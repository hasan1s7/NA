"""Account-private, bounded SQLite translation memory.

No raw requests, context, or credentials are retained here: only a request digest
and its translated answer. Answers can contain private material; backups remain
private too. This is not a public corpus and not provider billing telemetry.
"""
from __future__ import annotations
import json
import sqlite3
import time
from typing import Callable

SCHEMA = '''
CREATE TABLE IF NOT EXISTS translation_memory (
 owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 request_key TEXT NOT NULL,
 answer TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 accessed_at INTEGER NOT NULL,
 PRIMARY KEY(owner_id,request_key)
);
CREATE INDEX IF NOT EXISTS translation_memory_access ON translation_memory(accessed_at);
CREATE TABLE IF NOT EXISTS translation_memory_usage (
 owner_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 cache_hits INTEGER NOT NULL DEFAULT 0,
 provider_attempts INTEGER NOT NULL DEFAULT 0,
 submitted_chars INTEGER NOT NULL DEFAULT 0,
 avoided_chars INTEGER NOT NULL DEFAULT 0,
 generation INTEGER NOT NULL DEFAULT 0
);
'''


class TranslationMemory:
    def __init__(self, connection: Callable, per_account: int = 2000, total: int = 20000):
        self.connection = connection
        self.per_account, self.total = per_account, total

    def _ensure(self, conn, owner):
        # A late in-flight response must not recreate a deleted user's data.
        if not conn.execute('SELECT 1 FROM users WHERE id=?', (owner,)).fetchone():
            return False
        conn.execute('INSERT OR IGNORE INTO translation_memory_usage(owner_id) VALUES(?)', (owner,))
        return True

    def get(self, owner: str, key: str, characters: int):
        with self.connection() as conn:
            conn.execute('BEGIN IMMEDIATE')
            row = conn.execute('SELECT answer FROM translation_memory WHERE owner_id=? AND request_key=?', (owner, key)).fetchone()
            if row:
                conn.execute('UPDATE translation_memory SET accessed_at=? WHERE owner_id=? AND request_key=?', (time.time_ns(), owner, key))
                if self._ensure(conn, owner):
                    conn.execute('UPDATE translation_memory_usage SET cache_hits=cache_hits+1, avoided_chars=avoided_chars+? WHERE owner_id=?', (characters, owner))
            conn.commit()
            return row[0] if row else None

    def generation(self, owner: str):
        with self.connection() as conn:
            conn.execute('BEGIN IMMEDIATE')
            if not self._ensure(conn, owner):
                conn.commit()
                return None
            value = conn.execute('SELECT generation FROM translation_memory_usage WHERE owner_id=?', (owner,)).fetchone()[0]
            conn.commit()
            return value

    def attempt(self, owner: str, characters: int):
        with self.connection() as conn:
            conn.execute('BEGIN IMMEDIATE')
            if self._ensure(conn, owner):
                conn.execute('UPDATE translation_memory_usage SET provider_attempts=provider_attempts+1, submitted_chars=submitted_chars+? WHERE owner_id=?', (characters, owner))
            conn.commit()

    def put(self, owner: str, key: str, answer: str, generation: int | None):
        if not isinstance(answer, str) or not answer.strip() or len(answer) > 10000:
            raise ValueError('Only a usable translation can enter translation memory.')
        with self.connection() as conn:
            conn.execute('BEGIN IMMEDIATE')
            row = conn.execute('SELECT generation FROM translation_memory_usage WHERE owner_id=?', (owner,)).fetchone()
            if generation is None or not row or row[0] != generation:
                conn.commit()
                return False
            now = time.time_ns()
            conn.execute('INSERT OR REPLACE INTO translation_memory VALUES(?,?,?,?,?)', (owner, key, answer, now, now))
            conn.execute('DELETE FROM translation_memory WHERE owner_id=? AND request_key NOT IN(SELECT request_key FROM translation_memory WHERE owner_id=? ORDER BY accessed_at DESC,request_key LIMIT ?)', (owner, owner, self.per_account))
            conn.execute('DELETE FROM translation_memory WHERE rowid NOT IN(SELECT rowid FROM translation_memory ORDER BY accessed_at DESC,rowid DESC LIMIT ?)', (self.total,))
            conn.commit()
            return True

    def clear(self, owner: str):
        with self.connection() as conn:
            conn.execute('BEGIN IMMEDIATE')
            conn.execute('DELETE FROM translation_memory WHERE owner_id=?', (owner,))
            # Preserve counters and spending limits. Invalidate in-flight writes.
            conn.execute('UPDATE translation_memory_usage SET generation=generation+1 WHERE owner_id=?', (owner,))
            conn.commit()

    def stats(self, owner: str):
        with self.connection() as conn:
            row = conn.execute('SELECT cache_hits,provider_attempts,submitted_chars,avoided_chars FROM translation_memory_usage WHERE owner_id=?', (owner,)).fetchone()
            entries = conn.execute('SELECT count(*) FROM translation_memory WHERE owner_id=?', (owner,)).fetchone()[0]
        values = list(row) if row else [0, 0, 0, 0]
        return dict(zip(('cacheHits', 'providerAttempts', 'submittedCharacters', 'reusedCharacters'), values), entries=entries, scope='private-account', maxEntries=self.per_account)
