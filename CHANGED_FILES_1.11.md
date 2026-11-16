# Nabu 1.11.0 - exact file comparison

Compared with uploaded nabu-local-1.10.0.zip (SHA-256 `ead479912ae6a7b7260346088014a83ddc84391d0aab170f9876579e8583c309`).

This is a local archive comparison, not a Git commit or remote deployment.
Runtime requirements, package dependencies and the extension permission set were not expanded.
Private configuration, databases, caches, virtual environments and font files are excluded.
SHA256SUMS.json is regenerated for the release; this comparison document is new.

39 modified files; 161 added files (including test output).

## Application, build, assets and configuration

| File | Change |
|---|---|
| `chrome-extension/manifest.json` | Modified |
| `chrome-extension/sidepanel.js` | Modified |
| `data/illustrations.json` | Added |
| `package.json` | Modified |
| `public/clipart/bank.svg` | Added |
| `public/nabu-app.js` | Modified |
| `public/nabu-core.js` | Modified |
| `public/nabu-illustrations.js` | Added |
| `public/nabu-media.js` | Modified |
| `public/nabu-reading-ui.js` | Added |
| `public/nabu-speech.js` | Modified |
| `public/nabu-sw.js` | Modified |
| `public/nabu-transliteration.js` | Added |
| `public/nabu-word-tools.js` | Modified |
| `public/nabu-workspace.css` | Added |
| `server.py` | Modified |
| `social.py` | Modified |
| `start_local.py` | Modified |
| `tools/build_media_catalogue.py` | Modified |
| `tools/build_standalone.py` | Modified |
| `tools/index.template.html` | Modified |

## Generated outputs and copied shared modules

| File | Change |
|---|---|
| `chrome-extension/nabu-media.js` | Modified |
| `chrome-extension/nabu-transliteration.js` | Added |
| `public/index.html` | Modified |
| `public/nabu-clipart.js` | Modified |

## Focused tests and updated harnesses

| File | Change |
|---|---|
| `tests/bank_browser.py` | Modified |
| `tests/extension_browser.py` | Modified |
| `tests/illustrations.test.mjs` | Added |
| `tests/local_release_browser.py` | Modified |
| `tests/meaning_tools_browser.py` | Added |
| `tests/media.test.mjs` | Modified |
| `tests/media_browser.py` | Modified |
| `tests/next_browser.py` | Modified |
| `tests/reading-ui.test.mjs` | Added |
| `tests/redesign_accessibility.py` | Added |
| `tests/redesign_browser.py` | Added |
| `tests/redesign_http.py` | Added |
| `tests/spatial_browser.py` | Modified |
| `tests/test_meaning_tools.py` | Added |
| `tests/transliteration.test.mjs` | Added |

## Documentation

| File | Change |
|---|---|
| `CHANGES.md` | Modified |
| `FEATURE_STATUS.md` | Modified |
| `HANDOFF.md` | Modified |
| `MEANING_TOOLS.md` | Added |
| `README.md` | Modified |
| `REDESIGN_REPORT.md` | Added |
| `RUN_NABU_1.11.md` | Added |
| `START_HERE.md` | Modified |
| `THIRD_PARTY_MEDIA.md` | Modified |

## Verification evidence and screenshots

| File | Change |
|---|---|
| `bank-test-results/01-word-bank-desktop.png` | Added |
| `bank-test-results/02-natural-literal-desktop.png` | Added |
| `bank-test-results/03-natural-literal-mobile.png` | Added |
| `bank-test-results/04-phrase-breakdown-desktop.png` | Added |
| `bank-test-results/05-context-reader-desktop.png` | Added |
| `bank-test-results/06-context-reader-mobile.png` | Added |
| `bank-test-results/07-library-desktop.png` | Added |
| `bank-test-results/08-review-desktop.png` | Added |
| `bank-test-results/09-offline-queue-desktop.png` | Added |
| `bank-test-results/10-shared-collection-desktop.png` | Added |
| `bank-test-results/11-friends-desktop.png` | Added |
| `bank-test-results/12-friends-mobile.png` | Added |
| `bank-test-results/results.json` | Added |
| `mobile-test-results/short-word-link-desktop.png` | Modified |
| `mobile-test-results/short-word-link-mobile.png` | Modified |
| `next-test-results/01-rich-phrase-desktop.png` | Added |
| `next-test-results/02-reader-desktop.png` | Added |
| `next-test-results/03-reader-mobile.png` | Added |
| `next-test-results/04-review-desktop.png` | Added |
| `next-test-results/05-collaboration-desktop.png` | Added |
| `next-test-results/06-friends-desktop.png` | Added |
| `next-test-results/07-friends-mobile.png` | Added |
| `next-test-results/results.json` | Added |
| `startup-test-results/bundle-browser-results.json` | Added |
| `startup-test-results/fixed-desktop.png` | Added |
| `startup-test-results/fixed-mobile.png` | Added |
| `startup-test-results/storage-error-desktop.png` | Added |
| `verification/careful-media/extension-browser-results.json` | Modified |
| `verification/careful-media/extension-panel.png` | Modified |
| `verification/careful-media/extension-source-in-words.png` | Modified |
| `verification/careful-media/words-context-desktop.png` | Modified |
| `verification/careful-media/words-context-mobile.png` | Modified |
| `verification/local/memory-desktop.png` | Modified |
| `verification/meaning-tools/arabic-context-desktop.png` | Added |
| `verification/meaning-tools/arabic-context-phone-200.png` | Added |
| `verification/meaning-tools/arabic-context-phone.png` | Added |
| `verification/meaning-tools/arabic-reader-phone.png` | Added |
| `verification/meaning-tools/bank-financial-desktop.png` | Added |
| `verification/meaning-tools/bank-river-no-image.png` | Added |
| `verification/meaning-tools/baseline-js.txt` | Added |
| `verification/meaning-tools/baseline-redesign.json` | Added |
| `verification/meaning-tools/browser-log.txt` | Added |
| `verification/meaning-tools/browser-results.json` | Added |
| `verification/meaning-tools/build.txt` | Added |
| `verification/meaning-tools/final-accessibility.txt` | Added |
| `verification/meaning-tools/final-driver.txt` | Added |
| `verification/meaning-tools/final-existing-ui.txt` | Added |
| `verification/meaning-tools/final-extension-options.txt` | Added |
| `verification/meaning-tools/final-extension-ui.txt` | Added |
| `verification/meaning-tools/final-http.txt` | Added |
| `verification/meaning-tools/final-js.txt` | Added |
| `verification/meaning-tools/final-local-release-ui.txt` | Added |
| `verification/meaning-tools/final-meaning-ui.txt` | Added |
| `verification/meaning-tools/final-media-ui.txt` | Added |
| `verification/meaning-tools/final-python.txt` | Added |
| `verification/meaning-tools/final-redesign-ui.txt` | Added |
| `verification/meaning-tools/final-spatial-ui.txt` | Added |
| `verification/meaning-tools/final-suites.json` | Added |
| `verification/meaning-tools/final-syntax.json` | Added |
| `verification/meaning-tools/focused-api.txt` | Added |
| `verification/meaning-tools/focused-js.txt` | Added |
| `verification/meaning-tools/iteration-js.txt` | Added |
| `verification/meaning-tools/japanese-user-reading-desktop.png` | Added |
| `verification/meaning-tools/media-ui.txt` | Added |
| `verification/meaning-tools/post-polish-media-ui.txt` | Added |
| `verification/meaning-tools/post-polish-startup-ui.txt` | Added |
| `verification/meaning-tools/reader-water-desktop.png` | Added |
| `verification/meaning-tools/summary.json` | Added |
| `verification/meaning-tools/syntax.json` | Added |
| `verification/meaning-tools/water-context-desktop.png` | Added |
| `verification/redesign/accessibility-results.json` | Added |
| `verification/redesign/accessibility.txt` | Added |
| `verification/redesign/baseline-context.png` | Added |
| `verification/redesign/baseline-harness.json` | Added |
| `verification/redesign/baseline-js.txt` | Added |
| `verification/redesign/baseline-native.json` | Added |
| `verification/redesign/baseline-pids.json` | Added |
| `verification/redesign/baseline-python.txt` | Added |
| `verification/redesign/baseline-read-mobile.png` | Added |
| `verification/redesign/baseline-read.png` | Added |
| `verification/redesign/baseline-server.txt` | Added |
| `verification/redesign/baseline-words.png` | Added |
| `verification/redesign/build.txt` | Added |
| `verification/redesign/cold-launch.txt` | Added |
| `verification/redesign/existing-ui.txt` | Added |
| `verification/redesign/final-accessibility.txt` | Added |
| `verification/redesign/final-build.txt` | Added |
| `verification/redesign/final-driver.txt` | Added |
| `verification/redesign/final-existing-ui.txt` | Added |
| `verification/redesign/final-extension-options.txt` | Added |
| `verification/redesign/final-extension-ui.txt` | Added |
| `verification/redesign/final-http.txt` | Added |
| `verification/redesign/final-js.txt` | Added |
| `verification/redesign/final-local-ui.txt` | Added |
| `verification/redesign/final-media-ui.txt` | Added |
| `verification/redesign/final-python.txt` | Added |
| `verification/redesign/final-redesign-ui.txt` | Added |
| `verification/redesign/final-spatial-ui.txt` | Added |
| `verification/redesign/final-suites.json` | Added |
| `verification/redesign/http-results.json` | Added |
| `verification/redesign/http-server.txt` | Added |
| `verification/redesign/installed-launch-no-index.txt` | Added |
| `verification/redesign/installed-launch.txt` | Added |
| `verification/redesign/iteration-1.json` | Added |
| `verification/redesign/iteration1-js.txt` | Added |
| `verification/redesign/iteration2-js.txt` | Added |
| `verification/redesign/js-final.txt` | Added |
| `verification/redesign/library-desktop.png` | Added |
| `verification/redesign/library-phone.png` | Added |
| `verification/redesign/local-ui.txt` | Added |
| `verification/redesign/media-ui.txt` | Added |
| `verification/redesign/overflow-diagnostic.json` | Added |
| `verification/redesign/python-final.txt` | Added |
| `verification/redesign/read-200-percent.png` | Added |
| `verification/redesign/read-arabic-desktop.png` | Added |
| `verification/redesign/read-arabic-phone.png` | Added |
| `verification/redesign/read-empty-desktop.png` | Added |
| `verification/redesign/read-loading.png` | Added |
| `verification/redesign/read-long-phone.png` | Added |
| `verification/redesign/read-phone-200-percent.png` | Added |
| `verification/redesign/read-phone.png` | Added |
| `verification/redesign/read-save-error.png` | Added |
| `verification/redesign/read-tablet.png` | Added |
| `verification/redesign/read-unavailable.png` | Added |
| `verification/redesign/read-word-desktop.png` | Added |
| `verification/redesign/read-word-phone.png` | Added |
| `verification/redesign/reader-desktop.png` | Added |
| `verification/redesign/reader-empty.png` | Added |
| `verification/redesign/reader-mobile.png` | Added |
| `verification/redesign/reader-saved-desktop.png` | Added |
| `verification/redesign/reader-word-desktop.png` | Added |
| `verification/redesign/reader-word-mobile.png` | Added |
| `verification/redesign/redesign-browser.json` | Added |
| `verification/redesign/redesign-ui.txt` | Added |
| `verification/redesign/settings-desktop.png` | Added |
| `verification/redesign/spatial-ui.txt` | Added |
| `verification/redesign/suite-pids.json` | Added |
| `verification/redesign/syntax.json` | Added |
| `verification/redesign/translate-desktop.png` | Added |
| `verification/redesign/words-desktop.png` | Added |
| `verification/redesign/words-final-desktop.png` | Added |
| `verification/redesign/words-final-phone.png` | Added |
| `verification/redesign/words-selected.png` | Added |
| `verification/redesign/zoom-overflow.json` | Added |
| `verification/redesign/zoom-overflow.png` | Added |
| `verification/spatial/nabu-2d-desktop.png` | Added |
| `verification/spatial/nabu-2d-mobile.png` | Added |
| `verification/spatial/nabu-3d-desktop.png` | Added |
| `verification/spatial/results.json` | Added |
| `verification/spatial/russian-expression-2d.png` | Added |
| `verification/spatial/russian-expression-3d.png` | Added |

## Omitted original files

No original application files were removed.
