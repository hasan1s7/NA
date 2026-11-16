/** Bounded structural queries over Nabu's existing authored records.
 *
 * Alignment and topic factors store incidences, not expanded cliques. A witness
 * traces supplied records; it is not an implication, attestation, or learner
 * observation. Legacy translation and card identities remain unchanged.
 */
import * as G from './nabu-graph.js';
import * as X from './nabu-content.js';
import * as Structure from './nabu-structure.js';
import * as GraphKernel from './nabu-graph-kernel.js';
import * as TaskMaterialData from './nabu-task-material-data.js';

export const STRUCTURE_QUERY_SCHEMA_VERSION = 1;
const POLICY='nabu-structure-query-v1';
const clone=value=>structuredClone(value);
const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const alignmentId=id=>'alignment:'+id;
const alignmentFactor=id=>'factor:alignment:'+id;
const occurrenceId=(item,annotation)=>'usage:explore:'+item.id+'@'+item.version+':'+annotation.id;
const occurrenceFactor=(item,annotation)=>'factor:occurrence:'+item.id+'@'+item.version+':'+annotation.id;
const taskFactor=(profile,material)=>'factor:task-material:'+profile.id+':'+material.role+':'+material.conceptId;
const FORMS=new Set(['listed-term','listed-alias','authored-meaning-rendering','authored-literal-rendering']);
const SEARCHABLE_ROLES=new Set(['listed-term','listed-alias','authored-meaning-rendering']);
const CAPABILITIES=Object.freeze({
 legacyAlignments:true,exactSurfaceForms:true,authoredUsages:true,sourceAnchors:true,
 categoryMemberships:true,authoredTaskMaterials:true,compactIncidences:true,
 lexemeInventory:false,lexicalSenseInventory:false,productionPatternApplications:false,
 automaticEvidenceTransfer:false,exhaustiveLexicon:false,
});
let cache=null;

export function graphVersion(){
 const hash=G.DATA.structureSourceManifest?.sha256;
 if(typeof hash!=='string'||!/^[a-f0-9]{64}$/u.test(hash))throw Error('Rebuild the graph source manifest before querying structure.');
 return POLICY+':'+hash;
}

function createSnapshot(){
 const nodes=new Map(),factors=new Map(),sources=new Map(),issues=[];
 const sourceRef=raw=>{
  // One source lineage may describe many independently addressable locations.
  // Qualify the record ID; do not invent another independent source lineage.
  const suffix=raw.locator===raw.recordId?'':'#'+encodeURIComponent(raw.locator);
  const sourceId=raw.sourceId+suffix;
  const source={...clone(raw),sourceId,originSourceId:raw.sourceId};
  const previous=sources.get(sourceId);
  if(previous&&JSON.stringify(previous)!==JSON.stringify(source))throw Error('A structural source ID has conflicting metadata.');
  sources.set(sourceId,source);return sourceId;
 };
 const refs=provenance=>[...new Set(provenance.map(sourceRef))];
 const addNode=raw=>{
  const {provenance=[],...fields}=raw,node={...clone(fields),provenanceRefs:refs(provenance)};
  if(node.type==='alignment'){node.lexemeId=null;node.senseId=null;}
  const previous=nodes.get(node.id);
  if(previous){
   if(previous.type!==node.type||previous.language!==node.language||previous.text!==node.text)throw Error('A structural node ID has conflicting identity.');
   previous.provenanceRefs=[...new Set([...previous.provenanceRefs,...node.provenanceRefs])];
  }else nodes.set(node.id,node);
  return node.id;
 };
 const addFactor=factor=>{
  if(factors.has(factor.id))throw Error('Duplicate structural factor ID.');
  factors.set(factor.id,{...factor,automaticEvidenceTransfer:false});return factor;
 };
 const addMember=(factor,member)=>{
  if(!factor.members.some(old=>old.nodeId===member.nodeId&&old.role===member.role&&old.language===member.language))factor.members.push(member);
 };
 const bankIssueSources=new Map(Structure.graphIntegrityRegistry().entryFlags.map(flag=>[flag.conceptId,flag]));
 // Reuse the existing typed bridge in its bounded batches, preserving its NFC
 // identities, actual authored usages, and conservative quality declarations.
 for(let offset=0;offset<G.CONCEPTS.length;offset+=100){
  const slice=Structure.structureSlice({conceptIds:G.CONCEPTS.slice(offset,offset+100).map(c=>c.id)});
  issues.push(...slice.issues);
  for(const node of slice.nodes){
   addNode(node);
   if(node.type==='alignment'){
    const flag=bankIssueSources.get(node.legacyConceptId),provenanceRefs=refs(node.provenance);
    if(flag)provenanceRefs.push(sourceRef({sourceId:'nabu-integrity:'+flag.conceptId,lineageId:'nabu-integrity:v1',kind:'integrity-review',sourcePath:'data/graph-integrity.json',recordId:flag.conceptId,locator:'entryFlags.'+flag.conceptId,reviewStatus:'needs_verification',humanReviewed:false,attested:false}));
    addFactor({id:alignmentFactor(node.legacyConceptId),type:'authored-alignment',semantics:'association',members:[{nodeId:node.id,role:'alignment'}],status:flag?'needs_verification':'authored-unreviewed',provenanceRefs,legacyConceptId:node.legacyConceptId,requiresContext:!!flag,lexemeId:null,senseId:null});
   }
  }
  for(const edge of slice.edges){
   if(FORMS.has(edge.type)){
    const node=nodes.get(edge.from),factor=factors.get('factor:'+edge.to);
    addMember(factor,{nodeId:edge.from,role:edge.type,language:node.language});
   }else if(edge.type==='authored-example-for-alignment'){
    addFactor({id:'factor:'+edge.from,type:'authored-usage',semantics:'association',members:[{nodeId:edge.from,role:'usage',language:nodes.get(edge.from).language},{nodeId:edge.to,role:'alignment'}],status:'authored-unreviewed',provenanceRefs:refs(edge.provenance)});
   }
  }
 }
 // An expression may use the same surface in two distinct roles. Retain both
 // memberships so target-role selection agrees with G.translation in every
 // direction, including translation back into the expression's origin.
 for(const concept of G.CONCEPTS)if(concept.meaningTerms){
  const factor=factors.get(alignmentFactor(concept.id));
  for(const language of G.LANGUAGES)addMember(factor,{nodeId:Structure.surfaceFormId(concept.meaningTerms[language],language),role:'authored-meaning-rendering',language});
 }
 const media=Structure.structureSlice({mediaRefs:X.ITEMS.map(({id,version})=>({id,version}))});
 issues.push(...media.issues);for(const node of media.nodes)addNode(node);
 for(const item of X.ITEMS)for(const annotation of item.annotations){
  const usage=nodes.get(occurrenceId(item,annotation));if(!usage)continue;
  addFactor({id:occurrenceFactor(item,annotation),type:'anchored-occurrence',semantics:'association',members:[{nodeId:usage.id,role:'occurrence',language:item.language},{nodeId:'media:explore:'+item.id+'@'+item.version,role:'source',language:item.language},{nodeId:Structure.surfaceFormId(annotation.quote,item.language),role:'surface',language:item.language}],status:'authored-unreviewed',provenanceRefs:usage.provenanceRefs.slice(),anchor:clone(usage.anchor),bankAlignmentId:null});
 }
 const categoryMembers=new Map(Object.keys(G.CATEGORIES).map(category=>[category,[]]));
 for(const concept of G.CONCEPTS)categoryMembers.get(concept.category).push({nodeId:alignmentId(concept.id),role:'member'});
 for(const [category,label]of Object.entries(G.CATEGORIES)){
  const source=sourceRef({sourceId:'nabu-topic:'+category,lineageId:'nabu-bank:categories',kind:'authored-category',sourcePath:['phrases','expressions'].includes(category)?'tools/build_graph.py':'data/wordgraph-source.json',locator:'categories.'+category,recordId:category,reviewStatus:'authored-unreviewed',humanReviewed:false,attested:false});
  const id='topic:'+category;addNode({id,type:'topic',category,label,provenance:[]});nodes.get(id).provenanceRefs=[source];
  addFactor({id:'factor:'+id,type:'category-membership',semantics:'association',members:[{nodeId:id,role:'topic'},...categoryMembers.get(category)],status:'authored-unreviewed',provenanceRefs:[source],projectionOnly:true,prerequisite:false});
 }
 G.DATA.bridges.forEach(([from,to,label],index)=>{
  const origin=G.DATA.structureSourceManifest.bridgeOrigins[index];
  if(!origin)throw Error('A bridge is missing its build-time source locator.');
  const source=sourceRef({sourceId:'nabu-bridge:'+from+':'+to+':'+encodeURIComponent(label),lineageId:origin.kind==='generated-category-anchor'?'nabu-bank:category-anchors':'nabu-bank:authored-bridges',...origin,recordId:from+'>'+to+':'+label,reviewStatus:'authored-unreviewed',humanReviewed:false,attested:false});
  addFactor({id:'factor:bridge:'+from+':'+to+':'+encodeURIComponent(label),type:origin.kind==='generated-category-anchor'?'category-anchor':'authored-association',semantics:'association',members:[{nodeId:alignmentId(from),role:'endpoint-a'},{nodeId:alignmentId(to),role:'endpoint-b'}],status:'authored-unreviewed',provenanceRefs:[source],label,direction:'unspecified-association',prerequisite:false});
 });
 for(const profile of TaskMaterialData.TASK_MATERIAL_RELATIONS.profiles){
  const source=sourceRef({sourceId:'nabu-task-material:'+profile.id,lineageId:'nabu-task-material:'+profile.id,kind:'authored-task-material',sourcePath:'data/task-material-relations.json',locator:'profiles.'+profile.id,recordId:profile.id,reviewStatus:'authored-unreviewed',humanReviewed:false,attested:false});
  const id='task-profile:'+profile.id;addNode({id,type:'task-profile',purposeFamily:profile.purposeFamily,label:profile.label,provenance:[]});nodes.get(id).provenanceRefs=[source];
  for(const material of profile.materials){
   const memberSource=sourceRef({sourceId:'nabu-task-material:'+profile.id+':'+material.conceptId+':'+material.role,lineageId:'nabu-task-material:'+profile.id,kind:'authored-task-material',sourcePath:'data/task-material-relations.json',locator:'profiles.'+profile.id+'.materials.'+material.role,recordId:material.conceptId,reviewStatus:'authored-unreviewed',humanReviewed:false,attested:false});
   addFactor({id:taskFactor(profile,material),type:'task-material',semantics:'association',members:[{nodeId:id,role:'task'},{nodeId:alignmentId(material.conceptId),role:'material'}],status:'authored-unreviewed',provenanceRefs:[memberSource],purposeFamily:profile.purposeFamily,materialRole:material.role,title:material.title,taskUtility:material.taskUtility,utilityMeaning:'Existing authored policy priority, not a graph score or measured learner benefit.'});
  }
 }
 return {schemaVersion:1,id:'nabu-language-structure',version:graphVersion(),nodes:[...nodes.values()],factors:[...factors.values()],sources:[...sources.values()],capabilities:{...CAPABILITIES},issues};
}

function ready(){
 if(cache)return cache;
 const index=GraphKernel.createIncidenceIndex(createSnapshot());
 const lookup=new Map(G.LANGUAGES.map(language=>[language,new Map()]));
 for(const concept of G.CONCEPTS){
  const factor=index.getFactor(alignmentFactor(concept.id));
  const entryKeys=new Map();
  for(const member of factor.members)if(SEARCHABLE_ROLES.has(member.role)){
   const form=index.getNode(member.nodeId),key=G.normalizeWord(form.text,member.language),map=lookup.get(member.language);
   if(!map.has(key))map.set(key,[]);
   const localKey=member.language+'\u0000'+key;
   if(!entryKeys.has(localKey)){
    const entry={legacyConceptId:concept.id,matchedForms:[]};entryKeys.set(localKey,entry);map.get(key).push(entry);
   }
   entryKeys.get(localKey).matchedForms.push({id:form.id,text:form.text,role:member.role});
  }
 }
 cache={index,lookup};return cache;
}

/** Detached compact snapshot. Calling this is an explicit full export. */
export function buildStructureSnapshot(){return ready().index.snapshot();}
export function structureIndexStats(){return {...ready().index.stats(),graphVersion:graphVersion()};}

function checkedBudget(value={}){
 if(!object(value)||Object.keys(value).some(k=>!['maxFactors','maxAnswers'].includes(k)))throw Error('Unknown structural query budget.');
 const limits={maxFactors:64,maxAnswers:32,...value};
 for(const [key,maximum]of [['maxFactors',4096],['maxAnswers',256]])if(!Number.isSafeInteger(limits[key])||limits[key]<0||limits[key]>maximum)throw Error('Structural query budgets must be bounded nonnegative integers.');
 return limits;
}
const problem=(code,message,seedIndex)=>({code,message,seedIndex});
function pairSupported(seed){return G.LANGUAGES.includes(seed.sourceLang)&&G.LANGUAGES.includes(seed.targetLang)&&seed.sourceLang!==seed.targetLang;}
function factorSources(index,factorIds){return [...new Set(factorIds.flatMap(id=>index.getFactor(id).provenanceRefs))].map(id=>clone(index.getSource(id)));}
function step(factorId,fromId,fromRole,toId,toRole){return {factorId,from:{nodeId:fromId,role:fromRole},to:{nodeId:toId,role:toRole}};}
function targetMember(concept,language){return {nodeId:Structure.surfaceFormId(concept.meaningTerms?.[language]||concept.terms[language],language),role:concept.meaningTerms?'authored-meaning-rendering':'listed-term'};}
const emptyPlan=()=>({totalMatches:0,get:()=>null});

function surfaceProposals(seed,seedIndex,state,issues){
 if(!pairSupported(seed)){issues.push(problem('unsupported-language-pair','Choose two supported, different bank languages.',seedIndex));return emptyPlan();}
 if(typeof seed.text!=='string'||!seed.text.trim()||seed.text.length>1000){issues.push(problem('empty-or-invalid-surface','Choose a nonempty bounded surface.',seedIndex));return emptyPlan();}
 const key=G.normalizeWord(seed.text,seed.sourceLang),entries=state.lookup.get(seed.sourceLang).get(key)||[],inputNFC=seed.text.normalize('NFC');
 return {totalMatches:entries.length,get(index){
  const entry=entries[index],id=entry.legacyConceptId,factor=alignmentFactor(id);
  return {seedIndex,kind:'surface',legacyConceptId:id,id:'alignment:'+id+':'+seed.sourceLang+':'+seed.targetLang,factorIds:[factor],prepare(){
   const concept=G.concept(id),matches=entry.matchedForms.map(form=>({...form,exact:form.text===inputNFC}));
   const chosen=matches.find(m=>m.exact&&m.role==='listed-term')||matches.find(m=>m.exact)||matches[0],target=targetMember(concept,seed.targetLang),hub=alignmentId(id);
   return {witnessId:'witness:alignment:'+id+':'+seed.sourceLang+':'+seed.targetLang+':'+encodeURIComponent(chosen.id)+':'+chosen.role,
    witness:{nodeIds:[chosen.id,hub,target.nodeId],factorIds:[factor],steps:[step(factor,chosen.id,chosen.role,hub,'alignment'),step(factor,hub,'alignment',target.nodeId,target.role)]},
    answer:{kind:'alignment',legacyConceptId:id,alignmentId:hub,sourceLang:seed.sourceLang,targetLang:seed.targetLang,match:{input:seed.text,normalizedKey:key,matchedForms:clone(matches),exactSurface:matches.some(m=>m.exact)},translation:clone(G.translation(id,seed.sourceLang,seed.targetLang)),eligibility:Structure.candidateEligibility(id,seed.sourceLang,seed.targetLang),provenance:factorSources(state.index,[factor])}};
  }};
 }};
}

function selectedAnnotation(item,seed,seedIndex,issues){
 const suppliedSelection=Object.hasOwn(seed,'selectedText')||Object.hasOwn(seed,'selectionStart');
 if(suppliedSelection){
  const selected=seed.selectedText,text=X.sourceText(item);
  if(typeof selected!=='string'||!selected.trim()||selected.length>1000){issues.push(problem('invalid-selection','Select an exact bounded occurrence from the current source.',seedIndex));return null;}
  let start;
  if(seed.selectionStart!==undefined&&seed.selectionStart!==null){
   if(!Number.isSafeInteger(seed.selectionStart)||seed.selectionStart<0){issues.push(problem('invalid-selection','The source offset must be a nonnegative UTF-16 index.',seedIndex));return null;}
   start=seed.selectionStart;
  }else{
   start=text.indexOf(selected);
   if(start>=0&&text.indexOf(selected,start+1)!==-1){issues.push(problem('ambiguous-occurrence','Repeated source text requires its exact occurrence offset.',seedIndex));return null;}
  }
  if(start<0||text.slice(start,start+selected.length)!==selected){issues.push(problem('selection-source-mismatch','The selection no longer matches this source version.',seedIndex));return null;}
  let offset=0;
  for(const segment of item.segments){
   const found=item.annotations.find(annotation=>annotation.segmentId===segment.id&&annotation.quote===selected&&offset+X.scalarToUTF16(segment.text,annotation.start)===start);
   if(found){
    for(const [key,actual]of [['annotationId',found.id],['segmentId',found.segmentId],['start',found.start],['end',found.end],['quote',found.quote]])if(seed[key]!==undefined&&seed[key]!==actual){issues.push(problem('annotation-mismatch','The supplied annotation fields do not identify this selected occurrence.',seedIndex));return null;}
    return found;
   }
   offset+=segment.text.length+2;
  }
  return null;
 }
 if(typeof seed.annotationId==='string'){
  const annotation=item.annotations.find(a=>a.id===seed.annotationId);
  if(!annotation)return null;
  for(const [key,actual]of [['segmentId',annotation.segmentId],['start',annotation.start],['end',annotation.end],['quote',annotation.quote]])if(seed[key]!==undefined&&seed[key]!==actual){issues.push(problem('annotation-mismatch','The supplied annotation fields identify different source text.',seedIndex));return null;}
  return annotation;
 }
 if(typeof seed.segmentId==='string'&&Number.isSafeInteger(seed.start)&&Number.isSafeInteger(seed.end))return item.annotations.find(a=>a.segmentId===seed.segmentId&&a.start===seed.start&&a.end===seed.end&&(seed.quote===undefined||seed.quote===a.quote))||null;
 issues.push(problem('occurrence-required','An annotation ID or exact occurrence is required; a matching gloss does not establish a source link.',seedIndex));return null;
}

function occurrenceProposals(seed,seedIndex,state,issues){
 if(typeof seed.contentId!=='string'||!Number.isSafeInteger(seed.version)||seed.version<1){issues.push(problem('invalid-media-reference','A source reference needs its exact content ID and version.',seedIndex));return emptyPlan();}
 const item=X.itemById(seed.contentId,seed.version);
 if(!item){issues.push(problem('unknown-media','This content version is not in the current catalogue.',seedIndex));return emptyPlan();}
 // Source text anchoring is separate validation work, not counted as graph
 // incidence traversal. It is bounded by the supplied current catalogue item.
 const annotation=selectedAnnotation(item,seed,seedIndex,issues);if(!annotation)return emptyPlan();
 const factor=occurrenceFactor(item,annotation);
 return {totalMatches:1,get(){return {seedIndex,kind:'occurrence',id:'annotation:'+item.id+'@'+item.version+':'+annotation.id,factorIds:[factor],prepare(){
  const usage=occurrenceId(item,annotation),media='media:explore:'+item.id+'@'+item.version,form=Structure.surfaceFormId(annotation.quote,item.language);
  return {witnessId:'witness:occurrence:'+item.id+'@'+item.version+':'+annotation.id,
   witness:{nodeIds:[usage,media,form],factorIds:[factor],steps:[step(factor,usage,'occurrence',media,'source'),step(factor,usage,'occurrence',form,'surface')]},
   answer:{kind:'annotation',contentId:item.id,version:item.version,annotationId:annotation.id,segmentId:annotation.segmentId,annotation:clone(annotation),media:clone(item),alignmentId:null,lexemeId:null,senseId:null,eligibility:{eligible:true,code:'anchored-authored-draft',reviewStatus:'authored-unreviewed',humanReviewed:false,attested:false,automaticEvidenceTransfer:false},provenance:factorSources(state.index,[factor])}};
 }}}};
}

function taskProposals(seed,seedIndex,state,issues){
 if(!pairSupported(seed)){issues.push(problem('unsupported-language-pair','Choose two supported, different bank languages.',seedIndex));return emptyPlan();}
 const profile=TaskMaterialData.TASK_MATERIAL_RELATIONS.profiles.find(p=>p.purposeFamily===seed.purposeFamily);
 if(!profile){issues.push(problem('unknown-task-profile','No authored material relationship exists for this task profile.',seedIndex));return emptyPlan();}
 return {totalMatches:profile.materials.length,get(index){
  const material=profile.materials[index],id=material.conceptId,relation=taskFactor(profile,material),factor=alignmentFactor(id);
  return {seedIndex,kind:'task',legacyConceptId:id,id:'task-material:'+profile.id+':'+material.role+':'+id+':'+seed.sourceLang+':'+seed.targetLang,factorIds:[relation,factor],prepare(){
   const concept=G.concept(id),hub=alignmentId(id),task='task-profile:'+profile.id,source=Structure.surfaceFormId(concept.terms[seed.sourceLang],seed.sourceLang),target=targetMember(concept,seed.targetLang);
   return {witnessId:'witness:task:'+profile.id+':'+material.role+':'+id+':'+seed.sourceLang+':'+seed.targetLang,
    witness:{nodeIds:[task,hub,source,target.nodeId],factorIds:[relation,factor],steps:[step(relation,task,'task',hub,'material'),step(factor,hub,'alignment',source,'listed-term'),step(factor,hub,'alignment',target.nodeId,target.role)]},
    answer:{kind:'task-material',legacyConceptId:id,alignmentId:hub,purposeFamily:profile.purposeFamily,role:material.role,title:material.title,taskUtility:material.taskUtility,sourceLang:seed.sourceLang,targetLang:seed.targetLang,translation:clone(G.translation(id,seed.sourceLang,seed.targetLang)),eligibility:Structure.candidateEligibility(id,seed.sourceLang,seed.targetLang),provenance:factorSources(state.index,[relation,factor])}};
  }};
 }};
}

/** Query only declared relationships. Budgets never select a hidden winner. */
export function queryStructure({seeds=[],budget={}}={}){
 if(!Array.isArray(seeds)||seeds.length>16||seeds.some(seed=>!object(seed)))throw Error('Provide at most sixteen explicit structural seeds.');
 const limits=checkedBudget(budget),state=ready(),issues=[],plans=[],seedResults=[];
 for(const [seedIndex,seed]of seeds.entries()){
  const discover=seed.kind==='surface'?surfaceProposals:seed.kind==='occurrence'?occurrenceProposals:seed.kind==='task'?taskProposals:null;
  if(!discover){issues.push(problem('unsupported-seed','This structural seed type is not supported.',seedIndex));seedResults.push({kind:seed.kind||null,status:'missing',totalMatches:0});continue;}
  const plan=discover(seed,seedIndex,state,issues);plans.push(plan);
  seedResults.push({kind:seed.kind,status:seed.kind==='surface'?(plan.totalMatches>1?'ambiguous':plan.totalMatches?'single-catalogue-match':'missing'):plan.totalMatches?'matched':'missing',totalMatches:plan.totalMatches});
 }
 const answers=[],witnesses={},visited=new Set(),reasons=[],enumerated=[];
 discovery:for(const plan of plans)for(let index=0;index<plan.totalMatches;index++){
  if(answers.length>=limits.maxAnswers){reasons.push('maxAnswers');break discovery;}
  const proposal=plan.get(index);enumerated.push(proposal);
  const additional=proposal.factorIds.filter(id=>!visited.has(id));
  if(visited.size+additional.length>limits.maxFactors){reasons.push('maxFactors');break discovery;}
  for(const id of additional)visited.add(id);
  let prepared,witness;
  try{prepared=proposal.prepare();witness=state.index.witness(prepared.witness);}
  catch(error){issues.push(problem('unavailable-witness','The exact structural record could not supply a complete witness.',proposal.seedIndex));reasons.push('unavailable-witness');break discovery;}
  witnesses[prepared.witnessId]={...clone(witness),id:prepared.witnessId};
  answers.push({...prepared.answer,id:proposal.id,seedIndex:proposal.seedIndex,witnessId:prepared.witnessId});
 }
 const returned=new Set(answers.map(answer=>answer.seedIndex+'|'+answer.id));
 const unresolvedAlternatives=enumerated.filter(p=>seedResults[p.seedIndex].status==='ambiguous'||!returned.has(p.seedIndex+'|'+p.id)).map(p=>({seedIndex:p.seedIndex,id:p.id,legacyConceptId:p.legacyConceptId||null,reason:returned.has(p.seedIndex+'|'+p.id)?'unresolved-alignment-choice':'not-returned-within-budget'}));
 const totalMatches=seedResults.reduce((sum,seed)=>sum+seed.totalMatches,0);
 const totalAlternatives=seedResults.reduce((sum,seed,index)=>sum+(seed.status==='ambiguous'?seed.totalMatches:seed.totalMatches-answers.filter(answer=>answer.seedIndex===index).length),0);
 const omittedAlternativeCount=totalAlternatives-unresolvedAlternatives.length,complete=reasons.length===0&&answers.length===totalMatches;
 return {schemaVersion:STRUCTURE_QUERY_SCHEMA_VERSION,graphVersion:graphVersion(),status:seedResults.length===1?seedResults[0].status:seedResults.some(s=>s.status==='ambiguous')?'ambiguous':totalMatches?'matched':'missing',answers,witnesses,unresolvedAlternatives,omittedAlternativeCount,
  alternativeCompleteness:{complete:omittedAlternativeCount===0,totalAlternatives,returnedAlternatives:unresolvedAlternatives.length,omittedAlternativeCount},issues,
  completeness:{complete,totalMatches,returnedAnswers:answers.length,truncated:!complete,reason:reasons[0]||null,reasons:[...new Set(reasons)],work:{factors:visited.size,proposals:enumerated.length},limits,budgetScope:'Post-indexing proposal and witness discovery; source text anchor validation and bounded input normalization are separate work.'},
  seeds:seedResults,capabilities:{...CAPABILITIES}};
}

export function lookupAlignmentWitnesses({text,sourceLang,targetLang,budget={}}={}){return queryStructure({seeds:[{kind:'surface',text,sourceLang,targetLang}],budget});}
export function occurrenceWitnesses(reference={},budget={}){return queryStructure({seeds:[{...reference,kind:'occurrence'}],budget});}
export function taskMaterialWitnesses({purposeFamily,sourceLang,targetLang,budget={}}={}){return queryStructure({seeds:[{kind:'task',purposeFamily,sourceLang,targetLang}],budget});}
