"""Focused UI verification for Nabu 1.13 structural ambiguity support.
Uses the repository's existing IndexedDB/fetch fixtures and actual FastAPI/SQLite.
This verifies the authored structure-lens interaction, not general parsing ability.
"""
from pathlib import Path
import sys,tempfile,json,traceback,re
ROOT=Path(__file__).resolve().parents[1];sys.path[:0]=[str(ROOT),str(ROOT/'tests')]
from fastapi.testclient import TestClient
from server import create_app
from playwright.sync_api import sync_playwright,expect
import next_browser as H
OUT=ROOT/'verification/syntax-1.13.0';OUT.mkdir(parents=True,exist_ok=True)
checks=[];errors=[];shots=[]

def check(name,ok=True):
    assert ok,name;checks.append(name);print('PASS',name,flush=True)

def shot(page,name):
    page.evaluate('document.querySelector("#toast").hidden=true')
    page.screenshot(path=str(OUT/name),full_page=False);shots.append(name)

def main():
  with tempfile.TemporaryDirectory() as tmp, TestClient(create_app(Path(tmp)/'ui.sqlite3','http://testserver',invite='',translation_key=''),headers={'Origin':'http://testserver'}) as client, sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    page=browser.new_page(viewport={'width':1440,'height':980});page.set_default_timeout(9000);page.on('pageerror',lambda e:errors.append(str(e)))
    def req(source,q):
      r=client.request(q['method'],q['path'],headers={**q['headers'],'Origin':'http://testserver'},content=q.get('body'))
      try:value=r.json()
      except:value={'detail':r.text[:300]}
      return {'status':r.status_code,'data':value}
    page.expose_binding('__apiCall',req);page.evaluate(H.fixture);page.set_content(H.html);expect(page.locator('#translation-input')).to_be_visible()
    H.nav(page,'reader')
    page.locator('.reader-intake details > summary').click();page.locator('[data-action=reader-example]').click()
    expect(page.locator('#reader-text')).to_contain_text('researcher photographed the student with the telescope')
    page.locator('.reader-token').filter(has_text=re.compile('^student$')).click();H.settle(page)
    expect(page.locator('.syntax-lens > summary')).to_contain_text('Structure lens')
    check('Authored ambiguity is surfaced only after an in-context lookup')
    page.locator('.syntax-lens > summary').click()
    expect(page.locator('.syntax-analysis')).to_have_count(2)
    expect(page.locator('.syntax-status')).to_contain_text('unresolved')
    expect(page.locator('.syntax-diagnostic.recommended')).to_contain_text('Movement')
    check('Two plausible structures remain visible and movement is selected as the next informative test')
    before=page.evaluate('()=>({cards:__app.state.cards.length,logs:__app.state.logs.length})')
    page.locator('[data-action=syntax-run][data-diagnostic=movement]').click()
    expect(page.locator('.syntax-result')).to_contain_text('With the telescope')
    expect(page.locator('.syntax-status')).to_contain_text('Instrumental')
    check('Movement updates sentence-level relative support toward the instrumental analysis')
    page.locator('[data-action=syntax-run][data-diagnostic=coordination]').click()
    expect(page.locator('.syntax-result').filter(has_text='Inconclusive')).to_be_visible()
    check('Coordination can remain explicitly inconclusive instead of forcing a parse')
    after=page.evaluate('()=>({cards:__app.state.cards.length,logs:__app.state.logs.length})')
    check('Syntax diagnostics never mutate learner cards or review evidence',before==after)
    shot(page,'structure-lens-desktop.png')
    page.set_viewport_size({'width':390,'height':844})
    expect(page.locator('#word-sheet')).to_be_visible()
    check('Structure lens remains usable in the mobile word sheet',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
    shot(page,'structure-lens-phone.png')
    check('No uncaught browser errors',not errors)
    browser.close()
  (OUT/'results.json').write_text(json.dumps({'passed':len(checks),'checks':checks,'errors':errors,'screenshots':shots,'boundary':__doc__},indent=2),encoding='utf-8')

if __name__=='__main__':
  failure=None
  try:main()
  except Exception:failure=traceback.format_exc();print(failure,flush=True)
  if failure:(OUT/'failure.txt').write_text(failure,encoding='utf-8');sys.exit(1)
