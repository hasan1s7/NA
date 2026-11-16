import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {createWorkspaceUI} from '../public/nabu-institutions.js';

const pause=()=>new Promise(resolve=>setTimeout(resolve,0));
async function until(fn){for(let i=0;i<100;i++){if(fn())return;await pause();}throw Error('Department UI did not settle');}
const keys=['correction_pending','review_rubric','awaiting_response','assisted_evidence','task_matches'];
function summary(status='available'){
 return {schemaVersion:1,policyVersion:'department-support-v1',status,minimumParticipants:5,
  participantBand:status==='available'?{lower:15,upper:19,label:'15–19'}:null,
  denominator:'Current members who opted in and have at least one accepted assignment.',
  categories:keys.map((key,i)=>({key,label:key,status:status==='available'&&i===0?'released':'suppressed',band:status==='available'&&i===0?{lower:5,upper:9,label:'5–9'}:null})),
  recommendations:[{action:status==='available'?'review_corrections':'insufficient',reason:status==='available'?'Review correction requests before drawing conclusions about learner ability.':'Offer support without inferring ability from missing or withheld results.'}],
  notice:'Thresholding is not differential privacy or a guarantee of anonymity. Repeated summaries and other knowledge can reveal information.',learnerModelUpdated:false,conditionsVerified:false};
}
function harness({role='owner'}={}){
 const dom=new JSDOM('<main id="main"><article id="reader" lang="ar" dir="rtl">خذي وقتك.</article></main><dialog id="modal"><div id="modal-body"></div></dialog>',{url:'http://localhost'}),d=dom.window.document,calls=[];
 let account={id:'learner-a'},handler,consent={schemaVersion:1,policyVersion:'department-support-v1',revision:1,enabled:false,terms:'Choose whether past and future accepted assignment results may appear in future support summaries. Private reading is excluded.'};
 const ws={id:'department',label:'قسم العربية <script>',role,policy:{revision:1,offlineResponses:false}};
 const api=async(path,options={})=>{calls.push({path,options:structuredClone(options)});if(handler){const result=handler(path,options);if(result!==undefined)return result;}
  if(path==='workspaces')return {workspaces:[ws]};
  if(path.endsWith('/assignments'))return {assignments:[]};
  if(path.endsWith('/support-consent')){
   if(options.method==='PUT'){assert.equal(options.body.revision,consent.revision);assert.equal(options.body.policyVersion,consent.policyVersion);consent={...consent,enabled:options.body.enabled,revision:consent.revision+1};}
   return structuredClone(consent);
  }
  if(path.endsWith('/department-support'))return summary();
  throw Error('Unexpected route '+path);
 };
 const metadata=new Map();
 const ui=createWorkspaceUI({api,getUser:()=>account,getMeta:async(k,f)=>metadata.get(k)??f,mutateMeta:async(k,fn)=>{const v=fn(metadata.get(k)??null);metadata.set(k,v);return v;},showModal:(title,html)=>{d.querySelector('#modal-body').innerHTML=html;d.querySelector('#modal').open=true;},closeModal:()=>{d.querySelector('#modal-body').replaceChildren();d.querySelector('#modal').open=false;},download:()=>{},escapeHTML:s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),uid:()=> 'fixture-id',document:d});
 const click=action=>{const b=d.querySelector(`[data-ws-action="${action}"]`);assert.ok(b,action);b.click();return b;};
 return {ui,d,dom,calls,click,handler:f=>handler=f,consent:()=>consent,setConsent:v=>consent={...consent,...v},setUser:v=>account=v,async workspace(){await ui.open();click('workspace');await until(()=>d.querySelector('[data-ws-action="reporting"]'));},async reporting(){await this.workspace();click('reporting');await until(()=>d.querySelector('[data-ws-form="reporting-choice"]'));},close:()=>dom.window.close()};
}

test('department reporting is optional, separate from membership, and off by default',async()=>{
 const h=harness({role:'member'});try{
  assert.equal(h.d.querySelector('#nabu-workspaces'),null);await h.workspace();
  assert.equal(h.calls.some(x=>x.path.endsWith('/support-consent')),false);assert.equal(h.d.querySelector('[data-ws-action="department-support"]'),null);
  h.click('reporting');await until(()=>h.d.querySelector('[name="enabled"]'));
  assert.equal(h.d.querySelector('[name="enabled"]').checked,false);assert.match(h.d.body.textContent,/Saved choice: Off/);
  assert.match(h.d.body.textContent,/separate from accepting an assignment/);assert.match(h.d.body.textContent,/past and future accepted assignment results/);
  assert.equal(h.calls.some(x=>x.options.method==='PUT'),false);
 }finally{h.close();}
});

test('explicit opt-in and withdrawal use saved revisions and accurately reflect acknowledged state',async()=>{
 const h=harness();try{await h.reporting();let f=h.d.querySelector('[data-ws-form="reporting-choice"]');f.querySelector('[name="enabled"]').checked=true;await h.ui.submit(f);
  assert.equal(h.consent().enabled,true);assert.match(h.d.body.textContent,/Saved choice: On/);
  f=h.d.querySelector('[data-ws-form="reporting-choice"]');f.querySelector('[name="enabled"]').checked=false;await h.ui.submit(f);
  const writes=h.calls.filter(x=>x.options.method==='PUT');assert.deepEqual(writes.map(x=>x.options.body),[{revision:1,enabled:true,policyVersion:'department-support-v1'},{revision:2,enabled:false,policyVersion:'department-support-v1'}]);
  assert.match(h.d.body.textContent,/Saved choice: Off/);assert.match(h.d.body.textContent,/excluded from future group summaries/);
  assert.match(h.d.body.textContent,/cannot be recalled/);
 }finally{h.close();}
});

test('a revision conflict removes stale choice controls until the learner reloads',async()=>{
 const h=harness();try{await h.reporting();h.setConsent({enabled:true,revision:2});let fail=true;
  h.handler((p,o)=>p.endsWith('/support-consent')&&o.method==='PUT'&&fail?Promise.reject(Object.assign(Error('Conflict'),{status:409})):undefined);
  const f=h.d.querySelector('[data-ws-form="reporting-choice"]');await h.ui.submit(f);
  assert.equal(h.d.querySelector('[name="enabled"]'),null);assert.match(h.d.body.textContent,/changed elsewhere/);assert.equal(h.d.querySelector('[data-reporting-enabled]'),null);
  fail=false;h.click('reporting');await until(()=>h.d.querySelector('[name="enabled"]'));
  assert.equal(h.d.querySelector('[name="enabled"]').checked,true);assert.match(h.d.body.textContent,/Saved choice: On/);
 }finally{h.close();}
});

test('lost consent acknowledgement stays unknown until a successful reload',async()=>{
 const h=harness();try{await h.reporting();h.handler((p,o)=>{if(p.endsWith('/support-consent')&&o.method==='PUT'){h.setConsent({enabled:true,revision:2});return Promise.reject(Error('Connection lost after submission'));}});
  const f=h.d.querySelector('[data-ws-form="reporting-choice"]');f.querySelector('[name="enabled"]').checked=true;await h.ui.submit(f);
  assert.match(h.d.body.textContent,/change was not confirmed/);assert.equal(h.d.querySelector('[data-reporting-enabled]'),null);assert.equal(h.d.querySelector('[type="submit"]'),null);
  h.handler(()=>undefined);h.click('reporting');await until(()=>h.d.querySelector('[name="enabled"]'));assert.match(h.d.body.textContent,/Saved choice: On/);
 }finally{h.close();}
});

test('a failed consent load provides retry without inventing a saved state',async()=>{
 const h=harness();try{await h.workspace();h.handler(p=>p.endsWith('/support-consent')?Promise.reject(Error('Unavailable')):undefined);h.click('reporting');await until(()=>h.d.querySelector('[role="alert"]'));
  assert.equal(h.d.querySelector('[name="enabled"]'),null);assert.equal(h.d.querySelector('[data-reporting-enabled]'),null);assert.match(h.d.body.textContent,/Reload reporting choice/);
  h.handler(()=>undefined);h.click('reporting');await until(()=>h.d.querySelector('[name="enabled"]'));assert.match(h.d.body.textContent,/Saved choice: Off/);
 }finally{h.close();}
});

test('owner support view contains only released bands and explains suppression and inference limits',async()=>{
 const h=harness();try{await h.workspace();h.click('department-support');await until(()=>h.d.querySelector('.ws-support-grid'));
  assert.equal(h.d.querySelectorAll('.ws-support-card').length,5);assert.match(h.d.querySelector('.ws-cohort-band').textContent,/15–19/);
  assert.equal(h.d.querySelector('[data-support-category="correction_pending"] .ws-support-value').textContent,'5–9');
  assert.equal(h.d.querySelector('[data-support-category="review_rubric"] .ws-support-value').textContent,'Not shown');
  assert.match(h.d.body.textContent,/does not mean zero/);assert.match(h.d.body.textContent,/not measures of proficiency/);assert.match(h.d.body.textContent,/not differential privacy/);
  assert.equal(h.d.querySelector('[data-learner-id]'),null);assert.equal(h.d.querySelector('[data-ws-action="record"]'),null);
  assert.equal(h.d.querySelector('script'),null);assert.equal(h.calls.some(x=>/content-progress|intents|library|translate|speech/.test(x.path)),false);
 }finally{h.close();}
});

test('insufficient participants never become zero performance or display a participant number',async()=>{
 const h=harness();try{await h.workspace();h.handler(p=>p.endsWith('/department-support')?summary('insufficient'):undefined);h.click('department-support');await until(()=>h.d.querySelector('.ws-support-grid'));
  assert.equal(h.d.querySelector('.ws-cohort-band'),null);assert.equal([...h.d.querySelectorAll('.ws-support-value')].every(x=>x.textContent==='Not shown'),true);
  assert.match(h.d.body.textContent,/At least five current members/);assert.match(h.d.body.textContent,/missing or withheld results/);
 }finally{h.close();}
});

test('support failure removes formerly shown values and retains a working retry',async()=>{
 const h=harness();try{await h.workspace();h.click('department-support');await until(()=>h.d.querySelector('.ws-support-grid'));
  h.handler(p=>p.endsWith('/department-support')?Promise.reject(Object.assign(Error('Current owner membership is required'),{status:403})):undefined);h.click('department-support');await until(()=>h.d.querySelector('[role="alert"]'));
  assert.equal(h.d.querySelector('.ws-support-grid'),null);assert.equal(h.d.querySelector('.ws-cohort-band'),null);assert.match(h.d.body.textContent,/No previous numbers are shown as current/);
  h.handler(()=>undefined);h.click('department-support');await until(()=>h.d.querySelector('.ws-support-grid'));
 }finally{h.close();}
});

test('malformed aggregate payloads are unavailable rather than misleading partial reports',async()=>{
 const h=harness();try{await h.workspace();const invalid=summary();invalid.categories[1].status='released';invalid.categories[1].band={lower:1,upper:4,label:'1–4'};
  h.handler(p=>p.endsWith('/department-support')?invalid:undefined);h.click('department-support');await until(()=>h.d.querySelector('[role="alert"]'));
  assert.equal(h.d.querySelector('.ws-support-grid'),null);assert.match(h.d.body.textContent,/unsupported count range/);
 }finally{h.close();}
});

test('late support results cannot replace a newer reporting view',async()=>{
 const h=harness();try{await h.workspace();let finish;h.handler(p=>p.endsWith('/department-support')?new Promise(r=>finish=r):undefined);h.click('department-support');await until(()=>finish);
  h.click('home');await until(()=>h.d.querySelector('[data-ws-action="workspace"]'));h.click('workspace');await until(()=>h.d.querySelector('[data-ws-action="reporting"]'));h.click('reporting');await until(()=>h.d.querySelector('[name="enabled"]'));
  finish(summary());await pause();assert.ok(h.d.querySelector('[name="enabled"]'));assert.equal(h.d.querySelector('.ws-support-grid'),null);
 }finally{h.close();}
});

test('account switching rejects an in-flight consent acknowledgement',async()=>{
 const h=harness();try{await h.reporting();let finish;h.handler((p,o)=>p.endsWith('/support-consent')&&o.method==='PUT'?new Promise(r=>finish=r):undefined);
  const f=h.d.querySelector('[data-ws-form="reporting-choice"]');f.querySelector('[name="enabled"]').checked=true;const pending=h.ui.submit(f);await until(()=>finish);
  h.setUser({id:'other-account'});h.dom.window.dispatchEvent(new h.dom.window.Event('nabu-account-change'));finish({...h.consent(),enabled:true,revision:2});await assert.rejects(pending,e=>e.code==='NABU_WORKSPACE_STALE');
  assert.equal(h.d.querySelector('#nabu-workspaces'),null);
 }finally{h.close();}
});

test('reporting and summary preserve the reader node, selection, script direction and scroll position',async()=>{
 const h=harness();try{const reader=h.d.querySelector('#reader');reader.scrollTop=42;const range=h.d.createRange();range.selectNodeContents(reader);h.dom.window.getSelection().addRange(range);const selected=h.dom.window.getSelection().toString();
  await h.workspace();h.click('department-support');await until(()=>h.d.querySelector('.ws-support-grid'));
  assert.equal(h.d.querySelector('#reader'),reader);assert.equal(reader.scrollTop,42);assert.equal(reader.dir,'rtl');assert.equal(h.dom.window.getSelection().toString(),selected);
  const back=h.d.querySelector('[data-ws-action="workspace"]');assert.equal(back.tagName,'BUTTON');assert.equal(back.type,'button');assert.equal(back.tabIndex,0);back.focus();assert.equal(h.d.activeElement,back);
  h.click('close');await pause();assert.equal(h.d.querySelector('#reader'),reader);assert.equal(reader.textContent,'خذي وقتك.');
 }finally{h.close();}
});


test('unrecognized reporting terms do not present an actionable consent form',async()=>{
 const h=harness();try{await h.workspace();h.handler(p=>p.endsWith('/support-consent')?{...h.consent(),policyVersion:'department-support-v2'}:undefined);h.click('reporting');await until(()=>h.d.querySelector('[role="alert"]'));
  assert.equal(h.d.querySelector('[name="enabled"]'),null);assert.equal(h.d.querySelector('[type="submit"]'),null);assert.match(h.d.body.textContent,/could not be verified/);
  assert.equal(h.calls.some(x=>x.options.method==='PUT'),false);
 }finally{h.close();}
});
