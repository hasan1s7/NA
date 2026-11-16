#!/usr/bin/env node
/** Reproducible synthetic/numerical evaluation. No human data or network calls. */
import { performance } from 'node:perf_hooks';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fitLearner, summarizePrediction, MODEL_VERSION } from '../public/nabu-learner-model.js';
import { selectLearnerDecision, LEARNER_POLICY_VERSION } from '../public/nabu-learner-policy.js';
import { listLearnerTasks, learnerTask, modelTask, LEARNER_TASK_VERSION } from '../public/nabu-learner-tasks.js';

export const EVALUATION_VERSION = 'learner-synthetic-evaluation-v1';
const NOW = Date.parse('2026-11-14T12:00:00.000Z');
const DAY = 86_400_000;
const near = (a, b, tolerance = 1e-10) => Math.abs(a - b) <= tolerance;
const sigmoid = x => 1 / (1 + Math.exp(-x));
const round = (value, digits = 6) => Number.isFinite(value) ? Number(value.toFixed(digits)) : value;
function boundedInteger(value, name, minimum, maximum) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) throw Error(`${name} must be an integer from ${minimum} to ${maximum}.`);
  return value;
}
function rng(seed) {
  let state = seed >>> 0;
  return () => { state = (Math.imul(1664525, state) + 1013904223) >>> 0; return (state + .5) / 4294967296; };
}
function observationRows(taskId, outcomes, prefix, start = NOW - 40 * DAY) {
  return outcomes.map((correct, index) => ({id:`${prefix}:${index}`, taskId, correct, at:start + index * DAY, episodeId:`${prefix}:independent-episode:${index}`, learnerId:'synthetic-learner'}));
}
function prediction(fit, id, extra = {}) {
  const s = summarizePrediction(fit, id, extra);
  return {taskId:id, mean:s.mean, lower:s.lower, upper:s.upper, intervalLevel:s.intervalLevel, status:s.status, priorOnly:s.priorOnly, directCount:s.directCount, evidenceCount:s.evidenceCount, crossLanguageEventCount:s.crossLanguageEventIds.length, diagnostics:s.diagnostics};
}
function fitDescription(fit, milliseconds) {
  return {milliseconds, observations:fit.dataSummary.currentObservations, parameters:fit.dataSummary.parameterCount, draws:fit.samples.length, inferenceStatus:fit.diagnostics.inferenceStatus, converged:fit.diagnostics.converged, truncated:fit.diagnostics.truncated, warnings:fit.diagnostics.warnings, sampling:fit.diagnostics.sampling};
}
function exactDecisionCases() {
  const target = {id:'target', version:1, language:'synthetic', mode:'recognition', components:[{id:'root',kind:'root'},{id:'pattern',kind:'pattern'}]};
  const probe = {id:'probe', version:1, language:'synthetic', mode:'recognition', components:[{id:'pattern',kind:'pattern'}]};
  const fit = {version:'exact-two-state-reference', now:NOW, tasks:[target,probe], samples:[{state:'root-gap'},{state:'pattern-gap'}], sampleWeights:[.5,.5], scope:{actor:{userId:'synthetic-learner',tenantId:null}}, diagnostics:{usable:true,converged:true,inferenceStatus:'exact-finite-state'}, dataSummary:{source:'Hand-specified finite posterior; not fitted learner data.'}};
  const standardActions = () => [
    {id:'root-help',kind:'support',taskId:'target',providedComponentIds:['root'],cost:.2},
    {id:'pattern-help',kind:'support',taskId:'target',providedComponentIds:['pattern'],cost:.2},
    {id:'probe',kind:'diagnostic',taskId:'probe',cost:.1},
  ];
  const basePredictor = (_f,t,o) => t.id === 'probe' ? [1,0] : o.providedComponentIds.length === 2 ? [1,1] : o.providedComponentIds.includes('root') ? [1,0] : o.providedComponentIds.includes('pattern') ? [0,1] : [0,0];
  const scenarios = [
    {id:'profitable-diagnostic', expected:{kind:'diagnostic',loss:.3,evsi:.5,net:.4}},
    {id:'noisy-diagnostic', likelihood:[.8,.2], expected:{kind:'diagnostic',loss:.5,evsi:.3,net:.2}},
    {id:'uninformative-diagnostic', likelihood:[.5,.5], expected:{kind:'support',loss:.7,evsi:0,net:-.1}},
    {id:'informative-no-action-change', completeHelp:true, expected:{kind:'support',loss:.05,evsi:0,net:-.1}},
    {id:'known-gap', weights:[1,0], expected:{kind:'support',loss:.2,evsi:0,net:-.1}},
    {id:'diagnostic-cost-break-even', diagnosticCost:.5, expected:{kind:'support',loss:.7,evsi:.5,net:0}},
    {id:'sequential-budget', duration:2, budget:3, expected:{kind:'support',loss:.7,evsi:0,net:-.4}},
    {id:'no-practice', noPractice:true, expected:{kind:'support',loss:.7,available:false}},
  ];
  return scenarios.map(scenario => {
    const actions = standardActions();
    if (scenario.completeHelp) actions.push({id:'complete-help',kind:'support',taskId:'target',providedComponentIds:['root','pattern'],cost:.05});
    if (scenario.duration) actions.forEach(a => a.seconds = scenario.duration);
    if (scenario.diagnosticCost !== undefined) actions[2].cost = scenario.diagnosticCost;
    const started = performance.now();
    const decision = selectLearnerDecision({fit:{...fit,sampleWeights:scenario.weights??fit.sampleWeights}, now:NOW, targets:[{taskId:'target'}], actions,
      constraints:{costPerSecond:0,avoidPractice:scenario.noPractice??false,...(scenario.budget ? {timeBudgetSeconds:scenario.budget} : {})},
      predictor:(...args) => args[1].id === 'probe' && scenario.likelihood ? scenario.likelihood : basePredictor(...args)});
    const diagnostic = decision.candidates.find(c => c.id === 'probe'), expected = scenario.expected;
    const checks = [decision.primary.kind === expected.kind,near(decision.primary.expectedLoss,expected.loss)];
    if (expected.evsi !== undefined) checks.push(near(diagnostic.evsi,expected.evsi),near(diagnostic.netValue,expected.net));
    if (expected.available !== undefined) checks.push(diagnostic.available === expected.available);
    return {id:scenario.id, expected, observed:{primary:decision.primary.id,kind:decision.primary.kind,expectedLoss:decision.primary.expectedLoss,evsi:diagnostic.evsi??null,netValue:diagnostic.netValue??null,diagnosticAvailable:diagnostic.available,branches:diagnostic.branches??[]},passed:checks.every(Boolean),milliseconds:performance.now()-started};
  });
}

/** Independent Simpson integration for a one-dimensional logistic-normal model. */
export function logisticNormalReference({successes=8,failures=2,steps=12000,limit=12}={}) {
  boundedInteger(successes,'Successes',0,1000); boundedInteger(failures,'Failures',0,1000);
  boundedInteger(steps,'Quadrature steps',100,100000); if (steps % 2) throw Error('Quadrature steps must be even.');
  if (!Number.isFinite(limit) || limit < 6 || limit > 20) throw Error('Quadrature limit must be from 6 to 20.');
  const h = 2 * limit / steps, rows = []; let mass = 0, first = 0, second = 0;
  for (let i = 0; i <= steps; i++) {
    const z = -limit + i * h, p = sigmoid(z);
    const density = Math.exp(-.5*z*z + successes*Math.log(p) + failures*Math.log1p(-p));
    const weight = density * (i === 0 || i === steps ? 1 : i % 2 ? 4 : 2);
    mass += weight; first += weight*p; second += weight*p*p; rows.push({p,weight});
  }
  let cumulative = 0, lower = null, upper = null;
  for (const row of rows) { cumulative += row.weight/mass; if (lower === null && cumulative >= .05) lower = row.p; if (upper === null && cumulative >= .95) upper = row.p; }
  return {method:'Independent composite Simpson integration over a standard-normal logit',successes,failures,steps,logitRange:[-limit,limit],mean:first/mass,variance:second/mass-(first/mass)**2,lower,upper,intervalLevel:.9};
}

function properScores(meanProbability, outcomes) {
  const p = Math.max(1e-12,Math.min(1-1e-12,meanProbability));
  return {n:outcomes.length,brier:outcomes.reduce((sum,y)=>sum+(p-y)**2,0)/outcomes.length,logLoss:outcomes.reduce((sum,y)=>sum-(y*Math.log(p)+(1-y)*Math.log1p(-p)),0)/outcomes.length};
}

export function runLearnerEvaluation({seed=140015,samples=256,burnIn=384}={}) {
  boundedInteger(seed,'Seed',0,0xffffffff); boundedInteger(samples,'Samples per chain',64,1024); boundedInteger(burnIn,'Burn-in',64,1024);
  const started = performance.now(), random = rng(seed), diagnostics = [];
  const ids = {ar:'learner:ar:write:reading',es:'learner:es:write:reading',en:'learner:en:write:reading',vocabulary:'learner:es:write:pattern',target:'learner:ar:write:retrieval',root:'learner:ar:write:base-recall',pattern:'learner:ar:open:pattern'};
  const authored = Object.values(ids).map(id => { const task=learnerTask(id); if(!task)throw Error('Evaluation task is absent: '+id); return task; });
  const tasks = authored.map(modelTask), options = {chains:2,burnIn,samples,thin:1,dynamics:false};
  const makeFit = (name, observations, extra={}) => {
    const at = performance.now();
    const fit = fitLearner({tasks,observations,actor:{userId:'synthetic-learner',tenantId:null},now:NOW,options:{...options,seed:`${seed}:${name}`,...extra}});
    diagnostics.push({id:name,...fitDescription(fit,performance.now()-at)}); return fit;
  };
  const prior = makeFit('prior',[]);
  const arOutcomes = Array.from({length:24},(_,i)=>i<21?1:0), arRows = observationRows(ids.ar,arOutcomes,'ar-shared-reading');
  const sourceOnly = makeFit('arabic-reading-evidence',arRows);
  const conflict = makeFit('opposing-spanish-evidence',[...arRows,...observationRows(ids.es,Array(18).fill(0),'es-opposing-reading')]);
  const gap = makeFit('known-pattern-gap',[
    ...observationRows(ids.root,Array(20).fill(1),'ar-root-known'),
    ...observationRows(ids.pattern,Array(20).fill(0),'ar-pattern-missed'),
  ]);
  const observations = [...observationRows(ids.root,Array(20).fill(1),'ar-root-time'),...observationRows(ids.pattern,Array.from({length:20},(_,i)=>i<16?1:0),'ar-pattern-time')];
  const temporal = makeFit('elapsed-time-forecast',observations,{dynamics:true});
  const rootTask = authored.find(t=>t.id===ids.target);
  const supportActions = rootTask.componentSupport.map((item,i)=>({id:`authored-support-${i}`,kind:'support',title:item.text,taskId:rootTask.id,providedComponentIds:[item.componentId],supportText:item.text,seconds:item.seconds}));
  const actions = [...supportActions,{id:'root-diagnostic',kind:'diagnostic',taskId:ids.root,seconds:15},{id:'pattern-diagnostic',kind:'diagnostic',taskId:ids.pattern,seconds:15}];
  const decisionStarted = performance.now();
  const gapDecision = selectLearnerDecision({fit:gap,now:NOW,targets:[{taskId:ids.target}],actions,constraints:{timeBudgetSeconds:45,costPerSecond:.002}});
  const decisionMilliseconds = performance.now()-decisionStarted;
  const readPredictions = fit => Object.fromEntries(['ar','es','en','vocabulary'].map(key=>[key,prediction(fit,ids[key])]));
  const priorPredictions=readPredictions(prior), sourcePredictions=readPredictions(sourceOnly), conflictPredictions=readPredictions(conflict);
  const heldout=Array.from({length:64},()=>random()<.85?1:0);
  const beforeTime=prediction(temporal,ids.target), afterTime=prediction(temporal,ids.target,{now:NOW+30*DAY});
  const reference=logisticNormalReference();
  const calibrationTask={id:'synthetic:logistic-normal',version:1,language:'synthetic',mode:'production',components:[],guess:0,slip:0,memory:true};
  const fixedScales={intercept:0,meaning:0,root:0,pattern:0,shared:0,word:0,memory:1,context:0,practice:0,forgetting:0,population:0};
  const calibrationStart=performance.now();
  const calibrated=fitLearner({tasks:[calibrationTask],observations:observationRows(calibrationTask.id,[1,1,1,1,1,1,1,1,0,0],'reference'),actor:{userId:'synthetic-learner',tenantId:null},now:NOW,populationPrior:{id:'standard-normal-memory-logit',version:1,memoryMean:0},options:{chains:2,burnIn:384,samples:768,thin:1,dynamics:false,fixedScales,seed:`${seed}:reference`}});
  const sampled=prediction(calibrated,calibrationTask.id);
  const meanError=Math.abs(reference.mean-sampled.mean),lowerError=Math.abs(reference.lower-sampled.lower),upperError=Math.abs(reference.upper-sampled.upper);
  const numericalReference={reference,sampled,absoluteErrors:{mean:meanError,lower:lowerError,upper:upperError},tolerances:{mean:.025,quantile:.06},passed:meanError<=.025&&lowerError<=.06&&upperError<=.06,fit:fitDescription(calibrated,performance.now()-calibrationStart)};
  const exactCases=exactDecisionCases();
  const structuralChecks=[
    {id:'direct-evidence-moves-exact-task',passed:sourcePredictions.ar.mean>priorPredictions.ar.mean,prior:priorPredictions.ar.mean,posterior:sourcePredictions.ar.mean},
    {id:'local-counterevidence-can-overcome-pooled-meaning',passed:conflictPredictions.es.mean<sourcePredictions.es.mean,pooled:sourcePredictions.es.mean,withLocalCounterevidence:conflictPredictions.es.mean},
    {id:'unobserved-local-vocabulary-not-credited',passed:sourcePredictions.vocabulary.directCount===0&&sourcePredictions.vocabulary.priorOnly&&sourcePredictions.vocabulary.mean<.9&&sourcePredictions.vocabulary.upper-sourcePredictions.vocabulary.lower>.1,prediction:sourcePredictions.vocabulary},
    {id:'elapsed-time-does-not-create-unaided-mastery',passed:afterTime.mean<=beforeTime.mean,now:beforeTime.mean,after30Days:afterTime.mean},
    {id:'decision-remains-a-decision-not-a-learning-claim',passed:gapDecision.primary.learningGain===null&&gapDecision.primary.retentionGain===null,primary:gapDecision.primary.id},
  ];
  const catalogue=listLearnerTasks();
  return {
    schemaVersion:1,evaluationVersion:EVALUATION_VERSION,modelVersion:MODEL_VERSION,policyVersion:LEARNER_POLICY_VERSION,taskVersion:LEARNER_TASK_VERSION,
    seed,scenarioTimestamp:NOW,sampler:{...options,seedPolicy:'Explicit seed derived from integer seed and scenario ID.'},
    environment:{node:process.version,platform:process.platform,arch:process.arch},
    scope:'Synthetic authored outcomes and independent numerical references. No human learners, causal interventions, or measured educational benefit.',
    catalogue:{count:catalogue.length,languages:[...new Set(catalogue.map(t=>t.language))].sort(),evaluatedTaskIds:tasks.map(t=>t.id),quality:'Authored mappings and references are not independent linguistic or psychometric validation.'},
    decisionCases:exactCases,
    posteriorScenarios:{
      prior:priorPredictions,arabicReadingEvidence:sourcePredictions,opposingSpanishEvidence:conflictPredictions,
      design:{arabicCorrect:21,arabicTotal:24,spanishCorrect:0,spanishTotal:18,separateEpisodes:true,dynamicsInComparison:false,interpretation:'The shared reading is a declared modeling hypothesis. Local forms retain separate effects. Opposing evidence tests that pooling is defeasible; it is not a causal negative-transfer experiment.'},
      heldoutSynthetic:{sourceTask:ids.ar,generatingProbability:.85,correct:heldout.reduce((a,b)=>a+b,0),total:heldout.length,prior:properScores(priorPredictions.ar.mean,heldout),posterior:properScores(sourcePredictions.ar.mean,heldout),interpretation:'One generated held-out outcome sequence for a constant response probability. Descriptive proper scores, not a calibrated predictive benchmark.'},
      elapsedTime:{now:beforeTime,after30Days:afterTime,interpretation:'A conditional forecast from the declared decay model. No retention benefit of practice was estimated.'},
    },
    actualPosteriorDecision:{status:gapDecision.status,primary:gapDecision.primary,bestTerminal:gapDecision.bestTerminal,candidates:gapDecision.candidates,assumptions:gapDecision.assumptions,uncertainty:gapDecision.uncertainty,milliseconds:decisionMilliseconds},
    numericalReference,structuralChecks,fitDiagnostics:diagnostics,
    checks:{exactDecisions:exactCases.filter(x=>x.passed).length,exactDecisionTotal:exactCases.length,structural:structuralChecks.filter(x=>x.passed).length,structuralTotal:structuralChecks.length,numericalReference:numericalReference.passed,passed:exactCases.every(x=>x.passed)&&structuralChecks.every(x=>x.passed)&&numericalReference.passed},
    limitations:[
      'All observations in this report are synthetic; predictive accuracy and learning benefit on humans remain unmeasured.',
      'The task mapping, guessing/slip values, priors, diagnostic durations, and effort costs are authored assumptions.',
      'Posterior convergence and intervals are reported. A passing synthetic check does not establish psychological identifiability.',
      'Cross-language sharing concerns an explicit reading alignment; no lexical knowledge is granted from a translation or graph neighbor.',
      'Support predictions condition on supplied components. Learning gain and retention gain remain unknown.',
      'Only one diagnostic followed by a terminal action is optimized; no long-horizon teaching policy is claimed.',
      'Wall-clock timings depend on the environment; seeded numerical outputs can be reproduced with the same implementation and settings.',
    ],
    totalMilliseconds:performance.now()-started,
  };
}

export function renderLearnerEvaluation(report) {
  const p=report.posteriorScenarios, lines=[
    '# Nabu learner model: synthetic and numerical evaluation','',
    `Evaluation version: \`${report.evaluationVersion}\`. Model: \`${report.modelVersion}\`. Seed: **${report.seed}**.`, '',
    report.scope,'',
    `**Checks:** ${report.checks.exactDecisions}/${report.checks.exactDecisionTotal} exact decision cases; ${report.checks.structural}/${report.checks.structuralTotal} structural scenarios; numerical reference ${report.checks.numericalReference?'passed':'FAILED'}.`, '',
    '## Exact decision arithmetic','',
    '| Scenario | Selected action | Expected loss | Diagnostic EVSI | Diagnostic net value | Check |','|---|---|---:|---:|---:|---|',
    ...report.decisionCases.map(c=>`| ${c.id} | ${c.observed.primary} | ${round(c.observed.expectedLoss)} | ${c.observed.evsi===null?'Unavailable':round(c.observed.evsi)} | ${c.observed.netValue===null?'Unavailable':round(c.observed.netValue)} | ${c.passed?'Pass':'FAIL'} |`),'',
    'These finite-state calculations exercise the actual decision module with an exact joint posterior. They are implementation checks, not estimated performance on people.','',
    '## Actual posterior predictions on authored tasks','',
    'The Arabic reading receives 21 correct responses in 24 synthetic independent episodes. A second fit adds 18 incorrect Spanish reading responses. The Spanish exceptional word-form task receives no direct observations. Dynamics are disabled for these comparisons.','',
    '| Task | Prior mean | Arabic evidence mean | After Spanish counterevidence | Arabic-evidence 90% interval |','|---|---:|---:|---:|---|',
    ...['ar','es','en','vocabulary'].map(k=>`| ${p.prior[k].taskId} | ${round(p.prior[k].mean)} | ${round(p.arabicReadingEvidence[k].mean)} | ${round(p.opposingSpanishEvidence[k].mean)} | ${round(p.arabicReadingEvidence[k].lower)}–${round(p.arabicReadingEvidence[k].upper)} |`),'',
    'Shared meaning can alter predictions through declared shared variables. Language-specific evidence can counter that prediction, and an unobserved local word form remains uncertain. These are conditional model behaviors; this experiment does not identify causal transfer.','',
    '### Descriptive held-out synthetic scores','',
    `A seeded sequence of ${p.heldoutSynthetic.total} binary responses was generated at a fixed success probability of ${p.heldoutSynthetic.generatingProbability}; ${p.heldoutSynthetic.correct} were correct.`, '',
    '| Prediction | Brier score | Log loss |','|---|---:|---:|',
    `| Prior | ${round(p.heldoutSynthetic.prior.brier)} | ${round(p.heldoutSynthetic.prior.logLoss)} |`,
    `| After Arabic evidence | ${round(p.heldoutSynthetic.posterior.brier)} | ${round(p.heldoutSynthetic.posterior.logLoss)} |`,'',
    'These scores describe one generated sequence and one task. They do not establish calibration, generalization across learners, or superiority to an existing learner model.','',
    '## Independent numerical reference','',
    'With all unrelated effects fixed to zero, the memory logit has a standard-normal prior and a likelihood of eight successes and two failures. Composite Simpson integration provides an independent one-dimensional posterior reference.','',
    '| Quantity | Quadrature | Sampled model | Absolute error |','|---|---:|---:|---:|',
    ...['mean','lower','upper'].map(k=>`| ${k} | ${round(report.numericalReference.reference[k])} | ${round(report.numericalReference.sampled[k])} | ${round(report.numericalReference.absoluteErrors[k])} |`),'',
    `Mean tolerance: ${report.numericalReference.tolerances.mean}; interval-endpoint tolerance: ${report.numericalReference.tolerances.quantile}. These are numerical test tolerances, not confidence statements.`, '',
    '## Decision from a fitted learner posterior','',
    `The synthetic gap case contains 20 correct Arabic base-recall responses and 20 incorrect responses to a separate Arabic pattern task. The selected action is **${report.actualPosteriorDecision.primary.id}**, with modeled immediate expected loss **${round(report.actualPosteriorDecision.primary.expectedLoss)}**. Status: **${report.actualPosteriorDecision.status}**.`, '',
    'The action supplies only an authored component on the target task. Its modeled immediate benefit does not claim a change in the learner\'s knowledge or later retention. The JSON report preserves the alternative losses, diagnostic branches, assumptions, and warnings.','',
    '## Conditional time forecast','',
    `In the separate dynamic scenario, target mean success is ${round(p.elapsedTime.now.mean)} at the evaluation time and ${round(p.elapsedTime.after30Days.mean)} after 30 days with no added evidence. This checks the configured decay mechanism; it is not a measured forgetting curve.`, '',
    '## Sampling and runtime','',
    `Environment: ${report.environment.node} on ${report.environment.platform}/${report.environment.arch}. Total observed runtime: ${round(report.totalMilliseconds,2)} ms.`, '',
    '| Fit | Observations | Parameters | Draws | Converged | Bounded | Runtime ms |','|---|---:|---:|---:|---|---|---:|',
    ...[...report.fitDiagnostics,{id:'quadrature-reference',...report.numericalReference.fit}].map(f=>`| ${f.id} | ${f.observations} | ${f.parameters} | ${f.draws} | ${f.converged===null?'Not assessed':f.converged?'Yes':'No'} | ${f.truncated?'Yes':'No'} | ${round(f.milliseconds,2)} |`),'',
    'A failed convergence check remains visible. The decision policy normally withholds an additional diagnostic when convergence is false. Bounded history or numerical work is reported rather than interpreted as absent learner evidence.','',
    '## Limits','',...report.limitations.map(x=>'- '+x),'',
    '## Reproduce','',
    '```bash',`node tools/evaluate_learner.mjs --seed ${report.seed} --samples ${report.sampler.samples} --burn-in ${report.sampler.burnIn} --output docs/learner-evaluation/results.json`,'```','',
    'The command writes the complete JSON record and a Markdown companion. Numerical outputs are deterministic for the same seed and settings; elapsed runtime is measured on each run.','',
  ];
  return lines.join('\n');
}

async function main(argv) {
  const settings={}; let output=null;
  for(let i=0;i<argv.length;i++) {
    const flag=argv[i];
    if(flag==='--help') { console.log('Usage: node tools/evaluate_learner.mjs [--seed 140015] [--samples 256] [--burn-in 384] [--output path.json]'); return; }
    if(!['--seed','--samples','--burn-in','--output'].includes(flag)||i+1>=argv.length)throw Error('Unknown or incomplete evaluation option: '+flag);
    const value=argv[++i]; if(flag==='--output')output=value; else settings[flag==='--burn-in'?'burnIn':flag.slice(2)]=Number(value);
  }
  const report=runLearnerEvaluation(settings);
  if(output) {
    const requested=resolve(output),extension=extname(requested);
    if(extension!=='.json'&&extension!=='.md')throw Error('--output must end in .json or .md.');
    const base=requested.slice(0,-extension.length),jsonPath=base+'.json',markdownPath=base+'.md';
    await mkdir(dirname(jsonPath),{recursive:true});
    await writeFile(jsonPath,JSON.stringify(report,null,2)+'\n'); await writeFile(markdownPath,renderLearnerEvaluation(report));
    console.log(JSON.stringify({jsonPath,markdownPath,checks:report.checks,totalMilliseconds:report.totalMilliseconds},null,2));
  }else console.log(JSON.stringify(report,null,2));
  if(!report.checks.passed)process.exitCode=1;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main(process.argv.slice(2)).catch(error=>{console.error(error.message);process.exitCode=1;});
