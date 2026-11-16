/** Optional shipping-bundle integration tests. These execute the self-contained
 * public/index.html, its real UI handlers and its existing IndexedDB adapters.
 * jsdom is a test tool only; the IndexedDB fixture is in memory. This suite does
 * not verify native persistence, layout, media playback or assistive technology.
 * Rebuild index.html before running after source edits.
 * Run: NABU_TEST_JSDOM=/absolute/path/to/jsdom/lib/api.js node --test tests/next-step-bundle.dom.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {installIDBFixture} from './idb-fixture.js';

const {JSDOM,VirtualConsole}=await import(process.env.NABU_TEST_JSDOM?pathToFileURL(process.env.NABU_TEST_JSDOM).href:'jsdom');
const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
const mama='I want to meet my girlfriend Alexandra’s Mexican mother and make a good impression.';

async function until(predicate,label='condition'){
 for(let i=0;i<300;i++){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,10));}
 throw Error('Timed out: '+label);
}

async function boot(){
 const failures=[],requests=[],events=[];
 let startupFinished=false;
 const vc=new VirtualConsole();
 vc.on('jsdomError',error=>{
  // jsdom cannot parse all of the shipping CSS. No script error is suppressed.
  if(error.message==='Could not parse CSS stylesheet')return;
  failures.push(error.stack||error.message);
 });
 vc.on('error',(...args)=>failures.push(args.map(value=>value?.stack||String(value)).join(' ')));
 const dom=new JSDOM(html,{url:'https://nabu.invalid/explore',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
  w.structuredClone=structuredClone;w.Response=Response;w.AbortController=AbortController;
  // The existing app registers its passive refresh only after account checking
  // and restoring the initial URL. Observe that boundary instead of sleeping or
  // clicking during a second startup render. All intervals still run normally.
  const setInterval=w.setInterval.bind(w);
  w.setInterval=(fn,delay,...args)=>{if(delay===15000)startupFinished=true;return setInterval(fn,delay,...args);};
  w.fetch=async(input,options={})=>{
   requests.push({url:String(input),method:options.method||'GET',body:options.body||null});
   return new Response(JSON.stringify({detail:'Offline test'}),{status:503,headers:{'Content-Type':'application/json'}});
  };
  w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
  w.scrollTo=()=>{};w.scrollBy=()=>{};
  installIDBFixture(w);
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
  w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
  w.addEventListener('error',event=>failures.push(event.error?.stack||event.message));
  w.addEventListener('unhandledrejection',event=>failures.push(event.reason?.stack||String(event.reason)));
  w.addEventListener('nabu-next-step',event=>events.push(structuredClone(event.detail)));
 }});
 const w=dom.window,d=w.document,$=selector=>d.querySelector(selector);
 const h={dom,w,d,$,failures,requests,events,
  click(selector){const el=$(selector);assert.ok(el,'Missing control: '+selector);assert.notEqual(el.disabled,true,'Disabled control: '+selector);el.click();},
  input(selector,value){const el=$(selector);assert.ok(el,'Missing input: '+selector);if(el.type==='checkbox')el.checked=value;else el.value=value;el.dispatchEvent(new w.Event('input',{bubbles:true}));},
  snapshot(){return w.__idbFixture.snapshot();},
  contentEvents(){return this.snapshot().meta.find(record=>record.id==='nabu.content.v1:guest')?.value.events||[];},
  async request(){
   const count=events.filter(event=>event.phase==='shown').length;
   this.click('[data-action="next-step-request"]');
   await until(()=>$('#next-step-error')?.textContent||(events.filter(event=>event.phase==='shown').length===count+1&&$('#nabu-next-step-panel')?.getAttribute('aria-busy')==='false'),'shipping suggestion');
   assert.equal($('#next-step-error')?.textContent,'');
  },
  assertNoErrors(){assert.deepEqual(failures,[],'The shipping bundle must not report JavaScript errors');},
  close(){w.close();}
 };
 try{
  await until(()=>startupFinished&&$('#nabu-next-step-panel')&&$('#nabu-intent-panel')&&$('[data-action="intent-toggle"]')&&!$('[data-action="intent-toggle"]').disabled,'shipping Explore controls');
  assert.equal(d.documentElement.dataset.nabuBuild,'nabu-pages-1.17-20261116-r3','Use the current self-contained graph and learner integration build');
  assert.equal(d.querySelectorAll('.content-card').length,6,'Boot the real curated catalogue');
  h.assertNoErrors();return h;
 }catch(error){try{h.assertNoErrors();}finally{h.close();}throw error;}
}

function learningSnapshot(h){const {cards,logs}=h.snapshot();return {cards,logs};}
function assertNoLearningWrites(h,before){
 assert.deepEqual(learningSnapshot(h),before,'Asking for or opening support must not add cards, alter schedules or record a self-rating');
 assert.deepEqual(h.contentEvents().filter(event=>event.kind==='attempt'||event.kind==='help'),[],'Opening support or optional practice must not fabricate practice evidence');
 h.assertNoErrors();
}
function readerSnapshot(h){const node=h.$('#reader-text');assert.ok(node);return {node,text:node.textContent};}
function assertReaderPreserved(h,before){assert.equal(h.$('#reader-text'),before.node,'Keep the original reader node');assert.equal(before.node.textContent,before.text,'Keep the complete source text');}
async function openManualReader(h,text){
 h.click('[data-action="open-own-reader"]');await until(()=>h.$('#reader-input'),'manual reader intake');
 assert.equal(h.$('#source-language').value,'en');assert.equal(h.$('#target-language').value,'es');
 h.input('#reader-input',text);h.click('[data-action="read-text"]');
 await until(()=>h.$('#reader-text')?.textContent===text,'manual source text');
}

test('shipping Explore: mamá intent with explicit Spanish opens the existing greeting and returns without learning writes',async()=>{
 const h=await boot();try{
  const before=learningSnapshot(h);
  h.click('[data-action="intent-toggle"]');h.input('#intent-text',mama);
  h.input('input[name="languages"][value="es"]',true);
  h.$('#intent-form').dispatchEvent(new h.w.Event('submit',{bubbles:true,cancelable:true}));
  await until(()=>h.$('.intent-headline')?.textContent.includes('Alexandra’s Mexican mother')&&h.$('#intent-controls')?.hidden,'saved mamá intent');
  const saved=h.snapshot().meta.find(record=>record.id==='nabu.intent.v1:guest')?.value.intents[0];
  assert.ok(saved,'Use the actual guest intent storage');assert.equal(saved.rawText,mama);assert.deepEqual(saved.languages,['es']);
  assert.equal(saved.provenance.fields.languages.source,'user_edit');
  const requestCount=h.requests.length;
  await h.request();
  assert.match(h.$('.next-step-primary').textContent,/Mucho gusto/);
  h.click('[data-action="next-step-choose"][data-id="task-bank:phrases.nice_to_meet_you:es"]');
  await until(()=>h.$('#modal').open&&h.$('.next-step-bank-entry'),'actual phrase support modal');
  assert.equal(h.$('#modal-title').textContent,'A meaning to consider');
  assert.equal(h.$('.next-step-bank-entry h3').textContent,'Mucho gusto.');
  assert.equal(h.$('.next-step-bank-entry h3').getAttribute('lang'),'es');
  assert.match(h.$('#modal-body').textContent,/Nice to meet you/);
  assert.match(h.$('#modal-body').textContent,/not independently reviewed/);
  assertNoLearningWrites(h,before);
  h.click('[data-action="next-step-return"]');await until(()=>!h.$('#modal').open,'return from phrase');
  assert.ok(h.$('[data-action="next-step-request"]'));assert.equal(h.d.querySelectorAll('.content-card').length,6);
  assert.equal(h.$('.intent-headline').textContent,saved.immediateActivity);
  assert.equal(h.requests.length,requestCount,'Suggestions and local phrase support make no network request');
  assert.deepEqual(h.events.map(event=>event.phase),['shown','selected','continued']);
  assertNoLearningWrites(h,before);
 }finally{h.close();}
});

test('shipping manual reader: traced graph support opens both real meanings without autosave or source changes',async()=>{
 const h=await boot();try{
  const before=learningSnapshot(h);await openManualReader(h,'The light is bright.');
  const source=readerSnapshot(h),word=[...h.d.querySelectorAll('.reader-token')].find(el=>el.textContent==='light');
  assert.ok(word,'Select the actual light token');word.click();
  await until(()=>word.classList.contains('selected'),'actual reader-word selection');
  const requestCount=h.requests.length;
  await h.request();assert.match(h.$('.next-step-primary h3').textContent,/Compare the possible meanings/);const shown=h.events.find(event=>event.phase==='shown');assert.equal(typeof shown.graphVersion,'string');assert.ok(shown.graphVersion.length);assert.equal(shown.structuralWitnessIds.length,2);assert(shown.structuralWitnessIds.every(id=>typeof id==='string'&&id.startsWith('witness:alignment:')));assert.equal(JSON.stringify(shown).includes(source.text),false,'The local integration hook carries public graph references, not the paragraph');
  h.$('.next-step-primary [data-action="next-step-choose"]').click();
  await until(()=>h.$('#modal').open&&h.d.querySelectorAll('.next-step-bank-entry').length===2,'two existing light meanings');
  assert.equal(h.$('#modal-title').textContent,'Possible meanings in this sentence');
  const entries=[...h.d.querySelectorAll('.next-step-bank-entry')];
  assert.deepEqual(entries.map(el=>el.querySelector('h3').textContent),['light','light']);
  assert.deepEqual(new Set(entries.map(el=>el.querySelector('p[lang="es"]').textContent)),new Set(['luz','ligero']));
  const selected=h.events.find(event=>event.phase==='selected');assert.equal(selected.graphVersion,shown.graphVersion);assert.deepEqual(selected.structuralWitnessIds,shown.structuralWitnessIds);
  assertReaderPreserved(h,source);assertNoLearningWrites(h,before);
  h.click('[data-action="next-step-return"]');await until(()=>!h.$('#modal').open,'return to manual reading');
  assertReaderPreserved(h,source);assertNoLearningWrites(h,before);
  assert.equal(h.requests.length,requestCount,'Comparing local meanings does not send the paragraph to a provider');
 }finally{h.close();}
});

test('shipping Arabic reader: authored annotation and optional practice use the real controls without automatic evidence',async()=>{
 const h=await boot();try{
  const before=learningSnapshot(h);
  h.click('[data-action="open-content"][data-id="a-little-later"]');
  await until(()=>h.$('#reader-text')&&h.contentEvents().some(event=>event.kind==='opened'),'curated reader and persisted opening');
  const source=readerSnapshot(h);assert.equal(source.node.getAttribute('dir'),'rtl');
  const word=[...h.d.querySelectorAll('.reader-token.annotated')].find(el=>el.textContent==='خذي وقتك');
  assert.ok(word,'Use the actual anchored Arabic annotation');word.click();
  await until(()=>h.$('#translation-output')?.textContent.includes('Take your time'),'existing authored word support');
  const requestCount=h.requests.length;await h.request();
  h.click('[data-action="next-step-choose"][data-id="annotation:a-little-later:a3"]');
  await until(()=>h.events.some(event=>event.phase==='selected'&&event.actionType==='annotation'),'annotation action');
  assert.match(h.$('#translation-output').textContent,/Take your time/);
  assert.match(h.$('#translation-output').textContent,/female addressee/);
  assertReaderPreserved(h,source);assertNoLearningWrites(h,before);
  h.click('[data-action="next-step-choose"][data-id="practice:a-little-later:p1"]');
  await until(()=>h.$('#modal').open&&h.$('.content-practice'),'actual existing practice modal');
  assert.equal(h.$('#modal-title').textContent,'A little practice');
  assert.match(h.$('.content-practice').textContent,/What does خذي وقتك mean/);
  assert.equal(h.d.querySelectorAll('input[name="content-choice"]').length,3);
  assert.equal(h.$('input[name="content-choice"]:checked'),null,'Opening practice supplies no learner answer');
  assertReaderPreserved(h,source);assertNoLearningWrites(h,before);
  h.click('[data-action="practice-return"]');await until(()=>!h.$('#modal').open,'return from existing practice');
  assertReaderPreserved(h,source);assertNoLearningWrites(h,before);
  assert.equal(h.requests.length,requestCount,'Authored Arabic support stays local');
 }finally{h.close();}
});

test('shipping reader: an unsupported selected line offers a working continue action without invented support',async()=>{
 const h=await boot();try{
  const before=learningSnapshot(h);await openManualReader(h,'Glorpified moonstairs shimmer beyond the zindle.');
  const source=readerSnapshot(h),range=h.d.createRange();range.selectNodeContents(source.node);
  const selection=h.w.getSelection();selection.removeAllRanges();selection.addRange(range);
  h.d.dispatchEvent(new h.w.Event('selectionchange'));
  const requestCount=h.requests.length;await h.request();
  assert.match(h.$('.next-step-empty')?.textContent||'',/no safe local explanation/);
  assert.equal(h.$('.next-step-primary'),null,'Do not invent a definition or forced remedial exercise');
  assert.match(h.$('.next-step-selection').textContent,/Glorpified moonstairs/);
  h.click('[data-action="next-step-continue"]');
  assert.ok(h.$('[data-action="next-step-request"]'));assert.equal(h.$('#modal').open,false);
  assertReaderPreserved(h,source);assertNoLearningWrites(h,before);
  assert.equal(h.requests.length,requestCount,'Unsupported local content is not uploaded for a fabricated answer');
  assert.deepEqual(h.events.map(event=>event.phase),['shown','unavailable','continued']);
 }finally{h.close();}
});
