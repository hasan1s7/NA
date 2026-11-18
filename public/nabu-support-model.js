/** A deliberately small conditional model. A response supplies ONE likelihood
 * for its JOINT target set. No graph neighbours receive invented observations.
 * Cue conditions have separate parameters: there is no scalar hint discount. */
import * as SupportCycle from "./nabu-support-cycle.js";
export const SUPPORT_PARAMETERS = Object.freeze({
  version: "support-parameters-provisional-v1",
  calibrated: false,
  gridSize: 81,
  priorAlpha: 2,
  priorBeta: 2,
  halfLifeDays: 30,
  forgettingFloor: 0.05,
  defaultGuess: 0.03,
  defaultSlip: 0.08,
  defaultDifficulty: 0,
  practiceGain: null,
  intervalMass: 0.8,
  independentReviewHours: 24,
  assumptions: [
    "Uniformly spaced ability grid with a Beta(2,2) starting distribution.",
    "Ordinal scores use a two-unit binomial rubric, still one joint observation.",
    "Scorer reliability mixes the rubric likelihood with an uninformative outcome.",
    "Assistance conditions are estimated separately; no universal cue strength.",
    "Half-life, difficulty, guessing and slips are provisional sensitivity assumptions.",
    "Practice opportunities are logged; their causal learning gain is unidentified.",
  ],
});
const DAY = 86400000,
  clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const normalize = (w) => {
  const n = w.reduce((a, b) => a + b, 0);
  if (!Number.isFinite(n) || n <= 0)
    throw Error("Invalid posterior normalizer.");
  return w.map((x) => x / n);
};
const sigmoid = (x) => 1 / (1 + Math.exp(-x));
const logit = (x) => Math.log(x / (1 - x));
export function supportConditionKey(
  task,
  condition = { extra: [], visible: [], earlierAnswerEventIds: [] },
) {
  return SupportCycle.canonicalSupport({
    level: task.condition.level,
    scopeId: task.condition.scopeId,
    itemId: task.condition.level === "item" ? task.condition.itemId : null,
    targets: [...task.targetIds].sort(),
    skill: task.type,
    input: task.inputModality,
    response: task.responseModality,
    variety: task.condition.variety,
    taskCues: (task.supports || [])
      .filter((s) => s.role === "task" && s.visibility === "visible")
      .map((s) => s.type)
      .sort(),
    extra:
      condition.extraSupports || [...new Set(condition.extra || [])].sort(),
    earlierAnswer: !!condition.earlierAnswerEventIds?.length,
  });
}
function prior(p) {
  const grid = Array.from(
    { length: p.gridSize },
    (_, i) => (i + 0.5) / p.gridSize,
  );
  return {
    grid,
    weights: normalize(
      grid.map((q) => q ** (p.priorAlpha - 1) * (1 - q) ** (p.priorBeta - 1)),
    ),
  };
}
function summary(grid, weights, mass = 0.8) {
  let sum = 0,
    lo = null,
    hi = null;
  const tail = (1 - mass) / 2;
  for (let i = 0; i < grid.length; i++) {
    sum += weights[i];
    if (lo === null && sum >= tail) lo = grid[i];
    if (hi === null && sum >= 1 - tail) hi = grid[i];
  }
  return {
    mean: grid.reduce((n, q, i) => n + q * weights[i], 0),
    interval: [lo ?? grid[0], hi ?? grid.at(-1)],
    mass,
  };
}
/** Prediction transition, NOT a measurement and NOT evidence of forgetting. */
export function transitionSupportMemory(
  distribution,
  elapsedMs,
  parameters = SUPPORT_PARAMETERS,
) {
  const { grid, weights } = distribution;
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0)
    throw Error("Invalid elapsed time.");
  const retention = 2 ** (-elapsedMs / (DAY * parameters.halfLifeDays)),
    next = grid.map(() => 0);
  for (let i = 0; i < grid.length; i++) {
    const q = Math.min(
      grid[i],
      parameters.forgettingFloor +
        (grid[i] - parameters.forgettingFloor) * retention,
    );
    const index = clamp(q * grid.length - 0.5, 0, grid.length - 1),
      lo = Math.floor(index),
      hi = Math.ceil(index);
    next[lo] += weights[i] * (hi === lo ? 1 : hi - index);
    if (hi !== lo) next[hi] += weights[i] * (index - lo);
  }
  return {
    grid: [...grid],
    weights: normalize(next),
    transition: {
      kind: "provisional-forgetting-prediction",
      elapsedMs,
      halfLifeDays: parameters.halfLifeDays,
      learningGain: null,
      observation: false,
    },
  };
}
/** Practice is a separate possible transition. Without longitudinal calibration
 * the default makes no automatic upward change to any ability distribution. */
export function transitionSupportPractice(
  distribution,
  { kind = "practice", gain = null } = {},
) {
  if (gain !== null)
    throw Error("A calibrated practice-gain model is not installed.");
  return {
    ...structuredClone(distribution),
    practice: { kind, gain: null, identified: false, observation: false },
  };
}
function likelihood(theta, row, p) {
  const task = row.task,
    g = clamp(task.guess ?? p.defaultGuess, 0, 0.8),
    slip = clamp(task.slip ?? p.defaultSlip, 0, 0.8);
  if (!Number.isFinite(g) || !Number.isFinite(slip) || g + slip >= 1)
    throw Error(
      "Guessing and slip probabilities must leave an ability-dependent range.",
    );
  const r = clamp(row.scoring.reliability, 0, 1),
    ordinal = task.scoring === "ordinal";
  let total = 0;
  for (const h of row.interpretation.hypotheses) {
    const difficulty =
      (task.difficulty ?? p.defaultDifficulty) + (h.difficultyOffset || 0);
    const ability = g + (1 - g - slip) * sigmoid(logit(theta) - difficulty);
    const s = row.scoring.score;
    const rubric = ordinal
      ? s === 1
        ? ability ** 2
        : s === 0
          ? (1 - ability) ** 2
          : 2 * ability * (1 - ability)
      : s === 1
        ? ability
        : 1 - ability;
    total += h.weight * (r * rubric + (1 - r) / (ordinal ? 3 : 2));
  }
  return Math.max(1e-12, total);
}
export function fitSupportModel(
  projection,
  { now = Date.now(), parameters = SUPPORT_PARAMETERS } = {},
) {
  const p = { ...SUPPORT_PARAMETERS, ...parameters };
  if (
    !Number.isInteger(p.gridSize) ||
    p.gridSize < 21 ||
    p.gridSize > 401 ||
    p.halfLifeDays <= 0
  )
    throw Error("Invalid support parameters.");
  const cells = new Map(),
    updates = [];
  for (const row of projection.rows
    .filter((r) => r.admitted && r.at <= now)
    .sort((a, b) => a.at - b.at || a.eventId.localeCompare(b.eventId))) {
    const key = supportConditionKey(row.task, row.condition);
    let cell = cells.get(key);
    if (!cell) {
      cell = {
        key,
        task: structuredClone(row.task),
        ...prior(p),
        at: row.at,
        eventIds: [],
        independent: row.independent,
        contexts: [],
        speakers: [],
        condition: structuredClone(row.condition),
      };
      cells.set(key, cell);
    }
    const transition = transitionSupportMemory(
        cell,
        Math.max(0, row.at - cell.at),
        p,
      ),
      before = summary(transition.grid, transition.weights, p.intervalMass);
    const weights = normalize(
      transition.weights.map((w, i) => w * likelihood(cell.grid[i], row, p)),
    );
    const after = summary(cell.grid, weights, p.intervalMass);
    updates.push({
      eventId: row.eventId,
      key,
      jointObservations: 1,
      operation: "measurement",
      before,
      after,
      transition: transition.transition,
      score: row.scoring.score,
      support: row.condition,
      evidenceOrigin: "direct-response",
    });
    cell.weights = weights;
    cell.at = row.at;
    cell.eventIds.push(row.eventId);
    cell.contexts.push(row.task.condition.contextId);
    cell.speakers.push(row.task.condition.speakerId);
  }
  const estimates = [...cells.values()].map((c) => {
    const d = transitionSupportMemory(c, Math.max(0, now - c.at), p);
    return {
      key: c.key,
      condition: c.condition,
      task: c.task,
      eventIds: c.eventIds,
      independent: c.independent,
      directObservations: c.eventIds.length,
      contexts: [...new Set(c.contexts)],
      speakers: [...new Set(c.speakers)],
      observedAt: c.at,
      timeSinceObservationMs: now - c.at,
      atObservation: summary(c.grid, c.weights, p.intervalMass),
      prediction: summary(d.grid, d.weights, p.intervalMass),
      predictionTransition: d.transition,
      evidenceOrigin: "model-inferred-from-direct-responses",
      observedAcrossContexts: new Set(c.contexts).size >= 2,
      generalizationClaim: null,
      grid: c.grid,
      weights: c.weights,
      predictionWeights: d.weights,
    };
  });
  const model = {
    modelVersion: SupportCycle.SUPPORT_MODEL_VERSION,
    parameters: p,
    calibrated: false,
    estimates,
    updates,
    jointObservations: updates.length,
    learningGain: null,
    practiceOpportunities: projection.ledger.filter((e) =>
      ["feedback", "repair", "support-opened"].includes(e.observation),
    ).length,
  };
  model.supportDependence = estimateSupportDependence(model);
  return model;
}
/** An observational contrast, never a diagnosis from a lookup. Small unmatched
 * samples stay explicitly insufficient; cue types are compared separately. */
export function estimateSupportDependence(model) {
  return model.estimates
    .filter((e) => !e.independent)
    .map((assisted) => {
      const key = supportConditionKey(assisted.task, {
        extra: [],
        earlierAnswerEventIds: [],
      });
      const independent = model.estimates.find(
        (e) => e.independent && e.key === key,
      );
      const base = {
        supportedCondition: assisted.condition,
        independentKey: key,
        assistedKey: assisted.key,
        causalClaim: false,
        minimumObservationsPerCondition: 2,
        thresholdProvisional: true,
      };
      if (
        !independent ||
        independent.directObservations < 2 ||
        assisted.directObservations < 2
      )
        return {
          ...base,
          status: "insufficient-comparable-evidence",
          difference: null,
          reason:
            "At least two direct responses in each comparable condition are required by this provisional policy.",
        };
      const differences = [];
      for (let i = 0; i < assisted.grid.length; i++)
        for (let j = 0; j < independent.grid.length; j++)
          differences.push({
            value: assisted.grid[i] - independent.grid[j],
            weight:
              assisted.predictionWeights[i] * independent.predictionWeights[j],
          });
      differences.sort((a, b) => a.value - b.value);
      let cumulative = 0,
        lo = null,
        hi = null;
      for (const d of differences) {
        cumulative += d.weight;
        if (lo === null && cumulative >= 0.1) lo = d.value;
        if (hi === null && cumulative >= 0.9) hi = d.value;
      }
      return {
        ...base,
        status:
          lo > 0
            ? "condition-specific-support-difference"
            : "difference-uncertain",
        difference: {
          mean: differences.reduce((n, d) => n + d.value * d.weight, 0),
          interval: [lo, hi],
          mass: 0.8,
        },
        reason:
          "Observational conditional contrast. Context, selection and task differences can confound it; it does not establish causal support dependence.",
      };
    });
}
export function supportSensitivity(projection, { now = Date.now() } = {}) {
  const variants = [
    ["default", {}],
    ["faster decay", { halfLifeDays: 7 }],
    ["slower decay", { halfLifeDays: 90 }],
    ["harder tasks", { defaultDifficulty: 0.6 }],
    ["easier tasks", { defaultDifficulty: -0.6 }],
    ["more slips", { defaultSlip: 0.18 }],
    ["more guessing", { defaultGuess: 0.15 }],
  ];
  // Override authored provisional values too; these are assumptions, not fitted data.
  const runs = variants.map(([name, overrides]) => {
    const changed = structuredClone(projection);
    for (const r of changed.rows)
      if (r.task) {
        if (overrides.defaultDifficulty !== undefined)
          r.task.difficulty =
            (r.task.difficulty || 0) + overrides.defaultDifficulty;
        if (overrides.defaultSlip !== undefined)
          r.task.slip = overrides.defaultSlip;
        if (overrides.defaultGuess !== undefined)
          r.task.guess = overrides.defaultGuess;
      }
    const fit = fitSupportModel(changed, {
      now,
      parameters: { ...SUPPORT_PARAMETERS, ...overrides },
    });
    return {
      name,
      parameters: fit.parameters,
      estimates: fit.estimates.map((e) => ({ key: e.key, ...e.prediction })),
    };
  });
  return {
    empiricalValidation: false,
    runs,
    interpretation:
      "Parameter sensitivity checks; not calibration or evidence of learning.",
  };
}
/** Review requests are derived from actual independent responses. Looking up an
 * answer never postpones an existing independent check or legacy card review. */
export function planSupportCycle(
  projection,
  tasks,
  { now = Date.now(), avoidPractice = false } = {},
) {
  if (avoidPractice)
    return {
      version: SupportCycle.SUPPORT_POLICY_VERSION,
      kind: "continue",
      taskId: null,
      dueAt: null,
      reason: "Your current intention excludes practice.",
    };
  const targets = new Set(tasks.flatMap((t) => t.targetIds));
  const rows = projection.rows.filter(
      (r) => r.at <= now && r.targetIds.some((t) => targets.has(t)),
    ),
    direct = rows.filter((r) => r.admitted && r.independent);
  const latest = direct.at(-1),
    any = rows.at(-1);
  const choose = (kind, predicate, reason, dueAt = now) => {
    const taskId = tasks.find(predicate)?.id || null;
    return {
      version: SupportCycle.SUPPORT_POLICY_VERSION,
      kind: taskId ? kind : "continue",
      taskId,
      dueAt: taskId ? dueAt : null,
      reason: taskId
        ? reason
        : "No reviewed check matches this request. Keep reading or choose a different skill.",
    };
  };
  if (!latest) {
    const fresh = tasks.find(
      (t) =>
        t.type === "meaning-recall" &&
        t.inputModality === "written" &&
        (!any || t.condition.contextId !== any.task?.condition.contextId),
    );
    return choose(
      "retrieval",
      (t) => (fresh ? t.id === fresh.id : t.type === "form-recall"),
      any
        ? "Try retrieval with the revealing aids closed. Recent answer exposure is still recorded; independent ability has not yet been established."
        : "Start anywhere: read with help or try a short check.",
    );
  }
  const checkKey = supportConditionKey(latest.task);
  const sameCheck = (task) => supportConditionKey(task) === checkKey;
  if (latest.scoring.score < 1)
    return choose(
      "targeted-repair",
      sameCheck,
      "Review the specific difficulty, then try a different context. This failure alone does not establish forgetting.",
    );
  const contexts = new Set(
    direct
      .filter((r) => r.scoring.score === 1 && sameCheck(r.task))
      .map((r) => r.task.condition.contextId),
  );
  if (contexts.size < 2)
    return choose(
      "variation",
      (t) => sameCheck(t) && !contexts.has(t.condition.contextId),
      "One context worked without extra aids. A different context can test transfer.",
    );
  const dueAt = latest.at + SUPPORT_PARAMETERS.independentReviewHours * 3600000;
  return choose(
    "later-retrieval",
    sameCheck,
    "Return after a delay. The time is provisional; assisted practice does not reset it.",
    dueAt,
  );
}

/** Two independently demonstrated contexts per direction is a pilot scheduling
 * convention. The ladder never promotes a different modality or implies learning. */
export function momentDirections(rows, key) {
  const contexts = {
    reading: new Set(),
    listening: new Set(),
    writing: new Set(),
    speaking: new Set(),
  };
  for (const row of rows) {
    const t = row.task;
    if (
      !t ||
      t.momentKey !== key ||
      t.momentStage === "old-key" ||
      !row.admitted ||
      !row.independent ||
      row.scoring.score !== 1
    )
      continue;
    const direction =
      t.responseModality === "speech"
        ? "speaking"
        : ["form-recall", "contextual-production"].includes(t.type)
          ? "writing"
          : t.inputModality === "auditory"
            ? "listening"
            : "reading";
    contexts[direction].add(t.condition.contextId);
  }
  return Object.fromEntries(
    Object.entries(contexts).map(([k, v]) => [k, Math.min(2, v.size)]),
  );
}
export function forecastMoment(task, analysis, projection, model) {
  const interpretation = SupportCycle.interpretSupportMedia(task, analysis);
  if (
    !task.momentKey ||
    task.momentStage === "old-key" ||
    task.scoring !== "binary" ||
    interpretation.status !== "compatible"
  )
    return null;
  const cell = model.estimates.find((c) => c.key === supportConditionKey(task));
  const initial = prior(SUPPORT_PARAMETERS),
    weights = cell?.predictionWeights || initial.weights,
    grid = cell?.grid || initial.grid;
  const positive = {
    task,
    interpretation,
    scoring: { score: 1, reliability: task.scoringReliability },
  };
  const predicted = weights.reduce(
    (sum, w, i) => sum + w * likelihood(grid[i], positive, SUPPORT_PARAMETERS),
    0,
  );
  const rung = momentDirections(projection.rows, task.momentKey)[
    task.inputModality === "auditory" ? "listening" : "reading"
  ];
  return {
    version: "moment-forecast-v1",
    ladder: task.guess + ((1 - task.guess) * rung) / 3,
    model: predicted,
    priorResponses: cell?.directObservations || 0,
  };
}
export function compareMomentForecasts(events, projection) {
  const presented = new Map(
    events.filter((e) => e.cycle?.forecast).map((e) => [e.cycle.attemptId, e]),
  );
  const byId = new Map(events.map((e) => [e.id, e]));
  const pairs = [];
  for (const r of projection.rows) {
    const p = presented.get(byId.get(r.eventId)?.cycle?.attemptId);
    if (
      !p ||
      !r.independent ||
      !r.admitted ||
      r.correctionEventIds.length ||
      p.at >= r.at ||
      ![0, 1].includes(r.scoring.score)
    )
      continue;
    pairs.push({
      eventId: r.eventId,
      atPrediction: p.at,
      atAnswer: r.at,
      forecast: p.cycle.forecast,
      outcome: r.scoring.score,
    });
  }
  const loss = (k) =>
    pairs.length
      ? pairs.reduce((n, p) => n + (p.forecast[k] - p.outcome) ** 2, 0) /
        pairs.length
      : null;
  return {
    pairs,
    eligible: pairs.length,
    ladderBrier: loss("ladder"),
    conditionalBrier: loss("model"),
    calibrated: false,
  };
}
