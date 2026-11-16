/** Optional, local next-step support inside Nabu's existing Explore and reader.
 * Suggestions are tab-local. Selecting support is not an assessed response; the existing reader can record display and lookup events.
 * This module never sends the media or intent text to a model or translator.
 */
import * as NextStep from './nabu-next-step.js';
import * as G from './nabu-graph.js';
import * as X from './nabu-content.js';
import * as Structure from './nabu-structure.js';

export function installNextSteps({state,DB,C,E,actions,api,$,intents,explore,getSource,showModal,closeModal}) {
 let result=null,error='',notice='',busy=false,generation=0,requestKey='',ownedModal=false;
 const owner=()=>state.user?.id||(state.accountHint?'!locked':'guest');
 const host=()=>$('#nabu-next-step-panel');
 const context=()=>intents.getContext();
 const available=()=>['explore','reader'].includes(state.view);
 const contextIdentity=value=>({actor:value?.actor,selection:value?.selection,intent:value?.immediateIntent?{id:value.immediateIntent.id,revision:value.immediateIntent.revision}:null,organization:value?.organizationObjective?{id:value.organizationObjective.id,revision:value.organizationObjective.revision}:null});
 const key=()=>JSON.stringify({owner:owner(),view:state.view,context:contextIdentity(context()),source:NextStep.sourceSnapshot(getSource())});
 const choices=()=>result?[result.primary,...result.alternatives,result.continueAction].filter(Boolean):[];
 const capabilities=()=>({annotation:typeof actions['reader-word']==='function','compare-senses':true,'bank-entry':true,'practice-content':typeof actions['content-task']==='function','continue-media':true,'open-content':typeof explore.openContent==='function','edit-intent':typeof intents.editCurrent==='function'});
 function emit(phase,candidate=null,decision=result) {
  if(!decision)return;
  // An integration hook, not telemetry storage, consent to upload, or mastery.
  const traced=candidate?[candidate]:phase==='shown'?[decision.primary,...decision.alternatives].filter(Boolean):[];
  const structuralWitnessIds=[...new Set(traced.flatMap(value=>value.structuralWitness?.witnessIds||[]))];
  window.dispatchEvent(new window.CustomEvent('nabu-next-step',{detail:{schemaVersion:1,policy:decision.policy,phase,at:Date.now(),taskKey:decision.taskKey,graphVersion:decision.graphVersion,structuralWitnessIds,intentRef:decision.intentRef,scope:{kind:decision.task.actor.kind,tenantId:decision.task.actor.tenantId},sourceRef:decision.sourceSnapshot.contentId?{id:decision.sourceSnapshot.contentId,version:decision.sourceSnapshot.contentVersion}:null,candidateId:candidate?.id||null,actionType:candidate?.action.type||null}}));
 }
 function explain(candidate) {
  const evidence=candidate.evidence;
  const evidenceText=evidence.status==='unknown'?'No direct performance evidence is used for this option. Unknown does not mean you do not know it.':evidence.status==='self-rated'?`${evidence.observations} direct self-rating${evidence.observations===1?'':'s'} on this meaning and language; no mastery claim.`:`${evidence.observations} response${evidence.observations===1?'':'s'} on the relevant authored activity; no general proficiency claim.`;
  const provenance=candidate.provenance.map(p=>[p.sourcePath||p.source||'',p.recordId||'',p.description||p.reviewStatus||''].filter(Boolean).join(' · ')).filter(Boolean);
  return `<details class="next-step-reasons"><summary>Why this option?</summary><p>${E(candidate.why)}</p><p>${E(evidenceText)}</p>${provenance.length?`<p class="small-print">Source: ${E([...new Set(provenance)].join('; '))}</p>`:''}<p class="small-print">${E(candidate.uncertainty?.linguistic||'No calibrated confidence is claimed.')}</p><details><summary>How the priority was calculated</summary><p class="small-print">A transparent rule, not a prediction of learning benefit. Total priority: ${E(candidate.score.total)}.</p><dl>${candidate.score.contributions.map(c=>`<div><dt>${E(({taskUtility:'Use for this task',sourceRelevance:'Current source',directLearnerEvidence:'Direct evidence',informationOpportunity:'Meaning to clarify',explicitPreference:'Stated preference',effort:'Estimated effort',interruption:'Interruption'})[c.name]||c.name)} (${c.value>0?'+':''}${E(c.value)})</dt><dd>${E(c.reason)}</dd></div>`).join('')}</dl></details></details>`;
 }
 function candidateHTML(candidate,primary=false) {
  return `<article class="next-step-option${primary?' next-step-primary':''}"><h3>${E(candidate.title)}</h3><p dir="auto" class="next-step-description">${E(candidate.description)}</p>${candidate.qualityLabel?`<p class="small-print next-step-quality">${E(candidate.qualityLabel)}</p>`:''}<button class="button ${primary?'secondary':'text-button'}" data-action="next-step-choose" data-id="${E(candidate.id)}">${candidate.kind==='continue-media'?'Continue':candidate.kind==='edit-intent'?'Edit intention':candidate.kind==='practice-content'?'Open optional practice':candidate.kind==='open-content'?'Open this piece':'Show me'}</button>${explain(candidate)}</article>`;
 }
 function body() {
  if(!result)return `<div class="next-step-heading"><div><p class="next-step-title">A little support, when you want it.</p><p class="small-print">Keep your place. Choose a suggestion or keep exploring.</p></div><button class="text-button" data-action="next-step-request"${busy?' disabled':''}>${busy?'Finding an option…':'Suggest a next step'}</button></div><p id="next-step-message" role="status">${E(notice)}</p><p id="next-step-error" role="alert">${E(error)}</p>${busy||error?'<button class="text-button" data-action="next-step-continue">Keep going</button>':''}`;
  const supports=[result.primary,...result.alternatives].filter(c=>c&&c.kind!=='continue-media');
  const allNotices=[...result.notices,notice].filter(Boolean);
  const noSupport=result.noSafeSupport&&result.supportStatus==='unavailable';
  return `<div class="next-step-heading"><p class="next-step-title">One option for right now</p><button class="text-button" data-action="next-step-dismiss" aria-label="Close next-step suggestions">Close</button></div>${result.sourceSnapshot.selectedText?`<p class="next-step-selection">For <bdi>${E(result.sourceSnapshot.selectedText)}</bdi></p>`:''}${result.primary?.kind==='continue-media'?`<p>${E(result.primary.why)}</p>`:''}${noSupport?'<p class="next-step-empty" role="status">There is no safe local explanation for this selection. Keep going, or choose another part of the text.</p>':''}<div class="next-step-options">${supports.map((c,i)=>candidateHTML(c,result.primary===c)).join('')}</div>${result.task.optionalRubric.length?`<details class="next-step-rubric"><summary>What might make this moment useful?</summary><p>Optional possibilities, in any order. You decide what fits this person and situation.</p><ul>${result.task.optionalRubric.map(r=>`<li>${E(r.description)}</li>`).join('')}</ul><p class="small-print">An authored reflection guide. These are not cultural rules, required lines, or a test.</p></details>`:''}${allNotices.length?`<details class="next-step-notices"><summary>Context and limits</summary>${allNotices.map(n=>`<p>${E(n)}</p>`).join('')}</details>`:''}<p id="next-step-error" role="alert">${E(error)}</p><div class="next-step-footer"><button class="text-button" data-action="next-step-continue">${E(result.continueAction?.title||'Keep going')}</button><button class="text-button" data-action="next-step-edit">Edit intention</button><button class="text-button" data-action="next-step-request"${busy?' disabled':''}>${busy?'Updating…':'Refresh suggestion'}</button></div>`;
 }
 function paint(focus=false) {
  const el=host();if(!el)return;
  const reader=$('#reader-text'),top=reader?.getBoundingClientRect().top;
  const preserve=reader&&window.scrollY>el.getBoundingClientRect().bottom+window.scrollY;
  el.innerHTML=body();el.setAttribute('aria-busy',String(busy));
  if(busy)for(const b of el.querySelectorAll('[data-action="next-step-choose"]'))b.disabled=true;
  if(preserve)window.scrollBy(0,reader.getBoundingClientRect().top-top);
  if(focus)el.querySelector('[data-action="next-step-choose"],[data-action="next-step-continue"],[data-action="next-step-request"]')?.focus({preventScroll:true});
 }
 function reset(message='',force=false) {
  if(!force&&requestKey&&requestKey===key())return;
  ++generation;result=null;error='';notice=message;busy=false;requestKey='';
  if(ownedModal){ownedModal=false;if($('#modal .next-step-support'))closeModal();}
  paint();
 }
 function refresh() {if((result||busy)&&(!available()||requestKey!==key()))reset('Your activity or intention changed. Ask for a fresh suggestion.',true);}
 function render() {refresh();return `<section id="nabu-next-step-panel" class="next-step-panel" aria-label="Optional next step" aria-busy="${busy}">${body()}</section>`;}
 async function request() {
  if(busy||!available())return;
  const who=owner();if(who==='!locked'){error='Sign in again to use your account evidence. You can keep reading.';paint();return;}
  result=null;error='';notice='';busy=true;requestKey=key();const epoch=++generation,expected=requestKey,source=getSource();let intentContext=context();
  paint();
  try{
   let inputs={cards:[],logs:[],contentEvents:[],evidenceScope:{kind:who==='guest'?'device-guest':'personal-account',tenantAttribution:'not-recorded'}};
   if(who==='guest'){
    const saved=await DB.snapshot();inputs={...inputs,cards:saved.cards||[],logs:saved.logs||[],contentEvents:explore.store.getState().owner==='guest'?explore.store.getEvents():[]};
   }else if(state.backend?.nextStepInputs){
    const tenant=intentContext.actor.tenantId;
    inputs=await api('next-step-inputs'+(tenant?'?tenantId='+encodeURIComponent(tenant):''));
    if(inputs.evidenceScope?.ownerUserId!==who||inputs.intentContext?.actor.userId!==who||inputs.intentContext?.actor.tenantId!==tenant)throw Error('The evidence response does not match this account and context. Please refresh.');
    if(JSON.stringify(contextIdentity(inputs.intentContext))!==JSON.stringify(contextIdentity(intentContext))){
     if(epoch===generation&&expected===key())await intents.refresh();
     if(who===owner()){notice='Your saved intention changed. Ask for a fresh suggestion.';paint();}
     return;
    }
    intentContext=inputs.intentContext;
    if(Object.values(inputs.truncated||{}).some(Boolean))notice='Only a bounded slice of account history was available. Omitted evidence remains unknown.';
   }else notice='Account evidence is unavailable on this server. This suggestion uses no learner history.';
   if(epoch!==generation||expected!==key())return;
   result=NextStep.recommendNextSteps({...inputs,intentContext,source,capabilities:capabilities()});
   emit('shown');if(result.supportStatus==='unavailable')emit('unavailable');
  }catch(e){if(epoch===generation&&expected===key()){error=e?.message||'Suggestions could not be opened. Your reading is still available.';result=null;}}
  finally{if(epoch===generation){busy=false;paint(true);}}
 }
 function stale() {
  if(!result||requestKey!==key()){reset('Your activity or intention changed. Ask for a fresh suggestion.',true);return true;}
  return false;
 }
 function entryHTML(action) {
  const quality=Structure.candidateEligibility(action.conceptId,action.sourceLang,action.targetLang);
  if(!quality.eligible)throw Error('This bank entry needs verification before it can be suggested.');
  const c=G.concept(action.conceptId),t=G.translation(c.id,action.sourceLang,action.targetLang);
  return `<article class="next-step-bank-entry"><p class="small-print">${E(C.languageName(action.sourceLang))} · ${E(c.sense)}</p><h3 dir="auto" lang="${E(action.sourceLang)}">${E(t.front)}</h3><p dir="auto" lang="${E(action.targetLang)}">${E(t.back)}</p>${c.details?.usage?`<p>${E(c.details.usage)}</p>`:''}${c.note?`<p class="small-print">${E(c.note)}</p>`:''}${t.literalGloss?`<p class="small-print">Approximate wording guide (English): ${E(t.literalGloss)}.</p>`:''}</article>`;
 }
 function bankModal(candidate) {
  const a=candidate.action;
  const entries=a.type==='compare-senses'?a.conceptIds.map(id=>entryHTML({...a,conceptId:id})).join(''):entryHTML(a);
  showModal(a.type==='compare-senses'?'Possible meanings in this sentence':'A meaning to consider',`<section class="next-step-support"><p>${E(candidate.why)}</p>${entries}<p class="small-print">Existing authored bank entries, not independently reviewed translations. Use the surrounding text and the person’s preferences to judge which wording fits. This does not change your text or record knowledge.</p><button class="button secondary" data-action="next-step-return">Return to your activity</button></section>`);ownedModal=true;
 }
 async function choose(button) {
  if(busy||stale())return;
  const candidate=choices().find(c=>c.id===button.dataset.id);if(!candidate)return;
  const decision=result,who=owner(),a=candidate.action;error='';
  try{
   if(a.type==='continue-media'){continueActivity();return;}
   if(a.type==='edit-intent'){intents.editCurrent();}
   else if(a.type==='bank-entry'||a.type==='compare-senses')bankModal(candidate);
   else if(a.type==='open-content'){const item=X.itemById(a.contentId,a.version);if(!item)throw Error('This content version is no longer available.');await explore.openContent(item.id);}
   else if(a.type==='annotation'){
    const item=explore.active(),index=state.reader.tokens.findIndex(t=>t.annotationId===a.annotationId);
    if(item?.id!==a.contentId||item.version!==a.version||index<0)throw Error('This expression is no longer in the current reading. Request a fresh suggestion.');
    const token=$(`.reader-token[data-index="${index}"]`);if(!token)throw Error('The selected expression is not visible in the reader.');
    await actions['reader-word'](token);
   }else if(a.type==='practice-content'){
    const item=explore.active();if(item?.id!==a.contentId||item.version!==a.version||!item.practice.some(p=>p.id===a.activityId))throw Error('This activity is no longer part of the current reading.');
    await actions['content-task']({dataset:{id:a.activityId}});
   }else throw Error('This action is unavailable. You can keep reading.');
   if(who===owner())emit('selected',candidate,decision);
  }catch(e){error=e?.message||'This option could not be opened.';paint();}
 }
 function continueActivity(phase='continued') {
  const decision=result,candidate=result?.continueAction;emit(phase,candidate,decision);reset('',true);
  // Do not stop speech, close unrelated dialogs, navigate, or re-render media.
  $('#nabu-next-step-panel [data-action="next-step-request"]')?.focus({preventScroll:true});
 }
 actions['next-step-request']=request;
 actions['next-step-choose']=choose;
 actions['next-step-continue']=()=>continueActivity();
 actions['next-step-dismiss']=()=>continueActivity('dismissed');
 actions['next-step-edit']=()=>{if(stale())return;intents.editCurrent();};
 actions['next-step-return']=()=>{if(ownedModal){ownedModal=false;if($('#modal .next-step-support'))closeModal();}continueActivity();};
 window.addEventListener('nabu-account-change',()=>reset('',true));
 window.addEventListener('nabu-intent-change',refresh);
 $('#modal')?.addEventListener('close',()=>{ownedModal=false;});
 return {render,refresh,request,getResult:()=>result?structuredClone(result):null};
}
