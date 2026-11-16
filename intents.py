"""Private, scoped intent records for the existing Nabu application.

This module stores what people say they want to do. It does not interpret their
text, grade learning evidence, or change the existing recommendation policy.
Authentication, origin/CSRF checks, SQLite connections and backups are supplied
by server.py. Team membership is the existing decision_engine membership.
"""
from __future__ import annotations

import json
import re
import time
from typing import Literal

from fastapi import Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

SCHEMA = """
CREATE TABLE IF NOT EXISTS nabu_intents (
 id TEXT PRIMARY KEY,
 owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 tenant_id TEXT REFERENCES decision_tenants(id) ON DELETE CASCADE,
 kind TEXT NOT NULL CHECK(kind IN ('learner','organization')),
 payload TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('active','paused','completed','abandoned')),
 revision INTEGER NOT NULL CHECK(revision >= 1),
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL,
 status_changed_at INTEGER NOT NULL,
 CHECK(kind = 'learner' OR tenant_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS nabu_intents_owner_scope
 ON nabu_intents(owner_user_id,tenant_id,kind,updated_at);
CREATE UNIQUE INDEX IF NOT EXISTS nabu_intents_active_organization
 ON nabu_intents(tenant_id) WHERE kind='organization' AND status='active';
CREATE TABLE IF NOT EXISTS nabu_intent_selections (
 owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 scope TEXT NOT NULL,
 tenant_id TEXT REFERENCES decision_tenants(id) ON DELETE CASCADE,
 mode TEXT NOT NULL CHECK(mode IN ('none','selected','exploring')),
 intent_id TEXT REFERENCES nabu_intents(id) ON DELETE SET NULL,
 updated_at INTEGER NOT NULL,
 PRIMARY KEY(owner_user_id,scope),
 CHECK(scope = COALESCE(tenant_id,''))
);
"""

LANGUAGES = {'en', 'ar', 'zh-CN', 'fr', 'ru', 'es', 'de', 'it', 'ja', 'ko', 'pt', 'tr'}
FIELDS = {
    'immediateActivity', 'destination', 'timeHorizon', 'languages', 'modalities',
    'sourceContent', 'context', 'constraints', 'preferences',
}
MAX_RECORDS_PER_SCOPE = 200
ObjectiveStatus = Literal['explicit', 'inferred', 'exploratory', 'unknown']
Lifecycle = Literal['active', 'paused', 'completed', 'abandoned']
ProvenanceSource = Literal['user_text', 'user_edit', 'local_parser', 'provider', 'reader_context', 'none']


def checked_text(value, maximum, *, verbatim=False):
    if value is None:
        return None
    if re.search(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f\ud800-\udfff]', value):
        raise ValueError('Unsupported control characters or malformed Unicode.')
    # Match browser String.length limits, including emoji represented by pairs.
    if len(value.encode('utf-16-le')) // 2 > maximum:
        raise ValueError('Text is too long.')
    return value if verbatim else re.sub(r'^[\s\ufeff]+|[\s\ufeff]+$', '', value) or None


class Model(BaseModel):
    model_config = ConfigDict(extra='forbid', strict=True, allow_inf_nan=False)


class FieldProvenance(Model):
    status: ObjectiveStatus
    source: ProvenanceSource
    evidence: str | None = Field(default=None, max_length=1200)

    @field_validator('evidence')
    @classmethod
    def text(cls, value):
        return checked_text(value, 1200)


class Provenance(Model):
    parser: str = Field(min_length=1, max_length=80)
    fields: dict[str, FieldProvenance]

    @field_validator('parser')
    @classmethod
    def parser_name(cls, value):
        clean = checked_text(value, 80)
        if not clean:
            raise ValueError('A parser identifier is required.')
        return clean

    @field_validator('fields')
    @classmethod
    def known_fields(cls, value):
        if set(value) != FIELDS:
            raise ValueError('Every intent field needs its own provenance.')
        return value


class SourceContent(Model):
    # A reference only: do not copy private paragraphs or media bodies.
    id: str = Field(min_length=1, max_length=160)
    version: str | None = Field(default=None, max_length=80)

    @field_validator('id')
    @classmethod
    def source_id(cls, value):
        clean = checked_text(value, 160)
        if not clean:
            raise ValueError('A source reference is required.')
        return clean

    @field_validator('version')
    @classmethod
    def source_version(cls, value):
        return checked_text(value, 80)


class IntentContent(Model):
    rawText: str = Field(max_length=1200)
    immediateActivity: str | None = Field(default=None, max_length=1200)
    destination: str | None = Field(default=None, max_length=400)
    timeHorizon: str | None = Field(default=None, max_length=120)
    languages: list[str] = Field(default_factory=list, max_length=12)
    modalities: list[Literal['reading', 'listening', 'speaking', 'writing', 'watching']] = Field(default_factory=list, max_length=5)
    sourceContent: SourceContent | None = None
    context: str | None = Field(default=None, max_length=500)
    constraints: list[str] = Field(default_factory=list, max_length=12)
    preferences: list[str] = Field(default_factory=list, max_length=12)
    objectiveStatus: ObjectiveStatus
    status: Lifecycle = 'active'
    provenance: Provenance

    @field_validator('rawText', 'immediateActivity', 'destination', 'timeHorizon', 'context')
    @classmethod
    def text(cls, value, info):
        limits = {'rawText': 1200, 'immediateActivity': 1200, 'destination': 400, 'timeHorizon': 120, 'context': 500}
        return checked_text(value, limits[info.field_name], verbatim=info.field_name == 'rawText')

    @field_validator('constraints', 'preferences')
    @classmethod
    def bounded_list(cls, values):
        values = [checked_text(v, 200) for v in values]
        if any(not v for v in values):
            raise ValueError('List items must be short, nonempty text.')
        if len(set(values)) != len(values):
            raise ValueError('List items must be distinct.')
        return values

    @field_validator('languages')
    @classmethod
    def supported_languages(cls, values):
        if any(v not in LANGUAGES for v in values) or len(set(values)) != len(values):
            raise ValueError('Use distinct supported languages.')
        return values

    @field_validator('modalities')
    @classmethod
    def distinct_modalities(cls, values):
        if len(set(values)) != len(values):
            raise ValueError('Modalities must be distinct.')
        return values

    @model_validator(mode='after')
    def valid(self):
        if not checked_text(self.rawText, 1200) and not self.immediateActivity:
            raise ValueError('Enter an intent, or choose to explore without one.')
        for key in FIELDS:
            value = getattr(self, key)
            empty = value is None or value == []
            if isinstance(value, str) and not value.strip():
                raise ValueError('Use null for unknown fields.')
            provenance = self.provenance.fields[key]
            if empty:
                if provenance.status != 'unknown' or provenance.source != 'none' or provenance.evidence:
                    raise ValueError('Unknown fields cannot claim evidence.')
            elif provenance.status == 'unknown' or provenance.source == 'none':
                raise ValueError('A populated field needs explicit or inferred provenance.')
            elif provenance.status == 'exploratory' and key != 'immediateActivity':
                raise ValueError('Exploratory provenance applies to the immediate activity.')
            if provenance.source == 'provider' and provenance.status != 'inferred':
                raise ValueError('Provider suggestions remain inferred until the learner confirms or edits them.')
        return self


class CreateIntent(Model):
    id: str = Field(pattern=r'^[A-Za-z0-9_-]{16,80}$')
    tenantId: str | None = Field(default=None, pattern=r'^[a-zA-Z0-9_-]{3,64}$')
    kind: Literal['learner', 'organization'] = 'learner'
    content: IntentContent


class EditIntent(Model):
    revision: int = Field(ge=1)
    content: IntentContent


class DeleteIntent(Model):
    revision: int = Field(ge=1)


class Selection(Model):
    mode: Literal['none', 'selected', 'exploring']
    intentId: str | None = Field(default=None, pattern=r'^[A-Za-z0-9_-]{16,80}$')

    @model_validator(mode='after')
    def valid(self):
        if (self.mode == 'selected') != (self.intentId is not None):
            raise ValueError('Only a selected intent may include an intent ID.')
        return self


def encode(content: IntentContent) -> str:
    return json.dumps(content.model_dump(exclude_none=False), ensure_ascii=False, separators=(',', ':'), sort_keys=True)


def output(row) -> dict:
    return {
        'schemaVersion': 1, 'id': row['id'], 'ownerUserId': row['owner_user_id'],
        'tenantId': row['tenant_id'], 'kind': row['kind'],
        **json.loads(row['payload']), 'revision': row['revision'],
        'createdAt': row['created_at'], 'updatedAt': row['updated_at'],
        'statusChangedAt': row['status_changed_at'],
    }


def install_intents(app, connection, authenticated, rate):
    def scope(conn, uid, tenant_id):
        if tenant_id is None:
            return None
        membership = conn.execute(
            'SELECT role FROM decision_memberships WHERE tenant_id=? AND user_id=?',
            (tenant_id, uid),
        ).fetchone()
        if not membership:
            raise HTTPException(403, 'You are not a member of this team.')
        return membership['role']

    def record(conn, uid, tenant_id, intent_id, *, role, write=False):
        row = conn.execute('SELECT * FROM nabu_intents WHERE id=? AND tenant_id IS ?', (intent_id, tenant_id)).fetchone()
        if row is None or (row['kind'] == 'learner' and row['owner_user_id'] != uid):
            raise HTTPException(404, 'Intent not found in this scope.')
        if write and row['kind'] == 'organization' and role != 'owner':
            raise HTTPException(403, 'Only the team owner may change its objective.')
        return row

    def selection(conn, uid, tenant_id):
        row = conn.execute(
            'SELECT mode,intent_id FROM nabu_intent_selections WHERE owner_user_id=? AND scope=?',
            (uid, tenant_id or ''),
        ).fetchone()
        if not row:
            return {'mode': 'none', 'intentId': None}
        if row['mode'] == 'selected':
            selected = conn.execute(
                "SELECT 1 FROM nabu_intents WHERE id=? AND owner_user_id=? AND tenant_id IS ? AND kind='learner' AND status='active'",
                (row['intent_id'], uid, tenant_id),
            ).fetchone()
            if not selected:
                return {'mode': 'none', 'intentId': None}
        return {'mode': row['mode'], 'intentId': row['intent_id'] if row['mode'] == 'selected' else None}

    def snapshot(conn, uid, tenant_id):
        role = scope(conn, uid, tenant_id)
        private = conn.execute(
            "SELECT * FROM nabu_intents WHERE owner_user_id=? AND tenant_id IS ? AND kind='learner' ORDER BY updated_at DESC,id",
            (uid, tenant_id),
        ).fetchall()
        organization = [] if tenant_id is None else conn.execute(
            "SELECT * FROM nabu_intents WHERE tenant_id=? AND kind='organization' ORDER BY updated_at DESC,id", (tenant_id,),
        ).fetchall()
        organizations = [output(row) for row in organization]
        return {
            'schemaVersion': 1, 'intents': [output(row) for row in private],
            'organizationObjective': next((row for row in organizations if row['status'] == 'active'), None),
            'organizationObjectives': organizations, 'selection': selection(conn, uid, tenant_id), 'role': role,
        }

    def read_intent_context(conn, uid, tenant_id):
        """One scoped reader for the original endpoint and decision inputs.

        The caller owns the read transaction. snapshot checks membership before
        any private or organization intent is selected.
        """
        data = snapshot(conn, uid, tenant_id)
        immediate = next((intent for intent in data['intents'] if intent['id'] == data['selection']['intentId']), None)
        return {
            'schemaVersion': 1,
            'actor': {'kind': 'team' if tenant_id else 'individual', 'userId': uid, 'tenantId': tenant_id},
            'selection': data['selection'], 'immediateIntent': immediate,
            'organizationObjective': data['organizationObjective'],
        }

    def assert_revision(row, expected):
        if row['revision'] != expected:
            raise HTTPException(409, 'This intent changed elsewhere. Reload it before saving your edits.')

    def assert_organization_slot(conn, tenant_id, content, except_id=None):
        if content.status != 'active':
            return
        row = conn.execute(
            "SELECT id FROM nabu_intents WHERE tenant_id=? AND kind='organization' AND status='active'", (tenant_id,),
        ).fetchone()
        if row and row['id'] != except_id:
            raise HTTPException(409, 'This team already has an active objective. Edit or pause it first.')

    @app.get('/api/intent-tenants')
    def list_tenants(session=Depends(authenticated)):
        with connection() as conn:
            rows = conn.execute(
                'SELECT t.id,t.label,m.role FROM decision_tenants t JOIN decision_memberships m ON m.tenant_id=t.id WHERE m.user_id=? ORDER BY t.label,t.id',
                (session['user_id'],),
            ).fetchall()
        return {'tenants': [dict(row) for row in rows]}

    @app.get('/api/intents')
    def list_intents(tenantId: str | None = Query(default=None, min_length=3, max_length=64, pattern=r'^[a-zA-Z0-9_-]+$'), session=Depends(authenticated)):
        with connection() as conn:
            conn.execute('BEGIN')
            return snapshot(conn, session['user_id'], tenantId)

    @app.post('/api/intents')
    def create_intent(body: CreateIntent, session=Depends(authenticated)):
        uid = session['user_id']
        rate('intent-write', uid, 600, 3600)
        payload = encode(body.content)
        with connection() as conn:
            conn.execute('BEGIN IMMEDIATE')
            role = scope(conn, uid, body.tenantId)
            if body.kind == 'organization' and (body.tenantId is None or role != 'owner'):
                raise HTTPException(403, 'Only a team owner may create its objective.')
            old = conn.execute('SELECT * FROM nabu_intents WHERE id=?', (body.id,)).fetchone()
            if old:
                if (old['owner_user_id'], old['tenant_id'], old['kind'], old['payload'], old['revision']) == (uid, body.tenantId, body.kind, payload, 1):
                    return {'intent': output(old)}
                raise HTTPException(409, 'That intent ID is already in use. Reload before retrying.')
            if body.kind == 'organization':
                assert_organization_slot(conn, body.tenantId, body.content)
                count = conn.execute("SELECT COUNT(*) FROM nabu_intents WHERE tenant_id=? AND kind='organization'", (body.tenantId,)).fetchone()[0]
            else:
                count = conn.execute("SELECT COUNT(*) FROM nabu_intents WHERE owner_user_id=? AND tenant_id IS ? AND kind='learner'", (uid, body.tenantId)).fetchone()[0]
            if count >= MAX_RECORDS_PER_SCOPE:
                raise HTTPException(409, 'This scope has reached its intent limit. Delete an unneeded intent before saving another.')
            now = int(time.time() * 1000)
            conn.execute('INSERT INTO nabu_intents VALUES(?,?,?,?,?,?,?,?,?,?)', (body.id, uid, body.tenantId, body.kind, payload, body.content.status, 1, now, now, now))
            if body.kind == 'learner' and body.content.status == 'active':
                conn.execute(
                    "INSERT INTO nabu_intent_selections VALUES(?,?,?,'selected',?,?) ON CONFLICT(owner_user_id,scope) DO UPDATE SET mode=excluded.mode,intent_id=excluded.intent_id,updated_at=excluded.updated_at",
                    (uid, body.tenantId or '', body.tenantId, body.id, now),
                )
            row = conn.execute('SELECT * FROM nabu_intents WHERE id=?', (body.id,)).fetchone()
            conn.commit()
            return {'intent': output(row)}

    @app.patch('/api/intents/{intent_id}')
    def edit_intent(intent_id: str, body: EditIntent, tenantId: str | None = Query(default=None, min_length=3, max_length=64, pattern=r'^[a-zA-Z0-9_-]+$'), session=Depends(authenticated)):
        uid = session['user_id']
        rate('intent-write', uid, 600, 3600)
        with connection() as conn:
            conn.execute('BEGIN IMMEDIATE')
            role = scope(conn, uid, tenantId)
            old = record(conn, uid, tenantId, intent_id, role=role, write=True)
            assert_revision(old, body.revision)
            if old['kind'] == 'organization':
                assert_organization_slot(conn, tenantId, body.content, except_id=intent_id)
            now = max(int(time.time() * 1000), old['updated_at'] + 1)
            changed_at = now if old['status'] != body.content.status else old['status_changed_at']
            conn.execute(
                'UPDATE nabu_intents SET payload=?,status=?,revision=revision+1,updated_at=?,status_changed_at=? WHERE id=?',
                (encode(body.content), body.content.status, now, changed_at, intent_id),
            )
            if body.content.status != 'active':
                conn.execute("UPDATE nabu_intent_selections SET mode='none',intent_id=NULL,updated_at=? WHERE intent_id=?", (now, intent_id))
            row = conn.execute('SELECT * FROM nabu_intents WHERE id=?', (intent_id,)).fetchone()
            conn.commit()
            return {'intent': output(row)}

    @app.delete('/api/intents/{intent_id}')
    def delete_intent(intent_id: str, body: DeleteIntent, tenantId: str | None = Query(default=None, min_length=3, max_length=64, pattern=r'^[a-zA-Z0-9_-]+$'), session=Depends(authenticated)):
        uid = session['user_id']
        rate('intent-write', uid, 600, 3600)
        with connection() as conn:
            conn.execute('BEGIN IMMEDIATE')
            role = scope(conn, uid, tenantId)
            old = record(conn, uid, tenantId, intent_id, role=role, write=True)
            assert_revision(old, body.revision)
            conn.execute("UPDATE nabu_intent_selections SET mode='none',intent_id=NULL,updated_at=? WHERE intent_id=?", (int(time.time() * 1000), intent_id))
            conn.execute('DELETE FROM nabu_intents WHERE id=?', (intent_id,))
            conn.commit()
        return {'deleted': intent_id}

    @app.put('/api/intent-selection')
    def set_selection(body: Selection, tenantId: str | None = Query(default=None, min_length=3, max_length=64, pattern=r'^[a-zA-Z0-9_-]+$'), session=Depends(authenticated)):
        uid = session['user_id']
        rate('intent-write', uid, 600, 3600)
        with connection() as conn:
            conn.execute('BEGIN IMMEDIATE')
            role = scope(conn, uid, tenantId)
            if body.mode == 'selected':
                row = record(conn, uid, tenantId, body.intentId, role=role)
                if row['kind'] != 'learner' or row['status'] != 'active':
                    raise HTTPException(409, 'Choose an active personal intent. Resume a paused intent before selecting it.')
            conn.execute(
                'INSERT INTO nabu_intent_selections VALUES(?,?,?,?,?,?) ON CONFLICT(owner_user_id,scope) DO UPDATE SET mode=excluded.mode,intent_id=excluded.intent_id,updated_at=excluded.updated_at',
                (uid, tenantId or '', tenantId, body.mode, body.intentId, int(time.time() * 1000)),
            )
            conn.commit()
        return {'selection': body.model_dump()}

    @app.get('/api/intent-context')
    def intent_context(tenantId: str | None = Query(default=None, min_length=3, max_length=64, pattern=r'^[a-zA-Z0-9_-]+$'), session=Depends(authenticated)):
        uid = session['user_id']
        with connection() as conn:
            conn.execute('BEGIN')
            return read_intent_context(conn, uid, tenantId)

    return read_intent_context
