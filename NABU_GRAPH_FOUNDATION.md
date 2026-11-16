# Nabu: a graph that can justify its next step

Updated 2026-11-14. Build: `nabu-graph-20261114-r1`. Base checkpoint: `dd8e829`, the verified Prompt 3 implementation. This release extends the existing application; it does not create another learner model, ontology, dashboard or recommendation system.

**The immediate deliverable is a typed, versioned incidence graph and bounded query interface.** A candidate can now retain the exact recorded relations, roles and source locations that made it available. Whole application records preserve every required input and contextual guard. A query that stops early says that it is incomplete. None of these facts becomes evidence that the learner knows a word or that a recommendation will help.

The long-term design permits richer reviewed linguistic applications and another storage implementation behind the same query contract. The current implementation deliberately stays within Nabu's real catalogue and local application. It does not certify a million-record deployment, automatic disambiguation, linguistic correctness or educational efficacy.

## 1. What actually existed

Inspection covered the source data, generators, runtime APIs, existing intent/evidence modules, reader integration and tests. The conclusions below come from the repository. The external graph critique remains a design input, not the implemented schema.

| Layer | Verified state before this extension |
| --- | --- |
| Application | Vanilla JavaScript/CSS, Python standalone HTML builder, FastAPI/Pydantic backend, SQLite, browser IndexedDB metadata and existing account queues. |
| Intent | Persistent immediate learner intent, optional broader destination, exploratory/unknown states, explicit/inferred provenance and separately scoped organization objectives. |
| Graph | `nabu-graph.js` already stores 1,026 authored alignment groups compactly. Its optional `exportGraph()` expands translation/category pairs. `nabu-structure.js` already supplies typed forms, authored usages, provenance, ambiguity, source anchors and complete application validation. |
| Content | Six Arabic reader items, 24 exact annotations and 18 existing exercises. Annotation-to-bank links are empty; a similar English gloss is not an authored join. |
| Learner | Existing recognition, production, listening and cloze schedules plus the Prompt 3 event ledger. The direct observation projector leaves competence unknown and does not propagate graph success. |
| Policy | Transparent task-aware priorities over real support actions; optional authored diagnostics in the evidence episode. No production bandit, graph mastery score or validated individualized forgetting model. |
| Storage | Public linguistic data are bundled JSON/JavaScript. Private intentions/events use existing scoped storage. No graph database or production morphology ingestion pipeline exists. |
| Test checkpoint | The previous verified release passed 668 Node, 480 Python and 56 DOM tests. Current exact results are recorded separately in `docs/GRAPH_VERIFICATION.md`. |

### Audit results

The 1,026 alignment groups comprise 900 word entries, 90 phrases and 36 expressions across 12 languages. Their 12,312 primary term slots include 12,189 distinct exact, language-qualified NFC surfaces. There are 120 shared-primary-surface groups, with 123 additional memberships, and 134 ambiguous normalized lookup keys when supported aliases and meaning renderings are included. These are catalogue properties, not counts of validated lexemes or senses.

The optional legacy export contains 135,432 directed translation records, 13,935 category pairs and 67 explicit bridge rows. Twenty-four bridge rows are generated category anchors. For example, a category connector is not a linguistic prerequisite merely because it links two topics. The old runtime was already compact; the new work does not remove an imaginary startup clique.

The legacy export uses term-slot node IDs for translations and alignment IDs for its concept links. This two-namespace contract remains unchanged. Its listed target node also differs from the actual authored translator's plain-meaning output in 396 idiom directions. Translating the Spanish meaning of “piece of cake” back into English is one example: the resolver returns “It's very easy.” while the listed expression is “It's a piece of cake.” The additive query layer selects the actual meaning-rendering role and preserves both records.

The bank remains AI-assisted authored material without independent review. External references attached to nine expression records support their stated idiom scope; they are not attestation for the full multilingual bank. The new graph does not upgrade those review labels.

## 2. Mathematical contract

Let the public structure be

\[
\mathcal G=(V,F,I,\tau_V,\tau_F,\rho,\sigma,\Pi),
\]

where \(V\) contains typed records, \(F\) contains relation/application records, \(I\) contains incidences between them, \(\rho\) labels each incidence's role and optional position/language, \(\sigma\) retains review or quarantine status, and \(\Pi\) resolves source records and declared lineages. Factor and node identities occupy distinct namespaces. Equal strings may occupy different languages, alignments, usages or roles.

This is a role-bearing incidence representation. It can equally be stored as a bipartite graph with explicit factor nodes. The essential property is preserving relation identity and roles, not insisting on a particular graph database.

### Association is different from application

An association such as category membership can help discover a record under an explicit relation filter. Traversing it does not establish an implication.

A full application \(f\) retains input records \(A_f\), output records \(B_f\), features, provenance, alternative analyses and declared guards. Under supplied structural inputs \(S\) and context \(c\), availability requires

\[
A_f\subseteq S,\qquad \bigwedge_{g\in\Gamma_f} g(c)=\mathrm{satisfied},
\]

as well as the explicit review/fixture gate and no unresolved competing analysis. Missing context is unknown; a contradiction is a mismatch. The result is structural availability under supplied declarations. It is not a statement that the learner knows \(S\), that the analysis is linguistically true or that producing \(B_f\) would be educationally useful.

Flattening \(\{a,b\}\to c\) into independently usable \(a\to c\) and \(b\to c\) loses conjunction. The flattened edges cannot distinguish that rule from two genuine unary alternatives. A bipartite encoding that preserves the factor and checks all its ports does distinguish them.

The new gate is local: it checks one supplied whole application. It does not compute recursive closure, a globally optimal learning path, a Steiner tree or a minimum intervention plan.

### Provenance and multiplicity

Every relation references source records with locators. A witness identifies the exact factor and from/to role-bearing ports used. Source lineages are reported without a claim of statistical independence. Copying one source into twenty row IDs keeps one declared lineage and `independenceEstablished: false`.

A witness identifies the supplied source record and locator associated with a claim; it does not independently verify that source's contents or the claim's truth. Different lineage labels also do not establish independence. This implementation retains explicit witnesses and lineage groups, not a probabilistic source-validity model or a complete provenance-semiring algebra.

### Bounded queries and partial answers

For a \(k\)-member association, the incidence representation stores \(k\) memberships; a complete directed clique projection stores \(k(k-1)\) pair records. Metadata can dominate at small arities. Construction reads and validates all supplied data and sorts IDs/adjacency; it is not claimed to be strict linear time.

After construction, a neighborhood query uses typed adjacency and explicit factor/incidence/node/answer budgets. It reports visited work, scope, limits and truncation reasons. These counters exclude preprocessing, source-text validation and output metadata copying; they are not a wall-clock or heap-memory guarantee.

A complete result is complete only for the declared catalogue, relation allow-list and depth. A missing result does not prove that a word or relation does not exist. For an ambiguous indexed surface, total matches are retained even when the answer cap returns only one. The next-step engine withholds an incomplete material branch and leaves Continue available.

## 3. Implemented code

### Pure graph kernel

`public/nabu-graph-kernel.js` exports `createIncidenceIndex(snapshot)` and the version `typed-incidence-v1`. It has no learner, policy, storage or network imports.

The snapshot contains `schemaVersion`, `id`, `version`, `nodes`, `factors` and `sources`. A factor declares either `association` or `application` semantics, complete member ports, a review status and source references. An application additionally retains the full existing application record and an explicit guards array.

Validation checks finite JSON, identity conflicts, closed references, disjoint namespaces, exact port identity, form/language binding, complete application inputs/outputs and complete competing analyses. Duplicate identical record IDs are idempotent; conflicting payloads fail. Returned records are frozen; a full snapshot export is detached.

| Index operation | Meaning |
| --- | --- |
| `getNode`, `getFactor`, `getSource` | Inspect an exact stored record; missing IDs return null. |
| `incident(nodeId, {relationTypes})` | Inspect factor memberships, optionally by explicit relation types. This full adjacency accessor is not a bounded traversal. |
| `stats()` | Typed counts, duplicate diagnostics and zero materialized pairwise edges. |
| `snapshot()` | Explicit detached full export, including sources and alternatives. |
| `witness({nodeIds, factorIds, steps})` | Validate exact factor/port references and return their versioned provenance. A witness can be a proof subgraph; it need not be one walk or an approved recommendation. |
| `queryNeighborhood(options)` | Deterministic bounded association discovery; application factors require their separate all-input gate. |
| `assessApplication(factorId, options)` | Check supplied inputs, guards, quality, fixture opt-in and unresolved alternatives for one complete application. |

Default neighborhood limits are 64 factors, 512 incidences, 256 nodes and 64 answers; default depth is one, with a maximum depth of eight. Fixture applications and authored-unreviewed applications each require explicit opt-in. Generated, unknown, quarantined and needs-verification applications remain blocked. A declared `verified` fixture status is test input, not independently established attestation.

### Adapter over the current catalogue

`public/nabu-structure-query.js` reuses `nabu-graph.js`, `nabu-structure.js`, the real content catalogue and the new kernel. It does not replace the legacy graph.

The current typed snapshot has **16,833 nodes, 4,190 association factors, 4,199 source records and 21,598 incidences**, with no pairwise edges allocated and **zero live application factors**. Node types comprise forms, alignments, authored usages, topics, media and an authored task profile. Language-specific lexeme and lexical-sense inventories remain unavailable rather than being invented.

The query API is:

```js
import {
  buildStructureSnapshot,
  structureIndexStats,
  graphVersion,
  queryStructure,
  lookupAlignmentWitnesses,
  occurrenceWitnesses,
  taskMaterialWitnesses
} from './public/nabu-structure-query.js';

const meanings = lookupAlignmentWitnesses({
  text: 'light',
  sourceLang: 'en',
  targetLang: 'es',
  budget: {maxAnswers: 1}
});

console.log(meanings.status);                 // ambiguous
console.log(meanings.answers.length);         // 1
console.log(meanings.completeness.complete);  // false
console.log(meanings.omittedAlternativeCount);// 1
```

The specialized queries cover three currently useful seed types:

1. A bounded surface query preserves all indexed alignment candidates and the target role used by the existing translator.
2. An exact occurrence query resolves a current content version and annotation or exact selected text/offset. Repeated text requires its occurrence; a gloss does not invent a bank link.
3. An authored task-material query connects the existing introduction task profile to its three already-supported materials.

Discovery uses indexed match counts and lazy proposal construction before witness materialization. `alternativeCompleteness` separates known total alternatives from the identities actually returned. Specialized query budgets default to 64 factors and 32 answers. Their counted work applies after indexing; text anchoring and bounded normalization are separately disclosed work.

`tools/build_graph.py` adds a SHA-256 source manifest over twelve data and semantic implementation dependencies. `graphVersion()` includes that hash. Changes to the kernel, adapter, base structural/content interpretation or relevant generators invalidate the query version rather than silently reusing an old trace.

### Existing task support, unchanged priorities

`data/task-material-relations.json` moves the three existing introduction materials into an explicit authored relation with source locators. Their action IDs, wording and task priorities remain the same: greeting, appreciation and asking for repetition. These are options, not a cultural script or prerequisites.

`public/nabu-next-step.js` consumes the three real structural queries. Candidate availability still passes through the existing source, capability, language, context, quality and task gates. Learner evidence is joined separately; existing heuristic scores remain separate. Candidate metadata gains `structuralWitness`; the result gains `graphVersion` and structural query summaries. The task key includes the structural version. The public `sourceSnapshot` shape remains unchanged.

`nabu-next-step-ui.js` adds only public graph version and witness IDs to the existing local selection event. It does not add private intent/source text, raw answers or a new telemetry stream. A selection is still not an assessed success.

One confirmed compatibility correction is documented: an explicitly supplied `no-practice` preference now suppresses optional practice just as the existing “No quizzes” wording does. An inferred token remains unconfirmed and does not silently become a preference.

## 4. Real supported examples

| Case | Current behavior |
| --- | --- |
| Meet Alexandra's mamá | Existing greeting, appreciation and repair options receive authored task/material witnesses. The immediate intent and optional destination remain separate; unknown learner evidence stays unknown. Register and family context remain contextual, not a claim about all Mexican families. |
| “light” | Both known English alignment readings remain available for comparison. With a one-answer cap, one returned reading is still ambiguous and incomplete; the policy preserves Continue instead of choosing it as the meaning. |
| One song line containing “piece of cake” | The existing authored phrase explanation remains the same action and score. Its witness retains the correct meaning-rendering role, without claiming that a song was newly transcribed or attested. |
| Open-ended Arabic poetry | Exact versioned source annotations remain available without requiring a destination. No bank join or knowledge claim is fabricated. Explicit no-practice preferences are respected. |
| Organization support goal, personal exploration | The organization objective and learner purpose remain separate. Public graph records contain neither person's private intent nor learner history. Existing scope checks remain in force. |
| Unknown material or incomplete discovery | No invented content, graph-derived mastery or forced quiz. Continue remains functional; the support status explains unavailable material or incomplete discovery. |
| Full application | Synthetic fixtures test complete inputs, changed context, contradictory/unknown guards, competing analyses and quarantine. No live morphology suggestion is introduced. |

The shipping-bundle DOM tests execute the actual updated modules, open the existing meanings interface, preserve the reader's source nodes and check that structural discovery does not create cards, attempt/help events or provider calls. These are DOM behavior checks, not native rendering, accessibility or audio certification.

## 5. Integrity and privacy

The existing `data/graph-integrity.json` registry remains intact. The external P073-related PDF output record stays quarantined pending its upstream provenance/application join. The surface `marciendo` remains separately documented as dictionary-listed; it is not blacklisted, deleted or used to invalidate an entire pattern. No relevant production morphology data appeared in this release. See `docs/GRAPH_INTEGRITY.md` for the source/page and dictionary verification record.

The current bank's context-sensitive aunt/uncle alignments remain withheld from unqualified automatic suggestions. Twenty-four generated category anchors are now explicitly distinguished from authored association rows. All unreviewed materials retain their status.

The graph index contains public catalogue declarations. It does not contain user IDs, organization memberships, raw intents, learner responses or schedules. The adapter may handle a supplied surface locally for that query; it does not persist or transmit it. The browser event adds public trace IDs only. No third-party request, new backend route, database table or security guarantee is introduced.

Guest/account/team isolation continues to depend on the existing intent/evidence/server mechanisms. This public graph addition does not claim enterprise tenant isolation or solve trust in client-reported human behavior.

## 6. Verification and research boundary

The structural evaluation is reproducible with twelve fixed seeds. It checks whole-conjunction semantics against an intentionally lossy OR projection, a unary control, exact guard/status outcomes, copied source lineages, typed distractors, wide-factor budgets, snapshot round trips, all 135,432 translator directions and all 24 reader anchors. The complete report, generated JSON and CSV are in `docs/graph-evaluation/`.

The AND oracle is explicitly the synthetic generator's declared rule. Zero false availability from checking that rule is a contract result, not evidence that a hypergraph learned a better linguistic model. A lossless bipartite representation gives the same semantics. No latency, runtime heap or human learning metric is measured. At arity two, richer snapshot metadata is larger than the stripped pairwise edge array; the report includes that negative case.

The updated paper, **Typed Incidence Graphs for Task-Conditioned Language Support**, formalizes the contract and reports actual measurements and failure conditions. It uses the official ICML style and includes editable LaTeX, bibliography and vector figures. The previous evidence-loop paper and its source are preserved in `paper/history/evidence-loop-20261114/`; the prior evidence simulation results are unchanged. Neither paper is submitted, accepted, graded or evidence of measured human benefit.

Exact full-suite commands, results, warnings and artifact hashes are in `docs/GRAPH_VERIFICATION.md`. Runtime build and research commands are:

```sh
npm run build
npm test
python -m pytest -q
npm run test:graph
npm run evaluate:graph
node tools/evidence_episode_demo.mjs --check
python tools/build_graph_paper_figures.py
python tools/build_paper.py
```

No runtime setup or migration is added. Start through the existing launcher and preserve the existing private configuration, database and browser origin. Rebuild when changing graph sources or semantic dependencies.

## 7. Dream, immediate need, next logical step

**Dream.** A multilingual system should justify a context-specific suggestion through independently reviewable linguistic claims, exact source occurrences, explicit alternative analyses, the learner's actual evidence and their present purpose. It should be possible to revise one analysis, replay affected claims and explain what remains unresolved.

**Immediate need, implemented.** Preserve identities and whole relations; retrieve only supported local materials; retain versioned source witnesses; stop when the query is incomplete; leave learner inference and policy as separately testable consumers. The new contract can support a different indexed storage backend later without turning a UI projection into the source of truth.

**Next logical step.** Curate one small real language/operation slice with an independent reviewer: complete input/output records, applicability conditions, source locations, alternative analyses and negative examples. Link only reviewed task materials to actual source occurrences. Use that slice to test representation and query semantics first. Only then compare held-out learner prediction and equal-time intervention policies under the existing evidence contract.

Before claiming large-scale operation, benchmark the actual richer records and queries for peak memory, load time and latency, and decide whether persistence/incremental indexing is warranted. The current catalogue builders still enforce 900 words, 90 phrases, 36 expressions and twelve languages; the in-browser index is built in full and cached. Serialization counts and generous validation caps do not remove those practical limits.

Global planning, automatic source trust, new lexeme/sense ontology, learned graph embeddings, calibrated transfer inference and graph-conditioned intervention effects remain future work. The acceptance criterion for this release is narrower and inspectable: Nabu can show the recorded structural reason a candidate exists, preserve uncertainty and explain when it cannot safely return a complete answer.
