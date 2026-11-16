import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as L from '../public/nabu-links.js';
import {createTransport} from '../mobile/transport.mjs';
const origin='https://nabu.example';
const slug='bonjour-fr-en-AbCdEf0123456789';
for(const [view,path]of Object.entries(L.ROUTES))test('route '+view+' has meaningful paths and static hashes',()=>{
 assert.equal(L.viewURL(view,origin+'/w/'+slug,true).href,origin+'/'+path);
 assert.equal(L.viewURL(view,origin+'/nabu/?view=library',false).href,origin+'/nabu/'+(path?'#'+path:''));
 assert.equal(L.viewFromURL(origin+'/'+path),view);
 assert.equal(L.viewFromURL(origin+'/nabu/#'+path),view);
 assert.equal(L.viewFromURL(origin+'/?view='+view),view);
});
for(const href of [origin+'/',origin+'/review',origin+'/w/'+slug])test('root API resolution '+href,()=>assert.equal(L.apiURL('session',href).href,origin+'/api/session'));
test('Pages subdirectory API resolution stays in that app',()=>assert.equal(L.apiURL('config',origin+'/nabu/#friends').href,origin+'/nabu/api/config'));
for(const invalid of ['//other','../x','x/../config','x/%2e%2e/config','https://evil','x?token=abc','x#frag'])test('API path rejects '+invalid,()=>assert.throws(()=>L.apiURL(invalid,origin)));
test('readable short slug recognized; arbitrary and damaged URLs rejected',()=>{
 assert.equal(L.shareSlug(origin+'/w/'+slug),slug);
 assert.equal(L.shareSlug(origin+'/w/bonjour'),null);
});
test('legacy sharing formats retain their exact payload',()=>{
 assert.equal(L.legacyShareToken(origin+'/#share=abcd'), 'abcd');
 assert.equal(L.legacyShareToken(origin+'/#word/bonjour.abcd'),'abcd');
 assert.equal(L.legacyShareToken(origin+'/#friends'),null);
 assert.equal(L.legacyShareURL({front:'Bonjour!'},'abc',origin+'/review'),origin+'/#word/bonjour.abc');
});
for(const invalid of ['http://nabu.example','https://person:secret@nabu.example','https://nabu.example/api','https://nabu.example/?x=1','https://nabu.example/#x','https://hasan1s7.github.io','javascript:alert(1)','https://localhost'])test('native origin rejects '+invalid,()=>assert.throws(()=>L.validateAPIOrigin(invalid)));
test('native origin accepts HTTPS and explicit offline-only mode',()=>{
 assert.equal(L.validateAPIOrigin(origin+'/'),origin);assert.equal(L.validateAPIOrigin('',{allowEmpty:true}),'');
});
test('native incoming links cannot redirect to another host or expose arbitrary pages',()=>{
 assert.equal(L.incomingAppURL(origin+'/w/'+slug,origin),'/w/'+slug);
 assert.equal(L.incomingAppURL(origin+'/review',origin),'/review');
 for(const value of ['https://evil.example/review',origin+'/api/session','nabu://review',origin+'/settings/anything'])assert.equal(L.incomingAppURL(value,origin),null);
});
test('native transport maps only allowed headers and origin; cookie never returned to JS',async()=>{
 let sent;const transport=createTransport(origin,async opts=>(sent=opts,{status:200,url:opts.url,data:{ok:true},headers:{'Set-Cookie':'SECRET','Content-Type':'application/json'}}));
 const response=await transport('/api/sync',{method:'POST',headers:{'X-CSRF-Token':'csrf','X-Nabu-Account':'u','Authorization':'secret','Origin':'https://evil.example','Content-Type':'application/json'},body:JSON.stringify({operations:[]})});
 assert.equal(sent.url,origin+'/api/sync');assert.equal(sent.headers.Origin,origin);assert.equal(sent.headers.authorization,undefined);assert.equal(sent.headers['x-csrf-token'],'csrf');assert.ok(sent.disableRedirects);assert.equal(response.headers.get('set-cookie'),null);assert.deepEqual(await response.json(),{ok:true});
});
test('native transport rejects every request without a configured secure backend',()=>assert.throws(()=>createTransport('',async()=>{})));
test('native transport forbids traversal, external URLs, auth and unrelated headers',async()=>{
 const t=createTransport(origin,async()=>{throw Error('Must not send');});
 for(const p of ['/api/../account','//api/config','/api/x?y=1','https://evil/api/config','/api/%2e%2e/config','/privacy'])await assert.rejects(t(p),/Invalid/);
 await assert.rejects(t('/api/config',{method:'TRACE'}),/Unsupported/);
});
test('native JSON HTTP errors keep status and structured message',async()=>{
 const t=createTransport(origin,async()=>({status:401,data:{detail:'Sign in'},headers:{}}));const r=await t('/api/library');assert.equal(r.status,401);assert.deepEqual(await r.json(),{detail:'Sign in'});
});
test('native audio becomes a Blob-compatible response',async()=>{
 const t=createTransport(origin,async()=>({status:200,data:btoa('audio'),headers:{'Content-Type':'audio/mpeg'}}));const r=await t('/api/speech',{method:'POST',headers:{Accept:'audio/mpeg'},body:'{}'});assert.equal(await r.text(),'audio');assert.equal(r.headers.get('content-type'),'audio/mpeg');
});
test('native HTTP redirects and off-origin replies are refused',async()=>{
 await assert.rejects(createTransport(origin,async()=>({status:302,data:{}}))('/api/config'),/Unexpected/);
 await assert.rejects(createTransport(origin,async()=>({status:200,url:'https://evil.example',data:{}}))('/api/config'),/redirect/);
});
test('native cancellation does not hang waiting for plugin acknowledgment',async()=>{
 const controller=new AbortController();const t=createTransport(origin,()=>new Promise(()=>{}));const request=t('/api/config',{signal:controller.signal});controller.abort();await assert.rejects(request,{name:'AbortError'});
});
test('already cancelled native requests do not cross the bridge',async()=>{
 const controller=new AbortController();controller.abort();let sent=false;const t=createTransport(origin,async()=>{sent=true;});await assert.rejects(t('/api/config',{signal:controller.signal}));assert.equal(sent,false);
});
test('mobile config never loads a remote document or relaxes transport security',()=>{
 const c=JSON.parse(fs.readFileSync(new URL('../capacitor.config.json',import.meta.url)));assert.equal(c.webDir,'mobile/www');assert.equal(c.server.url,undefined);assert.equal(c.server.allowNavigation,undefined);assert.equal(c.android.allowMixedContent,false);assert.equal(c.loggingBehavior,'none');
});
test('manifest is retained and every install icon exists',()=>{
 const page=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');assert.match(page,/<link rel="manifest"/);assert.match(page,/apple-touch-icon/);
 const m=JSON.parse(fs.readFileSync(new URL('../public/nabu.webmanifest',import.meta.url)));for(const icon of m.icons)assert.ok(fs.existsSync(new URL('../public/'+icon.src,import.meta.url)));assert.ok(m.icons.some(x=>x.purpose==='maskable'));
});

test('native file export waits for explicit share and cleans only its private cache files',async()=>{
 const {fileExporter}=await import('../mobile/file-export.mjs');const calls=[],timers=[];
 const filesystem={async writeFile(data){calls.push(['write',data]);return {uri:'file:///private/export'};},async deleteFile(data){calls.push(['delete',data]);},async readdir(){return {files:[{name:'nabu-export-old.json'},{name:'keep-this'}]};}};
 const file=fileExporter({filesystem,share:async data=>calls.push(['share',data]),directory:'CACHE',encoding:'utf8',schedule:(fn,ms)=>timers.push({fn,ms}),id:()=> 'id'});
 await file.cleanup();assert.equal(calls[0][1].path,'nabu-export-old.json');calls.length=0;
 await file.exportFile('nabu-backup.json','{}');assert.deepEqual(calls.map(x=>x[0]),['write','share']);assert.equal(timers[0].ms,300000);await timers[0].fn();
 assert.equal(calls[2][1].path,'nabu-export-id-nabu-backup.json');assert.equal(calls[0][1].directory,'CACHE');
 await assert.rejects(file.exportFile('../secrets',''),/Invalid/);
});
