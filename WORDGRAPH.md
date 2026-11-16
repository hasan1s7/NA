# Word and phrase graph

The current additive query layer is documented in [NABU_GRAPH_FOUNDATION.md](NABU_GRAPH_FOUNDATION.md). It preserves typed forms, authored alignments, usage occurrences, complete factor roles and source witnesses. The legacy bank/translation API described below remains available. Its expanded `exportGraph()` is a compatibility projection, not an independently validated linguistic graph or a learner model.

Version: nabu-bank-20261105-r3.

## Structure

1,026 authored alignment records: 900 word entries, 90 common phrases, 36
source-language expressions. Each has a primary term slot in each of 12
languages: 12,312 slots and 135,432 ordered distinct-language translation
directions. Slots are not unique surfaces or validated language-specific senses.
Topic links connect catalogue groups; their connectivity does not establish
linguistic correctness, prerequisites, learner knowledge or task usefulness.

The runtime already stores these groups compactly. Calling `exportGraph()`
explicitly expands pairwise translation and category links. Its legacy target
nodes retain listed idiom wording even where `translation()` returns a plain
meaning. The new query adapter traces the actual translation role in all
directions without silently changing that public export contract.

The canonical sources are `data/wordgraph-source.json` and `data/phrasebank-source.json`. New content is reproducibly merged from `data/expansion/*`; edit those inputs and run `npm run build`. All original IDs are preserved. There are three source expressions per language. See `docs/BANK_CONTENT_REVIEW.md` for semantic and editorial limits.

## Natural versus literal

For a source-language idiom, `terms` holds its original wording, `meaningTerms`
holds a plain-language meaning in every language, and `literalTerms` renders
its original imagery in every language. `origin` identifies the supplied expression
language, not its historical origin, and usage notes explain tone or limitations.

Example: English "It's a piece of cake." has the Spanish natural meaning
"Es muy facil." (with the appropriate written accent in the actual data) and
the separate literal rendering "Es un trozo de pastel." The saved learning
card uses the natural meaning, not an incorrect claim about food.

Selecting a non-origin plain meaning does not pretend that it is a local idiom
or fabricate its literal translation. The original idiom can be selected to
inspect literal wording. The implementation includes 396 source-expression
source-to-other-language literal results.

Everyday phrases have natural forms in all 12 languages and authored English
wording guides. The new **Break it down** panel can localize that guide into the
chosen target language through an explicit configured DeepL request. The English
source guide is labeled, not silently presented as a target-language translation.
Non-English ordinary-phrase guides are therefore not fully available offline.
Original-idiom literal renderings are built in instead.

All 126 phrase/expression entries now also contain usage guidance, provenance,
language-specific examples and possible replies. These are authored drafts.
A wording guide is not a full grammatical parse or a context-free promise that
an idiom can be translated word for word.

## Original expressions

English: piece of cake; Spanish: being in the clouds; French: giving one's
tongue to the cat; Arabic: one hand cannot clap; Chinese: one arrow, two eagles;
Russian: neither down nor feather; German: understanding only the station;
Italian: into the wolf's mouth; Japanese: borrowing even a cat's paw;
Korean: eating cold porridge; Portuguese: a flea behind the ear;
Turkish: skirts ringing. Exact spellings, meanings and usage notes are in data.

## Quality and limits

This is an authored starter bank, not a native-reviewed linguistic resource.
Phrase register, regional usage, pronouns, gender, morphology and context may
need refinement. Tests prove completeness, lookup behavior, graph connectivity
and UI separation; they do not certify translation quality.

Normalization supports case, spacing and common curly apostrophes. Ambiguous
forms expose a sense choice rather than silently deciding. Unknown text does
not become a fabricated built-in translation: configured providers or manual
entry are still needed. This graph is not an unrestricted sentence translator.

Autosave runs after an explicit translation or meaning selection. Looking up a
known sense preserves the existing card and schedule, with no duplicate creation.
New saves enter Reference by default, with one-click Learning promotion and an
optional automatic-Learning setting. Existing cards retain their state and schedule.
Signed-in saves first enter that account's device queue, then its server database.
Visible status distinguishes local persistence from confirmed sync. Guest saves
remain separate on device.
