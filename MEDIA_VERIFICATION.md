# Nabu 1.10.0 - implementation and verification

## What was changed, and what was not

This is an update to the actual uploaded `nabu-local-1.9.0.zip`, not the earlier
standalone journey prototype and not an assumed GitHub checkout. Source SHA-256:

`66e2f715bf1e04ee1951412409e39c170e9fd4e8c9224d413be13b552f31a053`

The supplied archive did not contain the earlier demo's exact "Show meaning in
context" control. A working action and dialog were added to this application's
real `/words` screen, with the same tools available for saved library cards.
The app's existing library, accounts, review schedules, synchronization and
translation-memory paths were retained. No remote deployment, production
account or user's local database was changed in this environment.

Build: `nabu-media-20261107-r1`. Application version: `1.10.0`.
Test date: November 7, 2026. Python 3.13.5; Node v22.16.0; Linux Chromium
with Playwright. Optional speech-model weights are not included.

## Implemented scope

| Area | Implemented behavior | Boundary |
|---|---|---|
| Context action | Opens a real dialog; displays recorded meaning; preserves source sentence, private note, reading and selected image; saves using the existing store; failed save retains inputs | Dictionary sense plus supplied context, not a claim of automatic contextual disambiguation |
| Speech playback | Matching device language voice, replay/stop/close, startup timeout and actionable errors; cloud speech stays explicitly opt-in | Real installed voices/audible output not tested here |
| Recording | Explicit microphone or extension tab chooser, stop/preview/discard, 60-second and size bounds; no automatic upload | Native device/Chrome permission and audio behavior still require testing |
| Transcription | Authenticated bounded decoding, optional local faster-whisper, editable transcript, manual alternative, no raw audio in database | Model not installed or run here; no recognition-accuracy claim |
| Clip art | Four bundled unmodified OpenMoji images; explicit choose/remove, persistent metadata and attribution | No broad stock search, custom generation or imagery for every word |
| Reading aids | Bounded script/letter transliteration and editable stored readings, separate from translation | No inferred Arabic vowels, no automatic reliable Japanese reading, no general pronunciation scoring |
| Extension | MV3 source, explicit selection/context/time capture, notes, sense selection/manual meaning or consented configured translation, recording, same-database save, idempotent retry | Panel/background/options tested with Chrome API fixtures; installed extension not verified |
| Persistence/privacy | Additive private encounter/token tables, hashed owner/extension-bound credentials, revocation, recovery revocation, existing-account library integration | Library JSON exports exclude the separate encounter history; SQLite backups preserve it |

## Final test evidence

These suites cover different layers. Do not combine them into a claim of
production end-to-end coverage. Repeated runs are not additional distinct tests.

| Suite actually run on this update | Passed | Evidence |
|---|---:|---|
| Full JavaScript domain/storage/startup/extension/media suite | 267 | `verification/careful-media/all-js.txt` |
| Full Python/API/operations suite | 285 | `verification/careful-media/all-api.txt` |
| New `/words`/recording/extension-account integration UI | 21 | `media-browser-results.json` |
| New extension side-panel UI | 19 | `extension-browser-results.json` |
| New extension connection/options UI | 8 | `extension-options-results.json` |
| Existing account/reading/review/sync/sharing UI regressions | 30 | `existing-browser-results.json` |
| Exact shipping HTML/CSP/startup regressions | 14 | `startup-browser-results.json` |
| Existing word-bank UI regressions | 19 | `bank-browser-results.json` |
| Existing short-link/mobile-transport UI regressions | 17 | `mobile-links-results.json` |
| Existing local-release/translation-memory UI regressions | 11 | `local-release-results.json` |
| Actual fresh-process HTTP and SQLite integration | 8 | `http-integration.json` |

JSON filenames above are under `verification/careful-media/`. The full API suite
includes 21 new media/security/migration tests; JavaScript includes 34 new checks
beyond the original 233. Browser error lists for completed UI suites are empty.
Syntax/build validation also passed, including exact SHA-256 CSP hashes and the
four SVG assets' upstream Git blob hashes.

### What the UI tests really execute

The existing repository uses a browser harness because native URL navigation is
blocked in this runtime. The app tests execute the shipping application bundle
and DOM with explicit URL/history, IndexedDB request and fetch/TestClient
fixtures. Account APIs use the actual FastAPI implementation and isolated SQLite.
Extension panel/options tests execute their real source with explicitly mocked
Chrome storage, messaging, selection, tab-opening and permission APIs. Background
worker contracts are also tested with Chrome API fixtures. Audio/voice events and
speech-model inference are simulated, not secretly represented as live providers.

### Actual HTTP test

A fresh real server process was started on a temporary loopback port and database.
HTTP requests verified `/words`, version, microphone response policy, account
registration, extension token creation, capture persistence, idempotent retry,
private source retrieval, immediate token revocation and absent-model status.
The process and temporary database were cleaned up. This is real HTTP, but not
native browser cookie, microphone, service-worker or extension validation.

## Important failures found and corrected

- The supplied server forbade microphone access. The policy now permits its own
  origin only; camera and geolocation remain disabled.
- A speech player's controls could be behind an inert modal backdrop. Device and
  existing cloud controls now attach inside the active dialog when appropriate.
- Failed context saves retain typed notes/readings and provide a retry instead
  of closing the form or reporting unconfirmed success.
- A save whose acknowledgment was lost could be retried. Its persistent request
  ID now guarantees one encounter for that request; a later distinct note is a
  new encounter without duplicating or regrading the underlying word.
- Pending extension saves lock the submitted fields so later edits cannot be
  falsely presented as the content already saved.
- Late permission grants and stale recording callbacks cannot leave tracks
  recording or terminate a newer recording. Account changes clear private
  transient state and abort pending requests.
- Using a new transcript clears old source/context rather than attributing it
  to the previously captured article. A tab chooser does not reveal source URLs.
- Inherited Japanese draft character romanization is not shown as a Japanese
  pronunciation. Unsupported readings require checked manual entry.
- Password recovery revokes extension credentials as well as browser sessions.
- Library export copy now says "Library backup" rather than falsely promising
  that the separate encounter history is included in the JSON export.

## Not passed / not attempted as live acceptance

- Native navigation to localhost returned `ERR_BLOCKED_BY_ADMINISTRATOR`.
  No browser policy was bypassed or disabled to relabel that as a pass.
- One ordinary unpacked-extension launch attempt produced no observable service
  worker before timeout. Exact cause was not established. See `native-extension.json`.
- Real microphone, tab sharing/audio, permission prompts, installed language voices
  and audible output have not been verified. Those paths use fixtures in UI tests.
- faster-whisper/model weights were not installed in this environment. Validation,
  real FFmpeg decoding, temporary-file cleanup and integration were tested with
  stub inference. Run the setup helper and an actual short recording locally.
- No live paid translation/TTS provider, personalized image generation, Chrome
  Web Store publication, production load test or native mobile binary test occurred.
- The full earlier adaptive-language-model vision is not implemented or validated
  by these media helpers. Capture, listening or a transcript are not mastery.

## Reproduce the checks

From the source folder with the Python dependencies from `requirements.txt` and
`requirements-dev.txt` installed, Node 22+ and Chromium/Playwright available:

```text
npm test
python -m pytest -q
python tests/media_browser.py
python tests/extension_browser.py
python tests/extension_options_browser.py
npm run test:ui
python tests/local_release_browser.py
```

The browser harness scripts use `/usr/bin/chromium` and are Linux test harnesses,
not a promise of portable installed-Chrome automation. Use the manual device
checklist in `MEDIA_SETUP.md` for the native acceptance that matters on your PC.

Source generation is optional for normal use; the built HTML is included:

```text
python tools/build_media_catalogue.py
python tools/build_standalone.py
```

## Release decision

**The source implementation and bounded integrations are packaged and the checks
above pass. Native Chrome/audio/model acceptance remains open.** Do not treat
"implemented" as "verified on your machine," or deploy a pilot before completing
the local checklist. Keep your prior folder and SQLite backup for rollback.
