# Local release 1.9.0 note

The native integration below is retained with the updated web source. No new APK/IPA, Xcode signing or physical-device validation is claimed. Local web testing uses README.md and does not require native tooling.

---

# Nabu 1.6.0 - iOS, Android and Pages

## What is actually delivered

Local packaged-web source, native HTTP/share/file adapters, ziggurat icons and
splash resources, build/generation/configuration scripts, safe URL routing,
HTTPS association endpoints and tests. **No IPA, APK, AAB or generated Xcode/Gradle
project is included.** The build attempt could not resolve npm dependencies in
this environment. Unit/fixture checks are not native-device validation.

## Development prerequisites

Capacitor 8 direct dependencies are pinned to 8.0.0; Node 22 or newer and Python
are required by these scripts. Install the current supported Android SDK/Studio
and Java on your development machine; iOS requires macOS and the supported Xcode.
Verify official requirements before installing SDKs:
https://capacitorjs.com/docs/getting-started/environment-setup
https://capacitorjs.com/docs/ios
https://capacitorjs.com/docs/android

## Build Android

Run from the nabu-mvp directory on a development machine:

```sh
npm install
# Save package-lock.json once installation and dependency review succeed.
export NABU_API_ORIGIN=https://YOUR-REAL-FULLSTACK-HOST
npm run mobile:doctor
npm run mobile:init -- android
npm run mobile:android
```

The doctor reports missing prerequisites, including Xcode on non-macOS hosts;
that Xcode item is not an Android build requirement. Resolve the Android items.
The initializer builds local assets, creates the official Capacitor project,
syncs plugins and applies icons, links and transport settings. Choose your own
controlled application ID in capacitor.config.json before first initialization;
app.nabu.learn is a provisional identifier, not proof of ownership. Configure
signing in Android Studio. Test a debug build before generating a release AAB.
Do not commit signing keys or passwords. The initializer does not submit apps.

## Build iOS

On macOS with the supported Xcode:

```sh
npm install
export NABU_API_ORIGIN=https://YOUR-REAL-FULLSTACK-HOST
npm run mobile:init -- ios
npm run mobile:ios
```

Select your team and bundle identifier in Xcode. Enable Associated Domains and
verify the generated entitlements. Add ios/App/PrivacyInfo.xcprivacy to the App
target resources; the script copies the file but does not claim Xcode membership
was validated. Review privacy declarations for actual accounts, providers and
third-party SDKs. The supplied Filesystem timestamp reason is C617.1; this is not
a complete App Store data-collection declaration. Audit the generated project,
AppIcon, launch screen, deployment targets and code-signing settings in Xcode.

Official references:
https://capacitorjs.com/docs/apis/filesystem
https://capacitorjs.com/docs/ios/privacy-manifest
https://capacitorjs.com/docs/apis/http
https://capacitorjs.com/docs/apis/share
https://capacitorjs.com/docs/guides/deep-links

## Updating web code after initialization

Keep NABU_API_ORIGIN exported to the SAME hosted API origin:

```sh
npm run mobile:sync
# A release preparation explicitly requires a backend:
npm run mobile:release
npx --no-install cap sync
node tools/configure_native.mjs
```

mobile:prepare bundles local HTML plus the native bridge, applies exact CSP
hashes, and writes mobile/build-info.json. An unset origin makes an explicitly
OFFLINE-ONLY build, not working accounts. mobile:release rejects an unset origin.
The origin is public configuration, not a secret. Provider keys belong only on
the server. Keep the backend and mobile configuration consistent. Do not restore
server.url or allowNavigation to load an arbitrary remote homepage.

The native HTTP wrapper only calls /api/ on that origin, rejects redirects,
filters headers and uses the native cookie jar. Browser cross-origin credentials
remain disabled. Real HttpOnly persistence, iOS cookie behavior, session expiry,
CSRF and native audio responses are REQUIRED device tests, not proven here.
Exports use private temporary cache files through the share sheet, scheduled for
cleanup or removal on the next cold launch. The recipient chosen in the native
share sheet controls any exported copy. These exports can contain private data.

## Verified HTTPS app links

On the BACKEND configure nonsecret signing metadata after signing is established:

```dotenv
NABU_MOBILE_APP_ID=YOUR_ACTUAL_BUNDLE_OR_APPLICATION_ID
NABU_APPLE_TEAM_ID=YOUR_ACTUAL_TEAM_ID
NABU_ANDROID_SHA256=YOUR_ACTUAL_SIGNING_CERTIFICATE_SHA256
```

The certificate value is 32 hex bytes separated by colons; multiple fingerprints
may be comma-separated for rotation. Use the store signing certificate when the
store signs builds, not merely the upload certificate. The backend publishes
/.well-known/apple-app-site-association and /.well-known/assetlinks.json. Without
valid metadata, responses authorize no app. The native configuration uses the
host from NABU_API_ORIGIN; you must control it and host these endpoints there.
Verify cold and warm /w/ links on installed devices. Receiving a link does not
silently import it. Older encoded links continue to work in the website.

## Pages update

Upload contents of nabu-pages-update.zip beside the published index.html. Keep
icons/ and nabu.webmanifest paths intact. Use nabu-repair.html for a stale app
shell, not Clear site data. Pages navigation uses #review/#friends etc.; clean
server /w/ links only work on the full-stack host. Account sync is not available
merely because the website is installable. The source does not buy a short domain.

## Acceptance before a release

Use actual Android and iOS devices: first/cold/offline launch, login/recovery,
expiry/logout, queued changes followed by resume, independent accounts, interrupted
requests, rotation and screen cutouts, keyboard/modal overflow, long text/RTL,
VoiceOver/TalkBack, audio play/pause, native backup export, share sheet cancellation,
public-link expiry/revoke, HTTPS associations and Android Back. Run web tests too.
Complete privacy and store declarations against the real deployed service.
