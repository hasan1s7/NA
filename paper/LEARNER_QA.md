# Learner paper verification

Current PDF: `nabu-learner.pdf`. Title: **From Typed Language Structure to Bayesian Learner Decisions: Auditable Hierarchies in Nabu**.

- Pages: 9, US Letter, official vendored ICML 2026 preprint style.
- SHA-256: `123ad09ebc21e756c2d07d78d7ff03367cefa003d526891096a283e123f1fd5b`.
- Compiled with pdflatex/bibtex and two resolving passes.
- No overfull boxes, unresolved references, multiply defined labels, or text blocks outside page bounds.
- All fonts are embedded according to `pdffonts`.
- All nine pages were rendered at 105 dpi and visually inspected. Detailed equation, appendix, and figure pages were inspected at full render size. No clipped tables, figures, equations, or overlapping text remained.
- Numerical macros and vector figures come from the saved learner evaluation JSON. The figure manifest retains that file's hash and the complete release-verification record.
- Two independent model/policy reviews checked the written mathematics against the implementation. The shared-factor identity includes component kind, and the variance-Gibbs conditional uses only likelihood-active coefficients.
- The paper is not tagged for accessibility; PDF screen-reader behavior was not verified.

The numerical record is synthetic. Test counts describe executed software checks. The paper does not claim human calibration, intervention efficacy, deployment, submission, peer review, or acceptance. Earlier graph and evidence-loop papers remain unchanged as historical PDFs.
