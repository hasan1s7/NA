# Nabu 1.10.0 - media helpers in your existing app

This update is based on the supplied `nabu-local-1.9.0.zip`. It keeps your current
FastAPI/SQLite application, clean `/words` route, library, account isolation,
review engine, offline queue and sharing. It is not the earlier standalone demo.

## 1. Upgrade without losing your words

1. Keep a private copy of your current Nabu folder. Never upload `.env.local`,
   `.data`, recovery codes, database snapshots or API keys.
2. Back up the database using the existing backup command. For the default local
   configuration, run from your current project folder:

   ```text
   python tools/backup_database.py --db .data/nabu.sqlite3 --out backups/pre-1.10.0.sqlite3
   ```

   Use the actual `NABU_DB` path from your private configuration when different.
   The backup command refuses to overwrite an existing backup. Use a new name.
3. Stop the old server with Ctrl+C in its terminal.
4. Unzip the new archive into a separate folder. Copy the contents of its `nabu`
   folder into your existing project, replacing application/source files only.
   **Keep your existing `.env.local`, `.data/`, `.venv/` and backups.** None of
   these private files or folders is included in this release archive.
5. Restart with your existing `Start-Nabu.cmd`, `Start-Nabu.command`, or:

   ```text
   python start_local.py
   ```

6. Keep the same browser/profile and exact address you used before:
   `http://127.0.0.1:8000/words`. A different host or port is a different guest
   storage origin. Hard-refresh after the server restarts. Do not clear browser
   site data to update the code.

The update adds `extension_tokens` and `media_captures` tables with `IF NOT EXISTS`.
It does not delete or rename your existing library tables. SQLite database
backups include the new tables. Ordinary library JSON exports include card
notes, image IDs and reading aids but **not the separate encounter history**.
Use server database backups to preserve captured-source history as well.

## 2. Meaning, context, notes and free clip art

In `/words`, select a word and press **Show meaning in context**. The panel shows
its recorded dictionary sense and lets you preserve the sentence where you met
it. This is not a claim that a language model automatically disambiguated it.
You can listen, reveal an explicitly labeled reading aid, edit a private note,
choose an optional image, and save through the existing library store.

Four unmodified OpenMoji starter images are bundled: water, book, house and sun.
They work without an image API, billing or network lookup. Suggestions are based
on the selected dictionary sense; the learner must confirm the image. No image
is better than a wrong one. A broad stock-search service and personalized image
generation are not included. Attribution and license links are in the interface
and in `THIRD_PARTY_MEDIA.md`.

Save failure leaves your form intact and re-enables saving. Account changes
clear private open-dialog/recording state rather than carrying it into another
account. The app differentiates local pending saves from server-confirmed saves.

## 3. Text-to-speech

New preferences default to **Device voice**, with explicit replay, stop and
close controls. Existing saved voice preferences are respected. The app checks
for a voice matching the chosen language and explains when none is available;
it never silently substitutes a different language. Install a matching voice
in your operating system when needed. Device-provided online voices are labeled.

The existing ElevenLabs integration remains available when you deliberately
configure it, sign in and consent. It is not needed for the free path. While a
context form is open, missing cloud setup produces an instruction instead of
replacing your unsaved form with another dialog.

Playback and its controls were tested with simulated voice events. Audible
output and installed voices must be checked on your own device.

## 4. Recording and local speech-to-text

Recording is explicit: **Start microphone -> Stop -> Listen -> Transcribe ->
Edit -> Use edited transcript**. Maximum 60 seconds / 4 MB. Audio is not sent
while you record. The web app enables microphone access only for its own origin.
A transcript is a draft, not pronunciation scoring or evidence of mastery.

Speech recognition is optional and needs local dependencies plus model weights.
There is no paid recognition API fallback and no automatic request-time model
download. Until configured, the transcription button is disabled with setup
instructions; recording and manually editing a transcript remain available.

### Windows

Run from the existing project folder, after launching Nabu once so `.venv` exists:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-speech.txt
.\.venv\Scripts\python.exe tools\setup_speech.py --download --model base --check
```

### macOS / Linux

```bash
.venv/bin/python -m pip install -r requirements-speech.txt
.venv/bin/python tools/setup_speech.py --download --model base --check
```

Install the **FFmpeg command-line program** first if the helper reports it missing;
verify `ffmpeg -version` works in the same terminal. Nabu uses a bounded FFmpeg
subprocess to validate and decode audio before model inference. Official downloads:
https://ffmpeg.org/download.html

The helper downloads `Systran/faster-whisper-base` only because `--download` was
explicitly supplied. It prints the exact line to add to private `.env.local`:

```text
NABU_WHISPER_MODEL_DIR=/absolute/path/printed/by/the/helper
```

Use that printed path, not the placeholder. Restart Nabu, refresh its connection,
and sign in before transcribing. `--model tiny` is a smaller alternative;
`--model small` is a larger one. Download/model loading requires disk, memory,
network access during setup and compatible CPU packages. These are local-compute
costs, not a promise of free hosting.

Your browser keeps the recording while an ordinary request fails. On normal
server completion or failure, temporary audio is deleted; raw audio is not
stored in SQLite. A process/OS crash can leave OS temporary files for cleanup.
Only one transcription runs at a time. The draft remains editable after return.

**Not verified here:** installation/model inference or recognition accuracy.
The implementation, validation, auth, decoder, bounds, cleanup and response flow
were tested, with explicitly stubbed inference. Run the local acceptance check
below before calling speech recognition ready.

## 5. Reading aids / transliteration

The new context panel supports editable, saved reading aids, separately from
translation. Automatic paths are deliberately bounded:

- Latin-script text: original spelling, not a pronunciation guide.
- Russian: letter transliteration, without inferred stress or vowel reduction.
- Arabic: only written letters and marks; missing vowels/dialect are not guessed.
- Korean: Hangul syllable transliteration, without cross-syllable sound changes.
- Chinese bank entries: existing approximate stored romanization, labeled as
  draft and not verified tone-marked Pinyin.
- Japanese: no fabricated kanji reading. Enter a checked reading manually.

The inherited Japanese draft romanization is suppressed on the word/translation
surfaces rather than presenting Chinese character readings as Japanese.
User readings are saved with the card, survive sync/export, and do not become
knowledge or pronunciation scores. Reverse cards do not inherit the old reading.

## 6. Connect the Chrome extension

Use the supplied `chrome-extension` folder (also provided as its own ZIP).
Chrome 116 or later is the declared minimum. No Web Store publication occurred.

1. Open `chrome://extensions`, enable Developer mode, choose **Load unpacked**,
   and select the folder containing `manifest.json`.
2. Copy the installation's 32-letter extension ID. In Nabu, sign in and open
   **Settings & data -> Manage extension connections**. Paste the ID and create
   a 30-day connection. Copy the token shown once. Treat it like a password.
3. Open the extension's **Connection** page. Use your server origin (normally
   `http://127.0.0.1:8000`, with no `/words` suffix), paste the token, and press
   **Check connection & save**.
4. On a normal webpage, highlight a short passage, click the Nabu extension icon,
   then **Capture highlighted text**. Alternatively use the selection context
   menu. Review the source context, select/enter a meaning, add a private note,
   and **Save word & note to Nabu**.
5. The word appears in the same signed-in Nabu library. **Context & media** shows
   its captured sources and per-encounter notes. Open the same account on the web
   app; the extension does not share its login cookie or access every library row.

Bank lookup is free/offline on your server. Text outside the bank needs a manually
entered meaning or explicit consent to your existing configured translation
provider. Context may be sent for translation; private notes are not.

Tokens are hashed on the server, tied to your account and installation ID, expire,
and can be revoked from Nabu. Password recovery revokes them too. They live in
Chrome's local extension storage, not sync storage or page scripts. Disconnecting
locally also clears session drafts; revoke in Nabu to invalidate the server token.
Moving/reloading the unpacked folder can change its ID; reconnect when necessary.

The extension does not read browsing history, install passive content scripts or
silently record. `activeTab` is used after your gesture. Optional HTTPS host
access is requested only for the Nabu origin you enter. Sensitive query strings
and fragments are omitted from captured links; YouTube's video ID is preserved.
Other query-dependent URLs may need a canonical source link entered manually.
Unsaved text lasts for the browser session; save before quitting Chrome.

### Recording in the extension

Open **Record and transcribe an excerpt**. Use the microphone or **Choose tab
audio**, select a tab and enable sharing its audio in Chrome's chooser. If no
audio is shared, the extension explains the problem instead of pretending to
record. Only audio is encoded; the chooser's video track is stopped with the
other tracks and is not uploaded. Browser/device/tab restrictions can prevent
capture; use a permitted transcript in that case. No DRM bypass is implemented.

Closing the panel stops recording and discards unsaved audio. Transcription is
sent to your same Nabu server only when requested. Review the text before using
it; add the original source details yourself because the tab chooser does not
supply a source URL. New transcripts clear stale source/context fields rather
than attributing a new recording to the previous article.

## 7. Local acceptance check - required before a live pilot

Use a test account and an actual passage you are allowed to capture.

- Open `/words`, display context, edit a note, save, refresh and reopen it.
- Listen in each intended language. Confirm sound, Stop and Replay.
- Record 5-10 seconds, stop, play it back, transcribe, correct and save it.
- Load the extension, capture a selection, confirm a meaning, save and verify
  the original source and note in your same web account.
- Disconnect the network during a save: the draft must stay visible. Retry after
  reconnecting and verify there is only one encounter for the same save request.
- Try an incorrect/revoked token and denied microphone permission. Both should
  produce clear instructions without losing typed text.
- Sign out or switch accounts while a dialog is open; private transient content
  must not remain in the next account.

Native browser navigation was blocked in the implementation environment. An
attempt to load the unpacked extension did not produce an observable worker.
Therefore native Chrome installation/permission prompts/tab recording and
real-device persistence/audio are not marked passed. See `MEDIA_VERIFICATION.md`
for the actual automated evidence and explicit fixtures.
