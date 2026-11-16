/** Live, optional Bayesian learning support. Observations use the existing
 * account-scoped immutable ledger; posteriors never overwrite that ledger.
 * No provider, pooled private-user history, or schedule mutation is involved. */
import * as Observations from './nabu-observations.js';
import * as LearnerTasks from './nabu-learner-tasks.js';
import * as LearnerObservations from './nabu-learner-observations.js';
import * as LearnerModel from './nabu-learner-model.js';
import * as LearnerPolicy from './nabu-learner-policy.js';
import * as EvidencePolicy from './nabu-evidence-policy.js';
import * as NextStep from './nabu-next-step.js';

export const LEARNER_SESSION_MS = 30 * 60 * 1000;
export function installLearnerSupport(h) {
 const {state,C,E,actions,$,explore,intents,showModal,closeModal,download}=h;
 const store=explore.store, now=()=>h.now?h.now():Date.now();
 let goalId='',language='',mode='production',budget=60,fit=null,decision=null,input=null;
 let pending=false,error='',notice='',generation=0,actionGeneration=0,actionPending=false,controller=null,resultKey='',check=null,covered=[],localTime=0,ownedModal=false;
 const clock=()=>localTime=Math.max(now(),localTime+1);
 const currentTime=()=>Math.max(now(),localTime);
 const host=()=>$('#nabu-learner-panel');
 const owner=()=>state.user?.id||(state.accountHint?'!locked':'guest');
 const enabled=()=>owner()!=='!locked'&&(!state.user||!!state.backend?.evidenceEvents)&&store.getState().owner===owner();
 function context(){
  const c=intents.getContext()||{};
  return {actor:{userId:state.user?.id||null,tenantId:state.user?c.actor?.tenantId||null:null},
   intentRef:c.immediateIntent?{id:c.immediateIntent.id,revision:c.immediateIntent.revision}:null,
   organizationObjectiveRef:c.organizationObjective?{id:c.organizationObjective.id,revision:c.organizationObjective.revision}:null};
 }
 const scope=()=>JSON.stringify(context());
 const events=()=>{const a=context().actor;return store.getEvents().filter(e=>e.evidence&&e.evidence.actor.userId===a.userId&&e.evidence.actor.tenantId===a.tenantId);};
 const signature=()=>JSON.stringify({scope:scope(),goalId,budget,events:events().map(e=>e.id),hour:Math.floor(currentTime()/3600000)});
 const intentTask=()=>NextStep.buildTask(intents.getContext(),{sourceLang:language||state.translation?.sourceLang,hasMedia:state.view==='reader'});
 const noPractice=()=>intentTask().avoidPractice||EvidencePolicy.practiceIsExcluded({preferences:[intents.getContext()?.immediateIntent?.rawText||'']});
 const catalogue=LearnerTasks.listLearnerTasks(),definitions=new Map(catalogue.map(t=>[t.id,t]));
 const registry=()=>catalogue;
 const taskById=id=>definitions.get(id)||null;
 const normalized=t=>LearnerTasks.modelTask(t);
 const percent=n=>Number.isFinite(n)?Math.round(n*100)+'%':'unavailable';
 const components=t=>normalized(t).components.map(c=>c.id);
 function related(a,b){
  const x=normalized(a),y=normalized(b);
  return x.components.some(c=>y.components.some(d=>c.id===d.id||(c.transferGroup&&c.transferGroup===d.transferGroup)))||
   (x.memoryKey&&x.memoryKey===y.memoryKey);
 }
 function assistanceFor(task,history=events()){
  const flags={...Observations.emptyAssistance(),...(task.requiredAssistance||{})},t=currentTime(),keys=new Set(components(task));
  const currentModel=normalized(task),exposure=LearnerTasks.taskExposure?.(task)||task;
  for(const event of history){
   const e=event.evidence;if(event.at>t||t-event.at>LEARNER_SESSION_MS)continue;
   const previous=taskById(e.taskRef?.id);if(!previous)continue;
   const previousModel=normalized(previous),priorExposure=LearnerTasks.taskExposure?.(previous)||previous;
   const form=exposure.responseFormKey;
   if(form){
    if(e.observation==='displayed'&&priorExposure.promptFormKeys?.includes(form))flags.sourceVisible=true;
    if((e.observation==='answer-revealed'||e.assistance.answerShown||e.assistance.feedbackShown)&&priorExposure.feedbackFormKeys?.includes(form))flags.feedbackShown=true;
    if(e.observation==='response'&&priorExposure.responseFormKey===form)flags.other=true;
   }
   const same=previous.id===task.id,overlap=components(previous).some(id=>keys.has(id))||
    (previousModel.memory&&currentModel.memory&&previousModel.memoryKey===currentModel.memoryKey);
   if(!same&&!overlap)continue;
   if(e.observation==='answer-revealed'||e.assistance.answerShown||e.assistance.feedbackShown)flags.feedbackShown=true;
   if(e.assistance.hint||e.assistance.lookup||e.assistance.other)flags.hint=true;
  }
  return flags;
 }
 function recentResponse(task,history=events()){
  const t=currentTime();return history.some(e=>e.evidence.taskRef?.id===task.id&&e.evidence.taskRef.version===task.version&&
   e.evidence.observation==='response'&&e.at<=t&&t-e.at<=LEARNER_SESSION_MS);
 }
 function checkAvailable(task,history=events()){
  const a=assistanceFor(task,history);return !recentResponse(task,history)&&!Object.entries(a).some(([k,v])=>v&&k!=='baseMeaningSupplied');
 }
 function availableActions(goal){
  const all=[{id:'continue',kind:'continue',title:'Keep going',seconds:0}],history=events();
  for(const [i,cue] of (goal.componentSupport||[]).entries()){
   if(!components(goal).includes(cue.componentId))continue;
   const kind=normalized(goal).components.find(c=>c.id===cue.componentId)?.kind;
   all.push({id:'support:'+i,kind:'support',title:cue.title||(kind==='pattern'?'See the form pattern':'See the base meaning'),
    providedComponentIds:[cue.componentId],affectedTaskIds:[goal.id],seconds:cue.seconds||10,supportText:cue.text,taskId:goal.id});
  }
  for(const t of registry().filter(t=>related(goal,t)&&checkAvailable(t,history)).slice(0,20)){
   all.push({id:'diagnostic:'+t.id,kind:'diagnostic',title:t.title,taskId:t.id,seconds:t.estimatedSeconds||20});
  }
  return all;
 }
 function predictionHTML(){
  if(!fit||!goalId)return '';
  const p=LearnerModel.summarizePrediction(fit,goalId,{now:currentTime()});
  return '<p class="learner-estimate"><strong>'+percent(p.mean)+'</strong> estimated chance on this task. Model interval: '+
   percent(p.lower)+'–'+percent(p.upper)+'.</p><p class="small-print">'+E(p.priorOnly?
    'No usable responses yet for this prediction. It comes from the model’s starting assumptions.':p.hyperparameterOnly?
    'Only the variation across the group has evidence. This task’s specific knowledge remains untested.':
    String(p.directCount||0)+' direct response'+(p.directCount===1?'':'s')+' for this task, with related evidence shared only through declared connections.')+
   ' This is a task prediction, not a proficiency level.</p>'+
   (fit.diagnostics.converged===false?'<p class="small-print learner-provisional">This estimate is provisional: the sampling check has not yet stabilized. Nabu will not recommend a diagnostic from this fit.</p>':'')+
   (fit.diagnostics.truncated?'<p class="small-print">This fit reached its history or computation limit. Its exported record identifies what was omitted.</p>':'');
 }
 function actionHTML(a,primary=false){
  if(!a)return '';
  const verb=a.kind==='diagnostic'?'Try this check':a.kind==='support'?'Show cue':'Keep going';
  return '<article class="learner-option"><h3>'+E(a.title||verb)+'</h3><p class="small-print">'+
   E(a.kind==='diagnostic'?'An optional check whose answer may change which help is useful.':a.kind==='support'?
    'A cue for completing the current task. Lasting learning has not been estimated.':'Continue without an interruption.')+
   '</p><button class="button '+(primary?'secondary':'text-button')+'" data-action="learner-choose" data-id="'+E(a.id)+'"'+
   (pending?' disabled':'')+'>'+verb+'</button></article>';
 }
 function explanationHTML(){
  if(!decision)return '';
  const candidates=decision.candidates||decision.scoredCandidates||[];
  return '<details class="learner-details"><summary>Why this next step?</summary><p>We compare the predicted chance of difficulty with the time each option takes. A check is valuable when its answer can change the best next action.</p>'+
   '<p>The current time limit is '+budget+' seconds. Each second costs 0.002 of one unsuccessful-task loss. These are editable design assumptions, not measured learning benefits.</p>'+
   (candidates.length?'<div class="learner-table-wrap"><table><thead><tr><th>Option</th><th>Expected loss</th><th>Value of information</th></tr></thead><tbody>'+
    candidates.filter(a=>a.available!==false).map(a=>'<tr><td>'+E(a.title||a.id)+'</td><td>'+E(Number.isFinite(a.expectedLoss)?a.expectedLoss.toFixed(3):'Excluded')+
     '</td><td>'+E(Number.isFinite(a.evsi)?a.evsi.toFixed(3):'—')+'</td></tr>').join('')+'</tbody></table></div>':'')+
   '<p class="small-print">Lower expected loss is preferred. The model uses an approximate posterior and authored task mappings. The exported record includes sampling diagnostics and the full decision calculation.</p></details>';
 }
 function body(){
  if(!enabled())return '';
  return '<div class="learner-heading"><div><p class="learner-title">'+(decision?'Support for your learning goal':'A small learning goal')+
   '</p><p class="small-print">'+(decision?E(taskById(goalId)?.title||'Your selected task'):'Choose a goal; Nabu can use your responses to suggest a cue, a check, or continuing.')+
   '</p></div><button class="text-button" data-action="learner-open"'+(pending?' disabled':'')+'>'+(decision?'Change goal':'Find useful support')+
   '</button></div><p id="learner-status" role="status">'+E(pending?'Updating from your responses…':notice)+'</p><p id="learner-error" role="alert">'+E(error)+'</p>'+
   (decision?predictionHTML()+'<div class="learner-options">'+actionHTML(decision.primary,true)+
    (decision.alternatives||[]).filter(a=>a.id!==decision.primary?.id&&a.kind!=='continue').slice(0,2).map(a=>actionHTML(a)).join('')+'</div>'+explanationHTML()+
    '<div class="button-row"><button class="text-button" data-action="learner-update"'+(pending?' disabled':'')+'>Refresh support</button>'+
    (!noPractice()?'<button class="text-button" data-action="learner-try-goal"'+(pending?' disabled':'')+'>Try my chosen goal</button>':'')+
    '<button class="text-button" data-action="learner-export"'+(pending?' disabled':'')+'>Export my model record</button><button class="text-button" data-action="learner-continue">Keep going</button></div>':'');
 }
 function paint(){const el=host();if(el){el.innerHTML=body();el.hidden=!enabled();el.setAttribute('aria-busy',String(pending));}}
 function uncover(){for(const {el,aria,visibility} of covered){if(aria===null)el.removeAttribute('aria-hidden');else el.setAttribute('aria-hidden',aria);el.style.visibility=visibility;}covered=[];}
 function cover(){
  uncover();const modal=$('#modal');
  for(const el of document.querySelectorAll('main,.reader-body,#word-panel-host,#word-sheet')){
   if(modal&&el.contains(modal))continue;
   covered.push({el,aria:el.getAttribute('aria-hidden'),visibility:el.style.visibility});el.setAttribute('aria-hidden','true');el.style.visibility='hidden';
  }
 }
 function reset(message=''){
  generation++;actionGeneration++;actionPending=false;controller?.abort();controller=null;pending=false;fit=null;decision=null;input=null;resultKey='';error='';notice=message;check=null;uncover();
  if(ownedModal&&$('#modal .learner-dialog'))closeModal();ownedModal=false;paint();
 }
 function refresh(){
  if((fit||pending||check)&&(!enabled()||(check&&check.scope!==scope())||(resultKey&&resultKey!==signature())))reset('Your context or responses changed. Refresh support for a new estimate.');
 }
 function render(){refresh();return '<section id="nabu-learner-panel" class="learner-panel" aria-label="Learning support"'+(!enabled()?' hidden':'')+'>'+body()+'</section>';}
 function selectGoal(){
  if(!enabled())return;
  reset();
  language=language||state.translation?.sourceLang||state.settings?.targetLang||'ar';
  if(!registry().some(t=>normalized(t).language===language))language='ar';
  showGoals();
 }
 function showGoals(){
  const choices=LearnerTasks.listLearnerTasks({language,mode});
  if(!choices.some(t=>t.id===goalId))goalId=choices[0]?.id||'';
  ownedModal=true;
  showModal('Choose a small learning goal','<section class="learner-dialog learner-goals"><p>A goal is one kind of response in one language. You can change it at any time.</p>'+
   '<div class="learner-fields"><label>Language<select id="learner-language" class="select">'+C.LANGUAGES.filter(([id])=>registry().some(t=>normalized(t).language===id)).map(([id,name])=>'<option value="'+E(id)+'"'+(id===language?' selected':'')+'>'+E(name)+'</option>').join('')+'</select></label>'+
   '<label>Response type<select id="learner-mode" class="select"><option value="production"'+(mode==='production'?' selected':'')+'>Recall a form</option><option value="recognition"'+(mode==='recognition'?' selected':'')+'>Recognize a meaning</option></select></label></div>'+
   '<label for="learner-goal">Goal</label><select id="learner-goal" class="select">'+choices.map(t=>'<option value="'+E(t.id)+'"'+(t.id===goalId?' selected':'')+'>'+E(t.title)+'</option>').join('')+'</select>'+
   '<label for="learner-budget">Time available for help</label><select id="learner-budget" class="select">'+[20,60,180].map(s=>'<option value="'+s+'"'+(budget===s?' selected':'')+'>'+s+' seconds</option>').join('')+'</select>'+
   (noPractice()?'<p>Your intention excludes practice. Cues and continuing remain available.</p>':'')+
   '<p class="small-print">The current authored tasks cover a small set of forms and meanings. Their grammar and answer rules have not been independently reviewed.</p>'+
   '<div class="button-row"><button class="button primary" data-action="learner-request"'+(!choices.length?' disabled':'')+'>Find my next step</button><button class="text-button" data-action="learner-continue">Keep going</button></div></section>');
 }
 async function update({keepCheck=false}={}){
  if(pending||!enabled()||!taskById(goalId))return;
  if(!keepCheck){ownedModal=false;uncover();if($('#modal .learner-dialog'))closeModal();}
  const epoch=++generation,expected=scope();controller?.abort();controller=new AbortController();const signal=controller.signal;
  pending=true;error='';notice='';resultKey='';paint();if(keepCheck&&check)showCheck();
  try{
   const captured=events(),capturedIds=JSON.stringify(captured.map(e=>e.id));
   input=LearnerObservations.buildLearnerInput({events:captured,actor:context().actor,now:currentTime()});
   const tasks=[...new Map([...registry().map(normalized),...input.tasks].map(t=>[t.id,t])).values()];
   const fitInput={tasks,observations:input.observations,actor:context().actor,now:currentTime(),options:h.fitOptions||{}};
   let fitted=await LearnerModel.fitLearnerAsync(fitInput,{signal});
   // One bounded refinement uses the same likelihood and seed. It changes
   // computational accuracy, not the evidence or its statistical weight.
   if(!h.fitOptions&&fitted.diagnostics.converged===false&&!signal.aborted)
    fitted=await LearnerModel.fitLearnerAsync({...fitInput,options:{burnIn:384,samples:256}},{signal});
   if(epoch!==generation||scope()!==expected||!enabled())return;
   if(capturedIds!==JSON.stringify(events().map(e=>e.id))){fit=null;decision=null;notice='New responses arrived during the update. Refresh support to include them.';return;}
   fit=fitted;
   decision=LearnerPolicy.selectLearnerDecision({fit,targets:[{taskId:goalId,weight:1}],actions:availableActions(taskById(goalId)),
    constraints:{avoidPractice:noPractice(),timeBudgetSeconds:budget,costPerSecond:0.002},now:currentTime()});
   resultKey=signature();
   notice=input.observations.length?'Updated from '+input.observations.length+' usable response'+(input.observations.length===1?'':'s')+'.':'No usable responses yet; starting assumptions are shown explicitly.';
   window.dispatchEvent(new window.CustomEvent('nabu-learner-decision',{detail:{model:LearnerModel.MODEL_VERSION,actor:context().actor,goalId,actionId:decision.primary?.id,at:currentTime()}}));
  }catch(e){if(epoch===generation&&e.name!=='AbortError'){error=e.message;fit=null;decision=null;}}
  finally{if(epoch===generation){pending=false;controller=null;paint();if(keepCheck&&check)showCheck();}}
 }
 function beginTask(task){
  const c=context(),t=currentTime(),same=(a,b)=>a?.id===b?.id&&a?.revision===b?.revision;
  const prior=events().filter(event=>event.evidence.taskRef?.id===task.id&&event.evidence.taskRef.version===task.version&&event.at<=t&&t-event.at<=LEARNER_SESSION_MS&&
   same(event.evidence.intentRef,c.intentRef)&&same(event.evidence.organizationObjectiveRef,c.organizationObjectiveRef)).sort((a,b)=>b.at-a.at)[0];
  return {task,scope:scope(),episodeId:prior?.evidence.episodeId||C.uid(),attemptId:C.uid(),presentedAt:clock(),...c,
   assistance:assistanceFor(task),answer:'',choice:null,busy:false,saved:null,result:null,error:'',revealed:false};
 }
 function envelope(p,observation,response=null,extra={}){
  const t=p.task,assessment=observation==='response'?t.score(response):null;
  return {schemaVersion:1,episodeId:p.episodeId,retryOfEpisodeId:null,attemptId:p.attemptId,actor:structuredClone(p.actor),
   intentRef:structuredClone(p.intentRef),organizationObjectiveRef:structuredClone(p.organizationObjectiveRef),taskRef:{id:t.id,version:t.version},
   occurrence:structuredClone(t.occurrence),inputModality:t.inputModality,outputModality:observation==='response'?t.outputModality:'none',observation,
   assistance:{...p.assistance,...extra},presentedAt:p.presentedAt,response,skipReason:observation==='skipped'?'not-now':null,
   assessment:assessment?{outcome:assessment.correct===null?'unscored':assessment.correct?'correct':'incorrect',basis:'authored-rule'}:null,
   rubricRef:structuredClone(t.rubricRef),scorerRef:structuredClone(t.scorerRef),analysisRef:structuredClone(t.analysisRef)};
 }
 async function save(p,event){
  if(p.scope!==scope()||!enabled())throw Error('Your account or intention changed. Open a new check in the current context.');
  const t=p.task;await store.append({id:t.occurrence.contentId,version:t.occurrence.version},'evidence',
   {sessionId:p.episodeId,evidence:event.evidence,at:event.at},event.id);
  if(state.user&&state.backend?.contentProgress)store.sync().catch(()=>{});
 }
 async function startCheck(taskId){
  const task=taskById(taskId);if(!task||!enabled())return;
  if(noPractice())throw Error('Your current intention excludes practice. Cues and continuing remain available.');
  h.stopSpeech?.();const p=beginTask(task);check=p;ownedModal=true;cover();
  p.busy=true;showCheck();
  try{
   await save(p,{id:C.uid(),at:clock(),evidence:envelope(p,'displayed')});
   if(check===p&&p.scope===scope()){p.busy=false;showCheck();}
  }catch(e){if(check===p){p.busy=false;p.error=e.message;showCheck();}}
 }
 function retain(){
  if(!check)return;const answer=$('#learner-answer'),choice=$('input[name="learner-choice"]:checked');
  if(answer)check.answer=answer.value;if(choice)check.choice=Number(choice.value);
 }
 function showCheck(){
  if(!check)return;const p=check,t=p.task,disabled=p.busy||p.saved?' disabled':'',result=p.result;
  const fields=t.options?'<fieldset class="content-options"><legend>Choose your response</legend>'+t.options.map((value,i)=>'<label><input type="radio" name="learner-choice" value="'+i+'"'+(p.choice===i?' checked':'')+disabled+'><span dir="auto">'+E(value)+'</span></label>').join('')+'</fieldset>':
   '<label for="learner-answer">Your response</label><input id="learner-answer" class="input" maxlength="300" autocomplete="off" dir="auto" lang="'+E(normalized(t).language)+'" value="'+E(p.answer)+'"'+disabled+'>';
  showModal('An optional short check','<section class="learner-dialog learner-check"><p class="small-print">Your activity is kept in place and covered during this check.</p><h2 dir="auto">'+E(t.prompt)+'</h2>'+
   (t.requiredAssistance?.baseMeaningSupplied?'<p class="small-print">The base meaning is supplied. This checks only the remaining declared ingredients.</p>':'')+
   (result?'<div class="content-feedback" role="status"><h3>'+E(result.skipped?'Skipped without grading':result.correct?'Matched this authored answer':'Did not match this authored answer')+'</h3>'+
    (result.skipped?'':'<p dir="auto">'+E(t.explanation)+'</p>')+'<p>'+E(result.note)+'</p></div>':fields)+
   (p.revealed&&!result?'<p class="model-answer" dir="auto">'+E(t.options?t.options[t.answer]:t.accepted[0])+'</p><p class="small-print">A response after this help is recorded as assisted.</p>':'')+
   '<p role="alert">'+E(p.error||(result?error:''))+'</p>'+
   (result?'<p role="status">'+E(pending?'Updating your next step…':fit&&decision&&resultKey===signature()?'Your next-step estimate has been refreshed.':'Your response is saved. Refresh support for a new estimate.')+'</p><button class="button secondary" data-action="learner-results"'+(pending?' disabled':'')+'>See my next step</button>':
    '<div class="button-row"><button class="button primary" data-action="learner-submit"'+(p.busy?' disabled':'')+'>'+(p.busy?'Saving…':p.saved?'Retry saving this response':'Check response')+'</button>'+
    (!p.saved?'<button class="text-button" data-action="learner-reveal"'+(p.busy?' disabled':'')+'>Show the answer</button><button class="text-button" data-action="learner-skip"'+(p.busy?' disabled':'')+'>Skip</button>':'')+'</div>')+
   '<button class="text-button" data-action="learner-continue">Return to my activity</button><details><summary>What this response can show</summary><p>'+E(t.assessmentScope)+'</p><p class="small-print">'+E(t.qualityNote||'Authored task draft; not independently reviewed.')+'</p></details></section>');
 }
 async function reveal(){
  if(!check||check.busy||check.saved)return;retain();const p=check;p.busy=true;p.assistance.answerShown=true;showCheck();
  p.revealEvent??={id:C.uid(),at:clock(),evidence:envelope(p,'answer-revealed')};
  try{await save(p,p.revealEvent);if(check===p&&p.scope===scope()&&enabled())p.revealed=true;}catch(e){p.error=e.message;}finally{p.busy=false;if(check===p&&p.scope===scope()&&enabled())showCheck();}
 }
 async function submit(skipped=false){
  if(!check||check.busy||check.result)return;retain();const p=check,t=p.task;
  if(!p.saved&&!skipped&&(t.options?p.choice===null:!p.answer.trim())){p.error='Enter a response or choose Skip.';showCheck();return;}
  p.saved??={id:C.uid(),at:clock(),evidence:envelope(p,skipped?'skipped':'response',skipped?null:t.options?{choice:p.choice}:{answer:p.answer})};
  p.busy=true;p.error='';showCheck();
  try{
   await save(p,p.saved);if(check!==p||p.scope!==scope())return;
   const skippedActual=p.saved.evidence.observation==='skipped',assessed=skippedActual?null:t.score(p.saved.evidence.response);
   if(!skippedActual){
    p.feedbackEvent??={id:C.uid(),at:clock(),evidence:envelope(p,'answer-revealed',null,{feedbackShown:true,answerShown:true})};
    await save(p,p.feedbackEvent);if(check!==p||p.scope!==scope())return;
   }
   const projected=LearnerObservations.buildLearnerInput({events:events(),actor:context().actor,now:currentTime()});
   const included=projected.observations.some(o=>o.id===p.saved.id);
   p.result={skipped:skippedActual,correct:assessed?.correct,note:skippedActual?'Skipping adds no success or failure.':included?
    'This first response updates the model for the ingredients this task tested.':'This response is preserved in your history; its assistance, repetition, or conditions prevent an independent model update.'};
   p.busy=false;showCheck();await update({keepCheck:true});
  }catch(e){p.error='Your first response is preserved for an identical retry. '+e.message;}
  finally{p.busy=false;if(check===p)showCheck();paint();}
 }
 async function choose(button){
  if(!enabled()){reset();return;}
  if(actionPending)return;
  if(pending||!decision||signature()!==resultKey){notice='Refresh support to use your current responses.';paint();return;}
  const id=button.dataset.id,a=(decision.candidates||[decision.primary,...decision.alternatives]).find(a=>a.id===id)||
   [decision.primary,...(decision.alternatives||[])].find(a=>a.id===id);
  if(!a||a.available===false)return;
  if(a.kind==='continue'){leave();return;}
  if(a.kind==='diagnostic'){await startCheck(a.taskId);return;}
  const t=taskById(a.taskId||goalId),p=beginTask(t),actionToken=++actionGeneration,selectedGoal=goalId,selectedDecision=decision;
  p.assistance.hint=true;actionPending=true;ownedModal=true;
  showModal('Opening your cue','<section class="learner-dialog"><p role="status">Recording which support is being supplied…</p><button class="text-button" data-action="learner-continue">Return to my activity</button></section>');
  try{
   await save(p,{id:C.uid(),at:clock(),evidence:envelope(p,'hint')});
   if(actionToken!==actionGeneration||p.scope!==scope()||!enabled()||selectedGoal!==goalId||selectedDecision!==decision)return;
   uncover();showModal('A cue for your task','<section class="learner-dialog"><h2>'+E(a.title)+'</h2><p class="learner-cue" dir="auto">'+E(a.supportText||'')+'</p><p>This cue supplies one part of the task. It does not count as an unaided response.</p><button class="button secondary" data-action="learner-continue">Return to my activity</button></section>');
   await update({keepCheck:true});
  }catch(e){
   if(actionToken===actionGeneration&&p.scope===scope()&&enabled())showModal('Your cue could not open','<section class="learner-dialog"><p role="alert">'+E(e.message)+'</p><button class="text-button" data-action="learner-continue">Return to my activity</button></section>');
  }finally{if(actionToken===actionGeneration)actionPending=false;}
 }
 function leave(){actionGeneration++;actionPending=false;check=null;uncover();if(ownedModal&&$('#modal .learner-dialog'))closeModal();ownedModal=false;paint();$('[data-action="learner-open"]')?.focus({preventScroll:true});}
 Object.assign(actions,{
  'learner-open':selectGoal,'learner-request':()=>{goalId=$('#learner-goal')?.value||goalId;budget=Number($('#learner-budget')?.value)||budget;return update();},
  'learner-update':()=>update(),'learner-choose':choose,'learner-continue':leave,'learner-submit':()=>submit(false),
  'learner-skip':()=>submit(true),'learner-reveal':reveal,'learner-results':leave,'learner-try-goal':()=>startCheck(goalId),
  'learner-export':async()=>{
   if(!fit||!decision||!enabled()||signature()!==resultKey){notice='Refresh support before exporting the current model record.';paint();return;}
   await download('nabu-learner-model-record.json',JSON.stringify({schemaVersion:1,exportedAt:currentTime(),context:context(),goalId,
    taskVersion:LearnerTasks.LEARNER_TASK_VERSION,events:events(),input,fit,decision},null,2),'application/json');
   notice='Your model record is ready, including responses, assumptions, posterior draws, and decision calculations.';paint();
  }
 });
 document.addEventListener('change',event=>{
  if(event.target.id==='learner-language'){language=event.target.value;showGoals();}
  if(event.target.id==='learner-mode'){mode=event.target.value;showGoals();}
 });
 $('#modal')?.addEventListener('close',event=>{
  // Native dialog close events are queued; the same element may already show a new goal.
  if(event.currentTarget.open)return;
  actionGeneration++;actionPending=false;check=null;ownedModal=false;uncover();
 });
 for(const name of ['nabu-account-change','nabu-intent-change'])window.addEventListener(name,()=>reset());
 return {render,refresh,open:selectGoal,update,startCheck,enabled,reset,
  getSnapshot:()=>({goalId,pending,fit:fit?structuredClone(fit):null,decision:decision?structuredClone(decision):null,input:input?structuredClone(input):null})};
}
