import * as Moments from "./nabu-moments.js";
import * as SupportModel from "./nabu-support-model.js";

/** First use and the return visit share the existing private progress store.
 * Saving or reopening a scene never manufactures a linguistic response. */
export function installMoments(h) {
  const { state, actions, store, E, $, showModal, closeModal } = h;
  let homeKey = "",
    dialog = null,
    generation = 0,
    pending = false;
  const user = () => state.user?.id || null;
  const owner = () => user() || (state.accountHint ? "!locked" : "guest");
  const enabled = () =>
    owner() !== "!locked" &&
    store.getState().owner === owner() &&
    !["loading", "locked"].includes(store.getState().status) &&
    (!state.user || state.backend?.moments);
  const list = () =>
    enabled()
      ? Moments.projectMoments(
          store.getEvents(),
          user(),
          Number.MAX_SAFE_INTEGER,
        )
      : [];
  const lookup = (id) => list().find((m) => m.id === id);
  const sceneFor = (id) => Moments.sceneByKey(id.replace(/^moment:/, ""));
  const titleFor = (m) =>
    m.source?.title || sceneFor(m.id)?.title || "Saved moment";
  const practice = () => !h.support().practiceExcluded();
  const shortDate = (n) =>
    new Date(n).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  function status(m) {
    if (m.mode === "reference") return "Reference only";
    if (m.mode === "familiar") return "Marked familiar · prompts paused";
    if (m.dueAt === null) return "Returned to this moment";
    return m.dueAt <= Date.now()
      ? "Ready to revisit"
      : "Next visit · " + shortDate(m.dueAt);
  }
  function openState(type, fields = {}) {
    dialog = { ...fields, type, owner: owner(), generation: ++generation };
    pending = false;
    return dialog;
  }
  function guard(d) {
    if (
      !enabled() ||
      !d ||
      dialog !== d ||
      owner() !== d.owner ||
      d.generation !== generation ||
      $(".moment-dialog")?.dataset.momentScope !== String(d.generation)
    )
      throw Error("Reopen this moment in the active library.");
  }
  function frame(d, title, html) {
    showModal(
      title,
      `<section class="moment-dialog" data-moment-scope="${d.generation}">${html}</section>`,
    );
  }
  const btn = (action, label, style = "secondary", attrs = "") =>
    `<button type="button" class="button ${style}" data-action="${action}" ${attrs}>${E(label)}</button>`;
  const idAttr = (id) => `data-id="${E(id)}"`;
  function picture(scene, next = false) {
    const image = next ? scene.nextImage : scene.image;
    return image
      ? `<img class="moment-photo" src="${Moments.MOMENT_IMAGES[image]}" alt="${E(next ? scene.nextAlt : scene.alt)}">`
      : "";
  }
  function quote(text, lang) {
    return `<blockquote lang="${E(lang)}" dir="auto">${E(text)}</blockquote>`;
  }
  function home() {
    if (!enabled()) return "";
    const scenes = Moments.MOMENT_SCENES,
      all = list(),
      s =
        Moments.sceneByKey(homeKey) ||
        scenes.find(
          (g) =>
            !all.some(
              (m) => m.id === "moment:" + g.key && m.mode === "familiar",
            ),
        ) ||
        scenes[0],
      id = "moment:" + s.key,
      m = lookup(id);
    const due = all.find(
      (v) =>
        practice() &&
        v.mode === "practice" &&
        v.dueAt !== null &&
        v.dueAt <= Date.now(),
    );
    return `<section class="moment-home explore-heading" aria-labelledby="moment-title"><div class="moment-top"><div><p class="eyebrow">Nabu 1.18</p><h1 id="moment-title">Moments</h1></div>${btn("open-own-reader", "Bring your own piece", "secondary")}</div>
      ${due ? `<div class="moment-due" role="status"><strong>Ready to revisit · ${E(titleFor(due))}</strong>${btn("moment-reopen", "Return to the passage", "secondary", idAttr(due.id))}</div>` : ""}
      <div class="moment-feature ${s.image ? "has-image" : "text-scene"}"><div class="moment-stage">${picture(s)}<div class="moment-line"><button class="moment-bubble" type="button" data-action="moment-help" data-id="${E(id)}" aria-label="Open help for this line" lang="${s.language}" dir="auto">${E(s.source)}</button></div></div>
      <div class="moment-story"><p class="eyebrow">${E(s.variety)}</p><h2>${E(s.title)}</h2><p>${E(s.context)}</p>
      ${btn("moment-choose", m ? "Change how this is kept" : "I want to understand this part", "primary", idAttr(id))}
      ${m ? `<p class="moment-state">${E(status(m))}</p>${practice() && m.mode === "practice" ? btn("moment-next", "Open the next scene", "secondary", idAttr(id)) : ""}` : ""}
      <span class="small-print">Tap the line for meaning. Swipe right to keep it, left for familiar.</span><span class="small-print">${s.image ? "Original scene with a generated still" : "Original written dialogue"}</span></div></div>
      <div class="moment-tabs" role="group" aria-label="Choose a scene">${scenes.map((g) => `<button type="button" data-action="moment-scene" data-key="${g.key}" aria-pressed="${g.key === s.key}">${E(g.variety)}</button>`).join("")}</div>
      <details class="moment-walkthrough"><summary>Watch the Moments walkthrough</summary><video controls playsinline preload="none" aria-label="Nabu Moments walkthrough" src="nabu-3-walkthrough.mp4"><track kind="captions" srclang="en" label="English" src="nabu-3-walkthrough.vtt"></video><p>Recorded in the Moments preview. <a href="capture-demo.html">Watch the scrolling Capture demo</a></p></details></section>`;
  }
  function frenchDirections() {
    return `<div class="button-row">${btn("moment-check", "Listen to the sentence", "secondary", 'data-task="moment-task:camille:listen"')}${btn("moment-check", "Write a reply", "secondary", 'data-task="moment-task:camille:write"')}</div>`;
  }
  function shelf(view) {
    if (!enabled()) return "";
    const all = list(),
      items =
        view === "review"
          ? all
              .filter((m) => m.mode === "practice" && practice())
              .sort((a, b) => (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity))
          : all;
    if (!items.length) return "";
    return `<section class="panel moment-shelf" aria-label="Saved moments"><h2>${view === "review" ? "Return to a moment" : "Your moments"}</h2>
      <ul>${items
        .map(
          (
            m,
          ) => `<li><div><strong dir="auto">${E(titleFor(m))}</strong><small>${E(status(m))}</small></div><div>${btn("moment-reopen", "Open passage", "secondary", idAttr(m.id))}
      ${practice() && !m.source && m.mode === "practice" ? btn("moment-next", "New scene", "secondary", idAttr(m.id)) : ""}
      ${view === "review" && m.id === "moment:camille" ? `<details><summary>Practice with the passage closed</summary>${frenchDirections()}</details>` : ""}
      <button class="text-button" data-action="moment-choose" ${idAttr(m.id)}>Change</button></div></li>`,
        )
        .join("")}</ul>
      ${view === "library" ? "<details><summary>Return activity on this account or device</summary>" + pilot() + "</details>" : ""}</section>`;
  }
  function pilot() {
    const counts = Moments.pilotCounts(list()),
      snapshot = h.support().getSnapshot();
    const comparison = SupportModel.compareMomentForecasts(
      store.getEvents(),
      snapshot.projection,
    );
    return `<p>${counts.distinctPiecesBrought} distinct learner-provided pieces kept. ${counts.reopenedAfter24h} of ${counts.eligibleAfter24h} eligible practice moments reopened at least 24 hours after choosing practice. ${counts.freshScenesOpened} moments opened in a new scene.</p><p>${comparison.eligible} first responses are eligible for the provisional prediction comparison. Reading a scene alone contributes no scored response.</p>${btn("moment-export", "Export review counts", "secondary")}`;
  }
  function choices(d, existing) {
    const scene = sceneFor(d.id || ""),
      title = existing
        ? titleFor(existing)
        : d.source?.title || scene?.title || "Selected passage";
    const excerpt =
      existing?.source?.text || d.source?.text || scene?.phrase || "";
    frame(
      d,
      "Keep this moment",
      `<p>${E(title)}</p>${quote(excerpt, scene?.language || d.source?.language || existing?.source?.language || "und")}
      ${practice() ? `<div class="moment-option">${btn("moment-mode", "Keep for practice", "primary", 'data-mode="practice"')}<span>Offer this moment in Review in 24 hours. You can open it sooner.</span></div>` : ""}
      <div class="moment-option">${btn("moment-mode", "Save as reference", "secondary", 'data-mode="reference"')}<span>Keep it in your Library for when you want it.</span></div>
      <div class="moment-option">${btn("moment-mode", "Already familiar", "secondary", 'data-mode="familiar"')}<span>Pause prompts for this moment. You can change this later.</span></div>`,
    );
  }
  // The store freezes event IDs and checks owner scope before and after every write.
  async function record(
    d,
    id,
    action,
    mode = null,
    source = null,
    undoOf = null,
  ) {
    guard(d);
    const key = JSON.stringify([id, action, mode, undoOf]);
    d.writes ??= new Map();
    if (!d.writes.has(key)) d.writes.set(key, h.uid());
    const event = await store.append(
      { id, version: 1 },
      "moment",
      {
        moment: {
          schemaVersion: 1,
          userId: user(),
          action,
          mode,
          source,
          ...(undoOf ? { undoOf } : {}),
        },
      },
      d.writes.get(key),
    );
    guard(d);
    if (state.user) store.sync().catch(() => {});
    return event;
  }
  async function locked(fn) {
    const d = dialog;
    if (pending || !d) return;
    guard(d);
    pending = true;
    try {
      await fn(d);
    } finally {
      if (d === dialog) pending = false;
    }
  }
  function reviewedAnswer() {
    const rows = h.support().getSnapshot().projection.rows;
    return [...rows]
      .reverse()
      .find(
        (row) =>
          row.task?.momentStage === "old-key" && row.correctionEventIds.length,
      );
  }
  function answerKeyControls() {
    if (reviewedAnswer())
      return btn("moment-history", "See your reviewed answer", "secondary");
    return `<details><summary>Review an old answer key</summary><p>Inspect a historical question and flag its assumption. This exercise stays outside your learner estimate.</p>${btn("moment-check", "Inspect the historical question", "secondary", 'data-task="moment-task:camille:old-key"')}</details>`;
  }
  function showPassage(d, m, next) {
    const s = sceneFor(m.id),
      own = m.source,
      lang = own?.language || s?.language || "und";
    const title =
      own?.title || (next ? s?.nextTitle : s?.title) || "Saved moment";
    const text = own?.text || (next ? s?.nextSource : s?.source);
    const key = s?.key,
      stage = next ? "next" : "first";
    frame(
      d,
      title,
      `${s ? picture(s, next) : ""}<p class="eyebrow">${E(own ? "Your saved excerpt" : s?.variety || "Saved source")}</p>
      ${quote(text || "This source version is unavailable.", lang)}
      ${s ? `<p>${E(next ? s.nextContext : s.context)}</p>` : ""}
      ${own?.seconds != null ? `<p>Saved at ${Math.floor(own.seconds / 60)}:${String(own.seconds % 60).padStart(2, "0")} in your local media.</p>` : ""}
      <div class="button-row">${s ? btn("moment-help", "Meaning in this context", "secondary", idAttr(m.id) + ' data-stage="' + stage + '"') : btn("moment-read-own", "Read this excerpt", "secondary")}
      ${s && practice() && m.mode === "practice" ? btn("moment-check", "Try a question", "primary", 'data-task="moment-task:' + key + ":" + stage + '"') : ""}
      ${s && !next && m.mode === "practice" && practice() ? btn("moment-next", "New scene", "secondary", idAttr(m.id)) : ""}
      ${btn("close-modal", "Keep reading", "secondary")}</div>
      ${key === "camille" && practice() && m.mode === "practice" ? `<details><summary>Listen or write instead</summary>${frenchDirections()}</details>` : ""}
      ${s && practice() && m.mode === "practice" ? directionSummary(key) : ""}
      ${key === "camille" && practice() ? answerKeyControls() : ""}`,
    );
  }
  function directionSummary(key) {
    const r = SupportModel.momentDirections(
      h.support().getSnapshot().projection.rows,
      key,
    );
    return `<details><summary>Evidence by direction</summary><p>Contexts where you answered a specific question correctly with its ordinary cues. Two different questions can count in a direction even when they check different skills.</p><ul>${Object.entries(
      r,
    )
      .map(
        ([k, n]) =>
          `<li>${E(k)} · ${n ? n + " / 2" : "no demonstrated step"}</li>`,
      )
      .join("")}</ul></details>`;
  }
  async function reopen(id, next) {
    if (pending) return;
    const m = lookup(id);
    if (!m) throw Error("This moment is unavailable in the active library.");
    if (next && (m.source || m.mode !== "practice" || !practice()))
      throw Error("A new scene is unavailable for this moment.");
    const d = openState("passage", { id, next });
    frame(
      d,
      "Opening moment",
      '<p role="status">Opening the saved passage…</p>',
    );
    await locked(async () => {
      await record(d, id, next ? "variation" : "reopen");
      showPassage(d, m, next);
      h.refreshShelf();
    });
  }
  actions["moment-scene"] = (b) => {
    if (Moments.sceneByKey(b.dataset.key)) homeKey = b.dataset.key;
    h.render();
  };
  actions["moment-choose"] = (b) => {
    if (!enabled()) return;
    const id = b.dataset.id,
      m = lookup(id);
    if (!m && !sceneFor(id)) return;
    choices(openState("choose", { id }), m);
  };
  actions["moment-mode"] = (b) =>
    locked(async (d) => {
      const mode = b.dataset.mode;
      if (
        !["reference", "familiar", "practice"].includes(mode) ||
        (mode === "practice" && !practice())
      )
        return;
      const old = lookup(d.id);
      let decision = null;
      if (!old || old.mode !== mode)
        decision = await record(
          d,
          d.id,
          old ? "mode" : "keep",
          mode,
          old ? null : d.source || null,
        );
      d.undoOf = decision?.id;
      guard(d);
      const m = lookup(d.id);
      if (!m) throw Error("Could not read the saved moment.");
      frame(
        d,
        mode === "practice"
          ? "Kept for practice"
          : mode === "reference"
            ? "Saved as reference"
            : "Marked familiar",
        `<p><strong dir="auto">${E(titleFor(m))}</strong></p><p>${E(status(m))}.</p><div class="button-row">${btn("moment-library", "Open Library", "secondary")}
      ${mode === "practice" && !m.source ? btn("moment-next", "Open the next scene", "primary", idAttr(m.id)) : btn("moment-reopen", "Open the passage", "secondary", idAttr(m.id))}${btn("close-modal", "Continue", "secondary")}${d.undoOf ? btn("moment-undo", "Undo", "secondary") : ""}</div>`,
      );
      h.refreshShelf();
    });
  actions["moment-undo"] = () =>
    locked(async (d) => {
      if (!d.undoOf) return;
      await record(d, d.id, "undo", null, null, d.undoOf);
      frame(
        d,
        "Choice undone",
        "<p>The previous moment preference is restored.</p>" +
          btn("close-modal", "Continue", "secondary"),
      );
      h.refreshShelf();
    });
  // Horizontal gestures have the same durable action as their labelled controls.
  let pointer = null,
    swiped = null;
  document.addEventListener("pointerdown", (event) => {
    const bubble = event.target.closest?.(".moment-bubble");
    if (!bubble || !event.isPrimary || event.button !== 0) return;
    pointer = {
      bubble,
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
    bubble.setPointerCapture?.(event.pointerId);
  });
  document.addEventListener("pointercancel", () => {
    pointer = null;
  });
  document.addEventListener("pointerup", (event) => {
    const p = pointer;
    pointer = null;
    if (!p || event.pointerId !== p.id || !p.bubble.isConnected || !enabled())
      return;
    const dx = event.clientX - p.x,
      dy = event.clientY - p.y;
    if (Math.abs(dx) < 48 || Math.abs(dx) < 1.4 * Math.abs(dy)) return;
    swiped = p.bubble;
    setTimeout(() => {
      if (swiped === p.bubble) swiped = null;
    }, 450);
    const id = p.bubble.dataset.id;
    choices(openState("choose", { id }), lookup(id));
    actions["moment-mode"]({
      dataset: {
        mode: dx < 0 ? "familiar" : practice() ? "practice" : "reference",
      },
    }).catch(h.error);
  });
  document.addEventListener(
    "click",
    (event) => {
      if (swiped && event.target.closest?.(".moment-bubble") === swiped) {
        event.preventDefault();
        event.stopImmediatePropagation();
        swiped = null;
      }
    },
    true,
  );
  actions["moment-reopen"] = (b) => reopen(b.dataset.id, false);
  actions["moment-next"] = (b) => reopen(b.dataset.id, true);
  actions["moment-help"] = (b) => {
    if (!enabled()) return;
    const scene = sceneFor(b.dataset.id);
    if (!scene) return;
    return h
      .support()
      .startCheck(
        "moment-task:" +
          scene.key +
          ":" +
          (b.dataset.stage === "next" ? "next" : "first"),
        { readOnly: true, openCue: "translation" },
      );
  };
  actions["moment-check"] = (b) => h.support().startCheck(b.dataset.task);
  actions["moment-history"] = () => {
    guard(dialog);
    const row = reviewedAnswer();
    if (!row) return;
    const record = store.getEvents().find((event) => event.id === row.eventId);
    const choice = row.task.options?.[record?.cycle.response?.choice];
    const d = openState("history", { id: "moment:camille" });
    frame(
      d,
      "Your reviewed answer",
      `<p lang="fr">${E(row.task.prompt)}</p>
      ${choice ? quote(choice, "fr") : ""}
      <p>Original result · <strong>${E(row.historicalScoring.outcome)}</strong></p>
      <p>After review · <strong>${E(row.scoring.outcome)}</strong></p>
      <p>${E(row.scoring.reason)}</p><p class="small-print">This exercise contributes no learner observation.</p>
      <div class="button-row">${btn("moment-check", "Try the fair question", "primary", 'data-task="moment-task:camille:first"')}${btn("close-modal", "Keep reading", "secondary")}</div>`,
    );
  };
  actions["moment-library"] = () => {
    closeModal();
    h.navigate("library");
  };
  actions["moment-read-own"] = () => {
    const m = dialog && lookup(dialog.id);
    if (m?.source) {
      closeModal();
      h.readOwn(m.source);
    }
  };
  actions["moment-capture"] = () => {
    if (!enabled()) throw Error("Wait for the active library to open.");
    const r = h.readerSource();
    if (!r?.text?.trim()) throw Error("Open a passage first.");
    const d = openState("capture", { reader: r });
    const start = Number.isInteger(r.selectionStart)
      ? r.selectionStart
      : Math.max(0, r.firstOffset || 0);
    const end = Math.min(
      r.text.length,
      start +
        (r.selectedText?.length ||
          r.text.slice(start).split("\n")[0].length ||
          600),
      start + 600,
    );
    frame(
      d,
      "I want to understand this part",
      `<label for="moment-excerpt">Select the part to keep, up to 600 characters.</label><textarea id="moment-excerpt" class="input" rows="5" readonly dir="auto" lang="${E(r.sourceLang)}">${E(r.text)}</textarea>
      <label for="moment-source-title">Passage title</label><input class="input" id="moment-source-title" maxlength="100" value="${E(r.title || "My passage")}">
      <p class="small-print">Only the selected text, title and position are kept in your private moments. Media files stay on this device.</p>${btn("moment-anchor", "Use this selection", "primary")}`,
    );
    const box = $("#moment-excerpt");
    box.focus();
    box.setSelectionRange(start, end);
  };
  actions["moment-anchor"] = () =>
    locked(async (d) => {
      const box = $("#moment-excerpt"),
        t = d.reader,
        title = $("#moment-source-title").value;
      const offset = box.selectionStart,
        excerpt = t.text.slice(offset, box.selectionEnd);
      const ref = await Moments.anchorExcerpt({
        text: t.text,
        excerpt,
        offset,
        title,
        language: t.sourceLang,
        seconds: t.seconds,
        origin: t.contentId ? "catalogue" : "learner",
        sourceRef: t.contentId ? [t.contentId, t.contentVersion] : null,
      });
      guard(d);
      Object.assign(d, ref);
      choices(d, lookup(d.id));
    });
  actions["moment-export"] = () => {
    const s = h.support().getSnapshot();
    return h.download(
      "nabu-1.18-review-counts.json",
      JSON.stringify(
        {
          version: "1.18.0",
          scope: "current private library",
          counts: Moments.pilotCounts(list()),
          forecastComparison: SupportModel.compareMomentForecasts(
            store.getEvents(),
            s.projection,
          ),
        },
        null,
        2,
      ),
      "application/json",
    );
  };
  window.addEventListener("nabu-account-change", () => {
    generation++;
    dialog = null;
    pending = false;
    homeKey = "";
    if ($(".moment-dialog")) closeModal();
  });
  $("#modal")?.addEventListener("close", () => {
    if (!$("#modal")?.open) {
      generation++;
      dialog = null;
      pending = false;
    }
  });
  return { home, shelf, enabled };
}
