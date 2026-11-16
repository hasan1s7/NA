# Nabu 1.16 handoff

Use `START_HERE.md`, `docs/RELEASE_NOTES_1.16.md` and `docs/VERIFICATION_1.16.md` as the current release documents. Prior handoff/README files are in `docs/history/1.15/`.

Architecture remains vanilla JS/CSS, the Python standalone bundle builder, FastAPI, SQLite, IndexedDB and existing account sync. Primary 1.16 modules are `public/nabu-scribe.js`, `public/nabu-scribe.css`, the existing `public/nabu-app.js`, and `public/nabu-explore-ui.js`. The scribe SVG is bundled inline as well as supplied in `public/nabu-scribe.svg`; it requires no remote asset request.

Rebuild with `npm run build`. No build step is needed to launch the delivered archive. Do not serve source modules in place of the hashed shipping bundle without rebuilding. `public/index.html` and `public/nabu-sw.js` share the 1.16 build identifier. `mobile/www` is an offline development web bundle, not an APK/IPA or configured account backend.

Council capability: `/api/config` returns `council.enabled: false`. `/api/council` returns a recoverable 503 and does not store or send selection text to an external provider. `PERSONA_POLICY` and the roster define the intended teaching contract, not an existing generator. Future generation must use a separately authorized server integration; validate structured output, preserve human corrections and bind every response to the selection/account epoch.

Own-text session metadata is `nabu.reader.v1:<account-id-or-guest>` in the existing local meta store. It is deliberately distinct from vocabulary cards and curated content events. Clearing guest data preserves another account’s session metadata; deleting an account forgets its own session. Saved settings add `explanationMode` and `nabuPresence` with conservative defaults.

Current evidence is under `verification/1.16/`. Do not describe older browser screenshots as this release. No deployment, publication or Git push was performed.
