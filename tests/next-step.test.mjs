import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as Next from '../public/nabu-next-step.js';
import * as Intent from '../public/nabu-intents.js';
import * as G from '../public/nabu-graph.js';
import * as X from '../public/nabu-content.js';

const capabilities=Object.fromEntries(Next.NEXT_STEP_ACTIONS.map(x=>[x,true]));
const fixtures=JSON.parse(await readFile(new URL('./fixtures/next-steps.json',import.meta.url),'utf8')).cases;
function record(rawText,edits={},extras={}){
 return {schemaVersion:1,id:'test-intent-00000001',ownerUserId:'alice',tenantId:null,kind:'learner',...Intent.editIntentContent(Intent.parseIntentLocal(rawText),edits),createdAt:1000,updatedAt:1000,statusChangedAt:1000,revision:1,...extras};
}
function context(intent,organizationObjective=null){
 return {schemaVersion:1,actor:{kind:intent?.tenantId?'team':'individual',userId:'alice',tenantId:intent?.tenantId||null},selection:intent?{mode:'selected',intentId:intent.id}:{mode:'exploring',intentId:null},immediateIntent:intent,organizationObjective};
}
function recommend(rawText,source={},edits={},extra={}){
 return Next.recommendNextSteps({intentContext:context(record(rawText,edits)),source,capabilities,...extra});
}
const allActions=result=>[result.primary,...result.alternatives,result.continueAction].filter(Boolean);
function sourceFor(item,annotation=null){
 const text=X.sourceText(item);return {contentId:item.id,contentVersion:item.version,sourceLang:item.language,targetLang:item.translationLanguage,text,selectedText:annotation?.quote||'',selectionStart:annotation?text.indexOf(annotation.quote):null,hasMedia:true};
}

test('all required fictional action scenarios produce supported grounded suggestions',()=>{
 for(const f of fixtures){
  const result=recommend(f.intent,f.source,f.edits||{});
  assert.equal(result.primary?.kind,f.expectedPrimaryKind,f.id);
  assert.equal(result.policy,'intent-next-step-v1');assert.equal(result.continueAction.kind,'continue-media');
  for(const candidate of allActions(result))assert(capabilities[candidate.action.type],f.id+' has an unavailable action');
 }
});

test('mamá context uses optional outcomes and authored phrase options without cultural rules',()=>{
 const f=fixtures[0],result=recommend(f.intent,f.source,f.edits);
 assert.equal(result.primary.action.conceptId,'phrases.nice_to_meet_you');
 assert.equal(result.primary.description,'Mucho gusto.');assert.equal(result.task.optionalRubric.length,4);
 assert(result.task.optionalRubric.every(x=>x.required===false&&x.status==='suggested'));
 assert(result.task.optionalRubric.some(x=>x.id==='genuine-question'));
 assert(result.task.optionalRubric.some(x=>x.id==='follow-response'));
 assert.match(result.primary.qualityLabel,/not native-speaker reviewed/);
 assert.match(result.primary.why,/person’s preferences/);
 assert.equal(result.task.broaderDestination.text,'make a good impression');
 assert.equal(result.task.organizationObjective,null);
});

test('mamá alone does not infer Spanish and offers a working intent correction action',()=>{
 const result=recommend(fixtures[0].intent,fixtures[0].source);
 assert.deepEqual(result.task.languages,[]);assert.equal(result.primary.kind,'edit-intent');
 assert(!allActions(result).some(x=>x.action.type==='bank-entry'));
 assert(result.notices.some(x=>x.includes('nationality')));
 assert.equal(result.noSafeSupport,true);
});

test('an inferred language cannot silently drive introduction content',()=>{
 const intent=record(fixtures[0].intent,{languages:['es']});
 intent.provenance.fields.languages={status:'inferred',source:'provider'};
 const result=Next.recommendNextSteps({intentContext:context(intent),source:fixtures[0].source,capabilities});
 assert.deepEqual(result.task.languages,[]);assert.equal(result.primary.kind,'edit-intent');
});

test('field-level inferred activity overrides contradictory explicit or exploratory objective labels',()=>{
 for(const objectiveStatus of ['explicit','exploratory']){
  const intent=record(fixtures[0].intent,{languages:['es']});
  intent.immediateActivity='Meet Alexandra’s mother';intent.objectiveStatus=objectiveStatus;
  intent.provenance.fields.immediateActivity={status:'inferred',source:'provider'};
  Intent.validateIntentRecord(intent);
  const result=Next.recommendNextSteps({intentContext:context(intent),source:fixtures[0].source,capabilities});
  assert.equal(result.task.purposeStatus,'inferred');assert.equal(result.task.purposeFamily,'current-activity');
  assert(!allActions(result).some(x=>x.kind==='bank-entry'));
  assert(result.notices.some(x=>x.includes('unconfirmed')));
 }
});

test('multiple actual bank meanings remain explicit alternatives, not an automatic parse',()=>{
 const f=fixtures[1],result=recommend(f.intent,f.source);
 assert.equal(result.primary.kind,'compare-senses');
 assert.deepEqual(new Set(result.primary.action.conceptIds),new Set(['home.light','colors.light']));
 assert.match(result.primary.uncertainty.linguistic,/unresolved/);
 assert.equal(result.primary.evidence.status,'unknown');
 assert(result.primary.score.contributions.find(x=>x.name==='informationOpportunity').value>0);
 assert.match(result.primary.score.contributions.find(x=>x.name==='informationOpportunity').reason,/not calibrated/);
});

test('a familiar selected song line receives only bounded phrase support and no quiz',()=>{
 const f=fixtures[2],result=recommend(f.intent,f.source);
 assert.equal(result.primary.action.conceptId,'expressions.piece_of_cake');
 assert(!allActions(result).some(x=>x.kind==='practice-content'));
 assert(result.primary.score.contributions.some(x=>x.reason.includes('does not explain the rest of the song')));
 assert.equal(result.task.broaderDestination,null);
});

test('an unknown song line does not acquire an invented translation or exercise',()=>{
 const result=recommend('I want to understand this song.',{sourceLang:'es',targetLang:'en',text:'una línea ficticia fuera del banco',selectedText:'una línea ficticia fuera del banco',format:'song',hasMedia:true});
 assert.equal(result.primary.kind,'continue-media');assert.equal(result.noSafeSupport,true);
 assert.equal(result.alternatives.length,0);assert(result.notices.some(x=>x.includes('No safe local explanation')));
});

test('open-ended Arabic poetry offers actual existing content without requiring a destination',()=>{
 const f=fixtures[3],result=recommend(f.intent,f.source);
 assert.equal(result.task.purposeStatus,'exploratory');assert.equal(result.task.broaderDestination,null);
 assert.deepEqual(result.task.optionalRubric,[]);
 assert.equal(result.primary.kind,'open-content');
 const item=X.itemById(result.primary.action.contentId,result.primary.action.version);
 assert.equal(item.genre,'poetry');assert.equal(item.language,'ar');assert(result.primary.provenance.length);
 assert(!allActions(result).some(x=>x.kind==='practice-content'));
});

test('an unexplained generated-form provenance does not become a trustworthy recommendation',()=>{
 const f=fixtures[4],result=recommend(f.intent,f.source);
 assert.equal(result.primary.kind,'continue-media');assert.equal(result.noSafeSupport,true);
 assert(result.notices.length>0);
 assert(!result.notices.some(x=>/invalid Spanish|ungrammatical|not a word/iu.test(x)),'The gate does not make an unsupported linguistic judgment.');
});

test('quarantined provenance cannot be rescued by a familiar bank spelling',()=>{
 const result=recommend('I want to understand this phrase.',{sourceLang:'es',targetLang:'en',text:'Mucho gusto.',selectedText:'Mucho gusto.',structuralStatus:'quarantined',hasMedia:true});
 assert.equal(result.primary.kind,'continue-media');assert.equal(result.noSafeSupport,true);
 assert(!allActions(result).some(x=>x.kind==='bank-entry'));
});

test('a quarantined current source does not offer practice that could reuse the flagged material',()=>{
 const item=X.itemById('a-little-later'),source={...sourceFor(item,item.annotations[0]),structuralStatus:'quarantined'};
 const result=recommend('I want to practice this dialogue.',source);
 assert.equal(result.primary.kind,'continue-media');
 assert(!allActions(result).some(x=>x.kind==='practice-content'||x.kind==='annotation'));
});

test('source-specific quarantine metadata reaches the structural gate without a spelling blacklist',()=>{
 const source={sourceLang:'es',targetLang:'en',text:'Mucho gusto.',selectedText:'Mucho gusto.',structuralStatus:'authored-unreviewed',analysisProvenance:[{sourceId:'authored-fixture',lineageId:'authored-fixture',locator:'line1',kind:'authored-fixture'}],hasMedia:true};
 const ordinary=recommend('I want to understand this phrase.',source);
 assert.equal(ordinary.primary.kind,'bank-entry');
 const flagged=recommend('I want to understand this phrase.',{...source,quarantineRecordId:'external-pdf-p073-output-001'});
 assert.equal(flagged.primary.kind,'continue-media');assert.notEqual(flagged.taskKey,ordinary.taskKey);
 assert(flagged.notices.some(x=>x.includes('metadata')));
 const markerOnly=recommend('I want to understand this phrase.',{...source,structuralStatus:null,quarantineRecordId:'external-pdf-p073-output-001'});
 assert.equal(markerOnly.primary.kind,'continue-media');
});

test('an exact quarantined record supplied only through analysis provenance still blocks support',()=>{
 const source={sourceLang:'es',targetLang:'en',text:'Mucho gusto.',selectedText:'Mucho gusto.',hasMedia:true};
 const ordinary=recommend('I want to understand this phrase.',source);
 const flagged=recommend('I want to understand this phrase.',{...source,analysisProvenance:[{sourceId:'pdf:nabu-language-graph-workspace-1',recordId:'external-pdf-p073-output-001'}]});
 assert.equal(ordinary.primary.kind,'bank-entry');assert.equal(flagged.primary.kind,'continue-media');
 assert(flagged.notices.some(x=>x.includes('metadata')));assert.notEqual(flagged.taskKey,ordinary.taskKey);
});

test('missing history stays unknown and carries no deficit score',()=>{
 const result=recommend('I want to understand this phrase.',{sourceLang:'es',targetLang:'en',text:'Mucho gusto.',selectedText:'Mucho gusto.',hasMedia:true});
 const candidate=result.primary;assert.equal(candidate.evidence.status,'unknown');assert.equal(candidate.evidence.observations,0);
 assert.equal(candidate.evidence.knowledgeEstimate,null);assert.equal(candidate.evidence.transferApplied,false);
 assert.equal(candidate.score.contributions.find(x=>x.name==='directLearnerEvidence').value,0);
 assert(candidate.why&&!/you (?:do not|don't) know|you lack/iu.test(candidate.why));
});

test('graph-neighbor performance never transfers knowledge or need to a different meaning',()=>{
 const f=fixtures[0],neighbor=G.related('phrases.nice_to_meet_you',1)[0].concept;
 const card={id:'neighbor-card',conceptId:neighbor.id,sourceLang:'es',targetLang:'en',schedule:{reps:100}};
 const logs=[{id:'neighbor-log',cardId:card.id,before:card,at:3000,rating:1,practiceMode:'production'}];
 const result=recommend(f.intent,f.source,f.edits,{cards:[card],logs});
 assert.equal(result.primary.action.conceptId,'phrases.nice_to_meet_you');assert.equal(result.primary.evidence.status,'unknown');
 assert.equal(result.primary.score.contributions.find(x=>x.name==='directLearnerEvidence').value,0);
});

test('translation neighbors do not transfer performance between languages',()=>{
 const f=fixtures[0],card={id:'arabic-card',conceptId:'phrases.nice_to_meet_you',sourceLang:'ar',targetLang:'en'};
 const result=recommend(f.intent,f.source,f.edits,{cards:[card],logs:[{id:'arabic-log',cardId:card.id,before:card,at:3000,rating:1,practiceMode:'production'}]});
 assert.equal(result.primary.evidence.status,'unknown');assert.equal(result.primary.evidence.observations,0);
});

test('recognition, production, listening, and cloze observations remain separate',()=>{
 const card={id:'spanish-card',conceptId:'phrases.nice_to_meet_you',sourceLang:'es',targetLang:'en'},logs=[{id:'production-log',cardId:card.id,before:card,at:3000,rating:1,practiceMode:'production'}];
 const result=recommend('I want to understand this phrase.',{sourceLang:'es',targetLang:'en',text:'Mucho gusto.',selectedText:'Mucho gusto.',hasMedia:true},{},{cards:[card],logs});
 assert.equal(result.primary.evidence.status,'unknown');assert.equal(result.primary.evidence.mode,'recognition');
 assert.equal(result.primary.evidence.modes.production.status,'self-rated');assert.equal(result.primary.evidence.modes.listening.status,'unknown');
 assert.equal(result.primary.score.contributions.find(x=>x.name==='directLearnerEvidence').value,0);
});

test('direct self-ratings are labeled observations, not objectively graded production',()=>{
 const f=fixtures[0],card={id:'spanish-card',conceptId:'phrases.nice_to_meet_you',sourceLang:'es',targetLang:'en'},logs=[{id:'production-log',cardId:card.id,before:card,at:3000,rating:1,practiceMode:'production'}];
 const result=recommend(f.intent,f.source,f.edits,{cards:[card],logs});
 assert.equal(result.primary.evidence.status,'self-rated');assert.equal(result.primary.evidence.mode,'production');
 assert.equal(result.primary.evidence.observations,1);assert.equal(result.primary.evidence.knowledgeEstimate,null);
 assert(result.primary.score.contributions.find(x=>x.name==='directLearnerEvidence').value>0);
});

test('schedules and saved cards without response records do not create performance evidence',()=>{
 const f=fixtures[0],card={id:'scheduled-card',conceptId:'phrases.nice_to_meet_you',sourceLang:'es',targetLang:'en',schedule:{reps:100,lapses:0,state:'review'},skills:{production:{reps:50}}};
 const result=recommend(f.intent,f.source,f.edits,{cards:[card]});
 assert.equal(result.primary.evidence.status,'unknown');assert.equal(result.primary.evidence.observations,0);
});

test('conflicting organization objective remains separate and does not reroute personal poetry',()=>{
 const personal=record('I want to explore Arabic poetry with no particular end goal.',{}, {tenantId:'team-a'});
 const org=record('Our team needs to handle customer-support calls in Spanish.',{destination:'Handle support calls in Spanish',languages:['es']},{id:'organization-objective-01',ownerUserId:'team-owner',tenantId:'team-a',kind:'organization'});
 const result=Next.recommendNextSteps({intentContext:context(personal,org),source:{sourceLang:'ar',targetLang:'en'},capabilities});
 assert.equal(result.primary.kind,'open-content');assert.equal(result.task.broaderDestination,null);
 assert.deepEqual(result.task.languages,['ar']);assert.deepEqual(result.task.organizationObjective.languages,['es']);
 assert(result.notices.some(x=>x.includes('shown separately')));
});

test('summarized organization context retains inferred fields and their provenance',()=>{
 const personal=record('I want to explore Arabic poetry with no particular end goal.',{}, {tenantId:'team-a'});
 const org=record('Our team needs to handle support calls.',{destination:'Handle support calls in Spanish',languages:['es']},{id:'inferred-organization-01',ownerUserId:'team-owner',tenantId:'team-a',kind:'organization'});
 for(const key of ['immediateActivity','destination','languages'])org.provenance.fields[key]={status:'inferred',source:'provider'};
 org.objectiveStatus='explicit';
 const result=Next.recommendNextSteps({intentContext:context(personal,org),source:{sourceLang:'ar',targetLang:'en'},capabilities});
 const summary=result.task.organizationObjective;
 assert.equal(summary.purposeStatus,'inferred');assert.equal(summary.objectiveStatus,'inferred');assert.equal(summary.declaredObjectiveStatus,'explicit');
 assert.equal(summary.destinationStatus,'inferred');assert.deepEqual(summary.languages,[]);assert.deepEqual(summary.suggestedLanguages,['es']);
 assert.equal(summary.provenance.fields.languages.source,'provider');assert.deepEqual(result.task.languages,['ar']);
});

test('unknown objective and entirely absent evidence remain a valid exploratory session',()=>{
 const result=recommend('???',{});
 assert.equal(result.task.purpose,'???');assert.equal(result.task.purposeStatus,'unknown');
 assert.equal(result.primary.kind,'continue-media');assert.equal(result.task.broaderDestination,null);
 assert.deepEqual(result.task.languages,[]);assert.deepEqual(result.task.optionalRubric,[]);
});

test('no action capability means no invented button target',()=>{
 const result=Next.recommendNextSteps({intentContext:context(record(fixtures[0].intent,{languages:['es']})),source:fixtures[0].source,capabilities:{}});
 assert.equal(result.primary,null);assert.equal(result.continueAction,null);assert.deepEqual(result.alternatives,[]);assert.equal(result.noSafeSupport,true);
});

test('concise reasons, meaningful alternatives, and a separate continue choice are always grounded',()=>{
 const result=recommend(fixtures[0].intent,fixtures[0].source,fixtures[0].edits);
 assert.equal(result.alternatives.length,2);assert(result.primary.why.length<350);
 assert.equal(result.continueAction.kind,'continue-media');
 assert.equal(new Set([result.primary.id,...result.alternatives.map(x=>x.id)]).size,3);
 for(const c of allActions(result)){
  assert(c.why);assert(Number.isFinite(c.score.total));
  assert(c.score.contributions.every(x=>Number.isFinite(x.value)&&x.reason));
  assert(Math.abs(c.score.total-c.score.contributions.reduce((sum,x)=>sum+x.value,0))<.001);
  assert(!c.score.contributions.some(x=>/centrality|coverage|Steiner|unlock/iu.test(x.name)));
  if(c.kind==='bank-entry')assert(G.concept(c.action.conceptId));
 }
});

test('current annotation uses its actual source, quote, and editorial provenance',()=>{
 const item=X.itemById('imru-al-qais-stop-and-weep'),annotation=item.annotations[0],source=sourceFor(item,annotation);
 const result=recommend('I want to understand this poem.',source);
 assert.equal(result.primary.kind,'annotation');assert.equal(result.primary.action.annotationId,annotation.id);
 assert.equal(result.primary.description,annotation.meaning);assert.equal(result.primary.provenance[0].recordId,item.id);
 assert.match(result.primary.qualityLabel,/draft|not instructor-reviewed/iu);
});

test('a stale content ID cannot attach old annotations to edited reader text',()=>{
 const item=X.itemById('imru-al-qais-stop-and-weep'),source=sourceFor(item,item.annotations[0]);source.text+=' changed';
 const result=recommend('I want to understand this poem.',source);
 assert(!allActions(result).some(x=>x.kind==='annotation'||x.kind==='practice-content'));
});

test('reading engagement is not a successful recognition or recall observation',()=>{
 const item=X.itemById('a-little-later'),annotation=item.annotations[0],source=sourceFor(item,annotation);
 const events=['opened','finished','preference'].map((kind,i)=>({id:'engagement-event-00000'+i,contentId:item.id,version:item.version,kind,at:1000+i,...(kind==='opened'?{}:{value:true})}));
 const result=recommend('I want to understand this dialogue.',source,{}, {contentEvents:events});
 assert.equal(result.primary.kind,'annotation');assert.equal(result.primary.evidence.status,'unknown');
 assert.equal(result.primary.evidence.observations,0);assert.equal(result.primary.evidence.engagement.finished,true);
 assert.equal(result.primary.evidence.knowledgeEstimate,null);
});

test('supported practice is optional and never becomes the default for quiet reading',()=>{
 const item=X.itemById('a-little-later'),source=sourceFor(item);
 const result=recommend('I want to read this dialogue.',source);
 assert.equal(result.primary.kind,'continue-media');
 const practice=result.alternatives.find(x=>x.kind==='practice-content');assert(practice);
 assert(item.practice.some(x=>x.id===practice.action.activityId));assert.match(practice.why,/optional/iu);
});

test('an explicit practice request can prioritize an actual existing authored activity',()=>{
 const item=X.itemById('a-little-later'),result=recommend('I want to practice this dialogue.',sourceFor(item));
 assert.equal(result.primary.kind,'practice-content');assert(item.practice.some(x=>x.id===result.primary.action.activityId));
 assert.equal(result.continueAction.kind,'continue-media');
});

test('explicit no-quiz preferences remove practice and prioritize continuing',()=>{
 const item=X.itemById('a-little-later'),result=recommend('I want to read this dialogue.',sourceFor(item),{preferences:['No quizzes. Just reading.']});
 assert.equal(result.primary.kind,'continue-media');assert(!allActions(result).some(x=>x.kind==='practice-content'));
 assert(result.primary.score.contributions.find(x=>x.name==='explicitPreference').value>0);
});

test('authored assisted recall stays bounded and does not become unaided performance',()=>{
 const item=X.itemById('a-little-later'),task=item.practice.find(x=>x.mode==='recall');
 const event={id:'recall-response-000001',contentId:item.id,version:item.version,kind:'attempt',activityId:task.id,sessionId:'session-one',at:1000,answer:task.accepted[0],assisted:true,skipped:false};
 const annotation=item.annotations.find(a=>a.id===task.annotationId);
 const result=recommend('I want to understand this dialogue.',sourceFor(item,annotation),{},{contentEvents:[event]});
 assert.equal(result.primary.evidence.status,'authored-response');assert.equal(result.primary.evidence.lastOutcome,'assisted-correct');
 assert.equal(result.primary.evidence.lastAssisted,true);assert.equal(result.primary.evidence.knowledgeEstimate,null);
});

test('an unrelated annotation response never supplies evidence for the selected expression',()=>{
 const item=X.itemById('a-little-later'),selected=item.annotations.find(a=>a.id==='a1'),activity=item.practice.find(p=>p.mode==='recognition');
 assert.notEqual(activity.annotationId,selected.id);
 const event={id:'unrelated-attempt-0001',contentId:item.id,version:item.version,kind:'attempt',activityId:activity.id,sessionId:'session-one',at:1000,choice:(activity.answer+1)%activity.options.length,assisted:false,skipped:false};
 const result=recommend('I want to understand this dialogue.',sourceFor(item,selected),{},{contentEvents:[event]});
 assert.equal(result.primary.kind,'annotation');assert.equal(result.primary.evidence.status,'unknown');
 assert.equal(result.primary.evidence.observations,0);assert.equal(result.primary.score.contributions.find(x=>x.name==='directLearnerEvidence').value,0);
});

test('recorded help overrides an inconsistent unaided claim before routing or grading summaries',()=>{
 const item=X.itemById('a-little-later'),activity=item.practice.find(p=>p.mode==='recall'),annotation=item.annotations.find(a=>a.id===activity.annotationId);
 const common={contentId:item.id,version:item.version,activityId:activity.id,sessionId:'same-session'};
 const events=[{...common,id:'prior-help-event-0001',kind:'help',help:'hint',at:1000},{...common,id:'later-attempt-event-01',kind:'attempt',at:1001,answer:activity.accepted[0],assisted:false,skipped:false}];
 const before=structuredClone(events),result=recommend('I want to understand this dialogue.',sourceFor(item,annotation),{},{contentEvents:events});
 assert.equal(result.primary.evidence.lastOutcome,'assisted-correct');assert.equal(result.primary.evidence.lastAssisted,true);
 assert.deepEqual(result.primary.evidence.assistanceEvidence,['prior-help-event-0001']);
 const practice=result.alternatives.find(x=>x.kind==='practice-content');assert.equal(practice.action.activityId,activity.id);
 assert.deepEqual(events,before,'Conservative reconciliation is a read-only view.');
});

test('a repeated spelling outside its authored anchor cannot reuse the annotation',()=>{
 const item=X.itemById('a-book-for-rain'),annotation=item.annotations.find(a=>a.id==='a1'),text=X.sourceText(item);
 const first=text.indexOf(annotation.quote),later=text.indexOf(annotation.quote,first+1);assert(later>first);
 const result=recommend('I want to understand this passage.',{...sourceFor(item,annotation),selectionStart:later});
 assert(!allActions(result).some(x=>x.kind==='annotation'));
 const ambiguousOffset=recommend('I want to understand this passage.',{...sourceFor(item,annotation),selectionStart:null});
 assert(!allActions(ambiguousOffset).some(x=>x.kind==='annotation'));
});

test('team scope cannot borrow a private intent or organization objective from elsewhere',()=>{
 const foreign=record(fixtures[0].intent,{languages:['es']},{ownerUserId:'bob',tenantId:'team-b'});
 const org=record('Our team needs to speak Spanish.',{}, {id:'foreign-organization-001',ownerUserId:'bob',tenantId:'team-b',kind:'organization'});
 const intentContext={...context(foreign,org),actor:{kind:'team',userId:'alice',tenantId:'team-a'}};
 const result=Next.recommendNextSteps({intentContext,source:{},capabilities});
 assert.equal(result.intentRef,null);assert.equal(result.task.organizationObjective,null);assert.deepEqual(result.task.languages,[]);
 assert.equal(result.primary.kind,'continue-media');
});

test('source and task revision keys change when actions become stale',()=>{
 const intent=record(fixtures[1].intent),input={intentContext:context(intent),source:fixtures[1].source,capabilities};
 const a=Next.recommendNextSteps(input),b=Next.recommendNextSteps({...input,source:{...input.source,text:'A different source with light.'}});
 assert.notEqual(a.taskKey,b.taskKey);assert.notDeepEqual(a.sourceSnapshot,b.sourceSnapshot);
 const c=Next.recommendNextSteps({...input,intentContext:context({...intent,revision:2,updatedAt:1001})});
 assert.notEqual(a.taskKey,c.taskKey);assert.deepEqual(c.intentRef,{id:intent.id,revision:2});
});

test('bad source offsets cannot fabricate a selected occurrence',()=>{
 const result=recommend(fixtures[1].intent,{...fixtures[1].source,selectionStart:0});
 assert.equal(result.primary.kind,'continue-media');assert(!allActions(result).some(x=>x.kind==='compare-senses'));
 assert(result.notices.some(x=>x.includes('no longer matches')));
});

test('recommendation is deterministic and never modifies media, intents, evidence, or schedules',()=>{
 const item=X.itemById('a-little-later'),input={intentContext:context(record('I want to read this dialogue.')),source:sourceFor(item),cards:[],logs:[],contentEvents:[],capabilities};
 const before=structuredClone(input),a=Next.recommendNextSteps(input),b=Next.recommendNextSteps(input);
 assert.deepEqual(a,b);assert.deepEqual(input,before);
 assert(!Object.hasOwn(a,'mastery'));assert(!Object.hasOwn(a,'posterior'));
});

test('legacy personal evidence is explicitly not labeled as team-attributed',()=>{
 const result=recommend(fixtures[1].intent,fixtures[1].source,{}, {evidenceScope:{ownerUserId:'alice',kind:'personal-account',tenantAttribution:'not-recorded'}});
 assert.equal(result.evidenceScope.tenantAttribution,'not-recorded');
 assert(result.notices.some(x=>x.includes('not recorded as team-specific')));
});
