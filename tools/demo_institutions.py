"""Exercise Nabu 1.17 through its real local launcher and HTTP API.

Creates only temporary fictional accounts and a temporary database, disables
providers and backups, then removes the database. Does not touch your Nabu data.
Run with the launcher's Python: .venv/bin/python tools/demo_institutions.py
"""
from pathlib import Path
import argparse
import json
import os
import socket
import subprocess
import sys
import tempfile
import time
import uuid

import httpx

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / 'verification/1.17/institution-http.json')
    args = parser.parse_args()
    checks = []

    def check(label, condition):
        if not condition:
            raise AssertionError(label)
        checks.append(label)
        print('PASS', label, flush=True)

    def valid(res):
        if res.status_code not in (200, 201):
            raise AssertionError(f'HTTP {res.status_code}: {res.text[:200]}')
        return res.json()

    def ident():
        return str(uuid.uuid4())

    with tempfile.TemporaryDirectory(prefix='nabu-117-demo-') as tmp:
        with socket.socket() as sock:
            sock.bind(('127.0.0.1', 0))
            port = sock.getsockname()[1]
        origin = f'http://127.0.0.1:{port}'
        environment = {k: v for k, v in os.environ.items() if not k.startswith(('NABU_', 'DEEPL_', 'ELEVENLABS_', 'AWS_'))}
        environment.update(NABU_DB=str(Path(tmp) / 'demo.sqlite3'), NABU_BACKUP_ENABLED='false', DEEPL_API_KEY='', ELEVENLABS_API_KEY='', NABU_INVITE_CODE='')
        clients = []
        with (Path(tmp) / 'server.log').open('w') as log:
            process = subprocess.Popen([sys.executable, str(ROOT / 'start_local.py'), '--ready', '--no-browser', '--port', str(port)], cwd=ROOT, env=environment, stdout=log, stderr=subprocess.STDOUT)
            try:
                for _ in range(100):
                    try:
                        if httpx.get(origin + '/api/health', timeout=.4, trust_env=False).status_code == 200:
                            break
                    except httpx.HTTPError:
                        pass
                    if process.poll() is not None:
                        raise RuntimeError('The local launcher stopped before readiness.')
                    time.sleep(.1)
                else:
                    raise RuntimeError('Local launcher did not become ready.')

                def account(handle):
                    c = httpx.Client(base_url=origin, headers={'Origin': origin}, trust_env=False)
                    auth = valid(c.post('/api/register', json={'handle': handle, 'password': ident() + '!'}))
                    c.headers.update({'X-CSRF-Token': auth['csrf'], 'X-Nabu-Account': auth['user']['id']})
                    clients.append(c)
                    return c, auth['user']['id']

                teacher, tid = account('department_demo')
                employer, eid = account('company_demo')
                learner, lid = account('learner_demo')
                check('Actual local launcher reports Nabu 1.17.0', valid(learner.get('/api/health'))['version'] == '1.17.0')
                personal = {'front': 'water', 'back': 'agua', 'sourceLang': 'en', 'targetLang': 'es', 'note': 'Private poetry note'}
                # Use the ordinary library API; no institution owns this card.
                at = int(time.time()*1000)
                personal.update(id=ident(), context='', deck='Private words', tags=[], attribution='', conceptId='', createdAt=at, updatedAt=at, revision=0, archived=False, schedule={'algorithm':'nabu-srs-v1','state':'new','step':0,'due':at,'interval':0,'ease':2.5,'reps':0,'lapses':0,'lastReview':None})
                valid(learner.post('/api/library/cards', json={'cards': [personal]}))
                assignments = []
                for tenant, admin, reviewer, language, source_text, accepted in [
                    ('department', teacher, tid, 'ar', 'خذي وقتك.', 'Take your time'),
                    ('company', employer, eid, 'fr', 'Prenez votre temps.', 'Take your time'),
                ]:
                    valid(admin.post('/api/decision-tenants', json={'id': tenant, 'label': tenant.title()}))
                    base = '/api/workspaces/' + tenant
                    valid(admin.post(base + '/members', json={'handle': 'learner_demo'}))
                    valid(admin.put(base + '/policy', json={'revision': 1, 'offlineResponses': True}))
                    source_id, task_id, assignment_id = ident(), ident(), ident()
                    source = {'id': source_id, 'version': 1, 'title': 'Demo source', 'text': source_text, 'language': language, 'attribution': 'Fictional release fixture', 'rights': 'Original short fixture'}
                    valid(admin.post(base + '/sources', json=source))
                    valid(admin.post(base + '/tasks', json={'id': task_id, 'title': 'Interpret the request', 'sourceId': source_id, 'sourceVersion': 1, 'prompt': 'Give a short English meaning.', 'mode': 'recall', 'sourceVisible': True, 'rubric': {'acceptedAnswers': [accepted], 'normalization': 'nfc-casefold-space'}}))
                    valid(admin.post(base + '/assignments', json={'id': assignment_id, 'learnerId': lid, 'taskId': task_id, 'rubricVersion': 1, 'reviewerIds': [reviewer], 'sharing': 'responses', 'objective': 'Understand this particular request.'}))
                    url = base + '/assignments/' + assignment_id
                    check(tenant + ': reviewer cannot inspect before acceptance', admin.get(url).status_code == 403)
                    valid(learner.put(url + '/acceptance', json={'decision': 'accepted'}))
                    body = {'id': ident(), 'assignmentId': assignment_id, 'response': 'No rush', 'occurredAt': int(time.time()*1000), 'assistance': {}, 'offline': True}
                    received = valid(learner.post(base + '/attempts', json=body))
                    duplicate = valid(learner.post(base + '/attempts', json=body))
                    check(tenant + ': duplicate offline delivery creates one result', duplicate['duplicate'] and len(duplicate['record']['attempts']) == 1)
                    check(tenant + ': visible source is recorded as assistance', received['record']['attempts'][0]['assessments'][0]['assistance']['sourceAvailable'])
                    check(tenant + ': no mastery claim is manufactured', received['record']['attempts'][0]['assessments'][0]['mastery'] is None)
                    assignments.append((base, url, body, task_id, source, received['record']['attempts'][0]['assessments'][0]))
                check('One learner has two organization memberships', len(valid(learner.get('/api/workspaces'))['workspaces']) == 2)
                check('Department cannot access company assignments', teacher.get(assignments[1][1]).status_code == 403)
                check('Company cannot access department assignments', employer.get(assignments[0][1]).status_code == 403)
                check('Private vocabulary stays out of institutional libraries', all('Private poetry note' not in c.get('/api/library').text for c in (teacher, employer)))
                base, url, body, task_id, source, initial = assignments[0]
                valid(learner.post(url + '/appeals', json={'id': ident(), 'assessmentId': initial['id'], 'reason': 'No rush is another acceptable paraphrase.'}))
                valid(teacher.post(base + '/tasks/' + task_id + '/rubrics', json={'expectedVersion': 1, 'rubric': {'acceptedAnswers': ['Take your time', 'No rush'], 'normalization': 'nfc-casefold-space'}, 'reason': 'Include the valid paraphrase.'}))
                check('Publishing a correction does not silently overwrite a result', not valid(learner.get(url))['attempts'][0]['assessments'][0]['matched'])
                revised = valid(teacher.post(base + '/attempts/' + body['id'] + '/reassess', json={'id': ident(), 'expectedAssessmentId': initial['id'], 'rubricVersion': 2, 'reason': 'Apply reviewed correction to the preserved response.'}))
                check('Explicit reassessment retains the original and corrected results', [x['matched'] for x in revised['attempts'][0]['assessments']] == [False, True])
                replay = valid(teacher.post(url + '/replay', json={}))
                check('Authorized reviewer reconstructs both results exactly', replay['allMatch'] and replay['assessmentCount'] == 2)
                valid(teacher.post(base + '/sources', json={**source, 'version': 2, 'text': 'Updated source for future tasks.'}))
                check('Historical assignment remains pinned to original source', valid(learner.get(url))['source']['text'] == source['text'])
                check('Missing council provider reports unavailable', learner.post('/api/council', json={}).status_code == 503)
                check('Normal reader and saved vocabulary remain available', learner.get('/read').status_code == 200 and 'Private poetry note' in learner.get('/api/library').text)
                valid(learner.request('DELETE', base + '/members/' + lid, json={}))
                check('Leaving a workspace rejects even identical old submissions', learner.post(base + '/attempts', json=body).status_code == 403)
                check('Leaving does not remove personal vocabulary or the other workspace', len(valid(learner.get('/api/workspaces'))['workspaces']) == 1 and 'Private poetry note' in learner.get('/api/library').text and learner.get(assignments[1][1]).status_code == 200)
                valid(teacher.post(base + '/members', json={'handle': 'learner_demo'}))
                check('Rejoining does not resurrect old reporting grants', learner.get(url).status_code == 403)
                check('Audit omits raw learner responses', 'No rush' not in teacher.get(base + '/audit').text)
            finally:
                for c in clients:
                    c.close()
                process.terminate()
                try:
                    process.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    process.kill(); process.wait()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps({'release': '1.17.0', 'passed': len(checks), 'checks': checks, 'scope': 'Real loopback HTTP through the local launcher; fictional accounts; temporary SQLite; no external provider calls; no browser layout claim.'}, indent=2) + '\n')
    print(f'{len(checks)} checks passed. Report: {args.output}')


if __name__ == '__main__':
    main()
