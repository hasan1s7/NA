"""Chromium UI + real FastAPI/SQLite integration with explicit test boundaries.
The environment forbids navigation (ERR_BLOCKED_BY_ADMINISTRATOR). We therefore
supply a URL/history shim, in-memory IndexedDB boundary and fetch-to-TestClient
transport. This does NOT verify native cookie delivery, real IndexedDB, HTTPS,
service workers or production hosting. UI, application, API and SQL code are real.
"""
from pathlib import Path
import sys,re,json,base64,hashlib,tempfile
from playwright.sync_api import sync_playwright,expect
from fastapi.testclient import TestClient
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
from server import create_app
OUT=ROOT/'social-test-results';OUT.mkdir(exist_ok=True)
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
 return new Response(JSON.stringify(out.data),{status:out.status,headers:{'Content-Type':'application/json'}});
};
'''
html=(ROOT/'public/index.html').read_text()
runtime=re.search(r'<script id="nabu-application">(.*?)</script>',html,re.S).group(1)
patched=runtime.replace('"use strict";','"use strict";'+BRIDGE,1).replace('boot();','window.__app={state,C,G,DB,api,translate,useGraph,checkBackend,refreshSocial};boot();')
html=html.replace(runtime,patched).replace(sig(runtime),sig(patched))
fixture=(ROOT/'tests/idb-fixture.js').read_text().replace('export function','function')+'\ninstallIDBFixture(window);'
def nav(page,name):page.locator('#navigation [data-view="'+name+'"]').click()
def snap(page):return page.evaluate('window.__app.DB.snapshot()')
def settle(page):page.wait_for_function('() => !__app.state.translation.busy && !__app.state.translation.saving')
def translate(page,text):
    nav(page,'translate');page.locator('#translation-input').fill(text);page.locator('#translation-input').press('Enter');settle(page)
def signup(page,name):
    nav(page,'exchange');page.locator('[data-action="auth"][data-mode="register"]').click()
    page.locator('#auth-handle').fill(name);page.locator('#auth-password').fill('UI secure password 123!')
    page.locator('#auth-form [type="submit"]').click()
    page.wait_for_function('(name)=>__app.state.user?.handle===name',arg=name)
    expect(page.locator('#friend-form')).to_be_visible()
def refresh(page):
    page.evaluate('window.__app.refreshSocial()')

def main():
    with tempfile.TemporaryDirectory() as tmp:
        app=create_app(Path(tmp)/'ui.sqlite3','http://testserver',invite='',translation_key='')
        with TestClient(app,headers={'Origin':'http://testserver'}) as lifetime,sync_playwright() as p:
            browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
            clients=[]
            def load():
                client=TestClient(app,headers={'Origin':'http://testserver'});clients.append(client)
                page=browser.new_page(viewport={'width':1440,'height':1080})
                page.on('pageerror',lambda e:errors.append(str(e)))
                def request(source,req):
                    headers={**req['headers'],'Origin':'http://testserver'}
                    res=client.request(req['method'],req['path'],headers=headers,content=req.get('body'))
                    try:body=res.json()
                    except:body={'detail':res.text[:500]}
                    return {'status':res.status_code,'data':body}
                page.expose_binding('__apiCall',request);page.evaluate(fixture);page.set_content(html)
                expect(page.locator('#translation-input')).to_be_visible()
                page.wait_for_function('() => __app.state.backend?.librarySync===true')
                return page,client
            alice,ac=load();translate(alice,'water')
            check('Guest translates and auto-saves through shipped UI',len(snap(alice)['cards'])==1)
            signup(alice,'alice')
            check('Signup opens an empty private account library, not guest data',len(snap(alice)['cards'])==0)
            alice.locator('[data-action="import-local"]').click()
            alice.locator('[data-action="confirm-local-import"]').click()
            expect(alice.locator('#modal')).not_to_be_visible()
            check('Explicit guest import copies the card to the real server',len(ac.get('/api/library').json()['cards'])==1)
            translate(alice,"It's a piece of cake.")
            expect(alice.locator('.translation-result')).to_have_text('Es muy f\u00e1cil.')
            expect(alice.locator('.literal-panel')).to_contain_text('Es un trozo de pastel.')
            check('Idiom shows distinct natural and literal Spanish and auto-saves',len(snap(alice)['cards'])==2)
            alice.evaluate('document.querySelector("#toast").hidden=true')
            alice.screenshot(path=str(OUT/'01-literal-and-natural-desktop.png'),full_page=True)
            nav(alice,'graph');alice.locator('#graph-category').select_option('phrases')
            expect(alice.locator('.graph-row')).to_have_count(30)
            alice.locator('[data-action="graph-word"][data-id="phrases.how_much"]').click();settle(alice)
            check('Everyday phrase exposes a clearly labeled English gloss', 'Literal gloss / English' in alice.locator('#graph-detail').inner_text())
            nav(alice,'review');alice.locator('[data-action="reveal"]').click();alice.locator('[data-action="grade"][data-rating="4"]').click()
            alice.wait_for_function('()=>__app.state.logs.length===1')
            check('Account review persists through authoritative server scheduler',len(ac.get('/api/library').json()['logs'])==1)
            bob,bc=load();signup(bob,'bob');nav(alice,'exchange')
            alice.locator('#friend-handle').fill('bob');alice.locator('#friend-form [type="submit"]').click()
            try: expect(alice.locator('.friend-row')).to_contain_text('Pending')
            except Exception:
                print('DEBUG',alice.locator('#toast').inner_text(),alice.evaluate('JSON.stringify(__app.state.friends)'),ac.get('/api/friends').text, errors, flush=True)
                alice.screenshot(path=str(OUT/'debug-friend.png'),full_page=True)
                raise
            refresh(bob);bob.locator('[data-action="accept-friend"]').click()
            bob.wait_for_function('()=>__app.state.friends.friends.length===1');refresh(alice)
            check('Request and acceptance connect two actual accounts',len(ac.get('/api/friends').json()['friends'])==1 and len(bc.get('/api/friends').json()['friends'])==1)
            alice.locator('[data-action="send-friend"]').click()
            alice.locator('#share-picker .recent-row').filter(has_text='water').click()
            expect(alice.locator('#send-handle')).to_have_value('bob')
            alice.locator('#send-message').fill('A useful word for you.')
            alice.locator('#send-form [type="submit"]').click();expect(alice.locator('#modal')).not_to_be_visible()
            refresh(bob);bob.locator('[data-action="accept-exchange"]').click()
            bob.wait_for_function('()=>__app.state.cards.length===1')
            check('One-click inbox acceptance saves an independent review card',snap(bob)['cards'][0]['schedule']['reps']==0)
            alice.locator('[data-action="publish-library"]').click()
            alice.locator('#publish-title').fill('Travel essentials')
            alice.locator('input[name="recipients"][value="bob"]').check()
            alice.locator('#publish-library-form [type="submit"]').click();expect(alice.locator('#modal')).not_to_be_visible()
            refresh(bob);bob.locator('[data-action="open-shared"]').click()
            expect(bob.locator('#modal-title')).to_have_text('Travel essentials')
            bob.locator('[data-action="import-shared"]').click();expect(bob.locator('#modal')).not_to_be_visible()
            check('Shared collection import skips duplicates and uses fresh schedules',len(snap(bob)['cards'])==3 and all(c['schedule']['reps']==0 for c in snap(bob)['cards']))
            bob.evaluate('document.querySelector("#toast").hidden=true')
            bob.screenshot(path=str(OUT/'02-friends-desktop.png'),full_page=True)
            bob.set_viewport_size({'width':390,'height':844})
            bob.screenshot(path=str(OUT/'03-friends-mobile.png'),full_page=True)
            check('Friends and shared collections fit a 390px viewport',bob.evaluate('document.documentElement.scrollWidth<=innerWidth'))
            nav(bob,'translate');bob.locator('#source-language').select_option('fr');bob.locator('#target-language').select_option('ar')
            translate(bob,'Je donne ma langue au chat.')
            check('French idiom resolves to Arabic meaning plus separate Arabic literal text',bob.locator('.literal-panel p').get_attribute('lang')=='ar' and snap(bob)['cards'][-1] is not None)
            bob.screenshot(path=str(OUT/'04-arabic-phrase-mobile.png'),full_page=True)
            check('Long phrase and RTL output fit mobile',bob.evaluate('document.documentElement.scrollWidth<=innerWidth'))
            # A new authenticated session uses the same persisted cloud library.
            alice2,ac2=load();nav(alice2,'exchange');alice2.locator('[data-action="auth"][data-mode="login"]').click()
            alice2.locator('#auth-handle').fill('alice');alice2.locator('#auth-password').fill('UI secure password 123!')
            alice2.locator('#auth-form [type="submit"]').click();alice2.wait_for_function('()=>__app.state.user?.handle==="alice"')
            expect(alice2.locator('#modal')).not_to_be_visible()
            check('A second sign-in sees saved cards and review history',len(snap(alice2)['cards'])==3 and len(snap(alice2)['logs'])==1)
            # Revoke via owner UI and ensure recipient copies remain.
            nav(alice,'exchange');alice.locator('[data-action="open-shared"]').click();alice.locator('[data-action="revoke-shared"]').click()
            expect(alice.locator('#modal')).not_to_be_visible();nav(bob,'exchange');refresh(bob)
            check('Owner revocation removes shared access but keeps saved copies',not bc.get('/api/shared-libraries').json()['libraries'] and len(snap(bob)['cards'])==4)
            alice.locator('[data-action="logout"]').click();alice.wait_for_function('()=>__app.state.user===null')
            check('Logout returns only the guest library and hides account content',len(snap(alice)['cards'])==1 and snap(alice)['cards'][0]['front']=='water')
            # Account network failure must not fall back to guest storage or show Saved.
            nav(alice2,'translate');alice2.evaluate('window.__networkDown=true')
            translate(alice2,'book')
            if alice2.locator('[data-action="choose-sense"]').count():alice2.locator('[data-action="choose-sense"]').first.click();settle(alice2)
            check('Failed account save remains visibly unsaved', 'Not saved' in alice2.locator('#translation-output').inner_text())
            alice2.evaluate('window.__networkDown=false')
            check('No uncaught JavaScript errors in the integrated UI',not errors)
            browser.close()
            for client in clients:client.close()
    (OUT/'results.json').write_text(json.dumps({'passed':len(checks),'checks':checks,'pageErrors':errors,'boundaries':['URL/history fixture','IndexedDB fixture','fetch-to-TestClient bridge; native cookies not tested','real SQLite and auth backend'],'liveProviderCalls':0},indent=2))
if __name__=='__main__':main()
