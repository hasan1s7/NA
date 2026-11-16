"""Extension panel DOM + real API/SQLite through explicitly mocked Chrome APIs.
Does NOT install an extension or validate native side-panel, host or audio permissions.
"""
import json,re,sys,tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from fastapi.testclient import TestClient
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT));sys.path.insert(0,str(ROOT/'tests'))
from server import create_app
from media_browser import AUDIO
OUT=ROOT/'verification/careful-media';EXT=ROOT/'chrome-extension';checks=[];errors=[]
def check(name,condition=True):
 assert condition,name
 checks.append(name);print('PASS',name,flush=True)
CHROME=r'''
if(!crypto.randomUUID)Object.defineProperty(crypto,'randomUUID',{value:()=>{const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;const h=[...bytes].map(x=>x.toString(16).padStart(2,'0')).join('');return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);}});
window.__fakeStorage={local:{},session:{}};window.__workerRequests=[];window.__loseCaptureAck=false;window.__delaySave=false;
const area=name=>({async get(key){const data=__fakeStorage[name];return typeof key==='string'?{[key]:structuredClone(data[key])}:structuredClone(data)},async set(values){Object.assign(__fakeStorage[name],structuredClone(values));},async clear(){__fakeStorage[name]={}},async remove(key){delete __fakeStorage[name][key]}});
window.chrome={storage:{local:area('local'),session:area('session'),onChanged:{addListener(fn){window.__onConnection=fn;}}},runtime:{id:'a'.repeat(32),onMessage:{addListener(fn){window.__onMessage=fn;}},async openOptionsPage(){window.__optionsOpened=true;},async sendMessage(msg){try{__workerRequests.push(msg);if(msg.type==='capture-selection'){const draft={...__fakeStorage.session.draft,text:'water',meaning:'',sourceLang:'en',targetLang:'es',context:'Please bring water.',sourceUrl:'https://example.org/article',sourceTitle:'A learner-selected article',note:'',acknowledged:false};await chrome.storage.session.set({draft});return {ok:true,data:draft};}if(__delaySave&&msg.path==='capture')await new Promise(resolve=>window.__releaseSave=resolve);const out=await __extensionCall(msg);if(__loseCaptureAck&&msg.path==='capture'&&out.status===200){__loseCaptureAck=false;throw new Error('Simulated lost acknowledgment after commit');}if(out.status>=400)throw new Error(out.data.detail||'Request failed');return {ok:true,data:out.data};}catch(e){return {ok:false,error:e.message};}}},tabs:{async create(options){window.__openedTab=options.url}}};
'''
def module(name):
 s=(EXT/name).read_text();s=re.sub(r'^import .*\n','',s,flags=re.M);return re.sub(r'^export ','',s,flags=re.M)
def main():
 with tempfile.TemporaryDirectory() as tmp:
  app=create_app(Path(tmp)/'ext.sqlite3','http://testserver',invite='',translation_key='')
  with TestClient(app,headers={'Origin':'http://testserver'}) as owner,sync_playwright() as p:
   r=owner.post('/api/register',json={'handle':'alice','password':'Extension test password!'});owner.headers['X-CSRF-Token']=r.json()['csrf'];owner.headers['X-Nabu-Account']=r.json()['user']['id']
   token=owner.post('/api/extension-tokens',json={'extensionId':'a'*32}).json()['token']
   with TestClient(app,headers={'Origin':'chrome-extension://'+'a'*32,'Authorization':'Bearer '+token}) as client:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage']);page=browser.new_page(viewport={'width':420,'height':1000});page.set_default_timeout(10000);page.on('pageerror',lambda e:errors.append(str(e)))
    def call(source,msg):
     r=client.request(msg['method'],'/api/extension/'+msg['path'],json=msg.get('body') if msg['method']=='POST' else None)
     return {'status':r.status_code,'data':r.json()}
    page.expose_binding('__extensionCall',call);page.evaluate(CHROME);page.evaluate(AUDIO)
    page.evaluate("chrome.storage.local.set({connection:{origin:'http://127.0.0.1:8000',accountId:'fixture',token:'not exposed to panel',handle:'alice'}})")
    html=(EXT/'sidepanel.html').read_text();html=re.sub(r'<script type="module".*?</script>','',html);html=html.replace('<link rel="stylesheet" href="extension.css">','<style>'+(EXT/'extension.css').read_text()+'</style>');page.set_content(html)
    common=module('common.js');media=module('nabu-media.js');panel=module('sidepanel.js');names=re.findall(r'^export (?:function|const|async function) (\w+)',(EXT/'nabu-media.js').read_text(),re.M)
    reading=module('nabu-transliteration.js');reading_names=re.findall(r'^export (?:function|const|async function) (\w+)',(EXT/'nabu-transliteration.js').read_text(),re.M)
    runtime='(async()=>{'+common+'\nconst T=(()=>{'+reading+'\nreturn {'+','.join(reading_names)+'};})();\nconst M=(()=>{'+media+'\nreturn {'+','.join(names)+'};})();\n'+panel+'})()'
    page.evaluate(runtime);expect(page.locator('#connection-status')).to_contain_text('@alice');check('Side panel connects through account-bound backend')
    page.locator('#save').click();expect(page.locator('#status')).to_contain_text('Add the selected text');check('Empty save has actionable feedback')
    page.locator('#capture').click();expect(page.locator('#selection')).to_have_value('water');expect(page.locator('#context')).to_have_value('Please bring water.');check('Capture fills source context (Chrome selection fixture)')
    page.locator('#translate').click();expect(page.locator('#choices .choice')).to_be_visible();page.locator('#choices .choice').first.click();expect(page.locator('#meaning')).to_have_value('agua');page.locator('#note').fill('From the article I chose')
    check('Exact bank lookup requires an explicit sense choice')
    page.locator('#show-reading').click();expect(page.locator('#reading')).to_be_visible();page.locator('#show-reading').click();expect(page.locator('#reading')).not_to_be_visible();check('Reading aid toggle changes visible state')
    page.locator('#listen').click();expect(page.locator('#device-speech-player')).to_contain_text('Finished');check('Extension Listen invokes device voice (fixture)',page.evaluate('__voicePlays[0]')=='water');page.locator('[data-voice-close]').click()
    page.evaluate('__loseCaptureAck=true');page.locator('#save').click();expect(page.locator('#status')).to_contain_text('Simulated lost acknowledgment');expect(page.locator('#note')).to_have_value('From the article I chose');check('Failed acknowledgment preserves text and retry')
    page.locator('#save').click();expect(page.locator('#status')).to_contain_text('Saved to your Nabu library');check('Retry creates one actual server card',len(owner.get('/api/library').json()['cards'])==1)
    cid=owner.get('/api/library').json()['cards'][0]['id'];assert len(owner.get('/api/captures/'+cid).json()['captures'])==1
    check('Retry creates one encounter, not duplicate progress')
    page.locator('#note').fill('Second encounter note');page.evaluate('__delaySave=true');page.locator('#save').click();expect(page.locator('#note')).to_be_disabled();check('Pending save prevents edits being mistaken for saved content');page.evaluate('__releaseSave();__delaySave=false');expect(page.locator('#status')).to_contain_text('separate encounter');assert len(owner.get('/api/captures/'+cid).json()['captures'])==2
    check('New note is a second private encounter with the same word')
    page.locator('#open-nabu').click();check('Open library targets configured Nabu app',page.evaluate('__openedTab')=='http://127.0.0.1:8000/library')
    page.locator('#settings').click();check('Connection button opens options (Chrome fixture)',page.evaluate('__optionsOpened') is True)
    page.locator('.recording-section summary').click();page.locator('#use-transcript').click();expect(page.locator('#status')).to_contain_text('Type or transcribe')
    page.locator('#record-mic').click();page.locator('#stop').click();expect(page.locator('#audio')).to_be_visible();expect(page.locator('#transcribe')).to_be_disabled();check('Recorder stops, previews audio, and explains missing local model')
    page.locator('#discard').click();expect(page.locator('#audio')).not_to_be_visible();check('Discard releases recording and preview')
    page.locator('#transcript').fill('An edited media excerpt');page.locator('#use-transcript').click();expect(page.locator('#selection')).to_have_value('An edited media excerpt');expect(page.locator('#meaning')).to_have_value('');check('Edited transcript requires a fresh meaning and source before save',page.locator('#source-url').input_value()=='' and page.locator('#context').input_value()=='')
    page.locator('#selection').fill('unlistedwordzzz');page.locator('#translate').click();expect(page.locator('#status')).to_contain_text('No exact bank match');check('Unknown vocabulary never fabricates a translation')
    page.locator('#source-language').select_option('ru');page.locator('#selection').fill('\u041f\u0440\u0438\u0432\u0435\u0442');page.locator('#show-reading').click();expect(page.locator('#reading')).to_contain_text('Privet');check('Extension uses the same Russian reading scheme as the app')
    page.locator('#selection').fill('\u0441\u043f\u0430\u0441\u0438\u0431\u043e');expect(page.locator('#reading')).not_to_be_visible();expect(page.locator('#show-reading')).to_have_attribute('aria-expanded','false');check('Changing the selection removes stale reading output')
    page.locator('#source-language').select_option('ja');page.locator('#selection').fill('\u9280\u884c');page.locator('#show-reading').click();expect(page.locator('#reading')).to_contain_text('No reliable whole-word');check('Extension cannot fabricate a Japanese kanji reading')
    check('Panel fits a narrow width',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
    page.screenshot(path=str(OUT/'extension-panel.png'),full_page=True)
    check('No uncaught panel errors',not errors)
    browser.close()
 (OUT/'extension-browser-results.json').write_text(json.dumps({'passed':len(checks),'checks':checks,'pageErrors':errors,'boundaries':['Real panel JS/DOM; imports bundled only for test','Chrome storage, messaging, selection, options and tab APIs are fixtures','Real extension-auth API and temporary SQLite','Audio and device voices are fixtures','No installed-extension, native permission prompt, model-accuracy or tab-audio compatibility claim']},indent=2)+'\n')
if __name__=='__main__':main()
