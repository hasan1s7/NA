"""Shipping HTML + real isolated API/SQLite. URL, IDB, and transport are fixtures.
No native SDK, HTTPS, cookie-jar or hosted deployment claim.
"""
from pathlib import Path
import json,re,tempfile
from fastapi.testclient import TestClient
from playwright.sync_api import sync_playwright,expect
import next_browser as H
from server import create_app
OUT=H.ROOT/'mobile-test-results';OUT.mkdir(exist_ok=True)
checks=[];errors=[]
def check(name,condition=True):
    assert condition,name
    checks.append(name);print('PASS',name,flush=True)
def main():
 with tempfile.TemporaryDirectory() as tmp:
  app=create_app(Path(tmp)/'mobile-links.sqlite3','http://testserver',invite='',translation_key='')
  with TestClient(app,headers={'Origin':'http://testserver'}),sync_playwright() as pw:
   browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
   clients=[];requests=[]
   def load(url='http://testserver/',offline=False):
    client=TestClient(app,headers={'Origin':'http://testserver'});clients.append(client)
    page=browser.new_page(viewport={'width':1360,'height':1000});page.on('pageerror',lambda e:errors.append(str(e)))
    def request(source,req):
     requests.append(req['path']);res=client.request(req['method'],req['path'],headers={**req['headers'],'Origin':'http://testserver'},content=req.get('body'))
     try:body=res.json()
     except:body={'detail':res.text[:300]}
     return {'status':res.status_code,'data':body}
    page.expose_binding('__apiCall',request);page.evaluate(H.fixture)
    html=H.html;runtime=re.search(r'<script id="nabu-application">(.*?)</script>',html,re.S).group(1)
    patched=runtime.replace("let testURL='http://testserver/';",'let testURL='+json.dumps(url)+';')
    patched=patched.replace("if(window.__loseAckOnce", "if(window.__loseLinkAckOnce&&u.pathname==='/api/word-links'&&out.status===201){window.__loseLinkAckOnce=false;throw new Error('Lost link acknowledgment');}\n if(window.__loseAckOnce")
    html=html.replace(runtime,patched).replace(H.sig(runtime),H.sig(patched))
    if offline:page.evaluate('window.__networkDown=true')
    page.set_content(html);expect(page.locator('#translation-input')).to_be_visible()
    return page,client
   owner,client=load();owner.wait_for_function('()=>__app.state.backend?.shortLinks===true');H.signup(owner,'alice')
   H.translate(owner,'water');H.sync(owner)
   owner.locator('#translation-output [data-action="share-card"]').click()
   expect(owner.locator('[data-action="create-short-link"]')).to_be_visible()
   check('Opening Share does not silently publish a word',client.get('/api/word-links').json()['links']==[])
   owner.locator('#link-expiry').select_option('7');owner.evaluate('window.__loseLinkAckOnce=true')
   owner.locator('[data-action="create-short-link"]').click();expect(owner.locator('#modal-error')).to_contain_text('Lost link acknowledgment')
   check('Lost acknowledgment leaves an actionable retry, not a false shared status',owner.locator('#share-url').count()==0)
   owner.locator('[data-action="create-short-link"]').click();expect(owner.locator('#share-url')).to_be_visible()
   url=owner.locator('#share-url').input_value();slug=url.rsplit('/',1)[1]
   check('Retry recovers the same server-issued short link',len(client.get('/api/word-links').json()['links'])==1 and len(url)<110)
   check('Readable link carries the word and both language codes','water-en-es-' in url and '#' not in url)
   owner.screenshot(path=str(OUT/'short-word-link-desktop.png'),full_page=True)
   owner.set_viewport_size({'width':390,'height':844});owner.screenshot(path=str(OUT/'short-word-link-mobile.png'),full_page=True)
   check('Sharing dialog fits a 390px screen',owner.evaluate('document.documentElement.scrollWidth<=innerWidth'))
   H.close(owner)
   reader,anon=load(url);expect(reader.locator('#card-front')).to_have_value('water')
   check('Anonymous short-link visitor receives a preview, not an automatic account or import',len(H.snap(reader)['cards'])==0)
   check('Short-link API is resolved at the server root','/api/word-links/'+slug in requests and not any('/w/api/' in x for x in requests))
   reader.locator('#card-form [type="submit"]').click();expect(reader.locator('#modal')).not_to_be_visible()
   saved=H.snap(reader)['cards'][0];check('Imported shared word starts with private fresh progress',saved['front']=='water' and saved['schedule']['reps']==0 and saved['note']=='')
   H.nav(owner,'exchange');owner.locator('[data-action="manage-links"]').click();expect(owner.locator('.managed-link')).to_have_count(1)
   owner.locator('[data-action="revoke-link"]').click();expect(owner.locator('.managed-links')).to_contain_text('No active links')
   blocked,_=load(url);expect(blocked.locator('#modal-title')).to_have_text('Word link unavailable')
   check('Revoked link cannot be imported through a fresh browser preview',blocked.locator('#card-form').count()==0)
   check('Revocation leaves a recipient copy untouched',len(H.snap(reader)['cards'])==1)
   H.close(owner);H.nav(owner,'library');check('Hosted navigation is a clean root-relative meaningful path',owner.evaluate('__app.currentURL()')=='http://testserver/library')
   check('Mobile content reserves space for bottom navigation',owner.evaluate('parseFloat(getComputedStyle(document.querySelector(".app-shell")).paddingBottom)>=80'))
   check('Ziggurat is embedded and visible without a logo network request',owner.locator('.brand-mark').first.get_attribute('src').startswith('data:image/svg+xml'))
   # Preserve expanded details during asynchronous sync redraws.
   H.translate(owner,"It's a piece of cake.");H.sync(owner)
   details=owner.locator('#translation-output .breakdown');details.locator('summary').click();owner.evaluate('__app.render()')
   expect(details).to_have_attribute('open','');check('Background render preserves the phrase breakdown the user opened','draft' in details.inner_text())
   # Old self-contained links still open; they are explicitly not revocable.
   legacy=owner.evaluate('()=>"http://testserver/#share="+__app.C.encodeShare(__app.state.cards[0],"Old sender")')
   old,_=load(legacy);expect(old.locator('#card-form')).to_be_visible();check('Legacy encoded links remain readable',old.locator('#modal-body').inner_text().find('unverified')>=0)
   offline,_=load(url,True);expect(offline.locator('#modal-title')).to_have_text('Word link unavailable')
   expect(offline.locator('#modal-body')).to_contain_text('Reconnect');check('Offline public-link opening does not reveal a stale cached snapshot',offline.locator('#card-form').count()==0)
   check('No uncaught JavaScript exceptions in new link/mobile interface flows',not errors)
   browser.close()
   for client in clients:client.close()
 (OUT/'results.json').write_text(json.dumps({'passed':len(checks),'checks':checks,'pageErrors':errors,'scope':'Actual shipping HTML and local API/SQLite; explicit IDB, URL/history and transport fixtures. No device or hosted claims.'},indent=2))
if __name__=='__main__':main()
