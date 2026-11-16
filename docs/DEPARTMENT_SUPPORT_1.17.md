# Department support summaries — Nabu 1.17 overnight build

## What shipped

The existing optional **Workspaces & assignments** view adds **Reporting choice** for every current member and **Department support** for workspace owners. The feature uses the existing server, SQLite database, authenticated session, account guard, origin/CSRF middleware and local launchers. No provider, runtime dependency, background job or new framework is introduced.

This is a coarse descriptive view of accepted institutional assignments. It does not query private notes, vocabulary, reading history, personal intentions or the personal learner model. It does not rank learners, expose response records to an owner, estimate mastery, or update a Bayesian posterior. Existing named-reviewer agreements remain separate.

## Explicit, independently revocable reporting choice

A member's reporting choice starts **off**, including for existing users who already accepted assignments. Enabling it separately permits the owner to receive the bounded summaries of the member's **past and future accepted assignments in this workspace**. The choice does not extend named-reviewer access to the member's raw responses. A member can withdraw from future summaries without leaving or revoking their individual assignment agreement.

The choice is self-service: the server obtains the account ID from the authenticated session; an owner cannot submit a different member's ID. The request must contain the revision and policy version of the terms displayed to the learner. Unknown fields, non-Boolean choices, a missing/wrong policy version and malformed revisions are rejected. A stale conflicting revision returns 409; a safe retry of the immediately preceding identical choice is acknowledged without another revision or audit event.

Choice changes appear in the owner-visible audit log with the account identifier and policy/revision, not a raw answer. **Participation and choice changes are not anonymous.** The consent text states this. This implementation does not establish that consent under an employment or institutional power relationship is freely given.

Leaving/removal disables the choice and advances a persisted revision, even if the member had never saved a choice. Rejoining starts with that off choice; an old in-flight opt-in using the earlier revision cannot reactivate it. This off record is a revision tombstone rather than a promise to erase all traces of a choice. Existing account/tenant deletion cascades delete it. Previously viewed/exported summaries cannot be remotely erased.

## Denominator and category rule

The denominator is **distinct current members who opted in to the current policy and have at least one accepted assignment**. Offered, declined and revoked assignments are excluded. Non-consenting members and their assignments are not counted, and neither their count nor an exact participation rate is returned.

Each eligible learner enters one first-applicable priority category across their accepted assignments:

1. **Correction requests need review:** an assessment referenced by a correction request has no successor. A request on a linked retry may trigger this category, but it does not add a performance observation or another learner.
2. **First responses need rubric review:** at least one first response's latest assessment is a non-match.
3. **Some accepted tasks await evidence:** at least one accepted assignment has no first response/assessment. Missing responses are not treated as failures.
4. **Matches include available or reported help:** the first responses match, but at least one latest assessment is marked assisted. Task-authored source visibility cannot be removed with client assistance flags; other help remains self-reported.
5. **First responses match these task rubrics:** the remaining first responses match without recorded assistance. Conditions are still unverified. This is not unassisted-proficiency certification.

Only first responses and their latest assessments determine match/assistance categories. Deliberate retries do not inflate the denominator or upgrade the first-response category. Explicit reassessment of a preserved first response can change its category. Publishing a revised rubric alone does not change historical results.

## Release policy

The fixed policy is `department-support-v1`:

- Fewer than five eligible learners produces `status: "insufficient"`, a null participant band, and five suppressed categories. Zero and four eligible learners produce the same public summary.
- Otherwise the participant total is represented by a five-wide range: 5–9, 10–14, 15–19, and so on. Exact totals and rates are omitted.
- A category is released only if it contains at least five learners and its complement contains either zero or at least five learners. Its value is another five-wide range.
- All other category values, including zero, are returned as `suppressed` with a null band. Thus a suppressed category does not identify an empty category. A 5+1 split releases neither category.
- Whole-workspace reporting only. All query parameters are rejected with 422. There are no language, date, assignment, task, learner, or reviewer filters and no drilldown.
- Next-step explanations are fixed, inspectable rules derived only from **released** categories. If no category is releasable, the response offers general optional support and says the group evidence is insufficient for targeted recommendations.

These rules reduce straightforward disclosure through small cells and complements; they do **not** provide anonymity, differential privacy, a privacy budget, or protection against a malicious owner. Repeated snapshots, roster knowledge, voluntary disclosures, collusion, or manufactured memberships can still reveal information. Both terms and dashboard say so. An owner can already see administrative assignment status and audit metadata under existing permissions. Do not advertise this as anonymous analytics.

## API

Prefix: `/api/workspaces/{tenant}`. Requests use the existing signed-in session and account header; mutations also require the CSRF token and same-origin request. Existing middleware returns `Cache-Control: no-store`.

### `GET /support-consent`

Available to the current member for their own choice:

```json
{
  "schemaVersion": 1,
  "policyVersion": "department-support-v1",
  "revision": 1,
  "enabled": false,
  "terms": "The complete reporting terms displayed by the UI."
}
```

### `PUT /support-consent`

```json
{
  "policyVersion": "department-support-v1",
  "revision": 1,
  "enabled": true
}
```

Returns the complete acknowledged choice, normally revision 2 for the first enable. Terms/version must be displayed before the learner chooses; frontend code sends the validated version it displayed. A client passing a policy version establishes a software contract, not proof that a person read or understood the terms.

### `GET /department-support`

Workspace owner only. The owner does not need raw-response review grants because the separately accepted reporting choice authorizes this specific aggregate release.

```json
{
  "schemaVersion": 1,
  "policyVersion": "department-support-v1",
  "status": "available",
  "minimumParticipants": 5,
  "participantBand": {"lower": 5, "upper": 9, "label": "5–9"},
  "denominator": "Current members who opted in and have at least one accepted assignment.",
  "categories": [
    {"key": "correction_pending", "label": "Correction requests need review", "status": "suppressed", "band": null},
    {"key": "review_rubric", "label": "First responses need rubric review", "status": "suppressed", "band": null},
    {"key": "awaiting_response", "label": "Some accepted tasks await evidence", "status": "released", "band": {"lower": 5, "upper": 9, "label": "5–9"}},
    {"key": "assisted_evidence", "label": "Matches include available or reported help", "status": "suppressed", "band": null},
    {"key": "task_matches", "label": "First responses match these task rubrics", "status": "suppressed", "band": null}
  ],
  "recommendations": [{"action": "offer_task_support", "reason": "Offer optional onboarding or task support. A missing response is not a failed response or evidence of inability."}],
  "notice": "The full limits are returned here by the implementation.",
  "learnerModelUpdated": false,
  "conditionsVerified": false
}
```

This example is illustrative, not a real class or a measured result. The implementation's full static strings are in `institutions.py`.

The read uses one explicit SQLite read transaction spanning current-owner authorization, membership, reporting choices, assignments and assessments. It therefore avoids assembling a report from several changing database snapshots. A response already authorized/in flight may still arrive after a later revocation. No instantaneous remote erasure is claimed.

## Correction ordering defect repaired

The prior implementation ordered assessment history and selected its current head by server wall-clock time. A backward clock adjustment could cause a newly appended correction to appear older than its predecessor, and a later reassessment could target the wrong predecessor. Histories and head selection now use SQLite insertion order (`rowid`) while retaining occurrence/receipt/creation times as metadata. Attempts also retain insertion order so a clock change cannot reorder a linked retry before the event it follows. No stored response, score, timestamp, or source is rewritten. This is not a cryptographic ordering guarantee against a database administrator.

The new regression test moves the server clock backward by an hour, explicitly reassesses the original response, checks that the corrected state remains current, and appends another reassessment against the corrected head.

## Upgrade and pilot limits

Startup adds only `institution_support_consent` with `CREATE TABLE IF NOT EXISTS`; existing tables and learner data are not migrated. Keep the normal backup and preserve `.data`, `.env.local` and browser origin when upgrading. No current member is opted in by the upgrade. An older release can ignore the additional table but does not provide the new reporting UI; keep a backup before rollback.

The existing registration limit remains **five new accounts per IP per hour** and 100 globally per day. A class registering together behind one campus NAT can reach that limit. Pilot onboarding must be planned/staggered or accounts prepared through a future reviewed administrative flow. The demo/tests use distinct fictional client addresses, not a disabled production guard. This release does not add bulk provisioning, SSO, email invitations, per-assignment consent withdrawal, retention schedules, differential privacy, cohort model training, load guarantees, or institutional compliance certification.

Run the focused backend contracts with:

```sh
.venv/bin/python -m pytest -q tests/test_department_support.py tests/test_institutions.py
```

The tests use real authentication and temporary SQLite, cover role/tenant boundaries, strict versioned consent, default-off behavior, leave/rejoin stale requests with and without a prior saved choice, privacy suppression, first-response accounting, corrections, assistance flags, persistence/cascades and server-clock rollback. They do not establish production scale, human learning, or adversarial privacy guarantees.
