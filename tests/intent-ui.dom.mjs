/** Optional DOM integration suite. Uses jsdom as a test tool, not a Nabu runtime
 * dependency. This exercises real UI handlers/model/store, not browser rendering,
 * native IndexedDB durability, cookies, media playback or screen-reader behavior.
 * Run: NABU_TEST_JSDOM=/absolute/path/to/jsdom/lib/api.js node --test tests/intent-ui.dom.mjs
 * Or install jsdom as an optional local test tool and omit NABU_TEST_JSDOM.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import * as C from '../public/nabu-core.js';
import * as Intent from '../public/nabu-intents.js';
import {installIntents} from '../public/nabu-intent-ui.js';
import {installIDBFixture} from './idb-fixture.js';
const {JSDOM,VirtualConsole}=await import(process.env.NABU_TEST_JSDOM?pathToFileURL(process.env.NABU_TEST_JSDOM).href:'jsdom');
const clone=x=>structuredClone(x);
async function until(predicate,label='condition'){
 for(let i=0;i<150;i++){if(predicate())return;await new Promise(r=>setTimeout(r,10));}
 throw Error('Timed out: '+label);
}
function setup({meta=new Map(),user=null,backend=null,api=async()=>{throw Error('Offline');},write=null}={}){
 const dom=new JSDOM('<main><div id="ui"></div><article id="reader-text" dir="rtl">نقرأ الشعر معًا</article><audio id="media"></audio></main>',{url:'https://nabu.invalid/read',pretendToBeVisual:true});
 const w=dom.window;w.scrollBy=()=>{};
 for(const key of ['window','document','FormData','HTMLFormElement'])globalThis[key]=key==='window'?w:w[key];
 const state={user,backend,accountHint:'',reader:{text:'نقرأ الشعر معًا',contentId:'a-little-later',contentVersion:1},cards:[{id:'kept',schedule:{due:100}}],logs:[{id:'existing-evidence'}]};
 const DB={getMeta:async(key,fallback)=>clone(meta.get(key)??fallback),setMeta:async(key,value)=>{if(write)await write();meta.set(key,clone(value));}};
 const actions={},errors=[];
 const ui=installIntents({state,DB,C,E:C.escapeHTML,actions,api,$:s=>w.document.querySelector(s)});
 w.document.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(!b||b.disabled)return;const fn=actions[b.dataset.action];if(fn){e.preventDefault();Promise.resolve(fn(b)).catch(e=>errors.push(e));}});
 const $=s=>w.document.querySelector(s);
 const input=(selector,value)=>{const el=$(selector);assert.ok(el,selector);if(el.type==='checkbox')el.checked=value;else el.value=value;el.dispatchEvent(new w.Event('input',{bubbles:true}));};
 const click=selector=>{const el=$(selector);assert.ok(el,selector);el.click();};
 const submit=()=>$('#intent-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
 const mount=()=>{$('#ui').innerHTML=ui.render();};
 return {dom,w,state,DB,actions,ui,errors,meta,$,input,click,submit,mount,async start(){await ui.configure();mount();return this;},close(){w.close();}};
}
async function create(h,text){h.click('[data-action="intent-toggle"]');if(!h.$('#intent-text'))h.click('[data-action="intent-new"]');h.input('#intent-text',text);h.submit();await until(()=>h.ui.store.getSnapshot().intents.length>0,'intent created');await until(()=>h.$('#nabu-intent-panel').getAttribute('aria-busy')==='false','save complete');return h.ui.getContext().immediateIntent;}
function remoteFixture({loseFirstAck=false}={}){
 const user={id:'ui-account'},tenants=[],scopes=new Map();let lost=false;
 const empty=role=>({schemaVersion:1,intents:[],organizationObjective:null,organizationObjectives:[],selection:{mode:'none',intentId:null},role});scopes.set('',empty(null));
 const api=async(path,{method='GET',body}={})=>{
  const [route,search='']=path.split('?'),scope=new URLSearchParams(search).get('tenantId')||'';
  if(route==='intent-tenants')return {tenants:clone(tenants)};
  if(route==='decision-tenants'){tenants.push({id:body.id,label:body.label,role:'owner'});scopes.set(body.id,empty('owner'));return {id:body.id};}
  if(route==='intents'&&method==='GET')return clone(scopes.get(scope));
  if(route==='intents'&&method==='POST'){
   const target=scopes.get(body.tenantId||''),list=body.kind==='organization'?target.organizationObjectives:target.intents;
   let item=list.find(x=>x.id===body.id);
   if(!item){item=Intent.validateIntentRecord({schemaVersion:1,id:body.id,ownerUserId:user.id,tenantId:body.tenantId,kind:body.kind,...body.content,revision:1,createdAt:100,updatedAt:100,statusChangedAt:100});list.push(item);if(item.kind==='organization')target.organizationObjective=item;else target.selection={mode:'selected',intentId:item.id};}
   if(loseFirstAck&&!lost){lost=true;throw Error('Lost acknowledgement after save');}return {intent:clone(item)};
  }
  if(route==='intent-selection'){scopes.get(scope).selection=clone(body);return {selection:clone(body)};}
  throw Error('Unexpected fixture request: '+method+' '+path);
 };
 return {api,user,tenants,scopes};
}

test('optional entry creates mamá intent and preserves source node, media, cards and evidence',async()=>{
 const h=await setup().start();try{
  const reader=h.$('#reader-text'),media=h.$('#media'),before=clone(h.state);
  const item=await create(h,"I want to meet my girlfriend’s Mexican mother and make a good impression.");
  assert.equal(item.destination,'make a good impression');assert.deepEqual(item.languages,[]);
  assert.equal(h.$('#reader-text'),reader);assert.equal(h.$('#media'),media);assert.deepEqual(h.state,before);
  assert.match(h.$('.intent-headline').textContent,/meet/);assert.match(h.$('.intent-destination').textContent,/impression/);
  assert.equal(h.$('#intent-controls').hidden,true);assert.deepEqual(h.errors,[]);
 }finally{h.close();}
});

test('adding and clearing optional fields uses explicit user-edit provenance',async()=>{
 const h=await setup().start();try{
  const item=await create(h,'I want to understand this song.');h.click('[data-action="intent-toggle"]');h.click('[data-action="intent-edit"]');
  h.input('#intent-destination','Have a conversation about its meaning');h.input('#intent-timeHorizon','next Friday');h.input('input[name="languages"][value="es"]',true);h.input('#intent-context','Informal family conversation');h.input('#intent-constraints','Ten minutes\nNo audio');h.input('#intent-preferences','Short explanations');h.input('#intent-source',true);h.submit();
  await until(()=>h.ui.getContext().immediateIntent.revision===2,'edit');await until(()=>!h.$('#intent-form'),'edit close');
  let record=h.ui.getContext().immediateIntent;assert.deepEqual(record.languages,['es']);assert.equal(record.destination,'Have a conversation about its meaning');assert.equal(record.provenance.fields.languages.source,'user_edit');assert.deepEqual(record.sourceContent,{id:'a-little-later',version:'1'});
  h.click('[data-action="intent-toggle"]');h.click('[data-action="intent-edit"]');h.input('#intent-destination','');h.input('input[name="languages"][value="es"]',false);h.input('#intent-source',false);h.submit();
  await until(()=>h.ui.getContext().immediateIntent.revision===3,'clear');record=h.ui.getContext().immediateIntent;
  assert.equal(record.destination,null);assert.deepEqual(record.languages,[]);assert.equal(record.sourceContent,null);assert.equal(record.provenance.fields.destination.status,'unknown');assert.equal(record.id,item.id);
 }finally{h.close();}
});

test('skip persists exploration without creating a fabricated record and reload retains it',async()=>{
 const meta=new Map();let h=await setup({meta}).start();h.click('[data-action="intent-skip"]');await until(()=>h.ui.getContext().selection.mode==='exploring');assert.equal(h.ui.store.getSnapshot().intents.length,0);h.close();
 h=await setup({meta}).start();try{assert.equal(h.ui.getContext().selection.mode,'exploring');assert.match(h.$('.intent-headline').textContent,/without a fixed destination/);}finally{h.close();}
});

test('creation, lifecycle controls, selecting saved intents and confirmed deletion work',async()=>{
 const h=await setup().start();try{
  await create(h,'I want to explore Arabic poetry with no particular end goal.');h.click('[data-action="intent-toggle"]');h.click('[data-action="intent-lifecycle"][data-status="paused"]');await until(()=>h.ui.store.getSnapshot().intents[0].status==='paused');await until(()=>h.$('[data-action="intent-lifecycle"][data-status="active"]'));
  assert.equal(h.ui.getContext().immediateIntent,null);h.click('[data-action="intent-lifecycle"][data-status="active"]');await until(()=>h.ui.store.getSnapshot().intents[0].status==='active');await until(()=>h.$('[data-action="intent-select"]'));h.click('[data-action="intent-select"]');await until(()=>h.ui.getContext().selection.mode==='selected');await until(()=>h.$('#intent-controls').hidden);
  h.click('[data-action="intent-toggle"]');h.click('[data-action="intent-lifecycle"][data-status="completed"]');await until(()=>h.ui.store.getSnapshot().intents[0].status==='completed');await until(()=>h.$('[data-action="intent-edit"]')&&!h.$('[data-action="intent-edit"]').disabled);
  h.click('[data-action="intent-edit"]');h.input('#intent-text','I want to read another poem.');h.submit();await until(()=>h.ui.store.getSnapshot().intents[0].rawText==='I want to read another poem.');assert.equal(h.ui.store.getSnapshot().intents[0].status,'completed');await until(()=>h.$('#intent-controls').hidden);
  h.click('[data-action="intent-toggle"]');h.click('[data-action="intent-delete"]');h.click('[data-action="intent-cancel-delete"]');assert.equal(h.ui.store.getSnapshot().intents.length,1);h.click('[data-action="intent-delete"]');h.click('[data-action="intent-confirm-delete"]');await until(()=>h.ui.store.getSnapshot().intents.length===0);assert.equal(h.ui.getContext().selection.mode,'none');
 }finally{h.close();}
});

test('empty input gives actionable error; ambiguous and Arabic input remain editable and escaped',async()=>{
 const h=await setup().start();try{
  h.click('[data-action="intent-toggle"]');h.input('#intent-text','   ');h.submit();await until(()=>h.$('#intent-error').textContent.length>0);assert.equal(h.ui.store.getSnapshot().intents.length,0);
  h.input('#intent-text','maybe something with music <script>bad()</script>');h.submit();await until(()=>h.ui.store.getSnapshot().intents.length===1);await until(()=>h.$('#intent-controls').hidden);
  const item=h.ui.getContext().immediateIntent;assert.equal(item.objectiveStatus,'unknown');assert.equal(item.immediateActivity,null);assert.equal(h.$('#nabu-intent-panel script'),null);
  h.click('[data-action="intent-toggle"]');h.click('[data-action="intent-edit"]');h.input('#intent-text','أريد أن أستكشف الشعر العربي بلا غاية محددة');h.input('#intent-immediateActivity','استكشاف الشعر العربي');h.input('#intent-objectiveStatus','exploratory');h.input('input[name="languages"][value="ar"]',true);h.submit();await until(()=>h.ui.getContext().immediateIntent.revision===2);
  assert.equal(h.ui.getContext().immediateIntent.objectiveStatus,'exploratory');assert.deepEqual(h.ui.getContext().immediateIntent.languages,['ar']);assert.equal(h.$('.intent-headline').getAttribute('dir'),'auto');
 }finally{h.close();}
});

test('write failure preserves draft and source; skip still works temporarily without corrupting saved data',async()=>{
 const h=await setup({write:async()=>{throw Error('Storage unavailable');}}).start();try{
  h.click('[data-action="intent-toggle"]');h.input('#intent-text','I want to understand this paragraph.');h.submit();await until(()=>h.$('#intent-error').textContent==='Storage unavailable');assert.equal(h.$('#intent-text').value,'I want to understand this paragraph.');assert.equal(h.ui.store.getSnapshot().intents.length,0);
  h.click('[data-action="intent-skip"]');await until(()=>h.ui.getContext().selection.mode==='exploring');assert.equal(h.meta.size,0);assert.equal(h.ui.store.getState().status,'temporary');assert.match(h.$('#intent-message').textContent,/could not be saved/);
 }finally{h.close();}
});

test('in-flight save disables draft actions and does not lose the submitted intent',async()=>{
 let release;const h=await setup({write:()=>new Promise(r=>{release=r;})}).start();try{
  h.click('[data-action="intent-toggle"]');h.input('#intent-text','I want to understand this song.');h.submit();await until(()=>!!release);
  assert.equal(h.$('[data-action="intent-cancel"]').disabled,true);h.actions['intent-cancel']();release();await until(()=>h.ui.store.getSnapshot().intents.length===1);await until(()=>!h.$('#intent-form'));assert.equal(h.$('#intent-error').textContent,'');
 }finally{h.close();}
});

test('account change immediately removes guest draft and never presents it as account data',async()=>{
 const h=await setup().start();try{
  await create(h,'I want to read a private paragraph.');h.click('[data-action="intent-toggle"]');h.click('[data-action="intent-edit"]');
  h.w.dispatchEvent(new h.w.Event('nabu-account-change'));h.state.user={id:'new-account'};h.state.backend={intentLayer:false};await h.ui.configure();
  assert.equal(h.ui.getContext().immediateIntent,null);assert.equal(h.$('#intent-text'),null);assert.doesNotMatch(h.$('#nabu-intent-panel').textContent,/private paragraph/);assert.equal(h.meta.size,1);
 }finally{h.close();}
});

test('all exposed intent actions have handlers and all form controls have accessible labels',async()=>{
 const h=await setup().start();try{
  h.click('[data-action="intent-toggle"]');
  for(const el of h.w.document.querySelectorAll('[data-action]'))assert.equal(typeof h.actions[el.dataset.action],'function',el.dataset.action);
  for(const el of h.w.document.querySelectorAll('#intent-form input,#intent-form textarea,#intent-form select'))assert.ok(el.labels?.length||el.getAttribute('aria-label'),el.name);
  for(const el of h.w.document.querySelectorAll('input[type="text"],textarea'))assert.equal(el.getAttribute('dir'),'auto');
  assert.equal(h.$('[data-action="intent-toggle"]').getAttribute('aria-expanded'),'true');
 }finally{h.close();}
});

test('team creation supports no destination, then shared objective and private activity remain separate',async()=>{
 const server=remoteFixture(),h=await setup({user:server.user,backend:{intentLayer:true},api:server.api}).start();try{
  h.click('[data-action="intent-toggle"]');h.click('[data-action="intent-team-form"]');h.input('#intent-team-name','Support learning group');h.$('#intent-team-form').dispatchEvent(new h.w.Event('submit',{bubbles:true,cancelable:true}));
  await until(()=>h.ui.store.getState().tenantId!==null);await until(()=>h.$('[data-action="intent-new-team-objective"]'));
  assert.equal(h.ui.getContext().organizationObjective,null);assert.equal(h.ui.getContext().immediateIntent,null);
  h.click('[data-action="intent-skip"]');await until(()=>h.ui.getContext().selection.mode==='exploring');await until(()=>h.$('#intent-controls').hidden);
  h.click('[data-action="intent-toggle"]');h.click('[data-action="intent-new-team-objective"]');h.input('#intent-text','Our team needs to handle customer-support calls in Spanish.');h.input('#intent-destination','Handle customer-support calls in Spanish');h.submit();
  await until(()=>h.ui.getContext().organizationObjective!==null);await until(()=>h.$('#intent-controls').hidden);
  assert.equal(h.ui.getContext().immediateIntent,null);assert.equal(h.ui.getContext().organizationObjective.destination,'Handle customer-support calls in Spanish');
  const objectiveId=h.ui.getContext().organizationObjective.id;await create(h,'I want to practice a conversation in Spanish.');
  assert.equal(h.ui.getContext().organizationObjective.id,objectiveId);assert.notEqual(h.ui.getContext().immediateIntent.id,objectiveId);assert.equal(h.ui.getContext().immediateIntent.destination,null);
  h.click('[data-action="intent-toggle"]');h.$('#intent-scope').value='';h.$('#intent-scope').dispatchEvent(new h.w.Event('change',{bubbles:true}));await until(()=>h.ui.store.getState().tenantId===null);await until(()=>h.$('#nabu-intent-panel').getAttribute('aria-busy')==='false');
  assert.equal(h.ui.getContext().organizationObjective,null);assert.equal(h.ui.getContext().immediateIntent,null);
 }finally{h.close();}
});

test('retrying a UI save after lost acknowledgement reuses its stable ID',async()=>{
 const server=remoteFixture({loseFirstAck:true}),h=await setup({user:server.user,backend:{intentLayer:true},api:server.api}).start();try{
  h.click('[data-action="intent-toggle"]');h.input('#intent-text','I want to understand this song.');h.submit();await until(()=>h.$('#intent-error').textContent.includes('Lost acknowledgement'));assert.equal(server.scopes.get('').intents.length,1);
  h.submit();await until(()=>h.ui.getContext().immediateIntent!==null);await until(()=>!h.$('#intent-form'));assert.equal(server.scopes.get('').intents.length,1);assert.equal(h.$('#intent-error').textContent,'');
 }finally{h.close();}
});

test('shipping self-contained bundle boots and its actual Explore/reader integration creates an intent',async()=>{
 const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');const failures=[];
 const vc=new VirtualConsole();vc.on('jsdomError',e=>failures.push(e.message));
 const dom=new JSDOM(html,{url:'https://nabu.invalid/explore',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
  w.structuredClone=structuredClone;w.Response=Response;w.AbortController=AbortController;
  w.fetch=async()=>new Response(JSON.stringify({detail:'Offline test'}),{status:503,headers:{'Content-Type':'application/json'}});
  w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});w.scrollTo=()=>{};w.scrollBy=()=>{};
  installIDBFixture(w);w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
 }});
 try{
  const d=dom.window.document;await until(()=>d.querySelector('#nabu-intent-panel'),'bundle intent control');assert.equal(d.querySelectorAll('.content-card').length,6);
  d.querySelector('[data-action="intent-toggle"]').click();const input=d.querySelector('#intent-text');assert.ok(input);input.value='I want to explore Arabic poetry.';input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));d.querySelector('#intent-form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));
  await until(()=>d.querySelector('.intent-headline').textContent==='I want to explore Arabic poetry.','bundle save');
  d.querySelector('[data-action="open-content"]').click();await until(()=>d.querySelector('#reader-text'),'reader');const node=d.querySelector('#reader-text');d.querySelector('[data-action="intent-toggle"]').click();assert.equal(d.querySelector('#reader-text'),node);assert.equal(d.querySelector('#intent-controls').hidden,false);assert.equal(failures.filter(x=>!x.includes('CSS')).length,0,failures.join('\n'));
 }finally{dom.window.close();}
});
