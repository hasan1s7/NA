# Nabu 1.15.0: Bayesian learner support

**Current version:** `1.15.0` · **Build:** `nabu-learner-20261114-r1`.

Nabu now fits a Bayesian learner model and uses it in the live **Explore** and **Read** goal panel. Select **Find useful support**, choose a language, response type, small goal, and time budget, then choose **Find my next step**. The panel can offer an authored cue, a diagnostic whose answer could change the best next action, or **Keep going**. It shows a task prediction with an uncertainty interval, explains the comparison, and can export the model record.

The model separates language, response mode, meaning, lexical base, pattern, word, context, and optional whole-form memory. Hierarchical variances control partial pooling; cross-language sharing requires an explicit mapping. The release includes **93 authored tasks across 12 languages**, plus **8 mappings for existing contrast tasks**. Morphological contrasts are a bounded Arabic, English, and Spanish slice; the remaining coverage is a small vocabulary set, not a complete curriculum.

Accepted first responses enter the existing actor-scoped immutable evidence ledger. Predictions remain separate from that ledger and do not become mastery certificates. Local asynchronous inference supports cancellation and makes one longer computation attempt if its initial sampling check is unstable. Guest, account, and team scopes remain distinct. No-data predictions are labelled as starting assumptions.

The decision objective is **one-step immediate task performance plus declared effort cost**. It respects no-practice and time limits. A supplied component predicts aided performance; lasting learning and retention gains remain unknown. The numerical and synthetic checks do not establish human learning benefit or linguistic measurement validity.

## Start and read

Use the normal local launcher: `python start_local.py` (Windows: `py -3 start_local.py`; macOS/Linux: `bash start-local.sh`). Open **http://127.0.0.1:8000/explore** or **http://127.0.0.1:8000/read**. Preserve your existing private database, settings, browser profile, and origin when upgrading; see the [1.15.0 release notes](docs/RELEASE_NOTES_1.15.0.md) and [current handoff](HANDOFF.md).

- [Task mappings and evidence conditions](docs/LEARNER_TASKS.md)
- [Decision mathematics, API, and assumptions](docs/LEARNER_DECISIONS.md)
- [Reproducible numerical evaluation](docs/learner-evaluation/results.md) and [full JSON results](docs/learner-evaluation/results.json)
- [Release verification record](docs/LEARNER_VERIFICATION.md) and [machine summary](verification/learner-release.json)
- [Learner model source](public/nabu-learner-model.js), [evidence bridge](public/nabu-learner-observations.js), and [decision source](public/nabu-learner-policy.js)
- [Learner research paper](paper/nabu-learner.pdf) and [editable LaTeX](paper/nabu-learner.tex)

Run `npm run test:learner`, `npm run test:learner-ui`, and `npm run test:api` for the model, DOM interaction, and backend suites. `npm run evaluate:learner` regenerates the evaluation; `npm run build` rebuilds the application. Build the current paper with `python tools/build_paper.py --paper nabu-learner` (requires a local TeX installation). DOM and API verification passed; native Chromium visual verification was blocked by this environment's socket policy and is not claimed. No deployment was performed.

Earlier sections below are retained historical documentation. Their version labels, implementation boundaries, and test counts describe earlier checkpoints; this preface and the 1.15.0 release notes supersede them.

---

# Previous checkpoint: a traceable graph foundation

The current release focuses on the graph inside the existing Nabu application. A typed incidence index preserves complete relations, language roles, source locations and uncertainty. Bounded queries now supply structural witnesses to the existing next-step engine; learner observations and recommendation scores remain separate. A complete pattern application is evaluated with all its declared inputs and context, rather than treated as unrelated pairwise implications. Live morphology applications remain unavailable; the application gate is tested with explicitly synthetic fixtures.

Start with **[NABU_GRAPH_FOUNDATION.md](NABU_GRAPH_FOUNDATION.md)** for the verified architecture, mathematical contract, implemented interfaces, real examples, compatibility decisions and immediate next step. **[docs/GRAPH_VERIFICATION.md](docs/GRAPH_VERIFICATION.md)** records the exact final tests and release boundary. **[docs/graph-evaluation/report.md](docs/graph-evaluation/report.md)** contains the reproducible structural evaluation. **[paper/](paper/)** contains the updated ICML-style paper, editable sources and the preserved previous evidence-loop paper. No human learning result is claimed.

Build: `nabu-graph-20261114-r1`. No database migration, runtime dependency, paid provider or credential is added. The existing bank, reader, intent ownership, evidence ledger and card schedules remain in use. The old graph export stays compatible; the new role-aware snapshot and query API are additive. The one documented preference correction makes an explicit `no-practice` preference behave like the already-supported “No quizzes” wording.

---

# Previous checkpoint: an auditable evidence loop

Prompt 3 extends the existing reader, authored practice and task-aware recommendations. Meaningful attempts now carry stable episode/attempt identities, exact source and reading references, first responses, assistance, and versioned rubric/scorer/analysis provenance in the existing event store. An optional ledger explains what changed and why. Help and skips do not become failures; display does not become comprehension; corrected retries do not become independent success.

Start with **[NABU_EVIDENCE_LOOP.md](NABU_EVIDENCE_LOOP.md)** for the working episode, architecture, scope/privacy boundaries, task catalogue, replay contract, tests and setup. **[docs/evidence-episode/README.md](docs/evidence-episode/README.md)** is the executable ledger/idempotency demonstration. **[docs/evidence-evaluation/report.md](docs/evidence-evaluation/report.md)** reports the fixed-seed synthetic experiments and their failures. **[paper/](paper/)** contains the accompanying ICML-style research draft and editable sources. These experiments do not claim human learning gains.

Historical build: `nabu-evidence-20261114-r1` at commit `dd8e829`. Prompt 3 added no database table, runtime dependency or paid provider. Restart the updated server to enable account evidence events; guest checks remain local. Existing card schedules and historical records are preserved. Code and the corresponding research paper are delivered together for this Nabu work.

---

# Nabu: intent-aware next steps

This source extends the existing Nabu 1.14.0 bundle with persistent intentions and optional next-step support in **Explore** and **Read**. A learner can say what they want to do now, add a broader destination if useful, choose a saved intention, or skip and explore. **Suggest a next step** uses current source content, explicit task context and bounded learner evidence to offer an actual local explanation, meaning comparison, optional existing activity or continued exploration. Team objectives remain separate from each member’s private immediate intention.

Read **[NABU_NEXT_STEP_ENGINE.md](NABU_NEXT_STEP_ENGINE.md)** for the verified architecture, source-quality findings, transparent policy, exact tests, limitations and Prompt 3 events/interfaces. **[NABU_INTENT_LAYER.md](NABU_INTENT_LAYER.md)** documents the completed Prompt 1 checkpoint. The existing reader, review schedules, content events, Structure Lens and recommendation APIs retain their contracts. No new runtime dependency, paid API, provider credential or remote parsing is required.

Guest intentions use the existing browser metadata store. Account/team intentions require the Nabu server and a connection for editing; they are not cached or queued locally. Startup creates two additive SQLite tables and indexes. Keep your existing private database and configuration when upgrading. No deployment or live-user data change was performed.

The bank and content remain authored, unreviewed drafts. The new structural bridge preserves ambiguity and provenance, withholds known context-sensitive kinship alignments from automatic suggestions and quarantines a suspect external PDF output record. It does not import a production morphology graph or claim learner gains. Full application fixtures are synthetic; `marciendo` itself is dictionary-listed and is not blacklisted.

Build identifier: `nabu-next-step-20261113-r1`. Intent/next-step schema version: `1`. Existing package/mobile version labels and the existing card/backup schema version were not changed. Historical release notes follow.

---

# Earlier frontend release: Nabu 1.13.0

That frontend release was 1.13.0. It preserves the Nabu 1.12.2 universal reader and adds an authored **Structure lens** for syntactically ambiguous sentences. Instead of forcing one parse, Nabu can show two plausible readings, run movement/substitution/coordination diagnostics, update relative support, recommend the next informative test, and explicitly remain inconclusive. See `STRUCTURE_LENS_1.13.md`.

Start at `/explore` or `/read`. Use `RUN_NABU_1.13.md` for safe upgrade instructions. No new provider key, paid service, database migration or automatic mastery update was added. The first release contains bounded English, Spanish and Arabic authored pilot cases; it is not an unrestricted parser.

---

# Nabu 1.12.2 - universal word + phrase support

Historical 1.12.2 release notes follow. That release began at `/explore`, or `/read` with any text in one of Nabu's 12 supported languages.
This patch keeps the six-item Explore MVP and Imru’ al-Qais content, then adds a universal reading layer: tap a word for a short meaning, see checked phrases around it when Nabu already knows them, and open **Read more** only for secondary detail. See `UNIVERSAL_SUPPORT_1.12.2.md`.
Read **RUN_NABU_1.12.md** for safe upgrade/run instructions, **MVP_1.12_REPORT.md** for the underlying MVP evidence and limits, **CONTENT_AUTHORING.md** for the six-piece catalogue, and **MVP_1.12_CONTROLS.md** for the core-flow control inventory.

Current architecture remains vanilla JavaScript/CSS with the existing Python bundle builder, FastAPI/Pydantic/SQLite and IndexedDB/account sync. No new runtime packages or provider keys. Source catalogue: `data/explore.json`; progress uses the existing meta store plus an additive private `content_events` table. Existing library data and schedules are preserved. Guest and account progress never silently mix. Native-device acceptance and independent Arabic editorial review remain open.

Windows: `py -3 start_local.py` or `Start-Nabu.cmd`. macOS/Linux: `bash start-local.sh`. Keep the server open; use `http://127.0.0.1:8000/explore` in the same browser/profile/origin. No deployment occurred.

The material below is retained historical documentation; earlier versions/test counts are not current verification. New release details above supersede older status/version statements.

---

# Nabu 1.11.0 - read what you choose

Implemented in the existing vanilla JavaScript/CSS + FastAPI/SQLite application.

Read **[RUN_NABU_1.11.md](RUN_NABU_1.11.md)** for safe upgrade and startup. Read
**[REDESIGN_REPORT.md](REDESIGN_REPORT.md)** for the baseline, implementation,
test evidence and limitations. Read **[MEANING_TOOLS.md](MEANING_TOOLS.md)** for
illustration concepts, licenses, supported reading schemes and provider boundaries.
The complete built website is included.

The reader now keeps content central, with contextual word support and explicit
saving, desktop side panels, phone sheets and preserved reading position.
`/words`, Quick lookup, Library, Review, Friends, Settings, existing audio and
the Chrome extension remain available. No database migration, new dependency,
paid service or new credential was introduced.

Back up before upgrading. Preserve `.env.local`, `.data/`, `.venv/` and browser data.
This archive does not contain your private configuration or database.

## Start

Install Python **3.11 or newer**, extract this whole folder, and run the launcher for your operating system:

| System | Launcher |
|---|---|
| Windows | Double-click `Start-Nabu.cmd`, or run `py -3 start_local.py` in this folder. |
| macOS | Run `bash start-local.sh` in Terminal. `Start-Nabu.command` is also included. |
| Linux | Run `bash start-local.sh`. |

The launcher creates `.venv`, installs the pinned Python dependencies, creates a private `.env.local` from the supplied template, and starts the backend **and** the built website. The initial dependency download needs internet access. Future runs reuse the environment unless requirements change.

Open **http://127.0.0.1:8000/read**. The original `/words` and `/` routes still work. Keep the terminal open; Ctrl+C stops Nabu. Do not open `public/index.html` as a file and expect account features to work. Do not use the static-only server for full-stack testing.

If Python cannot create a virtual environment on Linux, install your distribution's Python venv package. If a macOS double-click launcher is blocked, use the Terminal command above; no security setting needs to be disabled.

## What's in the app

A 1,026-entry bank (900 word meanings, 90 everyday phrases, 36 expressions) across twelve languages; auto-saved translations; sense-aware cards; contextual reading; 2D meaning maps with optional projected 3D; bounded language-specific reading aids and term concatenation; five-minute reviews; Learning/Reference/Archived states; accounts and one-use recovery codes; offline account queues; friends and word exchange; permissioned collaborative collections; short word links; backups and import/export.

The prior 1.9.0 release added **persistent account-private translation memory**, usage counters, local startup scripts, and safety fixes. Those remain in place. See [HANDOFF.md](HANDOFF.md) for exact changes, [FEATURE_STATUS.md](FEATURE_STATUS.md) for limitations, and [TEST_REPORT.md](TEST_REPORT.md) for evidence.

## Accounts

Open **Friends -> Create account** and choose your own handle and password. Save the recovery code privately. Use a second browser profile or a private window for Patrick's test account, then add each other by handle. Do not use two ordinary tabs as two accounts: they share the login cookie.

Accounts live in `.data/nabu.sqlite3` on **this computer**. They are not automatically public or hosted. No default usernames, passwords, API keys, or populated database are included.

## Optional providers

Edit the automatically created `.env.local` privately, then restart the app:

```dotenv
DEEPL_API_KEY=your_private_key
ELEVENLABS_API_KEY=your_private_key
ELEVENLABS_VOICE_ID=your_licensed_voice_id
```

Without keys, the bundled bank and account/social/review features still work. For pronunciation without cloud speech, choose **Settings & data -> Voice -> Device voice**. Availability and sound depend on the voices installed in your browser/OS. Cloud requests require configuration, sign-in and the relevant consent.

Never commit or share `.env.local`, `.env`, your `.data` folder, or recovery codes. The public directory is the only served directory.

## Keep your work

- The server database is `.data/nabu.sqlite3`. Local automatic snapshots are written under `.data/backups` when enabled. Same-disk snapshots are not off-server protection.
- Guest cards and offline queues also use browser storage. Keep using the exact address `http://127.0.0.1:8000/`; a different hostname or port is a different browser-storage origin.
- Export your existing Pages library before moving to localhost. It does not migrate automatically.
- Do not replace an existing database with a file from a backup or another ZIP. Use the provided restore tools to a **new** destination.

Detailed instructions: [START_HERE.md](START_HERE.md). Suggested manual test: [LOCAL_TEST_CHECKLIST.md](LOCAL_TEST_CHECKLIST.md).
