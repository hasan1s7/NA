"""Intent integration tests against real FastAPI auth and temporary SQLite.

No provider calls or production data. Existing recommendation, evidence and
review APIs are exercised alongside intent writes to verify their separation.
"""
import copy
import json
import sqlite3
import uuid
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from test_social import env, put, card, PASSWORD
from server import create_app
from intents import FIELDS


CONTENT_KEYS = FIELDS | {'rawText', 'objectiveStatus', 'status', 'provenance'}
FIXTURES = json.loads((Path(__file__).parent / 'fixtures' / 'intents.json').read_text())['cases']


def content(raw='I want to understand this song.', **values):
    out = {
        'rawText': raw, 'immediateActivity': raw or None,
        'destination': None, 'timeHorizon': None, 'languages': [], 'modalities': [],
        'sourceContent': None, 'context': None, 'constraints': [], 'preferences': [],
        'objectiveStatus': 'explicit' if raw else 'unknown', 'status': 'active',
        'provenance': {'parser': 'local-intent-v1', 'fields': {
            key: {'status': 'unknown', 'source': 'none'} for key in FIELDS
        }},
    }
    out.update(values)
    for key in FIELDS:
        if out[key] is not None and out[key] != []:
            out['provenance']['fields'][key] = {'status': 'explicit', 'source': 'user_text' if key == 'immediateActivity' else 'user_edit'}
    return out


def create(client, body=None, *, tenant=None, kind='learner', identifier=None):
    return client.post('/api/intents', json={
        'id': identifier or str(uuid.uuid4()), 'tenantId': tenant, 'kind': kind,
        'content': body if body is not None else content(),
    })


def saved(client, body=None, **options):
    r = create(client, body, **options)
    assert r.status_code == 200, r.text
    return r.json()['intent']


def edit(client, record, **changes):
    payload = {key: copy.deepcopy(record[key]) for key in CONTENT_KEYS}
    payload.update(changes)
    return client.patch('/api/intents/' + record['id'], params={'tenantId': record['tenantId']} if record['tenantId'] else {}, json={'revision': record['revision'], 'content': payload})


def select(client, identifier=None, *, mode=None, tenant=None):
    return client.put('/api/intent-selection', params={'tenantId': tenant} if tenant else {}, json={'mode': mode or ('selected' if identifier else 'exploring'), 'intentId': identifier})


def scope(client, tenant=None):
    return client.get('/api/intents', params={'tenantId': tenant} if tenant else {})


def team(owner, tenant='support-team', member=None):
    r = owner.post('/api/decision-tenants', json={'id': tenant, 'label': tenant.replace('-', ' ').title()})
    assert r.status_code == 200, r.text
    if member:
        r = owner.post('/api/decision-tenants/' + tenant + '/members', json={'userId': member.headers['X-Nabu-Account']})
        assert r.status_code == 200, r.text


@pytest.mark.parametrize('path', ['/api/intents', '/api/intent-context', '/api/intent-tenants'])
def test_intent_reads_require_authentication(env, path):
    assert env[2].get(path).status_code == 401


def test_mutations_use_existing_csrf_origin_and_account_guard(env):
    _, new, anon = env
    assert create(anon).status_code == 401
    a = new('intent_owner')
    csrf = a.headers.pop('X-CSRF-Token')
    assert create(a).status_code == 403
    a.headers['X-CSRF-Token'] = csrf
    assert a.post('/api/intents', headers={'Origin': 'https://elsewhere.invalid'}, json={}).status_code == 403
    a.headers['X-Nabu-Account'] = str(uuid.uuid4())
    assert create(a).status_code == 409
    assert scope(a).status_code == 409


def test_creation_keeps_original_text_unknown_language_and_server_ownership(env):
    _, new, _ = env
    a = new('intent_owner')
    raw = 'I want to meet my girlfriend Alexandra’s Mexican mamá and make a good impression.'
    record = saved(a, content(raw))
    assert record['rawText'] == raw
    assert record['languages'] == []
    assert record['destination'] is None
    assert record['ownerUserId'] == a.headers['X-Nabu-Account']
    assert record['tenantId'] is None and record['kind'] == 'learner'
    assert record['revision'] == 1
    assert record['createdAt'] == record['updatedAt'] == record['statusChangedAt']
    assert scope(a).json()['intents'] == [record]
    context = a.get('/api/intent-context').json()
    assert context['actor'] == {'kind': 'individual', 'userId': a.headers['X-Nabu-Account'], 'tenantId': None}
    assert context['selection'] == {'mode': 'selected', 'intentId': record['id']}
    assert context['immediateIntent'] == record and context['organizationObjective'] is None


def test_all_four_destination_cases_and_separate_organization_context(env):
    _, new, _ = env
    a = new('intent_owner')
    destination = saved(a, content('Meet Alexandra’s mamá.', destination='Have a warm introductory conversation.', timeHorizon='This weekend', languages=['es'], modalities=['speaking']))
    assert destination['destination'] and destination['tenantId'] is None
    poetry = saved(a, content('I want to explore Arabic poetry with no particular end goal.', objectiveStatus='exploratory', languages=['ar'], modalities=['reading']))
    assert poetry['objectiveStatus'] == 'exploratory' and poetry['destination'] is None
    team(a, 'support-team')
    objective = saved(a, content('Our team needs to handle customer-support calls in Spanish.', destination='Handle customer-support calls in Spanish.', languages=['es']), tenant='support-team', kind='organization')
    immediate = saved(a, content('Read this paragraph from a call transcript.', modalities=['reading']), tenant='support-team')
    context = a.get('/api/intent-context', params={'tenantId': 'support-team'}).json()
    assert context['immediateIntent']['id'] == immediate['id']
    assert context['immediateIntent']['destination'] is None
    assert context['organizationObjective']['id'] == objective['id']
    team(a, 'poetry-team')
    open_objective = saved(a, content('Explore Arabic poetry together.', objectiveStatus='exploratory', languages=['ar']), tenant='poetry-team', kind='organization')
    open_immediate = saved(a, content('Read this poem.', objectiveStatus='exploratory', modalities=['reading']), tenant='poetry-team')
    context = a.get('/api/intent-context', params={'tenantId': 'poetry-team'}).json()
    assert context['organizationObjective']['id'] == open_objective['id']
    assert context['organizationObjective']['destination'] is None
    assert context['immediateIntent']['id'] == open_immediate['id']


@pytest.mark.parametrize('case', FIXTURES, ids=lambda case: case['caseId'])
def test_shared_browser_parser_fixtures_are_accepted_without_semantic_changes(env, case):
    _, new, _ = env
    a = new('fixture_owner')
    tenant = case['tenantId']
    if tenant:
        team(a, tenant)
    record = saved(a, case['content'], tenant=tenant, kind=case['kind'])
    for key in CONTENT_KEYS - {'provenance'}:
        assert record[key] == case['content'][key]
    for key in FIELDS:
        assert record['provenance']['fields'][key]['status'] == case['content']['provenance']['fields'][key]['status']
        assert record['provenance']['fields'][key]['source'] == case['content']['provenance']['fields'][key]['source']
    if case.get('learnerContent'):
        learner = saved(a, case['learnerContent'], tenant=tenant)
        context = a.get('/api/intent-context', params={'tenantId': tenant}).json()
        assert context['immediateIntent']['id'] == learner['id']
        assert context['organizationObjective']['id'] == record['id']


def test_skip_persists_selection_without_creating_or_changing_intents(env):
    _, new, _ = env
    a = new('intent_owner')
    assert select(a).status_code == 200
    assert scope(a).json()['intents'] == []
    record = saved(a)
    assert select(a).status_code == 200
    data = scope(a).json()
    assert data['selection'] == {'mode': 'exploring', 'intentId': None}
    assert data['intents'] == [record]
    assert a.get('/api/intent-context').json()['immediateIntent'] is None
    assert select(a, record['id']).status_code == 200
    assert select(a, mode='none').status_code == 200
    assert scope(a).json()['selection']['mode'] == 'none'


def test_records_and_selection_survive_server_restart(env):
    app, new, _ = env
    a = new('intent_owner')
    record = saved(a)
    assert select(a).status_code == 200
    second = create_app(app.state.db_path, 'http://testserver', invite='', translation_key='')
    with TestClient(second, headers={'Origin': 'http://testserver'}) as client:
        assert client.post('/api/login', json={'handle': 'intent_owner', 'password': PASSWORD}).status_code == 200
        data = scope(client).json()
        assert data['intents'] == [record]
        assert data['selection'] == {'mode': 'exploring', 'intentId': None}


def test_creation_retry_is_idempotent_without_overwriting_later_selection(env):
    _, new, _ = env
    a = new('intent_owner')
    identifier, body = str(uuid.uuid4()), content()
    original = saved(a, body, identifier=identifier)
    other = saved(a, content('Read another article.'))
    assert saved(a, body, identifier=identifier) == original
    assert scope(a).json()['selection']['intentId'] == other['id']
    assert len(scope(a).json()['intents']) == 2
    assert create(a, content('Changed data.'), identifier=identifier).status_code == 409


def test_edit_has_optimistic_revision_and_preserves_status_timestamp(env):
    _, new, _ = env
    a = new('intent_owner')
    original = saved(a)
    provenance = copy.deepcopy(original['provenance'])
    provenance['fields']['destination'] = {'status': 'explicit', 'source': 'user_edit'}
    r = edit(a, original, destination='Explain the chorus.', provenance=provenance)
    assert r.status_code == 200, r.text
    current = r.json()['intent']
    assert current['revision'] == 2 and current['createdAt'] == original['createdAt']
    assert current['updatedAt'] > original['updatedAt']
    assert current['statusChangedAt'] == original['statusChangedAt']
    assert edit(a, original, rawText='Stale change').status_code == 409
    assert scope(a).json()['intents'] == [current]


@pytest.mark.parametrize('status', ['paused', 'completed', 'abandoned'])
def test_lifecycle_clears_current_selection_and_requires_explicit_resume(env, status):
    _, new, _ = env
    a = new('intent_owner')
    original = saved(a)
    r = edit(a, original, status=status)
    assert r.status_code == 200, r.text
    updated = r.json()['intent']
    assert updated['status'] == status and updated['statusChangedAt'] > original['statusChangedAt']
    assert scope(a).json()['selection'] == {'mode': 'none', 'intentId': None}
    assert select(a, original['id']).status_code == 409
    resumed = edit(a, updated, status='active').json()['intent']
    assert scope(a).json()['selection']['mode'] == 'none'
    assert select(a, resumed['id']).status_code == 200
    assert a.get('/api/intent-context').json()['immediateIntent']['id'] == original['id']


def test_private_records_and_selection_are_separate_for_each_actor_and_team(env):
    _, new, _ = env
    a, b = new('intent_owner'), new('intent_member')
    team(a, 'team-one', b)
    team(a, 'team-two', b)
    personal = saved(a, content('Personal intent.'))
    one = saved(a, content('Team one private intent.'), tenant='team-one')
    two = saved(a, content('Team two private intent.'), tenant='team-two')
    other = saved(b, content('Other learner private intent.'), tenant='team-one')
    assert [r['id'] for r in scope(a).json()['intents']] == [personal['id']]
    assert [r['id'] for r in scope(a, 'team-one').json()['intents']] == [one['id']]
    assert [r['id'] for r in scope(a, 'team-two').json()['intents']] == [two['id']]
    assert [r['id'] for r in scope(b, 'team-one').json()['intents']] == [other['id']]
    assert select(a, other['id'], tenant='team-one').status_code == 404
    assert edit(a, other, rawText='Team owner cannot overwrite member.').status_code == 404
    assert select(a, one['id'], tenant='team-two').status_code == 404
    assert edit(b, personal, rawText='Forbidden').status_code == 404
    assert create(b, identifier=personal['id']).status_code == 409
    assert scope(a, 'team-one').json()['selection']['intentId'] == one['id']
    assert scope(b).json()['intents'] == []


def test_organization_objectives_member_read_owner_write_and_no_personal_overwrite(env):
    _, new, _ = env
    a, b, outsider = new('intent_owner'), new('intent_member'), new('intent_other')
    team(a, member=b)
    personal = saved(b, content('My immediate curiosity.'), tenant='support-team')
    objective = saved(a, content('Our team objective.', destination='Handle Spanish calls.'), tenant='support-team', kind='organization')
    data = scope(b, 'support-team').json()
    assert data['role'] == 'member' and data['intents'] == [personal]
    assert data['organizationObjective'] == objective
    assert data['selection']['intentId'] == personal['id']
    assert create(b, tenant='support-team', kind='organization').status_code == 403
    assert edit(b, objective, rawText='Changed org objective.').status_code == 403
    assert b.request('DELETE', '/api/intents/' + objective['id'], params={'tenantId': 'support-team'}, json={'revision': 1}).status_code == 403
    assert select(b, objective['id'], tenant='support-team').status_code == 409
    assert scope(outsider, 'support-team').status_code == 403
    assert create(outsider, tenant='support-team').status_code == 403
    assert create(a, kind='organization').status_code == 403
    assert select(b, tenant='support-team').status_code == 200
    context = b.get('/api/intent-context', params={'tenantId': 'support-team'}).json()
    assert context['immediateIntent'] is None and context['organizationObjective'] == objective


def test_only_one_active_organization_objective_and_history_not_lost(env):
    _, new, _ = env
    a = new('intent_owner')
    team(a)
    first = saved(a, tenant='support-team', kind='organization')
    assert create(a, tenant='support-team', kind='organization').status_code == 409
    paused = edit(a, first, status='paused').json()['intent']
    second = saved(a, content('A second objective.'), tenant='support-team', kind='organization')
    assert edit(a, paused, status='active').status_code == 409
    data = scope(a, 'support-team').json()
    assert data['organizationObjective']['id'] == second['id']
    assert {r['id'] for r in data['organizationObjectives']} == {first['id'], second['id']}


def test_membership_revocation_prevents_all_team_access(env):
    app, new, _ = env
    a, b = new('intent_owner'), new('intent_member')
    team(a, member=b)
    record = saved(b, tenant='support-team')
    assert b.get('/api/intent-tenants').json()['tenants'][0]['id'] == 'support-team'
    with sqlite3.connect(app.state.db_path) as conn:
        conn.execute('DELETE FROM decision_memberships WHERE tenant_id=? AND user_id=?', ('support-team', b.headers['X-Nabu-Account']))
    assert scope(b, 'support-team').status_code == 403
    assert b.get('/api/intent-context', params={'tenantId': 'support-team'}).status_code == 403
    assert edit(b, record).status_code == 403
    assert select(b, record['id'], tenant='support-team').status_code == 403
    assert b.get('/api/intent-tenants').json()['tenants'] == []


def test_empty_input_rejected_and_ambiguous_input_remains_unknown(env):
    _, new, _ = env
    a = new('intent_owner')
    assert create(a, content('', immediateActivity=None)).status_code == 422
    body = content('???', immediateActivity=None, objectiveStatus='unknown')
    body['provenance']['fields']['immediateActivity'] = {'status': 'unknown', 'source': 'none'}
    record = saved(a, body)
    assert record['rawText'] == '???' and record['immediateActivity'] is None
    assert record['objectiveStatus'] == 'unknown' and record['destination'] is None
    assert record['languages'] == []


def test_inferences_remain_distinct_and_user_correction_is_explicit(env):
    _, new, _ = env
    a = new('intent_owner')
    body = content('Maybe an introduction.', languages=['es'], objectiveStatus='inferred')
    body['provenance']['fields']['immediateActivity'] = {'status': 'inferred', 'source': 'provider'}
    body['provenance']['fields']['languages'] = {'status': 'inferred', 'source': 'provider'}
    record = saved(a, body)
    assert record['objectiveStatus'] == 'inferred'
    assert record['provenance']['fields']['languages']['status'] == 'inferred'
    provenance = copy.deepcopy(record['provenance'])
    provenance['fields']['languages'] = {'status': 'explicit', 'source': 'user_edit'}
    updated = edit(a, record, languages=['ar'], provenance=provenance).json()['intent']
    assert updated['languages'] == ['ar']
    assert updated['provenance']['fields']['languages']['status'] == 'explicit'
    assert updated['objectiveStatus'] == 'inferred'


@pytest.mark.parametrize('change', [
    {'rawText': 'x' * 1201}, {'destination': 'x' * 401},
    {'languages': ['xx']}, {'languages': ['es', 'es']},
    {'modalities': ['telepathy']}, {'status': 'mastered'},
    {'constraints': ['x'] * 13}, {'preferences': ['x' * 201]},
    {'sourceContent': {'id': 'article', 'version': 1}},
    {'sourceContent': {'id': 'article', 'version': None, 'body': 'private paragraph'}},
    {'immediateActivity': '   '}, {'rawText': 'bad\x00text'},
    {'sourceContent': {'id': '   ', 'version': None}},
    {'sourceContent': {'id': '\ufeff', 'version': None}},
    {'rawText': '\U0001f600' * 601},
])
def test_invalid_fields_are_rejected_without_reflecting_private_input(env, change):
    _, new, _ = env
    a = new('intent_owner')
    raw = 'Private original phrase must not appear in error bodies.'
    body = content(raw)
    body.update(change)
    response = create(a, body)
    assert response.status_code == 422
    assert raw not in response.text
    assert scope(a).json()['intents'] == []


def test_missing_or_false_provenance_is_rejected(env):
    _, new, _ = env
    a = new('intent_owner')
    body = content()
    body['provenance']['fields'].pop('destination')
    assert create(a, body).status_code == 422
    body = content()
    body['provenance']['fields']['destination'] = {'status': 'explicit', 'source': 'user_text'}
    assert create(a, body).status_code == 422
    body = content()
    body['provenance']['fields']['immediateActivity'] = {'status': 'unknown', 'source': 'none'}
    assert create(a, body).status_code == 422


def test_provider_suggestions_cannot_claim_explicit_confirmation(env):
    _, new, _ = env
    a = new('intent_owner')
    body = content('A possible plan.', destination='A model suggested conversation.')
    body['provenance']['fields']['destination'] = {'status': 'explicit', 'source': 'provider'}
    assert create(a, body).status_code == 422
    body['provenance']['fields']['destination']['status'] = 'inferred'
    record = saved(a, body)
    assert record['provenance']['fields']['destination']['status'] == 'inferred'


@pytest.mark.parametrize('where', ['parser', 'evidence', 'source'])
def test_nested_provenance_and_source_text_reject_control_characters(env, where):
    _, new, _ = env
    a = new('intent_owner')
    body = content()
    if where == 'parser':
        body['provenance']['parser'] = 'parser\x7fname'
    elif where == 'evidence':
        body['provenance']['fields']['immediateActivity']['evidence'] = 'private\x00text'
    else:
        body['sourceContent'] = {'id': 'article\x7fid', 'version': None}
        body['provenance']['fields']['sourceContent'] = {'status': 'explicit', 'source': 'reader_context'}
    assert create(a, body).status_code == 422


def test_client_cannot_supply_ownership_revision_or_timestamp_metadata(env):
    _, new, _ = env
    a = new('intent_owner')
    base = {'id': str(uuid.uuid4()), 'kind': 'learner', 'content': content()}
    for key, value in [('ownerUserId', 'someone-else'), ('createdAt', 1), ('revision', 100), ('schemaVersion', 9)]:
        assert a.post('/api/intents', json={**base, key: value}).status_code == 422
    record = saved(a)
    body = {key: copy.deepcopy(record[key]) for key in CONTENT_KEYS}
    assert a.patch('/api/intents/' + record['id'], json={'revision': True, 'content': body}).status_code == 422
    assert a.patch('/api/intents/' + record['id'], json={'revision': 1, 'content': body, 'tenantId': 'other-team'}).status_code == 422


def test_invalid_selection_never_creates_blank_records(env):
    _, new, _ = env
    a = new('intent_owner')
    assert select(a, str(uuid.uuid4())).status_code == 404
    assert a.put('/api/intent-selection', json={'mode': 'selected', 'intentId': None}).status_code == 422
    assert a.put('/api/intent-selection', json={'mode': 'exploring', 'intentId': str(uuid.uuid4())}).status_code == 422
    assert scope(a).json()['intents'] == []


def test_delete_is_scoped_revision_guarded_and_removes_private_content(env):
    app, new, _ = env
    a, b = new('intent_owner'), new('intent_other')
    record = saved(a, content('PRIVATE TO DELETE'))
    other = saved(b)
    path = '/api/intents/' + record['id']
    assert b.request('DELETE', path, json={'revision': 1}).status_code == 404
    assert a.request('DELETE', path, json={'revision': 2}).status_code == 409
    assert a.request('DELETE', path, json={'revision': 1}).status_code == 200
    assert scope(a).json()['intents'] == []
    assert scope(a).json()['selection'] == {'mode': 'none', 'intentId': None}
    assert scope(b).json()['intents'] == [other]
    with sqlite3.connect(app.state.db_path) as conn:
        assert conn.execute('SELECT COUNT(*) FROM nabu_intents WHERE id=?', (record['id'],)).fetchone()[0] == 0


def test_intents_never_mutate_learning_evidence_schedules_or_existing_decisions(env):
    _, new, _ = env
    a = new('intent_owner')
    word = put(a, card(note='Keep this existing review schedule.'))
    before_library = a.get('/api/library').json()
    before_progress = a.get('/api/content-progress').json()
    before_decision = a.get('/api/decisions').json()
    record = saved(a, content('Read more Spanish.', languages=['es']))
    assert edit(a, record, status='completed').status_code == 200
    assert select(a).status_code == 200
    assert a.get('/api/library').json() == before_library
    assert a.get('/api/content-progress').json() == before_progress
    assert a.get('/api/decisions').json() == before_decision
    assert a.get('/api/library').json()['cards'][0]['schedule'] == word['schedule']


def test_account_deletion_cascades_its_intents_and_selection(env):
    app, new, _ = env
    a, b = new('intent_owner'), new('intent_other')
    team(a, member=b)
    saved(a)
    saved(a, tenant='support-team', kind='organization')
    saved(b, tenant='support-team')
    retained = saved(b)
    assert a.request('DELETE', '/api/account', json={'password': PASSWORD}).status_code == 200
    with sqlite3.connect(app.state.db_path) as conn:
        assert conn.execute('SELECT COUNT(*) FROM nabu_intents WHERE owner_user_id=?', (a.headers['X-Nabu-Account'],)).fetchone()[0] == 0
        assert conn.execute('SELECT COUNT(*) FROM nabu_intent_selections WHERE owner_user_id=?', (a.headers['X-Nabu-Account'],)).fetchone()[0] == 0
        assert conn.execute('SELECT COUNT(*) FROM nabu_intents WHERE tenant_id=?', ('support-team',)).fetchone()[0] == 0
    assert scope(b).json()['intents'] == [retained]


def test_additive_schema_preserves_existing_database_version_and_cards(env):
    app, new, _ = env
    a = new('intent_owner')
    old = put(a)
    with sqlite3.connect(app.state.db_path) as conn:
        version = conn.execute('PRAGMA user_version').fetchone()[0]
        conn.execute('DROP TABLE nabu_intent_selections')
        conn.execute('DROP TABLE nabu_intents')
    with TestClient(create_app(app.state.db_path, 'http://testserver', invite='', translation_key=''), headers={'Origin': 'http://testserver'}) as client:
        assert client.post('/api/login', json={'handle': 'intent_owner', 'password': PASSWORD}).status_code == 200
        assert scope(client).json()['intents'] == []
        assert client.get('/api/library').json()['cards'][0]['id'] == old['id']
        assert client.get('/api/config').json()['intentLayer'] is True
    with sqlite3.connect(app.state.db_path) as conn:
        assert conn.execute('PRAGMA user_version').fetchone()[0] == version
