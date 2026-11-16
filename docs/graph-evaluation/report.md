# Graph foundation evaluation — typed-incidence-v1

**These are structural contract checks and generated counterexamples, not a linguistic benchmark or evidence of learner benefit.** No learner observations, knowledge probabilities, recommendation scores, production graph records or scheduler state are changed. The fixed protocol passes **24/24** explicit acceptance statements.

## Reproduce

```bash
node tools/evaluate_graph.mjs --output docs/graph-evaluation
node --test tests/graph-evaluation.test.mjs
```

Seeds: **11, 29, 47, 83, 101, 137, 173, 211, 257, 307, 359, 419**. Each arity/seed contains 128 input subsets: explicit empty and complete boundary cases, then seeded selections with probability .5 for each input. There is no model fitting or favorable seed search. Means and sample SD are over the declared seed replicates, not confidence intervals about people. Exact result JSON includes the full application fixture template, sample subsets, kernel statuses, witnesses, work counters, version fingerprints and dependency hashes. The deterministic script defines every generated graph. Timings are not measured; asymptotic statements follow from the representation and algorithms, not a stopwatch.

## Current repository audit

| Quantity | Measured value | Meaning |
|---|---:|---|
| Authored alignment groups | 1026 | Not independently validated multilingual lexemes |
| Supported languages | 12 | Current catalogue support |
| Legacy term slots | 12312 | Not unique forms |
| Legacy directed translation export edges | 135432 | Within-alignment pair expansion |
| Legacy topic-pair export records | 13935 | Category clique pairs; not independent semantic evidence |
| Legacy explicit bridge export records | 67 | Existing declared or category-generated bridges |
| Legacy export JSON bytes | 13768045 | Exact JSON serialization of exportGraph() |
| Existing runtime graph module bytes | 934444 | Runtime was already compact; export size is not runtime memory |
| New typed snapshot nodes / factors / sources | 16833 / 4190 / 4199 | First-class typed records |
| New membership incidences | 21598 | Role-labelled factor ports |
| New snapshot JSON bytes | 8658850 | Different metadata/schema; no automatic performance claim |
| Ambiguous normalized lookup keys | 134 | Multiple known catalogue candidates |
| Surface/factor combinations retaining multiple roles | 426 | Equal text need not have one role |
| Real complete applications | 0 | None imported by this release |

Public translation compatibility checked **135432** language-pair/entry cases: **0** mismatched outputs and **0** missing alignment answers. This tests compatibility with the existing authored translator, not translation truth. The old structural adapter's listed target form disagreed with actual translation output in **396** cases; exact examples in JSON distinguish idiom meaning-rendering roles from the original expression. The new witnesses use the role that matches the existing translator. Legacy export behavior remains unchanged.

All **24** current reader annotations produce an exact source witness while retaining null bank-alignment, lexeme and sense links. Their supplied source text is not silently joined to bank entries by a similar gloss. Canonical snapshot export/reconstruction is stable: **true**. Distinct language-qualified surface identities do not assert lexeme identity or validated senses.

## Conjunction is not a path

The complete fixture rule {A,B}→C and the two unary rules A→C, B→C have the same flattened edges: **true**. With only A available, full conjunction is available: **false**; a unary alternative is available: **true**. This establishes loss of grouping in this particular projection. A bipartite graph that preserves factor IDs and roles can retain both semantics; the comparison does not claim that all pairwise storage is inadequate.

The oracle below is the explicit synthetic AND requirement. Both compared methods receive the same inputs; no quality or context difference favors either one. False availability = false positives / all subsets. False among available = false positives / claimed-available subsets. Precision and recall use the declared conjunction as reference. Arity one is the positive control. Empty/full boundary cases ensure at least one available and one unavailable case in every seed replicate; those cases are included in every reported denominator.

| Required inputs | Method | False availability | False among available | Precision | Recall |
|---:|---|---:|---:|---:|---:|
| 1 | pairwise | 0 ± 0 | 0 ± 0 | 1 ± 0 | 1 ± 0 |
| 1 | incidence | 0 ± 0 | 0 ± 0 | 1 ± 0 | 1 ± 0 |
| 2 | pairwise | 0.4863 ± 0.0373 | 0.6461 ± 0.0449 | 0.3539 ± 0.0449 | 1 ± 0 |
| 2 | incidence | 0 ± 0 | 0 ± 0 | 1 ± 0 | 1 ± 0 |
| 4 | pairwise | 0.8529 ± 0.0218 | 0.9149 ± 0.0217 | 0.0851 ± 0.0217 | 1 ± 0 |
| 4 | incidence | 0 ± 0 | 0 ± 0 | 1 ± 0 | 1 ± 0 |
| 8 | pairwise | 0.9798 ± 0.0078 | 0.9895 ± 0.0052 | 0.0105 ± 0.0052 | 1 ± 0 |
| 8 | incidence | 0 ± 0 | 0 ± 0 | 1 ± 0 | 1 ± 0 |
| 16 | pairwise | 0.9844 ± 0 | 0.9921 ± 0 | 0.0079 ± 0 | 1 ± 0 |
| 16 | incidence | 0 ± 0 | 0 ± 0 | 1 ± 0 | 1 ± 0 |

This is a semantics stress test with an intentionally forgetful projection, not an empirical contest between full hypergraph algorithms and every graph implementation. A projection that retains factor IDs and checks all ports is an incidence implementation and avoids the counterexample.

## Context, quality, and competing analyses

| Fixture | Expected status | Actual status | Pass |
|---|---|---|---|
| missing-input | missing-inputs | missing-inputs | true |
| complete-input | available | available | true |
| context-unknown | context-unknown | context-unknown | true |
| context-mismatch | context-mismatch | context-mismatch | true |
| context-match | available | available | true |
| unresolved-analysis | unresolved-analysis | unresolved-analysis | true |
| quarantined-application | blocked | blocked | true |
| generated-application | blocked | blocked | true |
| fixture-not-opted-in | blocked | blocked | true |
| authored-not-opted-in | blocked | blocked | true |

Application availability means only that the supplied structural inputs and declared guards are present under the explicit fixture/review policy. It does not say that a learner knows those inputs, that the operation is linguistically correct, or that the output will help. Any unresolved alternative causes abstention, even when its output agrees; this deliberately conservative gate is not a complete possible-world solver. The status “verified” in synthetic fixtures is stipulated software input, not attestation of the fictional strings. No real morphology applications are imported.

## Provenance, relevance, and bounded answers

| Copied source records | Returned source references | Declared source lineages | Independence established |
|---:|---:|---:|---|
| 1 | 1 | 1 | false |
| 5 | 5 | 1 | false |
| 20 | 20 | 1 | false |

Different record IDs and sibling outputs do not become independent evidence. The kernel groups declared source lineage; it does not discover hidden dependencies. Differently labelled lineages also do not establish statistical independence. Full source occurrences and factor records remain inspectable.

| Irrelevant topic factors | Answer IDs | Counted factors / incidences / nodes | Complete |
|---:|---|---:|---|
| 0 | relevant | 1 / 2 / 2 | true |
| 10 | relevant | 1 / 2 / 2 | true |
| 100 | relevant | 1 / 2 / 2 | true |
| 1000 | relevant | 1 / 2 / 2 | true |

This invariance is conditional on a correct explicit relation filter and a prebuilt typed index. It is not a test of learned task relevance. A task-independent topology score cannot distinguish two tasks that prefer opposite materials on the same graph. Topic degree may reflect catalogue organization rather than usefulness; current category sizes range from 15 to 90 entries.

The real “light” query returns **2** known alignments. With a one-answer cap it returns **1** but remains **ambiguous** and **incomplete**. A missing catalogue answer is scoped to this inventory, not a claim that no linguistic answer exists. Omitted alternative identities and total match counts must be distinguished when a query budget is reached.

## Size and bounded-work measurements

| Factors | Arity | Incidences | Directed clique edges | Snapshot JSON bytes | Projected edge-array bytes |
|---:|---:|---:|---:|---:|---:|
| 100 | 2 | 200 | 200 | 30804 | 12961 |
| 100 | 4 | 400 | 1200 | 38184 | 77761 |
| 100 | 8 | 800 | 5600 | 52944 | 362881 |
| 100 | 16 | 1600 | 24000 | 82465 | 1555201 |
| 1000 | 2 | 2000 | 2000 | 308005 | 133561 |
| 1000 | 4 | 4000 | 12000 | 383785 | 801361 |
| 1000 | 8 | 8000 | 56000 | 535345 | 3739681 |
| 1000 | 16 | 16000 | 240000 | 838466 | 16027201 |
| 10000 | 2 | 20000 | 20000 | 3107006 | 1375561 |
| 10000 | 4 | 40000 | 120000 | 3884786 | 8253361 |
| 10000 | 8 | 80000 | 560000 | 5440346 | 38515681 |
| 10000 | 16 | 160000 | 2400000 | 8551467 | 165067201 |

For a k-member association, role-labelled incidence needs k memberships while the illustrative complete directed projection has k(k−1) edge records. Projection counts retain one edge record per group/pair, even when different groups share endpoints; deduplicating those records would erase further multiplicity and would not recover grouping. Byte columns measure different serialized formats: the clique drops grouping, roles and much provenance, while the snapshot retains them. They do not establish equivalent information, runtime memory, loading latency, or system-wide speedup. At small arities, richer metadata can outweigh incidence savings.

| Members in one allowed factor | Counted factors / incidences / nodes | Answers | Incomplete |
|---:|---:|---:|---|
| 100 | 1 / 16 / 17 | 16 | true |
| 1000 | 1 / 16 / 17 | 16 | true |
| 10000 | 1 / 16 / 17 | 16 | true |

Query counters exclude construction, validation, metadata cloning and canonical sorting of the complete index. Indexing must read all supplied records and includes sorting costs; it is not claimed to be strict linear time. Generic neighborhood budgets cap counted factor/port/node visits and answer count after indexing. Specialized source queries also validate the selected current source and preserve indexed catalogue match counts; their bounded output must never imply semantic exhaustiveness. The report includes no latency benchmark and no worst-case guarantee for hypothetical global planning or provenance-expression enumeration.

## Acceptance statements

| Check | Pass |
|---|---|
| lossy-projection-collision | true |
| application-missing-input | true |
| application-complete-input | true |
| application-context-unknown | true |
| application-context-mismatch | true |
| application-context-match | true |
| application-unresolved-analysis | true |
| application-quarantined-application | true |
| application-generated-application | true |
| application-fixture-not-opted-in | true |
| application-authored-not-opted-in | true |
| unary-positive-control | true |
| conjunction-oracle-agreement | true |
| shared-provenance-not-multiplied | true |
| typed-distractor-invariance | true |
| wide-factor-budget | true |
| scale-counts | true |
| snapshot-roundtrip | true |
| translation-contract-parity | true |
| ambiguity-survives-truncation | true |
| missing-is-inventory-scoped | true |
| anchored-occurrences-without-invented-bank-joins | true |
| same-spelling-language-scoping | true |
| no-production-applications | true |

## Limits and immediate next step

The current bank remains authored and unreviewed. Language-specific lexemes and lexical senses are not invented. Existing next-step scoring and direct learner evidence remain separate from graph discovery. A graph witness establishes that a material is linked by allowed recorded relations; it does not identify instructional utility from topology alone. Source lineage records neither estimate source truth nor license automatic transfer into the learner ledger.

The immediate implemented step is the typed snapshot, local full-application gate and bounded witness query, connected to existing discovery. Before broader inference, add independently reviewed source-grounded applications with explicit applicability guards, versioned alternative analyses and counterexamples. Evaluate their structural query semantics separately from held-out prediction and equal-time policy studies. Global optimal plans, semantic disambiguation, probabilistic source validity, graph-based learner transfer and human learning outcomes are not implemented or measured here. The previous research-only evidence experiments remain unchanged in docs/evidence-evaluation/.
