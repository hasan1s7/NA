import test from "node:test";
import assert from "node:assert/strict";
import * as M from "../public/nabu-moments.js";
import * as S from "../public/nabu-support-cycle.js";
import * as T from "../public/nabu-support-tasks.js";
import * as Model from "../public/nabu-support-model.js";
import * as X from "../public/nabu-content.js";
import { createSupportFixture } from "../tools/support_cycle_fixtures.mjs";
const event = (
  n,
  at,
  action,
  mode = null,
  fields = {},
  id = "moment:bend",
) => ({
  id: "moment-event-" + String(n).padStart(9, "0"),
  at,
  kind: "moment",
  contentId: id,
  version: 1,
  moment: {
    schemaVersion: 1,
    userId: null,
    action,
    mode,
    source: null,
    ...fields,
  },
});
test("a return before 24 hours preserves the invitation; next-day reopen is product evidence only", () => {
  const a = event(1, 10, "keep", "practice"),
    early = event(2, 20, "variation"),
    late = event(3, 10 + M.MOMENT_DAY, "reopen");
  assert.equal(
    M.projectMoments(X.mergeEvents([a], [a, early]), null, 200)[0].dueAt,
    10 + M.MOMENT_DAY,
  );
  const m = M.projectMoments(X.mergeEvents([a, early], [late]), null, late.at);
  assert.equal(m[0].dueAt, null);
  assert.deepEqual(M.pilotCounts(m, late.at), {
    keptForReturn: 1,
    eligibleAfter24h: 1,
    reopenedAfter24h: 1,
    freshScenesOpened: 1,
    distinctPiecesBrought: 0,
  });
  assert.equal(X.progressFor(X.ITEMS[0], [a, early, late]).started, false);
  assert.deepEqual(M.projectMoments([a], "other"), []);
});
test("familiar pauses a return; undo restores its previous due time or removes a newly added preference", () => {
  const a = event(1, 100, "keep", "practice"),
    b = event(2, 200, "mode", "familiar"),
    c = event(3, 300, "undo", null, { undoOf: b.id });
  assert.equal(M.projectMoments([a, b])[0].dueAt, null);
  assert.equal(
    M.projectMoments(X.mergeEvents([a, b], [c]))[0].dueAt,
    100 + M.MOMENT_DAY,
  );
  assert.deepEqual(
    M.projectMoments([a, event(4, 400, "undo", null, { undoOf: a.id })]),
    [],
  );
  assert.throws(() =>
    X.mergeEvents([a], [{ ...a, moment: { ...a.moment, mode: "familiar" } }]),
  );
  assert.throws(() =>
    X.mergeEvents(
      [a],
      [event(8, 900, "undo", null, { undoOf: a.id }, "moment:camille")],
    ),
  );
});
test("piece identity survives early/late selection and personal material is bounded to the chosen span", async () => {
  const text = "A private preface. We took the train. We took the train.",
    excerpt = "We took the train.";
  const make = (offset) =>
    M.anchorExcerpt({
      text,
      excerpt,
      title: "Trip",
      language: "en",
      offset,
      seconds: 8,
    });
  const a = await make(text.indexOf(excerpt)),
    b = await make(text.lastIndexOf(excerpt));
  assert.notEqual(a.id, b.id);
  assert.equal(a.source.pieceId, b.source.pieceId);
  assert.equal(a.source.text, excerpt);
  assert(!JSON.stringify(a).includes("private preface"));
  assert.deepEqual(a, await make(text.indexOf(excerpt)));
  assert.equal(
    M.pilotCounts(
      M.projectMoments([
        event(1, 1, "keep", "reference", { source: a.source }, a.id),
        event(2, 2, "keep", "reference", { source: b.source }, b.id),
      ]),
    ).distinctPiecesBrought,
    1,
  );
  await assert.rejects(() => make(0));
  await assert.rejects(() =>
    M.anchorExcerpt({
      text: "a".repeat(601),
      excerpt: "a".repeat(601),
      offset: 0,
    }),
  );
  assert.throws(() =>
    M.validateMomentEvent(
      event(1, 1, "reopen", null, { source: a.source }, a.id),
    ),
  );
});
test("flagging an invalid inference preserves the historical answer; a reviewed correction retracts its likelihood", () => {
  const f = createSupportFixture(),
    bad = f.begin("moment-task:camille:old-key");
  f.respond(bad, { choice: 2 });
  const original = f.project().rows[0];
  assert.equal(original.scoring.outcome, "incorrect");
  f.append(bad, "question-flagged");
  assert.equal(f.project().jointObservations, 0);
  assert(original.exclusionReasons.includes("answer-key-exercise"));
  // Replay a previously admitted observation using the historical task metadata.
  const historical = {
    resolveTask(ref) {
      const task = T.supportTask(ref);
      if (task) delete task.reviewedCorrection;
      return task;
    },
  };
  assert.equal(f.project(historical).jointObservations, 1);
  f.correct(bad);
  const row = f.project().rows[0];
  assert.equal(row.historicalScoring.outcome, "incorrect");
  assert.equal(row.scoring.outcome, "abstain");
  assert.equal(f.project(historical).jointObservations, 0);
  assert.match(row.scoring.reason, /elsewhere/);
  assert.equal(f.project().jointObservations, 0);
  const fair = f.begin("moment-task:camille:first");
  f.respond(fair, { choice: 1 });
  assert.equal(f.project().jointObservations, 1);
  assert.deepEqual(
    S.currentAnalysisRef(
      f.events,
      { userId: null, tenantId: null },
      bad.task.analysisRef,
    ),
    { ...bad.task.analysisRef, version: 2 },
  );
});
test("forecasts are prospective, compare only matching conditions and keep the four directions independent", () => {
  const f = createSupportFixture(),
    t = T.supportTask("moment-task:bend:next"),
    analysis = T.supportAnalysis(t.analysisRef);
  const pred = Model.forecastMoment(
    t,
    analysis,
    f.project(),
    Model.fitSupportModel(f.project(), { now: f.now }),
  );
  assert(pred.model > 0 && pred.model < 1);
  assert.equal(pred.ladder, 1 / 3);
  const c = f.begin(t.id);
  f.events.find(
    (e) => e.cycle.observation === "task-presented",
  ).cycle.forecast = pred;
  f.respond(c, { choice: 1 });
  const s = f.project();
  assert.equal(Model.compareMomentForecasts(f.events, s).eligible, 1);
  assert.deepEqual(Model.momentDirections(s.rows, "bend"), {
    reading: 1,
    listening: 0,
    writing: 0,
    speaking: 0,
  });
  const next = f.begin(t.id);
  f.events.find(
    (e) =>
      e.cycle.attemptId === next.attemptId &&
      e.cycle.observation === "task-presented",
  ).cycle.forecast = pred;
  f.open(next, "translation");
  f.respond(next, { choice: 1 });
  assert.equal(Model.compareMomentForecasts(f.events, f.project()).eligible, 1);
  const writing = f.begin("moment-task:camille:write");
  f.respond(writing, { answer: "Je ne lui en ai pas parlé." });
  assert.deepEqual(Model.momentDirections(f.project().rows, "camille"), {
    reading: 0,
    listening: 0,
    writing: 1,
    speaking: 0,
  });
});

test("the return count starts at practice opt-in and requires reopening the saved source", () => {
  const keep = event(1, 5, "keep", "reference");
  const opt = event(2, M.MOMENT_DAY + 5, "mode", "practice");
  const early = event(3, opt.at + 1, "reopen");
  const variation = event(4, opt.at + M.MOMENT_DAY, "variation");
  const reopen = event(5, variation.at + 7, "reopen");
  const counts = (rows, at) => M.pilotCounts(M.projectMoments(rows, null, at), at);
  assert.equal(counts([keep], opt.at).eligibleAfter24h, 0);
  assert.equal(counts([keep, opt, early], early.at).reopenedAfter24h, 0);
  const before = counts([keep, opt, early, variation], variation.at);
  assert.equal(before.eligibleAfter24h, 1);
  assert.equal(before.reopenedAfter24h, 0);
  assert.equal(before.freshScenesOpened, 1);
  assert.equal(counts([keep, opt, early, variation, reopen], reopen.at).reopenedAfter24h, 1);
});
