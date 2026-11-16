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
import * as LearnerTasks from '../public/nabu-learner-tasks.js';

const {JSDOM,VirtualConsole}=await import(process.env.NABU_TEST_JSDOM?pathToFileURL(process.env.NABU_TEST_JSDOM).href:'jsdom');
const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
const item=Content.itemById('a-little-later');
async function until(predicate,label='condition'){
 for(let n=0;n<1200;n++){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,10));}
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
 try{await until(()=>startupFinished&&$('[data-action="intent-toggle"]')&&!$('[data-action="intent-toggle"]').disabled&&d.querySelectorAll('.content-card').length===6,'shipping Explore startup');h.assertNoErrors();return h;}catch(error){error.message+='; '+failures.join('; ');h.close();throw error;}
}

async function openLearner(h){
 h.click('[data-action="learner-open"]');h.$('#learner-language').value='ar';h.$('#learner-language').dispatchEvent(new h.w.Event('change',{bubbles:true}));
 h.$('#learner-goal').value='learner:ar:write:retrieval';h.click('[data-action="learner-request"]');
 try { await until(()=>h.$('.learner-options')&&!h.$('[data-action="learner-update"]').disabled,'shipping Bayesian fit and decision'); } catch(error) { error.message+='; '+h.$('#learner-error')?.textContent+'; '+h.failures.join('; '); throw error; }
 h.assertNoErrors();
}
async function learnerExport(h){
 const n=h.downloads.length;h.click('[data-action="learner-export"]');await until(()=>h.downloads.length===n+1,'learner model export');
 const file=h.downloads.at(-1);assert.equal(file.name,'nabu-learner-model-record.json');return JSON.parse(await file.blob.text());
}
test('shipping app fits, decides, records a real task, refits and exports the exact scoped calculation',async()=>{
 const h=await boot();try{
  await h.open();const source=h.$('#reader-text'),text=source.textContent,before=h.snapshot(),requests=h.requests.length;
  await openLearner(h);const prior=await learnerExport(h);assert.equal(prior.fit.diagnostics.inferenceStatus,'prior-only');
  h.click('[data-action="learner-try-goal"]');await until(()=>h.$('#learner-answer')&&!h.$('[data-action="learner-submit"]').disabled,'task presentation saved');
  assert.equal(h.$('main').style.visibility,'hidden');h.input('#learner-answer',LearnerTasks.learnerTask('learner:ar:write:retrieval').accepted[0]);h.click('[data-action="learner-submit"]');
  await until(()=>h.$('.learner-check .content-feedback')&&!h.$('[data-action="learner-results"]').disabled,'posterior after actual answer');
  h.click('[data-action="learner-results"]');const result=await learnerExport(h);assert.equal(result.input.observations.length,1);assert.equal(result.fit.dataSummary.currentObservations,1);
  const event=result.events.find(e=>e.evidence?.observation==='response');assert(event);assert.equal(event.evidence.actor.userId,null);assert.equal(event.evidence.actor.tenantId,null);
  assert.equal(result.input.observations[0].id,event.id);assert.equal(result.input.projection.competence,null);assert(result.decision.candidates.length>1);
  assert.equal(h.$('#reader-text'),source);assert.equal(source.textContent,text);assert.equal(h.$('main').style.visibility,'');
  assert.deepEqual(h.snapshot().cards,before.cards);assert.deepEqual(h.snapshot().logs,before.logs);assert.equal(h.requests.length,requests,'Local fitting makes no provider calls');h.assertNoErrors();
 }finally{h.close();}
});
test('shipping reveal, response and retry stay out of unassisted inference',async()=>{
 const h=await boot();try{
  await openLearner(h);h.click('[data-action="learner-try-goal"]');await until(()=>h.$('#learner-answer')&&!h.$('[data-action="learner-submit"]').disabled,'task');
  h.click('[data-action="learner-reveal"]');await until(()=>h.$('.model-answer'),'revealed answer');h.input('#learner-answer','مكتوب');h.click('[data-action="learner-submit"]');
  await until(()=>h.$('.learner-check .content-feedback')&&!h.$('[data-action="learner-results"]').disabled,'assisted feedback');h.click('[data-action="learner-results"]');
  let exported=await learnerExport(h);assert.equal(exported.input.observations.length,0);assert.equal(exported.events.filter(e=>e.evidence?.observation==='response').length,1);
  h.click('[data-action="learner-try-goal"]');await until(()=>h.$('#learner-answer')&&!h.$('[data-action="learner-submit"]').disabled,'repeat task');h.input('#learner-answer','مكتوب');h.click('[data-action="learner-submit"]');
  await until(()=>h.$('.learner-check .content-feedback')&&!h.$('[data-action="learner-results"]').disabled,'repeat feedback');h.click('[data-action="learner-results"]');
  exported=await learnerExport(h);assert.equal(exported.input.observations.length,0);const responses=exported.events.filter(e=>e.evidence?.observation==='response');assert.equal(responses.length,2);assert.equal(responses[0].evidence.episodeId,responses[1].evidence.episodeId);h.assertNoErrors();
 }finally{h.close();}
});
