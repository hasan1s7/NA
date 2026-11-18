# UX white paper: implementation and verification

**Prepared:** November 18, 2026. **Upstream inspected:** `hasan1s7/NA` main at `c624841475dfd584d231bf355d40d7b06cc83f7a`. **Deployment:** not published or merged; GitHub branch creation returned 403. **Privacy:** self-contained static page, no external scripts, assets, API calls, tracking, cookies or user data.

## Delivered HTML page

- Source: `public/nabu-ux-whitepaper.html`; self-contained CSS and semantic HTML. Browser-independent content can be printed through the browser's Print command.
- Seven anchored learner-facing phases: encounter, understand, keep, retrieve, vary, repair, return.
- Optional preflight explained without claims about learner competence; source-level surface analysis marked prototype.
- Annotated conceptual UX sketches, an evidence-boundaries table, design principles, deployment status distinctions, and one falsifiable pilot.
- Explicit distinction between bounded codebase capabilities, locally tested new component, and untested general claims.
- The illustrations are text/CSS concepts, not fabricated screenshots of the app.

## Browser checks

Run `python3 demo/capture_whitepaper.py` with Playwright and Chromium available.

Checks executed successfully in headless Chromium:

- Desktop viewport 1440 x 1000: no document-level horizontal overflow, one H1, seven phase articles, seven evidence rows, valid jump anchors, expected navigation links, no page JavaScript errors.
- Mobile viewport 390 x 844: same checks, no document-level horizontal overflow.
- Screenshots: `demo/whitepaper-desktop.png`, `demo/whitepaper-mobile.png`, `demo/whitepaper-circuit.png`.

Only the standalone white-paper page was browser-tested; these checks do not validate the full Nabu site or its deployed PWA.

## Integration

The local feature-bundle installer `tools/apply_media_preflight.py` verifies unique anchors and on a nondefault feature branch changes the existing source only by adding:

- A link in the existing Explore footer to `./nabu-ux-whitepaper.html`.
- A matching link style in `public/nabu-explore.css`.
- `nabu-ux-whitepaper.html` to `tools/build_pages.py` allowlisted root copy files.

The existing Nabu application is **not overwritten** by this delivery. The installer is idempotent and fails closed when the anchors differ. Tests in `tests/test_media_preflight_installer.py` pass for the isolated fixture; the complete application test suite still needs to run against a real checkout before publication.

**Release requirement:** the repo's `tools/build_standalone.py` hard-codes the PWA build ID. For a future approved release the maintainer must update the build identifier through Nabu's release process before running `tools/build_pages.py`, validate that the service worker and published root files match, and test returning users before merging. Nothing here pushes to GitHub or invalidates existing caches.
