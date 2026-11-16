"""Media API integration: real temp SQLite/auth; speech model is explicitly stubbed
only in the named dispatch test. No real microphone/provider/model inference."""
import base64, copy, hashlib, io, json, sqlite3, sys, time, uuid, wave
from pathlib import Path
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from server import create_app
from media_services import LocalTranscriber, AudioRequest, normalized_form, safe_source_url
EXT='a'*32; ORIGIN='chrome-extension://'+EXT

@pytest.fixture
def env(tmp_path, monkeypatch):
 monkeypatch.delenv('NABU_WHISPER_MODEL_DIR',raising=False)
 app=create_app(tmp_path/'media.sqlite3','http://testserver',invite='',translation_key='')
 clients=[]
 with TestClient(app,headers={'Origin':'http://testserver'}) as root:
  def new(name):
   c=TestClient(app,headers={'Origin':'http://testserver'});clients.append(c)
   r=c.post('/api/register',json={'handle':name,'password':'Media secure password 2026!'});assert r.status_code==201,r.text
   c.headers.update({'X-CSRF-Token':r.json()['csrf'],'X-Nabu-Account':r.json()['user']['id']});return c
  yield app,new,root
 for c in clients:c.close()

def issue(c):
 r=c.post('/api/extension-tokens',json={'extensionId':EXT,'label':'Test device'})
 assert r.status_code==200,r.text
 return r.json()
def ext(app,t):return TestClient(app,headers={'Origin':ORIGIN,'Authorization':'Bearer '+t['token']})
def payload(**updates):
 d={'requestId':str(uuid.uuid4()),'content':{'front':'water','back':'agua','sourceLang':'en','targetLang':'es','conceptId':'food.water','context':'A glass of water.','note':'Private media note'},'sourceUrl':'https://example.org/article','sourceTitle':'My article','offsetSeconds':12.5};d.update(updates);return d

def test_scoped_token_is_hashed_private_and_bound_to_extension(env):
 app,new,_=env;a=new('alice');b=new('bob');token=issue(a)
 with sqlite3.connect(app.state.db_path) as c:
  stored=c.execute('select digest from extension_tokens').fetchone()[0]
 assert stored==hashlib.sha256(token['token'].encode()).hexdigest()
 assert token['token'] not in a.get('/api/extension-tokens').text
 assert not b.get('/api/extension-tokens').json()['tokens']
 with ext(app,token) as x:
  r=x.get('/api/extension/status');assert r.status_code==200,r.text
  assert r.json()['handle']=='alice' and r.json()['extensionCapture']
  assert x.get('/api/library').status_code==401
  assert x.get('/api/extension/status',headers={'Origin':'chrome-extension://'+'b'*32}).status_code==401
  assert x.get('/api/extension/status',headers={'Origin':'https://example.org'}).status_code==403
  assert x.post('/api/register',json={'handle':'eve','password':'Eve secure password!'}).status_code==403

def test_token_creation_requires_csrf_and_valid_extension_id(env):
 app,new,root=env;a=new('alice')
 assert root.post('/api/extension-tokens',json={'extensionId':EXT}).status_code==401
 assert a.post('/api/extension-tokens',json={'extensionId':EXT},headers={'X-CSRF-Token':'bad'}).status_code==403
 for bad in ['abc','z'*32,'https://example.org']:
  assert a.post('/api/extension-tokens',json={'extensionId':bad}).status_code==422
 assert a.post('/api/extension-tokens',json={'extensionId':EXT,'days':91}).status_code==422

def test_expiry_revocation_and_cross_account_protection(env):
 app,new,_=env;a=new('alice');b=new('bob');t=issue(a)
 with ext(app,t) as x:
  assert b.request('DELETE','/api/extension-tokens/'+t['id'],json={}).status_code==404
  with sqlite3.connect(app.state.db_path) as c:c.execute('update extension_tokens set expires_at=0 where id=?',(t['id'],));c.commit()
  assert x.get('/api/extension/status').status_code==401
 t=issue(a)
 with ext(app,t) as x:
  assert a.request('DELETE','/api/extension-tokens/'+t['id'],json={}).status_code==200
  assert x.post('/api/extension/capture',json=payload()).status_code==401

def test_preflight_is_exact_and_cookie_free(env):
 app,_,root=env
 r=root.options('/api/extension/capture',headers={'Origin':ORIGIN,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization,content-type'})
 assert r.status_code==204
 assert r.headers['access-control-allow-origin']==ORIGIN
 assert 'access-control-allow-credentials' not in r.headers
 assert root.options('/api/extension/capture',headers={'Origin':'https://evil.example'}).status_code==403
 assert root.get('/words').headers['permissions-policy']=='camera=(), microphone=(self), geolocation=()'

def test_capture_uses_existing_library_and_private_encounter_table(env):
 app,new,_=env;a=new('alice');b=new('bob')
 with ext(app,issue(a)) as x:
  d=payload();r=x.post('/api/extension/capture',json=d);assert r.status_code==200,r.text
  cid=r.json()['cardId'];cards=a.get('/api/library').json()['cards'];assert len(cards)==1
  c=cards[0];assert c['id']==cid and c['learningMode']=='reference' and c['note']=='Private media note'
  assert c['schedule']['reps']==0 and c['schedule']['state']=='new'
  captures=a.get('/api/captures/'+cid).json()['captures'];assert len(captures)==1
  assert captures[0]['source_url']==d['sourceUrl'] and captures[0]['offset_seconds']==12.5
  assert b.get('/api/captures/'+cid).status_code==404
  assert x.get('/api/captures/'+cid).status_code==401

def test_replay_is_idempotent_changed_replay_conflicts(env):
 app,new,_=env;a=new('alice')
 with ext(app,issue(a)) as x:
  d=payload();one=x.post('/api/extension/capture',json=d);two=x.post('/api/extension/capture',json=d)
  assert one.status_code==two.status_code==200
  assert two.json()['replayed'] and one.json()['cardId']==two.json()['cardId']
  d['content']['note']='different';assert x.post('/api/extension/capture',json=d).status_code==409
  assert len(a.get('/api/library').json()['cards'])==1
  assert len(a.get('/api/captures/'+one.json()['cardId']).json()['captures'])==1

def test_second_encounter_does_not_overwrite_first_note(env):
 app,new,_=env;a=new('alice')
 with ext(app,issue(a)) as x:
  one=x.post('/api/extension/capture',json=payload());d=payload(sourceUrl='https://example.org/new');d['content']['note']='Second note';two=x.post('/api/extension/capture',json=d)
  assert two.json()['duplicate'] and two.json()['cardId']==one.json()['cardId']
  assert a.get('/api/library').json()['cards'][0]['note']=='Private media note'
  assert {c['note'] for c in a.get('/api/captures/'+one.json()['cardId']).json()['captures']}=={'Private media note','Second note'}

def test_context_and_form_matching_do_not_silently_collapse_meanings(env):
 assert normalized_form('Alcanc\u00e9')!=normalized_form('alcance')
 assert normalized_form(' CAF\u00c9 ')==normalized_form('cafe\u0301')
 app,new,_=env;a=new('alice')
 with ext(app,issue(a)) as x:
  r=x.post('/api/extension/translate',json={'text':'water','sourceLang':'en','targetLang':'es','context':'A glass of water'})
  assert r.status_code==200 and r.json()['status']=='choose-meaning'
  assert any(c['meaning']=='agua' for c in r.json()['candidates'])
  r=x.post('/api/extension/translate',json={'text':'zzq unknown','sourceLang':'en','targetLang':'es'})
  assert r.status_code==200 and r.json()['status']=='manual'
  assert x.post('/api/extension/translate',json={'text':'zzq unknown','sourceLang':'en','targetLang':'es','allowProvider':True}).status_code==503
  d=payload();d['content']['back']='incorrect selected meaning';assert x.post('/api/extension/capture',json=d).status_code==422
  d['content']['conceptId']='';assert x.post('/api/extension/capture',json=d).status_code==200

@pytest.mark.parametrize('url',['javascript:alert(1)','file:///tmp/abc','https://user:secret@example.org/x','https://example.org/x\n'])
def test_bad_source_urls_are_rejected(url):
 with pytest.raises(ValueError):safe_source_url(url)

def test_media_metadata_roundtrips_existing_library_schema(env):
 app,new,_=env;a=new('alice')
 with ext(app,issue(a)) as x:
  d=payload();d['content'].update(imageId='water',reading='water',readingMethod='User reading aid')
  r=x.post('/api/extension/capture',json=d);assert r.status_code==200,r.text
 c=a.get('/api/library').json()['cards'][0];assert c['imageId']=='water' and c['readingMethod']=='User reading aid'

def test_audio_auth_validation_and_honest_setup_state(env):
 app,new,root=env;a=new('alice')
 body={'audio':base64.b64encode(b'RIFFxxxxWAVEpayload').decode(),'mime':'audio/wav','language':'en'}
 assert root.post('/api/transcribe',json=body).status_code==401
 assert a.post('/api/transcribe',json={**body,'audio':'notbase64!!!!'}).status_code==422
 assert a.post('/api/transcribe',json={**body,'mime':'audio/ogg'}).status_code==422
 assert a.post('/api/transcribe',json={**body,'language':'xx'}).status_code==422
 r=a.post('/api/transcribe',json=body);assert r.status_code==503 and 'setup' in r.text.lower()
 assert not a.get('/api/config').json()['transcriptionEnabled']

def test_transcriber_dispatch_is_same_for_web_and_extension_using_explicit_stub(env):
 app,new,_=env;a=new('alice');calls=[]
 def stub(data):calls.append(data.language);return {'text':'Synthetic transcription fixture','draft':True,'audioRetained':False,'provider':'TEST STUB'}
 app.state.transcribe=stub
 body={'audio':'YWJjZGVmZ2g=','mime':'audio/wav','language':'es'}
 assert a.post('/api/transcribe',json=body).json()['provider']=='TEST STUB'
 with ext(app,issue(a)) as x:assert x.post('/api/extension/transcribe',json=body).json()['text']=='Synthetic transcription fixture'
 assert calls==['es','es']
 with sqlite3.connect(app.state.db_path) as conn:
  assert conn.execute('select count(*) from media_captures').fetchone()[0]==0

def wav_bytes(seconds=0.2):
 out=io.BytesIO()
 with wave.open(out,'wb') as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(16000);w.writeframes(b'\0\0'*int(16000*seconds))
 return out.getvalue()

def test_decoder_runs_real_ffmpeg_and_cleans_temporary_files_with_stub_model(monkeypatch):
 from types import SimpleNamespace
 import media_services
 import tempfile
 engine=LocalTranscriber();monkeypatch.setattr(engine,'ready',lambda:True)
 paths=[]
 class Model:
  def transcribe(self,path,**kwargs):
   paths.append(path);assert Path(path).is_file();assert kwargs['language']=='en'
   return iter([SimpleNamespace(text=' Synthetic model output ')]),None
 engine.model=Model()
 data=AudioRequest(audio=base64.b64encode(wav_bytes()).decode(),mime='audio/wav',language='en')
 r=engine(data);assert r['text']=='Synthetic model output' and r['audioRetained'] is False
 assert all(not Path(p).exists() for p in paths) and not engine.lock.locked()

@pytest.mark.parametrize('duration',[0.05,61])
def test_actual_decoder_rejects_too_short_or_long_recordings(monkeypatch,duration):
 engine=LocalTranscriber();monkeypatch.setattr(engine,'ready',lambda:True)
 data=AudioRequest(audio=base64.b64encode(wav_bytes(duration)).decode(),mime='audio/wav',language='en')
 with pytest.raises(HTTPException) as exc:engine(data)
 assert exc.value.status_code in (413,422) and not engine.lock.locked()

def test_transcriber_backpressure_never_loses_lock(monkeypatch):
 e=LocalTranscriber();monkeypatch.setattr(e,'ready',lambda:True);e.lock.acquire()
 with pytest.raises(HTTPException) as exc:e(AudioRequest(audio=base64.b64encode(wav_bytes()).decode(),mime='audio/wav',language='en'))
 assert exc.value.status_code==429 and e.lock.locked();e.lock.release()

def test_password_recovery_invalidates_extension_token(env):
 app,new,_=env;a=new('alice');t=issue(a)
 r=a.post('/api/account/recovery',json={'password':'Media secure password 2026!'})
 # Use the actual recovery route and code; do not retain plaintext in a test report.
 assert r.status_code==200,r.text
 code=r.json()['recoveryCode']
 c=TestClient(app,headers={'Origin':'http://testserver'})
 try:
  r=c.post('/api/recover',json={'handle':'alice','code':code,'password':'New secure media password!'})
  assert r.status_code==200,r.text
  with ext(app,t) as x:assert x.get('/api/extension/status').status_code==401
 finally:c.close()

def test_additive_media_tables_preserve_existing_account_library_on_restart(tmp_path):
 path=tmp_path/'upgrade.sqlite3'
 app=create_app(path,'http://testserver',invite='',translation_key='')
 with TestClient(app,headers={'Origin':'http://testserver'}) as c:
  r=c.post('/api/register',json={'handle':'existing','password':'Existing secure password!'});uid=r.json()['user']['id'];c.headers.update({'X-CSRF-Token':r.json()['csrf'],'X-Nabu-Account':uid})
  with ext(app,issue(c)) as x:assert x.post('/api/extension/capture',json=payload()).status_code==200
  before=c.get('/api/library').json()['cards']
 # Emulate the pre-media database boundary: existing user/card tables, no new tables.
 with sqlite3.connect(path) as conn:
  conn.execute('DROP TABLE media_captures');conn.execute('DROP TABLE extension_tokens');conn.commit()
 upgraded=create_app(path,'http://testserver',invite='',translation_key='')
 with TestClient(upgraded,headers={'Origin':'http://testserver'}) as c:
  r=c.post('/api/login',json={'handle':'existing','password':'Existing secure password!'});assert r.status_code==200
  c.headers.update({'X-CSRF-Token':r.json()['csrf'],'X-Nabu-Account':uid})
  assert c.get('/api/library').json()['cards']==before
  assert c.get('/api/extension-tokens').json()['tokens']==[]
