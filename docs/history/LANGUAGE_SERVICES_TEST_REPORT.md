# Nabu language services: verification report

Build: `nabu-language-20261104-r1`  
Date: November 4, 2026  
Base: the supplied `nabu-startup-fixed-source.zip`, not a live repository checkout.

## Result

Implemented and locally checked: contextual DeepL translation, protected ElevenLabs synthesis, playback/cache controls, provider configuration, and startup-regression handling.

**Not established:** valid user credentials, live provider connectivity, naturalness of a chosen voice, a completed Docker build, or successful deployment to the user's site. No real provider generation or purchase was performed.

| Check | Result | Scope |
|---|---:|---|
| `pytest -q tests/test_server.py tests/test_language_services.py` | 97 passed | FastAPI/SQLite API behavior and mocked provider contracts |
| `npm test` | 70 passed | Core scheduling/import/share logic, startup/cache logic, speech-key and CSP contracts |
| `python tests/language_browser.py` | 23 passed | Real rendering/player, explicit storage/URL/provider fixtures, local test-tone MP3 |
| `python tests/startup_browser.py` | 14 passed | Exact compiled HTML and CSP; healthy storage fixture; real denied-storage failure |
| Python source compilation | Passed | Server, provider adapter, readiness checker, hosted-browser test file |
| Readiness checker without credentials | Correctly reported not configured | No provider call or metered generation |

The counts above are separate test suites and UI assertions, not a statistical confidence score or a claim of production readiness. Logs and machine-readable UI results are included under `verification/`.

## Provider/API coverage

The Python suites exercise the existing account/exchange backend and the added services. Cases include:

- All twelve shipped language mappings, regional DeepL targets, optional context, formality, and optional model preference.
- Server-held authentication headers; public config and representation exclude the secret keys.
- Speech model-specific payload behavior, including no `language_code` for multilingual v2 and no legacy voice-setting overrides for v4.
- Rejection of arbitrary client voice IDs, unsupported languages, invalid configuration, empty/oversized text, and unsupported input fields.
- Unicode normalization that retains diacritics.
- Provider status errors, timeout handling, sanitized error messages, no automatic paid retries, malformed translation payloads, unusable audio MIME types, and oversized audio responses.
- Account authentication, origin checks, CSRF protection, per-user/global character reservations, request limits, and account deletion.
- Cache bounds, expiration checks, per-account separation, context-sensitive translation reuse, and concurrent duplicate-request coalescing.

Provider HTTP responses use `httpx.MockTransport`, and API tests inject adapter callbacks. Those tests validate the implemented request/response contracts, not a real provider's acceptance of an account key or a language pair. The adapter's audio response fixture is synthetic bytes, not a listening sample.

## UI coverage

`tests/language_browser.py` executes the real application renderer, core logic, and speech module. It replaces the storage adapter, navigation URL/history, and provider responses with explicit fixtures because hosted browser navigation is blocked in this environment.

Checks cover context/tone payloads; cached translations; consent before the first speech request; an actual HTML audio element decoding a local MP3 tone; text/language-only speech payloads; the AI-generated label; normal/slower playback; persistent slow-rate choice across replay; tab cache reuse from translator, library, and review; unchanged review state; visible quota failures without a silent provider substitution; coalescing rapid taps; settings persistence in the fixture; retaining current translation languages when speech preferences change; mobile overflow; clearing playback on sign-out; and absence of uncaught frontend errors.

The MP3 is a generated sine tone used to exercise decoding and playback. It is **not ElevenLabs speech** and is **not evidence of natural voice quality**. UI screenshots show fixture content and must not be presented as real translated/voiced examples. One fixture deliberately changes the returned meaning to test cache invalidation.

## Startup regression coverage

`tests/startup_browser.py` renders the exact generated standalone HTML with its exact script/style CSP hashes. The successful-startup cases use a minimal IndexedDB request fixture, while the denied-storage case uses the browser's real rejection on an opaque origin.

All fourteen checks pass: visible recovery instead of an endless loader, a repair control, script execution under the shipped CSP, no top-level parse errors, no required remote scripts, guard readiness, hidden startup helper after readiness, mobile layout, retention of a seeded existing card, optional BroadcastChannel failure, a nonresponding database timeout, a top-level syntax failure, and an absent bundle watchdog.

This does not prove native persistent IndexedDB behavior on the user's browser or successful service-worker installation/offline reloads at the deployed origin.

## Browser and deployment limits

A real Playwright navigation to a local HTTP server failed with `net::ERR_BLOCKED_BY_ADMINISTRATOR`. Fixture-based checks are not a substitute for a deployed browser smoke test. The included `tests/browser_smoke.py` was adapted for the self-contained runtime and explicit public-provider selection, but the full hosted-navigation suite was not completed here. The older `tests/preview_harness.py` is retained; its prior run counts are not asserted for this release.

Docker is not available in the authoring runtime. The Dockerfile and Compose configuration are supplied, but an image build and container lifecycle are not claimed as verified. Native Python/API tests ran against the installed dependency versions.

No GitHub push, Pages update, Render deployment, provider account signup, secret storage action, subscription, or billing transaction was performed.

## Live acceptance checklist

Before inviting users:

1. Run the read-only provider checker using private server environment settings. Confirm the model and chosen voice are accessible.
2. Explicitly run one metered translation and one metered speech sample. Listen to the result rather than inferring quality from an HTTP 200 response.
3. Open the deployed HTTPS origin in desktop and mobile browsers. Create an invited account, translate a contextual phrase, save it, listen, replay, slow it, and review it.
4. Verify native cookies/CSRF, playback after an initial user gesture, reload persistence, old-library backup/import, two-account exchange, and service-worker recovery without deleting words.
5. Check representative target-language pronunciation with competent speakers. Validate billing controls and ordinary provider retention terms.
6. Restart the host and verify that the server account database survives on its persistent disk. Keep only one instance for this SQLite/process-cache deployment.

The implementation supports this acceptance process; it does not claim these live checks have already passed.
