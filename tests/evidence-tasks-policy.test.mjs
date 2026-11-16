/** Real authored tasks + observation replay + deterministic optional policy.
 * These tests verify bounded software behavior, not native-speaker review,
 * independent learning effects, or validation of a competence model.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as X from '../public/nabu-content.js';
import * as O from '../public/nabu-observations.js';
import * as T from '../public/nabu-evidence-tasks.js';
import * as P from '../public/nabu-evidence-policy.js';

const DAY=86400000,NOW=30*DAY,actor={userId:'task-policy-learner',tenantId:null};
const clone=value=>structuredClone(value);
let sequence=0;
function recorded(taskOrKey,{at=NOW-1000,observation='response',response,assistance={},episodeId=null,retryOfEpisodeId=null,recordActor=actor}={}){
 const task=typeof taskOrKey==='string'?T.contrastTask(taskOrKey):taskOrKey;
 assert.ok(task,'An authored task must exist');const n=String(++sequence).padStart(16,'0'),episode=episodeId||'episode-'+n;
 const assessed=observation==='response';
 const e={schemaVersion:1,episodeId:episode,attemptId:['response','hint','answer-revealed','skipped'].includes(observation)?'attempt-'+n:null,retryOfEpisodeId,actor:clone(recordActor),intentRef:null,organizationObjectiveRef:null,taskRef:{id:task.id,version:task.version},occurrence:clone(task.occurrence),inputModality:task.inputModality,outputModality:assessed?task.outputModality:'none',observation,assistance:{...O.emptyAssistance(),...(task.requiredAssistance||{}),...assistance},presentedAt:at-500,response:assessed?(response??(task.outputModality==='choice'?{choice:task.answer}:{answer:task.accepted[0]})):null,skipReason:null,assessment:null,rubricRef:clone(task.rubricRef),scorerRef:clone(task.scorerRef),analysisRef:clone(task.analysisRef)};
 return {id:'observation-'+n,kind:'evidence',at,contentId:e.occurrence.contentId,version:e.occurrence.version,sessionId:episode,evidence:e};
}
function project(events,now=NOW,options={}){return O.projectEvidence(events,{actor,resolveTask:T.resolveEvidenceTask,now,...options});}
function policy(events,{now=NOW,contentId='a-little-later',preferences=[]}={}){return P.selectEvidenceStep({projection:project(events,now),contentId,now,preferences});}
function eligibility(key,events,now=NOW){return T.contrastEligibility(T.contrastTask(key),project(events,now),now);}
function allKeys(value){return value&&typeof value==='object'?Object.entries(value).flatMap(([key,nested])=>[key,...allKeys(nested)]):[];}

test('the small authored fixture contains exactly eight scoped contrasts with explicit provenance',()=>{
 assert.deepEqual(T.CONTRAST_KEYS,['take-meaning','open-meaning','take-female','open-female','take-male','write-female','phrase-now','phrase-later']);
 const targets=new Set();
 for(const key of T.CONTRAST_KEYS){
  const task=T.contrastTask(key);assert.equal(task.id,'contrast:'+key);assert.equal(task.version,1);
  assert.equal(task.target.language,'ar');assert.equal(task.inputModality,'text');assert.ok(O.EVIDENCE_DIMENSIONS.includes(task.dimension));assert.ok(O.EVIDENCE_PRACTICE_MODES.includes(task.practiceMode));
  assert.match(task.qualityNote,/not instructor-reviewed|not.*reviewed/);assert.match(task.qualityNote,/not.*corpus-attested/);
  assert.ok(task.rubricRef.provenance.some(source=>source.sourceId===T.CONTRAST_SOURCE&&source.kind==='grammar-reference-not-item-attestation'));
  assert.equal(task.analysisRef.status,'authored');assert.ok(task.cues.length);assert.match(task.assessmentScope,/Only this authored prompt/);
  assert.equal(task.occurrence.contentId,'a-little-later');assert.equal(task.occurrence.annotationId,'a3');assert.equal(task.occurrence.readingId,'authored:contrast:'+key);
  targets.add(task.target.id);O.validateEvidenceEvent(recorded(task));
 }
 assert.equal(targets.size,7,'The immediate and delayed phrase checks intentionally share one target');
 assert.equal(T.contrastTask('invent-an-unsupported-form'),null);
});

test('authored scorers match their supplied choices and normalize only the existing Arabic answer policy',()=>{
 for(const key of T.CONTRAST_KEYS){
  const task=T.contrastTask(key),correct=task.outputModality==='choice'?{choice:task.answer}:{answer:task.accepted[0]};
  assert.equal(task.score(correct).correct,true,key);assert.match(task.score(correct).scope,/no claim about general competence/);
 }
 const take=T.contrastTask('take-female');assert.equal(take.score({answer:'  خُذِي!  '}).correct,true);assert.equal(take.score({answer:'خذ'}).correct,false);assert.equal(take.score({answer:'خزى'}).correct,false);
 const phrase=T.contrastTask('phrase-now');assert.equal(phrase.score({answer:'خُذِي وَقْتَكِ.'}).correct,true);
});

test('a response outside the offered choices stays unscored rather than becoming failure evidence',()=>{
 const task=T.contrastTask('take-meaning');
 for(const choice of [-1,99,1.5,null,'0'])assert.equal(task.score({choice}).correct,null);
 const result=project([recorded(task,{response:{choice:99}})]);
 assert.equal(result.ledger[0].assessment.correct,null);assert.equal(result.ledger[0].counted,false);
 assert.equal(result.targets[0].directCounts.incorrect,0);assert.equal(result.targets[0].directCounts.unscoredResponses,1);
});

test('task factory results are independent copies with stable scorer and analysis references',()=>{
 const first=T.contrastTask('take-female'),original=JSON.stringify(first);
 first.accepted[0]='corrupted';first.occurrence.context.senseId='other';first.analysisRef.provenance[0].locator='changed';
 assert.equal(JSON.stringify(T.contrastTask('take-female')),original);
 const a=T.contrastTask('take-female'),b=T.contrastTask('take-male');assert.notEqual(a.analysisRef.id,b.analysisRef.id);assert.notEqual(a.target.id,b.target.id);
});

test('the resolver requires exact task versions and exact occurrence/context identity',()=>{
 const original=recorded('take-meaning'),ref=original.evidence.taskRef;
 assert.equal(T.resolveEvidenceTask(ref,original)?.id,ref.id);
 assert.equal(T.resolveEvidenceTask({...ref,version:2},original),null);
 assert.equal(T.resolveEvidenceTask({...ref,version:'1'},original),null);
 assert.equal(T.resolveEvidenceTask({id:'contrast:not-authored',version:1},original),null);
 for(const key of ['contentId','version','segmentId','annotationId','readingId']){
  const altered=clone(original);altered.evidence.occurrence[key]=key==='version'?2:'another-'+key;
  assert.equal(T.resolveEvidenceTask(ref,altered),null,key);
 }
 for(const key of ['lexicalId','senseId','speakerId','syntaxId','contextId']){
  const altered=clone(original);altered.evidence.occurrence.context[key]='another-'+key;
  assert.equal(T.resolveEvidenceTask(ref,altered),null,key);
  const replay=project([altered]);assert.equal(replay.ledger[0].counted,false);assert.equal(replay.ledger[0].assessment.correct,null);
 }
});

test('historical scoring or analysis versions stay stale until explicitly rescored without changing the event',()=>{
 const old=recorded('take-meaning');old.evidence.analysisRef.version='retired-analysis';old.evidence.assessment={outcome:'incorrect',basis:'authored-rule'};
 const saved=clone(old),stale=project([old]);assert.equal(stale.ledger[0].assessment.status,'stale');assert.equal(stale.ledger[0].counted,false);
 assert.equal(stale.ledger[0].recordedAssessment.outcome,'incorrect');assert.deepEqual(old,saved);
 const rescored=project([old],NOW,{allowRescore:true});assert.equal(rescored.ledger[0].assessment.status,'rescored');assert.equal(rescored.ledger[0].assessment.correct,true);
 assert.equal(rescored.ledger[0].recordedAssessment.outcome,'incorrect');assert.deepEqual(old,saved);
});

test('catalogue task mappings remain source-bound and expose the discovered Imru p3 mismatch as quarantined',()=>{
 let mapped=0,quarantined=0;
 for(const item of X.ITEMS)for(const activity of item.practice){
  const task=T.catalogueEvidenceTask(item,activity.id);assert.ok(task);mapped++;
  assert.equal(task.occurrence.annotationId,activity.annotationId);assert.equal(task.occurrence.contentId,item.id);
  assert.equal(task.inputModality,'text');assert.equal(task.dimension,activity.mode==='recall'?'retrieval':'visual-recognition');
  if(task.analysisRef.status==='quarantined')quarantined++;
 }
 assert.equal(mapped,18);assert.equal(quarantined,1);
 const item=X.itemById('imru-al-qais-stop-and-weep'),activity=item.practice.find(x=>x.id==='p3');
 const morning=item.annotations.find(x=>x.id==='a3'),grief=item.annotations.find(x=>x.id==='a4');
 assert.equal(morning.segmentId,'s4');assert.equal(grief.segmentId,'s5');assert.equal(activity.annotationId,grief.id);
 assert.ok(X.normalizeAnswer(activity.prompt).includes(X.normalizeAnswer(morning.quote)));
 assert.match(morning.meaning,/morning of parting/);assert.match(grief.meaning,/grief/);
 const task=T.catalogueEvidenceTask(item,'p3'),row=project([recorded(task)]).ledger[0];
 assert.equal(task.analysisRef.status,'quarantined');assert.match(task.qualityNote,/morning of parting/);assert.equal(row.assessment.status,'stale');assert.equal(row.counted,false);
 assert.equal(X.evaluateAttempt(item,{activityId:'p3',choice:activity.answer,assisted:false}).correct,true,'The historical exercise contract is unchanged');
});

test('a base in the bank, passive display, help or an unrelated response cannot establish direct-base eligibility',()=>{
 assert.equal(eligibility('open-female',[]).available,false);
 assert.equal(eligibility('open-female',[recorded('open-meaning',{observation:'displayed'})]).available,false);
 assert.equal(eligibility('open-female',[recorded('open-meaning',{assistance:{hint:true}})]).available,false);
 assert.equal(eligibility('open-female',[recorded('open-meaning',{response:{choice:0}})]).available,false);
 assert.equal(eligibility('open-female',[recorded('take-meaning')]).available,false);
 assert.equal(eligibility('open-female',[recorded('open-meaning',{recordActor:{userId:'another-learner',tenantId:null}})]).available,false);
 assert.match(eligibility('open-female',[]).reason,/presence in the graph is not learner evidence/);
});

test('only a fresh direct base response in the matching dimension and practice mode opens the gated contrast',()=>{
 const direct=recorded('open-meaning');assert.equal(eligibility('open-female',[direct]).available,true);
 const stale=recorded('open-meaning',{at:NOW-O.DEFAULT_STALE_AFTER_MS-1});assert.equal(eligibility('open-female',[stale]).available,false);
 const wrongMode=project([direct]);wrongMode.targets[0].practiceMode='cloze';assert.equal(T.contrastEligibility(T.contrastTask('open-female'),wrongMode,NOW).available,false);
 const wrongDimension=project([direct]);wrongDimension.targets[0].dimension='auditory-recognition';assert.equal(T.contrastEligibility(T.contrastTask('open-female'),wrongDimension,NOW).available,false);
});

test('supplied meaning is recorded as assistance and cannot yield unaided application credit',()=>{
 for(const key of ['take-female','write-female']){
  const task=T.contrastTask(key);assert.equal(task.baseMeaningSupplied,true);assert.equal(task.requiredAssistance.baseMeaningSupplied,true);
  const projection=project([recorded(task)]),row=projection.ledger[0];assert.equal(row.assisted,true);assert.equal(row.assessment.correct,true);assert.equal(row.counted,false);assert.equal(projection.targets[0].directCounts.correct,0);
  assert.match(T.contrastEligibility(task,projection,NOW).reason,/assisted/);
 }
});

test('replay derives required supplied meaning even when a stored assistance flag falsely says none',()=>{
 const event=recorded('take-female',{assistance:{baseMeaningSupplied:false}}),saved=clone(event),projection=project([event]);
 assert.equal(projection.ledger[0].assisted,true);assert.equal(projection.ledger[0].condition.assistance.baseMeaningSupplied,true);
 assert.equal(projection.ledger[0].counted,false);assert.equal(projection.targets[0].directCounts.correct,0);
 assert.deepEqual(event,saved,'Required task support is a derived condition; the historical declaration stays immutable');
});

test('the later phrase check requires a counted direct check and the complete fixed 24-hour interval',()=>{
 const first=recorded('phrase-now',{at:NOW-DAY});
 assert.equal(eligibility('phrase-later',[]).available,false);
 assert.equal(eligibility('phrase-later',[recorded('phrase-now',{at:NOW-DAY,assistance:{hint:true}})]).available,false);
 assert.equal(eligibility('phrase-later',[recorded('phrase-now',{at:NOW-DAY,observation:'skipped'})]).available,false);
 assert.equal(eligibility('phrase-later',[first],NOW-1).available,false);
 assert.equal(eligibility('phrase-later',[first],NOW).available,true);
 for(const now of [undefined,NaN,Infinity,-1,1.5])assert.equal(T.contrastEligibility(T.contrastTask('phrase-later'),project([first]),now).available,false,'Unknown or invalid replay time must not satisfy a delay');
});

test('the later phrase changes explicit syntax/context and records a bounded delayed condition without a transfer claim',()=>{
 const immediate=T.contrastTask('phrase-now'),later=T.contrastTask('phrase-later');
 assert.equal(immediate.target.id,later.target.id);assert.equal(immediate.practiceMode,'cloze');assert.equal(later.practiceMode,'cloze');
 assert.notEqual(immediate.occurrence.context.syntaxId,later.occurrence.context.syntaxId);assert.notEqual(immediate.occurrence.context.contextId,later.occurrence.context.contextId);
 const first=recorded(immediate,{at:NOW-DAY}),second=recorded(later),projection=project([first,second]);
 assert.equal(projection.ledger[1].delayedCondition.delayCriterionMet,false,'One second short of the full interval remains short');
 second.at=NOW;second.evidence.presentedAt=NOW-500;
 const delayed=project([first,second]);assert.equal(delayed.ledger[1].delayedCondition.delayedChangedCondition,true);assert.equal(delayed.ledger[1].delayedCondition.transferClaimed,false);
 assert.equal(delayed.competence,null);assert.equal(delayed.independenceEstablished,false);
 assert.ok(delayed.ledger[1].delayedCondition.changedConditions.some(change=>change.field==='syntaxId'));
});

test('repeating an authored phrase in the same episode or its retry lineage does not create a new counted delay',()=>{
 const first=recorded('phrase-now',{at:NOW-DAY});
 for(const second of [recorded('phrase-later',{at:NOW,episodeId:first.sessionId}),recorded('phrase-later',{at:NOW,retryOfEpisodeId:first.sessionId})]){
  const projection=project([first,second]);assert.equal(projection.ledger[1].counted,false);assert.equal(projection.ledger[1].delayedCondition,null);assert.equal(projection.targets[0].directCounts.unassistedAssessments,1);
 }
});

test('an unknown learner gets immediate help, continuation and only an optional diagnostic with different outcome branches',()=>{
 const result=policy([]);assert.equal(result.policy,P.EVIDENCE_POLICY);assert.equal(result.selectionMode,'deterministic');assert.equal(result.primary.kind,'help');
 assert.equal(result.diagnostic.taskKey,'take-meaning');assert.ok(result.alternatives.some(c=>c.kind==='continue'));
 assert.equal(result.diagnostic.diagnosticUsefulness.canChangeIntervention,true);
 assert.notEqual(result.diagnostic.diagnosticUsefulness.branches.correct,result.diagnostic.diagnosticUsefulness.branches.incorrect);
 assert.match(result.diagnostic.diagnosticUsefulness.limitations,/nonexclusive explanations/);
 assert.match(result.diagnostic.reason,/design budget.*not a measured/);
 for(const candidate of result.candidates)assert.equal(candidate.taskUsefulness.learningGain,null);
 assert.equal(allKeys(result).some(key=>['probability','posterior','mastery','reward','bandit','confidence'].includes(key)),false);
});

test('unsupported content offers continuation and an explicit no-practice preference disables checks',()=>{
 for(const contentId of ['unknown-content','imru-al-qais-stop-and-weep',null]){
  const result=policy([],{contentId});assert.equal(result.primary.kind,'continue');assert.equal(result.diagnostic,null);assert.equal(result.candidates.length,1);
 }
 const result=policy([],{preferences:['no-practice']});assert.equal(result.primary.kind,'help');assert.equal(result.diagnostic,null);
 assert.equal(result.candidates.find(c=>c.kind==='check').availability.available,false);
 assert.match(result.candidates.find(c=>c.kind==='check').availability.constraints.join(' '),/preference/);
 assert.ok(result.alternatives.some(c=>c.kind==='continue'));
});

test('a fresh direct base mismatch changes help to the base meaning instead of asking another identical question',()=>{
 const result=policy([recorded('take-meaning',{response:{choice:1}})]);
 assert.equal(result.primary.kind,'help');assert.equal(result.primary.focus,'base-meaning');assert.equal(result.diagnostic,null);
 assert.ok(result.alternatives.some(c=>c.kind==='continue'));
});

test('fresh base success permits the supplied-meaning form contrast, and its response can lead to another base check',()=>{
 const base=recorded('take-meaning',{at:NOW-4000}),operation=recorded('take-female',{at:NOW-3000,response:{answer:'خذ'}});
 assert.equal(policy([base]).diagnostic.taskKey,'take-female');
 assert.equal(policy([base,operation]).diagnostic.taskKey,'open-meaning');
 const otherBase=recorded('open-meaning',{at:NOW-2000});assert.equal(policy([base,operation,otherBase]).diagnostic.taskKey,'open-female');
});

test('a mismatch on another directly supported base actually routes to operation help without claiming a unique cause',()=>{
 const events=[recorded('take-meaning',{at:NOW-5000}),recorded('take-female',{at:NOW-4000,response:{answer:'خذ'}}),recorded('open-meaning',{at:NOW-3000}),recorded('open-female',{at:NOW-2000,response:{answer:'افتح'}})];
 const result=policy(events);assert.equal(result.primary.kind,'help');assert.equal(result.primary.focus,'operation');assert.equal(result.diagnostic,null);
 assert.match(JSON.stringify(result),/nonexclusive|unresolved|not.*unique|does not.*cause/);
});

test('a wrong other-base meaning routes to meaning support, never a claimed operation failure',()=>{
 const events=[recorded('take-meaning',{at:NOW-4000}),recorded('take-female',{at:NOW-3000,response:{answer:'خذ'}}),recorded('open-meaning',{at:NOW-2000,response:{choice:0}})];
 const result=policy(events);assert.equal(result.primary.kind,'help');assert.equal(result.primary.focus,'base-meaning');assert.equal(result.diagnostic,null);
});

test('stale base evidence permits a new bounded check instead of becoming a permanent current failure',()=>{
 const old=recorded('take-meaning',{at:NOW-O.DEFAULT_STALE_AFTER_MS-1,response:{choice:1}}),projection=project([old]);
 assert.equal(projection.targets[0].assessmentFreshness,'stale');const result=policy([old]);assert.equal(result.diagnostic?.taskKey,'take-meaning');
 assert.match(result.uncertainty.learner,/Unknown competence stays null/);
});

test('a completed fresh delayed check returns to help/continuation rather than immediately repeating the same diagnostic',()=>{
 const first=recorded('phrase-now',{at:NOW-DAY});assert.equal(policy([first]).diagnostic?.taskKey,'phrase-later');
 const later=recorded('phrase-later',{at:NOW});const result=policy([first,later]);assert.equal(result.diagnostic,null);assert.equal(result.primary.kind,'help');
 assert.ok(result.alternatives.some(c=>c.kind==='continue'));
});

test('policy selection is deterministic under event arrival order and leaves historical observations untouched',()=>{
 const events=[recorded('take-meaning',{at:NOW-4000}),recorded('take-female',{at:NOW-3000,response:{answer:'خذ'}})],saved=clone(events);
 const first=policy(events),second=policy([...events].reverse());assert.deepEqual(second,first);assert.deepEqual(events,saved);
 assert.deepEqual(policy(events),first);assert.equal(project(events).competence,null);
});

test('ambiguous first-response order and later retries do not silently choose a fresh diagnostic conclusion',()=>{
 const first=recorded('take-meaning',{at:NOW-1000}),conflict=recorded('take-meaning',{at:NOW-1000,episodeId:first.evidence.episodeId,response:{choice:1}});
 const unresolved=project([first,conflict]);assert.equal(unresolved.ledger.filter(r=>r.counted).length,0);
 const ambiguous=policy([first,conflict]);assert.equal(ambiguous.diagnostic.taskKey,'take-meaning');assert.equal(ambiguous.primary.focus,'phrase-context');
 conflict.at=NOW;conflict.evidence.presentedAt=NOW-100;
 const repeated=policy([first,conflict]);assert.equal(repeated.diagnostic.taskKey,'take-female');assert.equal(project([first,conflict]).targets[0].directCounts.correct,1);assert.equal(project([first,conflict]).targets[0].directCounts.incorrect,0);
});
