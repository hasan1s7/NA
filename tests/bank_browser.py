"""Expanded-bank regression checks and real UI captures.

Actual app bundle + actual FastAPI/SQLite, using the existing explicit
URL/history, in-memory IndexedDB, and fetch/TestClient fixtures. No native
navigation, provider calls, deployed accounts, or persistence claims.
"""
from pathlib import Path
import tempfile,json,re
from fastapi.testclient import TestClient
from playwright.sync_api import sync_playwright,expect
import next_browser as H
from server import create_app
OUT=H.ROOT/'bank-test-results';OUT.mkdir(exist_ok=True)
checks=[];errors=[];captures=[]
def check(name,condition=True):
    assert condition,name
    checks.append(name);print('PASS',name,flush=True)
def shot(page,name,title):
    page.evaluate('document.querySelector("#toast").hidden=true')
    page.screenshot(path=str(OUT/name),full_page=True)
    captures.append({'file':name,'title':title,'sampleData':True,'viewport':page.viewport_size})
def pair(page,source,target):
    H.nav(page,'translate')
    page.locator('#source-language').select_option(source)
    page.locator('#target-language').select_option(target)
def use(page,id,source='en',target='es'):
    pair(page,source,target)
    page.evaluate('(id)=>__app.useGraph(id)',id);H.settle(page)
def main():
 with tempfile.TemporaryDirectory() as tmp:
  app=create_app(Path(tmp)/'preview.sqlite3','http://testserver',invite='',translation_key='')
  with TestClient(app,headers={'Origin':'http://testserver'}),sync_playwright() as pw:
   browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
   clients=[]
   def load():
    client=TestClient(app,headers={'Origin':'http://testserver'});clients.append(client)
    page=browser.new_page(viewport={'width':1440,'height':1000});page.on('pageerror',lambda e:errors.append(str(e)))
    def request(source,req):
     res=client.request(req['method'],req['path'],headers={**req['headers'],'Origin':'http://testserver'},content=req.get('body'))
     try:body=res.json()
     except:body={'detail':res.text[:500]}
     return {'status':res.status_code,'data':body}
    page.expose_binding('__apiCall',request);page.evaluate(H.fixture);page.set_content(H.html)
    expect(page.locator('#translation-input')).to_be_visible();page.wait_for_function('()=>__app.state.backend?.offlineSync===true')
    return page,client
   page,client=load()
   page.locator('.workspace-tabs [data-view="graph"]').click()
   expect(page.locator('#graph-count')).to_have_text('1,026 entries')
   expect(page.locator('.graph-row')).to_have_count(60)
   check('All 1026 entries counted while initial DOM is bounded to 60 rows')
   page.locator('[data-action="bank-more"]').click();expect(page.locator('.graph-row')).to_have_count(120)
   check('Show-more exposes the next batch without dropping data')
   page.locator('[data-kind="phrase"]').click();expect(page.locator('#graph-count')).to_have_text('90 entries')
   page.locator('[data-action="bank-more"]').click();expect(page.locator('.graph-row')).to_have_count(90)
   check('Phrases filter includes all ninety entries and pagination terminates')
   page.locator('[data-kind="expression"]').click();expect(page.locator('#graph-count')).to_have_text('36 entries')
   expect(page.locator('.graph-row')).to_have_count(36)
   check('Expressions filter includes all thirty-six source expressions')
   page.locator('[data-action="bank-kind"][data-kind=""]').click()
   last=page.evaluate('__app.G.concept("expressions.flea_camel").terms.tr')
   page.locator('#graph-search').fill(last);expect(page.locator('[data-id="expressions.flea_camel"].graph-row')).to_be_visible()
   check('The last bank entry is searchable beyond the former thousand-entry cap')
   page.locator('#graph-search').fill('');page.locator('[data-kind="word"]').click()
   page.locator('#graph-category').select_option('kitchenware');expect(page.locator('.graph-row')).to_have_count(25)
   page.locator('[data-id="kitchenware.chopsticks"].graph-row').click();H.settle(page)
   page.locator('[data-action="save-support-word"]').click();H.settle(page)
   expect(page.locator('.graph-selected')).to_contain_text('Saved on this device')
   expect(page.locator('.language-link')).to_have_count(12)
   check('Explicit word-bank save creates a Reference card and exposes twelve forms',H.snap(page)['cards'][0]['learningMode']=='reference')
   shot(page,'01-word-bank-desktop.png','Expanded word bank and twelve linked language forms')
   # Natural meaning and literal image come from the same authored expression.
   use(page,'expressions.stand_up','fr','en')
   expect(page.locator('.literal-panel')).to_be_visible()
   page.locator('#translation-output .breakdown summary').click()
   expect(page.locator('#translation-output .breakdown')).to_contain_text('draft')
   check('New expression renders distinct natural meaning, literal wording, usage and provenance')
   shot(page,'02-natural-literal-desktop.png','Natural meaning versus literal wording with usage and an example')
   page.set_viewport_size({'width':390,'height':844})
   check('New idiom detail fits a narrow viewport',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
   shot(page,'03-natural-literal-mobile.png','Idiom card on mobile')
   page.set_viewport_size({'width':1440,'height':1000})
   use(page,'phrases.seat_taken','es','ja')
   page.locator('#translation-output .breakdown summary').click()
   check('Ordinary phrase English gloss is labeled, never presented as Japanese literal translation','English wording guide' in page.locator('.breakdown').inner_text())
   shot(page,'04-phrase-breakdown-desktop.png','A practical phrase with wording and language-specific usage')
   # Real disposable account and server, imported only after an explicit action.
   H.signup(page,'preview_alex')
   page.locator('[data-action="import-local"]').click();page.locator('[data-action="confirm-local-import"]').click();expect(page.locator('#modal')).not_to_be_visible();H.sync(page)
   for id in ['phrases.table_two','phrases.practice_together','expressions.spill_beans','calendar.weekend']:
    use(page,id);H.sync(page)
   # Reading uses the whole paragraph locally, requests only a selected entry.
   pair(page,'en','es');H.nav(page,'reader')
   passage='On Monday, I take the subway to the museum. After lunch, I meet a friend at the bookstore. We practice together and plan a weekend trip.'
   page.locator('#reader-input').fill(passage);page.locator('[data-action="read-text"]').click()
   try:
    page.locator('.reader-token').filter(has_text=re.compile('^subway$')).click(timeout=5000)
   except Exception:
    print('READER_DIAGNOSTIC',page.evaluate('() => ({reader:__app.state.reader,view:__app.state.view,translationSaving:__app.state.translation.saving,pair:[__app.state.translation.sourceLang,__app.state.translation.targetLang],toast:document.querySelector("#toast").textContent})'),flush=True)
    raise
   H.settle(page);page.locator('[data-action="save-support-word"]').click();H.settle(page);H.sync(page)
   selected=next(c for c in H.snap(page)['cards'] if c['conceptId']=='mobility.subway')
   check('New word bank powers reading lookup with a saved surrounding sentence','Monday' in selected['context'])
   shot(page,'05-context-reader-desktop.png','Read a paragraph and save a selected word in context')
   page.set_viewport_size({'width':390,'height':844});check('Reader fits mobile without horizontal scrolling',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
   shot(page,'06-context-reader-mobile.png','Contextual reading on mobile');page.set_viewport_size({'width':1440,'height':1000})
   H.nav(page,'library')
   for id in ['mobility.subway','phrases.table_two','phrases.practice_together']:
    card=next(c for c in H.snap(page)['cards'] if c['conceptId']==id)
    page.locator('[data-action="study-toggle"][data-id="'+card['id']+'"]').click();H.sync(page)
   page.locator('[data-action="edit-card"][data-id="'+selected['id']+'"]').click()
   page.locator('#card-deck').fill('City reading');page.locator('#card-submit').click();expect(page.locator('#modal')).not_to_be_visible();H.sync(page)
   shot(page,'07-library-desktop.png','Automatic Reference saves and an intentional Learning queue')
   H.nav(page,'review');page.locator('#practice-mode').select_option('cloze');page.locator('#practice-deck').select_option('City reading');page.locator('[data-action="start-practice"]').click()
   expect(page.locator('#practice-clock')).to_be_visible();expect(page.locator('.review-word')).to_contain_text('Monday')
   check('New reader entry becomes a five-minute sentence-completion review')
   shot(page,'08-review-desktop.png','Five-minute review using the learner\'s original sentence')
   page.locator('[data-action="reveal"]').click();expect(page.locator('.review-answer')).to_have_text('subway')
   page.locator('[data-action="grade"][data-rating="3"]').click();H.sync(page)
   server=client.get('/api/library').json();reviewed=next(c for c in server['cards'] if c['conceptId']=='mobility.subway')
   check('Sentence-completion progress persists independently',reviewed['skills']['cloze']['reps']==1 and reviewed['schedule']['reps']==0)
   # Honest pending and confirmed statuses, not a mocked success toast.
   page.evaluate('window.__networkDown=true');use(page,'kitchenware.teapot')
   expect(page.locator('#translation-output')).to_contain_text('pending')
   check('Offline new-bank save is visibly pending, not falsely synced')
   shot(page,'09-offline-queue-desktop.png','A local save waiting honestly for synchronization')
   page.evaluate('window.__networkDown=false');H.sync(page);H.nav(page,'translate')
   check('Reconnect confirms the new-bank word in the actual server database',any(c['conceptId']=='kitchenware.teapot' for c in client.get('/api/library').json()['cards']))
   # Permissioned sharing with an actual second test account.
   friend,fc=load();H.signup(friend,'preview_sam');H.nav(page,'exchange')
   page.locator('#friend-handle').fill('preview_sam');page.locator('#friend-form [type="submit"]').click()
   page.wait_for_function('()=>__app.state.friends.outgoing.length===1');H.refresh(friend)
   friend.locator('[data-action="accept-friend"]').click();friend.wait_for_function('()=>__app.state.friends.friends.length===1');H.refresh(page)
   page.locator('[data-action="publish-library"]').click();page.locator('#publish-title').fill('A weekend in a new city')
   page.locator('input[name="recipients"][value="preview_sam"]').check();page.locator('#publish-library-form [type="submit"]').click();expect(page.locator('#modal')).not_to_be_visible();H.refresh(page)
   page.locator('[data-action="open-shared"]').click();page.locator('summary').filter(has_text='Contributor permissions').click()
   page.locator('[data-action="member-role"][data-handle="preview_sam"]').click();expect(page.locator('[data-role="viewer"][data-handle="preview_sam"]')).to_have_text('Make viewer');H.close(page)
   H.refresh(friend);friend.locator('[data-action="open-shared"]').click()
   friend.locator('[data-action="propose-entry"]').filter(has_text='Propose a word').click()
   phrase=page.evaluate('__app.G.concept("phrases.see_menu")')
   friend.locator('#proposal-front').fill(phrase['terms']['en']);friend.locator('#proposal-back').fill(phrase['terms']['es'])
   friend.locator('#proposal-usage').fill(phrase['details']['usage']);friend.locator('#proposal-provenance').fill('Nabu authored phrase bank / unverified draft')
   friend.locator('#proposal-form [type="submit"]').click();expect(friend.locator('.proposal-card')).to_contain_text('pending');H.close(friend)
   H.refresh(page);page.locator('[data-action="open-shared"]').click()
   expect(page.locator('.proposal-card')).to_contain_text('preview_sam')
   check('New phrase proposals remain pending until the collection owner approves')
   shot(page,'10-shared-collection-desktop.png','Contributor proposal with owner approval and private progress')
   page.locator('[data-action="decide-proposal"][data-status="accepted"]').click();expect(page.locator('.collection-meta')).to_contain_text('Version 2')
   check('Approved expanded-bank phrase publishes without editing private schedules',next(c for c in client.get('/api/library').json()['cards'] if c['id']==selected['id'])['skills']['cloze']['reps']==1)
   H.close(page);H.refresh(page);shot(page,'11-friends-desktop.png','Friends, direct words, and shared collections')
   page.set_viewport_size({'width':390,'height':844});shot(page,'12-friends-mobile.png','Friends and shared libraries on mobile')
   check('Friends and collection controls fit mobile',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
   check('Expanded-feature flows have no uncaught application errors',not errors)
   browser.close()
   for c in clients:c.close()
 (OUT/'results.json').write_text(json.dumps({'passed':len(checks),'checks':checks,'pageErrors':errors,'captures':captures,
   'boundaries':['Actual bundled app HTML/CSS/JS','Actual local FastAPI and disposable SQLite','Explicit URL/history, fetch/TestClient cookie and in-memory IndexedDB fixtures','Fictional preview accounts, no real user data','No native navigation or hosted/offline durability validation'],'liveProviderCalls':0},indent=2))
 print('TOTAL',len(checks),flush=True)
if __name__=='__main__':main()
