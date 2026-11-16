# Start Nabu 1.17

Extract the whole archive first. Do not run a launcher from inside a ZIP viewer.

| Platform | Launch from the extracted Nabu-1.17 folder |
| --- | --- |
| Windows | Double-click `Start-Nabu.cmd`, or run `py -3 start_local.py` |
| macOS | Open `Start-Nabu.command`, or run `bash start-local.sh` |
| Linux | Run `bash start-local.sh` |

Requires Python 3.11+. First setup downloads the unchanged pinned Python dependencies. No npm installation is required for normal use. Open **http://127.0.0.1:8000/explore**. Leave the terminal open; Ctrl+C stops the server.

`python3 start_local.py --no-browser` suppresses browser opening. `python3 start_local.py --port 8001` uses another local port. On Windows substitute `py -3` for `python3`.

## Upgrade without losing your work

1. Stop the old Nabu process. Make a backup of the existing application folder and use Settings → Library backup for guest or unsynced browser words.
2. Extract 1.17 separately. Copy your existing **`.data` directory and `.env.local` file** into the new Nabu-1.17 folder. Do not replace these with files from another account or machine. If `NABU_DB` points elsewhere, preserve that configuration and database location instead.
3. Start 1.17 using the same port and exact browser origin as before, in the same browser/profile. `localhost` and `127.0.0.1` are different browser storage origins.
4. Your saved cards, corrections, notes and review history remain in the existing stores. Startup adds institutional tables without rewriting the existing records. Reopen your usual route or choose Resume your text after saving a reading session in 1.17.

The launchers never overwrite `.env.local`. If an older cached page persists, use the existing **Repair app loading** page (`http://127.0.0.1:8000/nabu-repair.html`); do not clear site data.

## Use the 1.17 backend workflow

1. Open **Settings & data**. Sign in or create an account with the existing account controls.
2. Choose **Open workspaces**. An owner creates a workspace and adds existing account handles under **Members & policy**. Use another browser profile to act as a different account; do not switch cookies while a response is being submitted.
3. Under **Sources & tasks**, save a source with attribution and rights, then create an exact-match recall task or a multiple-choice task. Keep source visibility honest; it is recorded as assistance.
4. Choose **Assign a task**. Select the learner, named reviewers, objective and reporting scope. Being an owner does not automatically grant access to answers.
5. The learner opens the offered assignment and accepts or declines its reporting terms. After submitting, the original answer and versioned results remain visible.
6. To fix an answer key, the owner publishes a corrected rubric in **Sources & tasks**. A named reviewer with response access opens the record and chooses **Reassess with a published rubric**. The initial result remains in the history. **Replay stored assessments** checks every recorded assessment against its exact rubric.
7. Offline pending answers require an owner-enabled policy and a learner-checked local-storage option. **Pending answers** provides retry, export and confirmed discard. A rejected or unacknowledged upload stays pending. This is unencrypted browser storage; use it only on an appropriate device.

The owner can remove a member; members can leave. Existing assignments and reviewer grants are revoked, and rejoining does not restore them. Previously downloaded copies cannot be remotely erased. Owners cannot leave or transfer ownership in this release.

## Optional departmental support summary (overnight r2)

After accepting an assignment, each learner may independently open **Reporting choice**, read the terms, and enable reporting. The default is off; accepting an assignment does not enable it. A learner may withdraw from future summaries without leaving the workspace or changing existing reviewer access.

Owners open **Department support**. At least five current opted-in learners with accepted assignments are required. Eligible counts and released categories are five-wide bands; small cells/complements are suppressed. No raw answers or learner identifiers are in this summary. Suppression is not anonymity: repeated reports, roster knowledge, manufactured accounts and the owner-visible consent audit can reveal participation. The categories describe task evidence, not mastery.

Use `python tools/demo_department_support.py` for a disposable fictional five-learner HTTP demonstration. It launches and stops its own temporary server/database; no provider calls or real user data.

Before campus onboarding, test registration capacity: the unchanged guard allows five registrations per IP per hour. Plan legitimate account setup in advance or design and review an invitation/provisioning workflow before a simultaneous class session. This release does not implement bulk enrollment, SSO or account invitations.

## First minute

Bring your own text → choose learning and meaning languages → paste a passage → Start reading → select a word → Save word → Return to reading.

Use **In depth** only when you want more evidence. The original sentence stays visible; generated/bank examples are labeled separately. Nabu can be quiet or hidden in Settings. Council dialogue honestly reports its missing conversational AI dependency. Reading, saving and available pronunciation continue to work.

For a local audio/video file, expand **Audio or video · optional** above your text. Its contents are not uploaded. After refresh, reselect the same file to restore its saved time.

See `docs/INSTITUTION_BACKEND_1.17.md`, `docs/RELEASE_NOTES_1.17.md` and `docs/VERIFICATION_1.17.md` for scope and testing. Linux launcher/HTTP behavior was exercised. Windows and macOS native launching, physical phones and audible speech were not verified in this environment.
