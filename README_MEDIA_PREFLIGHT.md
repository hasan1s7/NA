# Nabu Media Preflight: isolated source integration package

This package was prepared against the inspected **Nabu 1.18.0** main branch, latest observed head `c624841475dfd584d231bf355d40d7b06cc83f7a`. It is **not** a complete copy of Nabu, a production deployment or a replacement for existing source modules. It extends the existing readers using an additive installer and includes a self-contained, user-facing UX white-paper page (`public/nabu-ux-whitepaper.html`).

**IMPORTANT:** GitHub connector rejected remote branch creation with HTTP 403. The changes were **not pushed**. The full Nabu repository and browser app were not run in the authoring environment; only the isolated profiler, integration fixture, and isolated Chromium demo were tested. Do not merge or deploy without the full regression gates below.

## Install into your own Nabu checkout

1. Make a backup of your private account/browser work. Do not delete IndexedDB, `.data`, or the existing `.env.local` file. Review the source changes in this package first.
2. Obtain a clean, current working Nabu checkout. Do **not** start on `main`. From the checkout run:

   ```bash
   git checkout -b feat/media-preflight-b1-b2
   ```

3. Extract this ZIP at the repository root. It adds `public/nabu-media-profile.js`, `tests/media-profile.test.mjs`, `tools/apply_media_preflight.py`, `docs/...`, `demo/...`, and the standalone UX white-paper page, plus this handoff file. **It does not contain/replace `public/nabu-core.js`, `public/nabu-app.js`, `public/nabu-explore-ui.js`, `tools/build_standalone.py`, `public/nabu-explore.css`, `tools/build_pages.py` or `package.json`.** Existing files are modified only by the next guarded step.
4. Check integration anchors without editing:

   ```bash
   python3 tools/apply_media_preflight.py --check
   ```

5. Review `tools/apply_media_preflight.py`; then apply on the feature branch:

   ```bash
   python3 tools/apply_media_preflight.py --apply
   git diff -- public/nabu-app.js public/nabu-explore-ui.js public/nabu-explore.css tools/build_standalone.py tools/build_pages.py
   ```

6. Run validation against the **actual Nabu tree** after installing its existing dependencies:

   ```bash
   node --test tests/media-profile.test.mjs
   python3 -m unittest discover -s tests -p test_media_preflight_installer.py -v
   npm test
   npm run test:dom
   python3 -m pytest -q
   python3 tools/build_standalone.py
   ```

7. Open the rebuilt app locally on desktop and phone; test curated reader (Arabic source), own text in twelve languages, source selection, contextual help, deliberate saving, practice, return/reopen, account switch, consent and offline behavior. Confirm the new preflight is optional and **does not append an assessment event**. Validate keyboard disclosure, screen-reader naming and responsive layout.
8. After review and clean acceptance, open a pull request from your feature branch. To publish Pages, follow repository release procedures, explicitly rebuild generated root files via `python3 tools/build_pages.py`, and review the result. **Do not run that publication step on `main` before approval.** Update the PWA build identifier through the release procedure, then verify the service worker and Pages entry files to avoid old-cache confusion.

If anchors differ because of newer code, the installer fails instead of overwriting them. Port the minimal changes manually and test again. Re-running `--apply` is idempotent when the anchors remain compatible.

## UX white-paper page: where it lives

`public/nabu-ux-whitepaper.html` is a real, self-contained HTML page, not a proposal for a future page. It explains the **user-facing circuit** through seven concrete moments: encounter, contextual understanding, deliberate keeping, unaided retrieval, variation, targeted repair and later return. It starts with an **optional** media preflight, and ends by distinguishing existing features, a locally tested prototype and research hypotheses. It uses Nabu-like visual styling but accurately labels the on-page illustrations as concepts.

The installer adds a visible white-paper link to Explore, and adds the page to the root-file copying allowlist in `tools/build_pages.py`. After an approved `tools/build_pages.py` build, the page would exist at `/nabu-ux-whitepaper.html` next to the generated `index.html`. **The present package has not updated the GitHub Pages site.** The page is also downloadable/openable directly as a standalone HTML file from this package.

The document is written for learners, collaborators and supporters. The separate technical report remains the source of mathematical models, engineering caveats and trial protocols. The white paper does not claim learning efficacy or equal semantic analysis in all twelve languages.

## Programmatic contract

```js
import { analyzeText, analyzeMedia, renderPreflight } from './public/nabu-media-profile.js';

const sourceOnly = analyzeText(
  'En la mesa hay una llave. En la mesa hay una flor.',
  'es',
  {title: 'Una mesa'}
);
console.log(sourceOnly.quality, sourceOnly.frames);

const curated = analyzeMedia({id:'source-1',version:1,language:'en',format:'text',segments:[
  {id:'s1',text:'In the room there is a key.'},
  {id:'s2',text:'In the room there is a book.'}
]});
console.log(renderPreflight(curated));
```

This is read-only, source-level, synchronous, and performed in the reader browser. It uses `Intl.Segmenter` and `public/nabu-core.js` language validation, not a linguistic parser or learner knowledge graph. Its "first occurrence" means first within the given source, **not** first for a learner. Missing segmentation causes abstention, not an unreliable English-space fallback.

## Preview

`demo/index.html` is a deliberately isolated web component demonstrating the preflight's visual style and source analysis; it is **not** the full Nabu app. It uses local modules from the Nabu checkout. A screenshot is supplied separately and inside the package. `demo/capture_preview.py` requires Chromium and Playwright and shows an isolated browser capture; it does not verify production app integration. The full screenshot has no identifying private information. `public/nabu-ux-whitepaper.html` can be opened independently for a readable, printable explanation of the seven learner-facing moments. Its illustrations are explicitly marked as concepts, not production screenshots.

## Files and acceptance

- `public/nabu-media-profile.js`: analyzers + disclosure renderer.
- `tests/media-profile.test.mjs`: 11 unit tests using all registered language codes.
- `tests/test_media_preflight_installer.py`: 5 installer safety and white-paper integrity tests.
- `docs/MEDIA_PROFILE_V1_SCHEMA.json`: machine-readable schema, validated against 13 locally emitted source profiles.
- `tools/apply_media_preflight.py`: fail-closed integration adapter; also links the white paper from Explore and updates the Pages file-copy allowlist.
- `public/nabu-ux-whitepaper.html`: self-contained, printable, mobile-responsive product white paper describing encounter, contextual help, deliberate saving, independent retrieval, variation, repair and return, plus optional preflight and explicit capability boundaries.
- `docs/NABU_MEDIA_PREFLIGHT_REPORT.md`: audited six-object architecture, formulas, source-derived research review, experiments, limitations and B1-B4 roadmap.
- `docs/PATRICK_LONDON_BRIEF.md`: one-page collaborator handoff.
- `docs/WHITEPAPER_VERIFICATION.md`: exact white-paper browser checks, integration boundaries, and PWA release considerations.
- `demo/index.html`, `demo/capture_preview.py`, `demo/screenshot-desktop.png`, `demo/screenshot-mobile.png`: isolated component demo.
- `demo/whitepaper-desktop.png`, `demo/whitepaper-mobile.png`, `demo/whitepaper-circuit.png`, `demo/capture_whitepaper.py`: white-paper browser screenshots and reproducible responsive checks.

**Do not state this is a completed 1.19 release:** no GitHub write, full build/DOM regression or real in-app device verification was possible here. Keep the existing product running unchanged until those checks succeed.
