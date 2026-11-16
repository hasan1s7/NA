# Nabu 1.3.0 verification

Build: `nabu-social-phrases-20261104-r1`.
Checked 2026-11-04. **292 checks passed:** 115 JavaScript tests, 146 Python/API
tests, 17 integrated social-UI checks and 14 startup-browser checks.

## Executed

| Suite | Result | Scope |
| --- | --- | --- |
| `npm test` | 115 passed | Core scheduling, autosave, graph completeness/connectivity, phrase semantics, storage-adapter isolation, speech helpers and startup safeguards |
| `python -m pytest -q` | 146 passed | Existing auth/providers plus 49 new social/library/database/backup checks |
| `python tests/social_browser.py` | 17 passed | Chromium UI with real FastAPI auth and temporary SQLite database, using explicit browser-boundary fixtures |
| `python tests/startup_browser.py` | 14 passed | Compiled standalone HTML, exact CSP, error recovery, layout and storage-timeout handling |

The JavaScript graph suite iterates all 45,144 directed meaning translations;
this is structural coverage, not 45,144 independent language-quality reviews.
The phrase suite checks 30 phrases with 12 English glosses each, 12 original
idioms, 132 source-idiom literal directions, natural/literal separation, reverse
meaning lookup and curly-apostrophe matching. The bank is not native-reviewed.

## Backend checks

New checks cover account isolation, restart reconstruction against the same
SQLite file, sign-in from another session, expected-account guards, duplicate
preservation, sense-aware identity, optimistic editing conflicts, authoritative
review scheduling, undo revisions, archive/restore, import schedules, friend
request/recipient acceptance, unauthorized IDs, self/duplicate requests,
read-only snapshot access, private-field exclusion, friend-only recipients,
versioned updates, per-recipient revocation, whole-share revocation, blocking,
unfriend/re-friend access, account deletion, input validation, additive v1-to-v2
schema migration and consistent SQLite backup integrity.

The existing provider suite uses mocked responses. No real DeepL or ElevenLabs
request, charge or voice audition occurred for this release.

## Integrated UI checks

The integrated harness executes the shipped application against the real API
and SQLite implementation. It creates Alice and Bob, imports guest words only
after confirmation, auto-saves translations, shows distinct natural/literal
results, records a review, sends and accepts a friend request, sends a word,
accepts it in one click, shares/imports a collection, checks mobile/RTL layout,
loads saved data in a second Alice session, revokes a share, verifies recipient
copies remain, signs out to the separate guest library, and confirms a failed
account save is visibly unsaved. No uncaught application errors were observed.

The friends-entry refresh race found during testing was corrected: a refresh
no longer discards a handle while the friend-request form is being edited.

## Browser boundary and exact limitations

A normal navigation attempt to the local HTTP test server failed with
`net::ERR_BLOCKED_BY_ADMINISTRATOR` in this execution environment. The test code
does not bypass that restriction. Instead, HTML is loaded with `set_content`.

The social harness explicitly replaces URL/history, supplies an in-memory
IndexedDB request interface, and bridges fetch to FastAPI TestClient. Server
sessions and database operations are real, but native cookie delivery is not
verified. The harness updates its CSP hash only to authorize that explicit test
bridge; the shipped bundle contains no bridge or test accounts.

Startup checks separately run the exact shipping script/CSP hashes. Successful
startup uses the storage request fixture. The denied-storage case uses the
browser's real storage implementation on about:blank. Timeout checks use a
controlled clock. Neither suite proves disk persistence in real browser
IndexedDB, offline installation, real service-worker lifecycle, production HTTPS
cookies or behavior on the deployed domain.

An earlier startup run stalled on a wall-clock timeout fixture and was terminated.
The timeout test now uses a controlled browser clock; the complete final run
passed all 14 checks. The application storage timeout itself was not removed.

## Still requires deployment validation

No Render service, public database or GitHub deployment was created. Render was
available but not connected. The included YAML is a deployment configuration,
not a live hosting result. The Docker image was not built here. Verify actual
Python package installation, disk attachment, exact origin, TLS/session cookies,
health check, restart persistence and backups after deployment.

Run the two-account acceptance checklist in START_HERE.md on your real domain.
Verify actual provider credentials and voice quality separately when enabling
paid services. Complete a real browser persistence/offline test before relying
on guest storage or installing the app for other users.

## Product limitations that tests do not erase

Account libraries require connectivity; there is no offline write queue.
Guest data is separate; local import preserves schedules but not historical
review-event logs. Settings remain on-device. Shares are read-only versioned
snapshots, not live collaborative documents. Saved copies cannot be recalled.
The server is a single-instance SQLite pilot, not managed Postgres or a
multi-node system. Email verification and self-service password reset are not
implemented. No independent security review or native-language review is claimed.

## Evidence

`verification/` contains the final console logs, structured UI results and a
SHA-256 source manifest. Historical reports and superseded browser harnesses are
kept under `docs/history/` and `tests/legacy/`; they are not current pass evidence.
