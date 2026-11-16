# Institutional backend: Nabu 1.17

## Scope and architecture

`institutions.py` is an additive module in the existing FastAPI/SQLite application. `public/nabu-institutions.js` provides optional controls in the existing modal; `public/nabu-assignment-outbox.js` uses the existing IndexedDB metadata store and atomic metadata transactions. The standalone HTML embeds both modules. No new framework, provider, queue service or runtime dependency is required.

The implemented workflow is source → task/rubric → offered assignment → learner acceptance → immutable response → assessment → optional correction/reassessment → reproducible report. The existing reader and private learning system remain available throughout.

The authoritative institutional response is in `institution_attempts`. Its interpretations are append-only `institution_assessments`, linked by `supersedes`. These records are not copies of `content_events`: they represent a new, explicitly assigned workflow and are never double-counted into the personal evidence stream. Joining them to the Bayesian model requires a future authorized, validated task mapping.

## Authority

| Actor | Authority |
| --- | --- |
| Workspace owner | Manage membership and offline policy; publish source/task/rubric versions; offer assignments; view administrative assignment status and audit metadata |
| Assigned learner | Read their assignment; accept or decline its fixed terms; submit a first response and linked retries; inspect/export their permitted record; request a correction |
| Named reviewer, current member | Read accepted records within the specified reporting scope; with response access, replay and explicitly reassess |
| Another member or another organization | No access to the assignment record unless separately named and accepted |

The owner role alone does not grant access to learner responses. Reviewers are fixed when an assignment is issued; changing the agreement requires a new assignment. A learner who is also a named reviewer has those explicit authorities; this is not an independent or proctored evaluation.

Every institutional endpoint uses the existing authenticated session, same-origin mutation checks, CSRF token and optional `X-Nabu-Account` guard. Workspace membership and assignment authority are rechecked on the server. The frontend does not authorize reporting or cohort access by declaring a consent boolean.

Members can leave, and owners can remove non-owner members. Removal revokes all assignments for that learner in the workspace and removes their reviewer grants. Those records remain stored but inaccessible through the revoked agreements. Rejoining does not reactivate them. Personal data and other memberships are unchanged. Previously downloaded exports or offline copies cannot be remotely erased. Owner transfer/leave is not implemented. Existing account deletion cascades still apply; this is not a regulatory retention system or a cryptographically tamper-evident ledger.

## Source, task and rubric contracts

Source identity is `(tenantId, id, version)`. It contains original text, language, title, attribution and a rights/permission declaration supplied by the author. A declaration is not independently verified licensing. Versions must be consecutive, and existing versions cannot be overwritten. Original text is preserved; source/task SHA-256 values accompany reports as content fingerprints, not signatures.

Tasks pin a source version, prompt, reading mode, choice options where relevant, and whether the source remains visible. Those conditions are immutable. Changing the source or task conditions requires a new task. The initial rubric is version 1; later rubric versions require the expected prior version and a reason. Publishing a new rubric does not silently rescore old observations or change an offered assignment’s pinned version.

The current scorer, `nabu-assignment-exact-v1`, supports:

- Recognition: an authored answer index among 2–8 options.
- Recall: one of up to 30 explicitly accepted answers. `nfc-trim` applies Unicode NFC and outer whitespace trimming; `nfc-casefold-space` also ignores case and repeated whitespace. Neither removes accents, Arabic marks or hamza distinctions, or infers regional equivalence.

A non-match means the response did not match this particular rubric. It can reflect a missing accepted answer. It is not automatically a language error or evidence of broad inability. Raw responses remain unchanged so a later rubric can be compared and applied.

All existing language codes are accepted: `en`, `ar`, `zh-CN`, `fr`, `ru`, `es`, `tr`, `de`, `ko`, `ja`, `it`, `pt`. Existing translation locales, transliteration and pronunciation behavior are unchanged. This workflow currently assesses reading tasks only.

## Reporting agreement and evidence

An assignment fixes its learner, task, initial rubric version, organization objective, named reviewers and reporting level. `responses` includes submitted answers and correction-request text; `results` omits those fields. Results can still reveal information about an answer, particularly in a small choice set; the UI does not promise inference-proof anonymity. The assigning owner can see offer status without receiving an assessment record.

Acceptance is required before submission and before reviewers can read the record. Decline does not create a failure. Accepted terms cannot be silently expanded. To end server access under all of a member’s workspace agreements, use leave/removal; per-assignment withdrawal is not yet implemented.

The server preserves both the client-reported occurrence time and server receipt time. The former is not an independently verified clock. A source-visible task always records supplied source assistance, regardless of client flags. Other assistance is self-reported. Any retry is conservatively marked as following feedback, including offline linked retries; the system does not claim it can prove whether feedback was actually seen. `conditionsVerified` is false and `mastery` is null.

The first-response count is bounded to one per assignment. It is not a claim of psychological or statistical independence. Later responses retain their parent ID. Unknown or cross-assignment parents are rejected; upload the original response before its retry. A changed payload under an existing ID conflicts. Concurrent identical deliveries commit once. Up to 100 attempts are accepted per assignment; the application reports the limit instead of dropping old records.

The report’s `assignment-next-action-v1` decision identifies whether it is awaiting a response, continuing after a match, offering review after a non-match, or awaiting review of a correction request. It records the relevant assessment ID and explanation. It does not update the learner model or estimate causal teaching benefit.

## Correction and replay

The learner can append a correction request identifying an assessment. An owner publishes a revised rubric with a reason. A named reviewer with accepted response access then requests reassessment of the original response with an expected current assessment ID and selected published rubric version. Conflicts require reloading; identical lost-acknowledgement retries are idempotent.

The new assessment names its predecessor, rubric version, scorer, source version, actor, time and reason. Old results and original responses remain visible. A correction request is marked as having a reassessment once its referenced assessment has been superseded; this does not assert that the learner agrees with the new result.

Replay recomputes every stored assessment using its pinned rubric and the stored original observation, including assistance and source references. It reports any mismatch without overwriting the stored record. It verifies the implemented scoring contract, not the quality of the rubric or human learning validity. A result-only reviewer cannot obtain the raw record through replay.

## Offline behavior and failures

The workspace’s offline-response policy defaults to false. If enabled, a learner may explicitly opt in to local storage for a response before sending it. The outbox stores the frozen response and assignment/workspace IDs under the signed-in account. It does not store credentials, answer keys or source packs. This is unencrypted browser storage and is unsuitable for a device where such local copies are prohibited.

Atomic IndexedDB metadata transactions avoid lost updates across tabs. A response remains pending until the server acknowledges the exact ID, account, workspace, assignment and content. Network errors, malformed acknowledgements, revoked access and changed policy preserve the pending copy. Pending answers can be retried, exported or explicitly discarded; retries require a current session and permission. Queue capacity is 100 pending answers per account. Discarding a local copy does not erase an already-received server record.

Without local-storage permission, a failed online submission stays frozen in the open form for a retry using the same ID. Reloading loses an unreceived in-memory answer. Reopen the assignment to check whether the server committed it. This limitation is displayed next to the controls.

No institutional route sends text to an AI provider. Institutional materials are not automatically copied into the general translation UI. Existing personal translation/speech integrations remain separately available, and the user can still manually copy text elsewhere; this release is not a device data-loss-prevention system. Missing or failing providers do not block deterministic institutional scoring. Live council generation remains unavailable.

## API

Prefix: `/api/workspaces/{tenant}`. Mutations use JSON and the existing session/CSRF headers, including DELETE requests with `{}`.

| Method and suffix | Purpose |
| --- | --- |
| `GET /api/workspaces` | Current memberships and personal/private boundary |
| `POST /api/decision-tenants` | Existing workspace creation API: `{id,label}` |
| `GET /members`, `POST /members` | Owner member list; add an existing account by `{handle}` |
| `DELETE /members/{userId}` | Owner removal or member self-leave |
| `PUT /policy` | `{revision,offlineResponses}` with optimistic revision |
| `POST /sources` | Immutable source version |
| `GET /authoring` | Owner-only source versions and task/rubric inventory |
| `POST /tasks` | Immutable task and first rubric |
| `POST /tasks/{id}/rubrics` | Corrected rubric, expected version and reason |
| `GET /assignments`, `POST /assignments` | Scoped administrative listing; offer fixed terms |
| `GET /assignments/{id}` | Permission-filtered assignment and assessment record |
| `PUT /assignments/{id}/acceptance` | `{decision:"accepted"|"declined"}` |
| `POST /attempts` | Stable ID, assignment, response/choice, time, assistance and optional retry parent |
| `POST /attempts/{id}/reassess` | Stable ID, expected assessment, rubric version and reason |
| `POST /assignments/{id}/appeals` | Stable ID, assessment ID and correction reason |
| `POST /assignments/{id}/replay` | Recompute permitted stored assessments; no score mutation |
| `GET /audit?after=0` | Owner-only audit metadata, up to 200 rows and a `nextAfter` cursor |

Schemas are defined in `institutions.py`; `tools/demo_institutions.py` supplies a complete executable API example against a temporary database. Failed authorization returns 401/403, conflicting immutable content or revisions return 409, invalid input returns 422, and the existing rate limiter returns 429. Request bodies remain bounded by the existing middleware.

## Deployment and next steps

Use the unchanged local launcher. The database remains SQLite. Startup adds `institution_*` tables and indexes with `CREATE TABLE IF NOT EXISTS`. Back up before upgrading; keep `.data`, `.env.local` and the same browser origin. Backups include these tables. A previous app can ignore the additive tables, but retain a backup before any rollback. A database superuser can modify records; replay can detect scoring inconsistency, not all coordinated tampering.

Not implemented: SSO, email invitations, group hierarchies, ownership transfer, assignment withdrawal, retention controls, institutional content search, full offline source packs, reviewer notification delivery, speech rubrics, automatic human-reviewed equivalence, cohort model training, production scale testing, compliance certification or orchestration of isolated deployments. The authoring/listing APIs are suited to a bounded pilot; only the audit endpoint is paginated. These are explicit next steps, not hidden capabilities.
