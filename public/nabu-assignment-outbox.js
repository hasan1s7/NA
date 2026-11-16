/** Explicitly permitted, account/workspace scoped pending answers. No answer keys.
 * Atomic metadata updates protect concurrent tabs. A retry keeps the exact ID and
 * payload; an error or malformed acknowledgement never removes pending work.
 */
export function createAssignmentOutbox({getMeta,mutateMeta,getAccount,request}){
 const stable=value=>JSON.stringify(value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.keys(value).sort().map(k=>[k,JSON.parse(stable(value[k]))])):value);
 const key=owner=>'nabu.assignments.v1:'+owner;
 const guard=owner=>{if(!owner||getAccount()!==owner)throw Error('The active account changed. Sign in to the original account.');};
 const validate=doc=>{
  if(doc===null)return {schemaVersion:1,items:[]};
  if(doc?.schemaVersion!==1||!Array.isArray(doc.items)||doc.items.length>100)throw Error('Pending answers could not be read. Existing data was kept.');
  return doc;
 };
 const scope=(owner,tenant)=>{guard(owner);if(!/^[A-Za-z0-9_-]{3,64}$/.test(tenant))throw Error('Invalid workspace.');};
 async function list(owner,tenant){scope(owner,tenant);const doc=validate(await getMeta(key(owner,tenant),null));guard(owner);return structuredClone(doc.items.filter(x=>x.tenantId===tenant));}
 async function enqueue(owner,tenant,body,{workspaceAllows=false,learnerAllows=false}={}){
  scope(owner,tenant);
  if(!workspaceAllows||!learnerAllows)throw Error('Both the workspace and learner must permit local pending-answer storage.');
  if(!body?.id||!body.assignmentId||body.offline!==true)throw Error('Invalid offline submission.');
  const frozen=structuredClone(body);
  await mutateMeta(key(owner,tenant),old=>{
   guard(owner);const doc=validate(old),existing=doc.items.find(x=>x.tenantId===tenant&&x.body.id===body.id);
   if(existing){if(JSON.stringify(existing.body)!==JSON.stringify(frozen))throw Error('This submission ID already has a frozen answer.');return doc;}
   if(doc.items.length>=100)throw Error('Pending storage is full. Retry, export or discard existing answers.');
   return {...doc,items:[...doc.items,{tenantId:tenant,body:frozen,queuedAt:Date.now()}]};
  });guard(owner);return frozen;
 }
 async function retry(owner,tenant,id){
  scope(owner,tenant);const item=(await list(owner,tenant)).find(x=>x.body.id===id);if(!item)throw Error('Pending answer not found.');
  guard(owner);const result=await request('workspaces/'+encodeURIComponent(tenant)+'/attempts',{method:'POST',body:structuredClone(item.body)});guard(owner);
  if(result?.acknowledgedId!==id||result?.record?.assignment?.id!==item.body.assignmentId||result.record.assignment.tenantId!==tenant||result.record.assignment.learnerId!==owner||!result.record.attempts?.some(x=>x.id===id))throw Error('The server did not confirm this exact submission. It remains pending.');
  const observed=result.record.attempts.find(x=>x.id===id).observation;
  if(stable(observed)!==stable(item.body))throw Error('The acknowledged answer differs from the pending answer. It remains pending.');
  await mutateMeta(key(owner,tenant),old=>{
   guard(owner);const doc=validate(old);
   return {...doc,items:doc.items.filter(x=>x.tenantId!==tenant||x.body.id!==id||JSON.stringify(x.body)!==JSON.stringify(item.body))};
  });guard(owner);return result;
 }
 async function discard(owner,tenant,id){scope(owner,tenant);await mutateMeta(key(owner,tenant),old=>{guard(owner);const doc=validate(old);return {...doc,items:doc.items.filter(x=>x.tenantId!==tenant||x.body.id!==id)};});}
 async function listAll(owner){guard(owner);const doc=validate(await getMeta(key(owner),null));guard(owner);return structuredClone(doc.items);}
 return {list,listAll,enqueue,retry,discard};
}
