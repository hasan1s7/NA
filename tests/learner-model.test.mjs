import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MODEL_VERSION, normalizeModelTask, fitLearner, fitLearnerAsync,
  predictSamples, summarizePrediction, fitPopulation,
} from '../public/nabu-learner-model.js';

const NOW = Date.parse('2026-11-14T12:00:00Z');
const DAY = 86_400_000;
const ACTOR = {userId:'alice',tenantId:null};
const ZERO = Object.fromEntries(['intercept','meaning','root','pattern','shared','word','memory','context','practice','forgetting','population'].map(k=>[k,0]));
const sigmoid = x => 1/(1+Math.exp(-x));
const close = (actual,expected,tolerance=1e-10) => assert.ok(Math.abs(actual-expected)<=tolerance, `${actual} differs from ${expected}, tolerance ${tolerance}`);
const task = (id='root',extra={}) => ({id,version:1,language:'ar',mode:'production',components:[{id:'write',kind:'root'}],guess:0,slip:0,...extra});
const rows = (id, outcomes, extra={}) => outcomes.map((correct,i)=>({id:`${id}:${i}`,taskId:id,correct,at:NOW-(outcomes.length-i)*DAY,episodeId:`${id}:episode:${i}`,learnerId:'alice',...extra}));
function fit(tasks=[task()],observations=[],options={},extra={}) {
  return fitLearner({tasks,observations,actor:ACTOR,now:NOW,options:{dynamics:false,seed:'learner-model-tests',...options},...extra});
}

// Independent numerical integration over a scalar logit, with no sampler code.
function integrate(successes,failures,prior,{limit=16,step=.002,conditionalVariance=null}={}) {
  let mass=0,first=0,second=0,varianceMass=0;
  const points=[];
  for(let x=-limit;x<=limit;x+=step){
    const p=sigmoid(x),w=prior(x)*p**successes*(1-p)**failures;
    mass+=w;first+=w*p;second+=w*p*p;
    if(conditionalVariance)varianceMass+=w*conditionalVariance(x);
    points.push([p,w]);
  }
  let cumulative=0,lower=null,upper=null;
  for(const [p,w] of points){cumulative+=w/mass;if(lower===null&&cumulative>=.05)lower=p;if(upper===null&&cumulative>=.95)upper=p;}
  return {mean:first/mass,variance:second/mass-(first/mass)**2,lower,upper,hyperVariance:varianceMass/mass};
}

test('elliptical slice posterior agrees with independent logistic-normal quadrature',()=>{
  const observations=rows('root',[...Array(8).fill(1),0,0]);
  const fitted=fit([task()],observations,{chains:2,burnIn:256,samples:1024,seed:'quad',fixedScales:{...ZERO,root:1}});
  const expected=integrate(8,2,x=>Math.exp(-x*x/2));
  const p=summarizePrediction(fitted,'root');
  close(p.mean,expected.mean,.02);
  close(p.variance,expected.variance,.004);
  close(p.lower,expected.lower,.035);
  close(p.upper,expected.upper,.035);
  assert.equal(fitted.diagnostics.converged,true);
  assert.equal(fitted.diagnostics.sampling.sliceBoundHits,0);
});

test('variance Gibbs update agrees with the integrated normal-inverse-Gamma posterior',()=>{
  // beta|v ~ Normal(0,v), v ~ IG(3,1.28); integrating v gives
  // p(beta) proportional to (1+beta^2/(2*1.28))^(-3.5).
  const fixed={...ZERO};delete fixed.root;
  const observations=rows('root',Array(24).fill(1));
  const fitted=fit([task()],observations,{chains:2,burnIn:512,samples:2048,seed:'ig-reference',fixedScales:fixed});
  const expected=integrate(24,0,x=>(1+x*x/(2*1.28))**(-3.5),{
    limit:50,step:.004,conditionalVariance:x=>(1.28+.5*x*x)/2.5,
  });
  const p=summarizePrediction(fitted,'root');
  const group=fitted.hyperparameters.find(g=>g.group==='root:production');
  close(p.mean,expected.mean,.025);
  close(group.varianceMean,expected.hyperVariance,.25);
  assert.ok(group.varianceMean>group.priorMean+.2,'data must update the variance hyperposterior');
});

test('empty data produces a broad, explicitly prior predictive distribution',()=>{
  const fitted=fit([task()],[],{samples:512});
  const p=summarizePrediction(fitted,'root');
  assert.equal(fitted.version,MODEL_VERSION);
  assert.equal(fitted.diagnostics.inferenceStatus,'prior-only');
  assert.equal(p.status,'prior-only');assert.equal(p.priorOnly,true);
  close(p.mean,.5,.05);
  assert.ok(p.upper-p.lower>.5);
  assert.equal(fitted.dataSummary.likelihoodParameterCount,0);
  assert.ok(fitted.dataSummary.conditionallySampledParameterCount>0);
  assert.ok(fitted.hyperparameters.every(g=>g.status==='prior-only'));
});

test('required components retain AND semantics; whole-form retrieval is an explicit alternative',()=>{
  const parts=[{id:'r',kind:'root'},{id:'p',kind:'pattern'}];
  const both=task('both',{components:parts,guess:.2,slip:.1});
  const alternative=task('alternative',{components:parts,guess:.2,slip:.1,memory:true});
  const exception=task('exception',{components:[],guess:.2,slip:.1,memory:true});
  const fitted=fit([both,alternative,exception],[],{fixedScales:ZERO});
  const m=sigmoid(-1.5);
  close(summarizePrediction(fitted,'both').mean,.2+.7*.25);
  close(summarizePrediction(fitted,'alternative').mean,.2+.7*(m+(1-m)*.25));
  close(summarizePrediction(fitted,'exception').mean,.2+.7*m);
  assert.throws(()=>normalizeModelTask(task('invalid',{components:[]})),/empty conjunction/i);
  const memoryOnly=fit([exception],[],{fixedScales:ZERO});
  assert.deepEqual([...new Set(memoryOnly.design.variables.map(v=>v.kind))],['memory']);
});

test('supplied components change only the conditional task prediction',()=>{
  const t=task('both',{components:[{id:'r',kind:'root'},{id:'p',kind:'pattern'}],slip:.04});
  const fitted=fit([t],[],{fixedScales:ZERO}),before=JSON.stringify(fitted);
  close(summarizePrediction(fitted,t).mean,.96*.25);
  close(summarizePrediction(fitted,t,{providedComponentIds:['r']}).mean,.96*.5);
  close(summarizePrediction(fitted,t,{providedComponentIds:['r','p']}).mean,.96);
  assert.throws(()=>predictSamples(fitted,t,{providedComponentIds:['missing']}),/declared/);
  assert.throws(()=>predictSamples(fitted,t,{providedComponentIds:['r','r']}),/distinct/);
  assert.equal(JSON.stringify(fitted),before);
});

test('cross-language sharing requires an explicit mapping; identical IDs do not imply transfer',()=>{
  const ar=task('ar',{components:[{id:'meaning',kind:'meaning',transferGroup:'written-reading'}]});
  const es=task('es',{language:'es',components:[{id:'meaning',kind:'meaning',transferGroup:'written-reading'}]});
  const unrelated=task('unrelated',{language:'en',components:[{id:'meaning',kind:'meaning'}]});
  const fitted=fit([ar,es,unrelated],rows('ar',Array(20).fill(1)),{
    burnIn:256,samples:512,fixedScales:{...ZERO,shared:1},
  });
  const a=summarizePrediction(fitted,'ar'),b=summarizePrediction(fitted,'es'),c=summarizePrediction(fitted,'unrelated');
  assert.ok(a.mean>.8);close(a.mean,b.mean);
  close(c.mean,.5);
  assert.equal(b.crossLanguageEventIds.length,20);
  assert.equal(c.crossLanguageEventIds.length,0);
  assert.equal(c.status,'prior-only');
});

test('partial pooling supports a sparse translation and allows contradictory local evidence',()=>{
  const ar=task('ar',{components:[{id:'meaning-ar',kind:'meaning',transferGroup:'written-reading'}]});
  const es=task('es',{language:'es',components:[{id:'meaning-es',kind:'meaning',transferGroup:'written-reading'}]});
  const options={burnIn:384,samples:768,fixedScales:{...ZERO,meaning:.7,shared:1},seed:'partial-pooling'};
  const a=rows('ar',Array(24).fill(1));
  const sparse=fit([ar,es],a,options),conflict=fit([ar,es],[...a,...rows('es',Array(24).fill(0))],options);
  const source=summarizePrediction(sparse,'ar'),target=summarizePrediction(sparse,'es');
  assert.ok(target.mean>.6&&target.mean<source.mean);
  assert.ok(target.upper-target.lower>.25);
  assert.ok(summarizePrediction(conflict,'es').mean<target.mean-.2);
  assert.ok(summarizePrediction(conflict,'ar').mean>.65);
});

test('recognition evidence does not become production evidence',()=>{
  const recognition=task('recognition',{mode:'recognition'}),production=task('production');
  const fitted=fit([recognition,production],rows('recognition',Array(16).fill(1)),{burnIn:256,samples:512});
  const p=summarizePrediction(fitted,'production');
  assert.equal(p.status,'prior-only');assert.equal(p.evidenceCount,0);
  assert.equal(p.crossLanguageEventIds.length,0);
  assert.ok(p.upper-p.lower>.5);
  assert.ok(fitted.hyperparameters.filter(g=>g.mode==='production').every(g=>g.status==='prior-only'));
});

test('scale-only evidence is distinguished from shared-language ability evidence',()=>{
  const ar=task('ar'),es=task('es',{language:'es'});
  const fitted=fit([ar,es],rows('ar',Array(12).fill(1)),{samples:256});
  const p=summarizePrediction(fitted,'es');
  assert.equal(p.hyperparameterOnly,true);
  assert.equal(p.crossLanguageEventIds.length,0);
  assert.equal(p.sharedEffectEventIds.length,0);
  assert.equal(p.hyperparameterEventIds.length,12);
  assert.ok(p.upper-p.lower>.4);
});

test('transfer correlation includes baseline, local, word, context and shared variances',()=>{
  const component={id:'m',kind:'meaning',transferGroup:'literal-written'};
  const ar=task('ar',{components:[component],contextKey:'sentence'});
  const es=task('es',{language:'es',components:[component],contextKey:'sentence'});
  const fitted=fit([ar,es],[],{fixedScales:{...ZERO,intercept:.2,meaning:.3,shared:.4,word:.5,context:.6}});
  const group=fitted.transferGroups[0];
  close(group.correlationMean,.16/(.04+.09+.16+.25+.36));
  assert.equal(group.pairs.length,1);
  assert.match(group.meaning,/conditional-prior/);
});

test('time features precede the response and future predictions retain uncertainty',()=>{
  const observations=rows('root',[1,1,0,1,0]);
  const fitted=fit([task()],observations,{dynamics:true,burnIn:256,samples:512});
  const now=summarizePrediction(fitted,'root'),later=summarizePrediction(fitted,'root',{now:NOW+365*DAY});
  assert.ok(later.mean<now.mean);
  assert.equal(fitted.dynamics.practiceObservations,4);
  assert.equal(fitted.dynamics.elapsedObservations,4);
  assert.equal(fitted.dynamics.parameters[0].causal,false);
  assert.equal(fitted.dynamics.parameters[0].identified,false);
  const first=fit([task()],rows('root',[1]),{dynamics:true});
  assert.equal(first.dynamics.practiceObservations,0);
  assert.equal(first.dynamics.elapsedObservations,0);
  assert.equal(first.dynamics.forgettingStatus,'prior-sensitive');
  assert.throws(()=>predictSamples(fitted,'root',{now:NOW-1}),/Prediction time/);
});

test('disabling dynamics gives identical predictions at later times',()=>{
  const fitted=fit([task()],rows('root',[1,0,1]));
  assert.deepEqual(predictSamples(fitted,'root'),predictSamples(fitted,'root',{now:NOW+300*DAY}));
  assert.equal(fitted.dynamics.enabled,false);
});

test('seeding, input sorting, and async chunking replay exactly',async()=>{
  const tasks=[task('a'),task('b',{language:'es'})],observations=[...rows('a',[1,0,1]),...rows('b',[0,1])];
  const input={tasks,observations,actor:ACTOR,now:NOW,options:{seed:'exact-replay',samples:32,burnIn:20,dynamics:false}};
  const synchronous=fitLearner(input),progress=[];
  const asynchronous=await fitLearnerAsync(input,{yieldEvery:24,onProgress:p=>progress.push(p)});
  assert.deepEqual(asynchronous,synchronous);
  assert.deepEqual(fitLearner({...input,tasks:[...tasks].reverse(),observations:[...observations].reverse()}),synchronous);
  assert.ok(progress.some(p=>p.phase==='sampling'));
  assert.equal(progress.at(-1).phase,'complete');
  assert.deepEqual(JSON.parse(JSON.stringify(synchronous)),synchronous);
});

test('async fitting honors abort without returning a partial fit',async()=>{
  const controller=new AbortController();controller.abort();
  await assert.rejects(fitLearnerAsync({tasks:[task()],observations:[],actor:ACTOR,now:NOW},{signal:controller.signal}),{name:'AbortError'});
});

test('current actor and tenant boundaries reject accidental mixed-user likelihoods',()=>{
  assert.throws(()=>fit([task()],rows('root',[1],{learnerId:'bob'})),/another actor/);
  assert.throws(()=>fit([task()],rows('root',[1],{tenantId:'other-team'})),/another tenant/);
  assert.throws(()=>fit([task()],[],{}, {actor:{userId:null,tenantId:'team'}}),/account/);
  assert.throws(()=>fit([task()],[],{}, {actor:{userId:'!locked',tenantId:null}}),/locked/);
});

test('cohort observations require a named, explicitly authorized scope',()=>{
  const cohort=rows('root',[1,1,0],{learnerId:'bob'});
  assert.throws(()=>fit([task()],[],{}, {populationObservations:cohort}),/explicit consent/);
  assert.throws(()=>fit([task()],[],{populationConsent:true},{populationObservations:cohort}),/named/);
  const fitted=fit([task()],[],{populationConsent:true,populationScope:'consented-study'},{populationObservations:cohort});
  assert.equal(fitted.scope.populationUseExplicit,true);
  assert.equal(fitted.scope.populationScope,'consented-study');
  assert.equal(fitted.dataSummary.currentObservations,0);
  assert.equal(fitted.dataSummary.populationObservations,3);
  assert.equal(summarizePrediction(fitted,'root').populationInformed,true);
  assert.throws(()=>fit([task()],[],{populationConsent:true,populationScope:'study'},{populationObservations:rows('root',[1])}),/different/);
});

test('population calibration returns a declared approximation without raw cohort records',()=>{
  const observations=[...rows('root',[1,1,1]),...rows('root',[1,0,1],{learnerId:'bob'})];
  assert.throws(()=>fitPopulation({tasks:[task()],observations,now:NOW,scope:'study'}),/authorization/);
  const prior=fitPopulation({tasks:[task()],observations,now:NOW,scope:'study',consent:true,options:{samples:32,burnIn:32,dynamics:false,seed:'cohort'}});
  assert.equal(prior.method,'moment-matched-hyperposterior');
  assert.equal(prior.learners,2);assert.equal(prior.observations,6);
  assert.ok(Number.isFinite(prior.baselineMeans['ar:production']));
  assert.equal('samples' in prior,false);
  assert.ok(prior.limitations.some(s=>s.includes('calibration uncertainty')));
  assert.doesNotThrow(()=>fit([task()],[],{}, {populationPrior:prior}));
});

test('duplicates, dependent retries, future records and stale task versions cannot inflate evidence',()=>{
  const first=rows('root',[1])[0];
  const observations=[first,{...first},{...first,id:'retry',at:first.at+1},
    {...first,id:'future',at:NOW+1,episodeId:'future'},
    {...first,id:'old-version',taskVersion:99,episodeId:'old'},
    {...first,id:'unknown-task',taskId:'absent',episodeId:'unknown'}];
  const fitted=fit([task()],observations);
  assert.equal(fitted.dataSummary.currentObservations,1);
  assert.deepEqual(new Set(fitted.dataSummary.excluded.map(r=>r.reason)),new Set([
    'duplicate-event','same-task-episode-repeat','future-event','task-version-mismatch','task-outside-candidate-scope',
  ]));
  assert.throws(()=>fit([task()],[first,{...first,correct:0}]),/conflicting/);
  assert.throws(()=>fit([task()],[first,{...first,taskVersion:2}]),/conflicting/);
});

test('history omission is bounded, explicit and never silently counted as evidence',()=>{
  const fitted=fit([task()],rows('root',[1,0,1,1,0,1]),{maxObservations:3});
  assert.equal(fitted.dataSummary.currentObservations,3);
  assert.equal(fitted.diagnostics.truncated,true);
  assert.equal(fitted.diagnostics.inferenceStatus,'bounded-approximation');
  assert.equal(fitted.dataSummary.excluded.filter(r=>r.reason==='bounded-history-omission').length,3);
  assert.deepEqual(fitted.observations.map(r=>r.id),['root:3','root:4','root:5']);
});

test('compound-only evidence remains explicitly unidentified',()=>{
  const t=task('compound',{components:[{id:'root',kind:'root'},{id:'pattern',kind:'pattern'}],memory:true});
  const fitted=fit([t],rows('compound',[1,0,1]));
  assert.equal(fitted.diagnostics.identifiability.componentParametersIdentified,false);
  assert.deepEqual(fitted.diagnostics.identifiability.compoundOnlyTasks,['compound']);
});

test('extreme observations, guessing and slipping preserve finite probability bounds',()=>{
  const t=task('root',{guess:.3,slip:.1});
  for(const correct of [0,1]){
    const fitted=fit([t],rows('root',Array(45).fill(correct)),{burnIn:128,samples:128});
    assert.ok(predictSamples(fitted,'root').every(p=>Number.isFinite(p)&&p>=.3&&p<=.9));
    assert.ok(fitted.samples.every(s=>s.values.every(Number.isFinite)&&s.variances.every(Number.isFinite)));
  }
});

test('unknown tasks and changed definitions require an explicit refit',()=>{
  const fitted=fit();
  assert.throws(()=>predictSamples(fitted,'missing'),/outside/);
  assert.throws(()=>predictSamples(fitted,task('root',{version:2})),/differs/);
  const p=summarizePrediction(fitted,'missing');
  assert.equal(p.status,'unsupported');assert.equal(p.mean,null);
});

test('invalid definitions and excessive work fail before returning a partial model',()=>{
  assert.throws(()=>fit([task('x'),task('x')]),/Duplicate/);
  assert.throws(()=>fit([task('x'),task('y')],[],{maxTasks:1}),/Task bound/);
  assert.throws(()=>fit([task()],[],{maxParameters:1}),/Parameter bound/);
  assert.throws(()=>fit([task()],[],{chains:4,burnIn:2048,samples:2048,thin:8}),/iteration bound/);
  assert.throws(()=>normalizeModelTask(task('x',{version:NaN})),/version/);
  assert.throws(()=>normalizeModelTask(task('x',{guess:.8,slip:.3})),/less than one/);
  assert.throws(()=>normalizeModelTask(task('x',{components:[{id:'r',kind:'root'},{id:'r',kind:'pattern'}]})),/duplicated/);
  assert.throws(()=>fit([task()],[],{seed:{}}),/seed/);
});
