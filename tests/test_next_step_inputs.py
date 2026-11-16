"""Authenticated, read-only input bridge for the shared next-step engine."""
import json
import sqlite3
import time
import uuid

import pytest

from test_social import env, put, card
from test_intents import saved, content, team, select
from test_content_progress import event, send
import next_step_inputs


def review(client, original, mode='recognition', rating=3):
    response = client.post('/api/library/cards/' + original['id'] + '/review', json={
        'revision': original['revision'], 'practiceMode': mode, 'rating': rating, 'durationMs': 1200,
    })
    assert response.status_code == 200, response.text
    return response.json()


def read(client, tenant=None):
    return client.get('/api/next-step-inputs', params={'tenantId': tenant} if tenant else {})


def database_snapshot(path):
    with sqlite3.connect(path) as connection:
        return list(connection.iterdump())


def test_input_bridge_requires_authentication_and_correct_active_account(env):
    _, new, anon = env
    assert read(anon).status_code == 401
    a = new('step_owner')
    a.headers['X-Nabu-Account'] = str(uuid.uuid4())
    assert read(a).status_code == 409


def test_empty_inputs_remain_empty_and_unknown_without_creating_records(env):
    app, new, _ = env
    a = new('step_owner')
    before = database_snapshot(app.state.db_path)
    response = read(a)
    assert response.status_code == 200
    result = response.json()
    assert result['schemaVersion'] == 1
    assert result['cards'] == result['logs'] == result['contentEvents'] == []
    assert result['intentContext']['immediateIntent'] is None
    assert result['intentContext']['organizationObjective'] is None
    assert result['intentContext']['selection'] == {'mode': 'none', 'intentId': None}
    assert result['evidenceScope'] == {'ownerUserId': a.headers['X-Nabu-Account'], 'kind': 'personal-account', 'tenantAttribution': 'not-recorded'}
    assert result['limits'] == {'cards': 5000, 'logs': 10000, 'contentEvents': 8000}
    assert result['truncated'] == {'cards': False, 'logs': False, 'contentEvents': False}
    assert all(key not in result for key in ('mastery', 'recommendations', 'knowledge', 'history'))
    assert database_snapshot(app.state.db_path) == before
    assert 'no-store' in response.headers['cache-control']
    assert a.get('/api/config').json()['nextStepInputs'] is True


def test_identity_and_self_ratings_preserved_but_private_card_fields_stripped(env):
    _, new, _ = env
    a = new('step_owner')
    original = put(a, card(
        front='water', back='HIDDEN_TRANSLATION', context='HIDDEN_CONTEXT', note='HIDDEN_NOTE',
        example='HIDDEN_EXAMPLE', reply='HIDDEN_REPLY', usage='HIDDEN_USAGE', provenance='HIDDEN_PROVENANCE',
    ))
    graded = review(a, original, mode='production')
    result = read(a).json()
    assert len(result['cards']) == len(result['logs']) == 1
    observed_card, observed_log = result['cards'][0], result['logs'][0]
    assert observed_card['id'] == original['id']
    assert observed_card['conceptId'] == 'food.water'
    assert observed_card['front'] == 'water'
    assert observed_card['sourceLang'] == 'en' and observed_card['targetLang'] == 'es'
    assert observed_card['skills']['production'] == graded['card']['skills']['production']
    assert observed_card['schedule'] == original['schedule']
    assert observed_log['practiceMode'] == 'production' and observed_log['rating'] == 3
    assert observed_log['before']['conceptId'] == original['conceptId']
    assert observed_log['before']['sourceLang'] == original['sourceLang']
    assert observed_log['before']['targetLang'] == original['targetLang']
    assert observed_log['before']['schedule'] == original['schedule']
    assert 'HIDDEN_' not in json.dumps(result)
    for private_key in ('back', 'note', 'context', 'usage', 'example', 'reply', 'provenance', 'deck', 'tags'):
        assert private_key not in observed_card and private_key not in observed_log['before']
    assert 'history' not in result


def test_actual_authored_response_and_assistance_reach_shared_evaluator_unchanged(env):
    _, new, _ = env
    a = new('step_owner')
    session = str(uuid.uuid4())
    events = [
        event('opened'),
        event('help', activityId='p2', sessionId=session, help='hint'),
        event('attempt', activityId='p2', sessionId=session, answer='ربما لاحقًا', assisted=True, skipped=False),
        event('preference', value=True),
    ]
    assert send(a, events).status_code == 200
    result = read(a).json()
    assert {e['id']: e for e in result['contentEvents']} == {e['id']: e for e in events}
    assert 'correct' not in next(e for e in result['contentEvents'] if e['kind'] == 'attempt')
    assert all('mastery' not in e for e in result['contentEvents'])


def test_evidence_is_always_session_owned_not_selected_by_query(env):
    _, new, _ = env
    a, b = new('step_owner'), new('step_other')
    own = put(a, card(front='OWN_WORD', conceptId=''))
    other = put(b, card(front='OTHER_PRIVATE_WORD', conceptId=''))
    review(a, own)
    review(b, other)
    own_event, other_event = event(), event()
    assert send(a, [own_event]).status_code == 200
    assert send(b, [other_event]).status_code == 200
    result = a.get('/api/next-step-inputs', params={'ownerUserId': b.headers['X-Nabu-Account']}).json()
    assert [c['id'] for c in result['cards']] == [own['id']]
    assert [l['cardId'] for l in result['logs']] == [own['id']]
    assert [e['id'] for e in result['contentEvents']] == [own_event['id']]
    assert 'OTHER_PRIVATE_WORD' not in json.dumps(result)


def test_team_separates_objective_private_intent_and_personal_account_history(env):
    _, new, _ = env
    owner, member = new('step_owner'), new('step_member')
    team(owner, 'step-team', member)
    objective = saved(owner, content('Team support calls.', destination='Handle Spanish calls.', languages=['es']), tenant='step-team', kind='organization')
    saved(owner, content('OWNER_PRIVATE_INTENT'), tenant='step-team')
    own = saved(member, content('Read this transcript.'), tenant='step-team')
    owner_word = put(owner, card(front='OWNER_PRIVATE_WORD', conceptId=''))
    member_word = put(member, card(front='MEMBER_WORD', conceptId=''))
    review(owner, owner_word)
    review(member, member_word)
    result = read(member, 'step-team').json()
    assert result['intentContext']['immediateIntent']['id'] == own['id']
    assert result['intentContext']['organizationObjective']['id'] == objective['id']
    assert result['intentContext']['immediateIntent']['destination'] is None
    assert result['evidenceScope']['kind'] == 'personal-account'
    assert result['evidenceScope']['tenantAttribution'] == 'not-recorded'
    assert [c['id'] for c in result['cards']] == [member_word['id']]
    assert [l['cardId'] for l in result['logs']] == [member_word['id']]
    assert 'OWNER_PRIVATE' not in json.dumps(result)
    assert select(member, tenant='step-team').status_code == 200
    explored = read(member, 'step-team').json()
    assert explored['intentContext']['immediateIntent'] is None
    assert explored['intentContext']['organizationObjective']['id'] == objective['id']


def test_team_membership_is_required_and_revocation_blocks_context_and_evidence(env):
    app, new, _ = env
    owner, member, outsider = new('step_owner'), new('step_member'), new('step_outsider')
    team(owner, 'step-team', member)
    saved(member, tenant='step-team')
    put(member)
    assert read(outsider, 'step-team').status_code == 403
    assert read(member, 'step-team').status_code == 200
    with sqlite3.connect(app.state.db_path) as connection:
        connection.execute('DELETE FROM decision_memberships WHERE tenant_id=? AND user_id=?', ('step-team', member.headers['X-Nabu-Account']))
    before = database_snapshot(app.state.db_path)
    assert read(member, 'step-team').status_code == 403
    assert database_snapshot(app.state.db_path) == before


def test_same_person_different_team_contexts_do_not_claim_team_attribution(env):
    _, new, _ = env
    a = new('step_owner')
    team(a, 'team-one')
    team(a, 'team-two')
    personal = saved(a, content('Personal intent.'))
    one = saved(a, content('First team intent.'), tenant='team-one')
    two = saved(a, content('Second team intent.'), tenant='team-two')
    word = put(a)
    for tenant, expected in [(None, personal), ('team-one', one), ('team-two', two)]:
        result = read(a, tenant).json()
        assert result['intentContext']['immediateIntent']['id'] == expected['id']
        assert result['cards'][0]['id'] == word['id']
        assert result['evidenceScope']['tenantAttribution'] == 'not-recorded'


def test_bounded_snapshot_reports_truncation_and_keeps_recent_logs_and_events(env, monkeypatch):
    _, new, _ = env
    a = new('step_owner')
    first = put(a, card(front='first', conceptId=''))
    second = put(a, card(front='second', conceptId=''))
    review(a, first)
    last_review = review(a, second)['log']
    first_event, last_event = event(), event()
    assert send(a, [first_event]).status_code == 200
    assert send(a, [last_event]).status_code == 200
    monkeypatch.setattr(next_step_inputs, 'LIMITS', {'cards': 1, 'logs': 1, 'contentEvents': 1})
    result = read(a).json()
    assert result['limits'] == {'cards': 1, 'logs': 1, 'contentEvents': 1}
    assert result['truncated'] == {'cards': True, 'logs': True, 'contentEvents': True}
    assert len(result['cards']) == len(result['logs']) == len(result['contentEvents']) == 1
    assert result['logs'][0]['id'] == last_review['id']
    # All observations outside these windows are omitted, not fabricated failures.
    assert not any(key in result for key in ('unknownAsFailure', 'knowledge', 'mastery'))


def test_get_has_no_writes_or_changes_to_existing_decisions_intents_and_schedules(env):
    app, new, _ = env
    a = new('step_owner')
    saved(a)
    original = put(a)
    review(a, original)
    assert send(a, [event('opened')]).status_code == 200
    old_decision = a.get('/api/decisions').json()
    old_intent = a.get('/api/intent-context').json()
    old_library = a.get('/api/library').json()
    before = database_snapshot(app.state.db_path)
    first, second = read(a), read(a)
    assert first.status_code == second.status_code == 200
    assert first.json() == second.json()
    assert first.json()['intentContext'] == old_intent
    assert a.get('/api/decisions').json() == old_decision
    assert a.get('/api/intent-context').json() == old_intent
    assert a.get('/api/library').json() == old_library
    assert database_snapshot(app.state.db_path) == before


def test_input_bridge_adds_no_tables_or_database_version_change(env):
    app, new, _ = env
    a = new('step_owner')
    with sqlite3.connect(app.state.db_path) as connection:
        before_tables = connection.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").fetchall()
        before_version = connection.execute('PRAGMA user_version').fetchone()[0]
    assert read(a).status_code == 200
    with sqlite3.connect(app.state.db_path) as connection:
        assert connection.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").fetchall() == before_tables
        assert connection.execute('PRAGMA user_version').fetchone()[0] == before_version


@pytest.mark.parametrize('tenant', ['', 'x', 'has spaces', '../../team'])
def test_invalid_scope_is_rejected_without_guessing(env, tenant):
    _, new, _ = env
    a = new('step_owner')
    assert a.get('/api/next-step-inputs', params={'tenantId': tenant}).status_code == 422
