# Prompt 1: implemented intent layer

Checkpoint date: 13 November 2026. This is an additive implementation on the supplied `nabu-local-1.14.0.zip` source. The starting workspace had no checkout; the existing source archive was retrieved and inspected. No remote Git repository was changed or deployment performed.

## What the inspected application actually contained

- Vanilla JavaScript modules and CSS in `public/`, bundled into CSP-hashed `public/index.html` by `tools/build_standalone.py`. The service worker caches the matching application shell, not account API responses.
- FastAPI/Pydantic and SQLite; session authentication, origin/CSRF checks, and an `X-Nabu-Account` guard already existed.
- Guest IndexedDB with `cards`, `logs`, `meta`, `cache`, and `history`, plus existing account library synchronization and offline queues.
- A reader with contextual word/phrase support; six curated Arabic texts with eighteen authored practice activities; a separate authored Structure Lens.
- SM-2-inspired card schedules, independent recognition/production/listening/cloze modes, and self-rated review logs. This is not an implemented Bayesian learner posterior.
- Existing practice/content/syntax heuristics and `GET /api/decisions`, including tenant memberships and four individual/enterprise modes. There was no persistent immediate-intent representation or organizational-objective store.

Existing package/mobile version labels are historical; the source archive's 1.14 backend additions coexist with a package labeled 1.13. This increment identifies itself with build `nabu-intent-20261113-r1` and intent schema version `1`; card and backup schema versions were not changed.

## Behavior implemented

Explore and Read contain an optional **Right now** control. A learner can enter a short intention, select a previous one, correct optional details, or skip and explore. Editing only replaces the intent panel, not the reader or its media nodes. The UI uses existing styling, native labeled controls, responsive CSS, and `dir="auto"` for user text.

An intent stores an immediate activity separately from an optional destination and time horizon. Languages, modalities, source reference, context, constraints, and preferences are optional. Unknown fields are null or empty arrays with unknown provenance. Each populated field records explicit/inferred/exploratory provenance and its source; parser version is retained. The original statement is preserved verbatim. Editing a statement invalidates old extractions unless the learner explicitly supplies field corrections in the same edit.

Lifecycle is `active`, `paused`, `completed`, or `abandoned`, with creation, update, and status-change timestamps and optimistic revisions. Completing an intention is a planning action, not a learning result. Moving an intent out of active clears its current selection. Resuming does not automatically select it. Deletion is available with confirmation in the UI.

Guest intentions use the existing IndexedDB `meta` store. Signed-in intentions use server storage and are not cached or queued locally. A persistent skip sets selection to `exploring` without inventing an empty goal. If storage is unavailable, exploration can be selected for the current tab, with an explicit unsaved notice; it never silently writes account data into the guest store.

Team contexts reuse existing tenant memberships. Team objectives are member-readable and owner-writable. Each learner's immediate intent and current selection remain private and separately scoped by user and team; even the owner cannot read another member's private intent. There is one active organizational objective per team, with inactive history retained. Teams may explore without a destination. A team owner can create a context and an objective through the intent panel; membership administration remains the existing API.

## Conservative local parsing

The default parser performs no network requests. It recognizes a bounded set of explicit constructions, preserves ambiguous statements, and leaves unsupported details unknown. It does not infer Spanish from Mexican identity, resolve dates, infer proficiency, or claim broad multilingual semantic understanding. All supported fields can be corrected manually.

Examples in `tests/fixtures/intents.json` are fictional test data, not real user records:

| Case | Stored distinction |
| --- | --- |
| Meet Alexandra's Mexican mamá and make a good impression | Meeting is the immediate activity; impression is a stated destination; language remains unknown |
| Explore Arabic poetry without an end goal | Exploratory intent, Arabic explicit, destination absent |
| Team practicing Spanish support calls | Shared team objective and private learner task remain separate |
| Team exploring poetry without a destination | Valid exploratory team context; no required endpoint |

The parser ignores topic-clause language/modality mentions when deciding the activity: reading an article **about public speaking** does not assert that the user is practicing speaking. An optional adapter interface requires an explicitly supplied parser and explicit per-call permission; it is not connected to a provider or surfaced as cloud parsing in the UI. Provider suggestions remain inferred until user correction/confirmation.

## Data and API contracts

Records have `schemaVersion`, `id`, server-derived `ownerUserId`, `tenantId`, `kind` (`learner` or `organization`), content fields, lifecycle, provenance, timestamps, and revision. Source content is an ID and optional version, not a copy of a paragraph or audio.

| Endpoint | Contract |
| --- | --- |
| `GET /api/intent-tenants` | Accessible real team memberships |
| `GET /api/intents?tenantId=...` | Private learner intents, shared organizational objectives, selection and role |
| `POST /api/intents` | `{id, tenantId, kind, content}`; server stamps ownership/timestamps; active learner creation atomically selects |
| `PATCH /api/intents/{id}?tenantId=...` | `{revision, content}`; ownership and kind cannot change |
| `DELETE /api/intents/{id}?tenantId=...` | `{revision}`; clears live record and selection |
| `PUT /api/intent-selection?tenantId=...` | `{mode: "none"|"selected"|"exploring", intentId}` |
| `GET /api/intent-context?tenantId=...` | Read-only active scoped context for a later recommendation layer |

Omit `tenantId` for the individual context. Scope and membership are rechecked server-side. Mutations use existing authentication and CSRF. Create retries reuse the same per-draft ID; matching retries return the already-created record without creating duplicates. Conflicting edits return a revision conflict rather than silently overwriting.

## Prompt 2 interface

`intentStore.getContext()` and the authenticated context endpoint expose the same semantic boundary:

```ts
{
  schemaVersion: 1,
  actor: { kind: 'individual' | 'team', userId: string | null, tenantId: string | null },
  selection: { mode: 'none' | 'selected' | 'exploring', intentId: string | null },
  immediateIntent: IntentRecord | null,
  organizationObjective: IntentRecord | null
}
```

Only an active, selected private intent enters `immediateIntent`. The active organization objective is separate. A missing destination is valid. Provenance must survive consumption; inferred fields must not become confirmed goals. Intent changes do not modify cards, review logs, content events, Structure Lens evidence, or recommendation rankings. Prompt 1 did not implement new ranking.

## Files changed at the Prompt 1 checkpoint

- `intents.py`, `server.py`: validation, additive tables, scoped authenticated CRUD/context, capability flag.
- `public/nabu-intents.js`, `public/nabu-intent-store.js`: schema, parser, provenance, guest persistence, account API adapter and race protection.
- `public/nabu-intent-ui.js`, `public/nabu-intent.css`, `public/nabu-app.js`: optional existing-screen integration and working controls.
- `tools/build_standalone.py`, `public/index.html`, `public/nabu-sw.js`: embedded modules/CSS and matching build identifier/CSP hashes.
- `tests/intents.test.mjs`, `tests/intent-store.test.mjs`, `tests/test_intents.py`, `tests/intent-ui.dom.mjs`, `tests/fixtures/intents.json`: model, storage, API, DOM, and four-case fixtures.
- `README.md`, `package.json`, this document: handoff and optional focused test commands.

## Exact verification at the checkpoint

| Command | Baseline | After implementation |
| --- | ---: | ---: |
| `npm test` | 410 passed | 467 passed; zero failed/skipped |
| `python -m pytest -q` | 314 passed | 363 passed; zero failed, two dependency deprecation warnings |
| `node --test tests/intents.test.mjs tests/intent-store.test.mjs` | New | 57 passed |
| `python -m pytest -q tests/test_intents.py` | New | 49 passed |
| `NABU_TEST_JSDOM=/absolute/path/to/jsdom/lib/api.js node --test tests/intent-ui.dom.mjs` | New | 12 passed; zero failed/skipped |
| `python tools/build_standalone.py` | Existing builder | Successful; exact CSP-hash/startup checks included in `npm test` |

The focused tests are subsets of the full Node/Python totals, not additional tests to double-count. The twelve DOM tests are separate. They run real handlers, model/store code and the shipping self-contained bundle. They verify optional-field correction, all exposed intent-action handlers and labels, lifecycle, source/media node preservation, team/private separation, temporary exploration, and lost-acknowledgement retry.

Test environment: Node 24.22.1; Python 3.12.14; FastAPI 0.141.1; Pydantic 2.13.4; HTTPX 0.28.1; pytest 9.2.0. The tests used installed runtime dependencies rather than reinstalling the production pins. jsdom 31.0.1 was installed only as an external test tool, not an application dependency. To rerun the optional DOM suite, install jsdom in a separate test directory and set `NABU_TEST_JSDOM` to its `lib/api.js`, or make it locally resolvable.

The historical Chromium startup script was attempted but could not launch: the environment rejected Chromium's process-singleton socket with `Operation not permitted`. Consequently, these results do not establish native browser layout, screen-reader behavior, real IndexedDB disk durability, cookies, service-worker lifecycle, scroll/pixel fidelity or playback continuity. Responsive/RTL CSS and semantic controls are implemented; native-device visual acceptance remains unverified.

## Setup, migration, and privacy limits

Use the existing launcher and origin. The built website is included; no new runtime dependency, API credential, or provider setup is required. Preserve private configuration, `.data/`, virtual environments and browser data when upgrading. Back up the SQLite database before starting the new code.

Startup creates `nabu_intents`, `nabu_intent_selections`, and indexes using `CREATE ... IF NOT EXISTS`. It does not change `PRAGMA user_version` or alter existing tables. Guests use metadata key `nabu.intent.v1:guest` without changing the IndexedDB schema. Existing word-library export/import formats remain unchanged; they do not include the new intentions. Server backups include their SQLite tables.

Account editing is online-only; guest-to-account import and an offline account intent queue are not implemented. Current team context defaults to individual on page load; choosing the team again restores that scope's records and selection. Each private scope and each team objective history is capped at 200 records. Raw personal text is saved only when the learner chooses to save it; no automatic third-party parser or analytics call is introduced.

This implements the existing account/membership boundaries, not an enterprise security certification or administration product. Existing account/tenant deletion cascades apply. Deleting a live record does not erase historical database backups. Browser-local guest separation is not authentication or encryption, and there is no claim of native multi-device acceptance, calibrated parsing quality, or learning benefit.
