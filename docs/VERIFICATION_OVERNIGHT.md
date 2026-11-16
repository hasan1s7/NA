# Nabu 1.17 overnight verification

Release **1.17.0**, build **nabu-workspaces-1.17-20261115-r2**. Current evidence lives in `verification/overnight/`. Older release reports remain historical; their counts do not describe this build.

## Source and execution

The latest available application archive was Nabu-1.17.zip, SHA-256 `52695f940faeb5903a1339088ad9479a0475fa9555a8708b916c8226c51861aa`. The later Founder Studio Pack was reviewed as document/research context, not application code. No AGENTS.md or Git history was present. An isolated extraction was used. Before editing, 869 JavaScript, 88 DOM, 505 backend tests and 23 real-HTTP institution checks passed. No production/user database or provider credentials were used.

## Final results

| Check | Result | Command / evidence |
|---|---:|---|
| JavaScript unit suites | 869 passed | `npm test`; `node.log` |
| DOM integration suites | 102 passed, 0 failed/skipped | `npm run test:dom`; `dom.log` |
| Full Python backend suite | 522 passed, 1 warning | `.venv/bin/python -m pytest -q`; `python.log` |
| Focused department + institution backend subset | 37 passed | `department-support-python.log`; included in full suite |
| New real HTTP support scenario | 19 checks passed | `python tools/demo_department_support.py`; `department-http.json` |
| Existing institution HTTP scenario | 23 checks passed | `python tools/demo_institutions.py`; `institution-http.json` |
| Real local-launcher/SQLite smoke | 14 checks passed | `python tests/local_http_smoke.py`; `launcher-http.json` |
| Standalone bundle build | Passed | `npm run build`; `build.log` |
| Mobile web assets | Prepared successfully, offline-only | `npm run mobile:prepare`; `mobile-build.log` |
| Existing graph/model/intent numerical suite | 14 top-level checks passed | Research package: 8 decision cases, 5 structural scenarios, 1 independent reference |
| Preservation | 24 critical files byte-identical to baseline; no baseline files missing | `preservation.json` |

The focused subset overlaps the full backend suite. Counts must not be added as independent coverage. The warning is the inherited Starlette/AnyIO BlockingPortal deprecation. There is no configured standalone lint command; builds and the existing tests were run. The first full post-change backend run had 521 passes and one overly broad test assertion: it rejected the word "assessments" in a static privacy notice. The test was corrected to inspect forbidden field names/private values, then the focused and entire suites passed. That failed run is retained, not concealed.

## What the checks establish

- A learner's accepted assignment is not departmental reporting consent. The displayed policy version and current revision are required; unknown policy/stale writes fail. Retry, withdrawal, account changes, removed membership, and leave/rejoin tombstones are covered.
- Owners cannot retrieve an ungranted individual response just by owning a workspace. Named reviewers alone cannot request the owner summary. Summary requests reject extra filters and return no-store responses. Tenant/member/acceptance/opt-in eligibility and suppression rules are tested.
- Four eligible learners produce no participant/result band. Five can produce 5-9 with a stated support suggestion. Cells and their complements below five remain suppressed. The priority rule uses all accepted tasks but counts a learner once. No mastery or verified-test-condition claim is returned.
- First-response evidence remains first-response evidence after a successful retry. Publishing a corrected rubric changes nothing until an authorized explicit reassessment. The result history replays both versions. Clock rollback cannot hide a newer result. Replay exports are invalidated after a record change.
- Optional panels preserve reader DOM, selection/scroll state and focus behavior in DOM fixtures. Existing suites cover mode/state persistence, stored notes/corrections, saving, audio coordination, rapid-request handling, multilingual/RTL markup, reduced-motion rules, and hiding the avatar. These checks are not a substitute for native rendering or assistive-technology testing.
- The HTTP launcher smoke exercises real cookies/CSRF, isolated account libraries, saved notes/reviews through restart, backup/restore into another database, recovery and honest missing-provider failure. Temporary fictional users and data are disposed of.
- The source language catalogue, provider locale handling, transliteration, graph/model/intent modules, media services, pinned dependencies and all four launchers are unchanged at the byte level in the preservation manifest. User data is excluded from the archive.

## Unverified and deliberately unclaimed

Native Chromium could not start: process-singleton socket creation returned Operation not permitted. Browser recording and end-to-end native visual/keyboard/screen-reader/zoom/mobile/RTL checks therefore remain unverified. DOM fixtures and static CSS checks passed, but they do not certify accessibility. Windows/macOS launchers are preserved and not run on those operating systems. Physical Android/iOS, production Docker deployment, load/concurrency at campus scale, real authorized provider calls and audible speech were not tested. A clean dependency download on each native platform was not repeated; Linux used the existing pinned environment (Python 3.12.14, Node 24.22.1).

The report is not anonymous or differentially private, and has no privacy budget. Repeated reports, known rosters, collusion/manufactured accounts, and owner-visible audit metadata can disclose participation. It cannot recall already authorized in-flight or exported copies. Opt-in makes this a selected subset, not a department-wide estimate. No enterprise security certification, SSO, bulk onboarding, automated retention policy, ownership transfer, human efficacy result, or signed/paid Harvard deployment is claimed. Registration remains limited to five accounts per IP per hour. Council dialogue lacks an authorized conversational provider; its unavailable state does not block reading or reporting.

## Reproduction

Use the existing pinned development dependencies for tests; ordinary startup needs only the pinned runtime dependencies. Run commands from the extracted Nabu-1.17 folder. On Windows substitute `.venv\Scripts\python.exe` for `.venv/bin/python`. Both HTTP demo commands create their own temporary server/database and use fictional fixtures. The new five-learner scenario uses separate loopback client addresses, preserving the production registration guard.

The release packager verifies CRC, manifests, executable launcher bits and absence of runtime databases/secrets. `verification/overnight/packaged-launcher.json`, when present, records a separate extraction-and-launch smoke of the packaged payload. Final ZIP hashes are external so a file does not attempt to hash itself. See `START_HERE.md` for exact launch and data-preserving upgrade instructions.
