"""Run the shipping app in isolated Chromium with real IndexedDB.
Optional --record captures the UI. A temporary loopback static server serves
public/; no real account, user data, provider or remote media is accessed.
"""
import argparse
import functools
import http.server
import json
from pathlib import Path
import threading
from playwright.sync_api import sync_playwright, expect

ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output',default=str(ROOT/'support-cycle-browser-results'))
parser.add_argument('--record',action='store_true')
args=parser.parse_args();out=Path(args.output);out.mkdir(parents=True,exist_ok=True)
class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(QuietHandler,directory=str(ROOT/'public')))
threading.Thread(target=server.serve_forever,daemon=True).start()
url=f'http://127.0.0.1:{server.server_port}/'
checks=[];errors=[]
def check(name,condition=True):
    assert condition,name
    checks.append(name);print('PASS '+name,flush=True)
def hold(page,ms=1300):
    if args.record:page.wait_for_timeout(ms)
def records(page):
    return page.evaluate('''() => new Promise((resolve,reject)=>{
      const r=indexedDB.open('nabu-translate-remember',1);r.onerror=()=>reject(r.error);
      r.onsuccess=()=>{const db=r.result,t=db.transaction(['cards','logs','meta'],'readonly'),result={};
        for(const name of ['cards','logs','meta'])t.objectStore(name).getAll().onsuccess=e=>result[name]=e.target.result;
        t.oncomplete=()=>{db.close();resolve(result)};t.onabort=()=>reject(t.error);};})''')
def events(page):return next((r['value']['events'] for r in records(page)['meta'] if r['id']=='nabu.content.v1:guest'),[])
try:
    with sync_playwright() as p:
        b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
        options={'viewport':{'width':1280,'height':960},'accept_downloads':True}
        if args.record:options.update(record_video_dir=str(out),record_video_size={'width':1280,'height':960})
        context=b.new_context(**options);page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(url,wait_until='domcontentloaded');expect(page.locator('#translation-input')).to_be_visible();check('Standalone app boots with native IndexedDB')
        page.locator('#navigation [data-view="reader"]').click();page.locator('#reader-input').fill('A short passage I chose to read.');page.locator('[data-action="read-text"]').click()
        expect(page.locator('#reader-text')).to_be_visible();original=page.locator('#reader-text').inner_text()
        page.locator('.reading-tools').evaluate('(el)=>el.open=true');panel=page.locator('#nabu-support-cycle');panel.scroll_into_view_if_needed();hold(page,2000)
        page.locator('[data-action="support-save"]').click();expect(panel).to_contain_text('saved material');check('Explicit save creates one existing reference card',len(records(page)['cards'])==1)
        page.locator('#support-task').select_option('support:fr:meaning');page.locator('[data-action="support-start"]').click();expect(page.locator('#support-answer')).to_be_visible();hold(page)
        page.locator('[data-action="support-cue"][data-id="translation"]').click();expect(page.locator('.support-cue').first).to_contain_text("I haven't");hold(page,1800)
        page.locator('#support-answer').fill("I haven't talked to him about it.");hold(page,800);page.locator('[data-action="support-submit"]').click();expect(page.locator('.support-result')).to_contain_text('WITH SUPPORT');hold(page,1800)
        first=next(e for e in events(page) if e.get('cycle',{}).get('observation')=='response');check('A real response freezes its prior translation opening',next(s for s in first['cycle']['supportSnapshot'] if s['id']=='translation')['openedAt'] is not None)
        page.locator('[data-action="support-feedback"]').click();expect(page.locator('.support-result blockquote')).to_be_visible();hold(page,1500);page.locator('[data-action="support-finish"]').click()
        check('Reader source remains in place',page.locator('#reader-text').inner_text()==original)
        panel.scroll_into_view_if_needed();page.locator('#support-task').select_option('support:fr:variation');page.locator('[data-action="support-start"]').click();expect(page.locator('#support-answer')).to_be_visible();hold(page,1800)
        page.locator('#support-answer').fill("I haven't talked to her about it yet.");hold(page,800);page.locator('[data-action="support-submit"]').click();expect(page.locator('.support-result')).to_contain_text('WITHOUT EXTRA AIDS');hold(page,1800);page.locator('[data-action="support-finish"]').click();check('A fresh context can provide independent meaning recall')
        panel.scroll_into_view_if_needed();page.locator('#support-task').select_option('support:fr:uncertain');page.locator('[data-action="support-start"]').click();expect(page.locator('#support-answer')).to_be_visible();hold(page,1300);page.locator('#support-answer').fill("I haven't talked to him about it.");page.locator('[data-action="support-submit"]').click();expect(page.locator('.support-result')).to_contain_text('needs review');hold(page,1800)
        page.locator('[data-action="support-correct"]').click();expect(page.locator('[role="status"]')).to_contain_text('replayed');hold(page,1800);check('Reviewed transcript correction replays instead of blaming the learner')
        page.locator('[data-action="support-finish"]').click();panel.scroll_into_view_if_needed();panel.locator('details').evaluate('(el)=>el.open=true');hold(page,1800)
        with page.expect_download() as download:page.locator('[data-action="support-export"]').click()
        audit_path=out/'support-cycle-audit.json';download.value.save_as(audit_path);audit=json.loads(audit_path.read_text());check('Audit includes original scores and corrected projections',audit['projection']['rows'][-1]['historicalScoring']['outcome']=='abstain' and audit['projection']['rows'][-1]['scoring']['outcome']=='correct')
        before=records(page);page.reload();expect(page.locator('#reader-input, #reader-text').first).to_be_visible();check('Native storage survives reload',len(events(page))==len(audit['events']) and len(records(page)['cards'])==1)
        check('No SRS logs were fabricated',records(page)['logs']==[])
        page.locator('#navigation [data-view="library"]').click();page.set_viewport_size({'width':390,'height':844});expect(page.locator('#nabu-support-cycle')).to_be_visible();check('Mobile panel fits viewport',page.evaluate('document.documentElement.scrollWidth<=innerWidth'));page.screenshot(path=str(out/'support-cycle-mobile.png'),full_page=True)
        check('No uncaught application errors',not errors)
        video=page.video;context.close()
        if args.record and video:video.save_as(str(out/'Nabu-Support-Cycle-Demo.webm'))
        b.close()
finally:
    server.shutdown();server.server_close();(out/'verification.json').write_text(json.dumps({'checks':checks,'errors':errors},indent=2)+'\n')
