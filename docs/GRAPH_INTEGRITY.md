# Structural bridge and graph integrity

This is an additive, read-only interpretation layer over Nabu's existing bank and curated reader. It does not replace `nabu-graph.js`, rename existing concept IDs, change saved-card identities, or transfer learner evidence through graph relations.

## What the existing data supports

The bank contains 1,026 authored alignment entries: 900 word entries, 90 phrases, and 36 expressions. Each entry has terms in twelve languages. The generated 12,312 term slots and 135,432 directed translation links describe coverage of those alignment groups. They are not counts of independently validated lexemes, distinct forms, or translation judgments.

`nabu-structure.js` represents an existing concept as an **alignment** node. Forms have exact NFC surface identities scoped by language. A shared surface can participate in several alignment groups; sharing a surface does not merge those readings. Language-specific lexical sense and lexeme identities remain `null` because the current source does not supply them. The inherited POS label is exposed only as a legacy entry hint.

Actual bank examples and replies become authored usage nodes. The six curated reading items and their 24 annotations become media and usage nodes with exact versioned quote anchors. All 24 source annotation concept links are currently empty; the bridge does not invent a link by matching an English gloss. A source reference is preserved as attribution, not treated as independent proof of a translation or annotation.

All bank and annotation material remains labelled **authored-unreviewed**. The 300 legacy word records that omit an individual review status inherit the catalogue's `humanReviewed: false` declaration. A structural test pass does not upgrade this status.

## API

| Function | Behavior |
| --- | --- |
| `classifyKnownEntry(conceptId, language)` | Returns a language-specific surface, legacy alignment reference, provenance, draft/review status, and recommendation eligibility. Unknown IDs abstain. |
| `candidateEligibility(conceptId, sourceLang, targetLang)` | Adds language-pair checks and an authored translation-alignment reference. It never changes the legacy resolver. |
| `lookupGraphForms(text, language)` | Preserves all existing lookup candidates and reports ambiguity. A single match is not a claim of lexical exhaustiveness. |
| `structureSlice({conceptIds, languages, mediaRefs, includeUsages})` | Builds a bounded typed view. Media references require both `id` and integer `version`. The result reports unavailable lexeme, lexical-sense, and production-morphology capabilities. |
| `generatedCandidateEligibility(options)` | Gates a structural candidate using its declared quality and traceable provenance. It distinguishes authored drafts, dictionary-listed surfaces, supplied form attestations, generated forms, and quarantined source records. |
| `validatePatternApplication(record)` | Validates a complete application record, retaining inputs, outputs, features, provenance and competing analyses together. It does not verify grammaticality or productivity. |
| `groupEvidenceBySource(records)` | Groups shared source lineages. Sibling outputs are not counted as independent sources. Even distinct lineage labels do not establish statistical independence. |

Returned objects are detached copies. No function writes cards, logs, review schedules, content events, or database tables.

## Existing alignments requiring context

The source notes for `relatives.uncle` and `relatives.aunt` distinguish maternal and paternal family branches, but the existing alignment records combine branch-specific terms and aliases. For example, the current resolver maps the Arabic alias `خال` through `relatives.uncle` to Chinese `叔叔`, even though the record's own note distinguishes their branches.

These entries are flagged `context-required` for new automatic recommendations. Their legacy data and resolver behavior remain intact. This is a guard against unqualified substitution, not a claim that every term or every language pair in either entry is invalid. Other catalogue entries remain eligible only as clearly labelled authored drafts.

## External P073 record: quarantine scope and verification

A case-folded, Unicode-normalized search of 380 text files in the unchanged supplied source found no `P073`, `marcir` or `marciendo`. None is an existing bank entry. No active bank record was removed.

The separately supplied **Nabu Language Graph Workspace (1).pdf**, 515 pages, contains:

- Physical page 25: a pattern-table entry labelled `P073`, with system `past system`.
- Physical page 193: a displayed association between `marcir` and `P073` in the past-system column.
- Physical page 30: table header `change: expected>actual [cells affected]`, change cell `marciendo>attestation criteria [1 cells]`, with verbs `1`, independent base verbs `1`, and tier `stored`.

The exact change cell, extracted row text, column values, document, and page references are preserved in `data/graph-integrity.json`. Page 30 does not print a pattern ID beside this row; the cross-page association is explicitly marked unverified. The `attestation criteria` output may be nonlinguistic interface metadata. The registry quarantines that **external source/output record** pending upstream verification. The PDF alone does not establish a complete application join or which upstream parser or dataset produced it.

This quarantine does **not** assert that `marciendo` is invalid, that all P073 applications are invalid, or that a live Nabu record was removed. On 2026-11-13 the [RAE-ASALE DLE conjugation table for marcir](https://dle.rae.es/marcir) was checked and lists `marciendo` as its gerund; the [Larousse conjugation table](https://www.larousse.com/conjugaison/espagnol/marcir/2096678) also lists it. The registry records this separately as `dictionary-listed-gerund`.

Dictionary listing supports the surface form. It does not verify common usage, corpus frequency, contextual meaning, or the entire external P073 application. The adapter does not import a new user-facing bank entry or production morphology from this verification. Quarantine matching is source/record-specific; the surface is never globally blacklisted.

## Full applications and evidence boundaries

A pattern application must include an ID, pattern ID, language, review status, `fixtureOnly`, nonempty `inputs` and `outputs`, explicit feature objects for every complete form and the application, traceable source provenance, and an explicit `competingAnalyses` array. Alternatives must themselves contain full inputs, outputs, features and provenance. Bare suffix fragments do not pass validation.

The current release imports **zero production morphology applications**. Tests use clearly labelled fictional forms. Successful shape validation returns `linguisticCorrectness: "not-checked"`; it cannot make a generated form attested. A caller's `attested: true` boolean is insufficient. A supplied form-attestation record must identify the exact form and language, its source and lineage, a locator, and its declared verification status. The adapter reports that this is caller-supplied provenance rather than pretending to have fetched or independently checked it.

Several outputs or alternative analyses from one source lineage remain one provenance group. Generated variants, repeated strings, copied rows, and sibling suffixes do not become independent evidence merely because they have separate IDs. No graph relation, parser result, or pattern-validation result updates learner mastery.

## Build and compatibility

`data/graph-integrity.json` is the inspectable registry source. The standalone builder generates `public/nabu-structure-data.js` and embeds it with the structural adapter; no runtime network fetch or paid dependency is introduced. Existing graph/card APIs and persisted formats are unchanged. No database migration is required for this read-only bridge.

Focused tests are in `tests/structure.test.mjs`. They verify identity/ambiguity preservation, draft provenance, context gates, quote anchors, scoped quarantine, dictionary-versus-application boundaries, complete pattern records, and source-lineage grouping. Their results establish these implemented boundaries, not general linguistic correctness.
