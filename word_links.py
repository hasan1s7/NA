"""Owner-managed, expiring public word snapshots. No learner-state fields."""

import hashlib
import json
import re
import secrets
import sqlite3
import time
import unicodedata
import uuid

from fastapi import Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field

SCHEMA = """
CREATE TABLE IF NOT EXISTS word_links (
 slug TEXT PRIMARY KEY,
 owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 card_json TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL,
 revoked_at INTEGER,
 request_id TEXT NOT NULL,
 request_hash TEXT NOT NULL,
 UNIQUE(owner_id,request_id)
);
CREATE INDEX IF NOT EXISTS word_links_owner ON word_links(owner_id,created_at DESC);
PRAGMA user_version=4;
"""
SLUG = re.compile(r'^[a-z0-9][a-z0-9-]{0,63}-[A-Za-z0-9_-]{16}$')


def word_slug(front: str, source: str, target: str) -> str:
    """Readable prefix plus 96 bits of random capability, never just a word."""
    ascii_text = unicodedata.normalize('NFKD', front).encode('ascii', 'ignore').decode()
    word = re.sub(r'[^a-z0-9]+', '-', ascii_text.lower()).strip('-')[:30].rstrip('-') or 'word'
    return f'{word}-{source.lower()}-{target.lower()}-{secrets.token_urlsafe(12)}'


def install_word_links(app, connection, authenticated, rate, ip_key, Word, origin):
    class CreateLink(BaseModel):
        model_config = ConfigDict(extra='forbid')
        card: Word
        expiresDays: int = Field(default=30, ge=1, le=90, strict=True)
        requestId: uuid.UUID

    # Word is passed from the validated API model; resolve its local annotation.
    CreateLink.model_rebuild(_types_namespace={'Word': Word})

    def own_view(row):
        card = json.loads(row['card_json'])
        return {'slug': row['slug'], 'url': origin + '/w/' + row['slug'],
                'card': card, 'createdAt': row['created_at'] * 1000,
                'expiresAt': row['expires_at'] * 1000,
                'revoked': row['revoked_at'] is not None}

    @app.post('/api/word-links', status_code=201)
    def create(data: CreateLink, user=Depends(authenticated)):
        uid = user['user_id']
        rate('word-links-create', uid, 100, 86400)
        card = json.dumps(data.card.model_dump(), ensure_ascii=False, sort_keys=True, separators=(',', ':'))
        digest = hashlib.sha256((card + ':' + str(data.expiresDays)).encode()).hexdigest()
        now = int(time.time())
        with connection() as conn:
            conn.execute('BEGIN IMMEDIATE')
            old = conn.execute('SELECT * FROM word_links WHERE owner_id=? AND request_id=?',
                               (uid, str(data.requestId))).fetchone()
            if old:
                if old['request_hash'] != digest:
                    raise HTTPException(409, 'This link request was already used for different content.')
                if old['revoked_at'] is not None or old['expires_at'] <= now:
                    raise HTTPException(410, 'This link expired or was disabled. Create a new link.')
                return {**own_view(old), 'duplicate': True}
            count = conn.execute('SELECT COUNT(*) FROM word_links WHERE owner_id=? AND revoked_at IS NULL AND expires_at>?',
                                 (uid, now)).fetchone()[0]
            if count >= 200:
                raise HTTPException(409, 'You have 200 active links. Disable an old link before creating another.')
            for _ in range(5):
                slug = word_slug(data.card.front, data.card.sourceLang, data.card.targetLang)
                try:
                    conn.execute('INSERT INTO word_links VALUES(?,?,?,?,?,NULL,?,?)',
                                 (slug, uid, card, now, now + data.expiresDays * 86400,
                                  str(data.requestId), digest))
                    break
                except sqlite3.IntegrityError:
                    if not conn.execute('SELECT 1 FROM word_links WHERE slug=?', (slug,)).fetchone():
                        raise
            else:
                raise HTTPException(503, 'Could not allocate a link. Try again.')
            row = conn.execute('SELECT * FROM word_links WHERE slug=?', (slug,)).fetchone()
            conn.commit()
            return {**own_view(row), 'duplicate': False}

    @app.get('/api/word-links')
    def list_links(user=Depends(authenticated)):
        now = int(time.time())
        with connection() as conn:
            rows = conn.execute('SELECT * FROM word_links WHERE owner_id=? AND revoked_at IS NULL AND expires_at>? ORDER BY created_at DESC,slug LIMIT 200',
                                (user['user_id'], now)).fetchall()
        return {'links': [own_view(row) for row in rows]}

    @app.get('/api/word-links/{slug}')
    def read(slug: str, request: Request):
        # Deliberately identical 404s for absent, disabled and expired links.
        rate('word-links-read', ip_key(request), 180, 60)
        if not SLUG.fullmatch(slug):
            raise HTTPException(404, 'This word link is unavailable or has expired.')
        with connection() as conn:
            row = conn.execute('SELECT w.*,u.handle FROM word_links w JOIN users u ON u.id=w.owner_id WHERE w.slug=? AND w.revoked_at IS NULL AND w.expires_at>?',
                               (slug, int(time.time()))).fetchone()
        if not row:
            raise HTTPException(404, 'This word link is unavailable or has expired.')
        return {'card': json.loads(row['card_json']), 'sender': row['handle'],
                'verified': True, 'expiresAt': row['expires_at'] * 1000}

    @app.delete('/api/word-links/{slug}')
    def revoke(slug: str, user=Depends(authenticated)):
        rate('word-links-revoke', user['user_id'], 200, 3600)
        with connection() as conn:
            result = conn.execute('UPDATE word_links SET revoked_at=COALESCE(revoked_at,?) WHERE slug=? AND owner_id=?',
                                  (int(time.time()), slug, user['user_id']))
            if not result.rowcount:
                raise HTTPException(404, 'This link was not found in your account.')
        return {'ok': True}

    return CreateLink
