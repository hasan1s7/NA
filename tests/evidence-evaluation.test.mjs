import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as R from '../tools/evaluate_evidence.mjs';

const config={seeds:[11,29],learnersPerSeed:8,budgets:[60,120],learningRegimes:[{id:'assumed-default',gain:.45,retention:.75}]};
const regime=config.learningRegimes[0];
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-12,actual+' ≠ '+expected);
function response(id,itemId,correct,extra={}){return {id,learnerId:'synthetic-person',itemId,mode:'production',episodeId:'episode-'+id,at:1,kind:'assessed',assisted:false,correct,...extra};}

test('research module defines generated worlds and independent family identities without editing the live graph',()=>{
 const representation=R.representationAudit();assert.equal(representation.familyOverlap.length,0);assert.equal(representation.familyDefinitions.length,12);assert.equal(representation.sourceLineages,1);
 assert.equal(representation.application.fixtureOnly,true);assert.equal(representation.application.validation.linguisticCorrectness,'not-checked');assert.equal(representation.application.outputs.length,3);
 assert.equal(new Set(representation.familyDefinitions.map(x=>x.id)).size,12);assert.ok(representation.cases.every(x=>x.learnerClaim===null));
});

test('new-family questions never share a lexical family with training; within-family questions are separately labeled',()=>{
 const f=R.predictionFixture('shared-operation',11,0),byId=new Map(f.items.map(x=>[x.id,x])),trainingItems=new Set(f.events.map(x=>x.itemId)),trainingFamilies=new Set(f.events.map(x=>byId.get(x.itemId).familyId));
 assert.equal(f.events.length,36);assert.equal(trainingItems.size,12);assert.equal(trainingFamilies.size,6);
 for(const q of f.heldout){if(q.split==='new-lexical-family'){assert.equal(trainingFamilies.has(q.item.familyId),false);assert.equal(trainingItems.has(q.item.id),false);}else if(q.split==='new-item-within-family'){assert.equal(trainingFamilies.has(q.item.familyId),true);assert.equal(trainingItems.has(q.item.id),false);}else assert.equal(trainingItems.has(q.item.id),true);}
 assert.deepEqual(new Set(f.heldout.map(q=>q.split)),new Set(['later-same-item','new-item-within-family','new-lexical-family']));
});

test('prediction models receive the same held-out outcomes and cannot mutate shared observations',()=>{
 const f=R.predictionFixture('independent-memorized-items',47,2),before=structuredClone(f);
 for(const q of f.heldout){R.directEstimate(f.events,q.item);R.graphEstimate(f.events,q.item,f.items);}
 assert.deepEqual(f,before);assert.deepEqual(R.predictionFixture('independent-memorized-items',47,2),before);
 assert(f.heldout.every(q=>!f.events.some(e=>e.id===q.questionId)));
});

test('experimental structural support stays separate from direct counts and uses other families once',()=>{
 const f=R.predictionFixture('shared-operation',11,0),item=f.heldout.find(q=>q.split==='later-same-item').item,direct=R.directEstimate(f.events,item),graph=R.graphEstimate(f.events,item,f.items);
 assert.deepEqual(graph.direct,direct.direct);assert.equal(graph.direct.eventIds.length,3);assert.ok(graph.inferred);assert.equal(graph.inferred.sourceFamilyIds.includes(item.familyId),false);
 assert.equal(new Set(graph.inferred.sourceFamilyIds).size,graph.inferred.sourceFamilyIds.length);assert.equal(graph.inferred.sourceEventIds.length,graph.inferred.sourceFamilyIds.length);
 assert.equal(graph.inferred.sourceEventIds.some(id=>direct.direct.eventIds.includes(id)),false);assert.equal(graph.inferred.kind,'synthetic-assumption-not-direct-observation');
});

test('extra sibling forms do not create extra structural source families or direct target evidence',()=>{
 const f=R.predictionFixture('shared-operation',11,0),target=f.heldout.find(q=>q.split==='new-lexical-family').item,before=R.graphEstimate(f.events,target,f.items),sibling={...f.items[0],id:'synthetic-extra-sibling'};
 const extra=response('zz-extra-sibling-event',sibling.id,1,{learnerId:0});const after=R.graphEstimate([...f.events,extra],target,[...f.items,sibling]);
 assert.deepEqual(after.direct,before.direct);assert.deepEqual(after.inferred.sourceFamilyIds,before.inferred.sourceFamilyIds);assert.equal(after.inferred.sourceEventIds.length,before.inferred.sourceEventIds.length);
});

test('a spelling shared across different readings does not merge those observations',()=>{
 const f=R.predictionFixture('same-spelling-different-reading',29,0),target=f.heldout.find(q=>q.split==='new-item-within-family').item,byId=new Map(f.items.map(i=>[i.id,i])),byEvent=new Map(f.events.map(e=>[e.id,e])),estimate=R.graphEstimate(f.events,target,f.items);
 assert.equal(new Set(f.items.map(x=>x.form)).size,1);assert.equal(new Set(f.items.map(x=>x.readingId)).size,2);
 assert.ok(estimate.inferred);for(const id of estimate.inferred.sourceEventIds)assert.equal(byId.get(byEvent.get(id).itemId).readingId,target.readingId);
});

test('conflicting applicability makes the two estimators identical without inventing a chosen analysis',()=>{
 const f=R.predictionFixture('conflicting-analysis',83,0);for(const q of f.heldout){const direct=R.directEstimate(f.events,q.item),graph=R.graphEstimate(f.events,q.item,f.items);assert.equal(graph.probability,direct.probability);assert.equal(graph.inferred,null);assert.match(graph.reason,/conflicting/);}
});

test('a wrong transfer assumption can worsen held-out predictions even when all borrowed responses succeeded',()=>{
 const f=R.predictionFixture('wrong-application-domain',11,0),events=f.events.map(e=>({...e,correct:1})),target=f.heldout.find(q=>q.split==='new-lexical-family').item,direct=R.directEstimate(events,target),graph=R.graphEstimate(events,target,f.items);
 assert.equal(direct.probability,.5);assert(graph.probability>direct.probability);assert(graph.probability**2>direct.probability**2,'For an actual failure, structural overconfidence has a worse Brier score');assert.deepEqual(graph.direct,direct.direct);
});

test('exposure, lookup, pronunciation and knowing or unknowing skips never update the toy counts',()=>{
 const rows=R.semanticAudit();assert.equal(rows.length,9);assert(rows.every(x=>x.passed));
 for(const row of rows.filter(x=>x.id.startsWith('repeated-')||x.id.startsWith('skip-'))){assert.equal(row.acceptedEvents,0);assert.equal(row.probability,.5);}
 const knowing=rows.find(x=>x.id==='skip-already-know'),unknowing=rows.find(x=>x.id==='skip-do-not-know');assert.notEqual(knowing.latentProbability,unknowing.latentProbability);assert.equal(knowing.probability,unknowing.probability);
});

test('assisted and immediate retries cannot erase the first failure or become independent successes',()=>{
 const item={id:'one-item',mode:'production'},first=response('first',item.id,0),same=response('same-episode',item.id,1,{episodeId:first.episodeId,at:2}),retry=response('retry',item.id,1,{retryOfEpisodeId:first.episodeId,at:3});
 const estimate=R.directEstimate([first,same,retry],item);assert.deepEqual(estimate.direct,{successes:0,failures:1,eventIds:['first']});
 const later=response('later',item.id,1,{at:86400000});const updated=R.directEstimate([first,same,retry,later],item);assert.equal(updated.direct.successes,1);assert.equal(updated.direct.failures,1);
});

test('duplicate event IDs count once and contradictory duplicate events are rejected',()=>{
 const e=response('same-id','one-item',1);assert.equal(R.assessedObservations([e,structuredClone(e)]).length,1);assert.throws(()=>R.assessedObservations([e,{...e,correct:0}]),/Conflicting duplicate/);
});

test('the actual production projector passes all semantic fixtures and retains null competence',()=>{
 const report=R.productionSemanticAudit();assert.equal(report.module,'public/nabu-observations.js');assert.equal(report.cases.length,9);assert(report.cases.every(x=>x.passed&&x.competence===null));
 const retry=report.cases.find(x=>x.id==='unaided-failure-then-assisted-retry');assert.deepEqual(retry.actual,{correct:0,incorrect:1});
});

test('Brier, fixed calibration bins and false-ready denominators match hand-computed outcomes',()=>{
 const metrics=R.probabilityMetrics([{probability:.9,correct:0},{probability:.8,correct:1},{probability:.2,correct:0},{probability:.5,correct:1}],.8);
 close(metrics.brier,(.81+.04+.04+.25)/4);close(metrics.falseReadyRate,.5);close(metrics.falseReadyPopulationRate,.25);close(metrics.readyRate,.5);assert.equal(metrics.heldoutQuestions,4);assert.equal(metrics.reliability.reduce((sum,b)=>sum+b.n,0),4);
 assert.equal(R.probabilityMetrics([{probability:.5,correct:1}]).falseReadyRate,null);assert.throws(()=>R.probabilityMetrics([{probability:1.1,correct:0}]),/probability/);
});

test('the diagnostic asks only when answer outcomes lead to different useful actions',()=>{
 const item={id:'critical',mode:'production',taskWeight:4},decision=R.diagnosticDecision({events:[],items:[item],remaining:60});assert.equal(decision.type,'probe');assert.deepEqual(decision.outcomeActions,{correct:'continue',incorrect:'help'});
 const high=Array.from({length:10},(_,i)=>response('high'+i,item.id,1));assert.equal(R.diagnosticDecision({events:high,items:[item],remaining:120}).type,'continue');
});

test('a known low-uncertainty critical gap receives help without a diagnostic question',()=>{
 const f=R.policyFixture('known-critical-gap',11,0),critical=f.items[1],estimate=R.directEstimate(f.events,critical),decision=R.diagnosticDecision({events:f.events,items:f.items,remaining:120});
 assert(estimate.variance<.01);assert(estimate.probability<.2);assert.equal(decision.type,'help');assert.equal(decision.itemId,critical.id);assert.equal(decision.outcomeActions,null);
});

test('a diagnostic reserves time for its outcome-dependent help instead of asking an unactionable question',()=>{
 const item={id:'critical',mode:'production',taskWeight:4};assert.equal(R.diagnosticDecision({events:[],items:[item],remaining:59}).type,'help');assert.equal(R.diagnosticDecision({events:[],items:[item],remaining:39}).type,'continue');
});

test('both policies use identical action costs, pool, time cap and shared potential outcomes',()=>{
 for(const world of R.POLICY_WORLDS)for(const budget of [60,120,240]){
  const common={world,seed:11,learner:0,budget,regime},fixed=R.simulatePolicy({...common,policy:'fixed-practice'}),diagnostic=R.simulatePolicy({...common,policy:'diagnostic'}),allowed=new Set(R.policyFixture(world,11,0).items.map(x=>x.id));
  for(const run of [fixed,diagnostic]){assert(run.usedSeconds<=budget);assert.equal(run.usedSeconds+run.unusedSeconds,budget);assert.equal(run.actions.reduce((sum,a)=>sum+a.seconds,0),run.usedSeconds);assert(run.actions.every(a=>allowed.has(a.itemId)&&a.seconds===(a.type==='probe'?20:40)));assert.equal(run.heldout.length,6);}
  for(const a of fixed.actions){const b=diagnostic.actions.find(x=>x.type===a.type&&x.itemId===a.itemId);if(b){if(a.type==='probe')assert.equal(a.correct,b.correct);else assert.equal(a.assumedGain,b.assumedGain);}}
  assert.deepEqual(fixed.heldout.map(x=>x.itemId),diagnostic.heldout.map(x=>x.itemId));
 }
});

test('help and fewer interruptions are not manufactured knowledge observations',()=>{
 const run=R.simulatePolicy({world:'known-critical-gap',seed:11,learner:0,policy:'diagnostic',budget:120,regime});assert.equal(run.questions,0);assert.equal(run.helpActions,1);assert.equal(run.directEvidenceAfter,run.directEvidenceBefore);assert.equal(run.interruptions,1);
 const target=run.heldout.find(x=>x.itemId==='task-item-2'),initial=R.directEstimate(R.policyFixture('known-critical-gap',11,0).events,{id:target.itemId,mode:'production'});assert.equal(target.probability,initial.probability);assert(target.trueProbability>.15,'Only the simulator latent state receives its assumed learning effect');
});

test('stale confident history is an explicit failure case for the diagnostic policy',()=>{
 const common={world:'stale-success-history',seed:11,learner:0,budget:120,regime},diagnostic=R.simulatePolicy({...common,policy:'diagnostic'}),fixed=R.simulatePolicy({...common,policy:'fixed-practice'});
 assert.equal(diagnostic.actions.length,0);assert(fixed.actions.length>0);assert(diagnostic.expectedTaskSuccess<fixed.expectedTaskSuccess);assert(diagnostic.heldout.filter(x=>x.critical).every(x=>x.probability>=.8&&x.trueProbability===.15));
});

test('different seeds are deterministic replicates and their spread is the sample SD',()=>{
 assert.equal(R.uniform(11,'person','item'),R.uniform(11,'person','item'));assert.notEqual(R.uniform(11,'person','item'),R.uniform(29,'person','item'));assert(R.uniform(11)>0&&R.uniform(11)<1);
 const result=R.spread([1,2,3]);assert.equal(result.mean,2);assert.equal(result.sd,1);assert.equal(result.definedSeeds,3);assert.equal(R.spread([null]).mean,null);
});

test('a small complete run is byte-reproducible and keeps representation, prediction and policy results separate',()=>{
 const one=R.runEvaluation(config),two=R.runEvaluation(config);assert.deepEqual(one,two);assert.equal(one.synthetic,true);assert.equal(one.productionModified,false);assert.ok(one.representation&&one.prediction&&one.policy);
 assert.equal(one.prediction.seedRows.length,R.PREDICTION_WORLDS.length*3*2*config.seeds.length);assert.equal(one.policy.seedRows.length,R.POLICY_WORLDS.length*config.budgets.length*2*config.seeds.length);
 assert.equal(R.resultCSV(one),R.resultCSV(two));assert.equal(R.renderReport(one),R.renderReport(two));assert.match(R.renderReport(one),/not real learner results/);assert.match(R.renderReport(one),/independent-memorized-items/);assert.match(R.renderReport(one),/not launched/);
 for(const row of [...one.prediction.seedRows,...one.policy.seedRows]){assert(Number.isFinite(row.metrics.brier));assert(Number.isFinite(row.metrics.ece));assert(row.metrics.falseReadyRate===null||Number.isFinite(row.metrics.falseReadyRate));}
});

test('generated report artifacts retain exact protocol, fixed seeds, metric definitions and source hash',async()=>{
 const result=JSON.parse(await readFile(new URL('../docs/evidence-evaluation/results.json',import.meta.url),'utf8')),report=await readFile(new URL('../docs/evidence-evaluation/report.md',import.meta.url),'utf8'),csv=await readFile(new URL('../docs/evidence-evaluation/results.csv',import.meta.url),'utf8'),source=await readFile(new URL('../tools/evaluate_evidence.mjs',import.meta.url));
 assert.equal(result.protocol,R.PROTOCOL_VERSION);assert.deepEqual(result.config.seeds,R.FIXED_SEEDS);assert.equal(result.reproducibility.generatorSHA256,createHash('sha256').update(source).digest('hex'));assert.equal(result.synthetic,true);assert.equal(result.productionModified,false);
 assert.equal(csv.trim().split('\n').length,1+result.prediction.seedRows.length+result.policy.seedRows.length);assert.match(report,/Brier = mean/);assert.match(report,/False-ready rate = failed held-out responses among ready predictions/);assert.match(report,/common random numbers/);assert.match(report,/same direct-item estimator/);
 assert.equal(result.semantics.filter(x=>!x.passed).length,0);assert.equal(result.productionSemantics.cases.filter(x=>!x.passed).length,0);
});
