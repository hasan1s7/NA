/** Run the release's return and correction paths in memory on a controlled clock. */
import assert from "node:assert/strict";
import {
  MOMENT_DAY,
  pilotCounts,
  projectMoments,
} from "../public/nabu-moments.js";
import {
  fitSupportModel,
  forecastMoment,
} from "../public/nabu-support-model.js";
import { supportAnalysis } from "../public/nabu-support-tasks.js";
import { createSupportFixture } from "./support_cycle_fixtures.mjs";

const start = Date.UTC(2026, 0, 1, 12);
const hour = MOMENT_DAY / 24;
const momentEvents = [];
function visit(action, hours, mode = null) {
  momentEvents.push({
    id: "demo-moment-event-" + momentEvents.length,
    at: start + hours * hour,
    kind: "moment",
    contentId: "moment:bend",
    version: 1,
    moment: { schemaVersion: 1, userId: null, action, mode, source: null },
  });
}
visit("keep", 0, "practice");
visit("variation", 23);
const early = projectMoments(momentEvents, null, start + 23 * hour);
assert.equal(early[0].dueAt, start + MOMENT_DAY);
visit("reopen", 25);
const late = projectMoments(momentEvents, null, start + 25 * hour);
assert.equal(late[0].dueAt, null);
assert.equal(pilotCounts(late, start + 25 * hour).reopenedAfter24h, 1);

const trial = createSupportFixture({ at: start });
const first = trial.begin("moment-task:bend:first");
trial.open(first, "translation");
trial.respond(first, { choice: 0 });
const second = trial.begin("moment-task:bend:next", { at: start + 25 * hour });
const before = trial.project();
const forecast = forecastMoment(
  second.task,
  supportAnalysis(second.task.analysisRef),
  before,
  fitSupportModel(before, { now: trial.now }),
);
trial.events.find(
  (event) =>
    event.cycle.attemptId === second.attemptId &&
    event.cycle.observation === "task-presented",
).cycle.forecast = forecast;
trial.respond(second, { choice: 1 });
const [assisted, fresh] = trial.project().rows;
assert.equal(assisted.independent, false);
assert.equal(fresh.independent, true);

const oldQuestion = trial.begin("moment-task:camille:old-key");
trial.respond(oldQuestion, { choice: 2 });
trial.append(oldQuestion, "question-flagged");
const prior = trial.project().jointObservations;
assert(
  trial.project().rows.at(-1).exclusionReasons.includes("answer-key-exercise"),
);
trial.correct(oldQuestion);
const revised = trial.project();
const old = revised.rows.at(-1);
assert.equal(old.historicalScoring.outcome, "incorrect");
assert.equal(old.scoring.outcome, "abstain");
assert.equal(revised.jointObservations, prior);
console.log(
  [
    "Nabu 1.18 · fictional learner, controlled clock, in memory",
    "23 hours · a new scene opens and the next-day invitation stays due.",
    "25 hours · the learner reopens the passage and the invitation is fulfilled.",
    "Arabic · the first answer used translation. The fresh written scene used its ordinary task cues.",
    "French · the original key is retired. This review exercise carries no learner penalty. The original response remains available.",
  ].join("\n"),
);
