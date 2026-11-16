/** Bayesian learner model. Pure, deterministic, local inference; no I/O.
 * Gaussian hierarchical effects are sampled by elliptical slice sampling.
 * Their inverse-Gamma variance hyperparameters are sampled conditionally.
 * Observations must already have passed the immutable evidence contract.
 * Approximate posterior predictions are not certifications of competence.
 */
export const MODEL_VERSION = 'nabu-hierarchical-learner-v1';
const DAY = 86400000;
const TAU = 2 * Math.PI;
const KINDS = new Set(['meaning', 'root', 'pattern']);
const MODES = new Set(['recognition', 'production', 'listening', 'cloze']);
const DEFAULT_SCALES = Object.freeze({intercept:.65, meaning:.7, root:.8, pattern:.8, shared:.8, word:.45, memory:1, context:.3, practice:.25, forgetting:.45, population:.5});
const copy = x => structuredClone(x);
const mean = a => a.length ? a.reduce((s,x)=>s+x,0)/a.length : 0;
const sigmoid = x => x >= 0 ? 1/(1+Math.exp(-x)) : Math.exp(x)/(1+Math.exp(x));
const softplus = x => x > 30 ? x : Math.log1p(Math.exp(x));
const clamp = (x,a,b) => Math.max(a,Math.min(b,x));
const key = (...parts) => JSON.stringify(parts);
function text(x,name,max=240){if(typeof x!=='string'||!x.trim()||x.length>max||/[\u0000-\u001f]/u.test(x))throw Error(name+' must be a bounded nonempty string.');return x;}
function finite(x,name,lo=-Infinity,hi=Infinity){if(typeof x!=='number'||!Number.isFinite(x)||x<lo||x>hi)throw Error(name+' is outside its supported range.');return x;}
function integer(x,name,lo,hi){finite(x,name,lo,hi);if(!Number.isInteger(x))throw Error(name+' must be an integer.');return x;}
function stable(value){if(Array.isArray(value))return '['+value.map(stable).join(',')+']';if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stable(value[k])).join(',')+'}';return JSON.stringify(value);}
function hash(value){let h=2166136261;for(const c of String(value)){h^=c.codePointAt(0);h=Math.imul(h,16777619);}return h>>>0;}
function random(seed){let a=hash(seed),spare=null;const uniform=()=>{a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t^=t+Math.imul(t^(t>>>7),61|t);return (((t^(t>>>14))>>>0)+.5)/4294967296;};const normal=()=>{if(spare!==null){const n=spare;spare=null;return n;}const r=Math.sqrt(-2*Math.log(uniform())),t=TAU*uniform();spare=r*Math.sin(t);return r*Math.cos(t);};const gamma=shape=>{if(shape<1)return gamma(shape+1)*Math.pow(uniform(),1/shape);const d=shape-1/3,c=1/Math.sqrt(9*d);for(let i=0;i<10000;i++){const x=normal(),v0=1+c*x;if(v0<=0)continue;const v=v0*v0*v0,u=uniform();if(u<1-.0331*x**4||Math.log(u)<.5*x*x+d*(1-v+Math.log(v)))return d*v;}throw Error('Gamma sampler exceeded its numerical work bound.');};return {uniform,normal,gamma};}
function quantile(values,p){if(!values.length)return null;const a=[...values].sort((x,y)=>x-y),pos=(a.length-1)*p,i=Math.floor(pos);return a[i]+(a[Math.min(i+1,a.length-1)]-a[i])*(pos-i);}
function weightedQuantile(values,weights,p){const rows=values.map((v,i)=>[v,weights[i]]).sort((a,b)=>a[0]-b[0]);let s=0;for(const [v,w]of rows){s+=w;if(s>=p)return v;}return rows.at(-1)?.[0]??null;}
function moments(values,weights=null){const w=weights||values.map(()=>1/values.length),m=values.reduce((s,x,i)=>s+x*w[i],0);return {mean:m,variance:values.reduce((s,x,i)=>s+w[i]*(x-m)**2,0)};}

export function normalizeModelTask(raw){
 if(!raw||typeof raw!=='object')throw Error('A model task must be an object.');
 const id=text(raw.id,'Task ID'),language=text(raw.language,'Task language',40),mode=raw.mode;
 if(!MODES.has(mode))throw Error('Unsupported model task mode.');
 if(typeof raw.version==='number')finite(raw.version,'Task version',0,Number.MAX_SAFE_INTEGER);
 else if(typeof raw.version==='string')text(raw.version,'Task version',160);
 else throw Error('Task version must be explicit.');
 if(!Array.isArray(raw.components)||raw.components.length>8)throw Error('A task needs at most eight explicit required components.');
 const components=raw.components.map(c=>{if(!c||!KINDS.has(c.kind))throw Error('Unsupported component kind.');return {id:text(c.id,'Component ID'),kind:c.kind,transferGroup:c.transferGroup==null?null:text(c.transferGroup,'Explicit transfer group')};});
 if(new Set(components.map(c=>c.id)).size!==components.length)throw Error('A required component must not be duplicated.');
 const memory=raw.memory===true;
 if(!components.length&&!memory)throw Error('An empty conjunction is not a task: declare a whole-form memory route or required components.');
 const guess=finite(raw.guess??0,'Guessing floor',0,.95),slip=finite(raw.slip??.03,'Slip probability',0,.5);
 if(guess+slip>=1)throw Error('Guessing plus slipping must be less than one.');
 return {id,version:raw.version,language,mode,components,guess,slip,difficulty:finite(raw.difficulty??0,'Task difficulty',-8,8),memory,memoryKey:raw.memoryKey==null?id:text(raw.memoryKey,'Memory key'),contextKey:raw.contextKey==null?null:text(raw.contextKey,'Context key')};
}
function optionsFor(raw={}){
 const o={chains:raw.chains??2,burnIn:raw.burnIn??96,samples:raw.samples??64,thin:raw.thin??1,maxObservations:raw.maxObservations??256,maxTasks:raw.maxTasks??128,maxParameters:raw.maxParameters??768,maxSliceSteps:raw.maxSliceSteps??80,dynamics:raw.dynamics!==false,intervalLevel:raw.intervalLevel??.9,seed:raw.seed??null,populationConsent:raw.populationConsent===true,populationScope:raw.populationScope??null,fixedScales:raw.fixedScales==null?null:copy(raw.fixedScales)};
 integer(o.chains,'Chains',1,4);integer(o.burnIn,'Burn-in',0,2048);integer(o.samples,'Retained draws per chain',8,2048);integer(o.thin,'Thinning',1,8);integer(o.maxObservations,'Observation bound',1,2048);integer(o.maxTasks,'Task bound',1,256);integer(o.maxParameters,'Parameter bound',1,4096);integer(o.maxSliceSteps,'Slice bound',8,512);finite(o.intervalLevel,'Interval level',.5,.99);
 if(o.chains*(o.burnIn+o.samples*o.thin)>16384)throw Error('Requested sampler work exceeds the hard iteration bound.');
 if(o.fixedScales!==null){if(typeof o.fixedScales!=='object'||Array.isArray(o.fixedScales))throw Error('Fixed scales must be a named calibration object.');for(const [k,v]of Object.entries(o.fixedScales)){const parts=k.split(':');if(!Object.hasOwn(DEFAULT_SCALES,parts[0])||parts.length>2||parts.length===2&&!MODES.has(parts[1]))throw Error('Unknown fixed scale '+k);finite(v,'Fixed scale',0,4);}}
 if(o.populationScope!==null)text(o.populationScope,'Population scope',200);
 if(o.seed!==null&&typeof o.seed!=='string'&&typeof o.seed!=='number')throw Error('The deterministic seed must be a string or number.');
 if(typeof o.seed==='number')finite(o.seed,'Deterministic seed');
 return o;
}
function actorFor(raw={}){if(!raw||typeof raw!=='object')throw Error('An actor scope is required.');const userId=raw.userId==null?null:text(raw.userId,'Actor user',160),tenantId=raw.tenantId==null?null:text(raw.tenantId,'Actor team',160);if(tenantId!==null&&userId===null)throw Error('A team learner needs an account.');if(userId==='!locked')throw Error('A locked account cannot be fitted.');return {userId,tenantId};}
function populationFor(raw){if(raw==null)return {id:'default-weak-hyperprior',version:1,scales:{},baselineMeans:{},memoryMean:-1.5,varianceShape:3};if(typeof raw!=='object'||Array.isArray(raw))throw Error('Population prior must be an explicit calibration object.');const scales=copy(raw.scales||{}),baselineMeans=copy(raw.baselineMeans||{});for(const [k,v]of Object.entries(scales)){if(!Object.hasOwn(DEFAULT_SCALES,k))throw Error('Unknown population scale '+k);finite(v,'Population scale',.01,4);}for(const v of Object.values(baselineMeans))finite(v,'Population baseline',-5,5);return {id:text(raw.id,'Population prior ID'),version:raw.version??1,scales,baselineMeans,memoryMean:finite(raw.memoryMean??-1.5,'Memory prior mean',-6,2),varianceShape:finite(raw.varianceShape??3,'Variance prior shape',2.1,20)};}

function prepare(input){
 const actor=actorFor(input.actor),currentLearnerId=actor.userId??'guest',now=finite(input.now??Date.now(),'Inference time',0,9e15),options=optionsFor(input.options),populationPrior=populationFor(input.populationPrior),rawTasks=input.tasks;
 if(!Array.isArray(rawTasks)||!rawTasks.length)throw Error('Supply at least one explicit candidate task.');
 const tasks=rawTasks.map(normalizeModelTask).sort((a,b)=>a.id.localeCompare(b.id)),byTask=new Map();
 for(const t of tasks){if(byTask.has(t.id))throw Error('Duplicate model task ID.');byTask.set(t.id,t);}
 if(tasks.length>options.maxTasks)throw Error('Task bound exceeded; select an explicit smaller candidate scope before fitting.');
 if(!Array.isArray(input.observations))throw Error('Observations must be an explicit array, including when empty.');
 const cohort=input.populationObservations??[];
 if(!Array.isArray(cohort))throw Error('Population observations must be an array.');
 if(cohort.length&&(!options.populationConsent||!options.populationScope))throw Error('Population observations require explicit consent and a named authorized population scope.');
 const seen=new Map(),episodes=new Set(),excluded=[],records=[];
 function add(raw,population){
  if(!raw||typeof raw!=='object')throw Error('Invalid observation.');
  const id=text(raw.id,'Observation ID'),taskId=text(raw.taskId,'Observation task ID'),learnerId=raw.learnerId==null?currentLearnerId:text(raw.learnerId,'Observation learner');
  if(!population&&learnerId!==currentLearnerId)throw Error('A current-learner observation belongs to another actor.');
  if(!population&&raw.tenantId!==undefined&&raw.tenantId!==actor.tenantId)throw Error('A current-learner observation belongs to another tenant scope.');
  if(population&&(learnerId===currentLearnerId||raw.learnerId==null))throw Error('A population record must identify a different explicitly authorized learner.');
  if(raw.correct!==0&&raw.correct!==1&&raw.correct!==true&&raw.correct!==false)throw Error('Only assessed binary outcomes enter this likelihood.');
  const at=finite(raw.at,'Observation time',0,9e15),episodeId=raw.episodeId==null?null:text(raw.episodeId,'Observation episode');
  const row={id,taskId,taskVersion:raw.taskVersion??byTask.get(taskId)?.version??null,correct:Number(raw.correct),at,learnerId,episodeId,population};
  const identity=key(learnerId,id),old=seen.get(identity);if(old){if(stable(old)!==stable(row))throw Error('An observation ID has conflicting contents.');excluded.push({id,reason:'duplicate-event'});return;}seen.set(identity,row);
  if(!byTask.has(taskId)){excluded.push({id,reason:'task-outside-candidate-scope'});return;}
  if(raw.taskVersion!==undefined&&raw.taskVersion!==byTask.get(taskId).version){excluded.push({id,reason:'task-version-mismatch'});return;}
  if(at>now){excluded.push({id,reason:'future-event'});return;}
  records.push(row);
 }
 input.observations.forEach(r=>add(r,false));cohort.forEach(r=>add(r,true));
 records.sort((a,b)=>a.at-b.at||a.id.localeCompare(b.id)||a.learnerId.localeCompare(b.learnerId));
 const eligible=[];for(const row of records){const episode=row.episodeId===null?null:key(row.learnerId,row.episodeId,row.taskId);if(episode!==null&&episodes.has(episode)){excluded.push({id:row.id,reason:'same-task-episode-repeat'});continue;}if(episode!==null)episodes.add(episode);eligible.push(row);}
 const truncated=eligible.length>options.maxObservations,observations=eligible.slice(-options.maxObservations);if(truncated)for(const r of eligible.slice(0,-options.maxObservations))excluded.push({id:r.id,reason:'bounded-history-omission'});
 const populationEnabled=observations.some(r=>r.population),learners=[...new Set([currentLearnerId,...observations.map(r=>r.learnerId)])].sort(),groups=[],groupMap=new Map(),variables=[],variableMap=new Map(),compiled=new Map();
 function variable(vkey,kind,mode,description){
  if(variableMap.has(vkey))return variableMap.get(vkey);
  const groupKey=kind+':'+mode;let gi=groupMap.get(groupKey);
  if(gi===undefined){gi=groups.length;groupMap.set(groupKey,gi);const scale=populationPrior.scales[kind]??DEFAULT_SCALES[kind],fixed=options.fixedScales&&(Object.hasOwn(options.fixedScales,groupKey)?options.fixedScales[groupKey]:options.fixedScales[kind]);groups.push({key:groupKey,kind,mode,shape:populationPrior.varianceShape,rate:(populationPrior.varianceShape-1)*scale*scale,priorScale:scale,fixedScale:fixed??null,indices:[]});}
  const i=variables.length;variables.push({key:vkey,kind,mode,group:gi,description});variableMap.set(vkey,i);groups[gi].indices.push(i);return i;
 }
 function effects(k,kind,mode,learner){const list=[variable(key('actor',learner,...k),kind,mode,kind+' effect')];if(populationEnabled)list.push(variable(key('population',...k),'population',mode,'Authorized cohort '+kind+' mean'));return list;}
 function compile(task,learner){
  const ck=key(learner,task.id);if(compiled.has(ck))return compiled.get(ck);
  const lang=task.language,mode=task.mode,baseline=task.components.length?effects(['baseline',lang,mode],'intercept',mode,learner):[],word=task.components.length?effects(['word',lang,task.memoryKey,mode],'word',mode,learner):[],context=task.contextKey?effects(['context',lang,task.contextKey,mode],'context',mode,learner):[];
  const practice=options.dynamics?variable(key('practice',learner,lang,mode),'practice',mode,'Conditional practice trend'):null,forgetting=options.dynamics?variable(key('forgetting',learner,lang,mode),'forgetting',mode,'Conditional elapsed-time decay'):null;
  const components=task.components.map(c=>{const local=effects(['component',lang,c.kind,c.id,mode],c.kind,mode,learner),shared=c.transferGroup?effects(['shared',c.kind,c.transferGroup,mode],'shared',mode,learner):[];return {id:c.id,kind:c.kind,transferGroup:c.transferGroup,indices:[...baseline,...word,...context,...local,...shared],historyKey:key(learner,lang,mode,c.kind,c.id)};});
  const memory=task.memory?{indices:[...effects(['memory',lang,task.memoryKey,mode],'memory',mode,learner),...context],historyKey:key(learner,lang,mode,'memory',task.memoryKey)}:null;
  const result={taskId:task.id,learnerId:learner,baselineMean:populationPrior.baselineMeans[lang+':'+mode]??populationPrior.baselineMeans[mode]??0,components,memory,practice,forgetting};compiled.set(ck,result);return result;
 }
 tasks.forEach(t=>compile(t,currentLearnerId));observations.forEach(r=>compile(byTask.get(r.taskId),r.learnerId));
 if(variables.length>options.maxParameters)throw Error('Parameter bound exceeded; use a smaller task/cohort scope. No partial fit was returned.');
 const histories={},rows=[];
 const history=(k,at)=>{const h=histories[k];return {count:h?.count??0,lag:h?Math.log1p(Math.max(0,at-h.lastAt)/DAY):0};};
 for(const row of observations){const task=byTask.get(row.taskId),c=compiled.get(key(row.learnerId,row.taskId)),times=c.components.map(x=>history(x.historyKey,row.at)),memoryTime=c.memory?history(c.memory.historyKey,row.at):null;rows.push({...row,task,compiled:c,times,memoryTime});for(const k of [...c.components.map(x=>x.historyKey),...(c.memory?[c.memory.historyKey]:[])]){const old=histories[k];histories[k]={count:(old?.count??0)+1,lastAt:row.at};}}
 // Integrate coefficients that do not enter an observed likelihood out of the
 // Markov chain. Sample them conditionally when retaining each joint draw.
 // Otherwise a large unobserved catalogue creates a slow variance/latent Gibbs
 // funnel even though those coefficients contribute no evidence whatsoever.
 const activeSet=new Set(),observedParameters=[];
 for(const r of rows){
  const rowIndices=new Set();
  for(const c of r.compiled.components)for(const i of c.indices)rowIndices.add(i);
  for(const i of r.compiled.memory?.indices??[])rowIndices.add(i);
  if(r.compiled.practice!==null&&[...r.times,r.memoryTime].some(t=>t?.count>0))rowIndices.add(r.compiled.practice);
  if(r.compiled.forgetting!==null&&[...r.times,r.memoryTime].some(t=>t?.lag>0))rowIndices.add(r.compiled.forgetting);
  for(const i of rowIndices)activeSet.add(i);
  observedParameters.push({id:r.id,learnerId:r.learnerId,indices:[...rowIndices]});
 }
 const activeIndices=[...activeSet].sort((a,b)=>a-b),inactiveIndices=variables.map((_,i)=>i).filter(i=>!activeSet.has(i));
 groups.forEach(g=>{g.activeIndices=g.indices.filter(i=>activeSet.has(i));});
 const currentTasks=Object.fromEntries(tasks.map(t=>[t.id,compiled.get(key(currentLearnerId,t.id))]));
 const seed=options.seed??hash(stable({version:MODEL_VERSION,actor,tasks,observations,populationPrior}));
 return {actor,currentLearnerId,now,options,populationPrior,tasks,byTask,observations,excluded,truncated,populationEnabled,learners,groups,variables,currentTasks,histories,rows,seed,activeIndices,inactiveIndices,observedParameters};
}
function sumIndices(values,indices){let s=0;for(const i of indices)s+=values[i];return s;}
function dynamic(values,c,time){if(c.practice===null||!time)return 0;return values[c.practice]*Math.log1p(time.count)-softplus(-3+values[c.forgetting])*time.lag;}
function successProbability(task,c,values,times,memoryTime,provided,populationPrior){
 let conjunction=c.components.length?1:0;
 for(let i=0;i<c.components.length;i++){const part=c.components[i];if(provided?.has(part.id))continue;const eta=c.baselineMean+sumIndices(values,part.indices)+dynamic(values,c,times[i])-task.difficulty;conjunction*=sigmoid(eta);}
 const memory=c.memory?sigmoid(populationPrior.memoryMean+sumIndices(values,c.memory.indices)+dynamic(values,c,memoryTime)-task.difficulty):0;
 const ideal=memory+(1-memory)*conjunction;
 return clamp(task.guess+(1-task.guess-task.slip)*ideal,1e-12,1-1e-12);
}
function logLikelihood(context,values){let total=0;for(const r of context.rows){const p=successProbability(r.task,r.compiled,values,r.times,r.memoryTime,null,context.populationPrior);total+=r.correct?Math.log(p):Math.log1p(-p);}return total;}
function ellipse(context,current,variances,currentLogLikelihood,rng,stats){
 const nu=context.activeIndices.map(i=>rng.normal()*Math.sqrt(variances[context.variables[i].group])),height=currentLogLikelihood+Math.log(rng.uniform());let angle=TAU*rng.uniform(),lo=angle-TAU,hi=angle;
 for(let tries=0;tries<context.options.maxSliceSteps;tries++){const ca=Math.cos(angle),sa=Math.sin(angle),proposal=current.slice();for(let j=0;j<context.activeIndices.length;j++){const i=context.activeIndices[j];proposal[i]=current[i]*ca+nu[j]*sa;}const ll=logLikelihood(context,proposal);stats.likelihoodEvaluations++;if(ll>=height){stats.sliceAccepted++;return {values:proposal,ll};}if(angle<0)lo=angle;else hi=angle;angle=lo+(hi-lo)*rng.uniform();}
 // Retaining the old point is a conservative work-bound fallback. Expose it;
 // do not call a truncated transition an exact unconstrained ESS draw.
 stats.sliceBoundHits++;return {values:current,ll:currentLogLikelihood};
}
function updateVariances(context,values,rng){return context.groups.map(g=>{if(g.fixedScale!==null)return g.fixedScale*g.fixedScale;let square=0;for(const i of g.activeIndices)square+=values[i]*values[i];return (g.rate+.5*square)/rng.gamma(g.shape+.5*g.activeIndices.length);});}
function rhat(chains){if(chains.length<2||chains[0].length<4)return null;const n=Math.min(...chains.map(c=>c.length)),a=chains.map(c=>c.slice(-n)),means=a.map(mean),grand=mean(means),within=mean(a.map((c,j)=>c.reduce((s,x)=>s+(x-means[j])**2,0)/(n-1))),between=n*means.reduce((s,x)=>s+(x-grand)**2,0)/(a.length-1);if(within<1e-18)return between<1e-18?1:null;return Math.max(1,Math.sqrt(((n-1)/n*within+between/n)/within));}
function ess(values){const n=values.length,m=mean(values),v=values.reduce((s,x)=>s+(x-m)**2,0)/Math.max(1,n);if(n<4||v<1e-18)return n;let corr=0;for(let lag=1;lag<Math.min(40,n/3);lag++){let c=0;for(let i=0;i<n-lag;i++)c+=(values[i]-m)*(values[i+lag]-m);const rho=c/((n-lag)*v);if(rho<=0)break;corr+=rho;}return clamp(n/(1+2*corr),1,n);}
function timeAt(fit,compiled,now){const get=k=>{const h=fit.design.histories[k];return {count:h?.count??0,lag:h?Math.log1p(Math.max(0,now-h.lastAt)/DAY):0};};return {times:compiled.components.map(c=>get(c.historyKey)),memoryTime:compiled.memory?get(compiled.memory.historyKey):null};}
function resolvePrediction(fit,raw,options={}){
 if(!fit||fit.version!==MODEL_VERSION||!fit.diagnostics?.usable)throw Error('A usable fitted learner model is required.');
 const id=typeof raw==='string'?raw:raw?.id,task=fit.tasks.find(t=>t.id===id);if(!task)throw Error('This task is outside the fitted candidate scope. Include its exact definition in fitLearner first.');
 if(typeof raw==='object'&&stable(normalizeModelTask(raw))!==stable(task))throw Error('Prediction task differs from the fitted task definition/version. Refit before predicting.');
 const now=finite(options.now??fit.now,'Prediction time',fit.now,9e15),provided=options.providedComponentIds??[];
 if(!Array.isArray(provided)||provided.some(id=>!task.components.some(c=>c.id===id))||new Set(provided).size!==provided.length)throw Error('Support may supply only distinct declared required components.');
 const compiled=fit.design.currentTasks[task.id],timing=timeAt(fit,compiled,now);return {task,compiled,now,provided:new Set(provided),...timing};
}

export function predictSamples(fit,taskOrId,options={}){const q=resolvePrediction(fit,taskOrId,options);return fit.samples.map(s=>successProbability(q.task,q.compiled,s.values,q.times,q.memoryTime,q.provided,fit.populationPrior));}
function normalizedWeights(fit){const w=fit.sampleWeights;if(!Array.isArray(w)||w.length!==fit.samples.length||w.some(x=>!Number.isFinite(x)||x<0)||!w.some(x=>x>0))throw Error('Invalid posterior sample weights.');const sum=w.reduce((s,x)=>s+x,0);return w.map(x=>x/sum);}
function taskEvidence(fit,q){
 const own=fit.observations.filter(r=>r.learnerId===fit.currentLearnerId),direct=own.filter(r=>r.taskId===q.task.id),byId=new Map(fit.tasks.map(t=>[t.id,t]));
 const indices=new Set([...q.compiled.components.flatMap(c=>c.indices),...(q.compiled.memory?.indices??[])]);
 if(q.compiled.practice!==null&&[...q.times,q.memoryTime].some(t=>t?.count>0))indices.add(q.compiled.practice);
 if(q.compiled.forgetting!==null&&[...q.times,q.memoryTime].some(t=>t?.lag>0))indices.add(q.compiled.forgetting);
 for(const i of indices)if(fit.design.groups[fit.design.variables[i].group].fixedScale===0)indices.delete(i);
 const variableGroups=new Set([...indices].map(i=>fit.design.variables[i].group).filter(i=>fit.design.groups[i].fixedScale===null));
 const observed=new Map(fit.design.observedParameters.map(r=>[key(r.learnerId,r.id),r.indices]));
 const shared=r=>(observed.get(key(r.learnerId,r.id))??[]).some(i=>indices.has(i));
 const hyper=r=>(observed.get(key(r.learnerId,r.id))??[]).some(i=>variableGroups.has(fit.design.variables[i].group));
 const related=own.filter(r=>r.taskId===q.task.id||shared(r));
 const hyperparameterRelated=own.filter(r=>!related.includes(r)&&hyper(r));
 const populationRelated=fit.observations.filter(r=>r.learnerId!==fit.currentLearnerId&&(shared(r)||hyper(r)));
 const crossLanguage=related.filter(r=>byId.get(r.taskId).language!==q.task.language);
 return {direct,related,hyperparameterRelated,populationRelated,crossLanguage};
}
export function summarizePrediction(fit,taskOrId,options={}){
 let q;try{q=resolvePrediction(fit,taskOrId,options);}catch(error){return {taskId:typeof taskOrId==='string'?taskOrId:taskOrId?.id??null,status:'unsupported',mean:null,lower:null,upper:null,variance:null,intervalLevel:options.intervalLevel??fit?.options?.intervalLevel??.9,directCount:0,evidenceCount:0,priorOnly:true,inferred:false,reason:error.message};}
 const probabilities=predictSamples(fit,q.task,options),weights=normalizedWeights(fit),level=finite(options.intervalLevel??fit.options.intervalLevel,'Interval level',.5,.99),stats=moments(probabilities,weights),e=taskEvidence(fit,q),populationInformed=e.populationRelated.length>0;
 const priorOnly=e.related.length===0&&e.hyperparameterRelated.length===0&&!populationInformed,status=priorOnly?'prior-only':e.direct.length?'direct-and-pooled':'inferred';
 return {taskId:q.task.id,taskVersion:q.task.version,language:q.task.language,mode:q.task.mode,status,...stats,lower:weightedQuantile(probabilities,weights,(1-level)/2),upper:weightedQuantile(probabilities,weights,1-(1-level)/2),intervalLevel:level,directCount:e.direct.length,evidenceCount:e.related.length+e.hyperparameterRelated.length,sourceEventIds:[...e.related,...e.hyperparameterRelated].map(r=>r.id),sharedEffectEventIds:e.related.map(r=>r.id),hyperparameterEventIds:e.hyperparameterRelated.map(r=>r.id),hyperparameterOnly:e.related.length===0&&e.hyperparameterRelated.length>0&&!populationInformed,crossLanguageEventIds:e.crossLanguage.map(r=>r.id),populationInformed,priorOnly,inferred:status==='inferred',assistance:{providedComponentIds:[...q.provided],meaning:'A conditional supported-task prediction; supplied components are not learned or credited.'},at:q.now,diagnostics:{inferenceStatus:fit.diagnostics.inferenceStatus,converged:fit.diagnostics.converged,truncated:fit.diagnostics.truncated},scope:'Probability of matching this exact task rubric and conditions. Credible interval describes model-parameter uncertainty, not a guarantee or a human-calibrated mastery label.'};
}

function transferSummaries(context,fit){
 const sharing=new Map(),own=context.observations.filter(r=>r.learnerId===context.currentLearnerId);
 for(const task of context.tasks)for(const component of context.currentTasks[task.id].components){
  if(!component.transferGroup)continue;
  const k=key(component.kind,component.transferGroup,task.mode);
  if(!sharing.has(k))sharing.set(k,{kind:component.kind,transferGroup:component.transferGroup,mode:task.mode,members:[]});
  sharing.get(k).members.push({taskId:task.id,language:task.language,componentId:component.id,indices:component.indices});
 }
 return [...sharing.values()].map(group=>{
  const pairs=[];
  for(let i=0;i<group.members.length;i++)for(let j=i+1;j<group.members.length;j++){
   const a=group.members[i],b=group.members[j];if(a.language===b.language)continue;
   const bIndices=new Set(b.indices),shared=a.indices.filter(k=>bIndices.has(k));
   const correlations=fit.samples.map(draw=>{
    const variance=indices=>indices.reduce((sum,k)=>sum+draw.variances[context.variables[k].group],0);
    const va=variance(a.indices),vb=variance(b.indices);
    return va>0&&vb>0?variance(shared)/Math.sqrt(va*vb):null;
   });
   const values=correlations.filter(Number.isFinite);
   pairs.push({taskIds:[a.taskId,b.taskId],componentIds:[a.componentId,b.componentId],correlationMean:values.length?mean(values):null,correlationLower:quantile(values,.05),correlationUpper:quantile(values,.95),correlations});
  }
  const values=fit.samples.map((_,i)=>{const c=pairs.map(p=>p.correlations[i]).filter(Number.isFinite);return c.length?mean(c):null;}).filter(Number.isFinite);
  const observedLanguages=new Set(own.filter(r=>{const task=context.byTask.get(r.taskId);return task.mode===group.mode&&task.components.some(c=>c.kind===group.kind&&c.transferGroup===group.transferGroup);}).map(r=>context.byTask.get(r.taskId).language));
  return {kind:group.kind,transferGroup:group.transferGroup,mode:group.mode,languages:[...new Set(group.members.map(m=>m.language))].sort(),observedLanguages:[...observedLanguages].sort(),correlationMean:values.length?mean(values):null,correlationLower:quantile(values,.05),correlationUpper:quantile(values,.95),pairs:pairs.map(({correlations,...p})=>p),status:observedLanguages.size>=2?'hyperposterior-under-shared-factor-assumption':'prior-sensitive',meaning:'Average conditional-prior correlation between matched static component logits in different languages, averaged over hyperposterior draws. Includes all shared and unshared baseline, local, word, context, and authorized population coefficients. Excludes time terms. This is neither posterior predictive correlation nor a causal transfer estimate; covariance is restricted by the authored shared-factor structure.'};
 });
}

function dynamicParameterSummaries(context,fit){
 if(!context.options.dynamics)return [];
 const byCondition=new Map();
 for(const task of context.tasks){
  const k=key(task.language,task.mode);if(byCondition.has(k))continue;
  const compiled=context.currentTasks[task.id];
  const rows=context.rows.filter(r=>r.learnerId===context.currentLearnerId&&r.task.language===task.language&&r.task.mode===task.mode);
  const timings=rows.flatMap(r=>[...r.times,...(r.memoryTime?[r.memoryTime]:[])]);
  const practice=fit.samples.map(s=>s.values[compiled.practice]),decay=fit.samples.map(s=>softplus(-3+s.values[compiled.forgetting]));
  const summary=values=>({mean:mean(values),lower:quantile(values,.05),upper:quantile(values,.95)});
  const x=timings.map(t=>Math.log1p(t.count)),y=timings.map(t=>t.lag),mx=mean(x),my=mean(y);
  const vx=x.reduce((s,v)=>s+(v-mx)**2,0),vy=y.reduce((s,v)=>s+(v-my)**2,0);
  const predictorCorrelation=vx>0&&vy>0?x.reduce((s,v,i)=>s+(v-mx)*(y[i]-my),0)/Math.sqrt(vx*vy):null;
  byCondition.set(k,{language:task.language,mode:task.mode,practiceCoefficient:summary(practice),elapsedDecayCoefficient:summary(decay),elapsedObservations:rows.filter(r=>[...r.times,r.memoryTime].some(t=>t?.lag>0)).length,practiceObservations:rows.filter(r=>[...r.times,r.memoryTime].some(t=>t?.count>0)).length,predictorCorrelation,identified:false,causal:false});
 }
 return [...byCondition.values()];
}

function finalize(context,chainSamples,stats){
 const {tasks,observations,currentLearnerId,groups,variables,options}=context,samples=chainSamples.flat(),sampleWeights=samples.map(()=>1/samples.length);
 const own=observations.filter(r=>r.learnerId===currentLearnerId),directTaskIds=new Set(own.map(r=>r.taskId)),languages=[...new Set(own.map(r=>context.byTask.get(r.taskId).language))].sort(),modes=[...new Set(own.map(r=>context.byTask.get(r.taskId).mode))].sort();
 const fit={schemaVersion:1,version:MODEL_VERSION,method:'elliptical-slice-and-variance-gibbs',actor:copy(context.actor),currentLearnerId,now:context.now,scope:{actor:copy(context.actor),populationScope:context.populationEnabled?options.populationScope:null,populationUseExplicit:context.populationEnabled},populationPrior:copy(context.populationPrior),tasks:copy(tasks),observations:copy(observations),options:{chains:options.chains,burnIn:options.burnIn,samples:options.samples,thin:options.thin,dynamics:options.dynamics,intervalLevel:options.intervalLevel,seed:context.seed},design:{variables:copy(variables),groups:copy(groups),currentTasks:copy(context.currentTasks),histories:copy(context.histories),observedParameters:copy(context.observedParameters)},samples,sampleWeights,dataSummary:{currentObservations:own.length,populationObservations:observations.length-own.length,learners:context.learners.length,languages,modes,directTaskIds:[...directTaskIds],excluded:copy(context.excluded),parameterCount:variables.length,likelihoodParameterCount:context.activeIndices.length,conditionallySampledParameterCount:context.inactiveIndices.length,varianceGroups:groups.length},diagnostics:{usable:true,inferenceStatus:observations.length?'approximate-posterior':'prior-only',truncated:context.truncated||stats.sliceBoundHits>0,converged:null,warnings:[],sampling:stats}};
 const tracked=tasks.filter(t=>directTaskIds.has(t.id)).slice(0,12),metrics=[];
 for(const task of tracked){const values=predictSamples(fit,task),byChain=chainSamples.map((_,i)=>values.slice(i*options.samples,(i+1)*options.samples));metrics.push({taskId:task.id,rHat:rhat(byChain),effectiveSamples:byChain.reduce((sum,c)=>sum+ess(c),0)});}
 const finiteRhats=metrics.map(m=>m.rHat).filter(Number.isFinite),maxRHat=finiteRhats.length?Math.max(...finiteRhats):null,minESS=metrics.length?Math.min(...metrics.map(m=>m.effectiveSamples)):null;
 fit.diagnostics.rHat=maxRHat;fit.diagnostics.effectiveSamples=minESS;fit.diagnostics.predictiveChecks=metrics;
 fit.diagnostics.convergenceScope='Approximate chain checks on predictions for at most the first 12 directly observed current-learner tasks; these do not establish convergence of all latent coefficients or hyperparameters.';
 fit.diagnostics.converged=observations.length&&options.chains>=2&&tracked.length?metrics.every(m=>Number.isFinite(m.rHat)&&m.rHat<=1.2&&m.effectiveSamples>=Math.min(24,samples.length/4)):null;
 if(context.truncated)fit.diagnostics.warnings.push('Only the newest bounded observations were fitted. Omitted history is not evidence of absence.');
 if(stats.sliceBoundHits)fit.diagnostics.warnings.push('Some elliptical-slice transitions reached their work cap; posterior approximation requires review.');
 if(fit.diagnostics.converged===false)fit.diagnostics.warnings.push('Predictive chain checks have not met the displayed convergence threshold. Increase draws before making consequential decisions.');
 if(!observations.length)fit.diagnostics.warnings.push('No scored observations: all predictions are prior predictive and must not be labeled learned.');
 if(context.populationEnabled===false)fit.diagnostics.warnings.push('Population hyperpriors are configured assumptions; no other learners were imported.');
 const componentSignatures=new Map();for(const r of own){const task=context.byTask.get(r.taskId);for(const c of task.components){const k=key(task.language,task.mode,c.kind,c.id),a=componentSignatures.get(k)||new Set();a.add(task.components.map(x=>x.kind+':'+x.id).sort().join('|')+'|memory:'+task.memory);componentSignatures.set(k,a);}}
 const compoundOnly=tasks.filter(t=>directTaskIds.has(t.id)&&t.components.length>1&&t.components.every(c=>(componentSignatures.get(key(t.language,t.mode,c.kind,c.id))?.size??0)<2)).map(t=>t.id);
 fit.diagnostics.identifiability={componentParametersIdentified:false,compoundOnlyTasks:compoundOnly,meaning:'Proper priors regularize the model; they do not establish psychological identification. Component-specific diagnostics and multiple conditions are needed.',crossLanguageEvidence:languages.length>1};
 if(compoundOnly.length)fit.diagnostics.warnings.push('Some component abilities are observed only together; their separate attribution remains prior-sensitive.');
 const lagRows=context.rows.filter(r=>r.learnerId===currentLearnerId&&(r.times.some(t=>t.lag>0)||r.memoryTime?.lag>0)),practiceRows=context.rows.filter(r=>r.learnerId===currentLearnerId&&(r.times.some(t=>t.count>0)||r.memoryTime?.count>0));
 fit.dynamics={enabled:options.dynamics,elapsedObservations:lagRows.length,practiceObservations:practiceRows.length,forgettingStatus:!options.dynamics?'disabled':lagRows.length>=3?'estimated-under-response-model':'prior-sensitive',practiceStatus:!options.dynamics?'disabled':practiceRows.length>=3?'estimated-under-response-model':'prior-sensitive',meaning:'Elapsed time and prior assessed opportunities enter the response likelihood. Their coefficients are observational associations, not identified causal learning gains.'};
 fit.dynamics.parameters=dynamicParameterSummaries(context,fit);
 fit.hyperparameters=groups.map((g,i)=>{const values=samples.map(s=>s.variances[i]),st=moments(values);return {group:g.key,kind:g.kind,mode:g.mode,varianceMean:st.mean,varianceLower:quantile(values,.05),varianceUpper:quantile(values,.95),fixed:g.fixedScale!==null,activeParameterCount:g.activeIndices.length,priorMean:g.fixedScale!==null?g.fixedScale*g.fixedScale:g.rate/(g.shape-1),status:g.fixedScale!==null?'fixed-calibration':g.activeIndices.length?'joint-posterior-prior-sensitive':'prior-only'};});
 fit.transferGroups=transferSummaries(context,fit);
 if(fit.diagnostics.truncated)fit.diagnostics.inferenceStatus='bounded-approximation';
 return fit;
}
function* fitSteps(input){
 const context=prepare(input),{options,groups,variables}=context,total=options.chains*(options.burnIn+options.samples*options.thin),chains=[],stats={iterations:0,retained:0,likelihoodEvaluations:0,sliceAccepted:0,sliceBoundHits:0};
 for(let chain=0;chain<options.chains;chain++){
  const rng=random(String(context.seed)+':chain:'+chain);let variances=groups.map(g=>g.fixedScale!==null?g.fixedScale*g.fixedScale:g.rate/rng.gamma(g.shape)),values=variables.map(()=>0);for(const i of context.activeIndices)values[i]=rng.normal()*Math.sqrt(variances[variables[i].group]);let ll=logLikelihood(context,values);stats.likelihoodEvaluations++;const draws=[];
  for(let iteration=0;iteration<options.burnIn+options.samples*options.thin;iteration++){
   const step=ellipse(context,values,variances,ll,rng,stats);values=step.values;ll=step.ll;variances=updateVariances(context,values,rng);stats.iterations++;
   if(iteration>=options.burnIn&&(iteration-options.burnIn)%options.thin===0){const joint=values.slice();for(const i of context.inactiveIndices)joint[i]=rng.normal()*Math.sqrt(variances[variables[i].group]);draws.push({values:joint,variances:variances.slice(),chain});stats.retained++;}
   yield {phase:'sampling',completed:stats.iterations,total,chain:chain+1};
  }
  chains.push(draws);
 }
 return finalize(context,chains,stats);
}
export function fitLearner(input){const it=fitSteps(input);for(;;){const step=it.next();if(step.done)return step.value;}}
export async function fitLearnerAsync(input,{signal=null,onProgress=null,yieldEvery=12}={}){integer(yieldEvery,'Yield cadence',1,256);const it=fitSteps(input);let steps=0;for(;;){if(signal?.aborted){const e=new Error('Learner inference was cancelled.');e.name='AbortError';throw e;}const step=it.next();if(step.done){onProgress?.({phase:'complete',completed:1,total:1});return step.value;}if(++steps%yieldEvery===0){onProgress?.(step.value);await new Promise(resolve=>setTimeout(resolve,0));}}}

/** Fit shared hyperparameters only from an explicitly provided authorized cohort.
 * The returned prior contains calibration statistics, never raw cohort events.
 * It is a moment-matched reusable approximation, not the complete cohort posterior.
 */
export function fitPopulation({tasks,observations,now,scope,consent=false,options={}}){
 if(!consent||!scope)throw Error('Population fitting requires explicit authorization and a named scope.');
 const learners=[...new Set((observations||[]).map(r=>r.learnerId))];if(learners.length<2||learners.some(x=>typeof x!=='string'||!x))throw Error('Population calibration needs at least two explicitly identified learners.');
 const first=learners[0],fit=fitLearner({tasks,observations:observations.filter(r=>r.learnerId===first),populationObservations:observations.filter(r=>r.learnerId!==first),actor:{userId:first,tenantId:null},now,options:{...options,populationConsent:true,populationScope:scope}}),scales={};
 for(const kind of Object.keys(DEFAULT_SCALES)){const matching=fit.hyperparameters.filter(x=>x.kind===kind);if(matching.length)scales[kind]=clamp(Math.sqrt(mean(matching.map(x=>x.varianceMean))),.01,4);}
 const baselineMeans={};
 fit.design.variables.forEach((variable,i)=>{const parts=JSON.parse(variable.key);if(parts[0]==='population'&&parts[1]==='baseline')baselineMeans[parts[2]+':'+parts[3]]=clamp(mean(fit.samples.map(s=>s.values[i])),-5,5);});
 return {id:'nabu-population:'+hash(stable({scope,observations:fit.observations,version:MODEL_VERSION})).toString(16),version:1,scales,baselineMeans,memoryMean:fit.populationPrior.memoryMean,varianceShape:3,scope,learners:learners.length,observations:fit.observations.length,method:'moment-matched-hyperposterior',diagnostics:copy(fit.diagnostics),limitations:['This reusable prior approximates the fitted hyperposterior by moments, discards feature-specific cohort means and covariance, and does not propagate calibration uncertainty.','Modes receive separate posterior effects in the cohort fit; the reusable scale approximation averages scales across modes.','Cohort scope and permissions must be enforced by the caller.','Calibration is predictive and does not establish causal learning transfer.']};
}
