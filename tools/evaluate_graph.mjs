#!/usr/bin/env node
/** Reproducible structural evaluation, not a linguistic or learner benchmark.
 * No database writes, production graph mutation, learned scores, or API calls.
 * node tools/evaluate_graph.mjs --output docs/graph-evaluation
 */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve,join} from 'node:path';
import * as G from '../public/nabu-graph.js';
import * as Structure from '../public/nabu-structure.js';
import * as Content from '../public/nabu-content.js';
import * as Kernel from '../public/nabu-graph-kernel.js';
import * as Queries from '../public/nabu-structure-query.js';

export const GRAPH_PROTOCOL='typed-incidence-v1';
export const GRAPH_SEEDS=Object.freeze([11,29,47,83,101,137,173,211,257,307,359,419]);
export const GRAPH_CONFIG=Object.freeze({seeds:GRAPH_SEEDS,trialsPerSeed:128,arities:[1,2,4,8,16],scaleFactors:[100,1000,10000],scaleArities:[2,4,8,16],copyCounts:[1,5,20],distractorCounts:[0,10,100,1000],wideFactorSizes:[100,1000,10000]});
const clone=value=>structuredClone(value);
const bytes=value=>Buffer.byteLength(JSON.stringify(value),'utf8');
const canonical=value=>Array.isArray(value)?'['+value.map(canonical).join(',')+']':value&&typeof value==='object'?'{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}':JSON.stringify(value);
const mean=values=>values.length?values.reduce((sum,value)=>sum+value,0)/values.length:null;
export function graphSpread(values){const a=values.filter(Number.isFinite),m=mean(a);return {mean:m,sd:a.length>1?Math.sqrt(a.reduce((sum,x)=>sum+(x-m)**2,0)/(a.length-1)):a.length?0:null,min:a.length?Math.min(...a):null,max:a.length?Math.max(...a):null,n:a.length};}
export function graphUniform(...keys){let h=2166136261;for(const c of keys.join('\u001f')){h^=c.codePointAt(0);h=Math.imul(h,16777619);}h^=h>>>16;h=Math.imul(h,0x85ebca6b);h^=h>>>13;h=Math.imul(h,0xc2b2ae35);h^=h>>>16;return ((h>>>0)+.5)/4294967296;}
function fixtureSource(id='synthetic-source',lineageId='synthetic-lineage'){return {sourceId:id,lineageId,locator:'generated/'+id,kind:'authored-fixture',fixtureOnly:true,attested:false,humanReviewed:false};}
function node(id){return {id,type:'form',language:'es',text:'zzfixture_'+id,fixtureOnly:true};}
function fixtureSnapshot(id,{nodes,factors,sources}){return {schemaVersion:1,id:'evaluation:'+id,version:GRAPH_PROTOCOL+':fixture',nodes,factors,sources,fixtureOnly:true};}

/** Complete fictional form applications; verified here means stipulated fixture
 * input to the gate, never a verified claim about Spanish or another language.
 */
export function applicationFixture({id='synthetic-application',inputIds=['A','B'],outputIds=['C'],status='verified',guards=[],alternatives=0,source=fixtureSource()}={}){
 const nodes=[...new Set([...inputIds,...outputIds])].map(node),byId=new Map(nodes.map(n=>[n.id,n]));
 const part=id=>({id,form:byId.get(id).text,language:'es',features:{fixtureOnly:true,grammaticality:null}});
 const application={id,patternId:'fictional-complete-operation',language:'es',status,fixtureOnly:true,inputs:inputIds.map(part),outputs:outputIds.map(part),features:{fixtureOnly:true,operation:'synthetic conjunction; not natural morphology'},provenance:[source],competingAnalyses:[]};
 for(let i=0;i<alternatives;i++)application.competingAnalyses.push({...clone(application),id:id+'-alternative-'+i,patternId:'fictional-alternative-'+i,features:{fixtureOnly:true,operation:'competing fictional analysis'}});
 const validated=Structure.validatePatternApplication(application);
 const factor={id:'factor:'+id,type:'complete-application',semantics:'application',members:[...inputIds.map(nodeId=>({nodeId,role:'input',language:'es'})),...outputIds.map(nodeId=>({nodeId,role:'output',language:'es'}))],status,provenanceRefs:[source.sourceId],fixtureOnly:true,application:validated,guards:clone(guards)};
 return fixtureSnapshot(id,{nodes,factors:[factor],sources:[source]});
}

/** Intentionally lossy ablation: no factor identity or AND grouping survives. */
export function applicationPairwiseProjection(snapshot){
 const edges=new Set();for(const factor of snapshot.factors){if(factor.semantics!=='application')continue;
  const inputs=factor.members.filter(m=>m.role==='input'),outputs=factor.members.filter(m=>m.role==='output');
  for(const input of inputs)for(const output of outputs)edges.add(JSON.stringify([input.nodeId,output.nodeId]));
 }return [...edges].sort().map(edge=>JSON.parse(edge));
}
export function pairwiseReachable(edges,seeds){const reached=new Set(seeds),queue=[...reached],out=new Map();for(const [a,b] of edges){if(!out.has(a))out.set(a,[]);out.get(a).push(b);}for(let i=0;i<queue.length;i++)for(const next of out.get(queue[i])||[])if(!reached.has(next)){reached.add(next);queue.push(next);}return [...reached].sort();}
function truthTableMetrics(rows,key){let tp=0,fp=0,fn=0,tn=0;for(const row of rows){if(row[key])row.oracle?tp++:fp++;else row.oracle?fn++:tn++;}return {n:rows.length,trueAvailable:tp+fn,claimedAvailable:tp+fp,tp,fp,fn,tn,falseAvailabilityRate:rows.length?fp/rows.length:null,falseAmongAvailable:tp+fp?fp/(tp+fp):null,precision:tp+fp?tp/(tp+fp):null,recall:tp+fn?tp/(tp+fn):null};}

export function conjunctionEvaluation(config=GRAPH_CONFIG){
 const seedRows=[],examples=[];
 for(const arity of config.arities){
  const inputIds=Array.from({length:arity},(_,i)=>'input-'+i),snapshot=applicationFixture({inputIds}),index=Kernel.createIncidenceIndex(snapshot),factorId=snapshot.factors[0].id,edges=applicationPairwiseProjection(snapshot);
  for(const seed of config.seeds){const rows=[];
   for(let trial=0;trial<config.trialsPerSeed;trial++){
    // Explicit empty/full boundary cases plus predeclared seeded subsets.
    const available=trial===0?[]:trial===1?inputIds:inputIds.filter(id=>graphUniform(seed,arity,trial,id)<.5);
    const oracle=inputIds.every(id=>available.includes(id));
    const assessed=index.assessApplication(factorId,{availableNodeIds:available,context:{},includeFixtures:true,allowAuthored:true});
    const row={oracle,pairwise:pairwiseReachable(edges,available).includes('C'),incidence:assessed.availability==='available',availability:assessed.availability};rows.push(row);
    if(seed===config.seeds[0]&&trial<3)examples.push({arity,seed,trial,available,required:inputIds,...row});
   }
   for(const model of ['pairwise','incidence'])seedRows.push({comparison:'conjunction',arity,seed,model,metrics:truthTableMetrics(rows,model)});
  }
 }
 const summary=[];for(const arity of config.arities)for(const model of ['pairwise','incidence']){const rows=seedRows.filter(r=>r.arity===arity&&r.model===model);summary.push({arity,model,metrics:Object.fromEntries(['falseAvailabilityRate','falseAmongAvailable','precision','recall'].map(metric=>[metric,graphSpread(rows.map(r=>r.metrics[metric]))]))});}
 return {seedRows,summary,examples,interpretation:'The oracle is the explicit conjunction, not linguistic truth or learner competence. No context/status gate differs between these two models in this comparison.'};
}

export function projectionCounterexample(){
 const and=applicationFixture({id:'and-rule'}),first=applicationFixture({id:'or-A',inputIds:['A']}),second=applicationFixture({id:'or-B',inputIds:['B']});
 const either=fixtureSnapshot('two-unary-rules',{nodes:and.nodes,factors:[...first.factors,...second.factors],sources:and.sources});
 const a=Kernel.createIncidenceIndex(and),b=Kernel.createIncidenceIndex(either),options={availableNodeIds:['A'],context:{},includeFixtures:true,allowAuthored:true};
 const andAvailable=a.assessApplication(and.factors[0].id,options).availability==='available';
 const eitherAvailable=either.factors.some(f=>b.assessApplication(f.id,options).availability==='available');
 return {samePairwiseProjection:canonical(applicationPairwiseProjection(and))===canonical(applicationPairwiseProjection(either)),andAvailable,eitherAvailable,seeds:['A'],andProjection:applicationPairwiseProjection(and),eitherProjection:applicationPairwiseProjection(either),notice:'The two graphs have the same flattened directed edges, but different declared conjunction semantics. A role-labelled factor incidence graph can preserve both.'};
}

export function applicationGateCases(){
 const definitions=[
  {id:'missing-input',config:{},available:['A'],context:{},expected:'missing-inputs'},
  {id:'complete-input',config:{},available:['A','B'],context:{},expected:'available'},
  {id:'context-unknown',config:{guards:[{key:'register',value:'formal'}]},available:['A','B'],context:{},expected:'context-unknown'},
  {id:'context-mismatch',config:{guards:[{key:'register',value:'formal'}]},available:['A','B'],context:{register:'casual'},expected:'context-mismatch'},
  {id:'context-match',config:{guards:[{key:'register',value:'formal'}]},available:['A','B'],context:{register:'formal'},expected:'available'},
  {id:'unresolved-analysis',config:{alternatives:1},available:['A','B'],context:{},expected:'unresolved-analysis'},
  {id:'quarantined-application',config:{status:'quarantined'},available:['A','B'],context:{},expected:'blocked'},
  {id:'generated-application',config:{status:'generated'},available:['A','B'],context:{},expected:'blocked'},
  {id:'fixture-not-opted-in',config:{},available:['A','B'],context:{},includeFixtures:false,expected:'blocked'},
  {id:'authored-not-opted-in',config:{status:'authored-unreviewed'},available:['A','B'],context:{},allowAuthored:false,expected:'blocked'},
 ];
 return definitions.map(d=>{const snapshot=applicationFixture(d.config),index=Kernel.createIncidenceIndex(snapshot),actual=index.assessApplication(snapshot.factors[0].id,{availableNodeIds:d.available,context:d.context,includeFixtures:d.includeFixtures??true,allowAuthored:d.allowAuthored??true});return {id:d.id,expected:d.expected,actual:actual.availability,pass:actual.availability===d.expected,missingInputIds:actual.missingInputIds,guardResults:actual.guardResults,notice:d.id==='unresolved-analysis'?'Conservative gate: even alternatives with the same output remain unresolved. This is not complete possible-world reasoning.':null};});
}

export function associationFixture({factorCount=10,arity=4,seed=11,relation='synthetic-association'}={}){
 if(!Number.isInteger(factorCount)||factorCount<arity||!Number.isInteger(arity)||arity<2)throw Error('Choose a factor count at least its positive arity.');
 const source=fixtureSource(),nodes=Array.from({length:factorCount},(_,i)=>({id:'node-'+i,type:'fixture-entity',fixtureOnly:true}));
 const offset=Math.floor(graphUniform(seed,'ring-offset')*factorCount);
 const factors=Array.from({length:factorCount},(_,i)=>({id:'factor-'+String(i).padStart(8,'0'),type:relation,semantics:'association',members:Array.from({length:arity},(_,j)=>({nodeId:'node-'+((i+j+offset)%factorCount),role:'member'})),status:'verified',provenanceRefs:[source.sourceId],fixtureOnly:true}));
 return fixtureSnapshot('association-'+factorCount+'-'+arity,{nodes,factors,sources:[source]});
}

/** Serialize the exact illustrative directed clique array by summing the bytes
 * of its JSON records. Avoid holding a quadratic array merely to count bytes.
 * IDs/grouping/roles are intentionally absent: this projection is lossy.
 */
export function cliqueSerializationStats(snapshot){let edges=0,jsonBytes=2;for(const factor of snapshot.factors){if(factor.semantics!=='association')continue;for(const from of factor.members)for(const to of factor.members)if(from.nodeId!==to.nodeId){const edge={from:from.nodeId,to:to.nodeId,type:factor.type};jsonBytes+=bytes(edge)+(edges?1:0);edges++;}}return {directedEdges:edges,serializedEdgeArrayBytes:jsonBytes,materialized:false};}

export function scaleEvaluation(config=GRAPH_CONFIG){
 const rows=[];for(const factorCount of config.scaleFactors)for(const arity of config.scaleArities){
  const snapshot=associationFixture({factorCount,arity,seed:config.seeds[0]}),index=Kernel.createIncidenceIndex(snapshot),clique=cliqueSerializationStats(snapshot);
  const query=index.queryNeighborhood({seedIds:[snapshot.nodes[0].id],relationTypes:['synthetic-association'],maxDepth:1,budget:{maxFactors:64,maxIncidences:1024,maxNodes:256,maxAnswers:64},includeFixtures:true});
  rows.push({factorCount,arity,nodes:snapshot.nodes.length,membershipIncidences:snapshot.factors.reduce((n,f)=>n+f.members.length,0),snapshotJSONBytes:bytes(snapshot),...clique,indexStats:index.stats(),query});
 }return {rows,notice:'These are deterministic work/representation measurements, not wall-clock benchmarks. Dense projection bytes count a lossy illustrative edge array, not an equivalent runtime or all of its metadata. The existing Nabu runtime is already compact.'};
}

export function provenanceFixture(copyCount=1){
 const sources=Array.from({length:copyCount},(_,i)=>fixtureSource('copy-'+i,'one-shared-source-lineage'));
 const nodes=[{id:'A',type:'fixture-entity'},{id:'B',type:'fixture-entity'}];
 const factors=sources.map((s,i)=>({id:'claim-'+i,type:'synthetic-support',semantics:'association',members:[{nodeId:'A',role:'from'},{nodeId:'B',role:'to'}],status:'verified',provenanceRefs:[s.sourceId],fixtureOnly:true}));
 return fixtureSnapshot('source-copies-'+copyCount,{nodes,factors,sources});
}

export function provenanceEvaluation(config=GRAPH_CONFIG){return config.copyCounts.map(copyCount=>{
 const snapshot=provenanceFixture(copyCount),index=Kernel.createIncidenceIndex(snapshot),witness=index.witness({nodeIds:['A','B'],factorIds:snapshot.factors.map(f=>f.id),steps:snapshot.factors.map(f=>({factorId:f.id,from:{nodeId:'A',role:'from'},to:{nodeId:'B',role:'to'}}))});
 return {copyCount,rawSourceRecords:snapshot.sources.length,declaredUniqueLineages:new Set(snapshot.sources.map(s=>s.lineageId)).size,witness,notice:'Distinct source IDs that explicitly name the same lineage are copies for this audit. Distinct lineage labels would still not establish statistical independence.'};
});}

export function distractorFixture(count=0){
 const source=fixtureSource(),nodes=[{id:'seed',type:'fixture-entity'},{id:'relevant',type:'fixture-entity'}],factors=[{id:'z-relevant',type:'task-support',semantics:'association',members:[{nodeId:'seed',role:'cue'},{nodeId:'relevant',role:'material'}],status:'verified',provenanceRefs:[source.sourceId],fixtureOnly:true}];
 for(let i=0;i<count;i++){const id='distractor-'+i;nodes.push({id,type:'fixture-entity'});factors.push({id:'a-topic-'+String(i).padStart(5,'0'),type:'topic-membership',semantics:'association',members:[{nodeId:'seed',role:'member'},{nodeId:id,role:'member'}],status:'verified',provenanceRefs:[source.sourceId],fixtureOnly:true});}
 return fixtureSnapshot('topic-distractors-'+count,{nodes,factors,sources:[source]});
}

export function distractorEvaluation(config=GRAPH_CONFIG){return config.distractorCounts.map(count=>{const snapshot=distractorFixture(count),index=Kernel.createIncidenceIndex(snapshot);return {distractors:count,relationFilter:['task-support'],query:index.queryNeighborhood({seedIds:['seed'],relationTypes:['task-support'],maxDepth:1,budget:{maxFactors:4,maxIncidences:8,maxNodes:4,maxAnswers:4},includeFixtures:true}),notice:'Topic similarity is deliberately irrelevant to this declared structural query. No utility or learning-gain label is inferred.'};});}

export function wideFactorEvaluation(config=GRAPH_CONFIG){return config.wideFactorSizes.map(size=>{
 const nodes=Array.from({length:size},(_,i)=>({id:'wide-node-'+String(i).padStart(6,'0'),type:'fixture-entity'})),source=fixtureSource();
 const factor={id:'wide-factor',type:'wide-association',semantics:'association',members:nodes.map(n=>({nodeId:n.id,role:'member'})),status:'verified',provenanceRefs:[source.sourceId],fixtureOnly:true};
 const index=Kernel.createIncidenceIndex(fixtureSnapshot('wide-'+size,{nodes,factors:[factor],sources:[source]}));
 return {size,query:index.queryNeighborhood({seedIds:[nodes.at(-1).id],relationTypes:['wide-association'],maxDepth:1,budget:{maxFactors:2,maxIncidences:16,maxNodes:32,maxAnswers:32},includeFixtures:true}),notice:'The fixed work budget applies after constructing the complete index; construction must read and sort all supplied records.'};
});}

function translationContract(value){return Object.fromEntries(['status','front','back','sourceLang','targetLang','conceptId','literalBack','literalGloss','literalLanguage','sourceTransliteration','backTransliteration','literalBackTransliteration'].map(k=>[k,value[k]]));}
export function catalogueAudit({fullTranslationParity=true}={}){
 const snapshot=Queries.buildStructureSnapshot(),index=Kernel.createIncidenceIndex(snapshot),exported=G.exportGraph(),categories=new Map();for(const c of G.CONCEPTS)categories.set(c.category,(categories.get(c.category)||0)+1);
 const normalized=new Map();for(const c of G.CONCEPTS)for(const language of G.LANGUAGES)for(const text of [c.terms[language],...(c.aliases[language]||[]),...(c.meaningTerms?[c.meaningTerms[language]]:[])]){const key=language+'|'+G.normalizeWord(text,language);if(!normalized.has(key))normalized.set(key,new Set());normalized.get(key).add(c.id);}
 let pairsChecked=0,translationMismatches=0,missingAlignmentAnswers=0,oldTargetRoleMismatches=0;const samples=[];
 const concepts=fullTranslationParity?G.CONCEPTS:G.CONCEPTS.filter(c=>['home.light','colors.light','expressions.cats_paw','phrases.nice_to_meet_you'].includes(c.id));
 for(const c of concepts)for(const sourceLang of G.LANGUAGES)for(const targetLang of G.LANGUAGES){if(sourceLang===targetLang)continue;
  const expected=G.translation(c.id,sourceLang,targetLang);
  const result=Queries.lookupAlignmentWitnesses({text:c.terms[sourceLang],sourceLang,targetLang,budget:{maxFactors:64,maxAnswers:64}}),answer=result.answers.find(a=>a.legacyConceptId===c.id);pairsChecked++;
  if(!answer)missingAlignmentAnswers++;else if(canonical(translationContract(answer.translation))!==canonical(translationContract(expected)))translationMismatches++;
  const old=Structure.candidateEligibility(c.id,sourceLang,targetLang);if(old.targetForm?.text!==expected.back){oldTargetRoleMismatches++;if(samples.length<6)samples.push({conceptId:c.id,sourceLang,targetLang,legacyAdapterTarget:old.targetForm?.text,actualTranslation:expected.back,newTranslation:answer?.translation?.back??null});}
 }
 const light=Queries.lookupAlignmentWitnesses({text:'light',sourceLang:'en',targetLang:'es'}),truncatedLight=Queries.lookupAlignmentWitnesses({text:'light',sourceLang:'en',targetLang:'es',budget:{maxFactors:64,maxAnswers:1}});
 const missing=Queries.lookupAlignmentWitnesses({text:'zzfixture_unknown_surface',sourceLang:'en',targetLang:'es'});
 const occurrences=Content.ITEMS.flatMap(item=>item.annotations.map(annotation=>{
  const result=Queries.occurrenceWitnesses({contentId:item.id,version:item.version,annotationId:annotation.id});
  return {contentId:item.id,version:item.version,annotationId:annotation.id,declaredConceptId:annotation.conceptId||null,answerCount:result.answers.length,alignmentId:result.answers[0]?.alignmentId??null,lexemeId:result.answers[0]?.lexemeId??null,senseId:result.answers[0]?.senseId??null,complete:result.completeness.complete};
 }));
 const rolePorts=snapshot.factors.flatMap(f=>f.members),sameSurfaceDifferentRolePairs=snapshot.factors.reduce((sum,f)=>{const members=new Map();for(const p of f.members){if(!members.has(p.nodeId))members.set(p.nodeId,new Set());members.get(p.nodeId).add(p.role);}return sum+[...members.values()].filter(roles=>roles.size>1).length;},0);
 return {notice:'Repository audit and public-contract compatibility, not linguistic validation. The legacy runtime is compact and does not automatically materialize exportGraph().',legacyStats:G.graphStats(),legacyExport:{JSONBytes:bytes(exported),translationEdges:exported.edges.length,topicPairs:exported.conceptLinks.filter(e=>e.type==='same-topic').length,explicitBridgeRecords:exported.conceptLinks.filter(e=>e.type!=='same-topic').length},snapshot:{JSONBytes:bytes(snapshot),nodeCount:snapshot.nodes.length,factorCount:snapshot.factors.length,sourceCount:snapshot.sources.length,membershipIncidences:rolePorts.length,indexStats:index.stats(),stats:Queries.structureIndexStats(),roundtripStable:canonical(index.snapshot())===canonical(Kernel.createIncidenceIndex(index.snapshot()).snapshot()),sameSurfaceDifferentRolePairs},categorySizes:Object.fromEntries(categories),normalizedLookupKeys:normalized.size,ambiguousLookupKeys:[...normalized.values()].filter(ids=>ids.size>1).length,compatibility:{fullTranslationParity,pairsChecked,translationMismatches,missingAlignmentAnswers,oldTargetRoleMismatches,oldRoleMismatchExamples:samples},lookupCases:{light,truncatedLight,missing},occurrences,surfaceIdentity:{englishGift:Structure.surfaceFormId('gift','en'),germanGift:Structure.surfaceFormId('gift','de'),languageSpecific:true,claim:'Distinct language-qualified surface IDs; not verified lexeme identities or sense analyses.'}};
}

export async function evaluateGraph(config=GRAPH_CONFIG,{fullTranslationParity=true}={}){
 const result={schemaVersion:1,protocol:GRAPH_PROTOCOL,synthetic:true,productionGraphMutated:false,learnerModelUsed:false,config:clone(config),fixtureManifest:{wholeApplication:applicationFixture(),meaningOfVerified:'Stipulated software fixture status, not natural-language validation.'},projection:projectionCounterexample(),applicationGates:applicationGateCases(),conjunction:conjunctionEvaluation(config),provenance:provenanceEvaluation(config),distractors:distractorEvaluation(config),wideFactors:wideFactorEvaluation(config),scale:scaleEvaluation(config),catalogue:catalogueAudit({fullTranslationParity})};
 const root=resolve(fileURLToPath(new URL('..',import.meta.url))),paths=['tools/evaluate_graph.mjs','public/nabu-graph-kernel.js','public/nabu-structure-query.js','public/nabu-structure.js','public/nabu-structure-data.js','public/nabu-task-material-data.js','public/nabu-content.js','public/nabu-content-catalogue.js','public/nabu-observations.js','public/nabu-graph.js','tools/graph-engine.js','tools/build_graph.py','tools/build_media_catalogue.py','data/wordgraph-source.json','data/phrasebank-source.json','data/explore.json','data/task-material-relations.json','data/graph-integrity.json'];
 result.reproducibility={node:process.version,dependencySHA256:Object.fromEntries(await Promise.all(paths.map(async path=>[path,createHash('sha256').update(await readFile(join(root,path))).digest('hex')])))};
 result.catalogue.legacyRuntimeModuleBytes=(await readFile(join(root,'public/nabu-graph.js'))).byteLength;
 result.checks=graphChecks(result);
 return result;
}

/** Independent, explicit acceptance statements for the declared experiment. */
export function graphChecks(result){
 const checks=[],add=(id,pass,meaning)=>checks.push({id,pass:!!pass,meaning});
 const rows=result.conjunction.seedRows,lookup=result.catalogue.lookupCases;
 add('lossy-projection-collision',result.projection.samePairwiseProjection&&!result.projection.andAvailable&&result.projection.eitherAvailable,'Identical flattened edges can encode different conjunctive availability.');
 for(const gate of result.applicationGates)add('application-'+gate.id,gate.pass,'Declared expected status: '+gate.expected+'.');
 add('unary-positive-control',rows.filter(r=>r.arity===1).every(r=>r.metrics.fp===0&&r.metrics.fn===0),'Both representations agree for unary applications.');
 add('conjunction-oracle-agreement',rows.filter(r=>r.model==='incidence').every(r=>r.metrics.fp===0&&r.metrics.fn===0),'All generated complete-application assessments agree with independent set-inclusion labels.');
 add('shared-provenance-not-multiplied',result.provenance.every(r=>r.witness.sourceLineageCount===1&&r.witness.provenanceRefs.length===r.copyCount&&r.witness.independenceEstablished===false),'Copied records retain their identities but one declared lineage and no independence claim.');
 add('typed-distractor-invariance',result.distractors.every(r=>canonical(r.query.answers.map(a=>a.nodeId))===canonical(['relevant'])&&canonical(r.query.completeness.work)===canonical({factors:1,incidences:2,nodes:2})&&r.query.completeness.complete),'Unrequested topic relations do not change these indexed local query answers or counted work.');
 add('wide-factor-budget',result.wideFactors.every(r=>r.query.completeness.work.incidences===16&&r.query.completeness.truncated&&r.query.answers.length===16),'Each tested high-degree factor stops at sixteen counted incidences and reports incompleteness.');
 add('scale-counts',result.scale.rows.every(r=>r.membershipIncidences===r.factorCount*r.arity&&r.directedEdges===r.factorCount*r.arity*(r.arity-1)&&r.indexStats.pairwiseEdgesMaterialized===0),'Incidence and illustrative directed-clique counts match their exact formulas.');
 add('snapshot-roundtrip',result.catalogue.snapshot.roundtripStable,'Canonical snapshot reconstruction retains complete typed records.');
 add('translation-contract-parity',result.catalogue.compatibility.translationMismatches===0&&result.catalogue.compatibility.missingAlignmentAnswers===0,'Every audited existing translation has a matching source-witness answer.');
 add('ambiguity-survives-truncation',lookup.light.status==='ambiguous'&&lookup.light.completeness.totalMatches===2&&lookup.truncatedLight.status==='ambiguous'&&lookup.truncatedLight.answers.length===1&&lookup.truncatedLight.completeness.totalMatches===2&&lookup.truncatedLight.completeness.truncated,'A one-answer limit does not resolve the two known light alignments.');
 add('missing-is-inventory-scoped',lookup.missing.status==='missing'&&lookup.missing.capabilities.exhaustiveLexicon===false,'No match is limited to the current catalogue.');
 add('anchored-occurrences-without-invented-bank-joins',result.catalogue.occurrences.every(r=>r.answerCount===1&&r.complete&&r.declaredConceptId===null&&r.alignmentId===null&&r.lexemeId===null&&r.senseId===null),'Current reader anchors remain usable without fabricated bank, lexeme, or sense links.');
 add('same-spelling-language-scoping',result.catalogue.surfaceIdentity.englishGift!==result.catalogue.surfaceIdentity.germanGift,'Exact same spelling in two languages has distinct surface IDs.');
 add('no-production-applications',(result.catalogue.snapshot.indexStats.semantics.application||0)===0,'Complete application records occur only in explicit synthetic tests.');
 return checks;
}

const display=x=>x===null||x===undefined?'—':typeof x==='number'?Number.isInteger(x)?String(x):x.toFixed(4):String(x);
const meanSD=x=>display(x.mean)+' ± '+display(x.sd);
function csvCell(value){const s=value===undefined||value===null?'':typeof value==='object'?JSON.stringify(value):String(value);return /[",\n\r]/u.test(s)?'"'+s.replaceAll('"','""')+'"':s;}
export function graphCSV(result){const keys=['comparison','arity','factorCount','seed','model','n','trueAvailable','claimedAvailable','tp','fp','fn','tn','falseAvailabilityRate','falseAmongAvailable','precision','recall','nodes','membershipIncidences','snapshotJSONBytes','directedEdges','serializedEdgeArrayBytes'];const rows=[...result.conjunction.seedRows.map(r=>({...r,...r.metrics})),...result.scale.rows.map(r=>({comparison:'scale',...r}))];return keys.join(',')+'\n'+rows.map(row=>keys.map(key=>csvCell(row[key])).join(',')).join('\n')+'\n';}

export function graphReport(result){
 const audit=result.catalogue;
 const c=result.conjunction.summary.map(r=>`| ${r.arity} | ${r.model} | ${meanSD(r.metrics.falseAvailabilityRate)} | ${meanSD(r.metrics.falseAmongAvailable)} | ${meanSD(r.metrics.precision)} | ${meanSD(r.metrics.recall)} |`).join('\n');
 const scales=result.scale.rows.map(r=>`| ${r.factorCount} | ${r.arity} | ${r.membershipIncidences} | ${r.directedEdges} | ${r.snapshotJSONBytes} | ${r.serializedEdgeArrayBytes} |`).join('\n');
 return `# Graph foundation evaluation — ${result.protocol}

**These are structural contract checks and generated counterexamples, not a linguistic benchmark or evidence of learner benefit.** No learner observations, knowledge probabilities, recommendation scores, production graph records or scheduler state are changed. The fixed protocol passes **${result.checks.filter(c=>c.pass).length}/${result.checks.length}** explicit acceptance statements.

## Reproduce

\`\`\`bash
node tools/evaluate_graph.mjs --output docs/graph-evaluation
node --test tests/graph-evaluation.test.mjs
\`\`\`

Seeds: **${result.config.seeds.join(', ')}**. Each arity/seed contains ${result.config.trialsPerSeed} input subsets: explicit empty and complete boundary cases, then seeded selections with probability .5 for each input. There is no model fitting or favorable seed search. Means and sample SD are over the declared seed replicates, not confidence intervals about people. Exact result JSON includes the full application fixture template, sample subsets, kernel statuses, witnesses, work counters, version fingerprints and dependency hashes. The deterministic script defines every generated graph. Timings are not measured; asymptotic statements follow from the representation and algorithms, not a stopwatch.

## Current repository audit

| Quantity | Measured value | Meaning |
|---|---:|---|
| Authored alignment groups | ${audit.legacyStats.concepts} | Not independently validated multilingual lexemes |
| Supported languages | ${audit.legacyStats.languages} | Current catalogue support |
| Legacy term slots | ${audit.legacyStats.nodes} | Not unique forms |
| Legacy directed translation export edges | ${audit.legacyExport.translationEdges} | Within-alignment pair expansion |
| Legacy topic-pair export records | ${audit.legacyExport.topicPairs} | Category clique pairs; not independent semantic evidence |
| Legacy explicit bridge export records | ${audit.legacyExport.explicitBridgeRecords} | Existing declared or category-generated bridges |
| Legacy export JSON bytes | ${audit.legacyExport.JSONBytes} | Exact JSON serialization of exportGraph() |
| Existing runtime graph module bytes | ${audit.legacyRuntimeModuleBytes} | Runtime was already compact; export size is not runtime memory |
| New typed snapshot nodes / factors / sources | ${audit.snapshot.nodeCount} / ${audit.snapshot.factorCount} / ${audit.snapshot.sourceCount} | First-class typed records |
| New membership incidences | ${audit.snapshot.membershipIncidences} | Role-labelled factor ports |
| New snapshot JSON bytes | ${audit.snapshot.JSONBytes} | Different metadata/schema; no automatic performance claim |
| Ambiguous normalized lookup keys | ${audit.ambiguousLookupKeys} | Multiple known catalogue candidates |
| Surface/factor combinations retaining multiple roles | ${audit.snapshot.sameSurfaceDifferentRolePairs} | Equal text need not have one role |
| Real complete applications | ${audit.snapshot.indexStats.semantics.application||0} | None imported by this release |

Public translation compatibility checked **${audit.compatibility.pairsChecked}** language-pair/entry cases: **${audit.compatibility.translationMismatches}** mismatched outputs and **${audit.compatibility.missingAlignmentAnswers}** missing alignment answers. This tests compatibility with the existing authored translator, not translation truth. The old structural adapter's listed target form disagreed with actual translation output in **${audit.compatibility.oldTargetRoleMismatches}** cases; exact examples in JSON distinguish idiom meaning-rendering roles from the original expression. The new witnesses use the role that matches the existing translator. Legacy export behavior remains unchanged.

All **${audit.occurrences.length}** current reader annotations produce an exact source witness while retaining null bank-alignment, lexeme and sense links. Their supplied source text is not silently joined to bank entries by a similar gloss. Canonical snapshot export/reconstruction is stable: **${audit.snapshot.roundtripStable}**. Distinct language-qualified surface identities do not assert lexeme identity or validated senses.

## Conjunction is not a path

The complete fixture rule {A,B}→C and the two unary rules A→C, B→C have the same flattened edges: **${result.projection.samePairwiseProjection}**. With only A available, full conjunction is available: **${result.projection.andAvailable}**; a unary alternative is available: **${result.projection.eitherAvailable}**. This establishes loss of grouping in this particular projection. A bipartite graph that preserves factor IDs and roles can retain both semantics; the comparison does not claim that all pairwise storage is inadequate.

The oracle below is the explicit synthetic AND requirement. Both compared methods receive the same inputs; no quality or context difference favors either one. False availability = false positives / all subsets. False among available = false positives / claimed-available subsets. Precision and recall use the declared conjunction as reference. Arity one is the positive control. Empty/full boundary cases ensure at least one available and one unavailable case in every seed replicate; those cases are included in every reported denominator.

| Required inputs | Method | False availability | False among available | Precision | Recall |
|---:|---|---:|---:|---:|---:|
${c}

This is a semantics stress test with an intentionally forgetful projection, not an empirical contest between full hypergraph algorithms and every graph implementation. A projection that retains factor IDs and checks all ports is an incidence implementation and avoids the counterexample.

## Context, quality, and competing analyses

| Fixture | Expected status | Actual status | Pass |
|---|---|---|---|
${result.applicationGates.map(x=>`| ${x.id} | ${x.expected} | ${x.actual} | ${x.pass} |`).join('\n')}

Application availability means only that the supplied structural inputs and declared guards are present under the explicit fixture/review policy. It does not say that a learner knows those inputs, that the operation is linguistically correct, or that the output will help. Any unresolved alternative causes abstention, even when its output agrees; this deliberately conservative gate is not a complete possible-world solver. The status “verified” in synthetic fixtures is stipulated software input, not attestation of the fictional strings. No real morphology applications are imported.

## Provenance, relevance, and bounded answers

| Copied source records | Returned source references | Declared source lineages | Independence established |
|---:|---:|---:|---|
${result.provenance.map(r=>`| ${r.copyCount} | ${r.witness.provenanceRefs.length} | ${r.witness.sourceLineageCount} | ${r.witness.independenceEstablished} |`).join('\n')}

Different record IDs and sibling outputs do not become independent evidence. The kernel groups declared source lineage; it does not discover hidden dependencies. Differently labelled lineages also do not establish statistical independence. Full source occurrences and factor records remain inspectable.

| Irrelevant topic factors | Answer IDs | Counted factors / incidences / nodes | Complete |
|---:|---|---:|---|
${result.distractors.map(r=>`| ${r.distractors} | ${r.query.answers.map(a=>a.nodeId).join(', ')} | ${r.query.completeness.work.factors} / ${r.query.completeness.work.incidences} / ${r.query.completeness.work.nodes} | ${r.query.completeness.complete} |`).join('\n')}

This invariance is conditional on a correct explicit relation filter and a prebuilt typed index. It is not a test of learned task relevance. A task-independent topology score cannot distinguish two tasks that prefer opposite materials on the same graph. Topic degree may reflect catalogue organization rather than usefulness; current category sizes range from ${Math.min(...Object.values(audit.categorySizes))} to ${Math.max(...Object.values(audit.categorySizes))} entries.

The real “light” query returns **${audit.lookupCases.light.completeness.totalMatches}** known alignments. With a one-answer cap it returns **${audit.lookupCases.truncatedLight.answers.length}** but remains **${audit.lookupCases.truncatedLight.status}** and **incomplete**. A missing catalogue answer is scoped to this inventory, not a claim that no linguistic answer exists. Omitted alternative identities and total match counts must be distinguished when a query budget is reached.

## Size and bounded-work measurements

| Factors | Arity | Incidences | Directed clique edges | Snapshot JSON bytes | Projected edge-array bytes |
|---:|---:|---:|---:|---:|---:|
${scales}

For a k-member association, role-labelled incidence needs k memberships while the illustrative complete directed projection has k(k−1) edge records. Projection counts retain one edge record per group/pair, even when different groups share endpoints; deduplicating those records would erase further multiplicity and would not recover grouping. Byte columns measure different serialized formats: the clique drops grouping, roles and much provenance, while the snapshot retains them. They do not establish equivalent information, runtime memory, loading latency, or system-wide speedup. At small arities, richer metadata can outweigh incidence savings.

| Members in one allowed factor | Counted factors / incidences / nodes | Answers | Incomplete |
|---:|---:|---:|---|
${result.wideFactors.map(r=>`| ${r.size} | ${r.query.completeness.work.factors} / ${r.query.completeness.work.incidences} / ${r.query.completeness.work.nodes} | ${r.query.answers.length} | ${r.query.completeness.truncated} |`).join('\n')}

Query counters exclude construction, validation, metadata cloning and canonical sorting of the complete index. Indexing must read all supplied records and includes sorting costs; it is not claimed to be strict linear time. Generic neighborhood budgets cap counted factor/port/node visits and answer count after indexing. Specialized source queries also validate the selected current source and preserve indexed catalogue match counts; their bounded output must never imply semantic exhaustiveness. The report includes no latency benchmark and no worst-case guarantee for hypothetical global planning or provenance-expression enumeration.

## Acceptance statements

| Check | Pass |
|---|---|
${result.checks.map(c=>`| ${c.id} | ${c.pass} |`).join('\n')}

## Limits and immediate next step

The current bank remains authored and unreviewed. Language-specific lexemes and lexical senses are not invented. Existing next-step scoring and direct learner evidence remain separate from graph discovery. A graph witness establishes that a material is linked by allowed recorded relations; it does not identify instructional utility from topology alone. Source lineage records neither estimate source truth nor license automatic transfer into the learner ledger.

The immediate implemented step is the typed snapshot, local full-application gate and bounded witness query, connected to existing discovery. Before broader inference, add independently reviewed source-grounded applications with explicit applicability guards, versioned alternative analyses and counterexamples. Evaluate their structural query semantics separately from held-out prediction and equal-time policy studies. Global optimal plans, semantic disambiguation, probabilistic source validity, graph-based learner transfer and human learning outcomes are not implemented or measured here. The previous research-only evidence experiments remain unchanged in docs/evidence-evaluation/.
`;
}

async function main(){const args=process.argv.slice(2),at=args.indexOf('--output'),output=resolve(at<0?'docs/graph-evaluation':args[at+1]||'');if(at>=0&&!args[at+1])throw Error('--output needs a directory.');const result=await evaluateGraph();await mkdir(output,{recursive:true});await writeFile(join(output,'results.json'),JSON.stringify(result,null,2)+'\n');await writeFile(join(output,'results.csv'),graphCSV(result));await writeFile(join(output,'report.md'),graphReport(result));const failedChecks=result.checks.filter(x=>!x.pass);console.log(JSON.stringify({protocol:result.protocol,synthetic:true,conjunctionSeedRows:result.conjunction.seedRows.length,acceptanceChecks:result.checks.length,failedChecks:failedChecks.map(x=>x.id),translationPairs:result.catalogue.compatibility.pairsChecked,translationMismatches:result.catalogue.compatibility.translationMismatches,output}));if(failedChecks.length)process.exitCode=1;}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main().catch(error=>{console.error(error);process.exitCode=1;});
