"""Small media/capture integration. Additive tables; existing library stays authoritative.

Audio is transient, decoded in a bounded subprocess, and never stored in the DB.
Extension credentials are revocable, account-scoped and bound to one extension origin.
"""
from __future__ import annotations
import base64
import binascii
import hashlib
import importlib.util
import json
import logging
import os
import re
import secrets
import shutil
import subprocess
import tempfile
import threading
import time
import unicodedata
import uuid
import wave
from pathlib import Path
from typing import Literal
from urllib.parse import urlsplit
from fastapi import Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from social import Content, Card, Schedule, dump, now

ROOT = Path(__file__).resolve().parent
MAX_AUDIO_BYTES = 4 * 1024 * 1024
EXT_ORIGIN = re.compile(r'^chrome-extension://[a-p]{32}$')
SCHEMA = """
CREATE TABLE IF NOT EXISTS extension_tokens (
 id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 digest TEXT NOT NULL UNIQUE, extension_id TEXT NOT NULL, label TEXT NOT NULL,
 created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, last_used INTEGER
);
CREATE INDEX IF NOT EXISTS extension_token_owner ON extension_tokens(owner_id);
CREATE TABLE IF NOT EXISTS media_captures (
 owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 id TEXT NOT NULL, card_id TEXT NOT NULL, fingerprint TEXT NOT NULL,
 source_url TEXT NOT NULL, source_title TEXT NOT NULL, context TEXT NOT NULL,
 note TEXT NOT NULL, offset_seconds REAL, created_at INTEGER NOT NULL,
 PRIMARY KEY(owner_id,id),
 FOREIGN KEY(owner_id,card_id) REFERENCES cloud_cards(owner_id,id) ON DELETE CASCADE
);
"""

class Model(BaseModel):
    model_config = ConfigDict(extra='forbid', allow_inf_nan=False)

class TokenRequest(Model):
    extensionId: str = Field(pattern=r'^[a-p]{32}$')
    label: str = Field(default='My Chrome extension', min_length=1, max_length=60)
    days: int = Field(default=30, ge=1, le=90)

class AudioRequest(Model):
    audio: str = Field(min_length=8, max_length=5592410)
    mime: Literal['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/wav', 'audio/mpeg']
    language: str = Field(max_length=10)
    @field_validator('language')
    @classmethod
    def language_supported(cls, value):
        from language_services import LANGUAGES
        if value not in LANGUAGES: raise ValueError('Unsupported language.')
        return value

class CaptureRequest(Model):
    requestId: uuid.UUID
    content: Content
    sourceUrl: str = Field(default='', max_length=2000)
    sourceTitle: str = Field(default='', max_length=300)
    offsetSeconds: float | None = Field(default=None, ge=0, le=604800)
    @field_validator('sourceUrl')
    @classmethod
    def valid_url(cls, value):
        return safe_source_url(value)
    @field_validator('sourceTitle')
    @classmethod
    def valid_title(cls, value):
        if any(ord(x) < 32 for x in value): raise ValueError('Invalid title.')
        return value.strip()

class LookupRequest(Model):
    text: str = Field(min_length=1, max_length=2000)
    sourceLang: str
    targetLang: str
    context: str = Field(default='', max_length=1500)
    allowProvider: bool = False
    @model_validator(mode='after')
    def valid(self):
        from language_services import LANGUAGES
        self.text = unicodedata.normalize('NFC', self.text).strip()
        if not self.text or self.sourceLang not in LANGUAGES or self.targetLang not in LANGUAGES or self.sourceLang == self.targetLang:
            raise ValueError('Choose text and two supported, different languages.')
        if any(ord(x) < 32 and x not in '\n\t\r' for x in self.text+self.context):
            raise ValueError('Invalid control character.')
        return self

def safe_source_url(value):
    if not value: return ''
    try:
        u = urlsplit(value)
        if u.scheme not in ('http', 'https') or not u.hostname or u.username or u.password or any(ord(c)<33 for c in value):
            raise ValueError('Use an HTTP(S) source address without credentials.')
        _ = u.port
    except (TypeError, ValueError):
        raise ValueError('Use an HTTP(S) source address without credentials.') from None
    return value

def normalized_form(text):
    # Preserve accents, vowel marks and exact script. Search tolerance is not identity.
    return ' '.join(unicodedata.normalize('NFC', text).casefold().split())

class LocalTranscriber:
    """Optional faster-whisper backend. Explicit setup; no request-time download."""
    def __init__(self):
        configured = os.environ.get('NABU_WHISPER_MODEL_DIR', '').strip()
        self.path = Path(configured).expanduser().resolve() if configured else None
        self.lock = threading.Lock()
        self.model = None

    def ready(self):
        return bool(self.path and self.path.is_dir() and (self.path/'model.bin').is_file()
                    and (self.path/'tokenizer.json').is_file() and (self.path/'config.json').is_file() and shutil.which('ffmpeg')
                    and importlib.util.find_spec('faster_whisper'))

    def config(self):
        return {'transcriptionEnabled': self.ready(), 'transcriptionProvider': 'local faster-whisper',
                'transcriptionMaxSeconds': 60, 'transcriptionMaxBytes': MAX_AUDIO_BYTES,
                'transcriptionSetup': 'Install requirements-speech.txt, install FFmpeg, then run tools/setup_speech.py. Set the local model directory in private configuration and restart. See MEDIA_SETUP.md.'}

    def __call__(self, data: AudioRequest):
        try:
            raw = base64.b64decode(data.audio, validate=True)
        except (binascii.Error, ValueError):
            raise HTTPException(422, 'The recording is not valid base64 audio.') from None
        if not raw or len(raw) > MAX_AUDIO_BYTES:
            raise HTTPException(413, 'Use a recording of 4 MB or less.')
        signatures = {'audio/webm': lambda x:x.startswith(b'\x1aE\xdf\xa3'),
                      'audio/ogg':lambda x:x.startswith(b'OggS'),
                      'audio/wav':lambda x:x.startswith(b'RIFF') and x[8:12]==b'WAVE',
                      'audio/mp4':lambda x:len(x)>12 and x[4:8]==b'ftyp',
                      'audio/mpeg':lambda x:x.startswith(b'ID3') or x[:1]==b'\xff'}
        if not signatures[data.mime](raw):
            raise HTTPException(422, 'The recording format does not match its audio type.')
        if not self.ready():
            raise HTTPException(503, self.config()['transcriptionSetup'])
        if not self.lock.acquire(blocking=False):
            raise HTTPException(429, 'Another recording is being transcribed. Keep this recording and retry shortly.', headers={'Retry-After':'5'})
        try:
            with tempfile.TemporaryDirectory(prefix='nabu-audio-') as tmp:
                source = Path(tmp)/'input.audio'; target = Path(tmp)/'decoded.wav'
                source.write_bytes(raw)
                try:
                    subprocess.run([shutil.which('ffmpeg'), '-nostdin', '-v', 'error', '-protocol_whitelist', 'file,pipe',
                        '-i', str(source), '-t', '61', '-vn', '-ac', '1', '-ar', '16000', '-y', str(target)],
                        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=20, check=True)
                    with wave.open(str(target)) as wav:
                        duration = wav.getnframes()/wav.getframerate()
                        if duration > 60.5: raise HTTPException(413, 'Record at most 60 seconds at a time.')
                        if duration < 0.15: raise HTTPException(422, 'The recording is too short. Record some speech and try again.')
                except HTTPException: raise
                except (subprocess.SubprocessError, OSError, wave.Error):
                    raise HTTPException(422, 'This recording could not be decoded. Your original remains available in the browser.') from None
                if self.model is None:
                    from faster_whisper import WhisperModel
                    self.model = WhisperModel(str(self.path), device='cpu', compute_type='int8',
                                              cpu_threads=2, num_workers=1, local_files_only=True)
                language = data.language.split('-')[0]
                segments, _ = self.model.transcribe(str(target), language=language, beam_size=3,
                    condition_on_previous_text=False, vad_filter=True)
                text = ' '.join(s.text.strip() for s in segments).strip()
                if not text: raise HTTPException(422, 'No speech was detected. Listen to the recording and retry or type the text.')
                if len(text)>10000: raise HTTPException(422, 'The transcript is too long. Use a shorter recording.')
                return {'text':text, 'language':data.language, 'provider':'local faster-whisper',
                        'draft':True, 'audioRetained':False, 'durationSeconds':round(duration,2)}
        except HTTPException: raise
        except Exception as error:
            logging.getLogger('nabu.media').error('Local transcription failed (%s); audio and transcript omitted', type(error).__name__)
            raise HTTPException(503, 'Local transcription failed. Check the installed model and server log; the browser still has your recording.') from None
        finally: self.lock.release()


def install_media(app, connection, authenticated, rate, social, translate, Translation):
    transcriber = LocalTranscriber()
    app.state.transcribe = transcriber
    app.state.media_config = lambda: {**transcriber.config(), 'extensionCapture':True, 'captureVersion':1}
    entries = []
    for file in ['wordgraph-source.json', 'phrasebank-source.json']:
        entries.extend(json.loads((ROOT/'data'/file).read_text())['concepts'])
    index = {}
    for item in entries:
        for lang, form in item['terms'].items():
            for value in [form, *item.get('aliases',{}).get(lang,[])]:
                key = (lang, normalized_form(value))
                if not any(x['id']==item['id'] for x in index.setdefault(key,[])):
                    index[key].append(item)

    def token_user(request: Request):
        origin = request.headers.get('origin','')
        header = request.headers.get('authorization','')
        if not EXT_ORIGIN.fullmatch(origin) or not header.startswith('Bearer nabu_ext_'):
            raise HTTPException(401, 'Connect this extension in Nabu Settings first.')
        token = header[7:]
        if len(token)>150: raise HTTPException(401,'Invalid extension token.')
        digest = hashlib.sha256(token.encode()).hexdigest()
        with connection() as conn:
            row = conn.execute('SELECT t.*,u.handle FROM extension_tokens t JOIN users u ON u.id=t.owner_id WHERE t.digest=? AND t.expires_at>?', (digest, now())).fetchone()
            if not row or origin != 'chrome-extension://'+row['extension_id']:
                raise HTTPException(401, 'This extension connection expired or was revoked. Reconnect in Nabu Settings.')
            conn.execute('UPDATE extension_tokens SET last_used=? WHERE id=?',(now(),row['id']))
        return {'user_id':row['owner_id'], 'handle':row['handle']}

    @app.get('/api/extension-tokens')
    def list_tokens(user=Depends(authenticated)):
        with connection() as conn:
            return {'tokens':[dict(r) for r in conn.execute('SELECT id,extension_id,label,created_at,expires_at,last_used FROM extension_tokens WHERE owner_id=? ORDER BY created_at DESC',(user['user_id'],))]}

    @app.post('/api/extension-tokens')
    def issue_token(data: TokenRequest, user=Depends(authenticated)):
        rate('extension-token',user['user_id'],10,3600)
        token='nabu_ext_'+secrets.token_urlsafe(32); tid=str(uuid.uuid4()); start=now(); expires=start+data.days*86400000
        with connection() as conn:
            conn.execute('BEGIN IMMEDIATE')
            conn.execute('DELETE FROM extension_tokens WHERE owner_id=? AND expires_at<=?',(user['user_id'],start))
            if conn.execute('SELECT count(*) FROM extension_tokens WHERE owner_id=?',(user['user_id'],)).fetchone()[0]>=10:
                raise HTTPException(409,'Remove an unused extension connection first (maximum ten).')
            conn.execute('INSERT INTO extension_tokens VALUES(?,?,?,?,?,?,?,NULL)',(tid,user['user_id'],hashlib.sha256(token.encode()).hexdigest(),data.extensionId,data.label.strip(),start,expires))
            conn.commit()
        return {'id':tid,'token':token,'expiresAt':expires,'extensionId':data.extensionId}

    @app.delete('/api/extension-tokens/{token_id}')
    def revoke_token(token_id: uuid.UUID, user=Depends(authenticated)):
        with connection() as conn:
            result=conn.execute('DELETE FROM extension_tokens WHERE id=? AND owner_id=?',(str(token_id),user['user_id']))
            if not result.rowcount: raise HTTPException(404,'Connection not found.')
        return {'ok':True}

    @app.get('/api/extension/status')
    def status(user=Depends(token_user)):
        return {'handle':user['handle'],'accountId':user['user_id'],**app.state.media_config(),
                'translationEnabled':bool(app.state.language_services.settings.deepl_key)}

    @app.post('/api/extension/translate')
    def lookup(data: LookupRequest, user=Depends(token_user)):
        rate('extension-lookup',user['user_id'],180,3600)
        matches=index.get((data.sourceLang, normalized_form(data.text)),[])
        if matches:
            # A dictionary match is a proposal, not an assertion that context is understood.
            return {'status':'choose-meaning','provider':'Nabu draft word bank',
                    'candidates':[{'conceptId':c['id'],'meaning':c['terms'][data.targetLang], 'sense':c['sense']} for c in matches[:20]]}
        if not data.allowProvider:
            return {'status':'manual','candidates':[], 'message':'No exact bank match. Enter the meaning yourself, or explicitly allow the configured translation provider.'}
        result=translate(Translation(text=data.text,sourceLang=data.sourceLang,targetLang=data.targetLang,context=data.context),user)
        return {'status':'translated','meaning':result['translation'],'provider':result['provider'],'draft':True}

    @app.post('/api/extension/capture')
    def capture(data: CaptureRequest, user=Depends(token_user)):
        uid=user['user_id'];rate('extension-save',uid,300,3600)
        body=data.model_dump(mode='json'); fingerprint=hashlib.sha256(dump(body).encode()).hexdigest()
        timestamp=now()
        with connection() as conn:
            conn.execute('BEGIN IMMEDIATE')
            previous=conn.execute('SELECT * FROM media_captures WHERE owner_id=? AND id=?',(uid,str(data.requestId))).fetchone()
            if previous:
                if previous['fingerprint']!=fingerprint: raise HTTPException(409,'This save ID was already used for different content. Start a new save.')
                return {'saved':True,'replayed':True,'cardId':previous['card_id'],'captureId':str(data.requestId)}
            content=data.content.model_dump(mode='json')
            if content.get('conceptId'):
                matches=index.get((content['sourceLang'],normalized_form(content['front'])),[])
                match=next((c for c in matches if c['id']==content['conceptId'] and c['terms'][content['targetLang']]==content['back']),None)
                if not match: raise HTTPException(422,'The chosen bank meaning no longer matches this text. Translate again or save it as a manual meaning.')
            card=Card(**content,id=uuid.uuid4(),createdAt=timestamp,updatedAt=timestamp,revision=0,
                      schedule=Schedule(due=timestamp)).model_dump(mode='json')
            card['learningMode']='reference'
            old=social['existing'](conn,uid,card)
            if old:
                if old.get('archived'): old=social['save'](conn,uid,{**old,'archived':False},old)
                saved=old
            else: saved=social['save'](conn,uid,card)
            conn.execute('INSERT INTO media_captures VALUES(?,?,?,?,?,?,?,?,?,?)',(uid,str(data.requestId),saved['id'],fingerprint,data.sourceUrl,data.sourceTitle,content['context'],content['note'],data.offsetSeconds,timestamp))
            conn.commit()
        return {'saved':True,'replayed':False,'duplicate':old is not None,'cardId':saved['id'],'captureId':str(data.requestId)}

    @app.get('/api/captures/{card_id}')
    def captures(card_id: uuid.UUID, user=Depends(authenticated)):
        with connection() as conn:
            social['get_card'](conn,user['user_id'],str(card_id))
            rows=conn.execute('SELECT id,source_url,source_title,context,note,offset_seconds,created_at FROM media_captures WHERE owner_id=? AND card_id=? ORDER BY created_at DESC LIMIT 100',(user['user_id'],str(card_id)))
            return {'captures':[dict(row) for row in rows]}

    def transcribe_audio(data, user):
        rate('transcribe-hour',user['user_id'],30,3600)
        return app.state.transcribe(data)

    @app.post('/api/transcribe')
    def web_transcription(data:AudioRequest,user=Depends(authenticated)):
        return transcribe_audio(data,user)

    @app.post('/api/extension/transcribe')
    def extension_transcription(data:AudioRequest,user=Depends(token_user)):
        return transcribe_audio(data,user)
