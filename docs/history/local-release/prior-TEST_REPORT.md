# Nabu 1.7.1 - Pages packaging repair

Date: 2026-11-05. Input: nabu-1.7.0-translit-concat-graph.zip, confirmed in the current runtime and extracted into a fresh work directory.
Build: nabu-graph-pages-20261105-r2.

## Defects confirmed and repaired

- The 1.7.0 source called renderConceptGraph() and renderFeatureDecisionTree(), but neither function was defined. Selecting a bank word or opening Settings could fail at render time. Restored both SVG renderers.
- The standalone builder read the feature-tree module but never assigned it to F inside the shipping runtime. The feature-tree data is now included in the self-contained HTML.
- The previous patch reused the older service-worker release identifier. The rebuilt HTML and worker now share a new matching identifier.
- Wide graph SVGs expanded the Settings grid on narrow screens. The grid now shrinks correctly and only the graph's own viewport scrolls.
- Global icon strokes were inherited by SVG text. Graph labels now render without that outline.
- Declared the existing graph generator's Unidecode build dependency in requirements-dev.txt.

## Verification performed

| Suite | Passing checks | Evidence |
|---|---:|---|
| JavaScript tests | 228 | verification/1.7.1/javascript.log |
| New Pages-only UI regression | 17 | verification/1.7.1/pages-ui.log; pages-ui.json |
| Existing startup UI | 14 | verification/1.7.1/existing-ui.log |
| Existing learning/accounts/social UI | 30 | verification/1.7.1/existing-ui.log |
| Existing bank UI | 19 | verification/1.7.1/existing-ui.log |
| Existing short-link/mobile UI | 17 | verification/1.7.1/mobile-ui.log |
| Total distinct checks | 325 | Not all are native end-to-end tests |

The combined test:ui shell command hit the tool time limit after the startup,
learning/social and bank suites had completed. The remaining short-link/mobile
suite was run separately and passed. Final CSS label/shrinking adjustments were
followed by another full build, all 228 JavaScript tests and the 17 new Pages UI
checks. Repeated runs are not counted twice.

The new regression exercises the rebuilt bundle with API-unavailable behavior,
word selection, automatic guest saving, twelve graph language nodes, Settings
with all nineteen feature-tree nodes, narrow-screen containment, concatenation,
duplicate protection and the existing draft transliteration display.

## Scope and remaining limitations

Browser tests use explicit URL/history and IndexedDB fixtures. The existing
account/UI tests use a real isolated FastAPI/SQLite implementation behind a
transport fixture. This does not validate deployed HTTPS, native browser
persistence, physical iOS/Android devices, real offline reloads, or provider keys.
No live accounts were created; no deployment or live database was touched.
The full Python/API regression suite was not rerun in this packaging repair.

Transliteration remains the 1.7.0 approximate Unidecode-derived draft: it is not
a pronunciation system, reliable Japanese kanji reading, or verified Arabic
vocalization. Coverage/rendering tests do not certify linguistic quality.
Concatenation is a rough assembly helper, not grammar-aware translation. Its
existing partial/ambiguous-output behavior is unchanged; inspect results before
studying them. These language-quality issues need a separate follow-up.

The source archive retains historical reports under docs/history and verification.
They are not evidence of fresh 1.7.1 API, hosting or native validation.
