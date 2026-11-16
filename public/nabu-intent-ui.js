/** Optional planning context in the existing Explore/reader. No learning writes,
 * remote parser, media replacement or recommendation changes occur here. */
import * as Intent from './nabu-intents.js';
import * as IntentStore from './nabu-intent-store.js';

export function installIntents({state,DB,C,E,actions,api,$}) {
 let scopeKey='',ready=Promise.resolve(),tenants=[],expanded=false,draft=null;
 let dirty=new Set(),error='',notice='',busy=false,confirmDelete=null,teamForm=false;
 let generation=0,available=false;
 const store=IntentStore.createIntentStore({getMeta:DB.getMeta,setMeta:DB.setMeta,uid:C.uid,onChange:()=>{updateStatus();window.dispatchEvent(new window.Event('nabu-intent-change'));}});
 const host=()=>$('#nabu-intent-panel');
 const snapshot=()=>store.getSnapshot();
 const current=()=>store.getContext().immediateIntent;
 const owner=()=>state.user?.id||(state.accountHint?'!locked':'guest');
 const team=()=>tenants.find(t=>t.id===store.getState().tenantId);
 const editable=()=>available&&!busy;
 const copy=value=>JSON.parse(JSON.stringify(value));
 const empty=()=>Intent.emptyIntentContent();
 const contentOf=record=>{const value=empty();for(const key of Object.keys(value))if(key in record)value[key]=copy(record[key]);return value;};
 function stateText() {
  const s=store.getState();
  if(s.owner==='!locked')return 'Sign in again to open your intentions.';
  if(s.status==='temporary')return s.message;
  if(s.owner!=='guest'&&!state.backend?.intentLayer)return 'Account intentions need a connection to the updated Nabu server.';
  if(s.status==='loading')return 'Opening intentions…';
  if(s.status==='error'||s.status==='locked')return s.message||'Intentions could not be opened. You can keep reading.';
  return s.owner==='guest'?'Saved in this browser. A short description is enough.':'Saved to your Nabu account. Editing requires a connection.';
 }
 function updateStatus(){const el=$('#intent-storage-status');if(el)el.textContent=stateText();}
 function paint(focusId) {
  const el=host();if(!el)return;
  const reader=$('#reader-text'),top=reader?.getBoundingClientRect().top;
  const preserve=reader&&window.scrollY>el.getBoundingClientRect().bottom+window.scrollY;
  el.innerHTML=body();
  el.setAttribute('aria-busy',String(busy));
  if(busy)for(const control of el.querySelectorAll('button,input,textarea,select'))control.disabled=true;
  if(preserve)window.scrollBy(0,reader.getBoundingClientRect().top-top);
  if(focusId)$('#'+focusId)?.focus({preventScroll:true});
 }
 function fieldStatus(content,key){
  if(dirty.has(key))return 'Your edit · save to apply';
  const status=content.provenance?.fields?.[key]?.status||'unknown';
  return status==='inferred'?'Suggested · not confirmed':status==='unknown'?'Not specified':status==='exploratory'?'Exploratory':'Stated by you';
 }
 function textField(key,label,max,placeholder=''){
  const value=draft.content[key];
  return `<div class="form-field"><label for="intent-${key}">${label}</label><input class="input" id="intent-${key}" name="${key}" dir="auto" maxlength="${max}" value="${E(value||'')}" placeholder="${E(placeholder)}"><small>${E(fieldStatus(draft.content,key))}</small></div>`;
 }
 function editor(){
  const d=draft.content,organization=draft.kind==='organization';
  return `<form id="intent-form" class="intent-form"><label for="intent-text">${organization?'What is your team trying to do?':'What would you like to do right now?'}</label><textarea class="input" id="intent-text" name="rawText" dir="auto" rows="2" maxlength="1200" required placeholder="Understand this song, prepare for a conversation, or explore poetry…">${E(d.rawText)}</textarea><details class="intent-details"${draft.id?' open':''}><summary>Details you can correct <span class="muted">· optional</span></summary><p class="small-print">Only clear statements are filled in automatically. Leave anything unknown blank. A broader destination is optional.</p><div class="intent-fields">${textField('immediateActivity','Immediate activity',1200)}${textField('destination','Broader destination · optional',400)}${textField('timeHorizon','Time horizon · optional',120,'For example: next Friday')}<div class="form-field"><label for="intent-objectiveStatus">How definite is this objective?</label><select class="select" id="intent-objectiveStatus" name="objectiveStatus">${[['unknown','Not yet clear'],['explicit','Stated by me'],['exploratory','Exploratory · no fixed destination'],['inferred','Suggested · not confirmed']].map(([v,l])=>`<option value="${v}"${d.objectiveStatus===v?' selected':''}>${l}</option>`).join('')}</select></div><fieldset class="intent-choices"><legend>Languages · optional</legend>${C.LANGUAGES.map(([code,name])=>`<label><input type="checkbox" name="languages" value="${code}"${d.languages.includes(code)?' checked':''}> ${E(name)}</label>`).join('')}<small>${E(fieldStatus(d,'languages'))}</small></fieldset><fieldset class="intent-choices"><legend>Activity formats · optional</legend>${['reading','listening','speaking','writing','watching'].map(v=>`<label><input type="checkbox" name="modalities" value="${v}"${d.modalities.includes(v)?' checked':''}> ${v[0].toUpperCase()+v.slice(1)}</label>`).join('')}<small>${E(fieldStatus(d,'modalities'))}</small></fieldset>${textField('context','Context · optional',500,'Only what is useful for this activity')}<div class="form-field"><label for="intent-constraints">Constraints · one per line</label><textarea class="input" id="intent-constraints" name="constraints" rows="2" dir="auto" maxlength="2400">${E(d.constraints.join('\n'))}</textarea></div><div class="form-field"><label for="intent-preferences">Preferences · one per line</label><textarea class="input" id="intent-preferences" name="preferences" rows="2" dir="auto" maxlength="2400">${E(d.preferences.join('\n'))}</textarea></div></div>${state.reader.contentId?`<label class="checkbox-row"><input type="checkbox" id="intent-source" name="sourceContent"${d.sourceContent?.id===state.reader.contentId?' checked':''}> Link this reading piece (reference only)</label>`:d.sourceContent?`<p class="small-print">Linked reading: <bdi>${E(d.sourceContent.id)}</bdi></p><button type="button" class="text-button" data-action="intent-unlink-source">Remove reading link</button>`:''}</details><p class="small-print">Parsed on this device. ${organization?'Team objectives are visible to team members.':owner()==='guest'?'Your intention stays in this browser.':'Your immediate intention stays private to your account.'} Avoid names or personal details you do not need to save.</p><div class="button-row"><button type="submit" class="button primary"${editable()?'':' disabled'}>${draft.id?'Save changes':organization?'Save team objective':'Save intention'}</button><button type="button" class="text-button" data-action="intent-cancel">Cancel</button>${!organization?'<button type="button" class="text-button" data-action="intent-skip">Skip and explore</button>':''}</div></form>`;
 }
 function recordRow(item){
  const selected=snapshot().selection.intentId===item.id;
  const title=item.immediateActivity||item.rawText||'Exploration';
  const writable=item.kind==='learner'||snapshot().role==='owner';
  return `<li class="intent-record"><div><span dir="auto">${E(title)}</span><small>${selected?'Current · ':''}${E(item.status)}${item.objectiveStatus==='inferred'?' · suggestion, unconfirmed':''}</small></div><div class="button-row">${item.kind==='learner'&&item.status==='active'&&!selected?`<button class="text-button" data-action="intent-select" data-id="${E(item.id)}">Use this</button>`:''}${writable?`<button class="text-button" data-action="intent-edit" data-id="${E(item.id)}">Edit</button>${item.status!=='active'?`<button class="text-button" data-action="intent-lifecycle" data-id="${E(item.id)}" data-status="active">Resume</button>`:`<button class="text-button" data-action="intent-lifecycle" data-id="${E(item.id)}" data-status="paused">Pause</button><button class="text-button" data-action="intent-lifecycle" data-id="${E(item.id)}" data-status="completed">Complete</button><button class="text-button" data-action="intent-lifecycle" data-id="${E(item.id)}" data-status="abandoned">Abandon</button>`}<button class="text-button" data-action="intent-delete" data-id="${E(item.id)}">Delete</button>`:''}</div>${confirmDelete===item.id?`<div class="intent-delete-confirm" role="group" aria-label="Confirm deletion"><p>Delete this saved intention permanently?</p><button class="button danger" data-action="intent-confirm-delete" data-id="${E(item.id)}">Delete intention</button><button class="text-button" data-action="intent-cancel-delete">Keep it</button></div>`:''}</li>`;
 }
 function manager(){
  const snap=snapshot(),s=store.getState(),t=team();
  return `<div class="intent-manager">${state.user&&available?`<div class="intent-scope"><label for="intent-scope">Context</label><select id="intent-scope" class="select"><option value="">Individual</option>${tenants.map(x=>`<option value="${E(x.id)}"${s.tenantId===x.id?' selected':''}>${E(x.label)}</option>`).join('')}</select><button class="text-button" data-action="intent-team-form">Create a team</button></div>${teamForm?'<form id="intent-team-form" class="inline-form"><label for="intent-team-name">Team name</label><input id="intent-team-name" class="input" name="label" maxlength="120" required dir="auto"><button class="button secondary" type="submit">Create team</button><button class="text-button" type="button" data-action="intent-team-form">Cancel</button></form>':''}`:''}${t?`<p class="small-print">${E(t.label)} context. Team members can see the team objective; each learner’s immediate intention remains separate. This is basic account and membership scoping, not an enterprise administration system.</p>`:''}${draft?editor():`<div class="button-row"><button class="button secondary" data-action="intent-new"${editable()?'':' disabled'}>New intention</button><button class="text-button" data-action="intent-skip">Skip and explore</button>${t&&snap.role==='owner'&&!snap.organizationObjective?`<button class="text-button" data-action="intent-new-team-objective"${editable()?'':' disabled'}>Set team objective</button>`:''}</div>`}${snap.intents.length?`<h3>Your intentions</h3><ul class="intent-records">${snap.intents.map(recordRow).join('')}</ul>`:''}${snap.organizationObjectives?.length?`<h3>Team objectives</h3><ul class="intent-records">${snap.organizationObjectives.map(recordRow).join('')}</ul>`:''}<p id="intent-storage-status" class="small-print" role="status">${E(stateText())}</p><button class="text-button" data-action="intent-refresh">Refresh intentions</button></div>`;
 }
 function body(){
  const c=current(),snap=snapshot(),t=team();
  const objective=snap.organizationObjective,objectiveField=objective?.destination?'destination':'immediateActivity';
  const suggestedObjective=objective?.objectiveStatus==='inferred'||objective?.provenance?.fields?.[objectiveField]?.status==='inferred';
  const headline=c?(c.immediateActivity||c.rawText):snap.selection.mode==='exploring'?'Exploring without a fixed destination':'What would you like to do right now?';
  const status=c?.objectiveStatus==='inferred'||c?.provenance?.fields?.immediateActivity?.status==='inferred'?'Suggested · not confirmed':c?.objectiveStatus==='unknown'?'Details not yet clear':c?.objectiveStatus==='exploratory'?'Exploratory':t?'Your intention in '+t.label:'Your intention';
  return `<div class="intent-summary"><div><p class="eyebrow">RIGHT NOW${c?' · '+E(status):''}</p><p class="intent-headline" dir="auto">${E(headline)}</p>${c?.destination?`<p class="intent-destination">Toward: <bdi>${E(c.destination)}</bdi>${c.provenance?.fields?.destination?.status==='inferred'?' <span class="pill">Suggested · unconfirmed</span>':''}</p>`:''}${snap.organizationObjective?`<p class="intent-team-objective">Team objective · <bdi>${E(snap.organizationObjective.destination||snap.organizationObjective.immediateActivity||snap.organizationObjective.rawText)}</bdi>${suggestedObjective?' <span class="pill">Suggested · not confirmed</span>':''}</p>`:''}</div><button class="text-button" data-action="intent-toggle" aria-expanded="${expanded}" aria-controls="intent-controls">${expanded?'Close':c?'Edit or switch':'Choose intention'}</button></div><div id="intent-message" role="status">${E(notice)}</div><div id="intent-error" class="support-error" role="alert">${E(error)}</div><div id="intent-controls"${expanded?'':' hidden'}>${expanded?manager():''}</div>${!expanded&&!c&&snap.selection.mode!=='exploring'?'<button class="text-button intent-quick-skip" data-action="intent-skip">Skip and explore</button>':''}`;
 }
 function render(){return `<section id="nabu-intent-panel" class="intent-panel" aria-label="Current intention">${body()}</section>`;}
 function newDraft(kind='learner'){draft={kind,id:null,requestId:C.uid(),revision:null,content:empty(),original:empty()};dirty=new Set();expanded=true;error='';notice='';}
 function find(id){const snap=snapshot();return [...snap.intents,...(snap.organizationObjectives||[])].find(r=>r.id===id);}
 async function run(fn){
  if(busy)return;const epoch=generation;busy=true;error='';notice='';
  paint();
  try{await fn();}catch(e){if(epoch===generation)error=e?.message||'This change could not be saved. Your reading is still open.';}
  finally{if(epoch===generation){busy=false;paint();if(!draft&&!expanded)$('#nabu-intent-panel [data-action="intent-toggle"]')?.focus({preventScroll:true});}}
 }
 async function configure(){
  const who=owner(),support=who==='guest'||!!state.backend?.intentLayer;
  const key=who+':'+support;if(scopeKey===key)return ready;
  scopeKey=key;const epoch=++generation;draft=null;dirty=new Set();tenants=[];expanded=false;busy=false;error='';notice='';confirmDelete=null;teamForm=false;available=false;
  ready=(async()=>{try{await store.configure(who,state.user&&support?api:null);if(epoch!==generation)return;available=who==='guest'||support&&who!=='!locked';if(state.user&&support)tenants=await store.listTenants();}catch(e){if(epoch===generation)error=e.message;}finally{if(epoch===generation)paint();}})();
  return ready;
 }
 function reset(){scopeKey='';++generation;available=false;expanded=false;draft=null;tenants=[];error='';notice='';busy=false;store.configure('!locked',null).catch(()=>{});paint();}
 async function changeScope(value){await run(async()=>{draft=null;confirmDelete=null;teamForm=false;await store.setScope(value||null);notice=value?'Opened team context.':'Opened individual context.';});}
 actions['intent-toggle']=()=>{expanded=!expanded;if(expanded&&!draft&&!snapshot().intents.length&&available&&!store.getState().tenantId)newDraft();paint(expanded&&draft?'intent-text':undefined);};
 actions['intent-new']=()=>{newDraft();paint('intent-text');};
 actions['intent-new-team-objective']=()=>{newDraft('organization');paint('intent-text');};
 actions['intent-cancel']=()=>{draft=null;dirty.clear();error='';paint();};
 actions['intent-edit']=b=>{const item=find(b.dataset.id);if(!item)return;draft={id:item.id,kind:item.kind,revision:item.revision,content:contentOf(item),original:contentOf(item)};dirty=new Set();expanded=true;paint('intent-text');};
 actions['intent-skip']=()=>run(async()=>{const epoch=generation;draft=null;expanded=false;try{await store.skip();notice='Explore at your own pace. No destination is required.';}catch(e){if(epoch!==generation)return;store.exploreTemporarily();notice='Exploring for this tab. Your choice could not be saved; you can keep reading.';}});
 actions['intent-select']=b=>run(async()=>{await store.select(b.dataset.id);draft=null;expanded=false;notice='Current intention updated.';});
 actions['intent-lifecycle']=b=>run(async()=>{const item=find(b.dataset.id);if(!item)return;await store.transition(item.id,b.dataset.status,item.revision);draft=null;notice=b.dataset.status==='completed'?'Intention completed. This is a planning status, not a learning score.':'Intention marked '+b.dataset.status+'.';});
 actions['intent-delete']=b=>{confirmDelete=b.dataset.id;paint();};
 actions['intent-cancel-delete']=()=>{confirmDelete=null;paint();};
 actions['intent-confirm-delete']=b=>run(async()=>{const item=find(b.dataset.id);if(item)await store.remove(item.id,item.revision);confirmDelete=null;draft=null;notice='Intention deleted.';});
 actions['intent-team-form']=()=>{teamForm=!teamForm;draft=null;paint(teamForm?'intent-team-name':undefined);};
 actions['intent-refresh']=()=>run(async()=>{await store.refresh();if(state.user&&state.backend?.intentLayer)tenants=await store.listTenants();available=owner()==='guest'||!!state.backend?.intentLayer;notice='Intentions refreshed.';});
 actions['intent-unlink-source']=()=>{draft.content.sourceContent=null;dirty.add('sourceContent');paint();};
 document.addEventListener('input',event=>{
  if(!draft||!event.target.closest('#intent-form'))return;
  const name=event.target.name;if(!name)return;dirty.add(name);
  if(name==='rawText')draft.content.rawText=event.target.value;
  else if(['languages','modalities'].includes(name))draft.content[name]=new FormData(event.target.form).getAll(name);
  else if(name==='sourceContent')draft.content.sourceContent=event.target.checked&&state.reader.contentId?{id:state.reader.contentId,version:String(state.reader.contentVersion)}:null;
  else draft.content[name]=['constraints','preferences'].includes(name)?event.target.value.split('\n').map(s=>s.trim()).filter(Boolean):event.target.value||null;
 });
 document.addEventListener('change',event=>{if(event.target.id==='intent-scope')changeScope(event.target.value);});
 document.addEventListener('submit',event=>{
  if(!['intent-form','intent-team-form'].includes(event.target.id))return;
  event.preventDefault();event.stopImmediatePropagation();const form=event.target;
  if(form.id==='intent-team-form'){
   const label=new FormData(form).get('label').trim();if(!label)return;
   run(async()=>{const id='team-'+C.uid().replace(/[^a-zA-Z0-9_-]/g,'').slice(0,48);await api('decision-tenants',{method:'POST',body:{id,label}});tenants=await store.listTenants();await store.setScope(id);teamForm=false;draft=null;notice='Team context created. You can set an objective or explore without one.';});return;
  }
  const submitted=draft,changedFields=new Set(dirty);
  run(async()=>{
   const data=new FormData(form),rawText=String(data.get('rawText')||'');
   if(!rawText.trim())throw Error('Write a short intention, or choose Skip and explore.');
   const parsed=!submitted.id||rawText!==submitted.original.rawText?Intent.parseIntentLocal(rawText):copy(submitted.original);
   parsed.status=submitted.original.status;
   const changes={};
   for(const field of changedFields){
    if(field==='rawText')continue;
    if(['languages','modalities'].includes(field))changes[field]=data.getAll(field);
    else if(['constraints','preferences'].includes(field))changes[field]=String(data.get(field)||'').split('\n').map(s=>s.trim()).filter(Boolean);
    else if(field==='sourceContent')changes[field]=data.get(field)==='on'&&state.reader.contentId?{id:state.reader.contentId,version:String(state.reader.contentVersion)}:null;
    else changes[field]=String(data.get(field)||'').trim()||null;
   }
   const content=Intent.editIntentContent(parsed,changes);
   if(submitted.id)await store.update(submitted.id,content,submitted.revision);
   else await store.create(content,{kind:submitted.kind,id:submitted.requestId});
   draft=null;dirty.clear();expanded=false;notice='Intention saved. You can correct its details at any time.';
  });
 },true);
 for(const key of Object.keys(actions).filter(key=>key.startsWith('intent-'))){const action=actions[key];actions[key]=(...args)=>busy?undefined:action(...args);}
 window.addEventListener('nabu-account-change',reset);
 function editCurrent(){if(busy)return;const c=current();if(c)actions['intent-edit']({dataset:{id:c.id}});else if(available)actions['intent-new']();else{expanded=true;paint();}}
 return {render,configure,refresh:()=>store.refresh(),getContext:()=>store.getContext(),editCurrent,store};
}
