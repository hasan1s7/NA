# Nabu 1.4 release notes

- Additive server schema v3: recovery hashes, idempotent operation receipts,
  collection contributor roles, proposals and before/after events.
- Account-scoped durable offline outbox; visible sync states, explicit conflict
  decisions, exports and account-switch generation guards.
- One-use recovery codes, password-confirmed rotation and session invalidation.
- Reference/Learning states with automatic save preserved, optional automatic
  Learning, bulk promotion and independent four-skill schedules.
- Five-minute sessions, cloze matching, undo and self-rated delayed evidence.
- Contextual reading with Unicode word segmentation and sentence capture.
- Phrase usage, examples, replies and provenance; chosen-target literal guides.
- Collaborative collection proposals and owner approvals; private schedules stay
  separate. Friend badge and opt-in notifications while the app is open.
- Consistent periodic backups, optional encrypted S3-compatible uploads, freshness
  checker and restore-to-new-path with integrity checks and session revocation.
- Read-only optional FSRS analysis helper, with explicit unverified-library scope.
- Clear closed secret dialogs; protect pending account work during guest cleanup;
  scrub deleted library content from receipt caches; preserve idempotency tombstones.
- Retain self-contained startup guard, exact CSP hashes and repair page.

Not deployed. No paid resources or provider requests. Native persistence, HTTPS
cookies, service-worker lifecycle, Docker build, offsite transport, notification
permissions and optional FSRS replay must be checked in the real environment.

Original 1.3 documentation and test reports are under `docs/history` and describe
that historical release only; they are not current pass counts or limitations.
