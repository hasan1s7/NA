# Nabu development requirements

- A learner-facing feature must work across every supported language. Do not ship a subset of languages as the completed feature.
- Use the language registry in `public/nabu-core.js` as the coverage contract. A language selector alone is not coverage: examples, help, saving, practice and return flows introduced by the feature must work in every registered language.
- Add meaningful coverage checks against that registry so adding a supported language exposes missing feature paths.
- Preserve existing private data, event identities and versioned evidence. Never invent learner success, retroactively change assistance, or substitute an unrelated-language exercise.
