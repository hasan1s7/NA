import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import * as C from "../public/nabu-core.js";
import { createContentStore } from "../public/nabu-content-store.js";
import { installSupportCycle } from "../public/nabu-support-ui.js";
async function setup({
  beforeSave,
  afterSave,
  avoid = false,
  user = null,
  play,
} = {}) {
  const dom = new JSDOM(
    '<main><article id="reader-text">Existing reading stays here.</article><div id="host"></div></main><dialog id="modal"><h2 id="modal-title"></h2><div id="modal-body"></div></dialog>',
    { url: "https://nabu.invalid", pretendToBeVisual: true },
  );
  const w = dom.window;
  globalThis.window = w;
  globalThis.document = w.document;
  const $ = (s) => w.document.querySelector(s),
    meta = new Map(),
    calls = [],
    errors = [],
    downloads = [];
  let id = 0,
    time = 1800000000000;
  const uid = () => `support-dom-${String(++id).padStart(20, "0")}`;
  const state = {
    user,
    accountHint: "",
    backend: user ? { supportCycles: true } : null,
    cards: [{ id: "existing", front: "word", schedule: { due: 10, reps: 7 } }],
    logs: [{ id: "old" }],
    view: "reader",
  };
  let context = {
    actor: { userId: user?.id || null, tenantId: null },
    immediateIntent: {
      id: "test-intent",
      revision: 1,
      rawText: avoid
        ? "I want to read without practice."
        : "I want to practice French.",
    },
    organizationObjective: null,
  };
  const real = createContentStore({
    getMeta: async (k, d) => structuredClone(meta.get(k) ?? d),
    setMeta: async (k, v) => meta.set(k, structuredClone(v)),
    uid,
    now: () => time,
    locks: null,
  });
  await real.configure(user?.id || "guest");
  const store = {
    ...real,
    append: async (item, kind, fields, eventId) => {
      const call = { item, kind, fields: structuredClone(fields), id: eventId };
      calls.push(call);
      await beforeSave?.(call);
      const r = await real.append(item, kind, fields, eventId);
      await afterSave?.(call);
      return r;
    },
  };
  const actions = {};
  const showModal = (title, body) => {
    $("#modal-title").textContent = title;
    $("#modal-body").innerHTML = body;
    $("#modal").open = true;
  };
  const closeModal = () => {
    $("#modal").open = false;
    $("#modal").dispatchEvent(new w.Event("close"));
    $("#modal-body").replaceChildren();
  };
  const ui = installSupportCycle({
    state,
    C: { ...C, uid },
    E: C.escapeHTML,
    $,
    actions,
    explore: { store },
    intents: { getContext: () => structuredClone(context) },
    showModal,
    closeModal,
    now: () => time,
    play,
    savePassage: async (t) => {
      if (!state.cards.some((c) => c.front === t.source))
        state.cards.push({ front: t.source, learningMode: "reference" });
    },
    download: async (name, data) => downloads.push({ name, data }),
  });
  const pending = new Set();
  w.document.addEventListener("click", (event) => {
    const b = event.target.closest("[data-action]");
    if (!b || b.disabled || !actions[b.dataset.action]) return;
    const p = Promise.resolve()
      .then(() => actions[b.dataset.action](b))
      .catch((e) => errors.push(e));
    pending.add(p);
    p.finally(() => pending.delete(p));
  });
  $("#host").innerHTML = ui.render();
  const settle = async () => {
    while (pending.size) await Promise.all([...pending]);
  };
  return {
    ui,
    w,
    $,
    state,
    store,
    real,
    actions,
    calls,
    downloads,
    errors,
    showModal,
    close: () => w.close(),
    events: () => store.getEvents(),
    responses: () =>
      store.getEvents().filter((e) => e.cycle?.observation === "response"),
    setContext(v) {
      context = v;
      w.dispatchEvent(new w.Event("nabu-intent-change"));
    },
    getContext: () => structuredClone(context),
    advance(ms) {
      time += ms;
    },
    start(selector) {
      assert($(selector), selector);
      $(selector).click();
    },
    async click(selector) {
      this.start(selector);
      await settle();
    },
    settle,
    answer(text) {
      $("#support-answer").value = text;
    },
  };
}
test("supported answer, subsequent variation, save and export use actual app actions and preserve the reading", async () => {
  const h = await setup();
  try {
    const source = h.$("#reader-text"),
      before = structuredClone(h.state.cards);
    await h.ui.startCheck();
    assert.equal(h.$("main").style.visibility, "hidden");
    await h.click('[data-action="support-cue"][data-id="translation"]');
    h.answer("I haven't talked to him about it.");
    await h.click('[data-action="support-submit"]');
    assert.equal(h.responses().length, 1);
    let s = h.ui.getSnapshot();
    assert.equal(s.projection.rows[0].independent, false);
    assert(s.projection.rows[0].condition.opened.includes("translation"));
    await h.click('[data-action="support-feedback"]');
    assert.equal(
      h.responses()[0].cycle.supportSnapshot.find((s) => s.id === "translation")
        .openedAt !== null,
      true,
    );
    await h.click('[data-action="support-finish"]');
    assert.equal(h.$("#reader-text"), source);
    assert.equal(h.$("main").style.visibility, "");
    assert.deepEqual(h.state.cards, before);
    await h.ui.startCheck("support:fr:variation");
    h.answer("I haven't talked to her about it yet.");
    await h.click('[data-action="support-submit"]');
    assert.equal(h.ui.getSnapshot().projection.rows[1].independent, true);
    await h.click('[data-action="support-finish"]');
    await h.click('[data-action="support-save"]');
    assert.equal(h.state.cards.at(-1).learningMode, "reference");
    assert.deepEqual(h.state.cards[0], before[0]);
    await h.click('[data-action="support-export"]');
    const data = JSON.parse(h.downloads[0].data);
    assert.equal(data.model.jointObservations, 2);
    assert.equal(data.audit.filter((e) => e.response !== null).length, 2);
    assert.equal(data.sensitivity.empiricalValidation, false);
    assert.deepEqual(h.errors, []);
  } finally {
    h.close();
  }
});
for (const when of ["before", "after"])
  test(`${when}-write failure retries the original response and delivery ID`, async () => {
    let fail = true;
    const crash = (c) => {
      if (fail && c.fields.cycle.observation === "response") {
        fail = false;
        throw Error("Interrupted save");
      }
    };
    const h = await setup(
      when === "before" ? { beforeSave: crash } : { afterSave: crash },
    );
    try {
      await h.ui.startCheck();
      h.answer("I talked to him about it.");
      await h.click('[data-action="support-submit"]');
      assert(h.$("#support-answer").disabled);
      assert.match(
        h.$('[role="alert"]').textContent,
        /first response is preserved/,
      );
      h.answer("I haven't talked to him about it.");
      await h.click('[data-action="support-submit"]');
      assert.equal(h.responses().length, 1);
      assert.equal(
        h.responses()[0].cycle.response.answer,
        "I talked to him about it.",
      );
      const writes = h.calls.filter(
        (c) => c.fields.cycle.observation === "response",
      );
      assert.equal(writes[0].id, writes[1].id);
      assert.deepEqual(writes[0].fields, writes[1].fields);
      assert.deepEqual(h.errors, []);
    } finally {
      h.close();
    }
  });
test("a hint opened after submission is not backdated, and same-episode retries are dependent", async () => {
  const h = await setup();
  try {
    await h.ui.startCheck();
    h.answer("I haven't talked to him about it.");
    await h.click('[data-action="support-submit"]');
    assert.equal(h.ui.getSnapshot().projection.rows[0].independent, true);
    const before = structuredClone(h.responses()[0]);
    await h.click('[data-action="support-feedback"]');
    await h.click('[data-action="support-retry"]');
    h.answer("I haven't talked to him about it.");
    await h.click('[data-action="support-submit"]');
    assert.deepEqual(h.responses()[0], before);
    assert.equal(h.ui.getSnapshot().projection.rows[1].admitted, false);
    assert.equal(h.responses()[1].cycle.episodeId, before.cycle.episodeId);
  } finally {
    h.close();
  }
});
test("unknown audio is not scored as listening; completed playback enables an actual auditory response", async () => {
  let available = false;
  const h = await setup({
    play: async () => {
      if (!available) throw Error("Voice unavailable");
    },
  });
  try {
    await h.ui.startCheck("support:fr:listen");
    h.answer("I haven't talked to him about it.");
    await h.click('[data-action="support-submit"]');
    assert.equal(h.responses().length, 0);
    await h.click('[data-action="support-play"]');
    assert.equal(
      h.events().filter((e) => e.cycle.observation === "playback").length,
      0,
    );
    available = true;
    await h.click('[data-action="support-play"]');
    await h.click('[data-action="support-submit"]');
    assert.equal(h.responses()[0].cycle.inputModality, "auditory");
    assert.equal(h.ui.getSnapshot().projection.rows[0].independent, true);
  } finally {
    h.close();
  }
});
test("uncertain transcript correction recomputes scores through the visible review control", async () => {
  const h = await setup();
  try {
    await h.ui.startCheck("support:fr:uncertain");
    h.answer("I haven't talked to him about it.");
    await h.click('[data-action="support-submit"]');
    assert.equal(h.ui.getSnapshot().projection.jointObservations, 0);
    await h.click('[data-action="support-correct"]');
    const row = h.ui.getSnapshot().projection.rows[0];
    assert.equal(row.scoring.outcome, "correct");
    assert.equal(row.historicalScoring.outcome, "abstain");
    assert.equal(row.correctionEventIds.length, 1);
  } finally {
    h.close();
  }
});
test("a lost playback acknowledgement retries delivery without replaying; a real replay is a cue", async () => {
  let plays = 0,
    fail = true;
  const h = await setup({
    play: async () => plays++,
    afterSave: (c) => {
      if (fail && c.fields.cycle.observation === "playback") {
        fail = false;
        throw Error("Lost playback ACK");
      }
    },
  });
  try {
    await h.ui.startCheck("support:fr:listen");
    await h.click('[data-action="support-play"]');
    assert.equal(plays, 1);
    await h.click('[data-action="support-play"]');
    assert.equal(plays, 1);
    assert.equal(
      h.events().filter((e) => e.cycle.observation === "playback").length,
      1,
    );
    await h.click('[data-action="support-play"]');
    assert.equal(plays, 2);
    h.answer("I haven't talked to him about it.");
    await h.click('[data-action="support-submit"]');
    const row = h.ui.getSnapshot().projection.rows[0];
    assert.equal(row.independent, false);
    assert(row.condition.extra.includes("replay"));
  } finally {
    h.close();
  }
});
test("no-practice intentions allow reading support and suppress checks without inventing outcomes", async () => {
  const h = await setup({ avoid: true });
  try {
    assert.equal(h.$('[data-action="support-start"]'), null);
    await assert.rejects(() => h.ui.startCheck(), /excludes practice/);
    await h.click('[data-action="support-read"]');
    await h.click('[data-action="support-cue"][data-id="translation"]');
    assert.equal(h.responses().length, 0);
    assert.equal(h.ui.getSnapshot().model.jointObservations, 0);
    await h.click('[data-action="support-finish"]');
    assert.equal(h.$("main").style.visibility, "");
  } finally {
    h.close();
  }
});
test("scope changes restore the original source and late saves cannot reopen another dialog", async () => {
  let release,
    entered = false;
  const gate = new Promise((r) => (release = r));
  const h = await setup({
    beforeSave: async (c) => {
      if (c.fields.cycle.observation === "support-opened") {
        entered = true;
        await gate;
      }
    },
  });
  try {
    await h.ui.startCheck();
    h.start('[data-action="support-cue"][data-id="translation"]');
    for (let i = 0; i < 100 && !entered; i++)
      await new Promise((r) => setTimeout(r, 1));
    assert(entered);
    h.showModal("Another task", "<p>Keep this new dialog.</p>");
    release();
    await h.settle();
    assert.equal(h.$("#modal-title").textContent, "Another task");
    assert.equal(h.$("main").style.visibility, "");
    assert.equal(h.responses().length, 0);
    await h.ui.startCheck();
    const ctx = h.getContext();
    ctx.immediateIntent.revision++;
    h.setContext(ctx);
    assert.equal(h.$("#modal").open, false);
    assert.equal(h.$("main").style.visibility, "");
    assert.deepEqual(h.errors, []);
  } finally {
    release();
    h.close();
  }
});
test("account switches close a live check and never migrate guest responses", async () => {
  const h = await setup();
  try {
    await h.ui.startCheck();
    h.state.user = { id: "alice" };
    h.state.backend = { supportCycles: true };
    await h.real.configure("alice");
    h.w.dispatchEvent(new h.w.Event("nabu-account-change"));
    assert.equal(h.$("#modal").open, false);
    assert.equal(h.$("main").style.visibility, "");
    assert.equal(h.events().length, 0);
    assert.equal(h.ui.getSnapshot().projection.rows.length, 0);
    assert.deepEqual(h.errors, []);
  } finally {
    h.close();
  }
});
