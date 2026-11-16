"""Server-only translation and speech adapters. No provider credentials reach public/.

Speech cache is process-memory-only. Translation memory is durable when a
server database is attached; all arbitrary text stays account-private.
Provider calls are never automatically retried: a timeout can still be billable.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import threading
import time
from collections import OrderedDict
from dataclasses import dataclass, field
from typing import Callable

import httpx
from fastapi import HTTPException

LANGUAGES = {'en', 'ar', 'zh-CN', 'fr', 'ru', 'es', 'de', 'it', 'ja', 'ko', 'pt', 'tr'}
MODELS = {'eleven_v4', 'eleven_v3', 'eleven_multilingual_v2', 'eleven_flash_v2_5'}
MAX_AUDIO_BYTES = 6 * 1024 * 1024


def positive_env(name: str, default: int) -> int:
    try:
        value = int(os.environ.get(name, str(default)))
        if not 1 <= value <= 100_000_000:
            raise ValueError()
        return value
    except ValueError:
        raise RuntimeError(f'{name} must be a positive integer, at most 100000000.') from None


@dataclass(frozen=True)
class ServiceSettings:
    deepl_key: str = field(default='', repr=False)
    speech_key: str = field(default='', repr=False)
    default_voice: str = ''
    voices: dict[str, str] = field(default_factory=dict)
    model: str = 'eleven_v4'
    deepl_model: str = 'prefer_quality_optimized'
    english_target: str = 'EN-US'
    portuguese_target: str = 'PT-BR'
    translation_daily: int = 50000
    speech_daily: int = 10000
    speech_user_daily: int = 3000

    def __post_init__(self):
        if self.deepl_model not in {'auto', 'prefer_quality_optimized', 'quality_optimized', 'latency_optimized'}:
            raise RuntimeError('DEEPL_MODEL_TYPE is not a supported model preference.')
        if self.model not in MODELS:
            raise RuntimeError('ELEVENLABS_MODEL_ID must be one of: ' + ', '.join(sorted(MODELS)))
        if self.english_target not in {'EN-US', 'EN-GB'}:
            raise RuntimeError('DEEPL_ENGLISH_TARGET must be EN-US or EN-GB.')
        if self.portuguese_target not in {'PT-BR', 'PT-PT'}:
            raise RuntimeError('DEEPL_PORTUGUESE_TARGET must be PT-BR or PT-PT.')
        if not isinstance(self.voices, dict) or set(self.voices) - LANGUAGES:
            raise RuntimeError('ELEVENLABS_VOICES_JSON must map Nabu language codes to voice IDs.')
        for voice in [self.default_voice, *self.voices.values()]:
            if not isinstance(voice, str) or (voice and not re.fullmatch(r'[A-Za-z0-9_-]{5,100}', voice)):
                raise RuntimeError('Use voice IDs, not names, URLs, or API keys, in the voice configuration.')
        if any(not value for value in self.voices.values()):
            raise RuntimeError('Each language-specific voice must have a nonempty ID.')

    @classmethod
    def from_env(cls, translation_key: str | None = None):
        try:
            voices = json.loads(os.environ.get('ELEVENLABS_VOICES_JSON', '{}'))
        except (TypeError, ValueError):
            raise RuntimeError('ELEVENLABS_VOICES_JSON must be valid JSON.') from None
        return cls(
            deepl_key=os.environ.get('DEEPL_API_KEY', '') if translation_key is None else translation_key,
            speech_key=os.environ.get('ELEVENLABS_API_KEY', ''),
            default_voice=os.environ.get('ELEVENLABS_VOICE_ID', '').strip(),
            voices=voices,
            deepl_model=os.environ.get('DEEPL_MODEL_TYPE', 'prefer_quality_optimized'),
            model=os.environ.get('ELEVENLABS_MODEL_ID', 'eleven_v4').strip(),
            english_target=os.environ.get('DEEPL_ENGLISH_TARGET', 'EN-US').strip(),
            portuguese_target=os.environ.get('DEEPL_PORTUGUESE_TARGET', 'PT-BR').strip(),
            translation_daily=positive_env('NABU_TRANSLATION_DAILY_CHARS', 50000),
            speech_daily=positive_env('NABU_SPEECH_DAILY_CHARS', 10000),
            speech_user_daily=positive_env('NABU_SPEECH_USER_DAILY_CHARS', 3000),
        )

    def voice_for(self, language: str) -> str:
        return self.voices.get(language, self.default_voice)

    def public_config(self) -> dict:
        languages = sorted(x for x in LANGUAGES if self.speech_key and self.voice_for(x))
        # Configured does not mean the provider has accepted the credentials.
        return {
            'translationEnabled': bool(self.deepl_key),
            'translationProvider': 'DeepL',
            'translationEnglish': self.english_target,
            'translationPortuguese': self.portuguese_target,
            'speechEnabled': bool(languages),
            'speechProvider': 'ElevenLabs',
            'speechModel': self.model,
            'speechLanguages': languages,
            'speechMatchedLanguages': sorted(self.voices),
            'speechMaxCharacters': 2000,
            'serviceStatus': 'configured-not-verified',
        }


class PrivateCache:
    """Thread-safe bounded LRU. Expired entries cannot be reused; eviction is lazy."""
    def __init__(self, max_bytes: int, max_entries: int, ttl: int):
        self.max_bytes, self.max_entries, self.ttl = max_bytes, max_entries, ttl
        self.entries = OrderedDict()
        self.size = 0
        self.lock = threading.Lock()

    def get(self, key):
        with self.lock:
            entry = self.entries.get(key)
            if entry is None:
                return None
            until, value, size = entry
            if until <= time.monotonic():
                self.entries.pop(key)
                self.size -= size
                return None
            self.entries.move_to_end(key)
            return value

    def put(self, key, value):
        size = len(value.encode('utf-8') if isinstance(value, str) else value)
        if size > self.max_bytes:
            return
        with self.lock:
            old = self.entries.pop(key, None)
            if old:
                self.size -= old[2]
            now = time.monotonic()
            for expired in [k for k, v in self.entries.items() if v[0] <= now]:
                self.size -= self.entries.pop(expired)[2]
            self.entries[key] = (now + self.ttl, value, size)
            self.size += size
            while self.size > self.max_bytes or len(self.entries) > self.max_entries:
                self.size -= self.entries.popitem(last=False)[1][2]

    def remove_user(self, user_id: str):
        with self.lock:
            for key in [k for k in self.entries if k[0] == user_id]:
                self.size -= self.entries.pop(key)[2]


class LanguageServices:
    def __init__(self, settings: ServiceSettings, transport: httpx.BaseTransport | None = None):
        self.settings, self.transport = settings, transport
        self.memory = None
        self.translation_cache = PrivateCache(4 * 1024 * 1024, 2000, 86400)
        self.speech_cache = PrivateCache(64 * 1024 * 1024, 256, 3600)
        self.slots = threading.BoundedSemaphore(2)
        self.stripes = [threading.Lock() for _ in range(32)]

    def cached(self, kind: str, user_id: str, payload: dict,
               reserve: Callable[[], None], generate: Callable[[], str | bytes]):
        request_key = payload
        if kind == 'translation':
            request_key = {'request': payload, 'pipeline': 'nabu-deepl-v1',
                'model': self.settings.deepl_model, 'english': self.settings.english_target,
                'portuguese': self.settings.portuguese_target,
                'freeEndpoint': self.settings.deepl_key.endswith(':fx'), 'preserveFormatting': True}
        digest = hashlib.sha256(json.dumps(request_key, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
        key = (user_id, digest)
        cache = self.speech_cache if kind == 'speech' else self.translation_cache
        lock = self.stripes[int(hashlib.sha256((user_id + kind + digest).encode()).hexdigest(), 16) % len(self.stripes)]
        # The same request waits for a running generation instead of paying twice.
        if not lock.acquire(timeout=45):
            raise HTTPException(429, 'This request is still being prepared. Try again shortly.', headers={'Retry-After': '5'})
        try:
            durable = kind == 'translation' and self.memory is not None
            characters = len(payload.get('text', ''))
            found = self.memory.get(user_id, digest, characters) if durable else cache.get(key)
            if found is not None:
                return found, True
            if not self.slots.acquire(blocking=False):
                raise HTTPException(429, 'The language service is busy. Try again shortly.', headers={'Retry-After': '5'})
            try:
                generation = self.memory.generation(user_id) if durable else None
                reserve()
                if durable:
                    self.memory.attempt(user_id, characters)
                value = generate()
                if durable:
                    self.memory.put(user_id, digest, value, generation)
                else:
                    cache.put(key, value)
                return value, False
            finally:
                self.slots.release()
        finally:
            lock.release()

    def forget_user(self, user_id: str):
        self.translation_cache.remove_user(user_id)
        if self.memory is not None:
            self.memory.clear(user_id)
        self.speech_cache.remove_user(user_id)

    @staticmethod
    def provider_error(status: int, name: str):
        if status in {401, 403}:
            raise HTTPException(503, f'{name} rejected the server credentials or permissions. Ask the owner to check the API account.')
        if status in {402, 429, 456}:
            raise HTTPException(429, f'{name} reached a quota or rate limit. No other provider was used.', headers={'Retry-After': '30'})
        if status in {400, 404, 422}:
            raise HTTPException(422, f'{name} could not use these language, voice, or model settings. Ask the owner to check the configuration.')
        if status != 200:
            raise HTTPException(502, f'{name} is temporarily unavailable. No other provider was used.')

    def translate(self, data) -> str:
        settings = self.settings
        endpoint = 'https://api-free.deepl.com/v2/translate' if settings.deepl_key.endswith(':fx') else 'https://api.deepl.com/v2/translate'
        target = {'en': settings.english_target, 'pt': settings.portuguese_target, 'zh-CN': 'ZH-HANS'}.get(data.targetLang, data.targetLang.upper())
        payload = {'text': [data.text], 'source_lang': data.sourceLang.split('-')[0].upper(),
                   'target_lang': target, 'preserve_formatting': True, 'formality': data.formality}
        if data.context:
            payload['context'] = data.context
        # The optional model selector is omitted on API Free for compatibility.
        if not settings.deepl_key.endswith(':fx') and settings.deepl_model != 'auto':
            payload['model_type'] = settings.deepl_model
        try:
            with httpx.Client(transport=self.transport, timeout=httpx.Timeout(25, connect=5),
                              follow_redirects=False, trust_env=False) as client:
                response = client.post(endpoint, headers={'Authorization': f'DeepL-Auth-Key {settings.deepl_key}'}, json=payload)
            self.provider_error(response.status_code, 'DeepL')
            value = response.json()['translations'][0]['text']
            if not isinstance(value, str) or not value.strip() or len(value) > 10000:
                raise ValueError()
            return value
        except HTTPException:
            raise
        except httpx.TimeoutException:
            raise HTTPException(504, 'DeepL took too long. Your text is still here; retry manually.') from None
        except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError):
            raise HTTPException(502, 'DeepL did not return a usable translation. Try again later.') from None

    def speech(self, data) -> bytes:
        settings = self.settings
        voice = settings.voice_for(data.language)
        if not settings.speech_key or not voice:
            raise HTTPException(503, 'A speech API credential and voice for this language must be configured on the server.')
        payload = {'text': data.text, 'model_id': settings.model}
        # Multilingual v2 explicitly does not support language_code.
        if settings.model != 'eleven_multilingual_v2':
            payload['language_code'] = data.language.split('-')[0].lower()
        # v4 has a different control surface; do not send legacy voice settings.
        # Rate changes happen in the player and reuse exactly the same audio.
        if settings.model != 'eleven_v4':
            payload['voice_settings'] = {'stability': 0.5, 'similarity_boost': 0.75, 'style': 0.0, 'use_speaker_boost': True}
        try:
            with httpx.Client(transport=self.transport, timeout=httpx.Timeout(40, connect=5),
                              follow_redirects=False, trust_env=False) as client:
                with client.stream('POST', f'https://api.elevenlabs.io/v1/text-to-speech/{voice}',
                                   params={'output_format': 'mp3_44100_128'},
                                   headers={'xi-api-key': settings.speech_key, 'Accept': 'audio/mpeg'}, json=payload) as response:
                    self.provider_error(response.status_code, 'ElevenLabs')
                    if response.headers.get('content-type', '').split(';')[0].lower() not in {'audio/mpeg', 'audio/mp3'}:
                        raise ValueError()
                    audio = bytearray()
                    for chunk in response.iter_bytes():
                        audio.extend(chunk)
                        if len(audio) > MAX_AUDIO_BYTES:
                            raise ValueError()
            if len(audio) < 32:
                raise ValueError()
            return bytes(audio)
        except HTTPException:
            raise
        except httpx.TimeoutException:
            raise HTTPException(504, 'Speech generation timed out. Retry manually; Nabu did not automatically resubmit it.') from None
        except (httpx.HTTPError, TypeError, ValueError):
            raise HTTPException(502, 'ElevenLabs did not return playable audio. Try again later.') from None
