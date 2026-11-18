"""Exercise the actual local launcher, HTTP server and SQLite, without a browser.
Uses temporary accounts and a temporary database, never provider keys or live data.
Run: python tests/local_http_smoke.py
"""
from pathlib import Path
import json
import os
import socket
import sqlite3
import subprocess
import sys
import tempfile
import time
import uuid

import httpx

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from tools.backup_database import backup
from backup_service import restore

OUT = ROOT / 'verification/local'
OUT.mkdir(parents=True, exist_ok=True)
checks = []


def check(label, ok=True):
    assert ok, label
    checks.append(label)
    print('PASS', label, flush=True)


def valid(response, expected=200):
    assert response.status_code == expected, (response.status_code, response.text[:200])
    return response.json()


def main():
    with tempfile.TemporaryDirectory(prefix='nabu-http-check-') as directory:
        db = Path(directory) / 'local.sqlite3'
        with socket.socket() as s:
            s.bind(('127.0.0.1', 0))
            port = s.getsockname()[1]
        origin = f'http://127.0.0.1:{port}'
        env = {**os.environ, 'NABU_DB':str(db), 'NABU_BACKUP_ENABLED':'false', 'DEEPL_API_KEY':'', 'ELEVENLABS_API_KEY':'', 'NABU_INVITE_CODE':''}
        log = (OUT / 'http-server.log').open('w')
        proc = None
        def start():
            nonlocal proc
            proc = subprocess.Popen([sys.executable, str(ROOT/'start_local.py'), '--ready', '--no-browser', '--port', str(port)], cwd=ROOT, env=env, stdout=log, stderr=subprocess.STDOUT)
            for _ in range(100):
                try:
                    if httpx.get(origin+'/api/health', timeout=1, trust_env=False).status_code == 200:
                        return
                except httpx.HTTPError:
                    pass
                if proc.poll() is not None:
                    raise RuntimeError('Local server stopped during startup.')
                time.sleep(.1)
            raise TimeoutError('Local server did not become ready.')
        def stop():
            if proc and proc.poll() is None:
                proc.terminate()
                try:proc.wait(timeout=10)
                except subprocess.TimeoutExpired:proc.kill();proc.wait()
        try:
            start()
            a = httpx.Client(base_url=origin, headers={'Origin':origin}, trust_env=False)
            b = httpx.Client(base_url=origin, headers={'Origin':origin}, trust_env=False)
            password = 'Ephemeral HTTP test password 123!'
            check('Local launcher starts the full API and reports release 1.18.0', valid(a.get('/api/health'))['version']=='1.18.0')
            html = a.get('/')
            check('Actual HTTP serves the rebuilt standalone app and CSP', html.status_code==200 and 'nabu-pages-1.18.0-capture-r1' in html.text and 'Content-Security-Policy' in html.headers)
            check('Private source/config/database paths are not served', all(a.get(p).status_code==404 for p in ['/.env.local','/server.py','/.data/nabu.sqlite3','/translation_memory.py']))
            aa=valid(a.post('/api/register',json={'handle':'alphatest','password':password}),201)
            a.headers['X-CSRF-Token']=aa['csrf'];a.headers['X-Nabu-Account']=aa['user']['id']
            bb=valid(b.post('/api/register',json={'handle':'betatest','password':password}),201)
            b.headers['X-CSRF-Token']=bb['csrf'];b.headers['X-Nabu-Account']=bb['user']['id']
            check('Two isolated accounts can register with real HTTP cookies', bool(a.cookies) and bool(b.cookies) and aa['user']['id']!=bb['user']['id'])
            now=int(time.time()*1000)
            card={'id':str(uuid.uuid4()),'front':'water','back':'agua','sourceLang':'en','targetLang':'es','context':'A glass of water','note':'private-test-note','deck':'Travel','tags':['travel'],'conceptId':'food.water','createdAt':now,'updatedAt':now,'revision':0,'archived':False,'learningMode':'learning','schedule':{'algorithm':'nabu-srs-v1','state':'new','step':0,'due':now,'interval':0,'ease':2.5,'reps':0,'lapses':0,'lastReview':None}}
            saved=valid(a.post('/api/library/translations',json={'card':card,'provider':'Word graph'}))['card']
            check('Account libraries do not leak across real HTTP sessions', not valid(b.get('/api/library'))['cards'])
            fid=valid(a.post('/api/friends',json={'handle':'betatest'}),201)['id']
            valid(b.patch('/api/friends/'+fid,json={'status':'accepted'}))
            check('Friend request and acceptance persist', len(valid(a.get('/api/friends'))['friends'])==1)
            public={k:card[k] for k in ['front','back','sourceLang','targetLang','context']}
            item=valid(a.post('/api/exchanges',json={'recipient':'betatest','card':public,'message':'A test word','requestId':str(uuid.uuid4())}),201)
            inbox=valid(b.get('/api/exchanges'))
            check('Word exchange reaches the recipient without private notes', len(inbox['inbox'])==1 and 'private-test-note' not in json.dumps(inbox))
            shared=valid(a.post('/api/shared-libraries',json={'title':'Test collection','description':'Local test','cardIds':[saved['id']],'recipients':['betatest']}),201)
            view=valid(b.get('/api/shared-libraries/'+shared['id']))
            check('Permissioned library preview excludes private learner notes', len(view['cards'])==1 and 'private-test-note' not in json.dumps(view))
            valid(a.post('/api/library/cards/'+saved['id']+'/review',json={'revision':0,'rating':4,'durationMs':850,'practiceMode':'production'}))
            check('Review logs retain practice mode', valid(a.get('/api/library'))['logs'][0]['practiceMode']=='production')
            stop();start()
            check('Server restart keeps accounts, cards and review history', len(valid(a.get('/api/library'))['cards'])==1 and len(valid(a.get('/api/library'))['logs'])==1)
            snap=backup(db,Path(directory)/'snapshot.sqlite3')
            recovered=restore(snap,Path(directory)/'restore.sqlite3')
            with sqlite3.connect(recovered) as conn:
                check('Local backup restores into a different database and revokes sessions', conn.execute('SELECT COUNT(*) FROM users').fetchone()[0]==2 and conn.execute('SELECT COUNT(*) FROM sessions').fetchone()[0]==0 and conn.execute('PRAGMA integrity_check').fetchone()[0]=='ok')
            anon=httpx.Client(base_url=origin,headers={'Origin':origin},trust_env=False)
            result=valid(anon.post('/api/recover',json={'handle':'alphatest','code':aa['recoveryCode'],'password':'Changed HTTP test password 123!'}))
            check('Recovery rotates the code and invalidates old HTTP sessions', result['recoveryCode']!=aa['recoveryCode'] and valid(a.get('/api/session'))['user'] is None)
            login=valid(anon.post('/api/login',json={'handle':'alphatest','password':'Changed HTTP test password 123!'}))
            check('Recovered account keeps the original library', len(valid(anon.get('/api/library'))['cards'])==1)
            check('Missing cloud key fails visibly instead of spending or faking a result', b.post('/api/translate',json={'text':'outside bank','sourceLang':'en','targetLang':'fr'}).status_code==503)
            a.close();b.close();anon.close()
        finally:
            stop();log.close()
    (OUT/'http-smoke.json').write_text(json.dumps({'passed':len(checks),'checks':checks,'scope':'Actual loopback HTTP + SQLite + local launcher; no browser, no provider calls.'},indent=2))


if __name__=='__main__':
    main()
