/** Live learner interface: real task scoring, immutable store, Bayesian engine
 * and policy. jsdom verifies transactions and controls, not browser layout. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import * as C from '../public/nabu-core.js';
import * as Intent from '../public/nabu-intents.js';
import * as Tasks from '../public/nabu-learner-tasks.js';
import {createContentStore} from '../public/nabu-content-store.js';
import {installLearnerSupport} from '../public/nabu-learner-ui.js';
const {JSDOM}=await import(process.env.NABU_TEST_JSDOM?pathToFileURL(process.env.NABU_TEST_JSDOM).href:'jsdom');
const clone=v=>structuredClone(v),targetId='learner:ar:write:retrieval';
function intent(owner=null,tenantId=null,avoid=false){
 owner=owner||'guest';
 const parsed=Intent.parseIntentLocal(avoid?'I want to read Arabic without practice.':'I want to practice reading Arabic.');
 const record=Intent.validateIntentRecord({schemaVersion:1,id:'learner-ui-intent',ownerUserId:owner,tenantId,kind:'learner',...parsed,
  createdAt:1000,updatedAt:1000,statusChangedAt:1000,revision:1});
 return Intent.intentContext({intents:[record],selection:{mode:'selected',intentId:record.id},organizationObjective:null},{owner,tenantId});
}
async function setup({user=null,tenantId=null,avoid=false,beforeSave=null,afterSave=null,locked=false,deferClose=false}={}){
 const dom=new JSDOM('<main><article id="reader-text">An existing Arabic reading.</article><div id="learner-host"></div></main><dialog id="modal"><h2 id="modal-title"></h2><div id="modal-body"></div></dialog>',{url:'https://nabu.invalid/read',pretendToBeVisual:true});
 const w=dom.window;globalThis.window=w;globalThis.document=w.document;const $=s=>w.document.querySelector(s);
 let clock=1800000000000,counter=0,currentContext=intent(user?.id||null,tenantId,avoid);
 const uid=()=>('learner-ui-'+String(++counter).padStart(20,'0'));
 const meta=new Map(),errors=[],pending=new Set(),downloads=[],calls=[];
 const state={user,accountHint:locked?'locked-account':'',backend:user?{evidenceEvents:true}:null,view:'reader',
  translation:{sourceLang:'ar',targetLang:'en'},settings:{targetLang:'ar'},cards:[{id:'untouched',schedule:{due:1000,reps:3}}],logs:[{id:'old-log'}]};
 const realStore=createContentStore({getMeta:async(k,d)=>clone(meta.get(k)??d),setMeta:async(k,v)=>meta.set(k,clone(v)),uid,now:()=>clock,locks:null});
 await realStore.configure(locked?'!locked':user?.id||'guest');
 const store={...realStore,append:async(item,kind,fields,id)=>{const call={item,kind,fields:clone(fields),id};calls.push(call);await beforeSave?.(call);const result=await realStore.append(item,kind,fields,id);await afterSave?.(call);return result;}};
 const showModal=(title,body)=>{$('#modal-title').textContent=title;$('#modal-body').innerHTML=body;$('#modal').open=true;};
 const closeEvents=[];
 const closeModal=()=>{$('#modal').open=false;const dispatch=()=>$('#modal').dispatchEvent(new w.Event('close'));if(deferClose)closeEvents.push(dispatch);else dispatch();$('#modal-body').replaceChildren();};
 const actions={},ui=installLearnerSupport({state,C:{...C,uid},E:C.escapeHTML,actions,$,explore:{store},intents:{getContext:()=>clone(currentContext)},showModal,closeModal,
  download:async(name,data,type)=>downloads.push({name,data,type}),now:()=>clock,fitOptions:{burnIn:12,samples:12,chains:2,seed:17}});
 const mount=()=>{$('#learner-host').innerHTML=ui.render();};mount();
 w.document.addEventListener('click',event=>{const b=event.target.closest('[data-action]');if(!b||b.disabled||!actions[b.dataset.action])return;
  const p=Promise.resolve().then(()=>actions[b.dataset.action](b)).catch(e=>errors.push(e));pending.add(p);p.finally(()=>pending.delete(p));});
 const settle=async()=>{while(pending.size)await Promise.all([...pending]);};
 return {w,$,ui,state,store,realStore,meta,actions,calls,errors,downloads,mount,
  get context(){return clone(currentContext);},set context(v){currentContext=clone(v);},set clock(v){clock=v;},
  events:()=>store.getEvents(),responses:()=>store.getEvents().filter(e=>e.evidence?.observation==='response'),
  start(selector){assert.ok($(selector),selector);$(selector).click();},
  async click(selector){this.start(selector);await settle();},settle,
  async chooseGoal(id=targetId){await this.click('[data-action="learner-open"]');$('#learner-goal').value=id;await this.click('[data-action="learner-request"]');},
  async check(id=targetId){await ui.startCheck(id);},
  answer(text){$('#learner-answer').value=text;},
  allActions(){for(const b of w.document.querySelectorAll('[data-action]'))assert.equal(typeof actions[b.dataset.action],'function',b.dataset.action);},
  flushCloseEvents:()=>closeEvents.splice(0).forEach(dispatch=>dispatch()),close:()=>w.close()};
}
test('real prior and policy run in the live panel without creating learner evidence',async()=>{
 const h=await setup();try{
  const before=clone({cards:h.state.cards,logs:h.state.logs});await h.chooseGoal();
  const s=h.ui.getSnapshot();assert(s.fit);assert(s.decision);assert.equal(s.fit.diagnostics.inferenceStatus,'prior-only');
  assert.equal(h.events().length,0);assert.match(h.$('#nabu-learner-panel').textContent,/starting assumptions/);
  assert.equal(s.fit.scope.actor.userId,null);assert.equal(s.fit.scope.actor.tenantId,null);h.allActions();
  assert.deepEqual({cards:h.state.cards,logs:h.state.logs},before);assert.deepEqual(h.errors,[]);
 }finally{h.close();}
});
test('an unassisted real response updates a scoped posterior; source and schedules stay in place',async()=>{
 const h=await setup();try{
  await h.chooseGoal();const source=h.$('#reader-text'),before=clone({cards:h.state.cards,logs:h.state.logs});
  await h.click('[data-action="learner-try-goal"]');assert.equal(h.$('main').style.visibility,'hidden');assert.equal(h.$('main').getAttribute('aria-hidden'),'true');
  h.answer(Tasks.learnerTask(targetId).accepted[0]);await h.click('[data-action="learner-submit"]');
  assert.equal(h.responses().length,1);assert.equal(h.ui.getSnapshot().input.observations.length,1);
  assert.equal(h.ui.getSnapshot().fit.dataSummary.currentObservations,1);
  assert.equal(h.responses()[0].evidence.assistance.feedbackShown,false);
  assert.equal(h.events().filter(e=>e.evidence.observation==='answer-revealed').length,1);
  assert.match(h.$('.content-feedback').textContent,/updates the model/);h.allActions();
  await h.click('[data-action="learner-results"]');assert.equal(h.$('main').style.visibility,'');assert.equal(h.$('#reader-text'),source);
  assert.deepEqual({cards:h.state.cards,logs:h.state.logs},before);assert.deepEqual(h.errors,[]);
 }finally{h.close();}
});
test('reveals and same-session repeats never become independent evidence',async()=>{
 const h=await setup();try{
  await h.chooseGoal();await h.check();await h.click('[data-action="learner-reveal"]');h.answer(Tasks.learnerTask(targetId).accepted[0]);
  await h.click('[data-action="learner-submit"]');assert.equal(h.ui.getSnapshot().input.observations.length,0);
  await h.click('[data-action="learner-results"]');await h.check();h.answer(Tasks.learnerTask(targetId).accepted[0]);await h.click('[data-action="learner-submit"]');
  assert.equal(h.responses().length,2);assert.equal(h.ui.getSnapshot().input.observations.length,0);
  assert.equal(h.responses()[0].evidence.episodeId,h.responses()[1].evidence.episodeId);
  assert.equal(h.responses()[1].evidence.assistance.feedbackShown,true);assert.deepEqual(h.errors,[]);
 }finally{h.close();}
});
test('a meaning-supplied pattern check updates only the explicitly remaining component',async()=>{
 const h=await setup();try{
  await h.chooseGoal();const t=Tasks.learnerTask('learner:ar:open:pattern');await h.check(t.id);h.answer(t.accepted[0]);await h.click('[data-action="learner-submit"]');
  const s=h.ui.getSnapshot();assert.equal(s.input.observations.length,1);assert.equal(s.input.summary.conditioned,1);
  const mapped=s.fit.tasks.find(x=>x.id===t.id);assert(mapped.components.every(c=>c.kind==='pattern'));
  assert.equal(h.responses()[0].evidence.assistance.baseMeaningSupplied,true);assert.equal(s.input.projection.competence,null);
  assert.deepEqual(h.errors,[]);
 }finally{h.close();}
});
test('failed response writes retry the same first payload and ID, even if the input changes',async()=>{
 let fail=true;const h=await setup({beforeSave:call=>{if(fail&&call.fields.evidence.observation==='response'){fail=false;throw Error('Simulated write failure');}}});
 try{
  await h.chooseGoal();await h.check();h.answer('wrong');await h.click('[data-action="learner-submit"]');assert.equal(h.responses().length,0);
  assert.equal(h.$('#learner-answer').disabled,true);assert.match(h.$('.learner-check [role="alert"]').textContent,/first response is preserved/);
  h.answer(Tasks.learnerTask(targetId).accepted[0]);await h.click('[data-action="learner-submit"]');
  const writes=h.calls.filter(c=>c.fields.evidence.observation==='response');assert.equal(writes.length,2);assert.equal(writes[0].id,writes[1].id);assert.deepEqual(writes[0].fields,writes[1].fields);
  assert.equal(h.responses()[0].evidence.response.answer,'wrong');assert.equal(h.ui.getSnapshot().input.observations.length,1);assert.deepEqual(h.errors,[]);
 }finally{h.close();}
});
test('a lost response acknowledgement is idempotent and a skip remains unscored',async()=>{
 let fail=true;const h=await setup({afterSave:call=>{if(fail&&call.fields.evidence.observation==='response'){fail=false;throw Error('Lost acknowledgement');}}});
 try{
  await h.chooseGoal();await h.check();h.answer('wrong');await h.click('[data-action="learner-submit"]');assert.equal(h.responses().length,1);
  await h.click('[data-action="learner-submit"]');assert.equal(h.responses().length,1);
  await h.click('[data-action="learner-results"]');await h.check('learner:ar:open:base-recall');await h.click('[data-action="learner-skip"]');
  assert.match(h.$('.content-feedback').textContent,/Skipped without grading/);
  const skips=h.events().filter(e=>e.evidence.observation==='skipped');assert.equal(skips.length,1);assert.equal(skips[0].evidence.response,null);
  assert.equal(h.events().filter(e=>e.evidence.observation==='answer-revealed').length,1);assert.deepEqual(h.errors,[]);
 }finally{h.close();}
});
test('no-practice preference excludes recommended and manual checks',async()=>{
 const h=await setup({avoid:true});try{
  await h.chooseGoal();assert.equal(h.ui.getSnapshot().decision.constraints.avoidPractice,true);
  assert.equal(h.$('[data-action="learner-try-goal"]'),null);assert.notEqual(h.ui.getSnapshot().decision.primary.kind,'diagnostic');
  await assert.rejects(()=>h.ui.startCheck(targetId),/excludes practice/);assert.equal(h.responses().length,0);
 }finally{h.close();}
});
test('team/account changes close a check and discard old predictions without moving evidence',async()=>{
 const h=await setup({user:{id:'alice'},tenantId:'team-one'});try{
  await h.chooseGoal();await h.check();h.answer('wrong');h.context=intent('alice','team-two');h.w.dispatchEvent(new h.w.Event('nabu-intent-change'));
  assert.equal(h.$('#modal').open,false);assert.equal(h.$('main').style.visibility,'');assert.equal(h.ui.getSnapshot().fit,null);assert.equal(h.responses().length,0);
  await h.chooseGoal();assert.equal(h.ui.getSnapshot().fit.scope.actor.tenantId,'team-two');
  h.state.user={id:'bob'};h.context=intent('bob');await h.realStore.configure('bob');h.w.dispatchEvent(new h.w.Event('nabu-account-change'));
  assert.equal(h.ui.getSnapshot().fit,null);assert.equal(h.events().length,0);assert.deepEqual(h.errors,[]);
 }finally{h.close();}
});
test('locked accounts expose no learner controls and a scoped export contains its model calculation',async()=>{
 const locked=await setup({locked:true});try{assert.equal(locked.ui.enabled(),false);assert.equal(locked.$('[data-action="learner-open"]'),null);}finally{locked.close();}
 const h=await setup();try{
  await h.chooseGoal();await h.click('[data-action="learner-export"]');assert.equal(h.downloads.length,1);
  const data=JSON.parse(h.downloads[0].data);assert.equal(data.goalId,targetId);assert.equal(data.context.actor.userId,null);assert(data.fit.samples.length>0);assert(data.decision.assumptions);
  assert.equal(data.events.length,0);assert.deepEqual(h.errors,[]);
 }finally{h.close();}
});
test('a shown exceptional form follows its memory route across different task IDs',async()=>{
 const h=await setup();try{
  await h.chooseGoal();await h.check('learner:es:write:pattern');await h.click('[data-action="learner-reveal"]');await h.click('[data-action="learner-continue"]');
  const t=Tasks.learnerTask('learner:es:write:retrieval');await h.check(t.id);h.answer(t.accepted[0]);await h.click('[data-action="learner-submit"]');
  assert.equal(h.ui.getSnapshot().input.observations.length,0);assert.equal(h.responses()[0].evidence.assistance.feedbackShown,true);
  assert.deepEqual(h.errors,[]);
 }finally{h.close();}
});
test('a recognition prompt exposes a form and a conditioned prompt exposes its base',async()=>{
 const h=await setup();try{
  await h.chooseGoal();await h.check('learner:ar:write:reading');await h.click('[data-action="learner-continue"]');
  await h.check();h.answer('مكتوب');await h.click('[data-action="learner-submit"]');assert.equal(h.responses()[0].evidence.assistance.sourceVisible,true);
  assert.equal(h.ui.getSnapshot().input.observations.length,0);await h.click('[data-action="learner-results"]');
  await h.check('learner:ar:open:pattern');await h.click('[data-action="learner-continue"]');
  await h.check('learner:ar:open:base-recall');h.answer('فتح');await h.click('[data-action="learner-submit"]');
  assert.equal(h.responses()[1].evidence.assistance.sourceVisible,true);assert.equal(h.ui.getSnapshot().input.observations.length,0);
  assert.deepEqual(h.errors,[]);
 }finally{h.close();}
});
test('an accepted support save cannot replace a newly selected goal dialog',async()=>{
 let release,entered=false;const gate=new Promise(resolve=>release=resolve);
 const h=await setup({beforeSave:async c=>{if(c.fields.evidence.observation==='hint'){entered=true;await gate;}}});
 try{
  await h.chooseGoal();h.start('[data-action="learner-choose"][data-id="support:0"]');
  for(let i=0;i<100&&!entered;i++)await new Promise(r=>setTimeout(r,1));
  assert(entered);h.actions['learner-open']();assert.equal(h.$('#modal-title').textContent,'Choose a small learning goal');
  release();await h.settle();assert.equal(h.$('#modal-title').textContent,'Choose a small learning goal');
  assert.equal(h.events().filter(e=>e.evidence.observation==='hint').length,1);assert.equal(h.ui.getSnapshot().fit,null);assert.deepEqual(h.errors,[]);
 }finally{release();h.close();}
});
test('continuing while a cue saves prevents the old cue from reopening',async()=>{
 let release,entered=false;const gate=new Promise(resolve=>release=resolve);
 const h=await setup({beforeSave:async c=>{if(c.fields.evidence.observation==='hint'){entered=true;await gate;}}});
 try{
  await h.chooseGoal();h.start('[data-action="learner-choose"][data-id="support:0"]');
  for(let i=0;i<100&&!entered;i++)await new Promise(r=>setTimeout(r,1));
  assert(entered);h.actions['learner-continue']();assert.equal(h.$('#modal').open,false);
  release();await h.settle();assert.equal(h.$('#modal').open,false);assert.equal(h.responses().length,0);assert.deepEqual(h.errors,[]);
 }finally{release();h.close();}
});
test('a queued native close event cannot relinquish a newly opened goal dialog',async()=>{
 const h=await setup({deferClose:true});try{
  await h.chooseGoal();h.flushCloseEvents();await h.check();
  assert.equal(h.$('main').style.visibility,'hidden');
  h.actions['learner-open']();assert.equal(h.$('#modal-title').textContent,'Choose a small learning goal');
  h.flushCloseEvents();assert.equal(h.$('#modal').open,true);
  await h.click('#modal [data-action="learner-continue"]');assert.equal(h.$('#modal').open,false);
  h.flushCloseEvents();assert.equal(h.$('main').style.visibility,'');assert.deepEqual(h.errors,[]);
 }finally{h.close();}
});
