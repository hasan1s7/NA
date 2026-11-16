# Nabu: DeepL translation + ElevenLabs pronunciation

Release: `nabu-language-20261104-r1` | Prepared November 4, 2026

**This is implemented source, not an activated or deployed service.** Supply your own provider credentials, deploy the server, and run a live translation/listening check. Do not paste API keys into chat, browser code, or a GitHub commit.

## What changes

The repaired, self-contained frontend now connects to two authenticated server endpoints:

```text
Nabu browser -> same-origin /api/translate -> DeepL
Nabu browser -> same-origin /api/speech    -> ElevenLabs -> MP3 player
```

The original save/review/exchange loop is retained. Translation accepts a surrounding sentence and a formality preference. Pronunciation works from the translator, saved cards, and review cards, with normal and 0.85x playback, replay caching, and an explicit first-use disclosure. Cloud failures do not silently switch to a different provider or a device voice.

The existing startup guard, storage timeouts, repair page, and cache-refresh behavior are retained. The IndexedDB name and version are unchanged. The visible service status means **configured**, not that a provider has already accepted the key.

## 1. Get a DeepL API key

Create an **API account**, not just a subscription to the DeepL web translator. In your DeepL account, open **Account -> API Keys & Limits -> Create key**, name it `nabu`, and copy it privately. Set a provider-side usage limit. [1, 2]

As documented on November 4, 2026, **API Developer** has a free allowance of **1,000,000 characters total, which does not reset**. API Growth is the upgrade path. The legacy API Free and API Pro plans are no longer available for new purchases; do not plan around an assumed new 500,000-character monthly free account. [1]

Use the actual key as `DEEPL_API_KEY` in your private environment. The adapter selects the legacy free endpoint for keys ending in `:fx`, and the standard endpoint otherwise. It supports explicit English and Portuguese regional targets and simplified Chinese. [3]

Context goes in DeepL's `context` parameter, rather than being appended to the text being translated. DeepL documents that context is not translated and is not included in billed characters. Nabu does not send private card notes. [4]

## 2. Get an ElevenLabs key and choose a voice

Create an ElevenLabs API key with permission to generate text-to-speech. For the included readiness checker, also permit reading models and voices. Set a provider-side credit quota. Keys must remain server-side. [5]

Audition voices with real Nabu words and sentences. Save an appropriate voice to **My Voices**, then open its **three-dot menu -> Copy voice ID**. Use that ID as `ELEVENLABS_VOICE_ID`; a voice name or profile URL will not work. [6]

The configured default model is `eleven_v4`, currently documented by ElevenLabs as its highest-quality standard TTS model. Access and suitability still need checking with your account. Other explicitly implemented choices are `eleven_v3`, `eleven_multilingual_v2`, and `eleven_flash_v2_5`. Nabu does not switch models silently. [7, 8]

For commercial Nabu use, select a plan and voice with appropriate commercial rights. ElevenLabs documents commercial rights for paid-plan generations; free-plan output is non-commercial with attribution. Check the terms applicable to your chosen voice and plan. [9]

### Start with one voice, then validate by language

One default voice is enough to activate the first test. To select different voices for different languages, configure this optional JSON mapping with real voice IDs:

```dotenv
ELEVENLABS_VOICES_JSON='{"en":"EN_VOICE_ID","fr":"FR_VOICE_ID","ar":"AR_VOICE_ID","zh-CN":"ZH_VOICE_ID","ru":"RU_VOICE_ID","es":"ES_VOICE_ID"}'
```

Those uppercase values are placeholders, not usable voices. Supported Nabu keys are `en`, `ar`, `zh-CN`, `fr`, `ru`, `es`, `de`, `it`, `ja`, `ko`, `pt`, and `tr`. A language-specific ID overrides the default. Leave the default ID empty to enable only explicitly mapped languages.

Naturalness is an acceptance criterion, not a promise. Before enabling a language for beta users, have a competent speaker listen to short words, full sentences, questions, numbers, ambiguous spellings, and proper names. Check Arabic with and without vowel marks, Chinese tones, and the regional varieties your learners need. Prefer accurate, neutral pronunciation over theatrical delivery. The code does not train or fine-tune a speech model.

The slower option changes **playback rate** to 0.85x while preserving pitch where supported. It reuses the same recording; it is not a second paid synthesis. V4's legacy Style/Speed synthesis sliders are not supported, so this adapter does not send them. [8]

## 3. Run locally with Docker Compose

Extract the ZIP, open a terminal in the folder containing `compose.yaml`, and run:

```bash
cp .env.example .env
```

On Windows, copying `.env.example` to `.env` in your file manager is also sufficient. Edit `.env` privately. The minimum provider settings are:

```dotenv
DEEPL_API_KEY=your_actual_deepl_key
ELEVENLABS_API_KEY=your_actual_elevenlabs_key
ELEVENLABS_VOICE_ID=your_actual_voice_id
ELEVENLABS_MODEL_ID=eleven_v4
```

Keep these local settings from the template:

```dotenv
NABU_ORIGIN=http://localhost:8000
NABU_HOST=0.0.0.0
PORT=8000
NABU_DB=/data/nabu.sqlite3
```

Then run:

```bash
docker compose up --build -d
docker compose logs --tail=80 nabu
```

Open **`http://localhost:8000`**, using that exact host. `127.0.0.1` is a different origin from `localhost`; do not mix them. The compose file binds only to the local machine and stores the server database in the `nabu-data` volume. Do not use `docker compose down -v` unless you deliberately intend to delete that volume.

Create a handle from **Exchange** and sign in. Cloud translation and speech require an account so the paid API is not an anonymous public proxy. In **Settings**, choose **DeepL** and **ElevenLabs**. Existing users who previously selected MyMemory keep that preference until they switch it. Enter a phrase, translate it, and press its speaker button. Approve the first-use speech disclosure.

Docker Compose loads `.env`; `python server.py` by itself does not. For a direct Python launch, install `requirements.txt`, export variables in the launching shell, use a writable `NABU_DB` path, and then run `python server.py`. Docker was not available in the authoring environment, so the Docker build itself is not a completed test.

## 4. Put the full app online

**Uploading `public/index.html` to GitHub Pages does not activate these APIs.** DeepL explicitly disallows direct browser API calls, and neither provider's key belongs in frontend code. This release expects the website and API on the **same origin**, served by the included Python backend. It does not include cross-origin cookie/CORS integration with a separate Pages frontend. [3, 5]

A straightforward hosted route is a Render **Web Service**, using its native Python runtime. This is an optional deployment route, not an already-created service. Render supports Python/FastAPI web services, environment secrets, health checks, and persistent disks. Persistent disks require a paid service. [10, 11]

1. Put this source in a repository and create a Render Web Service from it. Set the root directory to the folder containing `server.py` and `requirements.txt` (`nabu-mvp` when the ZIP's enclosing folder is retained).
2. Choose Python, build with `pip install -r requirements.txt`, and start with `python server.py`. Configure the health-check path as `/api/health`.
3. Set `NABU_HOST=0.0.0.0`. Let the platform provide `PORT`. Set `NABU_ORIGIN` to the exact assigned HTTPS origin, for example `https://your-nabu-service.onrender.com`, without a path or trailing slash. Update it when changing to a custom domain.
4. Add both provider keys and the voice ID as private environment variables. Set `NABU_INVITE_CODE` to a long random value and share it only with your beta group. Public startup deliberately refuses a missing invitation code.
5. Attach a persistent disk at `/var/data` and set `NABU_DB=/var/data/nabu.sqlite3`. Verify that the runtime user can write there. Without a persistent disk, server accounts, exchange records, and usage counters can disappear on a restart or redeploy. [11]
6. Deploy a **single instance**, then create a beta account, translate, play audio, and verify that the account survives a restart. Do not horizontally scale this SQLite/process-cache design without redesigning shared storage and coordination.

The supplied Dockerfile is an alternative deployment method. Its process runs as UID 10001; an externally mounted disk must be writable by that UID. The native-Python instructions above avoid requiring a custom disk-permission entrypoint.

Provider credentials must be available at **runtime**, not baked into an image. No account signup, paid hosting purchase, secret configuration, repository push, or deployment was performed for you.

### Preserve your current words

Before changing from the existing GitHub Pages URL to a new host, use **Settings -> Full backup** on the old site. Open the new site and use **Import words** to restore the backup. Browser libraries do not automatically follow a different site origin. Do not clear site data as part of this move. Sign-in still enables exchange, not cloud synchronization or backup of the local library.

## 5. Verify actual provider access

The included checker defaults to read-only requests. Inside the local container:

```bash
docker compose exec nabu python tools/check_providers.py
```

It checks DeepL account usage, lists ElevenLabs models, and checks access to the selected voice. It never prints credentials or raw upstream error bodies. Read-only success does not certify translation or speech quality.

To explicitly generate **one metered translation and one metered speech sample**:

```bash
docker compose exec nabu python tools/check_providers.py --generate --language en --text "Hello. Welcome to Nabu." --output /tmp/voice-check.mp3
docker compose cp nabu:/tmp/voice-check.mp3 ./voice-check.mp3
```

Listen to that file, then test actual target-language phrases. The checker uses the default voice unless the chosen language has an override. Use the same script on your hosted server with its configured environment. A browser test must still verify authenticated requests and playback from the deployed site.

## 6. Cost, storage, and privacy controls

| Control | Shipped behavior |
|---|---|
| Credentials | Server environment only; no frontend key-entry box |
| API access | Account, same-origin checks, CSRF token, request/character limits |
| Translation limits | 20,000 characters per user and 50,000 globally per 24-hour quota window by default |
| Speech limits | 3,000 characters per user and 10,000 globally per 24-hour quota window by default |
| Translation length | Up to 2,000 characters; optional context up to 1,500 |
| Speech length | Up to 2,000 characters per request |
| Concurrency | Up to two upstream requests at once per process |
| Server translation cache | Private per account, memory-only, bounded to 4 MiB / 2,000 entries; 24-hour reuse TTL |
| Server audio cache | Private per account, memory-only, bounded to 64 MiB / 256 entries; one-hour reuse TTL |
| Browser audio cache | This tab only, 24 recordings / 16 MiB; cleared on sign-out, account change, or explicit clear |
| Local translation history | Continues to persist in browser storage; cleared separately in Settings |
| Paid retries | No automatic retries after provider failure or timeout |

Quota windows begin with their first request; they are not calendar-day billing reports. Cache hits avoid additional upstream generation, but request-rate limits still apply. Quota reservations conservatively count failed attempts, because a timeout can happen after a provider has charged for a request. Provider-side spending controls remain necessary. Process caches reset on a server restart; an evicted/expired recording requires a new generation.

TTL checks prevent reuse after expiration. Expired cache data is removed on later cache operations; this is not a scheduled secure-deletion system. Account deletion removes that account's currently cached entries. Audio is not written to the server database, card exports, or the offline service-worker cache.

Text goes to DeepL when Translate is pressed and to ElevenLabs when cloud Listen is used. Neither this release nor its consent screen promises zero provider retention. ElevenLabs documents its zero-retention request mode as enterprise-only; this code does not claim or enable it. [12]

## 7. Troubleshooting

**DeepL/voice says not configured:** check environment variables on the process actually serving Nabu, then restart it. A static Pages deployment has no Python API. A configured badge does not prove the key is valid.

**Origin/session error:** open the exact configured `NABU_ORIGIN`, sign in again, and reload. Avoid toggling between localhost and 127.0.0.1 or between a default host and a custom domain. Do not fix this by allowing every origin.

**Provider key or permission error:** check account status, endpoint permissions, credit limits, and key validity privately. The readiness script reports sanitized status codes. Never put credentials in screenshots or support messages.

**Model/translation option rejected:** run the readiness check. Select an accessible documented model explicitly. Set `DEEPL_MODEL_TYPE=auto` to omit the optional translation-model preference when your plan rejects it. Redeploy after changing environment variables. There is no automatic downgrade.

**Speech is ready but silent:** press the player's native Play control; the browser may require another user gesture. Check device volume and tab mute state. A speech-language/voice error does not delete the saved card.

**Quota reached:** inspect both provider limits and Nabu's configured character counters. Replays are free of new provider requests only while cached. A different language, text, voice, model, or cleared cache can require new generation.

**Startup/storage error:** use the included `nabu-repair.html` on the same Nabu path. The repair refreshes app files without deleting the library. Do not use Clear site data.

## Source map

| File | Purpose |
|---|---|
| `language_services.py` | Provider contracts, voice/model validation, bounded caches |
| `server.py` | Existing accounts/exchange plus protected translation and speech APIs |
| `public/nabu-speech.js` | Playback, cancellation, Blob cache, pitch-preserving slow mode |
| `public/nabu-app.js` | Translation context/tone, consent, speaker actions, settings |
| `tools/build_standalone.py` | Regenerates the self-contained HTML and exact CSP hashes |
| `tools/check_providers.py` | Read-only readiness check; opt-in metered sample generation |
| `LANGUAGE_SERVICES_TEST_REPORT.md` | Actual tests and explicit limitations |

After frontend source edits, run `python tools/build_standalone.py`. Do not hand-edit the embedded application in `public/index.html`; source edits and CSP hashes must stay synchronized.

## Official references checked November 4, 2026

[1] DeepL API plans: `https://support.deepl.com/hc/en-us/articles/360021200939-DeepL-API-plans`

[2] DeepL key creation: `https://support.deepl.com/hc/en-us/articles/360020695820-API-key-for-DeepL-API`

[3] DeepL browser restrictions and key security: `https://support.deepl.com/hc/en-us/articles/9773914250012-About-DeepL-API`; authentication: `https://developers.deepl.com/docs/getting-started/auth`

[4] DeepL translation parameters: `https://developers.deepl.com/api-reference/translate/request-translation`

[5] ElevenLabs authentication and restrictions: `https://elevenlabs.io/docs/api-reference/authentication`

[6] Finding a voice ID: `https://elevenlabs.io/docs/help-center/technical/how-do-i-find-the-voice-id-of-my-voices-via-the-website-and-api`

[7] ElevenLabs models: `https://elevenlabs.io/docs/overview/models`

[8] Eleven v4 controls and evaluation guidance: `https://elevenlabs.io/docs/overview/capabilities/text-to-speech/eleven-v4`

[9] ElevenLabs commercial-use plan distinction: `https://elevenlabs.io/docs/overview/administration/billing`

[10] Render web-service deployment: `https://render.com/docs/web-services`

[11] Render persistent disks: `https://render.com/docs/disks`

[12] ElevenLabs speech API, output format, language hints, and retention option: `https://elevenlabs.io/docs/api-reference/text-to-speech/convert`
