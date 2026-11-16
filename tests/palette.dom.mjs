import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM,VirtualConsole} from 'jsdom';
import {installIDBFixture} from './idb-fixture.js';
const raw=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
const html=raw.replace('boot();','window.__paletteTest={state,DB,actions,render};boot();');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn){for(let i=0;i<600;i++){if(fn())return;await wait(10);}throw Error('UI did not settle');}
async function boot(seed={},url='https://hasan1s7.github.io/NA/#settings'){
 const requests=[],errors=[];let ready=false;
 const vc=new VirtualConsole();vc.on('jsdomError',e=>{if(!e.message.includes('CSS'))errors.push(e.message);});vc.on('error',(...e)=>errors.push(e.map(String).join(' ')));
 const dom=new JSDOM(html,{url,runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
  installIDBFixture(w,seed);w.structuredClone=structuredClone;w.Response=Response;w.AbortController=AbortController;w.TextEncoder=TextEncoder;w.Blob=Blob;
  const interval=w.setInterval.bind(w);w.setInterval=(fn,ms,...a)=>{if(ms===15000)ready=true;return interval(fn,ms,...a);};
  w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=function(){};
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
  w.fetch=async u=>{requests.push(String(u));return new Response(JSON.stringify({detail:'Static host has no server'}),{status:404,headers:{'Content-Type':'application/json'}});};
 }});
 await until(()=>ready&&dom.window.document.querySelector('#palette-heading'));
 const w=dom.window,d=w.document;
 return {dom,w,d,t:w.__paletteTest,requests,errors,close:()=>w.close(),snapshot:()=>w.__idbFixture.snapshot()};
}
test('Pages boots the complete bundle with green default, four named templates and no backend requests',async()=>{
 const h=await boot();try{assert.equal(h.d.documentElement.dataset.nabuPalette,'green');assert.equal(h.d.querySelectorAll('.palette-option').length,4);assert.match(h.d.querySelector('.pages-notice').textContent,/Accounts, departmental workspaces and cloud services need/);assert.equal(h.requests.length,0);assert.deepEqual(h.errors,[]);}finally{h.close();}
});
test('choosing a palette persists it across refresh without replacing other preferences',async()=>{
 const h=await boot();let data;try{h.t.state.settings.alias='Preserve me';await h.t.actions['set-palette'](h.d.querySelector('[data-palette="plum"]'));assert.equal(h.d.documentElement.dataset.nabuPalette,'plum');assert.match(h.d.querySelector('#palette-status').textContent,/saved on this device/);data=h.snapshot();assert.equal(await h.t.DB.getMeta('settings',{}).then(s=>s.alias),'Preserve me');}finally{h.close();}
 const restored=await boot(data);try{assert.equal(restored.d.documentElement.dataset.nabuPalette,'plum');assert.equal(restored.d.querySelector('[data-palette="plum"]').getAttribute('aria-pressed'),'true');assert.equal(restored.t.state.settings.alias,'Preserve me');}finally{restored.close();}
});
test('palette save failure remains truthful and choosing it again retries',async()=>{
 const h=await boot();try{h.w.__idbFixture.failNextWrite();await h.t.actions['set-palette'](h.d.querySelector('[data-palette="clay"]'));assert.equal(h.d.documentElement.dataset.nabuPalette,'clay');assert.match(h.d.querySelector('#palette-status').textContent,/Could not save/);await h.t.actions['set-palette'](h.d.querySelector('[data-palette="clay"]'));assert.match(h.d.querySelector('#palette-status').textContent,/saved on this device/);}finally{h.close();}
});
test('a corrupt saved palette safely falls back to original green',async()=>{
 const h=await boot();let data;try{await h.t.DB.setMeta('settings',{palette:'unknown-template'});data=h.snapshot();}finally{h.close();}
 const restored=await boot(data);try{assert.equal(restored.d.documentElement.dataset.nabuPalette,'green');assert.deepEqual(restored.errors,[]);}finally{restored.close();}
});
