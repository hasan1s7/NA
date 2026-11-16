"""Real release process / loopback HTTP / SQLite persistence, without browser or API fixtures.
A disposable account/database is created; optional providers are not called. --ready
uses preinstalled Python dependencies. This does not prove native Chrome durability.
"""
from pathlib import Path
import os,sys,tempfile,subprocess,socket,time,json,uuid,sqlite3
import httpx
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'tests'))
from test_social import card,PASSWORD
OUT=ROOT/'verification/mvp112/final';OUT.mkdir(parents=True,exist_ok=True)
checks=[]
def check(name,ok=True):
    assert ok,name
    checks.append(name);print('PASS',name,flush=True)
def event(kind,**kw):
    return dict(id=str(uuid.uuid4()),contentId='a-little-later',version=1,kind=kind,at=int(time.time()*1000),**kw)
def main():
    with tempfile.TemporaryDirectory() as tmp:
        with socket.socket() as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
        base=f'http://127.0.0.1:{port}';db=Path(tmp)/'acceptance.sqlite3'
        env={k:v for k,v in os.environ.items() if not k.startswith(('NABU_','DEEPL_','ELEVENLABS_','AWS_'))};env['NABU_DB']=str(db)
        def start():
            log=open(OUT/'explore-http-server.txt','a')
            p=subprocess.Popen([sys.executable,'start_local.py','--ready','--no-browser','--port',str(port)],cwd=ROOT,env=env,stdout=log,stderr=subprocess.STDOUT)
            for _ in range(150):
                try:
                    if httpx.get(base+'/api/health',trust_env=False,timeout=1).status_code==200:return p,log
                except httpx.HTTPError:pass
                if p.poll() is not None:raise RuntimeError('Launcher exited; see explore-http-server.txt')
                time.sleep(.1)
            p.terminate();raise RuntimeError('Startup timed out')
        p,log=start()
        try:
            with httpx.Client(base_url=base,headers={'Origin':base},trust_env=False,timeout=10) as c:
                check('Documented launcher starts packaged version 1.13.0',c.get('/api/health').json()['version']=='1.13.0')
                for route in ['/explore','/read?content=a-little-later&version=1','/words','/library','/review','/settings']:
                    r=c.get(route);check('Shipping route '+route,r.status_code==200 and 'nabu-syntax-20261111-r1' in r.text)
                cfg=c.get('/api/config').json();check('Text and progress path needs no provider setup',cfg.get('contentProgress') is True)
                check('Private progress rejects anonymous reads',c.get('/api/content-progress').status_code==401)
                r=c.post('/api/register',json={'handle':'http_reader','password':PASSWORD});check('Existing signup preserved',r.status_code==201)
                login=r.json();owner=login['user']['id'];c.headers.update({'X-CSRF-Token':login['csrf'],'X-Nabu-Account':owner})
                word=card(front='Take your time',back='No need to hurry',sourceLang='en',targetLang='fr',context='The source in this HTTP-only QA fixture.',note='Private original note',reading='a checked reading',readingMethod='Manual',imageId='book',imageDismissed=['bank'],learningMode='reference',provenance='Nabu Explore / a-little-later@1 / s6/a3')
                r=c.post('/api/library/translations',json={'card':word,'provider':'Manual'});check('Existing card API saves source, note, reading, image and schedule',r.status_code==200)
                stored=r.json()['card']
                rows=[event('opened'),event('position',segmentId='s6',fraction=.42),event('finished',value=True),event('preference',value=True),event('saved',annotationId='a3',cardId=stored['id']),event('help',activityId='p2',sessionId=str(uuid.uuid4()),help='answer'),event('attempt',activityId='p2',sessionId=str(uuid.uuid4()),answer='QA answer',assisted=True,skipped=False)]
                r=c.post('/api/content-progress',json={'events':rows});check('All seven progress event kinds persist in account database',r.status_code==200)
                r=c.post('/api/content-progress',json={'events':rows});check('Lost-acknowledgment retry keeps exactly one event per ID',r.status_code==200 and len(c.get('/api/content-progress').json()['events'])==len(rows))
                r=c.post('/api/content-progress',json={'events':[dict(rows[1],fraction=.9)]});check('Changed payload with reused ID is refused',r.status_code==409)
                c.headers['X-Nabu-Account']=str(uuid.uuid4());check('A stale different-account tab cannot write',c.post('/api/content-progress',json={'events':[event('opened')]}).status_code==409);c.headers['X-Nabu-Account']=owner
                c.headers.pop('X-CSRF-Token');check('Existing CSRF protection applies to progress',c.post('/api/content-progress',json={'events':[event('opened')]}).status_code==403);c.headers['X-CSRF-Token']=login['csrf']
                check('Practice created no hidden cards or schedule changes',c.get('/api/library').json()['cards']==[stored])
            p.terminate();p.wait(timeout=10);log.close();p,log=start()
            with httpx.Client(base_url=base,headers={'Origin':base},trust_env=False,timeout=10) as c:
                r=c.post('/api/login',json={'handle':'http_reader','password':PASSWORD});check('Existing login survives process restart',r.status_code==200)
                login=r.json();c.headers.update({'X-CSRF-Token':login['csrf'],'X-Nabu-Account':login['user']['id']})
                actual=c.get('/api/content-progress').json()['events'];check('Exact source version, position, preference and practice survive restart',sorted(actual,key=lambda e:e['id'])==sorted(rows,key=lambda e:e['id']))
                after=c.get('/api/library').json()['cards'];check('Original saved word metadata and schedule survive restart',after==[stored])
                c.post('/api/logout',json={});check('Signing out removes access to private progress',c.get('/api/content-progress').status_code==401)
                c.headers.pop('X-Nabu-Account',None);c.headers.pop('X-CSRF-Token',None)
                r=c.post('/api/register',json={'handle':'second_reader','password':PASSWORD});check('Second account cannot see first account progress',r.status_code==201 and c.get('/api/content-progress').json()['events']==[])
            backup=Path(tmp)/'backup.sqlite3'
            r=subprocess.run([sys.executable,'tools/backup_database.py','--db',str(db),'--out',str(backup)],cwd=ROOT,capture_output=True,text=True)
            with sqlite3.connect(backup) as conn:count=conn.execute('SELECT COUNT(*) FROM content_events WHERE user_id=?',(owner,)).fetchone()[0]
            check('Existing SQLite backup includes private content progress',r.returncode==0 and count==len(rows))
        finally:
            if p.poll() is None:p.terminate();p.wait(timeout=10)
            log.close()
if __name__=='__main__':
    failure=None
    try:main()
    except Exception as e:failure=str(e);print('FAIL',failure,flush=True)
    (OUT/'explore-http.json').write_text(json.dumps({'passed':len(checks),'checks':checks,'failure':failure,'boundary':__doc__},indent=2))
    if failure:sys.exit(1)
