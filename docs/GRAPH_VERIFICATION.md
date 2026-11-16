# Graph foundation: verification and release record

Verified on 2026-11-14 in the existing Nabu repository. Base checkpoint: `dd8e829` (Prompt 3). Application build: `nabu-graph-20261114-r1`. Graph schema: `typed-incidence-v1`. This is an additive public-structure/query release, with one documented explicit-preference correction; it is not a new learner model or production morphology import.

## Exact final commands and results

Commands ran from the repository root. Durations below are test-runner output, not application performance benchmarks.

| Command | Result |
| --- | --- |
| `npm run build` | **Passed** all five existing stages. Six reader items, 24 annotations, 1,026 alignment entries, 12,312 primary term slots, 135,432 directed translation directions. Final standalone HTML: **1,736,475 bytes**. |
| `npm test` | **779 passed, 0 failed, 0 skipped, 0 cancelled**; **13,596.964243 ms**. Includes all 111 new graph tests and the existing evidence research tests. |
| `python -m pytest -q` | **480 passed, 0 failed**, two dependency warnings; **112.64 seconds**. |
| Five DOM suites below | **56 passed, 0 failed, 0 skipped, 0 cancelled**; **7,871.695748 ms**. |
| `node tools/evidence_episode_demo.mjs --check` | **13/13 checks passed**; all four expected artifacts match. Twelve input records, eleven unique IDs, nine scoped ledger rows, three counted responses. |
| `node --test tests/graph-evaluation.test.mjs` | Final focused research run: **23 passed**, 0 failed/skipped/cancelled; **5,670.957887 ms**. Already counted in the 779 total. |
| `node tools/evaluate_graph.mjs --output docs/graph-evaluation` | **24/24 explicit acceptance statements passed**; all three generated artifacts match a separate full replay byte-for-byte. |
| `python tools/build_graph_paper_figures.py` | Three vector figures and numeric TeX macros generated from the actual result JSON; input checksum matches. |
| `python tools/build_paper.py` | **Passed**; ten-page ICML-style PDF, main body ending on page seven. Current exact PDF hash and visual QA are in `paper/QA.md`. |
| `python tests/startup_browser.py` | **Blocked before browser startup**, exit 1: Chromium process-singleton `socket()` denied by the environment, followed by ptrace permission failure. This is not a passing browser test. |

Exact DOM command:

```sh
NABU_TEST_JSDOM=/workspace/scratch/014f6feb54e9/_qa/node_modules/jsdom/lib/api.js \
node --test \
  tests/intent-ui.dom.mjs \
  tests/next-step-ui.dom.mjs \
  tests/next-step-bundle.dom.mjs \
  tests/evidence-ui.dom.mjs \
  tests/evidence-bundle.dom.mjs
```

The DOM suites execute the actual application handlers and generated bundle with jsdom and the existing in-memory IndexedDB fixture. They check live action wiring, source preservation, graph trace metadata, scope changes, assistance/retry behavior, and existing ledger controls. They do not verify native browser rendering, disk-backed persistence, audio, screen-reader behavior or mobile devices. The current native smoke attempt failed at Chromium startup with `FATAL:chrome/browser/process_singleton_posix.cc:297 socket() failed: Operation not permitted (1)`; no browser assertion was reached.

The previous checkpoint had 668 Node, 480 Python and 56 DOM tests. This release adds **111 Node tests**: 55 kernel, 20 structural-query, 13 next-step graph integration and 23 graph evaluation tests. Existing DOM tests were extended without increasing their count. No tests were deleted to obtain a pass.

### Environment

Node **24.22.1**, Python **3.12.14**, pytest **9.2.0**, FastAPI **0.141.1**, Pydantic **2.13.4**, HTTPX **0.28.1**, jsdom **31.0.1**, NumPy **2.3.5** and Matplotlib **3.10.8** were used. Missing development packages were restored in the execution environment; no runtime requirement file or application dependency was changed.

The Python warnings are the existing AnyIO pytest-plugin use of the deprecated `CallSpec2` alias and the Starlette/FastAPI test-client deprecation of its HTTPX integration. npm also reports the environment's existing unknown `http-proxy` configuration. These are recorded rather than hidden; none caused an assertion failure.

## Verified contract and regression coverage

The kernel tests cover complete record preservation, role/position identity, conflicting versus duplicate IDs, closed references, snapshot detachment, quarantine and fixture gates, exact port witnesses, partial-context guards, all required inputs, competing analyses, typed adjacency, deterministic traversal, budget boundaries and explicit incompleteness. Independent review identified and fixed three boundary cases before the final gate: missing form/language fields in full applications, inherited witness fields that disappear on copying, and an unbounded positional-port scan during witness validation.

The adapter tests check all source types, actual translation roles, ambiguity, source offsets and versions, unknown material, source manifest integrity, review gates, lazy proposal limits and precise omitted-alternative reporting. Full translation parity checks **135,432** entry/language-pair cases with **zero output mismatches and zero missing alignment answers**. This checks compatibility with the authored resolver, not linguistic correctness.

The next-step tests preserve actual greeting, appreciation, repetition, ambiguous-word comparison and song-line actions and scores. They verify graph/evidence separation, exact occurrence tracing, unknown learner state, organizational/individual separation, open-ended exploration, confirmed versus inferred preferences, and Continue when a structural branch is incomplete or unsupported. The only intentional behavior correction is that a confirmed exact `no-practice` token now works like the already-supported “No quizzes” preference.

The existing reader, SRS, card identities, intent ownership/lifecycle, scoped event ingestion, replay, assistance handling and practice contracts continue to pass. No graph event is projected into success/failure counts.

## Actual graph and data-quality findings

| Finding | Verified result |
| --- | --- |
| Typed snapshot | **16,833 nodes; 4,190 factors; 4,199 source records; 21,598 incidences; zero pairwise edges materialized.** |
| Production morphology | **Zero complete live application factors.** Full-application semantics are exercised with synthetic fixtures only. |
| Current ambiguity | **134** normalized lookup keys have multiple catalogue alignments. Incomplete output retains ambiguity and omitted-alternative counts. |
| Idiom roles | **396** prior structural listed-target outputs differ from the resolver's actual meaning output. New witnesses use the correct declared role; the public legacy export and translator remain compatible. |
| Reader anchors | All **24** annotations retain exact source witnesses and null bank/lexeme/sense links. No gloss-based join is fabricated. |
| Category bridges | **24 of 67** bridge rows are generated category anchors, now explicitly distinguished from authored associations. Their presence is not a prerequisite or evidence of value. |
| Source lineage | Copies retain distinct source-record references and one declared lineage; independence remains false. Distinct lineage labels also do not establish independence. |
| Review status | Bank/content remain authored-unreviewed. Structural tests do not establish translations, attestation, cultural applicability or learner benefit. |
| Quarantine | Existing source-specific P073/external-output and evidence-annotation quarantines are preserved. No new live linguistic record was deleted or globally blacklisted in this release. |

The external P073 source still does not supply a complete production application join. The existing integrity report separately records dictionary listing for `marciendo`; this release does not reclassify that surface as invalid or infer that an entire pattern is invalid. The aunt/uncle context gates also remain. See `docs/GRAPH_INTEGRITY.md` and the historical evidence verification for the earlier source-specific findings.

## Structural evaluation and its limits

The fixed protocol uses seeds **11, 29, 47, 83, 101, 137, 173, 211, 257, 307, 359, 419**. Each seed/arity includes 128 supplied-input subsets: forced empty and complete cases plus 126 pseudorandom subsets. Across five arities this is 7,680 subsets, assessed by both the actual all-input gate and an explicitly lossy input-to-output edge projection.

The declared conjunction is the oracle. Both methods agree in the unary control; the lossy projection has mean false availability of **0.4863, 0.8529, 0.9798 and 0.9844** at arities 2, 4, 8 and 16. The complete gate has zero false availability on these stipulated cases. Those are semantic contract checks, not a learned-model contest or real morphology error rates. A lossless bipartite incidence graph preserves the same conjunction.

Ten application/context/status cases return their declared outcomes. Source copies do not become independent support. Adding 0–1,000 irrelevant typed topic factors leaves counted query work at one factor, two incidences and two nodes after index construction. Factors of width 100, 1,000 and 10,000 return sixteen answers under a sixteen-incidence budget and report incomplete output.

At 10,000 factors of arity sixteen, the fixture has 160,000 incidence ports versus 2.4 million directed clique records. The richer snapshot is 8,551,467 JSON bytes; the lossy edge array is 165,067,201 bytes. At arity two the richer snapshot is larger than the stripped edge array. The formats contain different metadata, and the existing real runtime already stores groups compactly. No latency, runtime heap, production throughput or human learning gain is measured.

All inputs, fixtures, exact source/implementation hashes, per-seed statistics and failure cases are in `docs/graph-evaluation/results.json`, CSV and report. Undefined or absent capabilities are not converted to zero competence. The previous observation/prediction/policy experiment in `docs/evidence-evaluation/` is unchanged.

## Source versions and checked hashes

The query version is:

```text
nabu-structure-query-v1:b32f4f2bc63ee9c81127598707820ca0d3c997c28fe21e131f70596db2bb198b
```

Its generated source manifest binds twelve data and semantic implementation dependencies. The evaluation separately records eighteen dependency hashes. All match the final checked sources.

| Artifact | SHA-256 |
| --- | --- |
| `public/index.html` | `9aa2edaee91d69907050b949605cfa1a42effe4f3aba85c98bbaa5e3a5dcd734` |
| `public/nabu-graph-kernel.js` | `35a2d31dc269a86643ec3c901b27f0c043b84627ca110213c848f8b4ae1a7dc2` |
| `public/nabu-structure-query.js` | `17313892f77fcbc0d65837815514b0b8ee78ccb26bab613ad88e16dc588a68d6` |
| `public/nabu-graph.js` | `eafa09ceea6755ceddf912c76cf49240af0b82ddb0585e8b2d9a7e466d1a55f6` |
| `tools/evaluate_graph.mjs` | `521bafdbe1637e752bafde217d731bb21e57aa00fd517b0ab55649ccfe5db215` |
| `docs/graph-evaluation/results.json` | `36d53b926ab90e281b4117f8b9f7d1acee4fb1dbf395356ca036bc360f21c686` |
| `docs/graph-evaluation/results.csv` | `3c1dc06e0a0ce3fb0683dc231c1731add6b73974cdf49b5c85d3b48446c88780` |
| `docs/graph-evaluation/report.md` | `bf8647dec4ea24dff219b4decf03acb9207db594ba1243b2db2cd2dc2715d6f7` |

The current PDF's hash is in `paper/QA.md` and the delivery manifest. The original evidence-loop PDF is preserved byte-for-byte under `paper/history/evidence-loop-20261114/`, with its original `6969a78a84c2feeae68e0329d129342bc8f3cb51561a52e8b5eff67598a0a621` checksum.

## Paper and immediate research step

The updated paper is **Typed Incidence Graphs for Task-Conditioned Language Support**. It includes local preservation and projection counterexamples, explicit source-lineage and work-budget statements, the actual catalogue audit, matched synthetic controls, negative size results, conservative-abstention costs and reproducible commands. Its official ICML style files are unchanged. Every page was rendered and reviewed; the final TeX build has no warnings, overfull boxes, missing characters or undefined references. Fonts are embedded with no Type 3 fonts. The PDF is searchable but not fully tagged for accessibility.

The previous paper, editable sources and figures remain available in the history folder. The graph paper is not submitted, accepted, peer reviewed or graded. The user-requested academic standard is a target for rigor, not an asserted outcome.

The next evidence-building step is a small independently reviewed collection of complete applications and task-material/source links. Larger graph storage, incremental indexes, inference over competing analyses, learner transfer and intervention effects need separate evaluation. The existing equal-time human pilot remains an unlaunched proposal; no participant data or sample-size claim is added.

## Compatibility, setup and release boundary

There is no new runtime dependency, provider, backend route, database table or data migration. Public structural declarations remain bundled assets. Private actor/intent/evidence data use the existing storage conventions and are not placed in the public graph. New DOM trace metadata contains public graph/witness identifiers, not raw private intent or source text.

The original `G.exportGraph()`, translation/card identities and public source snapshot remain compatible. Additive graph versions change recommendation task keys so old traces are not silently reused after structural code/source changes. The current catalogue builders still enforce 900 word entries, 90 phrases, 36 expressions and twelve languages. The full in-browser index is built and cached; generous validation caps are not production scale evidence.

Use the existing launcher and preserve the private configuration, database and browser origin. The deliverable includes the updated source, generated public application, tests, authored relations, synthetic results, paper sources and PDF. It excludes runtime databases, private configuration, dependency directories, TeX caches and the local Git directory. Nothing was deployed and no external users or accounts were changed.

The source archive's `SHA256SUMS.json` enumerates all packaged regular files except itself. Packaging checks ZIP integrity and every listed hash. The patch is relative to `dd8e829`; it is checked against a clean Git archive of that base and its resulting changed-file bytes are compared with the delivered source. The separate delivery manifest records artifact hashes and the local implementation commit.

## Changed-file inventory

53 files are added or modified relative to `dd8e829`, including the generated application, synthetic results, current paper, historical paper archive and checksum manifest.

- `NABU_EVIDENCE_LOOP.md`
- `NABU_GRAPH_FOUNDATION.md`
- `README.md`
- `SHA256SUMS.json`
- `WORDGRAPH.md`
- `data/task-material-relations.json`
- `docs/EVIDENCE_VERIFICATION.md`
- `docs/GRAPH_VERIFICATION.md`
- `docs/graph-evaluation/REPRODUCIBILITY.md`
- `docs/graph-evaluation/report.md`
- `docs/graph-evaluation/results.csv`
- `docs/graph-evaluation/results.json`
- `package.json`
- `paper/QA.md`
- `paper/README.md`
- `paper/SOURCES.md`
- `paper/figures/graph-manifest.json`
- `paper/figures/graph_budgets.pdf`
- `paper/figures/graph_conjunction.pdf`
- `paper/figures/graph_representation.pdf`
- `paper/graph-results.tex`
- `paper/history/evidence-loop-20261114/QA.md`
- `paper/history/evidence-loop-20261114/README.md`
- `paper/history/evidence-loop-20261114/SOURCES.md`
- `paper/history/evidence-loop-20261114/figures/calibration.pdf`
- `paper/history/evidence-loop-20261114/figures/manifest.json`
- `paper/history/evidence-loop-20261114/figures/policy_budget.pdf`
- `paper/history/evidence-loop-20261114/figures/policy_sensitivity.pdf`
- `paper/history/evidence-loop-20261114/figures/prediction_brier.pdf`
- `paper/history/evidence-loop-20261114/nabu-evidence.pdf`
- `paper/history/evidence-loop-20261114/nabu-evidence.tex`
- `paper/history/evidence-loop-20261114/references.bib`
- `paper/nabu-evidence.pdf`
- `paper/nabu-evidence.tex`
- `paper/references.bib`
- `public/index.html`
- `public/nabu-graph-kernel.js`
- `public/nabu-graph.js`
- `public/nabu-next-step-ui.js`
- `public/nabu-next-step.js`
- `public/nabu-structure-query.js`
- `public/nabu-sw.js`
- `public/nabu-task-material-data.js`
- `tests/graph-evaluation.test.mjs`
- `tests/graph-kernel.test.mjs`
- `tests/next-step-bundle.dom.mjs`
- `tests/next-step-graph.test.mjs`
- `tests/next-step-ui.dom.mjs`
- `tests/structure-query.test.mjs`
- `tools/build_graph.py`
- `tools/build_graph_paper_figures.py`
- `tools/build_standalone.py`
- `tools/evaluate_graph.mjs`
