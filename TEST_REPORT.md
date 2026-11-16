> **1.10.0 update:** Read [MEDIA_SETUP.md](MEDIA_SETUP.md) and [MEDIA_VERIFICATION.md](MEDIA_VERIFICATION.md) for the new context, speech, reading-aid, clip-art and Chrome-extension work. The 1.9.0 descriptions and results below are historical and are not new 1.10.0 verification.

# Nabu 1.9.0 verification report

Date: 2026-11-06. Base archive: `nabu-graph-1.8-source.zip` (hash in HANDOFF.md).
Build: `nabu-local-memory-20261106-r1`. Linux runtime: Python 3.13.5, Node.js 22.16.0, Chromium, Playwright 1.57.0. Installed server dependencies match requirements.txt.

## Results

| Suite | Passed checks | Evidence |
|---|---:|---|
| JavaScript domain/storage/graph/sync | 233 | `verification/local/javascript-final.log` |
| Full Python/API/operations suite | 264 | `verification/local/python-final.log`, `python-final.xml` |
| Startup and exact CSP, with explicit healthy-storage fixture | 14 | `verification/local/startup_browser.py.log` |
| Accounts/reading/practice/collaboration integration UI | 30 | `verification/local/next_browser.py.log` |
| Expanded word-bank interface | 19 | `verification/local/bank_browser.py.log` |
| Short links/native transport UI contracts | 17 | `verification/local/mobile_links_browser.py.log` |
| 2D/3D meaning-map interface | 10 | `verification/local/spatial_browser.py.log` |
| New local-release interface regressions | 11 | `verification/local/local_release_browser.py.log`, `local-ui.json` |
| Static/no-backend graph/settings/concatenation UI | 17 | `verification/local/pages_package_browser.py.log` |
| Actual loopback HTTP, launcher, SQLite, restart/recovery/restore | 14 | `verification/local/http-smoke.log`, `http-smoke.json` |
| **Total distinct checks** | **629** | Repeated runs are not counted again. |

The 118 browser/interface checks use explicitly injected storage and/or transport fixtures. Where account APIs are involved, the backend and isolated SQLite implementation are real. They are NOT evidence of native browser persistence, native cookie behavior, actual offline navigation, deployed HTTPS, physical iOS/Android operation, or live provider output. Startup checks also exercise the real browser's denied-storage case on about:blank and the exact shipping CSP.

The 14 loopback checks are actual HTTP calls to an actual server process launched by the local launcher using the already installed pinned dependencies. They use real HTTP client cookie jars, not a browser cookie implementation. They create temporary users/databases, not user accounts in a production database.

## Defects found and corrected

- Inherited Settings/feature-tree rendering referenced a missing `graphNodeText` function; Settings remained on its previous content with an error. Restored the helper and added explicit whole-page/tree checks.
- The graph's default displayed concept claimed a successful save even when the library was empty. It now checks the actual card and exposes Translate & save for an unsaved concept. Its audio action uses the displayed graph translation instead of a stale translator value.
- Background sync/focus refresh could replace the reader input while pasting, losing the draft. Passive refreshes now leave reader/translator inputs in place; added a node-identity and draft-preservation regression. The expanded-bank flow was rerun after reproducing and fixing this race.
- Incomplete concatenations were automatically saved with unresolved/ambiguous placeholder answers. These now remain unsaved and offer editing. Exact matches retain real bank identities; complete assemblies are explicitly draft Reference cards.
- The new launcher's initial bind-only port check rejected a legitimate quick restart while a TCP socket was in TIME_WAIT. Replaced with an active-listener probe, then reran real server restart/persistence/recovery/restore checks successfully.
- Existing provider cache was temporary process memory. Successful private translations now persist with settings/context-aware keys and owner isolation. Clearing during an in-flight generation cannot resurrect the cache. Tests cover eviction, settings/context separation, deletion, failed requests, quota rejection, single-flight and restart.

## What actual local HTTP tests exercised

The full server boot, matching built HTML/CSP headers, private-file isolation, two registered users, separate libraries, friend request acceptance, word delivery, private-note exclusion from collections, saved review mode, server stop/restart, password recovery with session invalidation and code rotation, restored library preservation, a new-file database backup/restore integrity check, and visible errors with missing provider credentials.

## Environment limitations and unsuccessful attempts

- A real Chromium navigation to `http://127.0.0.1:8765/` failed with `net::ERR_BLOCKED_BY_ADMINISTRATOR`. See `verification/local/native-browser-limit.txt`. We did not relabel browser fixtures as a native end-to-end result.
- The clean virtual-environment installer was attempted but the container could not resolve/connect to its package index. Pip ended with a failed resolution after DNS retries. The package pins were confirmed on PyPI, and the already installed matching versions were used for runtime tests. First-run online installation on a user machine is not certified here. See `verification/local/launcher.log`.
- The original failed Settings/port-check runs were used to locate bugs, then corrected and rerun. Failed checks are not included in the passing count.
- Windows and macOS launcher execution, a Docker image build, actual app-store/native builds, live DeepL/ElevenLabs requests, native linguistic review and real S3 offsite uploads were not performed. Existing offsite tests use simulated storage and real encryption/SQLite operations.

## Test-data and archive hygiene

Only isolated test accounts and synthetic material were used. No keys were requested, no paid service provisioned, no emails sent, and no live database overwritten. The release excludes `.env`, `.env.local`, virtual environments, caches, account databases, signing material and generated recovery files. `.env.example` and `.env.local.example` contain blank/example configuration only.

See `verification/local/archive-check.json` for the final archive's integrity, manifest, rebuilt-file and fresh-extraction test checks. Those repeated extraction checks are separate from the 629 distinct checks above.
