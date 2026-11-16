/** Deterministic task-oriented suggestions over existing Nabu capabilities.
 * Structure, learner observations, and intentions are kept separate. Scores
 * are transparent heuristic priorities; they are not probabilities, expected
 * learning gains, knowledge estimates, or information-theoretic quantities.
 * This module is read-only and performs no network or storage operations.
 */
import * as C from './nabu-core.js';
import * as G from './nabu-graph.js';
import * as X from './nabu-content.js';
import * as Structure from './nabu-structure.js';
import * as StructureQuery from './nabu-structure-query.js';
import * as Intent from './nabu-intents.js';
import * as Observations from './nabu-observations.js';
import * as EvidenceTasks from './nabu-evidence-tasks.js';

export const NEXT_STEP_POLICY = 'intent-next-step-v1';
export const NEXT_STEP_ACTIONS = Object.freeze(['annotation','compare-senses','bank-entry','practice-content','continue-media','open-content','edit-intent']);
const clone=value=>structuredClone(value);
const emptySelection=()=>({mode:'none',intentId:null});
const supportedLanguage=value=>C.LANGUAGES.some(([code])=>code===value);
const confirmed=detail=>detail?.status==='explicit'||detail?.status==='exploratory';
const cleanText=value=>typeof value==='string'?value:'';
const STRUCTURAL_SOURCE_KEYS=['sourceId','sourceDocument','sourceRecordId','quarantineRecordId','rawOutput','patternId','inputForm'];
function fingerprint(value){let n=2166136261;for(let i=0;i<value.length;i++){n^=value.charCodeAt(i);n=Math.imul(n,16777619);}return (n>>>0).toString(16).padStart(8,'0');}
function structuralSource(source){const declaration=source.structuralStatus&&typeof source.structuralStatus==='object'?source.structuralStatus:{};return Object.fromEntries(STRUCTURAL_SOURCE_KEYS.map(key=>[key,source[key]??declaration[key]??null]));}
function purposeStatusFor(intent){
 if(!intent)return 'unknown';
 const field=intent.provenance?.fields?.immediateActivity?.status||'unknown';
 if(field==='inferred'||field==='unknown')return field;
 if(intent.objectiveStatus==='inferred'||intent.objectiveStatus==='unknown')return intent.objectiveStatus;
 return field==='exploratory'||intent.objectiveStatus==='exploratory'?'exploratory':'explicit';
}
function scopedContext(input){
 const actor=input?.actor||{kind:'individual',userId:null,tenantId:null};
 const tenantId=typeof actor.tenantId==='string'?actor.tenantId:null;
 const owner=typeof actor.userId==='string'?actor.userId:'guest';
 const selected=input?.selection?.mode==='selected'?input.immediateIntent:null;
 const own=selected&&selected.ownerUserId===owner&&selected.tenantId===tenantId&&selected.kind==='learner'&&selected.status==='active'&&selected.id===input.selection.intentId;
 const organization=input?.organizationObjective;
 let org=null;try{if(tenantId&&organization?.kind==='organization'&&organization.tenantId===tenantId&&organization.status==='active')org=Intent.validateIntentRecord(organization);}catch{}
 let intent=null;try{if(own)intent=Intent.validateIntentRecord(selected);}catch{}
 return {actor:{kind:tenantId?'team':'individual',userId:owner==='guest'?null:owner,tenantId},selection:intent?clone(input.selection):input?.selection?.mode==='exploring'?{mode:'exploring',intentId:null}:emptySelection(),intent,organization:org};
}

export function sourceSnapshot(source={}){
 const text=cleanText(source.text),selectedText=cleanText(source.selectedText);
 return {contentId:typeof source.contentId==='string'?source.contentId:null,contentVersion:source.contentId?String(source.contentVersion??1):null,sourceLang:supportedLanguage(source.sourceLang)?source.sourceLang:null,targetLang:supportedLanguage(source.targetLang)?source.targetLang:null,selectedText,selectionStart:Number.isSafeInteger(source.selectionStart)?source.selectionStart:null,selectedIndex:Number.isSafeInteger(source.selectedIndex)?source.selectedIndex:-1,hasMedia:!!(source.hasMedia||text||source.contentId),format:cleanText(source.format)||'text',textLength:text.length,textFingerprint:fingerprint(text),structuralStatus:source.structuralStatus?clone(source.structuralStatus):null,structuralProvenanceFingerprint:fingerprint(JSON.stringify({origin:structuralSource(source),provenance:source.analysisProvenance||[],attested:source.attested===true}))};
}

export function buildTask(intentContext,source={}){
 const scoped=scopedContext(intentContext),intent=scoped.intent,snapshot=sourceSnapshot(source);
 const purpose=intent?.immediateActivity||intent?.rawText||(snapshot.hasMedia?'Continue the current media':'Explore at your own pace');
 const purposeStatus=intent?purposeStatusFor(intent):scoped.selection.mode==='exploring'?'exploratory':'unknown';
 const confirmedPurpose=intent&&confirmed(intent.provenance.fields.immediateActivity)?intent.immediateActivity:'';
 const activityText=cleanText(confirmedPurpose).split(/\babout\b/iu,1)[0];
 const family=/(?:^|\bto )(?:meet|greet|introduce)\b|\bintroducing myself\b/iu.test(activityText)?'introduction':/\b(?:song|lyrics?)\b/iu.test(activityText)?'song':/\b(?:poetry|poems?)\b|شعر/u.test(activityText)?'poetry':'current-activity';
 const explicitLanguages=intent&&confirmed(intent.provenance.fields.languages)?intent.languages.slice():[];
 const modality=intent&&confirmed(intent.provenance.fields.modalities)?intent.modalities.slice():[];
 const preferences=intent&&confirmed(intent.provenance.fields.preferences)?intent.preferences.slice():[];
 const constraints=intent&&confirmed(intent.provenance.fields.constraints)?intent.constraints.slice():[];
 const broaderDestination=intent?.destination?{text:intent.destination,timeHorizon:intent.timeHorizon,timeHorizonStatus:intent.provenance.fields.timeHorizon.status,status:intent.provenance.fields.destination.status,provenance:clone(intent.provenance.fields.destination),timeHorizonProvenance:clone(intent.provenance.fields.timeHorizon)}:null;
 const org=scoped.organization;
 const organizationObjective=org?{id:org.id,revision:org.revision,tenantId:org.tenantId,purpose:org.immediateActivity||org.rawText,purposeStatus:purposeStatusFor(org),destination:org.destination||null,destinationStatus:org.provenance.fields.destination.status,languages:confirmed(org.provenance.fields.languages)?org.languages.slice():[],suggestedLanguages:org.provenance.fields.languages.status==='inferred'?org.languages.slice():[],objectiveStatus:purposeStatusFor(org),declaredObjectiveStatus:org.objectiveStatus,provenance:clone(org.provenance),attribution:'Organization objective; separate from the learner’s immediate intention.'}:null;
 const optionalRubric=family==='introduction'?[
  {id:'greeting',description:'Choose a greeting that feels warm and respectful to both of you.'},
  {id:'appreciation',description:'Express appreciation in words you would naturally use.'},
  {id:'genuine-question',description:'Ask a genuine question that fits this person and the moment.'},
  {id:'follow-response',description:'Follow the other person’s response, or comfortably ask them to repeat something.'}
 ].map(x=>({...x,required:false,status:'suggested',evidence:'Optional learner reflection; no automatic completion judgment.'})):[];
 const preferenceText=[activityText,...preferences,...constraints].join(' ');
 const avoidPractice=preferences.includes('no-practice')||/\b(?:no|without|avoid|skip)\s+(?:quizzes|quiz|tests|test|practice|exercises|exercise)\b|\bjust (?:read|reading|listen|listening)\b|\bno interruption/iu.test(preferenceText);
 const wantsPractice=!avoidPractice&&/\b(?:practice|quiz|test me|recall)\b/iu.test(preferenceText);
 const task={schemaVersion:1,actor:scoped.actor,intentRef:intent?{id:intent.id,revision:intent.revision}:null,purpose,purposeStatus,purposeFamily:family,purposeFamilyStatus:family==='current-activity'?'unspecified':'heuristic interpretation of stated activity',selection:scoped.selection,context:intent?.context||null,languages:explicitLanguages,modalities:modality,preferences,constraints,broaderDestination,organizationObjective,optionalRubric,source:snapshot,wantsPractice,avoidPractice,provenance:{intent:intent?{parser:intent.provenance.parser,fields:clone(intent.provenance.fields)}:null,rubric:optionalRubric.length?'Optional authored task scaffold, not a cultural rule or assessment.':null},uncertainty:{intent:purposeStatus,learner:'Not inferred from the intent or language graph.',linguistic:'Evaluated separately for each source or bank entry.'}};
 return task;
}

function validEvents(events){
 const seen=new Set(),rows=[];
 for(const event of Array.isArray(events)?events:[]){
  if(!event||seen.has(event.id))continue;
  try{X.validateEvent(event);seen.add(event.id);rows.push(event);}catch{}
 }
 rows.sort((a,b)=>a.at-b.at||a.id.localeCompare(b.id));
 // The stored observations stay untouched. A recorded hint/answer from the
 // same task and session is assistance even if an attempt claims otherwise.
 const key=e=>JSON.stringify([e.contentId,e.version,e.activityId,e.sessionId]);
 const help=new Map();
 for(const event of rows)if(event.kind==='help'){const list=help.get(key(event))||[];list.push(event);help.set(key(event),list);}
 return rows.map(event=>{
  if(event.kind!=='attempt')return event;
  const used=(help.get(key(event))||[]).filter(h=>h.at<=event.at);
  return used.length?{...event,assisted:true,assistanceEvidence:[...new Set([...(event.assistanceEvidence||[]),...used.map(x=>x.id)])]}:event;
 });
}

function availableCatalogueTask(item,activityId){
 const task=EvidenceTasks.catalogueEvidenceTask(item,activityId);
 return task&&['rubricRef','scorerRef','analysisRef'].every(key=>!task[key]||['authored','verified'].includes(task[key].status))?task:null;
}

/** Read-only bridge into the existing content policy. Legacy unscoped history
 * retains its previous meaning. New observations are checked by the shared
 * projector and can contribute only to their exact resolved catalogue task.
 * Authored contrasts never acquire an annotation identity through association.
 */
export function auditRecommendationEvents(input,{actor,now}={}){
 const source=Array.isArray(input)?input:[],legacy=[],scoped=[],auditIds=new Set();
 const current=actor?{userId:actor.userId,tenantId:actor.tenantId}:null;
 let inconsistent=false;
 for(const event of source){
  if(!event||(!Object.hasOwn(event,'evidence')&&event.kind!=='evidence')){legacy.push(event);continue;}
  const owner=event.evidence?.actor;
  if(!current||!owner||!Object.hasOwn(owner,'userId')||!Object.hasOwn(owner,'tenantId')){inconsistent=true;auditIds.add(event.id);continue;}
  // Validate only the current scope. Another learner/team's record can neither
  // supply evidence nor poison this scope's otherwise valid replay.
  if(owner.userId!==current.userId||owner.tenantId!==current.tenantId)continue;
  scoped.push(event);auditIds.add(event.id);
 }
 const collisions=new Set(legacy.filter(event=>event&&auditIds.has(event.id)).map(event=>event.id));
 const legacySafe=legacy.filter(event=>!event||!collisions.has(event.id));
 if(!scoped.length&&!inconsistent)return {events:validEvents(legacySafe),notices:[],status:'legacy-only'};
 try{
  if(inconsistent||collisions.size)throw Error('Inconsistent observation identity.');
  const projection=Observations.projectEvidence(scoped,{actor:current,now,resolveTask:EvidenceTasks.resolveEvidenceTask});
  const originals=new Map(scoped.map(event=>[event.id,event])),accepted=[];
  let excludedAssessment=false;
  for(const row of projection.ledger){
   const original=originals.get(row.eventId),envelope=original.evidence;
   if(original.kind==='opened'&&row.at<=now&&X.itemById(original.contentId,original.version)){
    accepted.push({id:original.id,at:original.at,kind:'opened',contentId:original.contentId,version:original.version});
   }
   if(row.observation!=='response')continue;
   if(row.assessment.status!=='scored'||row.assessment.correct===null||row.at>now||now-row.at>projection.staleAfterMs){excludedAssessment=true;continue;}
   if(!row.firstResponse||!row.rootEpisodeId||envelope.retryOfEpisodeId)continue;
   const item=X.itemById(envelope.occurrence.contentId,envelope.occurrence.version);
   const activity=item?.practice.find(candidate=>envelope.taskRef?.id===`catalog:${item.id}:${candidate.id}`);
   // Contrast successes stay in their own ledger. They are not evidence about
   // a nearby expression merely because they were opened from the same piece.
   if(!activity)continue;
   const task=availableCatalogueTask(item,activity.id);
   if(!task||!EvidenceTasks.resolveEvidenceTask(envelope.taskRef,original)||(original.kind==='attempt'&&original.activityId!==activity.id)){
    excludedAssessment=true;continue;
   }
   const event={id:original.id,at:original.at,kind:'attempt',contentId:item.id,version:item.version,
    activityId:activity.id,sessionId:original.kind==='attempt'?original.sessionId:envelope.episodeId,
    ...clone(envelope.response),assisted:row.assisted||original.assisted===true,skipped:false,
    assistanceEvidence:row.assistanceSourceIds.slice()};
   // The old catalogue reader validates its own response shape as well. It is
   // safe to reuse the unchanged matcher only after the recorded rubric/scorer
   // and occurrence have passed the shared versioned assessment boundary.
   try{X.validateEvent(event);accepted.push(event);}catch{excludedAssessment=true;}
  }
  return {events:validEvents([...legacySafe,...accepted]),status:'audited',notices:excludedAssessment?['Stale, future-dated or unsupported audited responses were not used as fresh performance evidence.']:[]};
 }catch{
  return {events:validEvents(legacySafe),status:'inconsistent',notices:['The scoped evidence history is inconsistent, so it was not used for this suggestion. Your reading remains available.']};
 }
}
function bankEvidence(conceptId,language,cards,logs,targetMode='recognition'){
 const byId=new Map((Array.isArray(cards)?cards:[]).filter(x=>x&&typeof x.id==='string').map(x=>[x.id,x]));
 const seen=new Set(),matching=[];
 for(const log of Array.isArray(logs)?logs:[]){
  if(!log||typeof log.id!=='string'||seen.has(log.id)||![1,2,3,4].includes(log.rating)||!Number.isFinite(log.at))continue;
  const card=log.before||byId.get(log.cardId),mode=log.practiceMode||'recognition';
  if(!card||card.conceptId!==conceptId||card.sourceLang!==language||!C.PRACTICE_MODES.includes(mode))continue;
  seen.add(log.id);matching.push(log);
 }
 matching.sort((a,b)=>a.at-b.at||a.id.localeCompare(b.id));
 const modes=Object.fromEntries(C.PRACTICE_MODES.map(mode=>{
  const rows=matching.filter(l=>(l.practiceMode||'recognition')===mode),last=rows.at(-1);
  return [mode,{status:rows.length?'self-rated':'unknown',attempts:rows.length,lastRating:last?.rating??null,lastAt:last?.at??null}];
 }));
 const direct=matching.filter(x=>(x.practiceMode||'recognition')===targetMode);
 return {status:direct.length?'self-rated':'unknown',observations:direct.length,mode:targetMode,modes,otherModeObservations:matching.length-direct.length,lastRating:direct.at(-1)?.rating??null,referenceIds:direct.slice(-10).map(x=>x.id),scope:'Exact recorded concept, source language and practice mode; no transfer from other modes or graph neighbors.',knowledgeEstimate:null,transferApplied:false};
}
function contentEvidence(item,events,activityId=null,annotationId=null){
 const relatedActivities=annotationId?new Set(item.practice.filter(p=>p.annotationId===annotationId).map(p=>p.id)):null;
 const progress=X.progressFor(item,events),attempts=progress.attempts.filter(e=>e.outcome!=='skipped'&&(!activityId||e.activityId===activityId)&&(!relatedActivities||relatedActivities.has(e.activityId))),last=attempts.at(-1);
 return {status:attempts.length?'authored-response':'unknown',observations:attempts.length,lastOutcome:last?.outcome??null,lastCorrect:last?.correct??null,lastAssisted:last?.assisted??null,referenceIds:attempts.slice(-10).map(x=>x.id),assistanceEvidence:last?.assistanceEvidence?.slice()||[],engagement:{opened:progress.started,finished:progress.finished,preference:progress.preference},scope:annotationId?'Only authored activities targeting this exact annotation. Recall follows the supplied answer policy.':'Responses to this authored item/activity only. Recall is an exact authored-answer match with its documented normalization.',knowledgeEstimate:null,transferApplied:false};
}
function noEvidence(){return {status:'unknown',observations:0,referenceIds:[],knowledgeEstimate:null,transferApplied:false};}
function listProvenance(value){return Array.isArray(value)?clone(value):value?[clone(value)]:[];}
function sourceGate(source){
 const origin=structuralSource(source);
 const suppliedProvenance=Array.isArray(source.analysisProvenance)?source.analysisProvenance.length>0:!!source.analysisProvenance;
 if(!source.structuralStatus&&!suppliedProvenance&&!origin.quarantineRecordId&&!origin.sourceRecordId&&!origin.rawOutput&&!origin.patternId)return {eligible:true,code:'no-generated-claim'};
 const status=typeof source.structuralStatus==='string'?source.structuralStatus:source.structuralStatus?.status||'unknown';
 return Structure.generatedCandidateEligibility({...origin,status,attested:source.attested===true,form:cleanText(source.selectedText),language:source.sourceLang||null,provenance:source.analysisProvenance||[]});
}
function exactSelection(source){
 const selected=cleanText(source.selectedText),text=cleanText(source.text);
 if(!selected.trim()||selected.length>1000||!text)return false;
 if(Number.isSafeInteger(source.selectionStart))return source.selectionStart>=0&&text.slice(source.selectionStart,source.selectionStart+selected.length)===selected;
 return text.includes(selected);
}
function explanationLanguage(source,language){return supportedLanguage(source.targetLang)&&source.targetLang!==language?source.targetLang:language==='en'?'es':'en';}
function structuralWitness(query,answers,kind){
 const ids=[...new Set(answers.map(answer=>answer.witnessId))];
 return {graphVersion:query.graphVersion,query:{kind,status:query.status,completeness:clone(query.completeness)},witnessIds:ids,witnesses:ids.map(id=>clone(query.witnesses[id]))};
}
function addScore(candidate,task){
 const evidence=candidate.evidence;
 let observed=0,observedReason='No direct performance observation is used; unknown does not mean not known.';
 if(evidence.status==='self-rated'&&evidence.lastRating===1){observed=.8;observedReason='The most recent recorded self-rating on this exact meaning/language was Again; a small support preference, not a knowledge diagnosis.';}
 else if(evidence.status==='authored-response'&&evidence.lastCorrect===false){observed=.8;observedReason='The last response to this authored activity did not match its key; this says nothing about broader mastery.';}
 else if(evidence.status==='authored-response'&&evidence.lastAssisted){observed=.4;observedReason='The last authored response used assistance; it is not treated as unaided performance.';}
 const explicitPreference=candidate.kind==='continue-media'&&task.avoidPractice?5:0;
 const contributions=[
  {name:'taskUtility',value:candidate.taskUtility,reason:candidate.taskReason},
  {name:'sourceRelevance',value:candidate.sourceRelevance,reason:candidate.sourceReason},
  {name:'directLearnerEvidence',value:observed,reason:observedReason},
  {name:'informationOpportunity',value:candidate.informationValue||0,reason:candidate.informationValue?'An actual unresolved meaning choice can be clarified. This is a heuristic opportunity, not calibrated information gain.':'No uncertainty-reduction reward is asserted.'},
  {name:'explicitPreference',value:explicitPreference+(candidate.preferenceValue||0),reason:explicitPreference?'You explicitly asked to keep reading/listening or avoid practice.':candidate.preferenceValue?'You previously chose More like this for this content interest.':'No additional preference is assumed.'},
  {name:'effort',value:-Math.min(1.5,candidate.estimatedSeconds/120),reason:'Estimated interaction effort; an authored estimate, not a measured learner cost.'},
  {name:'interruption',value:-candidate.interruption,reason:candidate.interruption?'A small penalty for opening support or changing the current activity.':'Keeps the current activity available without an intervention.'}
 ];
 const total=Math.round(contributions.reduce((sum,row)=>sum+row.value,0)*1000)/1000;
 const {taskUtility,taskReason,sourceRelevance,sourceReason,informationValue,preferenceValue,interruption,...publicCandidate}=candidate;
 return {...publicCandidate,score:{total,contributions},why:candidate.why||candidate.taskReason};
}

export function recommendNextSteps({intentContext,source={},cards=[],logs=[],contentEvents=[],capabilities={},evidenceScope=null,structureBudget={},now=Date.now()}={}){
 const task=buildTask(intentContext,source),snapshot=task.source,audit=auditRecommendationEvents(contentEvents,{actor:task.actor,now}),events=audit.events,candidates=[],notices=audit.notices.slice(),graphVersion=StructureQuery.graphVersion(),structuralQueries=[];
 const can=type=>NEXT_STEP_ACTIONS.includes(type)&&capabilities[type]===true;
 const item=source.contentId?X.itemById(source.contentId,Number(source.contentVersion??1)):null;
 const currentItem=item&&(!source.text||source.text===X.sourceText(item))&&(!source.sourceLang||source.sourceLang===item.language)?item:null;
 const selectionExists=!!cleanText(source.selectedText).trim(),anchored=exactSelection(source),gate=sourceGate(source);
 const add=(type,fields)=>{if(can(type))candidates.push({kind:type,evidence:noEvidence(),uncertainty:{learner:'unknown',linguistic:'No calibrated confidence is claimed.'},provenance:[],...fields,action:{type,...fields.action}});};
 const query=(kind,run)=>{
  try{
   const value=run(),witnessed=Array.isArray(value?.answers)&&value.answers.every(answer=>typeof answer.witnessId==='string'&&value.witnesses?.[answer.witnessId]);
   const complete=value?.completeness?.complete===true&&value.graphVersion===graphVersion&&witnessed;
   const completeness=complete?clone(value.completeness):{...(value?.completeness||{}),complete:false,truncated:true,reason:value?.completeness?.reason||'The structural query did not supply a complete, current witness for every answer.'};
   structuralQueries.push({kind,graphVersion:value?.graphVersion||null,status:value?.status||'unavailable',completeness,unresolvedAlternatives:clone(value?.unresolvedAlternatives||[]),omittedAlternativeCount:value?.omittedAlternativeCount??null,alternativeCompleteness:clone(value?.alternativeCompleteness??null),issues:clone(value?.issues||[])});
   if(complete)return value;
  }catch{
   structuralQueries.push({kind,graphVersion,status:'unavailable',completeness:{complete:false,totalMatches:null,returnedAnswers:0,truncated:true,reason:'The structural query could not be completed.'},unresolvedAlternatives:[],omittedAlternativeCount:null,alternativeCompleteness:null,issues:[]});
  }
  notices.push('A local structural query was incomplete, so its material was withheld. You can continue or choose another selection.');return null;
 };
 const draftNotice='Authored bank draft; not native-speaker reviewed. Check the wording and register for this person and context.';
 if(task.organizationObjective)notices.push('The organization objective is shown separately. These suggestions follow your current intention and selected media.');
 if(evidenceScope?.kind==='personal-account'&&evidenceScope?.tenantAttribution==='not-recorded')notices.push('Existing learner responses are personal-account history; they were not recorded as team-specific evidence.');
 if(task.purposeStatus==='inferred')notices.push('The suggested intention is still unconfirmed. It does not select a language or destination for you.');
 if(selectionExists&&!anchored)notices.push('The selected text no longer matches the current source. Select it again to request support.');
 if(selectionExists&&!gate.eligible)notices.push(gate.reason||'This generated or unverified form is withheld from support suggestions.');

 if(anchored&&gate.eligible){
  const occurrence=currentItem?query('occurrence',()=>StructureQuery.occurrenceWitnesses({contentId:currentItem.id,version:currentItem.version,selectedText:source.selectedText,selectionStart:Number.isSafeInteger(source.selectionStart)?source.selectionStart:null},structureBudget)):null;
  const occurrenceAnswer=occurrence?.answers.find(answer=>answer.kind==='annotation'&&answer.eligibility?.eligible),annotation=occurrenceAnswer?.annotation;
  if(annotation){
   const evidence=contentEvidence(currentItem,events,null,annotation.id);
   add('annotation',{id:`annotation:${currentItem.id}:${annotation.id}`,title:'Explain this expression in its passage',description:annotation.meaning,why:'This explanation is attached to the exact selected expression in the current passage; it can address the immediate point of confusion.',action:{contentId:currentItem.id,version:currentItem.version,annotationId:annotation.id},estimatedSeconds:25,taskUtility:4,taskReason:'Supports understanding the expression selected now.',sourceRelevance:8,sourceReason:'Exact authored annotation on the current content version.',interruption:.15,evidence,qualityLabel:currentItem.editorialStatus,uncertainty:{learner:evidence.status,linguistic:'The explanation and translation are editorial drafts, not an unrestricted or independently verified analysis.'},provenance:[{sourcePath:'data/explore.json',recordId:currentItem.id,annotationId:annotation.id,reviewStatus:'authored-unreviewed',description:currentItem.editorialStatus}],structuralWitness:structuralWitness(occurrence,[occurrenceAnswer],'occurrence')});
  }
  if(supportedLanguage(source.sourceLang)){
   const target=explanationLanguage(source,source.sourceLang),surface=query('surface',()=>StructureQuery.lookupAlignmentWitnesses({text:source.selectedText,sourceLang:source.sourceLang,targetLang:target,budget:structureBudget}));
   const known=surface?.answers.filter(answer=>answer.kind==='alignment')||[],eligible=known.filter(answer=>answer.eligibility?.eligible),totalMatches=surface?.completeness.totalMatches||0;
   if(totalMatches>1){
    // Never collapse genuine ambiguity to a sole surviving sense after a quality
    // filter. A comparison is usable only when all displayed alternatives pass.
    if(eligible.length===totalMatches)add('compare-senses',{id:`senses:${source.sourceLang}:${fingerprint(source.selectedText)}`,title:'Compare the possible meanings',description:eligible.map(answer=>G.concept(answer.legacyConceptId).sense).join(' / '),why:`The selected spelling has ${totalMatches} meanings in the existing bank. Compare them against your sentence instead of accepting an automatic choice.`,action:{text:source.selectedText,sourceLang:source.sourceLang,targetLang:target,conceptIds:eligible.map(answer=>answer.legacyConceptId)},estimatedSeconds:35,taskUtility:4,taskReason:'Clarifies the actual meaning choice in the selected text.',sourceRelevance:8,sourceReason:'Exact spelling lookup in the selected source language.',informationValue:1.5,interruption:.15,provenance:eligible.flatMap(answer=>listProvenance(answer.provenance)),qualityLabel:draftNotice,uncertainty:{learner:'unknown',linguistic:'Multiple bank meanings remain unresolved; these legacy meaning groups are not a fully disambiguated lexical graph.'},structuralWitness:structuralWitness(surface,eligible,'surface')});
   }else if(totalMatches===1&&eligible.length===1){
    const answer=eligible[0],c=G.concept(answer.legacyConceptId),evidence=bankEvidence(c.id,source.sourceLang,cards,logs),translation=answer.translation;
    add('bank-entry',{id:`source-bank:${c.id}:${source.sourceLang}`,title:c.kind==='phrase'||c.kind==='expression'?'Understand this known phrase':'Check this authored meaning',description:translation.back,why:'This exact form is present in the local bank. Its supplied meaning may help with the selected line; check it against the surrounding text.',action:{conceptId:c.id,sourceLang:source.sourceLang,targetLang:target},estimatedSeconds:30,taskUtility:4,taskReason:'Offers bounded meaning support for the selected word or phrase.',sourceRelevance:7,sourceReason:'Exact selected form; the bank entry does not explain the rest of the song or passage.',interruption:.2,evidence,provenance:listProvenance(answer.provenance),qualityLabel:draftNotice,uncertainty:{learner:evidence.status,linguistic:'One match in this limited bank is not proof that the form has only one possible meaning.'},structuralWitness:structuralWitness(surface,[answer],'surface')});
   }
   if(totalMatches&&eligible.length!==totalMatches)notices.push('Some matching bank material needs additional context or verification, so it is withheld from these suggestions.');
  }
 }

 // A bounded social-introduction scaffold: phrases already in the repository,
 // offered as options, never as a national script or an automatic curriculum.
 if(task.purposeFamily==='introduction'&&task.purposeStatus!=='inferred'&&task.languages.length){
  const language=task.languages[0],target=explanationLanguage(source,language);
  const material=query('task-material',()=>StructureQuery.taskMaterialWitnesses({purposeFamily:task.purposeFamily,sourceLang:language,targetLang:target,budget:structureBudget}));
  for(const answer of material?.answers||[]){
   const id=answer.legacyConceptId,title=answer.title,utility=answer.taskUtility,concept=G.concept(id);if(answer.kind!=='task-material'||!concept||!answer.eligibility?.eligible)continue;
   const evidence=bankEvidence(id,language,cards,logs,'production');
   add('bank-entry',{id:`task-bank:${id}:${language}`,title,description:concept.terms[language],why:'You stated an introduction. This is one optional, existing phrase that may serve that moment; adapt it to the person’s preferences and the conversation.',action:{conceptId:id,sourceLang:language,targetLang:target},estimatedSeconds:40,taskUtility:utility,taskReason:'A concrete option for the stated introduction, with no assumption about nationality or family customs.',sourceRelevance:0,sourceReason:'Task-related bank material; it is not claimed to occur in your selected media.',interruption:snapshot.hasMedia?1:.3,evidence,provenance:listProvenance(answer.provenance),qualityLabel:draftNotice,uncertainty:{learner:evidence.status,linguistic:'Authored phrase draft. Familiarity, formality, and preferred expressions depend on the individual and situation.'},structuralWitness:structuralWitness(material,[answer],'task-material')});
  }
 }else if(task.purposeFamily==='introduction'&&!task.languages.length){
  notices.push('A language has not been confirmed for this introduction. No language is inferred from someone’s nationality.');
  add('edit-intent',{id:'edit-intent:language',title:'Choose the language for this moment',description:'Add or correct a language in your intention when you know it.',why:'The introduction is clear, but its language is still unspecified.',action:{},estimatedSeconds:20,taskUtility:5,taskReason:'Lets you supply the missing language without inventing one.',sourceRelevance:0,sourceReason:'An optional clarification of the stated task.',interruption:.2});
 }

 if(currentItem&&gate.eligible&&!task.avoidPractice){
  const support=X.nextSupport(currentItem,events),activity=currentItem.practice.find(p=>p.id===support.activityId);
  if(activity&&availableCatalogueTask(currentItem,activity.id)){const evidence=contentEvidence(currentItem,events,activity.id);
   add('practice-content',{id:`practice:${currentItem.id}:${activity.id}`,title:'Try one optional activity from this piece',description:activity.prompt,why:task.wantsPractice?'You asked to practice. This existing activity belongs to the current piece; you can skip it without grading.':'An optional authored activity is available if you want a check; continuing the piece does not require it.',action:{contentId:currentItem.id,version:currentItem.version,activityId:activity.id},estimatedSeconds:60,taskUtility:task.wantsPractice?7:.5,taskReason:task.wantsPractice?'Matches an explicit request for practice.':'An available alternative, with no inferred need for remediation.',sourceRelevance:2,sourceReason:'An existing authored activity attached to the current piece.',interruption:1.2,evidence,provenance:[{sourcePath:'data/explore.json',recordId:currentItem.id,activityId:activity.id,reviewStatus:'authored-unreviewed'}],qualityLabel:'Optional authored activity. Its result is bounded to its supplied answer policy.',uncertainty:{learner:evidence.status,linguistic:currentItem.editorialStatus}});
  }else if(activity)notices.push('The proposed activity has an unresolved source-analysis mapping and is withheld from new suggestions. You can continue reading.');
 }

 if(!snapshot.hasMedia&&task.purposeFamily==='poetry'&&task.languages.includes('ar')){
  const preferred=new Set(X.ITEMS.filter(x=>X.progressFor(x,events).preference).map(x=>x.interest));
  for(const poem of X.ITEMS.filter(x=>x.genre==='poetry'&&x.language==='ar'))add('open-content',{id:`content:${poem.id}`,title:'Open '+poem.titleTranslation,description:poem.preview,why:'You chose to explore Arabic poetry. This existing piece can be opened without setting a destination or taking a quiz.',action:{contentId:poem.id,version:poem.version},estimatedSeconds:20,taskUtility:4.5,taskReason:'Matches the stated language and exploratory interest.',sourceRelevance:0,sourceReason:'A real piece in Nabu’s catalogue; no current media is replaced.',preferenceValue:preferred.has(poem.interest)?1:0,interruption:.5,evidence:contentEvidence(poem,events),provenance:[{sourcePath:'data/explore.json',recordId:poem.id,reviewStatus:'authored-unreviewed',description:poem.editorialStatus}],qualityLabel:poem.editorialStatus});
 }

 add('continue-media',{id:'continue-media',title:snapshot.hasMedia?'Keep reading or listening':'Keep exploring',description:'Stay with what you chose. No answer or practice step is required.',why:task.avoidPractice?'You asked to keep going without practice.':task.selection.mode==='exploring'?'Exploration is a valid choice. You can continue without a fixed destination.':'You can continue your chosen activity without an intervention.',action:{},estimatedSeconds:0,taskUtility:snapshot.hasMedia?3:1.5,taskReason:'Preserves the learner’s chosen activity and freedom to decline help.',sourceRelevance:snapshot.hasMedia?2:0,sourceReason:snapshot.hasMedia?'The current media stays open.':'Keeps the existing Explore/reader available.',interruption:0});
 const ranked=candidates.map(x=>addScore(x,task)).sort((a,b)=>b.score.total-a.score.total||a.id.localeCompare(b.id));
 const continueAction=ranked.find(x=>x.kind==='continue-media')||null;
 const material=ranked.filter(x=>!['continue-media','edit-intent'].includes(x.kind));
 const noSafeSupport=material.length===0;
 if(noSafeSupport&&selectionExists&&anchored&&gate.eligible)notices.push('No safe local explanation or supported activity is available for this selection. You can continue or choose another part of the media.');
 const primary=ranked[0]||null;
 // Continue is a persistent separate choice. Alternatives should offer actual
 // different support, not duplicate that choice or the primary action.
 const alternatives=ranked.filter(x=>x!==primary&&x.kind!=='continue-media').slice(0,2);
 const taskKey='next1:'+fingerprint(JSON.stringify({actor:task.actor,intentRef:task.intentRef,selection:task.selection,source:snapshot,graphVersion,organization:task.organizationObjective?{id:task.organizationObjective.id,revision:task.organizationObjective.revision}:null}));
 return {schemaVersion:1,policy:NEXT_STEP_POLICY,task,taskKey,sourceSnapshot:snapshot,graphVersion,structuralQueries,intentRef:task.intentRef,primary,alternatives,continueAction,noSafeSupport,supportStatus:material.length?'available':selectionExists?'unavailable':'not-requested',notices:[...new Set(notices)],evidenceScope:evidenceScope?clone(evidenceScope):{kind:'current-client-context',tenantAttribution:'not-recorded'},limitations:['Scores are deterministic heuristic priorities, not calibrated learning gains or probabilities.','Unknown learner observations are not treated as inability.','Language-structure uncertainty and learner performance are not interchangeable.']};
}
