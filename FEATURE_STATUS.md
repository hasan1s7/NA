# Nabu 1.17 overnight r2 - current feature map

This header supersedes historical status notes below. The current release is a local pilot foundation, not a certified institutional deployment. Consult `docs/VERIFICATION_OVERNIGHT.md` for fresh checks and untested surfaces.

| Area | Current implementation | Practical boundary |
| --- | --- | --- |
| Learner journey | Real text/transcripts, contextual word/phrase help, source context, save/review/resume, At a glance/In depth, editable notes/aids | Native browser/media/audio verification remains open; local file must be reselected after reload |
| Supported languages | English, Arabic, Chinese, French, Russian, Spanish, Turkish, German, Korean, Japanese, Italian, Portuguese | Existing locale and script settings preserved; graph/linguistic detail varies by entry |
| Language graph | Typed links, authored witnesses, sense/context information, explicit structural uncertainty | No universal parser or complete native-reviewed morphology for all languages |
| Learner model | Explicit probabilistic model, sampled posterior, admission rules, task-condition tracking, decision calculations | Bounded authored tasks and assumptions; numerical tests are not human calibration |
| Intent | Individual/organization actor, present activity, optional destination; four conceptual cases | Local bounded interpretation and authored rules; no private-intent sharing by default |
| Institutional records | Explicit accepted assignments, named reviewers, original responses, versioned rubrics, appeals/reassessment/replay | Exact authored reading rubrics; no general semantic grading or proficiency certification |
| Department support (new) | Separate default-off opt-in, owner-only whole-workspace bands, suppression, correction-aware support explanations | Not anonymous, DP, a posterior, or learning gain; owner audit exposes choice-change metadata |
| External help | Existing authorized translation and speech integrations retained | Provider credentials/device voice required as applicable; not exercised live here; council generation unavailable |
| Deployment | Existing local Python launchers; additive SQLite table; browser IndexedDB and account sync | No SSO, bulk onboarding, retention automation, production-scale/load test or compliance guarantee |

The new release also repairs stale replay exports and insertion ordering of corrections/retries when the system clock moves backward. Encounter/lookup counts remain separate from performance evidence. Department summaries never automatically update the personal learner model.

---

## Archived feature reports

# Nabu 1.13.0 - historical feature status

**Shipping in this local release:** the complete 1.12.2 reader plus an authored Structure lens for three PP-attachment pilot cases (English, Spanish, Arabic), reliability-weighted evidence aggregation, entropy/information-gain diagnostic ordering, explicit inconclusive outcomes, and desktop/mobile UI.

**Not claimed:** unrestricted sentence parsing, calibrated parse probabilities, native-speaker validation of all pilot judgments, learner-model updates from syntax diagnostics, or measured learning efficacy.

---

# Nabu 1.12.1 - Explore, understand, return

Historical 1.12.1 release notes follow; it was built from the supplied 1.11 application and began at `/explore`.
Content patch 1.12.1 replaces one AI-written poetry item with a sourced opening excerpt from Imru’ al-Qais (قِفَا نَبْكِ), while keeping the collection at six items. See `IMRU_1.12.1_REPORT.md`.
Read **RUN_NABU_1.12.md** for safe upgrade/run instructions, **MVP_1.12_REPORT.md** for current evidence and limits, **CONTENT_AUTHORING.md** for the six-piece catalogue and authoring, and **MVP_1.12_CONTROLS.md** for the new-flow control inventory.

Current architecture remains vanilla JavaScript/CSS with the existing Python bundle builder, FastAPI/Pydantic/SQLite and IndexedDB/account sync. No new runtime packages or provider keys. Source catalogue: `data/explore.json`; progress uses the existing meta store plus an additive private `content_events` table. Existing library data and schedules are preserved. Guest and account progress never silently mix. Native-device acceptance and independent Arabic editorial review remain open.

Windows: `py -3 start_local.py` or `Start-Nabu.cmd`. macOS/Linux: `bash start-local.sh`. Keep the server open; use `http://127.0.0.1:8000/explore` in the same browser/profile/origin. No deployment occurred.

The material below is retained historical documentation; earlier versions/test counts are not current verification. New release details above supersede older status/version statements.

---

> **Historical 1.11.0 note:** See [REDESIGN_REPORT.md](REDESIGN_REPORT.md), [MEANING_TOOLS.md](MEANING_TOOLS.md) and [RUN_NABU_1.11.md](RUN_NABU_1.11.md). Historical reports below do not supersede current limitations.

> **1.10.0 update:** Read [MEDIA_SETUP.md](MEDIA_SETUP.md) and [MEDIA_VERIFICATION.md](MEDIA_VERIFICATION.md) for the new context, speech, reading-aid, clip-art and Chrome-extension work. The 1.9.0 descriptions and results below are historical and are not new 1.10.0 verification.

# Feature status - 1.9.0

This package contains the implemented application, not every idea mentioned in the strategy/research discussion.

| Capability | Implemented state |
|---|---|
| Bank | 900 word meanings, 90 everyday phrases, 36 expressions; twelve supported languages. Authored draft, not native-reviewed. |
| Translate/save | Built-in sense-aligned translations, automatic saving, duplicate protection, context, editing, import/export. |
| Translation memory | NEW: server-side account-private persistent SQLite cache. Context/settings-aware keys, bounded retention by LRU, in-process duplicate-request coalescing, usage counters and explicit clear. |
| Public reuse | The packaged public bank is reused without provider calls. There is no automatic promotion of private translations to a shared public corpus. |
| Graph | Nabu green/cream/sand palette; 2D by default, optional projected 3D, clickable language and relation nodes, usage panels, feature tree. |
| Components | Curated detailed components for selected Russian examples; other entries use labeled semantic neighbors. No universal morphological parser has been shipped. |
| Transliteration | Existing offline draft ASCII-style mappings and curated Russian annotations. Not reliable Japanese kanji reading, Arabic vocalization, stress-marked pronunciation or a universal romanization service. |
| Concatenation | Word-by-word draft assembly with breakdown. NEW: incomplete/ambiguous output is not auto-saved; complete assemblies stay Reference drafts, not validated grammatical sentences. |
| Reader | Pasted text, selected word/phrase lookup and sentence context. |
| Review | Learning/Reference/Archived, five-minute sessions, recognition/production/listening/cloze, independent skill schedules, undo. Listening availability depends on speech setup. |
| Scheduler | Production remains explicitly SM-2-inspired. Optional FSRS evaluation utility exists; no FSRS rollout or sinusoidal scheduler is claimed. |
| Accounts | Local/server account creation, sign-in/out, private libraries, one-use recovery codes; no email recovery. |
| Sync | Account-isolated IndexedDB caches and offline outboxes with conflict states, retries and idempotency. Works while the app is open; no OS background-sync guarantee. |
| Social | Friends, word sending, permissioned collection snapshots/proposals, owner approval, revocation, blocking. Learner notes and progress stay private. |
| Links | Server-backed expiring/revocable word links, legacy links and readable routes. Local links only reach this computer. |
| Audio | Existing DeepL and ElevenLabs adapters and playback cache, plus explicit device-voice selection. No live voice-quality claim. |
| Backups | SQLite snapshots, encrypted S3-compatible upload tooling, isolated restore verification. Same-disk snapshots enabled by the local template; remote storage not configured. |
| Mobile | Responsive web app and Capacitor integration sources/assets. No compiled or signed iOS/Android binary. |
| Startup | NEW: local-only Windows/macOS/Linux launchers and private configuration template. First dependency installation requires internet. |

## Not implemented just by discussing them

Automatic Stanza/CAMeL language enrichment, complete reviewed graph annotations for every entry, public provider-result admission/curation, context-aware semantic correction pipelines, true phonetic transliteration for every language, a new FSRS production scheduler, circadian or damped-wave optimization, full speech assessment, and the entire proposed QOL wishlist remain follow-up work.

## Boundaries

One server instance/process is the intended SQLite/private-beta deployment. Translation duplicate-request locks are in-process, not a distributed lock. Cache capacity is 2,000 entries per account / 20,000 globally; eviction can cause a later provider request. Generated private translations retain provider draft status and are not linguistic evidence. Actual provider bills, commercial terms and account quotas must be checked with the providers.

The local test server is not an enterprise production deployment. Password/security tests do not constitute an independent security audit. Do not import confidential enterprise materials during informal testing.
