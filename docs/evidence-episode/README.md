# Reproducible evidence episode

This is an **authored software fixture**, not a human learner study. The answers, timing, identities and outcomes were chosen to exercise Nabu’s production contracts. Nothing here estimates learning benefit, competence, or population performance.

## Reproduce

From the repository root:

```sh
node tools/evidence_episode_demo.mjs
node tools/evidence_episode_demo.mjs --check
```

The first command generates these files. The second recomputes the fixture and checks that the committed artifacts match exactly. No network, model provider, paid API, random sampling, wall-clock input, or real account is used. The pure `buildEvidenceEpisodeDemo()` function invokes `contrastTask`, `resolveEvidenceTask`, and `projectEvidence` from the actual application.

## Files

- `events.json`: 12 authored input records, including one identical transport redelivery and two records from other scopes. Every envelope carries actor, episode, task, occurrence, modalities, assistance and versioned scoring references.
- `ledger.json`: the full 9-row personal-scope ledger, direct counts, conditions, source references and explicit support boundaries.
- `replay.json`: deterministic reorder, scope separation, analysis-version change, explicit rescore and time-window comparisons. It includes the complete baseline, stale and rescored audit rows for the delayed response.

## What this fixture demonstrates

| Authored event | Verified interpretation | Boundary |
| --- | --- | --- |
| Display the existing dialogue | Opportunity to encounter material | No attention, comprehension or correctness is inferred. |
| Correct base-meaning choice | One visual-recognition response under the supplied choices | No productive or general lexical knowledge is inferred. |
| Exact redelivery of that event | Same event ID is counted once | Transport retries do not create observations. |
| Correct feminine-command response with meaning supplied by the task | Task-derived assistance is retained even though the fixture’s client flags falsely say no help | No unaided meaning or production credit. |
| Incorrect phrase response | One mismatch to this authored cloze rubric | No claim of general inability or a diagnosed cause. |
| Answer feedback and a correct retry episode | Support and retry are visible in the ledger | The retry does not replace the first response or become fresh independent evidence. |
| Skip with “too hard” | Explicit reason is retained | No correctness or competence judgment. |
| Correct phrase response after a fixed two-day gap in a different authored sentence | The actual syntax identifier differs; the delay is 172780000 milliseconds | Unknown speaker identity remains unknown. A changed content/context label alone would not qualify; no general transfer or retention estimate is made. |
| Other learner and same learner in another team | Each appears only in its exact actor/tenant projection | Personal and organization contexts are not pooled. |
| Changed analysis reference | The existing delayed-response event becomes stale by default | No source event is rewritten or added. |
| Explicit rescore permission | The same event is interpreted with the supplied new analysis reference | The scorer result is not a second observation or new learning. |
| Replay at day ten | Old assessments cross the declared seven-day policy window | Counts are retained; there is no learner-specific forgetting calculation. |

The personal projection has **3 first, unassisted assessed responses** across its actual targets and modes. This is a fixture count, not an effectiveness result. All overall and target competence values remain `null`. The source tasks and translations remain authored drafts; a grammar source is not attestation or instructor review of these particular items.

## Version-change demonstration

The demo resolver deliberately adds `-demo-revision-2` to the current analysis reference for `contrast:phrase-later`. It keeps the exact task and response, and does not pretend to validate a new linguistic analysis. Default replay marks the historical interpretation stale. Explicit `allowRescore:true` records both the original and applied references while preserving every event ID and timestamp.

## Limits

This verifies deterministic code paths and auditable boundaries. It does not validate the task rubric as a measure of ability, the declared assistance as independently observed truth, the delay as an optimal interval, the task sequence as a teaching intervention, or the independence of separate episodes. The reader, account storage and real UI behavior are tested elsewhere.
