> **1.10.0 update:** Read [MEDIA_SETUP.md](MEDIA_SETUP.md) and [MEDIA_VERIFICATION.md](MEDIA_VERIFICATION.md) for the new context, speech, reading-aid, clip-art and Chrome-extension work. The 1.9.0 descriptions and results below are historical and are not new 1.10.0 verification.

# A local acceptance test

Use dummy material and test accounts. Do not clear existing site storage. Start the app with the launcher and keep using the same origin.

1. **Guest capture.** Translate English `water` to Spanish. Expect `agua`, one Reference card, and no provider setup. Look it up twice; the library should still have one matching card. Reload and check it is still there.
2. **Graphs.** Open Word bank, choose Try Russian idiom. Inspect the four Russian components, five priority translations, All 12 languages, and usage nodes. Toggle 3D and back. Check Settings' feature tree too.
3. **Concatenation.** Concatenate `water book`: expect a draft assembly. Concatenate `water nonsenseunlisted`: expect an unresolved term and NOT an auto-saved card.
4. **Practice.** Move a card to Learning; run recognition practice, reveal, rate and undo. Reference and Archived items should not create ordinary due reviews. Check a sentence-based card in cloze mode.
5. **Reader.** Paste a short paragraph, select a word or phrase, and inspect the stored context. The entire document should not silently become a shared collection.
6. **Accounts.** Create your test account, privately retain the recovery code. A separate browser profile/private window creates the second account. Guest words are not silently uploaded into a new account.
7. **Friends/sharing.** Add the exact handle and accept. Send a word, preview and import it. Share a collection, make the other user a contributor, propose a correction and approve it as owner. Verify private notes do not appear in the shared preview.
8. **Server restart.** Stop the terminal server and start it again. Sign in and check cards, reviews and friends. Do not delete `.data`.
9. **Offline queue.** With an account already cached, use browser developer tools' Offline network toggle. Save/review. Expect pending/offline, not Synced. Reconnect and confirm the queue drains without a duplicate. Closing/reopening the browser offline also tests a native capability not established by our fixtures.
10. **Recovery.** Recover one test account using its code. Old sessions/code should stop working; a fresh code is shown. Saved cards remain. Never use a real account as a destructive recovery experiment.
11. **Optional providers.** Only after you intentionally configure private keys, test one uncached translation and repeat it. Inspect Settings -> Translation memory & usage; restart the server and repeat via a fresh session. Provider attempts should not increase for a matching server-cache hit. Browser cache hits bypass the server counters. Model/variant/context changes create different keys.
12. **Backups.** Export the browser library; make a server snapshot to a new filename; restore it to a separate database. Verify the copy, never overwrite the live database as part of this checklist.

## Report a problem

Record the release (`1.9.0`), page/feature, exact steps, expected vs actual behavior, browser/OS, and whether you were guest or signed in. Include a screenshot of the visible error or redacted console trace. Never send `.env.local`, passwords, recovery codes, cookies, private documents or an unredacted database.
