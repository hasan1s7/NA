"""Real Chromium rendering and shipped app/store/graph code.
Browser navigation is prohibited in this environment. URL/history, IndexedDB's
request boundary and cloud responses are explicit fixtures. No native database
persistence, live provider or service-worker claim is made by these checks.
"""
from pathlib import Path
import re,json,base64,hashlib
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'wordgraph-test-results';OUT.mkdir(exist_ok=True)
results=[];errors=[]
def check(name,value=True):
 assert value,name
 results.append(name);print('PASS',name,flush=True)
def sig(v):return 'sha256-'+base64.b64encode(hashlib.sha256(v.encode()).digest()).decode()
BRIDGE=r'''
let previewURL='https://nabu-test.invalid/nabu/';
const location={get href(){return previewURL},get hash(){return new URL(previewURL).hash},get pathname(){return new URL(previewURL).pathname},get search(){return new URL(previewURL).search},protocol:'https:',origin:'https://nabu-test.invalid'};
const history={state:null,pushState(s,t,url){this.state=s;previewURL=String(url)},replaceState(s,t,url){this.state=s;previewURL=new URL(String(url),previewURL).href}};
window.__loadShare=async token=>{previewURL='https://nabu-test.invalid/nabu/#share='+token;await handleShare();};
window.__requests=[];window.__backendEnabled=false;window.__signedIn=true;
const fetch=async(url,options={})=>{
 const path=new URL(String(url),previewURL).pathname;
 window.__requests.push({url:String(url),path,method:options.method||'GET',body:options.body||''});
 const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
 if(path.endsWith('/api/config'))return window.__backendEnabled?json({service:'nabu',translationEnabled:true,translationEnglish:'EN-US',translationPortuguese:'PT-BR',speechEnabled:true,speechLanguages:['en','fr','es','ar','ja','zh-CN'],speechMatchedLanguages:['en']}):json({},404);
 if(path.endsWith('/api/session'))return json({user:window.__signedIn?{handle:'test_user'}:null,csrf:'fixture-csrf'});
 if(path.endsWith('/api/translate')){
  if(window.__translationDelay)await new Promise((resolve,reject)=>{
   const timer=setTimeout(resolve,window.__translationDelay);
   options.signal?.addEventListener('abort',()=>{clearTimeout(timer);reject(new DOMException('Cancelled','AbortError'));},{once:true});
  });
  if(window.__translationFailure)return json({detail:'DeepL quota reached.'},429);
  const body=JSON.parse(options.body);return json({translation:body.context?'contextual result':'cloud phrase result',provider:'DeepL'});
 }
 if(path.endsWith('/api/speech')){
  const bytes=Uint8Array.from(atob(window.__testAudio),x=>x.charCodeAt(0));
  return new Response(bytes,{status:200,headers:{'Content-Type':'audio/mpeg'}});
 }
 if(path.endsWith('/api/exchanges'))return json({inbox:[],sent:[]});
 if(path.endsWith('/api/login')){window.__signedIn=true;return json({user:{handle:'test_user'},csrf:'fixture-csrf'});}
 if(path.endsWith('/api/logout'))return json({ok:true});
 return json({},404);
};
'''
def load(page):
 html=(ROOT/'public/index.html').read_text()
 runtime=re.search(r'<script id="nabu-application">(.*?)</script>',html,re.S).group(1)
 patched=runtime.replace('"use strict";','"use strict";'+BRIDGE,1).replace('boot();','window.__app={state,C,G,DB,translate,useGraph,checkBackend,keepTranslation};boot();')
 html=html.replace(runtime,patched).replace(sig(runtime),sig(patched))
 fixture=(ROOT/'tests/idb-fixture.js').read_text().replace('export function','function')+'\ninstallIDBFixture(window);'
 page.evaluate(fixture)
 page.evaluate('(b)=>window.__testAudio=b',base64.b64encode((ROOT/'tests/fixtures/playback-tone.mp3').read_bytes()).decode())
 page.set_content(html)
 expect(page.locator('#translation-input')).to_be_visible()
 page.wait_for_timeout(80)
def nav(page,name):
 page.locator('#navigation [data-view="'+name+'"]').click()
def snapshot(page):return page.evaluate('window.__app.DB.snapshot()')
def n(page):return len(snapshot(page)['cards'])
def settle(page):page.wait_for_function('() => !window.__app.state.translation.saving && !window.__app.state.translation.busy')
def word(page,text):
 page.locator('#translation-input').fill(text);page.locator('#translation-input').press('Enter');settle(page)
def use(page,id,src='en',dst='es'):
 page.evaluate('([id,a,b])=>__app.useGraph(id,a,b)',[id,src,dst]);settle(page)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=b.new_page(viewport={'width':1440,'height':1080})
 page.on('pageerror',lambda e:errors.append(str(e)))
 load(page)
 check('Clean boot with no backend, signup, demo data or startup modal',n(page)==0 and not page.locator('#modal').is_visible())
 check('Five functional navigation destinations are present',page.locator('#navigation button').count()==5)
 page.locator('#translation-input').fill('wat')
 check('Typing shows real vocabulary suggestions but does not save partial words',n(page)==0 and page.locator('#word-suggestions [data-id="food.water"]').count()==1)
 word(page,'water');expect(page.locator('.translation-result')).to_have_text('agua')
 check('Enter translates and atomically auto-saves without a second click',n(page)==1 and len(snapshot(page)['history'])==1)
 check('There is no separate Save word button',page.locator('[data-action="save-translation"]').count()==0)
 expect(page.locator('#translation-output .save-status')).to_contain_text('Saved')
 check('All twelve language forms appear with a disabled source',page.locator('.language-link').count()==12 and page.locator('.language-link:disabled').count()==1)
 word(page,'WATER!');check('Case and punctuation do not create duplicate cards',n(page)==1)
 page.locator('[data-action="graph-target"][data-language="ar"]').click();settle(page)
 check('Clicking Arabic instantly creates the selected direction',n(page)==2 and page.locator('#target-language').input_value()=='ar')
 page.locator('[data-action="swap"]').click();settle(page)
 check('Swap translates and saves the reverse direction',n(page)==3 and page.locator('#source-language').input_value()=='ar' and page.locator('.translation-result').inner_text()=='water')
 page.locator('[data-action="graph-target"][data-language="ja"]').click();settle(page)
 check('Arabic to Japanese works without English input or a provider request',n(page)==4 and page.locator('.translation-result').inner_text()=='\u6c34')
 check('Built-in translation makes zero translation-provider requests',page.evaluate('__requests.filter(r=>r.path.endsWith("/api/translate")||r.url.includes("mymemory")).length')==0)
 nav(page,'review');page.locator('[data-action="reveal"]').click();page.locator('[data-action="grade"][data-rating="4"]').click()
 page.wait_for_function('() => window.__app.state.logs.length===1')
 reviewed=snapshot(page)['logs'][0]['cardId'];before=next(c for c in snapshot(page)['cards'] if c['id']==reviewed)
 check('Auto-saved words enter the existing review scheduler',before['schedule']['reps']==1)
 nav(page,'translate');use(page,'food.water')
 after=next(c for c in snapshot(page)['cards'] if c['id']==reviewed)
 check('Repeated translation preserves the completed review',after['schedule']==before['schedule'])
 count=n(page);word(page,'light')
 check('Ambiguous meaning requires a choice, with no premature saved card',n(page)==count and page.locator('[data-action="choose-sense"]').count()==2)
 page.locator('[data-action="choose-sense"][data-id="home.light"]').click();settle(page)
 check('Selected illumination sense is translated and saved',page.locator('.translation-result').inner_text()=='luz' and n(page)==count+1)
 count=n(page);word(page,'unlisted phrase 8492')
 check('Unknown text is not fabricated or saved',n(page)==count and 'Not in the offline vocabulary' in page.locator('#translation-output').inner_text())
 check('Unknown text offers adding a translation rather than a blocking consent error',page.locator('#translation-output [data-action="add-manual"]').count()==1)
 nav(page,'graph');check('Vocabulary browser exposes all 300 meanings',page.locator('.graph-row').count()==300)
 check('A stale selected graph card is cleared after unrelated input',page.locator('.graph-selected').count()==0)
 page.locator('#graph-category').select_option('health');check('Topic filter shows exactly fifteen meanings',page.locator('.graph-row').count()==15)
 page.locator('#graph-search').fill('fever');check('Search narrows the actual multilingual graph',page.locator('.graph-row').count()==1)
 page.locator('.graph-row').click();settle(page)
 check('Selecting a graph row translates and saves it',snapshot(page)['cards'][-1]['conceptId']=='health.fever')
 page.locator('[data-action="graph-target"][data-language="fr"]').click();settle(page)
 check('Graph target switches use the same concept',page.locator('#target-language').input_value()=='fr' and page.locator('.graph-selected-target').inner_text()=='fi\u00e8vre')
 page.screenshot(path=str(OUT/'02-word-graph-desktop.png'),full_page=True)
 nav(page,'translate');use(page,'food.water')
 page.locator('[data-action="edit-translation"]').click();expect(page.locator('#modal-title')).to_have_text('Edit word')
 page.locator('#card-back').fill('agua (my wording)');page.locator('#card-note').fill('PRIVATE TEST NOTE');page.locator('#card-submit').click()
 expect(page.locator('#modal')).not_to_be_visible();count=n(page)
 use(page,'food.water');c=next(c for c in snapshot(page)['cards'] if c['conceptId']=='food.water' and c['sourceLang']=='en' and c['targetLang']=='es')
 check('Editing an auto-saved card updates in place and later lookups preserve it',n(page)==count and c['back']=='agua (my wording)' and c['note']=='PRIVATE TEST NOTE')
 page.locator('#translation-output [data-action="share-card"]').click();url=page.locator('#share-url').input_value()
 decoded=page.evaluate('(u)=>__app.C.decodeShare(u.split("#share=")[1])',url)
 check('Word sharing still works and does not leak private notes or review history',decoded['card']['note']=='' and 'schedule' not in decoded['card'])
 page.locator('[data-action="close-modal"]').first.click()
 nav(page,'library');page.locator('[data-action="archive-card"][data-id="'+c['id']+'"]').click();page.wait_for_timeout(100)
 nav(page,'translate');use(page,'food.water')
 check('Looking up an archived word restores the same card',n(page)==count and not next(x for x in snapshot(page)['cards'] if x['id']==c['id'])['archived'])
 page.evaluate('__idbFixture.failNextWrite()');count=n(page);use(page,'food.milk')
 check('Failed auto-save stays visible and never displays a false saved state',n(page)==count and page.locator('.save-error').count()==1 and page.locator('#translation-output .save-status').inner_text()=='Not saved')
 page.locator('[data-action="retry-save"]').click();settle(page)
 check('Retry save persists the result once',n(page)==count+1 and page.locator('.save-error').count()==0)
 page.evaluate('window.__backendEnabled=true');page.evaluate('__app.checkBackend()')
 word(page,'a phrase not in this graph');expect(page.locator('.translation-result')).to_have_text('cloud phrase result')
 check('Cloud translations are auto-saved through the same path',any(c['front']=='a phrase not in this graph' for c in snapshot(page)['cards']))
 cloud_calls=page.evaluate('__requests.filter(r=>r.path.endsWith("/api/translate")).length');count=n(page)
 word(page,'a phrase not in this graph')
 check('Cloud cache avoids a duplicate provider call and card',n(page)==count and page.evaluate('__requests.filter(r=>r.path.endsWith("/api/translate")).length')==cloud_calls)
 page.locator('.translation-options summary').click();page.locator('#translation-context').fill('river bank');word(page,'bank')
 check('Explicit sentence context bypasses an unrelated built-in sense',page.locator('.translation-result').inner_text()=='contextual result')
 page.locator('#translation-context').fill('');page.evaluate('window.__translationDelay=300')
 page.locator('#translation-input').fill('slow response never saved');page.locator('#translation-input').press('Enter')
 page.wait_for_timeout(40);page.locator('.starter-words [data-id="food.water"]').click();settle(page);page.wait_for_timeout(350)
 check('A stale cloud response cannot replace or save over the next word',page.locator('.translation-result').inner_text()=='agua' and not any(c['front']=='slow response never saved' for c in snapshot(page)['cards']))
 page.evaluate('window.__translationDelay=0;window.__translationFailure=true');count=n(page);word(page,'failing cloud request')
 check('Cloud errors do not create library cards',n(page)==count and 'quota reached' in page.locator('#translation-output').inner_text())
 page.evaluate('window.__translationFailure=false');use(page,'food.water')
 page.locator('[data-action="speak-target"]').click();expect(page.locator('#modal')).to_be_visible()
 check('Cloud voice retains one-time consent; graph lookup never auto-generates audio',page.evaluate('__requests.filter(r=>r.path.endsWith("/api/speech")).length')==0)
 page.locator('[data-action="allow-speech"]').click();page.wait_for_function('() => document.querySelector("#speech-player audio")?.readyState>=2')
 check('Existing audio player decodes the test tone fixture (not a voice-quality test)')
 page.locator('#speech-player [data-speech-close]').click()
 check('Last selected language pair persists in settings',page.evaluate('__app.DB.getMeta("settings")')['targetLang']=='es')
 page.screenshot(path=str(OUT/'01-translate-desktop.png'),full_page=True)
 page.set_viewport_size({'width':390,'height':844});page.screenshot(path=str(OUT/'03-translate-mobile.png'),full_page=True)
 check('Translator and all-language links fit a 390px screen',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
 nav(page,'graph');page.locator('#graph-search').fill('');page.locator('#graph-category').select_option('');page.locator('[data-action="graph-word"][data-id="food.water"]').first.click();settle(page)
 page.screenshot(path=str(OUT/'04-word-graph-mobile.png'),full_page=True)
 check('Vocabulary graph is usable on mobile without horizontal scrolling',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
 nav(page,'library');page.screenshot(path=str(OUT/'05-library-mobile.png'),full_page=True)
 check('Mobile library has no horizontal overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
 page.locator('#avatar').click();expect(page.locator('#settings-form')).to_be_visible();page.locator('[data-action="reset-data"]').click()
 check('Destructive reset still requires explicit typed confirmation',page.locator('#reset-confirm').count()==1 and n(page)>0)
 page.locator('[data-action="close-modal"]').first.click()
 check('No uncaught application errors during the full UI flow',not errors)
 b.close()
(OUT/'results.json').write_text(json.dumps({'count':len(results),'checks':results,'uncaughtErrors':errors,'scope':__doc__},indent=2))
