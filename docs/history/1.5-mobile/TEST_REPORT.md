# Nabu 1.5.1 - verification report

Date: November 5, 2026. Input: the actual attached `nabu-next-release.zip` (1.5.0). Final build: `nabu-audit-20261105-r1`.

## Results from this run

| Suite | Result | What was exercised |
|---|---:|---|
| `npm test` | **182 passed** | Real JS domain, account adapters, outbox, scheduler, imports, graph, build/CSP and new regression checks; storage is an explicit fixture |
| `python -m pytest -v --durations=10` | **207 passed** | Real FastAPI handlers, authentication, permissions, temporary SQLite databases, recovery, sync, backup/restore logic; provider and S3 I/O are substitutes |
| `tests/startup_browser.py` | **14 passed** | Shipping standalone HTML/CSP and visible startup failures; successful storage uses a fixture |
| `tests/next_browser.py` | **30 passed** | Current interface, recovery, real temporary API/database, reading/review, account queues and collaboration; URL/storage/network boundaries use fixtures |
| `tests/bank_browser.py` | **19 passed** | Bank counts/search, phrase detail, context, mobile layout, offline indicators and approved contributions; same fixture boundaries |
| **Total** | **452 passed** | No skipped checks in the JS/Python suites; the separate native-navigation attempt was blocked and is not counted as passed |

All three UI suites completed sequentially through `npm run test:ui`. Python source compilation passed. Rebuilding the generated application and canonical language files produced identical SHA-256 hashes. There was no database or scheduler migration. A fresh extraction of the delivery ZIP also passed all 182 JS tests and the 31 backup, operator-tooling and release-audit Python tests. These are repeat checks of already-counted tests, not additions to the 452 total. The ZIP CRC and per-file SHA-256 manifest were verified.

## Baseline and regression evidence

The extracted original source passed 172 JS, 193 Python/API and 63 browser-fixture checks (428 total). A first long combined backend execution timed out before reporting a full result; it is not counted as a completed run. A subsequent independently logged baseline run completed all 193 checks, followed by the final 207-check run.

Ten new JavaScript checks were added. Nine failed against the original code, including malformed server-card/log/history initialization, corrupt sync acknowledgment/refresh/conflict replies, invalid identity mappings, wrong-direction reverse-card metadata and the online adapter's missing non-default practice mode. The existing missing-collection rejection already passed. All ten pass now.

Fourteen new Python checks cover secret-free validation responses (registration, login, recovery); rejection of a correction that duplicates another shared entry without changing private progress; failed restore-drill receipt invalidation and private file permissions; malformed monitoring receipts; and invalid backup freshness thresholds. The existing 193 checks were retained.

Evidence is under `verification/release-audit/`: current JS/Python/UI logs, baseline logs, the before-fix JS regression output, source diff and reproducible-build hashes. Current browser result JSON and screenshots are under `startup-test-results`, `next-test-results` and `bank-test-results`. Older verification directories belong to the earlier release and are not the authority for the current totals.

## Feature/data checks

Counts remain 900 word meanings, 90 phrases and 36 expressions, with twelve language forms per concept. The existing round-trip test checks all 135,432 directed sense-preserving translation routes. This loop is one test, not 135,432 additional tests. It validates coverage and ID consistency, not the correctness of every translation. All original concept IDs and authored bank outputs are unchanged by this correction release.

Account review scheduling remains SM-2-inspired. Separate meaning/production/listening/cloze evidence, Learning/Reference/Archived flow, contextual selection and owner-approved collection proposals continue to pass the existing tests. The production system is not relabeled as FSRS.

## Explicit boundaries

- Native browser smoke testing was attempted against an isolated loopback server. Chromium returned `net::ERR_BLOCKED_BY_ADMINISTRATOR` before loading the application. Its raw failure is preserved in `verification/release-audit/native-browser.txt`. This is not a pass or evidence of a deployed app bug; it prevents validation of real browser persistence here.
- Successful UI tests load the actual generated application with URL/history, IndexedDB and fetch/cookie boundary fixtures. The application logic and FastAPI/SQLite handlers are real. Those checks do **not** validate native durable IndexedDB, service-worker reload behavior, HTTPS cookies or physical devices.
- Backup tests exercise real encryption, SQLite integrity/foreign keys, non-overwriting restoration and session revocation, but S3 is simulated. A fresh real off-server drill is still required; a successful HEAD or mock round trip is not disaster-recovery proof.
- Live DeepL/ElevenLabs calls: zero. No voice quality audition or production provider verification. API keys remain server-only configuration.
- No hosted deployment, Docker image build, native-speaker review, full security audit or FSRS evaluation was completed or claimed.

## Reproduction and deployment gates

```sh
npm run build
npm test
python -m pytest -q
npm run test:ui
```

Before a real beta: preserve existing data; deploy the full server to staging and restart it; validate account save/offline queue/reload/recovery on two real devices; confirm permissions and cross-account isolation; configure private provider credentials; verify live translation/audio and an actual encrypted offsite restore to a new database. Never overwrite the live database during a restore drill. See `HANDOFF.md` and `START_HERE.md`.
