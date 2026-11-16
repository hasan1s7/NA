# Nabu 1.13.0 — implementation report

## What changed

Nabu 1.13.0 adds a bounded structural-ambiguity layer to the existing 1.12.2 reader. For an authored ambiguity case, the word-support panel can open a **Structure lens** that keeps two plausible analyses visible, aggregates diagnostic evidence, recommends the next unused diagnostic by expected information gain, and permits explicitly inconclusive evidence.

The implementation is intentionally conservative. It does not parse arbitrary sentences, call an LLM, or convert structural evidence into learner mastery. The first authored cases are English, Spanish and Arabic PP-attachment examples. Their likelihoods are explanatory/heuristic weights for the research prototype, not calibrated linguistic probabilities.

## Main implementation

- `public/nabu-syntax.js`
  - exact authored case matching;
  - candidate structural analyses;
  - reliability-weighted Bayesian evidence aggregation;
  - posterior entropy;
  - mutual-information diagnostic scoring;
  - active next-diagnostic selection;
  - uncertainty labels.
- `public/nabu-app.js`
  - Structure-lens rendering in the existing reader support panel;
  - movement/substitution/coordination interactions;
  - diagnostic history kept in tab-local reader state;
  - no card/review mutations;
  - 1.13 sample sentence.
- `public/nabu-workspace.css`
  - responsive desktop/mobile lens UI.
- `tools/build_standalone.py`
  - embeds the syntax module in the self-contained CSP-hashed release.

## Verification completed

- JavaScript suite: 410/410 passing.
- Focused backend/release pytest subset: 60/60 passing.
- Real loopback route/restart regression: passing.
- Explore/account/progress loopback regression: passing.
- Focused Structure-lens Chromium test: 7/7 checks passing.
- Desktop and phone screenshots are included under `verification/syntax-1.13.0/`.

The complete Python suite was started but is substantially longer than the release-focused checks; the release evidence above is the completed verification claimed for 1.13.0.

## Safety / inference boundary

The new percentages are labeled **relative support** and explicitly state that they are not calibrated parse probabilities. An unsupported sentence receives no Structure lens. An inconclusive diagnostic is allowed to remain inconclusive. Running diagnostics never creates learning evidence, changes SM-2-inspired schedules, or claims educational efficacy.
