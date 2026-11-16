> 1.7.1 Pages packaging repair: see HANDOFF.md and TEST_REPORT.md. Older instructions below remain for the full-stack/native application.

# Nabu 1.6.0 - start here

Build `nabu-mobile-links-20261105-r1`. This archive contains the **full backend,
website, native integration source, asset generator and tests**. It does not
contain a live database, credentials, a compiled mobile app or a deployed service.

## Which update to use

**GitHub Pages only:** use the separate `nabu-pages-update.zip`, uploading its
contents to the directory containing the published index.html. It adds meaningful
hash navigation, ziggurat icons, the repaired manifest and mobile layout. Existing
local learning and long self-contained shares work. It CANNOT provide accounts,
server sync, or new server-backed short links. Do not clear browser storage.

**Accounts and short links:** deploy this full source and use the same HTTPS
address for the web app and API. The existing API intentionally does not enable
arbitrary cross-origin credentialed access from GitHub Pages.

**iOS and Android:** follow `MOBILE_HANDOFF.md`. The app now packages local assets
and addresses one explicitly configured HTTPS API origin rather than loading a
remote homepage. Native compilation, signing and actual-device testing remain.

The bank remains 900 word senses, 90 phrases and 36 expressions in twelve
languages. Its authored text remains draft content. The logo is the geometric
ziggurat already in the latest source, now included in generated app icon sizes.

## Preserve the existing app first

Export a full JSON library backup in Settings & data. Keep the old site and its
browser storage. If you already host the backend, take a consistent SQLite backup
before upgrading. Schema v1/v2/v3 upgrades additively to v4; the browser database name
and version are unchanged. Existing review schedules are preserved.

A new domain cannot read the old domain's browser data. Sign into the new site and
import your JSON backup explicitly. Same-domain guest words can be copied with
**Friends > Import this device's words**. Imported notes and schedules survive;
old guest review-event logs stay in the original library/backup. New account
reviews are recorded normally. Signing in never silently uploads guest data.

## Put the full source on the server

Place the **contents of `nabu-mvp`** at the deployment repository root. Keep these
together:

```text
render.yaml
requirements.txt
server.py
social.py
upgrades.py
backup_service.py
language_services.py
word_links.py
public/
tools/
```

Do not upload the ZIP itself, `.env`, database files, recovery codes, private
backups or pending-change exports. There is no need to delete your existing
persistent database or volume.

The included Render Blueprint uses one paid Python web service with a persistent
1 GB disk at `/var/data` and SQLite at `/var/data/nabu.sqlite3`. In Render choose
**New > Blueprint**, select the repository/branch, inspect the charges and
configuration, then deploy. The Render connection was not enabled here, so this
step was not performed. Use one server instance, not multiple replicas.

Use the deployed server URL for the whole app. For a custom domain, set
`NABU_ORIGIN` to its exact HTTPS origin. To restrict registration, set
`NABU_OPEN_SIGNUP=false` and supply a private `NABU_INVITE_CODE`.

Local alternative:

```bash
cp .env.example .env
docker compose up --build -d
```

Open `http://localhost:8000`. Compose loads `.env`; native Python expects exported
environment variables. Docker itself was unavailable for a build test here.

## Use the new flow

Create an account in Friends and **save the displayed recovery code privately**.
Existing accounts should choose **Recovery code** while signed in to generate one.
The Forgot password form accepts the handle, that code and a new password. Using
it invalidates other sessions and returns a replacement code. No email setup is
required; there is no email-reset fallback.

Translate to save automatically as Reference. Press **Learn this** to put a card
into review. **Review** starts a five-minute session; choose meaning, production,
listening, sentence completion or mixed practice. The app records each skill
separately. References do not become involuntary homework.

Open **Translate > Read a text**, paste a paragraph and tap a word. The selected
word and surrounding sentence are saved. The rest of the pasted document stays
in that tab. Provider lookups remain explicit.

Add a friend's handle and have them accept. Share a collection, open it, then use
**Contributor permissions** to grant access. Contributors propose words or
corrections; the owner approves them. Approval changes the shared version, not
private copies. **Import new words** skips existing identities rather than
silently rewriting private notes or learning progress.

## Understand sync before switching devices

Open the account online once to initialize its device cache. Pending writes are
stored separately for that account. The header opens a Sync panel with status,
retry, backup/export and conflict recovery. Automatic retries happen while Nabu
is open, not after the app closes.

Wait for **Synced** before expecting another device to see your newest changes.
Offline changes remain **Saved on this device / pending**. A conflict requires an
explicit choice; export first. Choosing the server version discards the entire
pending queue on this device, not just the first operation. Retrying a pending
review records it at the retry time. A local resolution audit is retained.

Sign-out is blocked while changes remain pending; reconnect or resolve them first.
Once signed out, that account's device cache is removed. Guest cards remain.
Never use Clear site data to repair an app with unsynced work.

## Translation and voice

The built-in vocabulary needs no paid API. Other text and on-demand literal-guide
localization use a privately configured `DEEPL_API_KEY`. Cloud audio requires
`ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID` and an available model. Do not put keys
in Git or browser JavaScript. Test your actual provider account and chosen voices
before inviting users. No live paid requests were made during this build.

Literal guides are approximate wording explanations. Original-idiom literal
renderings are built in for target languages. Other phrase guides use DeepL to
localize an authored English gloss on demand. The examples and language material
remain unverified drafts, not a certified multilingual dictionary.

## Enable actual off-server backups

The Blueprint enables local six-hour snapshots. **Those alone are not disaster
recovery.** To upload encrypted snapshots, configure an existing private
S3-compatible bucket and private environment values:

```dotenv
NABU_BACKUP_ENABLED=true
NABU_BACKUP_BUCKET=YOUR_PRIVATE_BUCKET
NABU_BACKUP_KEY=YOUR_PRIVATE_FERNET_KEY
AWS_ACCESS_KEY_ID=YOUR_ACCESS_KEY
AWS_SECRET_ACCESS_KEY=YOUR_SECRET
AWS_DEFAULT_REGION=YOUR_REGION
# Non-AWS S3-compatible storage only:
NABU_BACKUP_ENDPOINT=https://YOUR_STORAGE_ENDPOINT
```

Generate the key once in a private terminal and keep a separate secure copy:

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Limit bucket permissions to the required prefix and prohibit public access.
Configure a bucket lifecycle/retention rule separately. The app never uploads a
plaintext snapshot. Losing the encryption key makes those backups unrecoverable.
The current encrypted-snapshot helper is capped at 64 MB.

Check status from a server shell or monitoring agent:

```bash
python tools/backup_status.py --directory /var/data/backups --require-offsite
```

A zero exit code requires a recent confirmed offsite upload; local-only or stale
status fails. Configure an alert on nonzero results. No external monitoring
service or alert delivery was configured here. Logs report failures without
printing user content or credentials. Inspect disk usage; repeated failed uploads
retain local snapshots until an operator resolves the failure.

## Restore safely

Stop the app and keep the current database untouched. Download a private backup
and restore into a **new** path:

```bash
# Set NABU_BACKUP_KEY privately first for an encrypted backup.
python tools/restore_database.py --backup nabu-snapshot.sqlite3.fernet --encrypted --out /var/data/nabu-restored.sqlite3
```

For a plain local snapshot omit `--encrypted`. The command checks integrity and
foreign keys, refuses an existing destination, revokes all restored sessions and disables all restored public word links. Create fresh links after recovery; this prevents old backups from reviving links revoked after the snapshot.
Test the restored database on an isolated instance. Only after verification,
point `NABU_DB` at that new file and restart. Keep old files for recovery; never
copy an actively written SQLite file by itself. Restoring recovers data as of the
snapshot, not changes made later. Account credentials/codes are also historical;
communicate the restore and rotate credentials as appropriate.

## Hosted acceptance gate

Use two real browsers/devices before opening a public beta. Register, save the
recovery code, translate, promote to Learning, review, then confirm another device
sees the confirmed data. Drop the network while editing and reviewing, reload
offline after service-worker installation, reconnect and check no duplicates.
Create a conflicting edit from the other device and exercise explicit resolution.

Test account recovery, expired sessions, sign-out isolation, friends, direct words,
contributor permissions, proposals, approvals and revocation. Restart the server
and verify persistence. Test an encrypted backup restoration. Check native
notifications, actual DeepL calls and real pronunciation on your target devices.

The supplied automated fixture checks passed; they are not native browser or mobile-device acceptance tests. HTTPS cookies, actual IndexedDB durability, service-worker
reloads, Docker, real offsite storage and the hosted service remain deployment
checks, not claims made by this package.

Official implementation references (checked November 5, 2026):
https://render.com/docs/disks
https://sqlite.org/backup.html
https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html
https://cryptography.io/en/latest/fernet/

## Verify actual offsite restoration

Use the release handoff (`HANDOFF.md`) and current `TEST_REPORT.md` rather than archived release counts. After configuring private offsite S3 credentials and a successful backup, run on a trusted operator/staging host:

```bash
python tools/verify_offsite_backup.py --directory /var/data/backups
python tools/backup_status.py --directory /var/data/backups --require-offsite --require-restore-drill
```

The drill downloads and decrypts the encrypted object into a new temporary SQLite path, checks database integrity, foreign keys and invalidated sessions, then deletes the temporary copy. It **does not** swap or overwrite the production database. A successful fake-S3 test is not proof that your actual bucket works: perform the real drill before claiming disaster recovery. Save/monitor the separate operator-only `restore-drill.json` receipt. Never give recovery or encryption secrets to a browser.
