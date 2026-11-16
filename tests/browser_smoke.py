"""Hosted smoke test of unmodified shipping HTML and real browser storage.
Run against an HTTP(S) deployment in an environment that permits navigation:
  python tests/browser_smoke.py --url http://127.0.0.1:8080/
No storage/provider fixtures, imports of internal app code or paid API requests.
Uses isolated ephemeral browser contexts; does not touch your existing profile.
"""
from __future__ import annotations
import argparse, json
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url', default='http://127.0.0.1:8080/')
parser.add_argument('--chromium', default=None, help='Optional path to Chromium')
parser.add_argument('--output', default='hosted-test-results')
args=parser.parse_args()
if not args.url.startswith(('http://','https://')):
    parser.error('--url must be an HTTP(S) address')
out=Path(args.output);out.mkdir(parents=True,exist_ok=True)
checks=[];errors=[]
def check(name, condition=True):
    if not condition: raise AssertionError(name)
    checks.append(name); print('PASS', name, flush=True)
def records(page):
    return page.evaluate('''() => new Promise((resolve,reject)=>{
      const request=indexedDB.open('nabu-translate-remember',1);
      request.onerror=()=>reject(request.error);
      request.onsuccess=()=>{const db=request.result;
        const tx=db.transaction(['cards','logs'],'readonly');let cards,logs;
        tx.objectStore('cards').getAll().onsuccess=e=>{cards=e.target.result};
        tx.objectStore('logs').getAll().onsuccess=e=>{logs=e.target.result};
        tx.oncomplete=()=>{db.close();resolve({cards,logs})};
        tx.onabort=()=>{db.close();reject(tx.error)};
      };
    })''')
def nav(page, view):
    page.locator('#navigation [data-view="'+view+'"]').click()
def translate(page, text):
    page.locator('#translation-input').fill(text)
    page.locator('#translation-input').press('Enter')
    expect(page.locator('#translation-output .save-status')).to_contain_text('Saved')

try:
    with sync_playwright() as p:
        opts={'headless':True,'args':['--no-sandbox']}
        if args.chromium: opts['executable_path']=args.chromium
        browser=p.chromium.launch(**opts)
        context=browser.new_context(viewport={'width':1440,'height':1000},accept_downloads=True)
        page=context.new_page();page.on('pageerror',lambda error:errors.append(str(error)))
        requested=[];page.on('request',lambda request:requested.append(request.url))
        page.goto(args.url,wait_until='domcontentloaded')
        expect(page.locator('#translation-input')).to_be_visible()
        check('Fresh hosted app boots with an empty native database',not records(page)['cards'])
        translate(page,'water')
        expect(page.locator('.translation-result')).to_have_text('agua')
        check('Translation automatically commits a real IndexedDB card',len(records(page)['cards'])==1)
        page.reload();expect(page.locator('#translation-input')).to_be_visible()
        check('Saved word persists across a full native reload',len(records(page)['cards'])==1)
        translate(page,'water');check('Repeat translation does not duplicate',len(records(page)['cards'])==1)
        page.locator('[data-action="graph-target"][data-language="ar"]').click()
        expect(page.locator('#translation-output .save-status')).to_contain_text('Saved')
        page.locator('[data-action="swap"]').click()
        expect(page.locator('#translation-output .save-status')).to_contain_text('Saved')
        page.locator('[data-action="graph-target"][data-language="ja"]').click()
        expect(page.locator('#translation-output .save-status')).to_contain_text('Saved')
        check('Arabic-to-Japanese works through the UI',page.locator('.translation-result').inner_text()=='\u6c34')
        check('No provider translation request was required',not any('/api/translate' in u or 'mymemory' in u for u in requested))
        page.screenshot(path=str(out/'translate-desktop.png'),full_page=True)
        nav(page,'library');page.locator('[data-action="study-toggle"]').first.click()
        nav(page,'review');page.locator('#practice-mode').select_option('recognition');page.locator('[data-action="start-practice"]').click();page.locator('[data-action="reveal"]').click()
        page.locator('[data-action="grade"][data-rating="4"]').click()
        page.wait_for_timeout(250)
        data=records(page)
        check('Real review updates persist',len(data['logs'])==1 and any(c['schedule']['reps']==1 for c in data['cards']))
        page.reload();expect(page.locator('.review-word, .practice-start').first).to_be_visible()
        check('Review history survives native reload',len(records(page)['logs'])==1)
        nav(page,'translate');page.locator('.workspace-tabs [data-view="graph"]').click();expect(page.locator('.graph-row')).to_have_count(60);expect(page.locator('#graph-count')).to_contain_text('1,026')
        page.locator('[data-action="graph-word"][data-id="food.water"]').first.click()
        expect(page.locator('.graph-selected .save-status')).to_contain_text('Saved')
        page.set_viewport_size({'width':390,'height':844})
        check('Graph fits mobile viewport',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
        nav(page,'library');page.screenshot(path=str(out/'library-mobile.png'),full_page=True)
        check('Library fits mobile viewport',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
        page.locator('#avatar').click()
        with page.expect_download() as download:
            page.locator('[data-action="export-backup"]').click()
        file=out/'backup.json';download.value.save_as(file)
        backup=json.loads(file.read_text())
        check('JSON backup includes committed cards and review history',len(backup['cards'])==len(records(page)['cards']) and len(backup['logs'])==1)
        nav(page,'translate')
        page.locator('#source-language').select_option('en')
        page.locator('#target-language').select_option('es')
        translate(page,'water')
        with page.expect_download() as download:
            page.locator('#avatar').click();page.locator('[data-action="export-graph"]').click()
        file=out/'graph.json';download.value.save_as(file)
        check('Graph export is readable JSON',isinstance(json.loads(file.read_text()),dict))
        # Wait for the matching service worker and its cached self-contained page.
        nav(page,'translate')
        page.evaluate('() => navigator.serviceWorker.ready.then(()=>true)')
        await_controller='() => !!navigator.serviceWorker.controller'
        page.wait_for_function(await_controller,timeout=15000)
        expected_count=len(records(page)['cards'])
        context.set_offline(True);page.reload(wait_until='domcontentloaded')
        expect(page.locator('#translation-input')).to_be_visible(timeout=20000)
        check('Cached app reloads offline without replacing the library',len(records(page)['cards'])==expected_count)
        translate(page,'coffee');expect(page.locator('.translation-result')).to_have_text('caf\u00e9')
        check('Offline vocabulary lookup and native auto-save work')
        context.set_offline(False)
        check('No uncaught application errors',not errors)
        browser.close()
except Exception as error:
    (out/'results.json').write_text(json.dumps({'status':'failed','passed':checks,'error':str(error),'pageErrors':errors},indent=2))
    raise
(out/'results.json').write_text(json.dumps({'status':'passed','count':len(checks),'checks':checks,'pageErrors':errors},indent=2))
