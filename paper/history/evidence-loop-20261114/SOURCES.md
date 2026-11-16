# Source verification for the paper

Bibliographic metadata and the limited related-work claims were checked against the following primary publisher, proceedings, or author-hosted sources. The manuscript paraphrases the relevant ideas and contains no copied passages. These references are background; none evaluates the Nabu implementation.

| Citation | Verified primary source | Use in the manuscript |
|---|---|---|
| Corbett and Anderson (1994), *Knowledge tracing: Modeling the acquisition of procedural knowledge* | [Springer article and DOI](https://link.springer.com/article/10.1007/BF01099821) | Published December 1994; volume 4, pages 253–278; probabilistic modeling of acquisition and performance. The paper does not claim that Nabu implements BKT. |
| Pavlik, Cen, and Koedinger (2009), *Performance Factors Analysis—A New Alternative to Knowledge Tracing* | [University of Memphis faculty publication record](https://digitalcommons.memphis.edu/facpubs/8350/) and [author-hosted full paper](https://pact.cs.cmu.edu/koedinger/pubs/AIED%202009%20final%20Pavlik%20Cen%20Keodinger%20corrected.pdf) | Authors, title, AIED/FAIA volume 200, pages 531–538, DOI; use of performance history and adaptive instruction. |
| Settles and Meeder (2016), *A Trainable Spaced Repetition Model for Language Learning* | [ACL Anthology official proceedings entry](https://aclanthology.org/P16-1174/) | Authors, ACL 2016, pages 1848–1858, DOI; a fitted recall-over-time model, distinct from Nabu's fixed freshness threshold. |
| Guo, Pleiss, Sun, and Weinberger (2017), *On Calibration of Modern Neural Networks* | [PMLR official proceedings entry and BibTeX](https://proceedings.mlr.press/v70/guo17a.html) | Authors, ICML/PMLR volume 70, pages 1321–1330; calibration and bin-based evaluation. Nabu is not described as a neural predictor or temperature-scaled model. |
| Brier (1950), *Verification of Forecasts Expressed in Terms of Probability* | [AMS publisher record](https://journals.ametsoc.org/view/journals/mwre/78/1/1520-0493_1950_078_0001_vofeit_2_0_co_2.xml) | Publisher-indexed title, author, volume 78(1), pages 1–3, DOI; background for squared probability error. The publisher's full-page retrieval returned HTTP 403 during a later check; no quotation or unverified detailed interpretation is used. |
| Gneiting and Raftery (2007), *Strictly Proper Scoring Rules, Prediction, and Estimation* | [Author-hosted published JASA PDF](https://sites.stat.washington.edu/raftery/Research/PDF/Gneiting2007jasa.pdf) | Authors, March 2007, volume 102(477), pages 359–378, DOI; proper probability scores. The publication year follows the published PDF rather than a later online metadata date. |

## Official style

- [ICML 2026 Author Instructions](https://icml.cc/Conferences/2026/AuthorInstructions) links the official style archive and specifies an eight-page main body plus references/appendices.
- [Official ICML 2026 style archive](https://media.icml.cc/Conferences/ICML2026/Styles/icml2026.zip) was downloaded successfully from that linked URL.
- The original archive's checksum and vendored-file list are in `vendor/SOURCE.txt`. The official files are unchanged.
- Anonymous preprint notice handling is described in `README.md`. No paper has been submitted to ICML or a course, and no grade is claimed.

## Implementation and generated data

Repository counts, module responsibilities, contracts, and the authored contrast set were checked against the source shipped with the paper. All experiment figures come from `docs/evidence-evaluation/results.json`; the source checksum is recorded in `figures/manifest.json`. The fictional family manifest, seeds, assumed gain/retention regimes, exact policy, and metric denominators are fully specified in the appendix and evaluation script. These sources are sufficient to reproduce the synthetic numbers; external literature is not used to imply that those assumptions were measured in people.
