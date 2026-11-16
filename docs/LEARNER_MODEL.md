# Multilingual Bayesian learner model

`public/nabu-learner-model.js` implements the learner posterior used by Nabu 1.15.0. It is a deterministic, local JavaScript module with no network calls and no runtime packages. It receives versioned task definitions and already admitted scored observations, returns joint posterior samples, and predicts exact task conditions with uncertainty. `public/nabu-learner-policy.js` uses those same joint samples to compare immediate help and the value of an additional diagnostic response.

This implementation supplies a probabilistic model and working inference. The authored mappings, prior scales, guessing and slipping probabilities, and response equations are explicit assumptions. The release does not contain human calibration, an independently validated proficiency scale, or an estimate of causal learning gains.

## 1. What a task label means

A model task declares its language, response mode, required components, optional whole-form retrieval route, and response conditions. A component has a stable ID and a kind (`meaning`, `root`, or `pattern`). Two components share a learner effect across languages only when the author supplies the same `transferGroup`, component kind, and mode. Equal strings, neighboring graph nodes, translations, or membership in an "irregular" category do not create that shared effect.

The hierarchy is crossed. A task can involve a root, a pattern, a word-specific residual, and a context, while a semantic component can also belong to a declared multilingual group. It is not a tree in which each word has only one parent. The model can represent an Arabic pattern shared by several Arabic words, a literal reading aligned between Arabic and Spanish, and language-specific lexical uncertainty at the same time.

Recognition, production, listening, and cloze have separate coefficients **and separate variance groups**. Recognition evidence therefore does not count as production evidence. A new mode starts from its configured prior. A task with an answer ingredient supplied must omit that ingredient from its assessed component list; support predictions can additionally condition on a declared component being supplied without recording it as learned.

```js
const task = {
  id: 'example:ar:written:complete-production',
  version: 1,
  language: 'ar',
  mode: 'production',
  components: [
    {id: 'ar:root:ktb', kind: 'root'},
    {id: 'ar:sound-form-I:passive-participle', kind: 'pattern'},
  ],
  memory: true,
  memoryKey: 'ar:maktub:literal-written',
  contextKey: 'written-message',
  guess: 0,
  slip: .03,
  difficulty: 0,
};
```

The whole-form `memoryKey` is scoped by language and response mode internally. It should identify the exact lexical form and reading intended to share retrieval evidence across conditions. An exception-only task may have `components: []` with `memory: true`. The compositional route is then zero: an empty list never becomes automatic success through a vacuous conjunction. With `memory: false`, an empty component list is rejected.

## 2. Response likelihood

Let \(u\) denote a learner, \(\ell\) a language, \(m\) a response mode, \(j\) a task, and \(c\) a required component. Its static logit is

\[
\eta^{\mathrm{static}}_{u j c}=
\mu_{\ell m}
+a_{u\ell m}
+w_{u\ell,\operatorname{word}(j),m}
+h_{u\ell,\operatorname{context}(j),m}
+b_{u\ell,\operatorname{kind}(c),c,m}
+\mathbf 1_{\operatorname{mapped}(c)}s_{u,\operatorname{kind}(c),\operatorname{group}(c),m}
-d_j.
\]

Here \(a\) is a language and mode baseline, \(w\) is a word residual, \(h\) is an optional context residual, \(b\) is the language-specific component effect, and \(s\) is the explicitly shared component effect. Context is omitted when no context key is supplied. \(\mu\) and task difficulty \(d_j\) are configured offsets. In an explicitly authorized joint cohort fit, each static effect additionally has a feature-specific population mean, shared among the included learners; it has its own Gaussian prior.

After adding the time and practice terms below, component success is

\[
q_{u j c}(t)=\operatorname{logistic}(\eta_{u j c}(t)).
\]

All required components must succeed along the compositional route:

\[
C_{u j}(t)=\prod_{c\in\operatorname{required}(j)}q_{u j c}(t).
\]

The product is an explicit conditional independence assumption about component success given the joint parameters. Shared coefficients still induce dependence after integrating out uncertainty. Multiplying marginal posterior means would discard that dependence, so predictions multiply component probabilities **within each joint draw** and average only afterward.

If a whole-form route is declared, its probability is

\[
M_{u j}(t)=\operatorname{logistic}
\left(\mu_{\mathrm{mem}}+v_{u\ell,\operatorname{word}(j),m}
+h_{u\ell,\operatorname{context}(j),m}
+D_{u j,\mathrm{mem}}(t)-d_j\right).
\]

Its default offset is \(\mu_{\mathrm{mem}}=-1.5\). The memory route uses its own retrieval coefficient, context, and temporal history; it does not duplicate the compositional baseline or word residual. The alternative-route equation is

\[
R_{u j}(t)=M_{u j}(t)+(1-M_{u j}(t))C_{u j}(t).
\]

This is another model assumption: conditional route success combines as an OR of independent route opportunities. It does not identify which psychological route caused a correct response. With no memory route, \(M=0\); for a memory-only exception, \(C=0\).

The observed binary response has likelihood

\[
Y_{u j t}\sim\operatorname{Bernoulli}(p_{u j}(t)),\qquad
p_{u j}(t)=g_j+(1-g_j-s_j)R_{u j}(t).
\]

Guessing \(g_j\) and slipping \(s_j\) are authored task constants, with \(g_j+s_j<1\). They are not inferred by this release. The numeric implementation clips probabilities to \([10^{-12},1-10^{-12}]\) for finite log likelihoods.

## 3. Hierarchical partial pooling

Each zero-mean coefficient \(\beta_i\) belongs to a kind-and-mode variance group \(k(i)\):

\[
\beta_i\mid V_{k(i)}\sim\mathcal N(0,V_{k(i)}),\qquad
V_k\sim\operatorname{InverseGamma}(\alpha_k,B_k).
\]

The inverse-Gamma convention is \(p(V)\propto V^{-\alpha-1}\exp(-B/V)\). By default \(\alpha=3\) and \(B=(\alpha-1)\tau_k^2\), so the prior mean variance is \(\tau_k^2\). The starting scales are:

| Effect kind | Prior scale \(\tau_k\) |
|---|---:|
| Language and mode baseline | 0.65 |
| Meaning | 0.70 |
| Root | 0.80 |
| Pattern | 0.80 |
| Explicit shared component | 0.80 |
| Word residual | 0.45 |
| Whole-form memory | 1.00 |
| Context | 0.30 |
| Practice coefficient | 0.25 |
| Elapsed-time coefficient before softplus | 0.45 |
| Authorized population mean | 0.50 |

These are regularizing starting assumptions, not learned population facts. The group variances are updated jointly with the coefficients. `fixedScales` can instead fix a named kind or `kind:mode` variance, including zero to remove that random effect; the output identifies such groups as `fixed-calibration`. The caller must supply the justification for an actual calibration. The numerical reference tests use fixed scales to reduce the model to independently integrable cases.

Partial pooling arises from the posterior over the shared factors, local deviations, and group scales. Sparse Spanish evidence can borrow through a declared semantic factor supported by Arabic data. Strong contradictory Spanish evidence can move the Spanish-specific effect away from that shared factor. A correct Arabic answer never sets every Spanish neighbor to known.

Even without a shared factor, features of the same kind and mode share a variance hyperparameter. Evidence can therefore inform the **spread** of an untested feature's prior without establishing that feature's ability. `summarizePrediction` exposes `hyperparameterOnly`, `sharedEffectEventIds`, and `hyperparameterEventIds` to keep that distinction visible. `crossLanguageEventIds` includes shared-effect evidence, not this scale-only relationship. A mode with no relevant data remains prior-only.

### Induced covariance

For two matched static component logits with coefficient index sets \(I_a,I_b\), conditional on the variances,

\[
\operatorname{Cov}(\eta_a,\eta_b\mid V)
=\sum_{i\in I_a\cap I_b}V_{k(i)},\qquad
\operatorname{Var}(\eta_a\mid V)=\sum_{i\in I_a}V_{k(i)}.
\]

`transferGroups` computes the resulting correlation using **all** static coefficients, including word, context, baseline, local, shared, and authorized population effects. It reports cross-language pairs and an average over pairs and hyperposterior draws. Temporal terms are excluded from this diagnostic. The quantity is a conditional-prior structural correlation averaged over the hyperposterior; it is not the posterior predictive correlation of two responses. The permitted covariance structure is constrained by authored shared factors and is not an unrestricted learned language covariance matrix or a causal transfer estimate.

## 4. Time and assessed opportunities

Before each admitted observation, the model reads that component's earlier assessed opportunities \(N\) and the elapsed days \(\Delta\) since its last assessed occurrence. History is scoped by learner, language, mode, component kind and ID; the optional memory route has a separate form history. The response logit receives

\[
D(t)=\kappa_{u\ell m}\log(1+N)
-\operatorname{softplus}(-3+\phi_{u\ell m})\log(1+\Delta).
\]

Both \(\kappa\) and \(\phi\) are inferred Gaussian coefficients with learned group variances. The count term can be positive or negative. The elapsed term is constrained to nonnegative decay by the chosen softplus link. The history features are constructed before incorporating the current event, preventing the current answer from counting as its own prior practice. First occurrences have zero count and zero lag. History omission under the configured cap is recorded rather than concealed.

This is a longitudinal response model with fitted covariate effects, not a hidden-state transition model that asserts a known learning increment after every answer. The count includes assessed opportunities, including failures; it is not a measured dose of effective instruction. Time, practice, difficulty, and task selection can be confounded. `fit.dynamics` reports evidence counts, posterior parameter summaries, a predictor-correlation diagnostic, and `identified:false` / `causal:false`. More than a few repeated observations makes a coefficient likelihood-informed without establishing psychological or causal identification.

`predictSamples(...,{now})` recomputes lag at a future prediction time. It does not increment practice or modify the fit. Prediction times before the fitted cutoff are rejected so a posterior using later data is not mislabeled as a historical forecast. With `dynamics:false`, predictions do not change with time.

## 5. Posterior computation

The posterior is proportional to the binary-response likelihood times the Gaussian coefficient priors and inverse-Gamma variance priors. The implementation alternates:

1. Elliptical slice sampling of the likelihood-active Gaussian coefficient vector, conditional on group variances. An independent Gaussian direction defines an ellipse; a likelihood slice determines the accepted angle.
2. Conditional Gibbs updates of each learned variance group.

Let \(A_k\) contain coefficients in group \(k\) that actually occur with nonzero design loading in at least one admitted likelihood term. Then

\[
V_k\mid\beta_A,Y\sim\operatorname{InverseGamma}
\left(\alpha_k+|A_k|/2,
B_k+\tfrac12\sum_{i\in A_k}\beta_i^2\right).
\]

Coefficients for unobserved candidate tasks are analytically integrated out of this chain; their normal densities integrate to one. At retention, those coefficients are sampled from their conditional Gaussian prior using the retained variances. This supplies complete joint prediction draws without letting hundreds of unobserved catalogue coefficients create an unnecessary variance/latent Gibbs dependence. A group with no active coefficients remains `prior-only` in `hyperparameters`, even when some other group has observations.

Elliptical slice sampling follows [Murray, Adams and MacKay (2010), *Elliptical slice sampling*, AISTATS, PMLR 9](https://proceedings.mlr.press/v9/murray10a.html). The hard transition work cap is an engineering modification: a capped transition retains the old state and records `sliceBoundHits`; it is explicitly classified as a bounded approximation, without claiming the invariant-kernel guarantee of an uncapped transition. The Gamma and normal generators use a seeded local pseudorandom generator. Replaying the same normalized input and options gives the same fit in the same runtime. Floating-point transcendental functions can differ slightly between runtimes.

The synchronous and asynchronous APIs run the same generator and retain the same samples. The asynchronous API yields to the event loop at a bounded iteration cadence and supports cancellation. No worker or remote statistical service is required.

### Sampling checks and computational bounds

Defaults are two chains, 96 discarded iterations and 64 retained draws per chain. The UI makes one refinement to 384 discarded iterations and 256 retained draws per chain when the first predictive check fails. The engine itself never silently increases its budget.

The reported checks use a classical between-chain variance ratio and a short-lag autocorrelation approximation to effective sample size for at most the first 12 directly observed current-learner task predictions. The UI criterion is a ratio at most 1.2 and effective size at least `min(24, totalDraws/4)` for every tracked prediction. These limited checks are **not** rank-normalized split diagnostics, tail diagnostics, a proof of stationarity, or a check of every latent coefficient and hyperparameter. `convergenceScope` records that restriction; `converged:null` means the current scope has no applicable multi-chain predictive check. A passed check does not establish human calibration or identify latent abilities.

The default scope bounds are 128 tasks, 256 observations, and 768 coefficients. Larger explicit budgets remain bounded at 256 tasks, 2,048 observations, 4,096 coefficients, and 16,384 sampler iterations. If tasks or coefficients exceed the bound, fitting throws before returning a partial model. If observations exceed the configured history bound, only the newest eligible observations are fitted and every omitted event ID is listed. A slice bound hit or omitted history yields `inferenceStatus:'bounded-approximation'`. Short fits can remain provisional; downstream diagnostic selection is constrained by those flags.

## 6. Evidence and actor scope

The engine is a low-level assessed-data API. Production callers first use `nabu-learner-observations.js`, which enforces the immutable event contract, authored task version, assistance, provenance, and dependent-attempt rules. Calling the engine directly does not turn arbitrary raw interactions into admissible learner evidence.

The engine additionally enforces current-user identity, declared tenant identity, duplicate-event consistency, exact task versions, future-event exclusion, and first scored response per learner/task/episode. An exact duplicate is excluded; conflicting contents for the same learner/event ID throw. Different tasks within one episode still require the bridge's exposure and assistance rules. Excluded records and bounded-history omissions appear in `dataSummary.excluded`.

Default fitting uses only the current actor. It never reads or discovers other users. `populationObservations` is a separate input and requires both `options.populationConsent:true` and a named `options.populationScope`. Every population row must explicitly name a different learner. Account or study authorization must be enforced by the caller; a boolean is an API declaration, not an access-control system. The fit records its actor and population scope.

`fitPopulation` is a separate opt-in cohort operation. It needs at least two explicitly identified learners, `consent:true`, and a scope. It returns a portable moment approximation containing group scales and language/mode baseline means, without raw cohort events or individual draws. That portable approximation discards feature-specific population means, covariance, and calibration uncertainty, and averages each kind's scales across modes. An authorized direct joint cohort fit retains the richer joint uncertainty; the portable prior must not be described as equivalent to it.

## 7. Public API

```js
import {
  MODEL_VERSION, normalizeModelTask, fitLearner, fitLearnerAsync,
  predictSamples, summarizePrediction, fitPopulation,
} from './nabu-learner-model.js';

const abortController = new AbortController();
const input = {
  tasks: [task],
  observations: [{
    id: 'assessed-event-1', taskId: task.id, taskVersion: task.version,
    correct: 1, at: 1794657600000,
    learnerId: 'learner-a', episodeId: 'independent-episode-1',
  }],
  actor: {userId: 'learner-a', tenantId: null},
  now: 1794657600000,
  options: {seed: 'reproducible-run', burnIn: 384, samples: 256},
};

const fit = await fitLearnerAsync(input, {
  signal: abortController.signal,
  yieldEvery: 12,
  onProgress: ({phase, completed, total}) => {},
});
const summary = summarizePrediction(fit, task.id);
const supported = predictSamples(fit, task.id, {
  providedComponentIds: ['ar:root:ktb'],
});
```

`actor.userId:null` denotes the local guest; its observation learner ID is `guest`. An account is required when a team ID is present. The example assumes the task and event were first validated by the production bridge.

### Returned fit

| Field | Purpose |
|---|---|
| `version`, `schemaVersion`, `method` | Model and serialization provenance |
| `actor`, `scope`, `now` | Exact learner, authorized cohort scope, and cutoff |
| `tasks`, `observations` | Normalized candidate definitions and admitted scoped observations |
| `design` | Coefficient descriptors, group definitions, task incidence, history, and observation incidence |
| `samples` | Serializable joint `{values, variances, chain}` draws |
| `sampleWeights` | Normalized weights in identical sample order, initially uniform |
| `dataSummary` | Counts, active versus conditionally sampled parameters, and exclusions |
| `diagnostics` | Inference status, work bounds, limited chain checks, and identifiability caveats |
| `hyperparameters` | Group variance means, intervals, active parameter counts, and prior/fixed/posterior status |
| `transferGroups` | Explicit cross-language shared-factor correlation summaries |
| `dynamics` | Temporal response coefficient summaries and evidential limitations |

All state is JSON serializable. Predictions do not mutate it. A stored fit includes scoped assessed data and model coefficients; callers should apply the same account and export controls as to its source evidence.

### Prediction outputs

`predictSamples(fit, taskIdOrExactTask, options)` returns an array of probabilities aligned with `fit.samples` and `fit.sampleWeights`. This alignment lets the decision layer reweight the **same joint posterior** for a possible diagnostic answer. Options are `now` and `providedComponentIds`; support changes the immediate conditional likelihood only.

`summarizePrediction` adds a weighted mean, parameter variance, equal-tailed credible bounds, direct and related event counts, provenance categories, prior/inferred status, and sampling flags. `intervalLevel` defaults to 0.90 and can be supplied at fit or summary time. The interval concerns the modeled task probability, not the range of a binary answer, a proficiency certification, or a calibrated probability of durable mastery.

Unknown tasks, changed task definitions, changed versions, duplicate support IDs, undeclared support components, and prediction times before the fit cutoff are rejected by `predictSamples`. The summary wrapper returns `status:'unsupported'` and null estimates for those unsupported prediction requests. Include the complete selectable candidate catalogue in a fit before requesting a new task's prediction.

## 8. Verification

Run `node --test tests/learner-model.test.mjs`. The tests include an independent logistic-normal quadrature reference for the posterior probability, and a separate integrated normal/inverse-Gamma reference for the learned variance. They additionally check joint required-component and memory-route behavior, conditional support, prior uncertainty, partial pooling under contradictory local data, explicit cross-language mappings, mode separation, full static-logit covariance, temporal history ordering, asynchronous replay and cancellation, JSON serialization, actor and cohort scope, event deduplication, work limits, and numerical extremes.

`tools/evaluate_learner.mjs` produces a separately reproducible synthetic/numerical evaluation of the integrated model and decision layer. Numerical agreement and software tests establish the implemented calculations under their stated assumptions. They do not establish that the mappings or likelihood describe human learners, that a latent component is identifiable from compound responses, or that the selected support improves future learning. Those remain empirical questions for appropriate assessed and intervention data.
