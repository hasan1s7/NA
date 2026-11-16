# Nabu 1.15.0 learner release verification

Verified build: **nabu-learner-20261114-r1**. The release implements scoped Bayesian learner inference and a goal-driven decision interface in the existing application. It is packaged for local use; no deployment or private database migration was performed.

## Executed checks

| Suite | Result | What was exercised |
|---|---:|---|
| JavaScript unit and contract tests | **855 passed** | Existing application contracts plus learner hierarchy, task mapping, evidence bridge, policy, numerical evaluation, bounds and replay |
| Executable DOM and shipping-bundle tests | **72 passed** | Real task scoring, actual model and decision calculations, controls, account/context changes, storage failure/retry, queued dialog events, and generated HTML |
| Python/backend tests | **483 passed** | Existing backend contracts plus actual authored task references round-tripping through FastAPI and SQLite |
| Hand-computable policy cases | **8/8 passed** | Exact EVSI, noisy outcomes, no decision change, costs, budget and no-practice |
| Structural evaluation cases | **5/5 passed** | Actual task metadata, modes, explicit language sharing and local lexical gates |
| Independent numerical reference | **Passed** | Sampled scalar posterior compared with Simpson quadrature |

The learner additions account for 95 tests: 23 engine, 19 policy, 7 evaluation, 27 observation bridge, 14 live UI, 2 shipping bundle, and 3 API. These are included in the suite totals above, not additional tests to add to them. All executed JavaScript and DOM suites completed without skipped, failed, or cancelled tests. The Python run emitted two existing dependency deprecation warnings. Raw logs and their hashes are retained in `verification/learner-release.json` and the adjacent log files.

## Actual numerical results

All responses below are synthetic inputs to the shipped modules, using seed 140015. They are not a person's history or an estimate of human learning benefit.

| Condition / task | Modeled mean success probability |
|---|---:|
| Arabic contextual reading before evidence | 0.5042 |
| Same Arabic task after 21/24 synthetic successes | 0.7888 |
| Spanish aligned reading after that Arabic evidence | 0.5245 |
| Spanish aligned reading after its own 0/18 responses | 0.3576 |
| Untested Spanish exceptional form after Arabic evidence | 0.2197, prior-only |

The full record retains 90% model intervals, posterior diagnostics and task provenance. The untested form is not credited with Spanish recall; independent prior draws account for small changes in its reported mean. An authored recognition guessing floor prevents the Spanish all-failure estimate from reaching zero, exposing a likelihood limitation for systematic wrong answers.

The scalar numerical reference mean is **0.70578**, and the sampled mean is **0.69779**, an absolute difference of **0.00799**. A separate engine test integrates a normal/inverse-Gamma model to verify learned variance behavior. These independent methods check arithmetic and inference, not psychological identifiability.

The finite-posterior ideal diagnostic case has information value 0.5 and net improvement 0.4 in authored loss units. When every answer leaves the same action best, decision value is zero. A fitted synthetic Arabic root/pattern example selects the authored pattern cue. The saved report preserves all candidate losses and outcome branches.

## Verified application behavior

A learner can choose a language, recognition or production task, and help budget from Explore or Read. The live panel fits the current scoped observations, displays uncertainty and provenance, compares support/check/Continue actions, scores an actual response, persists immutable evidence, refits, and exports the complete scoped model calculation.

The tests cover source and answer exposure, recognition-to-recall leakage, supplied-base leakage, equivalent forms under different task IDs, recent component hints, future/expired events, exact task/scorer/analysis versions, skips, idempotent first responses, failed writes, lost acknowledgements, account/team isolation, no-practice preferences, inference cancellation, and delayed support/dialog races. Existing reader content, cards, and schedules retain their contracts. The original ledger's overall competence field stays unknown; posterior task probabilities live separately.

Hints are saved before display. A cancelled pending action can leave a record of possibly supplied support. Replay conservatively unions declared possible cues where the existing schema lacks the selected cue identity. This can withhold a later unaided update; the witness explains why.

## Scope and limits of verification

The native Chromium launch failed before any assertion because the execution environment denied process-singleton socket creation (`Operation not permitted`). The exact block is recorded in `verification/learner-browser/result.json`. **Native browser layout, actual assistive technology, native IndexedDB durability, and physical-device acceptance are not verified by this release run.** Executable DOM tests use a transaction fixture; API tests exercise real FastAPI and SQLite behavior.

The task set contains 93 authored tasks across 12 languages and 8 explicit existing contrast mappings. Broader morphology contrasts are limited to Arabic, English and Spanish; the remaining language coverage is two vocabulary items in recognition and production. Task content and answer rubrics have not received independent linguistic or psychometric validation.

The model is a bounded hierarchical posterior with authored priors and constrained sharing. Predictive diagnostics cover at most twelve directly observed tasks; their pass is not a certificate for every coefficient or pooling variance. The policy looks ahead one diagnostic and one terminal action. It optimizes immediate task completion under declared aids and costs. Time/practice associations are not causal learning gains, and retained learning is not measured.

## Reproduction

Use Node.js 22.22.2+, 24.15.0+, or 26+ and Python 3.11+. This run used Node.js v24.22.1, Python 3.12.14, and jsdom 31.0.1. `npm install` installs the declared development dependencies. This environment reused a matching installed jsdom through `NABU_TEST_JSDOM`; a clean network dependency installation was not part of this verification.

```bash
npm test
npm run test:learner
npm run test:learner-ui
node --test tests/*ui.dom.mjs tests/*bundle.dom.mjs
python -m pytest -q
node tools/evaluate_learner.mjs --seed 140015 --samples 256 --burn-in 384 --output docs/learner-evaluation/results.json
python tools/build_standalone.py
python tools/build_learner_paper_figures.py
python tools/build_paper.py --paper nabu-learner
```

The paper's tables and figures are generated from the saved numerical record and completed test logs. Source and bundle hashes are in the machine record. The supplied 1.14.0 baseline SHA-256 is `dfa8a4a05bc84d9d2b58f4de1492e69cef79c255b143ad6fe85846615c0c28de`. The original archive remains separate and unchanged.
