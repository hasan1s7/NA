# Nabu capture extension 1.10.0

This extension requires the Nabu 1.10.0 server from the accompanying application
package. It is not a separate library or a public Web Store release.

## Install and connect

1. Start the updated Nabu application and sign in.
2. In Chrome, open `chrome://extensions`, enable Developer mode, and choose
   **Load unpacked**. Select this directory (the one with `manifest.json`).
3. Copy the extension ID. In Nabu, open **Settings & data -> Manage extension
   connections**, enter that ID, and create a connection. Copy the token once.
4. Open the extension's **Connection** options, enter your Nabu origin, e.g.
   `http://127.0.0.1:8000` (no `/words` suffix), and paste the token. Press
   **Check connection & save**. HTTPS servers request only their own host access.
5. Highlight text on a normal page, open Nabu's side panel, and capture it.
   Choose source and target languages, select or enter a meaning, review the
   source/context, add a note, and save. Open the same account's Nabu library.

## What is and is not automatic

No browsing-history permission, passive content script, or automatic recording.
Selection access follows your explicit gesture. Password fields and editable
fields are not captured by the selection reader. Captured text is editable.

Tokens are in extension-local storage, never Chrome sync storage. Session-only
unsaved text and private notes are cleared when the connection changes. Save
before quitting Chrome. Closing the panel discards unsaved audio. Disconnect
locally to remove credentials; revoke in Nabu to invalidate them server-side.

Microphone and tab audio are explicit actions. Stop, preview, then transcribe
only when you choose. Transcription requires the optional local speech model
configured on Nabu; missing configuration is explained rather than hidden.
Text is editable before use/save. Source URLs have sensitive query strings
removed, except YouTube video IDs. For other query-based pages, supply an
appropriate canonical source link. Capturing audio does not discover its URL.

Exact dictionary meanings are offered for explicit selection. Unknown text
needs a manual meaning or consent to the existing configured translation
provider. Private notes are not sent to that provider. No word is marked
mastered simply because you captured or listened to it.

## Validation boundary

The panel/options/background contracts and real server persistence were tested
with explicit Chrome API fixtures. An installed extension and native permissions,
real tab/microphone capture, and actual ASR output were not verified here.
Complete the local acceptance checklist in the application MEDIA_SETUP.md.
The minimum declared Chrome version is 116.
