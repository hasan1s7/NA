# Support-aware understanding and retrieval

This feature asks what currently enables success and what a later encounter can
show without those cues. Encounter → supported understanding → retrieval →
variation → targeted repair → later retrieval is a flexible interaction cycle.
It is not a validated theory of memory or a sequence of psychological stages.
Historical linguistic change inspired the design; it supplies no memory-model
evidence or empirical parameter values.

## Run and review

```sh
npm install
python -m pip install -r requirements.txt -r requirements-dev.txt
python tools/build_pages.py
npm run demo:support
npm run test:support
python -m pytest tests/test_support_cycles.py -q
python start_local.py
```

Open Read or Explore, expand **Optional learning tools**, then find **What stays
available without help?** The same panel appears in Library and Review. In an existing curated reader,
the checks belong to that actual piece; saved expressions retain the matching
checks. The French dialogue is the fallback walkthrough for unanalysed media. Save
the authored French passage, open translation, answer, try a fresh context,
request feedback/repair, and return later. Any check can be chosen directly.
The uncertain-transcript example includes an explicit reviewed correction.
The local launcher binds to loopback and retains the existing database.

`node tools/demo_support_cycle.mjs --output /tmp/support-cycle-audit.json`
executes deterministic synthetic episodes through the shipping modules. Its
assertions demonstrate invariants, not learning efficacy. No synthetic event
is imported by the application or sent to an account. `support_cycle_browser.py`
exercises the built app in Chromium and can record the real UI.

## Existing architecture and additive integration

| Concern inspected | Existing infrastructure | This change |
| --- | --- | --- |
| Source reader | `nabu-explore-ui.js`, own-media reader in `nabu-app.js` | Optional panel; original document nodes stay in place and are temporarily hidden/inert during a check |
| Saved material | Owner-scoped `nabu-account-store.js`, existing cards and duplicate handling | Explicit save creates a reference card; no implicit cards or schedule changes |
| Event history | IndexedDB meta `nabu.content.v1:<owner>`, `content_events` SQLite table | Additive `support-cycle` envelope; same outbox, limits, auth, CSRF, deletion and account/team scoping |
| Existing observations | `nabu-observations.js`, legacy progress wrappers | Retained unchanged; older projectors ignore the new kind |
| Existing learner model | Joint hierarchical Gaussian learner, `nabu-learner-model.js` | Retained; its current bridge deliberately excludes many assisted responses, so rich cue timelines use an isolated conditional model rather than silently changing old estimates |
| Review | Existing per-skill SRS and `nabu-learner-policy.js` | Additional derived return request; assisted activity cannot reset its independent-observation deadline or alter an existing card/log |
| Build | Python standalone bundler, root Pages mirror, hashed CSP | New modules bundled locally; Capture demo remains in the static allowlist |

No schema migration, table replacement, account import, reset, new dependency,
remote parser, provider call, or pooled private-user fit is introduced.

## Three explicit operations

1. **Interpretation:** `interpretSupportMedia(task, analysis)` resolves the
   immutable source/task versions without looking at the learner response or
   ability. It retains transcription, segmentation, construction, meaning,
   scope and variety uncertainty and normalized hypothesis weights. Compatible
   hypotheses remain a mixture. Missing rubrics or incompatible answers cause
   abstention. Unmatched free-text phrasings require review, not an error label.
2. **Measurement:** `projectSupportEvidence` re-scores under the current
   explicitly corrected analysis and admits at most one joint observation per
   response. `fitSupportModel` applies its likelihood only to the exact joint
   target set, task skill, input/output modality, variety, item/construction
   scope and cue condition. It never fabricates graph-neighbour successes.
3. **Transitions:** `transitionSupportMemory` projects elapsed-time decay
   separately from the measurement update. `transitionSupportPractice` records
   a possible practice opportunity with unidentified gain and leaves ability
   unchanged. The model does not interpret a posterior update as learning.

Recognition, meaning recall, form recall and contextual production are separate.
An auditory result cannot establish written access or vice versa. Item-scoped
familiarity cannot create a construction-scoped observation. Construction
checks can collect direct responses across contexts; this coverage alone does
not establish general mastery. The UI exposes observations and unknown facets,
not precise mastery percentages.

## Cue timing and event integrity

The strict schema includes event/episode/attempt IDs, a causal parent where
applicable, actor/team and intent revisions, media/analysis/task versions,
joint target IDs, task and modalities, condition, timestamp, scoring rule,
scoring reliability, model and selection-policy versions. `supportAuditRecord`
provides the requested snake-case review/export fields.

Each support descriptor has a type, visibility and task/extra role. Types cover
translation, gloss, paraphrase, transcript, highlighting, segmentation, image,
scene context, options, replay, slower playback, another recording, language
comparison, historical explanation, earlier answer and feedback. The first UI
offers only cues it can actually supply. A transcript and choices defining a
recognition task are recorded as task cues; an additional answer-revealing cue
is an extra condition. A closed cue is available, not observed attention.
Opening is an action; “I used this” is an explicit self-report.

Response snapshots are derived from the preceding immutable cue timeline.
Form answers already visible in the current reader/library surface are recorded
as an earlier-answer cue before a form check, without claiming attention.
Hints after submission cannot retroactively assist it. Backdated events that
contradict an existing snapshot are rejected. Exact repeated deliveries are
idempotent; changed payloads under one ID conflict. Attempt identity cannot
change, and a second response needs a new attempt. Same-episode overlapping
target retries are retained but excluded from another independent likelihood.
Recent answer/source exposure across episodes is conservatively marked as a
separate supported condition for 30 minutes; a changed context can supply a
fresh direct observation. This window is provisional, not a claim about when
answer memory disappears. Actor/intent changes cancel the active check.

`analysis-correction` advances an analysis version. Replaying follows correction
heads and retains the original declared scoring beside current scoring and
correction event IDs. Unresolved versions invalidate affected measurements;
conflicting branches require reconciliation. The UI supplies a reviewed v2 of
the authored ambiguous example. Arbitrary source corrections must be authored
as new analysis/rubric versions; the feature never resolves an uncertain source
by assuming that the learner is wrong.

## Provisional probability model

`support-conditional-grid-v1` maps to the immutable assumptions in
`support-parameters-provisional-v1`; selection uses `support-cycle-selection-v1`.
Each exact conditional cell starts with an 81-point Beta(2,2) grid over ability
q. For analysis h and task difficulty d:

```text
p_h(q) = guess + (1 - guess - slip) × sigmoid(logit(q) - d - offset_h)
L(q) = Σ_h weight_h × [reliability × rubricLikelihood(score | p_h(q))
                       + (1 - reliability) / numberOfOutcomes]
posterior(q) ∝ priorPrediction(q) × L(q)
```

Recognition uses a binary rubric and its actual number of choices for guessing.
Reviewed partial scores use an ordinal 0 / 0.5 / 1 rubric with a two-unit
binomial likelihood. These are scoring units within ONE joint response, not
two learner observations. Guessing .03, slip .08, difficulty 0, scorer
reliability .85 and hypothesis offsets/weights are authored provisional values.
Different cue types have separate conditional cells; there is no hint-level
number or invented empirical cue weight.

The prediction transition moves ability toward a .05 floor with a provisional
30-day half-life. It is not an observed forgetting event. Practice gain is null.
The default 80% interval describes this assumed model, not calibrated coverage.
Sensitivity reruns 7/30/90-day half-lives, ±.6 difficulty, higher slips and
higher guessing. Export includes all assumptions, inputs, scores, updates,
transition records, predictions and sensitivity results.

Support dependence is an observational contrast only after at least two direct
responses in each comparable independent/supported condition (a provisional
minimum). Before that it is **insufficient comparable evidence**. The full
posterior difference remains uncertain and potentially confounded by context,
time, selection and difficulty. A lookup alone produces no diagnosis.

## Scheduling and limits

The derived policy requests a fresh retrieval when independent ability is
unknown, repair after a scored difficulty, a new context after one successful
independent context, then a provisional 24-hour return after context variation.
No-practice intentions suppress checks. A failure after removing help is not
labelled forgetting. Assisted responses do not postpone the independent return.
Existing card schedules, logs, source positions and library data are preserved.

The initial catalogue contains eight original French tasks and adapters for
the existing media catalogue. Those adapters reuse exact source anchors, media
versions, and authored recognition/form-recall rubrics. Their original
AI-assisted, not-instructor-reviewed editorial status is preserved; they make
item-level claims only. This is not a universal automatic media interpreter. Exact authored scoring abstains on unreviewed
phrasing. Auditory checks require completed playback with an installed French
synthetic voice; unavailable audio cannot generate listening evidence. The same
synthetic voice does not establish generalization to another human speaker.
Speech-response records are supported by the contract, but this UI does not
pretend to provide automatic production/STT evaluation. No calibration dataset
was available. This release tests software invariants and runnable behavior;
it makes no empirical efficacy or precise mastery claim.

Raw media, audio recordings and surrounding personal messages are not added to
the event log. Bounded answers remain private to the current learner under the
existing 8,000-event retention cap, export flow and account-deletion cascade.
