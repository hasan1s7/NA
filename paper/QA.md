# Current graph paper verification record

## Checked deliverable

- File: `paper/nabu-evidence.pdf`
- Title: **Typed Incidence Graphs for Task-Conditioned Language Support**
- SHA-256: `765b9dde14b9e2380a42c739d9f1820da4691cb28eb8e81ec046f7681ed149e8`
- Size: **302,244 bytes**.
- Pages: **10**. The main body ends on page **7**; references occupy pages **7–8**; appendices begin on page **8** and end on page **10**.
- Page format: US letter, 612 × 792 points.
- Attribution: Anonymous Authors; explicitly a research prototype, not submitted or peer reviewed.

## Compilation and visual verification

The final `python tools/build_paper.py` completed successfully with the unchanged official ICML 2026 style files. The final TeX log contains **no warnings, overfull boxes, missing-character reports, or undefined references**. Ordinary underfull-box diagnostics were visually reviewed and do not indicate missing content or clipping.

Every final page was rendered with:

```bash
pdftoppm -r 120 -png paper/nabu-evidence.pdf paper/.build/graph-final
```

All **10 final page images** were inspected. A slightly overwide type table, overlong reproduction commands, and a nonbreaking seed list were corrected before this final render. The final figures have labelled axes, explicit control/baseline names, visible markers, and captions identifying the synthetic oracle and error bars. Tables, equations, references, code commands, footers, and the anonymous notice are legible without overlaps or clipping.

After the final wording correction distinguishing record/port count limits from metadata byte-size limits, every page was rendered again. Pages 1–9 were byte-identical PNGs to the inspected prior render; the changed page 10 was visually reinspected.

The local review images are `paper/.build/graph-final-01.png` through `paper/.build/graph-final-10.png`. They are ignored QA intermediates and should not be included in release archives.

Poppler reports all fonts embedded, including Times-family body fonts, mathematical fonts, and TrueType figure labels; there are **no Type 3 fonts**. The PDF is text-searchable. It is **not a fully tagged accessible PDF**; editable TeX, the evaluation report, and exact CSV/JSON results accompany it.

All five vendored style/bibliography files were compared byte-for-byte with the verified official ICML archive. They are unchanged. The original archive checksum remains recorded in `vendor/SOURCE.txt`.

## Data and reproducibility checks

The final graph result is bound to:

`nabu-structure-query-v1:b32f4f2bc63ee9c81127598707820ca0d3c997c28fe21e131f70596db2bb198b`

The full evaluator was run against the frozen implementation and then independently rerun into the ignored `paper/.build/graph-repeat/` directory. All three generated artifacts were byte-identical:

| Artifact | SHA-256 |
|---|---|
| `docs/graph-evaluation/results.json` | `36d53b926ab90e281b4117f8b9f7d1acee4fb1dbf395356ca036bc360f21c686` |
| `docs/graph-evaluation/results.csv` | `3c1dc06e0a0ce3fb0683dc231c1731add6b73974cdf49b5c85d3b48446c88780` |
| `docs/graph-evaluation/report.md` | `bf8647dec4ea24dff219b4decf03acb9207db594ba1243b2db2cd2dc2715d6f7` |

All **18 recorded dependency hashes** match the shipped files. The graph figure manifest's result checksum matches the saved JSON. All numerical macros in `graph-results.tex` are generated from that JSON, as are the three graph vector figures.

The final evaluator reports **24/24 acceptance statements passing**, including **135,432 translation cases with 0 contract mismatches and 0 missing alignment answers**. The full repeat command completed in 14.21 seconds elapsed in this environment. This is reproduction duration, including generation and the audit, not a graph-query latency benchmark.

The final focused command `node --test tests/graph-evaluation.test.mjs` reports **23 tests, 23 passed, 0 failed, 0 skipped, 0 cancelled**; Node's reported duration was **5,670.957887 ms** (shell elapsed **5.78 seconds**). Whole-repository test totals belong to the current top-level verification report, not this focused-paper record.

## Scope and claims checked

- Language-qualified surfaces, authored alignments, usages, and source anchors remain distinct; unsupported lexeme/sense identities are not invented.
- The retention proposition is relative to declared records and specified canonicalization, not linguistic truth.
- The projection counterexample compares an explicitly forgetful edge representation with full conjunction; a lossless bipartite incidence graph avoids the loss.
- The analytic probability expression is conditional on independent supplied inputs; the fixed-seed experiment is a synthetic semantic check, not a morphology benchmark.
- Complete applications have all inputs, outputs, features, guards, provenance, and alternatives. They remain synthetic fixtures only.
- Source-lineage grouping does not establish statistical independence or validate a source. Witness traceability is separate from traversal eligibility.
- The gate abstains on unresolved alternatives even when their outputs agree, and this coverage limitation is stated.
- Query counters exclude indexing, sorting, source-text checking, witness-copying, and other bookkeeping. No measured latency, memory, or global-planning advantage is claimed.
- Size comparisons state their different metadata and information content and retain the adverse arity-two byte comparison. The existing runtime was already compact.
- No learner observations are added by graph discovery. Production competence remains unknown; the earlier research-only Beta estimators remain separate.
- The one equal-time human pilot is proposed, not launched. No sample size, power, recruitment, efficacy, author affiliation, acceptance, or course grade is fabricated.

## Historical preservation

Ten historical paper files under `paper/history/evidence-loop-20261114/` were verified byte-for-byte against commit `dd8e829`: the original PDF, TeX, bibliography, QA/source records, four evidence figures, and their manifest. The archive README is new and explains its version boundary. The prior evidence generator, results, tests, figure builder, and root-level evidence figures remain unchanged.

This QA record applies to the PDF checksum above. A rebuild may change PDF metadata and therefore its checksum. A changed manuscript or figure requires renewed visual inspection and a new checked hash.
