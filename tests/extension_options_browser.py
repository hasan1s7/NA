"""Connection UI with explicit Chrome permissions/storage and transport fixtures."""
import json,re,sys
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'verification/careful-media';EXT=ROOT/'chrome-extension'
checks=[];errors=[]
def check(name,ok=True):
 assert ok,name
 checks.append(name);print('PASS',name,flush=True)
MOCK=r'''
window.__stored={};window.__sessionCleared=false;window.__permission=true;window.__checked=[];
window.chrome={runtime:{id:'a'.repeat(32)},storage:{local:{async get(){return __stored},async set(x){Object.assign(__stored,x)},async remove(key){delete __stored[key]}},session:{async clear(){__sessionCleared=true}}},permissions:{async contains(){return false},async request(x){__checked.push(x);return __permission;}}};
window.fetch=async(url,options)=>{if(options.headers.Authorization.endsWith('b'.repeat(43)))return Response.json({detail:'This connection expired'},{status:401});return Response.json({accountId:'test-user',handle:'alice'})};
'''
def main():
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);page=b.new_page(viewport={'width':900,'height':900});page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept())
  html=re.sub(r'<script type="module".*?</script>','',(EXT/'options.html').read_text()).replace('<link rel="stylesheet" href="extension.css">','<style>'+(EXT/'extension.css').read_text()+'</style>');page.set_content(html);page.evaluate("()=>{"+MOCK+"}")
  common=re.sub(r'^export ','',(EXT/'common.js').read_text(),flags=re.M);script=re.sub(r'^import .*\n','',(EXT/'options.js').read_text(),flags=re.M);page.evaluate('(async()=>{'+common+script+'})()')
  expect(page.locator('#extension-id')).to_have_text('a'*32);check('Connection page shows installation-specific extension ID (fixture)')
  page.locator('#origin').fill('http://remote.example');page.locator('#token').fill('nabu_ext_'+'a'*43);page.locator('#connect').click();expect(page.locator('#status')).to_contain_text('Use HTTPS');check('Insecure remote server is rejected before credential transmission',not page.evaluate('__checked.length'))
  page.locator('#origin').fill('https://nabu.example');page.evaluate('__permission=false');page.locator('#connect').click();expect(page.locator('#status')).to_contain_text('not granted');check('Permission denial leaves no stored token',not page.evaluate('__stored.connection'))
  page.evaluate('__permission=true');page.locator('#token').fill('nabu_ext_'+'b'*43);page.locator('#connect').click();expect(page.locator('#status')).to_contain_text('expired');check('Server rejects invalid connection without storing credential',not page.evaluate('__stored.connection'))
  page.locator('#token').fill('nabu_ext_'+'a'*43);page.locator('#connect').click();expect(page.locator('#status')).to_contain_text('Connected to @alice');expect(page.locator('#token')).to_have_value('');check('Successful connection saves account scope, clears visible secret and old drafts',page.evaluate('__stored.connection.accountId')=='test-user' and page.evaluate('__sessionCleared'))
  check('Requested host permission matches only the configured origin',page.evaluate('__checked.at(-1).origins[0]')=='https://nabu.example/*')
  page.locator('#disconnect').click();expect(page.locator('#status')).to_contain_text('Local token and drafts removed');check('Explicit disconnect removes credentials and explains server revocation',not page.evaluate('__stored.connection'))
  check('No uncaught connection-page errors',not errors);b.close()
 (OUT/'extension-options-results.json').write_text(json.dumps({'passed':len(checks),'checks':checks,'pageErrors':errors,'boundaries':['DOM with mocked Chrome permissions/storage','Mock fetch responses; API authentication tested separately','Not a native permission prompt test']},indent=2)+'\n')
if __name__=='__main__':main()
