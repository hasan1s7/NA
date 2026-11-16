# Nabu 1.15.0 — Bayesian learner support

**Release:** 1.15.0  
**Build:** `nabu-learner-20261114-r1`  
**Date:** November 14, 2026

This release implements the learner model and decision layer on top of the existing typed graph, reader, intentions, and evidence ledger. It is a local application update; it does not claim a deployment or a measured improvement in human learning.

## Using the new flow

Open **Explore** (`/explore`) or **Read** (`/read`). In **A small learning goal**, select **Find useful support**. Choose the language, response type, exact goal, and time available for help, then select **Find my next step**.

The panel displays the modeled chance of success on that task, an uncertainty interval, and whether the estimate comes from starting assumptions or accepted evidence. Available actions include an authored cue, a useful diagnostic, or **Keep going**. **Why this next step?** exposes expected loss and value of information. **Try my chosen goal** allows an assessed response when practice is permitted. **Export my model record** exports the scoped observations, assumptions, posterior draws, diagnostics, and decision calculation.

The existing immediate intention still controls no-practice. Changing account, team, goal, or relevant evidence invalidates the displayed fit. Continue remains available when evidence is absent or a decision cannot be computed.

## Implemented model

The crossed hierarchy separates language, response mode, meaning, lexical base or item-specific lexical gate, morphological pattern, word, context, and optional whole-form memory. Gaussian effects and learned variance hyperparameters produce partial pooling. A cross-language transfer group must be explicitly authored; a shared label, translation, or graph neighbor does not grant knowledge of a local word form.

The response likelihood combines required components, an optional whole-form alternative, declared guessing and lapse values, and observational time/practice covariates. Component success is conjunctive within the compositional route. A complete correct response therefore does not prove that every component is known: it could arise through the alternative memory route or guessing. Recognition and production retain separate parameters.

Posterior inference runs locally and asynchronously with cancellation and bounded computation. The default fit uses two chains, 96 warm-up iterations, and 64 retained draws per chain. If its predictive chain check fails, the live UI makes one longer attempt with 384 warm-up iterations and 256 retained draws per chain. This changes computation, not evidence weights. Prior-only, unstable, and bounded states remain visible. The diagnostics do not certify convergence of every latent parameter or identify a psychological decomposition.

The task catalogue contains **93 authored tasks across 12 languages**, plus explicit model mappings for **8 existing contrast tasks**. Arabic, English, and Spanish provide a small set of base, pattern, exceptional-form, retrieval, and contextual-reading contrasts. A small vocabulary slice supplies the remaining multilingual coverage. These are authored mappings and narrow answer rubrics; they have not received independent linguistic or psychometric validation.

## Evidence and scope

The learner bridge uses the existing immutable event store. An admitted response retains its event/episode identity, actor, exact task and analysis version, source occurrence, input/output modality, first response, assistance conditions, rubric, and scorer. Unsupported references, ambiguous attempts, future events, duplicate events, and dependent repeats do not silently enter the likelihood.

Help, feedback, source exposure, skips, and assessed responses remain distinct. Assisted evidence normally cannot update unaided performance. An explicitly authored task with its base meaning supplied can inform only the remaining mapped requirements. Recent help and feedback are carried across reopened checks within the bounded session.

Hints are saved before the cue appears. A cancelled pending action can therefore leave a record of possibly supplied support and conservatively exclude a later response. Generic hint replay also uses all declared possible cues for that task because the existing event schema does not identify the selected cue. The audit explains this exclusion; it does not turn the hint into mastery evidence.

Guest, account, and team contexts remain separate. Inference does not automatically import another learner's private history. The research cohort API requires an explicit authorized scope. The observation ledger continues to leave overall competence unknown; posterior task predictions are exported separately. Existing review schedules are not replaced by this learner model.

## Decision layer and its limits

The policy minimizes normalized weighted target failure probability plus declared effort cost. The live panel uses one chosen target and a cost of **0.002 unsuccessful-task-loss units per second**. Those durations and costs are visible design assumptions, not measured cognitive or economic effects.

A support action names the actual component it supplies and the exact tasks it affects. Its probability is conditional on that aid being present. A diagnostic is useful only when its possible answers can change the best subsequent action enough to pay for its cost. The calculation uses aligned joint posterior draws and Bayes reweighting, preserving covariance among task predictions. Time limits apply to both the diagnostic and its follow-up action.

The look-ahead contains **one diagnostic followed by a terminal action**. Opportunity counts and last-opportunity histories are held fixed during this calculation; only wall-clock time advances. An actual accepted response subsequently updates histories on refit. This information-only approximation does not simulate a causal teaching effect. Learning gain and retention gain remain unknown. A long-horizon teaching policy and a demonstration of improved learning remain separate work.

## Verification and research artifact

The implementation has passing JavaScript model/decision/evidence tests, DOM interaction and built-bundle checks, actual API checks, and Python backend tests. The evaluation uses hand-computable decision cases, independent numerical integration, and seeded synthetic response sequences. It reports the actual sampling diagnostics, probabilities, proper scores, decision branches, and timing. See [the generated report](learner-evaluation/results.md), [complete JSON record](learner-evaluation/results.json), [release verification record](LEARNER_VERIFICATION.md), and [machine summary](../verification/learner-release.json). Exact test totals are recorded there and in `verification/learner-node-tests.log`, `verification/learner-api-tests.log`, and `verification/learner-dom-tests.log`.

Native Chromium visual verification was blocked by the environment's socket policy. DOM execution and API results are not a substitute for visual browser acceptance or a physical-device check, and those checks are not claimed. No live provider efficacy, deployment, or human learning result was established.

The accompanying research draft is [paper/nabu-learner.pdf](../paper/nabu-learner.pdf), with [editable LaTeX](../paper/nabu-learner.tex). It documents the implemented architecture, mathematical assumptions, independent reference calculations, synthetic cases, and empirical limits. It is a draft, not a claim of publication or peer review. Earlier graph/evidence papers remain preserved.

## Commands

Run commands from the extracted application folder. The JavaScript tooling supports Node.js 22.22.2+, 24.15.0+, or 26+. The verified runtime was Node.js 24.22.1. Run `npm install` to install development tools, including the pinned `jsdom` DOM harness. The normal local launcher uses Python 3.11 or newer; no learner runtime dependency was added.

| Purpose | Command |
|---|---|
| Start the full local application | `python start_local.py` |
| Start on Windows | `py -3 start_local.py` or `Start-Nabu.cmd` |
| Start on macOS/Linux | `bash start-local.sh` |
| All JavaScript tests | `npm test` |
| Learner model, policy, evidence, and evaluation tests | `npm run test:learner` |
| Learner DOM and shipped-bundle tests | `npm run test:learner-ui` |
| Python/backend tests | `npm run test:api` |
| Regenerate numerical report | `npm run evaluate:learner` |
| Rebuild the application | `npm run build` |
| Rebuild the learner paper | `python tools/build_paper.py --paper nabu-learner` |

The evaluation command writes `docs/learner-evaluation/results.json` and a Markdown companion. The paper command requires local `pdflatex` and `bibtex`; it performs no submission. Opening `public/index.html` directly or using the static-only server does not provide account/backend functionality.

## Safe upgrade

1. Stop the existing Nabu server with Ctrl+C before changing code or copying the database.
2. Back up the current private `.data/` directory and `.env.local`. Preserve browser-only work through the existing export controls and keep the browser profile you use for Nabu.
3. Extract 1.15.0 into a separate folder. Preserve your existing database and settings in the new installation; do not replace them with a template or another archive's database. Keep backups outside the new release folder.
4. Run the normal local launcher from the new folder. Let it create or update that folder's Python environment and pinned dependencies.
5. Open `http://127.0.0.1:8000/explore` or `/read` using the same browser/profile and origin. A different hostname or port uses different browser storage.

The learner layer reuses the existing event store. This work did not migrate a private user database, reset a learner's schedules, deploy the site, or change provider credentials.

## Source trace and implementation references

The verified baseline was the supplied **Nabu 1.14.0 ZIP**, with SHA-256:

```text
dfa8a4a05bc84d9d2b58f4de1492e69cef79c255b143ad6fe85846615c0c28de
```

Package and server metadata now identify version 1.15.0. Current source contracts:

- [Task definitions](../public/nabu-learner-tasks.js) and [task/evidence documentation](LEARNER_TASKS.md)
- [Observation bridge](../public/nabu-learner-observations.js)
- [Hierarchical learner model](../public/nabu-learner-model.js)
- [Decision policy](../public/nabu-learner-policy.js) and [decision documentation](LEARNER_DECISIONS.md)
- [Live goal interface](../public/nabu-learner-ui.js)
- [Reproducible evaluation tool](../tools/evaluate_learner.mjs)

Historical release notes remain in the package. Their older version labels, test totals, and descriptions of unimplemented learner inference are superseded by this release.
