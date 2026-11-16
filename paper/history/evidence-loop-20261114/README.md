# Historical evidence-loop paper

This directory preserves the checked Prompt 3 paper exactly as committed at `dd8e829` before the graph-foundation iteration. Its title is **Evidence Before Inference: Intent-Conditioned Language Support with Replayable Observations**. The PDF, editable TeX, bibliography, four vector figures, figure manifest, source verification, and original QA record are unchanged copies from that commit.

The current paper is `../../nabu-evidence.pdf`; it covers the newer typed-incidence graph implementation. This historical paper remains useful for the separate observation, prediction, and policy experiments. Its test totals and PDF verification apply to its own recorded version, not to the current repository. No human study or course grade was claimed.

The original evaluation is still available, unchanged, in `docs/evidence-evaluation/`, with `tools/evaluate_evidence.mjs` and `tools/build_paper_figures.py`. The shared official ICML style is in `paper/vendor/`; local TeX intermediates were not archived. To recompile this historical source with a configured TeX installation, run `pdflatex` and `bibtex` from this directory with `TEXINPUTS` and `BSTINPUTS` including `../../vendor`, then repeat `pdflatex` twice. The included checked PDF requires no build step.
