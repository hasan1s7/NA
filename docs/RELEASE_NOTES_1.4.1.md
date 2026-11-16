# Nabu 1.4.1 — overnight reliability continuation

See `../HANDOFF.md` for provenance, exact file changes, test results and staging gate. Adds cross-tab Web Locks for account flushing; stale-cache/late-outbox status fixes; SHA-256 evidence on encrypted offsite backups; an actual downloadable offsite restore *drill command* with checksum, SQLite and session checks; optional restore-drill freshness checks for monitoring; five new test cases plus additional operation tests; and a rebuilt versioned HTML/service worker.

No schema migration, FSRS switch, hosting or external provider calls.
