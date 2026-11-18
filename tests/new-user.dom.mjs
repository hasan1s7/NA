/** Executes the shipping standalone bundle and its event handlers. The existing
 * in-memory IDB boundary verifies wiring, not real browser persistence/layout. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { webcrypto } from "node:crypto";
import { JSDOM, VirtualConsole } from "jsdom";
import { installIDBFixture } from "./idb-fixture.js";
import { newCard, LANGUAGES } from "../public/nabu-core.js";
import { sceneByLanguage, MOMENT_DAY } from "../public/nabu-moments.js";
import { supportTask } from "../public/nabu-support-tasks.js";
const html = await readFile(
  new URL("../public/index.html", import.meta.url),
  "utf8",
);
async function until(fn, label) {
  for (let i = 0; i < 1000; i++) {
    if (fn()) return;
    await new Promise((r) => setTimeout(r, 5));
  }
  throw Error("Timed out: " + label);
}
async function boot({
  url = "https://nabu.invalid/#new-user",
  seed = null,
} = {}) {
  let startupFinished = false;
  const failures = [],
    v = new VirtualConsole();
  v.on("jsdomError", (e) => {
    if (e.message !== "Could not parse CSS stylesheet")
      failures.push(e.message);
  });
  v.on("error", (...args) => failures.push(args.join(" ")));
  const old = newCard(
    {
      front: "preserve",
      back: "conservar",
      sourceLang: "en",
      targetLang: "es",
      note: "private old note",
      learningMode: "learning",
    },
    1000,
  );
  const dom = new JSDOM(html, {
    url,
    runScripts: "dangerously",
    pretendToBeVisual: true,
    virtualConsole: v,
    beforeParse(w) {
      const originalInterval = w.setInterval.bind(w);
      w.setInterval = (fn, delay, ...args) => {
        if (delay === 15000) startupFinished = true;
        return originalInterval(fn, delay, ...args);
      };
      w.structuredClone = structuredClone;
      w.Response = Response;
      w.TextEncoder = TextEncoder;
      Object.defineProperty(w.crypto, "subtle", { value: webcrypto.subtle });
      w.AbortController = AbortController;
      w.matchMedia = () => ({ matches: false, addEventListener() {} });
      w.scrollTo = () => {};
      w.scrollBy = () => {};
      w.fetch = async () => new Response("{}", { status: 503 });
      installIDBFixture(w, seed || { cards: [old] });
      w.HTMLDialogElement.prototype.showModal = function () {
        this.open = true;
      };
      w.HTMLDialogElement.prototype.close = function () {
        this.open = false;
        this.dispatchEvent(new w.Event("close"));
      };
    },
  });
  const w = dom.window,
    $ = (s) => w.document.querySelector(s);
  await until(
    () => startupFinished && $('#new-user-experience'),
    "new-user route",
  );
  const data = () => w.__idbFixture.snapshot(),
    events = () =>
      data().meta.find((r) => r.id === "nabu.content.v1:guest")?.value.events ||
      [];
  const click = (s) => {
    assert($(s), s);
    $(s).click();
  };
  return {
    dom,
    w,
    $,
    click,
    data,
    events,
    failures,
    old,
    close: () => w.close(),
  };
}
test('top New user route opens without a tutorial or synthetic responses and keeps old data', async()=>{
  const h=await boot();
  try {
    assert.equal(h.$('#new-user-tab').textContent,'New user');
    assert.equal(h.$('#new-user-tab').getAttribute('aria-current'),'page');
    assert(h.$('[data-action="nu-help"]'));
    assert.equal(h.events().length,0);
    assert.deepEqual(h.data().cards,[h.old]);
    h.click('#navigation [data-view="library"]');
    await until(()=>h.$('#new-user-tab').getAttribute('aria-current')===null,'normal library navigation');
    h.click('#new-user-tab');
    await until(()=>h.$('#new-user-experience'),'return to first steps');
    assert.equal(h.w.location.hash,'#new-user');
    assert.deepEqual(h.failures,[]);
  } finally {h.close();}
});

async function helpAndKeep(h,key='dream') {
  h.click(`[data-action="nu-select"][data-key="${key}"]`);
  h.click('[data-action="nu-help"]');
  await until(()=>h.$('.first-use-check [data-action="support-cue"]'),'friendly contextual help');
  h.click('[data-action="support-cue"]');
  await until(()=>h.events().some(e=>e.cycle?.observation==='support-opened'),'translation opening');
  await until(()=>!h.$('[data-action="support-finish"]').disabled,'help write settled');
  h.click('[data-action="support-finish"]');
  await until(()=>h.$('[data-action="nu-keep"]'),'save offered');
  h.click('[data-action="nu-keep"]');
  // The same real button must reject a rapid double click.
  h.$('[data-action="nu-keep"]')?.click();
  await until(()=>h.$('[data-action="nu-practice"]'),'saved phrase');
}

test('help, one durable Keep, a distinct scene and feedback use the existing evidence history',async()=>{
 const h=await boot();
 try {
  await helpAndKeep(h);
  assert.equal(h.events().filter(e=>e.kind==='moment' && e.moment.action==='keep').length,1);
  assert.equal(h.events().filter(e=>e.cycle?.observation==='response').length,0);
  h.click('[data-action="nu-practice"]');
  await until(()=>h.$('input[name="support-choice"]'),'real practice choices');
  assert.match(h.$('.first-use-check').textContent,/estación/);
  h.$('input[name="support-choice"][value="0"]').checked=true;
  h.click('[data-action="support-submit"]');
  await until(()=>h.$('[data-action="support-feedback"]'),'response saved');
  const response=h.events().find(e=>e.cycle?.observation==='response');
  assert.equal(response.cycle.taskRef.id,'moment-task:dream:next');
  assert.equal(response.cycle.scoring.outcome,'correct');
  const frozen=structuredClone(response.cycle.supportSnapshot);
  h.click('[data-action="support-feedback"]');
  await until(()=>h.$('[data-action="support-retry"]'),'feedback');
  assert.deepEqual(h.events().find(e=>e.id===response.id).cycle.supportSnapshot,frozen);
  h.click('[data-action="support-retry"]');
  await until(()=>h.$('input[name="support-choice"]'),'retry');
  h.$('input[name="support-choice"][value="0"]').checked=true;
  h.click('[data-action="support-submit"]');
  await until(()=>h.events().filter(e=>e.cycle?.observation==='response').length===2,'retry saved');
  const responses=h.events().filter(e=>e.cycle?.observation==='response');
  assert.equal(responses[0].cycle.episodeId,responses[1].cycle.episodeId);
  await until(()=>!h.$('[data-action="support-finish"]').disabled,'result settled');
  h.click('[data-action="support-finish"]');
  await until(()=>h.$('[data-action="nu-library"]'),'return to first steps');
  assert.equal(h.$('.nu-steps li:last-child').classList.contains('is-done'),false);
  assert.deepEqual(h.data().cards,[h.old]);
  const restored=await boot({seed:h.data()});
  try {
   assert.equal(restored.$('[data-key="dream"]').getAttribute('aria-pressed'),'true');
   assert(restored.$('[data-action="nu-library"]'));
   assert.equal(restored.$('.nu-steps li:last-child').classList.contains('is-done'),false);
   assert.equal(restored.events().filter(e=>e.kind==='moment').length,1);
   assert.deepEqual(restored.failures,[]);
  } finally {restored.close();}
  assert.deepEqual(h.failures,[]);
 } finally {h.close();}
});

test('failed Keep can retry without adding an event or changing existing schedules',async()=>{
 const h=await boot();
 try {
  h.click('[data-action="nu-help"]');
  await until(()=>h.$('.first-use-check [data-action="support-finish"]'),'help');
  h.click('[data-action="support-finish"]');
  await until(()=>h.$('[data-action="nu-keep"]'),'keep');
  h.w.__idbFixture.failNextWrite();
  h.click('[data-action="nu-keep"]');
  await until(()=>h.$('#nu-error')&&!h.$('#nu-error').hidden,'recoverable save error');
  assert.equal(h.events().filter(e=>e.kind==='moment').length,0);
  h.click('[data-action="nu-keep"]');
  await until(()=>h.$('[data-action="nu-practice"]'),'retry succeeds');
  assert.equal(h.events().filter(e=>e.kind==='moment').length,1);
  assert.deepEqual(h.data().cards,[h.old]);
 } finally {h.close();}
});

for (const [language, label] of LANGUAGES) test(`${label}: help, save, new-scene response, reload and later return work in the shipping UI`,async()=>{
 const h=await boot();
 try {
   const {key} = sceneByLanguage(language);
   h.click(`[data-action="nu-select"][data-key="${key}"]`);
   assert.equal(h.$('.nu-source').lang,language);
   assert.equal(h.$('.nu-source').getAttribute('dir'),'auto');
   await helpAndKeep(h,key);
   assert.equal(h.events().filter(e=>e.cycle?.observation==='encounter').at(-1).cycle.taskRef.id,`moment-task:${key}:first`);
   const next = supportTask(`moment-task:${key}:next`);
   h.click('[data-action="nu-practice"]');
   await until(()=>h.$('input[name="support-choice"]'),'matching new-scene check');
   assert.equal(h.$('.first-use-check blockquote').textContent,next.source);
   assert.equal(h.$('.first-use-check blockquote').lang,language);
   h.$(`input[name="support-choice"][value="${next.correctChoice}"]`).checked=true;
   h.click('[data-action="support-submit"]');
   await until(()=>h.$('[data-action="support-feedback"]'),'scored response');
   const response=h.events().find(e=>e.cycle?.observation==='response');
   assert.equal(response.cycle.taskRef.id,next.id);
   assert.equal(response.cycle.scoring.outcome,'correct');
   assert.equal(response.cycle.analysisRef.id,next.analysisRef.id);
   assert.equal(response.cycle.supportSnapshot.find(s=>s.id==='translation')?.openedAt,null);
   await until(()=>!h.$('[data-action="support-finish"]').disabled,'response write settled');
   h.click('[data-action="support-finish"]');
   await until(()=>!h.$('#modal').open,'close help');
   const restored=await boot({seed:h.data()});
   try {
    assert.equal(restored.$(`[data-key="${key}"]`).getAttribute('aria-pressed'),'true');
    assert.equal(restored.events().filter(e=>e.kind==='moment').length,1);
    assert.equal(restored.$('.nu-steps li:last-child').classList.contains('is-done'),false);
    // Test clock only: production never simulates the return or its evidence.
    const later=Date.now()+MOMENT_DAY+1000;
    restored.w.Date.now=()=>later;
    restored.click('#navigation [data-view="review"]');
    await until(()=>restored.$(`[data-action="moment-reopen"][data-id="moment:${key}"]`),'saved phrase in Review');
    restored.click(`[data-action="moment-reopen"][data-id="moment:${key}"]`);
    await until(()=>restored.$('.moment-dialog blockquote'),'return to original context');
    assert.equal(restored.$('.moment-dialog blockquote').textContent,sceneByLanguage(language).source);
    restored.click('#modal [data-action="close-modal"]');
    restored.click('#new-user-tab');
    await until(()=>restored.$('.nu-steps li:last-child')?.classList.contains('is-done'),'real delayed reopen');
    assert.equal(restored.events().filter(e=>e.cycle?.observation==='response').length,1,'return does not invent a response');
    assert.deepEqual(restored.failures,[]);
   } finally {restored.close();}
  assert.deepEqual(h.failures,[]);
 } finally {h.close();}
});

test('own text validates, keeps its draft across navigation, escapes markup, and offers no unrelated checks',async()=>{
 const h=await boot();
 try {
  h.click('[data-action="nu-select"][data-key="own"]');
  h.click('[data-action="nu-open"]');
  assert.match(h.$('#nu-error').textContent,/Paste/);
  const text='My own <img src=x onerror=alert(1)> passage.\nSecond line.';
  h.$('#nu-text').value=text;h.$('#nu-text').dispatchEvent(new h.w.Event('input',{bubbles:true}));
  h.$('#nu-language').value='en';h.$('#nu-language').dispatchEvent(new h.w.Event('change',{bubbles:true}));
  h.$('#nu-title').value='My <b>text</b>';h.$('#nu-title').dispatchEvent(new h.w.Event('input',{bubbles:true}));
  h.click('[data-action="nu-select"][data-key="camille"]');
  h.click('[data-action="nu-select"][data-key="own"]');
  assert.equal(h.$('#nu-text').value,text);
  h.click('[data-action="nu-open"]');
  await until(()=>h.$('#reader-text'),'own source reader');
  assert.equal(h.$('#reader-text').textContent,text);
  assert.equal(h.$('#reader-text img'),null);
  assert.equal(h.$('[data-action="support-start"]'),null);
  assert.match(h.$('#nabu-support-cycle').textContent,/not available for this source/);
  assert.equal(h.events().filter(e=>e.cycle?.observation==='response').length,0);
  assert.deepEqual(h.data().cards,[h.old]);
  assert.deepEqual(h.failures,[]);
 } finally {h.close();}
});

test('existing reference choice stays a reference when opening the new-user path',async()=>{
 const seed={meta:[{id:'nabu.content.v1:guest',value:{events:[{id:'seed-reference-00000000001',kind:'moment',contentId:'moment:dream',version:1,at:1000,moment:{schemaVersion:1,userId:null,action:'keep',mode:'reference',source:null}}],pending:[]}}]};
 const h=await boot({seed});
 try {
  h.click('[data-action="nu-help"]');
  await until(()=>h.$('.first-use-check [data-action="support-finish"]'),'help');
  h.click('[data-action="support-finish"]');
  await until(()=>h.$('[data-action="nu-library"]'),'saved reference');
  assert.match(h.$('.nu-saved-note').textContent,/reference/);
  assert.equal(h.$('[data-action="nu-keep"]'),null);
  assert.equal(h.events().filter(e=>e.kind==='moment').length,1);
  assert.equal(h.events().find(e=>e.kind==='moment').moment.mode,'reference');
 } finally {h.close();}
});

test('account change clears a private intake draft and closes its help without migrating evidence',async()=>{
 const h=await boot();
 try {
  h.click('[data-action="nu-select"][data-key="own"]');
  h.$('#nu-text').value='Private new-user draft';h.$('#nu-text').dispatchEvent(new h.w.Event('input',{bubbles:true}));
  h.w.dispatchEvent(new h.w.Event('nabu-account-change'));
  h.click('#new-user-tab');
  h.click('[data-action="nu-select"][data-key="own"]');
  assert.equal(h.$('#nu-text').value,'');
  assert.equal(h.events().length,0);
 } finally {h.close();}
});
