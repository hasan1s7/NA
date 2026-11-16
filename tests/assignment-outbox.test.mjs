import test from 'node:test';
import assert from 'node:assert/strict';
import {createAssignmentOutbox} from '../public/nabu-assignment-outbox.js';

const answer=(id='answer-0001')=>({id,assignmentId:'assignment-0001',response:'No rush',choice:null,occurredAt:100,retryOf:null,assistance:{sourceConsulted:false,translation:false,hint:false,other:false},offline:true});
function harness(){
 let account='learner-a',transport,chain=Promise.resolve();const data=new Map(),calls=[];
 const ack=body=>({acknowledgedId:body.id,record:{assignment:{id:body.assignmentId,tenantId:'university',learnerId:'learner-a'},attempts:[{id:body.id,observation:body}]}});
 transport=async(path,options)=>ack(options.body);
 const store=createAssignmentOutbox({getAccount:()=>account,getMeta:async(k,f)=>structuredClone(data.get(k)??f),mutateMeta:(k,fn)=>{const result=chain.catch(()=>{}).then(()=>{const value=fn(structuredClone(data.get(k)??null));data.set(k,structuredClone(value));return value;});chain=result;return result;},request:async(p,o)=>{calls.push([p,structuredClone(o)]);return transport(p,o);}});
 return {store,data,calls,ack,account:value=>account=value,transport:fn=>transport=fn};
}
const permit={workspaceAllows:true,learnerAllows:true};
test('offline queue requires explicit permissions from both parties',async()=>{
 const h=harness();for(const p of [{},{workspaceAllows:true},{learnerAllows:true}])await assert.rejects(h.store.enqueue('learner-a','university',answer(),p),/Both/);
 assert.deepEqual(await h.store.listAll('learner-a'),[]);
});
test('same ID is immutable and duplicates from concurrent tabs are idempotent',async()=>{
 const h=harness(),body=answer();await Promise.all([h.store.enqueue('learner-a','university',body,permit),h.store.enqueue('learner-a','university',body,permit)]);
 body.response='changed externally';assert.equal((await h.store.list('learner-a','university'))[0].body.response,'No rush');
 await assert.rejects(h.store.enqueue('learner-a','university',body,permit),/frozen/);
 assert.equal((await h.store.listAll('learner-a')).length,1);
});
test('account and workspace boundaries apply to reads, retries and discards',async()=>{
 const h=harness();await h.store.enqueue('learner-a','university',answer(),permit);
 assert.deepEqual(await h.store.list('learner-a','corporation'),[]);
 await assert.rejects(h.store.retry('learner-a','corporation','answer-0001'),/not found/);
 h.account('learner-b');await assert.rejects(h.store.listAll('learner-a'),/account changed/);
 assert.deepEqual(await h.store.listAll('learner-b'),[]);
 assert.equal(h.calls.length,0);
});
test('network failure, revocation and malformed acknowledgements retain exact pending work',async()=>{
 const h=harness();await h.store.enqueue('learner-a','university',answer(),permit);
 for(const implementation of [async()=>{throw Error('Offline');},async()=>{throw Object.assign(Error('Revoked'),{status:403});},async()=>({acknowledgedId:'someone-else'})]){
  h.transport(implementation);await assert.rejects(h.store.retry('learner-a','university','answer-0001'));
  assert.deepEqual((await h.store.list('learner-a','university'))[0].body,answer());
 }
});
test('lost acknowledgement retry sends identical payload and removes only confirmed item',async()=>{
 const h=harness();await h.store.enqueue('learner-a','university',answer(),permit);await h.store.enqueue('learner-a','corporation',answer('answer-0002'),permit);
 let called=0;h.transport(async(p,o)=>{if(++called===1)throw Error('Server committed but connection dropped');return h.ack(o.body);});
 await assert.rejects(h.store.retry('learner-a','university','answer-0001'));
 await h.store.retry('learner-a','university','answer-0001');
 assert.deepEqual(h.calls[0],h.calls[1]);assert.equal((await h.store.listAll('learner-a')).length,1);
 assert.equal((await h.store.listAll('learner-a'))[0].tenantId,'corporation');
});
test('an acknowledgement from the wrong account or workspace is never accepted',async()=>{
 for(const field of ['learnerId','tenantId']){const h=harness();await h.store.enqueue('learner-a','university',answer(),permit);
  h.transport(async(p,o)=>{const a=h.ack(o.body);a.record.assignment[field]='wrong';return a;});
  await assert.rejects(h.store.retry('learner-a','university','answer-0001'),/exact submission/);
  assert.equal((await h.store.listAll('learner-a')).length,1);
 }
});
test('switching accounts during a request preserves the old queue',async()=>{
 const h=harness();await h.store.enqueue('learner-a','university',answer(),permit);let finish;
 h.transport((p,o)=>new Promise(resolve=>finish=()=>resolve(h.ack(o.body))));
 const pending=h.store.retry('learner-a','university','answer-0001');await new Promise(r=>setTimeout(r,0));
 h.account('learner-b');finish();await assert.rejects(pending,/account changed/);h.account('learner-a');assert.equal((await h.store.listAll('learner-a')).length,1);
});
test('persisted pending answers survive store reconstruction and scoped discard',async()=>{
 const h=harness();await h.store.enqueue('learner-a','university',answer(),permit);await h.store.enqueue('learner-a','corporation',answer(),permit);
 const rebuilt=createAssignmentOutbox({getAccount:()=> 'learner-a',getMeta:async(k,f)=>h.data.get(k)??f,mutateMeta:async(k,f)=>h.data.set(k,f(h.data.get(k))),request:async()=>{}});
 assert.equal((await rebuilt.listAll('learner-a')).length,2);
 await rebuilt.discard('learner-a','university','answer-0001');assert.equal((await rebuilt.listAll('learner-a'))[0].tenantId,'corporation');
});
test('quota failure preserves existing pending answers',async()=>{
 const h=harness();for(let i=0;i<100;i++)await h.store.enqueue('learner-a','university',answer('answer-'+i),permit);
 await assert.rejects(h.store.enqueue('learner-a','university',answer('overflow'),permit),/full/);
 assert.equal((await h.store.listAll('learner-a')).length,100);
});
test('an acknowledged ID with different answer content does not erase pending work',async()=>{
 const h=harness();await h.store.enqueue('learner-a','university',answer(),permit);
 h.transport(async(p,o)=>{const a=h.ack(o.body);a.record.attempts[0].observation={...o.body,response:'wrong answer'};return a;});
 await assert.rejects(h.store.retry('learner-a','university','answer-0001'),/differs/);
 assert.equal((await h.store.listAll('learner-a')).length,1);
});
