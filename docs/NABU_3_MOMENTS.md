# Nabu 3.0 · Moments

On a hillside road, a passenger says **على مهلك** to the driver. At a doorway, a friend uses the same words while somebody puts on a coat. The learner can look up the first line and make sense of the second one in a different setting. Nabu preserves which scene, task and cues made each answer possible.

## Review the release

1. Extract the archive. Open `public/index.html` for a quick look. For persistent guest data and private excerpt saving, use the normal local launcher or run `python -m http.server 8080 --directory public` and visit `http://127.0.0.1:8080/`. The full launchers use port 8000. Use the same address and browser profile each time.
2. In **Explore**, tap the line in **The bend in the road**. Read the translation and return. Choose **I want to understand this part → Keep for practice → Open the next scene**. At the door, choose **Try a question**. Look at the task cues listed with the result. Compare with a different attempt where you open the translation before answering.
3. Choose **French**, keep **Before Camille leaves**, then open the passage from **Library**. Expand **Review an old answer key**. Choose *Le dialogue ne le dit pas.* Flag the question and apply the reviewed correction. The dialogue establishes what the speaker told Camille. Camille could have heard about the departure elsewhere. The audit retains the original result and marks the current score as abstaining. The historical exercise is excluded from learner measurement even if a reviewer closes it before applying the correction. Reopen the French passage and choose **See your reviewed answer** to see what you submitted and both results. Future attempts use the corrected analysis. The ordinary question asks what the speaker said to Camille.
4. From **Review**, expand **Practice with the passage closed** on the French moment. Listen using an installed French device voice, or write a reply. Free writing uses a small authored rubric. Other plausible phrasings go to unscored review. Speaking has no scored capture route in this release.
5. In **Explore → Bring your own piece**, paste a short passage and choose **Start reading**. Use **I want to understand this part**, select an exact span and keep it as reference. Reopen it in **Library**. Try another passage, or keep two occurrences of the same line in one passage. The private activity summary counts distinct pieces. For a local video or audio transcript, the selection can also retain the playback second.
6. **Explore → Watch the 3.0 walkthrough** plays the silent 39-second film from the actual browser. The linked **scrolling Capture demo** shows a blank feed, translucent bubbles and their gestures in the Capture prototype. The road and doorway pictures are generated illustrations. All three paired dialogues are original editorial examples.

## What a return means

| Learner action | What is recorded | Effect |
| --- | --- | --- |
| Open or use a cue | Type, visibility, task role and time | A later answer receives the actual pre-response cue snapshot. An opened cue alone supplies no scored answer. |
| Keep for practice | Moment identity and choice | One in-app invitation becomes due after 24 hours. An early visit leaves the deadline in place. A visit after the deadline fulfills it. |
| Save as reference | Explicit preference | The passage appears in Library. |
| Mark familiar, or swipe left | Self-report scoped to this moment | Practice prompts for this moment pause. Undo restores the prior choice. |
| Answer an authored check | One response jointly covering its targets | Interpretation resolves the applicable rubric. Measurement uses the response condition and scorer reliability. |
| Correct an analysis | Immutable replacement reference linked to the earlier revision | Replay recomputes affected scores and estimates. Incompatible readings can yield abstention. |

The 24-hour invitation is an in-app product setting. The existing saved-word scheduler continues to use its own review log. Learners can enter through the reader, review or a saved passage and use any of these actions in their chosen order.

## Evidence and assumptions

The support-cycle implementation keeps linguistic interpretation, response measurement, elapsed-time prediction and practice opportunities separate. Its provisional grid uses an explicit prior, task difficulty, guessing, slips and scoring reliability. Compatible readings are marginalized. Recognition, meaning recall, form recall and contextual production retain their own task conditions and modality. An assisted answer updates its supported condition. A submitted response creates one observation, including when it has several targets. Feedback within an episode and earlier source cues are represented in the history. The model leaves causal practice gain unidentified. The full parameters, correction contract, retained cue categories and sensitivity scenarios are in [the support-cycle guide](SUPPORT_CYCLE.md).

The pilot ladder counts up to two distinct contexts with a correct independent response in each of reading, listening, writing and speaking. Unsupported directions remain open. Only eligible binary authored checks receive two prospective predictions. The first uses the direction's rung and task guessing rate. The second integrates the conditional model over its distribution. Predictions are saved before the question opens. The private export pairs them with eligible independent outcomes and reports mean squared probability error (the Brier score). Assisted, dependent, corrected and unscored outcomes are excluded. The design has no calibration dataset or comparative efficacy result.

**Library → Your moments → Return activity** reports currently kept practice moments, distinct learner-provided pieces, saved moments old enough for a 24-hour observation, returns after that point, and moments opened in a fresh authored scene. Each count is scoped to the active private library. A pair of excerpts from a single submitted text counts as one piece. These measure use of the product. A human pilot still needs people who return voluntarily and bring another piece.

## Implementation and verification

- `public/nabu-moments.js` defines immutable preferences, source anchors, undo, eligibility and returns. `public/nabu-moment-ui.js` connects them to Explore, the existing reader, Library and Review. `public/nabu-moment-tasks.js` contains the reviewed prompts, varieties and rubrics.
- `public/nabu-content-store.js` and `content_progress.py` reuse the existing actor-scoped ledger, offline outbox, retry and retention limits. `moments.py` validates the contract on ingestion. A new private keep stores only the chosen excerpt, title, language, source fingerprint, position and optional playback second. Later moment events contain references. The reader's existing resume setting is a separate local feature.
- `npm run demo:moments` reproduces the 23-hour and 25-hour return and the French repair using a fictional in-memory history. `npm run demo:support` exercises additional retrieval, variation, help, abstention and time assumptions. These commands write no data into a learner account.
- `npm test`, `npm run test:dom` and `python -m pytest -q` run the unit, bundled interface and backend suites. New tests cover exact duplicate text spans, stale and conflicting events, source ownership, rollback, reopen after restart, cue order, historical correction and frozen forecasts.
- One source project builds the browser app and the web content for the Android and iOS wrappers. Native packaging and signing still use their platform toolchains. The review package runs locally and includes both videos.

## Benchmark for the next release

3.0.0 is the build for the founders' first joint review. A 3.x revision can change a prompt, the invitation interval or the ladder without committing future releases to those settings. For the first pilot, record how many people were eligible for a next-day visit, how many returned voluntarily, and how many brought a second piece of their own. Then inspect the independent answers from fresh scenes separately. Agree on the decision date and success criteria before collecting the pilot results.

The 3.0 review build passed 892 JavaScript unit tests, 122 interface tests, 545 Python tests, and 14 checks against the running local launcher. The browser walkthrough also exercised the road and doorway scenes, challenged the French key, reopened the reviewed answer after reload, and reopened a personal Spanish excerpt. The next-day check used a controlled clock. Human return rates and device-specific native builds still need separate evaluation.
