# Run Nabu 1.13.0

Nabu 1.13.0 is an additive feature release over 1.12.2. It preserves the existing reader, Explore collection, library, review state, account sync and SQLite schema; the Structure lens is browser-side authored evidence and requires no new provider, API key or database migration.

## Safe upgrade

1. Back up the Nabu folder and your live SQLite database.
2. Stop the old server.
3. Extract `nabu-local-1.13.0.zip` into a separate folder.
4. Copy the contents of its `nabu` folder over the application/source files in your existing installation. Keep your own `.env.local`, `.data/`, `.venv/`, backups and browser profile data.
5. Start Nabu:

   **Windows**
   ```powershell
   py -3 start_local.py
   ```

   **macOS/Linux**
   ```bash
   bash start-local.sh
   ```

6. Open `http://127.0.0.1:8000/explore` or `/read` using the same browser/profile/origin as before.

Do not clear site data to perform an upgrade; guest libraries live in browser storage.

## Try the 1.13 feature

Open **Read → Just exploring? → Try an example**. The sample is now:

> The researcher photographed the student with the telescope.

Tap **student**, open **Structure lens**, and run the recommended diagnostic. Movement should push relative support toward the instrumental reading; coordination remains explicitly inconclusive. Reset diagnostics to return to the 50/50 authored prior.

The lens is sentence-level explanatory evidence only. Running a diagnostic does not save a word, create a review event, or change learner mastery.
