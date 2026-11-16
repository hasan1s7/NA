"""Actual bundled /words DOM and FastAPI/SQLite through explicit fixtures.
Native URL navigation, IndexedDB, audio hardware and Chrome APIs are not asserted.
Speech recognition outputs are deliberate TEST STUBS, not accuracy evidence.
"""
from pathlib import Path
import sys,json,tempfile,uuid
from playwright.sync_api import sync_playwright,expect
from fastapi.testclient import TestClient
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT));sys.path.insert(0,str(ROOT/'tests'))
import next_browser as H
from server import create_app
OUT=ROOT/'verification/careful-media';OUT.mkdir(parents=True,exist_ok=True)
checks=[];errors=[]
def check(name,condition=True):
 assert condition,name
 checks.append(name);print('PASS',name,flush=True)
def shot(page,name):
 page.evaluate('document.querySelector("#modal-body").scrollTop=0')
 page.screenshot(path=str(OUT/name),full_page=False)
AUDIO=r'''
window.__audioTracks=[];window.__denyAudio=false;window.__voicePlays=[];
Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async()=>{
 if(window.__denyAudio)throw new DOMException('Fixture permission denied','NotAllowedError');
 const track={stopped:false,stop(){this.stopped=true},addEventListener(){}};__audioTracks.push(track);
 return {getTracks:()=>[track],getAudioTracks:()=>[track]};}}});
window.MediaStream=class {constructor(tracks){this.tracks=tracks;}};
window.MediaRecorder=class {static isTypeSupported(){return true}constructor(){this.state='inactive'}start(){this.state='recording'}stop(){this.state='inactive';queueMicrotask(()=>{this.ondataavailable?.({data:new Blob(['fixture audio'],{type:'audio/webm'})});this.onstop?.();});}};
window.SpeechSynthesisUtterance=class {constructor(text){this.text=text;}};
Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{getVoices:()=>[{name:'Fixture English',lang:'en-US',localService:true}],cancel(){},speak(u){__voicePlays.push(u.text);u.onstart?.();setTimeout(()=>u.onend?.(),100);}}});
'''
def main():
 with tempfile.TemporaryDirectory() as tmp:
  app=create_app(Path(tmp)/'ui.sqlite3','http://testserver',invite='',translation_key='')
  with TestClient(app,headers={'Origin':'http://testserver'}) as lifetime,sync_playwright() as p:
   browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage']);clients=[]
   def load():
    client=TestClient(app,headers={'Origin':'http://testserver'});clients.append(client)
    page=browser.new_page(viewport={'width':1440,'height':1080});page.on('pageerror',lambda e:errors.append(str(e)));page.set_default_timeout(10000)
    def request(source,req):
     res=client.request(req['method'],req['path'],headers={**req['headers'],'Origin':'http://testserver'},content=req.get('body'))
     try:body=res.json()
     except:body={'detail':res.text[:200]}
     return {'status':res.status_code,'data':body}
    page.expose_binding('__apiCall',request);page.evaluate(H.fixture);page.evaluate(AUDIO);page.set_content(H.html)
    expect(page.locator('#translation-input')).to_be_visible();page.wait_for_function('()=>__app.state.backend?.offlineSync===true');return page,client
   page,client=load();page.locator('[data-view="graph"]').first.click()
   check('Words route selected in shipping router',page.evaluate('__app.currentURL().endsWith("/words")'))
   page.evaluate("async()=>{__app.state.graph.selectedId='home.house';await __app.useGraph('home.house');__app.render();}")
   page.locator('.word-details summary').click();page.locator('[data-action="show-context"]').click();expect(page.locator('#word-context-form')).to_be_visible()
   check('Show meaning in context opens a real dictionary/context panel')
   page.locator('[data-action="context-listen-sentence"]').click();expect(page.locator('#modal-error')).to_contain_text('Paste a sentence')
   check('Missing context produces visible instruction, not silent click')
   page.locator('[data-action="toggle-reading"]').click();expect(page.locator('#context-reading')).to_be_visible()
   page.locator('[data-action="use-reading"]').click();assert page.locator('#word-reading').input_value()
   page.locator('[data-action="toggle-reading"]').click();expect(page.locator('#context-reading')).not_to_be_visible()
   check('Transliteration show, use and hide controls change actual state')
   page.locator('#word-context-form .word-details').evaluate('(e)=>e.open=true');page.locator('#word-context').fill('The house is near the station.');page.locator('#word-note').fill('First context note');page.locator('input[name="imageId"][value="house"]').check()
   page.locator('#word-context-form [type="submit"]').click();expect(page.locator('#context-save-status')).to_contain_text('Saved in this browser')
   saved=H.snap(page)['cards'][0];check('Context, note, reading and image persist in existing local store',saved['context']=='The house is near the station.' and saved['note']=='First context note' and saved['imageId']=='house')
   check('Clip art image actually decodes',page.locator('.clipart-picker img').first.evaluate('(e)=>e.complete&&e.naturalWidth>0'))
   page.locator('[data-action="context-listen"]').click();expect(page.locator('#device-speech-player')).to_contain_text('Finished')
   check('Device TTS invokes utterance with selected text (voice fixture)',page.evaluate('__voicePlays.length')==1)
   page.locator('[data-voice-replay]').click();page.wait_for_function('()=>__voicePlays.length===2');page.locator('[data-voice-close]').click()
   page.evaluate('()=>{window.__originalEdit=__app.DB.editCard;__app.DB.editCard=async()=>{throw new Error("SIMULATED storage failure")};}')
   page.locator('#word-note').fill('Keep this when save fails');page.locator('#word-context-form [type="submit"]').click();expect(page.locator('#modal-error')).to_contain_text('SIMULATED storage failure')
   check('Save failure keeps editable note and retry enabled',page.locator('#word-note').input_value()=='Keep this when save fails' and page.locator('#word-context-form [type="submit"]').is_enabled())
   page.evaluate('()=>{__app.DB.editCard=window.__originalEdit;}');page.locator('#word-context-form [type="submit"]').click();page.wait_for_function('()=>__app.state.cards[0].note==="Keep this when save fails"')
   check('Retry saves the retained edit')
   shot(page,'words-context-desktop.png');page.set_viewport_size({'width':390,'height':844});shot(page,'words-context-mobile.png');check('Context dialog fits mobile width',page.evaluate('document.documentElement.scrollWidth<=innerWidth'));page.set_viewport_size({'width':1440,'height':1080});H.close(page)
   H.nav(page,'translate');page.locator('[data-action="record-excerpt"]').click();page.locator('[data-action="use-transcript"]').click();expect(page.locator('#modal-error')).to_contain_text('Enter or transcribe')
   page.evaluate('__denyAudio=true');page.locator('#start-microphone').click();expect(page.locator('#record-status')).to_contain_text('Permission was not granted')
   check('Denied microphone has a visible error and retry')
   page.evaluate('__denyAudio=false');page.locator('#start-microphone').click();expect(page.locator('#record-status')).to_contain_text('Recording.');page.locator('#stop-microphone').click();expect(page.locator('#record-preview')).to_be_visible()
   check('Record and stop create an audio preview and stop all tracks (media fixture)',page.evaluate('__audioTracks.every(t=>t.stopped)'))
   expect(page.locator('#transcribe-audio')).to_be_disabled();page.locator('[data-action="transcription-setup"]').click();expect(page.locator('#transcription-setup')).to_contain_text('Install')
   check('Missing model disables transcription with explicit setup instructions')
   page.locator('#record-transcript').fill('An edited media excerpt');page.locator('[data-action="use-transcript"]').click();expect(page.locator('#translation-input')).to_have_value('An edited media excerpt');check('Edited transcript enters existing translator without auto-submitting')
   H.signup(page,'alice');H.nav(page,'translate')
   page.locator('[data-view="graph"]').first.click();H.nav(page,'translate');page.locator('[data-action="record-excerpt"]').click();expect(page.locator('#record-transcript')).to_have_value('');expect(page.locator('#record-preview')).not_to_be_visible();check('Account change clears retained recording and draft');H.close(page)
   # Stub only recognition; run actual authenticated endpoint and media UI.
   app.state.transcribe=lambda data:{'text':'TEST model transcript','provider':'TEST STUB','draft':True,'audioRetained':False}
   original_config=app.state.media_config;app.state.media_config=lambda:{**original_config(),'transcriptionEnabled':True}
   page.evaluate('__app.checkBackend()');page.wait_for_function('()=>__app.state.backend.transcriptionEnabled===true')
   H.nav(page,'translate');page.locator('[data-action="record-excerpt"]').click();page.locator('#start-microphone').click();page.locator('#stop-microphone').click();expect(page.locator('#transcribe-audio')).to_be_enabled();page.locator('#transcribe-audio').click();expect(page.locator('#record-transcript')).to_have_value('TEST model transcript');check('Authenticated transcription response fills editable transcript (model stub)')
   page.locator('#record-transcript').fill('Corrected transcript');page.locator('[data-action="use-transcript"]').click();expect(page.locator('#translation-input')).to_have_value('Corrected transcript');check('Transcript correction survives transfer to translator')
   page.locator('#settings-nav').click();page.locator('[data-action="extension-connections"]').click();page.locator('#extension-id').fill('a'*32);page.locator('#extension-token-form [type="submit"]').click();expect(page.locator('#new-token')).to_be_visible();token=page.locator('#new-token').input_value();check('Connection UI creates real account-bound credential',token.startswith('nabu_ext_'));H.close(page)
   x=TestClient(app,headers={'Origin':'chrome-extension://'+'a'*32,'Authorization':'Bearer '+token})
   body={'requestId':str(uuid.uuid4()),'content':{'front':'water','back':'agua','sourceLang':'en','targetLang':'es','conceptId':'food.water','context':'Please bring water.','note':'From an article'},'sourceUrl':'https://example.org/article','sourceTitle':'Learner selected article','offsetSeconds':24}
   response=x.post('/api/extension/capture',json=body);assert response.status_code==200,response.text
   H.sync(page)
   page.evaluate('async()=>{const x=await __app.DB.snapshot();__app.state.cards=x.cards;__app.render();}')
   H.nav(page,'library');page.locator('[data-action="show-context"]').click();expect(page.locator('#word-context')).to_have_value('Please bring water.');expect(page.locator('#captured-sources')).to_contain_text('Learner selected article');expect(page.locator('#captured-sources')).to_contain_text('From an article');check('Extension capture appears in existing library with private source, timestamp and note')
   shot(page,'extension-source-in-words.png');H.close(page);page.locator('#settings-nav').click();page.locator('[data-action="extension-connections"]').click();page.locator('[data-action="revoke-extension-token"]').click();expect(page.locator('#modal-body')).to_contain_text('No extension connections');check('Revoke UI invalidates actual token',x.get('/api/extension/status').status_code==401);H.close(page)
   check('No uncaught application errors',not errors)
   x.close();browser.close()
   for client in clients:client.close()
 (OUT/'media-browser-results.json').write_text(json.dumps({'passed':len(checks),'checks':checks,'pageErrors':errors,'boundaries':['Real bundled DOM with URL/history fixture','IndexedDB fixture: no native disk persistence tested','FastAPI TestClient + real temporary SQLite','Audio, voice and transcription model fixtures; no hardware or accuracy claim','Native Chromium localhost navigation blocked by environment policy']},indent=2)+'\n')
if __name__=='__main__':main()
