# Nabu: auditable evidence around a working episode

**Checkpoint record:** this document describes Prompt 3 at commit `dd8e829`. The later graph-focused extension is documented in [NABU_GRAPH_FOUNDATION.md](NABU_GRAPH_FOUNDATION.md), with current verification in [docs/GRAPH_VERIFICATION.md](docs/GRAPH_VERIFICATION.md). The observation/event contracts below remain in place. The original checked paper is preserved under `paper/history/evidence-loop-20261114/`; `paper/nabu-evidence.pdf` now contains the updated graph paper.

Status: implemented extension of the existing Nabu application; synthetic research prototypes are separate. Updated 2026-11-14. Build: `nabu-evidence-20261114-r1`.

This release answers four questions without turning a graph relationship into learner knowledge: **What happened? What does that event support? Why offer this next action? What remains unknown?** It extends the verified Prompt 1 and Prompt 2 checkpoint `28d3bc9`. It preserves the reader, card identities, existing review schedules, authored content IDs, account storage and earlier recommendation contracts.

## What actually existed before this change

Inspection and fresh baseline tests confirmed the following. These findings come from the repository, not the external graph workshop slides.

| Component | Verified implementation at the Prompt 2 checkpoint |
| --- | --- |
| Application | Vanilla JavaScript modules and CSS; a Python builder embeds the application in a self-contained HTML page. FastAPI/Pydantic and SQLite provide the optional authenticated backend. |
| Intent | `nabu-intents.js`, `nabu-intent-store.js`, `nabu-intent-ui.js`, and the existing intent routes implement free-text local parsing, explicit/inferred/exploratory/unknown provenance, lifecycle and revisions. Immediate learner intent and organization objective are separate. Guests use IndexedDB metadata; authenticated intents use SQLite. |
| Language structure | The bank has 1,026 authored multilingual alignment entries, not a validated lexeme ontology. `nabu-structure.js` preserves ambiguous surfaces, provenance, context gates and full application records. No production morphology applications are imported. |
| Content | Six Arabic reader items, 24 anchored annotations and 18 authored exercises. The current content and translations are drafts, not independently reviewed material. The pipeline remains `data/explore.json` → `build_media_catalogue.py` → generated catalogue. |
| Learner state | Cards and review logs already retain recognition, production, listening and cloze schedules. The existing SRS remains authoritative for those schedules. There was no validated learner-specific forgetting model to reuse for the new evidence view. |
| Events | `content_events` already stored immutable JSON records under `(user_id, event_id)`, with duplicate-delivery checks. Browser queues use the existing metadata store. The old attempts lacked complete episode, assistance, intended-reading and scorer/analysis-version metadata. |
| Recommendations | `nabu-next-step.js` implements transparent task-aware heuristic priorities over real support actions. `nabu-content.js` supplies the earlier authored practice sequence. Neither graph centrality nor a bandit was required to keep these working. |
| Tests | Fresh baseline: `npm test` — **535 passed**; `python -m pytest -q` — **378 passed**, with two dependency warnings. Existing DOM suites are also retained. |

The earlier Prompt 2 integrity registry remains unchanged. It records a suspicious external PDF output association around P073 separately from the dictionary-listed surface `marciendo`; it does not blacklist that surface or claim that a production morphology graph was repaired. See [docs/GRAPH_INTEGRITY.md](docs/GRAPH_INTEGRITY.md).

## Three separate components

**Language structure and task authoring.** The existing structural adapter proposes bounded relationships and preserves source uncertainty. Because the live bank has no complete production morphology applications, this release uses eight explicitly authored Arabic contrasts as the smallest bridge. Their IDs are task-local references; they do not create a new ontology, morphology generator or graph mastery state. Each item declares its intended reading, exact response rubric, cues and provenance. A grammar reference supports a rule; it does not attest the task or independently review its wording.

**Observation interpretation.** `nabu-observations.js` is a pure, separately tested module with no graph, network, database, scheduler or policy imports. It validates events, resolves versioned tasks, recomputes rubric matches, reconciles assistance, keeps first responses and retries distinct, and produces a source-linked ledger. It does not estimate an overall probability of competence. Both overall and target `competence` values remain `null`.

**Policy.** The Prompt 2 baseline continues to propose task-related support and media. `nabu-evidence-policy.js` adds a small deterministic optional-check policy around the current authored phrase. Candidate availability, task usefulness, possible diagnostic branches, interruption cost and selection are separate fields. Each policy result includes the actor, intent/objective references, observation-policy version, replay time and source event IDs that supplied its input. Help is available immediately. A diagnostic is offered only when the declared outcomes change the subsequent help. The policy makes no numerical learning-gain claim, Pareto frontier, reward estimate, exploration probability or contextual-bandit claim.

## The working episode

Start the normal application and open **Explore → A Little Later**. The existing dialogue, word support, translation disclosure, intent controls and practice remain in place.

1. Opening the piece writes one existing `opened` event with an additive evidence envelope. It records an opportunity for exposure, not attention or comprehension.
2. Selecting an annotated phrase records a help request at that occurrence. Opening the English translation records supplied support. Neither action creates a failure, and closing the translation does not erase the earlier assistance.
3. Existing practice submissions retain their original `attempt` event and fields. The same event now contains the audit envelope. A second response event is not generated for the same answer. Existing recall leaves source text available behind its modal, so the new audit correctly records source support rather than claiming an independently produced answer.
4. Near the reading controls, **Get context now** opens the existing explanation for `خذي وقتك`. **See an optional short check** offers help, a decision-relevant authored check, or continued reading. There is no forced quiz, destination or onboarding step.
5. The new optional check temporarily covers all background reader/support content and stops optional device pronunciation while preserving their DOM nodes and content. Its actual prompt and cues stay visible. A skip is saved without grading and offers a return to reading; Return, close, or an intent/account change restores the source. This behavior has DOM integration coverage; native visual and assistive-technology validation is still outstanding.
6. A response is frozen on first submission. A storage retry sends the identical event ID, time and answer. Earlier assistance is retained. Answer feedback is a support event; a corrected retry does not replace the original response or add another independent count for that episode/target/mode.
7. **What this reading and practice show** opens a small ledger. Each row explains its bounded support, exclusions, source event and episode. **Replay the ledger** recomputes from the immutable records. **Export scoped evidence** exports the current actor/team events, projection and current policy explanation. These controls do not change cards or review schedules.

The interface uses the existing dialog and button system, visible labels, direction-aware Arabic text, logical CSS properties and narrow-screen wrapping. It introduces no new dashboard, audio recording, speech scorer, media player or translation provider. Existing pronunciation actions outside this bounded episode are not falsely represented as newly instrumented assessments.

## Evidence contract

| Recorded observation | What it supports | What it cannot establish |
| --- | --- | --- |
| Display or play | An opportunity to encounter the referenced material | Attention, comprehension, recognition or successful retrieval |
| Lookup | A help request at a particular occurrence | Ignorance of meaning, especially when the request concerns pronunciation |
| No lookup | No assessed event | Success or knowledge |
| Correct choice | Visual or auditory recognition under the actual prompt, options and modality | Uncued recall, production or another modality |
| Recall response | A match or mismatch to the recorded retrieval rubric and assistance condition | Broad vocabulary competence or an untested sense |
| Contextual production | A result for that context and rubric, when a supported task supplies one | Universal productive mastery |
| Correct response after answer visibility | Assisted performance, with the original first response retained | Independently producing the answer |
| Skip, with or without a reason | A choice not to complete that check | Correctness, inability or a reward signal |
| Later unassisted success with explicitly changed conditions | A result under that delay and recorded lexical, sense, speaker, syntax, modality or assistance condition | General transfer or an individualized retention curve |

Visual recognition, auditory recognition, retrieval and contextual production remain distinct. The existing recognition/production/listening/cloze modes are also preserved, so a cloze result is not silently merged with full recall. The current new UI uses text and choice tasks; auditory and contextual-production contracts are tested with clearly authored software fixtures, not invented recordings or real learner histories.

Task definitions can require assistance. In particular, a task with a supplied base meaning remains assisted even if a client falsely supplies all-false assistance flags. Recorded historical outcomes are not trusted as the scorer result: the exact versioned task is resolved and its rubric is applied again. Invalid choices, unavailable tasks, changed analyses and quarantined mappings remain unscored or stale.

## Authoritative storage and identity

There is **no new database table or parallel event store** in Prompt 3. A `kind: evidence` record supports new observations. Existing `opened`, `help` and `attempt` records can carry the same additive envelope. Historical legacy records remain readable; their missing conditions are not fabricated.

Every envelope contains:

- Schema version, stable episode ID, optional retry parent, and attempt ID where a task is involved.
- Exact actor `{userId, tenantId}`, learner-intent revision, separately labelled organization-objective revision, and task/version references.
- Versioned media occurrence, segment, annotation and intended reading; task-local lexical/sense/syntax/context IDs and unknown speaker identity where appropriate.
- Input/output modalities, observation type, presentation time, bounded first response or explicit skip reason.
- Explicit assistance flags for lookup, hint, answer visibility, translation, replay, feedback, supplied base meaning, source visibility and other support.
- Historical assessment plus versioned rubric, scorer and linguistic-analysis references with provenance.

The surrounding event supplies the immutable event ID and timestamp. Replayed rows retain source IDs, original/applied references, latency, exclusions and the bounded inference. The ledger deliberately omits a second copy of raw answers; the authoritative event already contains the bounded response needed for exact replay.

The server accepts an identical delivery of the same event ID once. A different payload under that ID conflicts. Another terminal response under the same attempt ID conflicts even if it uses a new event ID. An episode fixes its actor and retry parent; separate attempts in that episode can refer to different tasks and occurrences. Each attempt fixes its full source, task, intent and scoring identity. Identity conflicts and cyclic retry lineage are rejected atomically. Unknown retry parents may arrive out of order; until their lineage resolves, the projection cannot count them as fresh assessments. Contradictory equal-time first responses do not let random ID order choose which result receives credit.

A reopen or reload of the same content and actor/intent scope within 30 minutes resumes its latest episode and reconstructs earlier assistance from saved events. The 30-minute window is an explicit session-continuity rule, not a forgetting model. A later visit or changed intent opens a new episode without asserting statistical independence.

The first response for an episode-root, exact target, dimension and practice mode is the direct observation opportunity. Immediate later responses and explicit retry episodes stay in the ledger but do not create new independent success/failure counts. A separately identified later episode can supply another bounded assessment; `independenceEstablished: false` still prevents the code from claiming that episode labels prove statistical independence.

The existing 8,000-event cap remains. Server batches are at most 50 events and the content-progress request body is capped at 512 KiB. The browser chunks by both 50 rows and 500 KiB of serialized UTF-8 JSON, including envelope overhead. An export is available when storage is full; automatic archival or silent event deletion has not been added.

## Scope and privacy

Authenticated ingestion validates the event user against the session and current team membership. New records also validate referenced intent/objective ownership, scope and revision. An unchanged already-stored delivery can be acknowledged after reference deletion, but still requires the same account and current team membership. The new recommendation-input projection filters enveloped records by exact actor and current tenant before applying limits. The older `/api/decisions` endpoint also filters explicitly scoped envelopes before its fold and event count; its unscoped legacy history and ranking rules retain their prior meaning. The content-progress export retains its established contract of returning all of the authenticated user's own records, including their historical records after team membership ends; the UI projection/export then selects the exact current actor/team. Teammates do not gain access to one another's response records through this feature.

Legacy card reviews and older content events did not record team attribution. They remain explicitly labelled personal-account history rather than being relabelled as team-specific evidence. Guest events remain in the existing guest browser store; they are not automatically imported into an account.

No raw intent, organization objective, full source paragraph or personal context is copied into the evidence envelope. References and revisions are retained instead. Choice answers are integers; free responses are bounded to 300 UTF-16 code units, consistent with the existing exercise limits. The new code does not send any text to a model, speech service or translation provider. The scoped export contains private bounded responses, and says so.

These controls reuse Nabu's existing session authentication, membership checks, SQLite and browser metadata. They are **not enterprise isolation, tenant encryption, immutable third-party audit storage, or independently verified learner behavior**. Clients can still misreport conditions; the server validates the contract, not human attention or who actually typed an answer. Existing database backups, browser access, account administration and operational controls still matter.

## Replay, version changes and time

`projectEvidence(events, {actor, resolveTask, now, ...})` is deterministic for its inputs. Exact duplicate delivery of validated enveloped events in the selected actor scope and their arrival reordering do not change the result. Unenveloped legacy records are ignored for assessment; duplicating one changes the ignored-record diagnostic count, but not the ledger or target evidence. The UI caches the derived view by actor, event identities and policy; it refreshes time-dependent freshness at read time and forces a fresh replay on request. Immutable source events remain authoritative. A small local logical millisecond clock orders a response and immediately following feedback; imported future records never advance that clock.

Task and annotation fingerprints change the rubric/analysis references when authored wording or mapping changes. Explicit scorer IDs/versions identify the normalization and choice rules. If a recorded rule or analysis no longer matches, default replay marks the interpretation stale. `allowRescore: true` is an explicit caller option, records both references, and reuses the original event and timestamp. There is no automatic rescore button that pretends a corrected linguistic analysis is new learner behavior.

The seven-day stale threshold and 24-hour minimum for one later check are **declared review/task policies**, not fitted forgetting parameters. Passive display, lookup and playback do not refresh a direct assessment. The view exposes elapsed time since the relevant assessment, keeps historical counts, and leaves competence unknown. No Beta parameters are decayed. The research tool uses separate toy Beta estimators and explicitly assumed learning/retention regimes; neither is installed in production.

A changed text or context ID alone does not qualify as transfer. The later phrase check uses a genuinely different authored sentence frame and records its syntax ID. Unknown speaker remains unknown. The ledger reports what changed and the actual elapsed interval, while `transferClaimed` remains false.

## Authored contrast set and policy decisions

All eight items are in `public/nabu-evidence-tasks.js`, with exact answers, task-local targets, cues, source references and fingerprints:

| Check | Requirement varied | Boundary |
| --- | --- | --- |
| `take-meaning` | Meaning of `خذ` independently, with answer choices | Visual recognition only |
| `open-meaning` | Meaning of `افتح` independently | Does not infer a form operation |
| `take-female` | Address one woman using the supplied masculine base and meaning | Supplied-meaning assistance is mandatory |
| `open-female` | Apply the operation to another base with recent direct meaning evidence | Bank or graph presence cannot unlock eligibility |
| `take-male` | Same base, reverse addressee/form operation | A separate assessed target |
| `write-female` | New authored eligible base with meaning supplied | No unaided base-meaning credit |
| `phrase-now` | Retrieve the phrase inside a waiting-message sentence | An English cue and sentence gap are recorded |
| `phrase-later` | Later retrieval inside a different book-choice sentence | At least 24 hours after a direct earlier phrase check; no general transfer claim |

The new release does not verify Arabic editorial quality by running unit tests. The forms are manually authored, with the existing annotation and a university grammar reference in their provenance. They remain drafts pending an independent Arabic review.

The policy can supply help after a recent local meaning mismatch directly instead of asking an unnecessary diagnostic. A response on another supported base can lead to operation help or to help with the original phrase. A failure on that other base's meaning leads to meaning support first. An answer, whether correct or incorrect, does not force “unknown stem,” “weak pattern,” “misread instructions” and “slip” into mutually exclusive probabilities. Stale evidence permits a fresh optional check. A completed later check is not immediately proposed again. Explicit no-practice preferences keep checks out of the suggested options.

An additional real data issue was found during this work: **`imru-al-qais-stop-and-weep`, activity `p3`, asks about the morning of parting but points to annotation `a4`, which concerns grief; `a3` matches the prompt.** Its new analysis adapter is quarantined and cannot supply a scored update until reviewed. The original content, historical responses and legacy exercise behavior are retained. This is a specific mapping defect, not a judgment about the whole poem or catalogue.

## Reproducible episode and synthetic evaluation

The concrete fixture in [docs/evidence-episode/README.md](docs/evidence-episode/README.md) uses the real task resolver and production projector. It includes **12 input rows, 11 unique event IDs, 9 events in the selected personal scope, and 3 bounded first unassisted assessed responses**. Thirteen asserted checks cover idempotency, reordering, mandatory assistance, retry exclusion, skip, actual changed syntax, other actor/team isolation, stale analysis, explicit rescore with the same IDs, and aging without changed counts. These are authored software events, not observations of people.

The separate research report is [docs/evidence-evaluation/report.md](docs/evidence-evaluation/report.md). Its fixed protocol uses 12 named seeds and 128 fictional learners per world. It evaluates representation, prediction and policy separately. The raw JSON retains family definitions, observation IDs, calibration bins, traces and every per-seed metric; the CSV exposes metric rows. Two full runs produced byte-identical report/JSON/CSV artifacts.

Prediction compares direct item-level Beta(1,1) estimates with an explicitly experimental structural mixture on the **same observations and held-out question/outcome pairs**. The mixture borrows at most one observation from each other declared family, retains provenance and does not increment direct counts. Six lexical families are held out wholesale, separately from a within-family split. The independent-memorization world does not assume the graph model is right.

| New-family world | Direct Brier | Experimental structural Brier | Interpretation |
| --- | ---: | ---: | --- |
| Genuine shared operation | 0.2500 ± 0.0000 | 0.1162 ± 0.0066 | Borrowing helps under the generator's shared-operation assumption. |
| Independent memorized items | 0.2500 ± 0.0000 | 0.2637 ± 0.0039 | Borrowing hurts when that transfer assumption is false. |
| Conflicting analysis | 0.2500 ± 0.0000 | 0.2500 ± 0.0000 | Borrowing is disabled; equal results are expected by construction. |
| Wrong applicability domain | 0.2500 ± 0.0000 | 0.5195 ± 0.0095 | Apparently usable structure can mislead badly. |

Values are means ± sample standard deviations across seeds, not human confidence intervals. Brier is mean squared probability error against a held-out binary response. The report also defines ten-bin expected calibration error, ready rate, false-ready among predictions at least 0.8, and population false-ready. Undefined false-ready rates are reported as unavailable when no prediction is ready. A lower Brier does not automatically imply better calibration.

The policy comparison holds the direct estimator, available content, response stream and time budget fixed while comparing fixed practice and deterministic diagnostic selection. It reports simulated task success, questions, interruptions, used time and budget sensitivity under three assumed learning/retention regimes. Diagnostic selection is not uniformly superior: a known-gap case improves under a short budget by avoiding an unnecessary question, but the ordering can reverse with more time; a stale-success case is another failure. These are assumptions and synthetic effects, not measured human learning or retention.

The equal-time human pilot is a **proposal only**, specified in [docs/HUMAN_PILOT_PROPOSAL.md](docs/HUMAN_PILOT_PROPOSAL.md) and summarized in the research report and accompanying paper. Its proposed 12-minute sessions and 48-hour delayed check are design choices, not validated optima. Both arms use the same reviewed content, model and total interaction time; they differ only in fixed versus decision-sensitive selection. A delayed unassisted check uses documented changed conditions. The plan records assistance, interruptions, attrition and scorer versions, separates immediate help from delayed performance, and determines sample size from feasibility/precision requirements rather than inventing one. No participants were recruited and no study was launched.

## Interfaces for the next implementation step

| Interface | Purpose |
| --- | --- |
| `validateEvidenceEnvelope` / `validateEvidenceEvent` | Strict versioned event contract; detached validated JSON |
| `validateEvidenceSequence` | Identity, terminal-attempt and retry-lineage consistency without scoring |
| `interpretEvidence(event, {resolveTask, allowRescore})` | One event's bounded support, assessment references and exclusions |
| `projectEvidence(events, {actor, resolveTask, now, staleAfterMs, delayThresholdMs, allowRescore})` | Replayable scoped ledger and direct target/mode counts; competence stays null |
| `catalogueEvidenceTask`, `contrastTask`, `resolveEvidenceTask` | Exact current task, occurrence, cue, rubric/scorer/analysis versions and score function |
| `contrastEligibility(task, projection, now)` | Real direct-base and fixed-delay constraints |
| `evidenceCandidates` / `selectEvidenceStep` | Availability, task usefulness, diagnostic branches, effort/interruption, deterministic choice and separate uncertainties |
| Existing `content-progress` routes | Owner-private immutable event persistence and export, using the existing table |
| Existing `next-step-inputs` route | Whitelisted current-scope inputs for browser recommendations; original personal-account evidence remains explicitly labelled |
| `auditRecommendationEvents(events, {actor, now})` | Projects scoped audited catalogue responses into the existing baseline, withholding stale, conflicting, retry and quarantined inputs without guessing contrast-to-annotation links |
| Existing `nabu-next-step` DOM hook | Suggestion shown/selected/continued metadata; selections are not learning or reward observations |

A future probabilistic model must declare its observation likelihood, dependency assumptions, conditions and validation protocol. It can consume source IDs and derived conditions without rewriting responses. A future graph-informed estimate must remain labelled inferred and separate from direct counts. A future experimental exploration policy needs its own enablement, reward definition, selection probabilities and evaluation; none exists in this production release.

## Setup and verification

Use the existing server/start scripts and browser origin. Keep existing private configuration and database files when updating. Restart the backend with the new code so `/api/config` advertises `evidenceEvents: true`; account audit controls are withheld on an older backend. Guest mode requires no service or credentials. Prompt 3 adds no table migration, runtime package, provider key or external parsing configuration.

```sh
npm run build
npm test
python -m pytest -q
NABU_TEST_JSDOM=/absolute/path/to/jsdom/lib/api.js node --test tests/intent-ui.dom.mjs tests/next-step-ui.dom.mjs tests/next-step-bundle.dom.mjs tests/evidence-ui.dom.mjs tests/evidence-bundle.dom.mjs
node tools/evidence_episode_demo.mjs --check
node tools/evaluate_evidence.mjs --output docs/evidence-evaluation
```

The optional DOM suites use jsdom as a development test tool and an in-memory IndexedDB fixture. They verify actual handlers, source preservation and storage calls; they do not prove native disk durability, pixel layout, audio playback or screen-reader behavior. Chromium cannot start in the current execution environment because its process-singleton socket is denied; that remains an explicit browser-validation limitation.

Final commands, counts, warnings and artifact hashes are recorded in `docs/EVIDENCE_VERIFICATION.md`. The implementation and all reproducible inputs are included in the full source archive. The paper's LaTeX, bibliography, figures and build instructions are under `paper/`; the paper does not report a human trial, a validated mastery estimator or a production-ready morphology graph.
