# Nabu 1.16 verification

Verified on 15 November 2026 in a Linux execution environment. This report distinguishes executed tests from unverified platforms. Earlier reports and screenshots in the source archive are historical.

## Inspection and baseline

The supplied archive was inspected before editing. No AGENTS.md repository guidance was present. The application is vanilla JavaScript/CSS bundled into a CSP-hashed HTML file, with FastAPI, SQLite, IndexedDB/account sync and existing Python, shell and Windows launchers. Documentation, the language/card models, source-context helpers, speech/translation adapters, build scripts and existing tests were read. The archive contained no private `.env.local` or user database.

Baseline: **855 JavaScript tests and 483 Python tests passed**. The baseline launcher started the API. Native Chromium UI inspection was attempted but blocked by the environment's Unix-socket restriction; a separate cloud browser could not reach its loopback server. The working functionality was subsequently exercised through shipping-bundle DOM fixtures and real HTTP/database tests, not inferred solely from documentation.

## Final results

| Check | Actual result | Evidence |
| --- | --- | --- |
| JavaScript domain suite | **859 passed, 0 failed** | `verification/1.16/node-final.log` |
| All DOM acceptance suites | **81 passed, 0 failed** | `verification/1.16/dom-final.log` |
| Full Python suite, original pinned production dependencies | **485 passed, 0 failed**, one upstream deprecation warning | `verification/1.16/python-final.log` |
| Full application rebuild | **Passed**, 1,026 meanings / 12,312 forms; CSP-hashed standalone bundle regenerated | `verification/1.16/build.log` |
| Public JS syntax checks | **42 files passed** | `verification/1.16/syntax.log` |
| Actual Linux launcher/HTTP/restart/backup smoke | **14 checks passed** | `verification/1.16/launcher-pinned.log` |
| Normal launcher bootstrap/configuration path | **Passed** through `bash start-local.sh --check`, using the prepared environment with unchanged dependencies | `verification/1.16/launcher-bootstrap.log` |
| `.command` shell execution | **Passed on Linux**, not a macOS native test | `verification/1.16/launcher-command.log` |
| Optional mobile web bundle preparation | **Passed**, offline development bundle | `verification/1.16/mobile-build.log` |
| Declared new palette contrast | Six checked text/background pairs range from **5.98:1 to 12.30:1** | `verification/1.16/palette-contrast.json` |

The project defines no lint command; all public JavaScript received syntax checks, followed by the build and behavioral suites.

## Behavior covered

The new shipping-bundle acceptance tests execute the real compiled JavaScript and event handlers. Explicit in-memory IndexedDB transaction, transport, matchMedia and audio-event fixtures cover:

- Default at-a-glance mode; remembered depth preference; no unsolicited explanation during ordinary reading.
- Unchanged reader DOM, selection, scroll value, media element/time and question draft while switching modes.
- Actual saved correction/note/reading-aid records and reconstruction in a fresh app instance from the saved fixture state; the original text and saved indicator return.
- A pending save surviving mode changes; duplicate submissions blocked; failed save followed by successful retry.
- A late lookup success or failure unable to replace a newer selection, plus a failed lookup followed by retry.
- Council request language/translation/question payloads, pending mode changes, truthful missing-provider errors and late-reply rejection.
- Mobile-sheet control paths, close/return behavior, real button semantics and hidden-avatar flow.
- All twelve language codes: English, Arabic, Chinese (zh-CN), French, Russian, Spanish, Turkish, German, Korean, Japanese, Italian and Portuguese; RTL/script attributes and relevant two-person council rosters.
- Phrase ranges and exact repeated-word highlighting; source text is unchanged.
- Local media selection, preserved element/time across modes, pronunciation/source-audio mutual exclusion, recoverable audio failure and remembered file-time metadata.

Existing suites additionally cover account/sync isolation, correction/revision rules, translation memory, speech failure/race handling, transliteration, content progress, graph/structure/learner evidence, review scheduling and backups. Real HTTP smoke tests use actual cookies and SQLite; they verify saved accounts/cards/reviews across a server restart, isolated accounts, private-note boundaries, backup/restore and recovery.

The launcher files `Start-Nabu.cmd`, `Start-Nabu.command` and `start-local.sh` are byte-for-byte preserved from the supplied archive. POSIX executable bits are retained in the ZIP. The language/core module and production requirements are also byte-for-byte unchanged. Only the launcher's Python release banner changed. There is no new migration or runtime dependency.

## Limits that remain

| Area | Verification boundary |
| --- | --- |
| Desktop/mobile visual layout, zoom, focus ring rendering and physical keyboard navigation | Responsive CSS and DOM wiring are implemented. Native Chromium was blocked; visual reflow and real input rendering were **not verified**. |
| Reduced motion | Explicit CSS disables avatar animation/transforms in reduced-motion mode; actual browser preference rendering was **not verified**. |
| Screen readers and physical touch devices | Accessible names, native controls, source language/direction and status text are present; no screen-reader or physical-device certification. |
| Browser disk persistence and service-worker upgrade | Fresh-instance persistence tested with the explicit storage fixture; account durability tested with real SQLite restart. Real IndexedDB disk durability and installed-PWA upgrades were **not verified** here. |
| Windows/macOS | Launcher source/permissions preserved; Windows CMD and macOS Finder/Gatekeeper behavior **not executed**. Linux shell/HTTP behavior was executed. |
| iOS/Android | Offline web bundle built; no native compilation, signing or device run. |
| Speech and codecs | Playback/control/error events tested using fixtures. No audible device speech, live ElevenLabs generation or real media codec test. |
| DeepL and other authorized services | Existing adapters and failure behavior tested; no live credentialed provider calls. |
| Council | No conversational AI provider/credential exists in the input app. Missing-dependency behavior works; **live dialogue is unavailable**, and no canned conversation is shown as analysis. |
| Content expertise | Offline bank/editorial material remains unverified draft evidence where originally labeled; no native-speaker review or universal contextual parser is claimed. |

No deployment, external publishing, Git push or paid provider call was performed. Detailed environmental browser errors are recorded in `verification/1.16/browser-limitations.txt`.
