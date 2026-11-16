# Persistent private translation memory

The bundled offline bank remains the first lookup in the client. The new backend memory handles uncached, explicitly requested private cloud translations. There is no automatic public publication of arbitrary user text.

## Request key

The stored key hashes request text (including meaningful case/spacing), source and target language, context, formality, requested model preference, regional English/Portuguese variants, endpoint tier, formatting policy and Nabu pipeline version. The API's existing NFC/outer-whitespace normalization occurs before caching. Different contexts do not share a cache entry. Provider credentials are not part of stored records.

## Persistence and constraints

Answers are stored in SQLite with owner foreign keys. No 24-hour expiration is applied to successful translation records. Limits are 2,000 entries per account and 20,000 globally, with least-recently-used eviction. Cache hits do not reserve character allowance again. Existing persisted quota counters remain conservative on failed requests because a timeout can occur after a provider has processed a request.

A process-local striped lock coalesces duplicate requests. This is NOT a distributed exactly-once guarantee. Use one server process/instance for this private-beta SQLite deployment. A crash between provider response and database commit may still lead to another billable request later; the software does not claim perfect prevention of this failure mode.

Deletion is explicit. Clearing history also clears private server memory. Account deletion cascades. Clearing caches retains the usage ledger and quotas. An in-flight generation captures a generation number; clearing advances it so the late answer cannot recreate a purged cache. This does not delete old backups.

## Usage display

- Cache hits: server-side durable hits only.
- Provider attempts: generation attempts after quota reservation, including failures.
- Source characters submitted: local character counter for those attempts.
- Reused characters: lengths of requests served from server memory.

These are not billing records, and do not include bundled-bank or browser-only reuse. No monetary savings estimate is invented.

## Provider references consulted

DeepL's current translation API documents the independent effects of context, formality, model choice and regional target settings. Its `context` input is not itself translated and does not add billed text characters; its `show_billed_characters` response option is separate from Nabu's internal counters. This package does not claim that local counters equal the provider invoice.

- https://developers.deepl.com/api-reference/translate/request-translation
- https://developers.deepl.com/docs/learning-how-tos/examples-and-guides/how-to-use-context-parameter

Consulted 2026-11-06. No provider API was called during package validation.
