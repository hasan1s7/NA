import test from 'node:test';
import assert from 'node:assert/strict';
import {installIDBFixture} from './idb-fixture.js';
import * as C from '../public/nabu-core.js';
import * as G from '../public/nabu-graph.js';
const fixture=installIDBFixture();
const DB=await import('../public/nabu-store.js');await DB.openStore();
const water=()=>({...G.translation('food.water','en','es'),provider:'Word graph',note:'Keep this note'});

test('translation and history commit together without an explicit save action',async()=>{
 await DB.clearAll();const r=await DB.commitTranslation(water());const data=await DB.snapshot();
 assert(r.added);assert.equal(data.cards.length,1);assert.equal(data.history.length,1);assert.equal(r.card.back,'agua');
});
test('rapid repeated saves produce one card and one history entry',async()=>{
 await DB.clearAll();const result=await Promise.all(Array.from({length:12},()=>DB.commitTranslation(water())));
 assert.equal((await DB.snapshot()).cards.length,1);assert.equal(result.filter(x=>x.added).length,1);
});
test('duplicate lookup preserves schedule, notes, text edits and identity',async()=>{
 await DB.clearAll();const {card}=await DB.commitTranslation(water());await DB.gradeCard(card.id,4,0,800);
 let c=(await DB.snapshot()).cards[0];await DB.editCard(c.id,{...c,back:'edited meaning',note:'private edit'},c.revision);
 c=(await DB.snapshot()).cards[0];await DB.commitTranslation(water());const after=(await DB.snapshot()).cards[0];
 assert.deepEqual(after.schedule,c.schedule);assert.equal(after.note,'private edit');assert.equal(after.back,'edited meaning');assert.equal(after.revision,c.revision);
});
test('legacy card is linked in place, not duplicated or reset',async()=>{
 await DB.clearAll();const old={...water(),conceptId:''};const r=await DB.addCards([old]);await DB.gradeCard(r.cards[0].id,4,0,800);
 const before=(await DB.snapshot()).cards[0];const saved=await DB.commitTranslation(water());
 assert.equal(saved.card.id,before.id);assert.deepEqual(saved.card.schedule,before.schedule);assert.equal(saved.card.note,before.note);assert.equal(saved.card.conceptId,'food.water');assert.equal((await DB.snapshot()).cards.length,1);
});
test('a legacy homograph cannot collapse two different graph meanings',async()=>{
 await DB.clearAll();const a=G.translation('food.fish','en','de'),b=G.translation('animals.fish','en','de');
 await DB.addCards([{...a,conceptId:''}]);await DB.commitTranslation(a);await DB.commitTranslation(b);assert.equal((await DB.snapshot()).cards.length,2);
});
test('reopening an archived translation restores it without resetting review',async()=>{
 await DB.clearAll();let r=await DB.commitTranslation(water());await DB.gradeCard(r.card.id,4,r.card.revision,200);
 let c=(await DB.snapshot()).cards[0];await DB.archiveCard(c.id,true);r=await DB.commitTranslation(water());
 assert(r.restored);assert(!r.card.archived);assert.deepEqual(r.card.schedule,c.schedule);
});
test('a stale async translation creates neither a card nor a history record',async()=>{
 await DB.clearAll();const r=await DB.commitTranslation(water(),()=>false);assert.equal(r,null);const data=await DB.snapshot();assert.equal(data.cards.length,0);assert.equal(data.history.length,0);
});
test('storage write failure rolls back both stores and retry succeeds',async()=>{
 await DB.clearAll();fixture.failNextWrite();await assert.rejects(DB.commitTranslation(water()),/storage write failure/);
 const data=await DB.snapshot();assert.equal(data.cards.length,0);assert.equal(data.history.length,0);assert((await DB.commitTranslation(water())).added);
});
test('same translation from cloud or manual input does not duplicate a graph card',async()=>{
 await DB.clearAll();await DB.commitTranslation(water());await DB.commitTranslation({...water(),conceptId:'',provider:'DeepL'});
 const added=await DB.addCards([{...water(),conceptId:''}]);assert.equal(added.duplicates,1);assert.equal((await DB.snapshot()).cards.length,1);
});
test('history remains bounded while saved vocabulary is retained',async()=>{
 await DB.clearAll();for(const c of G.CONCEPTS.slice(0,55))await DB.commitTranslation(G.translation(c.id,'en','es'));
 const data=await DB.snapshot();assert.equal(data.cards.length,55);assert.equal(data.history.length,50);
});
test('reverse translations have independent schedules',async()=>{
 await DB.clearAll();const a=await DB.commitTranslation(water());const b=await DB.commitTranslation(G.translation('food.water','es','en'));
 await DB.gradeCard(a.card.id,4,a.card.revision,100);const data=await DB.snapshot();assert.equal(data.cards.find(c=>c.id===b.card.id).schedule.reps,0);
});
