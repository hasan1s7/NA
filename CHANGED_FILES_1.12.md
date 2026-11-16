# Exact changes: Nabu 1.11.0 to 1.12.0

Compared byte-for-byte with the supplied source ZIP. SHA256SUMS.json and this report are release metadata; no private config, database, credentials, dependency folder or font files are distributed.

## Source, build output, tests and docs

| File | Change |
|---|---|
| `CHANGES.md` | modified |
| `CONTENT_AUTHORING.md` | added |
| `FEATURE_STATUS.md` | modified |
| `HANDOFF.md` | modified |
| `MVP_1.12_CONTROLS.md` | added |
| `MVP_1.12_LATER.md` | added |
| `MVP_1.12_REPORT.md` | added |
| `README.md` | modified |
| `RUN_NABU_1.12.md` | added |
| `START_HERE.md` | modified |
| `chrome-extension/manifest.json` | modified |
| `content_progress.py` | added |
| `data/explore.json` | added |
| `mobile-test-results/short-word-link-desktop.png` | modified |
| `mobile-test-results/short-word-link-mobile.png` | modified |
| `package.json` | modified |
| `public/index.html` | modified |
| `public/nabu-account-store.js` | modified |
| `public/nabu-app.js` | modified |
| `public/nabu-content-catalogue.js` | added |
| `public/nabu-content-store.js` | added |
| `public/nabu-content.js` | added |
| `public/nabu-explore-ui.js` | added |
| `public/nabu-explore.css` | added |
| `public/nabu-links.js` | modified |
| `public/nabu-reading-ui.js` | modified |
| `public/nabu-store.js` | modified |
| `public/nabu-sw.js` | modified |
| `server.py` | modified |
| `start_local.py` | modified |
| `tests/content-store.test.mjs` | added |
| `tests/content.test.mjs` | added |
| `tests/explore_browser.py` | added |
| `tests/explore_http.py` | added |
| `tests/redesign_http.py` | modified |
| `tests/sync.test.mjs` | modified |
| `tests/test_content_progress.py` | added |
| `tools/build_content.py` | added |
| `tools/build_standalone.py` | modified |

## Test evidence (historical results remain labeled)

- `bank-test-results/01-word-bank-desktop.png` (modified)
- `bank-test-results/02-natural-literal-desktop.png` (modified)
- `bank-test-results/03-natural-literal-mobile.png` (modified)
- `bank-test-results/04-phrase-breakdown-desktop.png` (modified)
- `bank-test-results/05-context-reader-desktop.png` (modified)
- `bank-test-results/07-library-desktop.png` (modified)
- `bank-test-results/08-review-desktop.png` (modified)
- `bank-test-results/09-offline-queue-desktop.png` (modified)
- `bank-test-results/10-shared-collection-desktop.png` (modified)
- `bank-test-results/11-friends-desktop.png` (modified)
- `bank-test-results/12-friends-mobile.png` (modified)
- `next-test-results/01-rich-phrase-desktop.png` (modified)
- `next-test-results/02-reader-desktop.png` (modified)
- `next-test-results/04-review-desktop.png` (modified)
- `next-test-results/05-collaboration-desktop.png` (modified)
- `next-test-results/06-friends-desktop.png` (modified)
- `next-test-results/07-friends-mobile.png` (modified)
- `startup-test-results/fixed-desktop.png` (modified)
- `startup-test-results/fixed-mobile.png` (modified)
- `verification/careful-media/extension-source-in-words.png` (modified)
- `verification/careful-media/words-context-desktop.png` (modified)
- `verification/careful-media/words-context-mobile.png` (modified)
- `verification/meaning-tools/arabic-context-desktop.png` (modified)
- `verification/meaning-tools/arabic-context-phone.png` (modified)
- `verification/meaning-tools/bank-financial-desktop.png` (modified)
- `verification/meaning-tools/bank-river-no-image.png` (modified)
- `verification/meaning-tools/japanese-user-reading-desktop.png` (modified)
- `verification/meaning-tools/reader-water-desktop.png` (modified)
- `verification/meaning-tools/water-context-desktop.png` (modified)
- `verification/mvp112/baseline/javascript.exit` (added)
- `verification/mvp112/baseline/javascript.txt` (added)
- `verification/mvp112/baseline/native-browser.json` (added)
- `verification/mvp112/baseline/python-rerun.exit` (added)
- `verification/mvp112/baseline/python-rerun.txt` (added)
- `verification/mvp112/baseline/python.txt` (added)
- `verification/mvp112/browser-results.json` (added)
- `verification/mvp112/browser-run.txt` (added)
- `verification/mvp112/explore-desktop.png` (added)
- `verification/mvp112/explore-initial.png` (added)
- `verification/mvp112/explore-phone.png` (added)
- `verification/mvp112/final/build.txt` (added)
- `verification/mvp112/final/content-js.txt` (added)
- `verification/mvp112/final/content-store.txt` (added)
- `verification/mvp112/final/explore-http-server.txt` (added)
- `verification/mvp112/final/explore-http.exit` (added)
- `verification/mvp112/final/explore-http.json` (added)
- `verification/mvp112/final/explore-http.txt` (added)
- `verification/mvp112/final/explore-ui.exit` (added)
- `verification/mvp112/final/explore-ui.txt` (added)
- `verification/mvp112/final/extension-options.exit` (added)
- `verification/mvp112/final/extension-options.txt` (added)
- `verification/mvp112/final/extension-ui.exit` (added)
- `verification/mvp112/final/extension-ui.txt` (added)
- `verification/mvp112/final/javascript.exit` (added)
- `verification/mvp112/final/javascript.txt` (added)
- `verification/mvp112/final/meaning.exit` (added)
- `verification/mvp112/final/meaning.txt` (added)
- `verification/mvp112/final/media-ui.exit` (added)
- `verification/mvp112/final/media-ui.txt` (added)
- `verification/mvp112/final/old-ui.exit` (added)
- `verification/mvp112/final/old-ui.txt` (added)
- `verification/mvp112/final/python.exit` (added)
- `verification/mvp112/final/python.txt` (added)
- `verification/mvp112/final/redesign.exit` (added)
- `verification/mvp112/final/redesign.txt` (added)
- `verification/mvp112/final/reflow-last.exit` (added)
- `verification/mvp112/final/reflow-last.txt` (added)
- `verification/mvp112/final/summary.json` (added)
- `verification/mvp112/final/syntax.json` (added)
- `verification/mvp112/http-initial-fixture-header-failure.txt` (added)
- `verification/mvp112/new-api.txt` (added)
- `verification/mvp112/new-js.txt` (added)
- `verification/mvp112/practice-desktop.png` (added)
- `verification/mvp112/practice-initial.png` (added)
- `verification/mvp112/reader-200-percent-css.png` (added)
- `verification/mvp112/reader-context-desktop.png` (added)
- `verification/mvp112/reader-context-phone-rtl.png` (added)
- `verification/mvp112/reader-initial.png` (added)
- `verification/mvp112/ui-sync-race-found.txt` (added)
- `verification/redesign/accessibility-results.json` (modified)
- `verification/redesign/http-server.txt` (modified)
- `verification/redesign/library-desktop.png` (modified)
- `verification/redesign/library-phone.png` (modified)
- `verification/redesign/read-200-percent.png` (modified)
- `verification/redesign/read-arabic-desktop.png` (modified)
- `verification/redesign/read-empty-desktop.png` (modified)
- `verification/redesign/read-loading.png` (modified)
- `verification/redesign/read-phone-200-percent.png` (modified)
- `verification/redesign/read-phone.png` (modified)
- `verification/redesign/read-save-error.png` (modified)
- `verification/redesign/read-tablet.png` (modified)
- `verification/redesign/read-unavailable.png` (modified)
- `verification/redesign/read-word-desktop.png` (modified)
- `verification/redesign/settings-desktop.png` (modified)
- `verification/redesign/translate-desktop.png` (modified)
- `verification/redesign/words-final-desktop.png` (modified)
- `verification/redesign/words-final-phone.png` (modified)
