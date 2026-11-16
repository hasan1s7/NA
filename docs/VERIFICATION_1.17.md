# Nabu 1.17 verification

Release verification used the actual 1.16 codebase as the baseline. Baseline: **859 JavaScript tests and 485 backend tests passed** before editing. No existing user database or credentials were used. Institutional scenarios use clearly fictional accounts and temporary SQLite databases.

## Checks and evidence

| Check | Result | Evidence |
| --- | --- | --- |
| JavaScript domain, storage and worker suite (`npm test`) | 869 passed, zero failed/skipped | `verification/1.17/node.log` |
| DOM acceptance (`npm run test:dom`) | 88 passed, zero failed/skipped | `verification/1.17/dom.log` |
| Full backend suite with unchanged production dependency pins | 505 passed, zero failed; one existing dependency deprecation warning | `verification/1.17/python-pinned.log` |
| Focused institutional backend suite | 20 passed, including concurrent duplicate delivery and oversized-input rejection | `verification/1.17/institutions-python.log` |
| Actual institutional launcher/HTTP scenario | 23 checks passed | `verification/1.17/institution-http.json` |
| Existing launcher, HTTP, persistence, backup, restore and recovery smoke | 14 checks passed | `verification/1.17/launcher-http.json` |
| Python launcher bootstrap and Linux shell launcher configuration checks | Passed with the existing pinned environment | `verification/1.17/launcher-bootstrap.log`, `launcher-shell.log` |
| Full content/graph/standalone build | Passed using the declared development dependency Unidecode 1.4.0 | `verification/1.17/build.log` |
| Mobile bundled web assets | Built successfully; offline-only configuration | `verification/1.17/mobile-build.log` |
| Python compile and JavaScript syntax checks | Passed | Run against the changed modules and demo tool |
| Docker source assembly import | Passed in an isolated directory using the Docker COPY inputs | `verification/1.17/container-context.log` |
| Extracted release archive | Starts through its local launcher; 1.17 health/config and rebuilt reader/workspace shell verified | `verification/1.17/package-smoke.json` |
| Preservation | Launchers, dependency pins, catalogue, language services, speech/transliteration, personal evidence/model and related files byte-identical to 1.16 | `verification/1.17/preservation.json` |

The focused suites are subsets of the larger totals; do not add them together. HTTP smoke checks exercise a different transport and launcher boundary. The isolated institutional demonstration is repeatable with `tools/demo_institutions.py` and never makes provider calls.

## Behavior exercised

- One learner in two organizations, with private vocabulary and intentions excluded from organization reports.
- Owner administration separate from named-reviewer response access; acceptance required before reporting; decline creates no assessment.
- Results-only views omit raw responses and correction-request text, including through export/replay boundaries.
- Stable source/task/rubric identity, original Unicode text and responses preserved before normalization, all twelve language codes accepted, and historical source version pinning.
- Identical offline/concurrent deliveries count once; changed payloads conflict; retry lineage remains explicit; unknown/cross-assignment parents are rejected.
- Source-visible assistance cannot be removed by client flags. Other conditions remain self-reported and explicitly unverified; no mastery is invented.
- Correction request, corrected rubric, explicit reassessment, predecessor preservation, optimistic conflict handling and replay of both old and new results. Deliberate stored-score inconsistency is reported without overwriting it.
- Removing or leaving membership blocks new and old submissions and record access. Rejoining does not restore grants. Other organizations and private vocabulary remain available.
- Server restart, existing account deletion cascades, backup/restore and recovery remain functional.
- Outbox permission checks, exact acknowledgement, account/workspace separation, queue capacity, discarded local copies, failed/revoked uploads, account switching and reconstruction from stored metadata.
- Optional UI entry, accepted/declined reporting terms, response freeze after a network failure, manual pending retry, replay/export controls, ignored stale loads, and integration through the shipping bundle’s existing account/CSRF transport.
- Existing explanation modes, source nodes, selection, reading position, notes/corrections, saved state, rapid lookup races, source media identity/time, hidden Nabu, representative scripts and mobile-sheet DOM behavior remain covered by the 1.16 regression suite.

Verification found and repaired an unsynchronized service-worker release marker and inherited whitespace stripping on new source/response models. The builder now synchronizes the marker automatically, and raw text is preserved before the scorer applies its declared normalization. DOM files run serially to avoid competing inference/render tests timing out on small development machines.

## Environment and limitations

Linux; Python 3.12.14; Node 24.22.1; FastAPI 0.128.2; Uvicorn 0.48.0; HTTPX 0.28.1; Pydantic 2.14.3; jsdom 31.0.1. The production requirement pins are unchanged. Installing the already-declared development-only Unidecode 1.4.0 enabled the full graph regeneration. One existing Starlette/AnyIO test-helper deprecation warning remains.

Chromium was attempted but could not start: its process-singleton socket was denied with `Operation not permitted`. See `verification/1.17/browser-attempt.log`. Consequently, DOM tests do **not** verify native layout, real browser IndexedDB durability, actual cookie/service-worker lifecycles, screen-reader output, physical touch targets, zoom rendering, real media playback or audible speech. RTL/script attributes, semantic controls, focus styling, responsive rules and reduced-motion rules are implemented; native-device accessibility acceptance remains unverified.

Windows and macOS native launcher behavior, physical iOS/Android devices, native application compilation, Docker image execution, real provider calls, production load and a real institutional pilot were not tested. The Windows/macOS launcher files are preserved byte-for-byte. The mobile result is a web-asset build, not an installed device build. Docker itself was unavailable; only its source assembly/import was checked.

This release demonstrates correct bounded software behavior under its tested contracts. It does not establish human calibration, learning gains, formal proficiency certification, organizational compliance, or readiness for classified/restricted operational deployments. It introduces no external publishing or deployment.
