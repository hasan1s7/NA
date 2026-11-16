# Paper verification record

## Checked deliverable

- File: `paper/nabu-evidence.pdf`
- SHA-256: `6969a78a84c2feeae68e0329d129342bc8f3cb51561a52e8b5eff67598a0a621`
- Size: 310,400 bytes.
- Pages: **12**. The main body ends on page **8**; references begin on the same page. Appendices occupy pages **9–12**.
- Page format: US letter, 612 × 792 points.
- Attribution: Anonymous Authors; explicitly a research prototype, not submitted or peer reviewed.

## Compilation and content checks

`python tools/build_paper.py` completed successfully using the unchanged official ICML 2026 style files. The final TeX log has no package warnings, overfull boxes, missing-character reports, or undefined references. The ordinary underfull-box diagnostics were visually reviewed; they do not indicate clipping or missing text in the checked pages.

Poppler font inspection reports every font embedded, including the Times-family body fonts, mathematical fonts, and TrueType vector-figure labels. There are no Type 3 fonts. The PDF is text-searchable. It is **not a fully tagged accessible PDF**; editable TeX and the text evaluation report are supplied as additional formats.

All five vendored style/bibliography files were compared byte-for-byte with the verified official archive. The figure manifest's result checksum matches the saved experiment JSON. Every new-family result-table mean and sample SD was programmatically checked against that JSON. No chart or table values were supplied by an image generator.

## Visual inspection

Every page was rendered with:

```bash
pdftoppm -r 120 -png paper/nabu-evidence.pdf paper/.build/final
```

All 12 pages were inspected as images. A crowded layer table, overlapping chart labels, and unbroken source-file names were corrected during review. The final charts use readable horizontal comparisons, distinguish the model/policy series, label axes and assumptions, and include captions explaining synthetic data and error bars. Tables, equations, references, footers, and the anonymous notice are legible without overlaps or clipping. The final concrete pilot paragraph was re-rendered and inspected after its last edit.

The ignored review images are `paper/.build/final-01.png` through `paper/.build/final-12.png`. They are local QA intermediates, not part of the source deliverable.

## Claims checked

- Production evidence remains direct counts and a ledger, with unknown competence; the Beta estimators are explicitly research-only.
- Replay invariance states its actor, event-validation, pure-resolver, time, and legacy-record boundaries.
- Passive-event nonidentifiability is a counterexample under stated assumptions, not a universal prohibition on behavioral modeling.
- Prediction comparison uses identical observations/questions; whole-family and within-family splits are separate.
- Policy comparison keeps estimator, content, time costs, and budget fixed and uses common random numbers.
- Negative results, calibration failure, readiness coverage, fixed-seed variation, and budget reversals are retained.
- The one human pilot is proposed, not launched: 12-minute sessions and a 48-hour target in a 42–54-hour window are design choices, not measured optima.
- No author identity, affiliation, course grade, acceptance, linguistic benchmark, human learner benefit, or enterprise isolation has been fabricated.

This verification applies to the PDF checksum above. Rebuilding may change PDF metadata and its checksum; a changed manuscript or figure requires renewed visual inspection.
