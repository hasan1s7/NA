# Nabu 1.15.0 — current handoff

**Version:** `1.15.0` · **Build:** `nabu-learner-20261114-r1`. Package and server metadata identify this release as 1.15.0.

## Source and release scope

The verified input is the supplied Nabu 1.14.0 archive. Its SHA-256 is:

```text
dfa8a4a05bc84d9d2b58f4de1492e69cef79c255b143ad6fe85846615c0c28de
```

The release adds the live learner model, versioned task/evidence bridge, and decision layer to the existing application. **Explore** and **Read** include a small-goal panel with language/mode selection, a time budget, predictions and uncertainty, authored support, optional diagnostics, Continue, and model-record export. The catalogue contains **93 authored tasks in 12 languages** and explicit mappings for **8 existing contrast tasks**. The morphology slice is bounded; twelve-language coverage does not imply twelve complete morphological systems.

The crossed Bayesian model includes language, response mode, meaning, root or lexical-form gate, pattern, word, context, optional whole-form memory, and observational time/practice terms. Shared variables and variance hyperparameters provide partial pooling. Sharing across languages requires an authored transfer group. Coefficients absent from observed likelihoods are sampled conditionally rather than allowed to create evidence. No observations means a labelled prior prediction.

Local asynchronous fitting is cancellable. An unstable initial fit receives one longer computation attempt using the same evidence. Unstable or bounded estimates remain labelled; a failed convergence check prevents an extra diagnostic recommendation. The immutable event ledger retains exact task/version, response, assistance, provenance, episode, and actor scope. The bridge excludes unsupported or ambiguous evidence and dependent repeats. Account/team changes cancel pending inference and clear the visible posterior. Neither predictions nor supplied help rewrite the ledger as mastery or update review schedules.

The decision layer minimizes immediate weighted task failure plus authored effort cost. It evaluates one diagnostic and a following terminal action, using joint-sample Bayes reweighting, available support, no-practice, and the combined time budget. Opportunity histories stay fixed during this information-only look-ahead; wall-clock time advances. A real accepted response updates histories on refit. No causal learning, retention gain, or human efficacy is asserted.

## Read and verify

Start with [the release notes](docs/RELEASE_NOTES_1.15.0.md), [task contract](docs/LEARNER_TASKS.md), [decision contract](docs/LEARNER_DECISIONS.md), [evaluation report](docs/learner-evaluation/results.md), and [complete evaluation record](docs/learner-evaluation/results.json). The current research draft is [paper/nabu-learner.pdf](paper/nabu-learner.pdf), with [editable source](paper/nabu-learner.tex).

```bash
npm run test:learner
npm run test:learner-ui
npm run test:api
npm run evaluate:learner
npm run build
python tools/build_paper.py --paper nabu-learner
```

`npm test` runs the complete JavaScript test suite. The dedicated learner UI command runs DOM interaction and shipped-bundle tests. DOM, actual API, numerical-reference, and synthetic-decision checks passed; see the [release verification record](docs/LEARNER_VERIFICATION.md), [machine summary](verification/learner-release.json), and logs in `verification/` for exact suite totals. Native Chromium visual verification was attempted but blocked by the environment's socket policy, so visual browser/device acceptance remains unverified. The paper build requires local `pdflatex` and `bibtex`. Earlier paper files and verification records remain historical artifacts.

## Safe local upgrade

Stop the existing server before changing code or copying its database. Back up the current private `.data/` directory, `.env.local`, and any browser-only data you need. Extract the new release into a separate folder, preserve your existing database and settings there, and start it with the normal `start_local.py` launcher (`py -3 start_local.py` on Windows, or `bash start-local.sh` on macOS/Linux). Let the launcher create the environment for that folder. Keep using the same browser/profile and `http://127.0.0.1:8000` origin for browser data. Do not replace an existing database with a database from another archive or a template. The learner layer uses the existing event store; no private data was migrated or deployed during this work.

The authored language content and statistical priors require independent review and human calibration. Synthetic correctness, convergence diagnostics, and functioning controls do not establish better learning. Deployment, native-device acceptance, and external-provider verification are not claimed.

The following sections are preserved historical handoffs. Their versions, feature boundaries, and test totals do not describe the 1.15.0 release.

---

# Historical checkpoint: Nabu 1.12.1 - Explore, understand, return

The current release is 1.12.1, built from the supplied 1.11 application. Begin at `/explore`.
Content patch 1.12.1 replaces one AI-written poetry item with a sourced opening excerpt from Imru’ al-Qais (قِفَا نَبْكِ), while keeping the collection at six items. See `IMRU_1.12.1_REPORT.md`.
Read **RUN_NABU_1.12.md** for safe upgrade/run instructions, **MVP_1.12_REPORT.md** for current evidence and limits, **CONTENT_AUTHORING.md** for the six-piece catalogue and authoring, and **MVP_1.12_CONTROLS.md** for the new-flow control inventory.

Current architecture remains vanilla JavaScript/CSS with the existing Python bundle builder, FastAPI/Pydantic/SQLite and IndexedDB/account sync. No new runtime packages or provider keys. Source catalogue: `data/explore.json`; progress uses the existing meta store plus an additive private `content_events` table. Existing library data and schedules are preserved. Guest and account progress never silently mix. Native-device acceptance and independent Arabic editorial review remain open.

Windows: `py -3 start_local.py` or `Start-Nabu.cmd`. macOS/Linux: `bash start-local.sh`. Keep the server open; use `http://127.0.0.1:8000/explore` in the same browser/profile/origin. No deployment occurred.

The material below is retained historical documentation; earlier versions/test counts are not current verification. New release details above supersede older status/version statements.

---

> **1.11.0 meaning-tools addition:** Read MEANING_TOOLS.md before changing illustrations, reading rules, saved corrections or the shared extension modules. REDESIGN_REPORT.md is the current verification record.

> Current release: **1.11.0**, build `nabu-reading-20261108-r1`. Start with
> `RUN_NABU_1.11.md` and `REDESIGN_REPORT.md`. The older notes below remain
> architectural history, not new verification claims.

> **1.10.0 update:** Read [MEDIA_SETUP.md](MEDIA_SETUP.md) and [MEDIA_VERIFICATION.md](MEDIA_VERIFICATION.md) for the new context, speech, reading-aid, clip-art and Chrome-extension work. The 1.9.0 descriptions and results below are historical and are not new 1.10.0 verification.

# Nabu 1.9.0 - local-ready handoff

## Source and scope

Input: `nabu-graph-1.8-source.zip`, confirmed in this runtime, freshly extracted.
Input archive SHA-256: `adcd202fe9c14c6820d9cd4ad845ae7d8ddddc6e636bbe7d1c93d648a4754710`.
Release build: `nabu-local-memory-20261106-r1`.

The original ziggurat branding, Nabu colors, 2D-first graph, optional projected 3D, word bank, accounts/social/review features and mobile integration sources are retained. This release does not turn research proposals into claimed production features. See FEATURE_STATUS.md.

## New in this package

- `start_local.py`, `Start-Nabu.cmd`, `Start-Nabu.command`, `start-local.sh`: local-only first-run setup and startup; private `.env.local` template; isolated Python environment; explicit loopback origin; no database replacement; port conflict handling; optional browser opening.
- `translation_memory.py`: durable SQLite translation cache, keyed by normalized API request/context/direction/formality plus configured model/regional targets/endpoint type/pipeline version. Private account isolation, bounded LRU eviction, read-only usage counters, clear controls and deletion cascade.
- Translation single-flight remains in-process; durable reads/writes now survive process restarts. Stored answers are reused before quota reservation/provider calls. Failures are not cached and are not automatically retried. Account deletion and explicit cache clearing invalidate or delete persisted records; late generations cannot repopulate a cleared private cache.
- `GET/DELETE /api/language-memory` and Settings UI for private memory/usage. Statistics count Nabu requests/source characters, not provider-billed characters or certified cost savings. Private records are never automatically promoted to the public bank.
- Partial or ambiguous term concatenations no longer auto-save placeholder answers. Fully resolved assemblies remain explicit draft Reference cards. Exact matches reuse the sense ID and existing duplicate protection.
- Repaired an inherited `graphNodeText is not defined` exception that broke Settings/feature-tree rendering in 1.8.
- Corrected the default graph detail: browsing an unsaved concept no longer claims it is saved. The graph speaker uses the displayed concept, not a stale translator result.
- Fixed a reader paste/background-render race: passive sync refreshes keep input nodes and drafts intact.
- Fixed local restart preflight: a TCP TIME_WAIT socket is no longer misdiagnosed as an active listener.
- Updated stale offline bank-size copy, draft romanization labels, version metadata, build/worker IDs and local documentation.

## Database safety

Existing IndexedDB name/version and SQLite user_version 4 are retained. Startup adds two translation-memory tables with foreign keys to users; it does not drop tables or reset accounts. Never overwrite a live database. Back up before adopting any new release. New local installs use `.data/nabu.sqlite3`; the archive contains no populated database or credentials.

Private translated answers are stored in the database and its backups; request text/context are not separately duplicated by the cache, but translations may contain the same private information. A hash is not a promise of anonymization. Account deletion purges active cache rows, not historical snapshots. Treat all backups as private.

## Run and test

Read README.md / START_HERE.md. The public site is already built, so npm/build tools are optional. To rebuild after code changes, install requirements-dev.txt and run the three Python build scripts. TEST_REPORT.md is the current verification report; historical documents are not evidence of this release's live behavior.

## Outstanding

- Real native browser storage/service-worker/HTTPS behavior and physical-device testing. Browser navigation is restricted in this environment; fixture checks are labeled accordingly.
- A fresh online pip install could not complete here because container DNS/network access failed. The runtime was exercised with the matching pinned dependencies already installed. Windows/macOS launcher execution is not locally verified.
- Live DeepL and ElevenLabs credentials, account entitlements, language accuracy and voice quality. No live provider calls were made.
- Real offsite bucket upload/download drill, Docker build, native compilation/signing and deployment. Nothing was hosted or purchased.
- Universal morphology, reliable language-specific transliteration, full graph enrichment pipeline and public-provider-memory curation remain unimplemented.
- FSRS remains a research/evaluation tool, not the production scheduler. Sinusoidal/circadian scheduling is not shipped.
- The static Pages billing issue is unrelated to this local package; it was not changed.
