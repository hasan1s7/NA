# Nabu 1.13.0 — structure under uncertainty

Nabu 1.13 keeps the 1.12.2 media-first reading loop and adds a bounded **Structure lens** for authored ambiguity cases. It is an implementation of the research idea in *Auditable Syntax Under Intervention*: a sentence can have multiple plausible structures, and Nabu should expose what different diagnostics support instead of pretending one parse is certain.

## Learner experience

1. Read normally. Word and phrase support behaves exactly as in 1.12.2.
2. When the selected sentence matches an authored ambiguity case, the support panel exposes **Structure lens**.
3. The lens shows two plausible readings and their current **relative support**.
4. Nabu recommends the unused diagnostic with the highest expected information gain.
5. Run movement, substitution or coordination to see the transformed sentence, the observed interpretation and the diagnostic caveat.
6. A diagnostic may be explicitly **inconclusive**.
7. Structural evidence never updates cards, review schedules or learner mastery.

## What ships

- `public/nabu-syntax.js`: authored cases, Bayesian evidence aggregation, entropy and information-gain selection.
- English PP-attachment pilot: “The researcher photographed the student with the telescope.”
- Spanish pilot: “La investigadora fotografió al estudiante con el telescopio.”
- Arabic pilot: “صوّر الباحث الطالب بالمنظار.”
- Desktop and mobile Structure-lens UI integrated into the existing word-support panel.
- Focused unit and browser tests.

## Important boundary

This is **not an unrestricted parser**. Nabu only opens the Structure lens for reviewed/authored cases that explicitly declare candidate analyses and diagnostic outcome distributions. The displayed percentages are authored relative evidence weights used to demonstrate the inference mechanism; they are **not calibrated parse probabilities** and are not claimed as empirical linguistic estimates.

This keeps the existing Nabu rule intact: unknown or unsupported material remains unresolved rather than receiving an invented explanation.
