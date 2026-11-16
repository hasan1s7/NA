# Nabu: translate, remember, connect

Release 1.3.0 / `nabu-social-phrases-20261104-r1`.

A working account-backed upgrade of the supplied word-graph app. No public server
has been provisioned by this package. Read **START_HERE.md** for deployment.

## What is implemented

Translate between all 132 ordered pairs of 12 supported languages using the
built-in graph. Results automatically enter your library and review queue after
you translate or choose a sense. Repeat lookups keep your edits and review state.
The graph contains 300 word meanings, 30 everyday phrases and 12 source-language
expressions. Natural meanings and literal wording are shown separately.

Create a handle and password from **Friends** or the account button. Signed-in
cards, private notes, review schedules and account review events are stored in
the server database. A second signed-in session loads the same library. Writes
are saved immediately; another open session refreshes on focus or with Refresh
library. This is not a realtime collaborative editor.

Send friend requests by exact handle, accept or decline, remove friends, block
senders, send individual words, and accept received words with one click. Share a
collection with selected accepted friends. Recipients can preview and import it;
imports skip duplicates and start fresh review schedules. A collection is a
read-only snapshot. Its owner can publish an updated version or revoke access.
Revocation does not erase copies someone has already saved.

Guest use stays available. Guest words live on that browser, separately from all
accounts. Signing in never silently uploads them. **Import this device's words**
is an explicit action; it preserves schedules and notes but does not copy old
local review-event logs. Those remain in the local library and its backup.

## Run locally with the full backend

```bash
cp .env.example .env
docker compose up --build -d
```

Open `http://localhost:8000` exactly. The example configuration enables signup and
a persistent Docker volume. No translation or speech key is necessary for the
built-in word and phrase bank. Docker was not available for build verification
in this environment; the Python backend and application code were tested directly.

Without Docker, use Python 3.13 and a virtual environment:

```bash
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
NABU_ORIGIN=http://localhost:8000 NABU_DB=.data/nabu.sqlite3 NABU_OPEN_SIGNUP=true python server.py
```

The Python server does not automatically load `.env`; export settings or use the
Docker Compose path. Keep frontend and API on the same origin. The static-only
`npm run serve` preview does not provide accounts, friends or cloud storage.

## Hosting

The included `render.yaml` defines one paid Python web service and a persistent
1 GB disk. SQLite is written to `/var/data/nabu.sqlite3`. The server uses the
platform's `RENDER_EXTERNAL_URL` unless you set `NABU_ORIGIN`. Review current
pricing before creating resources. No hosting has been purchased or deployed.

Use one server instance. This is a small-pilot SQLite deployment, not managed
Postgres and not horizontally scalable. Do not put the database on an ephemeral
filesystem. Create consistent backups with `tools/backup_database.py` and keep
an encrypted off-host copy. Test restoration before depending on it.

## Data protection and limits

Accounts use password hashing, session cookies, CSRF protection, account-scoped
queries, write revisions, rate limits, block checks and request-size limits.
The UI sends an expected account ID, so a cookie change in another tab cannot
silently write into the wrong account. Notes and review histories are excluded
from word and collection shares; card context is included and should be reviewed
before sharing. Account deletion removes the user's server-owned data and shares.
Copies previously accepted by others are independent.

Cloud libraries require a network connection. Failed writes remain visibly
unsaved; they do not fall back into another account or the guest library.
There is no queued offline cloud synchronization. Settings remain device-local.
There is no email verification or self-service password reset in this release.
Use a password manager and keep backups. These are beta limitations, not hidden
features. Do not treat the built-in safeguards as an independent security audit.

Operational caps: 5,000 account cards; 50 cards per import request (automatically
batched); 300 cards per shared snapshot; 30 recipient friends per snapshot. Rate
limits can be shared by users behind the same reverse-proxy IP; tune carefully
before a large public signup campaign. Use an invite code for a controlled beta.

## Language coverage

English, Spanish, French, Arabic, simplified Chinese, Russian, German, Italian,
Japanese, Korean, Portuguese and Turkish. The graph has 342 concepts, 4,104
language forms and 45,144 directed concept translation links. Concept identity
is not a claim that all usages of a word are interchangeable.

For each of the 12 original idioms, there is a natural meaning and a separate
literal rendering into the other languages. The 30 everyday phrases include
literal word-order glosses in **English**, labeled as such. Those glosses are not
presented as literal translations into every target language. See WORDGRAPH.md.
The vocabulary is an authored draft, not a native-reviewed dictionary.

Optional DeepL and ElevenLabs integrations are preserved. Put keys and voice IDs
only in server environment settings. No live provider calls were made for this
release. Provider availability, commercial rights and voice quality require your
own configured account and auditioning; no natural-sounding voice is guaranteed.

## Build and test

```bash
pip install -r requirements-dev.txt
npm run build
npm test
python -m pytest -q
npm run test:ui
```

Node 20+ is needed for JavaScript tests; there are no npm dependencies. UI scripts
use `/usr/bin/chromium`. They use explicit storage/URL/transport fixtures because
this runtime blocks native navigation. The API and SQLite implementation are real.
See TEST_REPORT.md for exact checks and limitations. Historical scripts under
`tests/legacy` and reports under `docs/history` are not evidence for this release.

The hosted guest smoke suite is included for a normal browser environment:

```bash
python tests/browser_smoke.py --url http://localhost:8000/
```

Complete the two-account deployment checklist in START_HERE.md as well.

## Main files

`server.py`: same-origin app server and existing account/translation routes.
`social.py`: cloud library, scheduling, friendship and sharing routes/schema.
`public/nabu-account-store.js`: explicit local/account storage adapter.
`public/nabu-app.js`: application UI.
`data/phrasebank-source.json`: editable phrase and expression bank.
`tools/build_graph.py`: validated graph build.
`tools/build_standalone.py`: self-contained app build with CSP hashes.
`render.yaml`: deployment definition. `.env.example`: local configuration.

Official deployment references (checked 2026-11-04):
https://render.com/docs/blueprint-spec
https://render.com/docs/disks
https://render.com/docs/free
https://render.com/docs/environment-variables
