/** Immutable observations and a conservative, direct-evidence replay.
 * No I/O, graph traversal, scheduler, forgetting curve, or competence model.
 * A scorer is supplied by the caller and must resolve the recorded task.
 */
export const OBSERVATION_SCHEMA_VERSION = 1;
export const OBSERVATION_POLICY = 'direct-observations-v1';
export const DEFAULT_STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
export const DEFAULT_DELAY_THRESHOLD_MS = 24 * 60 * 60 * 1000;
export const EVIDENCE_DIMENSIONS = Object.freeze(['visual-recognition','auditory-recognition','retrieval','contextual-production']);
export const EVIDENCE_PRACTICE_MODES = Object.freeze(['recognition','production','listening','cloze']);
export const EVIDENCE_OBSERVATIONS = Object.freeze(['displayed','played','lookup','hint','answer-revealed','response','skipped']);
const ASSISTANCE_KEYS=['lookup','hint','answerShown','translationShown','replayed','feedbackShown','baseMeaningSupplied','sourceVisible','other'];
const CONTEXT_KEYS=['lexicalId','senseId','speakerId','syntaxId','contextId'];
const INPUT_MODALITIES=['text','audio','audiovisual','none'];
const OUTPUT_MODALITIES=['choice','text','speech','none'];
const REFERENCE_STATUSES=['authored','verified','inferred','unknown','quarantined'];
const ENVELOPE_KEYS=['schemaVersion','episodeId','attemptId','retryOfEpisodeId','actor','intentRef','organizationObjectiveRef','taskRef','occurrence','inputModality','outputModality','observation','assistance','presentedAt','response','skipReason','assessment','rubricRef','scorerRef','analysisRef'];
const TASK_BOUND=['response','hint','answer-revealed','skipped'];
const clone=value=>structuredClone(value);
function isObject(value){
 if(!value||Object.prototype.toString.call(value)!=='[object Object]')return false;
 const proto=Object.getPrototypeOf(value);if(proto===null)return true;
 const constructor=Object.getOwnPropertyDescriptor(proto,'constructor')?.value;
 return Object.getPrototypeOf(proto)===null&&typeof constructor==='function'&&Function.prototype.toString.call(constructor)===Function.prototype.toString.call(Object);
}
const same=(a,b)=>canonical(a)===canonical(b);
function canonical(value){if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';if(isObject(value))return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}';return JSON.stringify(value);}
function exact(value,keys,label){if(!isObject(value)||Object.keys(value).length!==keys.length||keys.some(key=>!Object.hasOwn(value,key)))throw Error(label+' has missing or unsupported fields.');}
function text(value,max,label){if(typeof value!=='string'||!value.trim()||value.length>max||/[\u0000-\u001f\u007f]/u.test(value))throw Error(label+' must be bounded nonempty text.');return value;}
function optionalText(value,max,label){if(value!==null)text(value,max,label);}
function eventId(value,label){if(typeof value!=='string'||!/^[A-Za-z0-9_-]{16,80}$/u.test(value))throw Error(label+' must be an identifier of 16–80 characters.');}
function stamp(value,label){if(!Number.isSafeInteger(value)||value<0)throw Error(label+' must be a nonnegative integer timestamp.');}
function contentVersion(value,label){if(!Number.isInteger(value)||value<1||value>1000000)throw Error(label+' must be a positive bounded integer.');}
function version(value,label){if(typeof value==='string')text(value,80,label);else contentVersion(value,label);}
function member(value,options,label){if(!options.includes(value))throw Error(label+' is unsupported.');}
function validateActor(actor){
 exact(actor,['userId','tenantId'],'Actor');optionalText(actor.userId,160,'User ID');
 if(actor.userId==='!locked')throw Error('A locked account is not an evidence actor.');
 if(actor.tenantId!==null&&(typeof actor.tenantId!=='string'||!/^[A-Za-z0-9_-]{3,64}$/u.test(actor.tenantId)||actor.userId===null))throw Error('A team context requires a named account and valid tenant ID.');
}
function reference(ref,label,full=false){
 if(ref===null)return;
 exact(ref,full?['id','version','status','provenance']:['id','version'],label);text(ref.id,160,label+' ID');version(ref.version,label+' version');
 if(!full)return;
 member(ref.status,REFERENCE_STATUSES,label+' status');
 if(!Array.isArray(ref.provenance)||ref.provenance.length>12)throw Error(label+' provenance must contain at most 12 source references.');
 for(const entry of ref.provenance){exact(entry,['sourceId','locator','kind'],label+' source');text(entry.sourceId,200,'Source ID');text(entry.locator,300,'Source locator');text(entry.kind,80,'Source kind');}
}
function intentReference(ref,label){if(ref===null)return;exact(ref,['id','revision'],label);text(ref.id,160,label+' ID');contentVersion(ref.revision,label+' revision');}

export function emptyAssistance(){return Object.fromEntries(ASSISTANCE_KEYS.map(key=>[key,false]));}

export function validateEvidenceEnvelope(envelope){
 exact(envelope,ENVELOPE_KEYS,'Evidence envelope');
 const e=envelope;if(e.schemaVersion!==OBSERVATION_SCHEMA_VERSION)throw Error('Unsupported evidence schema version.');
 eventId(e.episodeId,'Episode ID');if(e.attemptId!==null)eventId(e.attemptId,'Attempt ID');
 if(e.retryOfEpisodeId!==null){eventId(e.retryOfEpisodeId,'Retry episode ID');if(e.retryOfEpisodeId===e.episodeId)throw Error('An episode cannot retry itself.');}
 validateActor(e.actor);intentReference(e.intentRef,'Intent reference');intentReference(e.organizationObjectiveRef,'Organization reference');
 if(e.organizationObjectiveRef&&e.actor.tenantId===null)throw Error('An organization objective needs a team context.');
 reference(e.taskRef,'Task reference');
 exact(e.occurrence,['contentId','version','segmentId','annotationId','readingId','context'],'Occurrence');
 text(e.occurrence.contentId,160,'Content ID');contentVersion(e.occurrence.version,'Content version');
 for(const key of ['segmentId','annotationId','readingId'])optionalText(e.occurrence[key],160,'Occurrence '+key);
 exact(e.occurrence.context,CONTEXT_KEYS,'Occurrence context');for(const key of CONTEXT_KEYS)optionalText(e.occurrence.context[key],160,'Context '+key);
 member(e.inputModality,INPUT_MODALITIES,'Input modality');member(e.outputModality,OUTPUT_MODALITIES,'Output modality');member(e.observation,EVIDENCE_OBSERVATIONS,'Observation');
 exact(e.assistance,ASSISTANCE_KEYS,'Assistance');for(const key of ASSISTANCE_KEYS)if(typeof e.assistance[key]!=='boolean')throw Error('Assistance flags must be explicit booleans.');
 if(e.presentedAt!==null)stamp(e.presentedAt,'Presentation time');
 for(const key of ['rubricRef','scorerRef','analysisRef'])reference(e[key],key,true);
 if(TASK_BOUND.includes(e.observation)&&(!e.taskRef||!e.attemptId||!e.rubricRef||!e.scorerRef||e.presentedAt===null))throw Error('A task observation needs its attempt, task, rubric, scorer and presentation time.');
 if(e.attemptId&&!e.taskRef)throw Error('An attempt ID needs a task reference.');
 if(e.observation==='played'&&!['audio','audiovisual'].includes(e.inputModality))throw Error('Playback needs an audio input modality.');
 if(e.observation==='response'){
  if(!isObject(e.response)||Object.keys(e.response).length!==1)throw Error('A response must contain exactly one choice or answer.');
  if(Object.hasOwn(e.response,'choice')){
   if(!Number.isInteger(e.response.choice)||e.response.choice<0||e.response.choice>99||e.outputModality!=='choice')throw Error('A choice response needs a bounded choice and choice output modality.');
  }else if(Object.hasOwn(e.response,'answer')){
   if(typeof e.response.answer!=='string'||!e.response.answer.trim()||e.response.answer.length>300||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(e.response.answer)||!['text','speech'].includes(e.outputModality))throw Error('An answer needs bounded text and a text or speech output modality.');
  }else throw Error('Unsupported response field.');
 }else if(e.response!==null||e.outputModality!=='none')throw Error('Nonresponse observations must have no response or output modality.');
 if(e.skipReason!==null)member(e.skipReason,['not-now','too-easy','too-hard','other'],'Skip reason');
 if(e.observation!=='skipped'&&e.skipReason!==null)throw Error('Only a skip may contain a skip reason.');
 if(e.assessment!==null){
  exact(e.assessment,['outcome','basis'],'Historical assessment');member(e.assessment.outcome,['correct','incorrect','unscored'],'Assessment outcome');member(e.assessment.basis,['authored-rule','self-report'],'Assessment basis');
  if(e.observation!=='response')throw Error('Only a response may carry a historical assessment.');
 }
 return clone(e);
}

export function validateEvidenceEvent(event){
 if(!isObject(event))throw Error('An evidence event must be an object.');
 if(event.kind==='evidence')exact(event,['id','at','kind','contentId','version','sessionId','evidence'],'Evidence event');
 else member(event.kind,['attempt','help','opened'],'Enveloped legacy event kind');
 eventId(event.id,'Event ID');stamp(event.at,'Event time');text(event.contentId,160,'Content ID');contentVersion(event.version,'Content version');
 const e=validateEvidenceEnvelope(event.evidence);
 if(e.occurrence.contentId!==event.contentId||e.occurrence.version!==event.version)throw Error('Occurrence and stored content references differ.');
 if(e.presentedAt!==null&&e.presentedAt>event.at)throw Error('A response cannot precede its presentation.');
 if(event.kind==='evidence'&&event.sessionId!==e.episodeId)throw Error('An evidence event session must equal its episode.');
 if(event.kind==='opened'&&e.observation!=='displayed')throw Error('An opening can record only a display opportunity.');
 if(event.kind==='help'&&((event.help==='hint'&&e.observation!=='hint')||(event.help==='answer'&&e.observation!=='answer-revealed')||!['hint','answer'].includes(event.help)))throw Error('Legacy help and its envelope disagree.');
 if(event.kind==='attempt'){
  if(event.skipped===true){if(e.observation!=='skipped')throw Error('Legacy skip and its envelope disagree.');}
  else{
   if(e.observation!=='response')throw Error('A legacy attempt must contain its response.');
   const key=Object.keys(e.response)[0];if(event[key]!==e.response[key])throw Error('Legacy response and its envelope disagree.');
  }
 }
 return {...clone(event),evidence:e};
}

function refIdentity(ref){return ref?{id:ref.id,version:ref.version,status:ref.status}:null;}
function sourceIds(e){return [...new Set(['rubricRef','scorerRef','analysisRef'].flatMap(key=>e[key]?.provenance.map(p=>p.sourceId)||[]))].sort();}
function effectiveFlags(e){const flags={...e.assistance};if(e.observation==='lookup')flags.lookup=true;if(e.observation==='hint')flags.hint=true;if(e.observation==='answer-revealed')flags.answerShown=true;return flags;}
function taskDefinition(raw,ref){
 if(!isObject(raw)||raw.id!==ref.id||raw.version!==ref.version)throw Error('The exact recorded task version is unavailable.');
 exact(raw.target,['id','language'],'Task target');text(raw.target.id,200,'Target ID');text(raw.target.language,40,'Target language');
 member(raw.dimension,EVIDENCE_DIMENSIONS,'Evidence dimension');member(raw.practiceMode,EVIDENCE_PRACTICE_MODES,'Practice mode');
 member(raw.inputModality,INPUT_MODALITIES,'Task input modality');member(raw.outputModality,OUTPUT_MODALITIES,'Task output modality');
 for(const key of ['rubricRef','scorerRef','analysisRef'])reference(raw[key],key,true);
 if(!raw.scorerRef||!raw.rubricRef||typeof raw.score!=='function')throw Error('The resolved task needs an explicit scorer and rubric.');
 text(raw.assessmentScope,1000,'Assessment scope');
 if(raw.cues!==undefined&&(!Array.isArray(raw.cues)||raw.cues.length>12||raw.cues.some(c=>typeof c!=='string'||!c.trim()||c.length>200)))throw Error('Task cues must be a short explicit list.');
 if(raw.requiredAssistance!==undefined&&(!isObject(raw.requiredAssistance)||Object.entries(raw.requiredAssistance).some(([key,value])=>!ASSISTANCE_KEYS.includes(key)||value!==true)))throw Error('Required task assistance must name supported flags with value true.');
 return raw;
}
function assess(event,task,allowRescore){
 const e=event.evidence,changed=['rubricRef','scorerRef','analysisRef'].filter(key=>!same(refIdentity(e[key]),refIdentity(task[key])));
 const appliedRefs=Object.fromEntries(['rubricRef','scorerRef','analysisRef'].map(key=>[key,clone(task[key])]));
 const unavailable=['rubricRef','scorerRef','analysisRef'].some(key=>task[key]&&['unknown','inferred','quarantined'].includes(task[key].status));
 if(unavailable)return {status:'stale',outcome:'unscored',correct:null,label:'The current analysis or scoring reference is unconfirmed or quarantined.',scope:task.assessmentScope,changedReferences:changed,appliedRefs};
 if(changed.length&&!allowRescore)return {status:'stale',outcome:'unscored',correct:null,label:'A scoring, rubric or analysis reference changed; this observation needs an explicit rescore.',scope:task.assessmentScope,changedReferences:changed,appliedRefs};
 try{
  const result=task.score(clone(e.response),clone(event));
  if(!isObject(result)||![true,false,null].includes(result.correct)||typeof result.label!=='string'||!result.label.trim()||result.label.length>500||typeof result.scope!=='string'||!result.scope.trim()||result.scope.length>1000)throw Error('The scorer returned an unsupported assessment.');
  return {status:result.correct===null?'unscored':changed.length?'rescored':'scored',outcome:result.correct===null?'unscored':result.correct?'correct':'incorrect',correct:result.correct,label:result.label,scope:result.scope,changedReferences:changed,appliedRefs};
 }catch{return {status:'unscored',outcome:'unscored',correct:null,label:'The declared scorer could not score this response.',scope:task.assessmentScope,changedReferences:changed,appliedRefs};}
}

export function interpretEvidence(event,{resolveTask,allowRescore=false,assistance=null,assistanceSourceIds=[]}={}){
 if(typeof allowRescore!=='boolean')throw Error('Rescoring permission must be an explicit boolean.');
 const validated=validateEvidenceEvent(event),e=validated.evidence,flags=effectiveFlags(e);
 if(assistance!==null){exact(assistance,ASSISTANCE_KEYS,'Reconciled assistance');for(const key of ASSISTANCE_KEYS){if(typeof assistance[key]!=='boolean')throw Error('Reconciled assistance must be boolean.');flags[key]||=assistance[key];}}
 let assisted=Object.values(flags).some(Boolean);
 const row={eventId:validated.id,at:validated.at,actor:clone(e.actor),episodeId:e.episodeId,retryOfEpisodeId:e.retryOfEpisodeId,attemptId:e.attemptId,observation:e.observation,taskRef:clone(e.taskRef),intentRef:clone(e.intentRef),organizationObjectiveRef:clone(e.organizationObjectiveRef),occurrence:clone(e.occurrence),dimension:null,practiceMode:null,target:null,inputModality:e.inputModality,outputModality:e.outputModality,assistance:flags,assisted,assistanceDerivedFromTask:[],assistanceSourceIds:[...new Set(assistanceSourceIds)].sort(),sourceEventIds:[validated.id],sourceIds:sourceIds(e),responseRecorded:e.response!==null,latencyMs:e.presentedAt===null?null:validated.at-e.presentedAt,skipReason:e.skipReason,recordedAssessment:clone(e.assessment),recordedReferences:{rubricRef:clone(e.rubricRef),scorerRef:clone(e.scorerRef),analysisRef:clone(e.analysisRef)},assessment:{status:'not-assessment',outcome:'unscored',correct:null,label:'No assessed response was observed.',scope:null,changedReferences:[],appliedRefs:null},condition:{inputModality:e.inputModality,outputModality:e.outputModality,context:clone(e.occurrence.context),assistance:clone(flags),cues:[]},supports:[],doesNotSupport:['No overall competence, mastery, forgetting rate, or transfer to graph neighbors is estimated.'],firstResponse:null,counted:false,exclusionReasons:[],competence:null,independenceEstablished:false};
 let task=null;
 if(e.taskRef&&typeof resolveTask==='function'){
  try{task=taskDefinition(resolveTask(clone(e.taskRef),clone(validated)),e.taskRef);row.target=clone(task.target);row.dimension=task.dimension;row.practiceMode=task.practiceMode;row.condition.cues=(task.cues||[]).slice();}
  catch(error){row.exclusionReasons.push('task-unavailable');row.assessment={...row.assessment,status:'stale',label:error.message};}
 }
 if(task){
  const required={...(task.requiredAssistance||{}),...(task.baseMeaningSupplied===true?{baseMeaningSupplied:true}:{})};
  row.assistanceDerivedFromTask=Object.keys(required).sort();for(const key of row.assistanceDerivedFromTask)flags[key]=true;
  row.condition.assistance=clone(flags);assisted=Object.values(flags).some(Boolean);row.assisted=assisted;
 }
 if(e.observation==='displayed'||e.observation==='played'){
  row.supports.push(e.observation==='displayed'?'The referenced material was displayed: an opportunity to encounter it.':'Playback was recorded: an opportunity to hear the material.');
  row.doesNotSupport.push('Display or playback does not establish attention, comprehension, recognition, or successful retrieval.');return row;
 }
 if(['lookup','hint','answer-revealed'].includes(e.observation)){
  row.supports.push('The learner requested or received the recorded support under these conditions.');
  row.doesNotSupport.push('A lookup or help request does not establish ignorance. Absence of a lookup does not establish success.');return row;
 }
 if(e.observation==='skipped'){
  row.supports.push(e.skipReason?'The learner explicitly skipped with reason: '+e.skipReason+'.':'The learner skipped this task without a stated reason.');
  row.doesNotSupport.push('A skip, including “too easy” or “too hard”, is not a correctness or competence assessment.');return row;
 }
 row.supports.push('One response was recorded for this specific task, occurrence and set of conditions.');
 if(!task){row.assessment={...row.assessment,status:'stale',label:'The exact task and scorer are unavailable; the historical assessment is not treated as fresh evidence.'};row.exclusionReasons.push('unresolved-task');return row;}
 if(task.inputModality!==e.inputModality||task.outputModality!==e.outputModality){row.assessment={...row.assessment,status:'stale',label:'The recorded modalities do not match the resolved task.'};row.exclusionReasons.push('modality-mismatch');return row;}
 row.assessment=assess(validated,task,allowRescore);
 row.sourceIds=[...new Set([...row.sourceIds,...['rubricRef','scorerRef','analysisRef'].flatMap(key=>row.assessment.appliedRefs?.[key]?.provenance.map(p=>p.sourceId)||[])])].sort();
 if(row.assessment.correct===null){row.exclusionReasons.push(row.assessment.status==='stale'?'stale-assessment':'unscored-response');row.doesNotSupport.push('An unscored or stale response does not become a successful or failed assessment.');return row;}
 const bounded={
  'visual-recognition':'Visual recognition of this target under the recorded prompt and cues.',
  'auditory-recognition':'Auditory recognition of this target under the recorded playback and cues.',
  retrieval:'Retrieval of this target under the recorded prompt and response mode.',
  'contextual-production':'Production matching this task’s rubric in this recorded context.'
 }[task.dimension];
 row.supports.push((row.assessment.correct?'The response matched the declared rubric: ':'The response did not match the declared rubric: ')+bounded);
 row.doesNotSupport.push(task.dimension==='contextual-production'?'A contextual response does not establish production across other people, syntax, lexical material, or situations.':'Success with these cues does not establish uncued recall, production, or performance in another modality.');
 if(assisted){row.supports.push('Assistance was present and is retained in the ledger.');row.doesNotSupport.push('This response receives no unaided assessment credit.');row.exclusionReasons.push('assisted-response');}
 if(e.assessment?.basis==='self-report')row.doesNotSupport.push('The retained self-report is not the scorer result and does not by itself establish correctness.');
 return row;
}

function attemptIdentity(e){return {episodeId:e.episodeId,actor:e.actor,intentRef:e.intentRef,organizationObjectiveRef:e.organizationObjectiveRef,taskRef:e.taskRef,occurrence:e.occurrence,inputModality:e.inputModality,presentedAt:e.presentedAt,rubricRef:e.rubricRef,scorerRef:e.scorerRef,analysisRef:e.analysisRef};}
function prepare(events,actor){
 if(!Array.isArray(events))throw Error('Evidence replay needs an event array.');validateActor(actor);
 const seen=new Map(),episodes=new Map(),attempts=new Map();let ignoredLegacyCount=0;
 for(const raw of events){
  if(!raw?.evidence){if(raw?.kind==='evidence')throw Error('An evidence event requires its envelope.');ignoredLegacyCount++;continue;}
  const event=validateEvidenceEvent(raw),e=event.evidence;
  if(!same(e.actor,actor))continue;
  if(seen.has(event.id)){if(!same(seen.get(event.id),event))throw Error('An event ID was reused with different evidence.');continue;}
  const episode=episodes.get(e.episodeId);
  if(episode&&episode.retryOfEpisodeId!==e.retryOfEpisodeId)throw Error('An episode cannot change its retry parent.');
  episodes.set(e.episodeId,{retryOfEpisodeId:e.retryOfEpisodeId});
  if(e.attemptId){
   const previous=attempts.get(e.attemptId),identity=attemptIdentity(e),terminal=['response','skipped'].includes(e.observation);
   if(previous&&(!same(previous.identity,identity)||(previous.outputModality!=='none'&&e.outputModality!=='none'&&previous.outputModality!==e.outputModality)))throw Error('An attempt ID was reused for a different task or condition.');
   if(previous?.terminal&&terminal)throw Error('An attempt has more than one terminal response event.');
   attempts.set(e.attemptId,{identity,terminal:previous?.terminal||terminal,outputModality:e.outputModality==='none'?previous?.outputModality||'none':e.outputModality});
  }
  seen.set(event.id,event);
 }
 const roots=new Map();
 function root(id,trail=new Set()){
  if(roots.has(id))return roots.get(id);if(trail.has(id))throw Error('Retry episode lineage contains a cycle.');
  const episode=episodes.get(id);if(!episode)return null;
  if(!episode.retryOfEpisodeId){roots.set(id,id);return id;}
  const next=new Set(trail);next.add(id);const value=root(episode.retryOfEpisodeId,next);roots.set(id,value);return value;
 }
 for(const id of episodes.keys())root(id);
 return {events:[...seen.values()].sort((a,b)=>a.at-b.at||(a.id<b.id?-1:a.id>b.id?1:0)),roots,ignoredLegacyCount};
}

export function validateEvidenceSequence(events){
 if(!Array.isArray(events))throw Error('Evidence validation needs an event array.');
 const scopes=new Map();let count=0;
 for(const event of events){
  if(!event?.evidence){if(event?.kind==='evidence')throw Error('An evidence event requires its envelope.');continue;}
  const validated=validateEvidenceEvent(event),actor=validated.evidence.actor,key=canonical(actor);
  if(!scopes.has(key))scopes.set(key,{actor,events:[]});scopes.get(key).events.push(validated);count++;
 }
 for(const scope of scopes.values())prepare(scope.events,scope.actor);
 return {events:count,scopes:scopes.size};
}
function targetKey(row){return canonical({target:row.target,dimension:row.dimension,practiceMode:row.practiceMode});}
function sameSupportScope(help,response){
 const a=help.evidence,b=response.evidence;
 if(a.episodeId!==b.episodeId||a.occurrence.contentId!==b.occurrence.contentId||a.occurrence.version!==b.occurrence.version)return false;
 if(a.attemptId&&b.attemptId&&a.attemptId===b.attemptId)return true;
 return same(a.occurrence,b.occurrence)&&(!a.taskRef||!b.taskRef||same(a.taskRef,b.taskRef));
}
function changedConditions(previous,row,threshold){
 if(!previous)return null;
 const changed=[],unknown=[];
 for(const key of CONTEXT_KEYS.filter(k=>k!=='contextId')){const a=previous.condition.context[key],b=row.condition.context[key];if(a===null||b===null)unknown.push(key);else if(a!==b)changed.push({field:key,previous:a,current:b});}
 for(const key of ['inputModality','outputModality'])if(previous.condition[key]!==row.condition[key])changed.push({field:key,previous:previous.condition[key],current:row.condition[key]});
 for(const key of ASSISTANCE_KEYS)if(previous.condition.assistance[key]!==row.condition.assistance[key])changed.push({field:'assistance.'+key,previous:previous.condition.assistance[key],current:row.condition.assistance[key]});
 const delayMs=row.at-previous.at;
 const contextReferenceChanged=previous.condition.context.contextId!==null&&row.condition.context.contextId!==null&&previous.condition.context.contextId!==row.condition.context.contextId;
 return {previousEventId:previous.eventId,delayMs,delayThresholdMs:threshold,delayCriterionMet:delayMs>=threshold,changedConditions:changed,unknownConditions:unknown,contextReferenceChanged,delayedChangedCondition:delayMs>=threshold&&changed.length>0,transferClaimed:false,scope:'An observed delay and explicitly different tested conditions; a different content/context ID alone is not such evidence. This is not an estimate of retention or transfer.'};
}
function blankTarget(row){return {key:targetKey(row),target:clone(row.target),dimension:row.dimension,practiceMode:row.practiceMode,competence:null,independenceEstablished:false,directCounts:{firstResponses:0,unassistedAssessments:0,correct:0,incorrect:0,assistedResponses:0,unscoredResponses:0,retryResponses:0,ambiguousResponses:0,skips:0,opportunities:0,helpRequests:0},sourceEventIds:[],lastAssessmentAt:null,lastAssessmentEventId:null,lastBoundedCondition:null,lastAssessment:null,timeSinceAssessmentMs:null,assessmentFreshness:'unknown'};}

export function projectEvidence(events,{actor,resolveTask,now,staleAfterMs=DEFAULT_STALE_AFTER_MS,delayThresholdMs=DEFAULT_DELAY_THRESHOLD_MS,allowRescore=false}={}){
 stamp(now,'Replay time');if(!Number.isSafeInteger(staleAfterMs)||staleAfterMs<0||!Number.isSafeInteger(delayThresholdMs)||delayThresholdMs<0)throw Error('Evidence time thresholds must be explicit nonnegative integers.');
 const prepared=prepare(events,actor),ledger=[],targets=new Map(),firstResponses=new Map(),priorAssessments=new Map();
 const helpEvents=prepared.events.filter(e=>Object.values(effectiveFlags(e.evidence)).some(Boolean));
 for(const event of prepared.events){
  // Automatic feedback is displayed after its own response. Millisecond ties
  // in imported records must not retroactively supply that response's answer.
  const e=event.evidence,help=e.observation==='response'?helpEvents.filter(h=>h.id!==event.id&&h.at<=event.at&&!(h.at===event.at&&h.evidence.attemptId===e.attemptId&&h.evidence.assistance.feedbackShown)&&sameSupportScope(h,event)):[];
  const flags=effectiveFlags(e);for(const h of help)for(const key of ASSISTANCE_KEYS)flags[key]||=effectiveFlags(h.evidence)[key];
  const row=interpretEvidence(event,{resolveTask,allowRescore,assistance:flags,assistanceSourceIds:help.map(x=>x.id)});row.rootEpisodeId=prepared.roots.get(e.episodeId);row.delayedCondition=null;
  if(event.at>now){row.exclusionReasons.push('future-event');row.doesNotSupport.push('A future-dated record cannot supply an assessment at this replay time.');}
  ledger.push(row);
  if(row.observation==='response'&&row.target&&row.dimension&&row.practiceMode&&row.rootEpisodeId&&!row.retryOfEpisodeId){
   const firstKey=row.rootEpisodeId+'|'+targetKey(row),first=firstResponses.get(firstKey);
   if(!first||row.at<first.at)firstResponses.set(firstKey,{at:row.at,count:1});else if(row.at===first.at)first.count++;
  }
 }
 for(const row of ledger){
  if(!row.target||!row.dimension||!row.practiceMode)continue;
  const key=targetKey(row),target=targets.get(key)||blankTarget(row);targets.set(key,target);target.sourceEventIds.push(row.eventId);
  if(['displayed','played'].includes(row.observation)){target.directCounts.opportunities++;continue;}
  if(['lookup','hint','answer-revealed'].includes(row.observation)){target.directCounts.helpRequests++;continue;}
  if(row.observation==='skipped'){target.directCounts.skips++;continue;}
  if(row.observation!=='response')continue;
  const root=row.rootEpisodeId,episodeKey=root?root+'|'+key:null;
  const first=episodeKey?firstResponses.get(episodeKey):null,ambiguous=!!(!row.retryOfEpisodeId&&first?.at===row.at&&first.count>1);
  row.firstResponse=ambiguous?null:!!(first&&!row.retryOfEpisodeId&&first.at===row.at);
  if(!root){row.exclusionReasons.push('unresolved-retry-lineage');row.doesNotSupport.push('An unresolved retry lineage cannot be counted as a fresh assessment episode.');}
  else if(ambiguous){row.exclusionReasons.push('ambiguous-first-response-order');row.doesNotSupport.push('Tied response timestamps do not establish which response came first; neither receives fresh assessment credit.');target.directCounts.ambiguousResponses++;}
  else if(!row.firstResponse){row.exclusionReasons.push(row.retryOfEpisodeId?'retry-episode':'repeat-response');row.doesNotSupport.push('A later response in this episode or its retry lineage is not another independent observation.');target.directCounts.retryResponses++;}
  else target.directCounts.firstResponses++;
  if(row.assisted)target.directCounts.assistedResponses++;
  if(row.assessment.correct===null)target.directCounts.unscoredResponses++;
  row.counted=!!(row.firstResponse&&!row.assisted&&row.assessment.correct!==null&&row.at<=now);
  if(!row.counted)continue;
  target.directCounts.unassistedAssessments++;target.directCounts[row.assessment.correct?'correct':'incorrect']++;
  row.delayedCondition=changedConditions(priorAssessments.get(key),row,delayThresholdMs);priorAssessments.set(key,row);
  target.lastAssessmentAt=row.at;target.lastAssessmentEventId=row.eventId;target.lastBoundedCondition=clone(row.condition);target.lastAssessment={outcome:row.assessment.outcome,scope:row.assessment.scope,sourceEventId:row.eventId,delayedCondition:clone(row.delayedCondition)};
 }
 for(const target of targets.values())if(target.lastAssessmentAt!==null){target.timeSinceAssessmentMs=now-target.lastAssessmentAt;target.assessmentFreshness=target.timeSinceAssessmentMs>staleAfterMs?'stale':'within-policy-window';}
 return {schemaVersion:OBSERVATION_SCHEMA_VERSION,policy:OBSERVATION_POLICY,actor:clone(actor),now,staleAfterMs,delayThresholdMs,thresholdMeaning:'Fixed review-policy thresholds; not an estimated learner forgetting or decay rate.',competence:null,independenceEstablished:false,ledger,targets:[...targets.values()].sort((a,b)=>a.key<b.key?-1:a.key>b.key?1:0),ignoredLegacyCount:prepared.ignoredLegacyCount};
}
