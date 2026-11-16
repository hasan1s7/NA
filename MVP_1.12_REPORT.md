# Nabu 1.12.1 - implemented Explore MVP and verification

Build: `nabu-explore-20261109-r2`. Work date: November 9, 2026.

## Scope and source

This is an implementation in the supplied Nabu 1.11.0 application, not another standalone demo, screenshot-only redesign, repository reconstruction or deployment. Baseline ZIP: `nabu-local-1.11.0.zip`; SHA-256 `0130f2d9ba9c9ebf80723f45b9ea43a2e2e45cea2fc50efcd55a6a5ee44578db`.

Read instructions/handoff, setup, report, package scripts, source, builder and launcher before editing. No AGENTS.md/CLAUDE.md existed. Verified actual stack: plain JavaScript ES modules/CSS with Python bundle generation, FastAPI/Pydantic and SQLite, IndexedDB/meta store, existing account sync, media/reading/illustration modules and optional MV3 extension. Not React, Next.js or Rails. No runtime dependency upgrade, paid provider, credential, new image service, remote deployment or repository push. Existing authentication, library, reference/study distinction and schedules are reused. Only isolated test identities/databases were used.

## Baseline observed, not assumed

| Area | Result before changes |
|---|---|
| JavaScript | 350 passed, 1 failed of 351. The pre-existing Web Locks test required exactly two lock acquisitions; an extra empty scheduled acquisition made it fail. Actual server write/card count assertions passed. |
| Python/backend | 297 passed on completed rerun. An earlier run was interrupted by the execution timeout and is retained, not counted as a pass. |
| Actual local HTTP | App and /words served from the existing launcher with installed dependencies. |
| Native Chromium | Localhost navigation failed with ERR_BLOCKED_BY_ADMINISTRATOR. No policy bypass. |
| Existing reader | Real source/help/saving paths present; whole pasted passages were tab-local. No published Explore catalogue or durable per-piece progress in this archive. |
| Optional integrations | Existing tools retained; real voices, microphones, installed-extension permissions and local speech-model inference were not established by this run. |

Evidence: `verification/mvp112/baseline/`.

## What ships

### 1.12.1 content patch

The six-item collection now includes a sourced public-domain opening excerpt from Imru’ al-Qais (`قِفَا نَبْكِ`) in place of the former AI-written `a-place-for-light` poem. The catalogue remains six items / 24 annotations / 18 activities. The Arabic source is attributed to Arabic Wikisource; Nabu’s English translation, explanations and practice remain AI-assisted editorial drafts, not instructor-reviewed. See `IMRU_1.12.1_REPORT.md`.


### A usable beginning

`/explore` opens with "Find something you want to understand." Four optional filters work on the real six-item collection and can be cleared. No signup, onboarding questionnaire, API key or extension is required to browse and complete the text path. Continue is shown only from stored progress; no fictional time spent, mastery, thumbnails or recordings.

The original warm/green/cream identity and reader are retained. Existing navigation remains; six compact phone tabs reflow. The launcher now opens Explore, while existing /read, /words, library, review, friends, translation and settings remain available.

### Six complete, honestly labelled text pieces

| ID | Title | Genre / register |
|---|---|---|
| a-little-later | A little later | Everyday dialogue, MSA |
| a-book-for-rain | A book for a rainy day | Everyday dialogue, MSA |
| the-key | The key | Complete microstory, MSA |
| imru-al-qais-stop-and-weep | Stop, and let us weep | Imru’ al-Qais excerpt, pre-Islamic Classical Arabic |
| an-unsent-letter | An unsent letter | Original free verse, literary MSA |
| a-drop-of-water | A drop's journey | Original factual passage, MSA |

There are 44 ordered segments, 24 precise contextual annotations and 18 optional activities. English translations are complete. Five texts are original AI-assisted Nabu drafts. The sixth is a sourced public-domain opening excerpt from Imru’ al-Qais; Nabu’s English translation, explanations and practice for that excerpt are AI-assisted editorial drafts and are NOT expert/instructor reviewed. Time/difficulty are editorial estimates, not measured engagement or certified levels. No recordings are bundled. The factual passage is a new paraphrase; its claims about condensation and the water cycle cite USGS/NASA reference material in the catalogue. No modern poem, performance or third-party translation was copied. The Imru’ al-Qais Arabic text is attributed and linked to Arabic Wikisource; the underlying pre-Islamic poem is public domain.

### A coherent contextual journey

Curated expressions open authored interpretations for the exact selected occurrence, with the real source sentence, usage explanation and original marks/linebreaks. Uncovered words/selected ranges retain the existing dictionary/manual path, not fabricated context-specific meanings. Help updates the existing panel without rebuilding the reading DOM. Phone sheets restore focus; practice returns to the same reader. Arabic and mixed-script prompts use bidi isolation.

The existing TTS, image and reading-aid implementations are reused. Lack of an image, automatic reading or matching voice does not prevent reading/saving/practice. No fake audio alignment, time segment action, or image generation was added.

Save uses the actual existing reference-card store, duplicate protection, context editor, notes/readings/images and schedules. The source excerpt and versioned provenance are kept. A later source encounter may become the card's latest context while the separate content event points back to the original catalogue occurrence. No hidden review enrollment. Retry preserves drafts and saves the underlying record before success. Relevant prior correction and illustration fields remain intact.

### Durable return and honest state

Curated content progress uses owner-scoped events in the EXISTING IndexedDB `meta` store. Signed-in events queue to `/api/content-progress`, protected by existing session/CSRF/expected-account rules. The server adds one table, `content_events`, with owner foreign key and immutable IDs. Existing tables, schema user_version, library data and schedules are not replaced or renamed. No guest-to-account progress migration occurs implicitly.

Stored events distinguish opening, position, explicit read/unread, explicit preference, source-to-saved-card references, help and practice attempts. Positions use segment IDs plus relative offsets; no comprehension claim follows from scrolling. Timestamps/IDs/version allow reproducible reduction. Retries are idempotent and conflicting duplicate payloads are rejected atomically. Raw answers are private; this is not an anti-cheating or independently verified assessment system.

Sync reports local/pending/confirmed/error correctly. A real race was found: events appended during a running sync could remain queued until a later call. The sync now drains those new events before resolving; a deterministic regression test and browser check cover it. Cold offline startup also reconnects the progress transport after the existing account session refresh, without requiring a page reload; a separate browser check covers this recovery. Account changes invalidate stale work and keep original-account writes private. New pending practice responses lock their inputs to avoid presenting later edits as already saved.

Progress export is a real private JSON download. It is NOT an import/restore tool. Existing server SQLite backups include the new table and restore it; ordinary Library JSON exports do not include content or encounter history. Guest storage remains device/browser/origin-specific. Maximum initial content history is 8,000 events per identity; reaching it stops new writes with an explanation, rather than silently deleting records. Full pasted documents still retain their older tab-local boundary; this release makes the six curated pieces resumable.

### Small, observable adaptation

Every piece has meaning recognition, constrained expression recall and related-context interpretation. Prompts specify the intended source form/register/gender when needed. Accepted-wording checks ignore specified harmless marks/spacing, not arbitrary meaning distinctions. Options use varied answer positions. Explanations explain the actual distinction, not just a generic success toast.

Incorrect, assisted-correct, unaided-correct and skipped observations remain distinct. Revealed answers, hints and an already-open source translation are assistance. Opening/finishing/saving/listening are not mastery. "Unaided" means no tracked in-app assistance on that attempt, not proof of no outside help or delayed retention. Learners can always ask for help or stop.

`content-support-v1` offers recall after a missed/assisted recall and a related-context question after an unaided match; absent recall evidence starts with contextual meaning. The reason is visible. This is a deterministic, bounded heuristic, NOT a trained model, calibrated posterior, spaced-content scheduler, universal ability estimate or efficacy result. The existing word-review scheduler is unchanged. Explicit "More like this" affects only a real catalogue recommendation, not the knowledge state. End-of-piece counts show only saved expressions and recorded activity results, with no proficiency percentage.

## Validation evidence and commands

Environment: Linux, Node 22, Python 3.13, Chromium/Playwright. Existing requirements were already installed. Commands are in package.json. No linter is configured; no fictitious lint pass is claimed.

| Executed layer | Result / evidence |
|---|---|
| Full JavaScript domain/store/media/startup/extension/reading + content | 391 passed on the 1.12.1 patch; see `IMRU_1.12.1_REPORT.md` |
| Full Python/API/operations + new content API | 311 passed, `verification/mvp112/final/python.txt` |
| New Explore/reader/practice/resume/RTL/failure UI | 77 checks, zero uncaught page errors; `verification/mvp112/browser-results.json` |
| Existing startup/account/reader/review/sync/word-bank/short-link UI | `npm run test:ui`, final command log/exit code |
| Existing redesign UI, keyboard/contrast/reflow, and restart HTTP | `npm run test:redesign`, final command log/exit code |
| Existing illustrations/transliteration/UI contracts | `npm run test:meaning`, final command log/exit code |
| Existing media and extension panel/options | Separate final command logs/exit codes; Chrome/audio fixtures explicitly labelled |
| New actual fresh-process HTTP/SQLite/restart/backup | 23 checks, `verification/mvp112/final/explore-http.json` |
| Application/extension/build JS and Python syntax | 51 files, zero failures, `verification/mvp112/final/syntax.json` |
| Build | Full package build; catalogue validation and exact script/style CSP hashes |

Read individual final logs/exit files; this table is not a claim that all tests operate at the same layer. The clean archive verification is additionally delivered as `NABU_1.12_RELEASE_CHECK.md`, tied to the downloadable archive SHA-256; it is generated only after that archive is extracted and tested. Historical 1.11 evidence included in older folders is not counted as new work.

New checks cover every published card and all 24 annotations; Unicode scalar/UTF-16 offsets, repeated spelling/different senses, source URL validation, private identities, rejected mutation, atomic batches, server reconstruction, stale account response, concurrent appends, lost ACK, write failure/retry, delayed sync appends, input locking, actual preference ranking, and different response histories with inspectable next support. Practice does not create unwanted cards or change stored review schedules. Existing fields/readings/images/schedules survive real process restart.

### Failures retained and corrected

The baseline Web Locks test's exact acquisition count was over-specific; it now requires both tabs to use the lock while preserving the important assertions: ONE server write and ONE card. No application lock was weakened. The initial Python test-client delete invocation and HTTP second-account header fixture were repaired; these were test mistakes, not user-facing fixes or additional passes. The source-progress sync race was an application defect discovered during the new UI suite; a focused regression reproduces the interleaving. Earlier failed logs are retained separately under `verification/mvp112/`.

### What UI checks actually execute

The shipping bundle and DOM execute with the repository's explicit URL/history, IndexedDB-request and fetch/TestClient bridge fixtures. API calls use actual FastAPI/SQLite; voice/Chrome APIs use explicit fixtures. A freshly mounted UI with retained fixture records tests application reconstruction, not native browser disk durability. The native navigation blocker was not bypassed. The separate HTTP test launches the actual server, writes an isolated SQLite database, stops/restarts, logs in again, compares exact records and invokes the real backup script.

Actual rendered screenshots were visually inspected: Explore, desktop reader/context, practice, phone sheet/Arabic, phone Explore and 200% CSS zoom. Reflow covers 1024, 768, 390 and 320px. Visible text contrast, named handlers, focus restoration and modal behaviours are checked. Native browser zoom, full screen-reader audit and independent WCAG certification are not claimed.

### Not verified / not shipped

Native Windows/macOS execution, fresh dependency installation on the user's machine, native browser storage/cookies/service workers, physical phone/zoom, real device voices/speakers/microphone, tab capture, installed Chrome-extension permissions and real speech-model inference remain local acceptance checks. No live paid service or generated image call occurred.

No arbitrary web/video ingestion, new audio/video pipeline, curriculum, attention blocker, Midjourney integration, universal language catalogue, trained adaptation, global mastery or learning efficacy is claimed. Independent Arabic/native-teacher review and real learner usability/return studies have not occurred. `MVP_1.12_LATER.md` separates those next investigations from the completed software slice.

## Files and operational safety

Core new files: `data/explore.json`, `public/nabu-content-catalogue.js`, `nabu-content.js`, `nabu-content-store.js`, `nabu-explore-ui.js`, `nabu-explore.css`, `content_progress.py`, `tools/build_content.py`, focused tests, authoring/setup/control documents. Existing app, reader highlighting, links/router, account/store cleanup, server/launcher, service worker, build scripts and metadata are adapted minimally. `CHANGED_FILES_1.12.md` contains the exact source comparison; generated bundles and evidence are listed separately.

Run Windows: `py -3 start_local.py` or `Start-Nabu.cmd`; macOS/Linux: `bash start-local.sh`. Open `http://127.0.0.1:8000/explore`. Keep the terminal open. See `RUN_NABU_1.12.md` to preserve .env.local, .data, .venv, backups, browser origin and rollback copies. This runtime did not modify the user's running installation.

## Bounded research and editorial decisions

- USGS, "Condensation and the Water Cycle": https://www.usgs.gov/water-science-school/science/condensation-and-water-cycle . Used to check the original condensation passage; new wording, not an extracted article or accuracy claim about all generated content.
- NASA, "What Is the Water Cycle?": https://science.nasa.gov/kids/earth/what-is-the-water-cycle/ . Corroborates water-vapour/cloud/precipitation descriptions in the original factual piece; not a complete science curriculum.
- W3C Web Annotation Data Model: https://www.w3.org/TR/annotation-model/ . Informs exact quote/position anchoring and source identity. The module is a small explicit contract, not full W3C annotation interoperability.
- Existing 1.11 contrast/reflow checks and W3C accessibility requirements motivate concrete visible-text/reflow/focus tests. A fixture screen check is not WCAG certification.

No learner study was run. The product hypothesis is that worthwhile chosen content, on-demand support and reliable return reduce friction; it remains a hypothesis. A small honest study design is in MVP_1.12_LATER.md.
