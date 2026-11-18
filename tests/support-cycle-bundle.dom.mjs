/** Executes the shipping standalone bundle and its event handlers. The existing
 * in-memory IDB boundary verifies wiring, not real browser persistence/layout. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { webcrypto } from "node:crypto";
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
async function boot({
  url = "https://nabu.invalid/library",
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
      () =>
        h
          .$('[data-action="support-cue"][data-id="translation"]')
          ?.textContent.includes("Opened:") &&
        !h.$('[data-action="support-submit"]').disabled,
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
    h.click('#navigation [data-view="explore"]');
    await until(() => h.$('[data-action="open-content"][data-id="a-little-later"]'), "curated source");
    h.click('[data-action="open-content"][data-id="a-little-later"]');
    await until(() => h.$("#reader-text") && h.$('[data-action="support-start"]'), "reader with a matching check");
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
    h.click('[data-action="support-save"]');
    await until(
      () => h.data().cards.length === 2,
      "separate French saved passage",
    );
    h.click('#navigation [data-view="explore"]');
    await until(
      () => h.$('[data-action="open-content"][data-id="a-little-later"]'),
      "catalogue",
    );
    h.click('[data-action="open-content"][data-id="a-little-later"]');
    await until(() => h.$("#reader-text"), "real media");
    await until(
      () =>
        h
          .events()
          .some((e) => e.kind === "opened" && e.contentId === "a-little-later"),
      "completed media opening",
    );
    const source = h.$("#reader-text");
    assert(
      !h
        .$("#nabu-support-cycle")
        .textContent.includes("This passage is in your saved material"),
    );
    assert(
      [...h.$("#support-task").options].every((o) =>
        o.value.startsWith("support:catalogue:a-little-later:"),
      ),
    );
    h.click('[data-action="support-save"]');
    await until(() => h.data().cards.length === 3, "anchored save");
    await until(
      () =>
        h
          .$("#nabu-support-cycle")
          .textContent.includes("This passage is in your saved material"),
      "matching saved passage status",
    );
    const saved = h.data().cards.find((c) => c.sourceLang === "ar");
    assert.equal(saved.front, "خذي وقتك");
    assert.equal(saved.learningMode, "reference");
    assert(
      saved.context.includes("خذي وقتك") &&
        saved.context.length > saved.front.length,
    );
    assert(saved.provenance.startsWith("Nabu source: a-little-later@1;"));
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

test("3.0 keeps a moment, freezes the forecast, respects a hint and reopens the same record after a cold start", async () => {
  let h = await boot({ url: "https://nabu.invalid/" });
  try {
    assert.equal(h.$("#moment-title").textContent, "Moments");
    h.click('[data-action="moment-choose"]');
    h.click('[data-action="moment-mode"][data-mode="practice"]');
    await until(
      () => h.$("#modal-title").textContent === "Kept for practice",
      "kept",
    );
    const saved = h.events().find((e) => e.kind === "moment");
    assert.equal(saved.moment.mode, "practice");
    h.click('#modal [data-action="moment-next"]');
    await until(
      () => h.$("#modal-title").textContent === "At the door",
      "variation",
    );
    h.click('#modal [data-action="moment-check"]');
    await until(() => h.$('[name="support-choice"]'), "authored task");
    let rows = h.events();
    const presentation = rows.find((e) => e.cycle?.forecast);
    assert(presentation);
    assert(!rows.some((e) => e.cycle?.response));
    h.click('#modal [data-action="support-cue"][data-id="translation"]');
    await until(
      () =>
        h
          .$('#modal [data-action="support-cue"]')
          .textContent.includes("Opened:"),
      "opened cue",
    );
    h.$('input[name="support-choice"][value="1"]').checked = true;
    h.click('[data-action="support-submit"]');
    await until(() => h.$(".support-result"), "response");
    rows = h.events();
    const response = rows.find((e) => e.cycle?.response);
    assert(response.at > presentation.at);
    assert(
      response.cycle.supportSnapshot.find((s) => s.type === "translation")
        ?.openedAt,
    );
    assert(
      response.cycle.supportSnapshot.find((s) => s.type === "scene-context"),
    );
    assert.deepEqual(
      rows.find((e) => e.id === presentation.id),
      presentation,
    );
    const seed = h.data();
    h.close();
    h = await boot({ seed, url: "https://nabu.invalid/review" });
    assert.match(h.$(".moment-shelf").textContent, /The bend in the road/);
    assert.equal(h.data().logs.length, 0);
    assert.deepEqual(h.failures, []);
  } finally {
    h.close();
  }
});

test("3.0 keeps an exact personal excerpt, pauses practice, and undoes a swipe without grading", async () => {
  const h = await boot({ url: "https://nabu.invalid/" });
  try {
    const swipe = (type, x) => {
      const ev = new h.w.Event(type, { bubbles: true });
      Object.assign(ev, {
        isPrimary: true,
        button: 0,
        pointerId: 2,
        clientX: x,
        clientY: 10,
      });
      h.$(".moment-bubble").dispatchEvent(ev);
    };
    swipe("pointerdown", 145);
    swipe("pointerup", 50);
    await until(
      () => h.$("#modal-title").textContent === "Marked familiar",
      "swipe left",
    );
    h.click('[data-action="moment-undo"]');
    await until(
      () => h.$("#modal-title").textContent === "Choice undone",
      "undo",
    );
    h.click('#modal [data-action="close-modal"]');
    h.click('[data-action="open-own-reader"]');
    await until(() => h.$("#reader-input"), "reader");
    h.$("#reader-input").value =
      "An unused introduction. The same line. The same line.";
    h.click('[data-action="read-text"]');
    await until(() => h.$('[data-action="moment-capture"]'), "capture");
    h.click('[data-action="moment-capture"]');
    const box = h.$("#moment-excerpt");
    const at = box.value.lastIndexOf("The same line.");
    box.setSelectionRange(at, at + 14);
    h.$("#moment-source-title").value = "My second piece";
    h.click('[data-action="moment-anchor"]');
    await until(() => h.$('[data-action="moment-mode"]'), "anchored");
    h.click('[data-action="moment-mode"][data-mode="reference"]');
    await until(
      () => h.$("#modal-title").textContent === "Saved as reference",
      "reference",
    );
    const kept = h.events().find((e) => e.moment?.source);
    assert.equal(kept.moment.source.offset, at);
    assert.equal(kept.moment.source.text, "The same line.");
    assert(!JSON.stringify(kept).includes("introduction"));
    assert.equal(h.data().cards.length, 1);
    assert(!h.events().some((e) => e.cycle?.response));
    h.click('#modal [data-action="moment-library"]');
    await until(() => h.$(".moment-shelf"), "library");
    assert.match(h.$(".moment-shelf").textContent, /My second piece/);
    assert.doesNotMatch(
      h.$(".moment-shelf").textContent,
      /The bend in the road/,
    );
    h.click('#navigation [data-view="review"]');
    await until(() => !h.$(".moment-shelf"), "reference excluded from review");
    assert.deepEqual(h.failures, []);
  } finally {
    h.close();
  }
});

test("the unfair question is quarantined and its reviewed answer survives a reload", async () => {
  let h = await boot({ url: "https://nabu.invalid/" });
  try {
    h.click('[data-action="moment-scene"][data-key="camille"]');
    h.click('[data-action="moment-choose"]');
    h.click('[data-action="moment-mode"][data-mode="practice"]');
    await until(
      () => h.$("#modal-title").textContent === "Kept for practice",
      "French moment kept",
    );
    h.click('[data-action="moment-library"]');
    await until(
      () => h.$('.moment-shelf [data-action="moment-reopen"]'),
      "library",
    );
    h.click('.moment-shelf [data-action="moment-reopen"]');
    await until(
      () => h.$('[data-task="moment-task:camille:old-key"]'),
      "historical question",
    );
    h.click('[data-task="moment-task:camille:old-key"]');
    await until(
      () => h.$('input[name="support-choice"][value="2"]'),
      "historical choices",
    );
    h.$('input[name="support-choice"][value="2"]').checked = true;
    h.click('[data-action="support-submit"]');
    await until(() => h.$(".support-result"), "initial result");
    assert.match(
      h.$(".support-result").textContent,
      /excluded from your learner estimate/,
    );
    h.click('[data-action="support-flag"]');
    await until(
      () => h.$('[data-action="support-correct"]'),
      "apply correction",
    );
    h.click('[data-action="support-correct"]');
    await until(
      () =>
        h.$(".support-result").textContent.includes("current result: abstain"),
      "replayed",
    );
    const seed = h.data();
    h.close();
    h = await boot({ seed, url: "https://nabu.invalid/library" });
    h.click('.moment-shelf [data-action="moment-reopen"]');
    await until(() => h.$('[data-action="moment-history"]'), "durable history");
    h.click('[data-action="moment-history"]');
    assert.match(
      h.$(".moment-dialog").textContent,
      /Le dialogue ne le dit pas/,
    );
    assert.match(h.$(".moment-dialog").textContent, /After review · abstain/);
    assert.equal(h.events().filter((e) => e.cycle?.response).length, 1);
    assert.deepEqual(h.failures, []);
  } finally {
    h.close();
  }
});

test("1.18 web release keeps a scribe choice across reload and restores the initial", async () => {
  let h = await boot({url:"https://nabu.invalid/"});
  try {
    h.click("#avatar");
    await until(() => h.$("#avatar-language"), "avatar settings");
    assert.equal(h.$("#avatar-language").options.length,12);
    h.$("#avatar-language").value = "ar";
    h.$("#avatar-language").dispatchEvent(new h.w.Event("change",{bubbles:true}));
    h.click('[data-action="choose-avatar"][data-form="feminine"]');
    await until(() => h.$("#avatar .nabu-avatar-art"), "header portrait");
    assert.match(h.$("#avatar svg").getAttribute("aria-label"),/feminine/i);
    const chosen=h.$("#avatar").innerHTML, seed=h.data();
    assert.equal(seed.meta.find(row=>row.id==='nabu.avatar.v1:guest').value.language,'ar');
    h.close();
    h=await boot({seed,url:"https://nabu.invalid/"});
    assert.equal(h.$("#avatar").innerHTML,chosen);
    h.click("#avatar");
    await until(() => h.$("#avatar-language"), "picker restored");
    assert.equal(h.$("#avatar-language").value,"ar");
    assert.equal(h.$('[data-action="choose-avatar"][data-form="feminine"]').getAttribute("aria-pressed"),"true");
    h.click('[data-action="choose-avatar"][data-form="initial"]');
    await until(() => h.$("#avatar").textContent==="N", "restore initial");
    assert.equal(h.data().cards.length, seed.cards.length);
    assert.deepEqual(h.failures,[]);
  } finally {h.close();}
});
