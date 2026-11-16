import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../public/nabu-graph.js';
import * as Structure from '../public/nabu-structure.js';
import * as Kernel from '../public/nabu-graph-kernel.js';
import * as Queries from '../public/nabu-structure-query.js';
import {
 GRAPH_CONFIG,GRAPH_SEEDS,graphUniform,graphSpread,applicationFixture,
 applicationPairwiseProjection,pairwiseReachable,projectionCounterexample,
 conjunctionEvaluation,applicationGateCases,associationFixture,
 cliqueSerializationStats,provenanceEvaluation,distractorEvaluation,
 wideFactorEvaluation,scaleEvaluation,catalogueAudit,evaluateGraph,graphCSV,graphReport,
} from '../tools/evaluate_graph.mjs';

test('seed manifest is fixed and keyed random draws reproduce without mutable order',()=>{
 assert.deepEqual(GRAPH_SEEDS,[11,29,47,83,101,137,173,211,257,307,359,419]);
 const draws=GRAPH_SEEDS.map(seed=>graphUniform(seed,'fixture',7));
 assert.deepEqual([...GRAPH_SEEDS].reverse().map(seed=>graphUniform(seed,'fixture',7)).reverse(),draws);
 assert(draws.every(x=>x>0&&x<1));assert.equal(new Set(draws).size,GRAPH_SEEDS.length);
});

test('spread uses sample SD across seed replicates, not standard error',()=>{
 assert.deepEqual(graphSpread([1,2,3]),{mean:2,sd:1,min:1,max:3,n:3});
 assert.deepEqual(graphSpread([]),{mean:null,sd:null,min:null,max:null,n:0});
});

test('fictional application fixture retains every complete part and is excluded by default',()=>{
 const value=applicationFixture(),factor=value.factors[0],index=Kernel.createIncidenceIndex(value);
 assert.equal(factor.fixtureOnly,true);assert.equal(factor.application.fixtureOnly,true);
 assert.equal(factor.application.validation.linguisticCorrectness,'not-checked');
 assert(factor.application.inputs.every(x=>x.form.startsWith('zzfixture_')));
 assert.equal(index.assessApplication(factor.id,{availableNodeIds:['A','B']}).availability,'blocked');
 assert.deepEqual(index.getFactor(factor.id).application,factor.application);
});

test('same flattened edges cannot distinguish a conjunction from two unary rules',()=>{
 const result=projectionCounterexample();
 assert.equal(result.samePairwiseProjection,true);assert.deepEqual(result.andProjection,[['A','C'],['B','C']]);
 assert.equal(result.andAvailable,false);assert.equal(result.eitherAvailable,true);
});

for(const arity of [1,2,3,4])test('independent exhaustive set-inclusion oracle for arity '+arity,()=>{
 const required=Array.from({length:arity},(_,i)=>'input-'+i),snapshot=applicationFixture({inputIds:required}),index=Kernel.createIncidenceIndex(snapshot),edges=applicationPairwiseProjection(snapshot);
 let falsePairwise=0;
 for(let mask=0;mask<2**arity;mask++){
  const supplied=required.filter((_,i)=>(mask&(1<<i))!==0),expected=mask===2**arity-1;
  const actual=index.assessApplication(snapshot.factors[0].id,{availableNodeIds:supplied,includeFixtures:true});
  assert.equal(actual.availability==='available',expected);
  if(pairwiseReachable(edges,supplied).includes('C')&&!expected)falsePairwise++;
 }
 assert.equal(falsePairwise,2**arity-2);
});

test('matched synthetic comparison includes unary control and explicit full/empty cases',()=>{
 const value=conjunctionEvaluation({...GRAPH_CONFIG,seeds:[11,29],trialsPerSeed:16});
 assert.equal(value.seedRows.length,2*GRAPH_CONFIG.arities.length*2);
 for(const row of value.seedRows){
  assert.equal(row.metrics.n,16);assert(row.metrics.trueAvailable>=1);assert(row.metrics.trueAvailable<16);
  if(row.model==='incidence'||row.arity===1){assert.equal(row.metrics.fp,0);assert.equal(row.metrics.fn,0);}
 }
 assert(value.seedRows.some(r=>r.model==='pairwise'&&r.arity>1&&r.metrics.fp>0));
});

test('context, quality, alternatives and opt-in fixtures match predeclared statuses',()=>{
 const cases=applicationGateCases();assert.equal(cases.length,10);assert(cases.every(x=>x.pass));
 assert.equal(cases.find(x=>x.id==='context-unknown').actual,'context-unknown');
 assert.equal(cases.find(x=>x.id==='context-mismatch').actual,'context-mismatch');
});

test('same-output alternative is still conservatively unresolved',()=>{
 const snapshot=applicationFixture({alternatives:1}),app=snapshot.factors[0].application;
 assert.deepEqual(app.outputs,app.competingAnalyses[0].outputs);
 const result=Kernel.createIncidenceIndex(snapshot).assessApplication(snapshot.factors[0].id,{availableNodeIds:['A','B'],includeFixtures:true});
 assert.equal(result.availability,'unresolved-analysis');assert.equal(result.witness,null);
});

test('association discovery never turns a complete fixture application into unary reachability',()=>{
 const snapshot=applicationFixture(),result=Kernel.createIncidenceIndex(snapshot).queryNeighborhood({seedIds:['A'],relationTypes:['complete-application'],maxDepth:8,includeFixtures:true});
 assert.deepEqual(result.answers,[]);assert.equal(result.issues[0].code,'application-requires-all-inputs');
});

test('one, five and twenty copied references remain one declared source lineage',()=>{
 for(const result of provenanceEvaluation()){
  assert.equal(result.witness.sourceLineageCount,1);
  assert.equal(result.witness.provenanceRefs.length,result.copyCount);
  assert.equal(result.witness.factorIds.length,result.copyCount);
  assert.equal(result.witness.independenceEstablished,false);
  assert.equal(result.witness.automaticEvidenceTransfer,false);
 }
});

test('explicit relation filter makes answers and counted work invariant to topic distractors',()=>{
 const rows=distractorEvaluation();assert.deepEqual(rows.map(r=>r.distractors),[0,10,100,1000]);
 for(const row of rows){
  assert.deepEqual(row.query.answers.map(a=>a.nodeId),['relevant']);
  assert.deepEqual(row.query.completeness.work,{factors:1,incidences:2,nodes:2});
  assert.equal(row.query.completeness.complete,true);
 }
});

test('a wide factor consumes only the fixed port budget and reports incompleteness',()=>{
 for(const row of wideFactorEvaluation()){
  assert.equal(row.query.completeness.work.incidences,16);assert.equal(row.query.answers.length,16);
  assert.equal(row.query.completeness.complete,false);assert(row.query.completeness.reasons.includes('maxIncidences'));
 }
});

test('streamed clique byte count equals independent explicit serialization',()=>{
 const snapshot=associationFixture({factorCount:8,arity:4}),explicit=[];
 for(const factor of snapshot.factors)for(let i=0;i<factor.members.length;i++)for(let j=0;j<factor.members.length;j++)if(i!==j)explicit.push({from:factor.members[i].nodeId,to:factor.members[j].nodeId,type:factor.type});
 const count=cliqueSerializationStats(snapshot);
 assert.equal(count.directedEdges,8*4*3);assert.equal(count.serializedEdgeArrayBytes,Buffer.byteLength(JSON.stringify(explicit)));
});

test('scale fixtures retain exactly k incidences per factor without expanded runtime pairs',()=>{
 const result=scaleEvaluation({...GRAPH_CONFIG,scaleFactors:[100],scaleArities:[2,4,8,16]});
 for(const row of result.rows){
  assert.equal(row.membershipIncidences,row.factorCount*row.arity);
  assert.equal(row.directedEdges,row.membershipIncidences*(row.arity-1));
  assert.equal(row.indexStats.pairwiseEdgesMaterialized,0);
  for(const [key,value]of Object.entries(row.query.completeness.work))assert(value<=row.query.completeness.limits['max'+key[0].toUpperCase()+key.slice(1)]);
 }
});

test('same spelling is language scoped and one surface may retain multiple alignment readings',()=>{
 assert.notEqual(Structure.surfaceFormId('gift','en'),Structure.surfaceFormId('gift','de'));
 const query=Queries.lookupAlignmentWitnesses({text:'light',sourceLang:'en',targetLang:'es'});
 assert.equal(query.status,'ambiguous');assert.deepEqual(query.answers.map(a=>a.legacyConceptId).sort(),['colors.light','home.light']);
 assert.equal(query.capabilities.lexemeInventory,false);assert.equal(query.capabilities.lexicalSenseInventory,false);
});

test('answer truncation leaves the known ambiguity and exact candidate total visible',()=>{
 const query=Queries.lookupAlignmentWitnesses({text:'light',sourceLang:'en',targetLang:'es',budget:{maxAnswers:1}});
 assert.equal(query.answers.length,1);assert.equal(query.status,'ambiguous');assert.equal(query.completeness.totalMatches,2);
 assert.equal(query.completeness.complete,false);assert.equal(query.completeness.truncated,true);
 assert.equal(query.completeness.work.proposals,1);assert.equal(query.omittedAlternativeCount,1);
 assert.equal(query.alternativeCompleteness.complete,false);
});

test('an idiom witness selects the meaning-rendering role used by the existing translator',()=>{
 const id='expressions.cats_paw',concept=G.concept(id),result=Queries.lookupAlignmentWitnesses({text:concept.terms.en,sourceLang:'en',targetLang:'ja'}),answer=result.answers.find(x=>x.legacyConceptId===id);
 assert.equal(answer.translation.back,G.translation(id,'en','ja').back);
 const witness=result.witnesses[answer.witnessId];assert.equal(witness.steps.at(-1).to.role,'authored-meaning-rendering');
 assert.notEqual(answer.translation.back,concept.terms.ja);
});

test('real catalogue audit preserves roles, source anchors and sampled translator contracts',()=>{
 const result=catalogueAudit({fullTranslationParity:false});
 assert.equal(result.compatibility.pairsChecked,528);assert.equal(result.compatibility.translationMismatches,0);assert.equal(result.compatibility.missingAlignmentAnswers,0);
 assert.equal(result.snapshot.roundtripStable,true);assert(result.snapshot.sameSurfaceDifferentRolePairs>0);
 assert.equal(result.occurrences.length,24);assert(result.occurrences.every(r=>r.answerCount===1&&r.complete&&r.alignmentId===null&&r.lexemeId===null&&r.senseId===null));
 assert.equal(result.snapshot.indexStats.semantics.application,undefined);
});

test('unknown lookup is a catalogue absence rather than an exhaustive-language claim',()=>{
 const result=Queries.lookupAlignmentWitnesses({text:'zzfixture_unknown_surface',sourceLang:'en',targetLang:'es'});
 assert.equal(result.status,'missing');assert.equal(result.answers.length,0);assert.equal(result.capabilities.exhaustiveLexicon,false);
});

test('small full evaluation is byte-reproducible and emits explicit acceptance statements',async()=>{
 const config={...GRAPH_CONFIG,seeds:[11],trialsPerSeed:8,arities:[1,2],scaleFactors:[100],scaleArities:[2],copyCounts:[1,5],distractorCounts:[0,10],wideFactorSizes:[100]};
 const first=await evaluateGraph(config,{fullTranslationParity:false}),second=await evaluateGraph(config,{fullTranslationParity:false});
 assert.deepEqual(first,second);assert(first.checks.every(c=>c.pass));assert.equal(first.learnerModelUsed,false);assert.equal(first.productionGraphMutated,false);
 assert.match(first.reproducibility.dependencySHA256['public/nabu-graph-kernel.js'],/^[a-f0-9]{64}$/);
 const csv=graphCSV(first);assert.equal(csv.trimEnd().split('\n').length,1+first.conjunction.seedRows.length+first.scale.rows.length);
 const report=graphReport(first);assert.match(report,/not confidence intervals about people/);assert.match(report,/not a linguistic benchmark/);assert.match(report,/Query counters exclude construction/);
});
