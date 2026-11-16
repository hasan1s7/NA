# Nabu 1.6.0 implementation handoff

Date: November 5, 2026. Build: `nabu-mobile-links-20261105-r1`.

## Provenance and limits

The attached `nabu-ziggurat-mobile-source.zip` was confirmed present, extracted and
read, including its handoffs and tests. This release modifies that source, not an
invented replacement. Prior documents are under docs/history/1.5-mobile/.
Nothing was deployed, bought, emailed, pushed to GitHub or written to a live DB.
No accounts were created on the user's site. All test identities are temporary.

## Exact changes

1. **Persistent short word links:** new word_links.py schema/API and additive DB
   version 4 migration. Only authenticated owners create/revoke links. Snapshots
   contain front/back/language/context, not notes, scheduler or review history.
   Slugs use readable word/language prefixes and 96 random bits. Expiry, 200-active
   limit, rate limits, idempotency keys, conflict detection and no-store responses
   are enforced server-side. Absent/expired/revoked reads share a generic 404.
2. **Share UI:** preview before explicit publication, expiry selector, stable-key
   failed-ack retries, clipboard/native share and disable actions, active-link
   management in Friends. Public preview requires explicit import and creates
   independent progress. Offline failures do not reveal cached public snapshots.
   Old encoded shares still work as a clearly longer non-revocable fallback.
3. **Meaningful routes:** hosted /review, /library, /friends, /read, /words and /w/
   shells; Pages uses hash routes. New pure URL module corrects root API requests
   from nested routes, preserves static subpaths and rejects unsafe paths/origins.
   No custom domain was registered. Public shares are bearer links, not private
   friend-only delivery; use direct word exchange for that.
4. **Actual packaged-mobile integration source:** removed remote server.url config;
   added local esbuild bundle, build-time HTTPS API origin, official Capacitor
   App/Share/Filesystem adapters, origin-bound native HTTP wrapper, deep-link and
   resume/back handlers, private temporary file export/cleanup, native project
   generation and configuration scripts. Native HTTP relies on the native cookie
   jar; no password/token is added to JavaScript/localStorage. Existing CSRF and
   account-binding checks stay enabled; arbitrary browser CORS was not added.
5. **Signing/association plumbing:** optional server association documents, verified
   HTTPS app-link declarations, iOS entitlement and app-bound-domain setup,
   Android no-cleartext/no-backup configuration, original ziggurat icons at web,
   iOS and Android sizes, adaptive icon resources and splash asset. Association
   documents authorize no app until real signing metadata is configured. iOS
   privacy manifest target membership and actual disclosures require Xcode audit.
6. **PWA and layout corrections:** build no longer strips the manifest; real PNG
   install icons/apple touch icon, hash shortcuts, embedded ziggurat in loading
   and branding, four bottom-nav columns, safe-area padding, usable modal/control
   sizing. Worker caches clean-route shells only, never public-link API contents.
7. **Learning UX regression fixed:** an expanded phrase breakdown stays open when
   sync/background rendering updates the screen; disclosure keys are stable.
8. **Backup safety:** v4 snapshots are validated; restoration into a new file ends
   restored sessions AND disables restored public links. Routine server restarts
   preserve valid links. A rollback to an older snapshot cannot resurrect public
   link capabilities. Existing offsite encryption/restore tools remain.
9. **Packaging:** Docker now includes word_links.py; version/build IDs and generated
   HTML/CSP refreshed; test:ui includes the new sharing/mobile-layout suite.

## Verification

See TEST_REPORT.md and verification/1.6.0/. The complete pre-change baseline ran:
182 JS and 207 Python/API checks passed. New final source: 224 JS, 246 Python/API,
14 startup UI, 30 learning/social UI, 19 bank UI and 17 short-link/mobile UI.
Total 550 unique passing checks, not 550 hosted/native end-to-end checks.

The new API tests use actual temporary SQLite and FastAPI. Browser tests render
shipping HTML but substitute URL/history, storage and transport. Native helpers
and generated-project configuration are tested against injected adapters and
representative project fixtures, not actual compiled SDK projects.

## Native build blocker (not passed)

npm registry resolution failed (EAI_AGAIN); Capacitor/esbuild were not installed.
The actual mobile preparation attempt failed on missing esbuild. No dependency
lockfile could be generated; all direct versions are pinned but transitive
resolution is not yet validated. Android SDK and macOS/Xcode are unavailable.
Therefore no native compilation, signing, IPA/APK/AAB, app-store publication or
real native cookies/offline start/deep-link/audio validation is claimed.

## Safe upgrade / remaining work

- Export old browser data and take a consistent server backup before deployment.
- Deploy to staging with the existing private configuration and durable volume.
  DB v3 -> v4 is additive; do not use old code against the migrated DB. Do not
  replace live SQLite with a packaged test file (none is included).
- Restart the backend with the rebuilt HTML so CSP and build ID agree. Keep one
  server instance. The browser database name/version and user schedules remain.
- On an SDK machine, install pinned dependencies, commit the resulting lockfile,
  run mobile:doctor and follow MOBILE_HANDOFF.md; then compile/sign/test privately.
- Configure real HTTPS signing association metadata only after choosing an app ID
  and controlling the domain. No generic nabu.app domain is promised or used.
- Perform two-device sync/offline/recovery tests, real backup upload/restore drill
  into a NEW path, live provider checks, and iOS/Android link/cookie/file tests.
- App-store privacy disclosures, accessibility/device QA, native dependency audit,
  production monitoring and actual hosting are still deployment responsibilities.

The 1,026-entry bank is an authored draft; native review is still outstanding.
Password recovery is still one-use-code based, not email. FSRS is still an
optional evaluation helper, not the production SM-2-inspired scheduler.
