# Run Nabu 1.11.0

This is the existing Nabu 1.10.0 FastAPI/SQLite application with an implemented
reading-workspace redesign, sense-bound illustrations and bounded reading aids. It is not a mockup or another app.

## Upgrade an existing installation

1. Back up your current project and database. From the current project folder,
   using its Python environment, the default database backup command is:

   ```text
   python tools/backup_database.py --db .data/nabu.sqlite3 --out backups/pre-1.11.0.sqlite3
   ```

   Use your configured `NABU_DB` path when different. Do not overwrite an older backup.
2. Stop the running Nabu terminal with **Ctrl+C**. Do not start two copies on port 8000.
3. Extract the release ZIP into a separate location. Copy the files inside its
   `nabu` directory into the existing project, replacing application files.
4. Keep your existing **`.env.local`, `.data/`, `.venv/`, backups and browser data**.
   These private directories/files are not included in the release. No database
   migration or data reset was added for this redesign.
5. Start Nabu again with the commands below. Use the same browser profile and
   exact `127.0.0.1:8000` origin you used previously. Hard-refresh with
   **Ctrl+Shift+R** after restart; do not clear site data.

## Windows

Open the extracted/updated `nabu` folder (the one containing `start_local.py`).
Double-click **Start-Nabu.cmd**, or open PowerShell there and run:

```powershell
py -3 start_local.py
```

If your installation exposes `python` rather than `py`:

```powershell
python start_local.py
```

## macOS / Linux

From that same folder:

```sh
bash start-local.sh
```

Or:

```sh
python3 start_local.py
```

Python 3.11+ is required. The documented launcher creates/reuses `.venv` and
installs the unchanged pinned Python requirements on first setup. That first
installation needs internet access. Keep its terminal open while using Nabu.
No npm installation, frontend development server, new provider key, or paid
service is needed to run the supplied built app.

The launcher now opens the reading workspace:

```text
http://127.0.0.1:8000/read
```

Your existing word bank remains available:

```text
http://127.0.0.1:8000/words
```

All original routes remain supported. `/` is still Quick lookup. Do not open
`public/index.html` as a local file or substitute `python -m http.server` for
this launcher; those do not run the account backend.

## Try the implemented flow

Open **Read**, choose your language pair and paste a passage you are allowed to
use. A title is optional. Select **Start reading**, then select a word (or
highlight a phrase and choose **Look up selection**). The panel displays the
real source sentence and an available dictionary meaning. Ambiguous words ask
you to choose a sense; missing words offer a manual meaning instead of a guess.

Use the speaker control, **Save word**, then **Return to reading**. Existing
notes and review schedules are retained when saving another source sentence.
On a phone the same panel becomes a keyboard-managed sheet. Escape/Return
restores the selected word and the reading position.

**Intentional behavior change:** reading and word-bank lookups are no longer
automatically saved. Save explicitly. Quick lookup retains its existing
auto-save behavior. Saving a reading reference does not automatically add
homework or mark the word mastered.

The full pasted document remains tab-local; saving a word preserves its source
excerpt, not an entire cloud copy of the article. Very long source sentences
are bounded by the existing 1,500-character context field.

## Existing media helpers

Device pronunciation uses the installed voices already supported by Nabu.
Missing voices produce a visible explanation and a working Replay/retry.
Actual audible output depends on your browser and installed language voices.
Existing cloud TTS/translation stays optional and consented.

Recording/transcription and the Chrome extension are preserved. The five bundled
illustrations and new language-specific reading rules are documented in
**MEANING_TOOLS.md**. The web app and extension share the same reading module. Their setup remains documented
in **MEDIA_SETUP.md**. The redesign does not install a speech model, publish
an extension, or add a universal video/article importer. A recorded transcript
used from Read opens in the reading workspace rather than submitting itself
for translation.

## Illustrations and reading aids

Select a word, then **Reading aid & details -> Add context & a note** (or
**Edit context & note** for a saved word). Expand **Reading aid & optional
illustration**. Pick a matching illustration, edit a reading and save.
**Not right for this meaning** removes the image and keeps private feedback
after saving; choosing it again explicitly restores it. No generator is connected.

**Show transliteration** reveals a labeled suggestion or an honest unavailable
state. User corrections take priority. **Use this draft reading** asks before
replacing a nonempty correction; clearing a reading keeps it hidden after saving.
Chinese and Japanese kanji need a checked word-level reading or a manual entry.

A bundled bank meaning can be wrong for a sentence. **Use a different meaning**
opens the existing editor with the original word and sentence, not a fabricated
translation. For example, the financial-bank image is not applied automatically
to a manually entered river-bank meaning.

## Local acceptance on your machine

Before using a live learner account, use a test account:

- Save a selected word and note; refresh and confirm both in Library.
- Play pronunciation in the intended language; test Stop and Replay.
- Try missing vocabulary and a temporarily failed save; verify the source and
  draft remain visible and Retry works.
- Check a phone/narrow window, keyboard access and Arabic mixed with Latin text.

The included verification report distinguishes real HTTP/SQLite checks from
browser fixture tests. Native Chromium navigation was blocked in the build
environment, so hardware audio, microphone permissions, the installed Chrome
extension, native browser refresh/IndexedDB durability and Windows execution
still need your device check. No production deployment occurred.

## Developer checks

With the existing requirements/dev requirements and test tools installed:

```text
npm run build
npm test
python -m pytest -q
npm run test:ui
npm run test:redesign
npm run test:meaning
```

The browser test harnesses use Linux Chromium/Playwright and explicit test
fixtures; they are not an installed-Windows-Chrome automation promise. There
is no lint script in the supplied project. The release also passed JavaScript
syntax and Python AST checks; no linter/package upgrade was introduced.
