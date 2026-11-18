/** Support-aware evidence contract. Interpretation and measurement are pure;
 * nothing in this module changes memory, schedules, source media or old events. */
export const SUPPORT_SCHEMA_VERSION = 1;
export const SUPPORT_MODEL_VERSION = "support-conditional-grid-v1";
export const SUPPORT_POLICY_VERSION = "support-cycle-selection-v2";
export const SUPPORT_TYPES = Object.freeze([
  "translation",
  "gloss",
  "paraphrase",
  "transcript",
  "highlighting",
  "segmentation",
  "image",
  "scene-context",
  "options",
  "replay",
  "slower-playback",
  "another-recording",
  "cross-language",
  "historical-explanation",
  "earlier-answer",
  "feedback",
]);
export const SUPPORT_OBSERVATIONS = Object.freeze([
  "encounter",
  "task-presented",
  "support-available",
  "support-opened",
  "support-used",
  "response",
  "feedback",
  "repair",
  "playback",
  "analysis-correction",
  "question-flagged",
]);
export const SUPPORT_SKILLS = Object.freeze([
  "recognition",
  "meaning-recall",
  "form-recall",
  "contextual-production",
]);
const KEYS = [
  "schemaVersion",
  "episodeId",
  "attemptId",
  "parentEventId",
  "actor",
  "intentRef",
  "organizationObjectiveRef",
  "mediaRef",
  "analysisRef",
  "targetIds",
  "taskRef",
  "taskType",
  "inputModality",
  "responseModality",
  "condition",
  "observation",
  "support",
  "supportSnapshot",
  "response",
  "scoring",
  "correction",
  "modelVersion",
  "selectionPolicyVersion",
];
const COPY = (x) => structuredClone(x);
export function canonicalSupport(value) {
  if (Array.isArray(value))
    return "[" + value.map(canonicalSupport).join(",") + "]";
  if (value && typeof value === "object")
    return (
      "{" +
      Object.keys(value)
        .sort()
        .map((k) => JSON.stringify(k) + ":" + canonicalSupport(value[k]))
        .join(",") +
      "}"
    );
  return JSON.stringify(value);
}
function object(v, keys, name) {
  if (
    !v ||
    Object.prototype.toString.call(v) !== "[object Object]" ||
    Object.keys(v).length !== keys.length ||
    keys.some((k) => !Object.hasOwn(v, k))
  )
    throw Error("Invalid " + name + " fields.");
}
function text(v, max, name) {
  if (
    typeof v !== "string" ||
    !v.trim() ||
    v.length > max ||
    /[\u0000-\u001f\u007f]/u.test(v)
  )
    throw Error("Invalid " + name + ".");
}
function id(v, name, nullable = false) {
  if (nullable && v === null) return;
  if (typeof v !== "string" || !/^[A-Za-z0-9_-]{16,80}$/u.test(v))
    throw Error("Invalid " + name + ".");
}
function integer(v, name, min = 0) {
  if (!Number.isSafeInteger(v) || v < min) throw Error("Invalid " + name + ".");
}
function member(v, values, name) {
  if (!values.includes(v)) throw Error("Invalid " + name + ".");
}
function ref(v, name) {
  object(v, ["id", "version"], name);
  text(v.id, 160, name + " ID");
  integer(v.version, name + " version", 1);
  if (v.version > 1000000) throw Error("Invalid " + name + " version.");
}
function intent(v, name) {
  if (v === null) return;
  object(v, ["id", "revision"], name);
  text(v.id, 160, name);
  integer(v.revision, name, 1);
}
function actor(v) {
  object(v, ["userId", "tenantId"], "actor");
  if (v.userId !== null) text(v.userId, 160, "learner ID");
  if (v.userId === "!locked")
    throw Error("Locked accounts cannot record support evidence.");
  if (v.tenantId !== null) {
    text(v.tenantId, 64, "team");
    if (!/^[A-Za-z0-9_-]{3,64}$/.test(v.tenantId) || v.userId === null)
      throw Error("Invalid team actor.");
  }
}
function support(v) {
  object(v, ["id", "type", "visibility", "role"], "support");
  text(v.id, 160, "support ID");
  member(v.type, SUPPORT_TYPES, "support type");
  member(v.visibility, ["hidden", "visible"], "support visibility");
  member(v.role, ["task", "extra"], "support role");
}
export function validateSupportEvent(raw) {
  object(
    raw,
    ["id", "contentId", "version", "kind", "at", "cycle"],
    "support event",
  );
  id(raw.id, "event ID");
  integer(raw.at, "event time");
  if (raw.kind !== "support-cycle") throw Error("Invalid support event kind.");
  const e = raw.cycle;
  object(
    e,
    Object.hasOwn(e, "forecast") ? [...KEYS, "forecast"] : KEYS,
    "support envelope",
  );
  if (Object.hasOwn(e, "forecast")) {
    const f = e.forecast;
    object(
      f,
      ["version", "ladder", "model", "priorResponses"],
      "prospective forecast",
    );
    if (
      e.observation !== "task-presented" ||
      e.taskType !== "recognition" ||
      f.version !== "moment-forecast-v1" ||
      ![f.ladder, f.model].every((n) => Number.isFinite(n) && n >= 0 && n <= 1)
    )
      throw Error("Invalid prospective forecast.");
    integer(f.priorResponses, "prior response count");
  }
  if (e.schemaVersion !== 1) throw Error("Unsupported support schema.");
  id(e.episodeId, "episode");
  id(e.attemptId, "attempt", true);
  id(e.parentEventId, "parent", true);
  if (e.parentEventId === raw.id) throw Error("An event cannot parent itself.");
  actor(e.actor);
  intent(e.intentRef, "intent");
  intent(e.organizationObjectiveRef, "objective");
  if (e.actor.tenantId === null && e.organizationObjectiveRef !== null)
    throw Error("An objective requires a team.");
  for (const key of ["mediaRef", "analysisRef", "taskRef"]) ref(e[key], key);
  if (raw.contentId !== e.mediaRef.id || raw.version !== e.mediaRef.version)
    throw Error("Support media and event wrapper differ.");
  if (
    !Array.isArray(e.targetIds) ||
    !e.targetIds.length ||
    e.targetIds.length > 8 ||
    new Set(e.targetIds).size !== e.targetIds.length
  )
    throw Error("Use one bounded joint target set.");
  for (const x of e.targetIds) text(x, 160, "target");
  member(e.taskType, SUPPORT_SKILLS, "task type");
  member(
    e.inputModality,
    ["written", "auditory", "audiovisual"],
    "input modality",
  );
  member(
    e.responseModality,
    ["none", "choice", "text", "speech"],
    "response modality",
  );
  object(
    e.condition,
    ["level", "scopeId", "itemId", "contextId", "speakerId", "variety"],
    "task condition",
  );
  member(e.condition.level, ["item", "construction"], "target level");
  for (const [k, v] of Object.entries(e.condition))
    if (k !== "level") text(v, 160, "condition " + k);
  member(e.observation, SUPPORT_OBSERVATIONS, "support observation");
  if (
    ["support-available", "support-opened", "support-used"].includes(
      e.observation,
    )
  )
    support(e.support);
  else if (e.support !== null)
    throw Error("Only support actions carry a support descriptor.");
  if (!Array.isArray(e.supportSnapshot) || e.supportSnapshot.length > 20)
    throw Error("Invalid support snapshot.");
  for (const s of e.supportSnapshot) {
    object(
      s,
      [
        "id",
        "type",
        "visibility",
        "role",
        "availableAt",
        "openedAt",
        "usedAt",
        "useBasis",
      ],
      "support snapshot",
    );
    support({ id: s.id, type: s.type, visibility: s.visibility, role: s.role });
    integer(s.availableAt, "availability");
    for (const k of ["openedAt", "usedAt"])
      if (s[k] !== null) {
        integer(s[k], k);
        if (s[k] < s.availableAt || s[k] > raw.at)
          throw Error("Invalid support ordering.");
      }
    if (s.availableAt > raw.at)
      throw Error("Future support cannot affect this response.");
    if (s.useBasis !== (s.usedAt === null ? null : "self-report"))
      throw Error("Use is an explicit self-report, not observed attention.");
  }
  if (
    new Set(e.supportSnapshot.map((s) => s.id)).size !==
    e.supportSnapshot.length
  )
    throw Error("Duplicate support in response snapshot.");
  if (e.observation === "response") {
    if (
      e.attemptId === null ||
      !e.response ||
      Object.keys(e.response).length !== 1
    )
      throw Error("A response needs its attempt and one answer.");
    if (Object.hasOwn(e.response, "choice")) {
      integer(e.response.choice, "choice");
      if (e.response.choice > 99 || e.responseModality !== "choice")
        throw Error("Invalid choice response.");
    } else if (Object.hasOwn(e.response, "answer")) {
      text(e.response.answer, 300, "answer");
      if (!["text", "speech"].includes(e.responseModality))
        throw Error("Invalid answer modality.");
    } else throw Error("Unsupported response field.");
    object(
      e.scoring,
      ["outcome", "score", "reliability", "reason", "ruleVersion"],
      "recorded scoring",
    );
    member(
      e.scoring.outcome,
      ["correct", "partial", "incorrect", "abstain"],
      "score outcome",
    );
    if (
      ![null, 0, 0.5, 1].includes(e.scoring.score) ||
      !Number.isFinite(e.scoring.reliability) ||
      e.scoring.reliability < 0 ||
      e.scoring.reliability > 1
    )
      throw Error("Invalid score or scoring uncertainty.");
    if ((e.scoring.outcome === "abstain") !== (e.scoring.score === null))
      throw Error("Abstention has no score.");
    text(e.scoring.reason, 400, "scoring reason");
    text(e.scoring.ruleVersion, 80, "scoring version");
  } else if (
    e.response !== null ||
    e.scoring !== null ||
    e.responseModality !== "none" ||
    e.supportSnapshot.length
  )
    throw Error(
      "Only responses contain answers, scoring and frozen support snapshots.",
    );
  if (e.observation === "analysis-correction") {
    object(e.correction, ["replaces", "uses", "note"], "analysis correction");
    ref(e.correction.replaces, "replaced analysis");
    ref(e.correction.uses, "new analysis");
    if (
      e.correction.replaces.id !== e.correction.uses.id ||
      e.correction.uses.version <= e.correction.replaces.version ||
      canonicalSupport(e.analysisRef) !== canonicalSupport(e.correction.uses)
    )
      throw Error("Corrections must advance and identify an analysis version.");
    text(e.correction.note, 400, "correction reason");
  } else if (e.correction !== null)
    throw Error("Only a correction may revise an analysis reference.");
  if (
    e.attemptId === null &&
    [
      "task-presented",
      "question-flagged",
      "support-available",
      "support-opened",
      "support-used",
      "response",
      "feedback",
      "playback",
    ].includes(e.observation)
  )
    throw Error("A task action requires an attempt.");
  if (
    e.scoring &&
    e.scoring.score !==
      { correct: 1, partial: 0.5, incorrect: 0, abstain: null }[
        e.scoring.outcome
      ]
  )
    throw Error("Score and outcome disagree.");
  if (
    e.modelVersion !== SUPPORT_MODEL_VERSION ||
    !["support-cycle-selection-v1", SUPPORT_POLICY_VERSION].includes(e.selectionPolicyVersion)
  )
    throw Error("Unsupported support model or policy version.");
  return COPY(raw);
}
export function supportSnapshot(
  events,
  attemptId,
  at = Number.MAX_SAFE_INTEGER,
) {
  const states = new Map();
  for (const event of [...events]
    .filter(
      (x) =>
        x.kind === "support-cycle" &&
        x.cycle.attemptId === attemptId &&
        x.at <= at,
    )
    .sort((a, b) => a.at - b.at || a.id.localeCompare(b.id))) {
    const e = event.cycle,
      s = e.support;
    if (!s) continue;
    if (e.observation === "support-available") {
      if (states.has(s.id))
        throw Error("Support availability is immutable per attempt.");
      states.set(s.id, {
        ...COPY(s),
        availableAt: event.at,
        openedAt: null,
        usedAt: null,
        useBasis: null,
      });
    } else {
      const prior = states.get(s.id);
      if (
        !prior ||
        canonicalSupport(s) !==
          canonicalSupport({
            id: prior.id,
            type: prior.type,
            visibility: prior.visibility,
            role: prior.role,
          })
      )
        throw Error("Support action needs its original availability.");
      if (e.observation === "support-opened" && prior.openedAt === null)
        prior.openedAt = event.at;
      if (e.observation === "support-used" && prior.usedAt === null) {
        prior.usedAt = event.at;
        prior.useBasis = "self-report";
      }
    }
  }
  return [...states.values()].sort((a, b) => a.id.localeCompare(b.id));
}
export function validateSupportSequence(events) {
  const rows = events
      .filter((e) => e.kind === "support-cycle")
      .map(validateSupportEvent)
      .sort((a, b) => a.at - b.at || a.id.localeCompare(b.id)),
    ids = new Map(),
    attempts = new Map(),
    episodes = new Map(),
    terminals = new Set(),
    presentations = new Set(),
    forecasts = new Set(),
    flags = new Set(),
    corrections = new Map();
  for (const event of rows) {
    const e = event.cycle,
      old = ids.get(event.id);
    if (old) {
      if (canonicalSupport(old) !== canonicalSupport(event))
        throw Error("Support event ID was reused with changed contents.");
      continue;
    }
    if (e.parentEventId !== null) {
      const parent = ids.get(e.parentEventId);
      if (
        !parent ||
        parent.at >= event.at ||
        parent.cycle.episodeId !== e.episodeId ||
        canonicalSupport(parent.cycle.actor) !== canonicalSupport(e.actor)
      )
        throw Error(
          "Support parent must be an earlier event in the same learner episode.",
        );
    }
    const identity = canonicalSupport({
      actor: e.actor,
      intentRef: e.intentRef,
      organizationObjectiveRef: e.organizationObjectiveRef,
    });
    if (episodes.has(e.episodeId) && episodes.get(e.episodeId) !== identity)
      throw Error("An episode cannot change learner or scope.");
    episodes.set(e.episodeId, identity);
    if (e.attemptId !== null) {
      const signature = canonicalSupport({
        episodeId: e.episodeId,
        identity,
        taskRef: e.taskRef,
        mediaRef: e.mediaRef,
        analysisRef: e.analysisRef,
        targetIds: [...e.targetIds].sort(),
        taskType: e.taskType,
        inputModality: e.inputModality,
        condition: e.condition,
      });
      if (attempts.has(e.attemptId) && attempts.get(e.attemptId) !== signature)
        throw Error("Attempt identity cannot change.");
      attempts.set(e.attemptId, signature);
    }
    if (e.observation === "task-presented") {
      if (
        forecasts.has(e.attemptId) ||
        (e.forecast && presentations.has(e.attemptId))
      )
        throw Error("A forecast must be frozen at the first presentation.");
      if (e.forecast) forecasts.add(e.attemptId);
      presentations.add(e.attemptId);
    }
    if (e.observation === "question-flagged") {
      if (!terminals.has(e.attemptId) || flags.has(e.attemptId))
        throw Error("A submitted question can be flagged once.");
      flags.add(e.attemptId);
    }
    if (e.observation === "response") {
      if (terminals.has(e.attemptId))
        throw Error(
          "An attempt already has a response. Retry its original ID.",
        );
      const prior = [...ids.values()].filter(
        (p) => p.cycle.attemptId === e.attemptId,
      );
      if (!prior.some((p) => p.cycle.observation === "task-presented"))
        throw Error("A response requires its earlier task presentation.");
      if (
        e.inputModality === "auditory" &&
        !prior.some((p) => p.cycle.observation === "playback")
      )
        throw Error("An auditory response requires recorded playback.");
      terminals.add(e.attemptId);
      const expected = supportSnapshot(
        [...ids.values()],
        e.attemptId,
        event.at,
      );
      if (canonicalSupport(expected) !== canonicalSupport(e.supportSnapshot))
        throw Error(
          "The response support snapshot differs from its prior timeline.",
        );
    }
    if (e.correction) {
      const key =
          canonicalSupport(e.actor) + "|" + refKey(e.correction.replaces),
        next = refKey(e.correction.uses);
      if (corrections.has(key) && corrections.get(key) !== next)
        throw Error(
          "Conflicting analysis correction branches need explicit reconciliation.",
        );
      corrections.set(key, next);
    }
    ids.set(event.id, event);
  }
  // Validate opens/uses even when the episode has no response yet.
  for (const attempt of attempts.keys())
    supportSnapshot([...ids.values()], attempt);
  return [...ids.values()];
}
export function normalizeSupportAnswer(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .trim()
    .replace(/[.!?。،؟]+$/gu, "")
    .trim()
    .replace(/\s+/gu, " ");
}
const refKey = (r) => r.id + "@" + r.version;
export function currentAnalysisRef(events, actor, ref) {
  const replacements = new Map();
  const scope = canonicalSupport(actor);
  for (const { cycle } of events) {
    if (cycle?.correction && canonicalSupport(cycle.actor) === scope)
      replacements.set(
        refKey(cycle.correction.replaces),
        cycle.correction.uses,
      );
  }
  let result = ref;
  while (replacements.has(refKey(result))) {
    const next = replacements.get(refKey(result));
    if (next.id !== result.id || next.version <= result.version) break;
    result = next;
  }
  return { ...result };
}
/** A source is interpreted without looking at the learner's answer or posterior. */
export function interpretSupportMedia(task, analysis) {
  if (analysis?.status === "retired")
    return {
      status: "unavailable",
      reason: analysis.retirementReason,
      hypotheses: [],
    };
  if (!task || !analysis || analysis.status === "unavailable")
    return {
      status: "unavailable",
      reason: "The recorded task or linguistic analysis is unavailable.",
      hypotheses: [],
    };
  if (
    canonicalSupport(task.mediaRef) !== canonicalSupport(analysis.mediaRef) ||
    !Array.isArray(analysis.hypotheses) ||
    !analysis.hypotheses.length
  )
    return {
      status: "unavailable",
      reason: "The source version and analysis do not agree.",
      hypotheses: [],
    };
  const plausible = analysis.hypotheses.filter(
    (h) => Number.isFinite(h.weight) && h.weight > 0,
  );
  if (plausible.some((h) => !h.answers?.[task.id]))
    return {
      status: "unavailable",
      reason: "A plausible analysis has no reviewed answer for this task.",
      hypotheses: COPY(plausible),
    };
  if (!plausible.length)
    return {
      status: "unavailable",
      reason: "No plausible analysis supplies this task rubric.",
      hypotheses: [],
    };
  const signature = (h) =>
    canonicalSupport({
      full: [...(h.answers[task.id].full || [])]
        .map(normalizeSupportAnswer)
        .sort(),
      partial: [...(h.answers[task.id].partial || [])]
        .map(normalizeSupportAnswer)
        .sort(),
      incorrect: [...(h.answers[task.id].incorrect || [])]
        .map(normalizeSupportAnswer)
        .sort(),
      choice: h.answers[task.id].choice ?? null,
    });
  if (new Set(plausible.map(signature)).size !== 1)
    return {
      status: "ambiguous",
      reason:
        "Plausible analyses require incompatible answers. Correct the source or analysis before scoring.",
      hypotheses: COPY(plausible),
      uncertainty: COPY(analysis.uncertainty),
    };
  const sum = plausible.reduce((n, h) => n + h.weight, 0);
  return {
    status: "compatible",
    reason:
      "Answers agree across the retained analyses; their likelihoods remain a mixture.",
    hypotheses: plausible.map((h) => ({ ...COPY(h), weight: h.weight / sum })),
    uncertainty: COPY(analysis.uncertainty),
    analysisRef: { id: analysis.id, version: analysis.version },
  };
}
export function scoreSupportResponse(task, analysis, response) {
  const interpretation = interpretSupportMedia(task, analysis),
    base = {
      outcome: "abstain",
      score: null,
      reliability: 0,
      reason: interpretation.reason,
      ruleVersion: "support-authored-score-v1",
    };
  if (interpretation.status !== "compatible") return base;
  const rubric = interpretation.hypotheses[0].answers[task.id];
  let score;
  if (response && Object.hasOwn(response, "choice"))
    score = response.choice === rubric.choice ? 1 : 0;
  else {
    const normalize = (v) =>
        normalizeSupportAnswer(
          task.answerPolicyId === "arabic-optional-vowels-v1"
            ? String(v ?? "").replace(/[\u064b-\u0652\u0640]/gu, "")
            : v,
        ),
      answer = normalize(response?.answer);
    score = (rubric.full || []).map(normalize).includes(answer)
      ? 1
      : (rubric.partial || []).map(normalize).includes(answer)
        ? 0.5
        : (rubric.incorrect || []).map(normalize).includes(answer)
          ? 0
          : null;
  }
  if (score === null)
    return {
      ...base,
      reason:
        "This wording is outside the reviewed rubric. It needs review, not an automatic error judgment.",
    };
  return {
    ...base,
    outcome: score === 1 ? "correct" : score === 0.5 ? "partial" : "incorrect",
    score,
    reliability: task.scoringReliability,
    reason:
      "Compared with the versioned authored rubric; scoring reliability is provisional.",
  };
}
export function projectSupportEvidence(
  events,
  {
    actor: who,
    resolveTask,
    resolveAnalysis,
    now = Date.now(),
    recentAnswerMs = 30 * 60 * 1000,
  } = {},
) {
  actor(who);
  integer(now, "projection time");
  if (
    typeof resolveTask !== "function" ||
    typeof resolveAnalysis !== "function"
  )
    throw Error("Versioned task and analysis resolvers are required.");
  const all = validateSupportSequence(events),
    owned = all.filter(
      (e) =>
        canonicalSupport(e.cycle.actor) === canonicalSupport(who) &&
        e.at <= now,
    ),
    heads = new Map(),
    correctionIds = new Map();
  for (const event of owned)
    if (event.cycle.correction) {
      const c = event.cycle.correction,
        k = refKey(c.replaces);
      if (heads.has(k) && refKey(heads.get(k)) !== refKey(c.uses))
        throw Error(
          "Conflicting analysis correction branches need explicit reconciliation.",
        );
      heads.set(k, COPY(c.uses));
      correctionIds.set(k, event.id);
    }
  const seen = [],
    ledger = [],
    rows = [];
  for (const event of owned) {
    const e = event.cycle;
    if (e.observation !== "response") {
      ledger.push({
        eventId: event.id,
        observation: e.observation,
        at: event.at,
        knowledgeClaim: null,
      });
      seen.push(event);
      continue;
    }
    let effective = COPY(e.analysisRef),
      corrections = [];
    const visited = new Set();
    while (heads.has(refKey(effective))) {
      if (visited.has(refKey(effective)))
        throw Error("Analysis correction cycle.");
      visited.add(refKey(effective));
      corrections.push(correctionIds.get(refKey(effective)));
      effective = heads.get(refKey(effective));
    }
    const task = resolveTask(e.taskRef),
      analysis = resolveAnalysis(effective),
      interpretation = interpretSupportMedia(task, analysis);
    let scoring = scoreSupportResponse(task, analysis, e.response);
    const reasons = [];
    // A deliberately flawed answer key can be inspected without grading the learner.
    if (task?.reviewedCorrection) reasons.push("answer-key-exercise");
    if (
      !task ||
      task.version !== e.taskRef.version ||
      canonicalSupport(task.targetIds?.slice().sort()) !==
        canonicalSupport(e.targetIds.slice().sort()) ||
      task.type !== e.taskType ||
      task.inputModality !== e.inputModality ||
      canonicalSupport(task.condition) !== canonicalSupport(e.condition)
    ) {
      reasons.push("task-identity-unavailable");
      scoring = {
        ...scoring,
        outcome: "abstain",
        score: null,
        reliability: 0,
        reason: "The versioned task condition no longer resolves.",
      };
    }
    const overlaps = (prior) =>
      prior.cycle.targetIds.some((t) => e.targetIds.includes(t));
    const episodeResponses = seen.filter(
      (p) =>
        p.cycle.observation === "response" &&
        p.cycle.episodeId === e.episodeId &&
        overlaps(p),
    );
    if (episodeResponses.length) reasons.push("dependent-episode-repeat");
    const priorFeedback = seen.filter(
      (p) =>
        p.cycle.attemptId !== e.attemptId &&
        p.cycle.condition.itemId === e.condition.itemId &&
        event.at - p.at <= recentAnswerMs &&
        overlaps(p) &&
        (p.cycle.observation === "feedback" ||
          p.cycle.observation === "response" ||
          (p.cycle.observation === "support-opened" &&
            p.cycle.support.role === "extra") ||
          (p.cycle.observation === "support-available" &&
            p.cycle.support.visibility === "visible" &&
            (p.cycle.support.role === "extra" ||
              (["form-recall", "contextual-production"].includes(e.taskType) &&
                p.cycle.support.type === "transcript")))),
    );
    const visible = e.supportSnapshot.filter(
        (s) =>
          s.visibility === "visible" ||
          s.openedAt !== null ||
          s.usedAt !== null,
      ),
      extra = visible.filter((s) => s.role === "extra");
    const independent =
      extra.length === 0 &&
      priorFeedback.length === 0 &&
      episodeResponses.length === 0;
    if (scoring.score === null)
      reasons.push(
        interpretation.status === "ambiguous"
          ? "incompatible-linguistic-analyses"
          : "unscorable",
      );
    if (scoring.reliability === 0) reasons.push("unreliable-scoring");
    const condition = {
      available: [...new Set(e.supportSnapshot.map((s) => s.type))].sort(),
      opened: [
        ...new Set(
          e.supportSnapshot
            .filter((s) => s.openedAt !== null)
            .map((s) => s.type),
        ),
      ].sort(),
      used: [
        ...new Set(
          e.supportSnapshot.filter((s) => s.usedAt !== null).map((s) => s.type),
        ),
      ].sort(),
      visible: [...new Set(visible.map((s) => s.type))].sort(),
      extra: [...new Set(extra.map((s) => s.type))].sort(),
      extraSupports: extra
        .map((s) => ({ id: s.id, type: s.type }))
        .sort((a, b) => a.id.localeCompare(b.id)),
      earlierAnswerEventIds: priorFeedback.map((p) => p.id),
    };
    const row = {
      eventId: event.id,
      at: event.at,
      episodeId: e.episodeId,
      targetIds: COPY(e.targetIds),
      taskRef: COPY(e.taskRef),
      task: COPY(task),
      mediaRef: COPY(e.mediaRef),
      recordedAnalysisRef: COPY(e.analysisRef),
      appliedAnalysisRef: COPY(effective),
      correctionEventIds: corrections,
      historicalScoring: COPY(e.scoring),
      scoring,
      interpretation,
      condition,
      supportSnapshot: COPY(e.supportSnapshot),
      independent,
      admitted: reasons.length === 0,
      exclusionReasons: [...new Set(reasons)],
      jointObservationCount: reasons.length ? 0 : 1,
      evidenceOrigin: "direct-response",
    };
    rows.push(row);
    ledger.push(row);
    seen.push(event);
  }
  return {
    schemaVersion: 1,
    modelVersion: SUPPORT_MODEL_VERSION,
    policyVersion: SUPPORT_POLICY_VERSION,
    actor: COPY(who),
    rows,
    ledger,
    jointObservations: rows.filter((r) => r.admitted).length,
    learningGain: null,
    attentionObserved: false,
  };
}
export function supportAuditRecord(event) {
  const r = validateSupportEvent(event),
    e = r.cycle;
  return {
    event_id: r.id,
    episode_id: e.episodeId,
    parent_event_id: e.parentEventId,
    learner_id: e.actor.userId ?? "guest",
    media_item_id: e.mediaRef.id,
    media_item_version: e.mediaRef.version,
    linguistic_analysis_id: e.analysisRef.id,
    linguistic_analysis_version: e.analysisRef.version,
    target_ids: COPY(e.targetIds),
    task_type: e.taskType,
    input_modality: e.inputModality,
    response_modality: e.responseModality,
    support_availability_and_use: COPY(e.supportSnapshot),
    support_action: COPY(e.support),
    response: COPY(e.response),
    scoring_result: COPY(e.scoring),
    scoring_uncertainty: e.scoring === null ? null : 1 - e.scoring.reliability,
    event_timestamp: r.at,
    ...(e.forecast ? { prospective_forecast: COPY(e.forecast) } : {}),
    model_version: e.modelVersion,
    selection_policy_version: e.selectionPolicyVersion,
  };
}
