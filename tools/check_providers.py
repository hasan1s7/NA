"""Read-only account checks; --generate explicitly opts into metered content creation.
Use exported environment variables or run inside the supplied Docker Compose service.
Never prints API credentials or upstream response bodies.
"""
from __future__ import annotations
import argparse
from pathlib import Path
from types import SimpleNamespace
import sys
import httpx
from fastapi import HTTPException
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from language_services import LANGUAGES, LanguageServices, ServiceSettings


def main() -> int:
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--generate',action='store_true',help='Create one translation and one audio sample; consumes provider usage.')
    parser.add_argument('--language',choices=sorted(LANGUAGES),default='en')
    parser.add_argument('--text',default='Hello. Welcome to Nabu.')
    parser.add_argument('--output',default='samples/voice-check.mp3')
    args=parser.parse_args()
    try:
        settings=ServiceSettings.from_env()
    except RuntimeError as error:
        print('Configuration:',error);return 2
    failures=[]
    def check(label,url,headers):
        try:
            with httpx.Client(timeout=15,follow_redirects=False,trust_env=False) as client:
                response=client.get(url,headers=headers)
            if response.status_code!=200:
                print(f'{label}: HTTP {response.status_code}. Check credentials, scope and account access.')
                failures.append(label);return None
            return response.json()
        except (httpx.HTTPError,ValueError):
            print(f'{label}: request failed. Check connectivity and configuration.')
            failures.append(label);return None
    if settings.deepl_key:
        base='https://api-free.deepl.com' if settings.deepl_key.endswith(':fx') else 'https://api.deepl.com'
        usage=check('DeepL',base+'/v2/usage',{'Authorization':'DeepL-Auth-Key '+settings.deepl_key})
        if usage is not None:
            print('DeepL: account check passed. Translation capability still needs a live request.')
            if 'character_count' in usage:print('  Characters used:',usage['character_count'])
            if 'character_limit' in usage:print('  Account character limit:',usage['character_limit'])
    else:
        failures.append('DeepL');print('DeepL: DEEPL_API_KEY is not set.')
    if settings.speech_key:
        headers={'xi-api-key':settings.speech_key}
        models=check('ElevenLabs models','https://api.elevenlabs.io/v1/models',headers)
        if models is not None:
            available=isinstance(models,list) and any(x.get('model_id')==settings.model and x.get('can_do_text_to_speech') for x in models if isinstance(x,dict))
            if available:print('ElevenLabs: configured model is listed:',settings.model)
            else:print('ElevenLabs: configured model not found or not speech-capable.');failures.append('model')
        voice=settings.voice_for(args.language)
        if voice:
            found=check('ElevenLabs voice','https://api.elevenlabs.io/v1/voices/'+voice,headers)
            if found is not None:print('ElevenLabs: configured voice is accessible for the requested language mapping.')
        else:
            failures.append('voice');print('ElevenLabs: configure a voice ID for',args.language)
    else:
        failures.append('ElevenLabs');print('ElevenLabs: ELEVENLABS_API_KEY is not set.')
    if failures:
        print('Not ready. No translation or speech was generated.');return 2
    if not args.generate:
        print('Read-only checks finished. No text was translated or spoken. Use --generate for a metered live smoke test.');return 0
    if not args.text.strip() or len(args.text)>2000:
        print('Provide --text containing 1-2000 characters.');return 2
    print('Generating one translation and one speech sample. This consumes provider usage.')
    services=LanguageServices(settings)
    try:
        target='fr' if args.language=='en' else 'en'
        translation=services.translate(SimpleNamespace(text=args.text,sourceLang=args.language,targetLang=target,context='',formality='default'))
        print('Translation:',translation)
        audio=services.speech(SimpleNamespace(text=args.text,language=args.language))
        destination=Path(args.output);destination.parent.mkdir(parents=True,exist_ok=True);destination.write_bytes(audio)
        print('Saved speech sample:',destination)
    except HTTPException as error:
        print('Live test failed:',error.detail);return 2
    print('Live requests succeeded. Listen to the sample; this script cannot certify naturalness or pronunciation.');return 0

if __name__=='__main__':
    raise SystemExit(main())
