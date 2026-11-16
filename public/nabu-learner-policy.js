/** One-step Bayesian decisions over a scoped learner posterior.
 *
 * The loss concerns immediate task performance with explicitly supplied support.
 * It is not a causal estimate of learning, retention, or intervention benefit.
 * Diagnostics are useful only through their effect on the next terminal choice.
 * This module performs no I/O and never modifies the fit or observation ledger.
 */
import * as LearnerModel from './nabu-learner-model.js';

export const LEARNER_POLICY_VERSION = 'bayes-immediate-decision-v1';
export const LEARNER_POLICY_LIMITS = Object.freeze({targets:32,actions:64,samples:4096,workUnits:8000000});
export const DEFAULT_COST_PER_SECOND = 0.002;

const EPS = 1e-12;
const copy = value => value == null ? value : structuredClone(value);
const object = value => !!value && typeof value === 'object' && !Array.isArray(value);
const finite = (value,name,min=0) => {
 if(typeof value !== 'number' || !Number.isFinite(value) || value < min)throw Error(name+' must be a finite number at least '+min+'.');
 return value;
};
function identifier(value,name){
 if(typeof value!=='string'||!value.trim()||value.length>240||/[\u0000-\u001f\u007f]/u.test(value))throw Error(name+' must be a nonempty bounded identifier.');
 return value;
}
function strings(value,name){
 if(value===undefined)return [];
 if(!Array.isArray(value)||value.length>128)throw Error(name+' must be a bounded array.');
 const result=value.map(x=>identifier(x,name));
 if(new Set(result).size!==result.length)throw Error(name+' must not contain duplicates.');
 return result;
}
function boolean(value,name,fallback=false){
 if(value===undefined)return fallback;
 if(typeof value!=='boolean')throw Error(name+' must be boolean.');
 return value;
}
function timeAt(now,seconds){
 const at=now+seconds*1000;
 if(!Number.isSafeInteger(at))throw Error('Action time exceeds the supported timestamp range.');
 return at;
}
function normalizeWeights(values,n){
 if(!Array.isArray(values)&&!ArrayBuffer.isView(values))throw Error('Posterior sampleWeights must be an array.');
 if(values.length!==n)throw Error('Posterior samples and weights have different lengths.');
 const raw=Array.from(values,x=>finite(x,'Posterior weight'));
 const scale=Math.max(...raw);
 if(!(scale>0))throw Error('Posterior weights have no positive mass.');
 const scaled=raw.map(x=>x/scale),total=scaled.reduce((a,b)=>a+b,0);
 return scaled.map(x=>x/total);
}
function mean(values,weights){return values.reduce((sum,x,i)=>sum+x*weights[i],0);}
function ess(weights){return 1/weights.reduce((sum,w)=>sum+w*w,0);}
function quantile(values,weights,p){
 const pairs=values.map((value,i)=>({value,weight:weights[i]})).filter(x=>x.weight>0).sort((a,b)=>a.value-b.value);
 let mass=0;
 for(const pair of pairs){mass+=pair.weight;if(mass>=p)return pair.value;}
 return pairs.at(-1)?.value??null;
}
function interval(values,weights){return {level:0.90,lower:quantile(values,weights,0.05),upper:quantile(values,weights,0.95),meaning:'Posterior uncertainty in conditional expected loss, not a future-outcome interval.'};}
function tasksById(fit){
 if(!Array.isArray(fit?.tasks))return new Map();
 const result=new Map();
 for(const task of fit.tasks){
  if(!object(task))throw Error('The fitted task catalogue contains a non-object task.');
  const id=identifier(task.id,'Task ID');
  if(result.has(id))throw Error('The fitted task catalogue contains a duplicate task ID.');
  if(!Array.isArray(task.components))throw Error('Task components must be explicit.');
  const components=task.components.map(c=>identifier(c?.id,'Component ID'));
  if(new Set(components).size!==components.length)throw Error('A task contains duplicate component IDs.');
  result.set(id,task);
 }
 return result;
}
function targetsInput(values){
 if(!Array.isArray(values)||values.length>LEARNER_POLICY_LIMITS.targets)throw Error('Targets must be an array of at most '+LEARNER_POLICY_LIMITS.targets+'.');
 const seen=new Set(),result=[];
 for(const raw of values){
  if(!object(raw))throw Error('Each target must be an object.');
  const taskId=identifier(raw.taskId,'Target task ID'),weight=finite(raw.weight??1,'Target weight');
  if(seen.has(taskId))throw Error('A target task occurs more than once.');
  seen.add(taskId);if(weight>0)result.push({taskId,weight});
 }
 const scale=Math.max(0,...result.map(x=>x.weight));
 const total=result.reduce((sum,x)=>sum+x.weight/(scale||1),0);
 return result.map(x=>({...x,normalizedWeight:(x.weight/scale)/total}));
}
function constraintsInput(raw){
 if(!object(raw))throw Error('Constraints must be an object.');
 const timeBudgetSeconds=raw.timeBudgetSeconds==null?Infinity:finite(raw.timeBudgetSeconds,'Time budget');
 const minimumDiagnosticNetValue=finite(raw.minimumDiagnosticNetValue??0,'Minimum diagnostic net value');
 return {avoidPractice:boolean(raw.avoidPractice,'avoidPractice'),timeBudgetSeconds,costPerSecond:finite(raw.costPerSecond??DEFAULT_COST_PER_SECOND,'Cost per second'),minimumDiagnosticNetValue,requireConvergenceForDiagnostics:boolean(raw.requireConvergenceForDiagnostics,'requireConvergenceForDiagnostics',true)};
}
function actionsInput(values,taskMap,constraints){
 if(!Array.isArray(values)||values.length>LEARNER_POLICY_LIMITS.actions)throw Error('Actions must be an array of at most '+LEARNER_POLICY_LIMITS.actions+'.');
 const seen=new Set(),result=[];let continuation=null;
 for(const raw of values){
  if(!object(raw))throw Error('Each action must be an object.');
  const id=identifier(raw.id,'Action ID');
  if(seen.has(id))throw Error('Action IDs must be unique.');seen.add(id);
  if(!['continue','support','diagnostic'].includes(raw.kind))throw Error('Unsupported learner action kind.');
  const seconds=finite(raw.seconds??0,'Action seconds'),cost=finite(raw.cost??0,'Action cost');
  if(!Number.isSafeInteger(seconds*1000))throw Error('Action seconds must resolve to whole milliseconds.');
  const available=boolean(raw.available,'Action availability',true),requiresPractice=boolean(raw.requiresPractice,'requiresPractice',raw.kind==='diagnostic');
  const providedComponentIds=strings(raw.providedComponentIds,'Provided component IDs');
  const taskId=raw.taskId==null?null:identifier(raw.taskId,'Action task ID');
  const affectedTaskIds=strings(raw.affectedTaskIds??(raw.kind==='support'&&taskId?[taskId]:[]),'Affected task IDs');
  const title=raw.title==null?(raw.kind==='continue'?'Continue':id):String(raw.title);
  if(title.length>500)throw Error('Action title is too long.');
  const supportText=raw.supportText==null?null:String(raw.supportText);
  if(supportText&&supportText.length>12000)throw Error('Support text is too long.');
  const action={id,kind:raw.kind,title,supportText,taskId,providedComponentIds,affectedTaskIds,seconds,cost,requiresPractice,available,blockedReasons:[],effortCost:cost+constraints.costPerSecond*seconds};
  if(!Number.isFinite(action.effortCost))throw Error('The action effort cost overflows.');
  if(raw.kind==='continue'){
   if(continuation)throw Error('Supply at most one Continue action.');
   if(seconds||cost||providedComponentIds.length||affectedTaskIds.length||taskId)throw Error('Continue must have zero added cost, duration, and effects.');
   action.available=true;action.requiresPractice=false;continuation=action;
  }else{
   if(!available)action.blockedReasons.push('Action was declared unavailable.');
   if(constraints.avoidPractice&&(raw.kind==='diagnostic'||requiresPractice))action.blockedReasons.push('The learner excluded practice.');
   if(seconds>constraints.timeBudgetSeconds)action.blockedReasons.push('Action exceeds the available time budget.');
   if(raw.kind==='diagnostic'){
    if(!taskId||!taskMap.has(taskId))action.blockedReasons.push('The diagnostic task is absent from this fitted catalogue.');
    if(affectedTaskIds.length)action.blockedReasons.push('A diagnostic cannot declare immediate target support effects.');
   }else{
    if(!affectedTaskIds.length)action.blockedReasons.push('Support needs explicit affected target tasks.');
    if(!providedComponentIds.length)action.blockedReasons.push('Support must explicitly supply at least one task component.');
   }
   const effectTasks=raw.kind==='diagnostic'?(taskId?[taskId]:[]):affectedTaskIds;
   for(const affected of effectTasks){
    const task=taskMap.get(affected);
    if(!task){action.blockedReasons.push('Unknown affected task: '+affected);continue;}
    const allowed=new Set(task.components.map(c=>c.id));
    if(providedComponentIds.some(id=>!allowed.has(id)))action.blockedReasons.push('Support names a component outside task '+affected+'.');
   }
   action.available=action.blockedReasons.length===0;
  }
  result.push(action);
 }
 if(!continuation){
  if(seen.has('continue'))throw Error('The reserved Continue ID was used by another action kind.');
  continuation={id:'continue',kind:'continue',title:'Continue',taskId:null,providedComponentIds:[],affectedTaskIds:[],seconds:0,cost:0,requiresPractice:false,available:true,blockedReasons:[],effortCost:0};
  result.unshift(continuation);
 }
 return {actions:result,continuation};
}
function descriptor(action){return {id:action.id,kind:action.kind,title:action.title,supportText:action.supportText??null,taskId:action.taskId,providedComponentIds:action.providedComponentIds.slice(),affectedTaskIds:action.affectedTaskIds.slice(),seconds:action.seconds,cost:action.cost,effortCost:action.effortCost,available:action.available,blockedReasons:action.blockedReasons.slice(),learningGain:null,retentionGain:null};}
function ordered(a,b){
 const delta=a.expectedLoss-b.expectedLoss;
 if(Math.abs(delta)>EPS)return delta;
 // Equal expected value never justifies an extra interruption.
 return (a.kind==='continue'?-1:0)-(b.kind==='continue'?-1:0)||a.seconds-b.seconds||a.id.localeCompare(b.id);
}
function traceFor(fit,now,targets,actions){
 return {policyVersion:LEARNER_POLICY_VERSION,modelVersion:fit?.version??fit?.modelVersion??null,scope:copy(fit?.scope??fit?.actor??null),at:now,targetTaskIds:targets.map(x=>x.taskId),candidateActionIds:actions.map(x=>x.id),posteriorSampleCount:fit?.samples?.length??0,inferenceStatus:fit?.diagnostics?.inferenceStatus??'unavailable',modelDataSummary:copy(fit?.dataSummary??null)};
}

/**
 * Select an immediate terminal action or a single decision-relevant diagnostic.
 * predictor is an optional pure implementation hook, principally for exact tests;
 * normal application calls use the learner model's joint posterior predictions.
 */
export function selectLearnerDecision({fit=null,targets=[],actions=[],constraints={},now=fit?.now,predictor=LearnerModel.predictSamples}={}){
 if(!Number.isSafeInteger(now)||now<0)throw Error('An explicit nonnegative decision timestamp is required.');
 if(typeof predictor!=='function')throw Error('The posterior predictor must be a function.');
 const limits=constraintsInput(constraints),targetRows=targetsInput(targets),taskMap=tasksById(fit);
 const prepared=actionsInput(actions,taskMap,limits),all=prepared.actions,continuation=prepared.continuation;
 const unsupported=targetRows.filter(x=>!taskMap.has(x.taskId)).map(x=>x.taskId);
 const warnings=Array.isArray(fit?.diagnostics?.warnings)?fit.diagnostics.warnings.map(String):[];
 if(fit?.diagnostics?.truncated)warnings.push('Inference used a bounded history or work budget. Unseen data are not treated as absent evidence.');
 if(fit?.diagnostics?.converged===false)warnings.push('The posterior sampler did not meet its convergence criterion.');
 const result={schemaVersion:1,policy:LEARNER_POLICY_VERSION,status:'ready',selectionMode:'posterior-expected-loss',primary:null,alternatives:[],candidates:[],diagnostic:null,trace:traceFor(fit,now,targetRows,all),constraints:{...limits,timeBudgetSeconds:Number.isFinite(limits.timeBudgetSeconds)?limits.timeBudgetSeconds:null},targets:targetRows,uncertainty:{inferenceStatus:fit?.diagnostics?.inferenceStatus??'unavailable',warnings,linguistic:'Task labels, mappings, and source review remain separate from posterior inference.',intervention:'Support supplies declared components for the immediate modeled task. No causal learning or retention effect is estimated.'},assumptions:{targetLoss:'A normalized weighted average of immediate task failure probabilities.',effortCost:'Explicit action cost plus authored costPerSecond times authored seconds.',costPerSecond:limits.costPerSecond,continueCost:0,diagnosticHorizon:1,diagnosticAssumption:'A new response follows the declared likelihood at diagnostic completion. During EVSI, opportunity counts and last-opportunity histories are held fixed; only wall-clock time advances. Joint posterior draws are reweighted without simulating a practice gain or resetting a history. A real accepted response updates histories on refit and may change the subsequent choice. The caller must exclude dependent immediate retries.',supportAssumption:'Supplying a named component bypasses that component only on explicitly affected tasks. It does not change knowledge or future retention.'}};
 let unavailable=null;
 const terminalCount=all.filter(a=>a.available&&a.kind!=='diagnostic').length,diagnosticCount=all.filter(a=>a.available&&a.kind==='diagnostic').length;
 // Count the target/sample/action product before allocating forecast vectors.
 // Three downstream summaries cover the prior and the two response branches.
 const estimatedWork=(fit?.samples?.length??0)*targetRows.length*terminalCount*(1+3*diagnosticCount);
 result.trace.estimatedDecisionWork=estimatedWork;
 if(!targetRows.length)unavailable='No positively weighted target task was supplied.';
 else if(unsupported.length)unavailable='Target tasks are not supported by this fitted catalogue: '+unsupported.join(', ');
 else if(!fit||!Array.isArray(fit.samples)||!fit.samples.length||fit.diagnostics?.usable===false)unavailable='No usable scoped posterior is available.';
 else if(fit.samples.length>LEARNER_POLICY_LIMITS.samples)unavailable='The posterior exceeds the decision work budget.';
 else if(estimatedWork>LEARNER_POLICY_LIMITS.workUnits)unavailable='The target, action, and posterior combination exceeds the decision work budget. Supply a smaller explicit decision scope.';
 if(unavailable){
  result.status=!targetRows.length?'no-target':'unavailable';
  result.primary={...descriptor(continuation),expectedLoss:null,utility:null,reason:unavailable};
  result.candidates=all.map(a=>a.kind==='continue'?result.primary:{...descriptor(a),available:false,blockedReasons:[...a.blockedReasons,unavailable],expectedLoss:null,utility:null});
  result.uncertainty.warnings.push(unavailable);return result;
 }
 const n=fit.samples.length,weights=normalizeWeights(fit.sampleWeights,n);
 result.trace.posteriorEffectiveSampleSize=ess(weights);
 if(fit.diagnostics?.inferenceStatus==='prior-only')result.status='prior-only';
 else if(fit.diagnostics?.truncated||fit.diagnostics?.converged===false)result.status='bounded';
 const predictiveCache=new Map(),terminalCache=new Map();
 function prediction(taskId,provided,at){
  const providedIds=[...provided].sort(),key=JSON.stringify([taskId,providedIds,at]);
  if(predictiveCache.has(key))return predictiveCache.get(key);
  const raw=predictor(fit,taskMap.get(taskId),{now:at,providedComponentIds:providedIds});
  if((!Array.isArray(raw)&&!ArrayBuffer.isView(raw))||raw.length!==n)throw Error('The predictor must return one probability per joint posterior sample.');
  const values=Array.from(raw,p=>{finite(p,'Predicted probability');if(p>1)throw Error('Predicted probability exceeds one.');return p;});
  predictiveCache.set(key,values);return values;
 }
 function terminal(action,start){
  const key=JSON.stringify([action.id,start]);if(terminalCache.has(key))return terminalCache.get(key);
  const at=timeAt(start,action.seconds),affected=new Set(action.affectedTaskIds);
  const perTarget=targetRows.map(t=>({target:t,provided:action.kind==='support'&&affected.has(t.taskId)?action.providedComponentIds:[],values:null}));
  const taskLoss=Array(n).fill(0);
  for(const item of perTarget){
   item.values=prediction(item.target.taskId,item.provided,at);
   for(let i=0;i<n;i++)taskLoss[i]+=item.target.normalizedWeight*(1-item.values[i]);
  }
  const losses=taskLoss.map(x=>x+action.effortCost),value={action,at,perTarget,taskLoss,losses};terminalCache.set(key,value);return value;
 }
 function summary(entry,w,details=true){
  const expectedLoss=mean(entry.losses,w),base={...descriptor(entry.action),forecastAt:entry.at,expectedTaskLoss:mean(entry.taskLoss,w),expectedLoss,utility:-expectedLoss,conditionalLossInterval:interval(entry.losses,w)};
  if(details)base.targetPredictions=entry.perTarget.map(x=>({taskId:x.target.taskId,weight:x.target.normalizedWeight,providedComponentIds:x.provided.slice(),mean:mean(x.values,w),lower:quantile(x.values,w,0.05),upper:quantile(x.values,w,0.95),intervalLevel:0.90}));
  return base;
 }
 const terminalActions=all.filter(a=>a.available&&a.kind!=='diagnostic');
 const terminalRows=terminalActions.map(a=>summary(terminal(a,now),weights)).sort(ordered);
 const bestNow=terminalRows[0];
 for(const action of all){
  if(!action.available){result.candidates.push({...descriptor(action),expectedLoss:null,utility:null});continue;}
  if(action.kind!=='diagnostic'){result.candidates.push(terminalRows.find(row=>row.id===action.id));continue;}
  const base=descriptor(action);
  if(limits.requireConvergenceForDiagnostics&&fit.diagnostics?.converged===false){
   result.candidates.push({...base,available:false,blockedReasons:['Posterior convergence is insufficient for an extra diagnostic.'],expectedLoss:null,utility:null,evsi:null,netValue:null});continue;
  }
  const afterDiagnostic=timeAt(now,action.seconds),remainingBudget=limits.timeBudgetSeconds-action.seconds;
  const feasible=terminalActions.filter(a=>a.seconds<=remainingBudget);
  // Continue is always zero-duration, so there is always a terminal choice.
  const entries=feasible.map(a=>terminal(a,afterDiagnostic));
  const beforeRows=entries.map(e=>summary(e,weights,false)).sort(ordered),beforeBest=beforeRows[0];
  const probabilities=prediction(action.taskId,action.providedComponentIds,afterDiagnostic);
  const responseProbability=mean(probabilities,weights),branches=[];
  let afterRisk=0;
  for(const correct of [true,false]){
   const likelihoods=probabilities.map(p=>correct?p:1-p),unnormalized=weights.map((w,i)=>w*likelihoods[i]);
   const probability=unnormalized.reduce((a,b)=>a+b,0);
   if(probability===0){branches.push({outcome:correct?'correct':'incorrect',probability:0,bestActionId:null,expectedLoss:null,posteriorEffectiveSampleSize:null});continue;}
   const conditionalWeights=unnormalized.map(w=>w/probability),ranked=entries.map(e=>summary(e,conditionalWeights,false)).sort(ordered),best=ranked[0];
   afterRisk+=probability*best.expectedLoss;
   branches.push({outcome:correct?'correct':'incorrect',probability,bestActionId:best.id,bestActionKind:best.kind,expectedLoss:best.expectedLoss,posteriorEffectiveSampleSize:ess(conditionalWeights),terminalAlternatives:ranked.map(x=>({id:x.id,expectedLoss:x.expectedLoss}))});
  }
  const rawEvsi=beforeBest.expectedLoss-afterRisk;
  if(rawEvsi < -1e-9)throw Error('Expected value of sample information became negative; posterior samples or predictor are inconsistent.');
  const evsi=Math.max(0,rawEvsi),delayAndConstraintPenalty=beforeBest.expectedLoss-bestNow.expectedLoss;
  const expectedLoss=action.effortCost+afterRisk,netValue=bestNow.expectedLoss-expectedLoss;
  const canChangeDecision=new Set(branches.filter(b=>b.probability>0).map(b=>b.bestActionId)).size>1;
  const decisionRelevant=evsi>EPS&&netValue>limits.minimumDiagnosticNetValue+EPS&&canChangeDecision;
  result.candidates.push({...base,expectedLoss,utility:-expectedLoss,evsi,netValue,delayAndConstraintPenalty,expectedDownstreamLoss:afterRisk,baselineExpectedLoss:bestNow.expectedLoss,preObservationDownstreamLoss:beforeBest.expectedLoss,predictiveCorrect:responseProbability,branches,canChangeDecision,decisionRelevant,recommended:decisionRelevant,reason:decisionRelevant?'The possible responses change the best subsequent action and the expected improvement exceeds the diagnostic cost.':!canChangeDecision||evsi<=EPS?'Resolving this uncertainty does not improve the next modeled action.':'The expected change in the next action does not pay for this diagnostic and its delay.'});
 }
 const eligible=result.candidates.filter(c=>c.available&&c.expectedLoss!==null&&(c.kind!=='diagnostic'||c.decisionRelevant)).sort(ordered);
 result.primary=eligible[0];
 for(const candidate of result.candidates)candidate.recommended=candidate===result.primary;
 result.alternatives=eligible.slice(1);
 result.diagnostic=result.primary.kind==='diagnostic'?result.primary:null;
 result.bestTerminal=bestNow;
 result.explanation=result.primary.kind==='diagnostic'?'A short check has positive expected decision value after its cost. The branches state which support would follow each result.':result.primary.kind==='support'?'This available support has the lowest modeled immediate loss after its declared effort cost.':'Continuing has the lowest modeled immediate loss after added effort; no extra diagnostic is justified.';
 result.trace.predictionVectors=predictiveCache.size;
 return result;
}
