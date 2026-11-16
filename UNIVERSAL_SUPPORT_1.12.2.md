# Nabu 1.12.2 — universal word + phrase support

This patch keeps the 1.12 Explore MVP and adds one consistent reading behavior across all 12 languages already present in Nabu's offline graph: English, Spanish, French, Arabic, Simplified Chinese, Russian, German, Italian, Japanese, Korean, Portuguese, and Turkish.

## Default learner experience

1. Read normally.
2. Tap any segmented word/term for one short meaning in the current target language.
3. When Nabu already knows a checked multiword phrase or expression containing that word, the support panel shows up to three **Also in this passage** phrase chips.
4. Tap a phrase chip to see its short meaning in the same panel.
5. Open **Read more** only for reading aid, usage, literal wording, examples, notes, or other secondary information.
6. Save only when useful. Unknown or ambiguous material remains explicitly unresolved; Nabu does not fabricate an explanation.

Phrase discovery is graph-based exact meaning lookup around the selected token, not a morphology engine and not unrestricted sentence parsing. It respects punctuation boundaries and prefers longer known expressions. The existing manual phrase selection remains available for material outside the graph.

## Coverage and evidence

- The offline graph remains the source of truth for meanings and phrase/expression identities.
- Focused tests cover every one of the 12 supported languages using the same phrase contract.
- Existing authored Explore annotations still take priority for their exact occurrence and meaning.
- No provider, API key, paid service, schema migration, or automatic mastery update was added.

## Files changed for this patch

- `public/nabu-reading-ui.js` — phrase discovery around a selected token.
- `public/nabu-app.js` — compact type label, phrase chips, phrase action, `Read more` disclosure.
- `public/nabu-workspace.css` — restrained responsive phrase-chip styling.
- `tests/universal-support.test.mjs` — 12-language and boundary tests.
- Release metadata/build IDs/tests — version 1.12.2.
