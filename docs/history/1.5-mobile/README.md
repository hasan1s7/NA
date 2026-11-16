# Nabu 1.5.1: translate, keep, practise, connect

Release `nabu-audit-20261105-r1`. Full application source, not a
GitHub Pages patch. **No public service or database was deployed in this session.**

See `HANDOFF.md` and `TEST_REPORT.md` for this release: **452 checks passed**, with native hosted-browser and language-review gates still open. Fresh desktop/mobile feature captures are under `bank-test-results/`.

This maintenance release fixes invalid sync acknowledgments, wrong-direction reverse-card details, dropped online review modes, reflected validation secrets, duplicate collection corrections, and misleading backup-monitor status. See `HANDOFF.md` for the exact changes. Restart the backend during deployment so its CSP matches the rebuilt page.

## Everyday flow

Translate a word or phrase; it saves automatically as **Reference**. Choose
**Learn this** to practise it. Existing Learning cards keep their schedules.
Settings can put new translations straight into Learning instead.

The interface stays centred on **Translate, Library, Review, Friends**. Translate
contains the word bank and **Read a text**: paste up to 15,000 characters, tap a
word or select a phrase, and keep the surrounding sentence. The document is not
silently uploaded. A requested nonlocal lookup can send the selection and its
sentence to the configured provider, subject to the existing disclosures.

The authored vocabulary has 900 word senses, 90 common phrases and 36
source-language expressions across 12 languages. The bank now filters by type and
topic, searches all 1,026 entries, and renders 60 rows at a time. Phrase entries now include usage guidance,
example dialogues, possible replies and explicit draft provenance. Meaning and
literal wording are separate. Idiom-origin literal renderings are built in;
other English wording guides can be localized into the chosen target language
through an explicit DeepL request. These are approximate guides, not morphological
analyses. The language content has not been certified by native reviewers.

## Accounts that distinguish local saves from server confirmation

New servers use an account-specific IndexedDB cache and a durable operation queue.
Changes persist on the device before the interface reports a local save. Each
queued operation has a stable UUID, expected revision and original timestamp.
The server commits changes and idempotency receipts together. A lost response can
be retried without adding a second word or counting a review twice.

The header and Sync panel distinguish pending, syncing, synced, offline,
conflict and sign-in-required states. Sync runs while the app is open. Working
offline requires opening that account online once. Real browser persistence and
service-worker installation still require the deployed acceptance checks below.
Clearing browser storage can lose unsynced work: export before clearing anything.

A conflict is not automatically overwritten. Export the queue, then choose to
apply the first change to the current server version or explicitly discard the
queue and use the server version. Discarding affects all dependent queued changes;
an audit copy is retained locally. Review retry records the review at the retry
time. The sync panel explains these consequences before the action.

Account caches are separate from guest cards and each other. An explicit sign-out
removes the current account cache after its queue has drained. Known expired
sessions stay locked even offline. Reconnect and sign in to recover pending work.
A different browser origin cannot read an old site's local library.

## Password recovery

Registration displays a random one-use recovery code. Save it in a password
manager. The server stores its hash, not the plaintext code. Recovery changes the
password, revokes all sessions and returns a replacement code. A signed-in user
can replace the code with their current password. Closed dialogs clear secret
inputs from the DOM.

Older accounts must generate a code from account settings while signed in. There
is no email collection, email reset delivery, identity-provider login or support
bypass. Without the password or a valid stored code, self-service recovery is not
available. Recovery codes are not included in library backups.

## Five-minute review

Choose mixed practice, meaning recall, production, listening or sentence
completion. Each mode has independent scheduling evidence. Listening requires a
configured voice provider; cloze requires matching context or an example. Ratings
are self-assessments, not automated pronunciation or proficiency scoring. Undo
restores the prior state without overwriting later edits.

The evidence view separates attempts, practice time and self-rated delayed recall
(at least 24 hours after a prior review of the same skill). It does not claim
causal learning gains or certified fluency.

The production scheduler remains the existing documented SM-2-inspired policy.
`tools/evaluate_fsrs.py` is an optional read-only replay using the official
`fsrs` package. Its parser was tested; execution with that optional dependency
was not possible here. It does not fit parameters or alter production schedules.
See `docs/FSRS_DECISION.md` before any scheduling migration.

## Collaborative collections

Friends, direct word exchange, blocking and private library imports remain.
Shared collections now have viewer and contributor roles. Contributors propose
new entries or corrections; only the owner publishes them. Collection versions,
revision checks and before/after history make approvals inspectable. Stale
proposals must be resubmitted. Removing friendship or access revokes future access.

Approvals update shared content, not anyone's private notes or review schedule.
Imported copies remain independent. **Import new words** skips existing identities;
it does not overwrite previously imported corrections. Revocation cannot erase
another user's saved copy. Context is shared, so review it for confidential text.

A Friends badge shows pending requests, words and owner proposals. Optional browser
notifications require an explicit click and permission. They operate only while
Nabu is open and polling; this is not background push delivery.

## Run

Docker Compose reads the private `.env` file:

```bash
cp .env.example .env
# Edit privately. Keep .env out of Git.
docker compose up --build -d
```

Open `http://localhost:8000` exactly. Docker build execution was not available here;
its dependency-copy paths are covered by a static test, not a container-build test.

Native Python alternative:

```bash
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
NABU_ORIGIN=http://localhost:8000 NABU_DB=.data/nabu.sqlite3 NABU_OPEN_SIGNUP=true NABU_BACKUP_ENABLED=true python server.py
```

`python server.py` does not automatically read `.env`; export its settings or use
Compose. Serve the frontend and API together on one origin. `npm run serve` is a
static preview and cannot provide account services.

## Deployment and operations

`render.yaml` describes one paid Python service with a persistent disk, not a
resource already created. Review charges in the hosting dashboard. Keep the app
single-instance; its SQLite deployment is for a pilot, not horizontal scaling.
Keep `NABU_DB` on durable storage and use the exact HTTPS `NABU_ORIGIN` for a custom
domain. Existing schema v1/v2 upgrades additively to v3. Back up before upgrading;
do not run old code against a migrated database.

When `NABU_BACKUP_ENABLED=true`, the running server creates consistent SQLite
snapshots every six hours by default and retains seven successful local copies.
Optional S3-compatible uploads encrypt snapshots with a privately configured
Fernet key before transmission. A private bucket, credentials, HTTPS endpoint
(if non-AWS) and encryption key must be supplied. They were not provisioned here.
The in-memory encrypted-backup helper caps snapshots at 64 MB; larger deployments
need a streaming backup design or managed database, not a larger blind allocation.

Monitor backup freshness with `tools/backup_status.py --require-offsite`.
`tools/restore_database.py` validates integrity, refuses to overwrite an existing
path and invalidates restored sessions. Full recovery instructions are in
`START_HERE.md`. Local snapshots alone do not protect against losing the disk.

Existing operational limits remain: 5,000 cards per account, 50 per import batch,
300 entries and 30 initial recipients per shared collection. The offline outbox
caps at 1,000 operations. Use invitations for a controlled beta. Security
safeguards and tests are not an independent audit. Device caches are not encrypted
by Nabu; sign out on shared devices. Deleted/revoked content may remain in other
previously authorized offline caches or independently saved copies.

## Test and build

```bash
pip install -r requirements-dev.txt
npm run build
npm test
python -m pytest -q
npm run test:ui
```

`test:ui` is explicitly fixture-based for URL/history, IndexedDB and transport,
with real rendering and the actual SQLite/API implementation. This runtime blocks
ordinary Chromium URL navigation. Native acceptance scripts are included but not
claimed as passed:

```bash
python tests/browser_smoke.py --url https://YOUR-SITE/
# Explicitly authorizes temporary account creation and deletion on that server:
python tests/hosted_accounts.py --url https://YOUR-SITE/ --allow-test-accounts
```

Run the manual two-device, disconnect, restart and restore checklist in
`START_HERE.md` before depending on the hosted service. Live translation/audio,
real offsite storage, native notifications and FSRS package execution remain
unverified. Detailed counts and boundaries are in `TEST_REPORT.md`.

### Latest continuation

The 2026-11-05 Nabu **1.4.1** continuation adds multi-tab account sync locking, honest warm-cache indicators, encrypted offsite backup checksums and an isolated *remote-download restore drill*. It retains existing accounts, one-use password recovery, natural/literal phrase cards, reviews, friends, shared collections and contextual reading. **Start with `HANDOFF.md` and `TEST_REPORT.md`** for verified scope, exact changes and deployment limits. This source package is not hosted.
