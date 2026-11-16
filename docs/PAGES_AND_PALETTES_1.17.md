# Nabu 1.17 r3: Pages and colour templates

Build: `nabu-pages-1.17-20261116-r3`, November 16, 2026. Live: https://hasan1s7.github.io/NA/.

## What changed

The original forest green (#24624f) is the default, including first paint. Settings & data → Colour palette offers Original green, Lapis, Clay and Plum. The chosen template applies immediately and saves on this device, with truthful write-failure and retry states. Unknown saved values fall back safely. Existing learning data, twelve supported languages, integrations, model rules and launcher contents are preserved. No dependency upgrades or new provider services were introduced.

The complete source folders are uploaded directly to the public repository. The portable archive includes executable launcher metadata. GitHub web uploads store loose launchers without executable permission; use `bash start-local.sh` on macOS/Linux or `py -3 start_local.py` on Windows, or extract the portable ZIP.

## Publishing and rebuilding

The active GitHub Pages setting is **Deploy from a branch → main → / (root)**. `python3 tools/build_pages.py` rebuilds the standalone bundle and copies only allowlisted static entry files to the repository root. Commit changed modules in `public/` and the regenerated root entry files together. Do not edit generated root HTML by hand. Root `.nojekyll` keeps branch publishing static. The built-in Pages deployment succeeded (run 43925033945, following application deployment 43924843951).

The optional custom Actions workflow is manual only and has read-only repository-content access. It cannot write source to main. Its runner was blocked before any build/test step with GitHub's message, “The job was not started because your account is locked due to a billing issue” (run 43923976137). No billing changes were made. Those failed runs are not represented as CI test results. Built-in branch Pages succeeded and serves the application.

## Static hosting boundaries

Pages provides reading, offline-bank word help, guest vocabulary, notes, review, existing local tools, local media and palette preferences in the browser. It cannot run Python account, assignment, departmental reporting, synchronization or cloud-provider services. Settings identifies this boundary. The complete local launchers remain available for server features. No provider key is embedded. Keep/export local library data before changing origins or devices; Pages and localhost have separate browser stores.

## Actual verification

- `npm test`: 872 passed, 0 failed.
- `npm run test:dom`: 106 passed, 0 failed.
- `python tests/local_http_smoke.py`: 14 launcher/HTTP/SQLite/restart checks passed.
- Seven new palette checks are included in the JavaScript/DOM totals: validation, host classification, normal-text contrast, Pages startup without backend API probes, persistence, save failure/retry, corrupt preference recovery.
- Standalone and optional mobile web bundles rebuilt successfully; inline CSP hashes matched. The unchanged r2 backend suite previously had 522 passes; it was not rerun for this frontend update.
- Live deployed Chromium: default green verified; English→Spanish water→agua lookup saved and survived refresh; book→libro reader lookup retained the actual source sentence; saving and switching both modes retained state; private note, selection, reader text, saved state and In depth preference survived refresh.
- Live palette check: Plum applied and survived reload; Original green was restored with keyboard Enter, showed visible focus and a successful saved status, and survived reload.
- All twelve existing language options remain visible. Desktop page had no horizontal overflow at the tested 1363px viewport. Browser extension metadata errors appeared in the remote browser runtime; they did not interrupt the learner flow.

## Limits and next deployment work

No physical Windows, macOS, iOS or Android run is certified by this update. Mobile web fixtures are automated checks, not device certification. This live pass did not separately certify narrow viewport, RTL assistive technology, media time persistence, audible speech, live cloud providers or institutional endpoints; inherited verification remains in its original reports. The device reported no matching voice for the chosen example, which the app displayed honestly. Council generation remains unavailable without an authorized conversational provider. GitHub Pages is a local-browser learning deployment, not an institutional server deployment or a security certification.
