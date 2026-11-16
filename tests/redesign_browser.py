"""UI acceptance of the real shipping bundle.
Explicit fixtures: navigation/history, IndexedDB requests, fetch->real FastAPI/SQLite,
voice events and injected delayed/failing storage. No live OS/audio/provider claims.
"""
from pathlib import Path
import sys,json,tempfile,re,traceback
from fastapi.testclient import TestClient
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT));sys.path.insert(0,str(ROOT/'tests'))
import next_browser as H
from server import create_app
OUT=ROOT/'verification/redesign';OUT.mkdir(parents=True,exist_ok=True)
checks=[];errors=[];captures=[];console_errors=[];request_failures=[]
def check(name,ok=True):
 assert ok,name
 checks.append(name);print('PASS',name,flush=True)
def snap(page,name):
 page.evaluate('document.querySelector("#toast").hidden=true')
 page.screenshot(path=str(OUT/name),full_page=False);captures.append(name)
def text(page,value,title='A quiet moment'):
 if page.locator('[data-action="edit-reader"]').count():page.locator('[data-action="edit-reader"]').click()
 page.locator('#reader-title').fill(title);page.locator('#reader-input').fill(value);page.locator('[data-action="read-text"]').click()
def choose(page,value):
 page.locator('.reader-token').filter(has_text=re.compile('^'+re.escape(value)+'$')).first.click();H.settle(page)
def saved(page):
 page.locator('[data-action="save-support-word"]').click();H.settle(page)
VOICE=r'''
window.__voiceCalls=[];window.__voices=[];window.__lastVoice=null;
window.SpeechSynthesisUtterance=class{constructor(t){this.text=t;}};
Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{
 getVoices:()=>__voices, cancel(){if(__lastVoice)__lastVoice.onend?.();__lastVoice=null;},
 speak(u){__voiceCalls.push(u.text);__lastVoice=u;u.onstart?.();}}});
'''
def main():
 with tempfile.TemporaryDirectory() as tmp:
  app=create_app(Path(tmp)/'ui.sqlite3','http://testserver',invite='',translation_key='')
  with TestClient(app,headers={'Origin':'http://testserver'}) as client,sync_playwright() as pw:
   browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
   def load(width=1440,height=1000):
    page=browser.new_page(viewport={'width':width,'height':height});page.set_default_timeout(8000)
    page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:console_errors.append(m.text) if m.type=='error' else None);page.on('requestfailed',lambda r:request_failures.append({'url':r.url,'failure':r.failure}))
    def request(source,req):
     r=client.request(req['method'],req['path'],headers={**req['headers'],'Origin':'http://testserver'},content=req.get('body'))
     try:data=r.json()
     except:data={'detail':r.text[:200]}
     return {'status':r.status_code,'data':data}
    page.expose_binding('__apiCall',request);page.evaluate(H.fixture);page.evaluate(VOICE);page.set_content(H.html)
    expect(page.locator('#translation-input')).to_be_visible();page.wait_for_function('()=>__app.state.backend?.offlineSync===true')
    return page
   page=load();H.nav(page,'reader')
   page.locator('[data-action="read-text"]').click();expect(page.locator('#reader-input-error')).to_contain_text('Paste')
   check('Empty reader explains the required input rather than doing nothing')
   snap(page,'read-empty-desktop.png')
   passage='I open the book by the window. There is water on the table, and the house is quiet.\n\nToday I want to read slowly. I do not need to know every word to enjoy this moment.\n\nA new word does not have to interrupt a good story.'
   text(page,passage,'The pleasure of slowing down')
   check('Reading replaces the editor and preserves exact source text',page.locator('#reader-input').count()==0 and page.locator('#reader-text').inner_text()==passage)
   page.evaluate('window.__originalReader=document.querySelector("#reader-text")')
   choose(page,'water')
   expect(page.locator('.word-definition')).to_have_text('agua')
   check('Dictionary meaning uses existing bank with truthful context qualification','Dictionary meaning' in page.locator('#translation-output').inner_text())
   check('Original sentence is exact, highlighted, and not an invented example',page.locator('.word-source blockquote').inner_text()=='There is water on the table, and the house is quiet.' and page.locator('.word-source mark').inner_text()=='water')
   check('Lookup does not create a card or schedule silently',not H.snap(page)['cards'])
   check('Lookup leaves the original reader DOM intact',page.evaluate('window.__originalReader===document.querySelector("#reader-text")'))
   check('No unrelated illustration or image placeholder appears',page.locator('#translation-output .word-image').count()==0)
   # Deterministic storage failure on a real app action, then real retry.
   page.evaluate("()=>{window.__commit=__app.DB.commitTranslation;__app.DB.commitTranslation=async()=>{throw Error('TEST disk full')};}")
   saved(page);expect(page.locator('.word-save [role=alert]')).to_contain_text('TEST disk full')
   check('Failed save retains the word, context and reachable retry',page.locator('[data-action="save-support-word"]').inner_text().startswith('Retry save') and not H.snap(page)['cards'])
   snap(page,'read-save-error.png');page.evaluate('()=>{__app.DB.commitTranslation=__commit;}');saved(page)
   expect(page.locator('.word-save-status')).to_contain_text('Saved')
   card=H.snap(page)['cards'][0]
   check('Retry confirms actual stored source and reference-only mode',card['context']=='There is water on the table, and the house is quiet.' and card['learningMode']=='reference')
   check('Confirmed saved status is not a pointless Save button',page.locator('[data-action="save-support-word"]').count()==0)
   snap(page,'read-word-desktop.png')
   choose(page,'book')
   page.evaluate('''()=>{window.__calls=0;__app.DB.commitTranslation=async(...args)=>{__calls++;await new Promise(r=>window.__finishSave=r);return __commit(...args);};}''')
   page.locator('[data-action="save-support-word"]').click();expect(page.locator('[data-action="save-support-word"]')).to_be_disabled()
   page.evaluate('document.querySelector("[data-action=save-support-word]").dispatchEvent(new MouseEvent("click",{bubbles:true}))')
   check('Slow save is pending and duplicate submission is guarded',page.evaluate('__calls')==1)
   page.evaluate('__finishSave()');H.settle(page);page.evaluate('()=>{__app.DB.commitTranslation=__commit;}')
   check('A double save creates one actual book card',len([c for c in H.snap(page)['cards'] if c['front']=='book'])==1)
   # Device availability and playback events are fixtures, never claimed as audible.
   page.locator('[data-action="support-listen"]').click();expect(page.locator('#device-speech-player')).to_contain_text('No')
   check('Missing matching voice is explicitly reported in reachable controls')
   page.evaluate('__voices=[{name:"TEST English",lang:"en-US",localService:true}]')
   page.locator('[data-voice-replay]').click();expect(page.locator('#device-speech-player')).to_contain_text('Playing')
   page.locator('[data-voice-stop]').click();expect(page.locator('#device-speech-player')).to_contain_text('Stopped')
   page.locator('[data-voice-replay]').click();check('Replay and Stop invoke existing voice implementation (fixture)',page.evaluate('__voiceCalls.length')==2)
   choose(page,'water');check('Selecting another word stops old pronunciation',page.evaluate('__lastVoice===null'))
   # Keyboard + modal focus/scroll, including closing the same panel node.
   page.set_viewport_size({'width':390,'height':844})
   expect(page.locator('#word-sheet')).to_be_visible();check('Phone panel is a native focus-managed dialog',page.evaluate('document.querySelector("#word-sheet").contains(document.activeElement)'))
   snap(page,'read-word-phone.png');page.keyboard.press('Escape');expect(page.locator('#word-sheet')).not_to_be_visible()
   check('Escape restores focus to the selected source word',page.evaluate('document.activeElement.textContent==="water"'))
   page.keyboard.press('Enter');expect(page.locator('#word-sheet')).to_be_visible();page.locator('[data-action="close-word-panel"]').first.click()
   check('Keyboard reopens the panel and Return restores reading',page.evaluate('document.activeElement.textContent==="water"') and page.locator('#reader-text').inner_text()==passage)
   snap(page,'read-phone.png');check('Phone has no horizontal overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
   page.set_viewport_size({'width':1440,'height':1000});choose(page,'water')
   # Blank knowledge produces manual entry, not a fabricated answer.
   text(page,'A quuxword appears beside the water.');choose(page,'quuxword');expect(page.locator('.support-error')).to_contain_text('No meaning')
   snap(page,'read-unavailable.png');page.locator('[data-action="add-manual"]').click()
   expect(page.locator('#card-front')).to_have_value('quuxword');expect(page.locator('#card-context')).to_have_value('A quuxword appears beside the water.')
   page.locator('#card-back').fill('A meaning supplied by the learner');page.locator('#card-submit').click();expect(page.locator('#modal')).not_to_be_visible()
   expect(page.locator('.word-definition')).to_have_text('A meaning supplied by the learner');expect(page.locator('.word-provider')).to_have_text('Your meaning')
   check('Manual meaning keeps selection and source, saves and returns to same reader')
   # Controlled cache delays exercise production stale-response check, no provider call.
   text(page,'The slowword sits beside water.');page.evaluate('''()=>{window.__cache=__app.DB.cacheGet;__app.settingsBefore={...__app.state.settings};__app.state.settings.provider='public';__app.state.settings.consent=true;__app.DB.cacheGet=()=>new Promise(r=>window.__lookupDone=r);}''')
   page.locator('.reader-token').filter(has_text=re.compile('^slowword$')).click();expect(page.locator('.support-loading')).to_be_visible()
   snap(page,'read-loading.png');choose(page,'water');page.evaluate('__lookupDone("TEST obsolete response")');page.wait_for_timeout(80)
   check('Older delayed response never replaces the most recent word',page.locator('#support-word').inner_text()=='water' and page.locator('.word-definition').inner_text()=='agua' and 'obsolete' not in page.locator('#translation-output').inner_text())
   page.evaluate('()=>{__app.DB.cacheGet=__cache;Object.assign(__app.state.settings,__app.settingsBefore);}');
   # Render long mixed directions, actual saved diacritics, genuine source only.
   H.nav(page,'translate');page.locator('#source-language').select_option('ar');page.locator('#target-language').select_option('en');H.nav(page,'reader')
   text(page,'\u0623\u0642\u0631\u0623 \u0643\u062a\u0627\u0628 \u0628\u062c\u0627\u0646\u0628 \u0627\u0644\u0646\u0627\u0641\u0630\u0629. Nabu helps me read. \u0645\u0627\u0621 \u0639\u0644\u0649 \u0627\u0644\u0637\u0627\u0648\u0644\u0629.','\u0644\u062d\u0638\u0629 \u0642\u0631\u0627\u0621\u0629 / A moment to read')
   choose(page,'\u0645\u0627\u0621');check('Mixed Arabic and Latin text retains direction and original context',page.locator('#reader-text').get_attribute('dir')=='rtl' and page.locator('.word-source mark').inner_text()=='\u0645\u0627\u0621')
   check('Latin words in Arabic retain left-to-right word order',page.evaluate('''() => {const a=[...document.querySelectorAll('.reader-token')];const left=t=>a.find(e=>e.textContent===t).getBoundingClientRect().left;return left('Nabu')<left('helps')&&left('helps')<left('me')&&left('me')<left('read');}'''));check('Arabic paragraph keeps its source run order',page.evaluate('''()=>{const a=document.querySelector('.reader-token'),z=[...document.querySelectorAll('.reader-token')].find(e=>e.textContent==='\u0645\u0627\u0621');return a.getBoundingClientRect().left>z.getBoundingClientRect().left;}'''));snap(page,'read-arabic-desktop.png');page.set_viewport_size({'width':390,'height':844});snap(page,'read-arabic-phone.png')
   check('Arabic phone layout has no overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
   page.keyboard.press('Escape');page.set_viewport_size({'width':1440,'height':1000});page.evaluate('document.documentElement.style.zoom="2"')
   check('200% CSS zoom reflows without horizontal scrolling',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
   snap(page,'read-200-percent.png');page.evaluate('document.documentElement.style.zoom=""')
   page.emulate_media(reduced_motion='reduce');check('Reduced motion removes animated transitions',page.locator('.reader-token').first.evaluate('(e)=>getComputedStyle(e).transitionDuration')=='0s');page.emulate_media(reduced_motion='no-preference')
   # Real account and server durability across a fresh UI mount (navigation/IDB remain fixtures).
   H.signup(page,'reading_verifier');H.nav(page,'reader')
   page.locator('#target-language').select_option('es');page.locator('#source-language').select_option('en')
   text(page,'Please bring water to the table.','Server persistence check');choose(page,'water');saved(page);H.sync(page)
   servercard=next(c for c in client.get('/api/library').json()['cards'] if c['front']=='water')
   check('Confirmed account save reaches the actual SQLite backend',servercard['context']=='Please bring water to the table.')
   fresh=load();fresh.wait_for_function('()=>__app.state.user?.handle==="reading_verifier"');H.nav(fresh,'library')
   check('A fresh UI mount loads server-confirmed source metadata',any(c['id']==servercard['id'] and c['context']==servercard['context'] for c in H.snap(fresh)['cards']))
   snap(fresh,'library-desktop.png');fresh.set_viewport_size({'width':390,'height':844});snap(fresh,'library-phone.png');check('Saved library reflows on phone',fresh.evaluate('document.documentElement.scrollWidth<=innerWidth'))
   fresh.set_viewport_size({'width':1440,'height':1000});H.nav(fresh,'translate');fresh.locator('.workspace-tabs [data-view="graph"]').click();snap(fresh,'words-final-desktop.png');fresh.set_viewport_size({'width':390,'height':844});snap(fresh,'words-final-phone.png');check('Word bank reflows on phone',fresh.evaluate('document.documentElement.scrollWidth<=innerWidth'))
   fresh.set_viewport_size({'width':1440,'height':1000});H.nav(fresh,'translate');snap(fresh,'translate-desktop.png');fresh.locator('#settings-nav').click();snap(fresh,'settings-desktop.png')
   check('No uncaught browser exception across all checks',not errors);check('No unexplained browser console errors',not console_errors);check('No failed browser network requests',not request_failures)
   browser.close()
if __name__=='__main__':
 failure=None
 try:main()
 except Exception as e:failure=traceback.format_exc();print(failure,flush=True)
 finally:(OUT/'redesign-browser.json').write_text(json.dumps({'passed':len(checks),'checks':checks,'errors':errors,'failure':failure,'screenshots':captures,'consoleErrors':console_errors,'requestFailures':request_failures,'fixtureBoundary':__doc__},indent=2))
 if failure:sys.exit(1)
