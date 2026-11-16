# Nabu 1.5.1 - checked, repaired full source

Date: November 5, 2026. Build: `nabu-audit-20261105-r1`.

## Source and scope

The actual attached `nabu-next-release.zip` (1.5.0) was present, inspected and extracted into a separate work directory. Its `HANDOFF.md`, `TEST_REPORT.md`, source and tests were read. The original archive was not overwritten. Prior handoff/report are retained under `docs/history/1.5.0-*`.

This is a reliability/privacy correction release, not another expansion. It retains 900 word meanings, 90 practical phrases and 36 expressions across twelve languages, with existing accounts, recovery codes, offline outbox, five-minute practice, contextual reading, friends, word exchange and moderated collaborative collections.

## Exact implementation corrections

1. **Invalid sync data cannot retire pending work.** `public/nabu-sync.js` now validates library structure, card/scheduler records, review records, history and duplicate-ID mappings before persisting a server response or removing an acknowledged operation. Initial load, normal refresh and conflict resolution use the same validation. A rejected response keeps the last confirmed cache and original queued operations. The UI does not say Synced. Initial cache creation also accounts for work queued by another tab while its request was in flight.
2. **Review mode is not silently lost on the online-only adapter.** `public/nabu-account-store.js` now sends non-default `practiceMode` to the server. Recognition keeps its backward-compatible payload. This prevents a production/listening/cloze request taking the recognition path in that adapter; the normal offline-sync route already transmitted the mode.
3. **Reverse cards no longer inherit wrong-direction details.** `public/nabu-core.js` clears literal wording, usage, example, reply and context when reversing the language pair. Notes and provenance remain, and the reversed card receives an independent schedule. Bank-linked displays can derive fresh direction-specific details from their concept ID. Custom content is not automatically retranslated.
4. **Validation failures do not echo private inputs.** `server.py` handles FastAPI request-validation errors with a generic 422 message instead of returning rejected values, including passwords, recovery codes or private payloads. Normal explicit authentication and revision errors retain their existing behavior.
5. **Corrections cannot duplicate another shared entry.** `upgrades.py` rejects an accepted correction that would create a duplicate identity in the collection. The rejection leaves the collection revision, proposal status and private learner cards untouched.
6. **A failed restore drill cannot leave an old success receipt green.** `tools/verify_offsite_backup.py` now atomically writes the latest failed attempt as a private failure receipt, without SDK exception messages or credentials. If writing the receipt fails, the command still returns nonzero and reports that failure without exposing a path. The backup snapshot/status itself is not changed.
7. **Backup monitoring fails closed on invalid evidence.** `tools/backup_status.py` rejects malformed timestamps/receipts, nonboolean offsite success when required, and nonpositive or nonfinite age limits. A previous successful drill cannot satisfy the monitor after a newer recorded failure.
8. **Release outputs regenerated.** Updated package/server version to 1.5.1, changed the offline-worker build ID, rebuilt the standalone page and exact CSP hashes, and retained original vocabulary IDs/data. No scheduler migration or database migration was introduced.

## Verification

**452 checks passed:** 182 JavaScript + 207 Python/API + 14 startup + 30 integrated learning/social UI + 19 bank UI. These are not 452 hosted end-to-end tests. The browser suites have explicit storage/transport substitutions; see `TEST_REPORT.md` for boundaries.

The original source passed its 428 checks. Ten new JavaScript regressions were then added; nine failed against the old implementation and passed after the corrections. Fourteen new Python regressions cover private validation errors, correction deduplication, failed-drill evidence and malformed backup monitoring. Existing tests remained enabled. Repeated generation produced identical app/data hashes. A clean delivery-ZIP extraction also passed 182 JS checks and 31 focused Python checks; these reruns do not inflate the unique test count. Archive CRC and its per-file SHA-256 manifest were verified.

## Build and test

```sh
python -m pip install -r requirements.txt -r requirements-dev.txt
npm run build
npm test
python -m pytest -q
npm run test:ui
```

UI fixture scripts default to `/usr/bin/chromium`. The separate opt-in hosted scripts require a normal browser-navigation environment. Tests use temporary SQLite databases. Provider replies/offsite storage remain controlled substitutes, not real paid services or buckets.

## Deployment steps

This is the whole backend application, not a GitHub Pages patch. Follow `START_HERE.md` and `README.md`.

1. Export existing browser libraries and take a consistent online database backup. Do not clear browser storage or replace a live SQLite file.
2. Deploy the contents of `nabu-mvp` to a controlled staging backend. Keep the current private database volume and environment configuration. Use a single server instance and the configured HTTPS origin. Schema remains v3 and browser database version remains 1.
3. Restart the server as part of deployment; the server calculates its page CSP from the generated bundle during initialization. Do not hot-swap only public files under an old running server.
4. Confirm build `nabu-audit-20261105-r1` and bank counts 900 / 90 / 36. Use the repair page for old shell caches rather than deleting user data.
5. Test real account sync on two devices, offline reload/restart, conflicts, recovery, friendship, contribution permissions and server restart persistence.
6. Configure provider keys privately and perform explicit live translation/audio checks. Configure existing private offsite storage and encryption keys; perform an actual encrypted download/restore drill into an isolated new database, then run the monitor with `--require-offsite --require-restore-drill`.

## Remaining gates and limits

- Native Chromium navigation was attempted against an isolated local server and blocked before app load with `ERR_BLOCKED_BY_ADMINISTRATOR`. Real IndexedDB durability, service-worker offline reload, HTTPS cookies, multiple physical devices, Firefox/Safari and installed-device behavior remain unverified. No attempt was made to bypass that environment policy.
- No public backend, storage bucket or monitoring service was created or validated. No Docker build, real provider request or real remote-bucket restore is claimed. Existing local/API restore tests use actual SQLite/encryption but simulated S3 transport.
- Password recovery uses a saved one-use code, not email. Losing both password and code still prevents self-service recovery. Save the replacement code after each recovery.
- The language bank is AI-assisted draft content, not native-reviewed. Ordinary phrases retain explicitly English wording glosses unless the separate provider localization is requested. Semantic coverage does not certify linguistic accuracy.
- The scheduler remains explicitly SM-2-inspired. The optional FSRS evaluation helper is not the production scheduler and was not newly installed or evaluated here.
- Sync operates while the app is open and requires one successful online account initialization. Offline queues are device-specific, not a substitute for backups. Pending operations must be resolved before sign-out.
- Shared collections remain limited to 300 entries per collection. Imported learner copies are independent; revocation cannot erase an already-imported copy. Single-instance SQLite and the 64 MB encrypted snapshot pilot limit are unchanged.

Nothing was deployed, purchased, emailed, pushed to a repository, or written to a live database. The delivery excludes private environment files, databases, recovery codes, real credentials and test runtime caches.
