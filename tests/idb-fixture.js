/** Test-only, in-memory IndexedDB request/transaction boundary.
 * This is NOT a browser-persistence implementation or evidence of disk durability.
 * It serializes transactions, enforces identity uniqueness, and rolls back aborts.
 */
export function installIDBFixture(target=globalThis,seed={}){
 const records={cards:new Map(),logs:new Map(),meta:new Map(),history:new Map(),cache:new Map()};
 const clone=v=>v===undefined?undefined:structuredClone(v);
 for(const [name,rows] of Object.entries(seed))if(records[name]&&Array.isArray(rows))for(const row of rows)records[name].set(row.id,clone(row));
 const waiting=[];let active=null,failWrite=false;
 function next(){if(active||!waiting.length)return;active=waiting.shift();active.start();}
 function transaction(names,mode='readonly'){
  const tr={error:null,oncomplete:null,onabort:null,onerror:null,queue:[],started:false,ended:false,scheduled:false,working:null,
   start(){this.started=true;this.working=Object.fromEntries(names.map(n=>[n,new Map([...records[n]].map(([k,v])=>[k,clone(v)]))]));this.schedule();},
   schedule(){if(!this.started||this.scheduled||this.ended)return;this.scheduled=true;setTimeout(()=>this.step(),0);},
   finish(aborted=false){if(this.ended)return;this.ended=true;if(!aborted&&mode==='readwrite')for(const n of names)records[n]=this.working[n];if(active===this)active=null;setTimeout(()=>{if(aborted)this.onabort?.({target:this});else this.oncomplete?.({target:this});next();},0);},
   step(){this.scheduled=false;if(this.ended)return;const item=this.queue.shift();if(!item){this.finish();return;}const {req,op,write}=item;try{if(write&&failWrite){failWrite=false;throw new Error('Simulated storage write failure');}req.result=clone(op());req.onsuccess?.({target:req});}catch(e){this.error=e;req.error=e;req.onerror?.({target:req});this.finish(true);return;}this.schedule();},
   enqueue(op,write=false){if(this.ended)throw new Error('TransactionInactiveError');const req={result:undefined,error:null,transaction:this};this.queue.push({req,op,write});this.schedule();return req;},
   abort(){if(this.ended)return;this.error=this.error||new Error('AbortError');this.finish(true);},
   objectStore(name){if(!names.includes(name))throw new Error('Store not in transaction');const r=this;return {
    get:key=>r.enqueue(()=>r.working[name].get(key)),getAll:()=>r.enqueue(()=>[...r.working[name].values()]),
    index:()=>({get:key=>r.enqueue(()=>[...r.working[name].values()].find(x=>x.identity===key))}),
    put:value=>r.enqueue(()=>{if(mode!=='readwrite')throw new Error('ReadOnlyError');if(name==='cards'&&[...r.working[name].values()].some(x=>x.identity===value.identity&&x.id!==value.id))throw new Error('ConstraintError');r.working[name].set(value.id,clone(value));return value.id;},true),
    add:value=>r.enqueue(()=>{if(mode!=='readwrite')throw new Error('ReadOnlyError');if(r.working[name].has(value.id)||(name==='cards'&&[...r.working[name].values()].some(x=>x.identity===value.identity)))throw new Error('ConstraintError');r.working[name].set(value.id,clone(value));return value.id;},true),
    delete:key=>r.enqueue(()=>r.working[name].delete(key),true),clear:()=>r.enqueue(()=>r.working[name].clear(),true)
   };}
  };waiting.push(tr);setTimeout(next,0);return tr;
 }
 const database={close(){},transaction};
 Object.defineProperty(target,'indexedDB',{configurable:true,value:{open(){const req={result:database};setTimeout(()=>req.onsuccess?.({target:req}),0);return req;}}});
 const tools={snapshot:()=>Object.fromEntries(Object.entries(records).map(([k,v])=>[k,[...v.values()].map(clone)])),failNextWrite(){failWrite=true;}};
 target.__idbFixture=tools;return tools;
}
