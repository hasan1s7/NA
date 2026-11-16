"""Real HTTP demonstration of optional departmental support reporting.

Temporary fictional accounts/database only. Distinct loopback client addresses
represent distinct fictional devices while retaining normal registration limits.
No providers, existing user data, external delivery, or browser-layout claim.
"""
from pathlib import Path
import argparse,json,os,socket,subprocess,sys,tempfile,time,uuid
import httpx
ROOT=Path(__file__).resolve().parents[1]

def main():
 parser=argparse.ArgumentParser(description=__doc__)
 parser.add_argument('--output',type=Path,default=ROOT/'verification/overnight/department-http.json')
 args=parser.parse_args();checks=[];trace=[];snapshots={};clients=[]
 def check(name,condition):
  assert condition,name
  checks.append(name);print('PASS',name,flush=True)
 def call(client,method,path,body=None,expected=200):
  if method=='PUT' and path.endswith('/support-consent'):
   body={**body,'policyVersion':'department-support-v1'}
  r=client.request(method,path,**({'json':body} if body is not None else {}))
  assert r.status_code==expected,(method,path,r.status_code,r.text[:300])
  try:data=r.json()
  except ValueError:data={'contentType':r.headers.get('content-type'),'bytes':len(r.content)}
  if path!='/api/register':trace.append({'method':method,'path':path,'status':r.status_code,'response':data})
  return data
 def uid():return str(uuid.uuid4())
 with tempfile.TemporaryDirectory(prefix='nabu-department-demo-') as temp:
  with socket.socket() as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
  origin=f'http://127.0.0.1:{port}'
  env={k:v for k,v in os.environ.items() if not k.startswith(('NABU_','DEEPL_','ELEVENLABS_','AWS_'))}
  env.update(NABU_DB=str(Path(temp)/'fictional.sqlite3'),NABU_BACKUP_ENABLED='false',DEEPL_API_KEY='',ELEVENLABS_API_KEY='',NABU_INVITE_CODE='')
  with (Path(temp)/'server.log').open('w') as log:
   p=subprocess.Popen([sys.executable,str(ROOT/'start_local.py'),'--ready','--no-browser','--port',str(port)],cwd=ROOT,env=env,stdout=log,stderr=subprocess.STDOUT)
   try:
    for _ in range(100):
     try:
      if httpx.get(origin+'/api/health',trust_env=False,timeout=.4).status_code==200:break
     except httpx.HTTPError:pass
     if p.poll() is not None:raise RuntimeError('Local launcher failed.')
     time.sleep(.1)
    else:raise RuntimeError('Readiness timeout')
    def account(name):
     address='127.0.0.'+str(len(clients)+2)
     c=httpx.Client(base_url=origin,headers={'Origin':origin},transport=httpx.HTTPTransport(local_address=address),trust_env=False)
     a=call(c,'POST','/api/register',{'handle':name,'password':uid()+'!'},201)
     c.headers.update({'X-CSRF-Token':a['csrf'],'X-Nabu-Account':a['user']['id']});clients.append(c)
     return c,a['user']['id']
    owner,oid=account('demo_coordinator');reviewer,rid=account('demo_instructor')
    learners=[account('demo_learner_'+str(i)) for i in range(1,6)]
    call(owner,'POST','/api/decision-tenants',{'id':'arabic_pilot','label':'Fictional Arabic pilot'})
    base='/api/workspaces/arabic_pilot'
    for c,lid in [(reviewer,rid)]+learners:call(owner,'POST',base+'/members',{'handle':'demo_instructor' if lid==rid else 'demo_learner_'+str(1+[x[1] for x in learners].index(lid))})
    source,task=uid(),uid()
    call(owner,'POST',base+'/sources',{'id':source,'version':1,'title':'A fictional request','text':'خذي وقتك.','language':'ar','attribution':'Original fictional demo fixture','rights':'Original short fixture'})
    call(owner,'POST',base+'/tasks',{'id':task,'title':'Interpret the request','sourceId':source,'sourceVersion':1,'prompt':'Give a short English meaning.','mode':'recall','sourceVisible':True,'rubric':{'acceptedAnswers':['Take your time'],'normalization':'nfc-casefold-space'}})
    assignments=[];firsts=[]
    for c,lid in learners:
     a=uid();assignments.append(a)
     call(owner,'POST',base+'/assignments',{'id':a,'learnerId':lid,'taskId':task,'rubricVersion':1,'reviewerIds':[rid],'sharing':'responses','objective':'Understand this particular request.'})
     call(c,'PUT',base+'/assignments/'+a+'/acceptance',{'decision':'accepted'})
     body={'id':uid(),'assignmentId':a,'response':'No rush','occurredAt':int(time.time()*1000),'assistance':{}}
     result=call(c,'POST',base+'/attempts',body);firsts.append(result['record']['attempts'][0])
    initial=call(owner,'GET',base+'/department-support');snapshots['default_off']=initial
    check('Acceptance does not opt learners into departmental reporting',initial['status']=='insufficient' and initial['participantBand'] is None)
    choice=call(learners[0][0],'GET',base+'/support-consent')
    check('Reporting choice defaults off',choice['enabled'] is False and choice['revision']==1)
    call(owner,'GET',base+'/assignments/'+assignments[0],expected=403)
    check('Owner still cannot open an ungranted individual record',True)
    call(reviewer,'GET',base+'/department-support',expected=403)
    check('Named reviewer alone cannot open owner summary',True)
    for c,lid in learners[:4]:call(c,'PUT',base+'/support-consent',{'revision':1,'enabled':True})
    four=call(owner,'GET',base+'/department-support');snapshots['four_opted_in']=four
    check('Four opted-in learners release no cohort count',four['status']=='insufficient' and four['participantBand'] is None and all(x['band'] is None for x in four['categories']))
    call(learners[4][0],'PUT',base+'/support-consent',{'revision':1,'enabled':True})
    five=call(owner,'GET',base+'/department-support');snapshots['five_nonmatches']=five
    def category(report,key):return next(x for x in report['categories'] if x['key']==key)
    check('Five opt-ins release a coarse cohort band',five['participantBand']=={'lower':5,'upper':9,'label':'5–9'})
    check('Rubric-review support is explained without mastery',category(five,'review_rubric')['band']['lower']==5 and five['recommendations'][0]['action']=='review_rubrics' and five['learnerModelUpdated'] is False)
    serialized=json.dumps(five)
    check('Summary omits learner identifiers and raw answers',all(lid not in serialized for _,lid in learners) and 'No rush' not in serialized and all(a not in serialized for a in assignments))
    call(owner,'GET',base+'/department-support?learnerId='+learners[0][1],expected=422)
    check('Unsupported filtering cannot create a drilldown',True)
    c=learners[0][0]
    call(c,'POST',base+'/attempts',{'id':uid(),'assignmentId':assignments[0],'response':'Take your time','occurredAt':int(time.time()*1000),'retryOf':firsts[0]['id'],'assistance':{}})
    after_retry=call(owner,'GET',base+'/department-support')
    check('A successful retry does not replace first-response evidence',after_retry['categories']==five['categories'])
    call(owner,'POST',base+'/tasks/'+task+'/rubrics',{'expectedVersion':1,'rubric':{'acceptedAnswers':['Take your time','No rush'],'normalization':'nfc-casefold-space'},'reason':'Include the appropriate paraphrase for this fictional request.'})
    unchanged=call(owner,'GET',base+'/department-support')
    check('Publishing a rubric does not silently revise support evidence',unchanged['categories']==five['categories'])
    for first in firsts:
     call(reviewer,'POST',base+'/attempts/'+first['id']+'/reassess',{'id':uid(),'expectedAssessmentId':first['assessments'][-1]['id'],'rubricVersion':2,'reason':'Apply the reviewed rubric to the original response.'})
    corrected=call(owner,'GET',base+'/department-support');snapshots['corrected_assisted_matches']=corrected
    check('Explicit reassessments change the group support explanation',category(corrected,'assisted_evidence')['band']['lower']==5 and corrected['recommendations'][0]['action']=='offer_optional_unassisted_check')
    replay=call(reviewer,'POST',base+'/assignments/'+assignments[1]+'/replay',{})
    check('Original and corrected assessments both replay',replay['allMatch'] and replay['assessmentCount']==2)
    call(c,'PUT',base+'/support-consent',{'revision':2,'enabled':False})
    withdrawn=call(owner,'GET',base+'/department-support');snapshots['one_withdraws']=withdrawn
    check('Withdrawing alone removes eligibility from future summaries',withdrawn['status']=='insufficient')
    check('Withdrawal does not revoke accepted individual review',call(reviewer,'GET',base+'/assignments/'+assignments[0])['assignment']['status']=='accepted')
    call(c,'DELETE',base+'/members/'+learners[0][1],{})
    call(owner,'POST',base+'/members',{'handle':'demo_learner_1'})
    rejoined=call(c,'GET',base+'/support-consent')
    check('Rejoining leaves reporting off and advances the choice revision',not rejoined['enabled'] and rejoined['revision']>3)
    call(c,'PUT',base+'/support-consent',{'revision':2,'enabled':True},expected=409)
    check('A stale opt-in cannot revive reporting after rejoin',True)
    call(c,'GET','/read')
    check('The ordinary reader stays available',True)
    check('Institutional summary stays independent of unavailable council',call(c,'POST','/api/council',{},expected=503) is not None)
   finally:
    for c in clients:c.close()
    p.terminate()
    try:p.wait(timeout=10)
    except subprocess.TimeoutExpired:p.kill();p.wait()
 args.output.parent.mkdir(parents=True,exist_ok=True)
 args.output.write_text(json.dumps({'release':'1.17.0','build':'nabu-workspaces-1.17-20261115-r2','fixture':'Fictional coordinator, instructor and five learners; real loopback HTTP; no human outcomes.','passed':len(checks),'checks':checks,'snapshots':snapshots,'trace':trace},ensure_ascii=False,indent=2)+'\n')
 print(f'{len(checks)} checks passed. Report: {args.output}')
if __name__=='__main__':main()
