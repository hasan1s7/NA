import test from 'node:test';
import assert from 'node:assert/strict';
import {installIDBFixture} from './idb-fixture.js';
import * as C from '../public/nabu-core.js';
import * as G from '../public/nabu-graph.js';
installIDBFixture();
const DB=await import('../public/nabu-account-store.js');await DB.openStore();
const water=()=>G.translation('food.water','en','es');

test('guest data and cloud snapshots are isolated',async()=>{
 DB.configure(null,'');await DB.clearAll();await DB.commitTranslation(water());
 DB.configure(async path=>{assert.equal(path,'library');return {cards:[],logs:[],history:[]}},'alice');
 assert.equal((await DB.snapshot()).cards.length,0);assert.equal((await DB.localSnapshot()).cards.length,1);
 DB.configure(null,'');assert.equal((await DB.snapshot()).cards.length,1);
});
test('cloud failure never falls back to a local successful write',async()=>{
 const before=(await DB.localSnapshot()).cards.length;
 DB.configure(async()=>{throw new Error('offline')},'alice');
 await assert.rejects(DB.commitTranslation(water()),/offline/);
 assert.equal((await DB.localSnapshot()).cards.length,before);
});
test('expired account locks storage until an explicit mode change',async()=>{
 DB.configure(async()=>{throw new Error('should not request')},'alice');DB.lock();
 await assert.rejects(DB.snapshot(),/Sign in again/);await assert.rejects(DB.addCards([water()]),/Sign in again/);
 DB.configure(null,'');assert.equal((await DB.snapshot()).cards.length,1);
});
test('late cloud response is rejected after account switch',async()=>{
 let finish;DB.configure(()=>new Promise(resolve=>{finish=resolve}),'alice');const response=DB.snapshot();
 DB.configure(async()=>({cards:[],logs:[],history:[]}),'bob');finish({cards:[C.newCard(water())],logs:[],history:[]});
 await assert.rejects(response,/active account changed/);
});
test('a cancelled translation makes no cloud write',async()=>{
 let calls=0;DB.configure(async()=>{calls++},'alice');assert.equal(await DB.commitTranslation(water(),()=>false),null);assert.equal(calls,0);
});
test('account reviews use server endpoint, not client-supplied schedules',async()=>{
 let seen;DB.configure(async(path,options)=>{seen={path,options};return {card:{},log:{}}},'alice');
 await DB.gradeCard('test-id',4,7,900);
 assert.equal(seen.path,'library/cards/test-id/review');assert.deepEqual(seen.options.body,{rating:4,revision:7,durationMs:900});
});
test('cloud import strips internal identity and preserves the imported schedule',async()=>{
 let sent;DB.configure(async(path,options)=>{sent=options.body;return {added:1,duplicates:0}},'alice');
 const card=C.newCard(water());card.identity='internal';card.schedule.reps=7;card.schedule.state='review';
 await DB.mergeImport({cards:[card],logs:[]});assert.equal(sent.cards[0].identity,undefined);assert.equal(sent.cards[0].schedule.reps,7);
});
test('large imports are bounded to fifty cards per request',async()=>{
 const batches=[];DB.configure(async(path,options)=>{batches.push(options.body.cards.length);return {added:options.body.cards.length,duplicates:0}},'alice');
 const result=await DB.mergeImport({cards:Array.from({length:102},()=>C.newCard(water())),logs:[]});
 assert.deepEqual(batches,[50,50,2]);assert.equal(result.added,102);
});
test('account translation cache is erased across account changes',async()=>{
 DB.configure(async()=>{},'alice');await DB.cachePut('one','private');assert.equal(await DB.cacheGet('one'),'private');
 DB.configure(async()=>{},'bob');assert.equal(await DB.cacheGet('one'),null);
});
test('clear account library does not clear guest words',async()=>{
 let called;DB.configure(async(path,options)=>{called={path,method:options.method};return {ok:true}},'alice');
 await DB.clearAll();assert.deepEqual(called,{path:'library',method:'DELETE'});assert.equal((await DB.localSnapshot()).cards.length,1);
});

test('online account adapter preserves the selected practice skill',async()=>{
 let body;DB.configure(async(path,options)=>{body=options.body;return {card:{},log:{}}},'alice');
 await DB.gradeCard('test-id',3,1,1200,Date.now(),'production');
 assert.equal(body.practiceMode,'production');
});
