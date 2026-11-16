"""Explicit browser storage/transport fixtures with real isolated FastAPI/SQLite.
Not a native navigation, HTTP cookie or deployed-site test."""
from pathlib import Path
import json,sys,tempfile
from playwright.sync_api import sync_playwright,expect
from fastapi.testclient import TestClient
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import next_browser as H
from server import create_app
OUT=Path(__file__).resolve().parents[1]/"verification/local"
checks=[];errors=[]
def check(label,condition=True):
 assert condition,label
 checks.append(label);print("PASS",label,flush=True)
with tempfile.TemporaryDirectory() as tmp:
 app=create_app(Path(tmp)/"test.sqlite3","http://testserver",invite="",translation_key="fake-test:fx")
 requests=[]
 def provider(data):requests.append(data.text);return "Test translation"
 app.state.translate=provider
 with TestClient(app,headers={"Origin":"http://testserver"}) as client,sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path="/usr/bin/chromium",headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
  page=browser.new_page(viewport={"width":1440,"height":1000})
  page.on("pageerror",lambda e:errors.append(str(e)))
  def request(source,req):
   res=client.request(req["method"],req["path"],headers={**req["headers"],"Origin":"http://testserver"},content=req.get("body"))
   try:data=res.json()
   except:data={"detail":res.text[:200]}
   return {"status":res.status_code,"data":data}
  page.expose_binding("__apiCall",request);page.evaluate(H.fixture);page.set_content(H.html)
  expect(page.locator("#translation-input")).to_be_visible()
  page.wait_for_function("() => __app.state.backend?.offlineSync===true")
  page.locator('[data-view="graph"]').first.click()
  expect(page.locator(".graph-selected [data-action='save-support-word']")).to_have_text('Save word')
  check("Opening the default graph never falsely reports a saved card",not H.snap(page)["cards"])
  H.nav(page,"translate")
  page.locator("#translation-input").fill("water nonsenseunlisted")
  page.locator("[data-action=compose-translation]").first.click();H.settle(page)
  expect(page.locator("#translation-output .save-status")).to_contain_text("Not saved")
  check("Incomplete concatenation does not create a card",not H.snap(page)["cards"])
  expect(page.locator("#translation-output [data-action=retry-save]")).to_have_count(0)
  check("Incomplete composition offers editing rather than an endless retry")
  page.locator("#translation-input").fill("water book")
  page.locator("[data-action=compose-translation]").first.click();H.settle(page)
  cards=H.snap(page)["cards"]
  check("Complete assembly is saved only as a labeled Reference draft",len(cards)==1 and cards[0]["learningMode"]=="reference" and "concatenation" in cards[0]["provenance"])
  page.locator("#translation-input").fill("water")
  page.locator("[data-action=compose-translation]").first.click();H.settle(page)
  check("Exact-bank concatenate uses the real sense ID",any(c["conceptId"]=="food.water" for c in H.snap(page)["cards"]))
  H.signup(page,"localtester")
  H.nav(page,"translate")
  H.nav(page,'reader')
  page.locator("#reader-input").fill("The subway takes me to the museum.")
  page.evaluate("() => {window.__readerBeforeRefresh=document.querySelector('#reader-input'); document.querySelector('#reader-input').blur(); window.dispatchEvent(new Event('nabu-sync'));}")
  page.wait_for_timeout(250)
  check("Background sync preserves the reader input node and pasted draft",page.evaluate("() => window.__readerBeforeRefresh===document.querySelector('#reader-input') && __app.state.reader.draft==='The subway takes me to the museum.'"))
  page.locator('[data-action="read-text"]').click()
  expect(page.locator(".reader-token").filter(has_text="subway")).to_be_visible()
  body={"text":"not in the bank","sourceLang":"en","targetLang":"fr"}
  page.evaluate("body => __app.api('translate',{method:'POST',body})",body)
  page.evaluate("body => __app.api('translate',{method:'POST',body})",body)
  page.locator("#settings-nav").click()
  expect(page.locator(".feature-tree .tree-node")).to_have_count(19)
  check("Settings and all nineteen feature-tree nodes render without the inherited missing-helper crash")
  page.locator("[data-action=translation-memory]").click()
  expect(page.locator("#modal-title")).to_have_text("Private translation memory")
  check("Settings exposes persisted memory stats",len(requests)==1 and "Server cache hits" in page.locator("#modal-body").inner_text())
  page.screenshot(path=str(OUT/"memory-desktop.png"))
  page.locator("[data-action=confirm-clear-memory]").click()
  page.locator("[data-action=clear-memory]").click()
  page.wait_for_function("() => !document.querySelector('#modal').open")
  stats=page.evaluate("() => __app.api('language-memory')")
  check("Confirmed clear removes memory but retains the provider-attempt counter",stats["entries"]==0 and stats["providerAttempts"]==1)
  page.set_viewport_size({"width":390,"height":844})
  page.locator("[data-action=translation-memory]").click()
  check("Memory dialog fits a phone viewport",page.evaluate("document.documentElement.scrollWidth<=innerWidth"))
  check("No uncaught page errors",not errors)
  browser.close()
(OUT/"local-ui.json").write_text(json.dumps({"passed":len(checks),"checks":checks,"errors":errors},indent=2))
