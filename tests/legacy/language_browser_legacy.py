"""Language UI harness: provider requests, URL navigation, and storage are explicit fixtures.
Uses the REAL frontend JS/CSS with an explicitly IN-MEMORY storage adapter.
This is NOT an IndexedDB, service-worker, cookie, or production deployment test.
The separate browser_smoke.py tests those features in an unrestricted local browser.
"""
from __future__ import annotations
import json,re,uuid,sys
import httpx
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'language-test-results';OUT.mkdir(exist_ok=True)
checks=[];errors=[]

def check(name,value=True):
    assert value,name
    checks.append(name)
    print('PASS:',name,flush=True)

def harness_script():
    core=(ROOT/'public/nabu-core.js').read_text()
    names=re.findall(r'export (?:async )?(?:function|const) (\w+)',core)
    core=core.replace('export ','')
    speech=(ROOT/'public/nabu-speech.js').read_text().replace('export ','')
    app=(ROOT/'public/nabu-app.js').read_text()
    app=re.sub(r"^import .*;\n",'',app,flags=re.M)
    bridge=r'''
    const C=(()=>{__CORE__;return {__NAMES__};})();
    const memory={cards:[],logs:[],history:[],cache:new Map(),meta:new Map()};
    memory.meta.set('settings',{provider:'workspace'});
    const clone=v=>structuredClone(v);
    const DB={
      openStore:async()=>{},snapshot:async()=>clone({cards:memory.cards,logs:memory.logs,history:memory.history}),
      getMeta:async(k,d)=>memory.meta.get(k)??d,setMeta:async(k,v)=>{memory.meta.set(k,clone(v));},
      addCards:async inputs=>{const clean=inputs.map(x=>C.newCard(x));let added=0,duplicates=0;const cards=[];for(const c of clean){const old=memory.cards.find(x=>C.identity(x)===C.identity(c));if(old){duplicates++;cards.push(clone(old));}else{memory.cards.push(c);cards.push(clone(c));added++;}}return {added,duplicates,cards};},
      editCard:async(id,content,revision)=>{const i=memory.cards.findIndex(c=>c.id===id),old=memory.cards[i];if(old.revision!==revision)throw new Error('Card changed.');const clean=C.cardContent(content);memory.cards[i]={...old,...clean,revision:old.revision+1,updatedAt:Date.now()};},
      archiveCard:async(id,archived)=>{const c=memory.cards.find(c=>c.id===id);c.archived=archived;c.revision++;},
      gradeCard:async(id,rating,revision,durationMs)=>{const c=memory.cards.find(c=>c.id===id);if(c.revision!==revision)throw new Error('Card changed.');const log={id:C.uid(),cardId:id,at:Date.now(),rating,before:clone(c),afterRevision:revision+1,durationMs};c.schedule=C.scheduleReview(c.schedule,rating);c.revision++;memory.logs.push(log);return {card:clone(c),log};},
      undoReview:async id=>{const log=memory.logs.find(l=>l.id===id),i=memory.cards.findIndex(c=>c.id===log.cardId),rev=memory.cards[i].revision;if(rev!==log.afterRevision)throw new Error('Card changed.');memory.cards[i]={...clone(log.before),revision:rev+1};memory.logs=memory.logs.filter(l=>l.id!==id);},
      rememberTranslation:async c=>{memory.history=[{...clone(c),id:C.uid(),at:Date.now()},...memory.history].slice(0,50);},
      cacheGet:async k=>memory.cache.get(k),cachePut:async(k,v)=>{memory.cache.set(k,v);},
      clearTranslationHistory:async()=>{memory.history=[];memory.cache.clear();},
      mergeImport:async data=>{let added=0,duplicates=0;for(const c of data.cards){if(memory.cards.some(x=>C.identity(x)===C.identity(c)||x.id===c.id)){duplicates++;}else{memory.cards.push(clone(c));added++;}}return {added,duplicates};},
      clearAll:async()=>{memory.cards=[];memory.logs=[];memory.history=[];memory.meta.clear();memory.cache.clear();}
    };
    let href='https://nabu-preview.invalid/';
    const location={get href(){return href},get hash(){return new URL(href).hash},get pathname(){return new URL(href).pathname},get search(){return new URL(href).search},protocol:'https:',origin:'https://nabu-preview.invalid'};
    const history={state:null,pushState:(s,t,u)=>{history.state=s;href=String(u)},replaceState:(s,t,u)=>{history.state=s;href=new URL(String(u),href).href}};
    const nativeFetch=window.fetch;
    const fetch=async(url,options={})=>{
      window.__requests.push({url:String(url),body:options.body||'',method:options.method||'GET'});
      if(String(url).includes('api.mymemory')){
        if(window.__translationDelay)await new Promise(r=>setTimeout(r,window.__translationDelay));
        if(window.__translationFailure)return new Response(JSON.stringify({responseStatus:403,quotaFinished:true}),{status:200,headers:{'Content-Type':'application/json'}});
        return new Response(JSON.stringify({responseStatus:200,responseData:{translatedText:'hello &amp; welcome'}}),{status:200,headers:{'Content-Type':'application/json'}});
      }
      const path=new URL(String(url)).pathname;
      const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
      if(path==='/api/config')return json({service:'nabu',translationEnabled:true,translationEnglish:'EN-US',translationPortuguese:'PT-BR',speechEnabled:true,speechModel:'eleven_v4',speechLanguages:['en','fr','es','ar','zh-CN','ru'],speechMatchedLanguages:['fr']});
      if(path==='/api/session')return json({user:{handle:'alice'},csrf:'test-csrf'});
      if(path==='/api/translate'){if(window.__translateFailure)return json({detail:'DeepL quota reached. No other provider was used.'},429);const body=JSON.parse(options.body);return json({translation:body.context==='money'?'bank (financial)':'hello',provider:'DeepL'});}
      if(path==='/api/speech'){
        if(window.__audioDelay)await new Promise(r=>setTimeout(r,window.__audioDelay));
        if(window.__speechFailure)return json({detail:'ElevenLabs quota reached. No other provider was used.'},429);
        const audio=Uint8Array.from(atob(window.__testAudio),c=>c.charCodeAt(0));
        return new Response(audio,{status:200,headers:{'Content-Type':'audio/mpeg'}});
      }
      if(path==='/api/logout')return json({ok:true});
      if(path==='/api/login')return json({user:{handle:'alice'},csrf:'test-csrf'});
      if(path==='/api/exchanges')return json({inbox:[],sent:[]});
      return new Response('{}',{status:404,headers:{'Content-Type':'application/json'}});
    };
    window.__requests=[];window.__memory=memory;
    window.__C=C;
    window.__loadShare=async token=>{href='https://nabu-preview.invalid/#share='+token;await handleShare();};
    window.__snapshot=()=>clone({cards:memory.cards,logs:memory.logs,history:memory.history});
    const S=(()=>{__SPEECH__;return {createSpeaker,speechKey};})();
    __APP__
    '''
    return '(async()=>{'+bridge.replace('__CORE__',core).replace('__NAMES__',','.join(names)).replace('__SPEECH__',speech).replace('__APP__',app)+'})()'

def load(page,width=1440,height=1050):
    page.set_viewport_size({'width':width,'height':height})
    html=(ROOT/'public/index.html').read_text()
    html=re.sub(r'<meta http-equiv="Content-Security-Policy"[^>]*>','',html)
    html=re.sub(r'<link[^>]*>','',html)
    html=re.sub(r'<script[^>]*>.*?</script>','',html,flags=re.S)
    html=html.replace('</head>','<style>'+(ROOT/'public/nabu.css').read_text()+'</style></head>')
    page.set_content(html)
    # getRandomValues is available on about:blank; randomUUID is not always exposed.
    page.evaluate("if(!crypto.randomUUID)crypto.randomUUID=()=> '10000000-1000-4000-8000-100000000000'.replace(/[018]/g,c=>(+c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> +c / 4).toString(16));")
    import base64
    page.evaluate('(value)=>window.__testAudio=value',base64.b64encode((ROOT/'tests/fixtures/playback-tone.mp3').read_bytes()).decode())
    page.evaluate(harness_script())
    expect(page.locator('#translation-input')).to_be_visible()

def nav(page,name):page.locator(f'#navigation [data-view="{name}"]').click()


def count(page,ending):
    return len([r for r in page.evaluate('window.__requests') if r['url'].endswith(ending)])

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    page=browser.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
    load(page)
    expect(page.locator('#language-services')).to_contain_text('ElevenLabs configured')
    check('Service configuration is visible without generating paid content',count(page,'/api/translate')==0 and count(page,'/api/speech')==0)
    page.locator('#source-language').select_option('fr')
    page.locator('#translation-input').fill('bonjour')
    page.locator('.translation-options summary').click()
    page.locator('#translation-context').fill('Bonjour, mon ami.')
    page.locator('#translation-formality').select_option('prefer_more')
    page.locator('[data-action="translate"]').click()
    expect(page.locator('.translation-result')).to_have_text('hello')
    requests=page.evaluate('window.__requests');payload=json.loads([r for r in requests if r['url'].endswith('/api/translate')][-1]['body'])
    check('DeepL gets selected text, context and tone; no private note',payload=={'text':'bonjour','sourceLang':'fr','targetLang':'en','context':'Bonjour, mon ami.','formality':'prefer_more'})
    page.locator('[data-action="translate"]').click()
    expect(page.locator('#provider-note')).to_contain_text('Saved DeepL')
    check('Repeat translations use the local provider-specific cache',count(page,'/api/translate')==1)
    page.locator('#translation-context').fill('money')
    page.locator('[data-action="translate"]').click()
    expect(page.locator('.translation-result')).to_have_text('bank (financial)')
    check('Changing context invalidates translation reuse',count(page,'/api/translate')==2)
    page.locator('#translation-context').fill('Bonjour, mon ami.')
    page.locator('[data-action="translate"]').click()
    expect(page.locator('.translation-result')).to_have_text('hello')
    page.locator('[data-action="speak-source"]').click()
    expect(page.locator('#modal')).to_be_visible()
    check('Speech requires explicit consent before sending any text',count(page,'/api/speech')==0)
    page.locator('[data-action="allow-speech"]').click()
    expect(page.locator('#speech-player')).to_be_visible()
    page.wait_for_function('document.querySelector("#speech-player audio").readyState >= 2')
    check('Actual audio element decodes the fixture MP3 (test tone, not a provider voice)')
    request=[r for r in page.evaluate('window.__requests') if r['url'].endswith('/api/speech')][-1]
    check('Speech sends only the requested text and language',json.loads(request['body'])=={'text':'bonjour','language':'fr'})
    check('The generated-voice label is visible',page.locator('.speech-provider').inner_text()=='ELEVENLABS / AI-GENERATED VOICE')
    page.locator('.speech-rate select').select_option('0.85')
    check('Slower playback reuses the recording without another provider call',count(page,'/api/speech')==1 and page.locator('#speech-player audio').evaluate('(a)=>a.playbackRate')==.85)
    page.locator('[data-action="speak-source"]').click()
    page.wait_for_timeout(150)
    check('Repeated pronunciation uses the tab cache',count(page,'/api/speech')==1)
    check('Selected slower playback persists on replay',page.locator('#speech-player audio').evaluate('(a)=>a.playbackRate')==.85)
    page.locator('[data-action="save-translation"]').click()
    expect(page.locator('[data-action="save-translation"]')).to_be_disabled()
    page.screenshot(path=str(OUT/'translate-and-pronunciation-desktop.png'),full_page=True)
    nav(page,'library')
    page.locator('[data-action="speak-card"]').click()
    expect(page.locator('.speech-word')).to_have_text('bonjour')
    check('Saved-card pronunciation shares the same audio cache',count(page,'/api/speech')==1)
    nav(page,'review');page.locator('[data-action="speak-review"]').click()
    check('Review-card pronunciation is connected',count(page,'/api/speech')==1)
    page.locator('[data-action="reveal"]').click()
    check('Speech does not alter the review schedule',page.evaluate('window.__snapshot().cards[0].schedule.reps')==0)
    nav(page,'translate');page.evaluate('window.__speechFailure=true')
    page.locator('[data-action="speak-target"]').click()
    expect(page.locator('.speech-status')).to_contain_text('quota reached')
    check('Cloud-speech failure is visible, with no silent provider replacement')
    check('Cloud failure retains the saved card',len(page.evaluate('window.__snapshot().cards'))==1)
    page.evaluate('window.__speechFailure=false;window.__audioDelay=200')
    page.locator('[data-action="speak-target"]').click()
    page.locator('[data-action="speak-target"]').click()
    page.wait_for_timeout(400)
    check('Rapid repeated taps share one in-flight generation',count(page,'/api/speech')==3)
    page.locator('#settings-nav').click()
    expect(page.locator('#setting-speech')).to_be_visible()
    page.locator('#setting-speech-rate').select_option('0.85')
    page.locator('#settings-form [type="submit"]').click()
    expect(page.locator('#toast')).to_contain_text('Preferences saved')
    check('Speech preferences persist in the explicit storage fixture',page.evaluate('window.__memory.meta.get("settings").speechRate')==.85)
    check('Changing speech preferences clears the current playback',page.locator('#speech-player').is_hidden())
    page.screenshot(path=str(OUT/'language-settings-desktop.png'),full_page=True)
    nav(page,'translate')
    check('Speech settings do not overwrite current translation languages',page.locator('#source-language').input_value()=='fr')
    page.set_viewport_size({'width':390,'height':844})
    page.locator('[data-action="speak-source"]').click()
    page.wait_for_timeout(400)
    check('Mobile speech player remains inside the viewport',page.locator('#speech-player').bounding_box()['x']>=0 and page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
    page.screenshot(path=str(OUT/'translate-and-pronunciation-mobile.png'),full_page=True)
    nav(page,'exchange');page.locator('[data-action="logout"]').click()
    expect(page.locator('#speech-player')).not_to_be_visible()
    check('Sign-out clears playback and keeps local cards',len(page.evaluate('window.__snapshot().cards'))==1)
    check('No uncaught frontend errors',not errors)
    browser.close()
(OUT/'language-ui-results.json').write_text(json.dumps({'checks':checks,'count':len(checks),'scope':'Real renderer/core/player with fixture storage, URL and provider responses. MP3 is a local tone, not generated speech. Not a native cookie, deployed-browser or listening-quality test.'},indent=2))
print('TOTAL',len(checks))
