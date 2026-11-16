/**
 * Pure incidence-graph mechanics. Public linguistic declarations enter here;
 * learner histories, observation likelihoods and intervention scores do not.
 * Association traversal discovers records. Only assessApplication evaluates
 * all the explicitly declared inputs of one complete application.
 */
export const GRAPH_KERNEL_VERSION = 'typed-incidence-v1';
export const GRAPH_QUERY_DEFAULT_BUDGET = Object.freeze({maxFactors:64,maxIncidences:512,maxNodes:256,maxAnswers:64});

const STATUSES = new Set(['authored-unreviewed','verified','quarantined','needs_verification','generated','unknown']);
const ASSOCIATION_STATUSES = new Set(['authored-unreviewed','verified']);
const own = (value,key) => Object.prototype.hasOwnProperty.call(value,key);
const plain = value => !!value && typeof value==='object' && !Array.isArray(value) && Object.prototype.toString.call(value)==='[object Object]';
const text = (value,name,max=65536) => {
 if(typeof value!=='string'||!value.trim()||value.length>max||/[\u0000-\u001f\u007f]/u.test(value))throw Error(name+' must be nonempty bounded text.');
 return value;
};
const integer = (value,name,min,max) => {
 if(!Number.isSafeInteger(value)||value<min||value>max)throw Error(name+' is outside its integer bound.');
 return value;
};
function jsonValue(value,depth=0,stack=new Set()){
 if(depth>24)throw Error('Graph metadata nesting is too deep.');
 if(value===null||typeof value==='boolean'||typeof value==='string')return;
 if(typeof value==='number'&&Number.isFinite(value))return;
 if(!Array.isArray(value)&&!plain(value))throw Error('Graph records must contain finite JSON values.');
 if(stack.has(value))throw Error('Graph metadata cannot contain object cycles.');
 stack.add(value);for(const v of Object.values(value))jsonValue(v,depth+1,stack);stack.delete(value);
}
function canonical(value){
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 if(plain(value))return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
 return JSON.stringify(value);
}
function freeze(value){
 if(value&&typeof value==='object'){Object.freeze(value);for(const v of Object.values(value))freeze(v);}return value;
}
const sortedUnique = values => [...new Set(values)].sort();
const compare = (a,b) => a<b?-1:a>b?1:0;
function boundedIds(value,name,max=1000000){
 if(!Array.isArray(value)||value.length>max)throw Error(name+' must be a bounded array.');
 return sortedUnique(value.map(v=>text(v,name+' identifier')));
}
function recordMap(rows,key,name,limit){
 if(!Array.isArray(rows)||rows.length>limit)throw Error(name+' must be a bounded record array.');
 const map=new Map();let duplicates=0;
 for(const row of rows){
  if(!plain(row))throw Error(name+' needs object records.');
  const id=text(row[key],name+' identity');
  if(map.has(id)){
   if(canonical(map.get(id))!==canonical(row))throw Error('Conflicting '+name+' identity: '+id);
   duplicates++;continue;
  }
  map.set(id,row);
 }
 return {map:new Map([...map].sort(([a],[b])=>a<b?-1:a>b?1:0)),duplicates};
}
function checkApplicationBinding(factor,nodes){
 const app=factor.application;
 if(!plain(app)||!Array.isArray(app.inputs)||!app.inputs.length||!Array.isArray(app.outputs)||!app.outputs.length||!plain(app.features)||!Array.isArray(app.provenance)||!app.provenance.length||!Array.isArray(app.competingAnalyses)||typeof app.fixtureOnly!=='boolean'||!STATUSES.has(app.status))throw Error('Application factors must retain a complete declared application.');
 text(app.id,'Application ID');text(app.patternId,'Pattern ID');text(app.language,'Application language',100);
 if(app.competingAnalyses.length>20)throw Error('Too many competing application analyses.');
 const analysisIds=new Set([app.id]);
 for(const alt of app.competingAnalyses){
  if(!plain(alt)||!plain(alt.features)||!Array.isArray(alt.provenance)||!alt.provenance.length)throw Error('Competing analyses must retain their full application records.');
  text(alt.id,'Competing analysis ID');text(alt.patternId,'Competing pattern ID');text(alt.language,'Competing language',100);
  if(analysisIds.has(alt.id))throw Error('Competing analysis identities must be distinct.');analysisIds.add(alt.id);
  for(const key of ['inputs','outputs']){
   if(!Array.isArray(alt[key])||!alt[key].length||alt[key].length>32)throw Error('Competing analyses need full inputs and outputs.');
   const ids=new Set();
   for(const part of alt[key]){
    if(!plain(part)||!plain(part.features))throw Error('Competing parts need complete features.');
    text(part.id,'Competing part ID');text(part.form,'Competing form');text(part.language,'Competing form language',100);
    if(ids.has(part.id))throw Error('Duplicate competing part identity.');ids.add(part.id);
   }
  }
 }
 for(const [key,role] of [['inputs','input'],['outputs','output']]){
  const parts=app[key];if(parts.length>32)throw Error('A declared application has too many '+key+'.');
  const ids=new Set();
  for(const part of parts){
   if(!plain(part)||!plain(part.features))throw Error('Each application part needs its full features.');
   text(part.form,'Application part form');text(part.language,'Application part language',100);
   const id=text(part.id,'Application part ID'),node=nodes.get(id);
   if(ids.has(id)||!node||node.text!==part.form||node.language!==part.language)throw Error('Application part identity, form or language does not match its node.');
   ids.add(id);
  }
  const ports=factor.members.filter(m=>m.role===role);
  if(ports.length!==ids.size||new Set(ports.map(p=>p.nodeId)).size!==ids.size||ports.some(p=>!ids.has(p.nodeId)))throw Error('Application '+key+' must match all corresponding incidence ports.');
 }
 if(!Array.isArray(factor.guards)||factor.guards.length>40)throw Error('An application must explicitly declare its contextual guards.');
 const keys=new Set();
 for(const guard of factor.guards){
  if(!plain(guard)||Object.keys(guard).some(k=>!['key','value'].includes(k)))throw Error('A context guard needs only key and value.');
  text(guard.key,'Guard key',100);
  if(keys.has(guard.key)||guard.value===null||!['string','number','boolean'].includes(typeof guard.value))throw Error('Guard values must be explicit scalar constraints with unique keys.');
  keys.add(guard.key);
 }
}
function budgetFor(value={}){
 if(!plain(value)||Object.keys(value).some(k=>!own(GRAPH_QUERY_DEFAULT_BUDGET,k)))throw Error('Unknown graph query budget.');
 const limits={...GRAPH_QUERY_DEFAULT_BUDGET,...value};
 for(const [key,v] of Object.entries(limits))integer(v,key,0,key==='maxIncidences'?1000000:100000);
 return limits;
}
function countBy(rows,key){
 const result=Object.create(null);for(const row of rows)result[row[key]]=(result[row[key]]||0)+1;return result;
}

/**
 * Indexing retains complete factors and roles; it does not build clique edges.
 * Record validation is proportional to supplied metadata. Deterministic ID and
 * adjacency ordering adds sorting costs; no pairwise projection is allocated.
 */
export function createIncidenceIndex(input){
 if(!plain(input))throw Error('Expected incidence schema version 1.');
 let value;try{value=structuredClone(input);}catch{throw Error('Graph records must contain finite JSON values.');}
 if(value.schemaVersion!==1)throw Error('Expected incidence schema version 1.');
 text(value.id,'Graph ID',500);text(value.version,'Graph version',2000);jsonValue(value);
 const nr=recordMap(value.nodes,'id','node',1000000),fr=recordMap(value.factors,'id','factor',1000000),sr=recordMap(value.sources,'sourceId','source',1000000);
 const nodes=nr.map,factors=fr.map,sources=sr.map,adj=new Map(),typedAdj=new Map(),ports=new Map(),orderedMembers=new Map(),exactPorts=new Map(),uniqueRolePorts=new Map();
 let incidenceCount=0;
 for(const node of nodes.values()){
  text(node.type,'Node type',100);adj.set(node.id,[]);typedAdj.set(node.id,new Map());
  for(const ref of node.provenanceRefs||[])if(!sources.has(ref))throw Error('Unknown node provenance reference.');
 }
 for(const source of sources.values()){
  if(source.lineageId!==null)text(source.lineageId,'Source lineage');
  text(source.locator,'Source locator');text(source.kind,'Source kind',200);
 }
 for(const factor of factors.values()){
  if(nodes.has(factor.id))throw Error('Node and factor identity namespaces must be distinct.');
  text(factor.type,'Factor type',100);
  if(!['association','application'].includes(factor.semantics)||!STATUSES.has(factor.status))throw Error('Declare factor semantics and review status.');
  if(own(factor,'fixtureOnly')&&typeof factor.fixtureOnly!=='boolean')throw Error('fixtureOnly must be boolean.');
  if(!Array.isArray(factor.members)||!factor.members.length||factor.members.length>1000000)throw Error('Factors need bounded role-bearing members.');
  if(!Array.isArray(factor.provenanceRefs)||!factor.provenanceRefs.length||factor.provenanceRefs.length>256||factor.provenanceRefs.some(ref=>!sources.has(ref)))throw Error('Factors need known provenance references.');
  factor.provenanceRefs=sortedUnique(factor.provenanceRefs);
  const local=new Map(),exact=new Map(),byRole=new Map();
  for(const member of factor.members){
   if(!plain(member)||!nodes.has(member.nodeId))throw Error('Every incidence endpoint must be a declared node.');
   text(member.role,'Incidence role',100);
   if(own(member,'language')&&member.language!==nodes.get(member.nodeId).language)throw Error('Incidence language must match its node.');
   const identity=canonical(member);if(exact.has(identity))throw Error('Duplicate identical incidence port.');exact.set(identity,member);
   if(!local.has(member.nodeId))local.set(member.nodeId,[]);local.get(member.nodeId).push(member);
   if(!byRole.has(member.nodeId))byRole.set(member.nodeId,new Map());
   const roles=byRole.get(member.nodeId);roles.set(member.role,roles.has(member.role)?null:member);
   if(++incidenceCount>8000000)throw Error('Incidence size limit exceeded.');
  }
  if(factor.semantics==='application')checkApplicationBinding(factor,nodes);
  const ordered=[...factor.members].sort((a,b)=>compare(canonical(a),canonical(b)));
  orderedMembers.set(factor.id,ordered);ports.set(factor.id,local);exactPorts.set(factor.id,exact);uniqueRolePorts.set(factor.id,byRole);
  for(const id of local.keys()){
   adj.get(id).push(factor.id);
   const byType=typedAdj.get(id);if(!byType.has(factor.type))byType.set(factor.type,[]);byType.get(factor.type).push(factor.id);
   local.get(id).sort((a,b)=>compare(canonical(a),canonical(b)));
  }
 }
 // Factors were visited in canonical ID order, so adjacency lists are sorted.
 for(const ids of adj.values())Object.freeze(ids);
 for(const groups of typedAdj.values())for(const ids of groups.values())Object.freeze(ids);
 value.nodes=[...nodes.values()];value.factors=[...factors.values()];value.sources=[...sources.values()];freeze(value);
 const stats=freeze({schemaVersion:1,graphId:value.id,graphVersion:value.version,nodeCount:nodes.size,factorCount:factors.size,sourceCount:sources.size,incidenceCount,nodeTypes:countBy(nodes.values(),'type'),factorTypes:countBy(factors.values(),'type'),semantics:countBy(factors.values(),'semantics'),duplicateRecords:{nodes:nr.duplicates,factors:fr.duplicates,sources:sr.duplicates},pairwiseEdgesMaterialized:0});
 const empty=Object.freeze([]);

 function witness({nodeIds=[],factorIds=[],steps=[]}={}){
  const declaredNodes=boundedIds(nodeIds,'Witness nodes',10000),declaredFactors=boundedIds(factorIds,'Witness factors',10000);
  if(declaredNodes.some(id=>!nodes.has(id))||declaredFactors.some(id=>!factors.has(id)))throw Error('Unknown witness record.');
  if(!Array.isArray(steps)||steps.length>10000)throw Error('Witness steps must be bounded.');
  // Validate the exact detached JSON that will be returned. Inherited fields
  // cannot validate successfully and then vanish from the audit certificate.
  const detachedSteps=structuredClone(steps);jsonValue(detachedSteps);
  const usedFactors=new Set(),usedNodes=new Set();
  for(const step of detachedSteps){
   if(!plain(step)||!own(step,'factorId')||!own(step,'from')||!own(step,'to')||!factors.has(step.factorId))throw Error('Unknown witness factor or endpoint.');
   usedFactors.add(step.factorId);
   for(const side of ['from','to']){
    const port=step[side];
    if(!plain(port)||!own(port,'nodeId')||!own(port,'role')||typeof port.role!=='string')throw Error('Witness step is not an actual role-bearing incidence.');
    const exact=exactPorts.get(step.factorId).get(canonical(port));
    const unique=uniqueRolePorts.get(step.factorId).get(port.nodeId)?.get(port.role);
    // Full ports take an indexed lookup. A partial node/role description is
    // accepted only for a unique role port; otherwise supply the full port.
    // Never scan every positional incidence to validate one bounded answer.
    if(!exact&&(!unique||!Object.keys(port).every(key=>own(unique,key)&&canonical(unique[key])===canonical(port[key]))))throw Error('Witness step must identify one actual role-bearing incidence; ambiguous roles require the complete port.');
    usedNodes.add(port.nodeId);
   }
  }
  if(canonical(declaredFactors)!==canonical([...usedFactors].sort())||[...usedNodes].some(id=>!declaredNodes.includes(id)))throw Error('Witness declarations must match their used factors and endpoints.');
  const provenanceRefs=sortedUnique(declaredFactors.flatMap(id=>factors.get(id).provenanceRefs));
  const sourceLineageIds=sortedUnique(provenanceRefs.map(id=>sources.get(id).lineageId).filter(id=>id!==null));
  return freeze({status:'recorded-structure',graphId:value.id,graphVersion:value.version,nodeIds:declaredNodes,factorIds:declaredFactors,steps:detachedSteps,provenanceRefs,sourceLineageIds,sourceLineageCount:sourceLineageIds.length,unattributedSourceRefs:provenanceRefs.filter(id=>sources.get(id).lineageId===null),claimStatuses:sortedUnique(declaredFactors.map(id=>factors.get(id).status)),independenceEstablished:false,automaticEvidenceTransfer:false});
 }

 function incident(id,{relationTypes=null}={}){
  if(relationTypes===null)return adj.get(id)||empty;
  const types=boundedIds(relationTypes,'Relation types',32),result=[];
  for(const type of types)for(const factorRef of typedAdj.get(id)?.get(type)||[])result.push(factorRef);
  return Object.freeze(sortedUnique(result));
 }
 // Merge pre-indexed type lists lazily. Irrelevant relation types are never
 // scanned, and a high-degree allowed relation is consumed only to its budget.
 function* allowedFactors(id,types){
  const lists=types.map(type=>typedAdj.get(id)?.get(type)||empty),positions=lists.map(()=>0);let previous=null;
  while(true){
   let selected=-1,next=null;
   for(let i=0;i<lists.length;i++){const candidate=lists[i][positions[i]];if(candidate!==undefined&&(next===null||candidate<next)){selected=i;next=candidate;}}
   if(selected<0)return;positions[selected]++;if(next===previous)continue;previous=next;yield next;
  }
 }

 function queryNeighborhood(options={}){
  if(!plain(options)||Object.keys(options).some(k=>!['seedIds','relationTypes','maxDepth','budget','includeFixtures'].includes(k)))throw Error('Unknown neighborhood query option.');
  const seeds=boundedIds(options.seedIds||[],'Query seeds',100),types=boundedIds(options.relationTypes||[],'Relation types',32),maxDepth=integer(options.maxDepth??1,'maxDepth',0,8),limits=budgetFor(options.budget);
  if(own(options,'includeFixtures')&&typeof options.includeFixtures!=='boolean')throw Error('includeFixtures must be boolean.');
  const work={factors:0,incidences:0,nodes:0},issues=[],reasons=new Set(),answers=[],visited=new Set(),examined=new Set(),queue=[],seedSet=new Set(seeds);
  for(const id of seeds){
   if(!nodes.has(id)){issues.push({code:'unknown-seed',nodeId:id});continue;}
   if(work.nodes>=limits.maxNodes){reasons.add('maxNodes');break;}
   visited.add(id);work.nodes++;queue.push({nodeId:id,depth:0,nodeIds:[id],factorIds:[],steps:[]});
  }
  outer:for(let q=0;q<queue.length;q++){
   const current=queue[q];if(current.depth>=maxDepth)continue;
   for(const factorId of allowedFactors(current.nodeId,types)){
    if(examined.has(factorId))continue;
    if(work.factors>=limits.maxFactors){reasons.add('maxFactors');break outer;}
    examined.add(factorId);work.factors++;const factor=factors.get(factorId);
    if(factor.semantics==='application'){issues.push({code:'application-requires-all-inputs',factorId});continue;}
    if(!ASSOCIATION_STATUSES.has(factor.status)||factor.quarantine){issues.push({code:'factor-unavailable',factorId,status:factor.status});continue;}
    if(factor.fixtureOnly&&!options.includeFixtures){issues.push({code:'fixture-excluded',factorId});continue;}
    const from=ports.get(factorId).get(current.nodeId)[0];
    for(const member of orderedMembers.get(factorId)){
     if(work.incidences>=limits.maxIncidences){reasons.add('maxIncidences');break outer;}work.incidences++;
     if(visited.has(member.nodeId))continue;
     if(work.nodes>=limits.maxNodes){reasons.add('maxNodes');break outer;}
     if(!seedSet.has(member.nodeId)&&answers.length>=limits.maxAnswers){reasons.add('maxAnswers');break outer;}
     visited.add(member.nodeId);work.nodes++;
     const next={nodeId:member.nodeId,depth:current.depth+1,nodeIds:sortedUnique([...current.nodeIds,member.nodeId]),factorIds:sortedUnique([...current.factorIds,factorId]),steps:[...current.steps,{factorId,from:structuredClone(from),to:structuredClone(member)}]};
     queue.push(next);
     if(!seedSet.has(member.nodeId))answers.push({nodeId:member.nodeId,witness:witness(next)});
    }
   }
  }
  return freeze({schemaVersion:1,graphVersion:value.version,answers,issues,completeness:{complete:reasons.size===0,truncated:reasons.size>0,reasons:[...reasons].sort(),work,limits},scope:{seedIds:seeds,relationTypes:types,maxDepth,semantics:'association',reviewStatuses:[...ASSOCIATION_STATUSES],includeFixtures:!!options.includeFixtures},interpretation:'Record discovery within this explicit relation/depth policy; not a composed linguistic implication or learner inference.',automaticEvidenceTransfer:false});
 }

 function assessApplication(factorId,options={}){
  if(!plain(options)||Object.keys(options).some(k=>!['availableNodeIds','context','includeFixtures','allowAuthored'].includes(k)))throw Error('Unknown application query option.');
  const factor=factors.get(factorId);if(!factor||factor.semantics!=='application')throw Error('Choose a declared whole application.');
  const available=new Set(boundedIds(options.availableNodeIds||[],'Available structural inputs')),context=options.context??{};
  if(!plain(context)||Object.keys(context).length>40)throw Error('Application context must be a bounded object.');jsonValue(context);
  for(const key of ['includeFixtures','allowAuthored'])if(own(options,key)&&typeof options[key]!=='boolean')throw Error(key+' must be boolean.');
  const app=factor.application,inputIds=app.inputs.map(p=>p.id),outputIds=app.outputs.map(p=>p.id),missingInputIds=inputIds.filter(id=>!available.has(id));
  const guardResults=factor.guards.map(g=>({key:g.key,expected:g.value,actual:own(context,g.key)?context[g.key]:null,state:!own(context,g.key)||context[g.key]===null?'unknown':context[g.key]===g.value?'satisfied':'mismatch'}));
  const blockedReasons=[];
  if(factor.quarantine||app.quarantine)blockedReasons.push('quarantined-source-record');
  for(const [name,status] of [['factor',factor.status],['application',app.status]])if(status!=='verified'&&!(status==='authored-unreviewed'&&options.allowAuthored))blockedReasons.push(name+'-status:'+status);
  if((factor.fixtureOnly||app.fixtureOnly)&&!options.includeFixtures)blockedReasons.push('fixture-excluded');
  let availability=blockedReasons.length?'blocked':app.competingAnalyses.length?'unresolved-analysis':guardResults.some(g=>g.state==='mismatch')?'context-mismatch':guardResults.some(g=>g.state==='unknown')?'context-unknown':missingInputIds.length?'missing-inputs':'available';
  const applicationWitness=availability==='available'?freeze({graphVersion:value.version,factorId,applicationId:app.id,patternId:app.patternId,inputIds:[...inputIds],outputIds:[...outputIds],features:structuredClone(app.features),guardResults:structuredClone(guardResults),provenanceRefs:[...factor.provenanceRefs],sourceLineageIds:sortedUnique(factor.provenanceRefs.map(id=>sources.get(id).lineageId).filter(x=>x!==null)),independenceEstablished:false,automaticEvidenceTransfer:false}):null;
  return freeze({schemaVersion:1,graphVersion:value.version,factorId,applicationId:app.id,availability,missingInputIds,guardResults,blockedReasons,competingAnalysisIds:app.competingAnalyses.map(a=>a.id),witness:applicationWitness,linguisticCorrectness:'not-checked',interpretation:'Availability under supplied structural inputs and declared guards; missing input means not supplied to this query, not unknown to a learner.',automaticEvidenceTransfer:false});
 }

 return Object.freeze({getNode:id=>nodes.get(id)||null,getFactor:id=>factors.get(id)||null,getSource:id=>sources.get(id)||null,incident,stats:()=>stats,snapshot:()=>structuredClone(value),witness,queryNeighborhood,assessApplication});
}
