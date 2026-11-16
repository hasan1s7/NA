# Nabu 1.17 — overnight departmental build (r2)

Release version remains **1.17.0**. Build identifier: **nabu-workspaces-1.17-20261115-r2**. Prepared November 15, 2026, Eastern. The Nabu 2.0 ambition guides the work; it is not the shipped version.

## Source and scope decision

The authoritative base was the latest application archive `Nabu-1.17.zip` (18,863,873 bytes; SHA-256 `52695f940faeb5903a1339088ad9479a0475fa9555a8708b916c8226c51861aa`), which supersedes 1.16 and already includes the reader modes, graph/learner/intent work and scoped assignments. The later Founder Studio Pack contained documents, experiment/reference-model code, and a presentation video, not a newer application source. It was treated as project context. No repository guidance file or `.git` history was in the application archive.

Fresh baseline: 869 JavaScript tests, 88 DOM tests, 505 backend tests, and the 23-check existing institutional HTTP demonstration passed before editing. The work used an isolated extracted copy, fictional accounts, and temporary databases. Original user data and credentials were never loaded.

The selected slice is accepted assignment evidence → separately opted-in departmental support → explainable next step → correction → updated summary. It addresses the first university use case without adding a framework, service, dependency upgrade, broad automatic learner scoring, or speculative infrastructure.

## What changed

- **Reporting choice:** separate learner-controlled permission, off by default, with displayed terms/policy version, optimistic revision, safe acknowledgement retry, withdrawal and stale-request handling. It includes past/future accepted assignment results in that workspace, not private reading or vocabulary.
- **Department support:** owner-only whole-workspace summary of distinct eligible learners; five-person minimum, five-wide count bands, small-cell and complement suppression, no raw response/learner-ID drilldown or arbitrary filters.
- **Evidence interpretation:** one priority category per learner; correction requests and latest assessments of first responses drive support suggestions. A successful retry does not replace the first response, publishing a rubric does not silently reassess, and no personal learner-model update occurs.
- **Non-resurrection:** leave/removal records an off revision tombstone even if the learner never saved a choice. Rejoining and an older request cannot revive reporting.
- **History repair:** attempt/assessment order and current-head selection use insertion order, retaining timestamps as metadata, so clock rollback cannot hide newer corrections or retries.
- **Export repair:** changes after replay invalidate the cached replay export; the next export includes the current record.
- **Demonstration:** `tools/demo_department_support.py` exercises five fictional learners through the actual local launcher/API, with separate loopback client addresses and normal registration guards.

## Preserved

The twelve supported languages and original locale/script handling, saved cards/corrections/notes, source catalogue, graph and learner-model code, personal evidence/intent logic, media services, settings/routes, dependencies, and launcher approach remain. The only generated application changes are the rebuilt standalone UI/service-worker marker and corresponding mobile web assets. The learner's source DOM is not replaced when opening the optional modal.

## Upgrade and migration

Stop the old server and back up. Extract the entire archive, keep the old `.data` and `.env.local` (or configured database path), and use the same browser/profile/origin/port. Follow `START_HERE.md`. Startup adds `institution_support_consent` with `CREATE TABLE IF NOT EXISTS`; it does not rewrite existing learner data or opt anyone in. Database user-version remains the existing version. Backups include the new table. Keep a pre-upgrade backup for rollback; an older app can ignore the additive table but cannot enforce the new reporting workflow.

## Limits before a departmental pilot

Suppression is not anonymity, differential privacy or a privacy budget. Repeated reports, roster knowledge, collusion, manufactured memberships and owner-visible audit events can disclose participation. Previously downloaded data and already authorized in-flight responses cannot be recalled. A consent record is not proof of freely given institutional consent.

Conditions are partly self-reported. Exact rubric matches are not general proficiency. This release does not add institutional-to-personal posterior transfer, broad production/speech assessment, SSO, invitations/bulk enrollment, retention automation, ownership transfer or production-scale verification. Registration remains limited to five accounts per IP per hour, so simultaneous same-network class onboarding needs a tested plan. Native browser, Windows/macOS, physical phones, real provider/audio, and human learning outcomes remain unverified here. Council generation still reports its unavailable conversational-provider dependency.

See `DEPARTMENT_SUPPORT_1.17.md` for contracts and `VERIFICATION_OVERNIGHT.md` for actual final results. No deployment, publication, purchase, outreach or calendar change was performed.
