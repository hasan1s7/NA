import test from "node:test";
import assert from "node:assert/strict";
import * as S from "../public/nabu-support-cycle.js";
import * as M from "../public/nabu-support-model.js";
import * as T from "../public/nabu-support-tasks.js";
import * as Content from "../public/nabu-content.js";
import { createContentStore } from "../public/nabu-content-store.js";
import { createSupportFixture } from "../tools/support_cycle_fixtures.mjs";
import { CATALOG } from "../public/nabu-content-catalogue.js";
const meaning = { answer: "I haven't talked to him about it." },
  clone = structuredClone;
test("support availability, opening, self-reported use and post-response timing stay distinct", () => {
  const f = createSupportFixture(),
    c = f.begin();
  f.open(c, "gloss");
  const s = c.task.supports.find((s) => s.id === "gloss");
  f.append(c, "support-used", {
    support: { id: s.id, type: s.type, visibility: s.visibility, role: s.role },
  });
  const r = f.respond(c, meaning),
    snapshot = clone(r.cycle.supportSnapshot);
  f.open(c, "translation");
  const row = f.project().rows[0];
  assert.deepEqual(row.condition.extra, ["gloss"]);
  assert.deepEqual(row.condition.used, ["gloss"]);
  assert(row.condition.available.includes("translation"));
  assert(!row.condition.opened.includes("translation"));
  assert.deepEqual(r.cycle.supportSnapshot, snapshot);
  assert.equal(f.project().attentionObserved, false);
});
test("a hidden available cue is not recorded as used or visible; primary source / options define recognition", () => {
  const f = createSupportFixture(),
    c = f.begin("support:fr:recognize");
  f.respond(c, { choice: 1 });
  const row = f.project().rows[0];
  assert.equal(row.independent, true);
  assert.deepEqual(row.condition.opened, []);
  assert(row.condition.visible.includes("options"));
  assert.equal(row.condition.extra.length, 0);
});
test("supported success estimates its condition and never creates independent or graph-neighbour successes", () => {
  const f = createSupportFixture(),
    c = f.begin();
  f.open(c, "translation");
  f.respond(c, meaning);
  const p = f.project(),
    fit = M.fitSupportModel(p, { now: f.now });
  assert.equal(p.jointObservations, 1);
  assert.equal(p.rows[0].targetIds.length, 2);
  assert.equal(fit.updates.length, 1);
  assert.equal(fit.estimates.length, 1);
  assert.equal(fit.estimates[0].independent, false);
  assert.deepEqual(fit.estimates[0].condition.extra, ["translation"]);
  assert.equal(fit.learningGain, null);
});
test("same-episode retries and recent exposed answers retain dependence, including new delivery IDs", () => {
  const f = createSupportFixture(),
    a = f.begin();
  f.respond(a, meaning, { feedback: true });
  const b = f.begin(undefined, { episodeId: a.episodeId, parent: a.parent });
  f.respond(b, meaning);
  const c = f.begin();
  f.respond(c, meaning);
  const rows = f.project().rows;
  assert.equal(rows[0].independent, true);
  assert.equal(rows[1].admitted, false);
  assert(rows[1].exclusionReasons.includes("dependent-episode-repeat"));
  assert.equal(rows[2].independent, false);
  assert(rows[2].condition.earlierAnswerEventIds.length > 0);
});
test("changing context can provide direct construction evidence; item familiarity remains separate", () => {
  const f = createSupportFixture(),
    a = f.begin();
  f.open(a, "translation");
  f.respond(a, meaning, { feedback: true });
  const b = f.begin("support:fr:variation");
  f.respond(b, { answer: "I haven't talked to her about it yet." });
  f.now += 3600000;
  const c = f.begin("support:fr:form");
  f.respond(c, { answer: "Je ne lui en ai pas parlé." });
  const p = f.project(),
    fit = M.fitSupportModel(p, { now: f.now });
  assert.equal(p.rows[1].independent, true);
  assert.equal(fit.estimates.length, 3);
  assert.equal(
    fit.estimates.find((e) => e.task.type === "form-recall").task.condition
      .level,
    "item",
  );
});
test("modality, variety and task type are separate conditions rather than borrowed evidence", () => {
  const f = createSupportFixture();
  f.respond(f.begin(), meaning);
  f.now += 3600000;
  f.respond(f.begin("support:fr:listen"), meaning);
  f.respond(f.begin("support:fr:listen-variation"), meaning);
  const fit = M.fitSupportModel(f.project(), { now: f.now });
  assert.equal(fit.estimates.length, 3);
  assert.equal(
    fit.estimates.filter((e) => e.task.inputModality === "auditory").length,
    2,
  );
  assert.equal(new Set(fit.estimates.map((e) => e.key)).size, 3);
});
test("source ambiguity abstains, corrections replay all affected scores and preserve original scoring", () => {
  const f = createSupportFixture(),
    c = f.begin("support:fr:uncertain"),
    r = f.respond(c, meaning);
  const historical = clone(r);
  assert.equal(f.project().jointObservations, 0);
  assert.equal(f.project().rows[0].scoring.outcome, "abstain");
  f.correct(c);
  const p = f.project();
  assert.equal(p.jointObservations, 1);
  assert.equal(p.rows[0].appliedAnalysisRef.version, 2);
  assert.equal(p.rows[0].historicalScoring.outcome, "abstain");
  assert.deepEqual(r, historical);
  assert.equal(
    M.fitSupportModel(f.project({ resolveAnalysis: () => null }), {
      now: f.now,
    }).jointObservations,
    0,
  );
});
test("compatible analyses are retained and marginalized without resolving them against the learner", () => {
  const f = createSupportFixture();
  f.respond(f.begin(), meaning);
  const row = f.project().rows[0];
  assert.equal(row.interpretation.hypotheses.length, 2);
  assert.equal(
    row.interpretation.hypotheses.reduce((n, h) => n + h.weight, 0),
    1,
  );
  const p = f.project(),
    a = M.fitSupportModel(p, { now: f.now });
  for (const h of p.rows[0].interpretation.hypotheses) h.difficultyOffset = 2;
  const b = M.fitSupportModel(p, { now: f.now });
  assert.notEqual(
    a.estimates[0].prediction.mean,
    b.estimates[0].prediction.mean,
  );
});
test("partial knowledge, unmatched answers, guessing, slips and scorer reliability are explicit", () => {
  const task = T.supportTask("support:fr:meaning"),
    analysis = T.supportAnalysis(task.analysisRef);
  assert.equal(
    S.scoreSupportResponse(task, analysis, { answer: "I haven't talked." })
      .score,
    0.5,
  );
  assert.equal(
    S.scoreSupportResponse(task, analysis, {
      answer: "A valid alternative not yet reviewed",
    }).score,
    null,
  );
  const f = createSupportFixture();
  f.respond(f.begin(), meaning);
  const p = f.project(),
    fit = M.fitSupportModel(p, { now: f.now });
  p.rows[0].scoring.reliability = 0;
  const weak = M.fitSupportModel(p, { now: f.now });
  assert(Math.abs(weak.estimates[0].prediction.mean - 0.5) < 0.01);
  assert(fit.estimates[0].prediction.mean > weak.estimates[0].prediction.mean);
  const sensitivity = M.supportSensitivity(f.project(), {
    now: f.now + 10 * 86400000,
  });
  assert.equal(sensitivity.empiricalValidation, false);
  assert.equal(sensitivity.runs.length, 7);
  assert(new Set(sensitivity.runs.map((r) => r.estimates[0].mean)).size > 3);
});
test("forgetting predictions and practice transitions never rewrite observations or prove learning", () => {
  const f = createSupportFixture();
  f.respond(f.begin(), meaning);
  const events = clone(f.events),
    p = f.project();
  const early = M.fitSupportModel(p, { now: f.now }),
    late = M.fitSupportModel(p, { now: f.now + 90 * 86400000 });
  assert(
    late.estimates[0].prediction.mean < early.estimates[0].prediction.mean,
  );
  assert.deepEqual(f.events, events);
  assert.deepEqual(
    late.estimates[0].atObservation,
    early.estimates[0].atObservation,
  );
  const d = {
    grid: early.estimates[0].grid,
    weights: early.estimates[0].weights,
  };
  assert.deepEqual(M.transitionSupportPractice(d).weights, d.weights);
  assert.throws(
    () => M.transitionSupportPractice(d, { gain: 0.2 }),
    /calibrated/,
  );
});
test("review requests use independent evidence; assisted activity cannot postpone an existing return", () => {
  const f = createSupportFixture();
  const a = f.begin();
  f.respond(a, meaning);
  f.respond(f.begin("support:fr:variation"), {
    answer: "I haven't talked to her about it yet.",
  });
  const first = M.planSupportCycle(f.project(), T.SUPPORT_TASKS, {
    now: f.now,
  });
  assert.equal(first.kind, "later-retrieval");
  f.now += 2000;
  const c = f.begin();
  f.open(c, "translation");
  f.respond(c, meaning);
  const next = M.planSupportCycle(f.project(), T.SUPPORT_TASKS, { now: f.now });
  assert.equal(next.dueAt, first.dueAt);
  assert.equal(
    M.planSupportCycle(f.project(), T.SUPPORT_TASKS, {
      now: f.now,
      avoidPractice: true,
    }).kind,
    "continue",
  );
  const g = createSupportFixture(),
    d = g.begin();
  g.open(d, "translation");
  g.respond(d, meaning);
  g.now += 3600000;
  g.respond(g.begin(), { answer: "I talked to him about it." });
  const plan = M.planSupportCycle(g.project(), T.SUPPORT_TASKS, { now: g.now });
  assert.match(plan.reason, /does not establish forgetting/);
});
test("event reprocessing is idempotent; altered IDs, forged snapshots, parents and second responses fail", () => {
  const f = createSupportFixture(),
    c = f.begin(),
    r = f.respond(c, meaning);
  const p = f.project();
  assert.deepEqual(
    S.projectSupportEvidence([...f.events, ...f.events], {
      actor: f.actor,
      resolveTask: T.supportTask,
      resolveAnalysis: T.supportAnalysis,
      now: f.now,
    }),
    p,
  );
  const bad = clone(r);
  bad.cycle.response.answer = "changed";
  assert.throws(() => Content.mergeEvents(f.events, [bad]), /reused/);
  const altered = clone(f.events);
  altered.at(-1).cycle.supportSnapshot = [];
  assert.throws(() => S.validateSupportSequence(altered), /snapshot/);
  const second = clone(r);
  second.id = f.uid();
  second.at++;
  assert.throws(
    () => S.validateSupportSequence([...f.events, second]),
    /already/,
  );
  const parent = clone(f.events);
  parent[0].cycle.parentEventId = r.id;
  assert.throws(() => S.validateSupportSequence(parent), /parent/i);
});
test("existing content store keeps old progress, retries stable payloads and isolates account ownership", async () => {
  const db = new Map(),
    f = createSupportFixture(),
    c = f.begin();
  f.respond(c, meaning);
  let ids = 0;
  const store = createContentStore({
    getMeta: async (k, d) => clone(db.get(k) ?? d),
    setMeta: async (k, v) => db.set(k, clone(v)),
    uid: () => String(++ids).padStart(20, "0"),
    locks: null,
  });
  await store.configure("guest");
  const legacy = {
    id: "legacy-opened-1234567890",
    kind: "opened",
    contentId: "a-little-later",
    version: 1,
    at: 1000,
  };
  await store.append(
    { id: legacy.contentId, version: 1 },
    legacy.kind,
    { at: 1000 },
    legacy.id,
  );
  for (const e of f.events)
    await store.append(
      e.cycle.mediaRef,
      e.kind,
      { cycle: e.cycle, at: e.at },
      e.id,
    );
  await store.append(
    c.task.mediaRef,
    "support-cycle",
    { cycle: f.events.at(-1).cycle, at: f.events.at(-1).at },
    f.events.at(-1).id,
  );
  assert.equal(store.getEvents().length, f.events.length + 1);
  assert.equal(
    Content.progressFor(Content.itemById("a-little-later"), store.getEvents())
      .started,
    true,
  );
  await store.configure("alice");
  assert.equal(store.getEvents().length, 0);
  await assert.rejects(
    () =>
      store.append(
        c.task.mediaRef,
        "support-cycle",
        { cycle: f.events[0].cycle, at: f.events[0].at },
        f.events[0].id,
      ),
    /different account/,
  );
  await store.configure("guest");
  assert.equal(store.getEvents().length, f.events.length + 1);
});
test("support dependence requires comparable response evidence, and remains an observational estimate", () => {
  const f = createSupportFixture(),
    c = f.begin(undefined, { readOnly: true });
  f.open(c, "translation");
  assert.deepEqual(
    M.fitSupportModel(f.project(), { now: f.now }).supportDependence,
    [],
  );
  for (let i = 0; i < 2; i++) {
    f.now += 3600000;
    const c = f.begin();
    f.open(c, "translation");
    f.respond(c, meaning);
  }
  assert.equal(
    M.fitSupportModel(f.project(), { now: f.now }).supportDependence[0].status,
    "insufficient-comparable-evidence",
  );
  for (let i = 0; i < 2; i++) {
    f.now += 3600000;
    f.respond(f.begin(), { answer: "I talked to him about it." });
  }
  const contrast = M.fitSupportModel(f.project(), { now: f.now })
    .supportDependence[0];
  assert.notEqual(contrast.status, "insufficient-comparable-evidence");
  assert(contrast.difference.interval.length === 2);
  assert.equal(contrast.causalClaim, false);
  assert.equal(contrast.thresholdProvisional, true);
});
test("all six real catalogue pieces reuse exact media versions and original task rubrics without construction claims", () => {
  const tasks = T.SUPPORT_TASKS.filter((t) => t.id.startsWith("support:catalogue:"));
  assert.equal(new Set(tasks.map((t) => t.mediaRef.id)).size, 6);
  for (const item of CATALOG.items)
    for (const original of item.practice) {
      const task = tasks.find(
        (t) => t.id === "support:catalogue:" + item.id + ":" + original.id,
      );
      assert(task);
      assert.deepEqual(task.mediaRef, { id: item.id, version: item.version });
      assert.equal(task.condition.level, "item");
      assert.equal(task.targetIds.length, 1);
      const analysis = T.supportAnalysis(task.analysisRef),
        response =
          original.mode === "recall"
            ? { answer: original.accepted[0] }
            : { choice: original.answer };
      assert.equal(S.scoreSupportResponse(task, analysis, response).score, 1);
      const f = createSupportFixture(),
        c = f.begin(task.id);
      f.respond(c, response);
      assert.equal(f.project().jointObservations, 1);
      assert.equal(
        M.fitSupportModel(f.project(), { now: f.now }).estimates.length,
        1,
      );
    }
  const recall = tasks.find((t) => t.type === "form-recall");
  assert.equal(
    S.scoreSupportResponse(recall, T.supportAnalysis(recall.analysisRef), {
      answer: recall.accepted[0].replace("خذي", "خُذي"),
    }).score,
    1,
  );
});

test("repairs and variations stay on the observed target when other saved passages are available", () => {
  const id = "support:catalogue:a-book-for-rain:p1";
  const other = T.supportTask("support:catalogue:a-little-later:p1");
  const target = T.supportTask(id);
  const tasks = [other, target];
  for (const correct of [false, true]) {
    const f = createSupportFixture();
    f.respond(f.begin(id), { choice: correct ? target.correctChoice : (target.correctChoice + 1) % target.options.length });
    const result = M.planSupportCycle(f.project(), tasks, { now: f.now });
    assert.equal(result.kind, correct ? "continue" : "targeted-repair");
    assert.equal(result.taskId, correct ? null : id);
    const old = structuredClone(f.events);
    for (const e of old) e.cycle.selectionPolicyVersion = "support-cycle-selection-v1";
    assert.doesNotThrow(() => S.validateSupportSequence(old));
  }
});
