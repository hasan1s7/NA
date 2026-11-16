# Nabu 1.17.0

This release implements the bounded institutional milestone: one learner can work with two organizations while retaining a separate private learning workspace. It extends the supplied 1.16 application; it does not claim to implement the entire five-year institutional architecture.

## Implemented

- An optional **Workspaces & assignments** entry in Settings. Existing reading, explanation modes, media, vocabulary, corrections, notes, language settings and account flows remain in place.
- Reuse of existing organizations and memberships, plus owner-managed membership and explicit leave/removal. Rejoining cannot revive revoked assignments or reviewer grants.
- Immutable, attributed source versions and task conditions. Exact-match recall and multiple-choice recognition rubrics are authored and versioned. Original source text and raw responses are preserved before scoring normalization.
- Assignments distinguish the learner, assigning owner and named reviewers. A learner accepts or declines fixed reporting terms. Results-only access omits raw answers and correction-request text. An owner is not implicitly a reviewer.
- Stable submission IDs, atomic database writes and duplicate acknowledgement. A first response cannot be silently replaced; linked retries remain visible without increasing the first-response count.
- Visible-source assistance is derived from the server task. Other help is self-reported and labeled unverified. No mastery, certification, learning-gain or statistical-independence claim is produced.
- Correction requests, owner-published rubric revisions, explicit reviewer reassessment, preserved prior results, exact scoring replay, permitted-record export and a paginated audit API.
- A device outbox for pending answers, disabled by default. It requires workspace permission and learner opt-in, is scoped by account/workspace, and keeps the exact frozen response until a matching acknowledgement. Failed or revoked uploads remain exportable/discardable. It does not cache task materials or answer keys for disconnected use.
- Institutional assessment records remain outside personal vocabulary, content-progress evidence, SRS and Bayesian model inputs. No automatic cohort sharing was introduced.
- No provider is needed for institutional task scoring. Provider failure/missing credentials leave this workflow and ordinary local learning functional. Council generation remains explicitly unavailable.
- Preserved local launchers and dependency pins. Additive SQLite tables, no rewrite of existing records, and no framework or runtime dependency upgrade. The standalone builder now synchronizes the service-worker release ID. Docker source packaging includes previously omitted imported modules and catalogue data; a Docker image was not built here.

## Boundaries

This is an institutional foundation, not a production enterprise certification. There is no SSO, domain verification, email invitation, group hierarchy, ownership transfer, configurable retention, proctoring, calibrated institutional proficiency model, speech assessment, external AI routing, private cloud orchestration, or fully disconnected deployment.

The interface remains English; the twelve existing learning languages and their existing locale/script handling are preserved. Exact matching can reject a valid regional or idiomatic answer: the UI labels it a rubric non-match and offers review rather than calling the learner wrong.

See `START_HERE.md`, `INSTITUTION_BACKEND_1.17.md`, and `VERIFICATION_1.17.md` for launch instructions, contracts, actual results and untested platforms. Nothing was published, deployed or pushed externally.
