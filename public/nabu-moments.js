/** Moment history is private saved material. Only a learner's explicitly kept
 * excerpt is stored; subsequent actions carry an opaque reference, not a copy. */
export const MOMENT_DAY = 86400000;
export const MOMENT_IMAGES = Object.freeze({
  bend: "./moment-media/bend.webp",
  doorway: "./moment-media/doorway.webp",
});
export const MOMENT_VERSION = 1;
export const MOMENT_SCENES = Object.freeze([
  {
    key: "bend",
    language: "ar",
    variety: "Lebanese Arabic",
    title: "The bend in the road",
    source: "على مهلك! في كوع قدّامنا.",
    phrase: "على مهلك",
    meaning: "Easy! There’s a bend ahead.",
    context: "A passenger speaks to the driver.",
    image: "bend",
    alt: "A passenger looks out toward a bend on a hillside road.",
    nextTitle: "At the door",
    nextSource: "على مهلك، بعد معنا وقت.",
    nextContext: "A friend waits while someone puts on a coat.",
    nextMeaning: "Take your time. We still have time.",
    nextImage: "doorway",
    nextAlt:
      "A friend waits in the doorway while his companion puts on a coat.",
  },
  {
    key: "camille",
    language: "fr",
    variety: "French",
    title: "Before Camille leaves",
    source:
      "« Tu as parlé du départ à Camille ? »\n« Je ne lui en ai pas parlé. »",
    phrase: "Je ne lui en ai pas parlé.",
    meaning:
      "“Did you talk to Camille about the departure?” “I didn’t talk to them about it.”",
    context: "A conversation about a departure.",
    nextTitle: "A change of plan",
    nextSource:
      "« Tu lui as parlé du changement ? »\n« Pas encore, je lui en parlerai demain. »",
    nextContext: "The conversation turns to a change of plan.",
    nextMeaning:
      "“Did you tell them about the change?” “Not yet. I’ll talk to them about it tomorrow.”",
  },
  {
    key: "dream",
    language: "es",
    variety: "Spanish",
    title: "The house by the sea",
    source: "Anoche tuve un sueño. Volví a la casa junto al mar.",
    phrase: "un sueño",
    meaning: "Last night I had a dream. I went back to the house by the sea.",
    context: "Someone describes the previous night.",
    nextTitle: "The train station",
    nextSource: "En mi sueño, el tren salía de una estación vacía.",
    nextContext: "A different person recalls a journey.",
    nextMeaning: "In my dream, the train was leaving an empty station.",
  },
  {
    key: "search-en", language: "en", variety: "English",
    title: "Before leaving home",
    source: "I'm looking for my keys. I left them by the door.",
    phrase: "looking for", meaning: "I am trying to find my keys. I left them near the door.",
    context: "Someone is getting ready to leave home.",
    nextTitle: "At the station",
    nextSource: "Maya is looking for her ticket. The train leaves soon.",
    nextContext: "Maya is getting ready to board a train.",
    nextMeaning: "Maya is trying to find her ticket before the train leaves.",
  },
  {
    key: "table-zh", language: "zh-CN", variety: "Mandarin Chinese · Simplified",
    title: "Finding the key",
    source: "钥匙在桌子上，在杯子旁边。", phrase: "在桌子上",
    meaning: "The key is on the table, next to the cup.",
    context: "Someone explains where to find a key.",
    nextTitle: "A book by the window",
    nextSource: "书在窗边的桌子上。",
    nextContext: "Someone is looking for a book.",
    nextMeaning: "The book is on the table by the window.",
  },
  {
    key: "table-ru", language: "ru", variety: "Russian",
    title: "Finding the key",
    source: "Ключ лежит на столе, рядом с чашкой.", phrase: "на столе",
    meaning: "The key is on the table, next to the cup.",
    context: "Someone explains where to find a key.",
    nextTitle: "A book by the window",
    nextSource: "Книга лежит на столе у окна.",
    nextContext: "Someone is looking for a book.",
    nextMeaning: "The book is on the table by the window.",
  },
  {
    key: "table-de", language: "de", variety: "German",
    title: "Finding the key",
    source: "Der Schlüssel liegt auf dem Tisch neben der Tasse.", phrase: "auf dem Tisch",
    meaning: "The key is on the table next to the cup.",
    context: "Someone explains where to find a key.",
    nextTitle: "A book by the window",
    nextSource: "Das Buch liegt auf dem Tisch am Fenster.",
    nextContext: "Someone is looking for a book.",
    nextMeaning: "The book is on the table by the window.",
  },
  {
    key: "table-it", language: "it", variety: "Italian",
    title: "Finding the key",
    source: "La chiave è sul tavolo, accanto alla tazza.", phrase: "sul tavolo",
    meaning: "The key is on the table, next to the cup.",
    context: "Someone explains where to find a key.",
    nextTitle: "A book in the kitchen",
    nextSource: "Il libro è sul tavolo della cucina.",
    nextContext: "Someone is looking for a book.",
    nextMeaning: "The book is on the kitchen table.",
  },
  {
    key: "table-ja", language: "ja", variety: "Japanese",
    title: "Finding the key",
    source: "鍵はテーブルの上にあります。カップの隣です。", phrase: "テーブルの上",
    meaning: "The key is on the table. It is next to the cup.",
    context: "Someone explains where to find a key.",
    nextTitle: "A book by the window",
    nextSource: "本は窓のそばのテーブルの上にあります。",
    nextContext: "Someone is looking for a book.",
    nextMeaning: "The book is on the table by the window.",
  },
  {
    key: "table-ko", language: "ko", variety: "Korean",
    title: "Finding the key",
    source: "열쇠는 탁자 위에 있어요. 컵 옆에 있어요.", phrase: "탁자 위",
    meaning: "The key is on the table. It is next to the cup.",
    context: "Someone explains where to find a key.",
    nextTitle: "A book by the window",
    nextSource: "책은 창가에 있는 탁자 위에 있어요.",
    nextContext: "Someone is looking for a book.",
    nextMeaning: "The book is on the table by the window.",
  },
  {
    key: "table-pt", language: "pt", variety: "Brazilian Portuguese",
    title: "Finding the key",
    source: "A chave está em cima da mesa, ao lado da xícara.", phrase: "em cima da mesa",
    meaning: "The key is on the table, next to the cup.",
    context: "Someone explains where to find a key.",
    nextTitle: "A book in the kitchen",
    nextSource: "O livro está em cima da mesa da cozinha.",
    nextContext: "Someone is looking for a book.",
    nextMeaning: "The book is on the kitchen table.",
  },
  {
    key: "table-tr", language: "tr", variety: "Turkish",
    title: "Finding the key",
    source: "Anahtar masanın üstünde, fincanın yanında.", phrase: "masanın üstünde",
    meaning: "The key is on the table, next to the cup.",
    context: "Someone explains where to find a key.",
    nextTitle: "A book in the kitchen",
    nextSource: "Kitap mutfaktaki masanın üstünde.",
    nextContext: "Someone is looking for a book.",
    nextMeaning: "The book is on the table in the kitchen.",
  },
]);
export const sceneByKey = (key) => MOMENT_SCENES.find((s) => s.key === key);
export const sceneByLanguage = (language) => MOMENT_SCENES.find((s) => s.language === language);
const modes = ["practice", "reference", "familiar"];
const idPattern = /^moment:(?:[a-z][a-z0-9-]{0,50}|own:[a-f0-9]{64})$/;
const stringOK = (v, n) =>
  typeof v === "string" &&
  v.trim().length > 0 &&
  v.length <= n &&
  !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(v);
function keys(value, want) {
  return (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).sort().join("|") === [...want].sort().join("|")
  );
}
export function validateMomentEvent(e) {
  if (
    !keys(e, ["id", "kind", "contentId", "version", "at", "moment"]) ||
    e.kind !== "moment" ||
    !/^[A-Za-z0-9_-]{16,80}$/.test(e.id) ||
    typeof e.id !== "string" ||
    typeof e.contentId !== "string" ||
    !idPattern.test(e.contentId) ||
    !Number.isSafeInteger(e.at) ||
    e.at < 0 ||
    e.version !== 1
  )
    throw Error("Invalid moment record.");
  const m = e.moment;
  if (
    !keys(m, [
      "schemaVersion",
      "userId",
      "action",
      "mode",
      "source",
      ...(m?.action === "undo" ? ["undoOf"] : []),
    ]) ||
    m.schemaVersion !== 1 ||
    !(m.userId === null || (stringOK(m.userId, 160) && m.userId !== "!locked"))
  )
    throw Error("Invalid moment owner or fields.");
  if (
    !["keep", "mode", "reopen", "variation", "undo"].includes(m.action) ||
    (["keep", "mode"].includes(m.action)
      ? !modes.includes(m.mode)
      : m.mode !== null)
  )
    throw Error("Invalid moment action.");
  if (
    m.action === "undo" &&
    (typeof m.undoOf !== "string" || !/^[A-Za-z0-9_-]{16,80}$/.test(m.undoOf))
  )
    throw Error("Invalid undo target.");
  if (m.action === "keep" && e.contentId.startsWith("moment:own:")) {
    const s = m.source;
    if (
      !keys(s, [
        "pieceId",
        "origin",
        "title",
        "text",
        "language",
        "offset",
        "seconds",
      ]) ||
      !/^[a-f0-9]{64}$/.test(s.pieceId) ||
      !["learner", "catalogue"].includes(s.origin) ||
      !stringOK(s.title, 100) ||
      !stringOK(s.text, 600) ||
      typeof s.language !== "string" ||
      !/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})?$/.test(s.language) ||
      !Number.isSafeInteger(s.offset) ||
      s.offset < 0 ||
      s.offset > 1000000 ||
      !(
        s.seconds === null ||
        (Number.isSafeInteger(s.seconds) &&
          s.seconds >= 0 &&
          s.seconds <= 86400)
      )
    )
      throw Error("Invalid saved excerpt.");
  } else if (m.source !== null)
    throw Error("Only the first save can include a private excerpt.");
  return e;
}
export function validateMomentSequence(events) {
  const roots = new Map(),
    decisions = new Map();
  for (const e of events) {
    if (e.kind !== "moment") continue;
    const m = e.moment,
      k = JSON.stringify([m.userId, e.contentId, e.version]);
    if (m.action === "undo" && decisions.get(m.undoOf) !== k)
      throw Error("Undo must refer to an earlier choice for this moment.");
    if (m.action === "keep" || m.action === "mode") decisions.set(e.id, k);
    if (m.action === "keep") {
      const old = roots.get(k);
      if (
        old &&
        Object.keys(m.source || {}).some(
          (key) => old.moment.source?.[key] !== m.source[key],
        )
      )
        throw Error("A saved excerpt cannot change its source.");
      if (!old) roots.set(k, e);
    } else if (!roots.has(k))
      throw Error("Open or change a moment after keeping it.");
  }
}
export function projectMoments(events, userId = null, now = Date.now()) {
  const moments = new Map(),
    seen = new Set();
  const rows = events
    .filter(
      (e) => e.kind === "moment" && e.moment.userId === userId && e.at <= now,
    )
    .sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
  const undoTargets = new Set(
    rows.filter((e) => e.moment.action === "undo").map((e) => e.moment.undoOf),
  );
  const before = new Map();
  for (const e of rows) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    const m = e.moment;
    let item = moments.get(e.contentId);
    if (m.action === "undo") {
      if (item?.lastEvent === m.undoOf) {
        const previous = before.get(m.undoOf);
        if (previous) moments.set(item.id, previous);
        else moments.delete(item.id);
      }
      continue;
    }
    if (undoTargets.has(e.id))
      before.set(e.id, item ? structuredClone(item) : null);
    if (!item) {
      if (m.action !== "keep") continue;
      item = {
        id: e.contentId,
        version: e.version,
        source: m.source,
        firstAt: e.at,
        practiceSince: m.mode === "practice" ? e.at : null,
        mode: m.mode,
        dueAt: null,
        visits: [],
        variations: 0,
      };
      moments.set(item.id, item);
      if (m.mode === "practice") item.dueAt = e.at + MOMENT_DAY;
    } else if (m.action === "mode" || m.action === "keep") {
      if (item.mode !== m.mode) {
        item.mode = m.mode;
        item.practiceSince = m.mode === "practice" ? e.at : null;
        item.dueAt = m.mode === "practice" ? e.at + MOMENT_DAY : null;
      }
    } else {
      item.visits.push({ at: e.at, action: m.action });
      if (m.action === "variation") item.variations++;
      if (item.dueAt !== null && e.at >= item.dueAt) item.dueAt = null;
    }
    item.lastAt = e.at;
    item.lastEvent = e.id;
  }
  return [...moments.values()].sort(
    (a, b) => b.lastAt - a.lastAt || a.id.localeCompare(b.id),
  );
}
export function pilotCounts(moments, now = Date.now()) {
  const own = new Set(
    moments
      .filter((m) => m.source?.origin === "learner")
      .map((m) => m.source.pieceId),
  );
  const eligible = moments.filter((m) => m.practiceSince != null && now - m.practiceSince >= MOMENT_DAY);
  return {
    keptForReturn: moments.filter((m) => m.mode === "practice").length,
    eligibleAfter24h: eligible.length,
    reopenedAfter24h: eligible.filter((m) =>
      m.visits.some((v) => v.action === "reopen" && v.at <= now && v.at - m.practiceSince >= MOMENT_DAY),
    ).length,
    freshScenesOpened: moments.filter((m) => m.variations > 0).length,
    distinctPiecesBrought: own.size,
  };
}
async function digest(parts) {
  const bytes = new TextEncoder().encode(JSON.stringify(parts));
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (v) =>
    v.toString(16).padStart(2, "0"),
  ).join("");
}
export async function anchorExcerpt({
  title,
  text,
  excerpt,
  language,
  offset,
  seconds = null,
  origin = "learner",
  sourceRef = null,
}) {
  if (
    !excerpt?.trim() ||
    excerpt.length > 600 ||
    !Number.isInteger(offset) ||
    offset < 0 ||
    text.slice(offset, offset + excerpt.length) !== excerpt
  )
    throw Error(
      "Choose up to 600 characters exactly as they appear in the passage.",
    );
  const pieceId = await digest([origin, sourceRef, language, text]);
  const id =
    "moment:own:" + (await digest([pieceId, offset, excerpt, seconds]));
  const source = {
    origin,
    pieceId,
    title: (title || "My passage").trim().slice(0, 100) || "My passage",
    text: excerpt,
    language,
    offset,
    seconds,
  };
  return { id, version: 1, source };
}
