/* Durable account outbox. HTTP failure never means "synced". Account caches are
 * scoped by immutable user ID and removed on explicit sign-out. Tokens/passwords
 * are never saved in IndexedDB. All queue mutations are atomic IDB transactions.
 */
import * as C from './nabu-core.js';
import * as Local from './nabu-store.js';
let request=null,owner='',epoch=0,running=null,scheduled=null;
let status={state:'local',pending:0,conflicts:0,lastSync:0,message:''};
const empty=()=>({server:{cards:[],logs:[],history:[]},queue:[],conflicts:[],lastSync:0,initialized:false});
const key=uid=>'account-cache:'+uid;
const clone=value=>JSON.parse(JSON.stringify(value));
const record=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
function validateSnapshot(value) {
 // Validate BEFORE replacing the last confirmed cache or acknowledging an outbox
 // item. A successful HTTP status alone is not evidence of a valid library.
 const invalid=()=>{throw new Error('The server returned an invalid library. Your last confirmed copy and pending changes were kept. Retry after checking the server.');};
 const number=v=>Number.isFinite(v)&&v>=0;
 const integer=v=>Number.isSafeInteger(v)&&v>=0;
 const id=v=>typeof v==='string'&&v.length>0&&v.length<=100;
 const schedule=s=>record(s)&&s.algorithm==='nabu-srs-v1'&&['new','learning','review','relearning'].includes(s.state)&&
  integer(s.step)&&number(s.due)&&number(s.interval)&&number(s.ease)&&integer(s.reps)&&integer(s.lapses)&&
  (s.lastReview===null||number(s.lastReview));
 const card=c=>{
  if(!record(c)||!id(c.id)||!integer(c.revision)||!number(c.createdAt)||!number(c.updatedAt)||typeof c.archived!=='boolean'||!schedule(c.schedule))invalid();
  try{C.cardContent(c);}catch{invalid();}
  if(c.skills!==undefined&&(!record(c.skills)||Object.entries(c.skills).some(([mode,s])=>!C.PRACTICE_MODES.includes(mode)||!schedule(s))))invalid();
 };
 if(!record(value)||!['cards','logs','history'].every(name=>Array.isArray(value[name])))invalid();
 const ids=new Set();for(const c of value.cards){card(c);if(ids.has(c.id))invalid();ids.add(c.id);}
 const logIds=new Set();for(const log of value.logs){
  if(!record(log)||!id(log.id)||!id(log.cardId)||!number(log.at)||![1,2,3,4].includes(log.rating)||!integer(log.afterRevision)||logIds.has(log.id))invalid();
  logIds.add(log.id);if(log.before!=null)card(log.before);
 }
 for(const item of value.history){
  if(!record(item)||typeof item.id!=='string'||!number(item.at))invalid();
  try{C.cardContent(item);}catch{invalid();}
 }
 return value;
}
function validateAcknowledgment(response) {
 if(!record(response)||!record(response.result))throw new Error('Incomplete sync response; changes remain pending.');
 validateSnapshot(response.snapshot);
 const mapping=response.result.idMap;
 if(mapping!==undefined&&(!record(mapping)||Object.entries(mapping).some(([from,to])=>!from||typeof to!=='string'||!to||!response.snapshot.cards.some(c=>c.id===to))))
  throw new Error('Invalid sync mapping; changes remain pending.');
 return response;
}
function emit(doc,state,message='') {
 status={state,pending:doc?.queue.length||0,conflicts:doc?.queue.filter(o=>o.blocked).length||0,lastSync:doc?.lastSync||0,message};
 if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('nabu-sync',{detail:{...status}}));
}
function guard(uid,generation) {if(owner!==uid||epoch!==generation)throw new Error('The active account changed. Reopen your library.');}
function validOwner(){if(!owner||owner==='!expired!')throw new Error('Sign in again to open your account library.');return owner;}
export function configure(transport,uid='') {request=transport;owner=uid;epoch++;running=null;clearTimeout(scheduled);status={state:uid?'connecting':'local',pending:0,conflicts:0,lastSync:0,message:''};}
export function lock(){owner='!expired!';epoch++;emit(null,'locked','Sign in again. Pending changes are preserved.');}
export function getStatus(){return {...status};}
async function read(uid=validOwner()){return await Local.getMeta(key(uid),null);}
export async function rememberAccount(user){await Local.setMeta('lastAccount',user?{id:user.id,handle:user.handle}:null);}
export async function lastAccount(){return Local.getMeta('lastAccount',null);}
export async function forget(uid,{preserveRemembered=false}={}){if(uid){await Local.setMeta(key(uid),null);await Local.setMeta('account-auth-required:'+uid,false);}if(!preserveRemembered)await rememberAccount(null);}
function apply(view,op) {
 const p=op.payload;let result;
 const get=id=>{const c=view.cards.find(x=>x.id===id);if(!c)throw new Error('This card is not available locally.');return c;};
 const put=c=>{const i=view.cards.findIndex(x=>x.id===c.id);if(i<0)view.cards.push(c);else view.cards[i]=c;return c;};
 if(op.kind==='add'||op.kind==='translation') {
  let added=0,restored=false;const cards=[];
  for(const c of op.kind==='add'?p.cards:[p.card]) {
   let old=view.cards.find(x=>x.id===c.id||C.identity(x)===C.identity(c)||!c.conceptId&&C.identity({...x,conceptId:''})===C.identity(c));
   if(old){if(op.kind==='translation'&&old.archived){old=put({...old,archived:false,revision:old.revision+1});restored=true;}cards.push(old);}
   else{put(clone(c));cards.push(c);added++;}
  }
  result={cards,added,duplicates:cards.length-added};
  if(op.kind==='translation'){
   const c=cards[0],entry={...C.cardContent(c),id:C.identity(c),at:op.at,provider:p.provider};
   view.history=[entry,...view.history.filter(h=>h.id!==entry.id)].slice(0,50);result={card:c,added:!!added,restored};
  }
 } else if(op.kind==='undo') {
  const log=view.logs.find(x=>x.id===p.logId);if(!log?.before)throw new Error('Review not available to undo.');
  const old=get(log.cardId);if(old.revision!==log.afterRevision)throw new Error('Newer changes prevent undo.');
  put({...log.before,revision:old.revision+1,updatedAt:op.at});view.logs=view.logs.filter(x=>x.id!==p.logId);result={ok:true};
 } else {
  const old=get(p.cardId);
  if(old.revision!==p.revision)throw new Error('This card changed. Your pending edit needs review.');
  if(op.kind==='edit')result=put({...old,...C.cardContent(p.content),revision:old.revision+1,updatedAt:op.at});
  if(op.kind==='archive')result=put({...old,archived:p.archived,revision:old.revision+1,updatedAt:op.at});
  if(op.kind==='review'){
   const next=put(C.applyReview(old,p.rating,op.at,p.practiceMode));
   const log={id:op.id,cardId:old.id,at:op.at,rating:p.rating,before:old,afterRevision:next.revision,durationMs:p.durationMs,practiceMode:p.practiceMode};
   view.logs.push(log);result={card:next,log};
  }
 }
 return result;
}
export function project(document) {
 const view=clone(document.server);
 for(const op of document.queue){try{apply(view,op);}catch{/* The original operation remains exportable in the outbox. */}}
 view.logs.sort((a,b)=>b.at-a.at);return view;
}
async function ensure(){
 const uid=validOwner(),generation=epoch;let doc=await read(uid);guard(uid,generation);
 if(doc?.initialized){if(status.state==='connecting')emit(doc,doc.queue.some(o=>o.blocked)?'conflict':doc.queue.length?'pending':globalThis.navigator?.onLine===false?'offline':'cached');return doc;}
 const remote=await request('library',{ms:6000});guard(uid,generation);
 validateSnapshot(remote);
 doc=await Local.mutateMeta(key(uid),existing=>existing?.initialized?existing:{...empty(),server:remote,initialized:true,lastSync:Date.now()});
 guard(uid,generation);emit(doc,doc.queue.some(o=>o.blocked)?'conflict':doc.queue.length?'pending':'synced');return doc;
}
export async function snapshot(){return project(await ensure());}
export async function pending(){return (await read())?.queue||[];}
export async function enqueue(kind,payload,at=Date.now()) {
 const uid=validOwner(),generation=epoch;await ensure();guard(uid,generation);
 const op={id:C.uid(),kind,payload,at};let result;
 const doc=await Local.mutateMeta(key(uid),d=>{
  if(!d?.initialized)throw new Error('Open your account library online once before working offline.');
  if(d.queue.length>=1000)throw new Error('Sync or export your 1,000 pending changes before adding more.');
  if(d.queue.some(x=>x.blocked))throw new Error('Resolve the pending sync conflict before editing more cards.');
  result=apply(project(d),op);return {...d,queue:[...d.queue,op]};
 });
 guard(uid,generation);emit(doc,'pending');schedule();return result;
}
function schedule(){clearTimeout(scheduled);scheduled=setTimeout(()=>flush().catch(()=>{}),50);}
function mapQueue(queue,mapping) {
 return queue.map(op=>{
  const value=clone(op);
  if(value.payload.cardId&&mapping[value.payload.cardId])value.payload.cardId=mapping[value.payload.cardId];
  return value;
 });
}
export async function flush(refresh=false) {
 const uid=validOwner(),generation=epoch;
 if(running)return running;
 const work=async()=>{
  let doc=await ensure();guard(uid,generation);
  if(globalThis.navigator?.onLine===false){emit(doc,'offline');return;}
  try{
   while(doc.queue.length){
    const op=doc.queue[0];if(op.blocked){emit(doc,'conflict',op.error);return;}
    emit(doc,'syncing');
    const response=await request('sync',{method:'POST',body:{id:op.id,kind:op.kind,payload:op.payload,at:op.at},ms:8000});guard(uid,generation);
    validateAcknowledgment(response);
    doc=await Local.mutateMeta(key(uid),current=>({...current,server:response.snapshot,
     queue:mapQueue(current.queue.filter(x=>x.id!==op.id),response.result.idMap||{}),lastSync:Date.now()}));
    guard(uid,generation);
   }
   if(refresh){
    const remote=await request('library',{ms:6000});guard(uid,generation);validateSnapshot(remote);
    doc=await Local.mutateMeta(key(uid),current=>({...current,server:remote,lastSync:Date.now()}));
   }
   // Another tab may have queued an operation while the previous acknowledgment
  // was in flight. Never call the whole account synced from a stale snapshot.
  doc=await read(uid);guard(uid,generation);
  emit(doc,doc.queue.length?'pending':'synced');
  }catch(error){
   if(owner!==uid||generation!==epoch)return;
   doc=await read(uid);
   if([400,404,409,413,422].includes(error.status)&&doc.queue.length){
    const first=doc.queue[0];
    doc=await Local.mutateMeta(key(uid),d=>({...d,queue:d.queue.map(o=>o.id===first.id?{...o,blocked:true,error:error.message}:o)}));
    emit(doc,'conflict',error.message);
   }else emit(doc,[401,403].includes(error.status)?'locked':error.status===429?'paused':'offline',error.message);
  }
 };
 // The Web Locks API serializes network flushes across Nabu tabs on HTTPS/localhost.
 // Without it, server-side UUID receipts still make retries idempotent, but
 // browsers without Web Locks cannot guarantee one concurrent sender per account.
 const locked=()=>globalThis.navigator?.locks?.request
  ?globalThis.navigator.locks.request('nabu-sync:'+uid,{mode:'exclusive'},work)
  :work();
 running=locked();const promise=running;
 try{return await promise;}finally{
  if(running===promise)running=null;
  if(owner===uid&&epoch===generation){
   try{
    const latest=await read(uid);
    if(latest?.queue.length&&['synced','syncing','pending'].includes(status.state)){
     emit(latest,'pending');
     if(globalThis.navigator?.onLine!==false)schedule();
    }
   }catch{/* Retain the last truthful status if browser storage failed. */}
  }
 }
}
export async function syncNow(){return flush(true);}
export async function exportPending(){const uid=validOwner();return JSON.stringify({app:'nabu-outbox',version:1,owner:uid,exportedAt:new Date().toISOString(),document:await read(uid)},null,2);}
export async function resolveConflict(choice) {
 const uid=validOwner(),generation=epoch,remote=await request('library',{ms:6000});guard(uid,generation);
 validateSnapshot(remote);
 const current=await read(uid);guard(uid,generation);const first=current?.queue[0];if(!first?.blocked)throw new Error('There is no blocked change.');
 if(choice!=='server'&&choice!=='retry')throw new Error('Choose a conflict resolution.');
 const doc=await Local.mutateMeta(key(uid),d=>{
  const conflict=d.queue[0];if(conflict.id!==first.id)throw new Error('The pending change was updated in another tab.');
  // Preserve the complete pre-resolution document for explicit export/recovery.
  const audit={at:Date.now(),choice,operations:clone(d.queue)};
  let queue=d.queue.slice();
  if(choice==='server')queue=[]; // Deliberately explicit in UI: drops all dependent queued changes.
  else {
   const p={...conflict.payload},card=remote.cards.find(c=>c.id===p.cardId);
   if(!card||!['edit','archive','review'].includes(conflict.kind))throw new Error('Export these changes, then use the server version.');
   const delta=card.revision-p.revision;p.revision=card.revision;
   queue=queue.map((o,i)=>i===0?{id:C.uid(),kind:o.kind,payload:p,at:o.kind==='review'?Date.now():o.at}:o.payload.cardId===p.cardId?{...o,payload:{...o.payload,revision:o.payload.revision+delta}}:o);
  }
  return {...d,server:remote,queue,conflicts:[...(d.conflicts||[]),audit].slice(-20)};
 });
 guard(uid,generation);emit(doc,doc.queue.length?'pending':'synced');await flush();
}
