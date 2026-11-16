/** Optional jsdom integration: real evidence UI, tasks, policy, projector and
 * existing content store. Storage is an in-memory meta adapter; modal/download
 * primitives are controlled. Does not claim browser layout/audio/cookie tests.
 * NABU_TEST_JSDOM=/absolute/path/to/jsdom/lib/api.js node --test tests/evidence-ui.dom.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import * as C from '../public/nabu-core.js';
import * as X from '../public/nabu-content.js';
import * as Tasks from '../public/nabu-evidence-tasks.js';
import * as Intent from '../public/nabu-intents.js';
import {createContentStore} from '../public/nabu-content-store.js';
import {EPISODE_RESUME_MS,installEvidenceLoop} from '../public/nabu-evidence-ui.js';
const {JSDOM}=await import(process.env.NABU_TEST_JSDOM?pathToFileURL(process.env.NABU_TEST_JSDOM).href:'jsdom');
const clone=value=>structuredClone(value);
const item=X.itemById('a-little-later');
function deferred(){let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};}
async function until(predicate,label='condition'){for(let i=0;i<150;i++){if(predicate())return;await new Promise(r=>setTimeout(r,10));}throw Error('Timed out: '+label);}
function context(userId=null,tenantId=null,revision=1){
 const owner=userId||'guest',record=Intent.validateIntentRecord({schemaVersion:1,id:'evidence-ui-intent',ownerUserId:owner,tenantId,kind:'learner',...Intent.parseIntentLocal('I want to understand this Arabic dialogue.'),createdAt:1000,updatedAt:1000+revision,statusChangedAt:1000,revision});
 return Intent.intentContext({intents:[record],selection:{mode:'selected',intentId:record.id},organizationObjective:null},{owner,tenantId});
}
async function setup({user=null,tenantId=null,accountHint='',backend=null,beforeSave=null,afterSave=null}={}){
 const dom=new JSDOM('<main><section class="reader-body"><article id="reader-text" lang="ar" dir="rtl"></article></section><audio id="media"></audio><aside id="word-panel-host">Existing word support</aside><div id="cards">Existing cards</div><div id="logs">Existing schedule logs</div><div id="evidence-host"></div><details class="content-translation"><summary>Translation</summary><p>Existing translation</p></details></main><dialog id="modal" aria-labelledby="modal-title"><h2 id="modal-title"></h2><div id="modal-body"></div></dialog>',{url:'https://nabu.invalid/read',pretendToBeVisual:true});
 const w=dom.window;globalThis.window=w;globalThis.document=w.document;const $=selector=>w.document.querySelector(selector);$('#reader-text').textContent=X.sourceText(item);
 let currentContext=context(user?.id||null,tenantId),activeItem=item,clock=100000,counter=0,reorderActors=false;
 const uid=()=>`evidence-ui-${String(++counter).padStart(16,'0')}`;
 const state={user,accountHint,backend,view:'reader',reader:{text:X.sourceText(item),contentId:item.id,contentVersion:item.version},cards:[{id:'untouched-card',schedule:{due:300000,reps:2}}],logs:[{id:'old-schedule-log',rating:2}]};
 const meta=new Map(),calls={writes:0,remember:[],downloads:[],modal:[],close:0},errors=[],pending=new Set();
 const realStore=createContentStore({getMeta:async(key,fallback)=>clone(meta.get(key)??fallback),setMeta:async(key,value)=>{calls.writes++;meta.set(key,clone(value));},uid,now:()=>clock,locks:null});
 await realStore.configure(user?.id||(accountHint?'!locked':'guest'));
 const store={...realStore,getEvents:()=>realStore.getEvents().map(e=>reorderActors&&e.evidence?{...e,evidence:{...e.evidence,actor:{tenantId:e.evidence.actor.tenantId,userId:e.evidence.actor.userId}}}:e)};
 const remember=async(content,kind,fields={},id=uid())=>{const request={contentId:content.id,kind,fields:clone(fields),id};calls.remember.push(request);if(beforeSave)await beforeSave(request);const result=await realStore.append(content,kind,fields,id);if(afterSave)await afterSave(request,result);return result;};
 const actions={},showModal=(title,html)=>{calls.modal.push(title);$('#modal-title').textContent=title;$('#modal-body').innerHTML=html;$('#modal').open=true;},closeModal=()=>{calls.close++;$('#modal').open=false;$('#modal').dispatchEvent(new w.Event('close'));};
 const ui=installEvidenceLoop({state,C:{...C,uid},E:C.escapeHTML,actions,$,store,remember,active:()=>activeItem,showModal,closeModal,download:async(name,data,type)=>{calls.downloads.push({name,data,type});},getIntentContext:()=>clone(currentContext),now:()=>clock});
 w.document.addEventListener('click',event=>{const button=event.target.closest('[data-action]');if(!button||button.disabled)return;const fn=actions[button.dataset.action];if(!fn)return;event.preventDefault();const p=Promise.resolve().then(()=>fn(button)).catch(error=>errors.push(error));pending.add(p);p.finally(()=>pending.delete(p));});
 const mount=()=>{$('#evidence-host').innerHTML=ui.panel();};mount();
 const settle=async()=>{while(pending.size)await Promise.all([...pending]);await Promise.resolve();};
 const startClick=selector=>{const el=$(selector);assert.ok(el,selector);el.click();};
 return {dom,w,$,state,ui,store,realStore,actions,calls,errors,meta,remember,mount,settle,startClick,
  get currentContext(){return clone(currentContext);},set currentContext(value){currentContext=clone(value);},
  set active(value){activeItem=value;},set clock(value){clock=value;},set reorderActors(value){reorderActors=value;},
  async display(){clock++;await remember(activeItem,'opened',ui.display(activeItem));ui.refresh();},
  async click(selector){startClick(selector);await settle();},
  async check(key){await this.click('[data-action="evidence-options"]');await this.click('[data-action="evidence-check"][data-key="'+key+'"]');},
  answer(value){const input=$('#evidence-answer');assert.ok(input);input.value=value;input.dispatchEvent(new w.Event('input',{bubbles:true}));},
  choice(value){const input=$('input[name="evidence-choice"][value="'+value+'"]');assert.ok(input);input.checked=true;input.dispatchEvent(new w.Event('change',{bubbles:true}));},
  assertActions(){for(const el of w.document.querySelectorAll('[data-action]')){assert.equal(typeof actions[el.dataset.action],'function',el.dataset.action);assert.ok(el.textContent.trim()||el.getAttribute('aria-label'),'Action name');}},
  close(){w.close();}
 };
}
function snapshot(h){return {nodes:['.reader-body','#reader-text','#media','#word-panel-host','#cards','#logs'].map(selector=>({selector,node:h.$(selector),html:h.$(selector).outerHTML})),state:clone(h.state)};}
function unchanged(h,before){for(const {selector,node,html} of before.nodes){assert.equal(h.$(selector),node,selector+' node');assert.equal(node.outerHTML.replace(/ style=""/g,''),html.replace(/ style=""/g,''),selector+' contents');}assert.deepEqual(h.state,before.state,'No card, schedule, log or source mutation');}
const audited=h=>h.store.getEvents().filter(e=>e.evidence);
const responses=h=>audited(h).filter(e=>e.evidence.observation==='response');

test('optional controls and context help preserve the reader, media, cards and schedules',async()=>{
 const h=await setup();try{await h.display();const before=snapshot(h);assert.equal(audited(h)[0].evidence.observation,'displayed');assert.equal(h.ui.projection().competence,null);assert.equal(h.ui.projection().ledger[0].counted,false);h.assertActions();
  await h.click('[data-action="evidence-help"]');assert.equal(h.$('#modal').open,true);assert.match(h.$('#modal-body').textContent,/does not show that you did not know/);assert.equal(h.$('#modal-body h2').getAttribute('dir'),'rtl');assert.equal(audited(h).at(-1).evidence.observation,'lookup');assert.equal(h.ui.projection().ledger.filter(r=>r.counted).length,0);h.assertActions();
  await h.click('[data-action="evidence-continue"]');assert.equal(h.$('#modal').open,false);unchanged(h,before);assert.deepEqual(h.errors,[]);
 }finally{h.close();}
});

test('a recognition response records exactly one bounded assessment and no production success',async()=>{
 const h=await setup();try{await h.display();const before=snapshot(h);await h.check('take-meaning');assert.equal(h.$('main').style.visibility,'hidden','Background prompts and prior support are concealed too');assert.equal(h.$('main').getAttribute('aria-hidden'),'true');assert.equal(h.$('.reader-body').style.visibility,'hidden');assert.equal(h.$('.reader-body').getAttribute('aria-hidden'),'true');assert.equal(h.$('#reader-text'),before.nodes[1].node);assert.ok(h.$('fieldset legend').textContent.trim());for(const input of h.w.document.querySelectorAll('input'))assert.ok(input.labels.length);h.choice(0);await h.click('[data-action="evidence-submit"]');
  assert.match(h.$('[role="status"].content-feedback').textContent,/Matched this authored answer/);const p=h.ui.projection(),row=p.ledger.find(r=>r.observation==='response');assert.equal(row.counted,true,JSON.stringify({at:row.at,now:p.now,assistance:row.assistance,exclusions:row.exclusionReasons}));assert.equal(row.dimension,'visual-recognition');assert.equal(row.practiceMode,'recognition');assert.equal(p.targets.filter(t=>t.directCounts.correct>0).length,1);assert.equal(p.targets.some(t=>t.dimension==='retrieval'),false);assert.equal(p.competence,null);assert.equal(responses(h).length,1);h.assertActions();
  await h.click('[data-action="evidence-continue"]');assert.equal(h.$('main').style.visibility,'');assert.equal(h.$('main').getAttribute('aria-hidden'),null);unchanged(h,before);assert.deepEqual(h.errors,[]);
 }finally{h.close();}
});

test('skip is a saved choice with no response, assessment, revealed answer or correctness count',async()=>{
 const h=await setup();try{await h.display();await h.check('take-meaning');await h.click('[data-action="evidence-skip"]');assert.match(h.$('.content-feedback').textContent,/Skipped, not graded/);const event=audited(h).at(-1);assert.equal(event.evidence.observation,'skipped');assert.equal(event.evidence.response,null);assert.equal(event.evidence.assessment,null);assert.equal(h.ui.projection().ledger.some(r=>r.counted),false);assert.equal(audited(h).some(e=>e.evidence.observation==='answer-revealed'),false);await h.click('[data-action="evidence-continue"]');assert.deepEqual(h.errors,[]);}finally{h.close();}
});

test('revealing an answer and retrying the same target never become unaided evidence',async()=>{
 const h=await setup();try{await h.display();await h.check('take-male');assert.equal(h.$('#evidence-answer').getAttribute('dir'),'auto');await h.click('[data-action="evidence-reveal"]');assert.equal(h.$('.model-answer').textContent,'خذ');h.answer('خذ');await h.click('[data-action="evidence-submit"]');let row=h.ui.projection().ledger.find(r=>r.observation==='response');assert.equal(row.assessment.correct,true);assert.equal(row.assisted,true);assert.equal(row.counted,false);assert.equal(row.assistance.answerShown,true);
  await h.click('[data-action="evidence-options"]');await h.click('[data-action="evidence-check"][data-key="take-male"]');h.answer('خذ');await h.click('[data-action="evidence-submit"]');const rows=h.ui.projection().ledger.filter(r=>r.observation==='response');assert.equal(rows.length,2);assert(rows.every(r=>!r.counted));assert.equal(rows[1].firstResponse,false);assert.equal(rows[1].assistance.feedbackShown,true);assert.equal(rows[0].episodeId,rows[1].episodeId);assert.deepEqual(h.errors,[]);
 }finally{h.close();}
});

test('a failed save freezes the first response and retries the same payload and ID',async()=>{
 let failed=false;const h=await setup({beforeSave:async r=>{if(!failed&&r.fields.evidence?.observation==='response'){failed=true;throw Error('Storage unavailable');}}});
 try{await h.display();await h.check('take-meaning');h.choice(0);await h.click('[data-action="evidence-submit"]');assert.match(h.$('[role="alert"]').textContent,/first response is preserved/);assert.equal(responses(h).length,0);for(const input of h.w.document.querySelectorAll('input[name="evidence-choice"]'))assert.equal(input.disabled,true);assert.equal(h.$('[data-action="evidence-skip"]'),null);
  // Even a changed DOM value cannot replace the already submitted first answer.
  h.choice(1);await h.click('[data-action="evidence-submit"]');const attempts=h.calls.remember.filter(r=>r.fields.evidence?.observation==='response');assert.equal(attempts.length,2);assert.equal(attempts[0].id,attempts[1].id);assert.deepEqual(attempts[0].fields,attempts[1].fields);assert.deepEqual(responses(h)[0].evidence.response,{choice:0});assert.equal(h.ui.projection().ledger.filter(r=>r.counted).length,1);assert.deepEqual(h.errors,[]);
 }finally{h.close();}
});

test('lost acknowledgement retries idempotently and never adds another assessment',async()=>{
 let lost=false;const h=await setup({afterSave:async r=>{if(!lost&&r.fields.evidence?.observation==='response'){lost=true;throw Error('Lost acknowledgement');}}});
 try{await h.display();await h.check('take-meaning');h.choice(0);await h.click('[data-action="evidence-submit"]');assert.equal(responses(h).length,1);assert.match(h.$('[role="alert"]').textContent,/Lost acknowledgement/);await h.click('[data-action="evidence-submit"]');assert.equal(responses(h).length,1);assert.equal(h.ui.projection().ledger.filter(r=>r.counted).length,1);assert.equal(new Set(audited(h).map(e=>e.id)).size,audited(h).length);assert.deepEqual(h.errors,[]);}finally{h.close();}
});

test('retrying a failed skip save never fabricates feedback or a revealed answer',async()=>{
 let failed=false;const h=await setup({beforeSave:async r=>{if(!failed&&r.fields.evidence?.observation==='skipped'){failed=true;throw Error('Storage unavailable');}}});
 try{await h.display();await h.check('take-meaning');await h.click('[data-action="evidence-skip"]');assert.match(h.$('[role="alert"]').textContent,/preserved/);await h.click('[data-action="evidence-submit"]');assert.match(h.$('.content-feedback').textContent,/Skipped, not graded/);assert.equal(audited(h).filter(e=>e.evidence.observation==='skipped').length,1);assert.equal(audited(h).filter(e=>e.evidence.observation==='answer-revealed').length,0,'No feedback was shown on the skipped result');assert.equal(h.ui.projection().ledger.some(r=>r.counted),false);assert.deepEqual(h.errors,[]);}finally{h.close();}
});

test('ledger replay and export preserve existing learning state and use semantic actor scope',async()=>{
 const h=await setup({user:{id:'alice'},tenantId:'team-one',backend:{evidenceEvents:true}});
 try{await h.display();await h.check('take-meaning');h.choice(0);await h.click('[data-action="evidence-submit"]');await h.click('[data-action="evidence-continue"]');const before=snapshot(h),events=clone(h.store.getEvents()),writes=h.calls.writes;await h.click('[data-action="evidence-replay"]');assert.match(h.$('#evidence-message').textContent,/without adding responses/);h.reorderActors=true;await h.click('[data-action="evidence-export"]');assert.equal(h.calls.downloads.length,1);const file=h.calls.downloads[0],data=JSON.parse(file.data);assert.equal(file.name,'nabu-evidence-ledger.json');assert.equal(file.type,'application/json');assert.equal(data.events.length,events.length,'Valid actor field order must not drop scoped records');assert.deepEqual(data.actor,{userId:'alice',tenantId:'team-one'});assert.equal(data.projection.competence,null);assert.equal(h.calls.writes,writes);unchanged(h,before);assert.deepEqual(h.errors,[]);
 }finally{h.close();}
});

test('changing intent invalidates an open check and restores the source without saving a response',async()=>{
 const h=await setup();try{await h.display();const before=snapshot(h);await h.check('take-male');h.answer('خذ');h.currentContext=context(null,null,2);h.w.dispatchEvent(new h.w.Event('nabu-intent-change'));assert.equal(h.$('#modal').open,false);assert.equal(responses(h).length,0);unchanged(h,before);await h.check('take-meaning');h.choice(0);await h.click('[data-action="evidence-submit"]');assert.equal(responses(h)[0].evidence.intentRef.revision,2);assert.deepEqual(h.errors,[]);}finally{h.close();}
});

test('account and team switches cannot reuse another actor or team’s ledger',async()=>{
 const h=await setup({user:{id:'alice'},tenantId:'team-one',backend:{evidenceEvents:true}});
 try{await h.display();await h.check('take-meaning');h.choice(0);await h.click('[data-action="evidence-submit"]');assert.equal(h.ui.projection().ledger.filter(r=>r.counted).length,1);
  h.currentContext=context('alice','team-two');h.w.dispatchEvent(new h.w.Event('nabu-intent-change'));assert.equal(h.$('#modal').open,false);assert.equal(h.ui.projection().ledger.length,0);await h.display();await h.click('[data-action="evidence-export"]');const teamTwo=JSON.parse(h.calls.downloads.at(-1).data);assert(teamTwo.events.every(e=>e.evidence.actor.tenantId==='team-two'));assert.equal(teamTwo.events.length,1);
  h.state.user={id:'bob'};h.currentContext=context('bob',null);await h.realStore.configure('bob');h.w.dispatchEvent(new h.w.Event('nabu-account-change'));assert.equal(h.ui.projection().ledger.length,0);assert.equal(h.$('#modal').open,false);assert.equal(h.meta.has('nabu.content.v1:alice'),true);assert.equal(h.store.getEvents().length,0);assert.deepEqual(h.errors,[]);
 }finally{h.close();}
});

test('a locked account omits evidence controls even when the server supports them',async()=>{
 const h=await setup({accountHint:'alice',backend:{evidenceEvents:true}});
 try{assert.equal(h.ui.enabled(),false);assert.equal(h.ui.panel(),'');assert.equal(h.$('[data-action="evidence-options"]'),null);assert.equal(h.calls.writes,0);assert.equal(h.store.getState().owner,'!locked');}finally{h.close();}
});

test('an imported future record cannot advance local response timestamps or supply current evidence',async()=>{
 const h=await setup();try{await h.display();await h.check('take-meaning');h.choice(0);await h.click('[data-action="evidence-submit"]');await h.click('[data-action="evidence-continue"]');
  const future=clone(responses(h)[0]);future.id='imported-future-record-0001';future.at=2000000;future.sessionId='imported-future-episode-0001';future.evidence.episodeId=future.sessionId;future.evidence.attemptId='imported-future-attempt-0001';future.evidence.presentedAt=future.at-100;
  await h.realStore.append(item,'evidence',{sessionId:future.sessionId,evidence:future.evidence,at:future.at},future.id);
  assert.equal(h.ui.projection().ledger.find(r=>r.eventId===future.id).counted,false);await h.check('open-meaning');h.choice(1);await h.click('[data-action="evidence-submit"]');const local=responses(h).find(e=>e.evidence.taskRef.id==='contrast:open-meaning');assert(local.at<future.at);assert.equal(h.ui.projection().ledger.find(r=>r.eventId===local.id).counted,true);assert.equal(h.ui.projection().ledger.find(r=>r.eventId===future.id).counted,false);assert.deepEqual(h.errors,[]);
 }finally{h.close();}
});

test('a pending context-help save cannot reopen the old intention’s modal after a scope change',async()=>{
 const gate=deferred();let pending=false;const h=await setup({beforeSave:async r=>{if(r.fields.evidence?.observation==='lookup'){pending=true;await gate.promise;}}});
 try{await h.display();h.startClick('[data-action="evidence-help"]');await until(()=>pending,'context-help save');h.currentContext=context(null,null,2);h.w.dispatchEvent(new h.w.Event('nabu-intent-change'));gate.resolve();await h.settle();assert.equal(h.$('#modal').open,false,'An obsolete async help action must not reopen its dialog');assert.equal(h.$('.evidence-dialog'),null);assert.equal(audited(h).filter(e=>e.evidence.observation==='lookup').length,1,'The original accepted action retains its original provenance');assert.equal(audited(h).at(-1).evidence.intentRef.revision,1);}finally{h.close();}
});

test('the complete optional contrast episode retains separate meanings, conditions and assisted status',async()=>{
 const h=await setup();try{await h.display();const before=snapshot(h);
  for(const [key,answer] of [['take-meaning',0],['take-female','خذي'],['open-meaning',1],['open-female','افتحي'],['phrase-now','خذي وقتك']]){await h.check(key);const task=Tasks.contrastTask(key);if(task.options)h.choice(answer);else h.answer(answer);await h.click('[data-action="evidence-submit"]');assert.match(h.$('.content-feedback').textContent,/Matched this authored answer/);await h.click('[data-action="evidence-continue"]');}
  const p=h.ui.projection(),rows=p.ledger.filter(r=>r.observation==='response');assert.equal(rows.length,5);assert.equal(rows.find(r=>r.taskRef.id==='contrast:take-female').assistance.baseMeaningSupplied,true);assert.equal(rows.find(r=>r.taskRef.id==='contrast:take-female').counted,false);assert.equal(rows.filter(r=>r.counted).length,4);assert.equal(new Set(rows.map(r=>r.target.id)).size,5);assert.equal(p.competence,null);assert.equal(p.targets.some(t=>t.target.id.includes('unseen')),false);
  await h.click('[data-action="evidence-options"]');assert.equal(h.$('[data-action="evidence-check"][data-key="phrase-later"]'),null,'A delayed check cannot be offered immediately');await h.click('[data-action="evidence-continue"]');unchanged(h,before);assert.deepEqual(h.errors,[]);
 }finally{h.close();}
});

test('no-practice still hides authored comparisons on an early help-only branch and blocks a stale check action',async()=>{
 const h=await setup();try{
  await h.display();await h.check('take-meaning');h.choice(1);await h.click('[data-action="evidence-submit"]');
  assert.equal(h.ui.projection().ledger.find(r=>r.observation==='response').assessment.correct,false);
  await h.click('[data-action="evidence-options"]');const stale=h.$('#modal [data-action="evidence-check"][data-key="take-female"]');assert.ok(stale,'The comparison existed before the preference changed');
  assert.equal(h.ui.policy().candidates.some(c=>c.kind==='check'),false,'This is the early help-only policy branch');
  const changed=h.currentContext,previous=changed.immediateIntent;changed.immediateIntent=Intent.validateIntentRecord({...previous,...Intent.editIntentContent(previous,{preferences:['no-practice']}),revision:previous.revision+1,updatedAt:previous.updatedAt+1});h.currentContext=changed;h.w.dispatchEvent(new h.w.Event('nabu-intent-change'));
  await h.click('[data-action="evidence-options"]');assert.equal(h.ui.policy().constraints.practiceExcluded,true);assert.equal(h.$('#modal [data-action="evidence-check"]'),null);assert.match(h.$('#modal-body').textContent,/preference excludes practice/);
  assert.throws(()=>h.actions['evidence-check'](stale),/excludes practice/);assert.equal(h.$('#modal .evidence-check'),null);assert.equal(responses(h).length,1);assert.equal(h.$('.reader-body').style.visibility,'');assert.deepEqual(h.errors,[]);
 }finally{h.close();}
});

test('an inferred no-practice preference remains unconfirmed and does not block optional checks',async()=>{
 const h=await setup();try{
  const changed=h.currentContext,previous=changed.immediateIntent,content=Intent.editIntentContent(previous,{preferences:['no-practice']});
  content.provenance.fields.preferences={status:'inferred',source:'provider'};
  changed.immediateIntent=Intent.validateIntentRecord({...previous,...content,revision:previous.revision+1,updatedAt:previous.updatedAt+1});h.currentContext=changed;h.w.dispatchEvent(new h.w.Event('nabu-intent-change'));
  await h.display();assert.equal(h.ui.policy().constraints.practiceExcluded,false);assert.equal(h.currentContext.immediateIntent.provenance.fields.preferences.status,'inferred');
  await h.click('[data-action="evidence-options"]');assert.ok(h.$('#modal [data-action="evidence-check"][data-key="take-meaning"]'));assert.doesNotMatch(h.$('#modal-body').textContent,/stated preference excludes practice/);
  await h.click('#modal [data-action="evidence-check"][data-key="take-meaning"]');assert.ok(h.$('#modal .evidence-check'));assert.equal(responses(h).length,0);assert.equal(h.ui.projection().ledger.some(row=>row.counted),false);assert.deepEqual(h.errors,[]);
 }finally{h.close();}
});

test('a recent reopen resumes the episode and its feedback without creating fresh unaided evidence',async()=>{
 const h=await setup();try{
  await h.display();await h.check('take-meaning');h.choice(0);await h.click('[data-action="evidence-submit"]');await h.click('[data-action="evidence-continue"]');
  const original=responses(h)[0],originalEpisode=original.evidence.episodeId;assert.equal(h.ui.projection().ledger.filter(row=>row.counted).length,1);
  h.ui.reset();await h.display();assert.equal(audited(h).at(-1).evidence.episodeId,originalEpisode,'A fresh UI episode state recovers the recent stored episode');
  await h.check('take-meaning');h.choice(0);await h.click('[data-action="evidence-submit"]');await h.click('[data-action="evidence-continue"]');
  let projection=h.ui.projection(),rows=projection.ledger.filter(row=>row.observation==='response');assert.equal(rows.length,2);assert.equal(rows[1].episodeId,originalEpisode);assert.equal(rows[1].firstResponse,false);assert.equal(rows[1].assistance.feedbackShown,true);assert.equal(rows[1].assistance.answerShown,true);assert.equal(rows[1].counted,false);assert.equal(rows.filter(row=>row.counted).length,1);
  assert.equal(EPISODE_RESUME_MS,30*60*1000);h.clock=Math.max(...h.store.getEvents().map(event=>event.at))+EPISODE_RESUME_MS+1;h.ui.reset();await h.display();
  const laterEpisode=audited(h).at(-1).evidence.episodeId;assert.notEqual(laterEpisode,originalEpisode,'A later visit may start a distinct episode');
  await h.check('take-meaning');h.choice(0);await h.click('[data-action="evidence-submit"]');
  projection=h.ui.projection();rows=projection.ledger.filter(row=>row.observation==='response');assert.equal(rows.length,3);assert.equal(rows[2].episodeId,laterEpisode);assert.equal(rows[2].firstResponse,true);assert.equal(rows[2].counted,true);assert.equal(rows.filter(row=>row.counted).length,2);assert.equal(projection.independenceEstablished,false);assert(projection.targets.every(target=>target.independenceEstablished===false),'A separate visit still does not establish statistical independence');assert.equal(projection.competence,null);assert.deepEqual(h.errors,[]);
 }finally{h.close();}
});
