# Nabu 1.13.0 - structure under uncertainty

- Added a bounded Structure lens implementing interventional constituency evidence for authored ambiguity cases.
- Two plausible analyses stay visible while movement, substitution and coordination update relative support.
- Active diagnostic selection recommends the highest-information unused test.
- Inconclusive diagnostics are first-class outcomes.
- Syntax evidence is sentence-level only and never changes learner cards, review schedules or mastery.
- Added English, Spanish and Arabic PP-attachment pilot cases plus focused unit/browser verification.
- Preserved the 1.12.2 universal word/phrase reader and honest fallback behavior.

See `STRUCTURE_LENS_1.13.md` and `RUN_NABU_1.13.md`.

---

# Nabu 1.12.1 - Explore, understand, return

Historical 1.12.1 release notes follow; it was built from the supplied 1.11 application and began at `/explore`.
Content patch 1.12.1 replaces one AI-written poetry item with a sourced opening excerpt from Imru’ al-Qais (قِفَا نَبْكِ), while keeping the collection at six items. See `IMRU_1.12.1_REPORT.md`.
Read **RUN_NABU_1.12.md** for safe upgrade/run instructions, **MVP_1.12_REPORT.md** for current evidence and limits, **CONTENT_AUTHORING.md** for the six-piece catalogue and authoring, and **MVP_1.12_CONTROLS.md** for the new-flow control inventory.

Current architecture remains vanilla JavaScript/CSS with the existing Python bundle builder, FastAPI/Pydantic/SQLite and IndexedDB/account sync. No new runtime packages or provider keys. Source catalogue: `data/explore.json`; progress uses the existing meta store plus an additive private `content_events` table. Existing library data and schedules are preserved. Guest and account progress never silently mix. Native-device acceptance and independent Arabic editorial review remain open.

Windows: `py -3 start_local.py` or `Start-Nabu.cmd`. macOS/Linux: `bash start-local.sh`. Keep the server open; use `http://127.0.0.1:8000/explore` in the same browser/profile/origin. No deployment occurred.

The material below is retained historical documentation; earlier versions/test counts are not current verification. New release details above supersede older status/version statements.

---

# 1.11.0 - content-first interface and meaning tools

See REDESIGN_REPORT.md for the full implementation and test boundaries. New
reading workspace, explicit reader/word-bank saving, mobile word sheet,
context preservation, multilingual direction fixes, accessible contrast and
responsive styling. Backend schema, existing providers and data are retained.

- Five licensed, locally bundled, sense-specific illustrations; metadata manifest,
  source hashes, descriptive alt text, remove/replace/private feedback and retry.
- No external image service configured. Adapter contract has explicit consent,
  single-flight/cache/error handling; generation is not represented as ready.
- Explicit Russian, Arabic, Hangul and kana reading schemes; original Latin text;
  no guessed Chinese or Japanese kanji readings. Saved corrections/hidden state
  persist; the app and extension share the same source implementation.
- Added optional validated `imageDismissed` JSON metadata; no SQLite migration.
- Fixed responsive nested-modal stacking and truthful pending/newer-edit status.
- See MEANING_TOOLS.md for the exact scope and REDESIGN_REPORT.md for evidence.

# 1.10.0 - careful media integration

Based directly on the supplied `nabu-local-1.9.0.zip`, preserving the current
application, SQLite library, account isolation, synchronization and reviews.

- Added a working context/notes/reading-aid/clip-art dialog to the real `/words`
  interface and saved words, with draft preservation and explicit save states.
- Added device-voice selection checks, replay/stop/close, visible failure states
  and controls reachable while a modal is open. Existing cloud speech remains
  opt-in; saved preferences are preserved.
- Added explicit, bounded recording and optional local faster-whisper
  transcription, with an editable draft and no automatic audio upload/save.
- Added four unmodified, attributed OpenMoji images. No paid image generation
  or broad stock-search service is bundled.
- Added bounded language-specific transliteration and editable readings. No
  guessed Japanese kanji readings, missing Arabic vowels or mastery claims.
- Added an unpacked Chrome extension with user-triggered capture, source notes,
  manual/bank/provider-consented translation, recording, and same-database save.
- Added owner-bound, revocable extension credentials and idempotent private
  encounter records. Recovery revokes extension tokens. No destructive schema
  migration, passive browsing collection or global dictionary writes.
- Native microphone/voice behavior, actual ASR inference, and installed-extension
  permissions remain local acceptance gates; do not infer those from fixtures.

See MEDIA_SETUP.md and MEDIA_VERIFICATION.md for precise scope and evidence.

---

# 1.9.0 - local-ready package

Based on the latest attached Nabu 1.8 source, not an older Pages snapshot.

- One local launch path starts both the website and Python account server, with a persistent local SQLite database.
- Windows, macOS and Linux launchers; private local configuration; pinned dependencies; no Node/build requirement for normal testing.
- Persistent account-private translation memory and usage UI; context/model/variant-aware request keys; bounded cache; no private-to-public reuse; deletion and in-flight clearing protections.
- Fixed inherited Settings/feature-tree crash and false saved status in the initial graph.
- Fixed the displayed graph's pronunciation target.
- Fixed a reader paste/background-render race: passive sync refreshes keep input nodes and drafts intact.
- Stopped incomplete concatenations from auto-saving; complete assemblies remain Reference drafts.
- Preserved Nabu's ziggurat, colors, bank, 2D-first/optional-3D graph, accounts, sync, reading, reviews, friends, collaborative collections and mobile integration source.
- Current handoff, feature-status table, local acceptance checklist and test evidence.

The language-analysis automation roadmap and experimental schedulers have not been represented as finished features. See FEATURE_STATUS.md.
