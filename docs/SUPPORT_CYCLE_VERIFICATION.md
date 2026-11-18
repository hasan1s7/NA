# Support-cycle verification — 17 November 2026

## Executed checks

| Check | Observed result |
| --- | --- |
| `npm run build` and `python tools/build_pages.py` | Passed; generated CSP-hashed standalone bundle and root Pages mirror |
| `npm test` | 887 passed, 0 failed |
| `npm run test:dom` | 119 passed, 0 failed |
| `npm run test:support` | 28 passed, 0 failed (domain, controller and built-app checks) |
| Targeted existing/new content event API suites | 131 passed, 0 failed |
| Full `python -m pytest -q` | 536 passed; one obsolete shell-name assertion failed |
| Corrected shell assertion plus support API recheck | 17 passed, 0 failed; no runtime change required |
| `node tools/demo_support_cycle.mjs` | All deterministic walkthrough assertions passed |
| Native Chromium via managed preview | Save, supported response, fresh-context response, abstention, correction replay, audit download, reload and saved-reference restoration observed |
| `git diff --check` | Passed |

The full backend run collected 537 tests. Its only failure expected the old
`nabu-workspaces-1.17-` shell name, while this repository's current build uses
`nabu-pages-...`. The assertion now checks the actual `BUILD` value from the
builder against the generated HTML. The affected two-test file and the new
15-test API suite passed after this correction. The other 536 backend tests
passed in the full run; they were not unnecessarily repeated. The analogous
old hard-coded build identifier in the next-step DOM harness was updated to
check the builder's current identity, retaining its behavioral assertions.

## Native browser evidence

An isolated preview origin served the actual `public/index.html`. It used real
browser IndexedDB, without the request fixture used by the DOM suites.

1. A French passage remained in the original reader while a reference card was
   explicitly saved through the existing card store.
2. Opening translation before answering produced a supported response. The
   exported frozen snapshot included its opening timestamp.
3. A different sentence was answered with its extra aids closed. It produced a
   separate independent meaning-recall observation for the new context.
4. An ambiguous transcript abstained. Applying authored analysis v2 recomputed
   the current score and retained the original abstention beside it.
5. The exported audit contained 21 immutable events and three joint response
   observations. The first was supported; the next was independent; the last
   retained its historical abstention and correction lineage.
6. Reload restored the passage, evidence counts, suggested return and saved
   reference. The library showed one reference and zero due learning cards.

The 40-second video is a silent walkthrough composed from actual browser
screens at these interaction steps. It is not a continuous native-app or
cross-app overlay recording. No empirical learner result is claimed.

## Invariants covered by new tests

- Availability, opening and self-reported use are distinct. Later hints do not
  retroactively change a response. Backdated contradictory snapshots are rejected.
- A multi-target answer contributes one likelihood. Reprocessing is idempotent;
  conflicting IDs, changed task identity and second terminal responses fail.
- Episode retries remain dependent; recent feedback/source exposure carries
  forward. Closed optional help does not itself count as used.
- Incompatible interpretations abstain; corrected or unavailable analysis
  versions recompute or invalidate current measurements without editing history.
- Recognition, meaning recall, form recall, production, input/output modality,
  variety and item/construction scope remain distinct.
- Scoring uncertainty, partial knowledge, guessing, slips and analysis mixtures
  enter the likelihood. Time and practice transitions are separate operations.
- Support contrasts require comparable responses; lookup alone yields no
  support-dependence diagnosis. Seven parameter sensitivity runs remain labelled
  provisional and uncalibrated.
- Save retries and lost acknowledgements preserve the first response and ID.
  Playback acknowledgement retries do not replay audio; an actual replay is a cue.
- Account/intention changes and dialog replacement cannot reopen stale checks.
  No-practice intentions allow reading and help while suppressing checks.
- All 18 authored tasks in the six existing media pieces reuse their original
  rubrics and exact source versions. Arabic optional-vowel normalization is
  preserved. These remain item-level evidence, with original editorial status.
- Explicit passage saves use reference cards. Existing reader nodes, notes,
  cards, schedules, review logs, database version and deletion cascade survive.

## Verification limits

The optional standalone Playwright browser script could not launch Chromium
inside this executor because its Unix socket was denied. Native browser QA was
completed through the supported managed preview/cloud browser instead. The
script remains runnable in an ordinary local Chromium environment.

DOM fixtures verify transactions and UI wiring, not disk durability, layout,
speech quality or accessibility certification. Native browser QA covered
desktop text interactions and reload. Audio gating/replay was tested with a
controlled playback boundary; real installed-voice quality, a different human
speaker, mobile/native apps and causal learning efficacy were not validated.
The existing media annotations remain AI-assisted editorial drafts. Model,
scorer and scheduling parameters are provisional; no calibration data was
available. The source contract supports further authored analyses and tasks;
it does not provide an automatic parser or universal free-text semantic judge.
