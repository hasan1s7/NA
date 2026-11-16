# Nabu 1.4 verification

Release: `nabu-connected-learning-20261105-r1`.
Checked: 2026-11-05. **390 checks passed in the final runs.**

| Executed suite | Result | Scope |
| --- | ---: | --- |
| `node --test tests/*.test.mjs` | 157 passed | Core scheduling, graph, phrases, autosave, speech, account adapters, offline queue and startup helpers |
| `python -m pytest -q` | 189 passed | Real FastAPI/SQLite operations, auth, recovery, providers with mocked upstream responses, collaborative collections, sync receipts, backups and operations helpers |
| `python tests/next_browser.py` | 30 passed | Integrated Chromium application flow, real FastAPI and SQLite, with explicit browser-boundary fixtures |
| `python tests/startup_browser.py` | 14 passed | Standalone bundle, exact shipped CSP hashes, startup recovery and responsive rendering |
| **Total** | **390 passed** | Not 390 live-production or independent linguistic validations |

JavaScript final run: 1.90 seconds. Python final run: 36.78 seconds. These are
observed test durations, not estimates for deployment or future work.

## What was exercised

### Account recovery and isolation

Registration issues a one-use recovery code. Tests verify that only its hash is
stored, successful recovery invalidates existing sessions, reuse fails, replacement
codes work, password-confirmed rotation is enforced, and recovery preserves cards.
Generic recovery errors, rate limits and existing authentication guards remain.
Integrated tests use two accounts and a second session for the first account.
Guest words are imported only through an explicit action; sign-out clears the
account cache without removing the guest library. A known expired account stays
locked when subsequently offline.

### Retry-safe offline synchronization

Tests cover durable queue writes before a local success indication, reopening a
remembered account cache, offline edits, interrupted fetches, lost acknowledgments,
duplicate operation receipts, account mismatches, late responses after an account
switch, concurrent metadata writes, card-ID remapping, optimistic revision
conflicts, export and explicit conflict resolution, and per-skill review/undo.
The integrated lost-acknowledgment case reaches the actual server and then retries:
one card remains, not two. Server receipts survive a database reopen.

Clearing a library scrubs private returned card content from receipts but preserves
idempotency tombstones so an old acknowledged operation cannot resurrect it.
Account deletion clears the matching device cache. Guest cleanup cannot silently
remove another account's pending work.

### Learning, phrases and reading

Automatic translations enter Reference unless the user enables automatic Learning.
Reference and archived items do not become review homework. Tests cover independent
meaning, production, listening and cloze schedules, undo, daily introduction limits,
Unicode-aware cloze matching, context capture, imports and delayed self-rated
recall evidence. The integrated review test saves a production result separately
from recognition, then undoes it.

The reading UI preserves the pasted text, translates selected words or phrases,
retains the surrounding sentence and deduplicates repeated encounters. The complete
pasted document is not silently uploaded. Unknown selections still need a configured
translation service or manual translation.

The bank remains 342 meanings: 300 word senses, 30 everyday phrases and 12 idioms
across 12 languages. Structural tests traverse 45,144 directed meaning translations.
All 42 phrase/expression entries have usage/provenance and language-specific example
and possible-reply fields. This does not certify their linguistic accuracy.
Original-idiom literal directions are built in. Other non-English phrase glosses
need an explicit configured DeepL request; upstream requests were mocked here.

### Friends and collaborative collections

Tests exercise friend requests/acceptance, direct word exchange, recipient access,
viewer/contributor roles, proposed entries and corrections, owner-only approvals,
stale revisions, version and before/after history, revocation/unfriending and
private-field exclusion. An approval changes the shared collection without altering
private cards. Import skips existing identities and starts independent progress for
new entries. The integrated flow uses two actual API accounts and the SQLite store.

### Backups and operations

Tests create consistent SQLite snapshots and check integrity and foreign keys.
Encrypted upload tests use a fake S3-compatible client: they inspect the uploaded
ciphertext, decrypt and restore it into a new database, verify content, and confirm
restored sessions are invalidated. Wrong keys, corrupt snapshots, overwrite refusal,
local retention, missing credentials, failed transport, and backup freshness checks
are covered. No real bucket or off-server transfer was configured or exercised.

The Dockerfile's required module/tool copy paths have a static regression test.
Docker itself was unavailable, so no container build ran. The optional FSRS helper's
input parsing and non-mutating behavior were tested. Installing its optional
`fsrs` dependency failed because package-network resolution was unavailable; actual
FSRS replay and its output remain unverified. Production scheduling was not changed.

## Browser boundaries: what these passes do not establish

A normal browser navigation to the local server failed with
`net::ERR_BLOCKED_BY_ADMINISTRATOR` in this environment. The tests do not bypass
that restriction. They render the app with `set_content`, supply explicit URL/history
and in-memory IndexedDB request fixtures, and bridge fetch to FastAPI TestClient.
Rendering, UI event handling, application code, API behavior and SQLite operations
are real. Native browser persistence and cookie delivery are not established by
that bridge. Its authorization is limited to the harness; the shipping HTML has
no bridge or test accounts.

The startup suite separately executes the exact shipped script/CSP hashes. Its
successful-storage case uses a fixture. Denied storage is tested against actual
about:blank browser storage; hanging-storage timing uses a controlled clock.
Mobile reading and Friends layouts have no horizontal overflow in these checks.
No uncaught JavaScript errors occurred in the 30-check integrated flow.

The screenshot evidence is under `next-test-results/`. A full-page mobile image can
show the fixed navigation at the capture viewport boundary; that is not evidence
of an element permanently obstructing the document during scrolling.

## Required live acceptance gates

No public site, hosting service, production database, S3 bucket or external monitor
was created. The Render connector was not enabled. The deployment configuration
is supplied, not deployed. Complete the checklist in `START_HERE.md` before inviting
users to rely on the app:

- Confirm installation, HTTPS origin/cookies, persistent disk and server restart.
- Run native-browser IndexedDB persistence, actual service-worker install/update,
  offline reload, reconnection, two-device conflicts and account isolation.
- Save and exercise recovery codes; check that old sessions lose access.
- Configure offsite credentials, verify a real encrypted upload and restore it on
  an isolated instance; configure alerts and bucket retention.
- Validate provider credentials, quotas, voice/model availability and actual sound
  quality. No live DeepL/ElevenLabs requests or voice auditions ran here.
- Verify opt-in notification permissions on target browsers. Notifications are
  foreground-only, not background push delivery.

`tests/browser_smoke.py` and `tests/hosted_accounts.py` are included for these native
checks but were not executed successfully against a hosted site. The latter requires
`--allow-test-accounts`; it creates and attempts to delete disposable accounts.
`tests/social_browser.py` is the older 1.3 harness, retained as historical source;
it is not included in the current pass count.

## Remaining limitations

- Recovery uses a saved code, not email. Without a password or valid code there is
  no self-service recovery bypass. Older accounts must generate a code while signed in.
- Account offline use requires a previously initialized cache; sync runs only while
  Nabu is open. Clearing device data destroys unsynced work. Sign-out blocks pending
  work. Conflict resolution is explicit, not automatic merging.
- Shared collections are versioned, approval-based contributions, not simultaneous
  document editing. Existing imported copies are not automatically rewritten by
  subsequent corrections. Revocation cannot erase already saved copies.
- The backend is one SQLite instance, not a multi-node managed database platform.
  Sync receipt history is retained for idempotency and needs future capacity planning.
- Local snapshots alone are not disaster recovery. Remote encryption helper cap is
  64 MB. Repeated failed uploads retain local files, requiring disk monitoring.
- Phrase data and examples are authored drafts, not native-reviewed. Non-English
  ordinary-phrase literal guides depend on a configured provider.
- Production scheduling remains SM-2-inspired, not FSRS. Ratings and delayed evidence
  are self-reports, not automated speech evaluation or proven learning efficacy.
- No independent security review, accessibility certification, load test or production
  reliability guarantee is claimed. Device settings and old guest review logs do not
  automatically synchronize between accounts/devices.

## Evidence included

`verification/` contains the four final console logs, structured browser results,
count summary and a SHA-256 manifest of the packaged source files. Earlier reports
under `docs/history/` describe their historical releases only.
