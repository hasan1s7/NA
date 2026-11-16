"""Real loopback HTTP and server-restart persistence. No browser/DB/API fixtures.
Uses --ready with already-installed requirements to avoid downloading dependencies.
This is not a native browser, audio, extension or provider test.
"""
from pathlib import Path
import os,sys,tempfile,subprocess,socket,time,json,uuid
import httpx
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'tests'))
from test_social import card,PASSWORD
OUT=ROOT/'verification/redesign';OUT.mkdir(parents=True,exist_ok=True)
checks=[]
def check(name,ok=True):
 assert ok,name
 checks.append(name);print('PASS',name,flush=True)
def main():
 with tempfile.TemporaryDirectory() as tmp:
  with socket.socket() as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
  base=f'http://127.0.0.1:{port}';env={k:v for k,v in os.environ.items() if not k.startswith(('NABU_','DEEPL_','ELEVENLABS_','AWS_'))};env.update(NABU_DB=str(Path(tmp)/'test.sqlite3'))
  def start():
   log=open(OUT/'http-server.txt','a');p=subprocess.Popen([sys.executable,'start_local.py','--ready','--no-browser','--port',str(port)],cwd=ROOT,env=env,stdout=log,stderr=subprocess.STDOUT)
   for _ in range(100):
    try:
     if httpx.get(base+'/api/health',trust_env=False,timeout=1).status_code==200:return p,log
    except httpx.HTTPError:pass
    if p.poll() is not None:raise RuntimeError('Server exited; see http-server.txt')
    time.sleep(.1)
   p.terminate();raise RuntimeError('Server startup timed out')
  p,log=start()
  try:
   with httpx.Client(base_url=base,headers={'Origin':base},trust_env=False,timeout=10) as c:
    r=c.get('/api/health');check('Fresh real process serves health and correct version',r.status_code==200 and r.json()['version']=='1.13.0')
    for route in ['/','/read','/words','/library','/review','/friends','/settings']:
     r=c.get(route);check('Existing route serves rebuilt application: '+route,r.status_code==200 and 'nabu-syntax-20261111-r1' in r.text)
    r=c.get('/nabu-sw.js');check('Service worker and app build IDs agree',r.status_code==200 and 'nabu-syntax-20261111-r1' in r.text)
    r=c.post('/api/register',json={'handle':'restart_reader','password':PASSWORD});check('Existing account registration works',r.status_code==201)
    login=r.json();c.headers.update({'X-CSRF-Token':login['csrf'],'X-Nabu-Account':login['user']['id']})
    value=card(context='The water is on the table.',note='Test note to preserve.',reading='water',readingMethod='Manual',imageId='water',imageDismissed=['bank'],learningMode='reference')
    r=c.post('/api/library/translations',json={'card':value,'provider':'Word graph'});check('Real API persists a word with context, note, reading and chosen image',r.status_code==200 and r.json()['card']['context']==value['context'])
    r=c.post('/api/library/translations',json={'card':value,'provider':'Word graph'});check('Duplicate request does not duplicate the saved word',r.status_code==200 and len(c.get('/api/library').json()['cards'])==1)
   p.terminate();p.wait(timeout=10);log.close();p,log=start()
   with httpx.Client(base_url=base,headers={'Origin':base},trust_env=False,timeout=10) as c:
    r=c.post('/api/login',json={'handle':'restart_reader','password':PASSWORD});check('Sign-in works after process restart',r.status_code==200)
    result=c.get('/api/library');actual=result.json()['cards'][0]
    check('Context, private note, reading, image and schedule survive server restart',all(actual[k]==value[k] for k in ['id','context','note','reading','readingMethod','imageId','imageDismissed','learningMode','schedule']))
    c.post('/api/logout',headers={'X-CSRF-Token':r.json()['csrf'],'X-Nabu-Account':r.json()['user']['id']},json={})
    check('Existing account privacy remains enforced after signout',c.get('/api/library').status_code==401)
  finally:
   if p.poll() is None:p.terminate();p.wait(timeout=10)
   log.close()
if __name__=='__main__':
 failure=None
 try:main()
 except Exception as e:failure=str(e);print('FAIL',failure)
 (OUT/'http-results.json').write_text(json.dumps({'passed':len(checks),'checks':checks,'failure':failure,'boundary':__doc__},indent=2))
 if failure:sys.exit(1)
