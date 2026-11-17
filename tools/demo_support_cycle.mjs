#!/usr/bin/env node
/** Runnable, synthetic walkthrough of the shipping interpretation / projection /
 * model / scheduler. No generated interaction enters a real learner account. */
import assert from "node:assert/strict";
import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { createSupportFixture } from "./support_cycle_fixtures.mjs";
import * as T from "../public/nabu-support-tasks.js";
import * as M from "../public/nabu-support-model.js";
import * as S from "../public/nabu-support-cycle.js";
const f = createSupportFixture({ at: 1794916800000 }),
  steps = [];
function record(label) {
  const projection = f.project(),
    model = M.fitSupportModel(projection, { now: f.now }),
    plan = M.planSupportCycle(projection, T.SUPPORT_TASKS, { now: f.now });
  steps.push({
    label,
    at: f.now,
    responses: projection.rows.map((r) => ({
      eventId: r.eventId,
      skill: r.task?.type,
      modality: r.task?.inputModality,
      outcome: r.scoring.outcome,
      independent: r.independent,
      admitted: r.admitted,
      condition: r.condition,
      replayed: r.correctionEventIds.length > 0,
    })),
    jointObservations: model.jointObservations,
    plan,
    learningGain: model.learningGain,
  });
  console.log(
    `${label}: ${model.jointObservations} joint observations; next ${plan.kind}.`,
  );
}
const meaning = { answer: "I haven't talked to him about it." };
const encounter = f.begin("support:fr:meaning", { readOnly: true });
f.open(encounter, "translation");
record("Encounter with translation");
assert.equal(f.project().jointObservations, 0);
const supported = f.begin();
f.open(supported, "translation");
f.respond(supported, meaning, { feedback: true });
record("Supported understanding");
assert.equal(f.project().rows.at(-1).independent, false);
f.now += 86400000;
f.respond(f.begin(), meaning);
record("Later independent retrieval");
assert.equal(f.project().rows.at(-1).independent, true);
f.respond(f.begin("support:fr:variation"), {
  answer: "I haven't talked to her about it yet.",
});
record("Variation in a new written context");
assert.equal(
  M.planSupportCycle(f.project(), T.SUPPORT_TASKS, { now: f.now }).kind,
  "later-retrieval",
);
const listening = f.begin("support:fr:listen-variation");
f.respond(listening, { answer: "I talked to him about it." });
record("Auditory difficulty in conversational variant");
assert.match(
  M.planSupportCycle(f.project(), T.SUPPORT_TASKS, { now: f.now }).reason,
  /does not establish forgetting/,
);
f.append(listening, "repair");
f.append(listening, "feedback");
const retry = f.begin("support:fr:listen-variation", {
  episodeId: listening.episodeId,
  parent: listening.parent,
});
f.respond(retry, meaning);
record("Targeted repair and dependent retry");
assert.equal(f.project().rows.at(-1).admitted, false);
f.now += 86400000;
f.respond(f.begin("support:fr:listen-variation"), meaning);
record("Later auditory retrieval");
assert.equal(f.project().rows.at(-1).independent, true);
const uncertain = f.begin("support:fr:uncertain");
f.respond(uncertain, meaning);
record("Uncertain transcript: abstain");
assert.equal(f.project().rows.at(-1).scoring.outcome, "abstain");
f.correct(uncertain);
record("Reviewed transcript correction and replay");
assert.equal(f.project().rows.at(-1).historicalScoring.outcome, "abstain");
assert.equal(f.project().rows.at(-1).scoring.outcome, "correct");
const projection = f.project(),
  model = M.fitSupportModel(projection, { now: f.now }),
  sensitivity = M.supportSensitivity(projection, { now: f.now });
const output = {
  synthetic: true,
  empiricalValidation: false,
  description:
    "Deterministic scenario; not a learning experiment or a fitted calibration dataset.",
  steps,
  events: f.events,
  audit: f.events.map(S.supportAuditRecord),
  projection,
  model,
  sensitivity,
};
const flag = process.argv.indexOf("--output");
if (flag >= 0) {
  const path = process.argv[flag + 1];
  if (!path) throw Error("Supply an output JSON filename.");
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(output, null, 2) + "\n");
  console.log("Wrote " + path);
}
console.log(
  "All walkthrough assertions passed. Parameters are provisional; causal learning gain remains unknown.",
);
