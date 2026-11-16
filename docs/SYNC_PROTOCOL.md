# Sync protocol and failure boundaries

The guest IndexedDB name/version is unchanged. Account caches are metadata records
`account-cache:<immutable-user-id>` with confirmed server state, ordered operations,
resolution audits and last-sync time. Credentials and recovery codes are not
cached. Device caches are local plaintext application data, not encrypted vaults.

`POST /api/sync` accepts one UUID-keyed operation: add, translation, edit, archive,
review or undo. The server validates the authenticated account, CSRF/origin,
expected account header, model fields and revision before mutation. One immediate
SQLite transaction performs mutation, review log update and receipt insertion.
A duplicate operation ID returns the previously recorded result and current
snapshot. Changed content under a reused ID is rejected.

The client appends locally in one IndexedDB transaction before returning a
local-save result. Flush acknowledges one operation at a time. Only the matching
acknowledged UUID is removed; operations appended in another tab survive. Returned
ID maps reconcile a duplicate created independently on another device. Revision
conflicts remain explicit; the app does not silently replay a stale edit over
someone else's work. Original payloads remain exportable.

Account generation guards reject late responses after switching users. A network
failure does not imply invalid credentials; cached use remains available. An
explicit authentication rejection locks the account until sign-in. Reconnecting
refreshes the session/CSRF before retrying. Sign-out removes the current account
cache only after pending work has drained. Deleted accounts are removed from the
current device cache, but unreachable prior devices cannot be remotely erased.

Pending reviews retain occurrence times, separate skill modes and monotonically
increasing revisions. Future timestamps beyond five minutes are rejected. Undo
requires that no newer revision intervened. Retry-after-conflict is a deliberate
user action and records a review at retry time. It is not automatic reconciliation.

Clearing a server library retains idempotency tombstones but scrubs private card
content from receipt results, so an old retry does not resurrect deleted data.
Account deletion cascades receipts. Receipts are not automatically expired in
this pilot: expiring them without a retry horizon could break idempotency. Monitor
storage growth and design compaction before scaling beyond a small pilot.

Browser quota eviction, profile deletion, origin changes, lost devices and a
closed app are outside automatic-sync guarantees. A displayed device save is not
a cloud backup. Export private backups and complete native deployment tests.

## 1.4.1 warm-cache and multi-tab behavior

A previously confirmed browser cache is labeled `cached`/checking when reopened; it is **not** called `synced` until a fresh server response. A successful sync read or acknowledged write transitions to `synced`, provided no pending operations remain. The client re-reads the outbox after the final acknowledgment to avoid reporting a stale zero-pending state.

On secure contexts with Web Locks, `navigator.locks.request` serializes cloud flushes using a per-account key. This ensures two open tabs do not concurrently drain one account queue; all mutations still take place in atomic IndexedDB transactions. On browsers without Web Locks, fallback sends remain protected by the API's UUID receipts, but duplicate HTTP sends and transient conflicts are possible. This is not a background sync feature; the app must be open for automatic retry.
