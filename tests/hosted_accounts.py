"""Opt-in native browser acceptance check for a deployed Nabu server.
Creates two throwaway accounts, exercises real cookies/IndexedDB/offline sync,
and deletes those accounts in cleanup. Does not touch existing users' libraries.
No provider requests. Must be run where ordinary browser navigation is permitted.
"""
import argparse,json,secrets
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--url',required=True);p.add_argument('--allow-test-accounts',action='store_true');p.add_argument('--chromium');p.add_argument('--output',default='hosted-account-results')
a=p.parse_args()
if not a.allow_test_accounts:p.error('Pass --allow-test-accounts to authorize temporary account creation and deletion.')
if not a.url.startswith(('https://','http://localhost:','http://127.0.0.1:')):p.error('Use HTTPS, or an explicit localhost test server.')
out=Path(a.output);out.mkdir(parents=True,exist_ok=True);checks=[];cleanup=[]
def check(text):checks.append(text);print('PASS',text,flush=True)
def nav(page,v):page.locator('#navigation [data-view="'+v+'"]').click()
def synced(page):
 expect(page.locator('#translation-output .save-status')).to_contain_text('Synced',timeout=30000)
 expect(page.locator('#connection')).to_contain_text('/ synced',timeout=30000)
def signup(page,handle,password):
 nav(page,'exchange');page.locator('[data-action="auth"][data-mode="register"]').click();page.locator('#auth-handle').fill(handle);page.locator('#auth-password').fill(password);page.locator('#auth-form [type="submit"]').click();expect(page.locator('#recovery-code')).to_be_visible();code=page.locator('#recovery-code').input_value();page.locator('#modal [data-action="close-modal"]').last.click();return code
with sync_playwright() as pw:
 opts={'headless':True}
 if a.chromium:opts['executable_path']=a.chromium
 browser=pw.chromium.launch(**opts);contexts=[];accounts=[]
 try:
  for _ in range(2):
   ctx=browser.new_context();contexts.append(ctx);page=ctx.new_page();page.goto(a.url);expect(page.locator('#translation-input')).to_be_visible();handle='test_'+secrets.token_hex(5);password=secrets.token_urlsafe(24);code=signup(page,handle,password);accounts.append((page,handle,password,code))
  alice,handle,password,code=accounts[0];bob,bhandle,_,_=accounts[1];check('Two temporary accounts use native session cookies')
  nav(alice,'translate');alice.locator('#translation-input').fill('water');alice.locator('#translation-input').press('Enter');synced(alice);expect(alice.locator('.translation-result')).to_have_text('agua')
  alice.reload();expect(alice.locator('#translation-input')).to_be_visible();nav(alice,'library');expect(alice.locator('.word-card')).to_have_count(1);check('Confirmed account word survives native reload')
  nav(alice,'translate');contexts[0].set_offline(True);alice.locator('#translation-input').fill('coffee');alice.locator('#translation-input').press('Enter');expect(alice.locator('.save-status')).to_contain_text('pending');contexts[0].set_offline(False);synced(alice);check('Offline account write synchronizes through real IndexedDB and cookies')
  nav(alice,'exchange');alice.locator('#friend-handle').fill(bhandle);alice.locator('#friend-form [type="submit"]').click();expect(alice.locator('.friend-row')).to_contain_text('Pending');nav(bob,'exchange');bob.locator('[data-action="refresh-social"]').click();bob.locator('[data-action="accept-friend"]').click();check('Native two-account friendship request and acceptance')
  # Recovery is separately covered against the real API in fixture UI tests.
  # Native smoke leaves credentials unchanged so cleanup remains deterministic.
  (out/'results.json').write_text(json.dumps({'status':'passed','checks':checks},indent=2))
 finally:
  for page,handle,password,_ in accounts:
   try:
    page.locator('#settings-nav').click();page.locator('[data-action="delete-account"]').click();page.locator('#delete-password').fill(password);page.locator('#delete-account-form [type="submit"]').click();expect(page.locator('#modal')).not_to_be_visible();cleanup.append({'handle':handle,'deleted':True})
   except Exception:cleanup.append({'handle':handle,'deleted':False})
  (out/'cleanup.json').write_text(json.dumps(cleanup,indent=2));browser.close()
  if any(not item['deleted'] for item in cleanup):print('Some temporary accounts need operator cleanup; see cleanup.json. No passwords were logged.')
