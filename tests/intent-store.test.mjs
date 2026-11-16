import test from 'node:test';
import assert from 'node:assert/strict';
import {createIntentStore} from '../public/nabu-intent-store.js';
import * as Intent from '../public/nabu-intents.js';
import * as Local from '../public/nabu-store.js';
import {installIDBFixture} from './idb-fixture.js';

const content=()=>Intent.parseIntentLocal('I want to explore Arabic poetry with no particular end goal.');
const empty=()=>({schemaVersion:1,intents:[],organizationObjective:null,organizationObjectives:[],selection:{mode:'none',intentId:null},role:null});
const record=(options={})=>({schemaVersion:1,id:'intent-record-00000001',ownerUserId:'alice',tenantId:null,kind:'learner',...content(),createdAt:1000,updatedAt:1000,statusChangedAt:1000,revision:1,...options});
function env(){
 const db=new Map();let n=0,fail=false;
 return {db,options:{getMeta:async(k,v)=>structuredClone(db.get(k)??v),setMeta:async(k,v)=>{if(fail)throw Error('Storage quota exceeded');db.set(k,structuredClone(v));},uid:()=>`intent-${String(++n).padStart(18,'0')}`,now:()=>1000},fail:v=>fail=v};
}

test('guest creation and selection persist through a fresh store',async()=>{
 const e=env(),a=createIntentStore(e.options);await a.configure('guest');
 const created=await a.create(content());
 assert.equal(created.ownerUserId,'guest');assert.equal(created.revision,1);
 const b=createIntentStore(e.options);await b.configure('guest');
 assert.deepEqual(b.getSnapshot().intents,[created]);
 assert.equal(b.getContext().immediateIntent.id,created.id);
 assert.equal(b.getState().status,'local');
});

test('existing IndexedDB meta transactions store intents without modifying cards or logs',async()=>{
 const fixture=installIDBFixture();await Local.openStore();
 const options={getMeta:Local.getMeta,setMeta:Local.setMeta,uid:()=> 'intent-idb-record-0001',now:()=>1000};
 const a=createIntentStore(options);await a.configure('guest');await a.create(content());
 const b=createIntentStore(options);await b.configure('guest');
 assert.equal(b.getSnapshot().intents.length,1);
 assert.deepEqual(fixture.snapshot().cards,[]);assert.deepEqual(fixture.snapshot().logs,[]);
 assert.equal(fixture.snapshot().meta.length,1);
});

test('skip persists exploration without creating a blank intent',async()=>{
 const e=env(),s=createIntentStore(e.options);await s.configure('guest');await s.skip();
 assert.deepEqual(s.getSnapshot().intents,[]);assert.equal(s.getContext().immediateIntent,null);
 const fresh=createIntentStore(e.options);await fresh.configure('guest');
 assert.deepEqual(fresh.getContext().selection,{mode:'exploring',intentId:null});
});

test('skip clears a selected goal without pausing, completing, or grading it',async()=>{
 const e=env(),s=createIntentStore(e.options);await s.configure('guest');const before=await s.create(content());
 await s.skip();assert.deepEqual(s.getSnapshot().intents,[before]);
 assert.equal(s.getContext().immediateIntent,null);assert.equal(s.getContext().selection.mode,'exploring');
 await s.select(before.id);assert.equal(s.getContext().immediateIntent.id,before.id);
});

test('empty save fails before persistent state is written',async()=>{
 const e=env(),s=createIntentStore(e.options);await s.configure('guest');
 await assert.rejects(s.create(Intent.emptyIntentContent()),/Enter/);
 assert.equal(e.db.size,0);assert.equal(s.getSnapshot().intents.length,0);
});

test('ambiguous original input persists with unknown fields',async()=>{
 const e=env(),s=createIntentStore(e.options);await s.configure('guest');
 const made=await s.create(Intent.parseIntentLocal('maybe something with music'));
 const fresh=createIntentStore(e.options);await fresh.configure('guest');
 assert.equal(fresh.getContext().immediateIntent.rawText,made.rawText);
 assert.equal(fresh.getContext().immediateIntent.immediateActivity,null);
 assert.equal(fresh.getContext().immediateIntent.objectiveStatus,'unknown');
});

test('editing survives reload with stable identity, updated revision, and explicit correction provenance',async()=>{
 const e=env(),s=createIntentStore(e.options);await s.configure('guest');const made=await s.create(content());
 const edited=await s.update(made.id,Intent.editIntentContent(made,{languages:['es'],context:'Read together'}),made.revision);
 assert.equal(edited.id,made.id);assert.equal(edited.createdAt,made.createdAt);assert.equal(edited.revision,2);
 assert(edited.updatedAt>made.updatedAt);assert.equal(edited.statusChangedAt,made.statusChangedAt);
 const fresh=createIntentStore(e.options);await fresh.configure('guest');
 assert.equal(fresh.getContext().immediateIntent.context,'Read together');
 assert.equal(fresh.getContext().immediateIntent.provenance.fields.languages.source,'user_edit');
});

test('stale revisions from another store cannot overwrite newer guest edits',async()=>{
 const e=env(),a=createIntentStore(e.options),b=createIntentStore(e.options);
 await a.configure('guest');const made=await a.create(content());await b.configure('guest');
 await a.update(made.id,Intent.editIntentContent(made,{context:'Newest context'}),1);
 await assert.rejects(b.update(made.id,Intent.editIntentContent(made,{context:'Stale context'}),1),/changed/);
 await b.refresh();assert.equal(b.getContext().immediateIntent.context,'Newest context');
});

test('lifecycle transitions preserve creation time and inactive intents are never current',async()=>{
 const e=env(),s=createIntentStore(e.options);await s.configure('guest');let current=await s.create(content());
 const createdAt=current.createdAt;
 for(const status of ['paused','active','completed','active','abandoned']){
  const next=await s.transition(current.id,status,current.revision);
  assert.equal(next.createdAt,createdAt);assert(next.statusChangedAt>current.statusChangedAt);
  assert.equal(s.getContext().immediateIntent,null);
  if(status==='active')await s.select(next.id);
  else await assert.rejects(s.select(next.id),/Resume/);
  current=next;
 }
 const fresh=createIntentStore(e.options);await fresh.configure('guest');
 assert.equal(fresh.getSnapshot().intents[0].status,'abandoned');assert.equal(fresh.getContext().immediateIntent,null);
});

test('deleting an intent removes its text and current selection',async()=>{
 const e=env(),s=createIntentStore(e.options);await s.configure('guest');const made=await s.create(content());
 await s.remove(made.id,made.revision);
 const fresh=createIntentStore(e.options);await fresh.configure('guest');
 assert.deepEqual(fresh.getSnapshot().intents,[]);assert.equal(fresh.getContext().selection.mode,'none');
 assert(!JSON.stringify([...e.db.values()]).includes(made.rawText));
});

test('guest actions cannot address a different owner or a nonexistent ID',async()=>{
 const e=env(),s=createIntentStore(e.options);await s.configure('guest');await s.create(content());
 for(const action of [()=>s.select('someone-else-0000001'),()=>s.update('someone-else-0000001',content(),1),()=>s.remove('someone-else-0000001',1)])await assert.rejects(action(),/not found/);
 await assert.rejects(s.create(content(),{kind:'organization'}),/authenticated team/);
 await assert.rejects(s.setScope('team-a'),/Sign in/);
 assert.equal(s.getSnapshot().intents.length,0,'Changing scope clears old data before access fails.');
});

test('failed guest writes never claim a save and preserve previous data',async()=>{
 const e=env(),s=createIntentStore(e.options);await s.configure('guest');const made=await s.create(content());
 e.fail(true);await assert.rejects(s.update(made.id,Intent.editIntentContent(made,{context:'Not saved'}),1),/quota/);
 assert.equal(s.getState().status,'error');assert.deepEqual(s.getSnapshot().intents,[made]);
 e.fail(false);await s.refresh();assert.equal(s.getContext().immediateIntent.context,null);
});

test('corrupt metadata produces an error and is not silently overwritten by skip',async()=>{
 const e=env(),bad={schemaVersion:9,intents:'not-a-list'};e.db.set('nabu.intent.v1:guest',bad);
 const s=createIntentStore(e.options);await assert.rejects(s.configure('guest'),/could not be read/);
 await assert.rejects(s.skip(),/could not be read/);assert.deepEqual(e.db.get('nabu.intent.v1:guest'),bad);
});

test('unsupported foreign-owner data in guest storage is rejected',async()=>{
 const e=env(),snapshot={...empty(),intents:[record()]};e.db.set('nabu.intent.v1:guest',snapshot);
 const s=createIntentStore(e.options);await assert.rejects(s.configure('guest'),/different account/);
 assert.equal(s.getSnapshot().intents.length,0);
});

test('returned snapshots and contexts cannot mutate durable state',async()=>{
 const e=env(),s=createIntentStore(e.options);await s.configure('guest');const made=await s.create(content());
 made.rawText='modified outside';s.getSnapshot().intents[0].rawText='also modified';s.getContext().immediateIntent.languages.push('es');
 assert.notEqual(s.getSnapshot().intents[0].rawText,'modified outside');
 assert.deepEqual(s.getContext().immediateIntent.languages,['ar']);
});

test('concurrent guest actions preserve both records and leave unrelated metadata intact',async()=>{
 const e=env();e.db.set('nabu.content.v1:guest',{events:['unchanged']});e.db.set('settings',{sourceLang:'en'});
 const s=createIntentStore(e.options);await s.configure('guest');
 await Promise.all([s.create(content()),s.create(Intent.parseIntentLocal('I want to understand this song.'))]);
 assert.equal(s.getSnapshot().intents.length,2);
 assert.deepEqual(e.db.get('nabu.content.v1:guest'),{events:['unchanged']});assert.deepEqual(e.db.get('settings'),{sourceLang:'en'});
});

test('signed-in actors with no supported backend never fall back to guest storage',async()=>{
 const e=env(),s=createIntentStore(e.options);await s.configure('guest');const guest=await s.create(content());
 await assert.rejects(s.configure('alice'),/Connect/);
 await assert.rejects(s.create(content()),/Connect/);await assert.rejects(s.skip(),/Connect/);
 assert.equal(s.getState().owner,'alice');assert.equal(s.getSnapshot().intents.length,0);
 await s.configure('guest');assert.equal(s.getContext().immediateIntent.id,guest.id);
});

test('expired identity cannot read or write guest intents',async()=>{
 const e=env(),s=createIntentStore(e.options);await assert.rejects(s.configure('!locked'),/Sign in/);
 await assert.rejects(s.create(content()),/Sign in/);await assert.rejects(s.skip(),/Sign in/);
 assert.equal(e.db.size,0);assert.equal(s.getState().status,'locked');
});

test('authenticated snapshots never import guest data or write account text to IndexedDB',async()=>{
 const e=env(),s=createIntentStore(e.options);await s.configure('guest');const guest=await s.create(content());
 const remote={...empty(),intents:[record()],selection:{mode:'selected',intentId:'intent-record-00000001'}};
 await s.configure('alice',async path=>{assert.equal(path,'intents');return remote;});
 assert.equal(s.getContext().immediateIntent.ownerUserId,'alice');assert.notEqual(s.getContext().immediateIntent.id,guest.id);
 assert.equal(e.db.size,1);assert.equal(e.db.get('nabu.intent.v1:guest').intents[0].id,guest.id);
 await s.configure('bob',async()=>empty());assert.equal(s.getContext().immediateIntent,null);
});

test('team context exposes its attributed objective without overwriting the member’s activity',async()=>{
 const e=env(),s=createIntentStore(e.options);
 const personal=record({tenantId:'team-a'}),org=record({id:'org-objective-000001',ownerUserId:'team-owner',kind:'organization',tenantId:'team-a',destination:'Handle Spanish support calls'});
 org.provenance=Intent.editIntentContent(content(),{destination:org.destination}).provenance;
 const snapshot={...empty(),role:'member',intents:[personal],organizationObjectives:[org],organizationObjective:org,selection:{mode:'selected',intentId:personal.id}};
 await s.configure('alice',async()=>snapshot,'team-a');
 const context=s.getContext();assert.equal(context.actor.kind,'team');assert.equal(context.organizationObjective.ownerUserId,'team-owner');
 assert.equal(context.immediateIntent.destination,null);assert.equal(context.organizationObjective.destination,'Handle Spanish support calls');
});

test('each team scope and its current selection are independent',async()=>{
 const e=env(),s=createIntentStore(e.options),a=record({tenantId:'team-a'});
 const api=async path=>path.endsWith('team-a')?{...empty(),role:'member',intents:[a],selection:{mode:'selected',intentId:a.id}}:{...empty(),role:'member',selection:{mode:'exploring',intentId:null}};
 await s.configure('alice',api,'team-a');assert.equal(s.getContext().immediateIntent.id,a.id);
 await s.setScope('team-b');assert.equal(s.getContext().immediateIntent,null);assert.equal(s.getContext().selection.mode,'exploring');
 await s.setScope('team-a');assert.equal(s.getContext().immediateIntent.id,a.id);
});

test('a server response containing another member’s private intent is rejected',async()=>{
 const e=env(),s=createIntentStore(e.options);
 await assert.rejects(s.configure('alice',async()=>({...empty(),intents:[record({ownerUserId:'bob'})]})),/different account/);
 assert.equal(s.getSnapshot().intents.length,0);
});

test('a late old-account read cannot populate a newly configured account',async()=>{
 const e=env(),s=createIntentStore(e.options);let release,began;const started=new Promise(r=>began=r);
 const old=s.configure('alice',async()=>{began();return new Promise(r=>release=r);});
 const handled=assert.rejects(old,/account or team changed/);await started;
 await s.configure('bob',async()=>empty());release({...empty(),intents:[record()]});await handled;
 assert.equal(s.getState().owner,'bob');assert.equal(s.getState().status,'synced');assert.equal(s.getSnapshot().intents.length,0);
});

test('a late old-team mutation response does not enter a new team context',async()=>{
 const e=env(),s=createIntentStore(e.options);let release,began;const started=new Promise(r=>began=r);
 const api=async(path,options)=>{if(options){began();return new Promise(r=>release=r);}return {...empty(),role:'member'};};
 await s.configure('alice',api,'team-a');const saving=s.skip(),handled=assert.rejects(saving,/account or team changed/);await started;
 await s.setScope('team-b');release({selection:{mode:'exploring',intentId:null}});await handled;
 assert.equal(s.getState().tenantId,'team-b');assert.equal(s.getContext().selection.mode,'none');assert.equal(e.db.size,0);
});

test('account mutation sends only editable content and refreshes the server-confirmed selection',async()=>{
 const e=env(),calls=[];let snapshot=empty();
 const api=async(path,options)=>{calls.push([path,options]);if(options){assert.equal(options.method,'POST');const saved=record({id:options.body.id,...options.body.content});snapshot={...empty(),intents:[saved],selection:{mode:'selected',intentId:saved.id}};return {intent:saved};}return snapshot;};
 const s=createIntentStore(e.options);await s.configure('alice',api);const made=await s.create(content());
 const sent=calls.find(([,options])=>options)?.[1].body;
 assert.equal(sent.kind,'learner');assert.equal(sent.tenantId,null);assert(!Object.hasOwn(sent.content,'ownerUserId'));assert(!Object.hasOwn(sent.content,'revision'));
 assert.equal(s.getContext().immediateIntent.id,made.id);assert.equal(s.getState().status,'synced');assert.equal(e.db.size,0);
});

test('a server mutation rejection cannot be represented as a local save',async()=>{
 const e=env(),s=createIntentStore(e.options),error=Object.assign(Error('Membership revoked'),{status:403});
 await s.configure('alice',async(path,options)=>{if(options)throw error;return empty();});
 await assert.rejects(s.create(content()),/Membership revoked/);assert.equal(s.getState().status,'locked');assert.equal(e.db.size,0);
 assert.equal(s.getSnapshot().intents.length,0);
});

test('listTenants uses the authenticated membership endpoint and exposes actual roles',async()=>{
 const e=env(),s=createIntentStore(e.options),tenants=[{id:'team-a',label:'Support team',role:'member'}];
 await s.configure('alice',async path=>path==='intent-tenants'?{tenants}:empty());
 assert.deepEqual(await s.listTenants(),tenants);assert.equal(e.db.size,0);
});

test('temporary exploration works with unavailable storage without overwriting corrupt data',async()=>{
 const e=env(),corrupt={schemaVersion:98,intents:'unreadable'};e.db.set('nabu.intent.v1:guest',corrupt);
 const s=createIntentStore(e.options);await assert.rejects(s.configure('guest'));
 s.exploreTemporarily('Browser storage is unavailable.');
 assert.equal(s.getState().status,'temporary');assert.match(s.getState().message,/not been saved/);
 assert.deepEqual(s.getContext().selection,{mode:'exploring',intentId:null});assert.equal(s.getContext().immediateIntent,null);
 assert.deepEqual(e.db.get('nabu.intent.v1:guest'),corrupt);
});

test('temporary exploration never creates a guest write for locked or offline accounts',async()=>{
 const e=env(),s=createIntentStore(e.options);await assert.rejects(s.configure('!locked'));
 s.exploreTemporarily();assert.equal(s.getContext().actor.userId,null);assert.equal(s.getContext().selection.mode,'exploring');
 await assert.rejects(s.configure('alice'));
 s.exploreTemporarily();assert.equal(s.getContext().actor.userId,'alice');assert.equal(s.getContext().selection.mode,'exploring');
 assert.equal(e.db.size,0);await assert.rejects(s.create(content()),/Connect/);
});

test('server authentication loss clears private in-memory records before temporary exploration',async()=>{
 const e=env(),s=createIntentStore(e.options),r=record();
 await s.configure('alice',async(path,options)=>{if(options)throw Object.assign(Error('Sign in again'),{status:401});return {...empty(),intents:[r],selection:{mode:'selected',intentId:r.id}};});
 await assert.rejects(s.skip(),/Sign in again/);assert.deepEqual(s.getSnapshot().intents,[]);
 s.exploreTemporarily();assert.equal(s.getContext().immediateIntent,null);assert.equal(e.db.size,0);
});

test('same guest draft ID retries idempotently without changing a newer selection',async()=>{
 const e=env(),s=createIntentStore(e.options),id='retry-draft-00000001';await s.configure('guest');
 const made=await s.create(content(),{id});await s.skip();
 assert.deepEqual(await s.create(content(),{id}),made);
 assert.equal(s.getSnapshot().intents.length,1);assert.equal(s.getContext().selection.mode,'exploring');
 await assert.rejects(s.create(Intent.editIntentContent(content(),{context:'changed after uncertain save'}),{id}),/already in use/);
});

test('same account draft ID survives a lost POST acknowledgement without duplicate records',async()=>{
 const e=env(),records=new Map();let lose=true;
 const api=async(path,options)=>{
  if(options){
   const id=options.body.id;if(!records.has(id))records.set(id,record({id,...options.body.content}));
   if(lose){lose=false;throw Error('Lost acknowledgement');}
   return {intent:records.get(id)};
  }
  const rows=[...records.values()];return {...empty(),intents:rows,selection:rows.length?{mode:'selected',intentId:rows[0].id}:{mode:'none',intentId:null}};
 };
 const s=createIntentStore(e.options);await s.configure('alice',api);
 const options={id:'retry-account-000001'};
 await assert.rejects(s.create(content(),options),/Lost acknowledgement/);
 const saved=await s.create(content(),options);
 assert.equal(records.size,1);assert.equal(saved.id,options.id);assert.equal(s.getSnapshot().intents.length,1);assert.equal(e.db.size,0);
});

test('same account draft ID survives a successful POST followed by failed refresh',async()=>{
 const e=env(),records=new Map();let failRead=false;
 const api=async(path,options)=>{
  if(options){const id=options.body.id;if(!records.has(id)){records.set(id,record({id,...options.body.content}));failRead=true;}return {intent:records.get(id)};}
  if(failRead){failRead=false;throw Error('Refresh unavailable');}
  const rows=[...records.values()];return {...empty(),intents:rows,selection:rows.length?{mode:'selected',intentId:rows[0].id}:{mode:'none',intentId:null}};
 };
 const s=createIntentStore(e.options);await s.configure('alice',api);
 const options={id:'retry-refresh-000001'};
 await assert.rejects(s.create(content(),options),/Refresh unavailable/);
 await s.create(content(),options);assert.equal(records.size,1);assert.equal(s.getSnapshot().intents.length,1);
});
