/** Existing IndexedDB metadata for guests; existing authenticated API for users.
 * Account intent text is deliberately not cached or queued on the device. A
 * network/authentication error must never silently become a guest write.
 */
import * as Intent from './nabu-intents.js';

export function createIntentStore({getMeta,setMeta,uid,now=()=>Date.now(),locks=globalThis.navigator?.locks,onChange=()=>{}}){
 const GUEST_KEY='nabu.intent.v1:guest';
 const clone=value=>structuredClone(value);
 const empty=()=>({schemaVersion:1,intents:[],organizationObjective:null,organizationObjectives:[],selection:{mode:'none',intentId:null},role:null});
 let owner='guest',tenantId=null,transport=null,epoch=0,status='loading',message='',data=empty(),chain=Promise.resolve();
 const state=()=>({owner,tenantId,status,message});
 const emit=()=>onChange(state());
 const query=scope=>scope?'?tenantId='+encodeURIComponent(scope):'';
 const current=(generation,who,scope)=>generation===epoch&&who===owner&&scope===tenantId;
 const check=(generation,who,scope)=>{if(!current(generation,who,scope))throw Error('The active account or team changed. Reopen your intent.');};
 const serial=fn=>{const promise=chain.catch(()=>{}).then(fn);chain=promise;return promise;};
 const locked=fn=>locks?.request?locks.request(GUEST_KEY,fn):fn();
 function scopeError(){
  if(owner==='!locked')return Error('Sign in again before opening private intents.');
  if(owner==='guest'&&tenantId)return Error('Sign in to use a team context.');
  if(owner!=='guest'&&!transport)return Error('Connect to a Nabu server with the intent layer to use account intents.');
  return null;
 }
 function normalizeSnapshot(input,who,scope){
  if(!input||input.schemaVersion!==1||!Array.isArray(input.intents)||!Array.isArray(input.organizationObjectives)||input.intents.length>200||input.organizationObjectives.length>200)throw Error('Saved intents could not be read. Existing data has not been replaced.');
  const result=empty(),ids=new Set();
  for(const record of input.intents){
   const clean=Intent.validateIntentRecord(record);
   if(clean.ownerUserId!==who||clean.tenantId!==scope||clean.kind!=='learner'||ids.has(clean.id))throw Error('An intent belongs to a different account or team.');
   ids.add(clean.id);result.intents.push(clean);
  }
  if(![null,'owner','member'].includes(input.role))throw Error('Invalid team role.');
  if((scope===null&&input.role!==null)||(scope!==null&&input.role===null))throw Error('Invalid team scope.');
  result.role=input.role;
  for(const record of input.organizationObjectives){
   const clean=Intent.validateIntentRecord(record);
   if(!scope||clean.tenantId!==scope||clean.kind!=='organization'||ids.has(clean.id))throw Error('An organization objective belongs to a different team.');
   ids.add(clean.id);result.organizationObjectives.push(clean);
  }
  const active=result.organizationObjectives.filter(x=>x.status==='active');
  if(active.length>1)throw Error('More than one active organization objective was returned.');
  if(input.organizationObjective!==null){
   const selected=Intent.validateIntentRecord(input.organizationObjective);
   if(active.length!==1||JSON.stringify(selected)!==JSON.stringify(active[0]))throw Error('Invalid active organization objective.');
   result.organizationObjective=selected;
  }else if(active.length)throw Error('The active organization objective is missing.');
  const s=input.selection;
  if(!s||!['none','selected','exploring'].includes(s.mode)||(s.mode==='selected')!==(typeof s.intentId==='string')||(s.mode!=='selected'&&s.intentId!==null))throw Error('Invalid intent selection.');
  if(s.mode==='selected'&&!result.intents.some(x=>x.id===s.intentId&&x.status==='active'))throw Error('The selected intent is not active in this account and team.');
  result.selection={mode:s.mode,intentId:s.intentId};
  return result;
 }
 function fail(error,generation){
  if(generation===epoch){status=error.status===401||error.status===403?'locked':'error';if(status==='locked')data=empty();message=error.message||'Intent could not be saved.';emit();}
  return error;
 }
 async function refresh(){
  const generation=epoch,who=owner,scope=tenantId,request=transport,error=scopeError();
  if(error){status=who==='!locked'?'locked':'unavailable';message=error.message;emit();throw error;}
  status='loading';message='';emit();
  try{
   const snapshot=who==='guest'?await getMeta(GUEST_KEY,empty()):await request('intents'+query(scope));
   check(generation,who,scope);
   const clean=normalizeSnapshot(snapshot,who,scope);
   data=clean;status=who==='guest'?'local':'synced';message='';emit();return clone(data);
  }catch(error){throw fail(error,generation);}
 }
 async function configure(account='guest',request=null,scope=null){
  if(scope!==null&&(typeof scope!=='string'||!/^[A-Za-z0-9_-]{3,64}$/.test(scope)))throw Error('Invalid team scope.');
  owner=account||'guest';transport=request||null;tenantId=scope;++epoch;data=empty();status='loading';message='';emit();
  return refresh();
 }
 async function setScope(scope=null){return configure(owner,transport,scope);}
 async function listTenants(){
  const generation=epoch,who=owner,scope=tenantId,request=transport,error=scopeError();
  if(error)throw error;
  if(who==='guest')return [];
  const response=await request('intent-tenants');check(generation,who,scope);
  if(!Array.isArray(response?.tenants)||response.tenants.some(x=>!x||typeof x.id!=='string'||!/^[A-Za-z0-9_-]{3,64}$/.test(x.id)||typeof x.label!=='string'||!['owner','member'].includes(x.role)))throw Error('Team contexts could not be read.');
  return clone(response.tenants);
 }
 async function guestMutation(change){
  const generation=epoch,who=owner,scope=tenantId;
  const error=scopeError();if(error)throw error;
  return serial(()=>locked(async()=>{
   check(generation,who,scope);
   try{
    const snapshot=normalizeSnapshot(await getMeta(GUEST_KEY,empty()),who,scope);
    check(generation,who,scope);
    const result=change(snapshot);
    await setMeta(GUEST_KEY,snapshot);
    check(generation,who,scope);
    data=snapshot;status='local';message='';emit();return clone(result);
   }catch(error){throw fail(error,generation);}
  }));
 }
 async function remoteMutation(path,options){
  const generation=epoch,who=owner,scope=tenantId,request=transport,error=scopeError();
  if(error)throw error;
  try{
   const result=await request(path+query(scope),options);check(generation,who,scope);
   const snapshot=await request('intents'+query(scope));check(generation,who,scope);
   data=normalizeSnapshot(snapshot,who,scope);status='synced';message='';emit();return result;
  }catch(error){throw fail(error,generation);}
 }
 function find(snapshot,id,revision){
  const record=[...snapshot.intents,...snapshot.organizationObjectives].find(x=>x.id===id);
  if(!record)throw Error('Intent not found in this account and team.');
  if(revision!==undefined&&record.revision!==revision)throw Error('This intent changed. Refresh before editing.');
  return record;
 }
 async function create(content,{kind='learner',id:requestId=null}={}){
  const clean=Intent.validateIntentContent(content),id=requestId??uid();
  if(typeof id!=='string'||!/^[A-Za-z0-9_-]{16,80}$/.test(id))throw Error('Invalid intent identifier.');
  if(!['learner','organization'].includes(kind))throw Error('Unknown intent kind.');
  if(owner==='guest'){
   if(kind!=='learner')throw Error('An organization objective requires an authenticated team.');
   return guestMutation(snapshot=>{
    const existing=snapshot.intents.find(x=>x.id===id);
    if(existing){
     if(existing.revision===1&&JSON.stringify(Intent.validateIntentContent(existing))===JSON.stringify(clean))return existing;
     throw Error('This intent identifier is already in use. Refresh before retrying.');
    }
    if(snapshot.intents.length>=200)throw Error('Intent storage is full. Delete an old intent before adding another.');
    const at=now(),record=Intent.validateIntentRecord({schemaVersion:1,id,ownerUserId:'guest',tenantId:null,kind,...clean,createdAt:at,updatedAt:at,statusChangedAt:at,revision:1});
    snapshot.intents.push(record);
    if(record.status==='active')snapshot.selection={mode:'selected',intentId:id};
    return record;
   });
  }
  const error=scopeError();if(error)throw error;
  if(kind==='organization'&&!tenantId)throw Error('Choose a team for an organization objective.');
  return (await remoteMutation('intents',{method:'POST',body:{id,tenantId,kind,content:clean}})).intent;
 }
 async function update(id,content,revision){
  const clean=Intent.validateIntentContent(content);
  if(!Number.isSafeInteger(revision)||revision<1)throw Error('An expected revision is required.');
  if(owner==='guest')return guestMutation(snapshot=>{
   const record=find(snapshot,id,revision),at=Math.max(now(),record.updatedAt+1),changed=record.status!==clean.status;
   Object.assign(record,clean,{updatedAt:at,statusChangedAt:changed?at:record.statusChangedAt,revision:record.revision+1});
   if(record.status!=='active'&&snapshot.selection.intentId===id)snapshot.selection={mode:'none',intentId:null};
   return record;
  });
  return (await remoteMutation('intents/'+encodeURIComponent(id),{method:'PATCH',body:{revision,content:clean}})).intent;
 }
 async function transition(id,nextStatus,revision){
  const record=find(data,id,revision);
  return update(id,Intent.editIntentContent(record,{status:nextStatus}),revision);
 }
 async function select(id){
  if(typeof id!=='string')throw Error('Choose an active intent.');
  if(owner==='guest')return guestMutation(snapshot=>{
   const record=find(snapshot,id);
   if(record.status!=='active'||record.kind!=='learner')throw Error('Resume this intent before selecting it.');
   snapshot.selection={mode:'selected',intentId:id};return snapshot.selection;
  });
  return (await remoteMutation('intent-selection',{method:'PUT',body:{mode:'selected',intentId:id}})).selection;
 }
 async function skip(){
  if(owner==='guest')return guestMutation(snapshot=>{snapshot.selection={mode:'exploring',intentId:null};return snapshot.selection;});
  return (await remoteMutation('intent-selection',{method:'PUT',body:{mode:'exploring',intentId:null}})).selection;
 }
 function exploreTemporarily(reason=''){
  data={...data,selection:{mode:'exploring',intentId:null}};
  status='temporary';message='Exploring for this session. This choice has not been saved.'+(reason?' '+String(reason):'');emit();
  return clone(data.selection);
 }
 async function remove(id,revision){
  if(!Number.isSafeInteger(revision)||revision<1)throw Error('An expected revision is required.');
  if(owner==='guest')return guestMutation(snapshot=>{
   find(snapshot,id,revision);snapshot.intents=snapshot.intents.filter(x=>x.id!==id);
   if(snapshot.selection.intentId===id)snapshot.selection={mode:'none',intentId:null};
   return {deleted:id};
  });
  return remoteMutation('intents/'+encodeURIComponent(id),{method:'DELETE',body:{revision}});
 }
 return {configure,setScope,refresh,listTenants,create,update,transition,select,skip,exploreTemporarily,remove,getSnapshot:()=>clone(data),getState:state,getContext:()=>Intent.intentContext(data,{owner,tenantId})};
}
