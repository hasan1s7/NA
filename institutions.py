"""Nabu 1.17: scoped assignments and reproducible assessment records.

This ledger is authoritative only for these assignments. It never copies personal
content_events or updates learner-model/SRS state. No provider receives its data.
"""
from __future__ import annotations

import hashlib
import json
import time
import unicodedata
import uuid
from typing import Literal

from fastapi import Depends, HTTPException, Query, Request
from pydantic import BaseModel, ConfigDict, Field, model_validator

LANGUAGES = {'en', 'ar', 'zh-CN', 'fr', 'ru', 'es', 'tr', 'de', 'ko', 'ja', 'it', 'pt'}
SCORER = 'nabu-assignment-exact-v1'
SUPPORT_POLICY = 'department-support-v1'
SUPPORT_MINIMUM = 5
SUPPORT_TERMS = (
    'Optional: include your past and future accepted assignment results in this workspace in '
    'coarse departmental support summaries visible to the workspace owner. These summaries '
    'include task-specific match, assistance, missing-response and correction-request categories; '
    'they exclude your raw answers, private reading, notes, vocabulary and intentions. '
    'At least five opted-in current learners with accepted assignments are required, and small '
    'categories are suppressed. This is not anonymity or differential privacy: repeated summaries '
    'and other knowledge may reveal information. You may withdraw from future summaries without '
    'leaving the workspace; withdrawal cannot erase summaries already seen or exported. '
    'This choice does not change the named reviewers or terms of your individual assignments.'
    ' Choice changes are recorded with your account identifier in the owner-visible audit log; '
    'participation is not anonymous.'
)
SUPPORT_NOTICE = (
    'Descriptive assignment support only; not mastery, proficiency, a Bayesian estimate or a '
    'learning-gain measure. Each eligible learner contributes to one priority category. '
    'Only first responses and their latest assessments are used for match/assistance evidence; '
    'retries do not add learners. Bands and small-group suppression are not anonymity or '
    'differential privacy. Repeated summaries and other knowledge may reveal information. '
    'No raw answers, learner identifiers or private learning history are returned.'
)
SUPPORT_CATEGORIES = (
    ('correction_pending', 'Correction requests need review', 'review_corrections',
     'Ask the named reviewers to address pending correction requests before drawing conclusions about understanding.'),
    ('review_rubric', 'First responses need rubric review', 'review_rubrics',
     'Review the authored rubric and acceptable alternatives before offering targeted practice; a non-match is not proof of inability.'),
    ('awaiting_response', 'Some accepted tasks await evidence', 'offer_task_support',
     'Offer optional onboarding or task support. A missing response is not a failed response or evidence of inability.'),
    ('assisted_evidence', 'Matches include available or reported help', 'offer_optional_unassisted_check',
     'If useful and agreed, offer a later unassisted task. Source availability and self-reported help limit the interpretation of a match.'),
    ('task_matches', 'First responses match these task rubrics', 'continue_meaningful_content',
     'Continue with meaningful content and a later appropriate check. Task-specific matches do not establish general proficiency.'),
)
SCHEMA = """
CREATE TABLE IF NOT EXISTS institution_policy (
 tenant_id TEXT PRIMARY KEY REFERENCES decision_tenants(id) ON DELETE CASCADE,
 offline_responses INTEGER NOT NULL DEFAULT 0, revision INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS institution_support_consent (
 tenant_id TEXT NOT NULL REFERENCES decision_tenants(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 enabled INTEGER NOT NULL CHECK(enabled IN (0,1)),
 revision INTEGER NOT NULL CHECK(revision >= 1), terms_version TEXT NOT NULL,
 PRIMARY KEY(tenant_id,user_id));
CREATE TABLE IF NOT EXISTS institution_sources (
 tenant_id TEXT NOT NULL REFERENCES decision_tenants(id) ON DELETE CASCADE,
 id TEXT NOT NULL, version INTEGER NOT NULL, payload TEXT NOT NULL,
 created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, created_at INTEGER NOT NULL,
 PRIMARY KEY(tenant_id,id,version));
CREATE TABLE IF NOT EXISTS institution_tasks (
 tenant_id TEXT NOT NULL REFERENCES decision_tenants(id) ON DELETE CASCADE,
 id TEXT NOT NULL, payload TEXT NOT NULL, created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 created_at INTEGER NOT NULL, PRIMARY KEY(tenant_id,id));
CREATE TABLE IF NOT EXISTS institution_rubrics (
 tenant_id TEXT NOT NULL, task_id TEXT NOT NULL, version INTEGER NOT NULL,
 payload TEXT NOT NULL, reason TEXT NOT NULL, created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 created_at INTEGER NOT NULL, PRIMARY KEY(tenant_id,task_id,version),
 FOREIGN KEY(tenant_id,task_id) REFERENCES institution_tasks(tenant_id,id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS institution_assignments (
 tenant_id TEXT NOT NULL, id TEXT NOT NULL, learner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 task_id TEXT NOT NULL, rubric_version INTEGER NOT NULL, payload TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('offered','accepted','declined','revoked')),
 created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 created_at INTEGER NOT NULL, accepted_at INTEGER, PRIMARY KEY(tenant_id,id),
 FOREIGN KEY(tenant_id,task_id,rubric_version) REFERENCES institution_rubrics(tenant_id,task_id,version) ON DELETE CASCADE);
CREATE INDEX IF NOT EXISTS institution_assignment_learner ON institution_assignments(learner_id,tenant_id);
CREATE TABLE IF NOT EXISTS institution_reviewers (
 tenant_id TEXT NOT NULL, assignment_id TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 PRIMARY KEY(tenant_id,assignment_id,user_id),
 FOREIGN KEY(tenant_id,assignment_id) REFERENCES institution_assignments(tenant_id,id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS institution_attempts (
 tenant_id TEXT NOT NULL, id TEXT NOT NULL, assignment_id TEXT NOT NULL,
 payload TEXT NOT NULL, received_at INTEGER NOT NULL, retry_of TEXT,
 PRIMARY KEY(tenant_id,id),
 FOREIGN KEY(tenant_id,assignment_id) REFERENCES institution_assignments(tenant_id,id) ON DELETE CASCADE,
 FOREIGN KEY(tenant_id,retry_of) REFERENCES institution_attempts(tenant_id,id) ON DELETE CASCADE);
CREATE UNIQUE INDEX IF NOT EXISTS institution_first_attempt ON institution_attempts(tenant_id,assignment_id) WHERE retry_of IS NULL;
CREATE TABLE IF NOT EXISTS institution_assessments (
 tenant_id TEXT NOT NULL, id TEXT NOT NULL, attempt_id TEXT NOT NULL,
 rubric_version INTEGER NOT NULL, payload TEXT NOT NULL, created_at INTEGER NOT NULL,
 created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, supersedes TEXT,
 PRIMARY KEY(tenant_id,id),
 FOREIGN KEY(tenant_id,attempt_id) REFERENCES institution_attempts(tenant_id,id) ON DELETE CASCADE,
 FOREIGN KEY(tenant_id,supersedes) REFERENCES institution_assessments(tenant_id,id) ON DELETE CASCADE);
CREATE UNIQUE INDEX IF NOT EXISTS institution_one_successor ON institution_assessments(tenant_id,supersedes) WHERE supersedes IS NOT NULL;
CREATE TABLE IF NOT EXISTS institution_appeals (
 tenant_id TEXT NOT NULL, id TEXT NOT NULL, assignment_id TEXT NOT NULL, payload TEXT NOT NULL,
 created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, created_at INTEGER NOT NULL,
 PRIMARY KEY(tenant_id,id),
 FOREIGN KEY(tenant_id,assignment_id) REFERENCES institution_assignments(tenant_id,id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS institution_audit (
 sequence INTEGER PRIMARY KEY AUTOINCREMENT,
 tenant_id TEXT NOT NULL REFERENCES decision_tenants(id) ON DELETE CASCADE,
 actor_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 action TEXT NOT NULL, reference TEXT NOT NULL, at INTEGER NOT NULL);
"""


def pack(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'))


def now():
    return int(time.time() * 1000)


class Model(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)


ID = Field(min_length=8, max_length=80, pattern=r'^[A-Za-z0-9_-]+$')


class Member(Model):
    handle: str = Field(pattern=r'^[A-Za-z0-9_]{3,24}$')


class Policy(Model):
    revision: int = Field(ge=1, le=2147483647, strict=True)
    offlineResponses: bool = Field(strict=True)


class SupportConsent(Model):
    policyVersion: Literal['department-support-v1']
    revision: int = Field(ge=1, le=2147483647, strict=True)
    enabled: bool = Field(strict=True)


class Source(Model):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=False)  # Preserve original text byte-for-byte in Unicode.
    id: str = ID
    version: int = Field(default=1, ge=1, le=2147483647, strict=True)
    title: str = Field(min_length=1, max_length=160)
    text: str = Field(min_length=1, max_length=16000)
    language: str
    attribution: str = Field(min_length=1, max_length=1000)
    rights: str = Field(min_length=1, max_length=1000)

    @model_validator(mode='after')
    def valid(self):
        if self.language not in LANGUAGES or not self.text.strip() or not self.title.strip():
            raise ValueError('Unsupported language.')
        return self


class Rubric(Model):
    acceptedAnswers: list[str] = Field(default_factory=list, max_length=30)
    answerIndex: int | None = Field(default=None, ge=0, le=7, strict=True)
    normalization: Literal['nfc-trim', 'nfc-casefold-space'] = 'nfc-trim'

    @model_validator(mode='after')
    def valid(self):
        if any(not x.strip() or len(x) > 2000 for x in self.acceptedAnswers):
            raise ValueError('Accepted answers must be nonempty and bounded.')
        if bool(self.acceptedAnswers) == (self.answerIndex is not None):
            raise ValueError('Supply recall answers or one choice index.')
        return self


class Task(Model):
    id: str = ID
    title: str = Field(min_length=1, max_length=160)
    sourceId: str = ID
    sourceVersion: int = Field(ge=1, le=2147483647, strict=True)
    prompt: str = Field(min_length=1, max_length=2000)
    mode: Literal['recognition', 'recall']
    options: list[str] = Field(default_factory=list, max_length=8)
    sourceVisible: bool = Field(default=True, strict=True)
    rubric: Rubric

    @model_validator(mode='after')
    def valid(self):
        validate_rubric(self.model_dump(), self.rubric.model_dump())
        if any(not x.strip() or len(x) > 1000 for x in self.options):
            raise ValueError('Invalid option.')
        return self


def validate_rubric(task, rubric):
    if task['mode'] == 'recognition':
        if not 2 <= len(task['options']) <= 8 or rubric['answerIndex'] is None or rubric['answerIndex'] >= len(task['options']) or rubric['acceptedAnswers']:
            raise ValueError('Recognition needs options and a valid answer index.')
    elif task['options'] or rubric['answerIndex'] is not None or not rubric['acceptedAnswers']:
        raise ValueError('Recall needs accepted answers and no options.')


class RubricRevision(Model):
    expectedVersion: int = Field(ge=1, le=2147483647, strict=True)
    rubric: Rubric
    reason: str = Field(min_length=3, max_length=1500)


class Assignment(Model):
    id: str = ID
    learnerId: str = Field(min_length=1, max_length=128)
    taskId: str = ID
    rubricVersion: int = Field(ge=1, le=2147483647, strict=True)
    reviewerIds: list[str] = Field(min_length=1, max_length=10)
    sharing: Literal['results', 'responses'] = 'responses'
    objective: str = Field(min_length=1, max_length=1000)

    @model_validator(mode='after')
    def valid(self):
        if len(set(self.reviewerIds)) != len(self.reviewerIds):
            raise ValueError('Duplicate reviewers.')
        return self


class Acceptance(Model):
    decision: Literal['accepted', 'declined']


class Assistance(Model):
    sourceConsulted: bool = Field(default=False, strict=True)
    translation: bool = Field(default=False, strict=True)
    hint: bool = Field(default=False, strict=True)
    other: bool = Field(default=False, strict=True)


class Attempt(Model):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=False)  # Preserve the submitted response before normalization.
    id: str = ID
    assignmentId: str = ID
    response: str = Field(default='', max_length=2000)
    choice: int | None = Field(default=None, ge=0, le=7, strict=True)
    occurredAt: int = Field(ge=0, le=8640000000000000, strict=True)
    retryOf: str | None = Field(default=None, min_length=8, max_length=80, pattern=r'^[A-Za-z0-9_-]+$')
    assistance: Assistance
    offline: bool = Field(default=False, strict=True)


class Reassessment(Model):
    id: str = ID
    expectedAssessmentId: str = ID
    rubricVersion: int = Field(ge=1, le=2147483647, strict=True)
    reason: str = Field(min_length=3, max_length=1500)


class Appeal(Model):
    id: str = ID
    assessmentId: str = ID
    reason: str = Field(min_length=3, max_length=1500)


def normalized(text, policy):
    value = unicodedata.normalize('NFC', text).strip()
    return ' '.join(value.casefold().split()) if policy == 'nfc-casefold-space' else value


def score(task, rubric, observation):
    """Bounded exact rubric, no semantics, accent stripping or proficiency claim."""
    if task['mode'] == 'recognition':
        matched = observation['choice'] == rubric['answerIndex']
    else:
        value = normalized(observation['response'], rubric['normalization'])
        matched = value in [normalized(x, rubric['normalization']) for x in rubric['acceptedAnswers']]
    flags = {**observation['assistance'], 'sourceAvailable': task['sourceVisible'], 'previousFeedback': observation['retryOf'] is not None}
    return {'matched': matched, 'interpretation': 'Matches this rubric.' if matched else 'Does not match this rubric; another valid answer may need review.',
            'mode': task['mode'], 'modality': 'reading', 'assistance': flags,
            'assisted': any(flags.values()), 'conditionsVerified': False,
            'firstResponse': observation['retryOf'] is None,
            'scorerVersion': SCORER, 'mastery': None,
            'limits': 'Exact authored rubric. Assistance is partly self-reported. No proctoring, proficiency certification, or learning-gain estimate.'}


def install_institutions(app, connection, authenticated, rate):
    def member(c, tenant, uid, owner=False):
        row = c.execute('SELECT role FROM decision_memberships WHERE tenant_id=? AND user_id=?', (tenant, uid)).fetchone()
        if not row or owner and row['role'] != 'owner':
            raise HTTPException(403, 'Current workspace membership' + (' with owner authority' if owner else '') + ' is required.')
        return row['role']

    def audit(c, tenant, uid, action, ref):
        c.execute('INSERT INTO institution_audit(tenant_id,actor_id,action,reference,at) VALUES(?,?,?,?,?)', (tenant, uid, action, ref, now()))

    def policy(c, tenant):
        row = c.execute('SELECT * FROM institution_policy WHERE tenant_id=?', (tenant,)).fetchone()
        return {'revision': row['revision'] if row else 1, 'offlineResponses': bool(row and row['offline_responses']),
                'externalAI': False, 'scorer': SCORER}

    def task(c, tenant, identifier):
        row = c.execute('SELECT payload FROM institution_tasks WHERE tenant_id=? AND id=?', (tenant, identifier)).fetchone()
        if not row:
            raise HTTPException(404, 'Task unavailable in this workspace.')
        return json.loads(row['payload'])

    def rubric(c, tenant, identifier, version):
        row = c.execute('SELECT * FROM institution_rubrics WHERE tenant_id=? AND task_id=? AND version=?', (tenant, identifier, version)).fetchone()
        if not row:
            raise HTTPException(404, 'Rubric version unavailable.')
        return {**dict(row), 'payload': json.loads(row['payload'])}

    def source(c, tenant, t):
        row = c.execute('SELECT payload FROM institution_sources WHERE tenant_id=? AND id=? AND version=?', (tenant, t['sourceId'], t['sourceVersion'])).fetchone()
        if not row:
            raise HTTPException(404, 'Source version unavailable.')
        return json.loads(row['payload'])

    def assignment(c, tenant, identifier):
        row = c.execute('SELECT * FROM institution_assignments WHERE tenant_id=? AND id=?', (tenant, identifier)).fetchone()
        if not row:
            raise HTTPException(404, 'Assignment unavailable.')
        return row

    def permitted(c, tenant, uid, a):
        member(c, tenant, uid)
        if a['status'] == 'revoked':
            raise HTTPException(403, 'This assignment has been revoked.')
        learner = a['learner_id'] == uid
        reviewer = bool(c.execute('SELECT 1 FROM institution_reviewers WHERE tenant_id=? AND assignment_id=? AND user_id=?', (tenant, a['id'], uid)).fetchone())
        if not learner and not reviewer:
            raise HTTPException(403, 'Only this learner and the named current reviewers can read this record.')
        return learner, reviewer

    def summary(c, a):
        details = json.loads(a['payload'])
        reviewers = [dict(r) for r in c.execute('SELECT r.user_id AS id,u.handle FROM institution_reviewers r JOIN users u ON u.id=r.user_id WHERE r.tenant_id=? AND r.assignment_id=? ORDER BY u.handle', (a['tenant_id'], a['id']))]
        return {'id': a['id'], 'tenantId': a['tenant_id'], 'learnerId': a['learner_id'], 'taskId': a['task_id'],
                'rubricVersion': a['rubric_version'], 'status': a['status'], 'createdBy': a['created_by'],
                'createdAt': a['created_at'], 'acceptedAt': a['accepted_at'], 'objective': details['objective'],
                'sharing': details['sharing'], 'reviewers': reviewers,
                'terms': 'The named reviewers can see results' + (' and your submitted answers and correction requests.' if details['sharing'] == 'responses' else '. Raw answers and correction-request text are omitted; results can still reveal information about answers.') + ' Private reading, notes, vocabulary and intentions are outside this assignment.'}

    def history(c, tenant, a, uid):
        learner, reviewer = permitted(c, tenant, uid, a)
        if not learner and a['status'] != 'accepted':
            raise HTTPException(403, 'The learner has not accepted this reporting agreement.')
        full = learner or json.loads(a['payload'])['sharing'] == 'responses'
        t = task(c, tenant, a['task_id'])
        attempts = []
        for row in c.execute('SELECT * FROM institution_attempts WHERE tenant_id=? AND assignment_id=? ORDER BY rowid', (tenant, a['id'])):
            observed = json.loads(row['payload'])
            assessments = [{**json.loads(s['payload']), 'id': s['id'], 'rubricVersion': s['rubric_version'], 'createdAt': s['created_at'], 'createdBy': s['created_by'], 'supersedes': s['supersedes']} for s in c.execute('SELECT * FROM institution_assessments WHERE tenant_id=? AND attempt_id=? ORDER BY rowid', (tenant, row['id']))]
            if not full:
                observed.pop('response', None)
                observed.pop('choice', None)
                for s in assessments:
                    s.pop('reason', None)
            attempts.append({'id': row['id'], 'observation': observed, 'receivedAt': row['received_at'], 'assessments': assessments})
        appeals = []
        for row in c.execute('SELECT * FROM institution_appeals WHERE tenant_id=? AND assignment_id=? ORDER BY created_at,id', (tenant, a['id'])):
            entry = {**json.loads(row['payload']), 'createdAt': row['created_at']}
            if not full:
                entry.pop('reason', None)
            appeals.append(entry)
        versions = sorted({s['rubricVersion'] for x in attempts for s in x['assessments']})
        source_record = source(c, tenant, t)
        if not t['sourceVisible'] and not reviewer and not attempts:
            source_record = {k: v for k, v in source_record.items() if k != 'text'}
        result = {'schemaVersion': 1, 'assignment': summary(c, a), 'task': t, 'source': source_record,
                  'attempts': attempts, 'appeals': appeals, 'policy': policy(c, tenant),
                  'sourceSha256': hashlib.sha256(pack(source(c, tenant, t)).encode()).hexdigest(),
                  'taskSha256': hashlib.sha256(pack(t).encode()).hexdigest(),
                  'canReview': reviewer and json.loads(a['payload'])['sharing'] == 'responses', 'rawResponsesVisible': full,
                  'directObservations': sum(x['observation']['retryOf'] is None for x in attempts),
                  'claim': 'Task-specific rubric results only. Retries are retained and never increase the first-response count; statistical independence is not established.'}
        # Only after a response, or to an authorized reviewer. No answer keys in an offline task pack.
        if attempts or reviewer:
            result['rubrics'] = [rubric(c, tenant, a['task_id'], v) for v in versions]
        latest = attempts[-1]['assessments'][-1] if attempts else None
        successors = {s['supersedes']: s['id'] for x in attempts for s in x['assessments'] if s['supersedes']}
        for entry in appeals:
            entry['reassessedBy'] = successors.get(entry['assessmentId'])
        pending_review = any(not x['reassessedBy'] for x in appeals)
        action = 'review_requested' if pending_review else 'await_response' if latest is None else 'continue' if latest['matched'] else 'offer_review'
        result['decision'] = {'policyVersion': 'assignment-next-action-v1', 'action': action,
                              'assessmentId': latest['id'] if latest else None,
                              'reason': 'A correction request needs review.' if pending_review else 'No scored response yet.' if latest is None else 'Continue after this task-specific match.' if latest['matched'] else 'A non-match may reflect the answer or the rubric; offer review before inferring inability.',
                              'learnerModelUpdated': False}
        return result

    def mutation(session):
        uid = session['user_id']
        rate('institutions-write', uid, 240, 3600)
        return uid

    def support_choice(c, tenant, uid):
        row = c.execute('SELECT enabled,revision,terms_version FROM institution_support_consent WHERE tenant_id=? AND user_id=?', (tenant, uid)).fetchone()
        return {'schemaVersion': 1, 'policyVersion': SUPPORT_POLICY,
                'revision': row['revision'] if row else 1,
                'enabled': bool(row and row['enabled'] and row['terms_version'] == SUPPORT_POLICY),
                'terms': SUPPORT_TERMS}

    @app.get('/api/workspaces/{tenant}/support-consent')
    def get_support_consent(tenant: str, session=Depends(authenticated)):
        with connection() as c:
            c.execute('BEGIN')
            member(c, tenant, session['user_id'])
            result = support_choice(c, tenant, session['user_id'])
            c.commit()
            return result

    @app.put('/api/workspaces/{tenant}/support-consent')
    def set_support_consent(tenant: str, body: SupportConsent, session=Depends(authenticated)):
        uid = mutation(session)
        with connection() as c:
            c.execute('BEGIN IMMEDIATE')
            member(c, tenant, uid)
            current = support_choice(c, tenant, uid)
            # Same-value updates are no-ops. An immediately repeated request after
            # a lost acknowledgement is safe; an older request cannot undo a later choice.
            if current['enabled'] == body.enabled and body.revision in (current['revision'], current['revision'] - 1):
                c.commit()
                return current
            if current['revision'] != body.revision:
                raise HTTPException(409, 'Your reporting choice changed. Reload before saving.')
            revision = current['revision'] + 1
            c.execute('INSERT INTO institution_support_consent VALUES(?,?,?,?,?) ON CONFLICT(tenant_id,user_id) DO UPDATE SET enabled=excluded.enabled,revision=excluded.revision,terms_version=excluded.terms_version',
                      (tenant, uid, int(body.enabled), revision, SUPPORT_POLICY))
            audit(c, tenant, uid, 'support.consent.changed', SUPPORT_POLICY + ':' + str(revision))
            result = support_choice(c, tenant, uid)
            c.commit()
            return result

    @app.get('/api/workspaces/{tenant}/department-support')
    def department_support(tenant: str, request: Request, session=Depends(authenticated)):
        with connection() as c:
            # One read transaction establishes a coherent membership/consent/result
            # snapshot. A previously authorized in-flight response is not remotely erased.
            c.execute('BEGIN')
            member(c, tenant, session['user_id'], owner=True)
            if request.query_params:
                raise HTTPException(422, 'Department support is whole-workspace only. Filters and drilldown are not supported.')
            rows = c.execute('''
                SELECT a.learner_id,a.id AS assignment_id,o.id AS first_id,s.payload AS assessment
                FROM institution_assignments a
                JOIN decision_memberships m ON m.tenant_id=a.tenant_id AND m.user_id=a.learner_id
                JOIN institution_support_consent consent ON consent.tenant_id=a.tenant_id AND consent.user_id=a.learner_id
                LEFT JOIN institution_attempts o ON o.tenant_id=a.tenant_id AND o.assignment_id=a.id AND o.retry_of IS NULL
                LEFT JOIN institution_assessments s ON s.rowid=(
                    SELECT newest.rowid FROM institution_assessments newest
                    WHERE newest.tenant_id=o.tenant_id AND newest.attempt_id=o.id
                    ORDER BY newest.rowid DESC LIMIT 1)
                WHERE a.tenant_id=? AND a.status='accepted' AND consent.enabled=1 AND consent.terms_version=?
                ''', (tenant, SUPPORT_POLICY)).fetchall()
            learners = {}
            for row in rows:
                flags = learners.setdefault(row['learner_id'], {'correction_pending': False, 'review_rubric': False,
                                                               'awaiting_response': False, 'assisted_evidence': False})
                if not row['first_id'] or not row['assessment']:
                    flags['awaiting_response'] = True
                else:
                    assessed = json.loads(row['assessment'])
                    flags['review_rubric'] |= assessed.get('matched') is False
                    flags['awaiting_response'] |= assessed.get('matched') not in (True, False)
                    flags['assisted_evidence'] |= bool(assessed.get('assisted'))
                # Correction requests include requests on linked retries, but they
                # still classify one learner rather than adding performance observations.
                for appeal in c.execute('SELECT payload FROM institution_appeals WHERE tenant_id=? AND assignment_id=?', (tenant, row['assignment_id'])):
                    assessment_id = json.loads(appeal['payload'])['assessmentId']
                    successor = c.execute('SELECT 1 FROM institution_assessments WHERE tenant_id=? AND supersedes=?', (tenant, assessment_id)).fetchone()
                    flags['correction_pending'] |= not bool(successor)
            counts = {key: 0 for key, *_ in SUPPORT_CATEGORIES}
            for flags in learners.values():
                bucket = next((key for key, *_ in SUPPORT_CATEGORIES if flags.get(key)), 'task_matches')
                counts[bucket] += 1
            total = len(learners)

            def band(n):
                lower = n // SUPPORT_MINIMUM * SUPPORT_MINIMUM
                return {'lower': lower, 'upper': lower + SUPPORT_MINIMUM - 1,
                        'label': str(lower) + '–' + str(lower + SUPPORT_MINIMUM - 1)}

            categories, recommendations = [], []
            enough = total >= SUPPORT_MINIMUM
            for key, label, action, reason in SUPPORT_CATEGORIES:
                count = counts[key]
                # Suppress zero as well as small cells: suppression must not disclose
                # which hidden cells are empty. Check the complement to avoid a
                # released large category singling out 1–4 remaining participants.
                released = enough and count >= SUPPORT_MINIMUM and (total - count == 0 or total - count >= SUPPORT_MINIMUM)
                categories.append({'key': key, 'label': label, 'status': 'released' if released else 'suppressed',
                                   'band': band(count) if released else None})
                if released:
                    recommendations.append({'action': action, 'reason': reason})
            if not recommendations:
                recommendations = [{'action': 'insufficient_information',
                                    'reason': 'There is not enough releasable group evidence to select targeted support. Offer optional general help without inferring individual ability or participation.'}]
            result = {'schemaVersion': 1, 'policyVersion': SUPPORT_POLICY,
                      'status': 'available' if enough else 'insufficient', 'minimumParticipants': SUPPORT_MINIMUM,
                      'participantBand': band(total) if enough else None,
                      'denominator': 'Current members who opted in and have at least one accepted assignment.',
                      'categories': categories, 'recommendations': recommendations, 'notice': SUPPORT_NOTICE,
                      'learnerModelUpdated': False, 'conditionsVerified': False}
            c.commit()
            return result

    @app.get('/api/workspaces')
    def workspaces(session=Depends(authenticated)):
        uid = session['user_id']
        with connection() as c:
            return {'schemaVersion': 1, 'personal': {'private': True, 'automaticSharing': False},
                    'workspaces': [{**dict(row), 'policy': policy(c, row['id'])} for row in c.execute('SELECT t.id,t.label,m.role FROM decision_tenants t JOIN decision_memberships m ON m.tenant_id=t.id WHERE m.user_id=? ORDER BY t.label', (uid,))]}

    @app.get('/api/workspaces/{tenant}/members')
    def members(tenant: str, session=Depends(authenticated)):
        with connection() as c:
            member(c, tenant, session['user_id'], owner=True)
            return {'members': [dict(r) for r in c.execute('SELECT m.user_id AS id,u.handle,m.role FROM decision_memberships m JOIN users u ON u.id=m.user_id WHERE m.tenant_id=? ORDER BY u.handle', (tenant,))]}

    @app.post('/api/workspaces/{tenant}/members')
    def invite_member(tenant: str, body: Member, session=Depends(authenticated)):
        uid = mutation(session)
        with connection() as c:
            c.execute('BEGIN IMMEDIATE')
            member(c, tenant, uid, owner=True)
            user = c.execute('SELECT id FROM users WHERE handle=? COLLATE NOCASE', (body.handle,)).fetchone()
            if not user:
                raise HTTPException(404, 'That account must register on this Nabu server first.')
            changed = c.execute("INSERT OR IGNORE INTO decision_memberships VALUES(?,?,'member')", (tenant, user['id'])).rowcount
            if changed:
                audit(c, tenant, uid, 'membership.added', user['id'])
            c.commit()
            return {'userId': user['id'], 'added': bool(changed)}

    @app.delete('/api/workspaces/{tenant}/members/{target}')
    def revoke_member(tenant: str, target: str, session=Depends(authenticated)):
        uid = mutation(session)
        with connection() as c:
            c.execute('BEGIN IMMEDIATE')
            member(c, tenant, uid, owner=target != uid)
            row = c.execute('SELECT role FROM decision_memberships WHERE tenant_id=? AND user_id=?', (tenant, target)).fetchone()
            if row and row['role'] == 'owner':
                raise HTTPException(409, 'The workspace owner cannot leave in this release. Keep the owner account or use another workspace.')
            c.execute("UPDATE institution_assignments SET status='revoked' WHERE tenant_id=? AND learner_id=?", (tenant, target))
            c.execute('DELETE FROM institution_reviewers WHERE tenant_id=? AND user_id=?', (tenant, target))
            # Preserve an off tombstone and advance its revision. Deleting this row
            # would reset the revision and let an old pending opt-in succeed after rejoin.
            if row:
                c.execute('INSERT INTO institution_support_consent VALUES(?,?,0,2,?) ON CONFLICT(tenant_id,user_id) DO UPDATE SET enabled=0,revision=institution_support_consent.revision+1',
                          (tenant, target, SUPPORT_POLICY))
            c.execute('DELETE FROM decision_memberships WHERE tenant_id=? AND user_id=?', (tenant, target))
            if row:
                audit(c, tenant, uid, 'membership.revoked', target)
            c.commit()
            return {'revoked': True, 'notice': 'Server access revoked. Previously downloaded or copied data cannot be remotely erased.'}

    @app.put('/api/workspaces/{tenant}/policy')
    def set_policy(tenant: str, body: Policy, session=Depends(authenticated)):
        uid = mutation(session)
        with connection() as c:
            c.execute('BEGIN IMMEDIATE')
            member(c, tenant, uid, owner=True)
            if body.revision != policy(c, tenant)['revision']:
                raise HTTPException(409, 'Workspace policy changed. Reload before editing.')
            c.execute('INSERT INTO institution_policy VALUES(?,?,?) ON CONFLICT(tenant_id) DO UPDATE SET offline_responses=excluded.offline_responses,revision=excluded.revision', (tenant, int(body.offlineResponses), body.revision + 1))
            audit(c, tenant, uid, 'policy.changed', str(body.revision + 1))
            c.commit()
            return policy(c, tenant)

    @app.post('/api/workspaces/{tenant}/sources')
    def create_source(tenant: str, body: Source, session=Depends(authenticated)):
        uid = mutation(session)
        payload = pack(body.model_dump())
        with connection() as c:
            c.execute('BEGIN IMMEDIATE')
            member(c, tenant, uid, owner=True)
            old = c.execute('SELECT payload FROM institution_sources WHERE tenant_id=? AND id=? AND version=?', (tenant, body.id, body.version)).fetchone()
            if old:
                if old['payload'] != payload:
                    raise HTTPException(409, 'A source version is immutable. Create the next version.')
            else:
                latest = c.execute('SELECT COALESCE(MAX(version),0) FROM institution_sources WHERE tenant_id=? AND id=?', (tenant, body.id)).fetchone()[0]
                if body.version != latest + 1:
                    raise HTTPException(409, 'Source versions must be consecutive.')
                c.execute('INSERT INTO institution_sources VALUES(?,?,?,?,?,?)', (tenant, body.id, body.version, payload, uid, now()))
                audit(c, tenant, uid, 'source.created', body.id + ':' + str(body.version))
            c.commit()
            return {'source': body.model_dump(), 'sha256': hashlib.sha256(payload.encode()).hexdigest()}

    @app.get('/api/workspaces/{tenant}/authoring')
    def authoring(tenant: str, session=Depends(authenticated)):
        with connection() as c:
            member(c, tenant, session['user_id'], owner=True)
            return {'sources': [json.loads(r['payload']) for r in c.execute('SELECT payload FROM institution_sources WHERE tenant_id=? ORDER BY created_at DESC', (tenant,))],
                    'tasks': [{**json.loads(r['payload']), 'latestRubricVersion': c.execute('SELECT MAX(version) FROM institution_rubrics WHERE tenant_id=? AND task_id=?', (tenant, r['id'])).fetchone()[0]} for r in c.execute('SELECT id,payload FROM institution_tasks WHERE tenant_id=? ORDER BY created_at DESC', (tenant,))]}

    @app.post('/api/workspaces/{tenant}/tasks')
    def create_task(tenant: str, body: Task, session=Depends(authenticated)):
        uid = mutation(session)
        data = body.model_dump()
        rules = data.pop('rubric')
        with connection() as c:
            c.execute('BEGIN IMMEDIATE')
            member(c, tenant, uid, owner=True)
            source(c, tenant, data)
            old = c.execute('SELECT payload FROM institution_tasks WHERE tenant_id=? AND id=?', (tenant, body.id)).fetchone()
            if old:
                if old['payload'] != pack(data) or rubric(c, tenant, body.id, 1)['payload'] != rules:
                    raise HTTPException(409, 'Task identity is immutable. Create a new task for changed conditions.')
            else:
                c.execute('INSERT INTO institution_tasks VALUES(?,?,?,?,?)', (tenant, body.id, pack(data), uid, now()))
                c.execute('INSERT INTO institution_rubrics VALUES(?,?,?,?,?,?,?)', (tenant, body.id, 1, pack(rules), 'Initial authored rubric', uid, now()))
                audit(c, tenant, uid, 'task.created', body.id)
            c.commit()
            return {'task': data, 'rubricVersion': 1}

    @app.post('/api/workspaces/{tenant}/tasks/{task_id}/rubrics')
    def correct_rubric(tenant: str, task_id: str, body: RubricRevision, session=Depends(authenticated)):
        uid = mutation(session)
        with connection() as c:
            c.execute('BEGIN IMMEDIATE')
            member(c, tenant, uid, owner=True)
            t = task(c, tenant, task_id)
            try:
                validate_rubric(t, body.rubric.model_dump())
            except ValueError as e:
                raise HTTPException(422, str(e))
            latest = c.execute('SELECT MAX(version) FROM institution_rubrics WHERE tenant_id=? AND task_id=?', (tenant, task_id)).fetchone()[0]
            # Lost acknowledgement retries do not make a second revision.
            if latest == body.expectedVersion + 1:
                existing = rubric(c, tenant, task_id, latest)
                if existing['payload'] == body.rubric.model_dump() and existing['reason'] == body.reason and existing['created_by'] == uid:
                    return {'version': latest}
            if latest != body.expectedVersion:
                raise HTTPException(409, 'The rubric changed. Reload its latest version.')
            version = latest + 1
            c.execute('INSERT INTO institution_rubrics VALUES(?,?,?,?,?,?,?)', (tenant, task_id, version, pack(body.rubric.model_dump()), body.reason, uid, now()))
            audit(c, tenant, uid, 'rubric.corrected', task_id + ':' + str(version))
            c.commit()
            return {'version': version, 'notice': 'Existing results are unchanged until a named reviewer explicitly reassesses them.'}

    @app.post('/api/workspaces/{tenant}/assignments')
    def assign(tenant: str, body: Assignment, session=Depends(authenticated)):
        uid = mutation(session)
        payload = pack(body.model_dump())
        with connection() as c:
            c.execute('BEGIN IMMEDIATE')
            member(c, tenant, uid, owner=True)
            member(c, tenant, body.learnerId)
            for reviewer in body.reviewerIds:
                member(c, tenant, reviewer)
            rubric(c, tenant, body.taskId, body.rubricVersion)
            old = c.execute('SELECT * FROM institution_assignments WHERE tenant_id=? AND id=?', (tenant, body.id)).fetchone()
            if old:
                if old['payload'] != payload:
                    raise HTTPException(409, 'Assignment terms are immutable; issue a new assignment.')
            else:
                c.execute("INSERT INTO institution_assignments VALUES(?,?,?,?,?,?, 'offered',?,?,NULL)", (tenant, body.id, body.learnerId, body.taskId, body.rubricVersion, payload, uid, now()))
                for reviewer in body.reviewerIds:
                    c.execute('INSERT INTO institution_reviewers VALUES(?,?,?)', (tenant, body.id, reviewer))
                audit(c, tenant, uid, 'assignment.offered', body.id)
            c.commit()
            return {'assignment': summary(c, assignment(c, tenant, body.id))}

    @app.get('/api/workspaces/{tenant}/assignments')
    def assignments(tenant: str, session=Depends(authenticated)):
        uid = session['user_id']
        with connection() as c:
            role = member(c, tenant, uid)
            rows = c.execute("SELECT a.* FROM institution_assignments a WHERE a.tenant_id=? AND (a.learner_id=? OR a.created_by=? OR EXISTS(SELECT 1 FROM institution_reviewers r WHERE r.tenant_id=a.tenant_id AND r.assignment_id=a.id AND r.user_id=?)) ORDER BY a.created_at DESC,a.id", (tenant, uid, uid if role == 'owner' else '', uid)).fetchall()
            return {'assignments': [summary(c, a) for a in rows], 'policy': policy(c, tenant)}

    @app.put('/api/workspaces/{tenant}/assignments/{assignment_id}/acceptance')
    def accept(tenant: str, assignment_id: str, body: Acceptance, session=Depends(authenticated)):
        uid = mutation(session)
        with connection() as c:
            c.execute('BEGIN IMMEDIATE')
            member(c, tenant, uid)
            a = assignment(c, tenant, assignment_id)
            learner, _ = permitted(c, tenant, uid, a)
            if not learner:
                raise HTTPException(403, 'Only the assigned learner can accept these terms.')
            if a['status'] == body.decision:
                return {'assignment': summary(c, a)}
            if a['status'] != 'offered':
                raise HTTPException(409, 'This agreement already has a decision. Request a new assignment or leave the workspace.')
            c.execute('UPDATE institution_assignments SET status=?,accepted_at=? WHERE tenant_id=? AND id=?', (body.decision, now() if body.decision == 'accepted' else None, tenant, assignment_id))
            audit(c, tenant, uid, 'assignment.' + body.decision, assignment_id)
            c.commit()
            return {'assignment': summary(c, assignment(c, tenant, assignment_id))}

    @app.get('/api/workspaces/{tenant}/assignments/{assignment_id}')
    def read_assignment(tenant: str, assignment_id: str, session=Depends(authenticated)):
        with connection() as c:
            member(c, tenant, session['user_id'])
            return history(c, tenant, assignment(c, tenant, assignment_id), session['user_id'])

    @app.post('/api/workspaces/{tenant}/attempts')
    def submit(tenant: str, body: Attempt, session=Depends(authenticated)):
        uid = mutation(session)
        data = body.model_dump()
        with connection() as c:
            c.execute('BEGIN IMMEDIATE')
            member(c, tenant, uid)
            a = assignment(c, tenant, body.assignmentId)
            learner, _ = permitted(c, tenant, uid, a)
            if not learner or a['status'] != 'accepted':
                raise HTTPException(403, 'The assigned learner must accept reporting terms before submitting.')
            old = c.execute('SELECT * FROM institution_attempts WHERE tenant_id=? AND id=?', (tenant, body.id)).fetchone()
            if old:
                if old['payload'] != pack(data):
                    raise HTTPException(409, 'This submission ID already has different content. The original is preserved.')
                return {'acknowledgedId': body.id, 'duplicate': True, 'record': history(c, tenant, a, uid)}
            if body.offline and not policy(c, tenant)['offlineResponses']:
                raise HTTPException(403, 'This workspace no longer permits offline submissions. Your pending answer has not been graded.')
            if body.occurredAt > now() + 300000:
                raise HTTPException(422, 'Submission time is in the future. Check the device clock.')
            t = task(c, tenant, a['task_id'])
            if (t['mode'] == 'recognition' and (body.choice is None or body.choice >= len(t['options']) or body.response)) or (t['mode'] == 'recall' and (body.choice is not None or not body.response)):
                raise HTTPException(422, 'Supply a response matching this task mode.')
            prior = c.execute('SELECT id FROM institution_attempts WHERE tenant_id=? AND assignment_id=? AND retry_of IS NULL', (tenant, a['id'])).fetchone()
            if body.retryOf:
                parent = c.execute('SELECT assignment_id FROM institution_attempts WHERE tenant_id=? AND id=?', (tenant, body.retryOf)).fetchone()
                if not parent or parent['assignment_id'] != a['id']:
                    raise HTTPException(409, 'Upload the original response for this assignment before its retry.')
            elif prior:
                raise HTTPException(409, 'A first response already exists. Open its feedback before submitting an explicitly linked retry.')
            if c.execute('SELECT COUNT(*) FROM institution_attempts WHERE tenant_id=? AND assignment_id=?', (tenant, a['id'])).fetchone()[0] >= 100:
                raise HTTPException(409, 'This assignment has reached its 100-attempt limit. Export the record and request a new assignment.')
            received = now()
            c.execute('INSERT INTO institution_attempts VALUES(?,?,?,?,?,?)', (tenant, body.id, a['id'], pack(data), received, body.retryOf))
            rules = rubric(c, tenant, a['task_id'], a['rubric_version'])
            result = {**score(t, rules['payload'], data), 'reason': 'Initial assessment', 'sourceId': t['sourceId'], 'sourceVersion': t['sourceVersion']}
            c.execute('INSERT INTO institution_assessments VALUES(?,?,?,?,?,?,?,NULL)', (tenant, str(uuid.uuid4()), body.id, a['rubric_version'], pack(result), received, uid))
            audit(c, tenant, uid, 'attempt.received', body.id)
            c.commit()
            return {'acknowledgedId': body.id, 'duplicate': False, 'record': history(c, tenant, a, uid)}

    @app.post('/api/workspaces/{tenant}/attempts/{attempt_id}/reassess')
    def reassess(tenant: str, attempt_id: str, body: Reassessment, session=Depends(authenticated)):
        uid = mutation(session)
        with connection() as c:
            c.execute('BEGIN IMMEDIATE')
            member(c, tenant, uid)
            observed = c.execute('SELECT * FROM institution_attempts WHERE tenant_id=? AND id=?', (tenant, attempt_id)).fetchone()
            if not observed:
                raise HTTPException(404, 'Attempt unavailable.')
            member(c, tenant, uid)
            a = assignment(c, tenant, observed['assignment_id'])
            _, reviewer = permitted(c, tenant, uid, a)
            if not reviewer or a['status'] != 'accepted' or json.loads(a['payload'])['sharing'] != 'responses':
                raise HTTPException(403, 'A named reviewer with accepted response access must perform reassessment.')
            existing = c.execute('SELECT * FROM institution_assessments WHERE tenant_id=? AND id=?', (tenant, body.id)).fetchone()
            if existing:
                if existing['attempt_id'] != attempt_id or existing['supersedes'] != body.expectedAssessmentId or existing['rubric_version'] != body.rubricVersion or existing['created_by'] != uid or json.loads(existing['payload'])['reason'] != body.reason:
                    raise HTTPException(409, 'Reassessment ID already used with different content.')
                return history(c, tenant, a, uid)
            current = c.execute('SELECT id FROM institution_assessments WHERE tenant_id=? AND attempt_id=? ORDER BY rowid DESC LIMIT 1', (tenant, attempt_id)).fetchone()
            if current['id'] != body.expectedAssessmentId:
                raise HTTPException(409, 'The result changed. Reload before reassessing.')
            rules = rubric(c, tenant, a['task_id'], body.rubricVersion)
            t = task(c, tenant, a['task_id'])
            result = {**score(t, rules['payload'], json.loads(observed['payload'])), 'reason': body.reason, 'sourceId': t['sourceId'], 'sourceVersion': t['sourceVersion']}
            c.execute('INSERT INTO institution_assessments VALUES(?,?,?,?,?,?,?,?)', (tenant, body.id, attempt_id, body.rubricVersion, pack(result), now(), uid, current['id']))
            audit(c, tenant, uid, 'assessment.revised', body.id)
            c.commit()
            return history(c, tenant, a, uid)

    @app.post('/api/workspaces/{tenant}/assignments/{assignment_id}/appeals')
    def appeal(tenant: str, assignment_id: str, body: Appeal, session=Depends(authenticated)):
        uid = mutation(session)
        with connection() as c:
            c.execute('BEGIN IMMEDIATE')
            member(c, tenant, uid)
            a = assignment(c, tenant, assignment_id)
            learner, _ = permitted(c, tenant, uid, a)
            if not learner or a['status'] != 'accepted':
                raise HTTPException(403, 'Only this learner can request a correction.')
            linked = c.execute('SELECT 1 FROM institution_assessments s JOIN institution_attempts o ON o.tenant_id=s.tenant_id AND o.id=s.attempt_id WHERE s.tenant_id=? AND s.id=? AND o.assignment_id=?', (tenant, body.assessmentId, assignment_id)).fetchone()
            if not linked:
                raise HTTPException(404, 'Assessment unavailable for this assignment.')
            old = c.execute('SELECT * FROM institution_appeals WHERE tenant_id=? AND id=?', (tenant, body.id)).fetchone()
            if old:
                if old['payload'] != pack(body.model_dump()) or old['assignment_id'] != assignment_id or old['created_by'] != uid:
                    raise HTTPException(409, 'Correction request ID already used.')
            else:
                c.execute('INSERT INTO institution_appeals VALUES(?,?,?,?,?,?)', (tenant, body.id, assignment_id, pack(body.model_dump()), uid, now()))
                audit(c, tenant, uid, 'correction.requested', body.id)
            c.commit()
            return history(c, tenant, a, uid)

    @app.post('/api/workspaces/{tenant}/assignments/{assignment_id}/replay')
    def replay_record(tenant: str, assignment_id: str, session=Depends(authenticated)):
        uid = mutation(session)
        with connection() as c:
            c.execute('BEGIN IMMEDIATE')
            member(c, tenant, uid)
            a = assignment(c, tenant, assignment_id)
            record = history(c, tenant, a, uid)
            if not record['rawResponsesVisible']:
                raise HTTPException(403, 'Exact replay requires response access.')
            checks = []
            for attempt in record['attempts']:
                for assessed in attempt['assessments']:
                    rules = rubric(c, tenant, a['task_id'], assessed['rubricVersion'])['payload']
                    expected = {**score(record['task'], rules, attempt['observation']), 'sourceId': record['task']['sourceId'], 'sourceVersion': record['task']['sourceVersion']}
                    checks.append({'assessmentId': assessed['id'], 'matches': all(assessed.get(k) == v for k, v in expected.items()), 'scorerVersion': SCORER})
            audit(c, tenant, uid, 'record.replayed', assignment_id)
            c.commit()
            return {'record': record, 'checks': checks, 'allMatch': all(x['matches'] for x in checks), 'assessmentCount': len(checks), 'notice': 'Replay checks this stored scorer contract; it does not independently validate the rubric or the learner model.'}

    @app.get('/api/workspaces/{tenant}/audit')
    def audit_trail(tenant: str, after: int = Query(default=0, ge=0, le=9007199254740991), session=Depends(authenticated)):
        with connection() as c:
            member(c, tenant, session['user_id'], owner=True)
            rows = [dict(r) for r in c.execute('SELECT sequence,actor_id AS actorId,action,reference,at FROM institution_audit WHERE tenant_id=? AND sequence>? ORDER BY sequence LIMIT 200', (tenant, max(0, after)))]
            return {'events': rows, 'nextAfter': rows[-1]['sequence'] if rows else after, 'containsRawResponses': False}
