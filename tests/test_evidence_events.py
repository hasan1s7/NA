"""Immutable evidence envelopes through the existing authenticated event API.

These tests check persistence, contracts, privacy and replay inputs. They do not
establish the linguistic quality of a scorer or treat client observations as
proctored performance. No network provider or additional database is used.
"""
import copy
import json
import sqlite3
import time
import uuid

import pytest
from fastapi.testclient import TestClient

import content_progress
import next_step_inputs
from server import create_app
from test_social import env, put, card, PASSWORD
from test_content_progress import event as legacy_event, send
from test_intents import saved, team, content, edit


def ref(identifier='test-authored-rule', version=1, status='authored'):
    return {'id': identifier, 'version': version, 'status': status, 'provenance': [
        {'sourceId': 'test-fixture', 'locator': 'tests/test_evidence_events.py', 'kind': 'authored'},
    ]}


def evidence_event(client, observation='displayed', tenant=None, content_id='reading:test-private-occurrence', version=1):
    at = int(time.time()*1000)
    episode = str(uuid.uuid4())
    evidence = {
        'schemaVersion': 1, 'episodeId': episode, 'attemptId': None, 'retryOfEpisodeId': None,
        'actor': {'userId': client.headers['X-Nabu-Account'], 'tenantId': tenant},
        'intentRef': None, 'organizationObjectiveRef': None, 'taskRef': None,
        'occurrence': {
            'contentId': content_id, 'version': version, 'segmentId': None,
            'annotationId': None, 'readingId': 'test-reading-occurrence',
            'context': {key: None for key in content_progress.CONTEXT_FIELDS},
        },
        'inputModality': 'audio' if observation=='played' else 'text',
        'outputModality': 'none', 'observation': observation,
        'assistance': {key: False for key in content_progress.ASSISTANCE_FIELDS},
        'presentedAt': at-1000, 'response': None, 'rubricRef': None,
        'scorerRef': None, 'analysisRef': None, 'assessment': None, 'skipReason': None,
    }
    if observation in content_progress.TASK_OBSERVATIONS:
        evidence.update(attemptId=str(uuid.uuid4()), taskRef={'id': 'test-local-task', 'version': 1},
                        rubricRef=ref('test-rubric'), scorerRef=ref('test-scorer'))
    if observation=='response':
        evidence.update(outputModality='choice', response={'choice': 0},
                        assessment={'outcome': 'correct', 'basis': 'authored-rule'})
    return {'id': str(uuid.uuid4()), 'contentId': content_id, 'version': version,
            'kind': 'evidence', 'at': at, 'sessionId': episode, 'evidence': evidence}


def next_inputs(client, tenant=None):
    return client.get('/api/next-step-inputs', params={'tenantId': tenant} if tenant else {})


def persisted(client):
    response = client.get('/api/content-progress')
    assert response.status_code == 200, response.text
    return response.json()['events']


def db_dump(path, exclude_rate_limits=False):
    with sqlite3.connect(path) as connection:
        rows = list(connection.iterdump())
    return [row for row in rows if not row.startswith('INSERT INTO "rate_limits"')] if exclude_rate_limits else rows


def as_hint(response):
    hint = copy.deepcopy(response)
    hint['id'] = str(uuid.uuid4())
    hint['at'] -= 10
    hint['evidence'].update(observation='hint', response=None, assessment=None, outputModality='none')
    hint['evidence']['assistance']['hint'] = True
    return hint


def test_evidence_capability_reuses_existing_table_and_database_version(env):
    app, new, _ = env
    owner = new('evidence_owner')
    before = db_dump(app.state.db_path)
    with sqlite3.connect(app.state.db_path) as connection:
        tables = connection.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").fetchall()
        version = connection.execute('PRAGMA user_version').fetchone()[0]
    assert owner.get('/api/config').json()['evidenceEvents'] is True
    assert db_dump(app.state.db_path) == before
    item = evidence_event(owner)
    assert send(owner, [item]).status_code == 200
    with sqlite3.connect(app.state.db_path) as connection:
        assert connection.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").fetchall() == tables
        assert connection.execute('PRAGMA user_version').fetchone()[0] == version
        assert connection.execute('SELECT COUNT(*) FROM content_events').fetchone()[0] == 1


def test_content_event_batch_has_its_own_bounded_body_limit(env):
    _, new, _ = env
    owner = new('evidence_owner')
    batch = [evidence_event(owner,'response') for _ in range(50)]
    encoded = json.dumps({'events':batch},ensure_ascii=False).encode('utf-8')
    assert 16384<len(encoded)<512*1024
    response = owner.post('/api/content-progress',content=encoded,headers={'Content-Type':'application/json'})
    assert response.status_code == 200, response.text
    assert len(persisted(owner)) == 50
    oversized = b'{"events":[],"padding":"'+b'x'*(512*1024)+b'"}'
    assert owner.post('/api/content-progress',content=oversized,headers={'Content-Type':'application/json'}).status_code == 413
    assert owner.post('/api/translate',content=b' '*16385,headers={'Content-Type':'application/json'}).status_code == 413
    assert len(persisted(owner)) == 50


def test_evidence_uses_existing_auth_csrf_origin_and_account_guard(env):
    _, new, anon = env
    owner, other = new('evidence_owner'), new('evidence_other')
    item = evidence_event(owner)
    assert send(anon, [item]).status_code == 401
    csrf = owner.headers.pop('X-CSRF-Token')
    assert send(owner, [item]).status_code == 403
    owner.headers['X-CSRF-Token'] = csrf
    assert owner.post('/api/content-progress', headers={'Origin': 'https://elsewhere.invalid'}, json={'events': [item]}).status_code == 403
    owner.headers['X-Nabu-Account'] = other.headers['X-Nabu-Account']
    assert send(owner, [item]).status_code == 409
    owner.headers['X-Nabu-Account'] = item['evidence']['actor']['userId']
    assert send(other, [item]).status_code == 403
    item['evidence']['actor']['userId'] = None
    assert send(owner, [item]).status_code == 403
    assert persisted(owner) == persisted(other) == []


@pytest.mark.parametrize('observation', sorted(content_progress.OBSERVATIONS))
def test_all_explicit_observations_round_trip_without_inventing_assessment(env, observation):
    _, new, _ = env
    owner = new('evidence_owner')
    item = evidence_event(owner, observation)
    assert send(owner, [item]).status_code == 200
    assert persisted(owner) == [item]
    assert next_inputs(owner).json()['contentEvents'] == [item]
    assert owner.get('/api/library').json()['cards'] == []
    assert owner.get('/api/library').json()['logs'] == []
    if observation!='response':
        assert persisted(owner)[0]['evidence']['assessment'] is None
        assert persisted(owner)[0]['evidence']['response'] is None


@pytest.mark.parametrize('path,value', [
    (('evidence','schemaVersion'), 2),
    (('evidence','episodeId'), 'short'),
    (('evidence','retryOfEpisodeId'), 'short'),
    (('evidence','actor','userId'), '!locked'),
    (('evidence','actor','tenantId'), '../../team'),
    (('evidence','intentRef'), {'id':'test-intent','revision':1_000_001}),
    (('evidence','occurrence','version'), True),
    (('evidence','occurrence','contentId'), 'wrong-source'),
    (('evidence','occurrence','readingId'), 'raw\nparagraph'),
    (('evidence','occurrence','context','senseId'), 'x'*161),
    (('evidence','inputModality'), 'guessed-language'),
    (('evidence','outputModality'), 'recognition'),
    (('evidence','observation'), ['response']),
    (('evidence','assistance','hint'), None),
    (('evidence','presentedAt'), -1),
    (('evidence','taskRef','version'), 0),
    (('evidence','scorerRef','status'), ['verified']),
    (('evidence','scorerRef','version'), 'x'*81),
    (('evidence','rubricRef','provenance'), [{'sourceId':'s','locator':'l','kind':'k','rawText':'private'}]),
    (('evidence','assessment','outcome'), 'mastered'),
    (('evidence','assessment','basis'), 'server-verified'),
    (('evidence','response','choice'), True),
    (('evidence','response','choice'), 100),
    (('evidence','skipReason'), 'too-hard'),
    (('at',), 1.5),
    (('at',), 2**53),
    (('version',), 2),
    (('sessionId',), str(uuid.uuid4())),
])
def test_invalid_evidence_values_are_rejected_without_partial_writes(env, path, value):
    _, new, _ = env
    owner = new('evidence_owner')
    item = evidence_event(owner, 'response')
    target = item
    for key in path[:-1]:
        target = target[key]
    target[path[-1]] = value
    response = send(owner, [evidence_event(owner), item])
    assert response.status_code == 422, response.text
    assert persisted(owner) == []


@pytest.mark.parametrize('location,key', [
    ((), 'rawMedia'), (('evidence',), 'intentText'),
    (('evidence','actor'), 'displayName'),
    (('evidence','occurrence'), 'paragraph'),
    (('evidence','occurrence','context'), 'rawText'),
    (('evidence','assistance'), 'maybeHelp'),
    (('evidence','response'), 'rawQuestion'),
    (('evidence','scorerRef'), 'currentAnswer'),
])
def test_unknown_fields_cannot_store_hidden_intent_or_media_bodies(env, location, key):
    _, new, _ = env
    owner = new('evidence_owner')
    item = evidence_event(owner, 'response')
    target = item
    for part in location:
        target = target[part]
    target[key] = 'PRIVATE_UNNECESSARY_TEXT'
    assert send(owner, [item]).status_code == 422
    assert persisted(owner) == []


@pytest.mark.parametrize('key', ['attemptId','taskRef','scorerRef','rubricRef','presentedAt'])
@pytest.mark.parametrize('observation', ['response','hint','answer-revealed','skipped'])
def test_task_observation_requires_complete_attempt_identity(env, key, observation):
    _, new, _ = env
    owner = new('evidence_owner')
    item = evidence_event(owner, observation)
    item['evidence'][key] = None
    assert send(owner, [item]).status_code == 422


def test_raw_answer_is_bounded_and_only_accepted_for_an_assessed_task(env):
    _, new, _ = env
    owner = new('evidence_owner')
    item = evidence_event(owner, 'response')
    item['evidence'].update(outputModality='text', response={'answer':'خذي وقتك'}, assessment=None)
    assert send(owner, [item]).status_code == 200
    assert persisted(owner)[0]['evidence']['response'] == {'answer':'خذي وقتك'}
    assert persisted(owner)[0]['evidence']['assessment'] is None
    for answer in (' ', 'a'*301, '😀'*151, '\ufeff', '\x00answer', 'answer\x7f'):
        invalid = evidence_event(owner, 'response')
        invalid['evidence'].update(outputModality='text', response={'answer':answer})
        assert send(owner, [invalid]).status_code == 422
    passive = evidence_event(owner)
    passive['evidence']['response'] = {'answer':'Do not retain media as a passive response.'}
    assert send(owner, [passive]).status_code == 422
    played = evidence_event(owner, 'played')
    played['evidence']['inputModality'] = 'text'
    assert send(owner, [played]).status_code == 422
    passive['evidence']['response'] = None
    passive['evidence']['attemptId'] = str(uuid.uuid4())
    assert send(owner, [passive]).status_code == 422


def test_canonical_delivery_retries_are_idempotent_and_conflicts_are_atomic(env):
    _, new, _ = env
    owner = new('evidence_owner')
    item = evidence_event(owner, 'response')
    assert send(owner, [item,item]).status_code == 200
    reordered = json.loads(json.dumps(item, sort_keys=True))
    assert send(owner, [reordered]).status_code == 200
    assert persisted(owner) == [item]
    changed = copy.deepcopy(item)
    changed['evidence']['response']['choice'] = 1
    assert send(owner, [evidence_event(owner),changed]).status_code == 409
    assert persisted(owner) == [item]


def test_second_terminal_delivery_cannot_count_the_same_attempt_again(env):
    _, new, _ = env
    owner = new('evidence_owner')
    item = evidence_event(owner, 'response')
    assert send(owner, [item]).status_code == 200
    duplicate = copy.deepcopy(item)
    duplicate['id'] = str(uuid.uuid4())
    assert send(owner, [duplicate]).status_code == 409
    duplicate['evidence'].update(observation='skipped', response=None, assessment=None, outputModality='none', skipReason='not-now')
    assert send(owner, [duplicate]).status_code == 409
    retry = copy.deepcopy(item)
    retry.update(id=str(uuid.uuid4()), sessionId=str(uuid.uuid4()))
    retry['evidence'].update(episodeId=retry['sessionId'], attemptId=str(uuid.uuid4()), retryOfEpisodeId=item['sessionId'])
    assert send(owner, [retry]).status_code == 200
    assert len(persisted(owner)) == 2


def test_retry_lineage_rejects_cycles_atomically_but_allows_out_of_order_parents(env):
    _, new, _ = env
    owner = new('evidence_owner')
    first, second = evidence_event(owner), evidence_event(owner)
    first['evidence']['retryOfEpisodeId'] = second['sessionId']
    second['evidence']['retryOfEpisodeId'] = first['sessionId']
    assert send(owner,[first,second]).status_code == 409
    assert persisted(owner) == []
    assert send(owner,[first]).status_code == 200
    assert send(owner,[second]).status_code == 409
    second['evidence']['retryOfEpisodeId'] = None
    assert send(owner,[second]).status_code == 200
    assert persisted(owner) == [first,second]


def test_episode_can_cover_multiple_tasks_but_actor_and_retry_parent_are_fixed(env):
    _, new, _ = env
    owner = new('evidence_owner')
    team(owner, 'evidence-team')
    first = evidence_event(owner, 'response')
    assert send(owner, [first]).status_code == 200
    second = copy.deepcopy(first)
    second['id'] = str(uuid.uuid4())
    second['evidence']['attemptId'] = str(uuid.uuid4())
    second['evidence']['taskRef']['id'] = 'another-test-task'
    second['evidence']['occurrence']['context']['senseId'] = 'another-sense'
    assert send(owner, [second]).status_code == 200
    changed = copy.deepcopy(second)
    changed['id'] = str(uuid.uuid4())
    changed['evidence']['attemptId'] = str(uuid.uuid4())
    changed['evidence']['actor']['tenantId'] = 'evidence-team'
    assert send(owner, [changed]).status_code == 409
    changed['evidence']['actor']['tenantId'] = None
    changed['evidence']['retryOfEpisodeId'] = str(uuid.uuid4())
    assert send(owner, [changed]).status_code == 409


@pytest.mark.parametrize('key', ['occurrence','taskRef','scorerRef','rubricRef','analysisRef','inputModality','presentedAt'])
def test_attempt_identity_cannot_change_between_help_and_response(env, key):
    _, new, _ = env
    owner = new('evidence_owner')
    response = evidence_event(owner, 'response')
    hint = as_hint(response)
    assert send(owner, [hint]).status_code == 200
    changed = copy.deepcopy(response)
    if key=='occurrence':
        changed['evidence'][key]['context']['speakerId'] = 'different-speaker'
    elif key=='inputModality':
        changed['evidence'][key] = 'audio'
    elif key=='presentedAt':
        changed['evidence'][key] -= 1
    elif key=='analysisRef':
        changed['evidence'][key] = ref('new-analysis')
    else:
        changed['evidence'][key]['version'] = 2
    assert send(owner, [changed]).status_code == 409
    response['evidence']['assistance']['hint'] = True
    assert send(owner, [response]).status_code == 200
    assert persisted(owner) == [hint,response]


def test_own_export_retains_all_scopes_but_next_step_inputs_filter_enveloped_rows(env):
    _, new, _ = env
    owner, member = new('evidence_owner'), new('evidence_member')
    team(owner, 'evidence-one', member)
    team(owner, 'evidence-two', member)
    legacy = legacy_event()
    personal, one, two = [evidence_event(member, tenant=tenant) for tenant in (None,'evidence-one','evidence-two')]
    private_peer = evidence_event(owner, tenant='evidence-one')
    assert send(member, [legacy,personal,one,two]).status_code == 200
    assert send(owner, [private_peer]).status_code == 200
    assert len(persisted(member)) == 4
    for scope, expected in [(None,personal),('evidence-one',one),('evidence-two',two)]:
        result = next_inputs(member, scope).json()
        assert {item['id'] for item in result['contentEvents']} == {legacy['id'],expected['id']}
        assert result['evidenceScope']['tenantAttribution'] == 'not-recorded'
        assert private_peer['id'] not in json.dumps(result)
    assert {item['id'] for item in next_inputs(owner, 'evidence-one').json()['contentEvents']} == {private_peer['id']}


def test_same_delivery_id_is_isolated_between_owners(env):
    _, new, _ = env
    owner, other = new('evidence_owner'), new('evidence_other')
    item = evidence_event(owner)
    separate = copy.deepcopy(item)
    separate['evidence']['actor']['userId'] = other.headers['X-Nabu-Account']
    assert send(owner, [item]).status_code == 200
    assert send(other, [separate]).status_code == 200
    assert persisted(owner) == [item]
    assert persisted(other) == [separate]


def test_team_membership_and_separate_owned_intent_references_are_enforced(env):
    _, new, _ = env
    owner, member, outsider = new('evidence_owner'), new('evidence_member'), new('evidence_outsider')
    team(owner, 'evidence-team', member)
    objective = saved(owner, content('Shared objective.'), tenant='evidence-team', kind='organization')
    private = saved(member, content('Read this paragraph.'), tenant='evidence-team')
    peers_intent = saved(owner, content('OWNER_PRIVATE_INTENT'), tenant='evidence-team')
    item = evidence_event(member, 'response', tenant='evidence-team')
    item['evidence']['intentRef'] = {'id':private['id'],'revision':private['revision']}
    item['evidence']['organizationObjectiveRef'] = {'id':objective['id'],'revision':objective['revision']}
    assert send(member, [item]).status_code == 200
    peer_reference = evidence_event(member, tenant='evidence-team')
    peer_reference['evidence']['intentRef'] = {'id':peers_intent['id'],'revision':1}
    assert send(member, [peer_reference]).status_code == 404
    wrong_scope = evidence_event(member)
    wrong_scope['evidence']['intentRef'] = {'id':private['id'],'revision':1}
    assert send(member, [wrong_scope]).status_code == 404
    wrong_kind = evidence_event(member, tenant='evidence-team')
    wrong_kind['evidence']['intentRef'] = {'id':objective['id'],'revision':1}
    assert send(member, [wrong_kind]).status_code == 404
    assert send(outsider, [evidence_event(outsider, tenant='evidence-team')]).status_code == 403
    result = next_inputs(member, 'evidence-team').json()
    assert result['intentContext']['immediateIntent']['id'] == private['id']
    assert result['intentContext']['organizationObjective']['id'] == objective['id']
    assert 'OWNER_PRIVATE_INTENT' not in json.dumps(result)


def test_historical_intent_revision_and_unchanged_delivery_survive_edits_and_deletion(env):
    _, new, _ = env
    owner = new('evidence_owner')
    intent = saved(owner)
    item = evidence_event(owner)
    item['evidence']['intentRef'] = {'id':intent['id'],'revision':1}
    assert send(owner, [item]).status_code == 200
    current = edit(owner, intent, rawText='A later intention.').json()['intent']
    historical = evidence_event(owner)
    historical['evidence']['intentRef'] = {'id':intent['id'],'revision':1}
    assert send(owner, [historical]).status_code == 200
    future = evidence_event(owner)
    future['evidence']['intentRef'] = {'id':intent['id'],'revision':current['revision']+1}
    assert send(owner, [future]).status_code == 409
    assert owner.request('DELETE','/api/intents/'+intent['id'],json={'revision':current['revision']}).status_code == 200
    assert send(owner, [item]).status_code == 200
    new_after_deletion = copy.deepcopy(item)
    new_after_deletion['id'] = str(uuid.uuid4())
    assert send(owner, [new_after_deletion]).status_code == 404
    assert persisted(owner) == [item,historical]


def test_revocation_blocks_new_team_writes_and_retries_but_not_own_history_export(env):
    app, new, _ = env
    owner, member = new('evidence_owner'), new('evidence_member')
    team(owner, 'evidence-team', member)
    item = evidence_event(member, tenant='evidence-team')
    assert send(member, [item]).status_code == 200
    with sqlite3.connect(app.state.db_path) as connection:
        connection.execute('DELETE FROM decision_memberships WHERE tenant_id=? AND user_id=?',('evidence-team',member.headers['X-Nabu-Account']))
    # Rejected POSTs still consume the existing rate limiter; event and learner
    # data must remain unchanged despite those administrative counter writes.
    before = db_dump(app.state.db_path, exclude_rate_limits=True)
    assert send(member, [item]).status_code == 403
    assert send(member, [evidence_event(member, tenant='evidence-team')]).status_code == 403
    assert next_inputs(member, 'evidence-team').status_code == 403
    assert persisted(member) == [item]
    assert db_dump(app.state.db_path, exclude_rate_limits=True) == before


def test_scope_filtering_happens_before_the_bounded_snapshot_limit(env, monkeypatch):
    _, new, _ = env
    owner = new('evidence_owner')
    team(owner, 'evidence-team')
    personal = evidence_event(owner)
    assert send(owner, [personal,evidence_event(owner,tenant='evidence-team'),evidence_event(owner,tenant='evidence-team')]).status_code == 200
    monkeypatch.setattr(next_step_inputs,'LIMITS',{'cards':5000,'logs':10000,'contentEvents':1})
    result = next_inputs(owner).json()
    assert result['contentEvents'] == [personal]
    assert result['truncated']['contentEvents'] is False
    assert next_inputs(owner,'evidence-team').json()['truncated']['contentEvents'] is True


@pytest.mark.parametrize('status', ['authored','verified','inferred','unknown','quarantined'])
def test_historical_versions_and_analysis_status_are_retained_without_regrading(env, status):
    app, new, _ = env
    owner = new('evidence_owner')
    item = evidence_event(owner,'response',content_id='bank:historical-entry',version=3)
    item['evidence']['taskRef']['version'] = 'retired-task-v0'
    item['evidence']['scorerRef'] = ref('retired-scorer','old-rules-v0',status)
    item['evidence']['rubricRef'] = ref('retired-rubric',2,status)
    item['evidence']['analysisRef'] = ref('historical-analysis','parse-v0',status)
    item['evidence']['assessment'] = {'outcome':'incorrect','basis':'self-report'}
    assert send(owner,[item]).status_code == 200
    before = db_dump(app.state.db_path)
    assert persisted(owner) == [item]
    assert next_inputs(owner).json()['contentEvents'] == [item]
    assert next_inputs(owner).json()['contentEvents'] == [item]
    assert db_dump(app.state.db_path) == before


def test_next_step_projection_strips_extra_private_fields_even_from_an_imported_row(env):
    app, new, _ = env
    owner = new('evidence_owner')
    item = evidence_event(owner,'response')
    assert send(owner,[item]).status_code == 200
    imported = copy.deepcopy(item)
    imported['rawMedia'] = 'HIDDEN_MEDIA'
    imported['evidence']['rawIntent'] = 'HIDDEN_INTENT'
    imported['evidence']['actor']['name'] = 'HIDDEN_NAME'
    imported['evidence']['occurrence']['context']['rawText'] = 'HIDDEN_CONTEXT'
    imported['evidence']['scorerRef']['rawPrompt'] = 'HIDDEN_PROMPT'
    imported['evidence']['scorerRef']['provenance'][0]['privateNote'] = 'HIDDEN_NOTE'
    imported['evidence']['assessment']['explanation'] = 'HIDDEN_ASSESSMENT'
    with sqlite3.connect(app.state.db_path) as connection:
        connection.execute('UPDATE content_events SET payload=? WHERE user_id=? AND event_id=?',(json.dumps(imported),owner.headers['X-Nabu-Account'],item['id']))
    result = next_inputs(owner).json()
    assert 'HIDDEN_' not in json.dumps(result)
    assert result['contentEvents'] == [item]


@pytest.mark.parametrize('kind', ['opened','help','attempt'])
def test_optional_legacy_envelope_preserves_original_event_contract(env, kind):
    _, new, _ = env
    owner = new('evidence_owner')
    observation = {'opened':'displayed','help':'hint','attempt':'response'}[kind]
    wrapped = evidence_event(owner,observation,content_id='a-little-later')
    if kind=='opened':
        original = legacy_event()
    elif kind=='help':
        original = legacy_event('help',activityId='p1',sessionId=str(uuid.uuid4()),help='hint')
    else:
        original = legacy_event('attempt',activityId='p1',sessionId=str(uuid.uuid4()),choice=0,assisted=False,skipped=False)
    original['evidence'] = wrapped['evidence']
    original['at'] = wrapped['at']
    assert send(owner,[original]).status_code == 200
    assert persisted(owner) == [original]
    assert next_inputs(owner).json()['contentEvents'] == [original]
    if kind=='attempt':
        changed = copy.deepcopy(original)
        changed['id'] = str(uuid.uuid4())
        changed['choice'] = 1
        assert send(owner,[changed]).status_code == 422


@pytest.mark.parametrize('kind', ['opened','help','attempt'])
def test_historical_legacy_envelope_remains_retainable_without_current_catalogue(env, kind):
    _, new, _ = env
    owner = new('evidence_owner')
    observation = {'opened':'displayed','help':'hint','attempt':'response'}[kind]
    item = evidence_event(owner,observation,content_id='retired-catalogue-item',version=7)
    item['kind'] = kind
    if kind=='opened':
        del item['sessionId']
    else:
        item['activityId'] = 'retired-activity'
        item['sessionId'] = str(uuid.uuid4())
        if kind=='help':
            item['help'] = 'hint'
        else:
            item.update(choice=0,assisted=False,skipped=False)
    assert send(owner,[item]).status_code == 200
    assert persisted(owner) == [item]
    assert next_inputs(owner).json()['contentEvents'] == [item]
    legacy_without_envelope = copy.deepcopy(item)
    del legacy_without_envelope['evidence']
    legacy_without_envelope['id'] = str(uuid.uuid4())
    assert send(owner,[legacy_without_envelope]).status_code == 422


def test_audit_stream_does_not_change_legacy_decisions_cards_or_schedules(env):
    _, new, _ = env
    owner = new('evidence_owner')
    put(owner,card(note='Private original note.'))
    assert send(owner,[legacy_event()]).status_code == 200
    decisions = owner.get('/api/decisions').json()
    library = owner.get('/api/library').json()
    items = [evidence_event(owner,observation,content_id='a-little-later') for observation in ('displayed','lookup','response','skipped')]
    assert send(owner,items).status_code == 200
    assert owner.get('/api/decisions').json() == decisions
    assert owner.get('/api/library').json() == library
    assert next_inputs(owner).json()['logs'] == []


@pytest.mark.parametrize('requested_scope', [None,'decisions-one','decisions-two'])
def test_legacy_decisions_use_only_matching_envelopes_and_preserve_unscoped_history(env, requested_scope):
    _, new, _ = env
    owner = new('decision_evidence_owner')
    team(owner,'decisions-one')
    team(owner,'decisions-two')
    legacy = [
        legacy_event(),
        legacy_event('position',segmentId='s1',fraction=.25),
        legacy_event('preference',value=True),
        legacy_event('attempt',activityId='p1',sessionId=str(uuid.uuid4()),choice=0,assisted=False,skipped=False),
    ]
    assert send(owner,legacy).status_code == 200
    counts = {None:1,'decisions-one':2,'decisions-two':3}
    for scope, openings in counts.items():
        scoped = []
        for _ in range(openings):
            opening = evidence_event(owner,'displayed',tenant=scope,content_id='a-little-later')
            opening['kind'] = 'opened'
            del opening['sessionId']
            scoped.append(opening)
        attempt = evidence_event(owner,'response',tenant=scope,content_id='a-little-later')
        attempt.update(kind='attempt',activityId='p1',sessionId=str(uuid.uuid4()),choice=0,assisted=False,skipped=False)
        scoped.append(attempt)
        # Standalone observations do not enter the legacy fold in any scope.
        scoped.append(evidence_event(owner,tenant=scope,content_id='a-little-later'))
        assert send(owner,scoped).status_code == 200
    params = {'mode':'enterprise-defined' if requested_scope else 'individual-defined','destination':'a-little-later'}
    if requested_scope:
        params['tenantId'] = requested_scope
    response = owner.get('/api/decisions',params=params)
    assert response.status_code == 200, response.text
    result = response.json()
    own_openings = counts[requested_scope]
    assert result['evidenceEvents'] == len(legacy)+own_openings+1
    assert result['tenantId'] == requested_scope
    assert result['state'] == {'contentItems':1,'completed':0}
    assert len(result['recommendations']) == 1
    recommendation = result['recommendations'][0]
    assert recommendation['reason'] == {'novelty':round(1/(2+own_openings),4),'resume':.15,'preference':.1}
    assert recommendation['nextAction'] == 'resume'


def test_history_limit_keeps_unchanged_retries_and_atomicity(env, monkeypatch):
    _, new, _ = env
    owner = new('evidence_owner')
    monkeypatch.setattr(content_progress,'MAX_EVENTS',1)
    item = evidence_event(owner)
    assert send(owner,[item]).status_code == 200
    assert send(owner,[item]).status_code == 200
    assert send(owner,[evidence_event(owner)]).status_code == 409
    assert persisted(owner) == [item]


def test_evidence_survives_server_restart_and_account_deletion_cascades(env):
    app, new, _ = env
    owner = new('evidence_owner')
    item = evidence_event(owner,'response')
    assert send(owner,[item]).status_code == 200
    with TestClient(create_app(app.state.db_path,'http://testserver',invite='',translation_key=''),headers={'Origin':'http://testserver'}) as client:
        assert client.post('/api/login',json={'handle':'evidence_owner','password':PASSWORD}).status_code == 200
        assert persisted(client) == [item]
    assert owner.request('DELETE','/api/account',json={'password':PASSWORD}).status_code == 200
    with sqlite3.connect(app.state.db_path) as connection:
        assert connection.execute('SELECT COUNT(*) FROM content_events WHERE user_id=?',(owner.headers['X-Nabu-Account'],)).fetchone()[0] == 0
