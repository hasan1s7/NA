"""Read-only, account-scoped inputs for Nabu's shared browser decision engine.

This is not a second ranking implementation or a learner-model migration. It
reads the existing intent, card, review and content-event stores in one SQLite
snapshot. Private notes, translations, lookup text and media bodies are omitted.
An omitted or truncated observation must be treated as unknown, never failure.
"""
from __future__ import annotations

import json

from fastapi import Depends, Query

from content_progress import EVIDENCE_FIELDS, ASSISTANCE_FIELDS, CONTEXT_FIELDS

LIMITS = {'cards': 5000, 'logs': 10000, 'contentEvents': 8000}
CARD_FIELDS = (
    'id', 'conceptId', 'sourceLang', 'targetLang', 'front', 'learningMode',
    'archived', 'createdAt', 'updatedAt', 'revision',
)
SCHEDULE_FIELDS = (
    'algorithm', 'state', 'step', 'due', 'interval', 'ease', 'reps', 'lapses', 'lastReview',
)
LOG_FIELDS = ('id', 'cardId', 'at', 'rating', 'practiceMode', 'durationMs', 'afterRevision')
MODES = ('recognition', 'production', 'listening', 'cloze')
EVENT_FIELDS = {
    'opened': (), 'position': ('segmentId', 'fraction'),
    'finished': ('value',), 'preference': ('value',),
    'help': ('activityId', 'sessionId', 'help'),
    'attempt': ('activityId', 'sessionId', 'answer', 'choice', 'assisted', 'skipped'),
    'saved': ('annotationId', 'cardId'),
    'evidence': ('sessionId',),
}


def pick(value, fields):
    if not isinstance(value, dict):
        return {}
    return {key: value[key] for key in fields if key in value}


def card_input(card):
    """Keep historical identity and schedule data; never return private notes."""
    result = pick(card, CARD_FIELDS)
    if isinstance(card.get('schedule'), dict):
        result['schedule'] = pick(card['schedule'], SCHEDULE_FIELDS)
    if isinstance(card.get('skills'), dict):
        result['skills'] = {mode: pick(card['skills'][mode], SCHEDULE_FIELDS) for mode in MODES if isinstance(card['skills'].get(mode), dict)}
    return result


def log_input(log):
    result = pick(log, LOG_FIELDS)
    if isinstance(log.get('before'), dict):
        result['before'] = card_input(log['before'])
    return result


def content_input(event):
    # Actual bounded recall responses are needed by the existing authored-answer
    # matcher. A response is not a lookup, general production grade or mastery.
    result = pick(event, ('id', 'contentId', 'version', 'kind', 'at') + EVENT_FIELDS.get(event.get('kind'), ()))
    if isinstance(event.get('evidence'), dict):
        result['evidence'] = evidence_input(event['evidence'])
    return result


def evidence_input(evidence):
    """Project audit references and bounded responses, never arbitrary context.

    Validation at ingestion is strict. This second whitelist also protects reads
    of older/imported rows from accidentally exposing new private payload fields.
    Historical versions/statuses are preserved; this bridge does not re-score.
    """
    result = pick(evidence, EVIDENCE_FIELDS)
    result['actor'] = pick(evidence.get('actor'), ('userId', 'tenantId'))
    for key in ('intentRef', 'organizationObjectiveRef'):
        if result.get(key) is not None:
            result[key] = pick(result[key], ('id', 'revision'))
    if result.get('taskRef') is not None:
        result['taskRef'] = pick(result['taskRef'], ('id', 'version'))
    source_occurrence = evidence.get('occurrence') if isinstance(evidence.get('occurrence'), dict) else {}
    occurrence = pick(source_occurrence, ('contentId', 'version', 'segmentId', 'annotationId', 'readingId'))
    occurrence['context'] = pick(source_occurrence.get('context'), CONTEXT_FIELDS)
    result['occurrence'] = occurrence
    result['assistance'] = pick(evidence.get('assistance'), ASSISTANCE_FIELDS)
    if result.get('response') is not None:
        result['response'] = pick(result['response'], ('choice', 'answer'))
    if result.get('assessment') is not None:
        result['assessment'] = pick(result['assessment'], ('outcome', 'basis'))
    for key in ('rubricRef', 'scorerRef', 'analysisRef'):
        if result.get(key) is None:
            continue
        ref = pick(result[key], ('id', 'version', 'status'))
        sources = result[key].get('provenance', []) if isinstance(result[key], dict) else []
        ref['provenance'] = [pick(source, ('sourceId', 'locator', 'kind')) for source in sources] if isinstance(sources, list) else []
        result[key] = ref
    return result


def install_next_step_inputs(app, connection, authenticated, read_intent_context):
    @app.get('/api/next-step-inputs')
    def next_step_inputs(
        tenantId: str | None = Query(default=None, min_length=3, max_length=64, pattern=r'^[a-zA-Z0-9_-]+$'),
        session=Depends(authenticated),
    ):
        uid = session['user_id']
        with connection() as conn:
            conn.execute('BEGIN')
            # This checks team membership before any evidence queries. Team
            # objectives remain separate from this member's private intent.
            context = read_intent_context(conn, uid, tenantId)
            card_rows = conn.execute(
                'SELECT body FROM cloud_cards WHERE owner_id=? ORDER BY id LIMIT ?', (uid, LIMITS['cards'] + 1),
            ).fetchall()
            log_rows = conn.execute(
                'SELECT body FROM cloud_logs WHERE owner_id=? ORDER BY at DESC,id DESC LIMIT ?', (uid, LIMITS['logs'] + 1),
            ).fetchall()
            event_rows = conn.execute(
                '''SELECT payload FROM content_events WHERE user_id=? AND (
                    (json_type(payload,'$.evidence') IS NULL AND json_extract(payload,'$.kind')!='evidence')
                    OR (json_extract(payload,'$.evidence.actor.userId')=?
                        AND json_extract(payload,'$.evidence.actor.tenantId') IS ?)
                ) ORDER BY received_at DESC,event_id DESC LIMIT ?''',
                (uid, uid, tenantId, LIMITS['contentEvents'] + 1),
            ).fetchall()
        return {
            'schemaVersion': 1,
            'intentContext': context,
            'evidenceScope': {'ownerUserId': uid, 'kind': 'personal-account', 'tenantAttribution': 'not-recorded'},
            'cards': [card_input(json.loads(row['body'])) for row in card_rows[:LIMITS['cards']]],
            'logs': [log_input(json.loads(row['body'])) for row in log_rows[:LIMITS['logs']]],
            'contentEvents': [content_input(json.loads(row['payload'])) for row in event_rows[:LIMITS['contentEvents']]],
            'limits': dict(LIMITS),
            'truncated': {
                'cards': len(card_rows) > LIMITS['cards'],
                'logs': len(log_rows) > LIMITS['logs'],
                'contentEvents': len(event_rows) > LIMITS['contentEvents'],
            },
        }
