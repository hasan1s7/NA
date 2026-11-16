import test from 'node:test';
import assert from 'node:assert/strict';
import {installIDBFixture} from './idb-fixture.js';
import * as C from '../public/nabu-core.js';
import * as S from '../public/nabu-sync.js';
import * as L from '../public/nabu-store.js';
const fixture=installIDBFixture();await L.openStore();
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:false}});
const cp=x=>structuredClone(x),empty=()=>({cards:[],logs:[],history:[]});
let seq=0;
function server(seed=empty()){
 let data=cp(seed),fail=null,lose=false,calls=0;const receipts=new Map();
 const api=async(path,opts={})=>{
  if(fail)throw Object.assign(new Error(fail.message||'offline'),{status:fail.status});
  if(path==='library')return cp(data);
  assert.equal(path,'sync');calls++;const op=opts.body;
  if(receipts.has(op.id))return {result:cp(receipts.get(op.id)),snapshot:cp(data),replayed:true};
  const card=data.cards.find(c=>c.id===op.payload.cardId);
  if(card&&['edit','review','archive'].includes(op.kind)&&op.payload.revision!==card.revision)throw Object.assign(new Error('Newer server edit'),{status:409});
  let result={ok:true};
  if(op.kind==='translation'||op.kind==='add'){
   const inputs=op.kind==='translation'?[op.payload.card]:op.payload.cards,idMap={};
   for(const c of inputs){const old=data.cards.find(x=>C.identity(x)===C.identity(c));if(old)idMap[c.id]=old.id;}
   data=S.project({server:data,queue:[op]});result.idMap=idMap;
  }else data=S.project({server:data,queue:[op]});
  receipts.set(op.id,cp(result));
  if(lose){lose=false;throw new Error('Connection closed after commit');}
  return {result,snapshot:cp(data)};
 };
 return {api,get data(){return cp(data)},edit(fn){data=fn(cp(data))},fail(e){fail=e},lose(){lose=true},get calls(){return calls}};
}
async function setup(seed=empty()){
 navigator.onLine=false;const uid='account-'+(++seq),remote=server(seed);S.configure(remote.api,uid);await S.snapshot();return {uid,remote};
}
const word=()=>C.newCard({front:'water',back:'agua',sourceLang:'en',targetLang:'es',learningMode:'learning'});
async function add(c=word()){await S.enqueue('add',{cards:[c]});return c;}
async function flush(){navigator.onLine=true;await S.syncNow();}

test('offline writes persist per account and never change guest cards',async()=>{
 const {uid}=await setup();await add();const raw=await L.getMeta('account-cache:'+uid);
 assert.equal(raw.queue.length,1);assert.equal((await S.snapshot()).cards.length,1);assert.equal((await L.snapshot()).cards.length,0);assert.equal(S.getStatus().state,'pending');
});
test('a warm cache is not called synced until the server is checked',async()=>{
 const {uid,remote}=await setup();navigator.onLine=true;
 S.configure(remote.api,uid);await S.snapshot();
 assert.equal(S.getStatus().state,'cached');
 await S.syncNow();assert.equal(S.getStatus().state,'synced');
});
test('reconfigure reopens pending work without an HTTP fetch',async()=>{
 const {uid}=await setup();await add();S.configure(async()=>{throw new Error('offline')},uid);assert.equal((await S.snapshot()).cards.length,1);assert.equal((await S.pending()).length,1);assert.equal(S.getStatus().pending,1);
});
test('no cached library produces a clear offline error, not an empty account',async()=>{
 S.configure(async()=>{throw new Error('offline')},'uncached-account');await assert.rejects(S.snapshot(),/offline/);
});
test('reconnect drains outbox and marks a confirmed snapshot synced',async()=>{
 const {remote}=await setup();await add();await flush();assert.equal(remote.data.cards.length,1);assert.equal((await S.pending()).length,0);assert.equal(S.getStatus().state,'synced');
});
test('lost acknowledgment retries the same operation without duplicate data',async()=>{
 const {remote}=await setup();await add();const id=(await S.pending())[0].id;remote.lose();await flush();assert.equal(remote.data.cards.length,1);assert.equal((await S.pending())[0].id,id);await flush();assert.equal(remote.data.cards.length,1);assert.equal(remote.calls,2);assert.equal((await S.pending()).length,0);
});
test('network failure preserves local edits and original operation IDs',async()=>{
 const {remote}=await setup();const c=await add();await S.enqueue('edit',{cardId:c.id,revision:0,content:{...c,note:'private'}});remote.fail({message:'offline'});await flush();assert.equal((await S.snapshot()).cards[0].note,'private');assert.equal((await S.pending()).length,2);assert.equal(S.getStatus().state,'offline');
});
test('IndexedDB write failure never reports a successful local save',async()=>{
 await setup();fixture.failNextWrite();await assert.rejects(add(),/Simulated storage/);assert.equal((await S.pending()).length,0);assert.equal((await S.snapshot()).cards.length,0);
});
test('sequential offline edits keep revisions and order',async()=>{
 const {remote}=await setup();const c=await add();await S.enqueue('edit',{cardId:c.id,revision:0,content:{...c,note:'first'}});await S.enqueue('edit',{cardId:c.id,revision:1,content:{...c,note:'second'}});await flush();assert.equal(remote.data.cards[0].note,'second');assert.equal(remote.data.cards[0].revision,2);
});
test('offline skill reviews and undo keep recognition schedule independent',async()=>{
 const {remote}=await setup();const c=await add(),before=cp(c.schedule);const result=await S.enqueue('review',{cardId:c.id,rating:3,revision:0,durationMs:1500,practiceMode:'production'});assert.deepEqual((await S.snapshot()).cards[0].schedule,before);assert.equal((await S.snapshot()).cards[0].skills.production.reps,1);await S.enqueue('undo',{logId:result.log.id});await flush();assert.equal(remote.data.logs.length,0);assert.equal(remote.data.cards[0].revision,2);assert.equal(remote.data.cards[0].skills.production,undefined);
});
test('stale server revision blocks queue and does not overwrite other device',async()=>{
 const c=word(),{remote}=await setup({cards:[c],logs:[],history:[]});await S.enqueue('edit',{cardId:c.id,revision:0,content:{...c,note:'my offline edit'}});remote.edit(d=>{d.cards[0].note='other device';d.cards[0].revision=1;return d});await flush();assert.equal(S.getStatus().state,'conflict');assert.equal(remote.data.cards[0].note,'other device');await assert.rejects(add(),/Resolve/);const exported=JSON.parse(await S.exportPending());assert.equal(exported.document.queue[0].payload.content.note,'my offline edit');
});
test('explicit server resolution retains a recovery audit of discarded queue',async()=>{
 const c=word(),{remote}=await setup({cards:[c],logs:[],history:[]});await S.enqueue('edit',{cardId:c.id,revision:0,content:{...c,note:'offline'}});remote.edit(d=>{d.cards[0].revision++;d.cards[0].note='latest';return d});await flush();await S.resolveConflict('server');assert.equal((await S.snapshot()).cards[0].note,'latest');const doc=JSON.parse(await S.exportPending()).document;assert.equal(doc.queue.length,0);assert.equal(doc.conflicts[0].operations[0].payload.content.note,'offline');
});
test('explicit retry rebases dependent edits after user selects overwrite',async()=>{
 const c=word(),{remote}=await setup({cards:[c],logs:[],history:[]});await S.enqueue('edit',{cardId:c.id,revision:0,content:{...c,note:'mine'}});await S.enqueue('archive',{cardId:c.id,revision:1,archived:true});remote.edit(d=>{d.cards[0].revision++;return d});await flush();await S.resolveConflict('retry');assert.equal(remote.data.cards[0].note,'mine');assert.equal(remote.data.cards[0].revision,3);assert.equal(remote.data.cards[0].archived,true);
});
test('authentication error locks status without deleting pending data',async()=>{
 const {remote}=await setup();await add();remote.fail({message:'Sign in again',status:401});await flush();assert.equal(S.getStatus().state,'locked');assert.equal((await S.pending()).length,1);
});
test('rate limit pauses rather than permanently blocking valid changes',async()=>{
 const {remote}=await setup();await add();remote.fail({message:'Limit',status:429});await flush();assert.equal(S.getStatus().state,'paused');assert.equal((await S.pending())[0].blocked,undefined);remote.fail(null);await flush();assert.equal(remote.data.cards.length,1);
});
test('server validation errors keep exact rejected payload exportable',async()=>{
 const {remote}=await setup();await add();remote.fail({message:'Invalid operation',status:422});await flush();assert.equal(S.getStatus().state,'conflict');assert.equal((await S.pending())[0].payload.cards[0].front,'water');
});
test('switching users never exposes another account queue',async()=>{
 const {uid,remote}=await setup();await add();S.configure(async()=>empty(),'other-account');assert.equal((await S.snapshot()).cards.length,0);assert.equal((await S.pending()).length,0);S.configure(remote.api,uid);assert.equal((await S.snapshot()).cards.length,1);
});
test('late response after account switch cannot overwrite new account cache',async()=>{
 const {uid}=await setup();await add();let finish,started;const start=new Promise(r=>started=r);S.configure((p)=>p==='sync'?new Promise(r=>{finish=r;started()}):Promise.resolve(empty()),uid);navigator.onLine=true;const result=S.syncNow();await start;S.configure(async()=>empty(),'late-account');await S.snapshot();finish({result:{ok:true},snapshot:{cards:[word()],logs:[],history:[]}});await result;assert.equal((await S.snapshot()).cards.length,0);assert.equal((await L.getMeta('account-cache:'+uid)).queue.length,1);
});
test('concurrent queue transactions retain both edits',async()=>{
 await setup();await Promise.all([add(),add(C.newCard({front:'book',back:'libro',sourceLang:'en',targetLang:'es'}))]);assert.equal((await S.pending()).length,2);assert.equal((await S.snapshot()).cards.length,2);
});
test('duplicate server identity remaps dependent card references',async()=>{
 const {remote}=await setup(),local=word(),other={...local,id:C.uid()};await add(local);await S.enqueue('edit',{cardId:local.id,revision:0,content:{...local,note:'queued'}});remote.edit(d=>({...d,cards:[other]}));await flush();assert.equal(remote.data.cards.length,1);assert.equal(remote.data.cards[0].note,'queued');assert.equal(remote.data.cards[0].id,other.id);
});
test('account forget removes only that account data and remembered identity',async()=>{
 const {uid}=await setup();await S.rememberAccount({id:uid,handle:'alice',password:'must not persist'});await add();assert.deepEqual(await S.lastAccount(),{id:uid,handle:'alice'});await S.forget(uid);assert.equal(await L.getMeta('account-cache:'+uid),null);assert.equal(await S.lastAccount(),null);
});
test('guest cleanup preserves queued account work',async()=>{
 const {uid}=await setup();await add();await L.addCards([word()]);await L.clearAll();assert.equal((await L.snapshot()).cards.length,0);assert.equal((await L.getMeta('account-cache:'+uid)).queue.length,1);
});
test('forgetting cache after account reset can retain remembered identity',async()=>{
 const {uid}=await setup();await S.rememberAccount({id:uid,handle:'alice'});await S.forget(uid,{preserveRemembered:true});assert.equal((await S.lastAccount()).id,uid);
});
test('Web Locks keep two tabs from sending the same offline operation concurrently',async()=>{
 const {uid,remote}=await setup();await add();navigator.onLine=true;
 const previous=navigator.locks, tails=new Map();let acquisitions=0;
 navigator.locks={request:async(name,options,work)=>{
  assert.equal(options.mode,'exclusive');acquisitions++;
  const before=tails.get(name)||Promise.resolve();let release;
  const turn=new Promise(resolve=>{release=resolve;});tails.set(name,before.then(()=>turn));
  await before;
  try{return await work();}finally{release();}
 }};
 const other=await import('../public/nabu-sync.js?second-tab');other.configure(remote.api,uid);
 try{
  await Promise.all([S.syncNow(),other.syncNow()]);
  assert.equal(remote.calls,1);
  assert.equal(remote.data.cards.length,1);
  assert.equal((await S.pending()).length,0);
  assert(acquisitions>=2, 'Both tabs must acquire the lock; an empty scheduled follow-up may also acquire it.');
 }finally{other.configure(null,'');navigator.locks=previous;}
});
test('a change saved during network acknowledgment remains in the flush queue',async()=>{
 const {uid,remote}=await setup();await add();
 let release,started;const gate=new Promise(r=>{release=r;});const begun=new Promise(r=>{started=r;});
 let paused=false;
 S.configure(async(path,options)=>{
  if(path==='sync'&&!paused){paused=true;started();await gate;}
  return remote.api(path,options);
 },uid);
 navigator.onLine=true;
 const flushing=S.syncNow();await begun;
 await S.enqueue('add',{cards:[C.newCard({front:'hello',back:'hola',sourceLang:'en',targetLang:'es'})]});
 release();await flushing;
 assert.equal(remote.data.cards.length,2);
 assert.equal((await S.pending()).length,0);
 assert.equal(S.getStatus().state,'synced');
});
test.after(()=>S.configure(null,''));

for (const [name,invalid] of [
 ['missing collections',{cards:[]}],
 ['invalid card record',{cards:[{id:'broken'}],logs:[],history:[]}],
 ['invalid review record',{cards:[],logs:[null],history:[]}],
 ['invalid history record',{cards:[],logs:[],history:[null]}]
]) test('invalid initial server snapshot is not cached: '+name,async()=>{
 const uid='invalid-initial-'+(++seq);S.configure(async()=>cp(invalid),uid);
 await assert.rejects(S.snapshot(),/invalid library/i);
 assert.equal(await L.getMeta('account-cache:'+uid),null);
});

test('malformed sync acknowledgment cannot discard queued work or replace the confirmed cache',async()=>{
 const {uid}=await setup();const c=await add();const before=await L.getMeta('account-cache:'+uid);
 S.configure(async(path)=>path==='sync'?{result:{ok:true},snapshot:{cards:[],logs:null,history:[]}}:empty(),uid);
 await flush();
 const after=await L.getMeta('account-cache:'+uid);
 assert.equal(after.queue.length,1);assert.equal(after.queue[0].id,before.queue[0].id);
 assert.deepEqual(after.server,before.server);assert.equal((await S.snapshot()).cards[0].id,c.id);
 assert.notEqual(S.getStatus().state,'synced');
});

test('malformed refresh leaves the last confirmed cards readable',async()=>{
 const c=word(),{uid}=await setup({cards:[c],logs:[],history:[]});
 S.configure(async()=>({cards:null,logs:[],history:[]}),uid);await flush();
 assert.equal((await S.snapshot()).cards[0].id,c.id);assert.notEqual(S.getStatus().state,'synced');
});

test('invalid duplicate ID mapping cannot retire a pending operation',async()=>{
 const {uid}=await setup();await add();
 S.configure(async()=>({result:{idMap:[]},snapshot:empty()}),uid);await flush();
 assert.equal((await S.pending()).length,1);assert.notEqual(S.getStatus().state,'synced');
});

test('malformed conflict refresh preserves all pending edits',async()=>{
 const c=word(),{uid,remote}=await setup({cards:[c],logs:[],history:[]});
 await S.enqueue('edit',{cardId:c.id,revision:0,content:{...c,note:'keep my work'}});
 remote.edit(d=>{d.cards[0].revision++;return d});await flush();
 const before=await L.getMeta('account-cache:'+uid);
 S.configure(async()=>({cards:[],logs:null,history:[]}),uid);
 await assert.rejects(S.resolveConflict('server'),/invalid library/i);
 assert.deepEqual(await L.getMeta('account-cache:'+uid),before);
});
