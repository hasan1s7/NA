import * as Moments from "./nabu-moments.js";
import * as SupportCycle from "./nabu-support-cycle.js";
import * as SupportModel from "./nabu-support-model.js";
import * as SupportTasks from "./nabu-support-tasks.js";
import * as EvidencePolicy from "./nabu-evidence-policy.js";

/** Optional reader / saved-passage / review integration. All durable writes use
 * the existing owner-scoped content store. Opening this UI invents no success. */
export function installSupportCycle(h) {
  const { state, C, E, $, actions, explore, intents, showModal, closeModal } =
      h,
    store = explore.store;
  const now = () => (h.now ? h.now() : Date.now()),
    uid = () => C.uid();
  let check = null,
    owned = false,
    covered = null,
    localTime = 0,
    generation = 0,
    busy = false,
    error = "";
  const owner = () =>
    state.user?.id || (state.accountHint ? "!locked" : "guest");
  const enabled = () =>
    owner() !== "!locked" &&
    (!state.user || state.backend?.supportCycles) &&
    store.getState().owner === owner() &&
    !["loading", "locked"].includes(store.getState().status);
  function context() {
    const c = intents.getContext() || {};
    return {
      actor: {
        userId: state.user?.id || null,
        tenantId: state.user ? c.actor?.tenantId || null : null,
      },
      intentRef: c.immediateIntent
        ? { id: c.immediateIntent.id, revision: c.immediateIntent.revision }
        : null,
      organizationObjectiveRef: c.organizationObjective
        ? {
            id: c.organizationObjective.id,
            revision: c.organizationObjective.revision,
          }
        : null,
    };
  }
  const scope = () => SupportCycle.canonicalSupport(context());
  const noPractice = () =>
    EvidencePolicy.practiceIsExcluded({
      preferences: [intents.getContext()?.immediateIntent?.rawText || ""],
    });
  const events = () =>
    store
      .getEvents()
      .filter(
        (e) =>
          e.kind === "support-cycle" &&
          SupportCycle.canonicalSupport(e.cycle.actor) ===
            SupportCycle.canonicalSupport(context().actor),
      );
  function availableTasks() {
    const ref = h.currentMediaRef?.(),
      current = ref
        ? SupportTasks.SUPPORT_TASKS.filter(
            (t) =>
              t.mediaRef.id === ref.id && t.mediaRef.version === ref.version,
          )
        : [];
    if (ref) return current;
    // A learner's unanalysed source cannot inherit unrelated demo exercises.
    if (state.view === 'reader' && state.reader?.text?.trim()) return [];
    const french = SupportTasks.SUPPORT_TASKS.filter(
      (t) => t.language === "fr" && !t.momentKey,
    );
    if (["reader", "explore"].includes(state.view)) return french;
    const saved = SupportTasks.supportTasksForSaved(state.cards || []);
    return saved.length
      ? [
          ...saved.filter((t) => t.language !== "fr"),
          ...(saved.some((t) => t.language === "fr") ? french : []),
        ]
      : french;
  }
  const preferredTask = () =>
    availableTasks().find((t) => t.type === "meaning-recall") ||
    availableTasks()[0];
  const selectedTask = () =>
    availableTasks().find((t) => t.id === $("#support-task")?.value) ||
    preferredTask();
  function snapshot() {
    const projection = SupportCycle.projectSupportEvidence(events(), {
      actor: context().actor,
      resolveTask: SupportTasks.supportTask,
      resolveAnalysis: SupportTasks.supportAnalysis,
      now: Math.max(now(), localTime),
    });
    return {
      projection,
      model: SupportModel.fitSupportModel(projection, {
        now: Math.max(now(), localTime),
      }),
      plan: SupportModel.planSupportCycle(projection, availableTasks(), {
        now: Math.max(now(), localTime),
        avoidPractice: noPractice(),
      }),
    };
  }
  const dialogOwns = (c) =>
    $("#support-current")?.dataset.attempt === c?.base.attemptId;
  function guard(c = check) {
    if (
      !enabled() ||
      !c ||
      c.scope !== scope() ||
      c.generation !== generation ||
      !dialogOwns(c)
    )
      throw Error(
        "Your account, intention or open dialog changed. Reopen this passage.",
      );
  }
  function cover() {
    if (covered) return;
    const main = $("main");
    if (main) {
      covered = {
        main,
        visibility: main.style.visibility,
        aria: main.getAttribute("aria-hidden"),
        inert: main.inert,
      };
      main.style.visibility = "hidden";
      main.setAttribute("aria-hidden", "true");
      main.inert = true;
    }
    h.stopSpeech?.();
  }
  function restore() {
    if (!covered) return;
    const c = covered;
    covered = null;
    c.main.style.visibility = c.visibility;
    if (c.aria === null) c.main.removeAttribute("aria-hidden");
    else c.main.setAttribute("aria-hidden", c.aria);
    c.main.inert = c.inert;
    h.stopSpeech?.();
  }
  function dismiss() {
    generation++;
    check = null;
    busy = false;
    error = "";
    restore();
    if (owned) {
      owned = false;
      closeModal();
    }
    refresh();
  }
  function base(task, ctx, episodeId, attemptId) {
    return {
      schemaVersion: 1,
      episodeId,
      attemptId,
      parentEventId: null,
      ...ctx,
      mediaRef: task.mediaRef,
      analysisRef: task.analysisRef,
      targetIds: task.targetIds,
      taskRef: { id: task.id, version: task.version },
      taskType: task.type,
      inputModality: task.inputModality,
      responseModality: "none",
      condition: task.condition,
      observation: "encounter",
      support: null,
      supportSnapshot: [],
      response: null,
      scoring: null,
      correction: null,
      modelVersion: SupportCycle.SUPPORT_MODEL_VERSION,
      selectionPolicyVersion: SupportCycle.SUPPORT_POLICY_VERSION,
    };
  }
  function draft(c, observation, extra = {}) {
    localTime = Math.max(
      now(),
      localTime + 1,
      ...events().map((e) => e.at + 1),
    );
    return {
      id: uid(),
      at: localTime,
      cycle: {
        ...structuredClone(c.base),
        parentEventId: c.parent,
        observation,
        ...structuredClone(extra),
      },
    };
  }
  async function persist(c, key, observation, extra = {}) {
    guard(c);
    if (!c.pending.has(key)) c.pending.set(key, draft(c, observation, extra));
    const first = c.pending.get(key);
    const saved = await store.append(
      c.task.mediaRef,
      "support-cycle",
      { at: first.at, cycle: first.cycle },
      first.id,
    );
    guard(c);
    c.parent = saved.id;
    c.pending.delete(key);
    store.sync().catch(() => {});
    return saved;
  }
  async function initialize(c) {
    if (!c.initialized) {
      await persist(
        c,
        "presented",
        c.readOnly ? "encounter" : "task-presented",
        c.forecast ? { forecast: c.forecast } : {},
      );
      c.initialized = true;
    }
    for (const s of c.supports) {
      if (c.available.has(s.id)) continue;
      await persist(c, "available:" + s.id, "support-available", {
        support: descriptor(s),
      });
      c.available.add(s.id);
    }
  }
  const descriptor = (s) => ({
    id: s.id,
    type: s.type,
    visibility: s.visibility,
    role: s.role,
  });
  async function start(
    id = preferredTask()?.id,
    { readOnly = false, retry = false, openCue = null, presentation = 'standard' } = {},
  ) {
    if (!enabled())
      throw Error("Wait for your account before opening this passage.");
    if (!readOnly && noPractice())
      throw Error(
        "Your current intention excludes practice. You can still read with help.",
      );
    const task = SupportTasks.supportTask(id);
    if (!task) throw Error("This versioned passage is not available.");
    task.analysisRef = SupportCycle.currentAnalysisRef(
      events(),
      context().actor,
      task.analysisRef,
    );
    const prior = retry && check ? check : null;
    generation++;
    error = "";
    busy = false;
    const c = {
      task,
      scope: scope(),
      generation,
      base: base(task, context(), prior?.base.episodeId || uid(), uid()),
      parent: prior?.parent || null,
      readOnly,
      presentation,
      initialized: false,
      available: new Set(),
      opened: new Set(),
      used: new Set(),
      supports: readOnly
        ? [
            ...structuredClone(
              task.supports.filter(
                (s) => s.role === "extra" && s.visibility === "hidden",
              ),
            ),
            {
              id: "read-source",
              type: "transcript",
              visibility: "visible",
              role: "task",
              text: task.source,
            },
          ]
        : structuredClone(task.supports),
      pending: new Map(),
      submitted: null,
      played: false,
      notice: "",
    };
    if (
      h.readerExposesForm?.(task) &&
      (["form-recall", "contextual-production"].includes(task.type) ||
        (task.momentKey && task.inputModality === "auditory"))
    )
      c.supports.push({
        id: "earlier-reader",
        type: "earlier-answer",
        visibility: "visible",
        role: "extra",
        text: "The source wording was visible just before this check.",
      });
    if (readOnly && task.image)
      c.supports.push(...task.supports.filter((s) => s.id === "scene"));
    if (task.momentKey && !readOnly && !prior) {
      const { projection, model } = snapshot();
      c.forecast = SupportModel.forecastMoment(
        task,
        SupportTasks.supportAnalysis(task.analysisRef),
        projection,
        model,
      );
    }
    check = c;
    cover();
    owned = true;
    showModal(
      readOnly ? "Stay with the passage" : "Try with less help",
      `<section id="support-current" data-attempt="${E(c.base.attemptId)}"><p role="status">Opening your private episode…</p></section>`,
    );
    try {
      await initialize(c);
      if (openCue && check === c) await openSupport(c, openCue);
      if (check === c) renderCheck();
    } catch (e) {
      if (check === c) {
        error = e.message;
        renderCheck();
      }
    }
  }
  function firstUseBody(c) {
    const t = c.task, row = c.submitted ? snapshot().projection.rows.find(r => r.eventId === c.submitted.id) : null;
    if (c.submitted) {
      const score = row?.scoring;
      const title = score?.outcome === 'correct' ? 'That fits this scene.' : score?.outcome === 'abstain' ? 'This question needs a closer look.' : 'Let’s look at this together.';
      const detail = score?.outcome === 'abstain' ? score.reason : score?.outcome === 'correct' ? 'You chose the meaning that fits this example.' : 'Open the explanation, then give yourself another try if you like.';
      return `<p class="nu-result-label">A SMALL CHECK, COMPLETED</p><h3>${E(title)}</h3><p class="nu-feedback">${E(detail)}</p><p class="nu-small">${row?.independent ? 'You answered with the passage and choices, without opening extra help.' : 'Your answer is saved together with the help or recent examples available to you.'} A later visit can show what stays available.</p><div class="nu-cue"><button class="text-button" data-action="support-feedback">${c.feedback?'Explanation opened':'See the explanation'}</button>${c.feedback?`<blockquote lang="${E(t.language)}" dir="auto">${E(t.source)}</blockquote><p>${E(t.meaning)}</p><button class="text-button" data-action="support-retry">Try again</button>`:''}</div><div class="nu-check-footer"><button class="button primary" data-action="support-finish">Back to my first steps</button></div>`;
    }
    const source = c.readOnly || t.supports.some(s=>s.id==='source') ? `<blockquote lang="${E(t.language)}" dir="auto">${E(t.source)}</blockquote>` : '';
    const help = c.supports.filter(s=>s.role==='extra' && s.visibility==='hidden').map(s=>`<div class="nu-cue"><button class="text-button" data-action="support-cue" data-id="${E(s.id)}">${E(c.opened.has(s.id)?'Meaning opened':s.type==='translation'?'See meaning in English':'Open '+(s.label||s.type))}</button>${c.opened.has(s.id)?`<p>${E(s.text)}</p>`:''}</div>`).join('');
    return `<p class="eyebrow">${E(t.title)} · Nabu example</p><h3>${E(c.readOnly?'Stay with the story.':t.prompt)}</h3>${t.image?`<figure class="moment-check-image"><img src="${Moments.MOMENT_IMAGES[t.image]}" alt="${E(t.alt)}"></figure>`:''}${source}${c.readOnly?'':t.options?`<fieldset class="support-options"><legend>Choose what fits</legend>${t.options.map((option,i)=>`<label><input type="radio" name="support-choice" value="${i}"><span lang="${E(t.language)}" dir="auto">${E(option)}</span></label>`).join('')}</fieldset>`:'<label for="support-answer">Your answer</label><textarea class="input" id="support-answer" maxlength="300" rows="3"></textarea>'}${help}<div class="nu-check-footer">${c.readOnly?'<button class="button primary" data-action="support-finish">Back to my first steps</button>':'<button class="button primary" data-action="support-submit">Check my answer</button><button class="text-button" data-action="support-finish">Leave this for later</button>'}</div><p class="nu-small">${c.readOnly?'Take the help you need. Reading this is not a test.':'Help is always available. Nabu remembers when you opened it.'}</p>`;
  }
  function renderCheck() {
    const c = check;
    if (!c || !owned) return;
    if (!dialogOwns(c)) {
      owned = false;
      check = null;
      restore();
      return;
    }
    const t = c.task;
    let body;
    if (c.submitted) {
      const s = snapshot(),
        row = s.projection.rows.find((r) => r.eventId === c.submitted.id),
        score = row?.scoring;
      const success =
        t.type === "form-recall"
          ? "Form available here"
          : t.type === "contextual-production"
            ? "Your sentence fits this context"
            : t.type === "recognition"
              ? "Meaning recognized here"
              : "Meaning available here";
      const reviewingKey = Boolean(t.reviewedCorrection);
      const title = reviewingKey
        ? score?.outcome === "abstain"
          ? "The old question is retired"
          : "Reviewing the old answer key"
        : score?.outcome === "abstain"
          ? "This answer needs review"
          : score?.outcome === "correct"
            ? success
            : score?.outcome === "partial"
              ? "Part of the answer is available"
              : "A specific difficulty to revisit";
      const reason = reviewingKey
        ? score?.outcome === "abstain"
          ? score.reason
          : "This is how the original key marked the response. This exercise is excluded from your learner estimate."
        : score?.outcome === "abstain"
          ? score.reason
          : score?.outcome === "correct"
            ? "This matches the authored answer for this example."
            : score?.outcome === "partial"
              ? "Your answer includes part of the authored meaning."
              : "Your answer changes a specified part of the meaning or form.";
      const dependence = row?.exclusionReasons.includes(
        "dependent-episode-repeat",
      )
        ? "This retry follows an earlier answer in the same episode."
        : "One answer does not tell us what will stay available later.";
      body = `<div class="support-result"><span class="eyebrow">${row?.independent ? "WITHOUT EXTRA AIDS" : "WITH SUPPORT OR RECENT ANSWER EXPOSURE"}</span><h3>${E(title)}</h3><p>${E(reason)}</p>${t.momentKey ? `<p class="small-print">Task cues: ${t.inputModality === "auditory" ? "device audio and answer choices" : t.responseModality === "text" ? "a written situation and the requested pronouns" : t.image ? "written dialogue, scene image and answer choices" : "written dialogue and answer choices"}.</p>` : ""}<p>${row?.admitted ? (row.independent ? "One independent response is recorded for this skill and condition." : "This response informs its support condition. Independent ability remains a separate question.") : "Your answer is saved without another ability update."}</p><p class="small-print">${E(dependence)}</p><button class="button secondary" data-action="support-feedback">${c.feedback ? "Answer shown below" : "See answer and explanation"}</button>${c.feedback ? `<blockquote dir="auto" lang="${E(t.language)}">${E(t.savedSource || t.source)}<br>${E(t.meaning)}</blockquote><p>${E(t.explanation || t.supports.find((s) => s.id === "structure")?.text || "")}</p><p>${E(t.answerPolicy)}</p><button class="text-button" data-action="support-retry">Try again with this feedback in the episode</button>` : ""}
        ${t.reviewedCorrection ? `<p class="small-print">Answer-key review · original result: ${E(row?.historicalScoring.outcome)} · current result: ${E(score?.outcome)}.</p><button class="text-button" data-action="support-flag" ${c.flagged ? "disabled" : ""}>${c.flagged ? "Question flagged" : "Flag this question"}</button> ${c.flagged && score?.outcome !== "abstain" ? '<button class="button secondary" data-action="support-correct">Apply the reviewed correction</button>' : ""}` : ""}
        ${t.sampleId === "uncertain-transcript" ? '<button class="button secondary" data-action="support-correct">Apply reviewed demo transcript: retain pas</button>' : ""}
        <div class="button-row"><button class="button primary" data-action="support-next">${E(t.momentKey ? (t.momentStage === "old-key" ? "Try the fair question" : score?.outcome === "incorrect" ? "Review this scene" : ["next", "write", "listen"].includes(t.momentStage) ? "Return to the moment" : "Try the next scene") : s.plan.kind === "targeted-repair" ? "Targeted repair" : s.plan.kind === "later-retrieval" ? "Choose another check" : "Try a fresh context")}</button><button class="text-button" data-action="support-finish">Return to reading</button></div></div>`;
    } else {
      body = `<p class="small-print">${E(t.provenance)} ${t.inputModality === "auditory" ? "Audio uses an installed synthetic French voice; it does not test a different human speaker." : ""}</p><h3>${E(c.readOnly ? "Read, listen, or open the help you need." : t.prompt)}</h3>
        ${t.image ? `<figure class="moment-check-image"><img src="${Moments.MOMENT_IMAGES[t.image]}" alt="${E(t.alt)}"><figcaption>${E(t.sceneContext)}</figcaption></figure>` : ""}
        ${c.readOnly || t.supports.some((s) => s.id === "source") ? `<blockquote lang="${E(t.language)}" dir="auto">${E(t.source)}</blockquote>` : ""}
        ${t.inputModality === "auditory" ? `<button class="button secondary" data-action="support-play">${c.played ? "Replay sentence" : "Play sentence"}</button>` : ""}
        ${c.readOnly ? "" : t.options ? `<fieldset class="support-options"><legend>Choose one meaning</legend>${t.options.map((o, i) => `<label><input type="radio" name="support-choice" value="${i}"> ${E(o)}</label>`).join("")}</fieldset>` : '<label for="support-answer">Your answer</label><textarea class="input" id="support-answer" maxlength="300" rows="3" autocomplete="off"></textarea>'}
        <details class="support-help" open><summary>Help is available</summary><p class="small-print">Opening a cue is recorded. Attention is not observed. “I used this” is your own report.</p>${c.supports
          .filter((s) => s.role === "extra")
          .map(
            (s) =>
              `<div class="support-cue"><button class="text-button" data-action="support-cue" data-id="${E(s.id)}">${E(c.opened.has(s.id) ? "Opened: " + (s.label || s.type) : "Show " + (s.label || s.type))}</button>${c.opened.has(s.id) || s.visibility === "visible" ? `<p>${E(s.text)}</p><button class="text-button" data-action="support-used" data-id="${E(s.id)}"${c.used.has(s.id) ? " disabled" : ""}>${c.used.has(s.id) ? "You reported using this" : "I used this"}</button>` : ""}</div>`,
          )
          .join("")}</details>
        ${c.readOnly ? '<button class="button primary" data-action="support-finish">Return to reading</button>' : '<button class="button primary" data-action="support-submit">Submit response</button><button class="text-button" data-action="support-finish">Continue without grading</button>'}`;
    }
    if (c.presentation === 'first-use') body = firstUseBody(c);
    const answer = $("#support-answer")?.value,
      choice = $('input[name="support-choice"]:checked')?.value;
    showModal(
      c.presentation === 'first-use' ? (c.readOnly ? 'A little context' : 'A different scene') : c.readOnly ? "Stay with the passage" : "Try with less help",
      `<section id="support-current" data-attempt="${E(c.base.attemptId)}" class="support-check${c.presentation==='first-use'?' first-use-check':''}">${error ? `<p role="alert">${E(error)}${c.pending.has("response") ? " The first response is preserved. Retry saving it." : ""}</p>` : ""}${body}<p role="status">${E(c.notice)}</p>${!c.initialized || c.available.size < c.supports.length ? '<button class="button secondary" data-action="support-initialize">Retry opening</button>' : ""}</section>`,
    );
    if (answer !== undefined && $("#support-answer"))
      $("#support-answer").value = answer;
    if (choice !== undefined) {
      const r = $(`input[name="support-choice"][value="${choice}"]`);
      if (r) r.checked = true;
    }
    if (c.pending.has("response")) {
      if ($("#support-answer")) $("#support-answer").disabled = true;
      for (const el of document.querySelectorAll(
        'input[name="support-choice"]',
      ))
        el.disabled = true;
    }
    if (busy)
      for (const el of $("#modal-body").querySelectorAll("button"))
        el.disabled = true;
  }
  async function act(fn) {
    const c = check;
    if (!c || c.busy) return;
    c.busy = true;
    busy = true;
    error = "";
    // Keep the source and draft nodes intact while a write is pending, but
    // expose the pending state so a fast second click cannot look accepted.
    for (const button of $("#support-current")?.querySelectorAll("button") ||
      [])
      button.disabled = true;
    try {
      guard(c);
      await initialize(c);
      await fn(c);
    } catch (e) {
      if (check === c) error = e.message;
    } finally {
      c.busy = false;
      if (check === c) {
        busy = false;
        if (owned) renderCheck();
      }
      refresh();
    }
  }
  async function play(c) {
    // A completed recording with a lost save acknowledgement must retry its
    // original delivery, not play again or quietly erase a replay condition.
    if (c.pending.has("playback")) {
      await persist(c, "playback", "playback");
      c.played = true;
      return;
    }
    if (c.played || c.audioAttempted) {
      let s = c.supports.find((s) => s.id === "replay");
      if (!s) {
        s = {
          id: "replay",
          type: "replay",
          visibility: "hidden",
          role: "extra",
          text: "You requested the same synthetic sentence again.",
        };
        c.supports.push(s);
      }
      await initialize(c);
      if (!c.opened.has("replay")) {
        await persist(c, "replay-open", "support-opened", {
          support: descriptor(s),
        });
        c.opened.add("replay");
      }
    }
    if (h.play) await h.play(c.task.source, "fr");
    else
      await new Promise((resolve, reject) => {
        const engine = globalThis.speechSynthesis,
          Voice = globalThis.SpeechSynthesisUtterance,
          voice = engine
            ?.getVoices?.()
            .find((v) => v.lang?.toLowerCase().startsWith("fr"));
        if (!engine || !Voice || !voice) {
          reject(
            Error(
              "No installed French voice is ready. Choose a written check, or load a French device voice.",
            ),
          );
          return;
        }
        const u = new Voice(c.task.source);
        u.lang = "fr";
        u.voice = voice;
        u.onend = resolve;
        u.onerror = () =>
          reject(
            Error(
              "Playback did not finish. No auditory response can be submitted yet.",
            ),
          );
        engine.cancel();
        c.audioAttempted = true;
        engine.speak(u);
      });
    guard(c);
    await persist(c, "playback", "playback");
    c.played = true;
  }
  actions["support-start"] = (b) =>
    start(b?.dataset?.id || $("#support-task")?.value || "support:fr:meaning");
  actions["support-read"] = () => start(selectedTask()?.id, { readOnly: true });
  actions["support-initialize"] = () => act(() => {});
  async function openSupport(c, id) {
    const s = c.supports.find((s) => s.id === id);
    if (!s) throw Error("Cue unavailable.");
    if (!c.opened.has(s.id)) {
      await persist(c, "open:" + s.id, "support-opened", {
        support: descriptor(s),
      });
      c.opened.add(s.id);
    }
  }
  actions["support-cue"] = (b) => act((c) => openSupport(c, b.dataset.id));
  actions["support-used"] = (b) =>
    act(async (c) => {
      const s = c.supports.find((s) => s.id === b.dataset.id);
      if (!s) throw Error("Cue unavailable.");
      await persist(c, "used:" + s.id, "support-used", {
        support: descriptor(s),
      });
      c.used.add(s.id);
    });
  actions["support-play"] = () => act(play);
  actions["support-submit"] = () =>
    act(async (c) => {
      if (c.submitted) return;
      if (c.task.inputModality === "auditory" && !c.played)
        throw Error(
          "Play the sentence before submitting an auditory response.",
        );
      let response;
      if (c.pending.has("response"))
        response = c.pending.get("response").cycle.response;
      else if (c.task.options) {
        const choice = $('input[name="support-choice"]:checked');
        if (!choice) throw Error("Choose a meaning first.");
        response = { choice: Number(choice.value) };
      } else {
        const answer = $("#support-answer")?.value.trim();
        if (!answer) throw Error("Enter a short answer first.");
        response = { answer };
      }
      const scoring = SupportCycle.scoreSupportResponse(
        c.task,
        SupportTasks.supportAnalysis(c.task.analysisRef),
        response,
      );
      c.submitted = await persist(c, "response", "response", {
        response,
        responseModality: c.task.responseModality,
        scoring,
        supportSnapshot: SupportCycle.supportSnapshot(
          events(),
          c.base.attemptId,
        ),
      });
    });
  actions["support-feedback"] = () =>
    act(async (c) => {
      if (c.feedback) return;
      await persist(c, "feedback", "feedback");
      c.feedback = true;
    });
  actions["support-retry"] = () => {
    const id = check?.task.id;
    return start(id, { retry: true, presentation: check?.presentation });
  };
  actions["support-next"] = () => {
    const t = check?.task;
    if (t?.momentKey) {
      if (t.momentStage === "old-key")
        return start("moment-task:camille:first");
      const row = snapshot().projection.rows.find(
        (r) => r.eventId === check.submitted?.id,
      );
      if (row?.scoring.outcome === "incorrect")
        return actions["support-feedback"]();
      if (["next", "write", "listen"].includes(t.momentStage)) return dismiss();
      return start("moment-task:" + t.momentKey + ":next");
    }
    const p = snapshot().plan;
    if (p.kind === "targeted-repair")
      return act(async (c) => {
        await persist(c, "repair", "repair");
        if (!c.feedback) {
          await persist(c, "feedback", "feedback");
          c.feedback = true;
        }
        c.notice =
          c.task.explanation ||
          "Compare the negation, the person, and the topic. A retry with this feedback remains supported practice.";
      });
    return start(p.taskId || preferredTask().id);
  };
  actions["support-finish"] = dismiss;
  actions["support-flag"] = () =>
    act(async (c) => {
      if (!c.submitted || c.flagged || !c.task.reviewedCorrection) return;
      await persist(c, "flag", "question-flagged");
      c.flagged = true;
      c.notice = c.task.reviewedCorrection.note;
    });
  actions["support-correct"] = () =>
    act(async (c) => {
      if (
        c.corrected ||
        c.task.analysisRef.version >= 2 ||
        (!c.task.reviewedCorrection &&
          c.task.sampleId !== "uncertain-transcript")
      )
        return;
      if (c.task.reviewedCorrection && !c.flagged) return;
      await persist(c, "correction", "analysis-correction", {
        analysisRef: { ...c.task.analysisRef, version: 2 },
        attemptId: null,
        correction: {
          replaces: c.task.analysisRef,
          uses: { ...c.task.analysisRef, version: 2 },
          note:
            c.task.reviewedCorrection?.note ||
            "Reviewed authored demo transcript retains pas; prior answers are replayed under analysis version 2.",
        },
      });
      c.corrected = true;
      c.notice =
        "The analysis was corrected. Historical scoring stays in the audit; the current projection has been replayed.";
    });
  actions["support-save"] = async () => {
    if (!enabled()) throw Error("Wait for your account.");
    const expected = scope(),
      task = selectedTask();
    if (!task) throw Error('Scored practice is not available for this source yet. You can still read and keep an excerpt.');
    await h.savePassage?.(task);
    if (expected !== scope())
      throw Error("Account changed while saving. Reopen your library.");
    refresh();
  };
  actions["support-export"] = async () => {
    const s = snapshot();
    await h.download(
      "nabu-support-cycle-audit.json",
      JSON.stringify(
        {
          schemaVersion: 1,
          context: context(),
          events: events(),
          audit: events().map(SupportCycle.supportAuditRecord),
          ...s,
          forecastComparison: SupportModel.compareMomentForecasts(
            events(),
            s.projection,
          ),
          sensitivity: SupportModel.supportSensitivity(s.projection, {
            now: Math.max(now(), localTime),
          }),
        },
        null,
        2,
      ),
      "application/json",
    );
  };
  function render() {
    if (!enabled()) return "";
    if (!availableTasks().length) return '<section id="nabu-support-cycle" class="panel support-cycle"><h2>Keep reading at your pace.</h2><p>Scored practice is not available for this source yet. You can still look up a word or keep an excerpt in your Library.</p></section>';
    const s = snapshot(),
      independent = s.projection.rows.filter(
        (r) => r.admitted && r.independent,
      ),
      assisted = s.projection.rows.filter((r) => r.admitted && !r.independent),
      saved = SupportTasks.supportTasksForSaved(state.cards || []).filter((t) =>
        availableTasks().some((offered) => offered.id === t.id),
      );
    return `<section id="nabu-support-cycle" class="panel support-cycle"><span class="eyebrow">RETURN TO WHAT YOU ENCOUNTER</span><h2>What stays available without help?</h2><p>Read with support, try recalling, change the context, repair a difficulty, and return later. Start wherever you need.</p>
      <div class="button-row"><button class="button secondary" data-action="support-read">Read this passage</button><button class="text-button" data-action="support-save">Save the passage</button></div>
      ${
        noPractice()
          ? "<p>Your current intention excludes practice. Reading and help remain available.</p>"
          : `<label for="support-task">Choose a check</label><select class="select" id="support-task">${availableTasks()
              .map(
                (t) =>
                  `<option value="${E(t.id)}"${t.id === s.plan.taskId ? " selected" : ""}>${E(t.title)} · ${E(t.inputModality)}</option>`,
              )
              .join(
                "",
              )}</select><div class="button-row"><button class="button primary" data-action="support-start">Try this check</button></div><p class="small-print">${E(s.plan.reason)}${s.plan.dueAt > now() ? " Suggested return: " + E(new Date(s.plan.dueAt).toLocaleString()) + "." : ""}</p>`
      }
      ${saved.length ? '<p class="small-print">This passage is in your saved material. Its checks are available here and in Review.</p>' : ""}
      <details><summary>Your evidence · ${independent.length} independent / ${assisted.length} supported responses</summary><p>Written and auditory access, recognition, meaning recall, form recall, and contextual production are kept distinct. An unfamiliar condition remains unknown.</p>
      <div class="support-facets">${SupportCycle.SUPPORT_SKILLS.map(
        (skill) =>
          `<p><strong>${E(skill.replaceAll("-", " "))}</strong>: ${[
            "written",
            "auditory",
          ]
            .map((m) => {
              const n = independent.filter(
                (r) => r.task.type === skill && r.task.inputModality === m,
              ).length;
              return (
                E(m) +
                ": " +
                (n
                  ? n + " independent observation" + (n === 1 ? "" : "s")
                  : "not established")
              );
            })
            .join(" · ")}</p>`,
      ).join("")}</div>
      <p class="small-print">These are provisional conditional estimates, not calibrated mastery scores. Practice gain is unknown. Time changes predictions separately from observations.</p><p>${s.model.supportDependence.length ? "Support comparisons: " + E(s.model.supportDependence.map((x) => x.status.replaceAll("-", " ")).join(" · ")) + "." : "No supported-versus-independent comparison is available yet."}</p>
      <ol class="support-audit">${
        s.projection.rows
          .slice(-8)
          .map(
            (r) =>
              `<li>${E(r.task?.title || r.taskRef.id)} · ${E(r.scoring.outcome)} · ${r.independent ? "no extra cues" : "support / recent exposure"}${r.condition.extra.length ? " (" + E(r.condition.extra.join(", ")) + ")" : ""}<br><small>${E(new Date(r.at).toLocaleString())} · ${r.admitted ? "one joint observation" : E(r.exclusionReasons.join(", "))}${r.correctionEventIds.length ? " · replayed analysis v" + r.appliedAnalysisRef.version : ""}</small></li>`,
          )
          .join("") ||
        "<li>No responses yet. Reading and lookups do not establish independent ability.</li>"
      }</ol><button class="text-button" data-action="support-export">Export evidence and model audit</button></details></section>`;
  }
  function refresh() {
    const host = $("#nabu-support-cycle");
    if (host) host.outerHTML = render();
  }
  for (const name of ["nabu-account-change", "nabu-intent-change"])
    globalThis.window?.addEventListener(name, () => {
      if (check && check.scope !== scope()) dismiss();
      else refresh();
    });
  $("#modal")?.addEventListener("close", () => {
    if (!$("#modal")?.open && owned) {
      owned = false;
      generation++;
      check = null;
      restore();
    }
  });
  return {
    enabled,
    render,
    refresh,
    startCheck: start,
    practiceExcluded: noPractice,
    getSnapshot: snapshot,
    dismiss,
  };
}
