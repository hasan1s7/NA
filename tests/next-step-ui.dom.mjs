/** Optional DOM integration tests: real next-step policy and UI, with the
 * existing reader, practice, modal, and data transports represented by spies.
 * These do not verify visual layout, native audio, cookies, IndexedDB durability,
 * or screen-reader behavior. No runtime dependency is added to Nabu.
 * Run: NABU_TEST_JSDOM=/absolute/path/to/jsdom/lib/api.js node --test tests/next-step-ui.dom.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import * as C from '../public/nabu-core.js';
import * as Intent from '../public/nabu-intents.js';
import * as X from '../public/nabu-content.js';
import {installNextSteps} from '../public/nabu-next-step-ui.js';
const {JSDOM}=await import(process.env.NABU_TEST_JSDOM?pathToFileURL(process.env.NABU_TEST_JSDOM).href:'jsdom');
const clone=value=>structuredClone(value);
const mama='I want to meet my girlfriend Alexandra’s Mexican mother and make a good impression.';
const phraseSource={sourceLang:'es',targetLang:'en',text:'Mucho gusto.',selectedText:'Mucho gusto.',selectionStart:0,hasMedia:true};
const lightSource={sourceLang:'en',targetLang:'es',text:'The suitcase is light.',selectedText:'light',selectionStart:16,hasMedia:true};
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
async function until(predicate,label='condition'){
 for(let i=0;i<150;i++){if(predicate())return;await new Promise(r=>setTimeout(r,10));}
 throw Error('Timed out: '+label);
}
function makeContext(text='I want to understand this phrase.',edits={},userId=null,tenantId=null){
 const intent=text?Intent.validateIntentRecord({schemaVersion:1,id:'dom-intent-00000001',ownerUserId:userId||'guest',tenantId,kind:'learner',...Intent.editIntentContent(Intent.parseIntentLocal(text),edits),createdAt:1000,updatedAt:1000,statusChangedAt:1000,revision:1}):null;
 return {schemaVersion:1,actor:{kind:tenantId?'team':'individual',userId,tenantId},selection:intent?{mode:'selected',intentId:intent.id}:{mode:'exploring',intentId:null},immediateIntent:intent,organizationObjective:null};
}
function sourceFor(item,annotation=null){
 const text=X.sourceText(item);
 return {contentId:item.id,contentVersion:item.version,sourceLang:item.language,targetLang:item.translationLanguage,text,selectedText:annotation?.quote||'',selectionStart:annotation?text.indexOf(annotation.quote):null,hasMedia:true,format:item.genre};
}
function setup({intentContext=makeContext(),source=phraseSource,user=null,backend=null,accountHint='',view='reader',cards=[],logs=[],contentEvents=[],eventsOwner='guest',activeItem=null,snapshot=null,api=null}={}){
 const dom=new JSDOM('<main><div id="ui"></div><article id="reader-text" dir="auto"></article><audio id="media"></audio><div id="cards">Saved cards</div><div id="logs">Existing evidence</div></main><dialog id="modal" aria-labelledby="modal-title"><h2 id="modal-title"></h2><div id="modal-body"></div></dialog>',{url:'https://nabu.invalid/read',pretendToBeVisual:true});
 const w=dom.window;w.scrollBy=()=>{};
 globalThis.window=w;globalThis.document=w.document;
 const $=selector=>w.document.querySelector(selector);
 let currentContext=clone(intentContext),currentSource=clone(source),currentItem=activeItem;
 const state={user,backend,accountHint,view,reader:{text:source.text||'',tokens:[]},cards:clone(cards),logs:clone(logs)};
 $('#reader-text').textContent=source.text||'Existing reading remains here.';
 const calls={snapshot:0,events:0,api:[],openContent:[],practice:[],annotation:[],edit:0,refresh:0,close:0,modal:[]};
 const errors=[],events=[],pending=new Set();
 const DB={snapshot:async()=>{calls.snapshot++;return snapshot?await snapshot():clone({cards,logs});}};
 const actions={
  'reader-word':async button=>{calls.annotation.push(Number(button.dataset.index));},
  'content-task':async button=>{calls.practice.push(button.dataset.id);}
 };
 const intents={getContext:()=>clone(currentContext),editCurrent:()=>{calls.edit++;},refresh:async()=>{calls.refresh++;}};
 const explore={active:()=>currentItem,openContent:async id=>{assert.ok(X.itemById(id),'Only a real catalogue item can be opened');calls.openContent.push(id);},store:{getState:()=>({owner:eventsOwner}),getEvents:()=>{calls.events++;return clone(contentEvents);}}};
 const apiSpy=async path=>{calls.api.push(path);if(!api)throw Error('No remote fixture configured');return await api(path);};
 const showModal=(title,html)=>{calls.modal.push(title);$('#modal-title').textContent=title;$('#modal-body').innerHTML=html;$('#modal').open=true;};
 const closeModal=()=>{calls.close++;$('#modal').open=false;$('#modal').dispatchEvent(new w.Event('close'));};
 const ui=installNextSteps({state,DB,C,E:C.escapeHTML,actions,api:apiSpy,$,intents,explore,getSource:()=>clone(currentSource),showModal,closeModal});
 w.addEventListener('nabu-next-step',event=>events.push(clone(event.detail)));
 w.document.addEventListener('click',event=>{
  const button=event.target.closest('[data-action]');if(!button||button.disabled)return;
  const fn=actions[button.dataset.action];if(!fn)return;
  event.preventDefault();const task=Promise.resolve().then(()=>fn(button)).catch(error=>errors.push(error));pending.add(task);task.finally(()=>pending.delete(task));
 });
 $('#ui').innerHTML=ui.render();
 const settle=async()=>{while(pending.size)await Promise.all([...pending]);await Promise.resolve();};
 const startClick=selector=>{const el=$(selector);assert.ok(el,selector);el.click();};
 return {dom,w,$,state,ui,actions,calls,errors,events,intents,explore,
  get context(){return clone(currentContext);},set context(value){currentContext=clone(value);},
  get source(){return clone(currentSource);},set source(value){currentSource=clone(value);},
  set active(value){currentItem=value;},
  startClick,settle,async click(selector){startClick(selector);await settle();},
  request(){return this.click('[data-action="next-step-request"]');},
  choose(candidate=ui.getResult()?.primary){assert.ok(candidate,'A candidate must exist');return this.click('[data-action="next-step-choose"][data-id="'+candidate.id+'"]');},
  shownActions(){for(const el of w.document.querySelectorAll('[data-action]')){assert.equal(typeof actions[el.dataset.action],'function',el.dataset.action);assert.ok(el.textContent.trim()||el.getAttribute('aria-label'),'Every shown action has an accessible name');}},
  close(){w.close();}
 };
}
function preserved(h){return {nodes:['#reader-text','#media','#cards','#logs'].map(selector=>[selector,h.$(selector),h.$(selector).outerHTML]),state:clone(h.state)};}
function assertPreserved(h,before){for(const [selector,node,html] of before.nodes){assert.equal(h.$(selector),node,selector+' must retain its node');assert.equal(node.outerHTML,html,selector+' must retain its content');}assert.deepEqual(h.state,before.state,'Suggestions must not write source, cards, logs or schedules');assert.deepEqual(h.errors,[]);}
function apiResponse(context,{cards=[],logs=[],contentEvents=[],ownerUserId=context.actor.userId,truncated={}}={}){return {schemaVersion:1,intentContext:clone(context),cards:clone(cards),logs:clone(logs),contentEvents:clone(contentEvents),evidenceScope:{kind:'personal-account',ownerUserId,tenantAttribution:'not-recorded'},truncated};}

test('explicit Spanish mamá intent opens a real local phrase and returns without changing media or evidence',async()=>{
 const h=setup({intentContext:makeContext(mama,{languages:['es'],modalities:['speaking']}),source:{sourceLang:'es',targetLang:'en',text:'The full private paragraph remains untouched.',hasMedia:true},cards:[{id:'existing-card',schedule:{due:12345,reps:3}}],logs:[{id:'existing-log',rating:2}]});
 try{
  const before=preserved(h);await h.request();const result=h.ui.getResult(),greeting=[result.primary,...result.alternatives].find(c=>c.action.conceptId==='phrases.nice_to_meet_you');assert.ok(greeting,'The existing greeting remains an available option alongside the current media');assert.equal(result.task.optionalRubric.length,4);h.shownActions();
  assert.match(h.$('#nabu-next-step-panel').textContent,/not cultural rules/);await h.choose(greeting);
  assert.equal(h.$('#modal').open,true);assert.match(h.$('#modal-body').textContent,/Mucho gusto/);assert.match(h.$('#modal-body').textContent,/not independently reviewed/);assert.equal(h.$('.next-step-bank-entry h3').getAttribute('lang'),'es');h.shownActions();
  await h.click('[data-action="next-step-return"]');assert.equal(h.$('#modal').open,false);assert.equal(h.ui.getResult(),null);assertPreserved(h,before);
  assert.deepEqual(h.events.map(e=>e.phase),['shown','selected','continued']);assert.equal(h.calls.api.length,0);
  const payload=JSON.stringify(h.events);for(const privateText of [mama,'The full private paragraph remains untouched.','Mucho gusto.'])assert.equal(payload.includes(privateText),false,'Decision events contain no raw intent, media, or answer text');
  assert(h.events.every(e=>e.intentRef?.id==='dom-intent-00000001'));
 }finally{h.close();}
});

test('an unconfirmed introduction language offers the working correction action without inventing Spanish',async()=>{
 const h=setup({intentContext:makeContext(mama),source:{targetLang:'en',hasMedia:false},view:'explore'});
 try{await h.request();assert.equal(h.ui.getResult().primary.kind,'edit-intent');assert.deepEqual(h.ui.getResult().task.languages,[]);await h.choose();assert.equal(h.calls.edit,1);await h.click('[data-action="next-step-edit"]');assert.equal(h.calls.edit,2);await h.click('[data-action="next-step-dismiss"]');assert.equal(h.ui.getResult(),null);assert.equal(h.events.at(-1).phase,'dismissed');h.shownActions();}finally{h.close();}
});

test('light opens both actual bank meanings and never records a selected meaning as knowledge',async()=>{
 const h=setup({source:lightSource,intentContext:makeContext('I want to understand this word in English.')});
 try{
  const before=preserved(h);await h.request();const result=h.ui.getResult();assert.equal(result.primary.kind,'compare-senses');assert.deepEqual(new Set(result.primary.action.conceptIds),new Set(['home.light','colors.light']));assert.equal(result.primary.structuralWitness.graphVersion,result.graphVersion);assert.equal(result.primary.structuralWitness.witnessIds.length,2);assert.deepEqual(h.events.at(-1).structuralWitnessIds,result.primary.structuralWitness.witnessIds);assert.equal(h.events.at(-1).graphVersion,result.graphVersion);
  await h.choose();assert.equal(h.$('#modal-title').textContent,'Possible meanings in this sentence');assert.equal(h.w.document.querySelectorAll('.next-step-bank-entry').length,2);assert.match(h.$('#modal-body').textContent,/does not change your text or record knowledge/);assert.equal(h.calls.practice.length,0);assertPreserved(h,before);
  await h.click('[data-action="next-step-return"]');await h.request();assert.equal(h.calls.snapshot,2);assert.equal(h.ui.getResult().primary.evidence.status,'unknown');h.shownActions();
 }finally{h.close();}
});

test('an unknown song line exposes no invented explanation and Continue preserves the whole source',async()=>{
 const text='A fictional chorus surrounds glorpified moonstairs without an authored translation.';
 const h=setup({intentContext:makeContext('I want to understand this song.'),source:{sourceLang:'en',targetLang:'es',text,selectedText:'glorpified moonstairs',selectionStart:text.indexOf('glorpified'),format:'song',hasMedia:true}});
 try{const before=preserved(h);await h.request();assert.equal(h.ui.getResult().noSafeSupport,true);assert.equal(h.ui.getResult().primary.kind,'continue-media');assert.match(h.$('[role="status"]').textContent,/no safe local explanation/);assert.equal(h.$('[data-action="next-step-choose"]'),null);h.shownActions();await h.click('[data-action="next-step-continue"]');assert.equal(h.ui.getResult(),null);assertPreserved(h,before);assert.deepEqual(h.events.map(e=>e.phase),['shown','unavailable','continued']);}finally{h.close();}
});

test('open-ended poetry opens an existing catalogue item without requiring a destination or practice',async()=>{
 const h=setup({intentContext:makeContext('I want to explore Arabic poetry with no particular end goal.'),source:{sourceLang:'ar',targetLang:'en',hasMedia:false},view:'explore'});
 try{await h.request();const result=h.ui.getResult();assert.equal(result.task.broaderDestination,null);assert.equal(result.primary.kind,'open-content');assert.equal(X.itemById(result.primary.action.contentId,result.primary.action.version).genre,'poetry');h.shownActions();await h.choose();assert.deepEqual(h.calls.openContent,[result.primary.action.contentId]);assert.deepEqual(h.calls.practice,[]);assert.equal(h.events.at(-1).phase,'selected');}finally{h.close();}
});

test('exploration without a selected source does not emit an unavailable-support event',async()=>{
 const h=setup({intentContext:makeContext(null),source:{targetLang:'en',hasMedia:false},view:'explore'});
 try{await h.request();assert.equal(h.ui.getResult().supportStatus,'not-requested');assert.deepEqual(h.events.map(e=>e.phase),['shown'],'Absent requested support is not an unavailable intervention');await h.click('[data-action="next-step-continue"]');assert.equal(h.events.at(-1).phase,'continued');}finally{h.close();}
});

test('the selected Arabic annotation invokes its actual reader token and preserves RTL content',async()=>{
 const item=X.itemById('imru-al-qais-stop-and-weep'),annotation=item.annotations[0];
 const h=setup({intentContext:makeContext('I want to understand this poem.'),source:sourceFor(item,annotation),activeItem:item});
 try{
  h.state.reader.tokens=[{text:annotation.quote,annotationId:annotation.id}];const token=h.w.document.createElement('button');token.className='reader-token';token.dataset.index='0';token.textContent=annotation.quote;h.$('#reader-text').replaceChildren(token);h.$('#reader-text').setAttribute('dir','rtl');
  const before=preserved(h);await h.request();assert.equal(h.ui.getResult().primary.kind,'annotation');assert.equal(h.$('.next-step-selection bdi').textContent,annotation.quote);assert.equal(h.$('.next-step-description').getAttribute('dir'),'auto');assert.equal(h.$('#nabu-next-step-panel').getAttribute('aria-label'),'Optional next step');h.shownActions();await h.choose();assert.deepEqual(h.calls.annotation,[0]);assertPreserved(h,before);
 }finally{h.close();}
});

test('optional practice routes only to a real activity in the active content version',async()=>{
 const item=X.itemById('a-little-later'),h=setup({intentContext:makeContext('I want to read this dialogue.'),source:sourceFor(item),activeItem:item});
 try{
  await h.request();let result=h.ui.getResult();assert.equal(result.primary.kind,'continue-media');const practice=result.alternatives.find(c=>c.kind==='practice-content');assert.ok(practice);assert.ok(item.practice.some(p=>p.id===practice.action.activityId));assert.match(h.$('[data-action="next-step-choose"]').textContent,/optional practice/);await h.choose(practice);assert.deepEqual(h.calls.practice,[practice.action.activityId]);
  h.active=X.itemById('a-book-for-rain');await h.choose(practice);assert.equal(h.calls.practice.length,1);assert.match(h.$('#next-step-error').textContent,/no longer part/);assert.equal(h.events.filter(e=>e.phase==='selected').length,1,'Rejected actions are not selected evidence');
 }finally{h.close();}
});

test('a changed source or intent revision invalidates old suggestions and closes their owned modal',async()=>{
 const h=setup({source:lightSource});
 try{
  await h.request();assert.equal(h.ui.getResult().primary.structuralWitness.witnessIds.length,2);const oldButton=h.$('[data-action="next-step-choose"]');h.source={...lightSource,text:'A changed source.'};await h.actions['next-step-choose'](oldButton);assert.equal(h.calls.modal.length,0);assert.equal(h.ui.getResult(),null);assert.match(h.$('#next-step-message').textContent,/changed/);assert.equal(h.events.some(event=>event.phase==='selected'),false,'A structural witness does not bypass the existing stale source guard');
  h.source=lightSource;await h.request();await h.choose();assert.equal(h.$('#modal').open,true);const context=h.context;context.immediateIntent.revision++;context.immediateIntent.updatedAt++;h.context=context;h.w.dispatchEvent(new h.w.Event('nabu-intent-change'));assert.equal(h.ui.getResult(),null);assert.equal(h.$('#modal').open,false);assert.equal(h.calls.close,1);
  await h.request();assert.equal(h.ui.getResult().intentRef.revision,2);assert.deepEqual(h.errors,[]);
 }finally{h.close();}
});

test('resetting suggestions does not close an unrelated dialog that replaced their earlier modal',async()=>{
 const h=setup({source:lightSource});
 try{
  await h.request();await h.choose();assert.equal(h.$('#modal').open,true);
  // Existing showModal() can replace an already-open dialog without firing close.
  h.$('#modal-title').textContent='Unrelated reader settings';h.$('#modal-body').innerHTML='<section class="reader-settings">Existing reader settings remain available.</section>';
  const body=h.$('.reader-settings'),context=h.context;context.immediateIntent.revision++;context.immediateIntent.updatedAt++;h.context=context;h.w.dispatchEvent(new h.w.Event('nabu-intent-change'));
  assert.equal(h.ui.getResult(),null);assert.equal(h.$('#modal').open,true,'Only the currently owned support dialog may be closed');assert.equal(h.$('.reader-settings'),body);assert.equal(h.calls.close,0);
 }finally{h.close();}
});

test('a pending guest snapshot cannot attach a result to a different source',async()=>{
 const data=deferred(),h=setup({source:lightSource,snapshot:()=>data.promise});
 try{h.startClick('[data-action="next-step-request"]');await until(()=>h.calls.snapshot===1,'snapshot request');assert.equal(h.$('#nabu-next-step-panel').getAttribute('aria-busy'),'true');h.source={...lightSource,text:'Different activity'};h.ui.refresh();data.resolve({cards:[],logs:[]});await h.settle();assert.equal(h.ui.getResult(),null);assert.deepEqual(h.events,[]);assert.equal(h.$('#nabu-next-step-panel').getAttribute('aria-busy'),'false');assert.match(h.$('#next-step-message').textContent,/changed/);}finally{h.close();}
});

test('matched account and team inputs use only the authenticated evidence response',async()=>{
 const context=makeContext(mama,{languages:['es']},'alice','team-one');
 const card={id:'account-card',conceptId:'phrases.nice_to_meet_you',sourceLang:'es',targetLang:'en'},log={id:'account-log',cardId:card.id,before:card,practiceMode:'production',rating:1,at:2000};
 const h=setup({intentContext:context,user:{id:'alice'},backend:{nextStepInputs:true},source:{targetLang:'en',hasMedia:false},cards:[{...card,id:'guest-card'}],logs:[{...log,id:'guest-log'}],api:async()=>apiResponse(context,{cards:[card],logs:[log],truncated:{cards:true}})});
 try{
  await h.request();const result=h.ui.getResult();assert.equal(result.primary.evidence.status,'self-rated');assert.deepEqual(result.primary.evidence.referenceIds,['account-log']);assert.equal(result.evidenceScope.ownerUserId,'alice');assert.equal(result.task.actor.tenantId,'team-one');assert.equal(h.calls.snapshot,0);assert.equal(h.calls.events,0);assert.deepEqual(h.calls.api,['next-step-inputs?tenantId=team-one']);assert.match(h.$('#nabu-next-step-panel').textContent,/not recorded as team-specific/);assert.match(h.$('#nabu-next-step-panel').textContent,/bounded slice/);assert.deepEqual(h.events[0].scope,{kind:'team',tenantId:'team-one'});
 }finally{h.close();}
});

test('wrong-account and wrong-team responses fail without guest-data fallback or foreign suggestions',async()=>{
 for(const mismatch of ['owner','team']){
  const context=makeContext('I want to understand this phrase.',{},'alice','team-one');const response=apiResponse(context);if(mismatch==='owner')response.evidenceScope.ownerUserId='bob';else response.intentContext.actor.tenantId='team-two';
  const h=setup({intentContext:context,user:{id:'alice'},backend:{nextStepInputs:true},api:async()=>response});
  try{const before=preserved(h);await h.request();assert.equal(h.ui.getResult(),null);assert.match(h.$('#next-step-error').textContent,/does not match/);assert.equal(h.calls.snapshot,0);assert.equal(h.calls.events,0);assert.deepEqual(h.events,[]);await h.click('[data-action="next-step-continue"]');assert.equal(h.$('#next-step-error').textContent,'');assertPreserved(h,before);}finally{h.close();}
 }
});

test('an account switch discards the pending old response before any choice or event is shown',async()=>{
 const context=makeContext(mama,{languages:['es']},'alice'),response=deferred();
 const h=setup({intentContext:context,user:{id:'alice'},backend:{nextStepInputs:true},api:()=>response.promise});
 try{
  h.startClick('[data-action="next-step-request"]');await until(()=>h.calls.api.length===1,'account request');h.state.user={id:'bob'};h.context=makeContext(null,{},'bob');h.w.dispatchEvent(new h.w.Event('nabu-account-change'));response.resolve(apiResponse(context));await h.settle();assert.equal(h.ui.getResult(),null);assert.deepEqual(h.events,[]);assert.equal(h.calls.snapshot,0);assert.equal(h.$('#nabu-next-step-panel').getAttribute('aria-busy'),'false');assert.doesNotMatch(h.$('#nabu-next-step-panel').textContent,/Alexandra|Mucho gusto/);assert.deepEqual(h.errors,[]);
 }finally{h.close();}
});

test('a remotely changed intent refreshes the intent context and requires a fresh request',async()=>{
 const context=makeContext('I want to understand this phrase.',{},'alice'),newer=clone(context);newer.immediateIntent.revision++;newer.immediateIntent.updatedAt++;
 const h=setup({intentContext:context,user:{id:'alice'},backend:{nextStepInputs:true},api:async()=>apiResponse(newer)});
 try{h.intents.refresh=async()=>{h.calls.refresh++;h.context=newer;};await h.request();assert.equal(h.calls.refresh,1);assert.equal(h.ui.getResult(),null);assert.match(h.$('#next-step-message').textContent,/saved intention changed/);assert.deepEqual(h.events,[]);await h.request();assert.equal(h.ui.getResult().intentRef.revision,2);}finally{h.close();}
});

test('unavailable account evidence never reads guest history, and a locked account can keep reading',async()=>{
 const context=makeContext('I want to understand this phrase.',{},'alice');
 const h=setup({intentContext:context,user:{id:'alice'},backend:{nextStepInputs:false},logs:[{id:'guest-private-log'}]});
 try{await h.request();assert.equal(h.ui.getResult().primary.evidence.status,'unknown');assert.equal(h.calls.snapshot,0);assert.equal(h.calls.events,0);assert.match(h.$('#nabu-next-step-panel').textContent,/uses no learner history/);assert.deepEqual(h.calls.api,[]);}finally{h.close();}
 const locked=setup({accountHint:'alice',intentContext:context});
 try{const before=preserved(locked);await locked.request();assert.equal(locked.ui.getResult(),null);assert.match(locked.$('#next-step-error').textContent,/Sign in again/);assert.equal(locked.calls.snapshot,0);await locked.click('[data-action="next-step-continue"]');assertPreserved(locked,before);}finally{locked.close();}
});

test('guest content events are ignored when the content store belongs to an account',async()=>{
 const item=X.itemById('a-little-later'),activity=item.practice.find(p=>p.mode==='recall'),annotation=item.annotations.find(a=>a.id===activity.annotationId);
 const event={id:'private-account-event-0001',kind:'attempt',contentId:item.id,version:item.version,activityId:activity.id,sessionId:'private-account-session',at:2000,answer:activity.accepted[0],assisted:false,skipped:false};
 const h=setup({source:sourceFor(item,annotation),activeItem:item,contentEvents:[event],eventsOwner:'alice'});
 try{await h.request();assert.equal(h.ui.getResult().primary.kind,'annotation');assert.equal(h.ui.getResult().primary.evidence.status,'unknown');assert.equal(h.calls.events,0);assert.equal(h.calls.snapshot,1);}finally{h.close();}
});

test('source markup stays escaped, multilingual selection uses bdi, and all visible controls are wired',async()=>{
 const text='<img src=x onerror="window.injected=true"> شعر عربي';
 const h=setup({intentContext:makeContext('???'),source:{sourceLang:'ar',targetLang:'en',text,selectedText:text,selectionStart:0,hasMedia:true}});
 try{await h.request();assert.equal(h.$('.next-step-selection bdi').textContent,text);assert.equal(h.$('#nabu-next-step-panel img'),null);assert.equal(h.w.injected,undefined);assert.equal(h.$('#next-step-error').getAttribute('role'),'alert');h.shownActions();await h.click('[data-action="next-step-request"]');assert.equal(h.calls.snapshot,2);assert.equal(h.ui.getResult().primary.kind,'continue-media');assert.equal(JSON.stringify(h.events).includes(text),false);assert.deepEqual(h.errors,[]);}finally{h.close();}
});
