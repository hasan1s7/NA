"""Integrated UI + actual FastAPI/SQLite, with explicit URL, IndexedDB and
fetch fixtures. Native navigation is blocked by this runtime. This is NOT a
native persistence/cookie/HTTPS/service-worker or deployed-site test."""
from pathlib import Path
import sys,re,json,base64,hashlib,tempfile
from playwright.sync_api import sync_playwright,expect
from fastapi.testclient import TestClient
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
from server import create_app
OUT=ROOT/'next-test-results';OUT.mkdir(exist_ok=True)
checks=[];errors=[]
def check(name,condition=True):
    assert condition,name
    checks.append(name);print('PASS',name,flush=True)
def sig(text):return 'sha256-'+base64.b64encode(hashlib.sha256(text.encode()).digest()).decode()
BRIDGE=r'''
let testURL='http://testserver/';
const location={get href(){return testURL},get hash(){return new URL(testURL).hash},get search(){return new URL(testURL).search},get pathname(){return new URL(testURL).pathname},protocol:'http:',origin:'http://testserver'};
const history={pushState(s,t,url){testURL=String(url)},replaceState(s,t,url){testURL=new URL(String(url),testURL).href}};
const fetch=async(url,options={})=>{
 if(window.__networkDown)throw new Error('Offline test: no transport');
 const u=new URL(String(url),testURL);
 const out=await window.__apiCall({path:u.pathname,method:options.method||'GET',body:options.body,headers:options.headers||{}});
 if(window.__loseAckOnce&&u.pathname==='/api/sync'&&out.status===200){window.__loseAckOnce=false;throw new Error('Lost connection after server commit');}
 return new Response(JSON.stringify(out.data),{status:out.status,headers:{'Content-Type':'application/json'}});
};
'''
html=(ROOT/'public/index.html').read_text()
runtime=re.search(r'<script id="nabu-application">(.*?)</script>',html,re.S).group(1)
patched=runtime.replace('"use strict";','"use strict";'+BRIDGE,1).replace('boot();','window.__app={state,C,G,DB,api,actions,translate,useGraph,checkBackend,refreshSocial,activateAccount,readingTokens,readingContext,navigate,openShare,handleShare,render,currentURL:()=>location.href};boot();')
html=html.replace(runtime,patched).replace(sig(runtime),sig(patched))
fixture=(ROOT/'tests/idb-fixture.js').read_text().replace('export function','function')+'\ninstallIDBFixture(window);'
def nav(page,name):page.locator('#navigation [data-view="'+name+'"]').click()
def snap(page):return page.evaluate('window.__app.DB.snapshot()')
def settle(page):page.wait_for_function('() => !__app.state.translation.busy && !__app.state.translation.saving')
def sync(page):
    page.evaluate('window.__app.DB.syncNow()')
    page.wait_for_function('() => __app.DB.syncStatus().pending===0')
def close(page):
    if page.locator('#modal').evaluate('(el)=>el.open'):page.locator('#modal [data-action="close-modal"]').last.click()
def translate(page,text):
    nav(page,'translate');page.locator('#translation-input').fill(text);page.locator('#translation-input').press('Enter');settle(page)
    if page.locator('[data-action="choose-sense"]').count():page.locator('[data-action="choose-sense"]').first.click();settle(page)
def signup(page,name):
    nav(page,'exchange');page.locator('[data-action="auth"][data-mode="register"]').click()
    page.locator('#auth-handle').fill(name);page.locator('#auth-password').fill('UI secure password 123!')
    page.locator('#auth-form [type="submit"]').click();page.wait_for_function('(name)=>__app.state.user?.handle===name',arg=name)
    expect(page.locator('#recovery-code')).to_be_visible();code=page.locator('#recovery-code').input_value();close(page);return code

def login(page,name,password='UI secure password 123!'):
    nav(page,'exchange');page.locator('[data-action="auth"][data-mode="login"]').click()
    page.locator('#auth-handle').fill(name);page.locator('#auth-password').fill(password)
    page.locator('#auth-form [type="submit"]').click();page.wait_for_function('(name)=>__app.state.user?.handle===name',arg=name)
    expect(page.locator('#modal')).not_to_be_visible()
def refresh(page):page.evaluate('window.__app.refreshSocial()')
def shot(page,name):
    page.evaluate('document.querySelector("#toast").hidden=true');page.screenshot(path=str(OUT/name),full_page=True)

def main():
 with tempfile.TemporaryDirectory() as tmp:
  app=create_app(Path(tmp)/'ui.sqlite3','http://testserver',invite='',translation_key='')
  with TestClient(app,headers={'Origin':'http://testserver'}) as lifetime,sync_playwright() as p:
   browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
   clients=[]
   def load():
    client=TestClient(app,headers={'Origin':'http://testserver'});clients.append(client)
    page=browser.new_page(viewport={'width':1440,'height':1080});page.on('pageerror',lambda e:errors.append(str(e)))
    def request(source,req):
     res=client.request(req['method'],req['path'],headers={**req['headers'],'Origin':'http://testserver'},content=req.get('body'))
     try:body=res.json()
     except:body={'detail':res.text[:500]}
     return {'status':res.status_code,'data':body}
    page.expose_binding('__apiCall',request);page.evaluate(fixture);page.set_content(html)
    expect(page.locator('#translation-input')).to_be_visible();page.wait_for_function('() => __app.state.backend?.offlineSync===true');return page,client
   alice,ac=load();translate(alice,'water')
   check('Automatic guest lookup saves a Reference card, not forced homework',snap(alice)['cards'][0]['learningMode']=='reference')
   nav(alice,'review');alice.locator('[data-action="start-practice"]').click()
   expect(alice.locator('.practice-start')).to_contain_text('Nothing due');check('Reference-only library does not create a review task')
   code=signup(alice,'alice');check('Registration shows a private one-use recovery code',len(code)>40)
   check('Signing in does not automatically upload guest words',not snap(alice)['cards'])
   alice.locator('[data-action="import-local"]').click();alice.locator('[data-action="confirm-local-import"]').click();expect(alice.locator('#modal')).not_to_be_visible();sync(alice)
   check('Explicit guest import reaches real server',len(ac.get('/api/library').json()['cards'])==1)
   translate(alice,"It's a piece of cake.");sync(alice)
   expect(alice.locator('.translation-result')).to_have_text('Es muy f\u00e1cil.')
   expect(alice.locator('.literal-panel')).to_contain_text('Es un trozo de pastel.')
   alice.locator('#translation-output .breakdown summary').click()
   expect(alice.locator('.breakdown')).to_contain_text('When to use it');check('Phrase card exposes natural meaning, literal wording and draft provenance','draft' in alice.locator('.breakdown').inner_text())
   shot(alice,'01-rich-phrase-desktop.png')
   # Context is kept from a sentence rather than translating a pasted document silently.
   nav(alice,'reader');alice.locator('.reader-intake details > summary').click();alice.locator('[data-action="reader-example"]').click()
   alice.locator('.reader-token').filter(has_text=re.compile('^water$')).click();settle(alice)
   check('Reader lookup reuses a duplicate instead of creating a second card',len(snap(alice)['cards'])==2)
   alice.locator('[data-action="edit-reader"]').click();alice.locator('#reader-input').fill('Hello. The book is on the table. Goodbye.');alice.locator('[data-action="read-text"]').click()
   alice.locator('.reader-token').filter(has_text=re.compile('^book$')).click();settle(alice);alice.locator('[data-action="save-support-word"]').click();settle(alice)
   if alice.locator('[data-action="choose-sense"]').count():alice.locator('[data-action="choose-sense"]').first.click();settle(alice)
   sync(alice);book=next(c for c in snap(alice)['cards'] if c['front']=='book')
   check('Reading saves only the selected item with the surrounding sentence',book['context']=='The book is on the table.')
   check('Reader segmentation preserves the entire original text',alice.evaluate('()=>__app.readingTokens("\u4f60\u597d\uff0c\u6211\u8981\u6c34\u3002","zh-CN").map(x=>x.text).join("")==="\u4f60\u597d\uff0c\u6211\u8981\u6c34\u3002"'))
   shot(alice,'02-reader-desktop.png');alice.set_viewport_size({'width':390,'height':844});shot(alice,'03-reader-mobile.png')
   check('Reader and translation fit a narrow screen',alice.evaluate('document.documentElement.scrollWidth<=innerWidth'));alice.set_viewport_size({'width':1440,'height':1080})
   # Start learning just one card and exercise independent skill evidence.
   nav(alice,'library');alice.locator('[data-action="study-toggle"][data-id="'+book['id']+'"]').click();sync(alice)
   nav(alice,'review');alice.locator('#practice-mode').select_option('production');alice.locator('[data-action="start-practice"]').click()
   expect(alice.locator('.review-word')).to_have_text(book['back']);check('Production asks for the word, not the translation')
   alice.locator('[data-action="reveal"]').click();shot(alice,'04-review-desktop.png');alice.locator('[data-action="grade"][data-rating="4"]').click()
   alice.wait_for_function('()=>__app.state.logs.length===1');sync(alice)
   reviewed=next(c for c in ac.get('/api/library').json()['cards'] if c['id']==book['id'])
   check('Production review persists separately from recognition',reviewed['skills']['production']['reps']==1 and reviewed['schedule']['reps']==0)
   alice.locator('[data-action="undo-review"]').click();alice.wait_for_function('()=>__app.state.logs.length===0');sync(alice)
   check('Undo restores independent skill state',not ac.get('/api/library').json()['logs'])
   # Offline queue and ambiguous acknowledgment through UI.
   alice.evaluate('window.__networkDown=true');translate(alice,'coffee')
   check('Interrupted save is locally available with visible pending status',len(snap(alice)['cards'])==4 and 'pending' in alice.locator('#translation-output').inner_text())
   check('Offline account writes never spill into guest library',alice.evaluate('()=>__app.DB.localSnapshot().then(x=>x.cards.length)')==1)
   alice.evaluate('window.__networkDown=false;window.__loseAckOnce=true');alice.evaluate('__app.DB.syncNow()')
   alice.evaluate('__app.DB.syncNow()');sync(alice)
   check('Lost acknowledgment retries without duplicate server words',len(ac.get('/api/library').json()['cards'])==4)
   # Offline reinitialization uses cached identity, not an empty guest library.
   alice.evaluate('async()=>{window.__networkDown=true;__app.DB.lock();__app.state.user=null;await __app.checkBackend()}')
   check('Remembered account reopens its cached library while disconnected',alice.evaluate('__app.state.user?.handle')=='alice' and len(snap(alice)['cards'])==4)
   alice.evaluate('window.__networkDown=false');alice.evaluate('__app.checkBackend()');sync(alice)
   bob,bc=load();signup(bob,'bob');nav(alice,'exchange');alice.locator('#friend-handle').fill('bob');alice.locator('#friend-form [type="submit"]').click()
   alice.wait_for_function('()=>__app.state.friends.outgoing.length===1');refresh(bob);bob.locator('[data-action="accept-friend"]').click();bob.wait_for_function('()=>__app.state.friends.friends.length===1');refresh(alice)
   check('Two real accounts request and accept friendship',len(ac.get('/api/friends').json()['friends'])==1)
   alice.locator('[data-action="send-friend"]').click();alice.locator('#share-picker .recent-row').filter(has_text='water').click();alice.locator('#send-form [type="submit"]').click();expect(alice.locator('#modal')).not_to_be_visible()
   refresh(bob);bob.locator('[data-action="accept-exchange"]').click();bob.wait_for_function('()=>__app.state.cards.length===1');sync(bob)
   check('Direct word exchange imports a fresh independent card',snap(bob)['cards'][0]['schedule']['reps']==0)
   alice.locator('[data-action="publish-library"]').click();alice.locator('#publish-title').fill('Our travel words');alice.locator('input[name="recipients"][value="bob"]').check();alice.locator('#publish-library-form [type="submit"]').click();expect(alice.locator('#modal')).not_to_be_visible()
   refresh(alice);alice.locator('[data-action="open-shared"]').click()
   alice.locator('summary').filter(has_text='Contributor permissions').click();alice.locator('[data-action="member-role"][data-handle="bob"]').click()
   expect(alice.locator('[data-role="viewer"][data-handle="bob"]')).to_have_text('Make viewer');close(alice)
   refresh(bob);bob.locator('[data-action="open-shared"]').click();expect(bob.locator('.collection-meta')).to_contain_text('contributor')
   bob.locator('[data-action="propose-entry"]').filter(has_text='Propose a word').click();bob.locator('#proposal-front').fill('ticket');bob.locator('#proposal-back').fill('billete');bob.locator('#proposal-usage').fill('Transport ticket; regional wording varies.');bob.locator('#proposal-form [type="submit"]').click()
   expect(bob.locator('.proposal-card')).to_contain_text('pending');check('Contributor proposals remain unpublished until owner approval')
   close(bob);refresh(alice);alice.locator('[data-action="open-shared"]').click();alice.locator('[data-action="decide-proposal"][data-status="accepted"]').click();expect(alice.locator('.collection-meta')).to_contain_text('Version 2')
   expect(alice.locator('.shared-preview-list')).to_contain_text('ticket');shot(alice,'05-collaboration-desktop.png');check('Owner approval creates a new collection version and change history',alice.locator('.change-event').count()>0)
   check('Shared approval does not overwrite the owner private library',len(ac.get('/api/library').json()['cards'])==4);close(alice)
   refresh(bob);bob.locator('[data-action="open-shared"]').click();bob.locator('[data-action="import-shared"]').click();expect(bob.locator('#modal')).not_to_be_visible();sync(bob)
   check('Collaborative collection import preserves duplicates and fresh private progress',len(snap(bob)['cards'])==5 and all(c['schedule']['reps']==0 for c in snap(bob)['cards']))
   shot(bob,'06-friends-desktop.png');bob.set_viewport_size({'width':390,'height':844});shot(bob,'07-friends-mobile.png');check('Friends interface has no mobile horizontal overflow',bob.evaluate('document.documentElement.scrollWidth<=innerWidth'))
   # Fresh authenticated session sees server-confirmed data; ordinary signout removes cache.
   alice2,ac2=load();login(alice2,'alice');check('Second sign-in sees confirmed library from another device',len(snap(alice2)['cards'])==4)
   uid=alice.evaluate('__app.state.user.id');nav(alice,'exchange');alice.locator('[data-action="logout"]').click();alice.wait_for_function('()=>__app.state.user===null')
   check('Signout removes account cache but retains guest words',alice.evaluate('(uid)=>__app.DB.getMeta("account-cache:"+uid)',uid) is None and len(snap(alice)['cards'])==1)
   # Recover account through the actual form, invalidate existing session.
   alice.locator('[data-action="auth"][data-mode="login"]').click();alice.locator('[data-action="forgot-password"]').click();alice.locator('#recover-handle').fill('alice');alice.locator('#recover-code').fill(code);alice.locator('#recover-password').fill('Replacement secure password!');alice.locator('#recovery-form [type="submit"]').click()
   expect(alice.locator('#recovery-code')).to_be_visible();check('Recovery rotates code and ends other sessions',alice.locator('#recovery-code').input_value()!=code and ac2.get('/api/session').json()['user'] is None);close(alice)
   login(alice,'alice','Replacement secure password!');check('Password recovery retains the account library',len(snap(alice)['cards'])==4)
   # A known expired session must not become unlocked merely by going offline.
   alice2.evaluate('__app.checkBackend()');alice2.evaluate('window.__networkDown=true');alice2.evaluate('__app.checkBackend()')
   check('Known expired account stays locked when subsequently offline',alice2.evaluate('__app.state.user===null'))
   check('No uncaught JavaScript errors throughout integrated flows',not errors)
   browser.close()
   for client in clients:client.close()
 (OUT/'results.json').write_text(json.dumps({'passed':len(checks),'checks':checks,'pageErrors':errors,'boundaries':['URL/history fixture','in-memory IndexedDB fixture; not native durability','fetch bridge with actual API/SQLite and TestClient cookies','no native navigation, HTTPS, service-worker or production hosting verification'],'liveProviderCalls':0},indent=2))
if __name__=='__main__':main()
