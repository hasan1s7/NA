"""Shipping UI with explicit navigation/IndexedDB/transport fixtures and real
FastAPI/SQLite. Passages are authored QA inputs, never actual learner records.
No native browser persistence, OS voice, audio, model or live image-provider claim.
"""
from pathlib import Path
import sys,tempfile,json,traceback
from fastapi.testclient import TestClient
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT));sys.path.insert(0,str(ROOT/'tests'))
import next_browser as H
from redesign_browser import text,choose,VOICE
from redesign_accessibility import AUDIT
from server import create_app
OUT=ROOT/'verification/meaning-tools';OUT.mkdir(parents=True,exist_ok=True)
checks=[];errors=[];captures=[];contrast=[]
def check(name,ok=True):
 assert ok,name
 checks.append(name);print('PASS',name,flush=True)
def shot(page,name):
 page.wait_for_timeout(160)  # Allow the existing 80ms sync-render debounce to update status.
 page.evaluate('document.querySelector("#toast").hidden=true;document.querySelector("#modal").scrollTop=0')
 page.screenshot(path=str(OUT/name),full_page=False);captures.append(name)
def extra(page):
 page.locator('#word-context-form .word-details').evaluate('(e)=>e.open=true')
def submit(page):
 page.locator('#word-context-form [type=submit]').click();expect(page.locator('#context-save-status')).to_contain_text('Saved');H.sync(page)
def open_word(page):
 b=page.locator('.word-save [data-action=show-context]')
 if b.count():b.click()
 else:
  page.locator('#translation-output .word-details').evaluate('(e)=>e.open=true');page.locator('#translation-output [data-action=show-context]').click()
 expect(page.locator('#word-context-form')).to_be_visible()
def audit(page,label):
 result=page.evaluate(AUDIT);contrast.append({'screen':label,**result});check('Visible text contrast: '+label,not result['failures'])
 unnamed=page.locator('#modal button:visible,#modal a:visible').evaluate_all('es=>es.filter(e=>!(e.textContent.trim()||e.getAttribute("aria-label")||e.getAttribute("aria-labelledby")||e.title)).map(e=>e.outerHTML)')
 check('Controls have accessible labels: '+label,not unnamed)
def library_word(page,front):
 page.wait_for_function('(front)=>__app.state.cards.some(c=>c.front===front)',arg=front)
 H.nav(page,'library');page.evaluate('(front)=>{const c=__app.state.cards.find(c=>c.front===front);if(!c)throw Error("Missing test card");return __app.actions["show-context"]({dataset:{cardId:c.id}});}',front)
 expect(page.locator('#word-context-form')).to_be_visible()
def main():
 with tempfile.TemporaryDirectory() as tmp:
  app=create_app(Path(tmp)/'meaning.sqlite3','http://testserver',invite='',translation_key='')
  with TestClient(app,headers={'Origin':'http://testserver'}) as client,sync_playwright() as pw:
   browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
   def load():
    page=browser.new_page(viewport={'width':1440,'height':1000});page.set_default_timeout(9000);page.on('pageerror',lambda e:errors.append(str(e)))
    def request(source,req):
     r=client.request(req['method'],req['path'],headers={**req['headers'],'Origin':'http://testserver'},content=req.get('body'))
     try:data=r.json()
     except:data={'detail':r.text[:200]}
     return {'status':r.status_code,'data':data}
    page.expose_binding('__apiCall',request);page.evaluate(H.fixture);page.evaluate(VOICE);page.set_content(H.html)
    expect(page.locator('#translation-input')).to_be_visible();page.wait_for_function('()=>__app.state.backend?.offlineSync')
    return page
   page=load();H.signup(page,'meaning_reader');H.nav(page,'reader')
   text(page,'I poured the water into a glass. Then I opened the book.','An ordinary afternoon')
   choose(page,'water');page.locator('[data-action=save-support-word]').click();H.settle(page);H.sync(page);open_word(page);extra(page)
   check('Context editor contains the exact selected source sentence',page.locator('#word-context').input_value()=='I poured the water into a glass.')
   check('Known water sense offers only its matching asset',page.locator('input[name=imageId]').evaluate_all('es=>es.map(e=>e.value)')==['','water'])
   page.locator('input[name=imageId][value=water]').check();page.locator('#word-note').fill('QA: keep the original sentence and sense.')
   submit(page);expect(page.locator('#illustration-choice-status')).to_have_text('')
   check('Image choice reaches the same account library',client.get('/api/library').json()['cards'][0]['imageId']=='water')
   check('Saved illustration decodes with descriptive alt',page.locator('#context-image-preview img').evaluate('(e)=>e.complete&&e.naturalWidth>0&&e.alt.includes("water")'))
   audit(page,'water-context');shot(page,'water-context-desktop.png')
   # Exercise a genuine decode failure, not a toast pretending to load.
   page.locator('#context-image-preview img').evaluate('(e)=>e.src="data:image/png;base64,NOT_AN_IMAGE"')
   expect(page.locator('#context-image-preview .illustration-error')).to_be_visible();expect(page.locator('#word-note')).to_have_value('QA: keep the original sentence and sense.')
   page.locator('#context-image-preview [data-action=retry-illustration]').click();page.wait_for_function('()=>document.querySelector("#context-image-preview img").naturalWidth>0&&!document.querySelector("#context-image-preview img").hidden')
   check('Broken-image state preserves content and retry reloads the actual asset')
   page.locator('[data-action=flag-illustration]').click();submit(page);H.close(page);open_word(page);extra(page)
   check('Incorrect-image feedback persists without redisplaying the rejected image',page.locator('#context-image-preview img').count()==0 and 'Previously flagged' in page.locator('.clipart-picker').inner_text())
   data=client.get('/api/library').json()['cards'][0];check('Flag is persisted, not merely a success message',data['imageDismissed']==['water'] and data['imageId']=='')
   page.locator('input[name=imageId][value=water]').check();submit(page);check('Explicit restore clears the relevant rejection',client.get('/api/library').json()['cards'][0]['imageDismissed']==[])
   page.locator('[data-action=remove-illustration]').click();submit(page);check('Remove deletes the saved association',client.get('/api/library').json()['cards'][0]['imageId']=='')
   page.locator('input[name=imageId][value=water]').check();submit(page)
   # Slow save: retain a newer edit rather than claiming it was part of the sent body.
   page.evaluate('()=>{window.__edit=__app.DB.editCard;window.__calls=0;__app.DB.editCard=async(...a)=>{__calls++;await new Promise(r=>window.__release=r);return __edit(...a);};}')
   page.locator('#word-note').fill('The submitted note');page.locator('#word-context-form [type=submit]').click();expect(page.locator('#word-context-form [type=submit]')).to_be_disabled()
   page.locator('#word-note').fill('A newer note while saving');page.evaluate('__release()');expect(page.locator('#context-save-status')).to_contain_text('newer edits are not saved');H.sync(page)
   check('Slow save reports newer unsaved edits accurately',page.evaluate('__calls')==1 and client.get('/api/library').json()['cards'][0]['note']=='The submitted note')
   page.evaluate('()=>{__app.DB.editCard=__edit;}');submit(page)
   page.evaluate('()=>{__app.DB.editCard=async()=>{throw Error("TEST interrupted storage");};}');page.locator('#word-note').fill('Retained on failure');page.locator('#word-context-form [type=submit]').click();expect(page.locator('#word-context-form [type=submit]')).to_have_text('Retry save');expect(page.locator('#word-note')).to_have_value('Retained on failure')
   page.evaluate('()=>{__app.DB.editCard=__edit;}');submit(page);check('Failed save retains edits and its explicit retry persists them')
   H.close(page);shot(page,'reader-water-desktop.png')
   # Real pasted input, dictionary financial sense vs a learner-entered river sense.
   text(page,'I deposited my money at the bank.','A visit to the bank');choose(page,'bank');open_word(page);extra(page)
   check('Financial bank has a distinct concept and bundled asset',page.locator('input[name=imageId]').evaluate_all('es=>es.map(e=>e.value)')==['','bank'])
   page.locator('input[name=imageId][value=bank]').check();submit(page);H.close(page);shot(page,'bank-financial-desktop.png')
   text(page,'We sat on the bank of the river.','Beside the river');choose(page,'bank');page.locator('[data-action=add-manual]').click();page.locator('#card-back').fill('orilla');page.locator('#card-submit').click();expect(page.locator('#modal')).not_to_be_visible();H.sync(page)
   expect(page.locator('.word-definition')).to_have_text('orilla');check('Learner can correct a bank sense without changing the original source',page.locator('.word-source blockquote').inner_text()=='We sat on the bank of the river.')
   check('Financial image is not reused for the manual river meaning',page.locator('#translation-output .word-image').count()==0)
   shot(page,'bank-river-no-image.png');open_word(page);extra(page)
   check('Manual meaning shows explicitly labelled choices, not an automatic match','No concept is linked' in page.locator('.clipart-picker').inner_text())
   page.locator('input[name=imageId][value=water]').check();page.locator('input[name=imageId][value=book]').check();page.locator('[data-action=remove-illustration]').click();expect(page.locator('#word-context-form [type=submit]')).to_be_disabled();check('Explicit replacement and removal leave no image for the ambiguous manual sense',page.locator('#context-image-preview img').count()==0)
   H.close(page)
   # Bounded Russian conversion, manual precedence, confirmation, explicit hide.
   H.nav(page,'reader');page.locator('#source-language').select_option('ru');page.locator('#target-language').select_option('en');text(page,'\u041f\u0440\u0438\u0432\u0435\u0442, Nabu!','A greeting');choose(page,'\u041f\u0440\u0438\u0432\u0435\u0442');open_word(page)
   page.locator('[data-action=toggle-reading]').click();expect(page.locator('#effective-reading')).to_contain_text('Privet');page.locator('[data-action=use-reading]').click();expect(page.locator('#word-reading')).to_have_value('Privet');submit(page)
   page.locator('#word-reading').fill('My checked greeting');expect(page.locator('#effective-reading')).to_contain_text('not saved yet');submit(page);expect(page.locator('#effective-reading')).to_contain_text('My checked greeting');check('Edited reading preview updates immediately and becomes confirmed only after save');H.close(page);open_word(page);extra(page)
   page.locator('[data-action=toggle-reading]').click();expect(page.locator('#effective-reading')).to_contain_text('My checked greeting');page.locator('.reading-suggestion').evaluate('(e)=>e.open=true')
   page.once('dialog',lambda d:d.dismiss());page.locator('[data-action=use-reading]').click();expect(page.locator('#word-reading')).to_have_value('My checked greeting');check('Automatic suggestion cannot overwrite a correction without confirmation')
   page.once('dialog',lambda d:d.accept());page.locator('[data-action=use-reading]').click();expect(page.locator('#word-reading')).to_have_value('Privet');submit(page);check('Explicit replacement uses and persists the selected draft')
   page.locator('[data-action=clear-reading]').click();submit(page);H.close(page);open_word(page);page.locator('[data-action=toggle-reading]').click();expect(page.locator('#effective-reading')).to_contain_text('cleared');check('Explicitly hidden reading remains hidden after reopening')
   H.close(page)
   # Japanese with no credible automatic reading remains usable and editable.
   H.nav(page,'reader');page.locator('#source-language').select_option('ja');text(page,'\u6c34\u3002','Water, in Japanese');choose(page,'\u6c34');open_word(page);page.locator('[data-action=toggle-reading]').click();expect(page.locator('#effective-reading')).to_contain_text('No reliable whole-word');expect(page.locator('[data-action=use-reading]')).to_have_count(0)
   check('Unavailable kanji reading is explicit; no fabricated Chinese-character reading is shown')
   extra(page);page.locator('#word-reading').fill('mizu (checked by learner)');page.locator('#word-note').fill('QA manual reading, not an automatic dictionary claim.');page.locator('input[name=imageId][value=water]').check();submit(page);H.close(page)
   fresh=load();fresh.wait_for_function('()=>__app.state.user?.handle==="meaning_reader"');library_word(fresh,'\u6c34');extra(fresh)
   expect(fresh.locator('#word-reading')).to_have_value('mizu (checked by learner)');expect(fresh.locator('input[name=imageId][value=water]')).to_be_checked();check('Fresh UI instance reloads corrected reading and matching image from real SQLite')
   fresh.locator('[data-action=toggle-reading]').click();audit(fresh,'saved-Japanese-reading');shot(fresh,'japanese-user-reading-desktop.png');H.close(fresh);fresh.close()
   # Missing asset metadata must not become a broken image; source remains editable.
   page.evaluate('async()=>{const c=__app.state.cards.find(c=>c.front==="water");await __app.DB.editCard(c.id,{...c,imageId:"missing_asset"},c.revision);await __app.DB.syncNow();const s=await __app.DB.snapshot();__app.state.cards=s.cards;__app.render();}')
   library_word(page,'water');expect(page.locator('#context-image-preview')).to_contain_text('not in this catalogue');expect(page.locator('#context-image-preview img')).to_have_count(0);extra(page);page.locator('[data-action=remove-illustration]').click();submit(page);check('Missing asset leaves the word usable with a working removal path');H.close(page)
   # RTL, mixed scripts and smaller screens, no invented reading from omitted vowels.
   H.nav(page,'reader');page.locator('#source-language').select_option('ar');text(page,'\u0647\u0646\u0627 \u0645\u0627\u0621. I read slowly.\n\n\u0645\u064e\u0627\u0621 \u0641\u064a \u0643\u0648\u0628.','\u0648\u0642\u062a \u0644\u0644\u0642\u0631\u0627\u0621\u0629 / Reading time');choose(page,'\u0645\u0627\u0621');open_word(page);page.locator('[data-action=toggle-reading]').click();expect(page.locator('#effective-reading')).to_contain_text('Missing vowels');extra(page);page.locator('input[name=imageId][value=water]').check();submit(page)
   check('Equivalent Arabic and English concepts use the same licensed asset',page.locator('#context-image-preview img').get_attribute('data-illustration-img')=='water')
   audit(page,'Arabic-context');shot(page,'arabic-context-desktop.png')
   for width in [768,390,320]:
    page.set_viewport_size({'width':width,'height':900});page.evaluate('document.querySelector("#modal").scrollTop=0');check(f'Context panel fits {width}px',page.evaluate('document.documentElement.scrollWidth<=innerWidth && document.querySelector("#modal").scrollWidth<=document.querySelector("#modal").clientWidth+1'))
    audit(page,f'Arabic-{width}')
    if width==390:shot(page,'arabic-context-phone.png')
   page.set_viewport_size({'width':390,'height':844});page.evaluate('document.documentElement.style.zoom="2"');check('Context panel reflows at 200% CSS zoom',page.evaluate('document.documentElement.scrollWidth<=innerWidth && document.querySelector("#modal").scrollWidth<=document.querySelector("#modal").clientWidth+1'));shot(page,'arabic-context-phone-200.png')
   page.evaluate('document.documentElement.style.zoom=""');H.close(page);shot(page,'arabic-reader-phone.png')
   # Current panel responds to rapid selections; no async enrichment is invented.
   page.keyboard.press('Escape');page.set_viewport_size({'width':1440,'height':1000});page.locator('#source-language').select_option('en');page.locator('#target-language').select_option('es');text(page,'The book is beside the water.','A brief reading')
   choose(page,'book');choose(page,'water');expect(page.locator('#support-word')).to_have_text('water');check('Rapid selections leave the latest selected word in the panel')
   check('No uncaught UI exceptions',not errors);browser.close()
if __name__=='__main__':
 failure=None
 try:main()
 except Exception:failure=traceback.format_exc();print(failure,flush=True)
 (OUT/'browser-results.json').write_text(json.dumps({'passed':len(checks),'checks':checks,'failure':failure,'pageErrors':errors,'screenshots':captures,'contrast':contrast,'boundary':__doc__},indent=2))
 if failure:sys.exit(1)
