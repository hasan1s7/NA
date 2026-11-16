# Source verification for the current graph paper

The current paper cites only primary publications or their author/institution-hosted copies. Bibliographic details and the limited claims below were checked on 14 November 2026. The manuscript contains no copied passages. None of these sources evaluates Nabu or establishes the truth of its authored language bank.

| Citation | Primary source checked | Supported use and boundary |
|---|---|---|
| Gallo, Longo, Nguyen, and Pallottino (1993), *Directed Hypergraphs and Applications* | [Giorgio Gallo's institutional publication list](https://pages.di.unipi.it/gallo/papers.html); [publisher record](https://www.sciencedirect.com/science/article/pii/0166218X9390045P), DOI 10.1016/0166-218X(93)90045-P | Basic directed-hypergraph background and metadata: four authors, *Discrete Applied Mathematics* 42, 177–201. The author list supplies all four authors; an incomplete third-party index was not used. Full publisher retrieval returned HTTP 403 and the linked PostScript archive could not be fetched. No specific algorithm, complexity theorem, or quotation is attributed to unread full text. |
| Kschischang, Frey, and Loeliger (2001), *Factor Graphs and the Sum-Product Algorithm* | [Published paper on the ETH author-group site](https://www.isiweb.ee.ethz.ch/papers/arch/aloe-2001-1.pdf), DOI 10.1109/18.910572 | Original title page verifies authors, IEEE Transactions on Information Theory 47(2), 498–519. The opening explains bipartite factor/argument structure. Nabu uses a representational analogy and does not implement sum-product or a probabilistic factor-graph learner model. |
| Green, Karvounarakis, and Tannen (2007), *Provenance Semirings* | [Author-hosted full PODS paper](https://web.cs.ucdavis.edu/~green/papers/pods07.pdf), DOI 10.1145/1265530.1265535 | Verified three authors and PODS 2007; annotated relations, dependency/provenance, distinct interpretations of combination. General provenance semirings are not all idempotent. Nabu currently returns source sets and checked steps, not a complete semiring evaluator or independent-source probability model. |
| Darwiche and Marquis (2002), *A Knowledge Compilation Map* | [Original JAIR paper](https://www.cs.cmu.edu/afs/cs.cmu.edu/project/jair/pub/volume17/darwiche02a.pdf), DOI 10.1613/jair.989 | Title page verifies JAIR 17, 229–264, publication September 2002. The paper explicitly analyzes succinctness against supported queries/transformations. Used to motivate stating the supported query class; no knowledge-compilation solver is claimed in Nabu. |
| Corbett and Anderson (1994), *Knowledge tracing: Modeling the acquisition of procedural knowledge* | [Springer primary article record](https://link.springer.com/article/10.1007/BF01099821) | Previously verified title, authors, volume 4, 253–278, December 1994. Used only to distinguish learner inference from structural graph availability; Nabu does not claim to implement BKT. |
| Settles and Meeder (2016), *A Trainable Spaced Repetition Model for Language Learning* | [Official ACL proceedings entry](https://aclanthology.org/P16-1174/) | Previously verified authors, title, ACL 2016, 1848–1858, DOI. Used to distinguish fitted recall prediction from the present structural query contract and fixed freshness policy. |

The original six-reference evidence-paper verification is preserved in `history/evidence-loop-20261114/SOURCES.md`. Its additional predictive-calibration citations are not used to imply a graph learning effect in the new paper.

## Official style

- [ICML 2026 Author Instructions](https://icml.cc/Conferences/2026/AuthorInstructions) links the official archive and specifies the eight-page main-body limit plus references/appendices.
- [Official style archive](https://media.icml.cc/Conferences/ICML2026/Styles/icml2026.zip) was downloaded from that linked URL. Its SHA-256 is `8b29290f5828e176debb57ea9cc00252502973d55ea561a2f18a7f0a326bfc6c`.
- Vendored files remain byte-for-byte unchanged; `vendor/SOURCE.txt` records them.
- Anonymous preprint notice handling is described in `README.md`. There is no submission, acceptance, institutional affiliation, or course-grade claim.

## Implementation and measured results

All repository counts, public contracts, application gates, and witness semantics come from the shipped code and reproducible audit in `tools/evaluate_graph.mjs`. Numeric macros and vector figures are generated from `docs/graph-evaluation/results.json`; `figures/graph-manifest.json` records its exact checksum. The result JSON identifies implementation and source dependencies, fixed seeds, fixture inputs, statuses, source witnesses, and operation counts.

The mathematical projection collision, its conditional Bernoulli error formula, the declared-lineage set invariant, and the opposite-task utility counterexample are derived in the manuscript under explicit assumptions. They are not literature novelty claims or human findings. The synthetic conjunction oracle is declared set inclusion. The manuscript does not cite external literature as evidence that these fictional applications are valid morphology or that structural checks improve a learner's performance.
