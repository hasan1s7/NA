# Nabu 1.6.0 - verification report

Date: November 5, 2026. Build: nabu-mobile-links-20261105-r1.
Source: the attached nabu-ziggurat-mobile-source.zip, confirmed and extracted.
This report supersedes root reports from earlier versions; historical reports
remain under docs/history/.

## Passing checks: 550 unique

| Suite | Passed | Evidence |
|---|---:|---|
| JavaScript core, sync, routing and native helpers | 224 | verification/1.6.0/js.log |
| Python/API, database, backup and native configuration fixtures | 246 | verification/1.6.0/python-final.log |
| Startup/browser | 14 | verification/1.6.0/ui-final.log; startup-test-results/ |
| Integrated learning/accounts/social UI | 30 | verification/1.6.0/ui-final.log; next-test-results/ |
| Expanded bank/phrases UI | 19 | verification/1.6.0/ui-final.log; bank-test-results/ |
| Short links and mobile-layout UI | 17 | verification/1.6.0/ui-final.log; mobile-test-results/ |

The 550 count includes rerun existing checks plus new tests. Repeated reruns are
not counted again. The original archive's baseline passed 182 JS and 207 Python
checks before modification. The final standalone page was rebuilt before these
runs. All four browser suites are now included in npm run test:ui.

## What the new tests establish

- Authenticated, explicit publication of a constrained word snapshot; no private
  card fields can be accepted by the new link API.
- Readable, high-entropy word links, durable SQLite storage across app restarts,
  stable idempotent retry after a lost acknowledgment, ownership checks, expiry,
  revocation, account-deletion cascade, and generic unavailable-link responses.
- Hosted clean paths load the shipping shell and resolve API/assets at the root;
  static Pages subpaths retain hash navigation and old encoded link compatibility.
- Public links preview before import, imported cards get independent schedules,
  revocation does not delete previously saved copies, and disconnected reads do
  not reveal stale API snapshots from a browser cache.
- Additive v3-to-v4 database migration and schema-aware backups. Restoring to a NEW
  file invalidates restored sessions/public links without changing the source DB.
- Native helper origin/header/path/redirect/timeout/abort handling, audio decoding,
  private temporary-file export/cleanup and deep-link allowlisting, using injected
  adapters. No JavaScript-visible cookie token is added.
- Idempotent Android/iOS generated-project configuration against representative
  fixtures: icons, HTTPS link declarations, entitlements and no-cleartext settings.
- Ziggurat asset embedding, restored install manifest, cache/build agreement,
  safe bottom-navigation space and 390px-wide share dialog layout.
- Phrase breakdown disclosures remain open through a background sync render.

## Scope boundaries

**Browser suites:** shipping HTML/CSP and real UI behavior, but set_content plus
explicit URL/history, IndexedDB and transport fixtures. The account/social suites
exercise an actual isolated FastAPI server and SQLite via that transport. These
are not native browser navigation, durable IndexedDB, HTTPS cookies, real offline
service-worker reload, multiple physical devices or signed mobile-app tests.
The screenshots are actual UI captures using fictional temporary accounts, not
mockups and not a live deployment. They do not prove device behavior.

**Native checks:** pure JavaScript adapters and generated-project fixture editing
only. Capacitor/esbuild installation was blocked by npm registry DNS resolution;
mobile:prepare was actually attempted and exited with a missing-dependency error.
See verification/1.6.0/native-build-attempt.log and mobile-doctor.log. There are no
compiled native projects/binaries. No package-lock.json could be generated;
pinned direct versions still require successful transitive resolution/audit.
Android SDK and macOS/Xcode were unavailable. Real native cookie jars, HTTPS
associations, share sheets, file permissions, audio and lifecycle remain untested.

**Providers/backups:** provider responses and S3 transport use controlled tests.
Actual SQLite snapshots and restore checks do run; no actual external bucket,
paid translation/audio request, cloud hosting or monitoring was configured.
No claim of production security auditing, store acceptance or linguistic review.
The 1,026-entry language bank is unchanged draft material. FSRS remains an optional
read-only evaluation helper, not the production scheduler.

## Reproduce

```sh
python -m pip install -r requirements.txt -r requirements-dev.txt
npm run build
npm test
python -m pytest -q
npm run test:ui
```

UI scripts use /usr/bin/chromium by default. Consult their explicit fixture setup
rather than treating these as hosted end-to-end tests. The separate hosted test
scripts require real browser navigation and explicit consent to create temporary
accounts on that server; they were NOT run against any user's deployment.

## Release packaging

The full source and separate Pages bundle exclude credentials, databases,
private configuration, node_modules, native build products and runtime caches.
SHA256SUMS.json records included source files. The archive is CRC-tested and its
manifest is checked after extraction. A separate package-verification.json records
fresh-extraction build/test commands and results: build succeeded, all 224 JavaScript checks and 39 focused Python/API/native-configuration checks passed. Rebuilding changed none of the hashed source files. Those reruns do not inflate 550.

## Still required before launch

Deploy the full-stack application on an HTTPS staging origin with durable storage;
backup before the additive DB v4 upgrade. Validate two real devices, interrupted
writes, native storage/reload, session/recovery, old/new links and a real isolated
external restore drill. Install and lock native dependencies; build, sign and test
Android/iOS; verify HTTPS associations and final store privacy declarations.
Nothing in this release bought services, deployed, emailed users, or replaced a
live database. See START_HERE.md and MOBILE_HANDOFF.md for exact operator steps.
