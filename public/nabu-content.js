/** Versioned curated content, exact source anchors, and transparent practice rules.
 * Original content never leaves the app for a lookup of an authored annotation.
 * Offsets in the catalogue count Unicode scalar values; DOM offsets count UTF-16.
 */
import {CATALOG} from './nabu-content-catalogue.js';
import * as Observations from './nabu-observations.js';
import * as SupportCycle from './nabu-support-cycle.js';
export const INTERESTS = Object.freeze({feeling:'Feel something',story:'Follow a story',useful:'Say something useful',discover:'Discover something interesting'});
export const POLICY_VERSION = 'content-support-v1';
export const ITEMS = CATALOG.items;
export function itemById(id,version=1){return ITEMS.find(x=>x.id===id&&x.version===version)||null;}
export function scalarToUTF16(text,index){return Array.from(text).slice(0,index).join('').length;}
export function validateCatalogue(catalog=CATALOG){
 const ids=new Set();if(catalog.schemaVersion!==1||!Array.isArray(catalog.items)||!catalog.items.length)throw Error('Invalid content catalogue.');
 for(const item of catalog.items){
  if(!/^[a-z0-9-]+$/.test(item.id)||ids.has(item.id+'@'+item.version))throw Error('Duplicate/invalid content ID.');ids.add(item.id+'@'+item.version);
  if(!Number.isInteger(item.version)||item.version<1||!INTERESTS[item.interest]||!item.title||!item.titleTranslation||!item.creator||!item.rights?.text||!item.editorialStatus||!item.register)throw Error('Incomplete content metadata: '+item.id);
  if(item.format!=='text'||item.language!=='ar'||item.translationLanguage!=='en')throw Error('Unsupported initial content format/language.');
  if(!Array.isArray(item.sourceReferences)||!item.segments?.length||!item.preview||!item.difficulty||!['poetry','story','dialogue','fact'].includes(item.genre)||!Number.isFinite(item.estimatedMinutes)||item.estimatedMinutes<=0)throw Error('Incomplete published item.');
  for(const source of item.sourceReferences){let u;try{u=new URL(source.url);}catch{throw Error('Invalid source URL.');}if(u.protocol!=='https:'||u.username||u.password||!source.title||!source.use)throw Error('Unsafe or incomplete source reference.');}
  const segments=new Map();for(const s of item.segments){if(!s.id||segments.has(s.id)||!s.text||!s.translation)throw Error('Invalid segment.');segments.set(s.id,s);}
  const annotations=new Set();const occupied=new Map();
  for(const a of item.annotations){
   const s=segments.get(a.segmentId);if(!s||!a.id||annotations.has(a.id)||!a.meaning||!a.usage)throw Error('Invalid annotation.');annotations.add(a.id);
   const chars=Array.from(s.text);if(!Number.isInteger(a.start)||!Number.isInteger(a.end)||a.start<0||a.end<=a.start||a.end>chars.length||chars.slice(a.start,a.end).join('')!==a.quote)throw Error('Broken annotation anchor: '+item.id+'/'+a.id);
   if(!chars.slice(0,a.start).join('').endsWith(a.prefix)||!chars.slice(a.end).join('').startsWith(a.suffix))throw Error('Quote context mismatch.');
   for(const [lo,hi] of occupied.get(s.id)||[])if(a.start<hi&&a.end>lo)throw Error('Overlapping annotations.');
   occupied.set(s.id,[...(occupied.get(s.id)||[]),[a.start,a.end]]);
  }
  const activityIds=new Set();for(const p of item.practice){
   if(activityIds.has(p.id)||!p.prompt||!p.hint||!p.explanation||!annotations.has(p.annotationId))throw Error('Incomplete activity.');activityIds.add(p.id);
   if(p.mode==='recall'){if(p.answerPolicy!=='arabic-optional-vowels-v1'||!p.accepted?.length||p.accepted.some(a=>!a.trim()))throw Error('Invalid recall answer policy.');}
   else if(!['recognition','related-context'].includes(p.mode)||p.options?.length<2||!Number.isInteger(p.answer)||p.answer<0||p.answer>=p.options.length)throw Error('Invalid recognition answer.');
  }
  if(item.practice.length<2||item.practice.length>3)throw Error('Use two or three activities per piece.');
 }
 for(const item of catalog.items)if(!catalog.items.some(x=>x.id===item.nextId))throw Error('Broken next item.');
 return {items:catalog.items.length,annotations:catalog.items.reduce((n,x)=>n+x.annotations.length,0)};
}
export function sourceText(item){return item.segments.map(s=>s.text).join('\n\n');}
export function anchoredTokens(item,tokenize){
 const result=[];let offset=0;
 for(let si=0;si<item.segments.length;si++){
  const s=item.segments[si],annotations=item.annotations.filter(a=>a.segmentId===s.id).sort((a,b)=>a.start-b.start);let cursor=0;
  const append=(text,start)=>{for(const t of tokenize(text,item.language))result.push({...t,start:offset+start+t.start,segmentId:s.id});};
  for(const a of annotations){const start=scalarToUTF16(s.text,a.start),end=scalarToUTF16(s.text,a.end);append(s.text.slice(cursor,start),cursor);result.push({text:a.quote,start:offset+start,word:true,annotationId:a.id,segmentId:s.id});cursor=end;}
  append(s.text.slice(cursor),cursor);offset+=s.text.length;
  if(si<item.segments.length-1){result.push({text:'\n\n',start:offset,word:false});offset+=2;}
 }
 return result;
}
export function normalizeAnswer(text){
 // Optional vowel marks only. Hamza, ta marbuta and distinct letters remain distinct.
 return String(text||'').normalize('NFC').replace(/[\u064b-\u0652\u0640]/gu,'').trim().replace(/\s+/gu,' ').replace(/[.!?\u061f\u060c]+$/u,'').trim();
}
export function evaluateAttempt(item,event){
 const task=item.practice.find(p=>p.id===event.activityId);if(!task)return {outcome:'unscorable',correct:null,assisted:false};
 if(event.skipped)return {outcome:'skipped',correct:null,assisted:false};
 const correct=task.mode==='recall'?task.accepted.some(a=>normalizeAnswer(a)===normalizeAnswer(event.answer)):Number.isInteger(event.choice)&&event.choice===task.answer;
 const assisted=!!event.assisted;
 return {outcome:correct?(assisted?'assisted-correct':'unaided-correct'):'incorrect',correct,assisted,mode:task.mode};
}
export function emptyProgress(){return {started:false,finished:false,lastSegment:'s1',fraction:0,attempts:[],saved:[],preference:false,lastAt:0};}
export function progressFor(item,events){
 const p=emptyProgress();const seen=new Set();
 for(const e of [...events].sort((a,b)=>a.at-b.at||a.id.localeCompare(b.id))){
  if(e.kind==='evidence'||e.kind==='support-cycle')continue;
  if(seen.has(e.id)||e.contentId!==item.id||e.version!==item.version)continue;seen.add(e.id);p.lastAt=Math.max(p.lastAt,e.at);
  if(e.kind==='opened')p.started=true;
  if(e.kind==='position'){p.lastSegment=e.segmentId;p.fraction=e.fraction;}
  if(e.kind==='finished')p.finished=e.value;
  if(e.kind==='preference')p.preference=e.value;
  if(e.kind==='saved'&&!p.saved.some(x=>x.annotationId===e.annotationId))p.saved.push(e);
  if(e.kind==='attempt')p.attempts.push({...e,...evaluateAttempt(item,e)});
 }
 return p;
}
export function nextSupport(item,events){
 const p=progressFor(item,events),recall=item.practice.find(t=>t.mode==='recall');
 const last=[...p.attempts].reverse().find(e=>e.activityId===recall?.id&&e.outcome!=='skipped');
 if(!last)return {activityId:item.practice[0].id,reason:'Start with meaning in context. There is no recall evidence yet.',policy:POLICY_VERSION};
 if(last.correct&&!last.assisted)return {activityId:item.practice.find(t=>t.mode==='related-context')?.id||recall.id,reason:'Your last unaided recall matched the authored answer. Try interpreting a related sentence.',policy:POLICY_VERSION};
 return {activityId:recall.id,reason:last.assisted?'You used help last time. Try recalling it again; help is still available.':'Your last recall did not match. Revisit the expression and try again when ready.',policy:POLICY_VERSION};
}
export function validateEvent(e){
 if(e?.kind==='support-cycle')return SupportCycle.validateSupportEvent(e);
 if(e?.kind==='evidence')return Observations.validateEvidenceEvent(e);
 const enveloped=!!e&&Object.hasOwn(e,'evidence');if(enveloped)Observations.validateEvidenceEvent(e);
 const item=itemById(e.contentId,e.version);
 if(!item&&enveloped){
  // Historical, versioned observations remain replayable even when their
  // content is no longer in the current catalogue. They are not regraded here.
  if(['attempt','help'].includes(e.kind)&&(typeof e.activityId!=='string'||!e.activityId||e.activityId.length>80||typeof e.sessionId!=='string'||e.sessionId.length>80))throw Error('Invalid historical practice activity.');
  return e;
 }
 if(!item||typeof e.id!=='string'||!(enveloped?/^[a-zA-Z0-9_-]{16,80}$/:/^[a-zA-Z0-9-]{16,80}$/).test(e.id)||!Number.isFinite(e.at)||e.at<0)throw Error('Invalid progress record.');
 if(!['opened','position','finished','preference','help','attempt','saved'].includes(e.kind))throw Error('Unsupported progress action.');
 if(e.kind==='position'&&(!item.segments.some(s=>s.id===e.segmentId)||!Number.isFinite(e.fraction)||e.fraction<0||e.fraction>1))throw Error('Invalid reading position.');
 if(['finished','preference'].includes(e.kind)&&typeof e.value!=='boolean')throw Error('Invalid preference.');
 if(e.kind==='saved'&&!item.annotations.some(a=>a.id===e.annotationId))throw Error('Invalid source annotation.');
 if(['attempt','help'].includes(e.kind)){
  const task=item.practice.find(p=>p.id===e.activityId);if(!task||typeof e.sessionId!=='string'||e.sessionId.length>80)throw Error('Invalid practice activity.');
  if(e.kind==='help'&&!['hint','answer'].includes(e.help))throw Error('Invalid help state.');
  if(e.kind==='attempt'&&!e.skipped){if(typeof e.assisted!=='boolean')throw Error('Missing assistance status.');if(task.mode==='recall'&&(typeof e.answer!=='string'||!e.answer.trim()||e.answer.length>300))throw Error('Enter a short response.');if(task.mode!=='recall'&&(!Number.isInteger(e.choice)||e.choice<0||e.choice>=task.options.length))throw Error('Choose an answer.');}
 }
 return e;
}
function canonicalEvent(value){
 if(value===null||typeof value==='string'||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value))return JSON.stringify(value);
 if(Array.isArray(value))return '['+value.map(canonicalEvent).join(',')+']';
 if(value&&Object.prototype.toString.call(value)==='[object Object]'){
  const proto=Object.getPrototypeOf(value),constructor=proto&&Object.getOwnPropertyDescriptor(proto,'constructor')?.value;
  if(proto===null||Object.getPrototypeOf(proto)===null&&typeof constructor==='function'&&Function.prototype.toString.call(constructor)===Function.prototype.toString.call(Object))return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonicalEvent(value[key])).join(',')+'}';
 }
 throw Error('Progress records must contain only JSON data.');
}
export function mergeEvents(a,b){const map=new Map();for(const raw of [...a,...b]){const e=validateEvent(raw),canonical=canonicalEvent(e),old=map.get(e.id);if(old&&canonicalEvent(old)!==canonical)throw Error('A progress ID was reused with different data.');map.set(e.id,e);}const merged=[...map.values()].sort((a,b)=>a.at-b.at||a.id.localeCompare(b.id));Observations.validateEvidenceSequence(merged);SupportCycle.validateSupportSequence(merged);return merged;}
/** Preference is an explicit content choice, never an estimate of knowledge. */
export function recommendNext(item,events){
 const preferred=new Set(ITEMS.filter(x=>progressFor(x,events).preference).map(x=>x.interest));
 const ranked=ITEMS.filter(x=>x.id!==item.id).map((x,index)=>({item:x,index,score:(preferred.has(x.interest)?4:0)+(!progressFor(x,events).finished?2:0)+(x.id===item.nextId?1:0)})).sort((a,b)=>b.score-a.score||a.index-b.index);
 const next=ranked[0].item;
 const reason=preferred.has(next.interest)?'You asked for more: '+INTERESTS[next.interest].toLowerCase()+'.':next.genre===item.genre?'Another piece in the same format.':'A different kind of reading from this small collection.';
 return {item:next,reason};
}
