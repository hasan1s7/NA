# Nabu 1.11.0 - implementation and verification

## Release scope and source of truth

This is an implemented update to the uploaded `nabu-local-1.10.0.zip`, not a new
static mockup, not the separate earlier journey demo, and not a deployment.
Source archive SHA-256: `ead479912ae6a7b7260346088014a83ddc84391d0aab170f9876579e8583c309`.
Version was read from the archive/source and is now consistently 1.11.0 in the
application, server, launcher and extension manifest. Build ID:
`nabu-reading-20261108-r1`. Work and verification: November 8, 2026.

No AGENTS.md or CLAUDE.md was present. README, HANDOFF, existing setup/report,
package scripts, launchers and build/test code were inspected before changes.
Actual stack: plain JavaScript ES modules and CSS, bundled with a Python script;
FastAPI/Pydantic and SQLite; IndexedDB/offline account queue; existing Chrome MV3
extension and optional Capacitor source. This is not React/Next.js.

Entry points: `start_local.py` -> `server.py`; `public/nabu-app.js` rendered through
`tools/build_standalone.py` into `public/index.html`. Styling is existing nabu.css
plus focused nabu-workspace.css tokens/overrides. Storage remains nabu-core/store/
account-store/sync and the existing server's JSON card contracts. Runtime Python
requirements and package dependencies were not upgraded or expanded.

No remote repository was pushed, no app was published, and no user account,
production data, private configuration or database was altered. Isolated test
accounts/databases and authored QA passages were used throughout.

## Baseline recorded before redesign

- Original JavaScript suite: **267/267 passed**.
- Original Python suite: **285/285 passed**.
- App served real HTTP locally; `/words` was present. Source version 1.10.0.
- Native Chromium localhost navigation failed with
  `ERR_BLOCKED_BY_ADMINISTRATOR`. This restriction was not bypassed.
- The existing fixture browser harness rendered actual source/screens and
  reported no baseline page exceptions. It confirmed that reading a word caused
  automatic saving, that the graph dominated `/words`, and that the source editor
  remained beside the rendered passage.
- Existing four images, saved reading fields, device-speech/recording controls,
  accounts and sync worked at their tested layers; hardware audio, speech-model
  inference and an installed Chrome extension were not validated by that baseline.
- The app has no pre-existing user dark theme to preserve. No new dark theme was
  silently claimed. Existing high-contrast focus/reduced-motion handling remains.

Evidence: `verification/redesign/baseline-*` and original MEDIA_VERIFICATION.md.
Those older results are historical, not additional final test counts.

## Implemented changes

### Reading and visual system

Nabu's ziggurat/green/cream identity is retained, with warm neutral surfaces,
subtle borders, readable type and a consistent spacing/control scale. No Wispr
branding/assets or new font files. Navigation is compact and existing sections
remain reachable. `/read` now opens a quiet paste/recorded-transcript workspace;
the text editor collapses when reading, so source content is not duplicated.

Selecting a word or phrase updates only the support panel, preserving the real
reader DOM and manually scrolled position. The desktop panel becomes a mobile
dialog; focus returns to the selected word, and nested context editing returns
to that panel. A real bug found during the new tests was fixed: a responsive
resize cannot put the word sheet above an already-open editor.

`/words` is vocabulary-first; the existing graph remains behind an expansion.
Library, Quick lookup, Review, Friends and Settings use the shared visual tokens
without replacing their functional integrations. Existing routes, auth, settings,
audio and review engine remain in place. Recording from Read inserts an editable
transcript, not a fabricated article or automatically translated document.

### Context, pronunciation and saving

The selected word retains its actual spelling and source sentence. Source content
is highlighted; bank examples are separately labeled and never passed off as the
learner's passage. Dictionary senses explicitly require contextual confirmation.
Use a different meaning opens the existing manual editor with the source intact.
No missing translation, example, source title, thumbnail or progress is fabricated.

Reader/word-bank lookup is now **explicit-save**, rather than automatic homework.
Quick lookup keeps its prior auto-save behavior. Saved words remain Reference
items unless the learner deliberately changes that. Existing schedules and notes
are not reset. Updates use the same existing store, revision checks and queue.
Pending/local/server-confirmed, failed/retry and no-change states are distinct.
Double submission is prevented; edits made during an earlier pending save are
kept and described as not yet saved. Failed requests retain the form.

Existing device/cloud pronunciation implementations are reused. Controls remain
reachable within dialogs, unavailable voices produce guidance, and changing a
word stops the previous pronunciation. No added paid TTS or unconsented provider.
Actual speakers/voices on the user's machine remain a separate acceptance check.

### Illustrations and language-specific reading aids

`MEANING_TOOLS.md` is the detailed implementation specification. Five unmodified,
licensed OpenMoji assets are bound to concept/sense IDs, with alt text, style
version, license/source attribution and verified hashes. Financial bank is not
reused for river bank. Equivalent language terms reuse one local asset. Missing
or rejected images do not block the word panel. Choose, replace, remove, mark
incorrect, explicitly restore, decode-error and real reload/retry are implemented.

A future provider adapter includes explicit consent, reuse/single-flight,
error/retry and stale-result protection. **No authorized image provider is connected
or called.** Tests use injected TEST adapters. No Generate button or fake success.
There is no universal image coverage and no bundled intended-meaning idiom art.

The shared language-specific reading layer handles Russian letters, Arabic written
forms, Hangul syllables, Japanese kana and original Latin spelling. Chinese and
Japanese kanji require a reliable whole-word source or manual correction; none
is invented. The old graph export fields are retained for API compatibility, but
unreliable generic Chinese/Japanese character conversions are not shown as readings.
Saved corrections are authoritative and explicitly cleared readings stay hidden.
The web app and extension use the same source files; extension selection changes
clear stale output. Scripts/schemes, examples and accuracy limits are documented.

### Data and privacy

Existing SQLite tables and API routes are unchanged. One optional validated
`imageDismissed` list was added to existing card JSON for private image feedback.
Older requests that omit it remain accepted; no destructive/renaming migration.
Image associations still use imageId; readings still use reading/readingMethod.
Corrections and image flags are excluded by the existing public share allowlist.
No global feedback collection, user-content upload or source-to-public conversion.

Whole documents remain tab-local; saved source excerpts use the existing 1,500
character limit. Existing richer extension encounter history remains separate
and is preserved by database backups, not ordinary library JSON exports.

## Final verification

Environment: Linux, Python 3.13, Node 22 and Chromium/Playwright. Commands and
individual raw logs are under `verification/meaning-tools/final-*`.

| Executed layer | Final result |
|---|---:|
| JS domain, storage, startup, media, extension, reading and illustration checks | 351 passed |
| Python/API/operations tests | 297 passed |
| New illustration/reading UI checks | 42 passed |
| Redesign UI checks | 34 passed |
| Focused keyboard/reflow/contrast checks | 35 passed |
| Existing media/context UI | 21 passed |
| Extension panel checks (Chrome API fixtures) | 22 passed |
| Extension connection/options checks | 8 passed |
| Actual HTTP and process-restart checks | 15 passed |

The existing `npm run test:ui` regression chain also passed (startup, existing
account/reader/review/social/sync, word-bank and short-link/mobile transport), as
did local-release/translation-memory and spatial graph UI suites. Build and exact
CSP hashes passed. **52 application/build JavaScript/Python syntax checks passed.** There is no
configured lint script; no nonexistent linter result is claimed.

An earlier concurrent test run had one timing-sensitive Web Locks test failure
(three acquisitions vs the fixture's expected two). An isolated rerun passed,
as did the final full suite. The failure remains recorded in the earlier
`verification/redesign/final-js.txt`; the current result is in
`verification/meaning-tools/final-js.txt`. Test-harness selector/wait errors were
corrected during development; they are not application fixes or extra passes.

Tests include same spelling/different senses, cross-language asset reuse,
missing/bad assets, unsafe provider outputs and denied consent, provider failures
and retries (fixtures), delayed/stale results, all twelve declared language
behaviors, Arabic with/without vowels, mixed scripts, Japanese missing readings,
manual reading correction/explicit hide, image feedback, unchanged schedules,
duplicate captures, cross-account isolation, reload into a fresh UI instance and
real server reconstruction. Saves fail honestly and retain input under injected
failures; their retry is checked against actual stored data.

### Browser boundary: not hidden

UI suites execute the actual shipping DOM/bundle with the repository's explicit
URL/history, IndexedDB-request and fetch fixtures. Account calls go through the
actual FastAPI implementation into isolated SQLite. Chrome APIs, voices and
speech-model responses are explicit fixtures where used. They do **not** prove
native browser persistence/cookies/service workers, audible playback, microphones,
tab capture or installed-extension permissions. No policy bypass was used.

Separately, a fresh real server process was started via the existing launcher
with already-installed dependencies (`--ready --no-browser --port <test-port>`).
Real loopback HTTP verified all original routes, version/build, registration,
word/metadata saves, duplicate protection and privacy. The process was stopped
and restarted: source, note, reading, image, rejection flags and review schedule
were retrieved unchanged from the same isolated SQLite file. This is actual
HTTP/process persistence, not a native Chrome refresh test.

### Visual/accessibility inspection

Inspected actual rendered desktop reader, open word panel, words page, library,
settings, mobile sheets, optional image/reading editors and Arabic/Latin source
text. Screenshots are captured from the shipping UI with authored QA inputs.
Reflow checks cover desktop/tablet/390px/320px and 200% **CSS zoom**. Native browser
zoom/hardware phone testing remains open. Keyboard restoration, modal layering,
named controls, visible focus, reduced motion and computed visible text contrast
were checked. This is targeted WCAG-AA contrast/reflow work, not a full independent
WCAG certification or screen-reader audit. The checks fixed low-contrast text and
several overflow cases rather than masking them.

## Key files

- public/nabu-workspace.css: reusable visual tokens and responsive reader/editor.
- public/nabu-app.js, nabu-reading-ui.js: real workspace, source selection/panel,
  safe manual-meaning path, saved states and focus/RTL behavior.
- public/nabu-word-tools.js: context/image/reading actions and persistence states.
- public/nabu-transliteration.js: versioned language-specific reading API.
- public/nabu-illustrations.js: sense-bound catalogue selection and provider seam.
- data/illustrations.json, public/clipart/*.svg, nabu-clipart.js: licensed local art.
- public/nabu-core.js and social.py: compatible optional private JSON metadata.
- chrome-extension/nabu-media.js, nabu-transliteration.js, sidepanel.js: shared
  reading rules and stale-display clearing; permissions not expanded.
- tools/build_media_catalogue.py and build_standalone.py: verified assets,
  shared modules and rebuilt self-contained HTML/CSP.
- tests/reading-ui.test.mjs, transliteration.test.mjs, illustrations.test.mjs,
  test_meaning_tools.py and redesign/meaning browser/HTTP checks.

CHANGED_FILES_1.11.md is the exact source-archive comparison. Generated bundles
and test evidence are identified separately from hand-edited source changes.

## Run and upgrade

Back up your existing project and SQLite first. Stop the old server. Replace
application files only, keeping `.env.local`, `.data/`, `.venv/`, backups and
browser data. Do not overwrite your database with a test database. For rollback,
keep the original application AND its pre-upgrade database backup.

From the `nabu` folder on Windows:

```powershell
py -3 start_local.py
```

Or double-click Start-Nabu.cmd. On macOS/Linux: `bash start-local.sh` or
`python3 start_local.py`. Python 3.11+; the first dependency setup needs internet.
No npm install or new provider credential is required for the supplied built app.
Open `http://127.0.0.1:8000/read`; `/words` is still available. Keep the server
terminal open. See RUN_NABU_1.11.md for optional speech/extension setup and safe
upgrade details. Windows execution itself was not performed in this environment.

Developer reproduction:

```text
npm run build
npm test
python -m pytest -q
npm run test:ui
npm run test:redesign
npm run test:meaning
python tests/media_browser.py
python tests/extension_browser.py
python tests/extension_options_browser.py
```

## Remaining limits

This release does not import arbitrary websites/videos, synchronize video
transcripts, train an adaptive learner model, prove learning efficacy, generate
images or install a speech model. Existing pasted text and recorded transcripts
are the supported content path; existing extension capture remains optional.
No unsupported source-time playback button was added. Native device acceptance,
provider quality and production readiness remain distinct from these local tests.
