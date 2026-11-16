import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as S from '../public/nabu-structure.js';
import * as G from '../public/nabu-graph.js';
import * as X from '../public/nabu-content.js';
import {GRAPH_INTEGRITY} from '../public/nabu-structure-data.js';

const source=()=>({sourceId:'fixture-only-source',lineageId:'fixture-only-lineage',locator:'synthetic-case-1',kind:'authored-fixture'});
const application=()=>({
 id:'fixture-only-application',patternId:'fixture-only-pattern',language:'es',status:'generated',fixtureOnly:true,
 inputs:[{id:'base',form:'zzfixturestem',language:'es',features:{role:'base',lexicalIdentity:null}}],
 outputs:[{id:'complete-output',form:'zzfixturestemando',language:'es',features:{formType:'fixture-gerund',attested:false}}],
 features:{operation:'synthetic-test-only',grammaticality:null},provenance:[source()],competingAnalyses:[]
});

test('generated integrity registry exactly matches its inspectable JSON source',()=>{
 const json=JSON.parse(fs.readFileSync(new URL('../data/graph-integrity.json',import.meta.url),'utf8'));
 assert.deepEqual(GRAPH_INTEGRITY,json);assert.deepEqual(S.graphIntegrityRegistry(),json);
});

test('existing entries retain alignment identity without fabricating lexemes or lexical senses',()=>{
 const p=S.classifyKnownEntry('food.water','ar');
 assert.equal(p.eligible,true);assert.equal(p.known,true);assert.equal(p.legacyConceptId,'food.water');
 assert.equal(p.form.text,G.concept('food.water').terms.ar);assert.equal(p.form.language,'ar');
 assert.equal(p.alignmentId,'alignment:food.water');assert.equal(p.lexemeId,null);assert.equal(p.senseId,null);
 assert.deepEqual(p.patternApplicationIds,[]);assert.equal(p.reviewStatus,'authored-unreviewed');
 assert.equal(p.attested,false);assert.equal(p.humanReviewed,false);
 assert.equal(p.provenance[0].sourcePath,'data/wordgraph-source.json');
});

test('legacy entries without row-level reviewStatus inherit the unreviewed catalogue status',()=>{
 assert.equal(G.concept('essentials.hello').reviewStatus,undefined);
 assert.equal(S.classifyKnownEntry('essentials.hello','es').reviewStatus,'authored-unreviewed');
 assert.equal(S.classifyKnownEntry('essentials.hello','es').humanReviewed,false);
});

test('unknown catalogue IDs and unsupported languages do not fabricate structural facts',()=>{
 for(const id of ['P073','marciendo','not-an-entry']){
  const p=S.classifyKnownEntry(id,'es');assert.equal(p.eligible,false);assert.equal(p.known,false);
  assert.equal(p.form,null);assert.equal(p.senseId,null);assert.deepEqual(p.provenance,[]);
 }
 assert.equal(S.classifyKnownEntry('food.water','xx').code,'unsupported-language');
 assert.equal(S.candidateEligibility('food.water','en','xx').eligible,false);
 assert.equal(S.candidateEligibility('food.water','es','es').code,'same-language-pair');
});

test('surface identity is language-scoped and does not inherit lookup accent or vowel stripping',()=>{
 assert.notEqual(S.surfaceFormId('si','es'),S.surfaceFormId('sí','es'));
 assert.notEqual(S.surfaceFormId('water','en'),S.surfaceFormId('water','es'));
 assert.notEqual(S.surfaceFormId('ماء','ar'),S.surfaceFormId('مَاء','ar'));
 assert.equal(S.surfaceFormId('cafe\u0301','fr'),S.surfaceFormId('café','fr'));
 assert.throws(()=>S.surfaceFormId('','es'));assert.throws(()=>S.surfaceFormId('word','xx'));
});

test('same surface can support distinct alignment candidates without silently selecting a sense',()=>{
 const light=S.lookupGraphForms('light','en');assert.equal(light.status,'ambiguous');
 assert.deepEqual(light.candidates.map(c=>c.legacyConceptId),['home.light','colors.light']);
 assert.equal(light.candidates[0].form.id,light.candidates[1].form.id);
 assert.notEqual(light.candidates[0].alignmentId,light.candidates[1].alignmentId);
 assert.equal(S.lookupGraphForms('mañana','es').status,'ambiguous');
 assert.equal(S.lookupGraphForms('bank','en').candidates.length,1,'No river-bank sense is invented.');
 assert.equal(S.lookupGraphForms('bank','en').exhaustiveLexicon,false);
});

test('kinship branches require context for new recommendations while the legacy graph remains unchanged',()=>{
 for(const id of ['relatives.uncle','relatives.aunt']){
  const p=S.candidateEligibility(id,'ar','zh-CN');assert.equal(p.eligible,false);
  assert.equal(p.requiresContext,true);assert.equal(p.code,'context-required');
  assert.equal(p.reviewStatus,'review-needed');assert.equal(p.issues[0].code,'kinship-branch-collapsed');
 }
 // This documents the legacy mismatch, not an endorsement or silent repair.
 const legacy=G.resolve('خال','ar','zh-CN');assert.equal(legacy.status,'found');assert.equal(legacy.back,'叔叔');
 assert.equal(G.concept('relatives.uncle').aliases.ar.includes('خال'),true);
});

test('ordinary candidate gates keep original graph contracts and never transfer evidence',()=>{
 const p=S.candidateEligibility('phrases.nice_to_meet_you','en','es');
 assert.equal(p.eligible,true);assert.equal(p.relation,'authored-translation-alignment');
 assert.equal(p.automaticEvidenceTransfer,false);assert.equal(p.reviewStatus,'authored-unreviewed');
 assert.equal(p.targetForm.text,G.concept('phrases.nice_to_meet_you').terms.es);
 assert(p.usageIds.length>0);
});

test('typed slice deduplicates same-language surfaces but retains distinct alignment edges and provenance',()=>{
 const g=S.structureSlice({conceptIds:['food.fish','animals.fish'],languages:['en']});
 const forms=g.nodes.filter(n=>n.type==='form');assert.equal(forms.length,1);
 assert.equal(forms[0].provenance.length,2);assert.equal(forms[0].lexemeId,null);
 assert.equal(g.nodes.filter(n=>n.type==='alignment').length,2);
 assert.equal(g.edges.filter(e=>e.from===forms[0].id&&e.type==='listed-term').length,2);
 assert(g.edges.every(e=>e.automaticEvidenceTransfer===false));
 assert.equal(g.nodes.some(n=>['lexeme','sense','pattern-application'].includes(n.type)),false);
 assert.equal(g.capabilities.productionPatternApplications,false);
});

test('bank usages are actual authored examples with source lineage, not attested media occurrences',()=>{
 const id='phrases.nice_to_meet_you',g=S.structureSlice({conceptIds:[id],languages:['es']});
 const example=g.nodes.find(n=>n.type==='usage'&&n.usageKind==='authored-example');
 assert.equal(example.text,G.concept(id).details.examples.es);assert.equal(example.attested,false);
 assert.equal(example.reviewStatus,'authored-unreviewed');assert.equal(example.senseId,null);
 assert.equal(example.provenance[0].lineageId,'nabu-bank:'+id);
 const ids=new Set(g.nodes.map(n=>n.id));assert(g.edges.every(e=>ids.has(e.from)&&ids.has(e.to)));
});

test('all 24 reader annotations retain exact versioned scalar anchors without invented sense joins',()=>{
 const mediaRefs=X.ITEMS.map(({id,version})=>({id,version}));
 const g=S.structureSlice({conceptIds:['food.water'],languages:['ar'],mediaRefs});
 const uses=g.nodes.filter(n=>n.usageKind==='anchored-authored-interpretation');assert.equal(uses.length,24);
 for(const use of uses){
  const item=X.itemById(use.anchor.contentId,use.anchor.version),segment=item.segments.find(s=>s.id===use.anchor.segmentId);
  assert.equal(Array.from(segment.text).slice(use.anchor.start,use.anchor.end).join(''),use.text);
  assert.equal(use.anchor.quote,use.text);assert.equal(use.legacyConceptId,null);assert.equal(use.senseId,null);
  assert.equal(g.edges.some(e=>e.from===use.id&&e.type==='authored-example-for-alignment'),false);
 }
 assert.equal(g.nodes.filter(n=>n.type==='media').length,6);
 const ids=new Set(g.nodes.map(n=>n.id));assert(g.edges.every(e=>ids.has(e.from)&&ids.has(e.to)));
});

test('slice preserves media source attribution and distinguishes source references from linguistic validation',()=>{
 const g=S.structureSlice({mediaRefs:[{id:'imru-al-qais-stop-and-weep',version:1}]});
 const media=g.nodes.find(n=>n.type==='media');
 assert.equal(media.sourceReferences[0].url,X.itemById(media.contentId).sourceReferences[0].url);
 assert.equal(media.reviewStatus,'authored-unreviewed');assert.equal(media.attested,false);
 assert.equal(media.provenance[0].sourcePath,'data/explore.json');
});

test('unknown graph/media references are explicit and slice limits are enforced',()=>{
 const g=S.structureSlice({conceptIds:['unknown-id'],mediaRefs:[{id:'unknown-piece',version:1}]});
 assert.equal(g.nodes.length,0);assert.deepEqual(g.issues.map(i=>i.code),['unknown-entry','unknown-media']);
 assert.throws(()=>S.structureSlice({mediaRefs:[{id:'x'}]}));
 assert.throws(()=>S.structureSlice({conceptIds:Array(101).fill('food.water')}));
 assert.throws(()=>S.structureSlice({languages:['xx']}));
});

test('returned adapter objects cannot mutate the bank or integrity policy',()=>{
 const before=JSON.stringify(G.concept('food.water'));
 const a=S.classifyKnownEntry('food.water','es');a.form.text='changed';a.provenance[0].sourcePath='elsewhere';
 const g=S.structureSlice({conceptIds:['food.water'],languages:['es']});g.nodes[0].gloss='changed';
 const registry=S.graphIntegrityRegistry();registry.entryFlags.length=0;
 assert.equal(JSON.stringify(G.concept('food.water')),before);
 assert.equal(S.classifyKnownEntry('relatives.uncle','es').eligible,false);
});

test('multiple sibling outputs from a source are grouped once, not treated as independent observations',()=>{
 const evidence=['ending-a','ending-b','ending-c'].map((suffix,i)=>({...source(),id:'part-'+i,suffix}));
 const groups=S.groupEvidenceBySource(evidence);assert.equal(groups.sourceLineageCount,1);
 assert.equal(groups.groups[0].items.length,3);assert.equal(groups.independenceEstablished,false);
});

test('distinct source IDs with shared lineage remain one source group and missing lineage does not manufacture independence',()=>{
 const grouped=S.groupEvidenceBySource([{...source(),sourceId:'copy-a'},{...source(),sourceId:'copy-b'},{applicationId:'app-a',suffix:'a'},{applicationId:'app-b',suffix:'b'}]);
 assert.equal(grouped.sourceLineageCount,1);assert.equal(grouped.unattributedCount,2);
 assert.deepEqual(grouped.groups[0].sourceIds,['copy-a','copy-b']);
 assert.equal(grouped.independenceEstablished,false);
});

test('full synthetic application keeps all forms, features, provenance and alternatives together',()=>{
 const p=application(),alternate=application();alternate.id='fixture-only-alternative';alternate.patternId='fixture-only-other-pattern';
 alternate.features.operation='different-fixture-analysis';delete alternate.competingAnalyses;
 p.competingAnalyses=[alternate];
 const actual=S.validatePatternApplication(p);assert.equal(actual.type,'pattern-application');
 assert.equal(actual.inputs.length,1);assert.equal(actual.outputs.length,1);assert.equal(actual.competingAnalyses.length,1);
 assert.equal(actual.validation.evidenceUnit,'whole-application');assert.equal(actual.validation.sourceLineageCount,1);
 assert.equal(actual.validation.linguisticCorrectness,'not-checked');assert.equal(actual.fixtureOnly,true);
 assert.equal(actual.validation.independenceEstablished,false);
 assert.equal(actual.quarantine,null);
});

test('partial patterns, bare suffix outputs, missing features and missing competing-analysis declarations are rejected',()=>{
 const cases=[];
 for(const key of ['inputs','outputs','features','provenance','competingAnalyses','fixtureOnly']){const p=application();delete p[key];cases.push(p);}
 const suffix=application();suffix.outputs=['ando'];cases.push(suffix);
 const noFeatures=application();delete noFeatures.outputs[0].features;cases.push(noFeatures);
 const noLineage=application();delete noLineage.provenance[0].lineageId;cases.push(noLineage);
 for(const p of cases)assert.throws(()=>S.validatePatternApplication(p));
});

test('competing analyses themselves require complete application records',()=>{
 const p=application();p.competingAnalyses=[{id:'alternative',patternId:'p2',output:'x'}];
 assert.throws(()=>S.validatePatternApplication(p));
 const duplicate=application();duplicate.competingAnalyses=[application()];
 assert.throws(()=>S.validatePatternApplication(duplicate),/distinct/);
});

test('structural validation alone does not promote a generated application to evidence',()=>{
 const p=S.validatePatternApplication(application());
 const gate=S.generatedCandidateEligibility({status:p.status,form:p.outputs[0].form,language:'es',attested:true,provenance:p.provenance});
 assert.equal(gate.eligible,false);assert.equal(gate.code,'generated-unverified');assert.equal(gate.attested,false);
});

test('a caller boolean or mismatched source cannot establish form attestation',()=>{
 const base={status:'generated',form:'zzfictionalform',language:'es',attested:true};
 assert.equal(S.generatedCandidateEligibility(base).eligible,false);
 const p={...source(),kind:'attestation',verificationStatus:'verified',supportsForm:true,form:'a-different-form',language:'es'};
 assert.equal(S.generatedCandidateEligibility({...base,provenance:[p]}).eligible,false);
 p.form=base.form;p.language='ar';assert.equal(S.generatedCandidateEligibility({...base,provenance:[p]}).eligible,false);
});

test('traceable authored examples remain unreviewed rather than becoming attestations',()=>{
 const p=S.generatedCandidateEligibility({status:'authored-unreviewed',provenance:[source()]});
 assert.equal(p.eligible,true);assert.equal(p.reviewStatus,'authored-unreviewed');assert.equal(p.attested,false);
 assert.equal(S.generatedCandidateEligibility({status:'draft'}).eligible,false);
 assert.equal(S.generatedCandidateEligibility({status:'unattested',provenance:[source()]}).eligible,false);
});

test('supplied form-specific attestation remains explicitly scoped to declared provenance',()=>{
 const provenance={...source(),kind:'attestation',verificationStatus:'verified',supportsForm:true,form:'zzfixture-observed',language:'es'};
 const p=S.generatedCandidateEligibility({status:'verified',form:provenance.form,language:'es',provenance});
 assert.equal(p.eligible,true);assert.equal(p.attested,true);assert.equal(p.patternApplicationVerified,false);
 assert.match(p.evidenceVerification,/caller-supplied/);
});

test('external P073 issue is scoped to the exact PDF record and does not pretend to remove a bank item',()=>{
 const registry=S.graphIntegrityRegistry(),q=registry.externalImportIssues[0];
 assert.equal(q.presentInActiveBank,false);assert.equal(q.status,'needs_verification');
 assert.equal(q.sourceDocument,'Nabu Language Graph Workspace (1).pdf');assert.equal(q.sourcePageCount,515);
 assert.deepEqual(q.observations.map(o=>o.page),[25,193,30]);
 const row=q.observations.find(o=>o.page===30);
 assert.equal(row.exactText,'marciendo>attestation criteria [1 cells]');assert.equal(row.verbs,1);
 assert.equal(row.independentBaseVerbs,1);assert.equal(row.tier,'stored');
 assert.equal(G.concept('P073'),null);assert.equal(G.resolve('marciendo','es','en').status,'missing');
});

test('suspect output metadata is quarantined only for the referenced external source record',()=>{
 const q=S.graphIntegrityRegistry().externalImportIssues[0],raw=q.observations.find(o=>o.page===30).exactText;
 const p=S.generatedCandidateEligibility({status:'generated',sourceId:q.sourceId,rawOutput:raw,form:'marciendo',language:'es'});
 assert.equal(p.eligible,false);assert.equal(p.code,'quarantined-record');assert.equal(p.quarantineRecordId,q.id);
 assert.equal(p.dictionaryListed,true);assert.equal(p.lexicalStatus,'dictionary-listed-gerund');
 const differentSource=S.generatedCandidateEligibility({status:'generated',sourceId:'unrelated-source',rawOutput:raw,form:'marciendo',language:'es'});
 assert.notEqual(differentSource.code,'quarantined-record');
});

test('dictionary-listed marciendo is not globally rejected or treated as a verified P073 application',()=>{
 const p=S.generatedCandidateEligibility({status:'generated',form:'marciendo',language:'es',patternId:'P073'});
 assert.equal(p.eligible,true);assert.equal(p.dictionaryListed,true);assert.equal(p.attested,false);
 assert.equal(p.reviewStatus,'dictionary-listed-form-only');assert.equal(p.patternApplicationVerified,false);
 assert(p.provenance.some(x=>x.url==='https://dle.rae.es/marcir'));
 assert.equal(S.classifyKnownEntry('marciendo','es').known,false,'A dictionary fact does not create a new live bank entry.');
 assert.equal(S.structureSlice().nodes.length,0,'External verification does not import production graph nodes.');
});

test('full application validation flags the contaminated external mapping without blocking every P073 record',()=>{
 const p=application(),q=S.graphIntegrityRegistry().externalImportIssues[0];
 p.patternId='P073';p.inputs[0].form='marcir';p.outputs[0].form='attestation criteria';
 p.provenance=[{sourceId:q.sourceId,lineageId:q.sourceId,locator:'physical page 30',kind:'external-import'}];
 assert.equal(S.validatePatternApplication(p).quarantine.id,q.id);
 p.outputs[0].form='marciendo';
 assert.equal(S.validatePatternApplication(p).quarantine,null,'Correct surface does not validate the pattern, but is not the contaminated record.');
 assert.equal(S.validatePatternApplication(p).validation.linguisticCorrectness,'not-checked');
});

test('quarantined source claims stay gated even when the surface has lexical support',()=>{
 const p=S.generatedCandidateEligibility({status:'quarantined',form:'marciendo',language:'es'});
 assert.equal(p.eligible,false);assert.equal(p.dictionaryListed,true);assert.match(p.reason,/source record/);
 assert.equal(S.generatedCandidateEligibility({status:'generated',form:{invalid:'shape'},language:'es'}).eligible,false);
});
