/** Shipping 1.16 bundle acceptance. DOM, IndexedDB transaction and audio-event
 * fixtures, not proof of native layout, real disk durability or audible speech. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM,VirtualConsole} from 'jsdom';
import {installIDBFixture} from './idb-fixture.js';
const original=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
const html=original.replace('boot();','window.__test={state,DB,actions,lookupReading,updateOutput,flushReaderSession,loadReaderSession,activateAccount,render};boot();');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label){for(let i=0;i<600;i++){if(fn())return;await wait(10);}throw Error('Timeout: '+label);}
const response=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
async function boot({seed={},mobile=false,url='https://nabu.invalid/read'}={}){
 const errors=[],requests=[];let ready=false,fetcher=null,voice=null;
 const vc=new VirtualConsole();vc.on('jsdomError',e=>{if(!e.message.includes('CSS'))errors.push(e.message);});vc.on('error',(...e)=>errors.push(e.map(String).join(' ')));
 const dom=new JSDOM(html,{url,runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
  installIDBFixture(w,seed);w.structuredClone=structuredClone;w.Response=Response;w.AbortController=AbortController;w.TextEncoder=TextEncoder;w.Blob=Blob;
  const interval=w.setInterval.bind(w);w.setInterval=(fn,ms,...a)=>{if(ms===15000)ready=true;return interval(fn,ms,...a);};
  w.matchMedia=()=>({matches:mobile,addEventListener(){},removeEventListener(){}});w.scrollTo=({top=0}={})=>{w.scrollY=top;};
  w.HTMLElement.prototype.scrollIntoView=function(){};
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
  w.HTMLMediaElement.prototype.pause=function(){this.__paused=true;this.dispatchEvent(new w.Event('pause'));};w.HTMLMediaElement.prototype.play=async function(){this.__paused=false;this.dispatchEvent(new w.Event('play'));};w.HTMLMediaElement.prototype.load=function(){};
  Object.defineProperty(w.HTMLMediaElement.prototype,'paused',{get(){return this.__paused!==false;}});
  w.URL.createObjectURL=()=> 'blob:nabu-fixture';w.URL.revokeObjectURL=()=>{};
  w.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};
  w.speechSynthesis={getVoices:()=>[{lang:'en-US',name:'Fixture voice',localService:true}],cancel(){voice?.onend?.();voice=null;},speak(v){voice=v;v.onstart?.();}};
  w.fetch=async(input,o={})=>{requests.push({url:String(input),...o});if(fetcher){const r=fetcher(input,o);if(r)return r;}
   if(String(input).endsWith('/api/config'))return response({service:'nabu',releaseVersion:'1.17.0',cleanRoutes:true,council:{enabled:false}});
   if(String(input).endsWith('/api/session'))return response({user:null,csrf:''});
   return response({detail:'No conversational AI provider is configured.'},503);
  };
 }});
 const w=dom.window,d=w.document,$=s=>d.querySelector(s);
 await until(()=>ready&&w.__test&&($('#reader-input')||$('#reader-text')||$('.content-card')),'boot');await wait(30);
 const h={dom,w,d,$,errors,requests,t:w.__test,
  click(s){const e=$(s);assert.ok(e,'control '+s);assert.ok(!e.disabled,'enabled '+s);e.click();},
  input(s,v){const e=$(s);assert.ok(e,'input '+s);e.value=v;e.dispatchEvent(new w.Event('input',{bubbles:true}));},
  submit(s){$(s).dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));},
  setFetch(fn){fetcher=fn;},snapshot(){return w.__idbFixture.snapshot();},
  async read(text='There is water on the table. I open a book.',lang='en',target='es'){
   h.t.state.translation.sourceLang=lang;h.t.state.translation.targetLang=target;h.t.render();h.input('#reader-input',text);h.click('[data-action=read-text]');await until(()=>$('#reader-text'),'reader');
  },
  async word(word){const el=[...d.querySelectorAll('.reader-token')].find(e=>e.textContent===word);assert.ok(el,'token '+word);el.click();await until(()=>!h.t.state.translation.busy,'lookup');await wait(25);},
  async mode(value){h.click('[data-mode='+value+']');await wait(25);},
  async save(){h.click('[data-action=save-support-word]');await until(()=>!h.t.state.translation.saving,'save');},
  close(){w.close();},assertClean(){assert.deepEqual(errors,[]);}
 };return h;
}
test('modes preserve source node, range, scroll, media identity, notes and saved state',async()=>{
 const h=await boot();try{
  await h.read();assert.equal(h.$('.support-modes'),null);await h.word('water');
  assert.equal(h.$('.word-definition').textContent,'agua');assert.equal(h.$('.word-source mark').textContent,'water');assert.equal(h.$('#support-depth').hidden,true);
  await h.save();const reader=h.$('#reader-text'),index=h.t.state.reader.selectedIndex;h.w.scrollY=312;
  await h.mode('depth');h.$('.council').open=true;h.input('#council-question','Why this reading?');const question=h.$('#council-question');
  const audio=h.d.createElement('audio');audio.id='fixture-source';audio.currentTime=17;reader.before(audio);
  await h.mode('glance');await h.mode('depth');assert.equal(h.$('#reader-text'),reader);assert.equal(h.t.state.reader.selectedIndex,index);assert.equal(h.w.scrollY,312);assert.equal(h.$('#council-question'),question);assert.equal(question.value,'Why this reading?');assert.equal(audio.currentTime,17);assert.ok(h.$('.word-save-status'));h.assertClean();
 }finally{h.close();}
});
test('saved correction, note, edited reading aid, mode and text survive a new app instance',async()=>{
 let h=await boot();let seed;try{
  await h.read();await h.word('water');await h.save();await h.mode('depth');h.click('[data-action=edit-card]');h.input('#card-back','agua para beber');h.input('#card-note','My contextual correction');h.submit('#card-form');await until(()=>!h.$('#modal').open&&h.$('.word-definition')?.textContent==='agua para beber','correction');
  h.click('[data-action=show-context]');h.input('#word-reading','WA-ter');h.submit('#word-context-form');await until(()=>h.snapshot().cards[0]?.reading==='WA-ter','reading');h.click('#modal [data-action=close-modal]');
  await h.t.flushReaderSession();seed=h.snapshot();assert.equal(h.$('.word-definition').textContent,'agua para beber');h.assertClean();
 }finally{h.close();}
 h=await boot({seed});try{await until(()=>h.$('.word-definition'),'resume');assert.equal(h.$('.word-definition').textContent,'agua para beber');assert.equal(h.$('#support-depth').hidden,false);assert.match(h.$('#support-depth').textContent,/My contextual correction/);assert.match(h.$('#support-depth').textContent,/WA-ter/);assert.ok(h.$('.word-save-status'));assert.equal(h.$('#reader-text').textContent,'There is water on the table. I open a book.');h.assertClean();}finally{h.close();}
});
test('mode changes during pending save cannot duplicate or cancel it; failed save can retry',async()=>{
 const h=await boot();try{
  await h.read();await h.word('water');let finish,calls=0;const commit=h.t.DB.commitTranslation;
  h.t.DB.commitTranslation=async(...a)=>{calls++;await new Promise(r=>finish=r);return commit(...a);};h.click('[data-action=save-support-word]');await h.mode('depth');await h.t.actions['save-support-word']();assert.equal(calls,1);finish();await until(()=>h.$('.word-save-status'),'saved');
  assert.equal(h.snapshot().cards.length,1);await h.word('book');h.t.DB.commitTranslation=async()=>{throw Error('Fixture disk full');};await h.save();assert.match(h.$('.word-save').textContent,/Fixture disk full/);h.t.DB.commitTranslation=commit;await h.save();assert.equal(h.snapshot().cards.length,2);h.assertClean();
 }finally{h.close();}
});
test('rapid selection ignores stale success and stale failure, then lookup retry recovers',async()=>{
 const h=await boot();try{
  await h.read('florplex zunavia water');h.t.state.settings.provider='public';h.t.state.settings.consent=true;const pending=[];
  h.setFetch((u,o)=>String(u).includes('mymemory')?new Promise((resolve,reject)=>pending.push({resolve,reject})):null);
  h.$('.reader-token').click();await until(()=>pending.length===1,'first request');h.d.querySelectorAll('.reader-token')[1].click();await until(()=>pending.length===2,'second request');
  pending[1].resolve(response({responseStatus:200,responseData:{translatedText:'newer answer'}}));await until(()=>h.$('.word-definition')?.textContent==='newer answer','new answer');pending[0].resolve(response({responseStatus:200,responseData:{translatedText:'obsolete answer'}}));await wait(80);assert.equal(h.$('.word-definition').textContent,'newer answer');
  h.$('.reader-token').click();await wait(30);await h.word('water');if(pending[2])pending[2].reject(Error('late failure'));await wait(30);assert.equal(h.$('.word-definition').textContent,'agua');
  h.setFetch((u)=>String(u).includes('mymemory')?Promise.reject(Error('Fixture network failed')):null);await h.word('zunavia'); // cached result may be used; force a new context
  h.t.state.translation.front='failuretoken';h.t.state.translation.context='new source';await h.t.actions.translate();assert.match(h.$('.support-error').textContent,/Fixture network failed/);
  h.setFetch((u)=>String(u).includes('mymemory')?response({responseStatus:200,responseData:{translatedText:'recovered'}}):null);await h.t.actions.translate();assert.equal(h.$('.word-definition').textContent,'recovered');h.assertClean();
 }finally{h.close();}
});
test('council request uses current pair languages, survives mode switches, reports dependency and ignores late replies',async()=>{
 const h=await boot();try{
  await h.read();await h.word('water');await h.mode('depth');h.$('.council').open=true;h.input('#council-question','Is it literal?');let finish;
  h.setFetch(u=>String(u).endsWith('/council')?new Promise(r=>finish=r):null);h.click('[data-action=ask-council]');await until(()=>finish,'council request');await h.mode('glance');await h.mode('depth');assert.equal(h.$('#council-question').value,'Is it literal?');finish(response({detail:'missing'},503));await until(()=>!h.t.state.translation.council.busy,'dependency');assert.match(h.$('.council-result').textContent,/no authorized conversational AI/);
  const body=JSON.parse(h.requests.find(r=>r.url.endsWith('/council')).body);assert.equal(body.sourceLang,'en');assert.equal(body.explanationLang,'es');assert.equal(body.question,'Is it literal?');
  h.click('[data-action=ask-council]');await wait(10);await h.word('book');finish(response({dialogue:'This must not appear'}));await wait(40);assert.equal(h.$('.word-definition').textContent,'libro');assert.doesNotMatch(h.$('#translation-output').textContent,/This must not appear/);h.assertClean();
 }finally{h.close();}
});
test('mobile sheet, hidden avatar and keyboard-activatable modes leave the same reader usable',async()=>{
 const h=await boot({mobile:true});try{
  await h.read();assert.equal(h.$('#word-sheet').open,false);await h.word('water');assert.equal(h.$('#word-sheet').open,true);const reader=h.$('#reader-text');await h.mode('depth');h.$('.scribe-presence').open=true;h.click('[data-action=hide-scribe]');await wait(25);assert.equal(h.$('.scribe-presence'),null);assert.ok(h.$('[data-mode=glance]'));assert.equal(h.$('[data-mode=depth]').tagName,'BUTTON');await h.save();h.click('[data-action=close-word-panel]');assert.equal(h.$('#word-sheet').open,false);assert.equal(h.$('#reader-text'),reader);await h.word('book');assert.equal(h.$('.scribe-presence'),null);h.assertClean();
 }finally{h.close();}
});
test('all twelve script/locale pairs select, explain, save and expose only their relevant council pair',async()=>{
 const samples=[['en','water'],['ar','ماء'],['zh-CN','水'],['fr','eau'],['ru','вода'],['es','agua'],['tr','su'],['de','Wasser'],['ko','물'],['ja','水'],['it','acqua'],['pt','água']];
 for(const [lang,word] of samples){const h=await boot();try{
  await h.read(word+'。',lang,lang==='en'?'es':'en');await h.word(word);assert.ok(h.$('.word-definition'),lang);assert.equal(h.$('#reader-text').lang,lang);assert.equal(h.$('#reader-text').dir,lang==='ar'?'rtl':'ltr');await h.save();await h.mode('depth');assert.equal(h.$('.council-pair').children.length,2);assert.equal(h.snapshot().cards[0].sourceLang,lang);h.assertClean();
 }finally{h.close();}}
});
test('local media position and identity survive mode changes; pronunciation stops source audio and has recoverable errors',async()=>{
 const h=await boot();try{
  await h.read();const file=new h.w.File(['audio-fixture'],'source.wav',{type:'audio/wav',lastModified:123});Object.defineProperty(h.$('#reader-media-file'),'files',{value:[file],configurable:true});h.$('#reader-media-file').dispatchEvent(new h.w.Event('change',{bubbles:true}));const media=h.$('#source-media');assert.ok(media);media.currentTime=23;media.dispatchEvent(new h.w.Event('timeupdate'));await media.play();await h.word('water');await h.mode('depth');assert.equal(h.$('#source-media'),media);assert.equal(media.currentTime,23);
  h.click('[data-action=support-listen]');await until(()=>h.$('[data-voice-status]')?.textContent.includes('Playing'),'device events');assert.equal(media.paused,true);await h.mode('glance');assert.match(h.$('[data-voice-status]').textContent,/Playing/);h.w.speechSynthesis.speak=v=>v.onerror({error:'audio-busy'});h.$('[data-voice-replay]').click();await until(()=>h.$('[data-voice-status]').textContent.includes('could not play'),'audio failure');assert.ok(h.$('[data-voice-replay]'));await h.t.flushReaderSession();assert.equal(h.snapshot().meta.find(x=>x.id==='nabu.reader.v1:guest').value.reader.media.time,23);h.assertClean();
 }finally{h.close();}
});
test('phrase selection and repeated-word source highlighting retain the actual occurrence',async()=>{
 const h=await boot();try{
  await h.read('water and water');const tokens=h.d.querySelectorAll('.reader-token');tokens[2].click();await wait(30);assert.equal(h.$('.word-source blockquote').innerHTML,'water and <mark>water</mark>');
  const range=h.d.createRange();range.setStart(tokens[0].firstChild,0);range.setEnd(tokens[2].firstChild,5);h.w.getSelection().removeAllRanges();h.w.getSelection().addRange(range);h.d.dispatchEvent(new h.w.Event('selectionchange'));h.click('[data-action=reader-selection]');await wait(30);assert.equal(h.$('#support-word').textContent,'water and water');assert.equal(h.$('#reader-text').textContent,'water and water');assert.equal(h.d.querySelectorAll('.reader-token.selected').length,3);h.assertClean();
 }finally{h.close();}
});

test('shipping bundle opens optional workspace controls and submits through existing account guards',async()=>{
 const h=await boot();try{
  await h.read();const reader=h.$('#reader-text');h.t.state.user={id:'workspace-user',handle:'workspaceuser'};h.t.state.csrf='fixture-csrf';let created=false;
  h.setFetch((u,o)=>{
   if(String(u).endsWith('/api/workspaces'))return response({workspaces:created?[{id:'university',label:'University',role:'owner',policy:{revision:1,offlineResponses:false}}]:[]});
   if(String(u).endsWith('/api/decision-tenants')){created=true;return response({id:'university',role:'owner'});}
   if(String(u).endsWith('/api/workspaces/university/assignments'))return response({assignments:[]});return null;
  });
  await h.t.actions.workspaces();assert.ok(h.$('#nabu-workspaces'));assert.equal(h.$('#reader-text'),reader);
  h.$('[name=label]').value='University';h.$('[name=id]').value='university';h.submit('[data-ws-form=create-workspace]');
  await until(()=>h.$('[data-ws-action=assign]'),'workspace creation');assert.match(h.$('#nabu-workspaces').textContent,/No assignments/);
  const sent=h.requests.find(x=>x.url.endsWith('/api/decision-tenants'));assert.equal(sent.headers['X-Nabu-Account'],'workspace-user');assert.equal(sent.headers['X-CSRF-Token'],'fixture-csrf');
  h.$('[data-ws-action=close]').click();assert.equal(h.$('#reader-text'),reader);assert.equal(h.$('#modal').open,false);h.assertClean();
 }finally{h.close();}
});
