import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as G from '../public/nabu-graph.js';
import * as X from '../public/nabu-content.js';
import * as Structure from '../public/nabu-structure.js';
import * as Query from '../public/nabu-structure-query.js';
import * as TaskMaterialData from '../public/nabu-task-material-data.js';

const lookup=(text,sourceLang='en',targetLang='es',budget={})=>Query.lookupAlignmentWitnesses({text,sourceLang,targetLang,budget});
const witnessFor=(result,answer=result.answers[0])=>result.witnesses[answer.witnessId];
const readJSON=path=>JSON.parse(fs.readFileSync(new URL(path,import.meta.url),'utf8'));

test('generated task relations and graph source manifest match their inspectable inputs',()=>{
 assert.deepEqual(TaskMaterialData.TASK_MATERIAL_RELATIONS,readJSON('../data/task-material-relations.json'));
 const manifest=G.DATA.structureSourceManifest;
 for(const source of manifest.sources){
  const bytes=fs.readFileSync(new URL('../'+source.path,import.meta.url));
  assert.equal(source.sha256,crypto.createHash('sha256').update(bytes).digest('hex'),source.path);
 }
 assert.equal(manifest.bridgeOrigins.length,G.DATA.bridges.length);
 assert(Query.graphVersion().includes(manifest.sha256));
});

test('snapshot closes every typed endpoint and interns traceable provenance',()=>{
 const graph=Query.buildStructureSnapshot(),nodes=new Map(graph.nodes.map(n=>[n.id,n])),sources=new Map(graph.sources.map(s=>[s.sourceId,s]));
 assert.equal(graph.schemaVersion,1);assert.equal(graph.version,Query.graphVersion());
 assert.equal(nodes.size,graph.nodes.length);assert.equal(sources.size,graph.sources.length);
 assert.equal(new Set(graph.factors.map(f=>f.id)).size,graph.factors.length);
 for(const node of graph.nodes){
  assert(!Object.hasOwn(node,'provenance'));
  for(const id of node.provenanceRefs)assert(sources.has(id),id);
  if(node.type==='form'){assert.equal(node.id,Structure.surfaceFormId(node.text,node.language));assert.equal(node.lexemeId,null);}
  if(node.type==='alignment'){assert.equal(node.lexemeId,null);assert.equal(node.senseId,null);assert(G.concept(node.legacyConceptId));}
 }
 for(const factor of graph.factors){
  assert.equal(factor.semantics,'association');assert.equal(factor.automaticEvidenceTransfer,false);
  assert(factor.provenanceRefs.length>0);
  for(const id of factor.provenanceRefs)assert(sources.has(id),id);
  for(const port of factor.members){assert(nodes.has(port.nodeId),port.nodeId);if(port.language)assert.equal(nodes.get(port.nodeId).language,port.language);}
 }
 assert.equal(graph.nodes.filter(n=>n.type==='alignment').length,1026);
 assert.equal(graph.nodes.filter(n=>n.type==='media').length,6);
 assert.equal(graph.nodes.filter(n=>n.type==='topic').length,46);
 assert.equal(graph.nodes.filter(n=>n.type==='usage').length,3048);
 assert.equal(graph.capabilities.lexemeInventory,false);assert.equal(graph.capabilities.lexicalSenseInventory,false);
 assert.equal(graph.capabilities.productionPatternApplications,false);
});

test('alignment and category factors retain sparse memberships without materialized pairwise cliques',()=>{
 const graph=Query.buildStructureSnapshot(),stats=Query.structureIndexStats();
 assert.equal(stats.pairwiseEdgesMaterialized,0);
 assert.equal(stats.factorTypes['authored-alignment'],1026);
 assert.equal(stats.factorTypes['category-membership'],46);
 assert.equal(stats.factorTypes['category-anchor'],24);
 assert.equal(stats.factorTypes['authored-association'],43);
 assert.equal(stats.factorTypes['anchored-occurrence'],24);
 assert.equal(stats.factorTypes['task-material'],3);
 assert.equal(graph.factors.some(f=>f.type==='translation'||f.type==='same-topic'),false);
 const categories=graph.factors.filter(f=>f.type==='category-membership');
 assert.equal(categories.reduce((n,f)=>n+f.members.filter(m=>m.role==='member').length,0),1026);
 assert.equal(categories.reduce((n,f)=>{const size=f.members.filter(m=>m.role==='member').length;return n+size*(size-1)/2;},0),13935);
 const anchor=graph.factors.find(f=>f.type==='category-anchor'&&f.members.some(m=>m.nodeId==='alignment:movement.walk'));
 assert(anchor.members.some(m=>m.nodeId==='alignment:actions.eat'));
 assert.equal(anchor.prerequisite,false);assert.equal(anchor.direction,'unspecified-association');
});

test('all 135432 translation directions preserve the existing resolver and typed target role',()=>{
 let checked=0,meaningTargets=0;
 for(const concept of G.CONCEPTS)for(const sourceLang of G.LANGUAGES)for(const targetLang of G.LANGUAGES){
  if(sourceLang===targetLang)continue;
  const result=lookup(concept.terms[sourceLang],sourceLang,targetLang),answer=result.answers.find(a=>a.legacyConceptId===concept.id);
  assert.equal(result.completeness.complete,true,concept.id);
  assert(answer,concept.id+':'+sourceLang);
  const expected=G.translation(concept.id,sourceLang,targetLang);
  assert.equal(answer.translation.back,expected.back);assert.equal(answer.translation.front,expected.front);
  assert.equal(answer.translation.conceptId,concept.id);assert.equal(answer.translation.literalBack,expected.literalBack);
  const witness=witnessFor(result,answer),target=witness.steps.at(-1).to;
  assert.equal(target.nodeId,Structure.surfaceFormId(expected.back,targetLang));
  assert.equal(target.role,concept.kind==='expression'?'authored-meaning-rendering':'listed-term');
  if(expected.back!==concept.terms[targetLang])meaningTargets++;
  checked++;
 }
 assert.equal(checked,135432);assert.equal(meaningTargets,396);
});

test('expression meaning and literal ports remain distinct even when their node text is shared',()=>{
 const result=lookup('Es muy fácil.','es','en'),answer=result.answers.find(a=>a.legacyConceptId==='expressions.piece_of_cake');
 assert.equal(answer.translation.back,"It's very easy.");
 assert.equal(witnessFor(result,answer).steps.at(-1).to.role,'authored-meaning-rendering');
 const graph=Query.buildStructureSnapshot(),factor=graph.factors.find(f=>f.id==='factor:alignment:expressions.piece_of_cake');
 const spanish=Structure.surfaceFormId('Es muy fácil.','es');
 assert(factor.members.some(m=>m.nodeId===spanish&&m.role==='listed-term'));
 assert(factor.members.some(m=>m.nodeId===spanish&&m.role==='authored-meaning-rendering'));
 assert(factor.members.some(m=>m.role==='authored-literal-rendering'));
});

test('all searchable listed terms, aliases and meaning renderings retain lookup candidate order',()=>{
 for(const concept of G.CONCEPTS)for(const language of G.LANGUAGES){
  const target=language==='en'?'es':'en';
  for(const text of [concept.terms[language],...(concept.aliases[language]||[]),...(concept.meaningTerms?[concept.meaningTerms[language]]:[])]){
   const result=lookup(text,language,target);
   assert.deepEqual(result.answers.map(a=>a.legacyConceptId),G.lookup(text,language).map(c=>c.id),language+':'+text);
  }
 }
});

test('shared exact forms retain multiple alignments and no lexical identity is invented',()=>{
 const result=lookup('light');assert.equal(result.status,'ambiguous');
 assert.equal(result.completeness.totalMatches,2);assert.equal(result.completeness.complete,true);
 assert.deepEqual(result.answers.map(a=>a.legacyConceptId),['home.light','colors.light']);
 assert.equal(result.unresolvedAlternatives.length,2);
 assert.equal(result.answers[0].match.matchedForms[0].id,result.answers[1].match.matchedForms[0].id);
 assert.notEqual(result.answers[0].alignmentId,result.answers[1].alignmentId);
 assert.equal(lookup('mañana','es','en').status,'ambiguous');
 assert.equal(lookup('bank').status,'single-catalogue-match');
 assert.equal(lookup('bank').capabilities.exhaustiveLexicon,false);
});

test('normalized search is labelled as a match rule rather than promoted to exact form identity',()=>{
 const result=lookup(' WATER! '),answer=result.answers[0];
 assert.equal(answer.legacyConceptId,'food.water');assert.equal(answer.match.exactSurface,false);
 assert.equal(answer.match.normalizedKey,'water');assert.equal(answer.match.input,' WATER! ');
 assert.equal(answer.match.matchedForms[0].id,Structure.surfaceFormId('water','en'));
 assert.equal(witnessFor(result).nodeIds.includes(Structure.surfaceFormId(' WATER! ','en')),false);
 const alias=lookup('hi').answers.find(a=>a.legacyConceptId==='essentials.hello');
 assert(alias.match.matchedForms.some(m=>m.text==='hi'&&m.role==='listed-alias'&&m.exact));
 assert.equal(alias.translation.front,'hello','The legacy display/translation contract is retained.');
 assert.notEqual(Structure.surfaceFormId('si','es'),Structure.surfaceFormId('sí','es'));
 assert.equal(lookup('si','es','en').answers.length,0);
});

test('answer and factor budgets preserve total ambiguity without choosing a hidden winner',()=>{
 for(const budget of [{maxAnswers:1},{maxFactors:1}]){
  const result=lookup('light','en','es',budget);
  assert.equal(result.status,'ambiguous');assert.equal(result.completeness.totalMatches,2);
  assert.equal(result.answers.length,1);assert.equal(result.completeness.complete,false);assert.equal(result.completeness.truncated,true);
  assert.equal(result.unresolvedAlternatives.length+result.omittedAlternativeCount,2);
  assert(result.unresolvedAlternatives.length<=result.completeness.work.proposals);
  assert(result.completeness.work.proposals<=(budget.maxAnswers??32)+1);
  assert.equal(Object.keys(result.witnesses).length,1);
 }
 const none=lookup('light','en','es',{maxFactors:0});
 assert.equal(none.answers.length,0);assert.equal(none.status,'ambiguous');assert.equal(none.completeness.totalMatches,2);
 assert.equal(none.completeness.complete,false);assert.equal(none.completeness.work.factors,0);
 assert.equal(none.completeness.work.proposals,1);assert.equal(none.omittedAlternativeCount,1);
 assert.equal(lookup('unlisted-example','en','es',{maxAnswers:0,maxFactors:0}).completeness.complete,true);
});

test('zero and one answer bounds do not enumerate hidden ambiguity into unbounded alternative arrays',()=>{
 const none=lookup('light','en','es',{maxAnswers:0});
 assert.equal(none.status,'ambiguous');assert.equal(none.completeness.totalMatches,2);
 assert.equal(none.completeness.work.proposals,0);assert.equal(none.completeness.work.factors,0);
 assert.deepEqual(none.unresolvedAlternatives,[]);assert.equal(none.omittedAlternativeCount,2);
 assert.equal(none.alternativeCompleteness.complete,false);
 const one=lookup('light','en','es',{maxAnswers:1});
 assert.equal(one.completeness.work.proposals,1);assert.equal(one.unresolvedAlternatives.length,1);
 assert.equal(one.omittedAlternativeCount,1);assert.equal(one.alternativeCompleteness.totalAlternatives,2);
 assert.equal(one.alternativeCompleteness.returnedAlternatives,1);assert.equal(one.alternativeCompleteness.complete,false);
 const full=lookup('light');assert.equal(full.completeness.work.proposals,2);assert.equal(full.omittedAlternativeCount,0);
 assert.equal(full.alternativeCompleteness.complete,true);assert.equal(full.status,'ambiguous','Listing all alternatives does not resolve their meaning.');
});

test('quality gates retain matching records and trace context-required claims without endorsing them',()=>{
 for(const id of ['relatives.uncle','relatives.aunt']){
  const concept=G.concept(id),result=lookup(concept.terms.ar,'ar','zh-CN'),answer=result.answers.find(a=>a.legacyConceptId===id);
  assert(answer);assert.equal(answer.eligibility.eligible,false);assert.equal(answer.eligibility.code,'context-required');
  assert.equal(result.completeness.totalMatches,G.lookup(concept.terms.ar,'ar').length);
  assert(witnessFor(result,answer).claimStatuses.includes('needs_verification'));
  assert(answer.provenance.some(p=>p.sourcePath==='data/graph-integrity.json'));
 }
 // The external quarantine is a source-specific registry entry, not a new bank
 // node, spelling blacklist, or invitation to invent a production application.
 assert.equal(lookup('marciendo','es','en').answers.length,0);
 const gate=Structure.generatedCandidateEligibility({status:'generated',form:'marciendo',language:'es',quarantineRecordId:'external-pdf-p073-output-001'});
 assert.equal(gate.eligible,false);assert.equal(gate.code,'quarantined-record');
 assert.equal(Query.buildStructureSnapshot().nodes.some(n=>n.id==='P073'||n.id==='alignment:P073'),false);
});

test('every actual reader annotation has an exact occurrence witness with no invented bank join',()=>{
 const graph=Query.buildStructureSnapshot(),nodes=new Map(graph.nodes.map(n=>[n.id,n]));let count=0;
 for(const item of X.ITEMS)for(const annotation of item.annotations){
  const result=Query.occurrenceWitnesses({contentId:item.id,version:item.version,annotationId:annotation.id});
  assert.equal(result.completeness.complete,true);assert.equal(result.answers.length,1);
  const answer=result.answers[0],witness=witnessFor(result);
  assert.equal(answer.annotationId,annotation.id);assert.equal(answer.annotation.conceptId,'');
  assert.equal(answer.alignmentId,null);assert.equal(answer.lexemeId,null);assert.equal(answer.senseId,null);
  assert(witness.nodeIds.every(id=>nodes.get(id).type!=='alignment'));
  assert(witness.factorIds.every(id=>graph.factors.find(f=>f.id===id).type==='anchored-occurrence'));
  assert.equal(answer.eligibility.attested,false);assert.equal(answer.eligibility.humanReviewed,false);
  let offset=0;for(const segment of item.segments){if(segment.id===annotation.segmentId){offset+=X.scalarToUTF16(segment.text,annotation.start);break;}offset+=segment.text.length+2;}
  const selected=Query.occurrenceWitnesses({contentId:item.id,version:item.version,selectedText:annotation.quote,selectionStart:offset});
  assert.equal(selected.answers[0].annotationId,annotation.id);assert.equal(selected.answers[0].witnessId,answer.witnessId);
  assert.equal(Query.occurrenceWitnesses({contentId:item.id,version:item.version,selectedText:annotation.quote,selectionStart:offset+1}).answers.length,0);
  count++;
 }
 assert.equal(count,24);
});

test('explicit scalar source anchors must match the same authored annotation',()=>{
 const item=X.ITEMS[0],annotation=item.annotations[0],reference={contentId:item.id,version:item.version,segmentId:annotation.segmentId,start:annotation.start,end:annotation.end,quote:annotation.quote};
 assert.equal(Query.occurrenceWitnesses(reference).answers[0].annotationId,annotation.id);
 assert.equal(Query.occurrenceWitnesses({...reference,annotationId:annotation.id,start:annotation.start+1}).answers.length,0);
 assert.equal(Query.occurrenceWitnesses({...reference,version:item.version+1}).answers.length,0);
 assert.equal(Query.occurrenceWitnesses({contentId:item.id,version:item.version}).answers.length,0);
 assert.equal(Query.occurrenceWitnesses({contentId:item.id,version:item.version,quote:annotation.meaning}).answers.length,0);
});

test('repeated source text without an occurrence offset never selects an annotation by first match',()=>{
 // Check every repeated authored quote in the actual source, and the unlocated
 // unsupported case even if an edition has no repeated annotation quote.
 for(const item of X.ITEMS)for(const annotation of item.annotations){
  const text=X.sourceText(item),first=text.indexOf(annotation.quote);
  if(first>=0&&text.indexOf(annotation.quote,first+1)!==-1){
   const result=Query.occurrenceWitnesses({contentId:item.id,version:item.version,selectedText:annotation.quote});
   assert.equal(result.answers.length,0);assert(result.issues.some(i=>i.code==='ambiguous-occurrence'));
  }
 }
 const item=X.ITEMS[0];
 assert.equal(Query.occurrenceWitnesses({contentId:item.id,version:item.version,selectedText:'unsupported quote'}).answers.length,0);
});

test('authored task relations preserve the existing options and priorities without topic expansion',()=>{
 const result=Query.taskMaterialWitnesses({purposeFamily:'introduction',sourceLang:'es',targetLang:'en'});
 assert.equal(result.completeness.complete,true);assert.equal(result.completeness.totalMatches,3);
 assert.deepEqual(result.answers.map(a=>[a.legacyConceptId,a.role,a.title,a.taskUtility]),[
  ['phrases.nice_to_meet_you','greeting','Try a first-meeting greeting',6],
  ['essentials.thanks','appreciation','Express appreciation in a few words',4.8],
  ['phrases.please_repeat','repair','Have a comfortable way to ask for repetition',4.4],
 ]);
 for(const answer of result.answers){
  assert.equal(answer.eligibility.eligible,true);
  assert(answer.provenance.some(p=>p.sourcePath==='data/task-material-relations.json'));
  assert(witnessFor(result,answer).factorIds.some(id=>id.startsWith('factor:task-material:')));
  assert.equal(witnessFor(result,answer).automaticEvidenceTransfer,false);
  assert.equal(witnessFor(result,answer).independenceEstablished,false);
 }
 assert.equal(result.answers.some(a=>a.legacyConceptId==='phrases.how_much'),false);
 const unknown=Query.taskMaterialWitnesses({purposeFamily:'customer-support',sourceLang:'es',targetLang:'en'});
 assert.equal(unknown.answers.length,0);assert(unknown.issues.some(i=>i.code==='unknown-task-profile'));
});

test('task witness budget exhaustion is reported without returning an unwitnessed option',()=>{
 const limited=Query.taskMaterialWitnesses({purposeFamily:'introduction',sourceLang:'es',targetLang:'en',budget:{maxFactors:1}});
 assert.equal(limited.completeness.totalMatches,3);assert.equal(limited.answers.length,0);
 assert.equal(limited.completeness.complete,false);assert.deepEqual(limited.witnesses,{});
 assert.equal(limited.completeness.work.proposals,1);assert.equal(limited.completeness.work.factors,0);
 assert.equal(limited.unresolvedAlternatives.length,1);assert.equal(limited.omittedAlternativeCount,2);
 const one=Query.taskMaterialWitnesses({purposeFamily:'introduction',sourceLang:'es',targetLang:'en',budget:{maxAnswers:1}});
 assert.equal(one.answers.length,1);assert.equal(one.completeness.complete,false);assert(witnessFor(one));
});

test('witnesses carry actual source locators and do not claim independent supporting observations',()=>{
 const result=lookup('water'),answer=result.answers[0],witness=witnessFor(result);
 assert.equal(witness.graphVersion,Query.graphVersion());assert.equal(witness.status,'recorded-structure');
 assert.equal(witness.independenceEstablished,false);assert.equal(witness.automaticEvidenceTransfer,false);
 const source=answer.provenance.find(p=>p.recordId==='food.water');
 assert.equal(source.sourcePath,'data/wordgraph-source.json');assert.equal(source.locator,'food.water');
 assert.equal(source.attested,false);assert.equal(source.humanReviewed,false);
 assert(witness.provenanceRefs.includes(source.sourceId));assert(witness.sourceLineageIds.includes(source.lineageId));
 const task=Query.taskMaterialWitnesses({purposeFamily:'introduction',sourceLang:'es',targetLang:'en'});
 const taskSource=task.answers[0].provenance.find(p=>p.kind==='authored-task-material');
 assert.equal(taskSource.lineageId,'nabu-task-material:introduction');assert.match(taskSource.locator,/materials.greeting$/);
});

test('query outputs and full snapshots are detached and repeated calls are deterministic',()=>{
 const first=lookup('light'),before=JSON.stringify(first);first.answers[0].translation.back='changed';first.answers[0].provenance[0].locator='changed';
 first.witnesses[first.answers[0].witnessId].steps[0].to.role='changed';
 assert.equal(JSON.stringify(lookup('light')),before);
 const snapshot=Query.buildStructureSnapshot(),node=snapshot.nodes.find(n=>n.type==='form'),id=node.id,original=node.text;node.text='changed';snapshot.factors.length=0;
 const actual=Query.buildStructureSnapshot();assert.equal(actual.nodes.find(n=>n.id===id).text,original);assert(actual.factors.length>0);
 assert.equal(JSON.stringify(lookup('light')),before);
});

test('mixed bounded seeds report separate ambiguity and deterministic source order',()=>{
 const item=X.ITEMS[0],annotation=item.annotations[0],input={seeds:[{kind:'surface',text:'light',sourceLang:'en',targetLang:'es'},{kind:'occurrence',contentId:item.id,version:item.version,annotationId:annotation.id}],budget:{maxAnswers:2}};
 const result=Query.queryStructure(input);assert.equal(result.status,'ambiguous');assert.equal(result.completeness.totalMatches,3);assert.equal(result.answers.length,2);
 assert.equal(result.completeness.complete,false);assert.deepEqual(result.answers.map(a=>a.seedIndex),[0,0]);
 assert.deepEqual(result,Query.queryStructure(input));
});

test('empty, unsupported and unknown seeds return explicit absence while malformed budgets reject',()=>{
 assert.equal(lookup('').answers.length,0);assert.equal(lookup('water','xx','es').answers.length,0);assert.equal(lookup('water','en','en').answers.length,0);
 assert.equal(Query.queryStructure({seeds:[{kind:'generated',form:'invented'}]}).answers.length,0);
 assert.equal(Query.queryStructure().completeness.totalMatches,0);
 for(const budget of [{maxAnswers:-1},{maxFactors:1.5},{maxAnswers:257},{maxFactors:4097},{unknown:1},null])assert.throws(()=>lookup('light','en','es',budget));
 assert.throws(()=>Query.queryStructure({seeds:Array(17).fill({kind:'surface'})}));
});
