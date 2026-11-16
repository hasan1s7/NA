"""Real auth/SQLite integration for the one-learner/two-organizations milestone."""
import copy
import json
import sqlite3
import time
import uuid

import pytest
from fastapi.testclient import TestClient
from test_social import env, put, card, PASSWORD
from test_intents import saved as save_intent, content
from server import create_app
from institutions import LANGUAGES, normalized


def uid():
    return str(uuid.uuid4())


def ok(response, status=200):
    assert response.status_code == status, response.text
    return response.json()


def path(tenant, suffix=''):
    return '/api/workspaces/' + tenant + suffix


def seed(owner, learner, reviewer=None, tenant='university'):
    ok(owner.post('/api/decision-tenants', json={'id': tenant, 'label': tenant}))
    for user in {learner.headers['X-Nabu-Account'], (reviewer or owner).headers['X-Nabu-Account']}:
        ok(owner.post('/api/decision-tenants/' + tenant + '/members', json={'userId': user}))
    source = {'id': uid(), 'version': 1, 'title': 'A quiet meeting', 'text': 'خذي وقتك، فالكتاب الذي معي ممتع.',
              'language': 'ar', 'attribution': 'Authored test fixture', 'rights': 'Original test material'}
    ok(owner.post(path(tenant, '/sources'), json=source))
    task = {'id': uid(), 'title': 'Understand the invitation', 'sourceId': source['id'], 'sourceVersion': 1,
            'prompt': 'What does خذي وقتك mean here?', 'mode': 'recall', 'sourceVisible': True,
            'rubric': {'acceptedAnswers': ['Take your time'], 'normalization': 'nfc-casefold-space'}}
    ok(owner.post(path(tenant, '/tasks'), json=task))
    assignment = {'id': uid(), 'learnerId': learner.headers['X-Nabu-Account'], 'taskId': task['id'],
                  'rubricVersion': 1, 'reviewerIds': [(reviewer or owner).headers['X-Nabu-Account']],
                  'sharing': 'responses', 'objective': 'Interpret this expression in this passage.'}
    ok(owner.post(path(tenant, '/assignments'), json=assignment))
    return tenant, source, task, assignment


@pytest.fixture
def world(env):
    app, new, anon = env
    owner = new('department')
    company = new('company')
    learner = new('learner')
    reviewer = new('reviewer')
    a = seed(owner, learner, reviewer)
    b = seed(company, learner, tenant='corporation')
    return app, owner, company, learner, reviewer, a, b, anon


def accept(learner, item):
    return ok(learner.put(path(item[0], '/assignments/' + item[3]['id'] + '/acceptance'), json={'decision': 'accepted'}))


def response(item, **extra):
    return {'id': uid(), 'assignmentId': item[3]['id'], 'response': 'Take your time',
            'occurredAt': int(time.time() * 1000), 'assistance': {}, **extra}


def send(learner, item, data=None):
    return learner.post(path(item[0], '/attempts'), json=data or response(item))


def record(user, item):
    return user.get(path(item[0], '/assignments/' + item[3]['id']))


def test_private_workspace_and_two_organizations_are_separate(world):
    app, owner, company, learner, reviewer, a, b, _ = world
    put(learner, card(note='PRIVATE vocabulary note'))
    private = save_intent(learner, content('PRIVATE poetry goal'))
    assert len(ok(learner.get('/api/workspaces'))['workspaces']) == 2
    assert ok(owner.get('/api/workspaces'))['workspaces'][0]['id'] == a[0]
    assert company.get(path(a[0], '/authoring')).status_code == 403
    assert owner.get(path(b[0], '/assignments')).status_code == 403
    assert len(ok(learner.get(path(a[0], '/assignments')))['assignments']) == 1
    assert len(ok(learner.get(path(b[0], '/assignments')))['assignments']) == 1
    for user in [owner, reviewer, company]:
        assert private['id'] not in user.get('/api/intents').text
        assert 'PRIVATE' not in user.get('/api/library').text
    assert ok(learner.get('/api/content-progress'))['events'] == []


def test_owner_is_not_automatically_a_reviewer_and_acceptance_is_required(world):
    _, owner, _, learner, reviewer, a, _, _ = world
    assert record(owner, a).status_code == 403
    assert record(reviewer, a).status_code == 403
    assert send(learner, a).status_code == 403
    offer = ok(record(learner, a))
    assert 'rubrics' not in offer
    assert 'acceptedAnswers' not in json.dumps(offer)
    assert reviewer.put(path(a[0], '/assignments/' + a[3]['id'] + '/acceptance'), json={'decision': 'accepted'}).status_code == 403
    accept(learner, a)
    assert ok(record(reviewer, a))['canReview'] is True
    assert record(owner, a).status_code == 403


def test_decline_does_not_become_failure_and_terms_cannot_change(world):
    _, owner, _, learner, _, a, _, _ = world
    ok(learner.put(path(a[0], '/assignments/' + a[3]['id'] + '/acceptance'), json={'decision': 'declined'}))
    assert send(learner, a).status_code == 403
    assert ok(record(learner, a))['attempts'] == []
    changed = {**a[3], 'sharing': 'results'}
    assert owner.post(path(a[0], '/assignments'), json=changed).status_code == 409
    assert learner.put(path(a[0], '/assignments/' + a[3]['id'] + '/acceptance'), json={'decision': 'accepted'}).status_code == 409


def test_offline_duplicate_lost_acknowledgement_and_retry_count_once(world):
    _, owner, _, learner, _, a, _, _ = world
    accept(learner, a)
    data = response(a, offline=True)
    assert send(learner, a, data).status_code == 403
    ok(owner.put(path(a[0], '/policy'), json={'revision': 1, 'offlineResponses': True}))
    first = ok(send(learner, a, data))
    again = ok(send(learner, a, data))
    assert first['duplicate'] is False and again['duplicate'] is True
    assert again['record']['directObservations'] == 1
    assert len(again['record']['attempts']) == 1
    assert send(learner, a, {**data, 'response': 'Changed after seeing feedback'}).status_code == 409
    assert send(learner, a).status_code == 409
    retry = ok(send(learner, a, response(a, retryOf=data['id'])))['record']
    assert retry['directObservations'] == 1 and len(retry['attempts']) == 2
    assert retry['attempts'][1]['assessments'][0]['assistance']['previousFeedback'] is True
    # Revoked policy rejects new offline uploads, but acknowledges a previously stored identical delivery.
    ok(owner.put(path(a[0], '/policy'), json={'revision': 2, 'offlineResponses': False}))
    assert ok(send(learner, a, data))['duplicate'] is True
    assert send(learner, a, response(a, offline=True, retryOf=data['id'])).status_code == 403


def test_unknown_retry_parent_and_other_workspace_parent_are_rejected(world):
    _, _, _, learner, _, a, b, _ = world
    accept(learner, a); accept(learner, b)
    rb = ok(send(learner, b))['acknowledgedId']
    assert send(learner, a, response(a, retryOf=uid())).status_code == 409
    assert send(learner, a, response(a, retryOf=rb)).status_code == 409
    assert ok(record(learner, a))['attempts'] == []


def test_server_assistance_and_bounded_rubric_do_not_claim_mastery(world):
    _, _, _, learner, _, a, _, _ = world
    accept(learner, a)
    assessed = ok(send(learner, a))['record']['attempts'][0]['assessments'][0]
    assert assessed['matched'] is True
    assert assessed['assisted'] is True
    assert assessed['assistance']['sourceAvailable'] is True
    assert assessed['conditionsVerified'] is False
    assert assessed['mastery'] is None
    assert send(learner, a, {**response(a), 'matched': True}).status_code == 422


def test_correction_preserves_original_reassesses_explicitly_and_replays(world):
    _, owner, _, learner, reviewer, a, _, _ = world
    accept(learner, a)
    attempt = response(a, response='No rush')
    initial = ok(send(learner, a, attempt))['record']['attempts'][0]['assessments'][0]
    assert initial['matched'] is False
    appeal = {'id': uid(), 'assessmentId': initial['id'], 'reason': 'No rush is also a valid reading in this context.'}
    ok(learner.post(path(a[0], '/assignments/' + a[3]['id'] + '/appeals'), json=appeal))
    ok(learner.post(path(a[0], '/assignments/' + a[3]['id'] + '/appeals'), json=appeal))
    correction = {'expectedVersion': 1, 'rubric': {'acceptedAnswers': ['Take your time', 'No rush'], 'normalization': 'nfc-casefold-space'}, 'reason': 'Accepted contemporary paraphrase.'}
    assert reviewer.post(path(a[0], '/tasks/' + a[2]['id'] + '/rubrics'), json=correction).status_code == 403
    version = ok(owner.post(path(a[0], '/tasks/' + a[2]['id'] + '/rubrics'), json=correction))['version']
    assert ok(owner.post(path(a[0], '/tasks/' + a[2]['id'] + '/rubrics'), json=correction))['version'] == version
    assert ok(record(learner, a))['attempts'][0]['assessments'][0]['matched'] is False
    change = {'id': uid(), 'expectedAssessmentId': initial['id'], 'rubricVersion': version, 'reason': 'Reassessed after the learner correction.'}
    endpoint = path(a[0], '/attempts/' + attempt['id'] + '/reassess')
    assert owner.post(endpoint, json=change).status_code == 403
    revised = ok(reviewer.post(endpoint, json=change))
    assert len(revised['appeals']) == 1
    results = revised['attempts'][0]['assessments']
    assert [r['matched'] for r in results] == [False, True]
    assert results[1]['supersedes'] == initial['id']
    assert len(ok(reviewer.post(endpoint, json=change))['attempts'][0]['assessments']) == 2
    assert reviewer.post(endpoint, json={**change, 'id': uid()}).status_code == 409
    replay = ok(reviewer.post(path(a[0], '/assignments/' + a[3]['id'] + '/replay'), json={}))
    assert replay['allMatch'] and replay['assessmentCount'] == 2
    assert replay['record']['directObservations'] == 1
    assert 'No rush' not in owner.get(path(a[0], '/audit')).text


def test_results_only_reviewers_do_not_receive_raw_answers_or_appeal_text(world):
    _, owner, _, learner, reviewer, a, _, _ = world
    limited = {**a[3], 'id': uid(), 'sharing': 'results'}
    ok(owner.post(path(a[0], '/assignments'), json=limited))
    item = (a[0], a[1], a[2], limited)
    accept(learner, item)
    ans = response(item, response='Private raw response')
    assessed = ok(send(learner, item, ans))['record']['attempts'][0]['assessments'][0]
    ok(learner.post(path(a[0], '/assignments/' + limited['id'] + '/appeals'), json={'id': uid(), 'assessmentId': assessed['id'], 'reason': 'PRIVATE appeal text'}))
    report = ok(record(reviewer, item))
    assert 'Private raw response' not in json.dumps(report) and 'PRIVATE appeal text' not in json.dumps(report)
    assert report['canReview'] is False
    assert reviewer.post(path(a[0], '/assignments/' + limited['id'] + '/replay'), json={}).status_code == 403
    assert learner.post(path(a[0], '/assignments/' + limited['id'] + '/replay'), json={}).status_code == 200


def test_revocation_blocks_old_and_queued_work_without_affecting_other_scope(world):
    _, owner, _, learner, reviewer, a, b, _ = world
    accept(learner, a); accept(learner, b)
    old = response(a); ok(send(learner, a, old))
    put(learner, card(note='Keep my private notes'))
    ok(owner.request('DELETE', path(a[0], '/members/' + learner.headers['X-Nabu-Account']), json={}))
    assert record(learner, a).status_code == 403
    assert record(reviewer, a).status_code == 403
    assert send(learner, a, old).status_code == 403
    assert send(learner, a, response(a, offline=True)).status_code == 403
    assert record(learner, b).status_code == 200
    assert 'Keep my private notes' in learner.get('/api/library').text
    ok(owner.post(path(a[0], '/members'), json={'handle': 'learner'}))
    assert record(learner, a).status_code == 403  # Rejoining never resurrects an old grant.


def test_removed_reviewer_cannot_regain_old_grant_by_rejoining(world):
    _, owner, _, learner, reviewer, a, _, _ = world
    accept(learner, a); ok(send(learner, a))
    target = reviewer.headers['X-Nabu-Account']
    ok(reviewer.request('DELETE', path(a[0], '/members/' + target), json={}))
    assert record(reviewer, a).status_code == 403
    ok(owner.post('/api/decision-tenants/' + a[0] + '/members', json={'userId': target}))
    assert record(reviewer, a).status_code == 403


def test_source_versions_and_task_identity_are_immutable(world):
    _, owner, _, learner, _, a, _, _ = world
    assert owner.post(path(a[0], '/sources'), json={**a[1], 'text': 'Overwritten'}).status_code == 409
    ok(owner.post(path(a[0], '/sources'), json={**a[1], 'version': 2, 'text': 'A later version.'}))
    assert ok(record(learner, a))['source']['text'] == a[1]['text']
    assert owner.post(path(a[0], '/tasks'), json={**a[2], 'sourceVersion': 2}).status_code == 409
    assert owner.post(path(a[0], '/sources'), json={**a[1], 'version': 4}).status_code == 409
    assert learner.get(path(a[0], '/authoring')).status_code == 403


def test_all_languages_preserve_script_and_literal_normalization(world):
    _, owner, _, _, _, a, _, _ = world
    examples = ['water', 'ماء', '水', 'eau', 'вода', 'agua', 'su', 'Wasser', '물', '水', 'acqua', 'água']
    for language, text in zip(sorted(LANGUAGES), examples):
        entry = {**a[1], 'id': uid(), 'language': language, 'text': text}
        assert ok(owner.post(path(a[0], '/sources'), json=entry))['source']['text'] == text
    assert normalized(' é ', 'nfc-trim') == normalized('e\u0301', 'nfc-trim')
    assert normalized('أ', 'nfc-casefold-space') != normalized('ا', 'nfc-casefold-space')
    assert normalized('كتب', 'nfc-trim') != normalized('كُتُب', 'nfc-trim')


def test_choice_scoring_and_hidden_source_do_not_leak_answer_key(world):
    _, owner, _, learner, _, a, _, _ = world
    t = {**a[2], 'id': uid(), 'mode': 'recognition', 'sourceVisible': False, 'options': ['A', 'B'], 'rubric': {'answerIndex': 1}}
    ok(owner.post(path(a[0], '/tasks'), json=t))
    ass = {**a[3], 'id': uid(), 'taskId': t['id']}
    ok(owner.post(path(a[0], '/assignments'), json=ass))
    item = (a[0], a[1], t, ass)
    before = ok(record(learner, item))
    assert 'text' not in before['source'] and 'rubrics' not in before
    accept(learner, item)
    assert send(learner, item, response(item, response='', choice=7)).status_code == 422
    result = ok(send(learner, item, response(item, response='', choice=1)))['record']['attempts'][0]['assessments'][0]
    assert result['matched'] and not result['assisted']


def test_auth_csrf_account_and_ownership_guards(world):
    _, owner, company, learner, _, a, _, anon = world
    assert anon.get('/api/workspaces').status_code == 401
    assert learner.get(path(a[0], '/members')).status_code == 403
    assert learner.post(path(a[0], '/sources'), json=a[1]).status_code == 403
    csrf = owner.headers.pop('X-CSRF-Token')
    assert owner.post(path(a[0], '/members'), json={'handle': 'reviewer'}).status_code == 403
    owner.headers['X-CSRF-Token'] = csrf
    assert owner.put(path(a[0], '/policy'), headers={'Origin': 'https://wrong.invalid'}, json={'revision': 1, 'offlineResponses': True}).status_code == 403
    owner.headers['X-Nabu-Account'] = company.headers['X-Nabu-Account']
    assert owner.get('/api/workspaces').status_code == 409


def test_server_restart_replays_and_provider_failure_is_independent(world):
    app, _, _, learner, _, a, _, _ = world
    accept(learner, a); ok(send(learner, a))
    async def unavailable(*args, **kwargs):
        raise RuntimeError('Fixture provider unavailable')
    app.state.translate = unavailable
    assert learner.post('/api/council', json={}).status_code == 503
    assert record(learner, a).status_code == 200
    app2 = create_app(app.state.db_path, 'http://testserver', invite='', translation_key='')
    with TestClient(app2, headers={'Origin': 'http://testserver'}) as c:
        auth = ok(c.post('/api/login', json={'handle': 'learner', 'password': PASSWORD}))
        c.headers['X-CSRF-Token'] = auth['csrf']
        replay = ok(c.post(path(a[0], '/assignments/' + a[3]['id'] + '/replay'), json={}))
        assert replay['allMatch'] and replay['assessmentCount'] == 1


def test_replay_detects_changed_stored_assessment_without_overwriting(world):
    app, _, _, learner, reviewer, a, _, _ = world
    accept(learner, a); ok(send(learner, a))
    with sqlite3.connect(app.state.db_path) as c:
        row = c.execute('SELECT id,payload FROM institution_assessments LIMIT 1').fetchone()
        payload = json.loads(row[1]); payload['matched'] = False
        c.execute('UPDATE institution_assessments SET payload=? WHERE id=?', (json.dumps(payload), row[0]))
    replay = ok(reviewer.post(path(a[0], '/assignments/' + a[3]['id'] + '/replay'), json={}))
    assert replay['allMatch'] is False
    assert replay['record']['attempts'][0]['assessments'][0]['matched'] is False


def test_source_and_response_are_preserved_verbatim_before_scoring(world):
    _, owner, _, learner, _, a, _, _ = world
    text = '  خذي وقتك.\n'
    revised = {**a[1], 'version': 2, 'text': text}
    assert ok(owner.post(path(a[0], '/sources'), json=revised))['source']['text'] == text
    accept(learner, a)
    raw = '  TAKE   YOUR TIME\n'
    observed = ok(send(learner, a, response(a, response=raw)))['record']['attempts'][0]
    assert observed['observation']['response'] == raw
    assert observed['assessments'][0]['matched'] is True


def test_concurrent_duplicate_delivery_has_one_authoritative_attempt(world):
    from concurrent.futures import ThreadPoolExecutor
    _, _, _, learner, _, a, _, _ = world
    accept(learner, a)
    body = response(a)
    with ThreadPoolExecutor(max_workers=4) as pool:
        replies = list(pool.map(lambda _: send(learner, a, body), range(8)))
    outputs = [ok(r) for r in replies]
    assert sum(not r['duplicate'] for r in outputs) == 1
    assert len(ok(record(learner, a))['attempts']) == 1


def test_account_deletion_cascades_without_corrupting_other_workspace(world):
    app, owner, _, learner, _, a, b, _ = world
    accept(learner, a); accept(learner, b)
    ok(send(learner, a)); ok(send(learner, b))
    ok(owner.request('DELETE', '/api/account', json={'password': PASSWORD}))
    assert len(ok(learner.get('/api/workspaces'))['workspaces']) == 1
    assert len(ok(record(learner, b))['attempts']) == 1
    with sqlite3.connect(app.state.db_path) as c:
        assert c.execute('PRAGMA foreign_key_check').fetchall() == []


def test_oversized_versions_and_cursors_are_rejected_before_sql(world):
    _, owner, _, learner, _, a, _, _ = world
    assert owner.post(path(a[0], '/sources'), json={**a[1], 'version': 10**40}).status_code == 422
    assert owner.get(path(a[0], '/audit'), params={'after': str(10**40)}).status_code == 422
    assert owner.put(path(a[0], '/policy'), json={'revision': 10**40, 'offlineResponses': True}).status_code == 422
    assert send(learner, a, response(a, occurredAt=10**40)).status_code == 422
