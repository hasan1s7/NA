"""Provider contract and authenticated API tests. All provider traffic is mocked."""
from __future__ import annotations
import json
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from types import SimpleNamespace

import httpx
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from language_services import LanguageServices, ServiceSettings, PrivateCache, LANGUAGES, MAX_AUDIO_BYTES
from server import create_app, Speech, Translation

AUDIO = b'ID3' + b'\x00' * 200  # A contract fixture, NOT a playable or real voice sample.
PASSWORD = 'Natural voices test account 327!'


def text_request(**changes):
    data = dict(text='bank', sourceLang='en', targetLang='fr', context='The river bank.', formality='default')
    data.update(changes)
    return Translation(**data)


def speech_request(**changes):
    data = dict(text='Bonjour.', language='fr')
    data.update(changes)
    return Speech(**data)


def adapter(handler, **changes):
    values = dict(deepl_key='test-deepl:fx', speech_key='test-eleven-secret', default_voice='testVoice123')
    values.update(changes)
    return LanguageServices(ServiceSettings(**values), httpx.MockTransport(handler))


@pytest.mark.parametrize('lang,target', [('en','EN-US'), ('zh-CN','ZH-HANS'), ('pt','PT-BR'), ('ar','AR'), ('fr','FR'), ('ru','RU'), ('es','ES'), ('de','DE'), ('it','IT'), ('ja','JA'), ('ko','KO'), ('tr','TR')])
def test_deepl_language_codes_context_and_auth(lang, target):
    calls=[]
    def handler(req):
        calls.append(req)
        return httpx.Response(200, json={'translations':[{'text':'translated'}]})
    service=adapter(handler)
    source='fr' if lang=='en' else 'en'
    assert service.translate(text_request(sourceLang=source, targetLang=lang))=='translated'
    request=calls[0];data=json.loads(request.content)
    assert str(request.url)=='https://api-free.deepl.com/v2/translate'
    assert request.headers['Authorization']=='DeepL-Auth-Key test-deepl:fx'
    assert data['target_lang']==target and data['context']=='The river bank.'
    assert data['preserve_formatting'] is True
    assert 'model_type' not in data and 'note' not in data


def test_pro_quality_preference_and_regional_variants():
    calls=[]
    service=adapter(lambda req: (calls.append(json.loads(req.content)) or httpx.Response(200,json={'translations':[{'text':'test'}]})),
                    deepl_key='test-pro', english_target='EN-GB', portuguese_target='PT-PT')
    service.translate(text_request(sourceLang='fr',targetLang='en',formality='prefer_more'))
    assert calls[0]['target_lang']=='EN-GB'
    assert calls[0]['model_type']=='prefer_quality_optimized'
    assert calls[0]['formality']=='prefer_more'


@pytest.mark.parametrize('model', ['eleven_v4','eleven_v3','eleven_multilingual_v2','eleven_flash_v2_5'])
def test_speech_model_contract(model):
    calls=[]
    service=adapter(lambda req: (calls.append(req) or httpx.Response(200,content=AUDIO,headers={'Content-Type':'audio/mpeg'})),
                    model=model,voices={'fr':'nativeFrench123'})
    assert service.speech(speech_request())==AUDIO
    request=calls[0];data=json.loads(request.content)
    assert request.url.path.endswith('/nativeFrench123')
    assert request.headers['xi-api-key']=='test-eleven-secret'
    assert request.url.params['output_format']=='mp3_44100_128'
    assert data['model_id']==model and data['text']=='Bonjour.'
    assert ('language_code' in data)==(model!='eleven_multilingual_v2')
    assert ('voice_settings' in data)==(model!='eleven_v4')
    assert 'speed' not in data.get('voice_settings',{})
    assert 'enable_logging' not in request.url.params  # Do not promise enterprise-only zero retention.


@pytest.mark.parametrize('language',sorted(LANGUAGES))
def test_speech_language_hint(language):
    calls=[]
    service=adapter(lambda req: (calls.append(json.loads(req.content)) or httpx.Response(200,content=AUDIO,headers={'Content-Type':'audio/mpeg'})))
    service.speech(speech_request(language=language))
    assert calls[0]['language_code']==language.split('-')[0].lower()


@pytest.mark.parametrize('status,expected',[(400,422),(401,503),(402,429),(403,503),(404,422),(422,422),(429,429),(456,429),(500,502),(302,502)])
def test_provider_errors_are_sanitized_without_retry(status,expected):
    calls=[]
    service=adapter(lambda req:(calls.append(req) or httpx.Response(status,text='test-eleven-secret private upstream error')))
    with pytest.raises(HTTPException) as error:
        service.speech(speech_request())
    assert error.value.status_code==expected
    assert 'test-eleven-secret' not in str(error.value.detail)
    assert len(calls)==1


def test_provider_timeouts_are_not_automatically_retried():
    calls=[]
    def fail(req):
        calls.append(req)
        raise httpx.ReadTimeout('SECRET_TIMEOUT_DETAILS')
    service=adapter(fail)
    for method,data in [(service.speech,speech_request()), (service.translate,text_request())]:
        with pytest.raises(HTTPException) as error: method(data)
        assert error.value.status_code==504
        assert 'SECRET' not in error.value.detail
    assert len(calls)==2


@pytest.mark.parametrize('content,ctype',[(b'{}','application/json'),(b'','audio/mpeg'),(b'x'*(MAX_AUDIO_BYTES+1),'audio/mpeg')])
def test_reject_unusable_or_oversized_audio(content,ctype):
    service=adapter(lambda req:httpx.Response(200,content=content,headers={'Content-Type':ctype}))
    with pytest.raises(HTTPException) as error: service.speech(speech_request())
    assert error.value.status_code==502


@pytest.mark.parametrize('payload',[{}, {'translations':[]}, {'translations':[{'text':''}]}, {'translations':[{'text':123}]}])
def test_reject_malformed_translations(payload):
    service=adapter(lambda req:httpx.Response(200,json=payload))
    with pytest.raises(HTTPException) as error: service.translate(text_request())
    assert error.value.status_code==502


def test_voice_mapping_and_config_do_not_expose_credentials():
    settings=ServiceSettings(deepl_key='SECRET-D',speech_key='SECRET-E',voices={'ar':'arabic123'})
    public=settings.public_config()
    assert public['speechLanguages']==['ar']
    assert public['speechEnabled']
    assert 'SECRET' not in json.dumps(public)
    assert 'SECRET' not in repr(settings)
    assert not ServiceSettings(speech_key='x').public_config()['speechEnabled']


@pytest.mark.parametrize('changes',[{'model':'made_up'}, {'deepl_model':'made_up'}, {'voices':{'xx':'voice123'}}, {'voices':[]}, {'default_voice':'https://attacker.example/'}, {'voices':{'ar':''}}, {'english_target':'EN'}, {'portuguese_target':'PT'}])
def test_invalid_config_fails_closed(changes):
    with pytest.raises(RuntimeError): ServiceSettings(**changes)


@pytest.mark.parametrize('body',[{'text':'   ','language':'fr'}, {'text':'x'*2001,'language':'fr'}, {'text':'x','language':'xx'}, {'text':'x','language':'fr','voice_id':'unapproved'}])
def test_speech_input_validation(body):
    with pytest.raises(ValueError): Speech(**body)


def test_normalize_unicode_without_stripping_diacritics():
    assert speech_request(text=' cafe\u0301 ').text=='caf\u00e9'
    assert speech_request(text='\u0643\u064e\u062a\u064e\u0628\u064e',language='ar').text=='\u0643\u064e\u062a\u064e\u0628\u064e'


def test_cache_has_limits_ttl_and_account_isolation(monkeypatch):
    now=[10.0];monkeypatch.setattr('language_services.time.monotonic',lambda:now[0])
    cache=PrivateCache(5,2,60)
    cache.put(('alice','one'),b'123');cache.put(('bob','two'),b'45')
    assert cache.get(('alice','one'))==b'123'
    cache.put(('alice','three'),b'abc')
    assert cache.get(('bob','two')) is None
    assert cache.size<=5
    cache.remove_user('alice');assert cache.size==0
    cache.put(('bob','four'),b'12');now[0]=71
    assert cache.get(('bob','four')) is None


def test_cached_same_request_singleflight_and_private():
    service=adapter(lambda req:None);calls=[];charges=[]
    def generate():
        calls.append('generation');time.sleep(.03);return AUDIO
    def run(user='alice'):
        return service.cached('speech',user,{'text':'bonjour'},lambda:charges.append('reserved'),generate)
    with ThreadPoolExecutor(max_workers=4) as pool:
        results=list(pool.map(lambda _:run(),range(4)))
    assert len(calls)==len(charges)==1
    assert sorted(hit for _,hit in results)==[False,True,True,True]
    run('bob');assert len(calls)==2
    service.forget_user('alice');run();assert len(calls)==3


@pytest.fixture
def client_env(tmp_path,monkeypatch):
    monkeypatch.setenv('ELEVENLABS_API_KEY','fake-eleven-secret')
    monkeypatch.setenv('ELEVENLABS_VOICE_ID','voiceTest123')
    monkeypatch.setenv('NABU_SPEECH_DAILY_CHARS','20')
    monkeypatch.setenv('NABU_SPEECH_USER_DAILY_CHARS','12')
    app=create_app(tmp_path/'test.sqlite3','http://testserver',invite='',translation_key='fake-deepl:fx')
    generated=[]
    app.state.speech=lambda data:(generated.append(data.model_dump()) or AUDIO)
    app.state.translate=lambda data:'translated'
    with TestClient(app,headers={'Origin':'http://testserver'}) as client:
        yield app,client,generated


def register(client,name='alice'):
    response=client.post('/api/register',json={'handle':name,'password':PASSWORD})
    assert response.status_code==201
    client.headers['X-CSRF-Token']=response.json()['csrf']


def test_speech_requires_account_origin_and_csrf(client_env):
    app,client,generated=client_env;body={'text':'hello','language':'en'}
    assert client.post('/api/speech',json=body).status_code==401
    register(client)
    assert client.post('/api/speech',json=body,headers={'Origin':'https://evil.test'}).status_code==403
    assert client.post('/api/speech',json=body,headers={'X-CSRF-Token':'wrong'}).status_code==403
    assert not generated


def test_audio_cache_reuse_and_character_budget(client_env):
    app,client,generated=client_env;register(client)
    body={'text':'bonjour','language':'fr'}
    first=client.post('/api/speech',json=body)
    assert first.status_code==200 and first.content==AUDIO
    assert first.headers['x-nabu-audio-cache']=='miss'
    assert 'no-store' in first.headers['cache-control']
    assert client.post('/api/speech',json=body).headers['x-nabu-audio-cache']=='hit'
    assert len(generated)==1
    limited=client.post('/api/speech',json={'text':'another','language':'en'})
    assert limited.status_code==429 and len(generated)==1
    assert client.post('/api/speech',json=body).status_code==200 # Hits do not spend character quota.


def test_translation_context_changes_cache_identity(client_env):
    app,client,_=client_env;register(client)
    calls=[];app.state.translate=lambda data:(calls.append(data.context) or 'translated')
    body={'text':'bank','sourceLang':'en','targetLang':'fr','context':'river'}
    assert client.post('/api/translate',json=body).json()['cached'] is False
    assert client.post('/api/translate',json=body).json()['cached'] is True
    body['context']='money'
    assert client.post('/api/translate',json=body).json()['cached'] is False
    assert calls==['river','money']


def test_audio_extra_payload_fields_rejected_and_config_is_private(client_env):
    app,client,generated=client_env;register(client)
    response=client.post('/api/speech',json={'text':'hello','language':'en','note':'PRIVATE NOTE'})
    assert response.status_code==422 and not generated
    config=client.get('/api/config')
    assert 'fake-eleven-secret' not in config.text and 'fake-deepl' not in config.text
    assert config.json()['speechEnabled'] is True
    assert client.get('/api/health').json()['ok'] is True
    for path in ['/.env','/language_services.py','/compose.yaml']:
        assert client.get(path).status_code==404


def test_account_delete_removes_cached_audio(client_env):
    app,client,generated=client_env;register(client)
    assert client.post('/api/speech',json={'text':'bonjour','language':'fr'}).status_code==200
    assert app.state.language_services.speech_cache.size>0
    assert client.request('DELETE','/api/account',json={'password':PASSWORD}).status_code==200
    assert app.state.language_services.speech_cache.size==0


def test_deepl_auto_omits_optional_model_type(monkeypatch):
    monkeypatch.setenv('DEEPL_MODEL_TYPE','auto')
    assert ServiceSettings.from_env().deepl_model=='auto'
    calls=[]
    service=adapter(lambda req: (calls.append(json.loads(req.content)) or httpx.Response(200,json={'translations':[{'text':'test'}]})),
                    deepl_key='test-developer',deepl_model='auto')
    assert service.translate(text_request())=='test'
    assert 'model_type' not in calls[0]
