"""No live provider calls. Durable/private cache regression and deletion tests."""
import sqlite3
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from pathlib import Path

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from language_services import LanguageServices, ServiceSettings
from server import create_app
from translation_memory import TranslationMemory, SCHEMA


@pytest.fixture
def memory(tmp_path):
    path = tmp_path / 'memory.sqlite3'
    @contextmanager
    def connection():
        conn = sqlite3.connect(path, timeout=10, isolation_level=None)
        conn.execute('PRAGMA foreign_keys=ON')
        try:
            yield conn
        finally:
            conn.close()
    with connection() as conn:
        conn.executescript('CREATE TABLE users(id TEXT PRIMARY KEY);' + SCHEMA)
        conn.executemany('INSERT INTO users VALUES(?)', [('alice',), ('bob',)])
    return TranslationMemory(connection, per_account=3, total=4)


def service(memory, **kwargs):
    s = LanguageServices(ServiceSettings(**kwargs))
    s.memory = memory
    return s


def call(s, user='alice', text='bank', context='river', generate=lambda: 'rive', reserve=lambda: None):
    return s.cached('translation', user, dict(text=text, sourceLang='en', targetLang='fr', context=context, formality='default'), reserve, generate)


def test_survives_service_restart_and_is_private(memory):
    assert call(service(memory)) == ('rive', False)
    assert call(service(memory), generate=lambda: pytest.fail('unneeded provider')) == ('rive', True)
    assert call(service(memory), user='bob') == ('rive', False)
    assert memory.stats('alice')['cacheHits'] == 1
    assert memory.stats('alice')['providerAttempts'] == 1
    assert memory.stats('bob')['providerAttempts'] == 1


def test_context_case_and_settings_are_not_collapsed(memory):
    s = service(memory)
    assert call(s)[1] is False
    assert call(s, context='money')[1] is False
    assert call(s, text='BANK')[1] is False
    assert call(service(memory, english_target='EN-GB'))[1] is False


def test_singleflight_reserves_characters_only_once(memory):
    s = service(memory)
    counts = []
    def generate():
        counts.append(1)
        time.sleep(0.02)
        return 'rive'
    with ThreadPoolExecutor(max_workers=4) as pool:
        values = list(pool.map(lambda _: call(s, generate=generate), range(4)))
    assert len(counts) == 1
    assert sorted(v[1] for v in values) == [False, True, True, True]
    assert memory.stats('alice')['submittedCharacters'] == 4
    assert memory.stats('alice')['reusedCharacters'] == 12


def test_failures_do_not_cache_or_retry(memory):
    s = service(memory)
    def fail():
        raise HTTPException(504, 'timeout')
    with pytest.raises(HTTPException):
        call(s, generate=fail)
    assert memory.stats('alice')['entries'] == 0
    assert memory.stats('alice')['providerAttempts'] == 1
    assert call(s)[1] is False


def test_rejected_budget_does_not_count_provider_attempt(memory):
    def deny():
        raise HTTPException(429, 'budget')
    with pytest.raises(HTTPException):
        call(service(memory), reserve=deny)
    assert memory.stats('alice')['providerAttempts'] == 0


def test_clear_during_generation_cannot_resurrect_private_cache(memory):
    s = service(memory)
    def generate():
        memory.clear('alice')
        return 'rive'
    call(s, generate=generate)
    assert memory.stats('alice')['entries'] == 0
    assert memory.stats('alice')['providerAttempts'] == 1
    assert call(s)[1] is False


def test_account_delete_cascades_and_late_put_is_ignored(memory):
    call(service(memory))
    generation = memory.generation('alice')
    with memory.connection() as conn:
        conn.execute('DELETE FROM users WHERE id=?', ('alice',))
    assert not memory.put('alice', 'late', 'private answer', generation)
    assert memory.stats('alice')['entries'] == 0
    assert memory.stats('alice')['providerAttempts'] == 0


def test_eviction_is_bounded_not_ttl_and_clear_retains_counters(memory):
    s = service(memory)
    for n in range(5):
        call(s, text=str(n))
    assert memory.stats('alice')['entries'] == 3
    for n in range(3):
        call(s, user='bob', text=str(n))
    with memory.connection() as conn:
        assert conn.execute('SELECT COUNT(*) FROM translation_memory').fetchone()[0] == 4
    memory.clear('alice')
    assert memory.stats('alice')['entries'] == 0
    assert memory.stats('alice')['providerAttempts'] == 5


def test_no_credentials_or_raw_context_retained_in_table(memory):
    call(service(memory, deepl_key='SECRET_test_only'), context='PRIVATE SOURCE CONTEXT')
    with memory.connection() as conn:
        rows = str(conn.execute('SELECT * FROM translation_memory').fetchall())
    assert 'SECRET' not in rows and 'PRIVATE SOURCE CONTEXT' not in rows


@pytest.mark.parametrize('bad', ['', '  ', None, 'x' * 10001])
def test_memory_rejects_bad_results(memory, bad):
    g = memory.generation('alice')
    with pytest.raises(ValueError):
        memory.put('alice', 'a', bad, g)


def test_http_restart_clear_history_and_account_boundary(tmp_path, monkeypatch):
    monkeypatch.setenv('NABU_BACKUP_ENABLED', 'false')
    path = tmp_path / 'full.sqlite3'
    def app():
        a = create_app(path, 'http://testserver', invite='', translation_key='fake:fx')
        a.state.translate = lambda data: 'translated test answer'
        return a
    payload = {'text':'outside bank sample', 'sourceLang':'en', 'targetLang':'fr', 'context':'private'}
    password = 'Only a test password 12345!'
    with TestClient(app(), headers={'Origin':'http://testserver'}) as c:
        assert c.get('/api/language-memory').status_code == 401
        r = c.post('/api/register', json={'handle':'alice', 'password':password})
        c.headers['X-CSRF-Token'] = r.json()['csrf']
        assert c.post('/api/translate', json=payload).json()['cached'] is False
        assert c.request('DELETE', '/api/language-memory', json={}, headers={'X-CSRF-Token':'wrong'}).status_code == 403
    with TestClient(app(), headers={'Origin':'http://testserver'}) as c:
        r = c.post('/api/login', json={'handle':'alice', 'password':password})
        c.headers['X-CSRF-Token'] = r.json()['csrf']
        assert c.post('/api/translate', json=payload).json()['cached'] is True
        assert c.get('/api/language-memory').json()['entries'] == 1
        assert c.request('DELETE', '/api/library/history', json={}).status_code == 200
        assert c.get('/api/language-memory').json()['entries'] == 0
        assert c.post('/api/translate', json=payload).json()['cached'] is False
        assert c.request('DELETE', '/api/account', json={'password':password}).status_code == 200
    with sqlite3.connect(path) as conn:
        assert conn.execute('SELECT COUNT(*) FROM translation_memory').fetchone()[0] == 0
