# New user · Nabu 1.18

The top-bar **New user** button opens `#new-user` on static hosting and `/new-user` on the Python application. Existing entry routes and saved data remain in place.

The page offers original examples in all twelve supported languages: English, Arabic, Chinese, French, Russian, Spanish, German, Italian, Japanese, Korean, Portuguese and Turkish, or the learner's own text in any of the twelve existing languages. A highlighted phrase opens contextual help. Keep writes to the existing private Moments history. A short check uses a different authored scene and the existing versioned support/response machinery. Saved actions and responses survive refresh; the later-return step is completed only by an actual qualifying revisit.

The first-use presentation keeps translation optional and records when it opens. It reports the result of the actual question, without a mastery percentage. Retries after feedback retain their episode. Existing reference and familiar choices remain unchanged. A failed save can retry the same operation, and an account change clears the intake draft.

Own text opens the existing reader, where local audio can be added. A source without matching task definitions now shows that scored practice is unavailable instead of substituting unrelated French demo questions. There is no automatic full-song transcription or new speaking assessment in this change.

## Verification

- 908 JavaScript domain/build tests passed.
- 141 DOM acceptance tests passed, including eighteen first-use scenarios. Each supported language exercises help, durable saving, a changed-scene answer, reload and a test-clock delayed return.
- 546 Python tests passed, including server, replay, release and native-configuration coverage.
- Browser verification covered the new top tab, contextual help, Keep, a different-scene answer, and preserved progress after reload. DOM tests separately cover save failure, duplicate clicks, all twelve example languages, personal-text escaping, preserved references, and account-switch draft clearing.
- Generated root and `public/` entry files use build marker `nabu-pages-1.18.0-new-user-r2` with exact CSP hashes.

Run `python tools/build_pages.py` to regenerate the shipping files. The new source files are `public/nabu-new-user.js` and `public/nabu-new-user.css`; tests are in `tests/new-user.dom.mjs` and `tests/new-user-languages.test.mjs`. The language coverage contract is derived from `public/nabu-core.js`, with the standing requirement recorded in `AGENTS.md`.

No database migration or clearing of existing cards, review logs, schedules, or private settings is performed. The example texts are authored demonstrations; their answers do not establish broad proficiency.
