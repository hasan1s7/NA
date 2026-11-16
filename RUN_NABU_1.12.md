# Run Nabu 1.12.1 - the Explore MVP

## Safely update the installation you already use

1. Keep a private copy of your existing Nabu folder and database. In your current project, use the existing backup command (choose a new output filename):

   ```powershell
   python tools/backup_database.py --db .data/nabu.sqlite3 --out backups/pre-1.12.1.sqlite3
   ```

   Use your configured `NABU_DB` path instead if different. Never upload this backup, your private config, recordings or recovery codes.
2. Stop the current server with Ctrl+C in its terminal.
3. Extract `nabu-local-1.12.1.zip` into a separate folder. Copy the CONTENTS of its `nabu` folder into your existing Nabu project, replacing application/source files. Keep your existing `.env.local`, `.data/`, `.venv/`, backups and browser data. None of those private folders is supplied in the ZIP. Do not replace your database with an empty/test one.
4. Start from the updated project folder on Windows:

   ```powershell
   py -3 start_local.py
   ```

   Or double-click `Start-Nabu.cmd`. If `py` is unavailable but Python is installed, use `python start_local.py`. Python 3.11 or later is required. The launcher creates/reuses `.venv`, installs pinned requirements when needed and starts the server. Initial dependency installation requires internet. Keep the terminal open.
5. Open:

   ```text
   http://127.0.0.1:8000/explore
   ```

   The launcher now opens Explore. `/read`, `/words`, `/library`, `/review`, `/friends`, `/settings`, and the existing translator remain available. Use the same browser/profile and exact origin as before. A new host/port is a different guest storage location. Refresh after restarting; do NOT clear site data to update code.

macOS/Linux: `bash start-local.sh` or `python3 start_local.py` from the project folder. No npm install, provider key, extension installation or paid service is needed to use the supplied built text experience. Do not run a plain static file server as a substitute for the full account/backend application.

## The first session

Explore has six Arabic pieces with English support. Choose an interest or browse everything. Open a piece, select an underlined expression for its authored contextual explanation, optionally listen or save, and return to the text. Every other word remains selectable through the existing dictionary/manual-meaning path. Reveal the English translation only when helpful.

At the end, optional practice offers a contextual choice, recall of an authored expression, and a related-context question. Skip is not incorrect. A revealed answer or hint is recorded as assistance. Saving does not enroll a word in review: new reader saves remain Reference items. Use the existing library controls to opt into study.

`Mark as read` is your explicit completion choice, not a comprehension score. `More like this` changes a transparent content recommendation; it does not alter your knowledge record. Return to Explore to continue the most recently unfinished piece.

## Persistence boundaries

- Guest: reading progress and words are stored only in this browser/profile/origin. They are not a cloud backup. Guest progress is NOT silently moved to a signed-in account.
- Signed in: curated progress is cached on-device and synchronized with the same Nabu server/account. Pending/offline and confirmed sync are distinguished. Keep the app open long enough to complete pending sync; failed progress sync has a working retry. The backend must be the updated 1.12 server.
- Account switching isolates histories. Signing out with pending content changes requires syncing first, rather than discarding them. Account recovery/deletion continues to follow existing account rules.
- This release makes the six packaged pieces resumable. Arbitrary pasted full documents retain the older tab-local behavior; saved word excerpts remain durable through the existing card store. It does not claim durable full-document import.
- Reading position is saved on a short debounce and on normal navigation/visibility changes. An abrupt power loss can lose the very latest unsaved movement. Practice responses and explicit actions require a successful local write before claiming success.
- Ordinary Library JSON backups include words/notes/readings/images but NOT the separate content history. Explore's `Export reading progress` exports private event data for inspection/safekeeping; there is no content-history import UI in 1.12. Full server SQLite backups preserve account content history and the existing encounter history. Guest progress has no server backup.
- The initial content history limit is 8,000 events per identity. At the limit new writes stop with an explanation, not silent deletion. Larger history compaction/import is a later feature.

## Optional existing speech, images and extension

No recordings or new generated images are bundled with the collection. Device pronunciation uses the installed matching voice, if present, with actual stop/replay/error handling. A missing voice does not prevent reading, saving or practice. This release does not guarantee audio on every device/language.

The existing five concept-bound OpenMoji assets and language-specific editable reading aids are retained. Optional microphone transcription still needs the local speech dependencies/model described in `MEDIA_SETUP.md`; it is not required to use Explore. The Chrome extension is included, versioned 1.12.1, and keeps its existing capture path. Pairing instructions remain in `MEDIA_SETUP.md`. No new extension permissions or provider credentials were added.

## Local acceptance before involving learners

Use a test account and the same origin throughout:

- Open `A little later`, select an annotated phrase, save it, edit its note/reading, refresh and reopen it.
- Scroll partway through a different piece, return to Explore, close/reopen the tab, and Continue. Check your actual browser's position restoration.
- Submit an incorrect recall, a response after Reveal answer, an unaided match, and a skip. Confirm distinct feedback and the explanation under `Why this practice?`.
- Disconnect during a save, preserve the draft, reconnect and Retry. Verify one saved result.
- Confirm actual voice output and Stop on your device. Missing voice should explain itself. Try a narrow window and native 200% browser zoom with Arabic.
- Sign in as another test account: no previous account's progress or drafts should appear.

Native browser navigation was blocked in the implementation environment. Native Windows startup, storage/cookies/service workers, physical-device zoom and audible voices require these local checks. Test-harness passes are not represented as native-device verification.

For rollback keep BOTH the old application and a pre-upgrade database backup. The new server adds `content_events` if absent; it does not drop or rename existing tables or rewrite word schedules. Backups after upgrading contain the new table. Do not delete a live database to resolve a startup issue. Send terminal errors with credentials removed.
