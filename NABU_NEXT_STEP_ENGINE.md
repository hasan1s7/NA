# Prompt 2: intent-aware next steps in the existing Nabu application

Implementation and inspection date: 13 November 2026. This document describes the implemented code and its limits. It does not claim learning gains, a verified linguistic graph, a calibrated learner model, or production enterprise assurance.

The starting workspace did not contain a checkout. Work continued from the existing `nabu-local-1.14.0.zip` source, not a new application. The Prompt 1 intent layer was implemented and tested first, then inspected again before this increment. Its separate checkpoint report is [NABU_INTENT_LAYER.md](NABU_INTENT_LAYER.md). This release includes both increments; the original package/mobile version labels are preserved. The shipping shell and service worker use build `nabu-next-step-20261113-r1`.

## 1. What actually existed

| Area | Verified implementation before the next-step increment |
| --- | --- |
| Application | Vanilla JavaScript modules and CSS, a CSP-hashed self-contained HTML build, a service worker, existing mobile/extension packaging, and a FastAPI/Pydantic backend. No framework replacement was introduced. |
| Storage | Guest IndexedDB, account library synchronization and existing offline queues, SQLite account/session/content tables, and existing tenant memberships. |
| Intent, after the completed Prompt 1 checkpoint | A versioned record with raw statement, immediate activity, optional destination/time horizon, languages, modalities, source reference, constraints/preferences, field-level provenance, lifecycle, timestamps, revision and actor scope. Private learner intents and member-readable organization objectives are separate. |
| Language bank | 900 word alignment records plus 90 phrases and 36 expressions across 12 languages. `conceptId` names an authored alignment group, not an established cross-language lexeme. English sense labels and some POS hints exist. Homographs can resolve to multiple entries. |
| Graph connections | The 12,312 primary term slots and 135,432 directed language-pair connections derive from 1,026 authored groups. These counts are not independently verified words or translation judgments. Topic links and 67 authored semantic bridges exist; they are not prerequisite or mastery edges. |
| Content pipeline | `data/explore.json` builds the existing catalogue. It contains six Arabic pieces, eighteen authored activities and twenty-four anchored annotations. All twenty-four annotation `conceptId` values are empty. No verified annotation-to-bank join was present. |
| Reader | Existing free-text intake, word/phrase lookup, ambiguity choices, contextual support, curated reading, source translations, and a separately authored Structure Lens. Existing optional speech and provider flows remain separate. |
| Learner evidence | Cards, self-rated review logs, independent recognition/production/listening/cloze schedules, and content events. This is an SM-2-inspired scheduling system, not the Bayesian learner posterior described in design material. |
| Recommendations | Existing due-card/practice ordering, `X.nextSupport`, `X.recommendNext`, and `/api/decisions` with four individual/team modes. These contracts remain intact. Syntax diagnostics concern analyses of a sentence, not learner mastery. |
| Missing prerequisites | No production lexeme/root/paradigm inventory, no imported UniMorph morphology graph, no attested full pattern-application store, and no validated task-utility model. The new code supplies a small typed bridge and a deterministic policy over available product actions. |

Sources for this inventory are the actual repository: `public/nabu-core.js`, `public/nabu-store.js`, `public/nabu-account-store.js`, `server.py`, `decision_engine.py`, `tools/graph-engine.js`, `tools/expand_bank.py`, `tools/build_graph.py`, `data/wordgraph-source.json`, `data/phrasebank-source.json`, `data/explore.json`, and their existing tests. Historical readme and package labels are not treated as proof of implemented features.

## 2. Three distinct inputs, joined at the decision boundary

The new policy consumes three independent inputs:

1. **Structure:** catalogue alignments, exact language-tagged surface forms, authored usages, source anchors, quality flags and provenance. Structural availability never creates a learner observation.
2. **Learner evidence:** observed self-ratings in a particular mode and language, or responses to an exact authored activity. A missing observation stays unknown. Merely saving, reading, opening, or encountering a graph neighbor is not performance evidence.
3. **Intent/task:** the active selected private intent, its optional destination, the separate organization objective, the actual source selection, and explicit preferences/constraints.

`buildTask` preserves field provenance. An inferred activity or language stays inferred even if a contradictory record-level status says explicit. An inferred language cannot choose an introduction language. Raw text survives uncertain parsing; it is never silently replaced with a confirmed goal. A team objective is shown separately and does not reroute an individual's poetry exploration into customer-support practice.

An introduction task has an optional, ungraded reflection rubric: choose a suitable greeting, express appreciation, ask a genuine question, and follow the response or ask for repetition. These are possibilities, with no required order. They do not assert that Mexican families share one cultural script. The rubric is an authored scaffold, not extracted evidence that the learner promised to perform four steps.

Exploration is complete as an intention. A destination, a quiz, and a completion score are not required. Planning lifecycle completion from Prompt 1 remains separate from any exercise result.

## 3. Graph integrity findings and quarantine

### The external P073 and marciendo material

The repository and live bank did not contain `P073`, `marcir`, or `marciendo` before the new integrity registry and tests. The external design PDFs describe a different, more ambitious morphology system. Their claims are not evidence that the current application implements that system.

The available graph-workspace PDFs were inspected as separate design/source artifacts; no separately named critique or upstream morphology extraction job was present in the source archive. The 515-page **Nabu Language Graph Workspace (1).pdf** contains the relevant rows. Physical pages were rendered and checked visually:

- Page 25 labels **P073** as **past system**.
- Page 193 lists **marcir**, class **ir**, status **irregular**, with **P073** in the past-system column.
- Page 30 has a table headed `change: expected>actual [cells affected]`. Its exact suspicious cell is `marciendo>attestation criteria [1 cells]`, with one verb, one independent base verb and tier `stored`.

The page-30 row does not itself print a pattern identifier. The registry preserves these as distinct observations; a raw upstream join and the cause of the contamination were not reproduced. The inspected source archive does not include the underlying verb extraction/normalization job that produced this PDF. The PDF's dataset-size and pattern-count claims remain unverified here.

**Marciendo itself is not blacklisted.** The RAE–ASALE DLE conjugation table for [marcir](https://dle.rae.es/marcir) explicitly lists `marciendo` as the gerund; [Larousse's conjugation table](https://www.larousse.com/conjugaison/espagnol/marcir/2096678) also lists it. These references were checked on 13 November 2026. Dictionary listing establishes the listed form, not its corpus frequency, contextual suitability, the complete paradigm, or the PDF's P073 application.

The registry quarantines the **specific external output record/mapping**, because `attestation criteria` appears where an actual Spanish form is expected. It records the source document, physical pages, exact observed cell, original counts and reason for review. It does not delete that evidence, declare every P073 application invalid, or claim that a live bank record was removed. A supplied unverified/generated application cannot earn recommendation eligibility merely from its output count or a boolean `attested` flag. The exact surface's separate dictionary evidence does not repair the contaminated application.

### An issue in the actual bank

The existing uncle/aunt alignments combine maternal and paternal alternatives. For example, the legacy resolver maps Arabic `خال` through the generic uncle group to Chinese `叔叔`, although the source note itself distinguishes family branches. The same issue affects other branch-specific aliases. This is enough to require context; it is not a claim that every pair in the group is wrong.

`relatives.uncle` and `relatives.aunt` are therefore withheld from **new context-free next-step recommendations**. Existing bank IDs, stored cards and resolver behavior are preserved. There is no quiet mass correction or deletion of existing vocabulary.

### Typed structural bridge

`public/nabu-structure.js` provides a read-only view of the existing data:

- `alignment:<legacy-id>` preserves the authored meaning/translation group.
- `form:<language>:<NFC-surface>` gives an exact language-scoped surface identity. Lookup normalization is not lexical identity. The same surface can connect to several alignments.
- `usage:bank:...`, `usage:explore:...` and `media:explore:<id>@<version>` represent actual authored examples and exact versioned media occurrences.
- `lexemeId` and lexical `senseId` remain `null` where the repository has no evidence for them. They are not invented from strings or English glosses.
- All current reader annotations retain their original Unicode-scalar offsets, quote, segment and content version. Their absent concept links remain absent.

`validatePatternApplication` validates a full record containing inputs, outputs, per-part and application features, provenance and complete competing analyses. It reports `linguisticCorrectness: 'not-checked'`. The production morphology inventory remains empty; only explicitly synthetic fixtures exercise this boundary. No multi-part application is reduced to unrelated input/output edges or counted as several attestations.

`groupEvidenceBySource` groups known shared lineage, copied source records and sibling outputs. It explicitly returns `independenceEstablished: false`; counting lineage buckets does not establish statistical independence.

The registry is in `data/graph-integrity.json`, with a generated local module in `public/nabu-structure-data.js`. `tools/build_standalone.py` regenerates that module and embeds it. No runtime network request fetches graph policy. See [docs/GRAPH_INTEGRITY.md](docs/GRAPH_INTEGRITY.md) for the structural API and limits.

## 4. Candidate generation and transparent ranking

The pure JavaScript policy is `intent-next-step-v1`. It proposes only actions with an explicitly enabled current-product capability:

| Action | Actual implementation used |
| --- | --- |
| `annotation` | The existing reader's contextual note for the exact quote occurrence in the exact content version |
| `compare-senses` | A local modal showing all actual matching bank meanings; no automatic sense selection |
| `bank-entry` | Existing authored bank wording and translation in the existing modal system; source text is not replaced and no card is silently saved |
| `practice-content` | An existing authored activity belonging to the active curated piece; ordinary skip and return controls remain available |
| `open-content` | An actual versioned piece in the existing catalogue |
| `continue-media` | Close the optional suggestion and keep the current reading/listening/exploration |
| `edit-intent` | Open the same Prompt 1 intent editor |

All available bank wording and curated support remain visibly labeled **authored/unreviewed drafts**. No generated phrase, corpus attestation, native recording, imaginary exercise or invented learner response is added. Arbitrary song lines are not submitted to a model. When no local supported material matches, the panel says so and offers continuation.

Candidate priority is an additive, explainable heuristic. Every candidate returns its contributions and reasons:

| Contribution | Meaning and current bounds |
| --- | --- |
| Task utility | Authored priority for an action that can serve the stated activity; no calibrated benefit estimate |
| Source relevance | Higher for an exact selected occurrence or spelling, lower for a task-related phrase absent from the media |
| Direct learner evidence | `0` for unknown; a small `+0.8` support preference for the exact relevant most recent Again self-rating or unmatched authored response, or `+0.4` for assisted authored performance |
| Meaning to clarify | `+1.5` for a real unresolved bank ambiguity; explicitly not expected information gain |
| Explicit preference | A continuation preference for an explicit no-practice/keep-reading request; latest More-like-this content preferences can add a small catalogue preference |
| Effort | `-min(1.5, estimatedSeconds / 120)`; estimates are authored, not measured individual costs |
| Interruption | A small authored penalty for opening support or changing the activity; continuation has none |

The policy does not use node centrality, graph coverage, unlock scores, a Steiner tree, or pattern counts as task value. It does not fill missing history with negative evidence. Ranking is deterministic with a stable identifier tie break. It returns one primary action, up to two alternatives and a separate continue action. No candidate is executed automatically.

### Real implemented examples

- **Alexandra's mamá:** the original sentence alone leaves the language unknown and offers an optional intent correction. After the learner explicitly supplies Spanish, the existing `phrases.nice_to_meet_you` entry can offer `Mucho gusto.` with the authored first-meeting usage note. Appreciation and repetition options are alternatives. No family customs, proficiency or deadline are inferred.
- **Multiple senses:** selecting English `light` can compare `home.light` (illumination) and `colors.light` (lightweight; not heavy) against the current sentence. The existing second ID is historical; its actual sense and Spanish `ligero` are retained. It does not invent a river-bank sense for `bank`, which the current bank lacks.
- **Song line:** a synthetic song-selection fixture containing the existing expression `a piece of cake` gets bounded local expression support. The source fixture is not attributed to a real song. An unmatched lyric receives no fabricated whole-line translation or exercise.
- **Arabic poetry:** explicit open-ended Arabic poetry exploration can open either of the two actual catalogue poems. It has no required destination and does not initiate a quiz.
- **Unknown graph neighbor:** a good or poor review of a related entry does not change the suggested entry's evidence state. Translation-equivalent entries in another language likewise do not transfer performance.
- **Conflicting team goal:** a Spanish support-call organization objective remains visible while the individual's Arabic poetry task drives the suggestion.
- **No safe candidate:** unknown text or quarantined structural input leaves continuation available, with an honest absence-of-support message.

## 5. Learner-evidence boundaries

Recognition, production, listening and cloze observations stay separate. Production-mode card ratings are self-reports, not objectively assessed free speech. Bank support uses the relevant mode for its task, and historical `log.before` identity prevents a later card edit from reattributing an old observation to another meaning.

Curated response evidence is bounded to the supplied answer key and existing Arabic normalization policy. It is not general recall or language proficiency. Selecting a suggestion, reading a note, opening content, saving a word, marking a piece read, or skipping a question does not create performance credit.

Three review findings were fixed with regressions in the new policy:

1. An activity about one annotation cannot supply success/failure evidence for an untested annotation in the same piece.
2. A prior hint/answer reveal in the same content version, activity and session conservatively marks the later response as assisted even if that response claims otherwise. This occurs in a read-only evidence view; historical events are not rewritten.
3. Repeated spelling elsewhere in a passage cannot borrow the first occurrence's annotation. Source position is validated using the actual segment and Unicode-scalar-to-UTF-16 conversion.

The historical content and `/api/decisions` policies are preserved; these safeguards apply to the new policy's consumption of their records. No retrospective mastery scores are created.

## 6. Interface integration and privacy

Explore and Read now include an unobtrusive **Suggest a next step** control below **Right now**. Suggestions are requested explicitly. The panel contains functional action controls, concise reasons, optional score/source disclosures, meaningful alternatives and continuation. The introduction rubric is a disclosure, not an onboarding step. The existing intent editor remains available.

Only the support panel or existing modal is changed. Bank support does not call the old graph-selection action, which would risk reusing the reader's current front/context for an unrelated phrase. Curated annotation and practice actions call the existing real handlers with validated IDs. No action fabricates audio, inserts a translation into the original media, enrolls vocabulary or grades a learner.

Source, actor, selected intent revision and organization-objective revision are checked before displaying or executing a suggestion. A changed selection or account invalidates the result; late account responses are rejected. A failed authenticated request does not fall through to guest history. Account/tenant changes clear optional support. Private raw text is not included in the new integration event.

The panel follows existing colors and typography, uses native buttons/details with keyboard focus styling, wraps at mobile widths, and isolates user/script text with `dir="auto"`, language tags or `bdi`. Functional DOM tests do not establish native screen-reader, visual layout, scroll or playback acceptance; see verification limits below.

## 7. Storage, setup and compatibility

Prompt 2 adds **no tables, migrations, runtime dependencies or paid provider requirement**. The new authenticated read-only endpoint takes one SQLite snapshot using existing data. The UI executes the shared JavaScript policy locally, avoiding a divergent Python ranking implementation.

Prompt 1's additive `nabu_intents` and `nabu_intent_selections` tables are created on startup with `CREATE ... IF NOT EXISTS`; existing tables and `PRAGMA user_version` are unchanged. Guest intents use the existing `meta` store. Signed-in intent editing remains online-only; no new account-intent offline queue was added. See its report for the full lifecycle, ownership and idempotency contract.

Use the existing launcher (`python start_local.py`) and the same deployment/browser origin. The already built self-contained `public/index.html` and matching service worker are included. Preserve private configuration, `.data/`, existing databases, virtual environments and browser storage when upgrading. Back up the SQLite file before first starting an updated source tree. Changing origin can make a guest IndexedDB library appear empty because it is a different browser storage scope.

To regenerate the full existing application pipeline, run `npm run build`. For only edited client modules and graph-integrity JSON, run `python tools/build_standalone.py`. Neither command installs a new service or calls a model. Optional DOM tests use jsdom as an external test tool only.

The original public graph APIs, word-library schemas, backup/import contracts, content event meanings, `/api/decisions`, and account sync behavior are retained. Existing library exports do not include the new intent records; server database backups do. A delete removes the live intent, not old database backups. The implementation provides the existing account/membership scoping, not encryption, enterprise certification or a new organization administration product.

## 8. Interfaces and events for Prompt 3

### Server input snapshot

`GET /api/next-step-inputs?tenantId=<existing-team-id>` requires the existing authenticated session. Omit `tenantId` for individual context. The server checks membership before reading evidence and derives the owner from the session, never from a supplied learner ID. Team membership does not expose teammate history or private intentions.

```js
{
  schemaVersion: 1,
  intentContext: {
    schemaVersion: 1,
    actor: { kind: 'individual' | 'team', userId, tenantId },
    selection: { mode: 'none' | 'selected' | 'exploring', intentId },
    immediateIntent: IntentRecord | null,
    organizationObjective: IntentRecord | null
  },
  evidenceScope: {
    ownerUserId,
    kind: 'personal-account',
    tenantAttribution: 'not-recorded'
  },
  cards, logs, contentEvents,
  limits: { cards: 5000, logs: 10000, contentEvents: 8000 },
  truncated: { cards: boolean, logs: boolean, contentEvents: boolean }
}
```

The returned card/log fields are minimal identity, schedule and review fields. Private notes, source context, back translations, lookup history and media bodies are omitted. Actual bounded recall answers are included only for the authenticated owner so the existing authored matcher can evaluate them. Existing personal evidence was not recorded with a team attribution; selecting a team does not retroactively label it team-specific. Truncation is explicit; omitted history must stay unknown.

### Shared pure functions

```js
import {
  buildTask, sourceSnapshot, recommendNextSteps
} from './public/nabu-next-step.js';

const decision = recommendNextSteps({
  intentContext,
  source: {
    contentId, contentVersion, sourceLang, targetLang,
    text, selectedText, selectionStart, selectedIndex,
    hasMedia, format
  },
  cards, logs, contentEvents, evidenceScope,
  capabilities: {
    annotation: true,
    'compare-senses': true,
    'bank-entry': true,
    'practice-content': true,
    'continue-media': true,
    'open-content': true,
    'edit-intent': true
  }
});
```

Capabilities default to false. Only enable actions that the consuming client really implements. Versioned catalogue source must match the actual text; selected text must match its exact occurrence. Optional structural provenance/quality fields are supported for future safe ingestion, but no production morphology is imported in this increment.

The decision includes `schemaVersion`, `policy`, `task`, `taskKey`, `sourceSnapshot`, `intentRef`, `primary`, `alternatives`, `continueAction`, `noSafeSupport`, `supportStatus`, `notices`, `evidenceScope` and limitations. Candidates include a functional action descriptor, evidence and uncertainty, source provenance, an authored time estimate, and the numeric contributions with explanations. Consumers should display the provenance/uncertainty, retain the separate organization objective and reject stale actions. `taskKey` is a lightweight fingerprint, not a cryptographic identity, authorization credential or deduplication guarantee.

### Tab-local integration event

The existing UI dispatches `window` CustomEvents named **`nabu-next-step`**:

```js
{
  schemaVersion: 1,
  policy: 'intent-next-step-v1',
  phase: 'shown' | 'selected' | 'continued' | 'dismissed' | 'unavailable',
  at, taskKey, intentRef,
  scope: { kind, tenantId },
  sourceRef: { id, version } | null,
  candidateId: string | null,
  actionType: string | null
}
```

These events contain no raw intent, media text, answer, note or user ID. They are **not persisted, uploaded or treated as learner performance**. `selected` is emitted after a supported action opens, not after the learner achieves an outcome. `unavailable` means no safe local material was offered, not that the learner failed. The current action adapters and request guards are in `public/nabu-next-step-ui.js`. Prompt 3 can subscribe to the hooks or call the pure engine, while any new persistence must use authenticated server-derived ownership and an explicit event contract.

## 9. Files added or changed

| Files | Purpose |
| --- | --- |
| `public/nabu-next-step.js` | Task construction, evidence projection, candidate generation and transparent ranking |
| `public/nabu-next-step-ui.js`, `public/nabu-next-step.css` | Optional existing-screen support, actual action adapters, stale-result guards and local events |
| `public/nabu-structure.js`, `data/graph-integrity.json`, `public/nabu-structure-data.js` | Typed structural view, integrity registry and generated local policy module |
| `next_step_inputs.py`, `server.py`, `intents.py` | Authenticated read-only snapshot; shared context reader; additive capability flag |
| `public/nabu-app.js`, `public/nabu-intent-ui.js` | Reader/source integration and reuse of the intent editor; no parallel app |
| `tools/build_standalone.py`, `public/index.html`, `public/nabu-sw.js` | Bundled modules/CSS/registry, exact CSP hashes and matching release identifier |
| `tests/next-step.test.mjs`, `tests/structure.test.mjs`, `tests/fixtures/next-steps.json`, `tests/test_next_step_inputs.py` | Policy, provenance, ambiguity, full applications, evidence and API scope regressions |
| `tests/next-step-ui.dom.mjs`, `tests/next-step-bundle.dom.mjs` | Optional real-module and shipping-bundle DOM interaction tests |
| `docs/GRAPH_INTEGRITY.md`, `NABU_NEXT_STEP_ENGINE.md`, `README.md`, `package.json`, `SHA256SUMS.json` | Source findings, interface handoff, limitations, commands and regenerated source-file checksums |

Prompt 1 files and fixtures remain in the source bundle; its complete changed-file list and separate test checkpoint are documented in its report.

## 10. Verification and remaining limits

Final verification used the following exact commands. Focused suites are subsets of the full Node/Python totals, not extra tests to double-count. The optional DOM suites are separate.

| Command | Final result |
| --- | --- |
| `npm run build` | Passed all five existing build stages: six content items/twenty-four annotations, 900 words/ninety phrases/thirty-six expressions, graph generation, five existing illustration assets, and the self-contained CSP-hashed bundle |
| `npm test` | **535 passed, 0 failed, 0 skipped**, 2,450.507597 ms |
| `python -m pytest -q` | **378 passed, 0 failed**, two dependency deprecation warnings, 76.45 s |
| `node --test tests/next-step.test.mjs tests/structure.test.mjs` | **68 passed, 0 failed, 0 skipped**: forty policy tests and twenty-eight structural tests; included in the 535 above |
| `"$CODEX_PRIMARY_RUNTIME_PYTHON" -m pytest -q tests/test_next_step_inputs.py tests/test_intents.py tests/test_decision_engine.py` | **67 passed**, two dependency warnings: fifteen new input-bridge tests, forty-nine intent tests and three existing decision tests; included in the 378 above |
| `git diff --check` | Passed |

The exact combined DOM command was:

```bash
NABU_TEST_JSDOM=/workspace/scratch/014f6feb54e9/_qa/node_modules/jsdom/lib/api.js \
  node --test tests/intent-ui.dom.mjs tests/next-step-ui.dom.mjs tests/next-step-bundle.dom.mjs
```

Result: **34 passed, 0 failed, 0 skipped**, 2,798.750523 ms. This comprises twelve intent tests, eighteen next-step UI tests and four new shipping-bundle flows. In the shipped bundle, the mamá phrase, actual light meanings (`luz`/`ligero`), anchored Arabic explanation/exercise, and unsupported-line continuation all run through the existing controls. Requesting/opening support adds no network calls, cards, review logs, practice attempts or hint events in these fixtures; reader nodes and complete text are preserved.

The supplied baseline passed 410 Node tests and 314 Python tests before any changes. Prompt 1's checkpoint passed 467 Node tests, 363 Python tests, and twelve separate DOM tests. The combined release results above include those regression suites.

Test runtime: Node 24.22.1; Python 3.12.14; FastAPI 0.141.1; Pydantic 2.13.4; HTTPX 0.28.1; pytest 9.2.0. Existing production dependency pins were preserved; these runs used the installed environment rather than a clean reinstall of those pins. The Python warnings concern AnyIO's pytest alias and Starlette's HTTPX test client. jsdom 31.0.1 was installed outside the application only as a test tool. The first full build attempt stopped because the environment lacked the existing `Unidecode==1.4.0` dev requirement; installing that declared version and rerunning the unchanged build succeeded. No dependency was added to the application.

The historical Chromium startup suite was attempted but could not launch: Chromium's process-singleton socket failed with `Operation not permitted`. DOM tests execute the actual UI code, state/storage adapters and self-contained bundle with a test-only in-memory IndexedDB implementation. They do not establish native layout, actual disk durability, cookies, service-worker behavior, screen-reader behavior, native mobile packaging, or live playback/scroll fidelity.

Remaining limitations include the small authored catalogue, unreviewed translations and annotations, absent production morphology and sense inventory, no upstream reproduction of the PDF export, a deliberately narrow deterministic intent parser, no validated task-utility model, and no controlled measurement of learner benefit. The new integrity registry guards identified records and provenance claims; it is not a completed linguistic audit of every catalogue entry. There is no automatic cloud intent parsing, new recommendation telemetry upload, speculative curriculum, or forced assessment.

## Appendix: complete change inventory against the supplied source

The combined Prompt 1 and Prompt 2 increment adds or changes these thirty-four files. Historical assets remain in the archive. `SHA256SUMS.json` is regenerated over actual packaged relative paths, preserving leading dots in filenames and excluding itself; it corrects the older manifest's path normalization.

```text
NABU_INTENT_LAYER.md
NABU_NEXT_STEP_ENGINE.md
README.md
SHA256SUMS.json
data/graph-integrity.json
docs/GRAPH_INTEGRITY.md
intents.py
next_step_inputs.py
package.json
public/index.html
public/nabu-app.js
public/nabu-intent-store.js
public/nabu-intent-ui.js
public/nabu-intent.css
public/nabu-intents.js
public/nabu-next-step-ui.js
public/nabu-next-step.css
public/nabu-next-step.js
public/nabu-structure-data.js
public/nabu-structure.js
public/nabu-sw.js
server.py
tests/fixtures/intents.json
tests/fixtures/next-steps.json
tests/intent-store.test.mjs
tests/intent-ui.dom.mjs
tests/intents.test.mjs
tests/next-step-bundle.dom.mjs
tests/next-step-ui.dom.mjs
tests/next-step.test.mjs
tests/structure.test.mjs
tests/test_intents.py
tests/test_next_step_inputs.py
tools/build_standalone.py
```
