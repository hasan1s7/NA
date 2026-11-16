/** Reproducible authored software fixture, never a human-learning experiment.
 * buildEvidenceEpisodeDemo is pure; only the optional CLI writes artifacts.
 */
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import * as Observations from '../public/nabu-observations.js';
import * as Tasks from '../public/nabu-evidence-tasks.js';
import * as Content from '../public/nabu-content.js';

const DAY=86400000,START=Date.UTC(2026,10,10,12),NOW=START+2*DAY+3600000;
const PERSONAL={userId:'demo-learner-a',tenantId:null};
const OTHER={userId:'demo-learner-b',tenantId:null};
const TEAM={userId:'demo-learner-a',tenantId:'demo-support-team'};
const clone=value=>structuredClone(value);
const uid=(kind,number)=>'demo-'+kind+'-'+String(number).padStart(16,'0');
const originalEpisode=uid('episode',1),retryEpisode=uid('episode',2),delayedEpisode=uid('episode',3);

function makeEvent(number,{task=null,observation='response',at=START+number*1000,episodeId=originalEpisode,attemptId=uid('attempt',number),retryOfEpisodeId=null,actor=PERSONAL,response=null,assistance={},presentedAt=at-1000,skipReason=null}={}){
 const item=Content.itemById('a-little-later'),answer=task&&observation==='response'?response??(task.outputModality==='choice'?{choice:task.answer}:{answer:task.accepted[0]}):null;
 const assessment=answer?task.score(answer):null;
 const evidence={schemaVersion:1,episodeId,attemptId:task?attemptId:null,retryOfEpisodeId,actor:clone(actor),intentRef:{id:actor.userId===OTHER.userId?'demo-intent-other-0001':actor.tenantId?'demo-intent-team-00001':'demo-intent-personal-01',revision:1},organizationObjectiveRef:actor.tenantId?{id:'demo-organization-goal',revision:1}:null,taskRef:task?{id:task.id,version:task.version}:null,occurrence:clone(task?.occurrence||Tasks.mediaOccurrence(item)),inputModality:task?.inputModality||'text',outputModality:observation==='response'?task.outputModality:'none',observation,assistance:{...Observations.emptyAssistance(),...assistance},presentedAt:task?presentedAt:null,response:answer,skipReason,assessment:assessment?{outcome:assessment.correct?'correct':'incorrect',basis:'authored-rule'}:null,rubricRef:clone(task?.rubricRef||null),scorerRef:clone(task?.scorerRef||null),analysisRef:clone(task?.analysisRef||null)};
 return Observations.validateEvidenceEvent({id:uid('event',number),at,kind:'evidence',contentId:item.id,version:item.version,sessionId:episodeId,evidence});
}
function summarize(projection){
 return {actor:projection.actor,sourceEventIds:projection.ledger.map(row=>row.eventId),eventCount:projection.ledger.length,countedEventIds:projection.ledger.filter(row=>row.counted).map(row=>row.eventId),assistedResponseIds:projection.ledger.filter(row=>row.observation==='response'&&row.assisted).map(row=>row.eventId),staleResponseIds:projection.ledger.filter(row=>row.observation==='response'&&row.assessment.status==='stale').map(row=>row.eventId),competence:projection.competence,targets:projection.targets.map(target=>({target:target.target,dimension:target.dimension,practiceMode:target.practiceMode,directCounts:target.directCounts,lastAssessmentAt:target.lastAssessmentAt,timeSinceAssessmentMs:target.timeSinceAssessmentMs,assessmentFreshness:target.assessmentFreshness,competence:target.competence}))};
}
function analysisRevisionResolver(taskRef,event){
 const task=Tasks.resolveEvidenceTask(taskRef,event);if(task?.id!=='contrast:phrase-later')return task;
 // A deliberately authored version change exercises replay mechanics. It is
 // not a newly validated linguistic analysis or a measured learner change.
 return {...task,analysisRef:{...task.analysisRef,version:String(task.analysisRef.version)+'-demo-revision-2',provenance:[...task.analysisRef.provenance,{sourceId:'demo:analysis-revision',locator:'tools/evidence_episode_demo.mjs:analysisRevisionResolver',kind:'authored-software-fixture'}]}};
}

export function buildEvidenceEpisodeDemo(){
 const meaning=Tasks.contrastTask('take-meaning'),supported=Tasks.contrastTask('take-female'),phrase=Tasks.contrastTask('phrase-now'),later=Tasks.contrastTask('phrase-later'),otherMeaning=Tasks.contrastTask('open-meaning');
 assert(meaning&&supported&&phrase&&later&&otherMeaning,'The actual authored task definitions must exist.');
 const shown=makeEvent(1,{observation:'displayed',at:START}),meaningResponse=makeEvent(2,{task:meaning,at:START+10000});
 const meaningFeedback=makeEvent(3,{task:meaning,observation:'answer-revealed',at:START+11000,attemptId:meaningResponse.evidence.attemptId,presentedAt:meaningResponse.evidence.presentedAt,assistance:{answerShown:true,feedbackShown:true}});
 // False flags here deliberately exercise mandatory task-derived support.
 const suppliedMeaningResponse=makeEvent(4,{task:supported,at:START+20000});
 const firstPhrase=makeEvent(5,{task:phrase,at:START+30000,response:{answer:'غير ذلك'}});
 const phraseFeedback=makeEvent(6,{task:phrase,observation:'answer-revealed',at:START+31000,attemptId:firstPhrase.evidence.attemptId,presentedAt:firstPhrase.evidence.presentedAt,assistance:{answerShown:true,feedbackShown:true}});
 const retry=makeEvent(7,{task:phrase,at:START+50000,episodeId:retryEpisode,retryOfEpisodeId:originalEpisode,assistance:{answerShown:true,feedbackShown:true}});
 const skipped=makeEvent(8,{task:otherMeaning,observation:'skipped',at:START+60000,skipReason:'too-hard'});
 const delayed=makeEvent(9,{task:later,at:START+2*DAY+10000,episodeId:delayedEpisode});
 const otherLearner=makeEvent(10,{task:meaning,at:START+15000,episodeId:uid('episode',4),actor:OTHER});
 const team=makeEvent(11,{task:otherMeaning,at:START+16000,episodeId:uid('episode',5),actor:TEAM});
 const events=[shown,meaningResponse,clone(meaningResponse),meaningFeedback,suppliedMeaningResponse,firstPhrase,phraseFeedback,retry,skipped,delayed,otherLearner,team];
 const before=clone(events),options={actor:PERSONAL,resolveTask:Tasks.resolveEvidenceTask,now:NOW};
 const projection=Observations.projectEvidence(events,options),reordered=Observations.projectEvidence([...events].reverse(),options);
 const stale=Observations.projectEvidence(events,{...options,resolveTask:analysisRevisionResolver});
 const rescored=Observations.projectEvidence(events,{...options,resolveTask:analysisRevisionResolver,allowRescore:true});
 const otherProjection=Observations.projectEvidence(events,{...options,actor:OTHER});
 const teamProjection=Observations.projectEvidence(events,{...options,actor:TEAM});
 const aged=Observations.projectEvidence(events,{...options,now:START+10*DAY});
 const row=id=>projection.ledger.find(r=>r.eventId===id),phraseTarget=projection.targets.find(t=>t.target.id===phrase.target.id&&t.practiceMode===phrase.practiceMode);

 assert.deepEqual(events,before,'Replay must not change source records.');
 assert.deepEqual(projection,reordered,'Input order must not change a replay.');
 assert.equal(projection.ledger.length,9,'One duplicate and two foreign scopes are excluded.');
 assert.equal(row(meaningResponse.id).counted,true);
 assert.equal(row(suppliedMeaningResponse.id).assisted,true);
 assert.equal(row(suppliedMeaningResponse.id).assistance.baseMeaningSupplied,true);
 assert.equal(row(suppliedMeaningResponse.id).counted,false);
 assert.equal(row(firstPhrase.id).assessment.correct,false);
 assert.equal(row(firstPhrase.id).counted,true);
 assert.equal(row(retry.id).counted,false);
 assert.equal(row(retry.id).rootEpisodeId,originalEpisode);
 assert.equal(row(skipped.id).counted,false);
 assert.equal(row(delayed.id).delayedCondition.delayedChangedCondition,true);
 assert.deepEqual(row(delayed.id).delayedCondition.changedConditions.map(x=>x.field),['syntaxId']);
 assert(!row(delayed.id).delayedCondition.changedConditions.some(x=>['contentId','contextId'].includes(x.field)));
 assert.equal(row(delayed.id).delayedCondition.transferClaimed,false);
 assert.equal(phraseTarget.directCounts.correct,1);
 assert.equal(phraseTarget.directCounts.incorrect,1);
 assert.equal(phraseTarget.directCounts.retryResponses,1);
 assert.deepEqual(otherProjection.ledger.map(r=>r.eventId),[otherLearner.id]);
 assert.deepEqual(teamProjection.ledger.map(r=>r.eventId),[team.id]);
 assert.equal(stale.ledger.find(r=>r.eventId===delayed.id).assessment.status,'stale');
 assert.equal(rescored.ledger.find(r=>r.eventId===delayed.id).assessment.status,'rescored');
 assert.deepEqual(stale.ledger.map(r=>r.eventId),projection.ledger.map(r=>r.eventId));
 assert.deepEqual(rescored.ledger.map(r=>r.eventId),projection.ledger.map(r=>r.eventId));
 assert.equal(rescored.targets.find(t=>t.target.id===phrase.target.id&&t.practiceMode===phrase.practiceMode).directCounts.correct,1);
 assert(projection.targets.every(t=>t.competence===null));
 assert(aged.targets.filter(t=>t.lastAssessmentAt!==null).every(t=>t.assessmentFreshness==='stale'));
 assert.deepEqual(aged.targets.map(t=>t.directCounts),projection.targets.map(t=>t.directCounts));

 const checks={rawRecordsUnchanged:true,reorderedReplayIdentical:true,duplicateDeliveryAddsNoResponse:true,scopeSeparation:true,requiredSupportOverridesEmptyFlags:true,assistedRetryAddsNoUnaidedAssessment:true,skipReasonAddsNoCompetence:true,laterSyntaxChangeIsExplicit:true,contextIdentifierExcludedFromSubstantiveChange:true,changedAnalysisMarksSameEventStale:true,explicitRescoreReusesEventIds:true,agingChangesPolicyFreshnessOnly:true,overallCompetenceRemainsNull:true};
 const fixture={schemaVersion:1,fixture:true,description:'Entirely authored software fixture. These events are not records of human learners, measured learning, or a validated linguistic experiment.',clock:{start:START,now:NOW,timezone:'UTC'},actor:PERSONAL,rawCount:events.length,uniqueEventCount:new Set(events.map(e=>e.id)).size,events};
 const ledger={schemaVersion:1,fixture:true,description:'Production direct-observation projector applied to the authored fixture, using actual Nabu task definitions.',projection};
 const replay={schemaVersion:1,fixture:true,checks,runs:{baseline:summarize(projection),reordered:summarize(reordered),changedAnalysisStale:summarize(stale),changedAnalysisExplicitRescore:summarize(rescored),otherLearner:summarize(otherProjection),sameLearnerOtherTeam:summarize(teamProjection),tenDayPolicyCheck:summarize(aged)},versionChangeAudit:{eventId:delayed.id,baseline:row(delayed.id),stale:stale.ledger.find(r=>r.eventId===delayed.id),rescored:rescored.ledger.find(r=>r.eventId===delayed.id)}};
 const readme=`# Reproducible evidence episode\n\nThis is an **authored software fixture**, not a human learner study. The answers, timing, identities and outcomes were chosen to exercise Nabu’s production contracts. Nothing here estimates learning benefit, competence, or population performance.\n\n## Reproduce\n\nFrom the repository root:\n\n\`\`\`sh\nnode tools/evidence_episode_demo.mjs\nnode tools/evidence_episode_demo.mjs --check\n\`\`\`\n\nThe first command generates these files. The second recomputes the fixture and checks that the committed artifacts match exactly. No network, model provider, paid API, random sampling, wall-clock input, or real account is used. The pure \`buildEvidenceEpisodeDemo()\` function invokes \`contrastTask\`, \`resolveEvidenceTask\`, and \`projectEvidence\` from the actual application.\n\n## Files\n\n- \`events.json\`: ${events.length} authored input records, including one identical transport redelivery and two records from other scopes. Every envelope carries actor, episode, task, occurrence, modalities, assistance and versioned scoring references.\n- \`ledger.json\`: the full ${projection.ledger.length}-row personal-scope ledger, direct counts, conditions, source references and explicit support boundaries.\n- \`replay.json\`: deterministic reorder, scope separation, analysis-version change, explicit rescore and time-window comparisons. It includes the complete baseline, stale and rescored audit rows for the delayed response.\n\n## What this fixture demonstrates\n\n| Authored event | Verified interpretation | Boundary |\n| --- | --- | --- |\n| Display the existing dialogue | Opportunity to encounter material | No attention, comprehension or correctness is inferred. |\n| Correct base-meaning choice | One visual-recognition response under the supplied choices | No productive or general lexical knowledge is inferred. |\n| Exact redelivery of that event | Same event ID is counted once | Transport retries do not create observations. |\n| Correct feminine-command response with meaning supplied by the task | Task-derived assistance is retained even though the fixture’s client flags falsely say no help | No unaided meaning or production credit. |\n| Incorrect phrase response | One mismatch to this authored cloze rubric | No claim of general inability or a diagnosed cause. |\n| Answer feedback and a correct retry episode | Support and retry are visible in the ledger | The retry does not replace the first response or become fresh independent evidence. |\n| Skip with “too hard” | Explicit reason is retained | No correctness or competence judgment. |\n| Correct phrase response after a fixed two-day gap in a different authored sentence | The actual syntax identifier differs; the delay is ${row(delayed.id).delayedCondition.delayMs} milliseconds | Unknown speaker identity remains unknown. A changed content/context label alone would not qualify; no general transfer or retention estimate is made. |\n| Other learner and same learner in another team | Each appears only in its exact actor/tenant projection | Personal and organization contexts are not pooled. |\n| Changed analysis reference | The existing delayed-response event becomes stale by default | No source event is rewritten or added. |\n| Explicit rescore permission | The same event is interpreted with the supplied new analysis reference | The scorer result is not a second observation or new learning. |\n| Replay at day ten | Old assessments cross the declared seven-day policy window | Counts are retained; there is no learner-specific forgetting calculation. |\n\nThe personal projection has **${projection.ledger.filter(r=>r.counted).length} first, unassisted assessed responses** across its actual targets and modes. This is a fixture count, not an effectiveness result. All overall and target competence values remain \`null\`. The source tasks and translations remain authored drafts; a grammar source is not attestation or instructor review of these particular items.\n\n## Version-change demonstration\n\nThe demo resolver deliberately adds \`-demo-revision-2\` to the current analysis reference for \`contrast:phrase-later\`. It keeps the exact task and response, and does not pretend to validate a new linguistic analysis. Default replay marks the historical interpretation stale. Explicit \`allowRescore:true\` records both the original and applied references while preserving every event ID and timestamp.\n\n## Limits\n\nThis verifies deterministic code paths and auditable boundaries. It does not validate the task rubric as a measure of ability, the declared assistance as independently observed truth, the delay as an optimal interval, the task sequence as a teaching intervention, or the independence of separate episodes. The reader, account storage and real UI behavior are tested elsewhere.\n`;
 return {events:fixture,ledger,replay,readme};
}

if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 const result=buildEvidenceEpisodeDemo(),directory=fileURLToPath(new URL('../docs/evidence-episode/',import.meta.url));
 const artifacts={'events.json':JSON.stringify(result.events,null,2)+'\n','ledger.json':JSON.stringify(result.ledger,null,2)+'\n','replay.json':JSON.stringify(result.replay,null,2)+'\n','README.md':result.readme};
 if(process.argv.includes('--check'))for(const [name,body] of Object.entries(artifacts))assert.equal(await readFile(resolve(directory,name),'utf8'),body,name+' differs from deterministic regeneration.');
 else{await mkdir(directory,{recursive:true});await Promise.all(Object.entries(artifacts).map(([name,body])=>writeFile(resolve(directory,name),body,'utf8')));}
 console.log(JSON.stringify({fixture:true,check:process.argv.includes('--check'),files:Object.keys(artifacts),rawRecords:result.events.rawCount,uniqueRecords:result.events.uniqueEventCount,scopedLedgerRows:result.ledger.projection.ledger.length,countedResponses:result.ledger.projection.ledger.filter(r=>r.counted).length,checks:Object.keys(result.replay.checks).length,allChecksPassed:Object.values(result.replay.checks).every(Boolean)}));
}
