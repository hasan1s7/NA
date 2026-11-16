/** Additive audit boundary for Prompt 2's unchanged ranking rule. */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as Next from '../public/nabu-next-step.js';
import * as X from '../public/nabu-content.js';
import * as O from '../public/nabu-observations.js';
import * as Tasks from '../public/nabu-evidence-tasks.js';
import * as Intent from '../public/nabu-intents.js';

const DAY=86400000,NOW=30*DAY,actor={userId:'audit-learner',tenantId:null};
const capabilities=Object.fromEntries(Next.NEXT_STEP_ACTIONS.map(action=>[action,true]));
const item=X.itemById('a-little-later'),annotation=item.annotations.find(a=>a.id==='a3');
const clone=value=>structuredClone(value);let serial=0;
const identifier=prefix=>prefix+'-'+String(++serial).padStart(16,'0');
function context(who=actor){return {schemaVersion:1,actor:{kind:who.tenantId?'team':'individual',...who},selection:{mode:'exploring',intentId:null},immediateIntent:null,organizationObjective:null};}
function sourceFor(content=item,selected=annotation){const text=X.sourceText(content);return {contentId:content.id,contentVersion:content.version,sourceLang:content.language,targetLang:content.translationLanguage,text,selectedText:selected?.quote||'',selectionStart:selected?text.indexOf(selected.quote):null,hasMedia:true};}
function recorded({task=Tasks.catalogueEvidenceTask(item,'p2'),at=NOW-1000,response,assistance={},who=actor,episodeId,attemptId,retryOfEpisodeId=null,legacy=false}={}){
 const episode=episodeId||identifier('episode'),id=identifier('observation');
 const e={schemaVersion:1,episodeId:episode,attemptId:attemptId||identifier('attempt'),retryOfEpisodeId,actor:clone(who),intentRef:null,organizationObjectiveRef:null,taskRef:{id:task.id,version:task.version},occurrence:clone(task.occurrence),inputModality:task.inputModality,outputModality:task.outputModality,observation:'response',assistance:{...O.emptyAssistance(),...(task.requiredAssistance||{}),...assistance},presentedAt:at-500,response:response??(task.outputModality==='choice'?{choice:task.answer}:{answer:task.accepted[0]}),skipReason:null,assessment:null,rubricRef:clone(task.rubricRef),scorerRef:clone(task.scorerRef),analysisRef:clone(task.analysisRef)};
 const event={id,at,kind:'evidence',contentId:e.occurrence.contentId,version:e.occurrence.version,sessionId:episode,evidence:e};
 if(legacy)Object.assign(event,{kind:'attempt',activityId:task.id.split(':').at(-1),sessionId:identifier('legacy-session'),...clone(e.response),assisted:false,skipped:false});
 return event;
}
function unwrapped(event){const result=clone(event);delete result.evidence;return result;}
function audit(events,who=actor,now=NOW){return Next.auditRecommendationEvents(events,{actor:who,now});}
function recommend(events,{who=actor,source=sourceFor(),now=NOW,...extra}={}){return Next.recommendNextSteps({intentContext:context(who),source,contentEvents:events,capabilities,now,...extra});}
function actions(result){return [result.primary,...result.alternatives,result.continueAction].filter(Boolean);}
function selectedEvidence(result){return actions(result).find(candidate=>candidate.kind==='annotation')?.evidence;}
function asHint(response){
 const event=clone(response);event.id=identifier('hint');event.at-=100;
 Object.assign(event.evidence,{observation:'hint',outputModality:'none',response:null,assessment:null});event.evidence.assistance.hint=true;
 if(event.kind==='attempt'){event.kind='help';event.help='hint';for(const key of ['answer','choice','assisted','skipped'])delete event[key];}
 return event;
}

test('a fresh exact catalogue response passes the audit and preserves Prompt 2 scores',()=>{
 const wrapped=recorded({legacy:true}),legacy=unwrapped(wrapped),before=clone(wrapped),result=audit([wrapped]);
 assert.equal(result.status,'audited');assert.deepEqual(result.notices,[]);assert.equal(result.events.length,1);
 assert.equal(result.events[0].kind,'attempt');assert.equal(result.events[0].id,wrapped.id);assert.equal(result.events[0].activityId,'p2');
 assert.deepEqual(recommend([wrapped]),recommend([legacy]));assert.deepEqual(wrapped,before);
});

test('a standalone observation may bridge only through an exact real catalogue task',()=>{
 const event=recorded(),result=audit([event]);assert.equal(result.events.length,1);
 assert.equal(result.events[0].activityId,'p2');assert.equal(result.events[0].sessionId,event.evidence.episodeId);
 const evidence=selectedEvidence(recommend([event]));assert.equal(evidence.observations,1);assert.equal(evidence.lastCorrect,true);assert.equal(evidence.lastAssisted,false);assert.deepEqual(evidence.referenceIds,[event.id]);
});

test('legacy unscoped response and SRS contracts do not acquire the new freshness filter',()=>{
 const legacy=unwrapped(recorded({legacy:true,at:1000}));
 assert.equal(audit([legacy]).status,'legacy-only');assert.equal(audit([legacy]).events.length,1);
 assert.deepEqual(recommend([legacy],{now:NOW}),recommend([legacy],{now:NOW+100*DAY}));
 const raw='I want to meet my girlfriend’s Mexican mother and make a good impression.';
 const intent={schemaVersion:1,id:'test-intent-00000001',ownerUserId:actor.userId,tenantId:null,kind:'learner',...Intent.editIntentContent(Intent.parseIntentLocal(raw),{languages:['es']}),createdAt:1000,updatedAt:1000,statusChangedAt:1000,revision:1};
 const intentContext={...context(),selection:{mode:'selected',intentId:intent.id},immediateIntent:intent};
 const card={id:'legacy-card',conceptId:'phrases.nice_to_meet_you',sourceLang:'es',targetLang:'en',schedule:{reps:12}},log={id:'legacy-review',cardId:card.id,before:card,at:1000,rating:1,practiceMode:'production'};
 const result=Next.recommendNextSteps({intentContext,source:{},cards:[card],logs:[log],contentEvents:[],capabilities,now:NOW});
 assert.equal(result.primary.evidence.status,'self-rated');assert.equal(result.primary.evidence.observations,1);assert.equal(result.primary.score.contributions.find(row=>row.name==='directLearnerEvidence').value,.8);
});

test('changed scorer, rubric, analysis, task version or task occurrence cannot supply current response evidence',()=>{
 const edits=[
  event=>event.evidence.scorerRef.version='retired-scorer',
  event=>event.evidence.rubricRef.version='retired-rubric',
  event=>event.evidence.analysisRef.version='retired-analysis',
  event=>event.evidence.taskRef.version=2,
  event=>event.evidence.occurrence.context.senseId='wrong-sense',
  event=>event.evidence.occurrence.context.syntaxId='wrong-syntax',
  event=>event.evidence.occurrence.readingId='wrong-reading',
 ];
 for(const edit of edits){const event=recorded({legacy:true});edit(event);const result=audit([event]);assert.equal(result.events.length,0);assert.equal(selectedEvidence(recommend([event])).status,'unknown');assert.ok(result.notices.length);}
});

test('future and aged audited responses stay unknown while the exact freshness boundary is retained',()=>{
 for(const event of [recorded({at:NOW+1}),recorded({at:NOW-O.DEFAULT_STALE_AFTER_MS-1})]){
  assert.equal(audit([event]).events.length,0);assert.equal(selectedEvidence(recommend([event])).observations,0);
 }
 assert.equal(audit([recorded({at:NOW-O.DEFAULT_STALE_AFTER_MS})]).events.length,1);
});

test('first assisted responses remain bounded and recorded help overrides a false unaided declaration',()=>{
 const response=recorded(),hint=asHint(response),before=clone([hint,response]);
 const result=audit([response,hint]);assert.equal(result.status,'audited');assert.equal(result.events.length,1);assert.equal(result.events[0].assisted,true);assert.deepEqual(result.events[0].assistanceEvidence,[hint.id]);
 const decision=recommend([response,hint]),evidence=selectedEvidence(decision);assert.equal(evidence.lastOutcome,'assisted-correct');assert.equal(evidence.lastAssisted,true);assert.deepEqual(evidence.assistanceEvidence,[hint.id]);
 assert.equal(decision.primary.score.contributions.find(row=>row.name==='directLearnerEvidence').value,.4);
 assert.equal(actions(decision).find(c=>c.kind==='practice-content').action.activityId,'p2');assert.deepEqual([hint,response],before);
});

test('legacy assistance remains conservative when the audit envelope fails to repeat its flag',()=>{
 const event=recorded({legacy:true});event.assisted=true;
 assert.equal(audit([event]).events[0].assisted,true);assert.equal(selectedEvidence(recommend([event])).lastAssisted,true);
});

test('legacy help and new audited help are both retained in the bounded response provenance',()=>{
 const response=recorded({legacy:true}),hint=asHint(response);
 const legacyHint={id:identifier('old-hint'),contentId:item.id,version:item.version,activityId:response.activityId,sessionId:response.sessionId,kind:'help',help:'hint',at:response.at-50};
 const evidence=selectedEvidence(recommend([legacyHint,response,hint]));assert.equal(evidence.lastAssisted,true);
 assert.deepEqual(new Set(evidence.assistanceEvidence),new Set([legacyHint.id,hint.id]));
});

test('identical delivery retries are counted once but altered event IDs fail closed',()=>{
 const event=recorded(),copy=clone(event);assert.equal(audit([event,copy]).events.length,1);
 copy.evidence.response.answer='a different response';const result=audit([event,copy]);assert.equal(result.status,'inconsistent');assert.deepEqual(result.events,[]);
 assert.match(result.notices.join(' '),/inconsistent/);assert.equal(selectedEvidence(recommend([event,copy])).status,'unknown');
});

test('conflicting terminal responses for the same attempt fail closed without silently choosing one',()=>{
 const first=recorded(),second=clone(first);second.id=identifier('another-delivery');second.evidence.response.answer='different';
 const result=audit([first,second]);assert.equal(result.status,'inconsistent');assert.deepEqual(result.events,[]);
 assert.equal(audit([second,first]).status,'inconsistent');
});

test('a later response in one episode and an explicit retry episode cannot replace the first response',()=>{
 const first=recorded({at:NOW-2000});
 for(const second of [recorded({at:NOW-1000,episodeId:first.sessionId,response:{answer:'different'}}),recorded({at:NOW-1000,retryOfEpisodeId:first.sessionId,response:{answer:'different'}})]){
  const result=audit([second,first]);assert.equal(result.events.length,1);assert.equal(result.events[0].id,first.id);assert.equal(selectedEvidence(recommend([second,first])).lastCorrect,true);
 }
 const orphan=recorded({retryOfEpisodeId:identifier('missing-parent')});assert.equal(audit([orphan]).events.length,0);
});

test('conflicts do not poison unrelated legacy history, and cross-format ID collisions use neither copy',()=>{
 const legacy=unwrapped(recorded({legacy:true})),first=recorded(),bad=clone(first);bad.evidence.response.answer='changed';
 const mixed=audit([legacy,first,bad]);assert.equal(mixed.status,'inconsistent');assert.deepEqual(mixed.events,[legacy]);
 const wrapped=recorded({legacy:true}),unwrappedCopy=unwrapped(wrapped),collision=audit([wrapped,unwrappedCopy]);
 assert.equal(collision.status,'inconsistent');assert.deepEqual(collision.events,[]);
 delete wrapped.evidence.actor;
 const unknownOwnerCollision=audit([wrapped,unwrappedCopy]);assert.equal(unknownOwnerCollision.status,'inconsistent');assert.deepEqual(unknownOwnerCollision.events,[],'An unscoped corrupted copy does not authorize choosing the legacy copy of its ID');
});

test('malformed scoped audit records fail closed with a small notice and leave reading support available',()=>{
 const bad=recorded();bad.evidence.assistance.hint='unknown';const result=recommend([bad]);
 assert.equal(selectedEvidence(result).status,'unknown');assert.equal(result.primary.kind,'annotation');assert.equal(result.continueAction.kind,'continue-media');
 assert.ok(result.notices.some(notice=>notice.includes('inconsistent')));assert.ok(result.notices.every(notice=>!notice.includes(bad.id)));
 assert.equal(Next.auditRecommendationEvents([recorded()],{now:NOW}).status,'inconsistent','No actor is not permission to infer one');
});

test('exact account and tenant scope are required while legacy history retains its account attribution',()=>{
 const teamActor={...actor,tenantId:'team-one'},one=recorded({who:teamActor}),personal=recorded(),two=recorded({who:{...actor,tenantId:'team-two'}}),peer=recorded({who:{userId:'another-learner',tenantId:'team-one'}}),legacy=unwrapped(recorded({legacy:true}));
 const result=audit([personal,one,two,peer,legacy],teamActor);assert.deepEqual(new Set(result.events.map(event=>event.id)),new Set([one.id,legacy.id]));
 assert.deepEqual(audit([personal,one,two,peer],actor).events.map(event=>event.id),[personal.id]);
 assert.equal(selectedEvidence(recommend([personal,one,two,peer],{who:teamActor})).observations,1);
});

test('invalid events from another actor cannot contaminate this actor replay or leak their source IDs',()=>{
 const own=recorded(),foreign=recorded({who:{userId:'other-learner',tenantId:null}});foreign.evidence.assistance.hint='malformed';foreign.evidence.analysisRef.provenance[0].sourceId='OTHER_PRIVATE_SOURCE';
 const result=audit([foreign,own]);assert.equal(result.status,'audited');assert.equal(result.events.length,1);assert.equal(result.events[0].id,own.id);assert.equal(JSON.stringify(result).includes('OTHER_PRIVATE_SOURCE'),false);
});

test('guest observations require the explicit guest actor and are never borrowed by an account',()=>{
 const guest={userId:null,tenantId:null},event=recorded({who:guest});assert.equal(audit([event],guest).events.length,1);assert.equal(audit([event],actor).events.length,0);
 assert.equal(selectedEvidence(recommend([event],{who:guest})).observations,1);
});

test('a valid authored contrast is not propagated into the linked reading annotation',()=>{
 for(const key of ['take-meaning','phrase-now','write-female']){
  const event=recorded({task:Tasks.contrastTask(key)}),result=audit([event]);assert.equal(result.status,'audited');assert.deepEqual(result.events,[]);
  assert.equal(selectedEvidence(recommend([event])).status,'unknown');assert.equal(selectedEvidence(recommend([event])).observations,0);
 }
});

test('a wrapped event cannot claim a different original activity from its resolved catalogue task',()=>{
 const event=recorded({legacy:true});event.activityId='p1';event.choice=0;
 assert.equal(audit([event]).events.length,0);assert.equal(selectedEvidence(recommend([event])).status,'unknown');
});

test('quarantined Imru p3 cannot provide response evidence to its mismatched grief annotation',()=>{
 const poem=X.itemById('imru-al-qais-stop-and-weep'),task=Tasks.catalogueEvidenceTask(poem,'p3'),event=recorded({task,legacy:true}),grief=poem.annotations.find(a=>a.id==='a4');
 assert.equal(task.analysisRef.status,'quarantined');assert.deepEqual(audit([event]).events,[]);
 const result=recommend([event],{source:sourceFor(poem,grief)});assert.equal(selectedEvidence(result).status,'unknown');assert.equal(selectedEvidence(result).observations,0);
});

test('the known mismatched activity is withheld from new recommendations after a successful recall',()=>{
 const poem=X.itemById('imru-al-qais-stop-and-weep'),recall=recorded({task:Tasks.catalogueEvidenceTask(poem,'p2')});
 assert.equal(X.nextSupport(poem,audit([recall]).events).activityId,'p3','The legacy support rule remains unchanged');
 const result=recommend([recall],{source:sourceFor(poem,null)});
 assert.equal(actions(result).some(candidate=>candidate.kind==='practice-content'&&candidate.action.activityId==='p3'),false);
 assert.ok(result.notices.some(notice=>notice.includes('unresolved source-analysis mapping')));assert.equal(result.continueAction.kind,'continue-media');
});

test('scoped opened wrappers retain actual engagement but standalone display does not invent a completed assessment or opening',()=>{
 const opened=recorded();opened.kind='opened';delete opened.sessionId;
 Object.assign(opened.evidence,{observation:'displayed',attemptId:null,taskRef:null,response:null,outputModality:'none',assessment:null,rubricRef:null,scorerRef:null,analysisRef:null});
 const result=recommend([opened]);assert.equal(selectedEvidence(result).engagement.opened,true);assert.equal(selectedEvidence(result).status,'unknown');
 const displayed=clone(opened);displayed.kind='evidence';displayed.sessionId=displayed.evidence.episodeId;
 assert.deepEqual(audit([displayed]).events,[]);assert.equal(selectedEvidence(recommend([displayed])).engagement.opened,false);
});

test('audit and ranking are deterministic for fixed replay time and never modify stored responses',()=>{
 const response=recorded(),hint=asHint(response),events=[response,hint],before=clone(events);
 assert.deepEqual(audit(events),audit([...events].reverse()));assert.deepEqual(recommend(events),recommend([...events].reverse()));assert.deepEqual(events,before);
 assert.equal(Object.hasOwn(recommend(events),'posterior'),false);assert.equal(Object.hasOwn(recommend(events),'mastery'),false);
});
