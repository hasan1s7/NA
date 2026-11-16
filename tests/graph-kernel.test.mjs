import test from 'node:test';
import assert from 'node:assert/strict';
import {createIncidenceIndex,GRAPH_KERNEL_VERSION} from '../public/nabu-graph-kernel.js';

// These records exercise software semantics; none is an attested language item.
const source=(id='s1',lineageId='source-family-1')=>({sourceId:id,lineageId,locator:'synthetic-fixture:'+id,kind:'authored-fixture'});
const node=id=>({id,type:'form',text:id,language:'en'});
const association=(id='f1',members=['a','b'],extras={})=>({id,type:'alignment',semantics:'association',members:members.map(nodeId=>({nodeId,role:'member',language:'en'})),status:'authored-unreviewed',provenanceRefs:['s1'],...extras});
function graph(){return {schemaVersion:1,id:'fixture-graph',version:'fixture-v1',nodes:['a','b','c','d'].map(node),factors:[association('f1',['a','b']),association('f2',['b','c'])],sources:[source()],capabilities:{linguisticValidation:false}};}
function applicationGraph({inputs=['a','b'],outputs=['c'],status='verified',fixtureOnly=true,guards=[],competingAnalyses=[]}={}){
 const value=graph(),part=id=>({id,form:id,language:'en',features:{fixture:true}});
 value.factors=[{id:'app-factor',type:'declared-operation',semantics:'application',status,fixtureOnly,provenanceRefs:['s1'],guards,
  members:[...inputs.map(nodeId=>({nodeId,role:'input'})),...outputs.map(nodeId=>({nodeId,role:'output'}))],
  application:{id:'application-1',patternId:'fixture-operation',language:'en',inputs:inputs.map(part),outputs:outputs.map(part),features:{fixture:true},provenance:[source()],status,fixtureOnly,competingAnalyses}}];
 return value;
}
const query=(index,extra={})=>index.queryNeighborhood({seedIds:['a'],relationTypes:['alignment'],maxDepth:2,...extra});

test('incidence index retains original records and role metadata without pairwise expansion',()=>{
 const value=graph(),original=structuredClone(value),index=createIncidenceIndex(value);
 assert.equal(GRAPH_KERNEL_VERSION,'typed-incidence-v1');
 assert.equal(index.stats().nodeCount,4);assert.equal(index.stats().factorCount,2);assert.equal(index.stats().incidenceCount,4);assert.equal(index.stats().pairwiseEdgesMaterialized,0);
 assert.deepEqual(value,original);value.nodes[0].text='changed outside';assert.equal(index.getNode('a').text,'a');
 assert.throws(()=>{index.getNode('a').text='mutated';},TypeError);
 const exported=index.snapshot();exported.nodes[0].text='export edit';assert.equal(index.getNode('a').text,'a');
 assert.deepEqual(createIncidenceIndex(index.snapshot()).snapshot(),index.snapshot());
});

test('identical record IDs are idempotent; conflicting identities fail closed',()=>{
 const value=graph();value.nodes.push(structuredClone(value.nodes[0]));value.factors.push(structuredClone(value.factors[0]));value.sources.push(structuredClone(value.sources[0]));
 const index=createIncidenceIndex(value);assert.deepEqual(index.stats().duplicateRecords,{nodes:1,factors:1,sources:1});assert.equal(index.stats().incidenceCount,4);
 value.factors.at(-1).status='verified';assert.throws(()=>createIncidenceIndex(value),/Conflicting factor identity/);
});

for(const [label,change,pattern] of [
 ['missing endpoint',g=>g.factors[0].members[0].nodeId='missing',/endpoint/],
 ['unknown provenance',g=>g.factors[0].provenanceRefs=['missing'],/provenance/],
 ['unscoped source lineage',g=>delete g.sources[0].lineageId,/lineage/],
 ['implicit semantics',g=>delete g.factors[0].semantics,/semantics/],
 ['undeclared status',g=>delete g.factors[0].status,/status/],
 ['language mismatch',g=>g.factors[0].members[0].language='ar',/language/],
 ['duplicate identical port',g=>g.factors[0].members.push(structuredClone(g.factors[0].members[0])),/Duplicate/],
 ['mixed node/factor namespace',g=>g.factors[0].id='a',/namespaces/],
 ['nonfinite metadata',g=>g.nodes[0].value=NaN,/finite JSON/],
 ['object cycle',g=>g.self=g,/cycles/],
 ['function metadata',g=>g.nodes[0].score=()=>1,/finite JSON/]
])test('schema rejects '+label,()=>{const value=graph();change(value);assert.throws(()=>createIncidenceIndex(value),pattern);});

test('unknown lineage remains unattributed and never claims independence',()=>{
 const value=graph();value.sources[0].lineageId=null;const index=createIncidenceIndex(value),result=query(index);
 assert.equal(result.answers[0].witness.sourceLineageCount,0);assert.deepEqual(result.answers[0].witness.unattributedSourceRefs,['s1']);assert.equal(result.answers[0].witness.independenceEstablished,false);
});

test('multiple roles on the same surface remain distinct and inspectable',()=>{
 const value=graph();value.factors[0].members.push({nodeId:'a',role:'literal-rendering',language:'en'});const index=createIncidenceIndex(value);
 assert.equal(index.getFactor('f1').members.filter(m=>m.nodeId==='a').length,2);
 const w=index.witness({nodeIds:['a','b'],factorIds:['f1'],steps:[{factorId:'f1',from:{nodeId:'a',role:'literal-rendering'},to:{nodeId:'b',role:'member'}}]});
 assert.equal(w.steps[0].from.role,'literal-rendering');
 assert.throws(()=>index.witness({nodeIds:['a','b'],factorIds:['f1'],steps:[{factorId:'f1',from:{nodeId:'a',role:'meaning'},to:{nodeId:'b',role:'member'}}]}),/actual role/);
});

test('witnesses cannot add unused factors to inflate their provenance',()=>{
 const index=createIncidenceIndex(graph());
 assert.throws(()=>index.witness({nodeIds:['a','b'],factorIds:['f1','f2'],steps:[{factorId:'f1',from:{nodeId:'a',role:'member'},to:{nodeId:'b',role:'member'}}]}),/match/);
});

test('role positions are preserved; an underspecified port cannot choose between them',()=>{
 const value=graph();value.factors[0].members[0].position=0;value.factors[0].members.push({nodeId:'a',role:'member',language:'en',position:1});
 const index=createIncidenceIndex(value),base={nodeIds:['a','b'],factorIds:['f1'],steps:[{factorId:'f1',from:{nodeId:'a',role:'member'},to:{nodeId:'b',role:'member'}}]};
 assert.throws(()=>index.witness(base),/one actual/);base.steps[0].from={nodeId:'a',role:'member',language:'en',position:1};assert.equal(index.witness(base).steps[0].from.position,1);
 assert.equal(query(index).answers[0].witness.steps[0].from.position,0);
});

test('witness fields must survive detachment, including factor and endpoint identities',()=>{
 const index=createIncidenceIndex(graph()),make=()=>({factorId:'f1',from:{nodeId:'a',role:'member'},to:{nodeId:'b',role:'member'}});
 const variants=[];
 for(const key of ['factorId','from','to']){const step=make(),inherited=step[key];delete step[key];variants.push(Object.assign(Object.create({[key]:inherited}),step));}
 for(const key of ['nodeId','role']){const step=make(),inherited=step.from[key];delete step.from[key];step.from=Object.assign(Object.create({[key]:inherited}),step.from);variants.push(step);}
 for(const step of variants)assert.throws(()=>index.witness({nodeIds:['a','b'],factorIds:['f1'],steps:[step]}));
});

test('two claims with the same source lineage retain two claims and one lineage',()=>{
 const value=graph();value.sources.push(source('s2'));value.factors[1].provenanceRefs=['s2'];
 const result=query(createIncidenceIndex(value)),w=result.answers.find(a=>a.nodeId==='c').witness;
 assert.deepEqual(w.factorIds,['f1','f2']);assert.deepEqual(w.provenanceRefs,['s1','s2']);assert.equal(w.sourceLineageCount,1);assert.equal(w.independenceEstablished,false);assert.equal(w.automaticEvidenceTransfer,false);
});

test('association query is deterministic under record permutations and cycles',()=>{
 const value=graph();value.factors.push(association('f3',['c','a']));const index=createIncidenceIndex(value),expected=query(index);
 const shuffled=structuredClone(value);shuffled.nodes.reverse();shuffled.factors.reverse();shuffled.sources.reverse();for(const f of shuffled.factors)f.members.reverse();
 assert.deepEqual(query(createIncidenceIndex(shuffled)),expected);assert.deepEqual(expected.answers.map(x=>x.nodeId).sort(),['b','c']);
 assert.equal(expected.completeness.complete,true);assert.equal(expected.answers.every(a=>a.witness.automaticEvidenceTransfer===false),true);
});

test('relation policy and depth are explicit; connectivity is not a prerequisite',()=>{
 const index=createIncidenceIndex(graph());
 assert.deepEqual(index.queryNeighborhood({seedIds:['a']}).answers,[]);
 assert.deepEqual(query(index,{maxDepth:1}).answers.map(x=>x.nodeId),['b']);
 assert.equal(query(index,{maxDepth:1}).completeness.complete,true);
 assert.match(query(index).interpretation,/not a composed linguistic implication/);
});

test('unknown seeds are reported without fabricating a node',()=>{
 const result=query(createIncidenceIndex(graph()),{seedIds:['absent']});assert.deepEqual(result.answers,[]);assert.equal(result.issues[0].code,'unknown-seed');
});

for(const [key,value] of [['maxFactors',0],['maxIncidences',0],['maxNodes',1],['maxAnswers',0]])test(key+' stops work with an explicit incomplete result',()=>{
 const result=query(createIncidenceIndex(graph()),{budget:{[key]:value}});
 assert.equal(result.completeness.complete,false);assert.equal(result.completeness.truncated,true);assert(result.completeness.reasons.includes(key));
 assert(result.completeness.work.factors<=result.completeness.limits.maxFactors);assert(result.completeness.work.incidences<=result.completeness.limits.maxIncidences);assert(result.completeness.work.nodes<=result.completeness.limits.maxNodes);assert(result.answers.length<=result.completeness.limits.maxAnswers);
});

test('finishing exactly at a work limit remains complete',()=>{
 const index=createIncidenceIndex(graph()),result=query(index,{maxDepth:1,budget:{maxFactors:1,maxIncidences:2,maxNodes:2,maxAnswers:1}});
 assert.equal(result.completeness.complete,true);assert.deepEqual(result.answers.map(x=>x.nodeId),['b']);
});

test('irrelevant high-degree topic associations are not scanned by a typed query',()=>{
 const small=createIncidenceIndex(graph()),expanded=graph();
 for(let i=0;i<1000;i++){const id='noise-'+i;expanded.nodes.push(node(id));expanded.factors.push(association('noise-factor-'+i,['a',id],{type:'topic'}));}
 const index=createIncidenceIndex(expanded),expected=query(small),actual=query(index);
 assert.deepEqual(actual.completeness.work,expected.completeness.work);assert.deepEqual(actual.answers,expected.answers);
 assert.equal(index.incident('a',{relationTypes:['alignment']}).length,1);assert.equal(index.incident('a').length,1001);
});

test('one huge allowed factor is read only to the incidence budget',()=>{
 const value=graph();value.nodes=Array.from({length:10000},(_,i)=>node('n'+String(i).padStart(5,'0')));value.factors=[association('wide',value.nodes.map(n=>n.id))];
 const result=query(createIncidenceIndex(value),{seedIds:['n09999'],budget:{maxIncidences:3}});
 assert.equal(result.completeness.work.incidences,3);assert.equal(result.completeness.truncated,true);assert.equal(result.answers.length,3);
});

test('a bounded answer resolves its complete positional port without ambiguous partial matching',()=>{
 const value=graph();value.factors=[association('wide',['b'])];
 for(let position=0;position<10000;position++)value.factors[0].members.push({nodeId:'a',role:'member',language:'en',position});
 const index=createIncidenceIndex(value),result=query(index,{seedIds:['b'],budget:{maxIncidences:1,maxAnswers:1}});
 assert.equal(result.completeness.work.incidences,1);assert.equal(result.answers.length,1);assert.equal(result.answers[0].nodeId,'a');assert.equal(typeof result.answers[0].witness.steps[0].to.position,'number');
 assert.throws(()=>index.witness({nodeIds:['a','b'],factorIds:['wide'],steps:[{factorId:'wide',from:{nodeId:'b',role:'member'},to:{nodeId:'a',role:'member'}}]}),/complete port/);
});

for(const status of ['quarantined','needs_verification','generated','unknown'])test(status+' factors remain traceable but are not traversed',()=>{
 const value=graph();value.factors[0].status=status;const index=createIncidenceIndex(value),result=query(index);
 assert.deepEqual(result.answers,[]);assert.equal(result.issues[0].code,'factor-unavailable');
 assert.equal(index.witness({nodeIds:['a','b'],factorIds:['f1'],steps:[{factorId:'f1',from:{nodeId:'a',role:'member'},to:{nodeId:'b',role:'member'}}]}).claimStatuses[0],status);
});

test('fixture associations require explicit opt-in',()=>{
 const value=graph();value.factors[0].fixtureOnly=true;const index=createIncidenceIndex(value);
 assert.equal(query(index).answers.length,0);assert.equal(query(index,{includeFixtures:true}).answers.length,2);
});

test('whole applications require every input, unlike a lossy unary projection',()=>{
 const joint=createIncidenceIndex(applicationGraph()),unary=createIncidenceIndex(applicationGraph({inputs:['a']})),options={availableNodeIds:['a'],includeFixtures:true};
 assert.equal(joint.assessApplication('app-factor',options).availability,'missing-inputs');assert.deepEqual(joint.assessApplication('app-factor',options).missingInputIds,['b']);
 assert.equal(unary.assessApplication('app-factor',options).availability,'available');
 const satisfied=joint.assessApplication('app-factor',{...options,availableNodeIds:['a','b']});
 assert.equal(satisfied.availability,'available');assert.deepEqual(satisfied.witness.inputIds,['a','b']);assert.equal(satisfied.linguisticCorrectness,'not-checked');assert.equal(satisfied.automaticEvidenceTransfer,false);
 assert.match(satisfied.interpretation,/not unknown to a learner/);
});

test('application outputs are never unlocked through association traversal',()=>{
 const result=createIncidenceIndex(applicationGraph()).queryNeighborhood({seedIds:['a'],relationTypes:['declared-operation'],includeFixtures:true,maxDepth:8});
 assert.deepEqual(result.answers,[]);assert.equal(result.issues[0].code,'application-requires-all-inputs');
});

test('an overlapping application cannot borrow another factor input',()=>{
 const value=applicationGraph();const extra=applicationGraph({inputs:['d'],outputs:['c']}).factors[0];extra.id='another-factor';extra.application.id='another-application';value.factors.push(extra);
 const index=createIncidenceIndex(value),options={availableNodeIds:['a','d'],includeFixtures:true};
 assert.equal(index.assessApplication('app-factor',options).availability,'missing-inputs');assert.equal(index.assessApplication('another-factor',options).availability,'available');
});

test('missing context stays unknown; a contradictory context is different',()=>{
 const index=createIncidenceIndex(applicationGraph({guards:[{key:'register',value:'formal'}]})),base={availableNodeIds:['a','b'],includeFixtures:true};
 assert.equal(index.assessApplication('app-factor',base).availability,'context-unknown');
 assert.equal(index.assessApplication('app-factor',{...base,context:{register:null}}).availability,'context-unknown');
 assert.equal(index.assessApplication('app-factor',{...base,context:{register:'informal'}}).availability,'context-mismatch');
 assert.equal(index.assessApplication('app-factor',{...base,context:{register:'formal'}}).availability,'available');
});

test('unresolved competing analyses are preserved and do not select an output',()=>{
 const alternative=applicationGraph({inputs:['d'],outputs:['c']}).factors[0].application;alternative.id='alternative-analysis';delete alternative.competingAnalyses;
 const value=applicationGraph({competingAnalyses:[alternative]}),index=createIncidenceIndex(value),result=index.assessApplication('app-factor',{availableNodeIds:['a','b','d'],includeFixtures:true});
 assert.equal(result.availability,'unresolved-analysis');assert.equal(result.witness,null);assert.deepEqual(result.competingAnalysisIds,['alternative-analysis']);assert.deepEqual(index.getFactor('app-factor').application.competingAnalyses,[alternative]);
});

test('authored applications and fixture status each require explicit permission',()=>{
 const index=createIncidenceIndex(applicationGraph({status:'authored-unreviewed'})),base={availableNodeIds:['a','b']};
 assert.equal(index.assessApplication('app-factor',base).availability,'blocked');
 assert.equal(index.assessApplication('app-factor',{...base,allowAuthored:true}).availability,'blocked');
 assert.equal(index.assessApplication('app-factor',{...base,includeFixtures:true}).availability,'blocked');
 assert.equal(index.assessApplication('app-factor',{...base,includeFixtures:true,allowAuthored:true}).availability,'available');
});

test('quarantine cannot be bypassed by verified status or a declared dictionary listing',()=>{
 const value=applicationGraph();value.factors[0].application.quarantine={id:'suspect-row'};value.factors[0].application.dictionaryListed=true;
 const result=createIncidenceIndex(value).assessApplication('app-factor',{availableNodeIds:['a','b'],includeFixtures:true,allowAuthored:true});
 assert.equal(result.availability,'blocked');assert(result.blockedReasons.includes('quarantined-source-record'));
});

for(const [label,change] of [
 ['missing whole payload',g=>delete g.factors[0].application],
 ['missing context declaration',g=>delete g.factors[0].guards],
 ['missing required port',g=>g.factors[0].members.splice(0,1)],
 ['repeated input instead of the other required port',g=>{g.factors[0].members[0].position=0;g.factors[0].members[1]={nodeId:'a',role:'input',position:1};}],
 ['changed input surface',g=>g.factors[0].application.inputs[0].form='fabricated'],
 ['changed input language',g=>g.factors[0].application.inputs[0].language='ar'],
 ['missing input features',g=>delete g.factors[0].application.inputs[0].features],
 ['missing input form on both part and node',g=>{delete g.factors[0].application.inputs[0].form;delete g.nodes[0].text;}],
 ['missing input language on both part and node',g=>{delete g.factors[0].application.inputs[0].language;delete g.nodes[0].language;}],
 ['missing output form on both part and node',g=>{delete g.factors[0].application.outputs[0].form;delete g.nodes[2].text;}],
 ['incomplete competing analysis',g=>g.factors[0].application.competingAnalyses=[{id:'alternative'}]]
])test('application binding rejects '+label,()=>{const value=applicationGraph();change(value);assert.throws(()=>createIncidenceIndex(value));});

test('kernel refuses learner-state fields and invalid query budget options',()=>{
 const index=createIncidenceIndex(graph());
 assert.throws(()=>index.queryNeighborhood({seedIds:['a'],cards:[]}),/Unknown/);
 assert.throws(()=>query(index,{budget:{maxFactors:Infinity}}),/bound/);
 assert.throws(()=>query(index,{budget:{extra:1}}),/Unknown/);
 assert.throws(()=>query(index,{maxDepth:99}),/bound/);
 assert.throws(()=>createIncidenceIndex(applicationGraph()).assessApplication('app-factor',{competence:1}),/Unknown/);
});

test('all graph queries leave the structural snapshot unchanged',()=>{
 const index=createIncidenceIndex(graph()),before=index.snapshot();query(index);query(index,{budget:{maxAnswers:0}});index.incident('b');assert.deepEqual(index.snapshot(),before);
});
