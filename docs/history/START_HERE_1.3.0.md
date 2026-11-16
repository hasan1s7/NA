# Start here: accounts, friends and phrases

This is the **full server app**, not a three-file GitHub Pages patch.
Nothing has been deployed, and no database is hosted yet. The Render connection
was not enabled in this ChatGPT session. No paid resources were created.

## 1. Preserve the words you already have

On your existing Nabu site, open Settings & data and export a full JSON backup.
Keep the old site and its browser data. A different domain has separate browser
storage: it cannot automatically read words from the old GitHub Pages address.

This release upgrades an existing backend SQLite schema additively from v1 to
v2; accounts and exchanges are retained. Back up the database before upgrading.
Do not downgrade a migrated database using old server code.

## 2. Deploy the full app on Render

Put the **contents of the nabu-mvp folder** from the ZIP at the root of a GitHub
repository or deployment branch. `render.yaml`, `server.py`, `social.py`,
`requirements.txt` and `public/` must be together at that root. Do not upload the
ZIP itself, secrets, `.env`, user databases or private backups.

In your Render account, choose **New > Blueprint**, connect that repository,
select its branch and review the resources before deploying. The blueprint
requests one paid Starter Python web service and a 1 GB persistent disk.
It saves SQLite under `/var/data/nabu.sqlite3`. Render's Free web service cannot
attach this persistent disk; do not switch this configuration to Free and expect
accounts to survive restarts. Current pricing is shown in your Render dashboard.

`NABU_OPEN_SIGNUP=true` enables public signup. For an invitation-only beta, set it
to `false` and add a private `NABU_INVITE_CODE`. The backend normally uses the
platform's `RENDER_EXTERNAL_URL` for its same-origin checks. For a custom domain,
set `NABU_ORIGIN` to that exact HTTPS origin, with no trailing path.

Use the deployed app's URL, not the old GitHub Pages URL, for account features.
Keep this a single instance. The supplied backend uses SQLite, not Postgres.

## 3. Start using it

Open Friends and create a handle/password. Account words save to the server.
On another browser, sign in with the same credentials to load them.

To bring words from an old domain, sign in and import your exported JSON backup
in Settings & data. To bring guest words from this same domain, choose
**Import this device's words** in Friends. Existing duplicates are skipped.
Schedules and notes are preserved; old guest review-event logs are not uploaded.
New reviews after import are recorded on the account.

Add a friend's exact handle, then have them accept the request. Send a word from
the friend row. In Shared libraries, select Share collection, a collection and
one or more friends. A recipient opens the snapshot and adds its words to their
own library. Later changes require the owner to publish an updated snapshot.
Revocation stops future access, not access to independent copies already saved.

The word bank now has 300 word concepts, 30 common phrases in all 12 languages
and 12 original idioms (one per language) with meaningful and literal renderings.
Everyday phrase glosses are specifically labeled English. All content is draft.

## 4. Optional translation and voice

Built-in lookup works without provider keys. For other text, add `DEEPL_API_KEY`
to Render's private environment settings. For cloud speech, add
`ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID`; verify the configured model is
available to your account. Keep keys out of Git and browser JavaScript.
The existing app disclosures and usage limits still apply.

## 5. Check the deployed app before inviting everyone

Use two separate browsers: create two accounts, translate a word, add a friend,
accept the request, send and accept a word, share a collection, then revoke it.
Confirm notes and review history did not travel in the share. Sign out and verify
that one user's words are not visible to another account.

Sign in from a second device, review a card and reload the first device. Restart
the Render service and confirm both accounts and their data remain. Disable the
network during a save: it must show Not saved rather than pretend to sync.
Test the HTTPS cookie, expiry/re-login, real browser IndexedDB and the service
worker/offline guest behavior on your actual domain. These native-browser and
hosted checks were not possible in this execution environment.

There is no email/password recovery workflow in this release. Keep credentials
in a password manager and operate this as a pilot until recovery and operations
are ready. The account library needs a network connection; guest use is separate.

## Database backup

From a server shell, choose a fresh filename:

```bash
python tools/backup_database.py --db /var/data/nabu.sqlite3 --out /var/data/backups/nabu-2026-11-04.sqlite3
```

The command uses SQLite's backup API, checks integrity and refuses to overwrite
an existing backup. Copy the result to private off-host storage. Keeping a backup
on the same disk alone is not disaster recovery. Restore with the app stopped,
and test restoration on a separate instance before production use.

## Local alternative

```bash
cp .env.example .env
docker compose up --build -d
```

Open `http://localhost:8000`. Provider credentials may remain blank. Native-Python
instructions and all test commands are in README.md. Docker itself was not built
in this environment; deployment configuration is supplied, not live-verified.

Official references checked 2026-11-04:
https://render.com/docs/blueprint-spec
https://render.com/docs/disks
https://render.com/docs/free
