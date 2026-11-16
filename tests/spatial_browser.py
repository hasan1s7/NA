from pathlib import Path
import sys,tempfile,json
from playwright.sync_api import sync_playwright,expect
from fastapi.testclient import TestClient
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import next_browser as H
from server import create_app
OUT=Path(__file__).resolve().parents[1]/'verification'/'spatial'
OUT.mkdir(parents=True,exist_ok=True)
checks=[];errors=[]
with tempfile.TemporaryDirectory() as tmp:
 app=create_app(Path(tmp)/'test.sqlite3','http://testserver',invite='',translation_key='')
 with TestClient(app,headers={'Origin':'http://testserver'}) as client,sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
  page=browser.new_page(viewport={'width':1440,'height':1000})
  page.on('pageerror',lambda e:errors.append(str(e)))
  def request(source,req):
   res=client.request(req['method'],req['path'],headers={**req['headers'],'Origin':'http://testserver'},content=req.get('body'))
   try: data=res.json()
   except: data={'detail':res.text[:500]}
   return {'status':res.status_code,'data':data}
  page.expose_binding('__apiCall',request)
  page.evaluate(H.fixture)
  page.set_content(H.html)
  expect(page.locator('#translation-input')).to_be_visible()
  page.locator('[data-view="graph"]').first.click();page.locator('[data-disclosure-key="meaning-map"] > summary').click()
  expect(page.locator('.spatial-switch [data-mode="2d"]')).to_have_attribute('aria-pressed','true')
  checks.append('2D default')
  expect(page.locator('.map-card.map-language')).to_have_count(5)
  checks.append('5 prioritized translation nodes')
  page.locator('[data-action="graph-all-languages"]').click()
  expect(page.locator('.map-card.map-language')).to_have_count(11)
  checks.append('all 11 alternate languages can be displayed')
  page.locator('[data-action="graph-all-languages"]').click()
  page.locator('#graph-main-canvas').screenshot(path=str(OUT/'nabu-2d-desktop.png'))
  page.locator('.spatial-switch [data-mode="3d"]').click()
  expect(page.locator('.spatial-switch [data-mode="3d"]')).to_have_attribute('aria-pressed','true')
  checks.append('3D optional toggle')
  page.locator('#graph-azimuth').fill('55')
  expect(page.locator('#graph-azimuth')).to_have_value('55')
  checks.append('3D rotation control')
  page.locator('#graph-main-canvas').screenshot(path=str(OUT/'nabu-3d-desktop.png'))
  page.locator('.spatial-switch [data-mode="2d"]').click()
  page.locator('.map-language[data-language="es"]').first.click()
  H.settle(page)
  expect(page.locator('.graph-selected')).to_be_visible()
  checks.append('graph translation node selection')
  page.set_viewport_size({'width':390,'height':844})
  page.locator('#graph-main-canvas').screenshot(path=str(OUT/'nabu-2d-mobile.png'))
  checks.append('mobile visual capture')
  page.set_viewport_size({'width':1440,'height':1000})
  page.evaluate('() => __app.useGraph("expressions.fly_elephant","ru","en")')
  H.settle(page)
  page.locator('#graph-main-canvas').screenshot(path=str(OUT/'russian-expression-2d.png'))
  expect(page.locator('.map-card.map-component')).to_have_count(4)
  checks.append('Russian idiom shows four grammatical components')
  assert page.evaluate('''() => [...document.querySelectorAll('.map-card text')].every(e=>{const t=e.getBoundingClientRect();return t.width<500})''')
  checks.append('long labels are bounded')
  page.locator('.spatial-switch [data-mode="3d"]').click()
  page.locator('#graph-main-canvas').screenshot(path=str(OUT/'russian-expression-3d.png'))
  checks.append('Russian expression graph captured in 2D and 3D')
  assert not errors,errors
  browser.close()
(OUT/'results.json').write_text(json.dumps({'passed':len(checks),'checks':checks,'errors':errors},indent=2))
print(json.dumps({'passed':len(checks),'checks':checks,'errors':errors},indent=2))
