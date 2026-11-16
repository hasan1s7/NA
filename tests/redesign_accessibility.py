"""Focused reflow, keyboard, RTL and computed contrast checks, not a complete WCAG audit.
Uses shipping bundle with explicit existing URL/storage/fetch fixtures. No native zoom claim.
"""
from pathlib import Path
import sys,json,tempfile,re,traceback
from fastapi.testclient import TestClient
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT));sys.path.insert(0,str(ROOT/'tests'))
import next_browser as H
from redesign_browser import text,choose
from server import create_app
OUT=ROOT/'verification/redesign';checks=[];errors=[];contrasts=[]
def check(name,ok=True):
 assert ok,name
 checks.append(name);print('PASS',name,flush=True)
AUDIT=r'''() => {
const rgb=s=>{const a=(s.match(/[\d.]+/g)||[]).map(Number);return [a[0]||0,a[1]||0,a[2]||0,a.length>3?a[3]:1]};
const blend=(a,b)=>a.slice(0,3).map((v,i)=>v*a[3]+b[i]*(1-a[3])).concat(1);
const lum=c=>c.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
const background=e=>{const stack=[];for(let x=e;x;x=x.parentElement)stack.push(rgb(getComputedStyle(x).backgroundColor));return stack.reverse().reduce((b,a)=>blend(a,b),[255,255,255,1])};
const root=document.querySelector('dialog[open]')||document.body;const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let n;const fails=[],checks=[];
while(n=w.nextNode()){
 const e=n.parentElement,s=getComputedStyle(e),r=e.getBoundingClientRect();if(!n.textContent.trim()||['SCRIPT','STYLE','OPTION'].includes(e.tagName)||!e.checkVisibility()||r.width===0||r.height===0||r.bottom<0||r.top>innerHeight||e.closest('.sr-only')||e.closest(':disabled'))continue;
 const bg=background(e),fg=blend(rgb(s.color),bg),a=lum(bg),b=lum(fg),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05),size=parseFloat(s.fontSize),large=size>=24||(size>=18.66&&parseInt(s.fontWeight)>=700),min=large?3:4.5;
 const v={text:n.textContent.trim().slice(0,70),ratio:+ratio.toFixed(2),minimum:min,foreground:s.color,background:bg.slice(0,3)};checks.push(v);if(ratio<min)fails.push(v);
}
return {checked:checks.length,failures:fails,minimum:checks.length?Math.min(...checks.map(x=>x.ratio)):null};
}'''
def audit(page,label):
 result=page.evaluate(AUDIT);contrasts.append({'screen':label,**result});check('Computed visible text contrast: '+label,not result['failures'])
 missing=page.locator('[data-action]:visible').evaluate_all('els=>els.filter(e=>typeof __app.actions[e.dataset.action]!=="function").map(e=>e.dataset.action)')
 check('Visible action handlers exist: '+label,not missing)
def main():
 with tempfile.TemporaryDirectory() as tmp:
  app=create_app(Path(tmp)/'a11y.sqlite3','http://testserver',invite='',translation_key='')
  with TestClient(app,headers={'Origin':'http://testserver'}) as client,sync_playwright() as p:
   browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
   page=browser.new_page(viewport={'width':1440,'height':1000});page.set_default_timeout(8000);page.on('pageerror',lambda e:errors.append(str(e)))
   def request(source,req):
    r=client.request(req['method'],req['path'],headers={**req['headers'],'Origin':'http://testserver'},content=req.get('body'));return {'status':r.status_code,'data':r.json()}
   page.expose_binding('__apiCall',request);page.evaluate(H.fixture);page.set_content(H.html);expect(page.locator('#translation-input')).to_be_visible();page.wait_for_function('()=>__app.state.backend?.offlineSync')
   audit(page,'quick-lookup');H.nav(page,'reader');audit(page,'empty-reader')
   text(page,'I want to read the book. There is water on the table.\n\n'+'A quiet afternoon with a book and a cup of water.\n\n'*40,'A longer reading test')
   # Click a late token after manual scroll; no automatic seeking or reset.
   late=page.locator('.reader-token').filter(has_text=re.compile('^water$')).nth(20);late.scroll_into_view_if_needed();late.focus();before=page.evaluate('scrollY');late.click();H.settle(page)
   check('Selecting a word preserves a manually scrolled reading position',abs(page.evaluate('scrollY')-before)<2)
   page.evaluate('window.__readingNode=document.querySelector("#reader-text");window.dispatchEvent(new Event("nabu-sync"));');page.wait_for_timeout(150)
   check('Passive updates retain document node and manual scroll',page.evaluate('__readingNode===document.querySelector("#reader-text")') and abs(page.evaluate('scrollY')-before)<2)
   page.locator('[data-action="close-word-panel"]').first.click()
   check('Returning restores the actual clicked late word',page.evaluate('document.activeElement.dataset.index')==late.get_attribute('data-index'))
   text(page,'I want to read the book. Water stays here.','Phrase selection test')
   page.evaluate('''()=>{const root=document.querySelector('#reader-text'),tokens=[...root.querySelectorAll('.reader-token')];const start=tokens.find(e=>e.textContent==='read'),end=tokens.find(e=>e.textContent==='book');const range=document.createRange();range.setStart(start.firstChild,0);range.setEnd(end.firstChild,4);const s=getSelection();s.removeAllRanges();s.addRange(range);}''')
   expect(page.locator('#reader-selection-button')).to_be_visible();page.locator('#reader-selection-button').click();H.settle(page)
   check('Highlighted phrase uses the original selection and sentence',page.locator('#support-word').inner_text()=='read the book' and 'I want to read the book.' in page.locator('.word-source').inner_text())
   # Long unbroken text/definition, safe text and layout stress, no dictionary claim.
   text(page,'Pneumonoultramicroscopicsilicovolcanoconiosis '+'x'*160+'.','An exceptionally long heading '+('reader '*23))
   choose(page,'Pneumonoultramicroscopicsilicovolcanoconiosis');page.locator('[data-action="add-manual"]').click();page.locator('#card-back').fill('Long learner-entered definition. '*45);page.locator('#card-submit').click();expect(page.locator('#modal')).not_to_be_visible()
   audit(page,'long-definition-desktop')
   for width in [1024,768,390,320]:
    page.set_viewport_size({'width':width,'height':900})
    if page.evaluate('document.documentElement.scrollWidth>innerWidth'):
     (OUT/'overflow-diagnostic.json').write_text(json.dumps(page.evaluate('''()=>[...document.querySelectorAll('body *')].filter(e=>e.checkVisibility()&&e.getBoundingClientRect().right>innerWidth+1).map(e=>({tag:e.tagName,id:e.id,cls:e.className,text:e.textContent.slice(0,80),width:e.getBoundingClientRect().width,right:e.getBoundingClientRect().right,display:getComputedStyle(e).display}))'''),indent=2))
    check(f'Reading and panel fit {width}px width',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
    audit(page,f'long-definition-{width}')
    if width==768:page.screenshot(path=str(OUT/'read-tablet.png'),full_page=False)
    if width==390:page.screenshot(path=str(OUT/'read-long-phone.png'),full_page=False)
   # Nested modal and image are user-chosen. Fields live behind explicit expansion.
   page.locator('.word-save [data-action="show-context"]').click();expect(page.locator('#modal')).to_be_visible();page.locator('#word-note').fill('A retained note from a small screen.')
   page.locator('#word-context-form .word-details summary').click();page.locator('input[name=imageId][value=book]').check();page.locator('#word-context-form [type=submit]').click();expect(page.locator('#context-save-status')).to_contain_text('Saved')
   H.close(page);expect(page.locator('#word-sheet')).to_be_visible();check('Nested note editor returns to original word sheet with saved note',H.snap(page)['cards'][-1]['note']=='A retained note from a small screen.')
   page.keyboard.press('Escape');page.set_viewport_size({'width':390,'height':844});page.evaluate('document.documentElement.style.zoom="2"')
   if page.evaluate('document.documentElement.scrollWidth>innerWidth'):
    (OUT/'zoom-overflow.json').write_text(json.dumps(page.evaluate('''()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,elements:[...document.querySelectorAll('body *')].filter(e=>e.checkVisibility()&&e.getBoundingClientRect().right>innerWidth+1).map(e=>({tag:e.tagName,id:e.id,cls:e.className,text:e.textContent.slice(0,80),width:e.getBoundingClientRect().width,right:e.getBoundingClientRect().right,display:getComputedStyle(e).display}))})'''),indent=2))
    page.screenshot(path=str(OUT/'zoom-overflow.png'),full_page=False)
   check('Phone reading fits at 200% CSS zoom',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
   page.screenshot(path=str(OUT/'read-phone-200-percent.png'),full_page=False)
   page.evaluate('document.documentElement.style.zoom=""');page.set_viewport_size({'width':1440,'height':1000})
   H.nav(page,'translate');page.locator('.workspace-tabs [data-view=graph]').click();audit(page,'word-bank');page.locator('#graph-search').fill('notinthedictionary123');expect(page.locator('#graph-results')).to_contain_text('No matching entries');page.locator('[data-action=reset-graph]').click();expect(page.locator('.graph-row')).to_have_count(60);check('Empty word-bank filter has a working reset')
   H.nav(page,'library');audit(page,'library');page.locator('#settings-nav').click();audit(page,'settings')
   for width in [390,320]:
    page.set_viewport_size({'width':width,'height':844});check(f'Settings fit {width}px width',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
   # Names on visible interactive controls; native select labels are checked by existing markup.
   unnamed=page.locator('button:visible,a:visible').evaluate_all("es=>es.filter(e=>!(e.textContent.trim()||e.getAttribute('aria-label')||e.getAttribute('aria-labelledby')||e.title)).map(e=>e.outerHTML)")
   check('Visible buttons and links have accessible text or names',not unnamed)
   check('No uncaught browser errors in edge-case checks',not errors);browser.close()
if __name__=='__main__':
 failure=None
 try:main()
 except Exception:failure=traceback.format_exc();print(failure,flush=True)
 (OUT/'accessibility-results.json').write_text(json.dumps({'passed':len(checks),'checks':checks,'contrast':contrasts,'pageErrors':errors,'failure':failure,'boundary':__doc__},indent=2))
 if failure:sys.exit(1)
