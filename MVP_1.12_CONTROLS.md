# New-flow control inventory

All actions use the existing application's event delegation. Handler existence is checked in rendered screens; behaviours below are exercised by domain/API/browser-fixture tests. Native browser/audio acceptance remains separate.

| Control | Real action and state | Recovery / boundary |
|---|---|---|
| Interest filters / All | Filter actual catalogue items; clear/toggle filter | No placeholder cards; current-session filter |
| Read / Continue / Open next | Open that packaged item in the existing reader; persist opened event; restore recorded segment | Unknown ID/version rejected; error retains usable source |
| Bring your own text | Existing reader editor | Arbitrary full document remains tab-local |
| Underlined expression | Authored exact occurrence with original sentence/meaning/usage | Unknown words use existing dictionary/manual path |
| Select phrase | Existing reader range-selection control | No fabricated meaning for missing coverage |
| Reveal translation / About | Native accessible details disclosures | Real text and source/rights, no remote fetch |
| Listen / Stop / Replay | Existing audio engine; matching voice and visible errors | No recording/timing claims; device audio unverified here |
| Save / Retry save | Existing reference-card transaction; source/provenance retained | Draft persists on failure; no implicit review enrollment |
| Reading aid / image / note controls | Existing 1.11 context tools/store | Preserve manual edits/hidden readings/rejections |
| Mark as read / mark unfinished | Persist explicit boolean completion event | Not comprehension or mastery |
| Optional practice / task tabs | Open real source-related task in existing modal | No mandatory sequence; unavailable persistence gives errors |
| Hint / Reveal answer | Persist assistance event, then display authored help | Failure explains itself; pending fields locked |
| Check response / Retry | Durable raw response, task/version, assistance; explicit deterministic grade | Empty validation; stable retry ID; failed response retained |
| Skip | Durable skipped event with no correctness grade | No silent incorrect mark |
| Return / close / Escape | Close modal/sheet and restore reading/focus | Submitted operation may finish privately; no stale screen overwrite |
| Why this practice? | Show actual policy reason/version | Not a posterior, no invented uncertainty score |
| More like this / remove preference | Owner-scoped explicit preference; rerank real next item | Does not alter knowledge estimate |
| Your saved words | Existing library route | References remain optional to enroll |
| From the beginning | Scroll to first segment, persist position | No media seek/autoplay |
| Retry progress sync | Drain owner queue using existing auth/CSRF transport | Guest reloads failed local state; expired identity opens account action; a missing/older server exposes Check connection, which makes a real connection attempt and explains any remaining incompatibility |
| Export reading progress | Existing download helper produces private JSON from current identity | Export only: no import UI; server SQLite backup is restorative account backup |

New native details, button names, focus restoration, RTL layouts, pending/failed/success states and visible text contrast are checked. Old sections/integrations are retained, not rewritten. Fixture controls are not a guarantee about unavailable hardware/provider APIs.
