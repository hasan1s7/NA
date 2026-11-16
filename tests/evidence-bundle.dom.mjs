/** Executes the actual built public/index.html and its real event handlers.
 * jsdom and the in-memory IndexedDB fixture verify wiring and transactions;
 * they do not verify disk durability, layout, audio or assistive technology.
 * Rebuild the shipping bundle before this suite.
 * NABU_TEST_JSDOM=/absolute/path/to/jsdom/lib/api.js node --test tests/evidence-bundle.dom.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {installIDBFixture} from './idb-fixture.js';
import * as Content from '../public/nabu-content.js';
import * as Tasks from '../public/nabu-evidence-tasks.js';

const {JSDOM,VirtualConsole}=await import(process.env.NABU_TEST_JSDOM?pathToFileURL(process.env.NABU_TEST_JSDOM).href:'jsdom');
const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
const item=Content.itemById('a-little-later');
async function until(predicate,label='condition'){
 for(let n=0;n<400;n++){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,10));}
 throw Error('Timed out: '+label);
}

async function boot(){
 const failures=[],requests=[],writes=[],downloads=[],blobs=new Map();let startupFinished=false,failContentWrite=null;
 const console=new VirtualConsole();
 console.on('jsdomError',error=>{if(error.message!=='Could not parse CSS stylesheet')failures.push(error.stack||error.message);});
 console.on('error',(...args)=>failures.push(args.map(value=>value?.stack||String(value)).join(' ')));
 const dom=new JSDOM(html,{url:'https://nabu.invalid/explore',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:console,beforeParse(w){
  w.structuredClone=structuredClone;w.Response=Response;w.AbortController=AbortController;w.TextEncoder=TextEncoder;w.Blob=Blob;
  const setInterval=w.setInterval.bind(w);w.setInterval=(fn,delay,...args)=>{if(delay===15000)startupFinished=true;return setInterval(fn,delay,...args);};
  w.fetch=async(input,options={})=>{requests.push({url:String(input),method:options.method||'GET',body:options.body||null});return new Response(JSON.stringify({detail:'Offline fixture'}),{status:503,headers:{'Content-Type':'application/json'}});};
  w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});w.scrollTo=()=>{};w.scrollBy=()=>{};
  const fixture=installIDBFixture(w),open=w.indexedDB.open.bind(w.indexedDB);let wrapped=false;
  w.indexedDB.open=(...args)=>{
   const request=open(...args),db=request.result;
   if(!wrapped){wrapped=true;const transaction=db.transaction.bind(db);db.transaction=(...params)=>{
    const tr=transaction(...params),objectStore=tr.objectStore.bind(tr);tr.objectStore=name=>{
     const store=objectStore(name);if(name==='meta'){const put=store.put.bind(store);store.put=value=>{
      if(value.id==='nabu.content.v1:guest'){
       const saved=structuredClone(value.value);writes.push(saved);
       if(failContentWrite?.(saved)){failContentWrite=null;fixture.failNextWrite();}
      }
      return put(value);
     };}return store;
    };return tr;
   };}return request;
  };
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
  w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
  w.URL.createObjectURL=blob=>{const url='blob:nabu-fixture/'+blobs.size;blobs.set(url,blob);return url;};w.URL.revokeObjectURL=url=>blobs.delete(url);
  const click=w.HTMLAnchorElement.prototype.click;w.HTMLAnchorElement.prototype.click=function(){if(this.download){downloads.push({name:this.download,blob:blobs.get(this.href)});return;}click.call(this);};
  w.addEventListener('error',event=>failures.push(event.error?.stack||event.message));w.addEventListener('unhandledrejection',event=>failures.push(event.reason?.stack||String(event.reason)));
 }});
 const w=dom.window,d=w.document,$=selector=>d.querySelector(selector);
 const h={dom,w,d,$,failures,requests,writes,downloads,
  click(selector){const el=$(selector);assert.ok(el,'Missing control: '+selector);assert.notEqual(el.disabled,true,'Disabled control: '+selector);el.click();},
  input(selector,value){const el=$(selector);assert.ok(el,'Missing input: '+selector);el.value=value;el.dispatchEvent(new w.Event('input',{bubbles:true}));},
  choice(name,value){const el=$(`#modal input[name="${name}"][value="${value}"]`);assert.ok(el);assert.notEqual(el.disabled,true);el.checked=true;el.dispatchEvent(new w.Event('change',{bubbles:true}));},
  snapshot(){return w.__idbFixture.snapshot();},
  events(){return this.snapshot().meta.find(record=>record.id==='nabu.content.v1:guest')?.value.events||[];},
  responses(){return this.events().filter(event=>event.evidence?.observation==='response');},
  failWriteWhen(predicate){failContentWrite=predicate;},
  async open(){this.click('[data-action="open-content"][data-id="a-little-later"]');await until(()=>$('#reader-text')&&this.events().some(e=>e.kind==='opened'&&e.evidence?.observation==='displayed'),'actual reader and audited opening');assert.ok($('#evidence-ledger-content'));},
  async saveIntent(){
   this.click('[data-action="intent-toggle"]');this.input('#intent-text','I want to understand this Arabic dialogue.');$('#intent-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
   await until(()=>$('.intent-headline')?.textContent.includes('Arabic dialogue')&&$('#intent-controls')?.hidden,'saved guest intention');
   return this.snapshot().meta.find(record=>record.id==='nabu.intent.v1:guest').value.intents[0];
  },
  async practice(activityId='p1'){
   this.click('[data-action="content-practice"]');await until(()=>$('#modal').open&&$('.content-practice'),'existing practice');
   if(activityId!=='p1'){this.click(`#modal [data-action="content-task"][data-id="${activityId}"]`);await until(()=>$('#content-answer'),'recall task');}
  },
  async check(key){
   if($('#modal').open)this.click('#modal [data-action="evidence-options"]');else this.click('.evidence-options [data-action="evidence-options"]');
   await until(()=>$('#modal .evidence-dialog'),'actual check options');this.click(`#modal [data-action="evidence-check"][data-key="${key}"]`);await until(()=>$('#modal .evidence-check'),'actual contrast task');
  },
  async export(){
   const count=downloads.length;this.click('[data-action="evidence-export"]');await until(()=>downloads.length===count+1,'actual evidence export');const file=downloads.at(-1);assert.equal(file.name,'nabu-evidence-ledger.json');assert.ok(file.blob);return JSON.parse(await file.blob.text());
  },
  assertNoErrors(){assert.deepEqual(failures,[],'Shipping JavaScript errors');},
  close(){w.close();}
 };
 try{await until(()=>startupFinished&&$('[data-action="intent-toggle"]')&&!$('[data-action="intent-toggle"]').disabled&&d.querySelectorAll('.content-card').length===6,'shipping Explore startup');h.assertNoErrors();return h;}catch(error){h.close();throw error;}
}
function sourceSnapshot(h){const node=h.$('#reader-text');assert.ok(node);return {node,text:node.textContent,dir:node.getAttribute('dir')};}
function assertSource(h,before){assert.equal(h.$('#reader-text'),before.node);assert.equal(before.node.textContent,before.text);assert.equal(before.node.getAttribute('dir'),before.dir);}
function learning(h){const {cards,logs}=h.snapshot();return {cards,logs};}
async function feedbackReady(h){await until(()=>h.$('#modal .content-feedback')&&!h.$('#modal [data-action="check-content-answer"]')&&!h.$('#modal [data-action="evidence-submit"]'),'saved response feedback');}

test('shipping legacy practice stores one response with an envelope and separate feedback, preserving intent and media',async()=>{
 const h=await boot();try{
  const intent=await h.saveIntent();await h.open();const source=sourceSnapshot(h),before=learning(h),requests=h.requests.length;
  assert.equal(source.dir,'rtl');await h.practice();h.choice('content-choice',item.practice[0].answer);h.click('#modal [data-action="check-content-answer"]');await feedbackReady(h);
  const responses=h.responses();assert.equal(responses.length,1);const response=responses[0];assert.equal(response.kind,'attempt');assert.equal(response.activityId,'p1');assert.equal(response.evidence.taskRef.id,'catalog:a-little-later:p1');assert.equal(response.choice,response.evidence.response.choice);assert.deepEqual(response.evidence.actor,{userId:null,tenantId:null});assert.deepEqual(response.evidence.intentRef,{id:intent.id,revision:intent.revision});assert.equal(response.evidence.organizationObjectiveRef,null);assert(response.at>=response.evidence.presentedAt);
  assert.equal(h.events().filter(e=>e.kind==='evidence'&&e.evidence.observation==='response').length,0,'The legacy attempt is the sole response record');
  const feedback=h.events().filter(e=>e.evidence?.observation==='answer-revealed'&&e.evidence.assistance.feedbackShown);assert.equal(feedback.length,1);assert.equal(feedback[0].evidence.attemptId,response.evidence.attemptId);assert(feedback[0].at>response.at);
  h.click('#modal [data-action="practice-return"]');await until(()=>!h.$('#modal').open,'return to source');const exported=await h.export(),row=exported.projection.ledger.find(r=>r.eventId===response.id);
  assert.equal(row.counted,true);assert.equal(row.assisted,false);assert.equal(row.assessment.correct,true);assert.equal(exported.projection.competence,null);assert.equal(exported.projection.ledger.filter(r=>r.observation==='response').length,1);
  assertSource(h,source);assert.deepEqual(learning(h),before);assert.equal(h.requests.length,requests);h.assertNoErrors();
 }finally{h.close();}
});

test('shipping lookup, translation, hint and reveal remain assistance on the single legacy recall attempt',async()=>{
 const h=await boot();try{
  await h.open();const source=sourceSnapshot(h),before=learning(h),requests=h.requests.length;
  const annotation=[...h.d.querySelectorAll('.reader-token.annotated')].find(el=>el.textContent==='خذي وقتك');assert.ok(annotation);annotation.click();await until(()=>h.events().some(e=>e.evidence?.observation==='lookup'&&e.evidence.occurrence.annotationId==='a3'),'authored annotation lookup');
  h.$('.content-translation').open=true;await until(()=>h.events().some(e=>e.evidence?.assistance.translationShown),'translation disclosure observation');
  await h.practice('p2');h.click('#modal [data-action="content-hint"]');await until(()=>h.events().some(e=>e.kind==='help'&&e.help==='hint')&&!h.$('#modal [data-action="content-reveal"]')?.disabled,'persisted hint');
  h.click('#modal [data-action="content-reveal"]');await until(()=>h.events().some(e=>e.kind==='help'&&e.help==='answer')&&!h.$('#modal [data-action="check-content-answer"]')?.disabled,'persisted reveal');
  h.input('#content-answer',item.practice[1].accepted[0]);h.click('#modal [data-action="check-content-answer"]');await feedbackReady(h);assert.match(h.$('.content-feedback').textContent,/Matched with help/);
  const responses=h.responses();assert.equal(responses.length,1);const response=responses[0];assert.equal(response.kind,'attempt');assert.equal(response.assisted,true);
  for(const flag of ['lookup','translationShown','hint','answerShown','sourceVisible'])assert.equal(response.evidence.assistance[flag],true,flag);
  h.click('#modal [data-action="practice-return"]');await until(()=>!h.$('#modal').open,'return after assistance');const exported=await h.export(),row=exported.projection.ledger.find(r=>r.eventId===response.id);
  assert.equal(row.counted,false);assert.equal(row.assisted,true);assert.equal(row.assessment.correct,true);assert.equal(row.dimension,'retrieval');assert.equal(row.practiceMode,'production');
  for(const help of h.events().filter(e=>e.kind==='help'))assert(row.assistanceSourceIds.includes(help.id));
  assertSource(h,source);assert.deepEqual(learning(h),before);assert.equal(h.requests.length,requests);h.assertNoErrors();
 }finally{h.close();}
});

test('shipping authored contrast episode uses real controls and exports separate bounded targets without automatic enrollment',async()=>{
 const h=await boot();try{
  await h.open();const source=sourceSnapshot(h),before=learning(h),requests=h.requests.length;
  for(const key of ['take-meaning','take-female','open-meaning','open-female','phrase-now']){
   await h.check(key);assert.equal(h.$('main').style.visibility,'hidden','The footer answer and prior support are concealed with the source');assert.equal(h.$('main').getAttribute('aria-hidden'),'true');assert.equal(h.$('.reader-body').style.visibility,'hidden');assert.equal(h.$('.reader-body').getAttribute('aria-hidden'),'true');assertSource(h,source);
   const task=Tasks.contrastTask(key);if(task.options)h.choice('evidence-choice',task.answer);else h.input('#evidence-answer',task.accepted[0]);
   h.click('#modal [data-action="evidence-submit"]');await feedbackReady(h);assert.match(h.$('#modal .content-feedback').textContent,/Matched this authored answer/);
  }
  h.click('#modal [data-action="evidence-options"]');await until(()=>h.$('#modal .evidence-dialog'),'post-episode options');assert.equal(h.$('#modal [data-action="evidence-check"][data-key="phrase-later"]'),null,'A delayed check is not silently treated as immediate practice');
  h.click('#modal [data-action="evidence-continue"]');await until(()=>!h.$('#modal').open,'continue from contrast checks');assert.equal(h.$('main').style.visibility,'');assert.equal(h.$('main').getAttribute('aria-hidden'),null);assert.equal(h.$('.reader-body').style.visibility,'');assert.equal(h.$('.reader-body').getAttribute('aria-hidden'),null);
  const exported=await h.export(),rows=exported.projection.ledger.filter(r=>r.observation==='response');assert.equal(rows.length,5);assert(h.responses().every(e=>e.kind==='evidence'));assert.equal(h.events().filter(e=>e.kind==='attempt').length,0);
  assert.equal(rows.filter(r=>r.counted).length,4);const supported=rows.find(r=>r.taskRef.id==='contrast:take-female');assert.equal(supported.assistance.baseMeaningSupplied,true);assert.equal(supported.counted,false);assert.equal(new Set(rows.map(r=>r.target.id)).size,5);assert.equal(rows.find(r=>r.taskRef.id==='contrast:phrase-now').practiceMode,'cloze');assert.equal(exported.projection.competence,null);
  assertSource(h,source);assert.deepEqual(learning(h),before);assert.equal(h.requests.length,requests);h.assertNoErrors();
 }finally{h.close();}
});

test('shipping legacy first response stays frozen after a failed write and an identical retry',async()=>{
 const h=await boot();try{
  await h.open();const source=sourceSnapshot(h),before=learning(h);await h.practice('p2');h.input('#content-answer','An authored incorrect first response');
  h.failWriteWhen(data=>data.events.some(e=>e.kind==='attempt'));h.click('#modal [data-action="check-content-answer"]');await until(()=>h.$('.content-practice-error')?.textContent.includes('Simulated storage write failure'),'reported write failure');
  assert.equal(h.responses().length,0);const failed=h.writes.flatMap(x=>x.events).find(e=>e.kind==='attempt');assert.ok(failed);assert.equal(h.$('#content-answer').disabled,true);assert.equal(h.$('#modal [data-action="skip-content-answer"]').disabled,true);assert.equal(h.$('#modal [data-action="content-hint"]'),null);
  // Even a programmatic change to the disabled field cannot rewrite the frozen response.
  h.input('#content-answer',item.practice[1].accepted[0]);h.click('#modal [data-action="check-content-answer"]');await feedbackReady(h);
  const responses=h.responses();assert.equal(responses.length,1);assert.equal(responses[0].id,failed.id);assert.equal(responses[0].at,failed.at);assert.equal(responses[0].answer,'An authored incorrect first response');assert.equal(responses[0].evidence.response.answer,responses[0].answer);assert.match(h.$('.content-feedback').textContent,/Not the authored answer yet/);
  h.click('#modal [data-action="practice-return"]');await until(()=>!h.$('#modal').open,'return after retry');assertSource(h,source);assert.deepEqual(learning(h),before);h.assertNoErrors();
 }finally{h.close();}
});

test('shipping feedback delivery failure retries the committed attempt without adding another response',async()=>{
 const h=await boot();try{
  await h.open();const source=sourceSnapshot(h),before=learning(h);await h.practice();h.choice('content-choice',item.practice[0].answer);
  h.failWriteWhen(data=>data.events.some(e=>e.kind==='evidence'&&e.evidence?.observation==='answer-revealed'&&e.evidence.assistance.feedbackShown));
  h.click('#modal [data-action="check-content-answer"]');await until(()=>h.$('.content-practice-error')?.textContent.includes('Simulated storage write failure'),'feedback write failure');
  assert.equal(h.responses().length,1);const original=structuredClone(h.responses()[0]);assert.equal(h.events().filter(e=>e.evidence?.observation==='answer-revealed').length,0);assert.equal(h.$('input[name="content-choice"]').disabled,true);
  h.click('#modal [data-action="check-content-answer"]');await feedbackReady(h);assert.deepEqual(h.responses(),[original]);const feedback=h.events().filter(e=>e.evidence?.observation==='answer-revealed');assert.equal(feedback.length,1);assert.equal(feedback[0].evidence.attemptId,original.evidence.attemptId);assert(feedback[0].at>original.at);
  h.click('#modal [data-action="practice-return"]');await until(()=>!h.$('#modal').open,'return after feedback retry');const exported=await h.export();assert.equal(exported.projection.ledger.filter(r=>r.observation==='response').length,1);assert.equal(exported.projection.ledger.find(r=>r.eventId===original.id).counted,true);assertSource(h,source);assert.deepEqual(learning(h),before);h.assertNoErrors();
 }finally{h.close();}
});
