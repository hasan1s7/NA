/** Integration of the real bounded structural query with the existing policy.
 * These tests assert traceability and unchanged behavior, not linguistic quality
 * or a learning effect. No mocked graph, provider, storage or learner estimator.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as Next from '../public/nabu-next-step.js';
import * as Query from '../public/nabu-structure-query.js';
import * as Intent from '../public/nabu-intents.js';
import * as G from '../public/nabu-graph.js';
import * as X from '../public/nabu-content.js';

const fixtures=JSON.parse(await readFile(new URL('./fixtures/next-steps.json',import.meta.url),'utf8')).cases;
const capabilities=Object.fromEntries(Next.NEXT_STEP_ACTIONS.map(type=>[type,true]));
const now=100000;
function record(rawText,edits={},metadata={}){
 return Intent.validateIntentRecord({schemaVersion:1,id:'graph-intent-0000001',ownerUserId:'alice',tenantId:null,kind:'learner',...Intent.editIntentContent(Intent.parseIntentLocal(rawText),edits),createdAt:1000,updatedAt:1000,statusChangedAt:1000,revision:1,...metadata});
}
function context(intent,organizationObjective=null){return {schemaVersion:1,actor:{kind:intent.tenantId?'team':'individual',userId:intent.ownerUserId,tenantId:intent.tenantId},selection:{mode:'selected',intentId:intent.id},immediateIntent:intent,organizationObjective};}
function recommend(rawText,source={},edits={},extra={}){return Next.recommendNextSteps({intentContext:context(record(rawText,edits)),source,capabilities,now,...extra});}
function fromFixture(id,extra={}){const f=fixtures.find(value=>value.id===id);assert.ok(f,id);return recommend(f.intent,f.source,f.edits||{},extra);}
function candidates(result){return [...new Map([result.primary,...result.alternatives,result.continueAction].filter(Boolean).map(candidate=>[candidate.id,candidate])).values()];}
function trace(candidate,result,kind){
 const value=candidate.structuralWitness;assert.ok(value,'The candidate must retain its structural witness');assert.equal(value.graphVersion,result.graphVersion);assert.equal(value.query.kind,kind);assert.equal(value.query.completeness.complete,true);assert(value.witnessIds.length>0);assert.equal(value.witnesses.length,value.witnessIds.length);assert(value.witnesses.every(witness=>witness&&typeof witness==='object'));return value;
}

test('existing introduction, ambiguity and song actions retain their exact IDs, titles and priorities',()=>{
 const expected={
  'mama-introduction':[['task-bank:phrases.nice_to_meet_you:es','Try a first-meeting greeting',5.367],['task-bank:essentials.thanks:es','Express appreciation in a few words',4.167],['task-bank:phrases.please_repeat:es','Have a comfortable way to ask for repetition',3.767],['continue-media','Keep exploring',1.5]],
  'multiple-dictionary-meanings':[['senses:en:e29d1e2f','Compare the possible meanings',13.058],['continue-media','Keep reading or listening',5]],
  'one-song-line':[['source-bank:expressions.piece_of_cake:en','Understand this known phrase',10.55],['continue-media','Keep reading or listening',5]]
 };
 for(const [id,rows] of Object.entries(expected)){
  const result=fromFixture(id);assert.deepEqual(candidates(result).map(candidate=>[candidate.id,candidate.title,candidate.score.total]),rows,id);assert.equal(result.policy,'intent-next-step-v1');assert.equal(result.graphVersion,Query.graphVersion());
  for(const candidate of candidates(result))assert(capabilities[candidate.action.type]);
 }
});

test('the three introduction options come from real authored task-material witnesses without new evidence',()=>{
 const result=fromFixture('mama-introduction'),query=Query.taskMaterialWitnesses({purposeFamily:'introduction',sourceLang:'es',targetLang:'en'});
 assert.equal(result.structuralQueries.find(value=>value.kind==='task-material').completeness.complete,true);
 for(const candidate of candidates(result).filter(value=>value.kind==='bank-entry')){
  const actual=trace(candidate,result,'task-material'),answer=query.answers.find(value=>value.legacyConceptId===candidate.action.conceptId);assert.ok(answer);assert.deepEqual(actual.witnessIds,[answer.witnessId]);assert.deepEqual(actual.witnesses,[query.witnesses[answer.witnessId]]);assert.equal(candidate.evidence.status,'unknown');assert.equal(candidate.evidence.knowledgeEstimate,null);assert.equal(candidate.evidence.transferApplied,false);assert.deepEqual(candidate.evidence.referenceIds,[]);
 }
 assert.equal(result.primary.action.sourceLang,'es');assert.equal(result.task.optionalRubric.length,4);
});

test('ambiguous surface support preserves both alignment witnesses and never chooses a sense',()=>{
 const result=fromFixture('multiple-dictionary-meanings'),value=trace(result.primary,result,'surface');
 assert.equal(result.primary.action.type,'compare-senses');assert.deepEqual(result.primary.action.conceptIds,['home.light','colors.light']);assert.equal(value.witnessIds.length,2);assert.equal(value.query.status,'ambiguous');assert.equal(value.query.completeness.totalMatches,2);assert.equal(result.primary.evidence.status,'unknown');
 const query=Query.lookupAlignmentWitnesses({text:'light',sourceLang:'en',targetLang:'es'});assert.deepEqual(value.witnesses,query.answers.map(answer=>query.witnesses[answer.witnessId]));
});

test('a truncated surface query cannot turn one surviving answer into a resolved meaning',()=>{
 const result=fromFixture('multiple-dictionary-meanings',{structureBudget:{maxAnswers:1}}),surface=result.structuralQueries.find(value=>value.kind==='surface');
 assert.equal(surface.completeness.complete,false);assert.equal(surface.completeness.totalMatches,2);assert.equal(surface.completeness.truncated,true);assert.equal(surface.unresolvedAlternatives.length,1);assert.equal(surface.omittedAlternativeCount,1);assert.deepEqual(surface.alternativeCompleteness,{complete:false,totalAlternatives:2,returnedAlternatives:1,omittedAlternativeCount:1});assert(surface.completeness.work.proposals<=2);assert.equal(result.primary.kind,'continue-media');assert(!candidates(result).some(value=>['compare-senses','bank-entry'].includes(value.kind)));assert.equal(result.supportStatus,'unavailable');assert(result.notices.some(value=>value.includes('query was incomplete')));
});

test('an exhausted task query withholds partial introduction material while preserving Continue',()=>{
 for(const structureBudget of [{maxFactors:0},{maxAnswers:1}]){
  const result=fromFixture('mama-introduction',{structureBudget}),query=result.structuralQueries.find(value=>value.kind==='task-material');
  assert.equal(query.completeness.complete,false);assert.equal(result.primary.kind,'continue-media');assert(!candidates(result).some(value=>value.kind==='bank-entry'));assert.equal(result.continueAction.action.type,'continue-media');assert.equal(result.task.languages[0],'es');
 }
});

test('the occurrence query retains exact reader anchors and does not reuse an explanation at another occurrence',()=>{
 const item=X.itemById('a-book-for-rain'),annotation=item.annotations.find(value=>value.id==='a1'),text=X.sourceText(item),first=text.indexOf(annotation.quote),second=text.indexOf(annotation.quote,first+1);assert(second>first,'The real source repeats this quote');
 const source={contentId:item.id,contentVersion:item.version,sourceLang:'ar',targetLang:'en',text,selectedText:annotation.quote,selectionStart:first,hasMedia:true};
 const exact=recommend('I want to understand this paragraph.',source),value=trace(exact.primary,exact,'occurrence');assert.equal(exact.primary.action.type,'annotation');assert.equal(exact.primary.action.annotationId,annotation.id);
 const query=Query.occurrenceWitnesses({contentId:item.id,version:item.version,selectedText:annotation.quote,selectionStart:first});assert.deepEqual(value.witnesses,query.answers.map(answer=>query.witnesses[answer.witnessId]));
 const repeated=recommend('I want to understand this paragraph.',{...source,selectionStart:second});assert(!candidates(repeated).some(value=>value.kind==='annotation'));assert.equal(repeated.structuralQueries.find(value=>value.kind==='occurrence').completeness.totalMatches,0);
 const unlocated=recommend('I want to understand this paragraph.',{...source,selectionStart:null});assert(!candidates(unlocated).some(value=>value.kind==='annotation'));
});

test('an expression target preserves the authored meaning role rather than substituting the origin idiom',()=>{
 const concept=G.concept('expressions.in_the_clouds'),selected=concept.meaningTerms.en,source={sourceLang:'en',targetLang:'es',text:selected,selectedText:selected,selectionStart:0,hasMedia:true};
 const result=recommend('I want to understand this line.',source),value=trace(result.primary,result,'surface');assert.equal(result.primary.action.conceptId,concept.id);assert.equal(result.primary.description,G.translation(concept.id,'en','es').back);assert.equal(result.primary.description,concept.meaningTerms.es);assert.notEqual(result.primary.description,concept.terms.es);
 const query=Query.lookupAlignmentWitnesses({text:selected,sourceLang:'en',targetLang:'es'});assert.deepEqual(value.witnesses,[query.witnesses[query.answers[0].witnessId]]);
});

test('quality exclusions and source-specific quarantine remain closed after structural discovery',()=>{
 const source={sourceLang:'ar',targetLang:'en',text:'خال',selectedText:'خال',selectionStart:0,hasMedia:true};
 const result=recommend('I want to understand this word.',source);assert.equal(result.primary.kind,'continue-media');assert.equal(result.structuralQueries[0].completeness.totalMatches,1);assert(result.notices.some(value=>value.includes('additional context or verification')));assert.equal(result.noSafeSupport,true);
 const blocked=recommend('I want to understand this form.',{sourceLang:'es',targetLang:'en',text:'Mucho gusto.',selectedText:'Mucho gusto.',hasMedia:true,quarantineRecordId:'external-pdf-p073-output-001'});assert.equal(blocked.primary.kind,'continue-media');assert.deepEqual(blocked.structuralQueries,[],'The structural source gate runs before graph discovery');
});

test('graph witnesses are unchanged by a neighbor response and never become assessment evidence',()=>{
 const baseline=fromFixture('mama-introduction'),neighbor=G.related('phrases.nice_to_meet_you',1)[0].concept,card={id:'neighbor-card',conceptId:neighbor.id,sourceLang:'es',targetLang:'en'},logs=[{id:'neighbor-response',at:5000,cardId:card.id,before:card,rating:1,practiceMode:'production'}];
 const withNeighbor=fromFixture('mama-introduction',{cards:[card],logs});assert.deepEqual(withNeighbor.primary.structuralWitness,baseline.primary.structuralWitness);assert.deepEqual(withNeighbor.primary.evidence,baseline.primary.evidence);assert.deepEqual(withNeighbor.primary.score,baseline.primary.score);
 const direct={...card,id:'direct-card',conceptId:'phrases.nice_to_meet_you'},withDirect=fromFixture('mama-introduction',{cards:[direct],logs:[{...logs[0],id:'direct-response',cardId:direct.id,before:direct}]});
 assert.deepEqual(withDirect.primary.structuralWitness,baseline.primary.structuralWitness);assert.equal(withDirect.primary.evidence.status,'self-rated');assert.deepEqual(withDirect.primary.evidence.referenceIds,['direct-response']);assert.equal(withDirect.primary.evidence.knowledgeEstimate,null);assert.equal(withDirect.primary.evidence.transferApplied,false);
});

test('an organization introduction does not seed material for a learner exploring poetry without practice',()=>{
 const learner=record('I want to explore Arabic poetry with no particular end goal.',{preferences:['No quizzes']},{tenantId:'team-one'}),organization=record('Our team wants to meet Spanish customers.',{languages:['es']},{id:'graph-org-objective-001',ownerUserId:'team-owner',tenantId:'team-one',kind:'organization'});
 const result=Next.recommendNextSteps({intentContext:context(learner,organization),source:{hasMedia:false},capabilities,now});assert.equal(result.task.organizationObjective.id,organization.id);assert.equal(result.task.avoidPractice,true);assert.equal(result.primary.kind,'continue-media');assert(candidates(result).some(value=>value.kind==='open-content'));assert(!result.structuralQueries.some(value=>value.kind==='task-material'));assert(!candidates(result).some(value=>['practice-content','bank-entry'].includes(value.kind)));
});

test('the confirmed no-practice token preserves the existing prose preference behavior',()=>{
 const item=X.itemById('a-little-later'),source={contentId:item.id,contentVersion:item.version,sourceLang:'ar',targetLang:'en',text:X.sourceText(item),hasMedia:true};
 const token=recommend('I want to understand this dialogue.',source,{preferences:['no-practice']}),prose=recommend('I want to understand this dialogue.',source,{preferences:['No quizzes']});
 assert.equal(token.task.avoidPractice,true);assert.equal(token.task.wantsPractice,false);assert.equal(token.primary.kind,'continue-media');assert(!candidates(token).some(candidate=>candidate.kind==='practice-content'));assert.deepEqual(candidates(token).map(candidate=>({action:candidate.action,score:candidate.score})),candidates(prose).map(candidate=>({action:candidate.action,score:candidate.score})));
});

test('an inferred no-practice token remains unconfirmed and does not suppress optional practice',()=>{
 const item=X.itemById('a-little-later'),source={contentId:item.id,contentVersion:item.version,sourceLang:'ar',targetLang:'en',text:X.sourceText(item),hasMedia:true},intent=record('I want to understand this dialogue.',{preferences:['no-practice']});
 intent.provenance.fields.preferences={status:'inferred',source:'provider'};
 const result=Next.recommendNextSteps({intentContext:context(Intent.validateIntentRecord(intent)),source,capabilities,now}),baseline=recommend('I want to understand this dialogue.',source);
 assert.equal(result.task.avoidPractice,false);assert.deepEqual(result.task.preferences,[]);assert.equal(result.task.provenance.intent.fields.preferences.status,'inferred');assert(candidates(result).some(candidate=>candidate.kind==='practice-content'));assert.deepEqual(candidates(result).map(candidate=>({action:candidate.action,score:candidate.score})),candidates(baseline).map(candidate=>({action:candidate.action,score:candidate.score})));
});

test('graph metadata is additive and cannot mutate source snapshots, inputs or later witnesses',()=>{
 const f=fixtures.find(value=>value.id==='one-song-line'),source=structuredClone(f.source),before=structuredClone(source),snapshot=Next.sourceSnapshot(source),result=recommend(f.intent,source,f.edits||{}),witness=structuredClone(result.primary.structuralWitness);
 assert.deepEqual(source,before);assert.deepEqual(result.sourceSnapshot,snapshot);assert.equal(Object.hasOwn(result.sourceSnapshot,'graphVersion'),false);assert.equal(result.graphVersion,Query.graphVersion());assert.match(result.taskKey,/^next1:/);assert.equal(result.primary.score.contributions.some(value=>/graph|centrality|coverage|unlock/i.test(value.name)),false);
 result.primary.structuralWitness.witnesses.length=0;result.structuralQueries.length=0;
 const again=recommend(f.intent,source,f.edits||{});assert.deepEqual(again.primary.structuralWitness,witness);assert.equal(again.taskKey,result.taskKey);assert.deepEqual(source,before);
});
