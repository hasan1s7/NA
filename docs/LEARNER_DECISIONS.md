# Bayesian learner decisions

`public/nabu-learner-policy.js` compares available actions using the **joint posterior** from `nabu-learner-model.js`. It can select Continue, explicit immediate support, or one diagnostic followed by the best terminal action for the observed answer. It never creates evidence, changes a fitted posterior, or writes to the observation ledger.

The implemented objective is immediate task performance after a declared amount of effort. It does not estimate how much a lesson teaches, future retention gain, or the causal benefit of practice. Those fields remain `null`.

## Actions and loss

A target is an exact fitted task, with a nonnegative goal weight. Positive weights are normalized to sum to one. A support action identifies the exact tasks it affects and the exact required components it supplies. For example, supplying an Arabic root meaning can bypass that component in the immediate task likelihood. It does not mark the root, a pattern, the whole word, or its neighbors as mastered.

For joint posterior draw \(s\), terminal action \(a\), and target task \(t\), the loss is

\[
L_s(a)=\sum_t \widetilde w_t\{1-p_s(Y_t=1\mid a)\}+c_a+\lambda d_a.
\]

Here \(d_a\) is the action's declared duration in seconds, \(c_a\) is its explicit cost in normalized failure-loss units, and \(\lambda\) converts seconds to those same units. The default \(\lambda=0.002\) is an authored preference, not a fitted cognitive parameter. It makes 15 seconds cost 0.03 units on a target objective ranging from zero to one. Applications can change it, and every result records the value used.

The model supplies the success probabilities, including its declared guessing, slips, whole-form route, component conjunction, and time effects. The policy averages the loss using posterior draw weights and chooses the available action with the lowest expected loss. Continue has zero additional duration and cost. If two actions have equal expected loss, Continue wins the tie.

Predictions use the time at completion of each candidate action. Following a diagnostic, the forecast includes the diagnostic duration and the follow-up support duration. This is a forecast under the existing model; no teaching effect is inserted into its state.

## One-step expected value of sample information

For diagnostic \(q\), the policy predicts the probability of each binary response using every draw. If \(v_s\) is the current posterior weight and \(\ell_s(y)\) is the diagnostic likelihood of answer \(y\), it computes

\[
P(y\mid D,q)=\sum_s v_s\ell_s(y),\qquad
v_s^{(y)}=\frac{v_s\ell_s(y)}{\sum_j v_j\ell_j(y)}.
\]

The same draw index represents the learner's root, pattern, word, mode, language, and shared effects throughout the calculation. Reweighting all of those together preserves their posterior covariance. The implementation does not independently adjust per-task means.

During this look-ahead, **opportunity counts and last-opportunity histories are held fixed**. Only wall-clock time advances; the diagnostic likelihood is evaluated at diagnostic completion, and terminal predictions include any subsequent action time. The calculation estimates the value of information without adding a practice-count effect or resetting a practice clock. After a real accepted response, the ordinary refit does update histories and may therefore produce a different subsequent choice. This is an information-only approximation, not a rollout of every dynamic state change in the learner model.

Let \(A_q\) be the terminal actions that fit the **remaining** time budget after the diagnostic. Both sides of the following comparison use the same future time and the same feasible set:

\[
\operatorname{EVSI}(q)=
\min_{a\in A_q}\mathbb E[L(a)\mid D]
-\sum_{y\in\{0,1\}}P(y\mid D,q)
\min_{a\in A_q}\mathbb E[L(a)\mid D,y,q].
\]

This is expected improvement in the next decision. A diagnostic can reveal a great deal about a parameter and still have zero EVSI if the same support remains best after either answer. Entropy reduction alone does not make the exercise worth asking.

EVSI is nonnegative apart from numerical rounding because the decision maker can always retain the previous action. The policy separately reports the delay and budget penalty relative to acting now:

\[
\Delta_q=
\min_{a\in A_q}\mathbb E[L(a)\mid D,\text{after }q]
-\min_{a\in A_0}\mathbb E[L(a)\mid D,\text{now}].
\]

Thus the diagnostic's net value is

\[
\operatorname{NetValue}(q)=\operatorname{EVSI}(q)-\Delta_q-c_q-\lambda d_q.
\]

A diagnostic can be selected only when its positive-probability response branches choose different terminal actions, its EVSI is positive, and its net value exceeds the configured minimum. It must also beat the other eligible actions. A known gap usually favors direct support: checking again does not buy a different decision.

The look-ahead horizon is one diagnostic. Branches contain terminal actions only. The algorithm does not claim to solve an entire teaching sequence or a long-horizon partially observed control problem.

## Exact two-state example

Suppose two posterior states have equal weight: a missing root ingredient and a missing pattern ingredient. Unaided target success is zero in both. Root help makes success certain only in the first state; pattern help does so only in the second. Either support costs 0.2. An ideal diagnostic distinguishes those states and costs 0.1.

| Choice | Expected target failure | Effort cost | Total expected loss |
|---|---:|---:|---:|
| Continue | 1.0 | 0.0 | 1.0 |
| Root help now | 0.5 | 0.2 | 0.7 |
| Pattern help now | 0.5 | 0.2 | 0.7 |
| Diagnostic, then matching help | 0.0 | 0.1 + 0.2 | 0.3 |

The expected value of information is \(0.7-0.2=0.5\); the net improvement is \(0.7-0.3=0.4\). If the diagnostic instead has success likelihoods 0.8 and 0.2, either answer leaves uncertainty. Bayes' rule gives branch weights 0.8 and 0.2, the optimal branch loss becomes 0.4, and EVSI falls to 0.3. The module's tests check these exact values.

These are numerical verification cases, not estimated learner behavior.

## API

```js
import { selectLearnerDecision } from './nabu-learner-policy.js';

const decision = selectLearnerDecision({
  fit,
  now: fit.now,
  targets: [{ taskId: selectedTask.id, weight: 1 }],
  actions: [
    { id: 'continue', kind: 'continue', title: 'Continue' },
    {
      id: 'root-help', kind: 'support',
      title: 'Show the root meaning',
      taskId: selectedTask.id,
      providedComponentIds: [authoredRootComponentId],
      supportText: authoredRootMeaning,
      seconds: 8, cost: 0, available: true,
    },
    {
      id: 'pattern-check', kind: 'diagnostic',
      title: 'Check the pattern', taskId: authoredContrastTask.id,
      seconds: 15, cost: 0, available: true,
    },
  ],
  constraints: {
    avoidPractice: false,
    timeBudgetSeconds: 30,
    costPerSecond: 0.002,
    minimumDiagnosticNetValue: 0,
    requireConvergenceForDiagnostics: true,
  },
});
```

The task definitions must already exist in `fit.tasks`. The example's component and contrast identifiers must come from authored task definitions; they are not inferred from display labels.

### Input rules

- `now` is an explicit nonnegative integer timestamp in milliseconds, defaulting to `fit.now`.
- Targets contain `taskId` and optional `weight` (default 1). Duplicate targets are rejected; zero weights are ignored. An unknown positively weighted target makes the decision unavailable, so a partial target set is never silently substituted.
- Actions have unique `id`, `kind`, optional `title`, `seconds`, `cost`, and `available`. Durations are nonnegative, with whole-millisecond precision; costs are finite and nonnegative.
- Support uses `affectedTaskIds`, or defaults to `[taskId]`. Every `providedComponentIds` member must be a required component of **every** affected task. Invalid effects make the action unavailable. Whole-form-only tasks with no components cannot acquire invented support components.
- Diagnostic actions name an exact fitted `taskId`. They may declare supplied components for an authored assisted diagnostic, but may not declare target support effects. The task/observation bridge must preserve those assistance conditions when recording a response.
- `requiresPractice:true` can additionally mark a support action as practice. Diagnostics always count as practice for the no-practice constraint, even if the caller passes `requiresPractice:false`.
- `avoidPractice:true` excludes practice. Unavailable support is excluded. Every diagnostic and follow-up action must fit the combined time budget.
- No budget means no duration limit. The result represents that limit as `null`, so it remains JSON serializable.
- At most 32 targets, 64 supplied actions, and 4,096 posterior draws are accepted. Target/action limit violations throw. The combined work estimate is draws × targets × available terminal actions × (1 + 3 × available diagnostics), bounded at 8,000,000 before prediction vectors are allocated. An oversized posterior or combined workload returns a conservative Continue decision with an explicit work-budget reason; it does not subsample or quietly change the posterior.
- A single zero-cost, zero-duration Continue action may be supplied. It is always available. The policy inserts a default Continue action if absent.

### Result

`primary`, `alternatives`, and `candidates` contain scored action objects, retaining IDs, kind, title, task, supplied components, affected tasks, and bounded `supportText`. `alternatives` contains available actions eligible under the objective, ordered by expected loss. `candidates` also contains unavailable actions and unprofitable diagnostics, including their reasons.

Terminal actions expose `expectedTaskLoss`, `effortCost`, `expectedLoss`, `utility` (negative loss), `forecastAt`, target predictive means and 90% intervals, and a 90% interval for conditional expected loss. These intervals describe uncertainty in model probabilities and expected loss. They are not prediction intervals for a binary response and are not guarantees of competence.

Diagnostics additionally expose `evsi`, `netValue`, `delayAndConstraintPenalty`, `predictiveCorrect`, and `branches`. Each branch gives the response probability, best subsequent action, expected loss, posterior effective sample size, and alternative terminal losses. Zero-probability branches contain no invented posterior or chosen action.

The result includes `bestTerminal`, the immediate best action without a diagnostic; all objective and cost assumptions; warnings; and a trace with policy/model versions, actor/population scope, timestamp, target IDs, candidate IDs, sample count, and the fitted data summary. It copies scope data and never writes back into the fit. `learningGain` and `retentionGain` are always `null`.

`status` is `ready`, `prior-only`, `bounded`, `no-target`, or `unavailable`. Missing or unusable posterior evidence returns Continue with unknown expected loss. Prior-only decisions explicitly retain their prior status. A failed convergence check blocks extra diagnostics by default; terminal choices remain visible with the bounded-inference warning. Callers must display uncertainty and should not translate these predictions into a stable mastery label.

## Evidence and privacy responsibilities

The policy accepts a fit that has already been restricted to the active actor and authorized population scope. It performs no database read, cohort discovery, telemetry, or network operation. The engine and evidence bridge remain responsible for ownership, provenance, assessment validity, version matching, and the immutable event record.

A proposed diagnostic is a future assessed response, not an existing observation. Calling the policy does not record completion or update abilities. The UI executes the chosen authored task; only the ordinary assessed-response pipeline can create new evidence. Immediate dependent retries and assisted responses must not be silently admitted as independent unaided evidence. Refit after an accepted response, then recompute the decision.

Reweighting assumes the diagnostic follows the declared likelihood conditional on the modeled state. It does not add a causal practice gain. The time forecast may decay existing modeled performance while the diagnostic consumes time; it does not claim that supplying a hint changes retention.

## Verification

Run `node --test tests/learner-policy.test.mjs`. The tests check exact EVSI and Bayes reweighting, informative-but-decision-irrelevant questions, known gaps, goal weights, joint covariance, cost thresholds, sequential budgets, delay, no-practice, invalid support, prior/bounded states, actor trace copying, normalized weights, and nonmutation. A pure `predictor` injection hook permits exact finite-state checks while application calls use the actual learner model by default.

`tools/evaluate_learner.mjs` supplies reproducible numerical examples and actual model-based synthetic evaluation. These checks establish implementation behavior and numerical consistency. Human prediction accuracy, educational effectiveness, linguistic coverage, calibrated cost preferences, and causal transfer require separate data and evaluation.
