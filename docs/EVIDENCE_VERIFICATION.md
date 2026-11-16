# Prompt 3: verification and release record

**Historical checkpoint:** the counts and artifact hashes below refer to commit `dd8e829`, before the graph foundation extension. Current verification is in [GRAPH_VERIFICATION.md](GRAPH_VERIFICATION.md). The original paper bytes and QA record are preserved in `paper/history/evidence-loop-20261114/`; the stable current paper path is updated by the graph release.

Verified on 2026-11-14 in the existing Nabu repository. The comparison checkpoint is Prompt 2 commit `28d3bc9`. The application build ID is `nabu-evidence-20261114-r1`. This record separates automated checks, authored fixtures, generated experiments, paper review and unverified browser behavior.

## Final regression results

All commands in this section ran from the repository root unless otherwise stated. Durations are those emitted by the test runners, not performance benchmarks.

| Command | Final result |
| --- | --- |
| `npm run build` | Passed all five existing build stages. Six reader items, 24 annotations, 1,026 authored alignment entries, 12,312 form slots, 135,432 directed translation links; generated standalone HTML is 1,678,643 bytes. These are structural counts, not validated senses or learner evidence. |
| `npm test` | **668 passed, 0 failed, 0 skipped**, 3,561.065466 ms. Includes the 22 research-harness tests; do not count those twice. |
| `python -m pytest -q` | **480 passed, 0 failed**, two dependency warnings, **113.01 seconds**. |
| Five DOM suites below | **56 passed, 0 failed, 0 skipped**, 4,620.734584 ms. |
| `node tools/evidence_episode_demo.mjs --check` | Passed all **13** assertions; all four generated fixture artifacts match their expected bytes. Twelve input records, 11 unique IDs, nine scoped ledger rows, three counted responses. |
| `node --test tests/evidence-evaluation.test.mjs` | **22 passed, 0 failed, 0 skipped**, 538.999814 ms in the final focused check. These are already included in the 668 total. |
| `node tools/evaluate_evidence.mjs --output docs/evidence-evaluation` | Completed the declared 12-seed protocol; report, JSON and CSV saved. A separate full replay matches these files byte-for-byte. |
| `python tools/build_paper_figures.py` | Generated four vector PDF figures from the actual saved result JSON. Figure-manifest input hash matches that JSON. |
| `python tools/build_paper.py` | Built the 12-page PDF with the main body ending on page eight. See `paper/QA.md` for the checked PDF checksum and visual review. |
| `git diff --cached --check -- . ':!paper/vendor/*'` | Passed for authored changes. The unchanged official style files contain upstream trailing whitespace/blank EOF lines; a whole-index check reports those, and they are retained to preserve byte-for-byte provenance. |
| `python tests/startup_browser.py` | **Blocked before browser startup**, exit 1: Chromium process-singleton `socket()` denied by the execution environment. This is not a passing browser test. |

The exact DOM command was:

```sh
NABU_TEST_JSDOM=/workspace/scratch/014f6feb54e9/_qa/node_modules/jsdom/lib/api.js \
node --test \
  tests/intent-ui.dom.mjs \
  tests/next-step-ui.dom.mjs \
  tests/next-step-bundle.dom.mjs \
  tests/evidence-ui.dom.mjs \
  tests/evidence-bundle.dom.mjs
```

The DOM suites comprise 12 intent tests, 18 next-step UI tests, four next-step bundle tests, 17 evidence UI tests and five evidence bundle tests. They execute real application handlers and the generated standalone bundle with jsdom and an in-memory IndexedDB fixture. They verify wiring, source preservation, assistance recording, stable retries, scope changes, skip/return behavior, no-practice preferences and ledger actions. They do not verify native disk persistence, pixel layout, actual audio playback or assistive-technology behavior.

For comparison, fresh tests at the unchanged Prompt 2 checkpoint passed **535 JavaScript** and **378 Python** tests. This release retains those suites and adds 133 JavaScript and 102 Python tests. The final documentation qualifications do not change application code or the built bundle.

### Environment and warnings

The recorded environment used Node **24.22.1**, Python **3.12.14**, pytest **9.2.0**, FastAPI **0.141.1**, Pydantic **2.13.4**, HTTPX **0.28.1** and jsdom **31.0.1**. Figures used Matplotlib **3.10.8** and NumPy **2.3.5**. This records what was actually exercised; it does not alter the repository's existing dependency pins or claim that every pinned deployment combination was tested.

The two Python warnings were:

1. The installed AnyIO pytest plugin imports the deprecated pytest `CallSpec2` alias, scheduled for removal in pytest 10.
2. The installed Starlette/FastAPI test client warns that its HTTPX integration is deprecated in favor of HTTPX2.

Both also appeared in baseline testing. npm emitted an existing environment warning about the unknown `http-proxy` configuration. No application assertion failed because of these warnings.

Chromium's startup error was `FATAL:chrome/browser/process_singleton_posix.cc:297 socket() failed: Operation not permitted (1)`, followed by a ptrace permission error. Native browser, mobile device and screen-reader acceptance checks remain outstanding. No deployment, production database, user account or participant was used in these tests.

## Evidence and data-quality checks

The new tests exercise creation, exact duplicate delivery, conflicting IDs, immutable first responses, terminal-attempt uniqueness, retry cycles and missing parents, reference drift, wrong user/team and revoked membership, deleted-reference retries, batch atomicity, UTF-8 request sizing, legacy compatibility and exact-scope recommendation inputs. A 559-case mutation comparison of the JavaScript and Python validators found zero validity disagreements in the checked cases; it is not a proof that all possible inputs behave identically.

Observation tests distinguish exposure, lookup, pronunciation assistance, recognition cues, retrieval, contextual production, assisted retry, unknown performance, delayed changed conditions and source-version changes. They retain direct target/mode counts without graph propagation. Task and policy tests cover supported-base eligibility, uncertainty, first-response ambiguity, no-practice preferences, changed next-help branches and continuing the reader.

The real catalogue issue found during this work is `imru-al-qais-stop-and-weep:p3`: its prompt concerns the morning of parting, while its referenced `a4` annotation concerns grief; `a3` matches the prompt. Its new analysis adapter is quarantined from scored projections and new practice recommendations. Original content and historical responses remain intact. Arabic editorial quality and the eight newly authored contrast drafts still require independent review; software tests do not establish linguistic attestation.

The pre-existing Prompt 2 P073/external-output registry is retained. No production morphology dataset containing that application has appeared, and this release does not fabricate an imported graph repair. See `docs/GRAPH_INTEGRITY.md`.

## Reproducible research and paper

The experiment is explicitly synthetic. It uses fixed seeds `11, 29, 47, 83, 101, 137, 173, 211, 257, 307, 359, 419` and 128 fictional learners per world and seed. The prediction comparison and policy comparison hold different variables fixed and are reported separately. New-family probes exclude every member of the held-out lexical family. The experiment includes an independent-item world, wrong applicability, conflicting analysis, same spelling with different readings, unassessed exposure, assisted retries and both knowing and unknowing skips.

A direct research Beta model and an experimental graph-informed mixture use identical observations and held-out responses. Neither is the production projector, which returns `competence: null`. The policy comparison keeps the direct estimator, six-item pool, keyed potential outcomes, question/help costs and time budget fixed. Assumed synthetic learning and retention regimes are not measured human effects.

The report includes Brier error, ten-bin calibration error, readiness coverage, conditional and population false-ready rates, simulated task success, question/interruption counts and 60/120/240-second budgets. Undefined rates are left unavailable. Means and sample SDs are across fixed seeds, not confidence intervals about learners. Both harmful structural borrowing and diagnostic-policy reversals are reported.

The paper uses the official unchanged ICML 2026 style files, an anonymous research-prototype notice and verified primary references. All 12 pages were rendered and inspected; the final log has no package warnings, overfull boxes, missing glyphs or undefined references, and every font is embedded. It is text-searchable but not a fully tagged accessible PDF. It is not submitted, peer reviewed, accepted or graded. Its editable LaTeX, bibliography, vector figures and build scripts accompany the PDF.

`docs/HUMAN_PILOT_PROPOSAL.md` specifies one proposed randomized equal-time pilot: 12-minute sessions, the same reviewed content/model, and a 48-hour unassisted target within a 42–54-hour window with documented changed conditions. The timing is a design choice, sample size is not asserted, and the study has not been launched.

## Release and migration boundary

Prompt 3 adds no database table, runtime dependency, provider key or third-party text transfer. Existing SQLite events and browser metadata remain authoritative. Restart the updated backend to advertise `evidenceEvents: true`; account audit controls are withheld against an older backend. Keep existing private configuration and database files during an update. The package contains source, public/generated application assets, tests, authored examples, reports and paper sources, but no new runtime database, private settings, test environment, TeX cache or `.git` directory.

The existing 8,000-event cap remains. Same-account owner access and current membership checks are implemented, but there is no new enterprise security boundary, cryptographic audit attestation or validation that a client truthfully reports human behavior. Historical own-event export remains available after membership ends. An exact stored retry can survive deletion of its old intent reference, while still requiring the same actor and current team membership.

The source archive's `SHA256SUMS.json` records all packaged file hashes except itself. The delivery manifest beside the artifacts records archive/patch/report/PDF hashes and the local implementation commit. The patch is relative to `28d3bc9`; the complete source archive is the authoritative runnable delivery. Packaging verifies ZIP integrity and every listed hash. The following sections inventory the changed files and reproducibility artifacts.

## Checked artifact hashes

Hashes are SHA-256 of the final checked bytes.

| Artifact | SHA-256 |
| --- | --- |
| `public/index.html` | `de19776ec0fe1d0d5c8d5aefd10a7ed78ed83c11e1d80d8e2f072fca0043cd81` |
| `public/nabu-observations.js` | `a606ac948f1503f3749f46859d2e0636de0c84f2720866e36cc0b491a3f9797d` |
| `tools/evaluate_evidence.mjs` | `e80e76da10e5d4173e74b45556457a537e74e7ac8371053924da2f3978973b05` |
| `docs/evidence-evaluation/results.json` | `2db872c8e18f9b9fb966a95ddbd61fcacd1620ce952d49d2af165aca8dceecbd` |
| `docs/evidence-evaluation/results.csv` | `a1975c2588270fa2f3adc4845e4cfcdbfe1b34da8835217eea3f29e5a1a0cfe1` |
| `docs/evidence-evaluation/report.md` | `4c889a5e2c113b154d4838cebda3529a4873d22f38ed54fd56d0e8c587424cbe` |
| `docs/evidence-episode/events.json` | `3f347ad20c61b8b992854f0d782230bdd95d1c27167c1c0ab874269277f9b0fd` |
| `docs/evidence-episode/ledger.json` | `7991b9daf7f0a94d4d153ec9e9af9b13dbf82d932b646c4231365cc9bdecdfcd` |
| `docs/evidence-episode/replay.json` | `182d66622179f6dc8a3f276606fd841590a02df46ce5d139a5ba506d076437dd` |
| `paper/nabu-evidence.pdf` | `6969a78a84c2feeae68e0329d129342bc8f3cb51561a52e8b5eff67598a0a621` |

## Complete changed-file inventory

62 files are added or modified relative to Prompt 2, including the generated bundle, paper assets and packaging checksum manifest. Generated result files are explicitly synthetic.

- `NABU_EVIDENCE_LOOP.md`
- `README.md`
- `SHA256SUMS.json`
- `content_progress.py`
- `decision_engine.py`
- `docs/EVIDENCE_VERIFICATION.md`
- `docs/HUMAN_PILOT_PROPOSAL.md`
- `docs/evidence-episode/README.md`
- `docs/evidence-episode/events.json`
- `docs/evidence-episode/ledger.json`
- `docs/evidence-episode/replay.json`
- `docs/evidence-evaluation/report.md`
- `docs/evidence-evaluation/results.csv`
- `docs/evidence-evaluation/results.json`
- `next_step_inputs.py`
- `package.json`
- `paper/.gitignore`
- `paper/QA.md`
- `paper/README.md`
- `paper/SOURCES.md`
- `paper/figures/calibration.pdf`
- `paper/figures/manifest.json`
- `paper/figures/policy_budget.pdf`
- `paper/figures/policy_sensitivity.pdf`
- `paper/figures/prediction_brier.pdf`
- `paper/nabu-evidence.pdf`
- `paper/nabu-evidence.tex`
- `paper/references.bib`
- `paper/vendor/SOURCE.txt`
- `paper/vendor/algorithm.sty`
- `paper/vendor/algorithmic.sty`
- `paper/vendor/fancyhdr.sty`
- `paper/vendor/icml2026.bst`
- `paper/vendor/icml2026.sty`
- `public/index.html`
- `public/nabu-app.js`
- `public/nabu-content-store.js`
- `public/nabu-content.js`
- `public/nabu-evidence-policy.js`
- `public/nabu-evidence-tasks.js`
- `public/nabu-evidence-ui.js`
- `public/nabu-evidence.css`
- `public/nabu-explore-ui.js`
- `public/nabu-next-step-ui.js`
- `public/nabu-next-step.js`
- `public/nabu-observations.js`
- `public/nabu-sw.js`
- `server.py`
- `tests/content-store.test.mjs`
- `tests/content.test.mjs`
- `tests/evidence-bundle.dom.mjs`
- `tests/evidence-evaluation.test.mjs`
- `tests/evidence-tasks-policy.test.mjs`
- `tests/evidence-ui.dom.mjs`
- `tests/next-step-evidence.test.mjs`
- `tests/observations.test.mjs`
- `tests/test_evidence_events.py`
- `tools/build_paper.py`
- `tools/build_paper_figures.py`
- `tools/build_standalone.py`
- `tools/evaluate_evidence.mjs`
- `tools/evidence_episode_demo.mjs`
