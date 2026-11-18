import * as Sync from './nabu-sync.js';
/* Guest cards and account caches are isolated in IndexedDB.
 * New servers use a durable account outbox; legacy servers remain online-only.
 * Device-saved and server-confirmed are distinct states. No credentials are stored.
 */
import * as Local from './nabu-store.js';
import * as C from './nabu-core.js';
let transport=null,owner='',epoch=0,offline=false;
const cache=new Map();
export function configure(request,account='',options={}) {transport=request;owner=account;offline=!!options.offline;epoch++;cache.clear();Sync.configure(request,account);}
export function lock(){Sync.lock();owner='!expired!';epoch++;cache.clear();}
export function isCloud(){return !!owner;}
async function call(path,options){
 if(owner==='!expired!')throw new Error('Sign in again to open your account library.');
 const generation=epoch;
 const result=await transport(path,options);
 if(generation!==epoch)throw new Error('The active account changed. Reopen your library.');
 return result;
}
export async function openStore(){return Local.openStore();}
export async function snapshot(){if(offline&&owner)return Sync.snapshot();return owner?call('library'):Local.snapshot();}
export async function getMeta(...args){return Local.getMeta(...args);}
export async function setMeta(...args){return Local.setMeta(...args);}
export async function addCards(inputs){
 if(offline&&owner){let result={added:0,duplicates:0,cards:[]};for(let i=0;i<inputs.length;i+=50){const b=await Sync.enqueue('add',{cards:inputs.slice(i,i+50).map(c=>C.newCard(c))});result.added+=b.added;result.duplicates+=b.duplicates;result.cards.push(...b.cards);}return result;}
 if(!owner)return Local.addCards(inputs);
 const result={added:0,duplicates:0,cards:[]};
 for(let i=0;i<inputs.length;i+=50){const batch=await call('library/cards',{method:'POST',body:{cards:inputs.slice(i,i+50).map(c=>C.newCard(c))}});result.added+=batch.added;result.duplicates+=batch.duplicates;result.cards.push(...batch.cards);}
 return result;
}
export async function editCard(id,content,revision){if(offline&&owner)return Sync.enqueue('edit',{cardId:id,content:C.cardContent(content),revision});return owner?call(`library/cards/${id}`,{method:'PATCH',body:{content:C.cardContent(content),revision}}):Local.editCard(id,content,revision);}
export async function archiveCard(id,archived){
 if(offline&&owner){const c=(await snapshot()).cards.find(c=>c.id===id);if(!c)throw new Error('Card not found.');return Sync.enqueue('archive',{cardId:id,archived,revision:c.revision});}
 if(!owner)return Local.archiveCard(id,archived);
 const card=(await snapshot()).cards.find(c=>c.id===id);if(!card)throw new Error('Card not found.');
 return call(`library/cards/${id}/archive`,{method:'POST',body:{archived,revision:card.revision}});
}
export async function gradeCard(id,rating,revision,durationMs=0,now=Date.now(),practiceMode='recognition'){
 if(offline&&owner)return Sync.enqueue('review',{cardId:id,rating,revision,durationMs:Math.round(Math.max(0,Math.min(86400000,durationMs))),practiceMode},now);
 return owner?call(`library/cards/${id}/review`,{method:'POST',body:{rating,revision,durationMs:Math.round(Math.max(0,Math.min(86400000,durationMs))),...(practiceMode==='recognition'?{}:{practiceMode})}}):Local.gradeCard(id,rating,revision,durationMs,now,practiceMode);
}
export async function undoReview(id){if(offline&&owner)return Sync.enqueue('undo',{logId:id});return owner?call(`library/reviews/${id}/undo`,{method:'POST',body:{}}):Local.undoReview(id);}
export async function commitTranslation(input,isCurrent=()=>true){
 if(offline&&owner){if(!isCurrent())return null;return Sync.enqueue('translation',{card:C.newCard(input),provider:input.provider||''});}
 if(!owner)return Local.commitTranslation(input,isCurrent);
 if(!isCurrent())return null;
 const result=await call('library/translations',{method:'POST',body:{card:C.newCard(input),provider:input.provider||''}});
 return isCurrent()?result:null;
}
export async function rememberTranslation(item){if(!owner)return Local.rememberTranslation(item);}
export async function cacheGet(id){return owner?(cache.get(id)??null):Local.cacheGet(id);}
export async function cachePut(id,value){if(!owner)return Local.cachePut(id,value);if(cache.size>=200)cache.delete(cache.keys().next().value);cache.set(id,value);}
export async function clearTranslationHistory(){if(!owner)return Local.clearTranslationHistory();cache.clear();return call('library/history',{method:'DELETE',body:{}});}
function cleanCard(c){const {id,createdAt,updatedAt,revision,archived,schedule}=c;return {...C.cardContent(c),id,createdAt,updatedAt,revision,archived,schedule,skills:c.skills||{}};}
export async function mergeImport(data){
 if(offline&&owner){const result={added:0,duplicates:0};for(let i=0;i<data.cards.length;i+=50){const b=await Sync.enqueue('add',{cards:data.cards.slice(i,i+50).map(cleanCard)});result.added+=b.added;result.duplicates+=b.duplicates;}return result;}
 if(!owner)return Local.mergeImport(data);
 const result={added:0,duplicates:0};
 for(let i=0;i<data.cards.length;i+=50){const batch=await call('library/cards',{method:'POST',body:{cards:data.cards.slice(i,i+50).map(cleanCard)}});result.added+=batch.added;result.duplicates+=batch.duplicates;}
 // Imported schedules survive. Historical review events stay in the original backup.
 return result;
}
export async function clearAll(){if(offline&&owner&&(await Sync.pending()).length)throw new Error('Sync or export pending changes before clearing this library.');const result=owner?await call('library',{method:'DELETE',body:{}}):await Local.clearAll();if(offline&&owner){await Sync.forget(owner,{preserveRemembered:true});await Sync.snapshot();}return result;}
export async function localSnapshot(){return Local.snapshot();}

export function syncStatus(){return offline&&owner?Sync.getStatus():{state:owner?'synced':'local',pending:0,conflicts:0,lastSync:0};}
export async function syncNow(){if(offline&&owner)return Sync.syncNow();}
export async function pendingChanges(){return offline&&owner?Sync.pending():[];}
export async function exportPending(){return Sync.exportPending();}
export async function resolveConflict(choice){return Sync.resolveConflict(choice);}
export async function rememberAccount(user){return Sync.rememberAccount(user);}
export async function lastAccount(){return Sync.lastAccount();}
export async function forgetAccount(uid){if(uid){await Local.setMeta('nabu.content.v1:'+uid,null);await Local.setMeta('nabu.reader.v1:'+uid,null);await Local.setMeta('nabu.avatar.v1:'+uid,null);}return Sync.forget(uid);}

export function clearCachedTranslations(){cache.clear();}
