import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import * as X from '../public/nabu-content.js';
import * as O from '../public/nabu-observations.js';
import {CATALOG} from '../public/nabu-content-catalogue.js';
import {highlightContext} from '../public/nabu-reading-ui.js';
const item=X.itemById('a-little-later'),NOW=Date.UTC(2026,10,9,12);
let serial=0;const event=(kind,extra={})=>({id:'event-'+String(++serial).padStart(16,'0'),contentId:item.id,version:1,kind,at:NOW+serial,...extra});
const attempt=extra=>event('attempt',{activityId:'p2',sessionId:'session-1234567890',assisted:false,skipped:false,answer:item.practice[1].accepted[0],...extra});
const tokenize=text=>[...new Intl.Segmenter('ar',{granularity:'word'}).segment(text)].map(x=>({text:x.segment,start:x.index,word:x.isWordLike}));
test('exactly six usable items, required genres, rights and editorial status',()=>{assert.deepEqual(X.validateCatalogue(),{items:6,annotations:24});assert.equal(X.ITEMS.filter(i=>i.genre==='poetry').length,2);assert.equal(X.ITEMS.filter(i=>i.genre==='dialogue').length,2);for(const p of X.ITEMS){assert(p.rights.text);assert.match(p.editorialStatus,/not instructor/);assert(p.segments.at(-1).text);assert(p.practice.some(x=>x.mode==='recall'));}});
for(const p of X.ITEMS){
 test(p.id+': all anchors reproduce the original text and multiword expressions',()=>{const tokens=X.anchoredTokens(p,tokenize);assert.equal(tokens.map(t=>t.text).join(''),X.sourceText(p));assert.equal(tokens.filter(t=>t.annotationId).length,4);for(const t of tokens){assert.equal(X.sourceText(p).slice(t.start,t.start+t.text.length),t.text);}assert(p.annotations.some(a=>a.quote.includes(' ')));});
 test(p.id+': every activity accepts its authored answer',()=>{for(const task of p.practice){const r=X.evaluateAttempt(p,{activityId:task.id,answer:task.accepted?.[0],choice:task.answer,assisted:false});assert.equal(r.outcome,'unaided-correct');}});
}
test('Imru al-Qais opening is a sourced classical excerpt, not an invented Nabu poem',()=>{const p=X.itemById('imru-al-qais-stop-and-weep');assert(p);assert.equal(p.creator,'امرؤ القيس (Imru’ al-Qais)');assert(p.segments[0].text.startsWith('قِفَا نَبْكِ'));assert.equal(p.annotations[0].quote,'قِفَا نَبْكِ');assert.match(p.register,/Pre-Islamic Classical/);assert.match(p.rights.text,/public domain/i);assert.match(p.sourceReferences[0].url,/ar\.wikisource\.org/);assert(!p.practice.some(x=>x.mode==='production'));});
test('Unicode scalar to UTF16 conversion includes astral symbols and marks',()=>{const str='A\u{1f4da}\u0643\u0650B';assert.equal(X.scalarToUTF16(str,2),3);assert.equal(str.slice(X.scalarToUTF16(str,2),X.scalarToUTF16(str,4)),'\u0643\u0650');});
test('repeated words highlight the explicitly selected occurrence',()=>{assert.equal(highlightContext('bank then bank','bank',10),'bank then <mark>bank</mark>');});
test('altered quote fails validation rather than becoming a dead annotation',()=>{const c=structuredClone(CATALOG);c.items[0].annotations[0].start++;assert.throws(()=>X.validateCatalogue(c),/anchor/);});
test('bad links and answer rules fail publication validation',()=>{const c=structuredClone(CATALOG);c.items[0].nextId='missing';assert.throws(()=>X.validateCatalogue(c),/next/);c.items[0].nextId=item.nextId;c.items[0].practice[1].answerPolicy='search';assert.throws(()=>X.validateCatalogue(c),/policy/);});
test('assisted, incorrect, unaided and skipped responses are distinct',()=>{assert.equal(X.evaluateAttempt(item,attempt({assisted:true})).outcome,'assisted-correct');assert.equal(X.evaluateAttempt(item,attempt({answer:'incorrect'})).outcome,'incorrect');assert.equal(X.evaluateAttempt(item,attempt()).outcome,'unaided-correct');assert.equal(X.evaluateAttempt(item,attempt({skipped:true})).correct,null);});
test('Arabic optional vowels ignored; hamza and different letters are retained',()=>{assert.equal(X.normalizeAnswer('\u0643\u0650\u062a\u064e\u0627\u0628\u061f'),'\u0643\u062a\u0627\u0628');assert.notEqual(X.normalizeAnswer('\u0623\u0646'),X.normalizeAnswer('\u0627\u0646'));assert.notEqual(X.normalizeAnswer('\u0647'),X.normalizeAnswer('\u0629'));});
test('two response histories yield different inspectable next support',()=>{const wrong=X.nextSupport(item,[attempt({answer:'wrong'})]);const right=X.nextSupport(item,[attempt()]);assert.equal(wrong.activityId,'p2');assert.equal(right.activityId,'p3');assert.notEqual(wrong.reason,right.reason);assert.equal(wrong.policy,'content-support-v1');});
test('assistance cannot masquerade as unaided recall; skip leaves policy unchanged',()=>{assert.equal(X.nextSupport(item,[attempt({assisted:true})]).activityId,'p2');assert.equal(X.nextSupport(item,[attempt({skipped:true})]).activityId,'p1');});
test('opening or finishing content does not fabricate practice outcomes',()=>{const p=X.progressFor(item,[event('opened'),event('finished',{value:true})]);assert(p.started&&p.finished);assert.equal(p.attempts.length,0);assert.equal(X.nextSupport(item,[event('opened')]).activityId,'p1');});
test('same event retried is counted once, mismatched payload rejected',()=>{const e=attempt();assert.equal(X.mergeEvents([e],[{...e}]).length,1);assert.throws(()=>X.mergeEvents([e],[{...e,answer:'different'}]),/reused/);assert.equal(X.progressFor(item,[e,e]).attempts.length,1);});
test('server key ordering is not a different event',()=>{const e=attempt(),r=Object.fromEntries(Object.entries(e).sort());assert.equal(X.mergeEvents([e],[r]).length,1);});
test('unknown versions do not borrow annotations or mastery',()=>{assert.equal(X.itemById(item.id,2),null);assert.equal(X.progressFor(item,[{...attempt(),version:2}]).attempts.length,0);});
test('positions and practice are validated before persistence',()=>{assert.throws(()=>X.validateEvent(event('position',{segmentId:'fake',fraction:0})));assert.throws(()=>X.validateEvent(attempt({answer:''})));assert.throws(()=>X.validateEvent(event('position',{segmentId:'s1',fraction:2})));});
test('explicit preferences change next-content ranking, not recall state',()=>{const e=event('preference',{contentId:'an-unsent-letter',value:true});assert.equal(X.recommendNext(item,[]).item.id,'a-book-for-rain');assert.equal(X.recommendNext(item,[e]).item.interest,'feeling');assert.equal(X.nextSupport(item,[e]).activityId,'p1');});

test('source URLs reject active schemes and credential-bearing addresses',()=>{for(const url of ['javascript:alert(1)','http://example.com','https://user:password@example.com']){const c=structuredClone(CATALOG);c.items[0].sourceReferences=[{url,title:'Source',use:'Reference'}];assert.throws(()=>X.validateCatalogue(c),/source/);}});
test('answer positions vary instead of always rewarding the first choice',()=>{const indices=new Set(X.ITEMS.flatMap(p=>p.practice.filter(t=>t.mode!=='recall').map(t=>t.answer)));assert.equal(indices.size,3);});
test('same spelling in two source occurrences keeps separate meanings',()=>{const p=structuredClone(item);p.segments=[{id:'s1',text:'bank beside the bank',translation:'Two different senses.'}];p.annotations=[{id:'a1',segmentId:'s1',quote:'bank',start:0,end:4,prefix:'',suffix:' beside',meaning:'financial institution',usage:'First occurrence.'},{id:'a2',segmentId:'s1',quote:'bank',start:16,end:20,prefix:'the ',suffix:'',meaning:'river edge',usage:'Second occurrence.'}];const tokens=X.anchoredTokens(p,tokenize).filter(t=>t.annotationId);assert.deepEqual(tokens.map(t=>[t.annotationId,t.start]),[['a1',0],['a2',16]]);assert.notEqual(p.annotations[0].meaning,p.annotations[1].meaning);});

function evidenceRecord(n,{observation='displayed',contentId=item.id,version=1}={}){
 const reference=id=>({id,version:1,status:'authored',provenance:[{sourceId:'fixture:content-test',locator:'fixture',kind:'authored-fixture'}]});
 const active=['response','hint','answer-revealed','skipped'].includes(observation),episodeId='content-episode-'+String(n).padStart(16,'0');
 return {id:'content-evidence-'+String(n).padStart(16,'0'),kind:'evidence',at:NOW+n,contentId,version,sessionId:episodeId,evidence:{schemaVersion:1,episodeId,attemptId:active?'content-attempt-'+String(n).padStart(16,'0'):null,retryOfEpisodeId:null,actor:{userId:null,tenantId:null},intentRef:null,organizationObjectiveRef:null,taskRef:active?{id:'fixture:p2',version:1}:null,occurrence:{contentId,version,segmentId:'s1',annotationId:'a3',readingId:'fixture-reading',context:{lexicalId:null,senseId:null,speakerId:null,syntaxId:null,contextId:null}},inputModality:'text',outputModality:observation==='response'?'text':'none',observation,assistance:O.emptyAssistance(),presentedAt:active?NOW:null,response:observation==='response'?{answer:item.practice[1].accepted[0]}:null,skipReason:null,assessment:null,rubricRef:active?reference('fixture:rubric'):null,scorerRef:active?reference('fixture:scorer'):null,analysisRef:null}};
}
test('standalone evidence does not modify legacy progress, recency or next-support state',()=>{
 const original=event('opened'),standalone=evidenceRecord(99999,{observation:'response'});
 assert.deepEqual(X.progressFor(item,[original,standalone]),X.progressFor(item,[original]));
 assert.deepEqual(X.nextSupport(item,[original,standalone]),X.nextSupport(item,[original]));
 assert.deepEqual(X.progressFor(item,[standalone]),X.emptyProgress());
});
test('new evidence supports versioned noncatalogue references without adding invented reader content',()=>{
 const e=evidenceRecord(1,{contentId:'reading:opaque-reference',version:4});assert.doesNotThrow(()=>X.validateEvent(e));assert.equal(X.itemById(e.contentId,e.version),null);assert.equal(X.mergeEvents([],[e]).length,1);
});
test('an envelope on the original legacy attempt remains exactly one legacy response',()=>{
 const record=evidenceRecord(1,{observation:'response'}),legacy={...record,kind:'attempt',activityId:'p2',sessionId:'old-session',answer:record.evidence.response.answer,assisted:false,skipped:false};
 assert.doesNotThrow(()=>X.validateEvent(legacy));assert.equal(X.progressFor(item,[legacy]).attempts.length,1);assert.equal(X.progressFor(item,[legacy]).attempts[0].correct,true);
 assert.throws(()=>X.validateEvent({...legacy,answer:'contradiction'}),/disagree/);
});
test('historical enveloped versions survive merge without borrowing current catalogue answers',()=>{
 const record=evidenceRecord(1,{observation:'response',version:99}),legacy={...record,kind:'attempt',activityId:'historical-task',sessionId:'old-session',answer:record.evidence.response.answer,assisted:false,skipped:false};
 assert.doesNotThrow(()=>X.validateEvent(legacy));assert.equal(X.mergeEvents([],[legacy]).length,1);assert.equal(X.progressFor(item,[legacy]).attempts.length,0);
});
test('nested server key ordering is canonical while changed nested evidence still conflicts',()=>{
 const reorder=value=>Array.isArray(value)?value.map(reorder):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).reverse().map(([key,v])=>[key,reorder(v)])):value;
 const record=evidenceRecord(1,{observation:'response'});assert.equal(X.mergeEvents([record],[reorder(record)]).length,1);
 const changed=structuredClone(record);changed.evidence.assistance.hint=true;assert.throws(()=>X.mergeEvents([record],[changed]),/reused/);
});
test('merge accepts nested plain JSON from another realm without accepting non-JSON classes',()=>{
 const record=evidenceRecord(1,{observation:'response'}),foreign=runInNewContext('JSON.parse(payload)',{payload:JSON.stringify(record)});assert.equal(X.mergeEvents([record],[foreign]).length,1);
 const legacy=event('opened');legacy.privateValue=new Date();assert.throws(()=>X.mergeEvents([],[legacy]),/JSON data/);
});
test('different event IDs cannot append the same terminal attempt twice',()=>{
 const record=evidenceRecord(1,{observation:'response'}),duplicate={...structuredClone(record),id:'duplicate-evidence-00001'};assert.throws(()=>X.mergeEvents([record],[duplicate]),/terminal response/);
});
