import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import * as O from '../public/nabu-observations.js';

const DAY=86400000,actor={userId:'alice',tenantId:null};
const clone=value=>structuredClone(value);
const id=(prefix,n)=>prefix+'-'+String(n).padStart(16,'0');
const ref=(name,version=1,status='authored')=>({id:name,version,status,provenance:[{sourceId:'fixture:'+name,locator:'tests/observations.test.mjs',kind:'authored-fixture'}]});
function definition(name='retrieval',changes={}){
 const scope='Only the recorded authored task, target, prompt, response mode and context.';
 return {id:'fixture:'+name,version:1,target:{id:'fixture:thanks',language:'es'},dimension:'retrieval',practiceMode:'production',inputModality:'text',outputModality:'text',rubricRef:ref('rubric:'+name),scorerRef:ref('scorer:'+name),analysisRef:ref('analysis:'+name),assessmentScope:scope,cues:['An English cue is supplied.'],score:response=>({correct:response.answer?.trim()==='Gracias.',label:'Match to the authored example.',scope}),...changes};
}
const base=definition();
const visual=definition('visual',{dimension:'visual-recognition',practiceMode:'recognition',outputModality:'choice',cues:['The target and three choices are visible.'],score:response=>({correct:response.choice===1,label:'Authored choice key.',scope:'Recognition with the three recorded choices.'})});
const auditory=definition('auditory',{dimension:'auditory-recognition',practiceMode:'listening',inputModality:'audio',outputModality:'choice',score:response=>({correct:response.choice===1,label:'Authored listening choice.',scope:'Recognition under the recorded audio and choices.'})});
const cloze=definition('cloze',{practiceMode:'cloze',cues:['The surrounding sentence and a gap are shown.']});
const production=definition('contextual',{dimension:'contextual-production',practiceMode:'production',assessmentScope:'Only this authored appreciation scenario.'});
const definitions=new Map([base,visual,auditory,cloze,production].map(t=>[t.id,t]));
const resolveTask=taskRef=>definitions.get(taskRef.id)||null;
function event(n,changes={},outer={}){
 const task=changes.taskRef?definitions.get(changes.taskRef.id)||base:base;
 const at=outer.at??1000+n*1000,observation=changes.observation||'response';
 const envelope={schemaVersion:1,episodeId:id('episode',n),attemptId:['response','hint','answer-revealed','skipped'].includes(observation)?id('attempt',n):null,retryOfEpisodeId:null,actor:clone(actor),intentRef:null,organizationObjectiveRef:null,taskRef:{id:task.id,version:task.version},occurrence:{contentId:'fixture:dialogue',version:1,segmentId:'s1',annotationId:'a1',readingId:'reading-one',context:{lexicalId:'fixture:thanks',senseId:'fixture:gratitude',speakerId:'speaker-one',syntaxId:'syntax-one',contextId:'context-one'}},inputModality:task.inputModality,outputModality:observation==='response'?task.outputModality:'none',observation,assistance:O.emptyAssistance(),presentedAt:at-100,response:observation==='response'?(task.outputModality==='choice'?{choice:1}:{answer:'Gracias.'}):null,skipReason:null,assessment:null,rubricRef:clone(task.rubricRef),scorerRef:clone(task.scorerRef),analysisRef:clone(task.analysisRef),...clone(changes)};
 return {id:id('observation',n),at,kind:'evidence',contentId:envelope.occurrence.contentId,version:envelope.occurrence.version,sessionId:envelope.episodeId,evidence:envelope,...outer};
}
function replay(events,options={}){return O.projectEvidence(events,{actor,resolveTask,now:Math.max(0,...events.map(e=>e.at||0))+1000,...options});}
const withContext=(e,changes)=>({...e, evidence:{...e.evidence,occurrence:{...e.evidence.occurrence,context:{...e.evidence.occurrence.context,...changes}}}});

test('the evidence contract validates a complete record and returns an independent copy',()=>{
 const e=event(1),saved=clone(e),result=O.validateEvidenceEvent(e);assert.deepEqual(result,saved);result.evidence.actor.userId='changed';assert.deepEqual(e,saved);
 assert.equal(O.OBSERVATION_SCHEMA_VERSION,1);assert.equal(O.DEFAULT_STALE_AFTER_MS,7*DAY);assert.deepEqual(O.EVIDENCE_PRACTICE_MODES,['recognition','production','listening','cloze']);
});

test('plain JSON objects from another realm are accepted while dates and class instances are rejected',()=>{
 const source=event(1),foreign=runInNewContext('JSON.parse(payload)',{payload:JSON.stringify(source)});assert.notEqual(Object.getPrototypeOf(foreign),Object.prototype);assert.deepEqual(O.validateEvidenceEvent(foreign),source);
 class Actor {constructor(){this.userId='alice';this.tenantId=null;}}
 for(const actor of [new Actor(),new Date(),Object.create({userId:'alice',tenantId:null})]){const e=event(1);e.evidence.actor=actor;assert.throws(()=>O.validateEvidenceEvent(e),/Actor/);}
});

test('missing and unknown envelope, actor, occurrence, context and assistance fields are rejected',()=>{
 for(const path of ['', 'actor','occurrence','occurrence.context','assistance']){
  const e=event(1).evidence,object=path?path.split('.').reduce((a,k)=>a[k],e):e;
  object.unexpected='private prose';assert.throws(()=>O.validateEvidenceEnvelope(e),/unsupported fields/);
 }
 const e=event(1).evidence;delete e.assistance.baseMeaningSupplied;assert.throws(()=>O.validateEvidenceEnvelope(e),/missing/);
});

test('bounded identifiers, versions, references, provenance and explicit booleans are enforced',()=>{
 const edits=[e=>e.episodeId='short',e=>e.attemptId='x'.repeat(81),e=>e.actor.userId='!locked',e=>e.actor.tenantId='x',e=>e.occurrence.version=0,e=>e.scorerRef.version='',e=>e.scorerRef.status='probably',e=>e.scorerRef.provenance[0].rawText='secret',e=>e.assistance.hint=1,e=>e.occurrence.context.senseId='x'.repeat(161)];
 for(const edit of edits){const e=event(1).evidence;edit(e);assert.throws(()=>O.validateEvidenceEnvelope(e));}
 const guest=event(1,{actor:{userId:null,tenantId:null}});assert.doesNotThrow(()=>O.validateEvidenceEvent(guest));guest.evidence.actor.tenantId='team-one';assert.throws(()=>O.validateEvidenceEvent(guest),/team context/);
});

test('response shape, modalities, time, required task references and historical assessment are strict',()=>{
 const edits=[e=>e.response={answer:'x',choice:1},e=>e.response={answer:''},e=>e.response={answer:'a'.repeat(301)},e=>e.response={choice:100},e=>e.outputModality='none',e=>e.taskRef=null,e=>e.rubricRef=null,e=>e.presentedAt=null,e=>e.assessment={outcome:'mastered',basis:'authored-rule'}];
 for(const edit of edits){const e=event(1);edit(e.evidence);assert.throws(()=>O.validateEvidenceEvent(e));}
 const e=event(1);e.evidence.presentedAt=e.at+1;assert.throws(()=>O.validateEvidenceEvent(e),/precede/);
});

test('nonresponse observations never contain an answer or historical correctness',()=>{
 for(const observation of ['displayed','played','lookup','hint','answer-revealed','skipped']){
  const e=event(1,{observation,inputModality:observation==='played'?'audio':'text'});assert.doesNotThrow(()=>O.validateEvidenceEvent(e));
  e.evidence.assessment={outcome:'correct',basis:'self-report'};assert.throws(()=>O.validateEvidenceEvent(e),/Only a response/);
 }
 assert.throws(()=>O.validateEvidenceEvent(event(1,{observation:'played'})),/audio/);
 assert.throws(()=>O.validateEvidenceEvent(event(1,{skipReason:'too-easy'})),/Only a skip/);
});

test('new event wrappers bind content and session references without requiring a current catalogue item',()=>{
 const e=event(1);assert.doesNotThrow(()=>O.validateEvidenceEvent(e));
 assert.throws(()=>O.validateEvidenceEvent({...e,contentId:'different:source'}),/references differ/);
 assert.throws(()=>O.validateEvidenceEvent({...e,sessionId:id('other-episode',1)}),/session/);
 assert.throws(()=>O.validateEvidenceEvent({...e,answer:'duplicate body'}),/unsupported fields/);
});

test('legacy envelopes describe the same attempt while preserving the legacy session contract',()=>{
 const e=event(1),legacy={...e,kind:'attempt',sessionId:'old-session',activityId:'p2',answer:'Gracias.',assisted:false,skipped:false};
 assert.doesNotThrow(()=>O.validateEvidenceEvent(legacy));assert.equal(replay([legacy]).targets[0].directCounts.correct,1);
 assert.throws(()=>O.validateEvidenceEvent({...legacy,answer:'different'}),/disagree/);
 assert.throws(()=>O.validateEvidenceEvent({...legacy,skipped:true}),/disagree/);
 const hint=event(2,{observation:'hint'});assert.doesNotThrow(()=>O.validateEvidenceEvent({...hint,kind:'help',sessionId:'old-help',help:'hint'}));
 assert.throws(()=>O.validateEvidenceEvent({...hint,kind:'help',help:'answer'}),/disagree/);
 const opening=event(3,{observation:'displayed'});assert.doesNotThrow(()=>O.validateEvidenceEvent({...opening,kind:'opened'}));
});

test('legacy records without envelopes receive no new competence projection',()=>{
 const legacy={id:id('legacy',1),kind:'attempt',at:1000,correct:true,assisted:false};
 const p=replay([legacy]);assert.equal(p.ignoredLegacyCount,1);assert.deepEqual(p.ledger,[]);assert.deepEqual(p.targets,[]);assert.equal(p.competence,null);
 assert.throws(()=>replay([{...legacy,kind:'evidence'}]),/requires its envelope/);
});

test('display and playback provide opportunities only, never recognition or retrieval success',()=>{
 const display=event(1,{observation:'displayed'}),play=event(2,{observation:'played',taskRef:{id:auditory.id,version:1},inputModality:'audio'});
 const p=replay([display,play]);assert.equal(p.targets.length,2);
 for(const t of p.targets){assert.equal(t.directCounts.opportunities,1);assert.equal(t.directCounts.unassistedAssessments,0);assert.equal(t.lastAssessmentAt,null);assert.equal(t.competence,null);}
 for(const row of p.ledger){assert.match(row.supports.join(' '),/opportunity/);assert.match(row.doesNotSupport.join(' '),/does not establish/);assert.equal(row.assessment.correct,null);}
});

test('lookup is retained as help without inferring ignorance or treating no lookup as success',()=>{
 const lookup=event(1,{observation:'lookup'}),p=replay([lookup]);assert.equal(p.ledger[0].assistance.lookup,true);
 assert.match(p.ledger[0].doesNotSupport.join(' '),/does not establish ignorance/);assert.equal(p.targets[0].directCounts.helpRequests,1);assert.equal(p.targets[0].directCounts.correct,0);
 assert.equal(replay([]).competence,null);assert.equal(replay([event(2,{observation:'displayed'})]).targets[0].directCounts.unassistedAssessments,0);
});

test('visual recognition is bounded by its actual cues and does not become production evidence',()=>{
 const p=replay([event(1,{taskRef:{id:visual.id,version:1}})]),row=p.ledger[0],target=p.targets[0];
 assert.equal(row.dimension,'visual-recognition');assert.equal(row.practiceMode,'recognition');assert.equal(row.assessment.correct,true);assert.deepEqual(row.condition.cues,visual.cues);
 assert.match(row.doesNotSupport.join(' '),/uncued recall, production/);assert.equal(target.directCounts.correct,1);assert.equal(target.competence,null);assert.equal(p.targets.some(x=>x.dimension==='contextual-production'),false);
});

test('auditory recognition retains its own modality and practice mode',()=>{
 const p=replay([event(1,{taskRef:{id:auditory.id,version:1}})]),row=p.ledger[0];
 assert.equal(row.dimension,'auditory-recognition');assert.equal(row.inputModality,'audio');assert.equal(row.practiceMode,'listening');assert.match(row.supports.join(' '),/Auditory recognition/);
});

test('cloze and full retrieval remain distinct even for the same target and episode',()=>{
 const a=event(1),b=event(2,{taskRef:{id:cloze.id,version:1},episodeId:a.evidence.episodeId});
 const p=replay([a,b]);assert.equal(p.targets.length,2);assert.deepEqual(new Set(p.targets.map(x=>x.practiceMode)),new Set(['production','cloze']));assert(p.targets.every(t=>t.directCounts.correct===1));
});

test('contextual production is limited to the declared context and rubric',()=>{
 const p=replay([event(1,{taskRef:{id:production.id,version:1}})]),row=p.ledger[0];
 assert.equal(row.dimension,'contextual-production');assert.match(row.supports.join(' '),/recorded context/);assert.match(row.doesNotSupport.join(' '),/other people, syntax, lexical material/);assert.equal(row.competence,null);
});

test('historical client correctness and self-reports are retained but recomputed by the injected rule',()=>{
 const e=event(1,{response:{answer:'Incorrect answer'},assessment:{outcome:'correct',basis:'self-report'}}),row=replay([e]).ledger[0];
 assert.deepEqual(row.recordedAssessment,{outcome:'correct',basis:'self-report'});assert.equal(row.assessment.correct,false);assert.equal(row.assessment.outcome,'incorrect');assert.match(row.doesNotSupport.join(' '),/self-report is not the scorer/);
});

test('missing scorers and unknown task versions remain stale instead of trusting historical answers',()=>{
 const e=event(1,{assessment:{outcome:'correct',basis:'authored-rule'}});
 for(const resolver of [undefined,()=>null,()=>({...base,version:2})]){const p=replay([e],{resolveTask:resolver});assert.equal(p.ledger[0].assessment.status,'stale');assert.equal(p.ledger[0].counted,false);assert.equal(p.competence,null);}
});

test('unconfirmed or quarantined structural/scoring references do not create scored target evidence',()=>{
 for(const field of ['analysisRef','scorerRef','rubricRef'])for(const status of ['inferred','unknown','quarantined']){
  const task={...base,[field]:{...base[field],status}},p=replay([event(1)],{resolveTask:()=>task,allowRescore:true});
  assert.equal(p.ledger[0].assessment.status,'stale');assert.equal(p.targets[0].directCounts.unassistedAssessments,0);
 }
});

test('changed scorer, rubric and analysis versions mark the same observation stale by default',()=>{
 for(const field of ['analysisRef','scorerRef','rubricRef']){
  const task={...base,[field]:{...base[field],version:2}},p=replay([event(1)],{resolveTask:()=>task});
  assert.equal(p.ledger.length,1);assert.equal(p.ledger[0].assessment.status,'stale');assert.deepEqual(p.ledger[0].assessment.changedReferences,[field]);assert.equal(p.targets[0].lastAssessmentAt,null);
 }
});

test('an explicit rescore replaces the derived interpretation without appending a new observation',()=>{
 const e=event(1,{assessment:{outcome:'correct',basis:'authored-rule'}}),before=clone(e);
 const task={...base,scorerRef:ref('scorer:retrieval',2),score:()=>({correct:false,label:'Changed authored rule.',scope:'Only the same fixture response.'})};
 const p=replay([e],{resolveTask:()=>task,allowRescore:true});assert.equal(p.ledger.length,1);assert.equal(p.ledger[0].eventId,e.id);assert.equal(p.ledger[0].assessment.status,'rescored');assert.equal(p.targets[0].directCounts.firstResponses,1);assert.equal(p.targets[0].directCounts.incorrect,1);assert.equal(p.ledger[0].recordedReferences.scorerRef.version,1);assert.equal(p.ledger[0].assessment.appliedRefs.scorerRef.version,2);assert.deepEqual(e,before);
});

test('reference version types are exact rather than silently coerced',()=>{
 const task={...base,analysisRef:{...base.analysisRef,version:'1'}},p=replay([event(1)],{resolveTask:()=>task});assert.equal(p.ledger[0].assessment.status,'stale');
});

test('a broken or nonsynchronous scorer leaves the raw observation unscored',()=>{
 for(const score of [()=>{throw Error('unavailable');},()=>Promise.resolve({correct:true}),()=>({correct:1,label:'bad',scope:'bad'})]){
  const p=replay([event(1)],{resolveTask:()=>({...base,score})});assert.equal(p.ledger[0].assessment.status,'unscored');assert.equal(p.targets[0].directCounts.correct,0);assert.equal(p.ledger[0].responseRecorded,true);
 }
});

test('all declared assistance conditions retain bounded responses without unaided credit',()=>{
 for(const key of Object.keys(O.emptyAssistance())){
  const e=event(1,{assistance:{...O.emptyAssistance(),[key]:true}}),p=replay([e]);
  assert.equal(p.ledger[0].assessment.correct,true,key);assert.equal(p.ledger[0].assisted,true,key);assert.equal(p.targets[0].directCounts.assistedResponses,1,key);assert.equal(p.targets[0].directCounts.unassistedAssessments,0,key);assert.equal(p.targets[0].lastAssessmentAt,null,key);
 }
});

test('support required by a task cannot be erased by falsely empty client assistance flags',()=>{
 const e=event(1),before=clone(e);
 for(const task of [{...base,requiredAssistance:{baseMeaningSupplied:true,sourceVisible:true}},{...base,baseMeaningSupplied:true}]){
  const p=replay([e],{resolveTask:()=>task}),row=p.ledger[0];assert.equal(row.assistance.baseMeaningSupplied,true);assert.equal(row.assisted,true);assert.equal(row.counted,false);assert(row.assistanceDerivedFromTask.includes('baseMeaningSupplied'));assert.equal(p.targets[0].directCounts.unassistedAssessments,0);
 }
 assert.deepEqual(e,before);
 const invalid=replay([e],{resolveTask:()=>({...base,requiredAssistance:{fabricated:true}})});assert.equal(invalid.ledger[0].assessment.status,'stale');assert.equal(invalid.ledger[0].counted,false);
});

test('recorded help overrides a contradictory false assistance flag before scoring credit',()=>{
 const response=event(2),help=event(1,{...response.evidence,observation:'hint',outputModality:'none',response:null},{at:response.at-1});
 const p=replay([response,help]);assert.equal(p.ledger[1].assistance.hint,true);assert.deepEqual(p.ledger[1].assistanceSourceIds,[help.id]);assert.equal(p.targets[0].directCounts.correct,0);assert.equal(p.targets[0].directCounts.assistedResponses,1);assert.equal(response.evidence.assistance.hint,false);
});

test('help recorded at the same timestamp is conservatively retained as assistance',()=>{
 const response=event(2),help=event(1,{...response.evidence,observation:'answer-revealed',outputModality:'none',response:null},{at:response.at});
 assert.equal(replay([response,help]).ledger.find(x=>x.eventId===response.id).assistance.answerShown,true);
});

test('automatic feedback at the response timestamp does not retroactively assist its own first response',()=>{
 const response=event(2),feedback=event(1,{...response.evidence,observation:'answer-revealed',response:null,outputModality:'none',assistance:{...O.emptyAssistance(),answerShown:true,feedbackShown:true}},{at:response.at});
 const later=event(3,{episodeId:response.evidence.episodeId});
 const p=replay([response,feedback,later]),first=p.ledger.find(r=>r.eventId===response.id),retry=p.ledger.find(r=>r.eventId===later.id);
 assert.equal(first.assisted,false);assert.equal(first.counted,true);assert.equal(retry.assisted,true);assert.equal(retry.counted,false);assert.equal(p.targets[0].directCounts.unassistedAssessments,1);
});

test('unrelated annotation or episode help never supplies assistance to another target occurrence',()=>{
 const response=event(2),help=event(1,{observation:'hint'});const p=replay([help,response]);assert.equal(p.ledger[1].assisted,false);assert.equal(p.ledger[1].counted,true);
 const second=event(3,{observation:'lookup',episodeId:response.evidence.episodeId,occurrence:{...response.evidence.occurrence,annotationId:'a2'}},{at:response.at-1});
 assert.equal(replay([second,response]).ledger.find(x=>x.eventId===response.id).assisted,false);
});

test('a lookup on the same occurrence and episode is assistance even without a task ID',()=>{
 const response=event(2),lookup=event(1,{observation:'lookup',episodeId:response.evidence.episodeId,occurrence:response.evidence.occurrence,taskRef:null,attemptId:null},{at:response.at-1});
 const row=replay([response,lookup]).ledger.find(x=>x.eventId===response.id);assert.equal(row.assistance.lookup,true);assert.equal(row.counted,false);
});

test('reconciled assistance can add flags but cannot erase the observation’s own support flags',()=>{
 const e=event(1,{assistance:{...O.emptyAssistance(),sourceVisible:true}}),row=O.interpretEvidence(e,{resolveTask,assistance:O.emptyAssistance()});assert.equal(row.assistance.sourceVisible,true);assert.equal(row.assisted,true);
});

test('only the first response in an episode-target-dimension-mode contributes direct assessment counts',()=>{
 const first=event(1,{response:{answer:'Incorrect'}}),retry=event(2,{episodeId:first.evidence.episodeId});
 const p=replay([first,retry]),t=p.targets[0];assert.equal(t.directCounts.firstResponses,1);assert.equal(t.directCounts.unassistedAssessments,1);assert.equal(t.directCounts.incorrect,1);assert.equal(t.directCounts.correct,0);assert.equal(t.directCounts.retryResponses,1);assert.equal(p.ledger[1].firstResponse,false);assert.equal(t.lastAssessmentAt,first.at);
});

test('tied competing first responses do not let random event IDs choose a successful outcome',()=>{
 const first=event(1,{response:{answer:'Incorrect'}}),second=event(2,{episodeId:first.evidence.episodeId},{at:first.at}),p=replay([second,first]);
 assert(p.ledger.every(r=>r.firstResponse===null&&r.counted===false));assert(p.ledger.every(r=>r.exclusionReasons.includes('ambiguous-first-response-order')));assert.equal(p.targets[0].directCounts.ambiguousResponses,2);assert.equal(p.targets[0].directCounts.unassistedAssessments,0);assert.equal(p.targets[0].lastAssessmentAt,null);
});

test('an assisted first response cannot be replaced by a later same-episode unaided claim',()=>{
 const first=event(1,{assistance:{...O.emptyAssistance(),answerShown:true}}),later=event(2,{episodeId:first.evidence.episodeId});
 const p=replay([first,later]);assert.equal(p.targets[0].directCounts.unassistedAssessments,0);assert.equal(p.targets[0].directCounts.firstResponses,1);assert.equal(p.ledger[1].firstResponse,false);assert.equal(p.ledger[1].counted,false);
});

test('an explicit retry episode retains responses without manufacturing fresh independence',()=>{
 const first=event(1,{response:{answer:'Incorrect'}}),retry=event(2,{retryOfEpisodeId:first.evidence.episodeId});
 const p=replay([first,retry]);assert.equal(p.targets[0].directCounts.unassistedAssessments,1);assert.equal(p.targets[0].directCounts.retryResponses,1);assert(p.ledger[1].exclusionReasons.includes('retry-episode'));assert.equal(p.ledger[1].rootEpisodeId,first.evidence.episodeId);assert.equal(p.independenceEstablished,false);
});

test('missing retry parents and retry episodes after only a skipped original are not fresh assessments',()=>{
 const orphan=event(1,{retryOfEpisodeId:id('missing-episode',1)}),p=replay([orphan]);assert.equal(p.targets[0].directCounts.unassistedAssessments,0);assert(p.ledger[0].exclusionReasons.includes('unresolved-retry-lineage'));
 const skipped=event(2,{observation:'skipped',skipReason:'not-now'}),retry=event(3,{retryOfEpisodeId:skipped.evidence.episodeId});assert.equal(replay([skipped,retry]).targets[0].directCounts.unassistedAssessments,0);
});

test('retry lineage cycles and changed retry parents are rejected',()=>{
 const a=event(1),b=event(2);a.evidence.retryOfEpisodeId=b.evidence.episodeId;b.evidence.retryOfEpisodeId=a.evidence.episodeId;
 assert.throws(()=>replay([a,b]),/cycle/);
 const first=event(3),second=event(4,{episodeId:first.evidence.episodeId,retryOfEpisodeId:id('root-episode',8)});assert.throws(()=>replay([first,second]),/retry parent/);
});

test('a skip reason is retained as a preference signal without a correctness or competence count',()=>{
 for(const skipReason of [null,'not-now','too-easy','too-hard','other']){
  const p=replay([event(1,{observation:'skipped',skipReason})]);assert.equal(p.ledger[0].skipReason,skipReason);assert.equal(p.targets[0].directCounts.skips,1);assert.equal(p.targets[0].directCounts.correct,0);assert.equal(p.targets[0].lastAssessmentAt,null);
 }
});

test('identical event redelivery deduplicates recursively regardless of object key order',()=>{
 const e=event(1),duplicate={...clone(e),evidence:Object.fromEntries(Object.entries(e.evidence).reverse())},p=replay([e,duplicate,e]);assert.equal(p.ledger.length,1);assert.equal(p.targets[0].directCounts.correct,1);
});

test('conflicting event IDs and multiple terminal records for an attempt are rejected',()=>{
 const e=event(1);assert.throws(()=>replay([e,{...clone(e),at:e.at+1}]),/reused with different evidence/);
 const duplicate=event(2,{...e.evidence});assert.throws(()=>replay([e,duplicate]),/terminal response/);
 const skipped=event(3,{...e.evidence,observation:'skipped',response:null,outputModality:'none'});assert.throws(()=>replay([e,skipped]),/terminal response/);
});

test('attempt identity cannot drift in target, actor-owned context, scoring references or presentation time',()=>{
 const e=event(2),hint=event(1,{...e.evidence,observation:'hint',response:null,outputModality:'none'},{at:e.at-1});
 for(const change of [x=>x.occurrence.annotationId='other',x=>x.scorerRef.version=2,x=>x.presentedAt--,x=>x.intentRef={id:'other-intent',revision:1}]){const altered=clone(hint);change(altered.evidence);assert.throws(()=>replay([altered,e]),/different task or condition/);}
 assert.doesNotThrow(()=>replay([hint,e]));
});

test('actor and team scoping excludes foreign records and their identifiers from the projection',()=>{
 const own=event(1),foreign=event(2,{actor:{userId:'bob',tenantId:null}}),team=event(3,{actor:{userId:'alice',tenantId:'team-one'}});
 const p=replay([foreign,team,own]);assert.deepEqual(p.ledger.map(x=>x.eventId),[own.id]);assert.equal(JSON.stringify(p).includes(foreign.id),false);assert.equal(JSON.stringify(p).includes(team.id),false);
 const scoped=replay([own,team,foreign],{actor:{userId:'alice',tenantId:'team-one'}});assert.deepEqual(scoped.ledger.map(x=>x.eventId),[team.id]);
 assert.throws(()=>O.projectEvidence([own],{resolveTask,now:5000}),/Actor/);
});

test('explicit delayed changed conditions are described without a generalization or retention estimate',()=>{
 const first=event(1,{}, {at:1000}),second=withContext(event(2,{}, {at:2*DAY+1000}),{speakerId:'speaker-two',syntaxId:'syntax-two',contextId:'context-two'}),p=replay([first,second]);
 const delayed=p.ledger[1].delayedCondition;assert.equal(delayed.delayMs,2*DAY);assert.equal(delayed.delayCriterionMet,true);assert.equal(delayed.delayedChangedCondition,true);assert.deepEqual(delayed.changedConditions.map(x=>x.field),['speakerId','syntaxId']);assert.equal(delayed.contextReferenceChanged,true);assert.equal(delayed.transferClaimed,false);assert.match(delayed.scope,/not an estimate/);assert.equal(p.targets[0].competence,null);
});

test('changing only a content ID is not declared a changed-condition probe',()=>{
 const first=event(1),second=event(2,{occurrence:{...first.evidence.occurrence,contentId:'fixture:another-page'}},{at:2*DAY});
 const delayed=replay([first,second]).ledger[1].delayedCondition;assert.equal(delayed.delayCriterionMet,true);assert.deepEqual(delayed.changedConditions,[]);assert.equal(delayed.delayedChangedCondition,false);
});

test('a new context identifier alone does not manufacture changed-condition or transfer evidence',()=>{
 const first=event(1),second=withContext(event(2,{}, {at:2*DAY}),{contextId:'new-text-label'});
 const delayed=replay([first,second]).ledger[1].delayedCondition;assert.equal(delayed.delayCriterionMet,true);assert.equal(delayed.contextReferenceChanged,true);assert.deepEqual(delayed.changedConditions,[]);assert.equal(delayed.delayedChangedCondition,false);assert.equal(delayed.transferClaimed,false);
});

test('unknown context features remain unknown instead of inferred changed conditions',()=>{
 const first=withContext(event(1),{speakerId:null,syntaxId:null}),second=withContext(event(2,{}, {at:2*DAY}),{speakerId:'new-speaker',syntaxId:'new-syntax'});
 const delayed=replay([first,second]).ledger[1].delayedCondition;assert(delayed.unknownConditions.includes('speakerId'));assert(delayed.unknownConditions.includes('syntaxId'));assert.equal(delayed.changedConditions.length,0);assert.equal(delayed.delayedChangedCondition,false);
});

test('passive events and help do not freshen an old assessment',()=>{
 const assessed=event(1,{}, {at:1000}),display=event(2,{observation:'displayed'},{at:10*DAY}),lookup=event(3,{observation:'lookup'},{at:10*DAY+1});
 const p=replay([assessed,display,lookup],{now:10*DAY+1000}),t=p.targets[0];assert.equal(t.lastAssessmentAt,assessed.at);assert.equal(t.timeSinceAssessmentMs,10*DAY);assert.equal(t.assessmentFreshness,'stale');assert.equal(t.directCounts.correct,1);assert.equal(t.competence,null);
});

test('the explicit staleness window is a policy threshold, not a competence decay calculation',()=>{
 const assessed=event(1,{}, {at:1000});
 const current=replay([assessed],{now:assessed.at+7*DAY}),old=replay([assessed],{now:assessed.at+7*DAY+1});
 assert.equal(current.targets[0].assessmentFreshness,'within-policy-window');assert.equal(old.targets[0].assessmentFreshness,'stale');assert.deepEqual(current.targets[0].directCounts,old.targets[0].directCounts);assert.equal(old.targets[0].competence,null);assert.match(old.thresholdMeaning,/not an estimated learner forgetting/);
});

test('future-dated responses remain in the ledger without assessment credit at the replay time',()=>{
 const e=event(1),p=replay([e],{now:e.at-1});assert.equal(p.ledger[0].counted,false);assert(p.ledger[0].exclusionReasons.includes('future-event'));assert.equal(p.targets[0].lastAssessmentAt,null);
});

test('each ledger row explains its support boundaries and preserves source identifiers',()=>{
 const p=replay([event(1),event(2,{observation:'displayed'}),event(3,{observation:'skipped'})]);
 for(const row of p.ledger){assert(row.supports.length);assert(row.doesNotSupport.length);assert.deepEqual(row.sourceEventIds,[row.eventId]);assert(row.sourceIds.includes('fixture:scorer:retrieval'));assert.equal(row.competence,null);assert.equal(row.independenceEstablished,false);assert.equal(Object.hasOwn(row,'answer'),false);}
});

test('replay is deterministic under input reordering and does not mutate raw observations',()=>{
 const events=[event(1),event(2,{observation:'lookup'}),event(3,{observation:'skipped'})],before=clone(events),a=replay(events),b=replay([...events].reverse());assert.deepEqual(a,b);assert.deepEqual(events,before);
 assert.throws(()=>replay(events,{now:NaN}),/Replay time/);assert.throws(()=>replay(events,{staleAfterMs:-1}),/thresholds/);
});

test('the direct projector has no graph dependency, I/O, Beta state, or scheduler writes',async()=>{
 const source=await readFile(new URL('../public/nabu-observations.js',import.meta.url),'utf8');
 assert.doesNotMatch(source,/^import\s/m);assert.doesNotMatch(source,/\b(?:fetch|localStorage|indexedDB|productionBeta|scheduleReview|applyReview)\s*\(/u);
 const p=replay([event(1)]);assert.equal(Object.hasOwn(p,'alpha'),false);assert.equal(Object.hasOwn(p,'beta'),false);assert.equal(Object.hasOwn(p,'forgettingRate'),false);
});
