# Nabu 1.14.0 — Evidence → State → Decision

## What was actually changed

This is an additive backend increment on the uploaded Nabu 1.13.0 source, not a rewrite. `decision_engine.py` adds a pure event replay function, a deterministic catalog recommender, membership-gated tenant contexts, and three authenticated endpoints. `server.py` installs the module and its two new SQLite tables. Existing `/api/content-progress`, reader, Structure Lens, cards, and schedules remain unchanged.

## Real contracts

- `GET /api/decisions?mode=individual-undefined`
- `GET /api/decisions?mode=individual-defined&destination=ar`
- `POST /api/decision-tenants` JSON `{"id":"school-a","label":"School A"}`
- `POST /api/decision-tenants/school-a/members` JSON `{"userId":"<existing Nabu user id>"}` (owner only)
- `GET /api/decisions?mode=enterprise-undefined&tenantId=school-a`
- `GET /api/decisions?mode=enterprise-defined&tenantId=school-a&destination=es`

These routes use the existing cookie authentication and CSRF protection. Tenant membership is verified server-side, but enterprise decisions are **individualized within the tenant**: the engine never exposes another member's private events. Enterprise administration, organizational objectives, invitations, shared analytics, and tenant-wide aggregate outcomes are **not implemented**. Do not market this as a complete enterprise product.

## Replay, evidence, and outcome semantics

`content_events` is the immutable source of truth; replay sorts by `(at, id)` and ignores duplicate IDs. `opened`, `position`, `finished`, `preference`, and structured `attempt` events are folded. Structured multiple-choice correctness is computed only from authored answer keys. Free-text recall is not auto-graded. The recommender filters completed items, optionally filters by a literal destination match (content ID, title, language, interest), then ranks novelty, resumability and explicit preference. Every score exposes its contributing terms. **These scores are deterministic heuristic priorities, not calibrated probabilities, causal effects, or learner mastery.**

The current event API still has its original 8,000-event cap per user. Event ingestion remains the existing `/api/content-progress` endpoint, with its original idempotency, validation, atomic batch writes, and owner scoping. No fabricated new event types or claims of universal cross-device sync were introduced.

## Migration and compatibility

Back up the SQLite database before launching. On server startup, `CREATE TABLE IF NOT EXISTS` installs `decision_tenants` and `decision_memberships`. The database `user_version` is not changed. Existing user/content data is untouched. The new tables have foreign-key cascades to existing users. Removing the two new tables rolls back the additive data model (tenant memberships will be lost).

## Verification

In this build, `python -m pytest -q tests/test_content_progress.py tests/test_decision_engine.py tests/test_server.py` passed **45 tests**. The new tests exercise all four modes, owner/membership access control, deterministic replay, and destination validation. This is not a claim that the entire original release suite, Chromium checks, or a live enterprise pilot were rerun.

## Known next steps

1. Define a versioned, independently validated learner evidence event schema with rubric-based grading and provenance; keep syntax evidence separate.
2. Build a real destination ontology and enterprise-assigned objectives rather than literal string filtering.
3. Add opt-in, privacy-preserving cohort analytics and admin policies before enterprise launch.
4. Add explicit decision-outcome attribution and offline calibration before claiming learning gains.
5. Test multi-device sync, tenant lifecycle, migration rollback and end-to-end browser flows in staging.
