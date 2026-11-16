import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {createWorkspaceUI} from '../public/nabu-institutions.js';

const pause=()=>new Promise(r=>setTimeout(r,0));
async function until(fn){for(let i=0;i<100;i++){if(fn())return;await pause();}throw Error('DOM action did not finish');}
const workspace={id:'university',label:'Department <script>',role:'member',policy:{offlineResponses:true,revision:1}};
const assignment={id:'assignment-001',tenantId:'university',learnerId:'learner-a',status:'offered',objective:'Read the Arabic passage',reviewers:[{id:'teacher',handle:'teacher'}],sharing:'responses',terms:'Results and submitted responses go to @teacher.',taskId:'task-001',rubricVersion:1};
function initial(){return {assignment:structuredClone(assignment),task:{title:'A phrase',mode:'recall',prompt:'What does خذي وقتك mean?',options:[],sourceVisible:true},source:{title:'Original',text:'خذي وقتك',language:'ar',version:1,attribution:'Test author',rights:'Original'},attempts:[],appeals:[],policy:{offlineResponses:true},canReview:false,rawResponsesVisible:true,claim:'Task-specific result only.'};}
function harness(){
 const dom=new JSDOM('<dialog id="modal"><div id="modal-body"></div></dialog>',{url:'http://localhost'}),d=dom.window.document,calls=[],metadata=new Map(),downloads=[];let user={id:'learner-a'},rec=initial(),handler,serial=0;
 const api=async(p,o={})=>{calls.push({p,o:structuredClone(o)});if(handler){const v=handler(p,o);if(v!==undefined)return v;}
  if(p==='workspaces')return {workspaces:[workspace]};
  if(p.endsWith('/assignments'))return {assignments:[rec.assignment]};
  if(p.endsWith('/acceptance')){rec.assignment.status=o.body.decision;return {assignment:rec.assignment};}
  if(p.endsWith('/assignments/assignment-001'))return structuredClone(rec);
  if(p.endsWith('/attempts')){rec.attempts.push({id:o.body.id,observation:o.body,receivedAt:100+rec.attempts.length,assessments:[{id:'assessment-'+o.body.id,rubricVersion:1,matched:true,assisted:true,interpretation:'Matches this rubric.',scorerVersion:'fixture',reason:'Initial'}]});return {acknowledgedId:o.body.id,record:structuredClone(rec)};}
  if(p.endsWith('/replay'))return {allMatch:true,assessmentCount:rec.attempts.length,record:structuredClone(rec)};
  throw Error('Unexpected route '+p);
 };
 const ui=createWorkspaceUI({api,getUser:()=>user,getMeta:async(k,f)=>structuredClone(metadata.get(k)??f),mutateMeta:async(k,fn)=>{const next=fn(structuredClone(metadata.get(k)??null));metadata.set(k,structuredClone(next));return next;},showModal:(title,html)=>{d.querySelector('#modal-body').innerHTML=html;d.querySelector('#modal').open=true;},closeModal:()=>{d.querySelector('#modal-body').replaceChildren();d.querySelector('#modal').open=false;},download:(...a)=>downloads.push(a),escapeHTML:s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),uid:()=>`request-${++serial}`,document:d});
 d.addEventListener('submit',e=>{e.preventDefault();ui.submit(e.target).catch(()=>{});});
 const click=action=>{const b=d.querySelector(`[data-ws-action="${action}"]`);assert.ok(b,action);b.click();return b;};
 return {ui,dom,d,calls,metadata,downloads,click,handler:fn=>handler=fn,user:value=>user=value,rec:()=>rec,async enter(){await ui.open();click('workspace');await until(()=>d.querySelector('[data-ws-action=record]'));click('record');await until(()=>d.querySelector('[data-ws-action=accept]'));},async accepted(){await this.enter();click('accept');await until(()=>d.querySelector('[data-ws-form=attempt]'));},close:()=>dom.window.close()};
}

test('workspace is optional, escapes titles and exposes reporting terms before response',async()=>{
 const h=harness();try{assert.equal(h.d.querySelector('#nabu-workspaces'),null);await h.ui.open();assert.match(h.d.body.textContent,/Department <script>/);assert.equal(h.d.querySelector('script'),null);
  h.click('workspace');await until(()=>h.d.querySelector('[data-ws-action=record]'));h.click('record');await until(()=>h.d.querySelector('[data-ws-action=accept]'));
  assert.match(h.d.body.textContent,/submitted responses go to @teacher/);assert.equal(h.d.querySelector('[name=response]'),null);h.click('decline');await until(()=>h.d.body.textContent.includes('No assessment was created'));assert.equal(h.calls.some(x=>x.p.endsWith('/attempts')),false);
 }finally{h.close();}
});
test('accepted Arabic source, submission, feedback and replay remain usable',async()=>{
 const h=harness();try{await h.accepted();assert.equal(h.d.querySelector('.ws-source').getAttribute('dir'),'rtl');assert.equal(h.d.querySelector('.ws-source').lang,'ar');
  const form=h.d.querySelector('[data-ws-form=attempt]');form.querySelector('[name=response]').value='Take your time';await h.ui.submit(form);assert.match(h.d.body.textContent,/Matches this rubric/);assert.ok(h.d.querySelector('[data-ws-form=appeal]'));
  h.click('replay');await until(()=>h.d.body.textContent.includes('reproduced exactly'));h.click('export');await pause();assert.equal(h.downloads.length,1);
  assert.equal(h.calls.filter(x=>x.p.endsWith('/attempts')).length,1);assert.equal(h.calls.some(x=>/translate|speech|council|library|content-progress/.test(x.p)),false);
 }finally{h.close();}
});
test('failed online submission freezes its exact response and ID until successful retry',async()=>{
 const h=harness();try{await h.accepted();let fail=true;h.handler(p=>p.endsWith('/attempts')&&fail?Promise.reject(Error('network unavailable')):undefined);
  const form=h.d.querySelector('[data-ws-form=attempt]');form.querySelector('[name=response]').value='No rush';await assert.rejects(h.ui.submit(form),/frozen/);assert.equal(form.querySelector('[name=response]').disabled,true);
  form.querySelector('[name=response]').value='Modified after failure';fail=false;await h.ui.submit(form);
  const calls=h.calls.filter(x=>x.p.endsWith('/attempts'));assert.deepEqual(calls[0].o.body,calls[1].o.body);assert.equal(calls[1].o.body.response,'No rush');
 }finally{h.close();}
});
test('a new response invalidates an older replay export snapshot',async()=>{
 const h=harness();try{await h.accepted();let form=h.d.querySelector('[data-ws-form=attempt]');form.querySelector('[name=response]').value='Take your time';await h.ui.submit(form);
  h.click('replay');await until(()=>h.d.body.textContent.includes('reproduced exactly'));form=h.d.querySelector('[data-ws-form=attempt]');form.querySelector('[name=response]').value='No rush';await h.ui.submit(form);
  h.click('export');await pause();const exported=JSON.parse(h.downloads.at(-1)[1]);assert.equal(exported.attempts.length,2);assert.equal(exported.attempts.at(-1).observation.response,'No rush');assert.equal(Object.hasOwn(exported,'allMatch'),false);
 }finally{h.close();}
});
test('opted-in offline answer survives failure and can be retried through pending controls',async()=>{
 const h=harness();try{await h.accepted();let fail=true;h.handler(p=>p.endsWith('/attempts')&&fail?Promise.reject(Error('offline')):undefined);
  const form=h.d.querySelector('[data-ws-form=attempt]');form.querySelector('[name=response]').value='Take your time';form.querySelector('[name=local]').checked=true;await assert.rejects(h.ui.submit(form),/Pending answers/);
  h.click('pending');await until(()=>h.d.querySelector('[data-ws-action=retry-pending]'));assert.match(h.d.body.textContent,/Take your time/);fail=false;h.click('retry-pending');await until(()=>h.d.body.textContent.includes('No pending answers'));
  const calls=h.calls.filter(x=>x.p.endsWith('/attempts'));assert.deepEqual(calls[0].o.body,calls[1].o.body);
 }finally{h.close();}
});
test('account change clears workspace and ignores in-flight response',async()=>{
 const h=harness();try{await h.ui.open();let finish;h.handler(p=>p.endsWith('/assignments')?new Promise(r=>finish=r):undefined);
  h.click('workspace');await until(()=>finish);h.user({id:'another-user'});h.dom.window.dispatchEvent(new h.dom.window.Event('nabu-account-change'));
  finish({assignments:[assignment]});await pause();assert.equal(h.d.querySelector('#nabu-workspaces'),null);assert.equal(h.d.querySelector('#modal').open,false);
 }finally{h.close();}
});
test('late workspace load cannot replace pending answers view',async()=>{
 const h=harness();try{await h.ui.open();let finish;h.handler(p=>p.endsWith('/assignments')?new Promise(r=>finish=r):undefined);
  h.click('workspace');await until(()=>finish);h.click('pending');await until(()=>h.d.body.textContent.includes('No pending answers'));finish({assignments:[assignment]});await pause();
  assert.match(h.d.body.textContent,/Pending answers on this device/);assert.equal(h.d.querySelector('[data-ws-action=record]'),null);
 }finally{h.close();}
});
