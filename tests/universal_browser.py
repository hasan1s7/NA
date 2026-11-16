"""Focused UI verification for Nabu 1.12.2 universal word + phrase support.
Uses the repository's explicit URL/IndexedDB/fetch fixtures with actual FastAPI/SQLite.
This is not native browser persistence, audible speech, or deployed hosting evidence.
"""
from pathlib import Path
import sys,tempfile,json,traceback,re
ROOT=Path(__file__).resolve().parents[1];sys.path[:0]=[str(ROOT),str(ROOT/'tests')]
from fastapi.testclient import TestClient
from server import create_app
from playwright.sync_api import sync_playwright,expect
import next_browser as H
OUT=ROOT/'verification/universal-1.12.2';OUT.mkdir(parents=True,exist_ok=True)
checks=[];errors=[];shots=[]
def check(name,ok=True):
    assert ok,name;checks.append(name);print('PASS',name,flush=True)
def shot(page,name):
    page.evaluate('document.querySelector("#toast").hidden=true');page.screenshot(path=str(OUT/name),full_page=False);shots.append(name)

def main():
  with tempfile.TemporaryDirectory() as tmp, TestClient(create_app(Path(tmp)/'ui.sqlite3','http://testserver',invite='',translation_key=''),headers={'Origin':'http://testserver'}) as client, sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    page=browser.new_page(viewport={'width':1440,'height':960});page.set_default_timeout(9000);page.on('pageerror',lambda e:errors.append(str(e)))
    def req(source,q):
      r=client.request(q['method'],q['path'],headers={**q['headers'],'Origin':'http://testserver'},content=q.get('body'))
      try:value=r.json()
      except:value={'detail':r.text[:300]}
      return {'status':r.status_code,'data':value}
    page.expose_binding('__apiCall',req);page.evaluate(H.fixture);page.set_content(H.html);expect(page.locator('#translation-input')).to_be_visible()
    H.nav(page,'reader')
    page.locator('#target-language').select_option('fr');page.locator('#source-language').select_option('es');page.locator('#target-language').select_option('en')
    page.locator('#reader-title').fill('Una mañana')
    page.locator('#reader-input').fill('Buenos días! Quiero agua, por favor. Hoy leo un poco.')
    page.locator('[data-action=read-text]').click();expect(page.locator('#reader-text')).to_be_visible()
    word=page.locator('.reader-token').filter(has_text=re.compile('^días$'));word.click()
    expect(page.locator('.phrase-suggestions')).to_be_visible();expect(page.locator('.phrase-chip')).to_contain_text('Buenos días')
    check('Selecting a word surfaces a checked phrase from the same passage')
    page.locator('.phrase-chip').first.click();expect(page.locator('#support-word')).to_contain_text('Buenos días')
    expect(page.locator('.word-definition')).to_contain_text('Good morning')
    expect(page.locator('.word-details > summary')).to_have_text('Read more')
    check('Phrase opens one short meaning with secondary detail behind Read more')
    check('Original passage stays untouched',page.locator('#reader-text').inner_text()=='Buenos días! Quiero agua, por favor. Hoy leo un poco.')
    shot(page,'spanish-phrase-desktop.png')
    page.set_viewport_size({'width':390,'height':844});expect(page.locator('#word-sheet')).to_be_visible();check('Phrase support remains usable as the mobile sheet',page.evaluate('document.documentElement.scrollWidth<=innerWidth'));shot(page,'spanish-phrase-phone.png')
    page.keyboard.press('Escape');
    # Direct phrase lookup for a no-space language remains available through the same reader contract.
    page.set_viewport_size({'width':1440,'height':960});page.locator('[data-action=edit-reader]').click();page.locator('#target-language').select_option('fr');page.locator('#source-language').select_option('ja');page.locator('#target-language').select_option('en');page.locator('#reader-input').fill('おはようございます。今日は本を読みます。');page.locator('[data-action=read-text]').click()
    # Intl.Segmenter can split the greeting; choose any inner token and the checked phrase is surfaced.
    page.locator('.reader-token').filter(has_text=re.compile('^ざ$')).click();expect(page.locator('.phrase-suggestions')).to_contain_text('おはようございます');check('Japanese phrase discovery works without spaces')
    check('No uncaught browser errors',not errors)
    browser.close()
  (OUT/'results.json').write_text(json.dumps({'passed':len(checks),'checks':checks,'errors':errors,'screenshots':shots,'boundary':__doc__},indent=2),encoding='utf-8')
if __name__=='__main__':
  failure=None
  try:main()
  except Exception:failure=traceback.format_exc();print(failure,flush=True)
  if failure:(OUT/'failure.txt').write_text(failure,encoding='utf-8');sys.exit(1)
