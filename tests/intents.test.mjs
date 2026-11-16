import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as Intent from '../public/nabu-intents.js';
import * as C from '../public/nabu-core.js';

const fixtures=JSON.parse(await readFile(new URL('./fixtures/intents.json',import.meta.url),'utf8')).cases;
const poem=()=>Intent.parseIntentLocal('I want to explore Arabic poetry with no particular end goal.');

test('all four realistic fixtures validate and distinguish team objectives from member activities',()=>{
 assert.equal(fixtures.length,4);
 for(const f of fixtures){
  assert.deepEqual(Intent.validateIntentContent(f.content),f.content);
  const withDestination=f.caseId.endsWith('with-destination');
  assert.equal(Boolean(f.content.destination),withDestination);
  if(f.kind==='organization'){
   assert(f.tenantId);assert(f.learnerContent);
   assert.notEqual(f.learnerContent.immediateActivity,f.content.immediateActivity);
   assert.equal(f.learnerContent.destination,null);
  }
 }
});

test('Alexandra’s mamá does not fabricate Spanish, proficiency, dates, or a modality',()=>{
 const p=fixtures[0].content;
 assert.equal(p.destination,'make a good impression');
 assert.equal(p.immediateActivity,'I want to meet my girlfriend Alexandra’s Mexican mother');
 assert.deepEqual(p.languages,[]);assert.deepEqual(p.modalities,[]);
 assert.equal(p.timeHorizon,null);assert.equal(p.context,null);
 assert.deepEqual(p.provenance.fields.languages,{status:'unknown',source:'none'});
});

test('raw free text is preserved verbatim, including surrounding spaces and Arabic script',()=>{
 const raw='  أريد أن أقرأ هذه القصيدة، ثم أفهمها.  ';
 const p=Intent.parseIntentLocal(raw);
 assert.equal(p.rawText,raw);
 assert.deepEqual(p.languages,[],'The script alone does not establish a target language.');
});

test('exploratory poetry has an explicit language and no compulsory destination',()=>{
 const p=poem();
 assert.equal(p.objectiveStatus,'exploratory');assert.equal(p.destination,null);
 assert.deepEqual(p.languages,['ar']);assert.equal(p.timeHorizon,null);
 assert.equal(p.provenance.fields.immediateActivity.status,'exploratory');
 assert.equal(p.provenance.fields.languages.status,'explicit');
});

test('understand this song is a complete immediate activity without assuming listening',()=>{
 const p=Intent.parseIntentLocal('I want to understand this song.');
 assert.equal(p.immediateActivity,p.rawText);assert.equal(p.destination,null);
 assert.deepEqual(p.modalities,[]);assert.deepEqual(p.languages,[]);
 assert.equal(p.objectiveStatus,'explicit');
});

test('an article paragraph stays an immediate reading activity',()=>{
 const p=Intent.parseIntentLocal('I’m reading an article and want to understand this paragraph.');
 assert.deepEqual(p.modalities,['reading']);assert.equal(p.destination,null);
});

test('topic clauses do not become explicit learner modalities or languages',()=>{
 for(const [rawText,languages,modalities] of [
  ['I want to read this article about public speaking.',[],['reading']],
  ['I want to understand this song about speaking French.',[],[]],
  ['I want to read a Spanish article about learning Arabic.',['es'],['reading']]
 ]){
  const p=Intent.parseIntentLocal(rawText);
  assert.equal(p.rawText,rawText);assert.equal(p.immediateActivity,rawText);
  assert.deepEqual(p.languages,languages);assert.deepEqual(p.modalities,modalities);
 }
});

test('empty, whitespace, oversized, and control-character input cannot create a goal',()=>{
 for(const raw of ['', '   ', '\n\t', 'a'.repeat(1201), 'hello\u0000world'])assert.throws(()=>Intent.parseIntentLocal(raw));
});

test('ambiguous input remains unknown while preserving the statement',()=>{
 for(const raw of ['???','maybe something with music','perhaps I want to learn Spanish','I do not want to speak Spanish','I want to','I am unsure','I’m bored','I want to understand this song but I cannot speak Spanish']){
  const p=Intent.parseIntentLocal(raw);
  assert.equal(p.rawText,raw);assert.equal(p.immediateActivity,null);
  assert.equal(p.objectiveStatus,'unknown');assert.equal(p.destination,null);
  assert.deepEqual(p.languages,[]);assert.deepEqual(p.modalities,[]);
 }
});

test('disjunctive languages are not resolved arbitrarily',()=>{
 const p=Intent.parseIntentLocal('I want to read in Spanish or Arabic.');
 assert.deepEqual(p.languages,[]);
});

test('all existing Nabu languages are accepted when explicitly stated',()=>{
 for(const [code,name] of C.LANGUAGES){
  const p=Intent.parseIntentLocal('I want to read an article in '+name+'.');
  assert.deepEqual(p.languages,[code]);assert.equal(p.provenance.fields.languages.status,'explicit');
 }
});

test('an explicit destination marker preserves the user’s wording',()=>{
 const p=Intent.parseIntentLocal('I want to practice speaking in Spanish so that I can hold a conversation.');
 assert.equal(p.immediateActivity,'I want to practice speaking in Spanish');
 assert.equal(p.destination,'I can hold a conversation');
 assert.deepEqual(p.languages,['es']);assert.deepEqual(p.modalities,['speaking']);
 assert.equal(p.timeHorizon,null);
});

test('a source reference is retained without duplicating a private paragraph',()=>{
 const p=Intent.parseIntentLocal('I want to understand this paragraph.',{sourceContent:{id:'a-little-later',version:'1'}});
 assert.deepEqual(p.sourceContent,{id:'a-little-later',version:'1'});
 assert.equal(p.provenance.fields.sourceContent.source,'reader_context');
 assert.throws(()=>Intent.parseIntentLocal('Read this.',{sourceContent:{id:'reader',version:null,text:'private paragraph'}}),/reference/);
});

test('field edits are explicit and optional context is never inferred',()=>{
 const p=Intent.editIntentContent(fixtures[0].content,{languages:['es'],modalities:['speaking'],timeHorizon:'Saturday evening',context:'First family introduction',constraints:['Ten minutes today'],preferences:['Polite, natural expressions']});
 assert.deepEqual(p.languages,['es']);assert.equal(p.timeHorizon,'Saturday evening');
 for(const field of ['languages','modalities','timeHorizon','context','constraints','preferences'])assert.deepEqual(p.provenance.fields[field],{status:'explicit',source:'user_edit'});
 assert.equal(p.rawText,fixtures[0].rawText);
});

test('replacing the original text clears stale language, destination, and source extractions',()=>{
 let p=Intent.editIntentContent(fixtures[0].content,{languages:['es'],sourceContent:{id:'old-reader-item',version:'1'}});
 p=Intent.editIntentContent(p,{rawText:'maybe something with music'});
 assert.equal(p.immediateActivity,null);assert.equal(p.destination,null);
 assert.deepEqual(p.languages,[]);assert.equal(p.sourceContent,null);
 assert.equal(p.objectiveStatus,'unknown');
});

test('clearing a field clears its evidence and preserves the creation statement',()=>{
 const p=Intent.editIntentContent(poem(),{languages:[],immediateActivity:null});
 assert.deepEqual(p.provenance.fields.languages,{status:'unknown',source:'none'});
 assert.deepEqual(p.provenance.fields.immediateActivity,{status:'unknown',source:'none'});
 assert.equal(p.objectiveStatus,'unknown');
});

test('provider receives no text unless an adapter and explicit permit are both present',async()=>{
 let calls=0;const parser=async()=>{calls++;return {languages:['es']};};
 const p=await Intent.parseIntent('I want to understand this song.',{parser});
 assert.equal(calls,0);assert.deepEqual(p.languages,[]);
 assert.deepEqual(await Intent.parseIntent(p.rawText,{allowExternalParser:true}),p);
});

test('provider suggestions remain inferred even if the provider asserts certainty',async()=>{
 const p=await Intent.parseIntent('maybe something with music',{allowExternalParser:true,parser:async()=>({immediateActivity:'Listen to a song',languages:['es'],objectiveStatus:'explicit',provenance:{fields:{languages:{status:'explicit'}}}})});
 assert.equal(p.objectiveStatus,'inferred');assert.equal(p.provenance.fields.languages.status,'inferred');
 assert.equal(p.provenance.fields.immediateActivity.source,'provider');
 const confirmed=Intent.editIntentContent(p,{languages:['es'],immediateActivity:'Listen to a song'});
 assert.equal(confirmed.objectiveStatus,'explicit');assert.equal(confirmed.provenance.fields.languages.source,'user_edit');
 assert.equal(p.provenance.fields.languages.status,'inferred','Editing does not mutate the previous record.');
});

test('provider failure or invalid output falls back locally without fabricating detail',async()=>{
 const raw='I want to understand this song.',local=Intent.parseIntentLocal(raw);
 for(const parser of [async()=>{throw Error('unavailable');},async()=>({languages:['not-a-language']}),async()=>null])assert.deepEqual(await Intent.parseIntent(raw,{parser,allowExternalParser:true}),local);
});

test('a provider cannot overwrite an explicitly stated language or source',async()=>{
 const p=await Intent.parseIntent('I want to read an article in Arabic.',{sourceContent:{id:'selected-item',version:null},allowExternalParser:true,parser:async()=>({languages:['es'],sourceContent:{id:'invented',version:'1'}})});
 assert.deepEqual(p.languages,['ar']);assert.equal(p.sourceContent.id,'selected-item');
 assert.equal(p.provenance.fields.languages.status,'explicit');
});

test('validation rejects inconsistent provenance, unsupported fields, and malformed lists',()=>{
 const valid=poem();
 const bad=structuredClone(valid);bad.provenance.fields.destination={status:'explicit',source:'local_parser',evidence:'invented'};
 assert.throws(()=>Intent.validateIntentContent(bad),/Unknown/);
 const bad2=structuredClone(valid);bad2.provenance.fields.languages={status:'unknown',source:'none'};
 assert.throws(()=>Intent.validateIntentContent(bad2),/Populated/);
 for(const changes of [{languages:['xx']},{languages:['ar','ar']},{preferences:['']},{preferences:['a'.repeat(201)]},{constraints:Array(13).fill('a')},{status:'done'}])assert.throws(()=>Intent.editIntentContent(valid,changes));
 assert.throws(()=>Intent.editIntentContent(valid,{ownerUserId:'someone-else'}),/ownership/);
});

test('server null evidence is accepted without changing known field status',()=>{
 const p=poem();for(const d of Object.values(p.provenance.fields))d.evidence??=null;
 assert.equal(Intent.validateIntentContent(p).provenance.fields.languages.status,'explicit');
});

test('a provider source cannot claim user-confirmed evidence',()=>{
 const p=poem();p.provenance.fields.languages={status:'explicit',source:'provider'};
 assert.throws(()=>Intent.validateIntentContent(p),/remain inferred/);
});

test('read-only context excludes inactive or foreign-selected intents and separate team objectives',()=>{
 const learner={...poem(),schemaVersion:1,id:'learner-intent-0001',ownerUserId:'alice',tenantId:'team-a',kind:'learner',status:'paused'};
 const organization={...poem(),id:'organization-intent-01',tenantId:'team-a',kind:'organization',status:'active'};
 const s={intents:[learner],selection:{mode:'selected',intentId:learner.id},organizationObjective:organization};
 const a=Intent.intentContext(s,{owner:'alice',tenantId:'team-a'});
 assert.equal(a.immediateIntent,null);assert.equal(a.selection.mode,'none');assert.equal(a.organizationObjective.id,organization.id);
 const b=Intent.intentContext(s,{owner:'bob',tenantId:'team-b'});
 assert.equal(b.immediateIntent,null);assert.equal(b.organizationObjective,null);
 assert.equal(s.selection.mode,'selected','Resolving context is read-only.');
});
