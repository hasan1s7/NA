# Nabu learner model: synthetic and numerical evaluation

Evaluation version: `learner-synthetic-evaluation-v1`. Model: `nabu-hierarchical-learner-v1`. Seed: **140015**.

Synthetic authored outcomes and independent numerical references. No human learners, causal interventions, or measured educational benefit.

**Checks:** 8/8 exact decision cases; 5/5 structural scenarios; numerical reference passed.

## Exact decision arithmetic

| Scenario | Selected action | Expected loss | Diagnostic EVSI | Diagnostic net value | Check |
|---|---|---:|---:|---:|---|
| profitable-diagnostic | probe | 0.3 | 0.5 | 0.4 | Pass |
| noisy-diagnostic | probe | 0.5 | 0.3 | 0.2 | Pass |
| uninformative-diagnostic | pattern-help | 0.7 | 0 | -0.1 | Pass |
| informative-no-action-change | complete-help | 0.05 | 0 | -0.1 | Pass |
| known-gap | root-help | 0.2 | 0 | -0.1 | Pass |
| diagnostic-cost-break-even | pattern-help | 0.7 | 0.5 | 0 | Pass |
| sequential-budget | pattern-help | 0.7 | 0 | -0.4 | Pass |
| no-practice | pattern-help | 0.7 | Unavailable | Unavailable | Pass |

These finite-state calculations exercise the actual decision module with an exact joint posterior. They are implementation checks, not estimated performance on people.

## Actual posterior predictions on authored tasks

The Arabic reading receives 21 correct responses in 24 synthetic independent episodes. A second fit adds 18 incorrect Spanish reading responses. The Spanish exceptional word-form task receives no direct observations. Dynamics are disabled for these comparisons.

| Task | Prior mean | Arabic evidence mean | After Spanish counterevidence | Arabic-evidence 90% interval |
|---|---:|---:|---:|---|
| learner:ar:write:reading | 0.504152 | 0.788783 | 0.79379 | 0.679053–0.886938 |
| learner:es:write:reading | 0.496101 | 0.524522 | 0.357601 | 0.345752–0.804309 |
| learner:en:write:reading | 0.491366 | 0.521921 | 0.501549 | 0.356294–0.768257 |
| learner:es:write:pattern | 0.214291 | 0.219689 | 0.21627 | 0.050397–0.515909 |

Shared meaning can alter predictions through declared shared variables. Language-specific evidence can counter that prediction, and an unobserved local word form remains uncertain. These are conditional model behaviors; this experiment does not identify causal transfer.

### Descriptive held-out synthetic scores

A seeded sequence of 64 binary responses was generated at a fixed success probability of 0.85; 59 were correct.

| Prediction | Brier score | Log loss |
|---|---:|---:|
| Prior | 0.246514 | 0.686175 |
| After Arabic evidence | 0.089735 | 0.340202 |

These scores describe one generated sequence and one task. They do not establish calibration, generalization across learners, or superiority to an existing learner model.

## Independent numerical reference

With all unrelated effects fixed to zero, the memory logit has a standard-normal prior and a likelihood of eight successes and two failures. Composite Simpson integration provides an independent one-dimensional posterior reference.

| Quantity | Quadrature | Sampled model | Absolute error |
|---|---:|---:|---:|
| mean | 0.705778 | 0.697787 | 0.007991 |
| lower | 0.5015 | 0.491347 | 0.010153 |
| upper | 0.873249 | 0.878556 | 0.005306 |

Mean tolerance: 0.025; interval-endpoint tolerance: 0.06. These are numerical test tolerances, not confidence statements.

## Decision from a fitted learner posterior

The synthetic gap case contains 20 correct Arabic base-recall responses and 20 incorrect responses to a separate Arabic pattern task. The selected action is **authored-support-1**, with modeled immediate expected loss **0.231047**. Status: **ready**.

The action supplies only an authored component on the target task. Its modeled immediate benefit does not claim a change in the learner's knowledge or later retention. The JSON report preserves the alternative losses, diagnostic branches, assumptions, and warnings.

## Conditional time forecast

In the separate dynamic scenario, target mean success is 0.688688 at the evaluation time and 0.681345 after 30 days with no added evidence. This checks the configured decay mechanism; it is not a measured forgetting curve.

## Sampling and runtime

Environment: v24.22.1 on linux/x64. Total observed runtime: 805.85 ms.

| Fit | Observations | Parameters | Draws | Converged | Bounded | Runtime ms |
|---|---:|---:|---:|---|---|---:|
| prior | 0 | 29 | 512 | Not assessed | No | 121.36 |
| arabic-reading-evidence | 24 | 29 | 512 | Yes | No | 97.44 |
| opposing-spanish-evidence | 42 | 29 | 512 | Yes | No | 110.38 |
| known-pattern-gap | 40 | 29 | 512 | Yes | No | 98.45 |
| elapsed-time-forecast | 40 | 39 | 512 | Yes | No | 174.63 |
| quadrature-reference | 10 | 1 | 1536 | Yes | No | 89.75 |

A failed convergence check remains visible. The decision policy normally withholds an additional diagnostic when convergence is false. Bounded history or numerical work is reported rather than interpreted as absent learner evidence.

## Limits

- All observations in this report are synthetic; predictive accuracy and learning benefit on humans remain unmeasured.
- The task mapping, guessing/slip values, priors, diagnostic durations, and effort costs are authored assumptions.
- Posterior convergence and intervals are reported. A passing synthetic check does not establish psychological identifiability.
- Cross-language sharing concerns an explicit reading alignment; no lexical knowledge is granted from a translation or graph neighbor.
- Support predictions condition on supplied components. Learning gain and retention gain remain unknown.
- Only one diagnostic followed by a terminal action is optimized; no long-horizon teaching policy is claimed.
- Wall-clock timings depend on the environment; seeded numerical outputs can be reproduced with the same implementation and settings.

## Reproduce

```bash
node tools/evaluate_learner.mjs --seed 140015 --samples 256 --burn-in 384 --output docs/learner-evaluation/results.json
```

The command writes the complete JSON record and a Markdown companion. Numerical outputs are deterministic for the same seed and settings; elapsed runtime is measured on each run.
