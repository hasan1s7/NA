# Nabu mobile and link handoff

## Delivered
- Ziggurat SVG logo is used in the website brand, loading screen, favicon and PWA manifest.
- PWA install manifest now includes Translate, Review and Friends shortcuts.
- Navigation removes redundant `?view=translate`; other views retain short readable names (`?view=review`, `?view=exchange`).
- Share links now start with a readable `#word/<slug>.` prefix and remain backward compatible with `#share=`. The remaining encoded payload is **not short**: static GitHub Pages cannot create durable compact links without a backend.
- Capacitor iOS/Android configuration and npm scripts are included. This is native-project scaffolding, not compiled or store-approved apps.

## Building native apps
1. Deploy the full-stack backend with HTTPS and a persistent database first. GitHub Pages alone cannot serve account APIs.
2. `npm install` and `npx cap add ios` (macOS/Xcode required for iOS) and `npx cap add android` (Android Studio/JDK required).
3. `NABU_MOBILE_URL=https://YOUR-DEPLOYED-FULLSTACK-HOST npm run mobile:sync`.
4. Open the native projects and configure signing, splash screens, Android adaptive icons, iOS App Icons, privacy disclosures and store metadata.
5. Test on real devices: deep links, offline startup, review persistence, cookies, account recovery, microphone/audio, notifications and accessibility.

## Remaining
- Server-issued short share codes (e.g. `/w/bonjour-x7k`) need an authenticated share API, token expiry/revocation and backend routing. Current static shares are self-contained and longer.
- Native binaries, actual iOS/Android device tests, and App Store/Play Store submissions are not complete.
- The native remote-URL approach must be reviewed against store rules and security requirements before release.
