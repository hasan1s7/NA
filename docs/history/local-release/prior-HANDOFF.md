# Nabu 1.7.1 - Pages-ready handoff

Use nabu-pages-1.7.1.zip for the existing GitHub Pages website.
Use nabu-source-1.7.1.zip for continued development or full-stack deployment.
This is a repair of the attached 1.7.0 archive, not a new backend release.

## Pages upload

1. Export the browser library first: Settings & data -> Full backup.
2. Extract nabu-pages-1.7.1.zip. Upload its contents into the SAME published folder
   as the current index.html. Replace matching files, keep the icons directory
   intact, and retain any existing repository workflow/configuration.
3. Commit the upload. After the Pages deployment completes, reload the site.
   If a stale shell remains, open nabu-repair.html in that same site directory.
   Never clear browser site data as a cache-fix shortcut.

The package contains index.html, nabu-sw.js, nabu-repair.html,
nabu.webmanifest, nabu-icon.svg, .nojekyll and five PNGs under icons/.
All application code/styles are embedded in index.html; there is no build step
for this Pages package. Do not upload backend code, private .env or databases.

## Find the changes

- Translate -> Concatenate: rough assembly and term-by-term breakdown.
- Word bank -> select a word -> Graph view, below the language forms.
- Settings & data -> Feature decision tree.
- Existing approximate transliterations appear with supported bank entries.

## Repair details and verification

See TEST_REPORT.md. Missing SVG functions and a missing feature-tree binding
were repaired. HTML/CSP and worker build identifiers have been rebuilt together.
The startup helpers and existing browser database name/version are preserved.
No account, database, deployment, or provider configuration was changed.

## Backend and mobile

The Pages bundle does not run the account/sync/public-short-link backend.
Full-stack deployment and native app compilation remain separate work.
Keep private configuration and existing databases outside public source control.
Read MOBILE_HANDOFF.md for existing native build instructions.

## Language-quality limits

Transliteration is still an approximate draft, not certified pronunciation or
reliable Japanese kanji readings. Concatenation is not grammatical translation.
No further language-engine changes are claimed in this packaging repair.
