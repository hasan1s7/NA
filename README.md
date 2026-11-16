# Nabu 1.17

Read or resume content → select a word or phrase → understand it in context → listen when available → save → continue.

**Release:** 1.17.0. **Build:** `nabu-pages-1.17-20261116-r3`.

**Overnight build r2:** optional learner consent and a coarse departmental support summary, plus corrected history/export behavior. See `docs/RELEASE_NOTES_1.17_OVERNIGHT.md` and `docs/VERIFICATION_OVERNIGHT.md` for current scope and evidence.

## GitHub Pages and colours

Open **https://hasan1s7.github.io/NA/**. GitHub Pages publishes the generated entry files from `main` / repository root. Editable application modules remain in `public/`; run `python3 tools/build_pages.py` after editing them and commit both source and generated entry files. The optional `.github/workflows/nabu-pages.yml` deployment is manual only; the active publisher is branch Pages. On Pages, reading, the offline word bank, guest saving, notes, review, local media and colour palettes run in the browser. Accounts, departmental workspaces, sync and server-backed providers require the full Python application; Pages does not run that backend.

The original green theme is the default. Open **Settings & data → Colour palette** to choose Original green, Lapis, Clay or Plum. The preference saves on this device. Palette templates are defined in `public/nabu-palette.js` and `public/nabu-palette.css`; they use shared semantic colour tokens and ship locally.

The deployed green build passed live Chromium checks for lookup, saving, notes, reader/mode restoration and palette persistence after refresh. Local verification passed 872 JavaScript tests, 106 DOM tests and 14 launcher/HTTP checks. See [Pages release report](docs/PAGES_AND_PALETTES_1.17.md) for exact limits.

## Start

1. Extract the entire ZIP into a writable folder. Install Python 3.11 or newer.
2. Windows: double-click **Start-Nabu.cmd**. macOS: open **Start-Nabu.command**, or run `bash start-local.sh` in Terminal. Linux: run `bash start-local.sh`.
3. Keep the terminal open. Visit **http://127.0.0.1:8000/explore** in your usual browser.

The launcher creates a local Python environment and installs the unchanged pinned dependencies on first use, so that setup needs internet. The rebuilt application is bundled: Node/npm, API keys and deployment are not needed to read, use the offline bank or save words. Press Ctrl+C to stop.

If double-click launching is unavailable, run `py -3 start_local.py` on Windows or `python3 start_local.py` on macOS/Linux. To suppress browser opening, add `--no-browser`. If port 8000 is occupied, add `--port 8001`; changing the port creates a different browser storage origin, so preserve/export guest work first.

See [START_HERE.md](START_HERE.md) for exact upgrade instructions, [release notes](docs/RELEASE_NOTES_1.17_OVERNIGHT.md) for current changes, and [verification](docs/VERIFICATION_OVERNIGHT.md) for actual results and limits.

## Workspaces & assignments

Open **Settings & data → Workspaces & assignments → Open workspaces**. Sign in using the existing account controls first. Owners can create a workspace, add existing account handles, author a source and task, and offer an assignment with named reviewers. Learners accept the reporting terms before submitting. A named reviewer can inspect and export the permitted record, replay its scoring, and append a reassessment after a corrected rubric is published.

A person can belong to several organizations while retaining a separate private library and intentions. Organization records do not automatically enter the personal learner model. Offline pending-answer storage is off by default and requires both workspace permission and learner opt-in. The ordinary reader remains available.

See [the workspace guide and API contracts](docs/INSTITUTION_BACKEND_1.17.md). Run `.venv/bin/python tools/demo_institutions.py` on macOS/Linux, or `.venv\Scripts\python.exe tools\demo_institutions.py` on Windows, for the isolated one-learner/two-organization HTTP demonstration. It uses fictional accounts and a temporary database, and makes no external provider calls.

## Try the main flow

- Choose **Bring your own text**, or open a curated piece. Returning readers can **Resume your text**.
- For a quick offline example, use English → Spanish and paste `There is water on the table. I open a book.` Select **water**.
- **At a glance** shows the meaning, original highlighted sentence, uncertainty, pronunciation availability and Save.
- **In depth** adds available usage evidence, literal wording, separately labeled examples, sources, reading aids, notes, corrections and the relevant council pair.
- Switch modes without replacing the source, media player or explanation subtrees. New users start at a glance; the preference is remembered.
- Choose **Save word**. An actual successful write produces the saved state. **Edit context & note** preserves notes and reading aids; **Correct saved meaning** is in depth.
- Optional local audio/video plays alongside your pasted transcript. Files stay on your device. The last playback time is remembered; reselect the same file after refresh to resume. There is no automatic media import or transcription in this new file player.

## Honest boundaries

The Council roster and on-request controls are implemented, with an explicit unavailable response. The supplied app has DeepL and ElevenLabs adapters but **no authorized conversational AI adapter or credential**. This release does not generate council conversations or fabricate them. Provider setup is a separate dependency; no new paid service was introduced.

The offline word bank has 1,026 meanings across all twelve existing languages. A dictionary match is not automatic contextual disambiguation. Curated editorial notes are labeled drafts. In-depth sections show available evidence; unsupported grammatical or regional claims are not invented.

The interface remains English. Learning and meaning languages are separate. The existing twelve language codes, transliteration behavior, DeepL locale settings and ElevenLabs language/voice handling are preserved.

Nabu is an original small vector scribe, with clay, lapis, a tablet and reed stylus. Expand him for status or a concrete failure assessment. Settings supports small, quiet and hidden modes. “Listening” means waiting for a selection, not recording audio.

## Data and integrations

Keep your existing `.data`, `.env.local`, browser profile and exact origin when upgrading. Startup adds the institutional tables with CREATE TABLE IF NOT EXISTS; it does not rewrite existing records or clear browser stores. Own-text resume is local to the browser and scoped to the current account; it is separate from the existing synced curated-content progress. Saved vocabulary, notes and reading aids retain the existing guest/account persistence and export paths.

DeepL, ElevenLabs, optional speech/transcription, extension connections, accounts, reviews, graph/learner tools, friends and sharing remain in the existing architecture. Credentials stay on the server. The original private configuration is never bundled in the release.

## Development

Python dependencies: `python -m pip install -r requirements.txt -r requirements-dev.txt`.
Node development dependencies: `npm install` (existing versions in package.json; normal users do not need this).

- Rebuild: `npm run build`
- JavaScript domain tests: `npm test`
- Shipping-bundle DOM acceptance: `npm run test:dom`
- Workspace API/outbox/DOM acceptance: `npm run test:institutions`
- Reader/modes preservation: `npm run test:scribe`
- API/database tests: `python -m pytest -q`
- Actual launcher/HTTP/restart smoke: `python tests/local_http_smoke.py`
- Optional native web bundle: `npm run mobile:prepare`

DOM fixtures do not certify browser layout, disk durability, speech output or assistive technology. Native applications and live providers require separate testing. Earlier release documents and test evidence remain historical context; this README and the 1.17 verification report describe this release.
