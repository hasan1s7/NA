#!/usr/bin/env node
/** Research-only synthetic model checks. No real learners, production writes,
 * scheduler changes, model fitting, linguistic benchmark, or efficacy claim.
 * node tools/evaluate_evidence.mjs --output docs/evidence-evaluation
 */
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {validatePatternApplication,groupEvidenceBySource} from '../public/nabu-structure.js';
import {emptyAssistance,projectEvidence} from '../public/nabu-observations.js';

export const PROTOCOL_VERSION='synthetic-evidence-v1';
export const FIXED_SEEDS=Object.freeze([11,29,47,83,101,137,173,211,257,307,359,419]);
export const DEFAULT_CONFIG=Object.freeze({seeds:FIXED_SEEDS,learnersPerSeed:128,budgets:[60,120,240],readinessThreshold:.8,probeSeconds:20,helpSeconds:40,retentionDays:7,learningRegimes:[{id:'weak',gain:.15,retention:.5},{id:'assumed-default',gain:.45,retention:.75},{id:'strong',gain:.65,retention:.9}]});
export const PREDICTION_WORLDS=Object.freeze(['shared-operation','independent-memorized-items','same-spelling-different-reading','conflicting-analysis','wrong-application-domain']);
export const POLICY_WORLDS=Object.freeze(['uncertain-critical','known-critical-gap','already-ready','stale-success-history','assisted-retry']);
// These identifiers are assigned independently of surface spelling and output
// suffixes. All members of one declared lexical family share its split.
export const FAMILY_DEFINITIONS=Object.freeze([
 ['lexfam-113','amber'],['lexfam-227','birch'],['lexfam-349','cobalt'],['lexfam-461','dune'],['lexfam-587','elm'],['lexfam-601','flint'],
 ['lexfam-719','glen'],['lexfam-823','heath'],['lexfam-941','iris'],['lexfam-1061','jade'],['lexfam-1171','kelp'],['lexfam-1283','larch']
].map(([id,label],index)=>Object.freeze({id,label,partition:index<6?'observed-families':'held-out-families',members:['a','b','c'].map(slot=>'synthetic:'+id+':'+slot)})));
const copy=value=>structuredClone(value);
const average=rows=>rows.length?rows.reduce((sum,x)=>sum+x,0)/rows.length:null;
const clamp=value=>Math.max(0,Math.min(1,value));
export function uniform(...keys){let h=2166136261;for(const c of keys.join('\u001f')){h^=c.codePointAt(0);h=Math.imul(h,16777619);}h^=h>>>16;h=Math.imul(h,0x85ebca6b);h^=h>>>13;h=Math.imul(h,0xc2b2ae35);h^=h>>>16;return ((h>>>0)+.5)/4294967296;}
function outcome(probability,...keys){return uniform(...keys)<probability?1:0;}

export function syntheticItems(world='shared-operation'){
 return FAMILY_DEFINITIONS.flatMap(f=>['a','b','c'].map(slot=>({
  id:'synthetic:'+f.id+':'+slot,familyId:f.id,partition:f.partition,slot,
  form:world==='same-spelling-different-reading'?'⟦same-surface⟧':'⟦'+f.label+'-'+slot+'⟧',
  readingId:world==='same-spelling-different-reading'&&slot!=='a'?'synthetic-reading-B':'synthetic-reading-A',
  operationId:'synthetic-complete-operation',analysisStatus:world==='conflicting-analysis'?'conflicting':'stipulated-supported',
  mode:'production',fixtureOnly:true
 })));
}

/** Select only direct, scored, unaided evidence. Exposure, lookups, pronunciation
 * requests and skips create no Beta counts. One first unaided response per
 * episode/item/mode prevents immediate retries from masquerading as independent
 * evidence. An assessed response after assistance in that episode is excluded.
 */
function selectAssessed(events){
 const ids=new Map(),helped=new Set(),episodes=new Set(),accepted=[];
 for(const event of [...events].sort((a,b)=>(a.at??0)-(b.at??0)||a.id.localeCompare(b.id))){
  if(ids.has(event.id)){if(JSON.stringify(ids.get(event.id))!==JSON.stringify(event))throw Error('Conflicting duplicate research event: '+event.id);continue;}
  ids.set(event.id,event);const key=JSON.stringify([event.learnerId,event.itemId,event.mode||'production',event.episodeId]);
  if(['lookup','pronunciation','help','assisted-retry'].includes(event.kind)||event.assisted===true)helped.add(key);
  if(event.kind!=='assessed'||![0,1].includes(event.correct)||event.assisted||event.retryOfEpisodeId||helped.has(key)||episodes.has(key))continue;
  episodes.add(key);accepted.push(event);
 }
 return accepted;
}
export function assessedObservations(events){return selectAssessed(events).map(copy);}
function directFromAssessed(assessed,item){
 const observations=assessed.filter(e=>e.itemId===item.id&&(e.mode||'production')===item.mode);
 const successes=observations.reduce((sum,e)=>sum+e.correct,0),failures=observations.length-successes,alpha=1+successes,beta=1+failures;
 return {probability:alpha/(alpha+beta),alpha,beta,variance:alpha*beta/((alpha+beta)**2*(alpha+beta+1)),direct:{successes,failures,eventIds:observations.map(e=>e.id)},inferred:null,model:'research-direct-beta-1-1'};
}
export function directEstimate(events,item){return directFromAssessed(selectAssessed(events),item);}

/** An explicitly experimental mixture, NOT production inference. Direct counts
 * are never changed. Borrow at most one observed result per other lexical family,
 * with no overlap with target direct events. Form spelling is never a join key.
 * Supported structural applicability does not prove learner-level transfer.
 */
export function graphEstimate(events,item,items){
 return graphFromAssessed(selectAssessed(events),item,items);
}
function graphFromAssessed(assessed,item,items){
 const direct=directFromAssessed(assessed,item);if(item.analysisStatus!=='stipulated-supported')return {...direct,model:'experimental-graph-mixture',reason:'Analysis is conflicting or unsupported; no structural borrowing.'};
 const byId=new Map(items.map(x=>[x.id,x])),families=new Map();
 for(const event of [...assessed].sort((a,b)=>a.id.localeCompare(b.id))){
  const other=byId.get(event.itemId);
  if(!other||other.familyId===item.familyId||other.operationId!==item.operationId||other.readingId!==item.readingId||other.mode!==item.mode||other.analysisStatus!=='stipulated-supported')continue;
  if(!families.has(other.familyId))families.set(other.familyId,event);
 }
 if(families.size<3)return {...direct,model:'experimental-graph-mixture',reason:'Fewer than three other declared families; no borrowing.'};
 const borrowed=[...families.values()],successes=borrowed.reduce((sum,e)=>sum+e.correct,0),probability=(1+successes)/(2+borrowed.length);
 const directN=direct.direct.successes+direct.direct.failures,weight=Math.min(.85,4/(4+directN));
 return {...direct,probability:(1-weight)*direct.probability+weight*probability,model:'experimental-graph-mixture',inferred:{kind:'synthetic-assumption-not-direct-observation',probability,weight,sourceFamilyIds:[...families.keys()],sourceEventIds:borrowed.map(e=>e.id),independentSourcesEstablishedOnlyBySimulation:true},reason:'Mixture assumes transferable operation knowledge; that assumption can be wrong.'};
}

function predictionProbability(world,seed,learner,item){
 const shared=uniform(seed,world,learner,'operation-state')<.5?.1:.9;
 if(world==='independent-memorized-items')return uniform(seed,world,learner,item.id,'memorized-state')<.5?.1:.9;
 if(world==='same-spelling-different-reading')return item.readingId==='synthetic-reading-B'?1-shared:shared;
 if(world==='wrong-application-domain'&&(item.partition==='held-out-families'||item.slot==='c'))return 1-shared;
 return shared;
}
export function predictionFixture(world,seed,learner){
 if(!PREDICTION_WORLDS.includes(world))throw Error('Unknown prediction world.');
 const items=syntheticItems(world),trainItems=items.filter(i=>i.partition==='observed-families'&&i.slot!=='c'),events=[];
 for(const item of trainItems)for(let trial=0;trial<3;trial++)events.push({id:'train:'+item.id+':'+trial,learnerId:learner,itemId:item.id,mode:item.mode,episodeId:'train-episode:'+item.id+':'+trial,at:events.length,kind:'assessed',assisted:false,correct:outcome(predictionProbability(world,seed,learner,item),seed,world,learner,item.id,'train',trial)});
 const heldout=[...trainItems.map(item=>({item,split:'later-same-item'})),...items.filter(i=>i.partition==='observed-families'&&i.slot==='c').map(item=>({item,split:'new-item-within-family'})),...items.filter(i=>i.partition==='held-out-families'&&i.slot==='a').map(item=>({item,split:'new-lexical-family'}))].map(({item,split})=>({item,split,probability:predictionProbability(world,seed,learner,item),correct:outcome(predictionProbability(world,seed,learner,item),seed,world,learner,item.id,'heldout'),questionId:'heldout:'+item.id}));
 return {world,seed,learner,items,events,heldout};
}

export function probabilityMetrics(rows,threshold=.8){
 const bins=Array.from({length:10},(_,index)=>({lower:index/10,upper:(index+1)/10,n:0,predictedSum:0,correctSum:0}));let ready=0,falseReady=0;
 for(const row of rows){if(!Number.isFinite(row.probability)||row.probability<0||row.probability>1||![0,1].includes(row.correct))throw Error('A scored probability requires an observed binary held-out outcome.');const bin=bins[Math.min(9,Math.floor(row.probability*10))];bin.n++;bin.predictedSum+=row.probability;bin.correctSum+=row.correct;if(row.probability>=threshold){ready++;if(row.correct===0)falseReady++;}}
 const reliability=bins.map(({predictedSum,correctSum,...b})=>({...b,meanPrediction:b.n?predictedSum/b.n:null,observedFrequency:b.n?correctSum/b.n:null}));
 return {questions:rows.length,heldoutQuestions:rows.length,brier:average(rows.map(r=>(r.probability-r.correct)**2)),calibrationBias:average(rows.map(r=>r.probability-r.correct)),ece:rows.length?reliability.reduce((sum,b)=>sum+b.n*Math.abs((b.meanPrediction??0)-(b.observedFrequency??0)),0)/rows.length:null,readyPredictions:ready,falseReadyPredictions:falseReady,readyRate:rows.length?ready/rows.length:null,falseReadyRate:ready?falseReady/ready:null,falseReadyPopulationRate:rows.length?falseReady/rows.length:null,accuracy:average(rows.map(r=>r.correct)),reliability};
}
export function spread(values){const finite=values.filter(Number.isFinite),mean=average(finite);return {mean,sd:finite.length>1?Math.sqrt(finite.reduce((sum,x)=>sum+(x-mean)**2,0)/(finite.length-1)):finite.length?0:null,min:finite.length?Math.min(...finite):null,max:finite.length?Math.max(...finite):null,definedSeeds:finite.length};}

function mergeMetrics(perSeed,keys){return Object.fromEntries(keys.map(key=>[key,spread(perSeed.map(r=>r.metrics[key]))]));}
function predictionRuns(config){
 const seedRows=[],summary=[];
 for(const world of PREDICTION_WORLDS){
  const pooled=new Map();
  for(const seed of config.seeds){
   const cells=new Map();
   for(let learner=0;learner<config.learnersPerSeed;learner++){
    const fixture=predictionFixture(world,seed,learner),assessed=selectAssessed(fixture.events);
    for(const question of fixture.heldout)for(const model of ['direct-item','experimental-graph']){
     const estimate=model==='direct-item'?directFromAssessed(assessed,question.item):graphFromAssessed(assessed,question.item,fixture.items),key=question.split+'|'+model;
     const row={probability:estimate.probability,correct:question.correct};if(!cells.has(key))cells.set(key,[]);cells.get(key).push(row);if(!pooled.has(key))pooled.set(key,[]);pooled.get(key).push(row);
    }
   }
   for(const [key,rows] of cells){const [split,model]=key.split('|');seedRows.push({comparison:'prediction',world,split,model,seed,metrics:probabilityMetrics(rows,config.readinessThreshold)});}
  }
  for(const [key,rows] of pooled){const [split,model]=key.split('|'),group=seedRows.filter(r=>r.world===world&&r.split===split&&r.model===model);summary.push({world,split,model,seedCount:group.length,heldoutQuestions:rows.length,metrics:mergeMetrics(group,['brier','ece','calibrationBias','falseReadyRate','falseReadyPopulationRate','readyRate']),pooled:probabilityMetrics(rows,config.readinessThreshold)});}
 }
 const paired=[];
 for(const world of PREDICTION_WORLDS)for(const split of ['later-same-item','new-item-within-family','new-lexical-family']){
  const deltas=config.seeds.map(seed=>{const get=model=>seedRows.find(r=>r.world===world&&r.split===split&&r.seed===seed&&r.model===model).metrics;return get('experimental-graph').brier-get('direct-item').brier;});paired.push({world,split,metric:'experimental-graph minus direct-item Brier',delta:spread(deltas)});
 }
 return {seedRows,summary,paired};
}

function historyFor(item,learner,successes,failures){return Array.from({length:successes+failures},(_,index)=>({id:'history:'+item.id+':'+index,learnerId:learner,itemId:item.id,mode:item.mode,episodeId:'history:'+item.id+':'+index,at:index,kind:'assessed',assisted:false,correct:index<successes?1:0}));}
export function policyFixture(world,seed,learner){
 if(!POLICY_WORLDS.includes(world))throw Error('Unknown policy world.');
 const items=Array.from({length:6},(_,i)=>({id:'task-item-'+(i+1),mode:'production',critical:i<2,taskWeight:i<2?4:1,fixtureOnly:true})),events=[],probabilities={};
 for(const [index,item] of items.entries()){
  let probability=.85,successes=12,failures=1;
  if(world==='uncertain-critical'&&item.critical){probability=uniform(seed,world,learner,item.id,'state')<.5?.15:.85;successes=failures=0;}
  if(world==='known-critical-gap'&&index===1){probability=.15;successes=1;failures=15;}
  if(world==='already-ready'){probability=.9;successes=12;failures=0;}
  if(world==='stale-success-history'){probability=item.critical?.15:.9;successes=12;failures=0;}
  if(world==='assisted-retry'&&index===1){probability=.15;successes=0;failures=1;}
  probabilities[item.id]=probability;events.push(...historyFor(item,learner,successes,failures));
  if(world==='assisted-retry'&&index===1){const base=events.at(-1);events.push({...base,id:'hint:'+item.id,kind:'help',at:base.at+1},{...base,id:'retry:'+item.id,kind:'assessed',correct:1,assisted:true,retryOfEpisodeId:base.episodeId,at:base.at+2});}
 }
 return {world,seed,learner,items,events,probabilities};
}

function terminalAction(probability){return probability<.6?'help':'continue';}
function decisionValue(probability){return Math.max(0,.6-probability);}
/** Outcome-sensitive toy decision, not entropy, a bandit, or a production policy.
 * A probe is eligible only if success and failure lead to different next actions
 * and its possible help response fits the remaining shared time budget.
 */
export function diagnosticDecision({events,items,remaining,probed=new Set(),helped=new Set(),probeSeconds=20,helpSeconds=40}){
 const candidates=[],assessed=selectAssessed(events);
 for(const item of items){if(helped.has(item.id))continue;const estimate=directFromAssessed(assessed,item),p=estimate.probability,afterCorrect=(estimate.alpha+1)/(estimate.alpha+estimate.beta+1),afterIncorrect=estimate.alpha/(estimate.alpha+estimate.beta+1),correctAction=terminalAction(afterCorrect),incorrectAction=terminalAction(afterIncorrect),diverges=correctAction!==incorrectAction;
  if(!probed.has(item.id)&&diverges&&remaining>=probeSeconds+helpSeconds){const value=p*decisionValue(afterCorrect)+(1-p)*decisionValue(afterIncorrect)-decisionValue(p);candidates.push({type:'probe',itemId:item.id,seconds:probeSeconds,score:item.taskWeight*value/probeSeconds,outcomeActions:{correct:correctAction,incorrect:incorrectAction},reason:'The possible answers change whether to offer support; the reserve can cover that support.'});}
  else if(terminalAction(p)==='help'&&remaining>=helpSeconds)candidates.push({type:'help',itemId:item.id,seconds:helpSeconds,score:item.taskWeight*(.6-p)/helpSeconds,outcomeActions:null,reason:'Direct evidence already favors support. Uncertainty is not required to make this critical gap useful to address.'});
 }
 return candidates.sort((a,b)=>b.score-a.score||a.itemId.localeCompare(b.itemId))[0]||{type:'continue',itemId:null,seconds:0,reason:'No remaining outcome-sensitive question or currently indicated help fits the budget.'};
}

export function simulatePolicy({world,seed,learner,policy,budget,regime,config=DEFAULT_CONFIG}){
 const fixture=policyFixture(world,seed,learner),events=fixture.events.slice(),current={...fixture.probabilities},actions=[],probed=new Set(),helped=new Set();let used=0;
 const apply=action=>{
  const item=fixture.items.find(x=>x.id===action.itemId);used+=action.seconds;
  if(action.type==='probe'){const correct=outcome(current[item.id],seed,world,learner,item.id,'probe',0);events.push({id:'policy-probe:'+item.id,learnerId:learner,itemId:item.id,mode:item.mode,episodeId:'policy-probe:'+item.id,at:1000+used,kind:'assessed',assisted:false,correct});probed.add(item.id);actions.push({...action,correct});}
  else{const learnerVariation=.8+.4*uniform(seed,world,learner,item.id,'learning-response');const gain=clamp(regime.gain*learnerVariation);current[item.id]+=gain*(1-current[item.id]);helped.add(item.id);actions.push({...action,assumedGain:gain});}
 };
 if(policy==='fixed-practice'){
  // Same criticality-ordered pool; the fixed baseline is not deliberately sent
  // to unrelated content. Every complete episode is a probe plus the same help.
  for(const item of fixture.items){if(used+config.probeSeconds+config.helpSeconds>budget)break;apply({type:'probe',itemId:item.id,seconds:config.probeSeconds,reason:'Fixed criticality-ordered practice.'});apply({type:'help',itemId:item.id,seconds:config.helpSeconds,reason:'Fixed feedback/support after the question, regardless of the response.'});}
 }else if(policy==='diagnostic'){
  for(let guard=0;guard<fixture.items.length*2+1;guard++){const action=diagnosticDecision({events,items:fixture.items,remaining:budget-used,probed,helped,probeSeconds:config.probeSeconds,helpSeconds:config.helpSeconds});if(action.type==='continue')break;apply(action);}
 }else throw Error('Unknown policy.');
 const assessed=selectAssessed(events),heldout=fixture.items.map(item=>{const trueProbability=fixture.probabilities[item.id]+regime.retention*(current[item.id]-fixture.probabilities[item.id]);return {itemId:item.id,critical:item.critical,probability:directFromAssessed(assessed,item).probability,trueProbability,correct:outcome(trueProbability,seed,world,learner,item.id,'delayed-heldout')};});
 return {world,seed,learner,policy,budget,regime:regime.id,actions,heldout,initialEvents:fixture.events.length,directEvidenceBefore:selectAssessed(fixture.events).length,directEvidenceAfter:assessed.length,questions:probed.size,helpActions:helped.size,interruptions:actions.length,usedSeconds:used,unusedSeconds:budget-used,taskSuccess:heldout.filter(x=>x.critical).every(x=>x.correct===1)?1:0,expectedTaskSuccess:heldout.filter(x=>x.critical).reduce((p,x)=>p*x.trueProbability,1)};
}

function policyRuns(config){
 const seedRows=[],summary=[],paired=[],exampleTraces=[];
 for(const world of POLICY_WORLDS)for(const regime of config.learningRegimes)for(const budget of config.budgets){
  for(const seed of config.seeds)for(const policy of ['fixed-practice','diagnostic']){
   const runs=Array.from({length:config.learnersPerSeed},(_,learner)=>simulatePolicy({world,seed,learner,policy,budget,regime,config})),metrics=probabilityMetrics(runs.flatMap(x=>x.heldout),config.readinessThreshold);
   for(const key of ['taskSuccess','expectedTaskSuccess','questions','helpActions','interruptions','usedSeconds','unusedSeconds'])metrics[key]=average(runs.map(x=>x[key]));
   seedRows.push({comparison:'policy',world,regime:regime.id,budget,policy,seed,metrics});
   if(seed===config.seeds[0]&&budget===120&&regime.id==='assumed-default')exampleTraces.push(runs[0]);
  }
  for(const policy of ['fixed-practice','diagnostic']){const group=seedRows.filter(r=>r.world===world&&r.regime===regime.id&&r.budget===budget&&r.policy===policy);summary.push({world,regime:regime.id,budget,policy,seedCount:group.length,learners:config.learnersPerSeed*group.length,metrics:mergeMetrics(group,['taskSuccess','expectedTaskSuccess','questions','helpActions','interruptions','usedSeconds','unusedSeconds','brier','ece','falseReadyRate','falseReadyPopulationRate','readyRate'])});}
  const changes=config.seeds.map(seed=>{const get=policy=>seedRows.find(r=>r.world===world&&r.regime===regime.id&&r.budget===budget&&r.seed===seed&&r.policy===policy).metrics;return {fixed:get('fixed-practice'),diagnostic:get('diagnostic')};});paired.push({world,regime:regime.id,budget,direction:'diagnostic minus fixed-practice',metrics:Object.fromEntries(['taskSuccess','expectedTaskSuccess','questions','interruptions','usedSeconds','brier'].map(key=>[key,spread(changes.map(x=>x.diagnostic[key]-x.fixed[key]))]))});
 }
 return {seedRows,summary,paired,exampleTraces};
}

export function representationAudit(){
 const provenance={sourceId:'synthetic-research-protocol',lineageId:'one-generated-application',locator:'fixture/application',kind:'authored-fixture'};
 const application={id:'synthetic-application',patternId:'synthetic-complete-operation',language:'es',status:'generated',fixtureOnly:true,inputs:[{id:'input',form:'zzfixturebase',language:'es',features:{role:'base',lexicalFamilyId:'lexfam-113'}}],outputs:['a','b','c'].map(slot=>({id:'output-'+slot,form:'zzfixture-output-'+slot,language:'es',features:{slot,attested:false}})),features:{operation:'fictional transformation with complete output set',grammaticality:null},provenance:[provenance],competingAnalyses:[]};
 const validated=validatePatternApplication(application),lineages=groupEvidenceBySource(application.outputs.map(output=>({...provenance,outputId:output.id,applicationId:application.id})));
 const families=FAMILY_DEFINITIONS,train=new Set(families.filter(f=>f.partition==='observed-families').map(f=>f.id)),test=new Set(families.filter(f=>f.partition==='held-out-families').map(f=>f.id));
 return {notice:'Representation checks verify record semantics and split definitions. They do not measure learner knowledge or verify natural-language morphology.',familyDefinitions:copy(families),application:validated,sourceLineages:lineages.sourceLineageCount,familyOverlap:[...train].filter(id=>test.has(id)),cases:[
  {id:'complete-supported-operation',status:'represented',fact:'The full synthetic application retains all inputs, outputs, features, provenance and competing-analysis list.',learnerClaim:null},
  {id:'memorized-independent-forms',status:'represented-without-transfer-claim',fact:'A structural relationship can be true while responses to its forms are independently memorized.',learnerClaim:null},
  {id:'same-spelling-different-readings',status:'separate-readings',fact:'Identical synthetic spelling has distinct reading IDs; the experimental estimator joins operation plus reading, never spelling.',learnerClaim:null},
  {id:'conflicting-analysis',status:'inference-disabled',fact:'Conflicting applicability metadata suppresses experimental borrowing.',learnerClaim:null},
  {id:'sibling-output-lineage',status:'one-lineage',fact:'Three output forms from one application remain one source lineage, not three independent sources.',learnerClaim:null},
  {id:'new-family-split',status:train.size===6&&test.size===6&&![...train].some(id=>test.has(id))?'disjoint':'failed',fact:'Six separately assigned families are observed and six are fully held out; within-family questions have their own split.',learnerClaim:null}
 ]};
}

export function semanticAudit(){
 const item={id:'semantic-item',mode:'production'},base={learnerId:'synthetic-learner',itemId:item.id,mode:item.mode,episodeId:'one-episode',at:1};
 const rows=[];const add=(id,events,latentProbability,expected)=>{const estimate=directEstimate(events,item);rows.push({id,generatedEvents:events.length,latentProbability,acceptedEvents:estimate.direct.eventIds.length,successes:estimate.direct.successes,failures:estimate.direct.failures,probability:estimate.probability,expected,passed:estimate.direct.successes===expected.successes&&estimate.direct.failures===expected.failures});};
 for(const kind of ['exposure','lookup','pronunciation'])add('repeated-unassessed-'+kind,Array.from({length:50},(_,i)=>({...base,id:kind+i,episodeId:kind+i,kind,at:i})),null,{successes:0,failures:0});
 for(const [reason,probability] of [['already-know',.9],['do-not-know',.1]])add('skip-'+reason,[{...base,id:'skip-'+reason,kind:'skip',skipReason:reason}],probability,{successes:0,failures:0});
 const failure={...base,id:'first-unaided',kind:'assessed',assisted:false,correct:0};
 add('unaided-failure-then-assisted-retry',[failure,{...base,id:'hint',kind:'help',at:2},{...base,id:'retry',kind:'assessed',correct:1,assisted:true,retryOfEpisodeId:base.episodeId,at:3}],.2,{successes:0,failures:1});
 add('duplicate-first-response',[failure,copy(failure)],.2,{successes:0,failures:1});
 add('assisted-success-only',[{...base,id:'assisted',kind:'assessed',correct:1,assisted:true}],.2,{successes:0,failures:0});
 add('later-independent-success',[failure,{...base,id:'later',episodeId:'new-day-episode',at:86400001,kind:'assessed',correct:1,assisted:false}],.5,{successes:1,failures:1});
 return rows;
}

/** The real production projector is used ONLY to check observation semantics.
 * Fictional tasks and scorers are injected; no production content is invented.
 * Its result remains competence:null and is not converted into the toy model.
 */
export function productionSemanticAudit(){
 const actor={userId:null,tenantId:null},source={sourceId:'synthetic-contract-fixture',locator:'research-semantic-audit',kind:'fictional-test-only'};
 const ref=id=>({id,version:1,status:'authored',provenance:[source]});
 const task={id:'synthetic-semantic-task',version:1,target:{id:'synthetic-semantic-target',language:'es'},dimension:'retrieval',practiceMode:'production',inputModality:'text',outputModality:'text',rubricRef:ref('synthetic-rubric'),scorerRef:ref('synthetic-exact-token-scorer'),analysisRef:ref('synthetic-no-language-claim'),assessmentScope:'Fictional exact-token task; no natural-language competence claim.',score:response=>({correct:response.answer==='accepted',label:'Synthetic exact-token comparison.',scope:'Only the explicitly authored fictional response token.'})};
 const make=(index,observation,options={})=>{
  const taskBound=['response','hint','answer-revealed','skipped'].includes(observation),episodeId=options.episodeId||'research_episode_'+String(index).padStart(5,'0'),at=options.at??index+1;
  const evidence={schemaVersion:1,episodeId,attemptId:taskBound?'research_attempt_'+String(index).padStart(5,'0'):null,retryOfEpisodeId:options.retryOfEpisodeId||null,actor,intentRef:null,organizationObjectiveRef:null,taskRef:taskBound?{id:task.id,version:task.version}:null,occurrence:{contentId:'synthetic-semantic-media',version:1,segmentId:null,annotationId:null,readingId:'synthetic-reading',context:{lexicalId:'synthetic-lexical',senseId:null,speakerId:null,syntaxId:null,contextId:'synthetic-context'}},inputModality:observation==='played'?'audio':'text',outputModality:observation==='response'?'text':'none',observation,assistance:{...emptyAssistance(),...(options.assistance||{})},presentedAt:taskBound?0:null,response:observation==='response'?{answer:options.answer||'accepted'}:null,skipReason:observation==='skipped'?options.skipReason||null:null,assessment:null,rubricRef:taskBound?task.rubricRef:null,scorerRef:taskBound?task.scorerRef:null,analysisRef:taskBound?task.analysisRef:null};
  return {id:'research_event_'+String(index).padStart(6,'0'),at,kind:'evidence',contentId:evidence.occurrence.contentId,version:1,sessionId:episodeId,evidence};
 };
 const cases=[];
 const add=(id,events,expected)=>{const replay=projectEvidence(events,{actor,resolveTask:reference=>reference.id===task.id&&reference.version===1?task:null,now:100000000});const actual={correct:replay.targets.reduce((sum,t)=>sum+t.directCounts.correct,0),incorrect:replay.targets.reduce((sum,t)=>sum+t.directCounts.incorrect,0)};cases.push({id,inputEvents:events.length,ledgerRows:replay.ledger.length,actual,expected,competence:replay.competence,passed:actual.correct===expected.correct&&actual.incorrect===expected.incorrect&&replay.competence===null});};
 for(const observation of ['displayed','lookup','played'])add('repeated-'+observation,Array.from({length:50},(_,i)=>make(i,observation)),{correct:0,incorrect:0});
 for(const skipReason of ['too-easy','too-hard'])add('skip-'+skipReason,[make(100,'skipped',{skipReason})],{correct:0,incorrect:0});
 const first=make(200,'response',{answer:'not-the-token',at:100}),hint=make(201,'hint',{episodeId:first.evidence.episodeId,at:101}),retry=make(202,'response',{retryOfEpisodeId:first.evidence.episodeId,assistance:{hint:true},at:102});
 add('unaided-failure-then-assisted-retry',[first,hint,retry],{correct:0,incorrect:1});
 add('duplicate-first-response',[first,copy(first)],{correct:0,incorrect:1});
 add('assisted-success-only',[make(300,'response',{assistance:{lookup:true}})],{correct:0,incorrect:0});
 add('later-independent-success',[first,make(400,'response',{at:86400200})],{correct:1,incorrect:1});
 return {module:'public/nabu-observations.js',purpose:'Production semantic contracts only; the synthetic predictors and policies remain separate.',cases};
}

export function runEvaluation(options={}){
 const config={...copy(DEFAULT_CONFIG),...copy(options)};
 if(!Array.isArray(config.seeds)||!config.seeds.length||!Number.isInteger(config.learnersPerSeed)||config.learnersPerSeed<1)throw Error('Explicit seeds and a positive learner count are required.');
 const representation=representationAudit(),semantics=semanticAudit(),productionSemantics=productionSemanticAudit(),prediction=predictionRuns(config),policy=policyRuns(config);
 return {schemaVersion:1,protocol:PROTOCOL_VERSION,synthetic:true,productionModified:false,config,representation,semantics,productionSemantics,prediction,policy,assumptions:{prior:'Research-only Beta(1,1) per item and production mode; no passive updates.',graph:'Separate mixture with at most one assessed outcome per other independently declared family; weight min(.85,4/(4+target direct count)). Requires at least three families and stipulated-supported same operation/reading.',truth:'Prediction worlds explicitly assume shared operation, independent memorization, separate readings, conflict, or reversed transfer domain. These are generated conditions, not linguistic findings.',help:'Help changes latent response probability by gain*(1-p), with deterministic keyed learner variation in [0.8,1.2]. It adds no assessed evidence.',retention:'At the common delayed test, only retention times the simulated gain remains; baseline probability stays constant except in the explicitly stale-history world.',time:'Both policies have identical content, estimator, 20-second probes, 40-second help and wall-clock budget; unspent time remains ordinary task time with no invented extra learning. Final test occurs seven days after the same budget deadline.',policy:'Fixed practice visits the same criticality-ordered pool and always probes then helps. Diagnostic decisions require different outcome-dependent help/continue actions; known low-uncertainty gaps may receive help directly. No bandit or learned policy.',randomness:'Keyed common random numbers for learner/item probe outcome, learning response, and delayed outcome, shared by policies. Prediction models see identical observations and held-out outcomes.',selection:'No parameters are fitted or selected on these results; worlds include explicit failure cases. Twelve fixed-seed replicate means and sample SD describe only these simulations.'}};
}

function number(value,digits=4){return value===null||value===undefined?'—':Number(value).toFixed(digits);}
function meanSD(metric,digits=4){return metric.mean===null?'—':number(metric.mean,digits)+' ± '+number(metric.sd,digits);}
function csvValue(value){return '"'+String(value??'').replaceAll('"','""')+'"';}
export function resultCSV(result){
 const keys=['comparison','world','split','model','regime','budget','policy','seed','questions','heldoutQuestions','brier','ece','calibrationBias','readyPredictions','falseReadyPredictions','readyRate','falseReadyRate','falseReadyPopulationRate','taskSuccess','expectedTaskSuccess','helpActions','interruptions','usedSeconds','unusedSeconds'];
 return keys.map(csvValue).join(',')+'\n'+[...result.prediction.seedRows,...result.policy.seedRows].map(row=>keys.map(key=>csvValue(row[key]??row.metrics[key])).join(',')).join('\n')+'\n';
}

export function renderReport(result){
 const predictionTable=result.prediction.summary.map(r=>`| ${r.world} | ${r.split} | ${r.model} | ${meanSD(r.metrics.brier)} | ${meanSD(r.metrics.ece)} | ${meanSD(r.metrics.falseReadyRate)} | ${meanSD(r.metrics.readyRate)} |`).join('\n');
 const policyDefault=result.policy.summary.filter(r=>r.regime==='assumed-default');
 const policyTable=policyDefault.map(r=>`| ${r.world} | ${r.budget}s | ${r.policy} | ${meanSD(r.metrics.taskSuccess,3)} | ${meanSD(r.metrics.questions,2)} | ${meanSD(r.metrics.interruptions,2)} | ${meanSD(r.metrics.usedSeconds,1)} | ${meanSD(r.metrics.falseReadyRate,3)} |`).join('\n');
 const sensitivity=result.policy.paired.map(r=>`| ${r.world} | ${r.regime} | ${r.budget}s | ${meanSD(r.metrics.taskSuccess,3)} | ${meanSD(r.metrics.questions,2)} | ${meanSD(r.metrics.brier,4)} |`).join('\n');
 const newFamily=result.prediction.paired.filter(r=>r.split==='new-lexical-family');
 const failures=newFamily.filter(r=>r.delta.mean>0).map(r=>`- **${r.world}:** experimental structural borrowing increases new-family Brier by ${meanSD(r.delta)} compared with the direct-item model.`).join('\n');
 const stale=result.policy.paired.filter(r=>r.world==='stale-success-history'&&r.regime==='assumed-default').map(r=>`${r.budget}s: ${meanSD(r.metrics.taskSuccess,3)}`).join('; ');
 const sharedCalibration=result.prediction.summary.filter(r=>r.world==='shared-operation'&&r.split==='new-lexical-family'),directCalibration=sharedCalibration.find(r=>r.model==='direct-item'),graphCalibration=sharedCalibration.find(r=>r.model==='experimental-graph');
 const budgetReversal=result.policy.paired.filter(r=>r.world==='uncertain-critical'&&r.regime==='assumed-default').map(r=>`${r.budget}s: ${meanSD(r.metrics.taskSuccess,3)}`).join('; ');
 return `# Synthetic evidence evaluation — ${result.protocol}

**These are generated experiments, not real learner results, a linguistic benchmark, or evidence that Nabu improves learning.** No production graph, scheduler, ontology, learner record, or recommendation rule is changed by this script. The production scheduler remains the existing SRS; the Beta model below exists only in this research tool.

## Reproduce and inspect

\`\`\`bash
node tools/evaluate_evidence.mjs --output docs/evidence-evaluation
node --test tests/evidence-evaluation.test.mjs
\`\`\`

Fixed seeds: **${result.config.seeds.join(', ')}**. Each seed generates **${result.config.learnersPerSeed} fictional learners per world**. Output files are deterministic for the source/protocol: \`results.json\` contains configuration, exact family definitions, traces, per-seed results and calibration bins; \`results.csv\` contains per-seed metric rows. Means and **sample standard deviations across seeds** are reported below; they are not confidence intervals about people. The runtime and generator SHA-256 are recorded in JSON. There is no parameter optimization or search for winning seeds.

## 1. Representation is evaluated separately

| Check | Actual result | Boundary |
|---|---|---|
${result.representation.cases.map(c=>`| ${c.id} | ${c.status} | ${c.fact} |`).join('\n')}

The complete application is explicitly fictional and is checked through the existing structural adapter's record validator. Shape validity does not verify its linguistic correctness. Three outputs share **${result.representation.sourceLineages}** source lineage. No new morphology enters the bank.

Family IDs are assigned in the source manifest independently of spelling and suffixes. The first six families are observed, the last six are held out wholesale. Each family has three complete output identities, a/b/c. Training uses a/b from observed families, with three unique assessed episodes per item. Evaluation uses a later response to each trained item, a new c item in each observed family, and an a item from each unobserved family. The held-out family intersection is **${result.representation.familyOverlap.length}**. A new derivative of an observed base is therefore never reported as a new lexical family.

## Observation semantics

| Synthetic case | Input events | Accepted assessed events | Direct successes | Direct failures | Toy probability | Check |
|---|---:|---:|---:|---:|---:|---|
${result.semantics.map(r=>`| ${r.id} | ${r.generatedEvents} | ${r.acceptedEvents} | ${r.successes} | ${r.failures} | ${number(r.probability,3)} | ${r.passed?'pass':'FAIL'} |`).join('\n')}

Unassessed exposure, lookup, and pronunciation requests do not establish recognition or production. A knowing skip (latent probability .9) and an unknowing skip (.1) produce identical evidence: none. A failed unaided response remains a failure even if an assisted retry succeeds; immediate retries are not independent trials. A later independently assessed response can supply new evidence. Synthetic latent states are available to the evaluator only; they are never passed to either estimator.

The real \`public/nabu-observations.js\` projector is also exercised with fictional task/scorer envelopes: **${result.productionSemantics.cases.filter(x=>x.passed).length}/${result.productionSemantics.cases.length} semantic contract checks pass**. Display, lookup, pronunciation playback, both skip reasons, assisted retries, duplicate events, and later independent responses preserve these boundaries. Production competence remains **null** throughout. These contract checks do not fit, validate, or install the research probabilities.

## 2. Prediction comparison on identical observations and questions

**Direct estimator:** Beta(1,1) per exact item and production mode; posterior mean (1 + scored successes)/(2 + scored attempts). It accepts only unique, first, scored, unaided episode responses. The actual Nabu production model is not replaced with this probability.

**Experimental structural estimator:** a convex mixture of that direct estimate and a separate pooled estimate from other explicitly declared families sharing the same stipulated operation and reading. It uses at most one observed result per other family, requires at least three families, and excludes the target family. Weight is min(.85, 4/(4 + target direct count)). Inferred support retains its source IDs and never increments direct counts. This is an assumed transfer model, not a fitted or validated learner model. A structurally valid relationship does not guarantee that a particular learner has learned a shared operation.

Both estimators receive byte-equivalent observation records and exactly the same held-out question/outcome pairs. Held-out responses never update either model before scoring. The independent-memorization world is deliberately favorable to item-specific evidence. The conflict world disables borrowing. The wrong-domain world gives the experimental model apparently supported metadata whose transfer implication is false; it tests failure under bad applicability assumptions.

**Metrics:** Brier = mean((predicted probability − held-out binary response)²), lower is better. Calibration uses ten predeclared equal-width probability bins; ECE = sum(bin fraction × absolute(mean prediction − empirical correct fraction)), lower is better. Signed calibration bias and full bin counts are in JSON. ECE depends on bins and sample size and is not proof of individual calibration. A prediction at least **${result.config.readinessThreshold}** is called “ready” only for this metric. False-ready rate = failed held-out responses among ready predictions; ready rate and population false-ready rate are also saved. A dash means no ready predictions, not zero error.

| Generated world | Held-out split | Estimator | Brier, mean ± SD | ECE, mean ± SD | False-ready, mean ± SD | Ready rate, mean ± SD |
|---|---|---|---:|---:|---:|---:|
${predictionTable}

### Prediction failures and limits

${failures||'- No new-family Brier degradation occurred in this run; inspect other splits before claiming any advantage.'}

The same-spelling world has separate reading IDs and opposite response tendencies. Spelling alone is never a transfer key. In the conflicting-analysis world, estimates coincide by construction because borrowing is disabled. These cases show why representation, applicability, and learner evidence cannot be treated as one source of certainty. The generated graph relation is an assumption supplied to the research model, not a discovery from Nabu's live graph.

Better Brier does not mean better calibration here. In the shared-operation new-family case, mean ECE is **${number(directCalibration.metrics.ece.mean)}** for the direct model and **${number(graphCalibration.metrics.ece.mean)}** for the experimental mixture. The direct model's constant .5 closely matches the marginal average while providing no distinction between the generated high- and low-probability learners. The unfitted mixture distinguishes them but shrinks their predictions toward the middle, leaving calibration error. False-ready rates also require their coverage and denominators: a very small ready subset can have a highly variable conditional failure rate. The report preserves all of these measures rather than treating one favorable metric as validation.

## 3. Policy comparison under matched constraints

Both policies share the **same direct-item estimator, six-item content pool, task priorities, action implementation, and time budget**. The first two items are critical to the simulated task. The fixed policy already visits those critical items first; it is not sent to irrelevant content. Each fixed episode has a 20-second scored probe followed by the same 40-second support whether the answer was correct or incorrect. The diagnostic policy may choose either of those same actions. It asks a question only if a correct versus incorrect response changes the next help/continue action and there is time left to provide the possible help. Otherwise an already established low-probability gap can receive help directly. It does not maximize entropy, use a bandit, or treat uncertainty as usefulness.

The help/continue rule uses .6 as its toy decision boundary; this is separate from the .8 reporting threshold for a readiness declaration. Help adds no knowledge evidence. Each item can receive at most one probe and one help action in a run. A question is an assessment; an interruption is either a question or a help action. No fixed policy gets a different model or different content. Both face the same wall-clock cap; unused time remains the chosen task, with no additional learning imputed to it.

**Assumed learning and retention:** help changes latent response probability by gain × (1 − current probability), multiplied by fixed learner/item variation in [0.8,1.2]. The default gain is .45. At a test seven days after the shared time deadline, .75 of that improvement remains. These values are assumptions, not estimates. Sensitivity also uses gain .15/retention .5 and gain .65/retention .9. Assessments themselves have no learning effect in this toy world; therefore this is not a test of retrieval-practice theory. Stale-history cases deliberately violate the estimator's stationarity assumption.

The two policies use keyed **common random numbers** for each learner/item response, learning response and delayed test. Different policies may ask different questions; their estimator and potential outcomes are otherwise shared. Task success means both critical items succeed in the independent delayed test. Six identical held-out tests per learner are administered after the shared intervention deadline and are not counted as intervention questions or charged differently to either policy. The report includes both sampled success and the simulator's expected success product. This is a simulated task score, not a language proficiency judgment.

### Default assumptions, with budget sensitivity

| Generated world | Budget | Policy | Delayed task success, mean ± SD | Questions | Interruptions | Used seconds | False-ready |
|---|---:|---|---:|---:|---:|---:|---:|
${policyTable}

### Learning/retention and budget sensitivity

All differences below are **diagnostic minus fixed practice**, paired within seed. Positive task-success difference favors diagnostic; positive question/interruption burden would favor fixed. The JSON also contains paired expected success, interruption, time, and Brier differences.

| World | Assumed learning regime | Budget | Task-success difference | Question difference | Brier difference |
|---|---|---:|---:|---:|---:|
${sensitivity}

### Policy failures and interpretation

In stale-success-history, earlier successes are misleading and the shared direct estimator cannot discover the unobserved change without a new response. The diagnostic policy can continue when help is needed. Its default paired task-success differences are **${stale}**. Fixed practice may outperform it by revisiting material regardless of apparent certainty. Already-ready learners may gain a small simulated improvement from redundant fixed help at the cost of extra interruptions. The comparison is consequently a tradeoff under declared assumptions, not a claim that diagnostics always win.

Budget changes can reverse the comparison even with the same learner world and learning assumptions. For uncertain-critical, default paired success differences are **${budgetReversal}**. The fixed policy can afford support for both critical items at longer budgets, while the diagnostic policy may withhold support after a correct answer. Reduced interruptions and unused time therefore cannot be reported as an unconditional task-success improvement. No common policy dominance was demonstrated.

The known-critical-gap world makes a different point: low uncertainty does not make a gap unimportant. The diagnostic policy can supply help without first asking an unnecessary question. Event-level example traces are saved in JSON to inspect these decisions. Fewer questions alone are not learner benefit; compare delayed task success, false-ready errors, time, and interruption counts together.

## What this evaluation does not establish

No real human observations, linguistic gold labels, curriculum outcomes, measured retention curves, or validated response-time costs were supplied. The simulated graph is independent of production alignment IDs and makes no new claims about Arabic, Spanish, P073, or any natural-language morphology. Binary independently generated responses simplify knowledge, attention, guessing, context, feedback, and correlation. False-ready is threshold-dependent; aggregate calibration can hide subgroup errors. Twelve deterministic seed replicates measure variability inside these chosen worlds only. No deployment, experiment recruitment, telemetry change, or production posterior is introduced.

## Equal-time human pilot proposal — not launched

After consent and content review, compare the two support policies with the same instruction, content pool, available actions, learning-state estimator, and fixed session time. Randomize or counterbalance policy assignment with separate matched content sets so carryover is visible; analyze participant-level assignment and item/context nesting. Keep exposure, assistance, skipped questions and scored responses separately recorded. Predeclare the task, delay, response rubric, readiness threshold and primary outcome before looking at results. Use a blinded delayed transfer task with genuinely unseen lexical families and a separate within-family score; include task completion, false-ready errors, interruptions, time, and learner-rated disruption. Inspect calibration only where enough scored predictions exist, with uncertainty intervals and missingness reported. Choose recruitment and sample size from pilot feasibility and a separate power analysis; this document makes no sample-size or efficacy claim. No human pilot has been started.
`;
}

export async function writeEvaluation(result,output){
 const dir=resolve(output);await mkdir(dir,{recursive:true});const source=await readFile(fileURLToPath(import.meta.url));
 const withReproducibility={...result,reproducibility:{generator:'tools/evaluate_evidence.mjs',generatorSHA256:createHash('sha256').update(source).digest('hex'),node:process.versions.node,command:'node tools/evaluate_evidence.mjs --output docs/evidence-evaluation',timestampPolicy:'No wall-clock timestamp is embedded; equal inputs and source produce equal output bytes.'}};
 await writeFile(join(dir,'results.json'),JSON.stringify(withReproducibility,null,2)+'\n');await writeFile(join(dir,'results.csv'),resultCSV(withReproducibility));await writeFile(join(dir,'report.md'),renderReport(withReproducibility));return withReproducibility;
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 const args=process.argv.slice(2);if(args.length!==0&&(args.length!==2||args[0]!=='--output'))throw Error('Usage: node tools/evaluate_evidence.mjs [--output docs/evidence-evaluation]');
 const result=runEvaluation(),output=args[1]||'docs/evidence-evaluation';await writeEvaluation(result,output);console.log(JSON.stringify({synthetic:true,protocol:result.protocol,seeds:result.config.seeds.length,learnersPerSeed:result.config.learnersPerSeed,predictionRows:result.prediction.seedRows.length,policyRows:result.policy.seedRows.length,semanticChecks:result.semantics.length,semanticFailures:result.semantics.filter(x=>!x.passed).length,output}));
}
