# Nabu 1.15.0 learner model paper

**From Typed Language Structure to Bayesian Learner Decisions: Auditable Hierarchies in Nabu** is the current research and implementation draft, in `nabu-learner.pdf`. Its editable sources are `nabu-learner.tex`, `learner-evaluation.tex`, `learner-appendix.tex`, and the shared bibliography. It accompanies the live Bayesian learner and decision layer. It reports numerical reference checks, synthetic examples, and application tests; it makes no human efficacy or publication claim.

The saved numerical record is `../docs/learner-evaluation/results.json`. `tools/build_learner_paper_figures.py` generates the `learner-results.tex` values and vector figures from that record and the completed verification logs. `figures/learner-manifest.json` binds the figures to the result-file hash. `LEARNER_QA.md` records the final paper inspection.

From the application root, reproduce the learner results and PDF with:

```bash
npm run evaluate:learner
python tools/build_learner_paper_figures.py
python tools/build_paper.py --paper nabu-learner
```

JavaScript tests, executable DOM tests, and Python test outcomes are recorded in `../docs/LEARNER_VERIFICATION.md`. Run `npm install` for development dependencies; `jsdom` is pinned as a test dependency and is absent from the runtime bundle. Building the paper also requires local Matplotlib, NumPy, `pdflatex`, and `bibtex`. The original graph paper and evidence-loop history below remain preserved; their original use of “current” describes that earlier checkpoint.

---

# Previous graph foundation paper

**Typed Incidence Graphs for Task-Conditioned Language Support** is the current anonymous research-prototype paper. It accompanies the additive graph implementation in the existing Nabu application. It is not submitted, accepted, graded, or peer reviewed. Its measurements are a repository audit and explicitly synthetic structural-contract cases; it reports no human learning result or validated linguistic benchmark.

The stable deliverable filename remains `nabu-evidence.pdf`. The earlier evidence-loop paper is preserved, unchanged from commit `dd8e829`, under `history/evidence-loop-20261114/`, including its PDF, TeX, bibliography, figures, and original verification record. The older evidence experiments in `docs/evidence-evaluation/` and their generator are unchanged.

## Files

- `nabu-evidence.pdf`: compiled current graph-focused paper, references, and reproducibility appendix.
- `nabu-evidence.tex`: complete editable manuscript.
- `references.bib`: verified primary-publication bibliography; older entries remain available for the historical paper.
- `graph-results.tex`: numeric macros generated only from the saved graph results.
- `figures/graph_*.pdf`: three vector figures from actual saved graph results.
- `figures/graph-manifest.json`: result-file SHA-256, protocol, seeds, and error-bar semantics.
- `figures/prediction_brier.pdf`, `calibration.pdf`, `policy_budget.pdf`, `policy_sensitivity.pdf`, and `manifest.json`: unchanged figures from the previous evidence experiment, also included in its archive.
- `vendor/`: unchanged official ICML 2026 style files; `vendor/SOURCE.txt` records the source URL and archive checksum.
- `SOURCES.md`: primary-source verification and the narrow claims supported by each citation.
- `QA.md`: the checked current PDF hash, layout, page count, fonts, and claim boundaries.
- `.build/`: ignored TeX intermediates, optional local format cache, logs, and page renders. These are not deliverables and should be excluded from release archives.

## Reproduce the current paper

From the repository root:

```bash
node tools/evaluate_graph.mjs --output docs/graph-evaluation
node --test tests/graph-evaluation.test.mjs
python tools/build_graph_paper_figures.py
python tools/build_paper.py
```

The evaluation uses Node.js; the recorded environment used version 24.22.1. Figures require Python, Matplotlib, and NumPy. Compilation requires `pdflatex`, `bibtex`, and the standard packages used by the official ICML style. No paid API, credential, production database, deployment, or network request is needed for these commands after dependencies are installed.

The PDF builder uses local style files. Some minimal containers include TeX engines and packages but lack initialized format or font caches. When the Debian distribution is present at `/usr/share/texlive/texmf-dist`, the script can initialize only an ignored `.build/` cache. It does not modify the system installation. Missing packages must be installed through normal environment setup.

## What the paper establishes

The manuscript formalizes retained records and ports, complete conjunctive applications, partial context, source-lineage grouping, and explicit query limits. The full translation audit checks compatibility with the existing authored translator, not independent translation correctness. The synthetic comparison holds inputs fixed and contrasts a whole-application gate with an intentionally forgetful edge projection; a lossless bipartite incidence graph avoids the same counterexample. The unary control, source copies, unresolved alternatives, unknown context, output truncation, and metadata overhead are retained.

Representation-size measurements compare explicitly different formats. The old runtime was already compact; a large `exportGraph()` serialization is not its normal memory footprint. Work counters apply after index construction and do not substitute for measured latency or memory. Complete morphology applications remain synthetic fixtures only. No graph score, learner evidence transfer, or global optimal plan is implemented by these queries.

The production observation projector still returns direct counts and a ledger with unknown competence. The previous research-only Beta estimators are not moved into production or into this graph kernel. Representation, predictive modeling, and intervention policy remain separate evaluation questions.

## Format and attribution

The manuscript uses the official ICML 2026 `preprint` style, Times-family body fonts, US letter pages, and vector figures. Vendor files are unchanged. The document changes only the affiliation/notice content to say **Anonymous Authors** and **Not submitted or peer reviewed**, without inventing an affiliation, email, submission, or grade. This is an ICML-style draft, not a submission-checker certification.

The main body stays within eight pages; references and appendices follow. Every page is rendered and inspected. The PDF is text-searchable but is not a fully tagged accessible PDF; editable source and a detailed text report accompany it. The one equal-time human pilot remains a proposal, with no recruitment, launch, power calculation, or results.

## Updating a later delivery

Update claims from the implemented API first. Rerun the declared evaluation after code/source fingerprints are final, repeat it to check deterministic outputs, regenerate all graph figures and numeric macros, and reconcile every number with the saved JSON. Preserve the distinction between authored records and verified linguistic facts, between recorded dependencies and independence, and between counted query work and total system cost. Compile, render every page, inspect tables/figures/references, and record the checked final PDF hash before packaging code, paper, and editable sources.
