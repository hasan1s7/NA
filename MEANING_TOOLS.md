# Nabu 1.11.0: illustrations and reading aids

Implemented in the existing FastAPI/SQLite + JavaScript application. No schema
migration, new runtime dependency, paid provider, credentials or deployment.
This is a bounded vertical slice, not universal illustration or pronunciation.

## What is complete in this slice

The reader, `/words` and saved-card context editor use five local illustrations
and one versioned reading module. A learner can choose a sense-appropriate image,
remove it, mark it incorrect, explicitly restore it, edit a reading, save and
retrieve those choices from the same account library. Invalid/missing images
never prevent use of the word panel. Failed saves retain inputs and can be retried.
No image-selection or transliteration operation sends content to an outside service.
Existing consented translation/audio services are unchanged.

The extension's existing Show transliteration action now uses byte-identical
reading/media source files. Editing its selected word or source language hides
stale readings. Capture/account permissions are unchanged; this does not install
or publish the extension and does not add the web illustration editor to it.

## Illustration style specification

Style ID: `nabu-openmoji-1` (defined in `nabu-illustrations.js`). One identifiable
subject with the original consistent OpenMoji rounded dark outlines and palette,
transparent background, no added labels, no busy scenery. Display at 56-96 pixels
inside a quiet warm-neutral frame, subordinate to meaning and source content.
Preserve original artwork; use a new reviewed style ID before adding a generated
catalogue rather than mixing unrelated visual styles silently.

The interface retains Nabu's existing ziggurat, cream/green identity and redesigned
spacing. Assets are not Wispr branding or artwork.

### Initial concept catalogue

| Asset | Bound meaning ID | Scope |
|---|---|---|
| Water droplet | `food.water` | Water as a substance. |
| Open book | `work.book` | Printed reading material, not a booking. |
| House | `home.house` | Physical house. |
| Sun | `nature.sun` | The sun/star, not every metaphor containing sun. |
| Financial bank | `city.bank` | Financial institution; never the river edge. |

Known concepts only offer matching assets. The same concept in Arabic, English
or other supported languages reuses the same file. A manual word without a
concept can explicitly choose a clearly labeled image, but it is marked as a
learner choice, not a verified automatic match. No spelling/substring heuristic
assigns an image. No image is the default, and an asset must be explicitly chosen.

The bank does not contain a river-bank translation or asset in this slice. The
UI demonstration uses the actual pasted QA sentence "We sat on the bank of the
river." and a **manually entered** meaning. The financial image is not inherited.
These are authored test inputs, not observations from a real learner study.

For expressions, requests distinguish `depiction: intended` from `literal`.
The selector rejects a literal-only image as a recommendation for an idiom's
intended meaning. There are currently **no bundled idiom illustrations**; for
"break the ice" the image remains absent. Usage/literal examples from the original
bank stay labeled draft content and are not the learner's source sentence.

### Data and reuse

`data/illustrations.json` stores id, concept IDs, sense, alt text, style version,
depiction, source, author, license and license URL, original Git blob hash, SHA-256,
modification status, and generation metadata (`null` for these bundled originals).
The build verifies each asset against its recorded hashes and checks SVG contents.
The generated `nabu-clipart.js` embeds the exact bytes: no image host or credentials.

Cards store the existing `imageId`; `imageDismissed` is a new optional validated
list within existing card JSON, not a new database table. Incorrect-image feedback
is private per card/account. Choosing an image again clears only its own flag.
No global moderation dashboard or semantic learning from flags was implemented.
Saved card metadata and readings survive sync and library JSON backup/import.
Private correction/feedback fields are excluded from the existing public-card
allowlist used for sharing; the full server database backup preserves everything.

`imageFigure()` refuses known sense mismatches and missing or rejected assets.
An actual decode failure hides the broken image, keeps the word usable and exposes
Retry image, which reloads the real catalogue source. Alt text describes the
visible concept; status includes words, not color alone.

### Future provider adapter: interface, not a live service

`createIllustrationService()` accepts an optional adapter with `id` and
`generate(request)`. The request contains selected text, source/target languages,
selected contextual meaning, original source sentence, concept/sense, expression
kind, depiction and style version. It reuses the local catalogue first. Adapter
calls require matching provider authorization and explicit source-content consent.
No authorized adapter is installed in this release; no Generate button is shown.
No request is sent and no generated output is fabricated.

Requests for the same concept/style/depiction coalesce; successful reviewed assets
can be reused across languages within the configured service scope. Failures are
not cached and are retryable. Clearing scope invalidates late results; the
selection controller ignores stale responses. Provider tests use injected TEST
adapters only. In-memory provider cache is not durable generation storage.

A real future integration still needs an authorized **server-side** provider,
credentials, reviewed/license-compatible assets saved in trusted local storage,
access control, durable job records/cache and operational validation. Secrets do
not belong in this frontend module. No claim of completed image generation,
universal concept coverage or perfect contextual disambiguation is made.

## Reading layer

`transliterate({text, sourceLanguage, sourceScript, targetScript, scheme,
dictionaryReading})` returns the unchanged normalized input, script/scheme,
output, availability, status, method, warning and partial flag. Supported output
script is Latin (`Latn`). Unsupported languages, script/scheme mismatches or
missing reliable data return `unavailable`, not a guessed conversion.

| Languages | Scheme | Implemented behavior / limit |
|---|---|---|
| Russian | `nabu-ru-letters-v1` | Deterministic letters/digraphs, case, written accents, soft/hard signs. No inferred stress or reduced vowels. Unsupported letters remain with a warning. |
| Arabic | `nabu-ar-written-v1` | Written letters/diacritics, shadda order, common written long-vowel sequences, tanwin support alif. Always approximate; no inserted missing short vowels or dialect guesses. Unmapped marks remain visible. |
| Korean | `nabu-ko-syllables-v1` | Composed/decomposed Hangul syllables, punctuation and mixed text. Approximate, not full official Revised Romanization; no cross-syllable sound changes or Hanja readings. |
| Japanese kana | `nabu-ja-kana-v1` | Bounded Hiragana/Katakana, common digraphs, gemination, long mark, syllabic-n separation and half-width normalization. Spelling aid, not phonetic reading; particles retain written spelling. |
| Japanese kanji | verified exact whole-word adapter or manual | No per-character Chinese conversion or fixed kanji reading. No new Japanese word dictionary bundled. |
| Simplified Chinese | `verified-word-reading-v1` or manual | No automatic Pinyin service or dictionary bundled. Legacy generic character romanization is not presented as a checked reading. |
| English, Spanish, French, German, Italian, Portuguese, Turkish | `original-latin-v1` | Preserve original spelling, diacritics, capitalization and punctuation. This is not a pronunciation guide. |

The Nabu versioned schemes do not claim ISO/ALA or other standards conformance.
Statuses distinguish rule-based, approximate, dictionary-derived, user-provided,
and unavailable. A supplied dictionary record must match the whole word, language
and target script, identify its source and be marked verified. No live dictionary
provider is enabled. Tests of that interface use clearly labeled TEST records.

Legacy generic fields remain in the bundled graph export/API for compatibility;
the redesigned app does not display them as trustworthy Chinese/Japanese readings.
Existing user-saved readings remain intact, even when automatic output is absent.

### Edits and persistence

`readingForCard()` gives saved readings first priority. Show/hide is local display
state. Use this draft reading requires confirmation before replacing a different
nonempty correction. Saving uses the existing `reading` and `readingMethod`
fields. An explicitly cleared reading uses a hidden marker so automatic output
does not silently return. The original word and source sentence are never rewritten
by transliteration. Reading help and images do not change mastery or review scores.

The context form keeps edits on failure and labels Retry save. It prevents duplicate
submissions; changes typed during a pending request remain unsaved and are described
as such after the earlier request succeeds. The normal account sync status separates
saved-on-device/pending from confirmed server saves. Offline durability still depends
on the user's actual browser and origin; fixture tests are not native-device proof.

## Reproduce focused checks

From the project folder, with the existing dev test dependencies installed:

```text
npm run test:meaning
```

Full checks and exact counts are in `REDESIGN_REPORT.md` and
`verification/meaning-tools/final-suites.json`. No lint command was configured in
the supplied project. Syntax, build/CSP and focused computed-contrast checks were
run instead of claiming an unconfigured linter passed.

Native browser navigation was blocked by the test environment. UI checks execute
the shipping DOM with explicit navigation, IndexedDB and transport fixtures and
actual FastAPI/SQLite. Fresh real HTTP/server-restart persistence is separately
verified. Native audio, installed extension permissions, hardware recordings,
Windows launcher execution and physical-device zoom remain local acceptance items.

## Source references and license obligations

Artwork: OpenMoji contributors, unmodified CC BY-SA 4.0 originals; retain creator,
source and license attribution, and comply with ShareAlike when adapting artwork.
See `THIRD_PARTY_MEDIA.md` and the source/license URLs in the manifest. This does
not relicense Nabu's own code and implies no endorsement. No fonts or model weights
are distributed. No new translation, speech or image provider bill is introduced.

For how to run and upgrade without resetting existing data, see RUN_NABU_1.11.md.
