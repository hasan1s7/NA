"""Department support: real authenticated HTTP/SQLite contracts, no providers."""
import json
import sqlite3
import time

import pytest
from fastapi.testclient import TestClient
from test_social import env, PASSWORD, put, card
from test_institutions import uid, ok, path
from server import create_app

TENANT = 'arabic_pilot'
BASE = path(TENANT)


@pytest.fixture
def pilot(env):
    app, new, anon = env
    owner = new('pilot_owner')
    reviewer = new('pilot_reviewer')
    outsider = new('pilot_outsider')
    ok(owner.post('/api/decision-tenants', json={'id': TENANT, 'label': 'Fictional Arabic pilot'}))
    ok(owner.post(BASE + '/members', json={'handle': 'pilot_reviewer'}))
    source = {'id': uid(), 'version': 1, 'title': 'Private source fixture', 'text': 'خذي وقتك.',
              'language': 'ar', 'attribution': 'Test fixture', 'rights': 'Original test sentence'}
    ok(owner.post(BASE + '/sources', json=source))
    tasks = {}
    for visible in (True, False):
        task = {'id': uid(), 'title': 'Interpret the request', 'sourceId': source['id'], 'sourceVersion': 1,
                'prompt': 'Give a short meaning.', 'mode': 'recall', 'sourceVisible': visible,
                'rubric': {'acceptedAnswers': ['Take your time'], 'normalization': 'nfc-casefold-space'}}
        ok(owner.post(BASE + '/tasks', json=task)); tasks[visible] = task
    learners, assignments = [], []

    def add(n=5, enabled=True, accepted=True, response='Take your time', visible=True):
        for _ in range(n):
            handle = 'pilot_learner_' + str(len(learners))
            # Distinct client addresses model independently registering learners;
            # the production five-registrations/IP/hour guard remains unchanged.
            learner = TestClient(app, headers={'Origin': 'http://testserver'}, client=('10.0.0.' + str(len(learners) + 1), 50000))
            auth = ok(learner.post('/api/register', json={'handle': handle, 'password': PASSWORD}), 201)
            learner.headers['X-CSRF-Token'] = auth['csrf']
            learner.headers['X-Nabu-Account'] = auth['user']['id']
            learners.append(learner)
            ok(owner.post(BASE + '/members', json={'handle': handle}))
            assignment = {'id': uid(), 'learnerId': learner.headers['X-Nabu-Account'], 'taskId': tasks[visible]['id'],
                          'rubricVersion': 1, 'reviewerIds': [reviewer.headers['X-Nabu-Account']],
                          'sharing': 'responses', 'objective': 'PRIVATE learning objective fixture'}
            ok(owner.post(BASE + '/assignments', json=assignment)); assignments.append(assignment)
            if accepted:
                ok(learner.put(BASE + '/assignments/' + assignment['id'] + '/acceptance', json={'decision': 'accepted'}))
            if enabled:
                ok(learner.put(BASE + '/support-consent', json={'policyVersion': 'department-support-v1', 'revision': 1, 'enabled': True}))
            if response is not None and accepted:
                send(learner, assignment, response)
        return learners, assignments

    yield app, owner, reviewer, outsider, anon, add, learners, assignments, tasks
    for learner in learners:
        learner.close()


def send(learner, assignment, response='Take your time', **extra):
    body = {'id': uid(), 'assignmentId': assignment['id'], 'response': response,
            'occurredAt': int(time.time() * 1000), 'assistance': {}, **extra}
    return ok(learner.post(BASE + '/attempts', json=body))


def summary(owner):
    r = owner.get(BASE + '/department-support')
    assert r.headers.get('cache-control') == 'no-store'
    return ok(r)


def released(report):
    return {c['key']: c['band'] for c in report['categories'] if c['status'] == 'released'}


def test_separate_choice_defaults_off_and_does_not_inherit_assignment_acceptance(pilot):
    _, owner, reviewer, _, _, add, learners, assignments, _ = pilot
    add(enabled=False)
    for learner in learners:
        r = learner.get(BASE + '/support-consent')
        assert r.headers['cache-control'] == 'no-store'
        choice = ok(r)
        assert choice['enabled'] is False and choice['revision'] == 1
        assert 'past and future accepted assignment' in choice['terms']
    report = summary(owner)
    assert report['status'] == 'insufficient' and report['participantBand'] is None
    assert released(report) == {}
    # An owner cannot use this feature to acquire the individual reporting grant.
    assert owner.get(BASE + '/assignments/' + assignments[0]['id']).status_code == 403
    assert reviewer.get(BASE + '/assignments/' + assignments[0]['id']).status_code == 200


def test_five_consenting_learners_release_coarse_assisted_category_without_private_fields(pilot):
    _, owner, _, _, _, add, learners, assignments, _ = pilot
    add()
    put(learners[0], card(note='SECRET personal note', front='privateword'))
    report = summary(owner)
    assert report['status'] == 'available'
    assert report['participantBand'] == {'lower': 5, 'upper': 9, 'label': '5–9'}
    assert released(report) == {'assisted_evidence': {'lower': 5, 'upper': 9, 'label': '5–9'}}
    assert report['learnerModelUpdated'] is False and report['conditionsVerified'] is False
    assert 'differential privacy' in report['notice']
    serialized = json.dumps(report)
    for forbidden in ['SECRET', 'privateword', 'Take your time', 'PRIVATE learning objective']:
        assert forbidden not in serialized
    # Static explanations may say "responses" or "assessments". They must not
    # contain corresponding record fields or any learner/assignment identifier.
    for field in ['learnerId', 'assignmentId', 'occurredAt', 'createdAt', 'response', 'assessments']:
        assert json.dumps(field) + ':' not in serialized
    assert all(x['learnerId'] not in serialized and x['id'] not in serialized for x in assignments)
    assert all(ok(l.get('/api/content-progress'))['events'] == [] for l in learners)


def test_below_threshold_does_not_reveal_count_or_zero_cells(pilot):
    _, owner, _, _, _, add, _, _, _ = pilot
    before = summary(owner)
    add(n=4)
    after = summary(owner)
    assert before == after  # Zero and four eligible learners have the same released view.
    assert all(c['status'] == 'suppressed' and c['band'] is None for c in after['categories'])
    assert after['recommendations'][0]['action'] == 'insufficient_information'


def test_complement_suppression_blocks_five_plus_one_release(pilot):
    _, owner, _, _, _, add, _, _, _ = pilot
    add(n=5, response='Unlisted answer')
    add(n=1)
    report = summary(owner)
    assert report['participantBand']['label'] == '5–9'
    assert released(report) == {}
    assert report['recommendations'][0]['action'] == 'insufficient_information'


def test_two_large_categories_release_bands_not_rates_or_exact_counts(pilot):
    _, owner, _, _, _, add, _, _, _ = pilot
    add(n=5, response='Unlisted answer', visible=False)
    add(n=5, visible=False)
    report = summary(owner)
    assert report['participantBand'] == {'lower': 10, 'upper': 14, 'label': '10–14'}
    assert set(released(report)) == {'review_rubric', 'task_matches'}
    assert all(b['lower'] == 5 and b['upper'] == 9 for b in released(report).values())
    assert 'count' not in report and 'rate' not in report
    assert {x['action'] for x in report['recommendations']} == {'review_rubrics', 'continue_meaningful_content'}


def test_consent_is_self_only_strict_revisioned_and_idempotent(pilot):
    _, owner, _, _, _, add, learners, _, _ = pilot
    add(n=1, enabled=False, response=None)
    learner = learners[0]
    chosen = ok(learner.put(BASE + '/support-consent', json={'policyVersion': 'department-support-v1', 'revision': 1, 'enabled': True}))
    assert chosen['revision'] == 2
    assert ok(learner.put(BASE + '/support-consent', json={'policyVersion': 'department-support-v1', 'revision': 1, 'enabled': True})) == chosen
    assert ok(learner.put(BASE + '/support-consent', json={'policyVersion': 'department-support-v1', 'revision': 2, 'enabled': True})) == chosen
    withdrawn = ok(learner.put(BASE + '/support-consent', json={'policyVersion': 'department-support-v1', 'revision': 2, 'enabled': False}))
    assert withdrawn['revision'] == 3 and not withdrawn['enabled']
    assert learner.put(BASE + '/support-consent', json={'policyVersion': 'department-support-v1', 'revision': 1, 'enabled': True}).status_code == 409
    assert owner.put(BASE + '/support-consent', json={'policyVersion': 'department-support-v1', 'revision': 1, 'enabled': True, 'userId': learner.headers['X-Nabu-Account']}).status_code == 422
    for body in ({'revision': '3', 'enabled': True}, {'revision': 3, 'enabled': 'true'}, {'revision': True, 'enabled': True}, {'revision': 0, 'enabled': True}):
        assert learner.put(BASE + '/support-consent', json={**body, 'policyVersion': 'department-support-v1'}).status_code == 422
    assert not ok(learner.get(BASE + '/support-consent'))['enabled']
    assert learner.put(BASE + '/support-consent', json={'policyVersion': 'old-terms', 'revision': 3, 'enabled': True}).status_code == 422
    assert learner.put(BASE + '/support-consent', json={'revision': 3, 'enabled': True}).status_code == 422


def test_withdrawal_changes_future_summary_not_individual_agreement(pilot):
    _, owner, reviewer, _, _, add, learners, assignments, _ = pilot
    add()
    assert summary(owner)['status'] == 'available'
    ok(learners[0].put(BASE + '/support-consent', json={'policyVersion': 'department-support-v1', 'revision': 2, 'enabled': False}))
    assert summary(owner)['status'] == 'insufficient'
    record = ok(reviewer.get(BASE + '/assignments/' + assignments[0]['id']))
    assert record['assignment']['status'] == 'accepted' and len(record['attempts']) == 1


@pytest.mark.parametrize('previously_enabled', [False, True])
def test_leave_rejoin_does_not_resurrect_choice_or_delayed_opt_in(pilot, previously_enabled):
    app, owner, _, _, _, add, learners, assignments, _ = pilot
    add(n=1, enabled=previously_enabled, response=None)
    learner = learners[0]; target = learner.headers['X-Nabu-Account']
    old_revision = ok(learner.get(BASE + '/support-consent'))['revision']
    ok(learner.request('DELETE', BASE + '/members/' + target, json={}))
    assert learner.get(BASE + '/support-consent').status_code == 403
    with sqlite3.connect(app.state.db_path) as c:
        assert c.execute('SELECT enabled,revision FROM institution_support_consent WHERE tenant_id=? AND user_id=?', (TENANT, target)).fetchone() == (0, old_revision + 1)
    ok(owner.post(BASE + '/members', json={'handle': 'pilot_learner_0'}))
    now = ok(learner.get(BASE + '/support-consent'))
    assert not now['enabled'] and now['revision'] == old_revision + 1
    assert learner.put(BASE + '/support-consent', json={'policyVersion': 'department-support-v1', 'revision': old_revision, 'enabled': True}).status_code == 409
    assert learner.get(BASE + '/assignments/' + assignments[0]['id']).status_code == 403


def test_offered_and_declined_assignments_do_not_enter_denominator(pilot):
    _, owner, _, _, _, add, learners, assignments, _ = pilot
    add(n=5, accepted=False, response=None)
    assert summary(owner)['status'] == 'insufficient'
    for learner, assignment in zip(learners, assignments):
        ok(learner.put(BASE + '/assignments/' + assignment['id'] + '/acceptance', json={'decision': 'declined'}))
    assert summary(owner)['status'] == 'insufficient'


def test_first_response_only_retries_do_not_improve_bucket_or_inflate_learners(pilot):
    _, owner, _, _, _, add, learners, assignments, _ = pilot
    add(response='Unlisted answer', visible=False)
    before = summary(owner)
    for learner, assignment in zip(learners, assignments):
        first = ok(learner.get(BASE + '/assignments/' + assignment['id']))['attempts'][0]['id']
        send(learner, assignment, retryOf=first)
    assert summary(owner) == before
    assert set(released(before)) == {'review_rubric'}


def test_missing_response_priority_and_distinct_learner_count(pilot):
    _, owner, reviewer, _, _, add, learners, assignments, tasks = pilot
    add(response=None)
    assert set(released(summary(owner))) == {'awaiting_response'}
    # Five more assignments for the same learners do not make ten participants.
    for learner, original in zip(learners, assignments[:]):
        second = {**original, 'id': uid(), 'taskId': tasks[False]['id']}
        ok(owner.post(BASE + '/assignments', json=second))
        ok(learner.put(BASE + '/assignments/' + second['id'] + '/acceptance', json={'decision': 'accepted'}))
        send(learner, second)
    report = summary(owner)
    assert report['participantBand']['label'] == '5–9'
    assert set(released(report)) == {'awaiting_response'}


def test_correction_priority_and_explicit_reassessment_reclassify_preserved_first_response(pilot):
    _, owner, reviewer, _, _, add, learners, assignments, tasks = pilot
    add(response='No rush', visible=False)
    assert set(released(summary(owner))) == {'review_rubric'}
    firsts = []
    for learner, assignment in zip(learners, assignments):
        first = ok(learner.get(BASE + '/assignments/' + assignment['id']))['attempts'][0]
        firsts.append(first)
        ok(learner.post(BASE + '/assignments/' + assignment['id'] + '/appeals', json={'id': uid(), 'assessmentId': first['assessments'][0]['id'], 'reason': 'This paraphrase should be accepted.'}))
    assert set(released(summary(owner))) == {'correction_pending'}
    ok(owner.post(BASE + '/tasks/' + tasks[False]['id'] + '/rubrics', json={'expectedVersion': 1, 'rubric': {'acceptedAnswers': ['Take your time', 'No rush'], 'normalization': 'nfc-casefold-space'}, 'reason': 'Include a valid paraphrase.'}))
    assert set(released(summary(owner))) == {'correction_pending'}
    for first in firsts:
        ok(reviewer.post(BASE + '/attempts/' + first['id'] + '/reassess', json={'id': uid(), 'expectedAssessmentId': first['assessments'][0]['id'], 'rubricVersion': 2, 'reason': 'Apply reviewed rubric correction.'}))
    assert set(released(summary(owner))) == {'task_matches'}
    record = ok(learners[0].get(BASE + '/assignments/' + assignments[0]['id']))
    assert record['attempts'][0]['observation']['response'] == 'No rush'
    assert [s['matched'] for s in record['attempts'][0]['assessments']] == [False, True]


def test_server_source_assistance_cannot_be_forged_for_summary(pilot):
    _, owner, _, _, _, add, learners, assignments, _ = pilot
    add(response=None)
    for learner, assignment in zip(learners, assignments):
        bad = {'id': uid(), 'assignmentId': assignment['id'], 'response': 'Take your time', 'occurredAt': int(time.time() * 1000), 'assistance': {'sourceAvailable': False}}
        assert learner.post(BASE + '/attempts', json=bad).status_code == 422
        send(learner, assignment)
    assert set(released(summary(owner))) == {'assisted_evidence'}


def test_clock_rollback_cannot_replace_latest_correction_with_older_assessment(pilot, monkeypatch):
    import institutions
    _, owner, reviewer, _, _, add, learners, assignments, tasks = pilot
    add(response='No rush', visible=False)
    firsts = [ok(l.get(BASE + '/assignments/' + a['id']))['attempts'][0] for l, a in zip(learners, assignments)]
    ok(owner.post(BASE + '/tasks/' + tasks[False]['id'] + '/rubrics', json={'expectedVersion': 1, 'rubric': {'acceptedAnswers': ['Take your time', 'No rush']}, 'reason': 'Add valid paraphrase.'}))
    earlier_time = int(time.time() * 1000) - 3600000
    monkeypatch.setattr(institutions, 'now', lambda: earlier_time)
    for first in firsts:
        result = ok(reviewer.post(BASE + '/attempts/' + first['id'] + '/reassess', json={'id': uid(), 'expectedAssessmentId': first['assessments'][0]['id'], 'rubricVersion': 2, 'reason': 'Correct after server clock adjustment.'}))
        assert [s['matched'] for s in result['attempts'][0]['assessments']] == [False, True]
    assert set(released(summary(owner))) == {'task_matches'}
    current = ok(learners[0].get(BASE + '/assignments/' + assignments[0]['id']))['attempts'][0]['assessments'][-1]
    # Another append must target the current chain head, not the latest wall-clock timestamp.
    again = ok(reviewer.post(BASE + '/attempts/' + firsts[0]['id'] + '/reassess', json={'id': uid(), 'expectedAssessmentId': current['id'], 'rubricVersion': 2, 'reason': 'Confirm the reviewed result.'}))
    assert len(again['attempts'][0]['assessments']) == 3
    # Receipt timestamps are also metadata, not event order: the linked retry
    # remains after its first response even if the server clock moves backward.
    monkeypatch.setattr(institutions, 'now', lambda: firsts[0]['receivedAt'] - 1000)
    retry = send(learners[0], assignments[0], retryOf=firsts[0]['id'])['record']
    assert retry['attempts'][0]['id'] == firsts[0]['id']
    assert retry['attempts'][1]['observation']['retryOf'] == firsts[0]['id']
    assert retry['attempts'][1]['receivedAt'] < retry['attempts'][0]['receivedAt']


def test_roles_tenant_auth_filters_and_origin_guards(pilot):
    _, owner, reviewer, outsider, anon, add, learners, _, _ = pilot
    add(n=1)
    for client in (reviewer, outsider, learners[0]):
        assert client.get(BASE + '/department-support').status_code == 403
    assert anon.get(BASE + '/department-support').status_code == 401
    assert outsider.get(BASE + '/support-consent').status_code == 403
    assert owner.get('/api/workspaces/another_tenant/department-support').status_code == 403
    for suffix in ('?learner=anything', '?minimum=1', '?from=0', '?task=anything'):
        assert owner.get(BASE + '/department-support' + suffix).status_code == 422
    assert learners[0].put(BASE + '/support-consent', json={'policyVersion': 'department-support-v1', 'revision': 2, 'enabled': False}, headers={'Origin': 'https://wrong.invalid'}).status_code == 403
    csrf = learners[0].headers.pop('X-CSRF-Token')
    assert learners[0].put(BASE + '/support-consent', json={'policyVersion': 'department-support-v1', 'revision': 2, 'enabled': False}).status_code == 403
    learners[0].headers['X-CSRF-Token'] = csrf


def test_consent_survives_restart_and_cascades_on_account_deletion(pilot):
    app, owner, _, _, _, add, learners, _, _ = pilot
    add(n=1)
    second = create_app(app.state.db_path, 'http://testserver', invite='', translation_key='')
    with TestClient(second, headers={'Origin': 'http://testserver'}) as c:
        auth = ok(c.post('/api/login', json={'handle': 'pilot_learner_0', 'password': PASSWORD}))
        c.headers['X-CSRF-Token'] = auth['csrf']
        assert ok(c.get(BASE + '/support-consent'))['enabled'] is True
    target = learners[0].headers['X-Nabu-Account']
    with sqlite3.connect(app.state.db_path) as c:
        c.execute('PRAGMA foreign_keys=ON')
        c.execute('DELETE FROM users WHERE id=?', (target,))
        assert c.execute('SELECT * FROM institution_support_consent WHERE user_id=?', (target,)).fetchall() == []
