/** Separate model input derived from the immutable audited ledger.
 * No source event, direct count, schedule, or historical assessment is rewritten.
 */
import * as Observations from './nabu-observations.js';
import {resolveEvidenceTask} from './nabu-evidence-tasks.js';
import {listLearnerTasks,resolveLearnerTask,modelTask,mappedContrastTasks,permitsMeaningSuppliedEvidence,taskExposure} from './nabu-learner-tasks.js';

export const LEARNER_INPUT_POLICY='audited-learner-input-v1';
export const LEARNER_EXPOSURE_WINDOW_MS=30*60*1000;
export const MAX_EXPOSURE_WITNESSES=12;
const copy=value=>structuredClone(value);
const defaultResolver=(ref,event)=>resolveLearnerTask(ref,event)||resolveEvidenceTask(ref,event);

export function buildLearnerInput({events,actor,now,resolveTask=defaultResolver}={}){
  if(typeof resolveTask!=='function')throw Error('Learner inference requires a synchronous task resolver.');
  // projectEvidence validates actors/events, filters exact account/team scope,
  // deduplicates IDs, checks attempts and retry lineages, and reconciles help.
  // Explicit rescoring remains outside this inference bridge.
  const projection=Observations.projectEvidence(events,{actor,now,resolveTask,allowRescore:false});
  const eventById=new Map();
  for(const event of events)if(event?.evidence&&event.evidence.actor.userId===actor.userId&&event.evidence.actor.tenantId===actor.tenantId&&!eventById.has(event.id))eventById.set(event.id,event);
  const maintainedTasks=[...listLearnerTasks(),...mappedContrastTasks()],tasks=maintainedTasks.map(modelTask).filter(Boolean),taskMap=new Map(tasks.map(t=>[t.id,t]));
  const resolved=new Map();
  for(const row of projection.ledger){try{resolved.set(row.eventId,row.taskRef?resolveTask(row.taskRef,eventById.get(row.eventId)):null);}catch{resolved.set(row.eventId,null);}}
  // Index declared forms and possible component cues against the maintained
  // tasks they can assist. Each source contributes at most one entry per task,
  // even when both its exact form and a component match. The raw ledger remains
  // complete; each exclusion keeps a bounded set of distinct source witnesses.
  const exposureIndex=new Map(),exposurePositions=new Map(),tiedFeedback=new Map();
  const formTargets=new Map(),componentTargets=new Map();
  function target(index,key,id){if(!key)return;if(!index.has(key))index.set(key,new Set());index.get(key).add(id);}
  for(const task of maintainedTasks){
    target(formTargets,taskExposure(task)?.responseFormKey,task.id);
    for(const component of taskMap.get(task.id)?.components||[])target(componentTargets,component.id,task.id);
  }
  for(const source of projection.ledger){
    const metadata=taskExposure(resolved.get(source.eventId));if(!metadata)continue;
    const visible=new Set(['displayed','response','skipped','hint','answer-revealed'].includes(source.observation)?metadata.promptFormKeys:[]);
    if(source.observation==='answer-revealed'||source.assistance.answerShown||source.assistance.feedbackShown)for(const key of metadata.feedbackFormKeys)visible.add(key);
    const affected=new Map();
    function affect(taskId,reason,{formKey=null,componentId=null,hint=false}={}){
      if(!affected.has(taskId))affected.set(taskId,{eventId:source.eventId,at:source.at,reasons:[],formKey:null,componentIds:[],hintFormKeys:[],hintIdentity:null,sourceTaskRef:copy(source.taskRef),attemptId:source.attemptId,feedback:source.assistance.feedbackShown});
      const entry=affected.get(taskId);if(!entry.reasons.includes(reason))entry.reasons.push(reason);
      if(formKey)entry.formKey=formKey;
      if(componentId&&!entry.componentIds.includes(componentId))entry.componentIds.push(componentId);
      if(hint){entry.hintIdentity='generic-hint-union';if(formKey&&!entry.hintFormKeys.includes(formKey))entry.hintFormKeys.push(formKey);}
    }
    for(const formKey of visible)for(const taskId of formTargets.get(formKey)||[])affect(taskId,'recent-form-exposure',{formKey});
    if(source.observation==='response'&&metadata.responseFormKey&&!visible.has(metadata.responseFormKey))
      for(const taskId of formTargets.get(metadata.responseFormKey)||[])affect(taskId,'recent-equivalent-form-response',{formKey:metadata.responseFormKey});
    if(source.observation==='hint'||source.assistance.hint){
      // The event schema does not identify which declared cue was selected.
      // Replayed/imported histories therefore use their conservative union,
      // independently of the later response's client assistance flags.
      for(const formKey of metadata.hintFormKeys||[])for(const taskId of formTargets.get(formKey)||[])affect(taskId,'recent-form-exposure',{formKey,hint:true});
      for(const componentId of metadata.hintComponentIds||[])for(const taskId of componentTargets.get(componentId)||[])affect(taskId,'recent-component-support',{componentId,hint:true});
    }
    for(const [taskId,entry] of affected){
      entry.reason=entry.reasons[0];
      if(!exposureIndex.has(taskId))exposureIndex.set(taskId,[]);
      const entries=exposureIndex.get(taskId);exposurePositions.set(source.eventId+'|'+taskId,entries.length);entries.push(entry);
      if(entry.feedback&&entry.attemptId){const key=entry.attemptId+'|'+entry.at+'|'+taskId;if(!tiedFeedback.has(key))tiedFeedback.set(key,[]);tiedFeedback.get(key).push(entry.eventId);}
    }
  }
  function bound(entries,time,inclusive){let lo=0,hi=entries.length;while(lo<hi){const mid=(lo+hi)>>>1;if(entries[mid].at<time||(inclusive&&entries[mid].at===time))lo=mid+1;else hi=mid;}return lo;}
  function priorExposures(row,task){
    const target=task.id,entries=exposureIndex.get(target)||[];
    const lo=bound(entries,row.at-LEARNER_EXPOSURE_WINDOW_MS,false),hi=bound(entries,Math.min(row.at,now),true),skip=new Set([row.eventId]);
    // Automatic feedback at a tied timestamp is after its own response.
    for(const eventId of tiedFeedback.get(row.attemptId+'|'+row.at+'|'+target)||[])skip.add(eventId);
    let total=hi-lo;for(const eventId of skip){const position=exposurePositions.get(eventId+'|'+target);if(position!==undefined&&position>=lo&&position<hi)total--;}
    const sources=[];
    for(let i=hi-1;i>=lo&&sources.length<MAX_EXPOSURE_WITNESSES;i--){const source=entries[i];if(skip.has(source.eventId))continue;const {attemptId,feedback,...witness}=source;sources.push(witness);}
    sources.reverse();return {sources,total,omitted:Math.max(0,total-sources.length)};
  }
  const observations=[],excluded=[],audit=[];let conditioned=0,unaided=0;
  for(const row of projection.ledger){
    const reasons=[];
    if(row.observation!=='response')reasons.push('not-assessed-response');
    const task=resolved.get(row.eventId);
    const mapped=modelTask(task);
    if(!mapped)reasons.push('no-maintained-model-mapping');
    if(!task||task.version!==row.taskRef?.version||mapped?.version!==row.taskRef?.version)reasons.push('task-version-unavailable');
    if(row.assessment.status!=='scored'||typeof row.assessment.correct!=='boolean')reasons.push('unscored-or-stale-assessment');
    if(row.firstResponse!==true)reasons.push('not-unambiguous-first-response');
    if(row.retryOfEpisodeId!==null)reasons.push('retry-episode');
    if(row.at>now)reasons.push('future-event');
    // Old events remain historical observations for time-aware inference. A
    // policy staleness window is not a claim that the original answer vanished.
    const help=Object.keys(row.assistance).filter(key=>row.assistance[key]);
    const onlySuppliedMeaning=help.length===1&&help[0]==='baseMeaningSupplied'&&permitsMeaningSuppliedEvidence(task);
    if(help.length&&!onlySuppliedMeaning)reasons.push('unsupported-assistance');
    const blocking=row.exclusionReasons.filter(reason=>reason!=='assisted-response');
    reasons.push(...blocking);
    const exposure=reasons.length?null:priorExposures(row,task),exposureSources=exposure?.sources||[];reasons.push(...exposureSources.flatMap(source=>source.reasons));
    if(reasons.length){excluded.push({eventId:row.eventId,taskRef:copy(row.taskRef),reasons:[...new Set(reasons)].sort(),exposureSources,exposureSourceCount:exposure?.total??null,omittedExposureSources:exposure?.omitted??null});continue;}
    if(!row.counted&&!onlySuppliedMeaning){excluded.push({eventId:row.eventId,taskRef:copy(row.taskRef),reasons:['not-counted-direct-or-approved-conditioned-evidence']});continue;}
    if(!taskMap.has(mapped.id)){taskMap.set(mapped.id,mapped);tasks.push(mapped);}
    observations.push({id:row.eventId,taskId:mapped.id,correct:row.assessment.correct?1:0,at:row.at,learnerId:actor.userId??'guest',episodeId:row.episodeId});
    if(onlySuppliedMeaning)conditioned++;else unaided++;
    audit.push({eventId:row.eventId,taskRef:copy(row.taskRef),condition:copy(row.condition),sourceEventIds:copy(row.sourceEventIds),sourceIds:copy(row.sourceIds),recordedReferences:copy(row.recordedReferences),appliedReferences:copy(row.assessment.appliedRefs),assistance:copy(row.assistance),evidenceKind:onlySuppliedMeaning?'meaning-supplied-form-response':'first-unassisted-response',directLedgerCounted:row.counted,modelMapping:copy(mapped),independenceEstablished:false});
  }
  const languageCounts={};for(const observation of observations){const language=taskMap.get(observation.taskId).language;languageCounts[language]=(languageCounts[language]||0)+1;}
  return {policy:LEARNER_INPUT_POLICY,exposureWindowMs:LEARNER_EXPOSURE_WINDOW_MS,tasks,observations,excluded,scope:copy(actor),summary:{accepted:observations.length,unaided,conditioned,excluded:excluded.length,scoredTasks:new Set(observations.map(o=>o.taskId)).size,languageCounts,ignoredLegacyCount:projection.ignoredLegacyCount},projection,audit};
}
