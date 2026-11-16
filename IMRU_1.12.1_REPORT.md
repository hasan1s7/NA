# Nabu 1.12.1 - Imru' al-Qais content patch

## Scope

This patch keeps the Explore catalogue at six items and replaces the AI-written poem `a-place-for-light` with the opening six couplets of Imru' al-Qais's Mu'allaqa under the new stable item ID `imru-al-qais-stop-and-weep`. It does not add a seventh card or change the storage, review, account, progress, image, speech, or extension contracts.

The Arabic source text was checked against Arabic Wikisource (`معلقة امرئ القيس`). The underlying pre-Islamic poem is public domain. Nabu's English translation, contextual explanations, and activities are original AI-assisted editorial drafts and are explicitly marked not instructor-reviewed. No modern recording or third-party translation is bundled.

## Pedagogical slice

The excerpt opens with `قِفَا نَبْكِ` and preserves six source couplets with their diacritics and line breaks. The item is labeled `Pre-Islamic Classical Arabic` and `Advanced · classical`.

Four exact contextual annotations are anchored to the unchanged source:

- `قِفَا نَبْكِ` - dual address plus “let us weep”, explained as the nasib opening gesture.
- `لمْ يَعْفُ رَسْمُها` - the campsite trace has not been effaced; `رسم` is not treated as generic “drawing”.
- `غَدَاةَ البَيْنِ` - the morning of separation/departure; `البين` is not treated as spatial “between”.
- `لاَ تَهْلِكْ أَسَىً وَتَجَمَّلِ` - grief versus endurance/composure; `تجمل` is not glossed as merely “make yourself beautiful”.

Practice remains poetry-appropriate: contextual recognition, phrase recall, and a related-context interpretation. There is no forced conversational production task.

## Verification actually run

- `npm run build` - passed; catalogue validation reports 6 items and 24 annotations; standalone bundle/CSP rebuilt.
- `npm test` - 391/391 JavaScript tests passed after updating the release/service-worker build IDs.
- `python -m pytest -q tests/test_content_progress.py` - 14/14 passed.
- `python tests/explore_browser.py` - 77/77 checks passed, including exact source rendering and all four Imru' al-Qais annotations, mobile/RTL, save/retry, resume, adaptive support, and no uncaught page exceptions.
- `python tests/explore_http.py` - 23/23 real HTTP/SQLite/restart/backup checks passed and confirmed release version 1.12.1.

A full unrelated Python-suite rerun was attempted but exceeded the execution window after partial progress and is not claimed as a new full-suite pass. The focused content/backend tests above completed successfully. Historical 1.12.0 full-suite results remain historical evidence, not a substitute for this patch's runs.

## Files most directly changed

- `data/explore.json`
- `public/nabu-content-catalogue.js` (generated)
- `tests/content.test.mjs`
- release/build metadata (`package.json`, server/launcher/extension version, service-worker/build IDs)
- Explore documentation and release notes

See `CHANGED_FILES_1.12.1.md` for the exact archive comparison.

## Run

Windows: `py -3 start_local.py` or `Start-Nabu.cmd`.

Open `http://127.0.0.1:8000/explore` and choose **قِفَا نَبْكِ**.

Preserve `.env.local`, `.data`, `.venv`, backups, and browser data when upgrading. No deployment occurred.
