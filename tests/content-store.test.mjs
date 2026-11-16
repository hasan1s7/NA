import test from 'node:test';import assert from 'node:assert/strict';
import {createContentStore} from '../public/nabu-content-store.js';import {itemById} from '../public/nabu-content.js';
import * as O from '../public/nabu-observations.js';
const item=itemById('a-little-later');
function env(){const db=new Map();let n=0,fail=false;return {db,options:{getMeta:async(k,v)=>structuredClone(db.get(k)??v),setMeta:async(k,v)=>{if(fail)throw Error('TEST failed storage');db.set(k,structuredClone(v));},uid:()=>`event-${String(++n).padStart(16,'0')}`,now:()=>1000},fail:v=>fail=v};}
test('guest reading place survives a newly constructed store',async()=>{const e=env(),a=createContentStore(e.options);await a.configure('guest');await a.append(item,'position',{segmentId:'s4',fraction:.25});const b=createContentStore(e.options);await b.configure('guest');assert.equal(b.getEvents()[0].segmentId,'s4');assert.equal(b.getState().status,'local');});
test('sign-in never migrates guest or another account progress',async()=>{const e=env(),s=createContentStore(e.options);await s.configure('guest');await s.append(item,'opened');await s.configure('alice');assert.equal(s.getEvents().length,0);await s.append(item,'finished',{value:true});await s.configure('bob');assert.equal(s.getEvents().length,0);await s.configure('guest');assert.equal(s.getEvents().length,1);});
test('failed local writes do not claim success and retry persists exactly once',async()=>{const e=env(),s=createContentStore(e.options);await s.configure('guest');e.fail(true);await assert.rejects(s.append(item,'opened',{},'event-stable-123456'),/failed/);assert.equal(s.getEvents().length,0);e.fail(false);await s.append(item,'opened',{},'event-stable-123456');assert.equal(s.getEvents().length,1);});
test('offline account queue survives reopen and a lost server acknowledgement',async()=>{const e=env(),remote=new Map();let lost=true;const api=async(p,o)=>{if(o){for(const ev of o.body.events)remote.set(ev.id,ev);if(lost){lost=false;throw Error('Lost acknowledgement');}return {accepted:o.body.events.map(e=>e.id)};}return {events:[...remote.values()]};};const s=createContentStore(e.options);await s.configure('alice',api);await s.append(item,'opened');await s.sync();assert.equal(s.getState().status,'error');assert.equal(s.getState().pending,1);const fresh=createContentStore(e.options);await fresh.configure('alice',api);await fresh.sync();assert.equal(remote.size,1);assert.equal(fresh.getState().pending,0);assert.equal(fresh.getState().status,'synced');});
test('concurrent append operations preserve both observations',async()=>{const e=env(),s=createContentStore(e.options);await s.configure('guest');await Promise.all([s.append(item,'opened'),s.append(item,'finished',{value:true})]);assert.equal(s.getEvents().length,2);});
test('late old-account remote response cannot enter a new account',async()=>{const e=env();let finish,began;const started=new Promise(r=>began=r);const s=createContentStore(e.options);await s.configure('alice',async()=>{began();return new Promise(r=>finish=r);});const running=s.sync();await started;await s.configure('bob');finish({events:[]});await running;assert.equal(s.getState().owner,'bob');assert.equal(s.getEvents().length,0);});
test('locked identity rejects writes instead of assigning them to guest',async()=>{const e=env(),s=createContentStore(e.options);await s.configure('!locked');await assert.rejects(s.append(item,'opened'),/sign in/);assert.equal(e.db.size,0);});

test('a response appended during a running sync is drained before sync resolves',async()=>{const e=env(),remote=new Map();let release,began;const started=new Promise(r=>began=r);let held=false;const api=async(path,options)=>{if(options){for(const row of options.body.events)remote.set(row.id,row);return {};}if(!held){held=true;began();await new Promise(r=>release=r);}return {events:[...remote.values()]};};const s=createContentStore(e.options);await s.configure('alice',api);await s.append(item,'opened');const first=s.sync();await started;await s.append(item,'position',{segmentId:'s6',fraction:.7});const joining=s.sync();release();await Promise.all([first,joining]);assert.equal(remote.size,2);assert.equal(s.getState().pending,0);assert.equal(s.getState().status,'synced');});

function evidenceFields(n,userId=null,observation='displayed'){
 const active=['response','hint','answer-revealed','skipped'].includes(observation),episodeId='store-episode-'+String(n).padStart(16,'0');
 const ref=id=>({id,version:1,status:'authored',provenance:[{sourceId:'fixture:store',locator:'fixture',kind:'authored-fixture'}]});
 return {sessionId:episodeId,evidence:{schemaVersion:1,episodeId,attemptId:active?'store-attempt-'+String(n).padStart(16,'0'):null,retryOfEpisodeId:null,actor:{userId,tenantId:null},intentRef:null,organizationObjectiveRef:null,taskRef:active?{id:'fixture:task',version:1}:null,occurrence:{contentId:item.id,version:1,segmentId:'s1',annotationId:'a3',readingId:'reading-one',context:{lexicalId:null,senseId:null,speakerId:null,syntaxId:null,contextId:null}},inputModality:'text',outputModality:observation==='response'?'text':'none',observation,assistance:O.emptyAssistance(),presentedAt:active?100:null,response:observation==='response'?{answer:'fixture response'}:null,skipReason:null,assessment:null,rubricRef:active?ref('fixture:rubric'):null,scorerRef:active?ref('fixture:scorer'):null,analysisRef:null}};
}
test('stable-ID append retries reuse the original timestamp and preserve pending delivery',async()=>{
 const e=env(),s=createContentStore(e.options),remote=new Map();let posts=0;
 const api=async(path,options)=>{if(options){posts++;for(const row of options.body.events)remote.set(row.id,row);return {};}return {events:[...remote.values()]};};
 await s.configure('alice',api);const fields=evidenceFields(1,'alice','response'),first=await s.append(item,'evidence',fields,'stable-evidence-00001');
 await s.append(item,'opened');const retried=await s.append(item,'evidence',fields,first.id);assert.deepEqual(retried,first);assert.equal(s.getEvents().length,2);assert.equal(s.getState().pending,2);
 await s.sync();assert.equal(s.getState().pending,0);assert.equal(posts,1);assert.equal(remote.size,2);
 assert.deepEqual(await s.append(item,'evidence',fields,first.id),first);assert.equal(s.getState().pending,0);await s.sync();assert.equal(posts,1);
});
test('a committed local write with a lost acknowledgement retries without changing event time',async()=>{
 const e=env(),original=e.options.setMeta;let lose=true,tick=1000;e.options.now=()=>tick++;
 e.options.setMeta=async(...args)=>{await original(...args);if(lose){lose=false;throw Error('Lost local acknowledgement');}};
 const s=createContentStore(e.options);await s.configure('alice');const fields=evidenceFields(1,'alice','response');await assert.rejects(s.append(item,'evidence',fields,'lost-ack-evidence-001'),/Lost local/);assert.equal(s.getEvents().length,0);
 const retry=await s.append(item,'evidence',fields,'lost-ack-evidence-001');assert.equal(retry.at,1000);assert.equal(s.getEvents().length,1);assert.equal(s.getState().pending,1);
});
test('conflicting retry payload or explicit timestamp cannot overwrite saved evidence or pending IDs',async()=>{
 const e=env(),s=createContentStore(e.options);await s.configure('alice');const fields=evidenceFields(1,'alice','response'),first=await s.append(item,'evidence',fields,'conflict-evidence-001');
 const changed=structuredClone(fields);changed.evidence.response.answer='different';await assert.rejects(s.append(item,'evidence',changed,first.id),/reused/);await assert.rejects(s.append(item,'evidence',{...fields,at:first.at+1},first.id),/reused/);
 assert.deepEqual(s.getEvents(),[first]);assert.equal(s.getState().pending,1);
});
test('evidence actor scope is enforced on append, reopen and remote merge',async()=>{
 const e=env(),s=createContentStore(e.options);await s.configure('guest');await assert.rejects(s.append(item,'evidence',evidenceFields(1,'alice')),/different account/);const own=await s.append(item,'evidence',evidenceFields(2));
 await s.configure('alice');await assert.rejects(s.append(item,'evidence',evidenceFields(3)),/different account/);assert.equal(s.getEvents().length,0);
 e.db.set('nabu.content.v1:bob',{events:[{...own,evidence:{...own.evidence,actor:{userId:'alice',tenantId:null}}}],pending:[]});await s.configure('bob');assert.equal(s.getState().status,'error');assert.equal(s.getEvents().length,0);
 await s.configure('alice',async()=>({events:[own]}));await s.sync();assert.equal(s.getState().status,'error');assert.equal(s.getEvents().length,0);assert.equal(e.db.has('nabu.content.v1:alice'),false);
});
test('terminal attempt identity is checked before persistence while explicit retry episodes remain auditable',async()=>{
 const e=env(),s=createContentStore(e.options);await s.configure('guest');const fields=evidenceFields(1,null,'response'),first=await s.append(item,'evidence',fields,'first-evidence-00001');
 await assert.rejects(s.append(item,'evidence',fields,'duplicate-evidence-01'),/terminal response/);assert.equal(s.getEvents().length,1);
 const next=evidenceFields(2,null,'response');next.evidence.retryOfEpisodeId=fields.evidence.episodeId;await s.append(item,'evidence',next,'retry-evidence-00001');assert.equal(s.getEvents().length,2);assert.equal(s.getEvents()[1].evidence.retryOfEpisodeId,first.evidence.episodeId);
});
test('returned events and exports cannot mutate the store’s nested evidence state',async()=>{
 const e=env(),s=createContentStore(e.options);await s.configure('guest');const created=await s.append(item,'evidence',evidenceFields(1));created.evidence.actor.userId='mutated';s.getEvents()[0].evidence.actor.userId='mutated';s.exportData().events[0].evidence.actor.userId='mutated';assert.equal(s.getEvents()[0].evidence.actor.userId,null);
});
test('sync batches obey both 50-record and 500-KiB serialized UTF8 boundaries',async()=>{
 const e=env(),s=createContentStore(e.options),remote=new Map(),sizes=[];
 const api=async(path,options)=>{if(options){const bytes=new TextEncoder().encode(JSON.stringify(options.body)).byteLength;sizes.push({count:options.body.events.length,bytes});assert(options.body.events.length<=50);assert(bytes<=500*1024);for(const row of options.body.events)remote.set(row.id,row);return {};}return {events:[...remote.values()]};};
 await s.configure('alice',api);
 for(let n=1;n<=50;n++)await s.append(item,'evidence',evidenceFields(n,'alice'));
 const source={sourceId:'س'.repeat(200),locator:'م'.repeat(300),kind:'ع'.repeat(80)};
 for(let n=51;n<=62;n++){const fields=evidenceFields(n,'alice');for(const key of ['scorerRef','rubricRef','analysisRef'])fields.evidence[key]={id:'long:'+key,version:1,status:'authored',provenance:Array.from({length:12},()=>({...source}))};await s.append(item,'evidence',fields);}
 assert(new TextEncoder().encode(JSON.stringify({events:s.getEvents()})).byteLength>500*1024);await s.sync();assert.equal(s.getState().status,'synced');assert.equal(s.getState().pending,0);assert.equal(remote.size,62);assert(sizes.some(x=>x.count===50));assert(sizes.length>=3);
});
