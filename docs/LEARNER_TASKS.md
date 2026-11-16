# Learner task mappings and the audited observation bridge

The 1.15 learner model receives a separate interpretation of the existing immutable evidence ledger. `projectEvidence()` still returns `competence: null`; original counts, answers, scorer references, and schedules are unchanged. No simulation output becomes a live observation.

## Implemented task slice

`public/nabu-learner-tasks.js` supplies 45 authored checks across Arabic, English, and Spanish. The nine lexical bases are Arabic كتب and فتح; English write, open, and wash; Spanish escribir, abrir, cerrar, and lavar. Each has a base-meaning choice, base-form retrieval, contextual form-meaning choice, operation with base and meaning supplied, and result-form retrieval. Labels and answers are complete records; the module does not synthesize unattested words from a suffix or template.

The Arabic sound Form I operation uses the bounded مفعول family. English open/opened and wash/washed share a regular past-participle operation; Spanish cerrar/cerrado and lavar/lavado share regular -ar participle formation. **Written, escrito, and abierto are lexical exceptions:** their form-production mappings use an item-specific memory route, with no compositional route and no invented shared “irregular” skill. A single success never establishes which route the learner used.

Another 48 checks reuse water and bread, with their declared aliases, from the existing authored vocabulary bank across its 12 languages. These are item-specific recognition and retrieval tasks. No morphology is asserted for these items. Existing eight Arabic evidence contrasts have explicit maintained mappings; other catalogue tasks remain raw ledger evidence until their mappings are supplied and reviewed.

The two bank entries were checked against the existing structural integrity gate in every bank language. They are eligible **authored-unreviewed** records, with no context-required flag; they are not promoted to verified entries. Generation calls `classifyKnownEntry()` for the local form and English cue, excludes blocked/context-required records, and records `graph-integrity-v1`, source IDs, and review status in the mapping fingerprint and provenance. `candidateEligibility()` additionally excludes same-language translation pairs, which is inapplicable to an English word-definition exercise; its underlying entry gate is still honored. The unrelated quarantined external P073 record is not imported or used.

All new tasks are AI-assisted authored drafts, not independently instructor-reviewed or validated measures. Three-way choices have a declared initial guessing probability of 1/3; text answers use 0.01; slip is initially 0.05. These are nuisance assumptions, not measured accuracy, empirical guessing rates, or efficacy findings. The text scorer matches only declared forms/aliases after bounded normalization; a mismatch can be a correct unlisted variant, a typo, misunderstanding, or an actual knowledge gap. It is never an automatic causal diagnosis.

## What the components mean

- **Root:** language-specific lexical-base knowledge, or an explicitly named local lexical-form gate for bank words. The latter use of the implementation's `root` kind does not assert a morphological root.
- **Pattern:** a particular language-specific operation. A supplied base and meaning remove the root requirement from that task's likelihood.
- **Meaning:** the stated lexical reading. Only explicit `transferGroup` records permit cross-language statistical borrowing. A separate local lexical-form component remains required in recognition tasks, so shared semantic information cannot satisfy the whole task by itself.
- **Whole-form memory:** an alternative exact form/reading route, shared only through its explicit memory key within language and response mode. Exceptional forms have this route alone.

The written-text reading is aligned across the three languages at the level of the word's stated reading. The full sentence's tense, aspect, syntax, and discourse implications are not declared equivalent. Bank recognition tasks align only their specified vocabulary reading. In definition-cued word retrieval, the definition supplies semantic content: only the local lexical-form component is tested, with no cross-language semantic production credit.

Recognition, production, listening, and cloze remain distinct model modes. A recognition answer does not become a production trial. The present new authored slice has visual recognition and text production; existing phrase contrasts preserve cloze mode. There are no fabricated audio observations.

Components form a crossed design. Several responses may still leave parameters confounded, and prior-dependent borrowing is not observed learning transfer. The UI must retain the model's uncertainty and its declared assumptions.

## Task and scoring identity

Public APIs are `listLearnerTasks({language, mode})`, `learnerTask(id)`, `resolveLearnerTask(ref, event)`, and `modelTask(task)`. Task version is `LEARNER_TASK_VERSION`. The resolver requires the exact task version and occurrence/context identity. Each task has an authored rubric, scorer and analysis reference with source locators; their fingerprints bind the current prompt/answer and model mapping. Unknown task IDs, mismatched versions, and altered contexts do not silently resolve.

Examples:

| ID | Tested condition |
| --- | --- |
| `learner:ar:write:base-recall` | Retrieve the lexical base from an English meaning |
| `learner:ar:write:pattern` | Produce the participle with base and meaning supplied |
| `learner:ar:open:pattern` | The same bounded operation on another supplied base |
| `learner:ar:write:retrieval` | Retrieve the result form without showing the Arabic base |
| `learner:ar:write:reading` | Recognize the contextual word meaning with three choices |

`componentSupport` lists only actual modeled components and safe explanatory cues. For regular Arabic retrieval, one cue supplies the lexical base and another supplies the general bounded pattern; neither displays the complete requested form. Each cue declares any exact `exposedFormKeys`, so supplying the base is still recognized as exposing the answer to a separate base-recall task. Exceptional forms have no fictitious pattern-help effect. Showing their answer is ordinary explicit assistance, outside a modeled component-support gain. Analysis fingerprints bind the component support and exposure declarations as well as the model mapping.

## Observation acceptance

`buildLearnerInput({events, actor, now, resolveTask})` returns normalized tasks, model observations, exclusion reasons, the exact actor/team scope, an accepted-observation audit, and the original direct-evidence projection. The default resolver composes the new task resolver with the existing evidence-task resolver. An explicitly supplied resolver replaces this composition and must resolve exact versions synchronously.

The bridge accepts only a scored, unambiguous first response in the exact account and tenant context, with a current maintained mapping and unchanged confirmed/authored scoring references. It preserves original event IDs and timestamps. Future events, unknown task versions, quarantined or changed scoring references, unscored responses, retry episodes, repeated responses and ambiguous tied first responses are excluded. Re-delivery of an identical event is deduplicated; conflicting reuse of immutable IDs is rejected by the original ledger validator.

Lookups, displays, playback and skips never become successes or failures. Historical client correctness is not trusted: the exact authored scorer recomputes the outcome. Recorded help overrides contradictory client assistance flags. Answer display, feedback, hints, translations, source visibility, replay, lookup and other assistance exclude a response from the likelihood.

The new tasks declare exact language-specific `responseFormKey`, `promptFormKeys`, and `feedbackFormKeys`; `taskExposure()` also supplies maintained mappings for legacy contrasts. A replayed display or feedback can expose an answer to another task even when task IDs differ. The bridge therefore excludes subsequent form responses within a conservative 30-minute window after that exact form was shown, or after an equivalent form response. This catches recognition→retrieval, meaning-supplied operation→base recall, and exceptional-form feedback→another task for the same word. Exclusion records retain the source event IDs and explicit reasons (`recent-form-exposure` or `recent-equivalent-form-response`). Semantic groups do not become cross-language form-exposure keys. Future/later events and a response's own later feedback cannot retroactively exclude that response. The window is a declared anti-repetition policy, not proof that later observations are independent or an estimated memory duration.

Generic hint events do not record which component cue the learner selected. `taskExposure()` therefore adds `hintComponentIds` and `hintFormKeys`: the conservative union of that maintained task's possible component cues. A recorded hint, or a recorded hint assistance flag, excludes subsequent responses requiring any of those supplied components within the same window, even when an imported response claims no help. This also prevents a rule cue for one supported word from being counted as unaided pattern knowledge on a different word. Only explicit component IDs and form keys match; an unrelated lexical base or a foreign-language component is unaffected. This is a deliberately conservative handling of missing cue identity, not evidence that every possible cue was actually displayed. The witness marks `hintIdentity: "generic-hint-union"`, retains the exact source event and task reference, and lists the matching `componentIds` and possible `hintFormKeys`. Component matches add the exclusion reason `recent-component-support`.

The bridge indexes declared exposure matches against affected maintained tasks and searches the chronological window. Each source event contributes one witness per target, even if both its form and a component match. Each exclusion retains at most 12 distinct source witnesses, plus the total source count and explicit omitted count; the complete original ledger remains available. Exposure counts are `null` when a row was already excluded by a more basic eligibility rule and did not require this further check. This bounds audit expansion without presenting a truncated witness list as complete.

There is one explicit conditioned-likelihood exception: **base meaning supplied alone** can support a maintained form task whose mapping omits root/meaning requirements. This includes lexical-exception form tasks modeled solely through their exact memory route. The direct ledger continues to call it assisted and gives it **zero unaided assessment credit**. The separate model audit identifies the conditioned response and its supplied meaning. An arbitrary `baseMeaningSupplied` flag on another task does not qualify.

Seven-day policy staleness is separate from reference validity. An old but valid scored event remains a time-stamped historical observation for the time-aware model; it is not relabeled as a fresh success or deleted as if it never happened. Rescoring is not enabled by this bridge.

No user demographic is inferred. Other users' or tenants' events do not enter model rows or returned audit/exclusion IDs. Public cohort calibration, if used by the model, has a separate explicit consent/scope contract; this bridge does not gather or pool private accounts.

## References and limits

The following public sources were checked for the grammatical descriptions or lexical entries. They do **not** attest the exact authored exercises, validate component loadings, or demonstrate an instructional effect:

- Michigan State University, [Intermediate Arabic I: active and passive participles](https://openbooks.lib.msu.edu/arb201/chapter/5-2-grammar-in-context/): bounded passive-participle description and examples.
- British Council, [Passives](https://learnenglish.britishcouncil.org/free-resources/grammar/b1-b2/passives): the past participle in English passive constructions.
- British Council, [Irregular verbs](https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/irregular-verbs): lexical irregular participle reference. The direct fetch timed out during this implementation; this URL is retained as a supplementary reference, not represented as independently fetched evidence.
- SpanishDictionary.com, [Past participles](https://www.spanishdict.com/guide/past-participle-in-spanish): regular -ado/-ido formation and listed exceptions.
- RAE–ASALE, [escrito](https://dle.rae.es/escrito) and [abierto](https://dle.rae.es/abierto): lexical participle entries.

Task prompts and explanations are original short drafts. No source chapter or dictionary entry is embedded. Broader language coverage requires additional reviewed mappings, meaningful held-out contrasts, and measurement calibration. The bank fallback preserves usable item-specific practice without manufacturing morphological transfer.

## Focused verification

`node --test tests/learner-observations.test.mjs` checks exact task/scorer identity, actual answer keys, multilingual coverage, lexical exceptions, local-form gates, safe component support, actor/tenant filtering, assistance reconciliation, immutable ID handling, first-response/retry rules, future/stale-reference exclusion, historical age handling, and the separation of conditioned model evidence from unaided ledger counts.
