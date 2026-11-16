"""Shipping Nabu application with explicit URL/history, IndexedDB and HTTP bridge
fixtures. API calls exercise actual FastAPI and SQLite. No native browser cookie,
disk storage, real microphone/voice or installed-extension claims."""
from pathlib import Path
import sys,json,tempfile,traceback,re
ROOT=Path(__file__).resolve().parents[1];sys.path[:0]=[str(ROOT),str(ROOT/'tests')]
from fastapi.testclient import TestClient
from server import create_app
from playwright.sync_api import sync_playwright,expect
import next_browser as H
from redesign_accessibility import AUDIT
from redesign_browser import VOICE
OUT=ROOT/'verification/mvp112';OUT.mkdir(exist_ok=True)
checks=[];errors=[];contrast=[];shots=[]
def check(name,ok=True):
 assert ok,name
 checks.append(name);print('PASS',name,flush=True)
def audit(page,label):
 r=page.evaluate(AUDIT);contrast.append({'screen':label,**r});check('Visible text contrast: '+label,not r['failures'])
 missing=page.locator('[data-action]:visible').evaluate_all('els=>els.filter(e=>typeof __app.actions[e.dataset.action]!=="function").map(e=>e.dataset.action)')
 check('Visible actions have real handlers: '+label,not missing)
def shot(page,name):
 page.evaluate('document.querySelector("#toast").hidden=true');page.screenshot(path=str(OUT/name),full_page=False);shots.append(name)
def main():
 with tempfile.TemporaryDirectory() as tmp,TestClient(create_app(Path(tmp)/'qa.sqlite3','http://testserver',invite='',translation_key=''),headers={'Origin':'http://testserver'}) as client,sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
  def load(seed=None,offline=False):
   page=browser.new_page(viewport={'width':1440,'height':1000});page.set_default_timeout(9000);page.on('pageerror',lambda e:errors.append(str(e)))
   def req(source,q):
    r=client.request(q['method'],q['path'],headers={**q['headers'],'Origin':'http://testserver'},content=q.get('body'))
    try:value=r.json()
    except:value={'detail':r.text[:300]}
    return {'status':r.status_code,'data':value}
   page.expose_binding('__apiCall',req);page.evaluate(H.fixture);page.evaluate(VOICE)
   if seed:
    page.evaluate('''async data=>{const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('nabu-translate-remember');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});for(const [name,rows] of Object.entries(data)){await new Promise((resolve,reject)=>{const t=db.transaction([name],'readwrite');t.oncomplete=resolve;t.onabort=()=>reject(t.error);for(const row of rows)t.objectStore(name).put(row);});}}''',seed)
   runtime=H.patched.replace('window.__app={state,','window.__app={explore,X,state,')
   html=H.html.replace(H.patched,runtime).replace(H.sig(H.patched),H.sig(runtime))
   
   if offline:page.evaluate('window.__networkDown=true')
   page.set_content(html);expect(page.locator('#translation-input')).to_be_visible()
   if offline:page.wait_for_function('()=>__app.state.user?.handle==="mvp_reader"')
   else:page.wait_for_function('()=>__app.state.backend?.contentProgress===true')
   return page
  page=load();H.nav(page,'explore');expect(page.locator('.content-card')).to_have_count(6)
  check('First-time guest sees all six real pieces without signup or keys')
  for key,count in [('feeling',2),('story',1),('useful',2),('discover',1)]:
   page.locator('[data-action=content-filter][data-filter='+key+']').click();expect(page.locator('.content-card')).to_have_count(count)
   page.locator('[data-action=content-filter][data-filter=""]').click();expect(page.locator('.content-card')).to_have_count(6)
  check('All four interest filters and reset operate on actual content');audit(page,'explore-desktop');shot(page,'explore-desktop.png')
  items=page.evaluate('__app.X.ITEMS.map(x=>({id:x.id,text:__app.X.sourceText(x)}))')
  for item in items:
   page.locator('[data-action=open-content][data-id='+item['id']+']').last.click()
   expect(page.locator('#reader-text')).to_be_visible()
   check('Published item opens with its exact untouched source: '+item['id'],page.locator('#reader-text').text_content()==item['text'])
   for b in page.locator('.reader-token.annotated').all():
    text=b.text_content();b.click();expect(page.locator('#support-word')).to_have_text(text);expect(page.locator('.word-provider')).to_contain_text('Contextual editorial meaning')
    check('Authored annotation, not a fabricated generic translation: '+item['id']+'/'+text,page.locator('.word-source mark').text_content()==text)
   H.nav(page,'explore')
  page.locator('[data-action=open-content][data-id=a-little-later]').last.click()
  token=page.locator('.reader-token.annotated').nth(2);token.scroll_into_view_if_needed();token.focus();before=page.evaluate('scrollY');token.click()
  check('Opening context keeps document and manual reading position',abs(page.evaluate('scrollY')-before)<2)
  page.evaluate('()=>{window.__reader=document.querySelector("#reader-text");window.__commit=__app.DB.commitTranslation;__app.DB.commitTranslation=async()=>{throw Error("TEST failed save")};}')
  page.locator('[data-action=save-support-word]').click();expect(page.locator('[data-action=save-support-word]')).to_contain_text('Retry')
  check('Failed vocabulary save preserves source and shows a genuine retry',page.locator('.word-source mark').inner_text()==token.inner_text())
  page.evaluate('()=>{__app.DB.commitTranslation=__commit;}');page.locator('[data-action=save-support-word]').click();H.settle(page)
  expect(page.locator('.word-save-status')).to_contain_text('Saved')
  card=H.snap(page)['cards'][0];check('Saved card preserves source/provenance, no hidden homework',card['learningMode']=='reference' and 'a-little-later@1' in card['provenance'] and token.inner_text() in card['context'])
  check('Save does not rebuild the reading DOM',page.evaluate('__reader===document.querySelector("#reader-text")'))
  page.locator('[data-action=support-listen]').click();expect(page.locator('#device-speech-player')).to_contain_text('No')
  check('Missing device voice is a visible, reachable unavailable state')
  page.locator('[data-action=close-word-panel]').first.click();check('Closing help restores focus to original expression',page.evaluate('document.activeElement.classList.contains("reader-token")'))
  # Record exact segment and reload fixtures into a fresh application instance.
  page.locator('[data-segment=s6]').scroll_into_view_if_needed();page.wait_for_timeout(650);page.evaluate('__app.explore.flushPosition()')
  saved_events=page.evaluate('__app.explore.store.getEvents()');check('Reading position is durably written in existing meta store',any(e['kind']=='position' for e in saved_events))
  seed=page.evaluate('__idbFixture.snapshot()');fresh=load(seed);H.nav(fresh,'explore');expect(fresh.locator('.explore-resume')).to_be_visible()
  fresh.locator('.explore-resume [data-action=open-content]').click();fresh.wait_for_timeout(200)
  check('Fresh application restores same content and a later reading position',fresh.evaluate('__app.state.reader.contentId')=='a-little-later' and fresh.evaluate('scrollY')>150)
  check('Previously saved vocabulary survives fresh application fixture',len(H.snap(fresh)['cards'])==1)
  # Practice records distinct evidence. Missing input is not silently accepted.
  fresh.locator('[data-action=content-practice]').click();fresh.locator('[data-action=check-content-answer]').click();expect(fresh.locator('.content-practice-error')).to_contain_text('Enter a response')
  check('Blank response has an actionable validation state')
  fresh.locator('[data-action=content-task][data-id=p2]').click();fresh.locator('#content-answer').fill('wrong');fresh.locator('[data-action=check-content-answer]').click();expect(fresh.locator('.content-feedback')).to_contain_text('Not the authored answer')
  fresh.locator('[data-action=practice-return]').first.click();fresh.locator('[data-action=content-practice]').click();expect(fresh.locator('#content-answer')).to_be_visible()
  check('Incorrect recall leads to a justified recall reattempt',fresh.locator('.content-practice').inner_text().find('last recall did not match')>=0)
  fresh.locator('[data-action=content-reveal]').click();expect(fresh.locator('.model-answer')).to_be_visible();answer=fresh.locator('.model-answer').inner_text()
  fresh.locator('#content-answer').fill(answer);fresh.locator('[data-action=check-content-answer]').click();expect(fresh.locator('.content-feedback')).to_contain_text('Matched with help')
  check('Revealed answer is recorded as assisted, not unaided recall')
  fresh.locator('[data-action=practice-return]').first.click();fresh.locator('[data-action=content-practice]').click()
  fresh.locator('#content-answer').fill(answer);fresh.locator('[data-action=check-content-answer]').click();expect(fresh.locator('.content-feedback')).to_contain_text('Matched without help')
  fresh.locator('[data-action=practice-return]').first.click();fresh.locator('[data-action=content-practice]').click();expect(fresh.locator('.practice-tabs .active')).to_contain_text('new context')
  check('Successful unaided recall recommends a related context with an inspectable reason')
  shot(fresh,'practice-desktop.png');audit(fresh,'practice')
  fresh.locator('[data-action=skip-content-answer]').click();expect(fresh.locator('.content-feedback')).to_contain_text('Skipped, not graded');check('Skip is persisted as missing evidence')
  fresh.locator('[data-action=practice-return]').first.click();check('Content practice has not created cards or changed review schedules',len(H.snap(fresh)['cards'])==1 and H.snap(fresh)['cards'][0]['schedule']==card['schedule'])
  fresh.locator('[data-action=finish-content]').click();expect(fresh.locator('.content-finish-state')).to_contain_text('marked this piece as read')
  fresh.locator('[data-action=finish-content]').click();expect(fresh.locator('.content-finish-state')).to_have_text('');check('Read/unread is explicit and separate from practice')
  fresh.locator('[data-action=content-preference]').click();expect(fresh.locator('[data-action=content-preference]')).to_have_attribute('aria-pressed','true');check('More like this persists an explicit reversible preference')
  # Failed progress writes preserve typed response and retry.
  fresh.locator('[data-action=content-practice]').click();fresh.locator('[data-action=content-task][data-id=p2]').click();fresh.locator('#content-answer').fill(answer)
  fresh.evaluate('__idbFixture.failNextWrite()');fresh.locator('[data-action=check-content-answer]').click();expect(fresh.locator('.content-practice-error')).to_contain_text('still here');expect(fresh.locator('#content-answer')).to_have_value(answer)
  fresh.locator('[data-action=check-content-answer]').click();expect(fresh.locator('.content-feedback')).to_contain_text('Matched');check('Failed progress write retains response; retry commits it')
  fresh.locator('[data-action=practice-return]').first.click()
  # A pending operation locks response fields so newer edits cannot look saved.
  fresh.locator('[data-action=content-practice]').click();fresh.locator('[data-action=content-task][data-id=p2]').click();fresh.locator('#content-answer').fill(answer)
  fresh.evaluate('()=>{window.__append=__app.explore.store.append;__app.explore.store.append=async(...args)=>{await new Promise(r=>window.__releaseResponse=r);return __append(...args)};}')
  fresh.locator('[data-action=check-content-answer]').click();expect(fresh.locator('#content-answer')).to_be_disabled();expect(fresh.locator('[data-action=skip-content-answer]')).to_be_disabled()
  check('In-flight responses cannot be edited into a misleading saved state')
  fresh.evaluate('()=>{__releaseResponse();__app.explore.store.append=__append;}');expect(fresh.locator('.content-feedback')).to_contain_text('Matched');fresh.locator('[data-action=practice-return]').first.click()
  # Phone/RTL/focus and 200% CSS zoom (not native browser zoom).
  fresh.set_viewport_size({'width':390,'height':844});fresh.locator('[data-action=restart-content]').click();fresh.locator('.reader-token.annotated').first.click();expect(fresh.locator('#word-sheet')).to_be_visible()
  check('Arabic phone panel has keyboard focus inside its modal',fresh.evaluate('document.querySelector("#word-sheet").contains(document.activeElement)'))
  audit(fresh,'phone-word-sheet');shot(fresh,'reader-context-phone-rtl.png');fresh.keyboard.press('Escape')
  check('Escape returns keyboard focus to selected Arabic expression',fresh.evaluate('document.activeElement.classList.contains("reader-token")'))
  for width in [1024,768,390,320]:
   fresh.set_viewport_size({'width':width,'height':900});check('No horizontal overflow at '+str(width),fresh.evaluate('document.documentElement.scrollWidth<=innerWidth'))
  fresh.evaluate('document.documentElement.style.zoom="2"');check('200% CSS zoom reflows',fresh.evaluate('document.documentElement.scrollWidth<=innerWidth'));shot(fresh,'reader-200-percent-css.png');fresh.evaluate('document.documentElement.style.zoom=""')
  fresh.set_viewport_size({'width':1440,'height':1000});fresh.locator('[data-action=restart-content]').click();fresh.locator('.reader-token.annotated').first.click();audit(fresh,'reader-desktop');shot(fresh,'reader-context-desktop.png')
  # Same account storage on actual SQLite, then a completely new UI instance.
  H.signup(fresh,'mvp_reader');H.nav(fresh,'explore');check('Signup does not silently transfer guest reading history',fresh.locator('.explore-resume').count()==0)
  fresh.locator('[data-action=open-content][data-id=the-key]').last.click();fresh.locator('.reader-token.annotated').first.click();fresh.locator('[data-action=save-support-word]').click();H.settle(fresh);H.sync(fresh)
  fresh.locator('[data-action=close-word-panel]').first.click();fresh.locator('[data-segment=s5]').scroll_into_view_if_needed();fresh.evaluate('__app.explore.flushPosition()');fresh.evaluate('__app.explore.store.sync()')
  persisted=client.get('/api/content-progress').json()['events'];check('Content source/progress reaches actual account SQLite',any(e['kind']=='position' and e['contentId']=='the-key' for e in persisted))
  next_page=load();next_page.wait_for_function('()=>__app.state.user?.handle==="mvp_reader"');next_page.evaluate('__app.explore.store.sync()');H.nav(next_page,'explore');expect(next_page.locator('.explore-resume')).to_contain_text('The key')
  check('Fresh account UI loads server-confirmed progress without guest history')
  # Real queued write under deliberate transport failure, then sync recovery.
  next_page.locator('.explore-resume button').click();next_page.evaluate('__networkDown=true');next_page.locator('[data-action=finish-content]').click();next_page.evaluate('__app.explore.store.sync()');expect(next_page.locator('[data-action=retry-content-progress]')).to_be_visible()
  check('Offline progress reports device-only pending data rather than false sync',next_page.evaluate('__app.explore.store.getState().pending')>0)
  next_page.evaluate('__networkDown=false');next_page.locator('[data-action=retry-content-progress]').click();next_page.wait_for_function('()=>__app.explore.store.getState().pending===0');check('Working retry sends the pending event to actual server')
  next_page.locator('[data-action=go][data-view=explore]').last.click();next_page.set_viewport_size({'width':390,'height':844});audit(next_page,'explore-phone');shot(next_page,'explore-phone.png')
  cached=load(next_page.evaluate('__idbFixture.snapshot()'),offline=True);H.nav(cached,'explore')
  cached.locator('[data-action=open-content][data-id=the-key]').last.click();check('Cold offline start restores the remembered private account and content',cached.evaluate('__app.explore.store.getState().owner')==cached.evaluate('__app.state.user.id'))
  cached.locator('[data-action=finish-content]').click();check('Cold offline edits stay queued on device',cached.evaluate('__app.explore.store.getState().pending')>0)
  cached.evaluate('window.__networkDown=false');cached.locator('[data-action=retry-content-progress]').click();cached.wait_for_function('()=>__app.explore.store.getState().pending===0&&__app.explore.store.getState().status==="synced"')
  check('Checking connection after cold offline startup drains progress without reload')
  check('No unexpected uncaught browser exceptions',not errors);browser.close()
if __name__=='__main__':
 failure=None
 try:main()
 except Exception:failure=traceback.format_exc();print(failure,flush=True)
 (OUT/'browser-results.json').write_text(json.dumps({'passed':len(checks),'checks':checks,'errors':errors,'contrast':contrast,'screenshots':shots,'failure':failure,'boundary':__doc__},indent=2))
 if failure:sys.exit(1)
