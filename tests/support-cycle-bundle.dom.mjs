/** Executes the shipping standalone bundle and its event handlers. The existing
 * in-memory IDB boundary verifies wiring, not real browser persistence/layout. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JSDOM, VirtualConsole } from "jsdom";
import { installIDBFixture } from "./idb-fixture.js";
import { newCard } from "../public/nabu-core.js";
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
async function boot() {
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
    url: "https://nabu.invalid/library",
    runScripts: "dangerously",
    pretendToBeVisual: true,
    virtualConsole: v,
    beforeParse(w) {
      const originalInterval=w.setInterval.bind(w);
      w.setInterval=(fn,delay,...args)=>{if(delay===15000)startupFinished=true;return originalInterval(fn,delay,...args);};
      w.structuredClone = structuredClone;
      w.Response = Response;
      w.TextEncoder = TextEncoder;
      w.AbortController = AbortController;
      w.matchMedia = () => ({ matches: false, addEventListener() {} });
      w.scrollTo = () => {};
      w.scrollBy = () => {};
      w.fetch = async () => new Response("{}", { status: 503 });
      installIDBFixture(w, { cards: [old] });
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
    () => startupFinished && $('[data-action="support-start"]'),
    "bundled support panel",
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
test("built app saves a reference, runs a supported check, and preserves old library and SRS data", async () => {
  const h = await boot();
  try {
    h.click('[data-action="support-save"]');
    await until(() => h.data().cards.length === 2, "saved passage");
    assert.deepEqual(
      h.data().cards.find((c) => c.id === h.old.id),
      h.old,
    );
    assert.equal(h.data().logs.length, 0);
    h.click('[data-action="support-start"]');
    await until(() => h.$("#support-answer"), "real check");
    h.click('[data-action="support-cue"][data-id="translation"]');
    await until(
      () => h.$('[data-action="support-cue"][data-id="translation"]')?.textContent.includes('Opened:') && !h.$('[data-action="support-submit"]').disabled,
      "cue saved",
    );
    h.$("#support-answer").value = "I haven't talked to him about it.";
    h.click('[data-action="support-submit"]');
    await until(() => h.$(".support-result"), "saved result");
    const response = h
      .events()
      .find((e) => e.cycle?.observation === "response");
    assert(response);
    assert.equal(
      response.cycle.supportSnapshot.find((s) => s.type === "translation")
        .openedAt !== null,
      true,
    );
    h.click('[data-action="support-finish"]');
    assert.equal(h.$("main").style.visibility, "");
    assert.deepEqual(
      h.data().cards.find((c) => c.id === h.old.id),
      h.old,
    );
    assert.equal(h.data().logs.length, 0);
    h.click('#navigation [data-view="review"]');
    await until(() => h.$("#nabu-support-cycle"), "review integration");
    assert.match(h.$("#nabu-support-cycle").textContent, /saved material/);
    assert.deepEqual(h.failures, []);
  } finally {
    h.close();
  }
});
test("a native close during a check does not replace the existing reader node", async () => {
  const h = await boot();
  try {
    h.click('#navigation [data-view="reader"]');
    await until(() => h.$("#reader-input"), "reader editor");
    h.$("#reader-input").value = "My original text stays here.";
    h.click('[data-action="read-text"]');
    await until(() => h.$("#reader-text"), "reader");
    const source = h.$("#reader-text");
    h.click('[data-action="support-start"]');
    await until(() => h.$("#support-answer"), "check");
    h.$("#modal").close();
    assert.equal(h.$("#reader-text"), source);
    assert.equal(h.$("main").style.visibility, "");
    assert.equal(
      h.events().filter((e) => e.cycle?.observation === "response").length,
      0,
    );
    assert.deepEqual(h.failures, []);
  } finally {
    h.close();
  }
});
test("actual curated media selects its own support tasks and saves the anchored Arabic expression", async () => {
  const h = await boot();
  try {
    h.click('#navigation [data-view="explore"]');
    await until(
      () => h.$('[data-action="open-content"][data-id="a-little-later"]'),
      "catalogue",
    );
    h.click('[data-action="open-content"][data-id="a-little-later"]');
    await until(() => h.$("#reader-text"), "real media");
    await until(()=>h.events().some(e=>e.kind==='opened'&&e.contentId==='a-little-later'),'completed media opening');
    const source = h.$("#reader-text");
    assert(
      [...h.$("#support-task").options].every((o) =>
        o.value.startsWith("support:catalogue:a-little-later:"),
      ),
    );
    h.click('[data-action="support-save"]');
    await until(() => h.data().cards.length === 2, "anchored save");
    const saved = h.data().cards.find((c) => c.sourceLang === "ar");
    assert.equal(saved.front, "خذي وقتك");
    assert.equal(saved.learningMode, "reference");
    h.$("#support-task").value = "support:catalogue:a-little-later:p1";
    h.click('[data-action="support-start"]');
    await until(
      () => h.$('input[name="support-choice"]'),
      "original authored recognition check",
    );
    h.$('input[name="support-choice"][value="0"]').checked = true;
    h.click('[data-action="support-submit"]');
    await until(() => h.$(".support-result"), "recognition response");
    const response = h
      .events()
      .find((e) => e.cycle?.observation === "response");
    assert.equal(response.contentId, "a-little-later");
    assert.equal(response.cycle.taskType, "recognition");
    assert.equal(response.cycle.scoring.score, 1);
    h.click('[data-action="support-finish"]');
    assert.equal(h.$("#reader-text"), source);
    assert.deepEqual(
      h.data().cards.find((c) => c.id === h.old.id),
      h.old,
    );
    assert.equal(h.data().logs.length, 0);
    assert.deepEqual(h.failures, []);
  } finally {
    h.close();
  }
});
