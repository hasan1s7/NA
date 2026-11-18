/** Deterministic SYNTHETIC interactions for tests and the CLI walkthrough.
 * These are never imported by the application or written into a user's store. */
import * as S from "../public/nabu-support-cycle.js";
import * as T from "../public/nabu-support-tasks.js";
export function createSupportFixture({
  actor = { userId: null, tenantId: null },
  at = 1800000000000,
} = {}) {
  let n = 0,
    clock = at;
  const events = [];
  const uid = () => `support-fixture-${String(++n).padStart(20, "0")}`;
  function append(c, observation, extra = {}) {
    const event = {
      id: uid(),
      contentId: c.task.mediaRef.id,
      version: c.task.mediaRef.version,
      kind: "support-cycle",
      at: ++clock,
      cycle: {
        schemaVersion: 1,
        episodeId: c.episodeId,
        attemptId: c.attemptId,
        parentEventId: c.parent,
        actor: structuredClone(actor),
        intentRef: null,
        organizationObjectiveRef: null,
        mediaRef: c.task.mediaRef,
        analysisRef: c.task.analysisRef,
        targetIds: c.task.targetIds,
        taskRef: { id: c.task.id, version: c.task.version },
        taskType: c.task.type,
        inputModality: c.task.inputModality,
        responseModality: "none",
        condition: c.task.condition,
        observation,
        support: null,
        supportSnapshot: [],
        response: null,
        scoring: null,
        correction: null,
        modelVersion: S.SUPPORT_MODEL_VERSION,
        selectionPolicyVersion: S.SUPPORT_POLICY_VERSION,
        ...structuredClone(extra),
      },
    };
    S.validateSupportSequence([...events, event]);
    events.push(event);
    c.parent = event.id;
    return event;
  }
  function begin(
    id = "support:fr:meaning",
    { episodeId = uid(), parent = null, readOnly = false, at: time } = {},
  ) {
    if (time !== undefined) clock = time;
    const task = T.supportTask(id),
      c = { task, episodeId, attemptId: uid(), parent };
    append(c, readOnly ? "encounter" : "task-presented");
    for (const s of task.supports)
      append(c, "support-available", { support: descriptor(s) });
    return c;
  }
  const descriptor = (s) => ({
    id: s.id,
    type: s.type,
    visibility: s.visibility,
    role: s.role,
  });
  function open(c, id) {
    const s = c.task.supports.find((s) => s.id === id);
    return append(c, "support-opened", { support: descriptor(s) });
  }
  function respond(c, response, { feedback = false } = {}) {
    if (c.task.inputModality === "auditory") append(c, "playback");
    const event = append(c, "response", {
      response,
      responseModality: c.task.responseModality,
      supportSnapshot: S.supportSnapshot(events, c.attemptId),
      scoring: S.scoreSupportResponse(
        c.task,
        T.supportAnalysis(c.task.analysisRef),
        response,
      ),
    });
    if (feedback) append(c, "feedback");
    return event;
  }
  function correct(c, version = 2) {
    return append(c, "analysis-correction", {
      attemptId: null,
      analysisRef: { ...c.task.analysisRef, version },
      correction: {
        replaces: c.task.analysisRef,
        uses: { ...c.task.analysisRef, version },
        note: "Reviewed synthetic transcript correction.",
      },
    });
  }
  const project = (extra = {}) =>
    S.projectSupportEvidence(events, {
      actor,
      resolveTask: T.supportTask,
      resolveAnalysis: T.supportAnalysis,
      now: clock,
      ...extra,
    });
  return {
    events,
    actor,
    uid,
    append,
    begin,
    open,
    respond,
    correct,
    project,
    get now() {
      return clock;
    },
    set now(t) {
      clock = t;
    },
  };
}
