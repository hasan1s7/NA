# Synthetic evidence evaluation — synthetic-evidence-v1

**These are generated experiments, not real learner results, a linguistic benchmark, or evidence that Nabu improves learning.** No production graph, scheduler, ontology, learner record, or recommendation rule is changed by this script. The production scheduler remains the existing SRS; the Beta model below exists only in this research tool.

## Reproduce and inspect

```bash
node tools/evaluate_evidence.mjs --output docs/evidence-evaluation
node --test tests/evidence-evaluation.test.mjs
```

Fixed seeds: **11, 29, 47, 83, 101, 137, 173, 211, 257, 307, 359, 419**. Each seed generates **128 fictional learners per world**. Output files are deterministic for the source/protocol: `results.json` contains configuration, exact family definitions, traces, per-seed results and calibration bins; `results.csv` contains per-seed metric rows. Means and **sample standard deviations across seeds** are reported below; they are not confidence intervals about people. The runtime and generator SHA-256 are recorded in JSON. There is no parameter optimization or search for winning seeds.

## 1. Representation is evaluated separately

| Check | Actual result | Boundary |
|---|---|---|
| complete-supported-operation | represented | The full synthetic application retains all inputs, outputs, features, provenance and competing-analysis list. |
| memorized-independent-forms | represented-without-transfer-claim | A structural relationship can be true while responses to its forms are independently memorized. |
| same-spelling-different-readings | separate-readings | Identical synthetic spelling has distinct reading IDs; the experimental estimator joins operation plus reading, never spelling. |
| conflicting-analysis | inference-disabled | Conflicting applicability metadata suppresses experimental borrowing. |
| sibling-output-lineage | one-lineage | Three output forms from one application remain one source lineage, not three independent sources. |
| new-family-split | disjoint | Six separately assigned families are observed and six are fully held out; within-family questions have their own split. |

The complete application is explicitly fictional and is checked through the existing structural adapter's record validator. Shape validity does not verify its linguistic correctness. Three outputs share **1** source lineage. No new morphology enters the bank.

Family IDs are assigned in the source manifest independently of spelling and suffixes. The first six families are observed, the last six are held out wholesale. Each family has three complete output identities, a/b/c. Training uses a/b from observed families, with three unique assessed episodes per item. Evaluation uses a later response to each trained item, a new c item in each observed family, and an a item from each unobserved family. The held-out family intersection is **0**. A new derivative of an observed base is therefore never reported as a new lexical family.

## Observation semantics

| Synthetic case | Input events | Accepted assessed events | Direct successes | Direct failures | Toy probability | Check |
|---|---:|---:|---:|---:|---:|---|
| repeated-unassessed-exposure | 50 | 0 | 0 | 0 | 0.500 | pass |
| repeated-unassessed-lookup | 50 | 0 | 0 | 0 | 0.500 | pass |
| repeated-unassessed-pronunciation | 50 | 0 | 0 | 0 | 0.500 | pass |
| skip-already-know | 1 | 0 | 0 | 0 | 0.500 | pass |
| skip-do-not-know | 1 | 0 | 0 | 0 | 0.500 | pass |
| unaided-failure-then-assisted-retry | 3 | 1 | 0 | 1 | 0.333 | pass |
| duplicate-first-response | 2 | 1 | 0 | 1 | 0.333 | pass |
| assisted-success-only | 1 | 0 | 0 | 0 | 0.500 | pass |
| later-independent-success | 2 | 2 | 1 | 1 | 0.500 | pass |

Unassessed exposure, lookup, and pronunciation requests do not establish recognition or production. A knowing skip (latent probability .9) and an unknowing skip (.1) produce identical evidence: none. A failed unaided response remains a failure even if an assisted retry succeeds; immediate retries are not independent trials. A later independently assessed response can supply new evidence. Synthetic latent states are available to the evaluator only; they are never passed to either estimator.

The real `public/nabu-observations.js` projector is also exercised with fictional task/scorer envelopes: **9/9 semantic contract checks pass**. Display, lookup, pronunciation playback, both skip reasons, assisted retries, duplicate events, and later independent responses preserve these boundaries. Production competence remains **null** throughout. These contract checks do not fit, validate, or install the research probabilities.

## 2. Prediction comparison on identical observations and questions

**Direct estimator:** Beta(1,1) per exact item and production mode; posterior mean (1 + scored successes)/(2 + scored attempts). It accepts only unique, first, scored, unaided episode responses. The actual Nabu production model is not replaced with this probability.

**Experimental structural estimator:** a convex mixture of that direct estimate and a separate pooled estimate from other explicitly declared families sharing the same stipulated operation and reading. It uses at most one observed result per other family, requires at least three families, and excludes the target family. Weight is min(.85, 4/(4 + target direct count)). Inferred support retains its source IDs and never increments direct counts. This is an assumed transfer model, not a fitted or validated learner model. A structurally valid relationship does not guarantee that a particular learner has learned a shared operation.

Both estimators receive byte-equivalent observation records and exactly the same held-out question/outcome pairs. Held-out responses never update either model before scoring. The independent-memorization world is deliberately favorable to item-specific evidence. The conflict world disables borrowing. The wrong-domain world gives the experimental model apparently supported metadata whose transfer implication is false; it tests failure under bad applicability assumptions.

**Metrics:** Brier = mean((predicted probability − held-out binary response)²), lower is better. Calibration uses ten predeclared equal-width probability bins; ECE = sum(bin fraction × absolute(mean prediction − empirical correct fraction)), lower is better. Signed calibration bias and full bin counts are in JSON. ECE depends on bins and sample size and is not proof of individual calibration. A prediction at least **0.8** is called “ready” only for this metric. False-ready rate = failed held-out responses among ready predictions; ready rate and population false-ready rate are also saved. A dash means no ready predictions, not zero error.

| Generated world | Held-out split | Estimator | Brier, mean ± SD | ECE, mean ± SD | False-ready, mean ± SD | Ready rate, mean ± SD |
|---|---|---|---:|---:|---:|---:|
| shared-operation | later-same-item | direct-item | 0.1243 ± 0.0039 | 0.1362 ± 0.0086 | 0.0998 ± 0.0120 | 0.3583 ± 0.0364 |
| shared-operation | later-same-item | experimental-graph | 0.1102 ± 0.0040 | 0.1352 ± 0.0097 | 0.0913 ± 0.0139 | 0.2110 ± 0.0229 |
| shared-operation | new-item-within-family | direct-item | 0.2500 ± 0.0000 | 0.0318 ± 0.0260 | — | 0.0000 ± 0.0000 |
| shared-operation | new-item-within-family | experimental-graph | 0.1228 ± 0.0084 | 0.1443 ± 0.0126 | 0.0927 ± 0.0228 | 0.2886 ± 0.0268 |
| shared-operation | new-lexical-family | direct-item | 0.2500 ± 0.0000 | 0.0263 ± 0.0209 | — | 0.0000 ± 0.0000 |
| shared-operation | new-lexical-family | experimental-graph | 0.1162 ± 0.0066 | 0.1393 ± 0.0153 | 0.0971 ± 0.0274 | 0.2598 ± 0.0267 |
| independent-memorized-items | later-same-item | direct-item | 0.1273 ± 0.0051 | 0.1311 ± 0.0095 | 0.1035 ± 0.0112 | 0.3607 ± 0.0149 |
| independent-memorized-items | later-same-item | experimental-graph | 0.1895 ± 0.0025 | 0.2087 ± 0.0107 | 0.0743 ± 0.0631 | 0.0095 ± 0.0050 |
| independent-memorized-items | new-item-within-family | direct-item | 0.2500 ± 0.0000 | 0.0188 ± 0.0117 | — | 0.0000 ± 0.0000 |
| independent-memorized-items | new-item-within-family | experimental-graph | 0.2647 ± 0.0030 | 0.0990 ± 0.0146 | 0.5406 ± 0.1017 | 0.0268 ± 0.0094 |
| independent-memorized-items | new-lexical-family | direct-item | 0.2500 ± 0.0000 | 0.0152 ± 0.0110 | — | 0.0000 ± 0.0000 |
| independent-memorized-items | new-lexical-family | experimental-graph | 0.2637 ± 0.0039 | 0.0965 ± 0.0178 | 0.3939 ± 0.1541 | 0.0130 ± 0.0084 |
| same-spelling-different-reading | later-same-item | direct-item | 0.1247 ± 0.0052 | 0.1354 ± 0.0102 | 0.0971 ± 0.0135 | 0.3611 ± 0.0065 |
| same-spelling-different-reading | later-same-item | experimental-graph | 0.1110 ± 0.0059 | 0.1362 ± 0.0082 | 0.0948 ± 0.0158 | 0.2091 ± 0.0153 |
| same-spelling-different-reading | new-item-within-family | direct-item | 0.2500 ± 0.0000 | 0.0270 ± 0.0186 | — | 0.0000 ± 0.0000 |
| same-spelling-different-reading | new-item-within-family | experimental-graph | 0.1222 ± 0.0071 | 0.1465 ± 0.0116 | 0.1063 ± 0.0128 | 0.3011 ± 0.0280 |
| same-spelling-different-reading | new-lexical-family | direct-item | 0.2500 ± 0.0000 | 0.0277 ± 0.0185 | — | 0.0000 ± 0.0000 |
| same-spelling-different-reading | new-lexical-family | experimental-graph | 0.1186 ± 0.0061 | 0.1433 ± 0.0103 | 0.0966 ± 0.0228 | 0.2441 ± 0.0332 |
| conflicting-analysis | later-same-item | direct-item | 0.1258 ± 0.0035 | 0.1315 ± 0.0063 | 0.0994 ± 0.0097 | 0.3536 ± 0.0291 |
| conflicting-analysis | later-same-item | experimental-graph | 0.1258 ± 0.0035 | 0.1315 ± 0.0063 | 0.0994 ± 0.0097 | 0.3536 ± 0.0291 |
| conflicting-analysis | new-item-within-family | direct-item | 0.2500 ± 0.0000 | 0.0282 ± 0.0194 | — | 0.0000 ± 0.0000 |
| conflicting-analysis | new-item-within-family | experimental-graph | 0.2500 ± 0.0000 | 0.0282 ± 0.0194 | — | 0.0000 ± 0.0000 |
| conflicting-analysis | new-lexical-family | direct-item | 0.2500 ± 0.0000 | 0.0315 ± 0.0185 | — | 0.0000 ± 0.0000 |
| conflicting-analysis | new-lexical-family | experimental-graph | 0.2500 ± 0.0000 | 0.0315 ± 0.0185 | — | 0.0000 ± 0.0000 |
| wrong-application-domain | later-same-item | direct-item | 0.1244 ± 0.0029 | 0.1365 ± 0.0051 | 0.0938 ± 0.0096 | 0.3595 ± 0.0338 |
| wrong-application-domain | later-same-item | experimental-graph | 0.1120 ± 0.0039 | 0.1371 ± 0.0077 | 0.0900 ± 0.0113 | 0.2039 ± 0.0321 |
| wrong-application-domain | new-item-within-family | direct-item | 0.2500 ± 0.0000 | 0.0263 ± 0.0195 | — | 0.0000 ± 0.0000 |
| wrong-application-domain | new-item-within-family | experimental-graph | 0.5053 ± 0.0110 | 0.6314 ± 0.0167 | 0.9033 ± 0.0261 | 0.2807 ± 0.0364 |
| wrong-application-domain | new-lexical-family | direct-item | 0.2500 ± 0.0000 | 0.0309 ± 0.0154 | — | 0.0000 ± 0.0000 |
| wrong-application-domain | new-lexical-family | experimental-graph | 0.5195 ± 0.0095 | 0.6466 ± 0.0138 | 0.8963 ± 0.0234 | 0.2493 ± 0.0375 |

### Prediction failures and limits

- **independent-memorized-items:** experimental structural borrowing increases new-family Brier by 0.0137 ± 0.0039 compared with the direct-item model.
- **wrong-application-domain:** experimental structural borrowing increases new-family Brier by 0.2695 ± 0.0095 compared with the direct-item model.

The same-spelling world has separate reading IDs and opposite response tendencies. Spelling alone is never a transfer key. In the conflicting-analysis world, estimates coincide by construction because borrowing is disabled. These cases show why representation, applicability, and learner evidence cannot be treated as one source of certainty. The generated graph relation is an assumption supplied to the research model, not a discovery from Nabu's live graph.

Better Brier does not mean better calibration here. In the shared-operation new-family case, mean ECE is **0.0263** for the direct model and **0.1393** for the experimental mixture. The direct model's constant .5 closely matches the marginal average while providing no distinction between the generated high- and low-probability learners. The unfitted mixture distinguishes them but shrinks their predictions toward the middle, leaving calibration error. False-ready rates also require their coverage and denominators: a very small ready subset can have a highly variable conditional failure rate. The report preserves all of these measures rather than treating one favorable metric as validation.

## 3. Policy comparison under matched constraints

Both policies share the **same direct-item estimator, six-item content pool, task priorities, action implementation, and time budget**. The first two items are critical to the simulated task. The fixed policy already visits those critical items first; it is not sent to irrelevant content. Each fixed episode has a 20-second scored probe followed by the same 40-second support whether the answer was correct or incorrect. The diagnostic policy may choose either of those same actions. It asks a question only if a correct versus incorrect response changes the next help/continue action and there is time left to provide the possible help. Otherwise an already established low-probability gap can receive help directly. It does not maximize entropy, use a bandit, or treat uncertainty as usefulness.

The help/continue rule uses .6 as its toy decision boundary; this is separate from the .8 reporting threshold for a readiness declaration. Help adds no knowledge evidence. Each item can receive at most one probe and one help action in a run. A question is an assessment; an interruption is either a question or a help action. No fixed policy gets a different model or different content. Both face the same wall-clock cap; unused time remains the chosen task, with no additional learning imputed to it.

**Assumed learning and retention:** help changes latent response probability by gain × (1 − current probability), multiplied by fixed learner/item variation in [0.8,1.2]. The default gain is .45. At a test seven days after the shared time deadline, .75 of that improvement remains. These values are assumptions, not estimates. Sensitivity also uses gain .15/retention .5 and gain .65/retention .9. Assessments themselves have no learning effect in this toy world; therefore this is not a test of retrieval-practice theory. Stale-history cases deliberately violate the estimator's stationarity assumption.

The two policies use keyed **common random numbers** for each learner/item response, learning response and delayed test. Different policies may ask different questions; their estimator and potential outcomes are otherwise shared. Task success means both critical items succeed in the independent delayed test. Six identical held-out tests per learner are administered after the shared intervention deadline and are not counted as intervention questions or charged differently to either policy. The report includes both sampled success and the simulator's expected success product. This is a simulated task score, not a language proficiency judgment.

### Default assumptions, with budget sensitivity

| Generated world | Budget | Policy | Delayed task success, mean ± SD | Questions | Interruptions | Used seconds | False-ready |
|---|---:|---|---:|---:|---:|---:|---:|
| uncertain-critical | 60s | fixed-practice | 0.339 ± 0.052 | 1.00 ± 0.00 | 2.00 ± 0.00 | 60.0 ± 0.0 | 0.146 ± 0.019 |
| uncertain-critical | 60s | diagnostic | 0.380 ± 0.062 | 1.00 ± 0.00 | 2.00 ± 0.00 | 60.0 ± 0.0 | 0.146 ± 0.019 |
| uncertain-critical | 120s | fixed-practice | 0.455 ± 0.056 | 2.00 ± 0.00 | 4.00 ± 0.00 | 120.0 ± 0.0 | 0.146 ± 0.019 |
| uncertain-critical | 120s | diagnostic | 0.406 ± 0.059 | 2.00 ± 0.00 | 3.00 ± 0.06 | 80.1 ± 2.6 | 0.146 ± 0.019 |
| uncertain-critical | 240s | fixed-practice | 0.455 ± 0.056 | 4.00 ± 0.00 | 8.00 ± 0.00 | 240.0 ± 0.0 | 0.119 ± 0.020 |
| uncertain-critical | 240s | diagnostic | 0.406 ± 0.059 | 2.00 ± 0.00 | 3.00 ± 0.06 | 80.1 ± 2.6 | 0.146 ± 0.019 |
| known-critical-gap | 60s | fixed-practice | 0.148 ± 0.027 | 1.00 ± 0.00 | 2.00 ± 0.00 | 60.0 ± 0.0 | 0.135 ± 0.013 |
| known-critical-gap | 60s | diagnostic | 0.382 ± 0.036 | 0.00 ± 0.00 | 1.00 ± 0.00 | 40.0 ± 0.0 | 0.146 ± 0.014 |
| known-critical-gap | 120s | fixed-practice | 0.408 ± 0.027 | 2.00 ± 0.00 | 4.00 ± 0.00 | 120.0 ± 0.0 | 0.135 ± 0.013 |
| known-critical-gap | 120s | diagnostic | 0.382 ± 0.036 | 0.00 ± 0.00 | 1.00 ± 0.00 | 40.0 ± 0.0 | 0.146 ± 0.014 |
| known-critical-gap | 240s | fixed-practice | 0.408 ± 0.027 | 4.00 ± 0.00 | 8.00 ± 0.00 | 240.0 ± 0.0 | 0.114 ± 0.015 |
| known-critical-gap | 240s | diagnostic | 0.382 ± 0.036 | 0.00 ± 0.00 | 1.00 ± 0.00 | 40.0 ± 0.0 | 0.146 ± 0.014 |
| already-ready | 60s | fixed-practice | 0.849 ± 0.032 | 1.00 ± 0.00 | 2.00 ± 0.00 | 60.0 ± 0.0 | 0.086 ± 0.009 |
| already-ready | 60s | diagnostic | 0.813 ± 0.035 | 0.00 ± 0.00 | 0.00 ± 0.00 | 0.0 ± 0.0 | 0.093 ± 0.009 |
| already-ready | 120s | fixed-practice | 0.878 ± 0.032 | 2.00 ± 0.00 | 4.00 ± 0.00 | 120.0 ± 0.0 | 0.081 ± 0.008 |
| already-ready | 120s | diagnostic | 0.813 ± 0.035 | 0.00 ± 0.00 | 0.00 ± 0.00 | 0.0 ± 0.0 | 0.093 ± 0.009 |
| already-ready | 240s | fixed-practice | 0.878 ± 0.032 | 4.00 ± 0.00 | 8.00 ± 0.00 | 240.0 ± 0.0 | 0.069 ± 0.010 |
| already-ready | 240s | diagnostic | 0.813 ± 0.035 | 0.00 ± 0.00 | 0.00 ± 0.00 | 0.0 ± 0.0 | 0.093 ± 0.009 |
| stale-success-history | 60s | fixed-practice | 0.059 ± 0.021 | 1.00 ± 0.00 | 2.00 ± 0.00 | 60.0 ± 0.0 | 0.301 ± 0.012 |
| stale-success-history | 60s | diagnostic | 0.022 ± 0.009 | 0.00 ± 0.00 | 0.00 ± 0.00 | 0.0 ± 0.0 | 0.352 ± 0.012 |
| stale-success-history | 120s | fixed-practice | 0.190 ± 0.032 | 2.00 ± 0.00 | 4.00 ± 0.00 | 120.0 ± 0.0 | 0.251 ± 0.014 |
| stale-success-history | 120s | diagnostic | 0.022 ± 0.009 | 0.00 ± 0.00 | 0.00 ± 0.00 | 0.0 ± 0.0 | 0.352 ± 0.012 |
| stale-success-history | 240s | fixed-practice | 0.190 ± 0.032 | 4.00 ± 0.00 | 8.00 ± 0.00 | 240.0 ± 0.0 | 0.240 ± 0.015 |
| stale-success-history | 240s | diagnostic | 0.022 ± 0.009 | 0.00 ± 0.00 | 0.00 ± 0.00 | 0.0 ± 0.0 | 0.352 ± 0.012 |
| assisted-retry | 60s | fixed-practice | 0.132 ± 0.025 | 1.00 ± 0.00 | 2.00 ± 0.00 | 60.0 ± 0.0 | 0.136 ± 0.010 |
| assisted-retry | 60s | diagnostic | 0.378 ± 0.032 | 0.00 ± 0.00 | 1.00 ± 0.00 | 40.0 ± 0.0 | 0.145 ± 0.009 |
| assisted-retry | 120s | fixed-practice | 0.395 ± 0.032 | 2.00 ± 0.00 | 4.00 ± 0.00 | 120.0 ± 0.0 | 0.136 ± 0.010 |
| assisted-retry | 120s | diagnostic | 0.378 ± 0.032 | 0.00 ± 0.00 | 1.00 ± 0.00 | 40.0 ± 0.0 | 0.145 ± 0.009 |
| assisted-retry | 240s | fixed-practice | 0.395 ± 0.032 | 4.00 ± 0.00 | 8.00 ± 0.00 | 240.0 ± 0.0 | 0.118 ± 0.009 |
| assisted-retry | 240s | diagnostic | 0.378 ± 0.032 | 0.00 ± 0.00 | 1.00 ± 0.00 | 40.0 ± 0.0 | 0.145 ± 0.009 |

### Learning/retention and budget sensitivity

All differences below are **diagnostic minus fixed practice**, paired within seed. Positive task-success difference favors diagnostic; positive question/interruption burden would favor fixed. The JSON also contains paired expected success, interruption, time, and Brier differences.

| World | Assumed learning regime | Budget | Task-success difference | Question difference | Brier difference |
|---|---|---:|---:|---:|---:|
| uncertain-critical | weak | 60s | 0.011 ± 0.011 | 0.00 ± 0.00 | 0.0007 ± 0.0004 |
| uncertain-critical | weak | 120s | -0.015 ± 0.011 | 0.00 ± 0.00 | 0.0014 ± 0.0008 |
| uncertain-critical | weak | 240s | -0.015 ± 0.011 | -2.00 ± 0.00 | 0.0046 ± 0.0016 |
| uncertain-critical | assumed-default | 60s | 0.041 ± 0.026 | 0.00 ± 0.00 | 0.0025 ± 0.0005 |
| uncertain-critical | assumed-default | 120s | -0.049 ± 0.017 | 0.00 ± 0.00 | 0.0043 ± 0.0008 |
| uncertain-critical | assumed-default | 240s | -0.049 ± 0.017 | -2.00 ± 0.00 | 0.0173 ± 0.0043 |
| uncertain-critical | strong | 60s | 0.074 ± 0.027 | 0.00 ± 0.00 | 0.0042 ± 0.0011 |
| uncertain-critical | strong | 120s | -0.100 ± 0.035 | 0.00 ± 0.00 | 0.0072 ± 0.0019 |
| uncertain-critical | strong | 240s | -0.100 ± 0.035 | -2.00 ± 0.00 | 0.0293 ± 0.0050 |
| known-critical-gap | weak | 60s | 0.048 ± 0.017 | -1.00 ± 0.00 | 0.0098 ± 0.0023 |
| known-critical-gap | weak | 120s | -0.003 ± 0.005 | -2.00 ± 0.00 | 0.0018 ± 0.0015 |
| known-critical-gap | weak | 240s | -0.003 ± 0.005 | -4.00 ± 0.00 | 0.0038 ± 0.0024 |
| known-critical-gap | assumed-default | 60s | 0.234 ± 0.038 | -1.00 ± 0.00 | 0.0441 ± 0.0038 |
| known-critical-gap | assumed-default | 120s | -0.025 ± 0.015 | -2.00 ± 0.00 | 0.0069 ± 0.0027 |
| known-critical-gap | assumed-default | 240s | -0.025 ± 0.015 | -4.00 ± 0.00 | 0.0201 ± 0.0041 |
| known-critical-gap | strong | 60s | 0.399 ± 0.041 | -1.00 ± 0.00 | 0.0743 ± 0.0060 |
| known-critical-gap | strong | 120s | -0.057 ± 0.026 | -2.00 ± 0.00 | 0.0115 ± 0.0038 |
| known-critical-gap | strong | 240s | -0.057 ± 0.026 | -4.00 ± 0.00 | 0.0351 ± 0.0063 |
| already-ready | weak | 60s | -0.007 ± 0.007 | -1.00 ± 0.00 | 0.0010 ± 0.0010 |
| already-ready | weak | 120s | -0.014 ± 0.009 | -2.00 ± 0.00 | 0.0021 ± 0.0014 |
| already-ready | weak | 240s | -0.014 ± 0.009 | -4.00 ± 0.00 | 0.0040 ± 0.0022 |
| already-ready | assumed-default | 60s | -0.036 ± 0.015 | -1.00 ± 0.00 | 0.0055 ± 0.0024 |
| already-ready | assumed-default | 120s | -0.065 ± 0.016 | -2.00 ± 0.00 | 0.0100 ± 0.0030 |
| already-ready | assumed-default | 240s | -0.065 ± 0.016 | -4.00 ± 0.00 | 0.0201 ± 0.0051 |
| already-ready | strong | 60s | -0.055 ± 0.018 | -1.00 ± 0.00 | 0.0088 ± 0.0034 |
| already-ready | strong | 120s | -0.111 ± 0.028 | -2.00 ± 0.00 | 0.0167 ± 0.0048 |
| already-ready | strong | 240s | -0.111 ± 0.028 | -4.00 ± 0.00 | 0.0334 ± 0.0060 |
| stale-success-history | weak | 60s | -0.010 ± 0.008 | -1.00 ± 0.00 | 0.0211 ± 0.0027 |
| stale-success-history | weak | 120s | -0.021 ± 0.012 | -2.00 ± 0.00 | 0.0425 ± 0.0035 |
| stale-success-history | weak | 240s | -0.021 ± 0.012 | -4.00 ± 0.00 | 0.0445 ± 0.0044 |
| stale-success-history | assumed-default | 60s | -0.037 ± 0.016 | -1.00 ± 0.00 | 0.0510 ± 0.0046 |
| stale-success-history | assumed-default | 120s | -0.168 ± 0.027 | -2.00 ± 0.00 | 0.1018 ± 0.0044 |
| stale-success-history | assumed-default | 240s | -0.168 ± 0.027 | -4.00 ± 0.00 | 0.1112 ± 0.0075 |
| stale-success-history | strong | 60s | -0.062 ± 0.024 | -1.00 ± 0.00 | 0.0757 ± 0.0060 |
| stale-success-history | strong | 120s | -0.393 ± 0.047 | -2.00 ± 0.00 | 0.1535 ± 0.0055 |
| stale-success-history | strong | 240s | -0.393 ± 0.047 | -4.00 ± 0.00 | 0.1707 ± 0.0072 |
| assisted-retry | weak | 60s | 0.051 ± 0.017 | -1.00 ± 0.00 | 0.0041 ± 0.0016 |
| assisted-retry | weak | 120s | -0.001 ± 0.002 | -2.00 ± 0.00 | 0.0014 ± 0.0015 |
| assisted-retry | weak | 240s | -0.001 ± 0.002 | -4.00 ± 0.00 | 0.0038 ± 0.0019 |
| assisted-retry | assumed-default | 60s | 0.246 ± 0.041 | -1.00 ± 0.00 | 0.0211 ± 0.0036 |
| assisted-retry | assumed-default | 120s | -0.017 ± 0.010 | -2.00 ± 0.00 | 0.0019 ± 0.0025 |
| assisted-retry | assumed-default | 240s | -0.017 ± 0.010 | -4.00 ± 0.00 | 0.0132 ± 0.0034 |
| assisted-retry | strong | 60s | 0.430 ± 0.061 | -1.00 ± 0.00 | 0.0366 ± 0.0040 |
| assisted-retry | strong | 120s | -0.046 ± 0.016 | -2.00 ± 0.00 | 0.0023 ± 0.0029 |
| assisted-retry | strong | 240s | -0.046 ± 0.016 | -4.00 ± 0.00 | 0.0228 ± 0.0038 |

### Policy failures and interpretation

In stale-success-history, earlier successes are misleading and the shared direct estimator cannot discover the unobserved change without a new response. The diagnostic policy can continue when help is needed. Its default paired task-success differences are **60s: -0.037 ± 0.016; 120s: -0.168 ± 0.027; 240s: -0.168 ± 0.027**. Fixed practice may outperform it by revisiting material regardless of apparent certainty. Already-ready learners may gain a small simulated improvement from redundant fixed help at the cost of extra interruptions. The comparison is consequently a tradeoff under declared assumptions, not a claim that diagnostics always win.

Budget changes can reverse the comparison even with the same learner world and learning assumptions. For uncertain-critical, default paired success differences are **60s: 0.041 ± 0.026; 120s: -0.049 ± 0.017; 240s: -0.049 ± 0.017**. The fixed policy can afford support for both critical items at longer budgets, while the diagnostic policy may withhold support after a correct answer. Reduced interruptions and unused time therefore cannot be reported as an unconditional task-success improvement. No common policy dominance was demonstrated.

The known-critical-gap world makes a different point: low uncertainty does not make a gap unimportant. The diagnostic policy can supply help without first asking an unnecessary question. Event-level example traces are saved in JSON to inspect these decisions. Fewer questions alone are not learner benefit; compare delayed task success, false-ready errors, time, and interruption counts together.

## What this evaluation does not establish

No real human observations, linguistic gold labels, curriculum outcomes, measured retention curves, or validated response-time costs were supplied. The simulated graph is independent of production alignment IDs and makes no new claims about Arabic, Spanish, P073, or any natural-language morphology. Binary independently generated responses simplify knowledge, attention, guessing, context, feedback, and correlation. False-ready is threshold-dependent; aggregate calibration can hide subgroup errors. Twelve deterministic seed replicates measure variability inside these chosen worlds only. No deployment, experiment recruitment, telemetry change, or production posterior is introduced.

## Equal-time human pilot proposal — not launched

After consent and content review, compare the two support policies with the same instruction, content pool, available actions, learning-state estimator, and fixed session time. Randomize or counterbalance policy assignment with separate matched content sets so carryover is visible; analyze participant-level assignment and item/context nesting. Keep exposure, assistance, skipped questions and scored responses separately recorded. Predeclare the task, delay, response rubric, readiness threshold and primary outcome before looking at results. Use a blinded delayed transfer task with genuinely unseen lexical families and a separate within-family score; include task completion, false-ready errors, interruptions, time, and learner-rated disruption. Inspect calibration only where enough scored predictions exist, with uncertainty intervals and missingness reported. Choose recruitment and sample size from pilot feasibility and a separate power analysis; this document makes no sample-size or efficacy claim. No human pilot has been started.
