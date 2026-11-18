/** Durable curated progress in the EXISTING IndexedDB meta store. Account events
 * use a separate, owner-scoped queue and the existing authenticated API transport.
 * No automatic guest-to-account import. No learning schedule is rewritten. */
import * as X from './nabu-content.js';
const MAX_SYNC_BYTES=500*1024;
function syncBatches(rows){
 const batches=[];let batch=[];
 for(const row of rows){
  const next=[...batch,row],bytes=new TextEncoder().encode(JSON.stringify({events:next})).byteLength;
  if(next.length>50||bytes>MAX_SYNC_BYTES){
   if(!batch.length)throw Error('A progress record is too large to sync. Export your progress before continuing.');
   batches.push(batch);batch=[row];
   if(new TextEncoder().encode(JSON.stringify({events:batch})).byteLength>MAX_SYNC_BYTES)throw Error('A progress record is too large to sync. Export your progress before continuing.');
  }else batch=next;
 }
 if(batch.length)batches.push(batch);return batches;
}
export function createContentStore({getMeta,setMeta,uid,now=()=>Date.now(),locks=globalThis.navigator?.locks,onChange=()=>{}}){
 let owner='guest',transport=null,epoch=0,events=[],pending=[],status='loading',message='',flight=null,chain=Promise.resolve();
 const key=who=>'nabu.content.v1:'+who;
 const emit=()=>onChange({owner,status,message,pending:pending.length});
 const locked=(who,fn)=>locks?.request?locks.request(key(who),fn):fn();
 function serial(fn){const run=chain.catch(()=>{}).then(fn);chain=run;return run;}
 function checkOwner(rows,who){for(const event of rows){if(event.kind==='moment'&&event.moment.userId!==(who==='guest'?null:who))throw Error('This moment belongs to another account.');const envelope=event.evidence||event.cycle;if(envelope&&envelope.actor.userId!==(who==='guest'?null:who))throw Error('An evidence record belongs to a different account.');}}
 async function read(who){
  const data=await getMeta(key(who),{events:[],pending:[]}),rows=X.mergeEvents([],data.events||[]);checkOwner(rows,who);
  const queue=data.pending??[];
  if(!Array.isArray(queue)||queue.some(id=>typeof id!=='string'||!rows.some(e=>e.id===id)))throw Error('The pending progress queue is invalid.');
  return {events:rows,pending:[...new Set(queue)]};
 }
 async function configure(account,request){
  owner=account||'guest';transport=request||null;const generation=++epoch;events=[];pending=[];message='';status='loading';emit();
  if(owner==='!locked'){status='locked';emit();return;}
  try{const data=await read(owner);if(epoch!==generation)return;events=data.events;pending=data.pending;status=pending.length?'pending':owner==='guest'?'local':'cached';emit();}
  catch(e){if(epoch!==generation)return;status='error';message='Reading progress could not open. '+e.message;emit();}
 }
 async function append(item,kind,fields={},id=uid()){
  const who=owner,generation=epoch;if(who==='!locked'||status==='loading')throw Error('Wait for your account, or sign in again before saving progress.');
  let event;
  await serial(()=>locked(who,async()=>{
   if(epoch!==generation)throw Error('Account changed. Reopen this content.');
   const data=await read(who),existing=data.events.find(e=>e.id===id);
   const at=Object.hasOwn(fields,'at')?fields.at:existing?.at??Math.max(now(),...data.events.map(e=>e.at+1));
   for(const [name,value] of Object.entries({id,contentId:item.id,version:item.version,kind}))if(Object.hasOwn(fields,name)&&fields[name]!==value)throw Error('Progress identity fields cannot override the requested record.');
   const candidate=X.validateEvent({...fields,id,contentId:item.id,version:item.version,kind,at});checkOwner([candidate],who);
   const list=X.mergeEvents(data.events,[candidate]);event=existing||candidate;
   if(list.length>8000)throw Error('Progress storage is full. Export your progress before continuing.');
   const queue=who==='guest'?[]:existing?data.pending:[...new Set([...data.pending,event.id])];
   if(!existing)await setMeta(key(who),{events:list,pending:queue});
   if(epoch!==generation)return;events=list;pending=queue;status=queue.length?'pending':who==='guest'?'local':existing&&status==='synced'?'synced':'cached';message='';emit();
  }));
  if(epoch!==generation)throw Error('Account changed while saving. The record remains private to the original account.');
  return structuredClone(event);
 }
 async function sync(){
  if(!transport||owner==='guest'||owner==='!locked')return;
  if(flight&&flight.generation===epoch)return flight.promise;
  const who=owner,generation=epoch,request=transport;
  const run=async()=>{
   status='syncing';message='';emit();
   try{
    do {
    const data=await read(who),queued=new Set(data.pending),batches=syncBatches(data.events.filter(e=>queued.has(e.id)));
    for(const send of batches){
     if(epoch!==generation)return;
     const ids=send.map(e=>e.id);
     await request('content-progress',{method:'POST',body:{events:send}});
     await serial(()=>locked(who,async()=>{const current=await read(who);current.pending=current.pending.filter(id=>!ids.includes(id));await setMeta(key(who),current);}));
    }
    if(epoch!==generation)return;
    const remote=await request('content-progress');
    await serial(()=>locked(who,async()=>{
     const current=await read(who);checkOwner(remote.events||[],who);const merged=X.mergeEvents(current.events,remote.events||[]);
     if(merged.length>8000)throw Error('Progress storage is full. Export your progress before continuing.');
     await setMeta(key(who),{events:merged,pending:current.pending});
     if(epoch!==generation)return;events=merged;pending=current.pending;status=pending.length?'pending':'synced';message='';emit();
    }));
    } while(epoch===generation&&pending.length);
   }catch(e){if(epoch!==generation)return;status=e.status===401||e.status===409?'locked':'error';message=e.message||'Could not sync progress. Your saved device copy remains available.';emit();}
  };
  flight={generation,promise:run()};try{await flight.promise;}finally{if(flight?.generation===generation)flight=null;}
 }
 return {configure,append,sync,getEvents:()=>structuredClone(events),getState:()=>({owner,status,message,pending:pending.length}),exportData:()=>({schemaVersion:1,owner,events:structuredClone(events),pending:pending.slice()})};
}
