# Independent review: departmental support vertical slice

Reviewer: separate read-only review agent. Scope: `overnight117/app/Nabu-1.17/institutions.py`, `public/nabu-institutions.js`, support tests, existing authentication/SQLite connection and membership routes. No application files changed by this reviewer. Review date: November 15, 2026 Eastern.

## Findings raised and repaired in source

### 1. Delayed opt-in after removal/rejoin when no consent row existed

**Severity:** material consent correctness bug. **Status:** source fix inspected; regression added by implementation owner.

Original sequence: a newly added member reads default off/revision 1 without a persisted choice; an opt-in request with revision 1 is delayed; membership is removed and later restored; the original removal only updated an existing consent row, so there was no tombstone. The delayed request could enable reporting after rejoining.

Repair: membership removal now UPSERTs an off tombstone, using revision 2 for an absent row and incrementing an existing revision. Adding membership does not delete/reset it. The test `test_leave_rejoin_does_not_resurrect_choice_or_delayed_opt_in` now covers both never-enabled and previously-enabled histories. A current off choice with advanced revision rejects an old enabling request.

### 2. Consent request did not identify the terms version accepted

**Severity:** policy-evolution design gap. **Status:** source fix inspected.

Original PUT body carried only revision and enabled. After a future policy-version change, a stale client with an otherwise current revision could enable the new policy without having rendered its terms.

Repair: the backend requires literal `policyVersion: department-support-v1`; the frontend returns the version received with the saved choice. This binds this release's mutation to the displayed policy version. Future policy content changes still require a new version and deliberate migration/reconsent design; a version label is not permission to silently change the text.

### 3. Wall-clock rollback could hide a later correction

**Severity:** assessment correctness defect, inherited by the new aggregate path. **Status:** source fix inspected; regression added by implementation owner.

Original latest-result queries sorted by server `created_at` then rowid. Reassess after the server clock moves backward: the new result is appended but an older timestamp can leave the original result selected as current. A subsequent reassessment can target the wrong predecessor and conflict with its existing successor.

Repair: assignment attempt/history ordering and assessment-current selection now use SQLite insertion order rather than wall-clock order. Timestamps remain descriptive metadata. `test_clock_rollback_cannot_replace_latest_correction_with_older_assessment` rolls the server scorer clock back one hour, checks preserved false/true history and the updated support category, then appends another reassessment. Broader database transformations that rebuild insertion order are not proved by this review.

### 4. Participation is identifiable through the owner audit

**Severity:** disclosure/claim qualification, not an unauthorized summary read. **Status:** terms updated and inspected.

The summary omits learner identifiers, but the existing owner audit returns actor identifiers and now records `support.consent.changed` plus the choice revision. It is therefore incorrect to say participation or opt-in choices are anonymous. The new terms explicitly say that choice changes are recorded with account identifiers in the owner-visible audit and participation is not anonymous. The summary alone still contains no raw answer, learner ID, assignment ID, exact count, timestamp, rate, or private reading history.

## Contract observations

- Department summary checks current workspace-owner authority server-side; membership or named-reviewer status alone is insufficient. Consent reads/writes apply to the authenticated self, with extra fields forbidden.
- `BEGIN` precedes membership and all aggregation reads, providing one SQLite read snapshot across membership, consent, assignment state, results, and appeals. This does not revoke a previously authorized in-flight response or recall a displayed/exported summary.
- Eligibility requires current membership, explicit enabled current-version consent, and at least one accepted assignment. Merely accepting an assignment does not enable summary reporting. Offered/declined assignments do not enter this denominator.
- One learner contributes to one priority category across their eligible assignments. Counts concern learners, not attempts. First responses and their current interpretations supply match/assistance evidence; retries do not inflate participant counts. Pending correction requests on retries can trigger the review-priority category without being treated as new independent performance evidence.
- Below five eligible learners, the response omits the participant band and suppresses all categories, including zero. Above threshold, five-wide bands are released only when a cell and its nonzero complement are both at least five. No category-specific recommendation is released for a suppressed cell. All query parameters are rejected; there is no task/learner/time drilldown endpoint in this feature.
- New frontend reads replace existing output with an explicit loading state. Failure removes the old numbers. Epoch/account checks reject responses for obsolete views; the real app disables the submit button during a reporting mutation. A lost acknowledgement is represented as unknown until reloaded, not as a false success.
- Withdrawal excludes later summaries while leaving the existing individual assignment/reporting agreement intact. Leaving the workspace additionally revokes old assignments and reviewer grants.
- No personal learner-model update occurs, and no new external-provider call was found in these paths.

## Limits that must remain in the release claims

This is disclosure minimization for a local departmental pilot, not anonymity, differential privacy, confidentiality against an owner with auxiliary knowledge, or enterprise security certification. Repeated views, thresholds/bands, known rosters, synthetic accounts, and outside knowledge can reveal information. Owner audit metadata exposes identifiable participation. No remote erasure of screenshots, memory, or exports is possible through this feature.

The summary is a deterministic descriptive heuristic, not a Bayesian posterior, calibrated proficiency estimate, causal learning effect, or proof that a learner needs a particular intervention. The denominator is opted-in current members with accepted assignments, not the entire class. It is selected, potentially biased, and can change. Source availability and other help must not be interpreted as verified independent performance.

The endpoint currently scans eligible assignments and makes per-assignment appeal queries. Its transaction consistency is useful but not a production-scale performance result. Native browser storage/service-worker/accessibility and deployed production traffic are separate verification boundaries. Account deletion and existing cascades can remove evidence and consent rows; normal correction history preservation is not a permanent legal archive.

## Verification status

The reviewer inspected source and reasoned through concrete request sequences, then inspected implementation-owner fixes and corresponding regression source. No independent full security proof or exhaustive application-level verification was performed. Final executed test totals and release checks belong in the final verification report; this review must not be cited as another independent test count.
