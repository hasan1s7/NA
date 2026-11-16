# Adding content to Explore without editing application logic

The current six-item release combines five original, AI-assisted Arabic drafts with a sourced public-domain opening excerpt from Imru’ al-Qais. Nabu’s English translations, explanations and practice remain editorial drafts; they are not native-teacher reviewed or certified proficiency material. All editorial estimates and source statuses are explicit. This guide is for expanding that same supported text format, not a new audio/video pipeline.

## Files and build

Edit `data/explore.json`. `tools/build_content.py` creates `public/nabu-content-catalogue.js` and calls the actual JavaScript validation rules. `tools/build_standalone.py` embeds that module in the shipping HTML with exact CSP hashes. From the project folder:

```text
npm run build
node --test tests/content.test.mjs tests/content-store.test.mjs
python -m pytest -q tests/test_content_progress.py
python tests/explore_browser.py
```

Use the release's tests for the current six-item collection. Tests that assert the initial count must be updated deliberately when publishing additional items; do not weaken source-anchor or rights checks. No application function needs editing to add another valid Arabic/English text item.

## Add a new item

Copy a structurally complete item, assign a NEW stable lowercase/hyphen ID and `version: 1`, and replace all content, title/preview, creator, rights, editorial status, estimates, next-item relation and activities. The existing interest IDs are `feeling`, `story`, `useful`, `discover`. Genres are `poetry`, `story`, `dialogue`, `fact`; format is currently `text`. Keep register explicit. Never label original/generated text as a famous quotation or expert-reviewed content.

Segments have stable IDs, original `text`, natural `translation` and an optional `speaker`. Preserve original line breaks. Copyright/permission checks apply independently to text, edition, translation, illustrations and recordings. A new factual passage needs reputable source references. `sourceReferences` requires safe HTTPS URLs, titles and applicability notes; imported private URLs/credentials should not be inserted in the public catalogue.

## Exact annotations, not guessed dictionary meanings

An annotation contains an ID, segmentId, exact quote, `start` and `end`, prefix/suffix, contextual meaning and usage explanation. Offsets count Unicode scalar values (Python string indices / JavaScript `Array.from`), NOT UTF-8 bytes or UTF-16 units. Combining marks remain separate scalars; do not normalize the source after assigning anchors. The renderer converts to DOM UTF-16 offsets explicitly. The original unmodified source is retained.

For an occurrence in Python:

```python
start = segment_text.index(exact_quote)  # choose the intended occurrence explicitly
end = start + len(exact_quote)
prefix = segment_text[max(0, start - 16):start]
suffix = segment_text[end:end + 16]
```

A repeated word needs the intended occurrence's offset; first-match search is not adequate. Overlapping authored spans are currently rejected. Author a meaningful phrase as one span; unannotated tokens retain the existing word lookup/manual route. There is no claim of universal morphology or automatic contextual disambiguation.

`conceptId` can remain empty. Use a real existing concept ONLY when the sense is equivalent. No matching image is better than an unrelated one. A shared image never means shared mastery across languages.

## Practice

Each piece has two or three tasks with distinct IDs, an annotationId, mode, prompt, hint and actual explanation. Current modes: recognition, recall, related-context. Recognition/related-context use explicit options and a zero-based correct answer. Vary answer positions without relying on untested randomization. Use plausible distractors that reveal the distinction.

Recall uses `accepted` alternatives and `arabic-optional-vowels-v1`. This rule ignores optional short-vowel marks/tatweel, repeated spacing and final punctuation; it does not collapse hamza or different letters. Set prompts narrowly enough that the expected source form is fair (for example specify the feminine addressee). Do not reject equally valid broad semantic answers by pretending this exact-expression check is general language understanding. Use original finite expressions or a self-check design in future where semantic grading is ambiguous.

Hint/reveal is assistance. Skip is no correctness observation. Practice does not create review cards or rewrite schedules. The policy `content-support-v1` is deterministic and inspectable: after missed/assisted recall it offers recall again; after a matched unaided recall it suggests a related-context task; without recall evidence it starts from meaning. It is not a calibrated knowledge model or an optimized spacing algorithm. The existing scheduler is used only for separately opted-in vocabulary review.

## Source versions and publication discipline

Do not rewrite a published item under the same ID/version after users have saved it. Saved cards preserve the source excerpt/provenance and progress refers to the content version. 1.12's public navigation deliberately opens the initial version 1. Full multi-version publishing and migration are not implemented.

For this MVP, publish substantially revised material under a NEW stable item ID, retain old published items in the catalogue so their old events/anchors remain valid, and update appropriate next links. Do not delete old version records or reinterpret historical practice against different answer keys. A future version-aware archive needs explicit UI/API work; merely editing the version number is not sufficient in 1.12.

## Review checklist

Read the entire piece as content, not just a vocabulary carrier. Check a satisfying ending, register, grammar, translations, every occurrence, reasonable answer alternatives and actual explanation. Then verify card opening, all annotations, save/reopen, keyboard/RTL/mobile and missing voice/image paths in the running app. An AI author's self-check is not independent expert review; record an actual named reviewer only with their review and permission.

The original factual passage paraphrases USGS condensation/water-cycle and NASA water-cycle material; the catalogue records exact source links. No modern literary text, translation, photograph or recording was copied into these six originals. Existing OpenMoji license obligations remain in `THIRD_PARTY_MEDIA.md`.
