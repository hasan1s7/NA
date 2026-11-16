import test from 'node:test';
import assert from 'node:assert/strict';
import * as O from '../public/nabu-observations.js';
import {contrastTask,resolveEvidenceTask} from '../public/nabu-evidence-tasks.js';
import {LANGUAGES} from '../public/nabu-graph.js';
import {LEARNER_TASK_VERSION,listLearnerTasks,learnerTask,resolveLearnerTask,modelTask,permitsMeaningSuppliedEvidence,mappedContrastTasks,taskExposure} from '../public/nabu-learner-tasks.js';
import {classifyKnownEntry} from '../public/nabu-structure.js';
import {buildLearnerInput,LEARNER_EXPOSURE_WINDOW_MS,MAX_EXPOSURE_WITNESSES} from '../public/nabu-learner-observations.js';

const actor={userId:'learner-alice',tenantId:null},now=100000,copy=x=>structuredClone(x);
const id=(prefix,n)=>prefix+'-'+String(n).padStart(18,'0');
const resolver=(ref,event)=>resolveLearnerTask(ref,event)||resolveEvidenceTask(ref,event);
function event(taskOrId,n=1,changes={},outer={}){
  const task=typeof taskOrId==='string'?learnerTask(taskOrId):taskOrId,at=outer.at??1000+n*10;
  const observation=changes.observation||'response';
  const evidence={schemaVersion:1,episodeId:id('episode',n),attemptId:['response','hint','answer-revealed','skipped'].includes(observation)?id('attempt',n):null,retryOfEpisodeId:null,actor:copy(actor),intentRef:null,organizationObjectiveRef:null,taskRef:{id:task.id,version:task.version},occurrence:copy(task.occurrence),inputModality:task.inputModality,outputModality:observation==='response'?task.outputModality:'none',observation,assistance:O.emptyAssistance(),presentedAt:at-1,response:observation==='response'?(task.options?{choice:task.answer}:{answer:task.accepted[0]}):null,skipReason:null,assessment:null,rubricRef:copy(task.rubricRef),scorerRef:copy(task.scorerRef),analysisRef:copy(task.analysisRef),...copy(changes)};
  return {id:id('observation',n),at,kind:'evidence',contentId:evidence.occurrence.contentId,version:evidence.occurrence.version,sessionId:evidence.episodeId,evidence,...outer};
}
const build=(events,options={})=>buildLearnerInput({events,actor,now,...options});
const target='learner:ar:write:retrieval';

test('the authored slice has current auditable scorers and actual answers in every bank language',()=>{
  const tasks=listLearnerTasks();assert.equal(new Set(tasks.map(t=>t.id)).size,tasks.length);assert(tasks.length>=60);
  assert.deepEqual(new Set(tasks.filter(t=>t.id.startsWith('learner:bank:')).map(t=>t.target.language)),new Set(LANGUAGES));
  for(const [n,task] of tasks.entries()){
    assert.equal(task.version,LEARNER_TASK_VERSION);assert.equal(task.rubricRef.status,'authored');assert(task.rubricRef.provenance.length);
    assert.match(task.qualityNote,/not independently|not been independently/i);
    const e=event(task,n+1);assert.doesNotThrow(()=>O.validateEvidenceEvent(e));assert.equal(task.score(e.evidence.response).correct,true,task.id);
    assert.equal(resolveLearnerTask(e.evidence.taskRef,e)?.id,task.id);
    const mapped=modelTask(task);assert.equal(mapped.language,task.target.language);assert.equal(mapped.mode,task.practiceMode);assert.equal(mapped.guess,task.options?1/task.options.length:.01);
  }
});

test('task views are independent and unsupported versions or fabricated occurrences do not resolve',()=>{
  const first=learnerTask(target);first.accepted[0]='changed';first.components[0].id='changed';
  const second=learnerTask(target);assert.notEqual(second.accepted[0],'changed');assert.notEqual(second.components[0].id,'changed');
  assert.equal(learnerTask('made-up-task'),null);assert.equal(resolveLearnerTask({id:target,version:2}),null);assert.equal(modelTask({...second,version:2}),null);
  const e=event(target);e.evidence.occurrence.context.senseId='another-reading';assert.equal(resolveLearnerTask(e.evidence.taskRef,e),null);assert.equal(build([e]).observations.length,0);
});

test('component contrasts separate root knowledge from supplied-meaning operations and lexical exceptions',()=>{
  const root=modelTask(learnerTask('learner:ar:write:base-recall')),pattern=modelTask(learnerTask('learner:ar:write:pattern')),whole=modelTask(learnerTask(target));
  assert.deepEqual(root.components.map(c=>c.kind),['root']);assert.deepEqual(pattern.components.map(c=>c.kind),['pattern']);assert.deepEqual(whole.components.map(c=>c.kind),['root','pattern']);
  assert.equal(pattern.memoryKey,whole.memoryKey);assert.equal(root.memory,false);assert.equal(whole.memory,true);
  assert.equal(pattern.components[0].id,modelTask(learnerTask('learner:ar:open:pattern')).components[0].id);
  assert.equal(pattern.components[0].transferGroup,null);
  for(const key of ['learner:en:write:pattern','learner:es:write:retrieval','learner:es:open:pattern']){const m=modelTask(learnerTask(key));assert.deepEqual(m.components,[]);assert.equal(m.memory,true);}
});

test('semantic sharing retains a separate local lexical gate and supplied definitions never create crosslanguage production evidence',()=>{
  const ar=modelTask(learnerTask('learner:bank:ar:water:meaning')),es=modelTask(learnerTask('learner:bank:es:water:meaning'));
  assert.equal(ar.components.find(c=>c.kind==='meaning').transferGroup,es.components.find(c=>c.kind==='meaning').transferGroup);
  const arLocal=ar.components.find(c=>c.kind==='root'),esLocal=es.components.find(c=>c.kind==='root');assert.notEqual(arLocal.id,esLocal.id);assert.equal(arLocal.transferGroup,null);assert.equal(esLocal.transferGroup,null);
  for(const language of LANGUAGES){const m=modelTask(learnerTask('learner:bank:'+language+':water:retrieval'));assert.equal(m.components.length,1);assert.equal(m.components[0].kind,'root');assert.equal(m.components[0].transferGroup,null);}
  for(const language of ['ar','en','es'])assert.equal(modelTask(learnerTask('learner:'+language+':write:reading')).components.length,2);
});

test('titles distinguish local tasks without giving away a meaning-choice answer or English word-form answer',()=>{
  for(const language of LANGUAGES){const tasks=listLearnerTasks({language});assert.equal(new Set(tasks.map(t=>t.title)).size,tasks.length);}
  for(const t of listLearnerTasks({language:'en',mode:'production'}))for(const answer of t.accepted)assert(!t.title.toLowerCase().split(/\W+/u).includes(answer.toLowerCase()),t.id);
  assert.match(learnerTask('learner:ar:write:meaning').title,/verb/);
});

test('named support supplies only an actual task component without showing the complete Arabic target',()=>{
  const t=learnerTask(target),mapped=modelTask(t);assert.equal(t.componentSupport.length,2);
  for(const support of t.componentSupport){assert(mapped.components.some(c=>c.id===support.componentId));assert(support.seconds>0);assert(!support.text.includes('مكتوب'));assert(!support.text.includes('مَكْتُوب'));}
  assert.deepEqual(learnerTask('learner:es:write:retrieval').componentSupport,[]);
});

test('the bridge recomputes correctness and keeps the original ledger competence and events untouched',()=>{
  const e=event(target,1,{response:{answer:'wrong'},assessment:{outcome:'correct',basis:'self-report'}}),before=copy(e),result=build([e]);
  assert.equal(result.observations.length,1);assert.equal(result.observations[0].correct,0);assert.equal(result.observations[0].learnerId,actor.userId);
  assert.equal(result.projection.competence,null);assert.equal(result.projection.ledger[0].competence,null);assert.deepEqual(e,before);
  assert.deepEqual(result.audit[0].sourceEventIds,[e.id]);assert.equal(result.audit[0].directLedgerCounted,true);assert.equal(result.summary.unaided,1);
});

test('base meaning supplied supports its maintained form likelihood without unaided or root credit',()=>{
  const t=learnerTask('learner:ar:write:pattern'),e=event(t),result=build([e]);assert(permitsMeaningSuppliedEvidence(t));
  assert.equal(result.observations.length,1);assert.equal(result.summary.conditioned,1);assert.equal(result.summary.unaided,0);
  assert.equal(result.projection.ledger[0].counted,false);assert.equal(result.projection.targets[0].directCounts.unassistedAssessments,0);
  assert.equal(result.audit[0].assistance.baseMeaningSupplied,true);assert(result.audit[0].modelMapping.components.every(c=>c.kind==='pattern'));
  const unapproved=event(target,2,{assistance:{...O.emptyAssistance(),baseMeaningSupplied:true}});assert.equal(build([unapproved]).observations.length,0);
});

test('answer, hint, translation, replay and other assistance cannot be laundered into conditioned model evidence',()=>{
  const t=learnerTask('learner:ar:write:pattern');
  for(const flag of Object.keys(O.emptyAssistance()).filter(k=>k!=='baseMeaningSupplied')){
    const result=build([event(t,1,{assistance:{...O.emptyAssistance(),baseMeaningSupplied:true,[flag]:true}})]);assert.equal(result.observations.length,0,flag);assert(result.excluded[0].reasons.includes('unsupported-assistance'),flag);
  }
});

test('encounters, lookups and skips never become successes or failures',()=>{
  const rows=['displayed','lookup','skipped'].map((observation,n)=>event(target,n+1,{observation,skipReason:observation==='skipped'?'too-hard':null}));
  const result=build(rows);assert.deepEqual(result.observations,[]);assert.equal(result.excluded.length,3);assert.equal(result.projection.competence,null);
});

test('exact account and tenant filtering does not reveal other peoples event IDs or responses',()=>{
  const own=event(target,1),other=event(target,2,{actor:{userId:'bob',tenantId:null}}),team=event(target,3,{actor:{userId:actor.userId,tenantId:'team-one'}}),result=build([own,other,team]);
  assert.deepEqual(result.observations.map(x=>x.id),[own.id]);assert.equal(result.projection.ledger.length,1);
  assert(!JSON.stringify(result.audit).includes(other.id));assert(!JSON.stringify(result.excluded).includes(team.id));assert.deepEqual(result.scope,actor);
  assert.throws(()=>build([own],{actor:{userId:'!locked',tenantId:null}}),/locked/);
  const guest=event(target,4,{actor:{userId:null,tenantId:null}});assert.equal(build([guest],{actor:{userId:null,tenantId:null}}).observations[0].learnerId,'guest');
});

test('transport duplicates count once while conflicting duplicates are rejected',()=>{
  const e=event(target);assert.equal(build([e,copy(e)]).observations.length,1);
  const conflict=copy(e);conflict.evidence.response.answer='different';assert.throws(()=>build([e,conflict]),/reused/);
});

test('repeat responses, explicit retries and tied first attempts supply no additional model observations',()=>{
  const first=event(target,1),repeat=event(target,2,{episodeId:first.evidence.episodeId}),retry=event(target,3,{retryOfEpisodeId:first.evidence.episodeId});
  const result=build([retry,repeat,first]);assert.deepEqual(result.observations.map(x=>x.id),[first.id]);assert.equal(result.excluded.length,2);
  const tied=event(target,4,{episodeId:first.evidence.episodeId},{at:first.at});assert.equal(build([first,tied]).observations.length,0);
  const orphan=event(target,5,{retryOfEpisodeId:id('missing',1)});assert.equal(build([orphan]).observations.length,0);
});

test('source reference changes, quarantine, unknown versions and unavailable scorers cannot become model evidence',()=>{
  for(const field of ['rubricRef','scorerRef','analysisRef']){
    const e=event(target);e.evidence[field].version='changed';assert.equal(build([e]).observations.length,0);
    const r=build([event(target)],{resolveTask:(ref,event)=>{const t=resolver(ref,event);return t?{...t,[field]:{...t[field],status:'quarantined'}}:null;}});assert.equal(r.observations.length,0);
  }
  const e=event(target);e.evidence.taskRef.version=2;assert.equal(build([e]).observations.length,0);
  assert.equal(build([event(target)],{resolveTask:()=>null}).observations.length,0);
});

test('future responses are excluded; historical age remains available to time-aware inference',()=>{
  const e=event(target);assert.equal(build([e],{now:e.at-1}).observations.length,0);
  const old=build([e],{now:e.at+30*86400000});assert.equal(old.projection.targets[0].assessmentFreshness,'stale');assert.equal(old.observations.length,1);assert.equal(old.observations[0].at,e.at);
});

test('recorded help overrides a falsely unaided response and feedback does not retrospectively assist its own answer',()=>{
  const response=event(target,2),help=event(target,1,{...copy(response.evidence),observation:'hint',response:null,outputModality:'none'},{at:response.at-1});
  assert.equal(build([response,help]).observations.length,0);
  const feedback=event(target,3,{...copy(response.evidence),observation:'answer-revealed',response:null,outputModality:'none',assistance:{...O.emptyAssistance(),answerShown:true,feedbackShown:true}},{at:response.at});
  const result=build([feedback,response]);assert.equal(result.observations.length,1);assert.equal(result.observations[0].id,response.id);
});

test('only the explicit existing contrast mappings are admitted and maintain their assistance conditions',()=>{
  assert.equal(mappedContrastTasks().length,8);
  const t=contrastTask('write-female'),result=build([event(t)]);assert.equal(result.observations.length,1);assert.equal(result.summary.conditioned,1);assert.equal(result.projection.ledger[0].counted,false);
  assert(modelTask(t).components.every(c=>c.kind==='pattern'));
  assert.equal(modelTask({id:'catalog:arbitrary:p1',version:1}),null);
});

test('malformed immutable evidence is rejected rather than silently repaired',()=>{
  const e=event(target);delete e.evidence.assistance.hint;assert.throws(()=>build([e]),/missing/);
  assert.throws(()=>build([{id:id('legacy',1),at:0,kind:'evidence'}]),/envelope/);
  assert.equal(build([{id:id('legacy',1),at:0,kind:'opened'}]).summary.ignoredLegacyCount,1);
});

test('bank checks inherit existing eligibility and maintain the exact source review policy',()=>{
  for(const task of listLearnerTasks().filter(t=>t.sourceBank)){
    const gate=classifyKnownEntry(task.sourceBank.conceptId,task.target.language);assert.equal(gate.eligible,true);assert.equal(gate.requiresContext,false);
    assert.equal(task.sourceBank.reviewStatus,gate.reviewStatus);assert.equal(task.sourceBank.integrityPolicy,'graph-integrity-v1');assert.equal(task.analysisRef.status,'authored');
    assert(task.analysisRef.provenance.some(p=>p.sourceId==='nabu:graph-integrity-v1'));
  }
  assert.equal(classifyKnownEntry('relatives.uncle','ar').eligible,false);
  assert(!listLearnerTasks().some(t=>t.sourceBank?.conceptId==='relatives.uncle'));
});

test('Spanish exception feedback excludes immediate form recall across different task IDs',()=>{
  const help=event('learner:es:write:pattern',1,{observation:'answer-revealed',assistance:{...O.emptyAssistance(),answerShown:true,feedbackShown:true}}),answer=event('learner:es:write:retrieval',2);
  const result=build([answer,help]);assert.equal(result.observations.length,0);
  const excluded=result.excluded.find(e=>e.eventId===answer.id);assert(excluded.reasons.includes('recent-form-exposure'));assert.equal(excluded.exposureSources[0].eventId,help.id);
  assert.equal(result.projection.ledger.find(e=>e.eventId===answer.id).counted,true,'immutable direct ledger remains separate');
});

test('a displayed meaning prompt or supplied base excludes immediate copied-form retrieval',()=>{
  for(const [from,to] of [['learner:ar:write:reading',target],['learner:ar:write:pattern','learner:ar:write:base-recall'],['learner:bank:es:water:meaning','learner:bank:es:water:retrieval']]){
    const display=event(from,1,{observation:'displayed'}),answer=event(to,2),result=build([answer,display]);
    assert.equal(result.observations.length,0,from);assert(result.excluded.find(e=>e.eventId===answer.id).reasons.includes('recent-form-exposure'),from);
    assert(taskExposure(learnerTask(from)).promptFormKeys.includes(taskExposure(learnerTask(to)).responseFormKey));
  }
});

test('a replayed generic support hint excludes base recall with one exact source witness',()=>{
  const hint=event(target,1,{observation:'hint',assistance:{...O.emptyAssistance(),hint:true}}),answer=event('learner:ar:write:base-recall',2);
  const result=build([answer,hint]),excluded=result.excluded.find(e=>e.eventId===answer.id);
  assert.equal(result.observations.length,0);assert.equal(result.projection.ledger.find(e=>e.eventId===answer.id).counted,true);
  assert(excluded.reasons.includes('recent-form-exposure'));assert(excluded.reasons.includes('recent-component-support'));
  assert.equal(excluded.exposureSourceCount,1,'one source matching a form and a component is counted once');
  assert.equal(excluded.exposureSources.length,1);const witness=excluded.exposureSources[0];
  assert.equal(witness.eventId,hint.id);assert.deepEqual(witness.sourceTaskRef,hint.evidence.taskRef);
  assert.equal(witness.hintIdentity,'generic-hint-union');assert.deepEqual(witness.componentIds,['root:ar:write']);
  assert.deepEqual(witness.hintFormKeys,['base:ar:write']);assert.equal(witness.formKey,'base:ar:write');
  const metadata=taskExposure(learnerTask(target));assert.deepEqual(new Set(metadata.hintComponentIds),new Set(modelTask(learnerTask(target)).components.map(c=>c.id)));
  assert.deepEqual(metadata.hintFormKeys,['base:ar:write']);
});

test('generic hints block a shared possible cue component without affecting unrelated components or languages',()=>{
  const hint=event(target,1,{observation:'hint',assistance:{...O.emptyAssistance(),hint:true}});
  const related=event('learner:ar:open:retrieval',2),unrelated=event('learner:ar:open:base-recall',3),spanish=event('learner:es:write:base-recall',4);
  const result=build([hint,related,unrelated,spanish]);
  assert.deepEqual(result.observations.map(e=>e.id),[unrelated.id,spanish.id]);
  const excluded=result.excluded.find(e=>e.eventId===related.id);
  assert(excluded.reasons.includes('recent-component-support'));assert(!excluded.reasons.includes('recent-form-exposure'));
  assert.equal(excluded.exposureSources[0].formKey,null);
  assert.deepEqual(excluded.exposureSources[0].componentIds,['pattern:ar:sound-form-I-passive-maful']);
  assert.equal(excluded.exposureSources[0].hintIdentity,'generic-hint-union');
  const late=event('learner:ar:open:retrieval',5,{},{at:hint.at+LEARNER_EXPOSURE_WINDOW_MS+1});
  assert.deepEqual(build([hint,late],{now:late.at+1}).observations.map(e=>e.id),[late.id]);
  const before=event('learner:ar:open:retrieval',6,{},{at:hint.at-1});
  assert.deepEqual(build([hint,before]).observations.map(e=>e.id),[before.id]);
});

test('recent equivalent form responses do not become independent trials under another task name',()=>{
  const first=event('learner:es:write:pattern',1),second=event('learner:es:write:retrieval',2),result=build([first,second]);
  assert.deepEqual(result.observations.map(e=>e.id),[first.id]);assert(result.excluded.find(e=>e.eventId===second.id).reasons.includes('recent-equivalent-form-response'));
});

test('exposure reconciliation is language-specific, chronological and bounded by a declared policy window',()=>{
  const display=event('learner:ar:write:reading',1,{observation:'displayed'}),spanish=event('learner:es:write:retrieval',2);
  assert.deepEqual(build([display,spanish]).observations.map(e=>e.id),[spanish.id]);
  const future=event('learner:ar:write:reading',3,{observation:'displayed'},{at:5000}),before=event(target,2,{},{at:4000});
  assert.deepEqual(build([future,before],{now:6000}).observations.map(e=>e.id),[before.id]);
  assert.deepEqual(build([future,before],{now:4500}).observations.map(e=>e.id),[before.id]);
  const late=event(target,4,{},{at:display.at+LEARNER_EXPOSURE_WINDOW_MS+1});
  assert.deepEqual(build([late,display],{now:late.at+1}).observations.map(e=>e.id),[late.id]);
});

test('a response remains admissible when its own correct-answer feedback is later',()=>{
  const first=event(target,1),feedback=event(target,2,{...copy(first.evidence),observation:'answer-revealed',response:null,outputModality:'none',assistance:{...O.emptyAssistance(),feedbackShown:true,answerShown:true}},{at:first.at+1});
  assert.deepEqual(build([feedback,first]).observations.map(e=>e.id),[first.id]);
});

test('exposure audit keeps bounded witnesses and explicit omitted counts without losing the full ledger',()=>{
  const displays=Array.from({length:100},(_,i)=>event('learner:ar:write:reading',i+1,{observation:'displayed'}));
  const answer=event(target,101),result=build([...displays,answer]),excluded=result.excluded.find(e=>e.eventId===answer.id);
  assert.equal(result.observations.length,0);assert.equal(result.projection.ledger.length,101);assert.equal(excluded.exposureSourceCount,100);
  assert.equal(excluded.exposureSources.length,MAX_EXPOSURE_WITNESSES);assert.equal(excluded.omittedExposureSources,100-MAX_EXPOSURE_WITNESSES);
});
