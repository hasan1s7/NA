/** Small, authored dialogue fixtures and adapters for the existing catalogue.
 * No claim of automatic parsing,
 * speech recognition, or a validated semantic scorer for arbitrary media. */
import { CATALOG } from "./nabu-content-catalogue.js";
import * as MomentTasks from "./nabu-moment-tasks.js";
const copy = (x) => structuredClone(x);
const targets = ["fr:negation:ne-pas", "fr:clitics:lui-en"];
const samples = [
  {
    id: "conversation",
    text: "Je ne lui en ai pas parlé.",
    meaning: "I haven't talked to him/her about it.",
    variety: "written-standard",
    context: "conversation-about-a-plan",
  },
  {
    id: "message",
    text: "Je ne lui en ai pas encore parlé.",
    meaning: "I haven't talked to him/her about it yet.",
    variety: "written-standard",
    context: "message-about-a-plan",
  },
  {
    id: "conversation-colloquial",
    text: "Je lui en ai pas parlé.",
    meaning: "I haven't talked to him/her about it.",
    variety: "conversational-ne-omitted",
    context: "informal-conversation",
  },
  {
    id: "uncertain-transcript",
    text: "Je lui en ai … parlé.",
    meaning: "Transcript needs review.",
    variety: "unresolved",
    context: "uncertain-segment",
  },
];
const definitions = [
  [
    "recognize",
    "conversation",
    "recognition",
    "written",
    "choice",
    "item",
    "Choose the meaning",
    [
      "I talked to them about it.",
      "I haven't talked to him/her about it.",
      "I will tell them about it.",
    ],
  ],
  [
    "meaning",
    "conversation",
    "meaning-recall",
    "written",
    "text",
    "construction",
    "Recall the meaning",
    null,
  ],
  [
    "variation",
    "message",
    "meaning-recall",
    "written",
    "text",
    "construction",
    "Try a new context",
    null,
  ],
  [
    "form",
    "conversation",
    "form-recall",
    "written",
    "text",
    "item",
    "Recall the French form",
    null,
  ],
  [
    "produce",
    "message",
    "contextual-production",
    "written",
    "text",
    "construction",
    "Write in a context",
    null,
  ],
  [
    "listen",
    "conversation",
    "meaning-recall",
    "auditory",
    "text",
    "construction",
    "Listen without a transcript",
    null,
  ],
  [
    "listen-variation",
    "conversation-colloquial",
    "meaning-recall",
    "auditory",
    "text",
    "construction",
    "Listen to a conversational variant",
    null,
  ],
  [
    "uncertain",
    "uncertain-transcript",
    "meaning-recall",
    "written",
    "text",
    "construction",
    "Check an uncertain transcript",
    null,
  ],
];
const frenchTasks = definitions.map(
  ([
    key,
    sampleId,
    type,
    inputModality,
    responseModality,
    level,
    title,
    options,
  ]) => {
    const s = samples.find((x) => x.id === sampleId),
      id = "support:fr:" + key;
    const sourceVisible =
      inputModality === "written" &&
      !["form-recall", "contextual-production"].includes(type);
    const prompt =
      type === "form-recall"
        ? "Write this in French: I haven't talked to him/her about it. Use lui and en."
        : type === "contextual-production"
          ? "A friend asks whether you have discussed the plan with Marie. You haven't done so yet. Write one French sentence using lui, en, and encore."
          : inputModality === "auditory"
            ? "Listen, then give the meaning in English."
            : "What does this sentence mean in English?";
    const supports = [
      ...(sourceVisible
        ? [
            {
              id: "source",
              type: "transcript",
              visibility: "visible",
              role: "task",
              text: s.text,
            },
          ]
        : []),
      ...(type === "form-recall"
        ? [
            {
              id: "meaning-prompt",
              type: "translation",
              visibility: "visible",
              role: "task",
              text: prompt,
            },
          ]
        : []),
      ...(type === "contextual-production"
        ? [
            {
              id: "scene-prompt",
              type: "scene-context",
              visibility: "visible",
              role: "task",
              text: prompt,
            },
          ]
        : []),
      ...(options
        ? [
            {
              id: "choices",
              type: "options",
              visibility: "visible",
              role: "task",
              text: options.join(" / "),
            },
          ]
        : []),
      {
        id: "translation",
        type: "translation",
        visibility: "hidden",
        role: "extra",
        text: s.meaning,
      },
      {
        id: "structure",
        type: "highlighting",
        visibility: "hidden",
        role: "extra",
        text: "ne … pas marks negation here. lui refers to the person; en refers to the topic. The conversational variant in this demo omits ne.",
      },
      {
        id: "gloss",
        type: "gloss",
        visibility: "hidden",
        role: "extra",
        text: "parler de quelque chose à quelqu’un — talk to someone about something.",
      },
      ...(!sourceVisible
        ? [
            {
              id: "transcript",
              type: "transcript",
              visibility: "hidden",
              role: "extra",
              text: s.text,
            },
          ]
        : []),
    ];
    return {
      id,
      version: 1,
      sampleId,
      language: "fr",
      title,
      type,
      inputModality,
      responseModality,
      source: s.text,
      meaning: s.meaning,
      prompt,
      options,
      mediaRef: { id: "support-dialogue:" + sampleId, version: 1 },
      analysisRef: { id: "support-analysis:" + sampleId, version: 1 },
      targetIds: targets,
      condition: {
        level,
        scopeId:
          level === "item"
            ? "fr:phrase:" + sampleId
            : "fr:negative-clitic-cluster",
        itemId: sampleId,
        contextId: s.context,
        speakerId:
          inputModality === "auditory"
            ? "device-synthetic-voice"
            : "written-author",
        variety: s.variety,
      },
      supports,
      guess: options ? 1 / options.length : 0.03,
      slip: 0.08,
      difficulty: 0,
      scoringReliability: 0.85,
      scoring: options ? "binary" : "ordinal",
      answerPolicy:
        "Bounded authored answers, normalized spelling and punctuation; other phrasings need review.",
      provenance: "Nabu-authored demonstration dialogue, not captured media.",
    };
  },
);
const catalogueTasks = CATALOG.items.flatMap((item) =>
  item.practice.map((p) => {
    const a = item.annotations.find((a) => a.id === p.annotationId),
      segment = item.segments.find((s) => s.id === a.segmentId),
      recall = p.mode === "recall";
    const source =
      p.mode === "related-context"
        ? p.prompt.match(/«([^»]+)»/u)?.[1] || a.quote
        : recall
          ? a.quote
          : segment.text;
    const supports = [
      {
        id: "primary-prompt",
        type: recall ? "translation" : "transcript",
        visibility: "visible",
        role: "task",
        text: p.prompt,
      },
      ...(!recall
        ? [
            {
              id: "source",
              type: "transcript",
              visibility: "visible",
              role: "task",
              text: source,
            },
            {
              id: "choices",
              type: "options",
              visibility: "visible",
              role: "task",
              text: p.options.join(" / "),
            },
          ]
        : []),
      {
        id: "gloss",
        type: "gloss",
        visibility: "hidden",
        role: "extra",
        text: a.meaning,
      },
      {
        id: "hint",
        type: "gloss",
        label: "contextual hint",
        visibility: "hidden",
        role: "extra",
        text: p.hint,
      },
      {
        id: "transcript",
        type: "transcript",
        visibility: "hidden",
        role: "extra",
        text: segment.text,
      },
    ];
    if (recall && p.prompt.includes(a.quote))
      supports.push({
        id: "form-in-prompt",
        type: "earlier-answer",
        visibility: "visible",
        role: "extra",
        text: "This prompt includes the requested form, so this is supported practice.",
      });
    return {
      id: "support:catalogue:" + item.id + ":" + p.id,
      version: 1,
      sampleId: "catalogue:" + item.id,
      language: item.language,
      title:
        item.titleTranslation +
        " · " +
        (recall
          ? "recall the expression"
          : p.mode === "related-context"
            ? "new context"
            : "recognize meaning"),
      type: recall ? "form-recall" : "recognition",
      inputModality: "written",
      responseModality: recall ? "text" : "choice",
      source,
      sourceContext: segment.text,
      meaning: a.meaning,
      savedSource: a.quote,
      prompt: p.prompt,
      options: p.options || null,
      mediaRef: { id: item.id, version: item.version },
      analysisRef: { id: "support-analysis:catalogue:" + item.id, version: 1 },
      targetIds: ["catalogue:" + item.id + ":" + a.id],
      condition: {
        level: "item",
        scopeId: "catalogue:" + item.id + ":" + a.id,
        itemId: item.id + ":" + a.id,
        contextId: "catalogue:" + item.id + ":" + p.id,
        speakerId: "written-author",
        variety: item.register,
      },
      supports,
      guess: recall ? 0.03 : 1 / p.options.length,
      slip: 0.08,
      difficulty: 0,
      scoringReliability: 0.85,
      scoring: recall ? "ordinal" : "binary",
      answerPolicy:
        "Existing " +
        (p.answerPolicy || "authored choice") +
        " rubric; unreviewed wording is left unscored.",
      provenance: "Existing Nabu media: " + item.editorialStatus,
      explanation: p.explanation,
      accepted: p.accepted || [],
      correctChoice: p.answer ?? null,
      answerPolicyId: p.answerPolicy || "choice",
    };
  }),
);
export const SUPPORT_TASKS = Object.freeze([
  ...frenchTasks,
  ...catalogueTasks,
  ...MomentTasks.MOMENT_TASKS,
]);
function answersFor(task, positive = false) {
  if (task.type === "recognition") return { choice: 1, full: [], partial: [] };
  if (task.type === "form-recall")
    return {
      full: ["Je ne lui en ai pas parlé."],
      partial: ["Je ne lui ai pas parlé."],
      incorrect: ["Je lui en ai parlé."],
    };
  if (task.type === "contextual-production")
    return {
      full: [
        "Je ne lui en ai pas encore parlé.",
        "Je lui en ai pas encore parlé.",
      ],
      partial: ["Je ne lui ai pas encore parlé.", "Je ne lui en ai pas parlé."],
      incorrect: ["Je lui en ai parlé."],
    };
  const yet = task.sampleId === "message" ? " yet" : "";
  if (positive)
    return {
      full: ["I talked to him about it.", "I talked to her about it."],
      partial: [],
    };
  return {
    full: [
      `I haven't talked to him/her about it${yet}.`,
      `I haven't talked to him about it${yet}.`,
      `I haven't talked to her about it${yet}.`,
      `I have not talked to him about it${yet}.`,
      `I have not talked to her about it${yet}.`,
    ],
    partial: ["I haven't talked.", "I didn't talk to him."],
    incorrect: [
      "I talked to him about it.",
      "I talked to her about it.",
      "I will talk to him about it.",
    ],
  };
}
export const SUPPORT_ANALYSES = Object.freeze([
  ...MomentTasks.MOMENT_ANALYSES,
  ...samples.flatMap((s) => {
    const tasks = SUPPORT_TASKS.filter((t) => t.sampleId === s.id),
      answers = Object.fromEntries(tasks.map((t) => [t.id, answersFor(t)]));
    const uncertainty = {
      transcription:
        s.id === "uncertain-transcript"
          ? "unresolved segment"
          : "authored text",
      segmentation: "authored",
      construction: "authored candidate",
      meaning: "person and topic referents unresolved",
      scope: "sentence negation",
      variety: s.variety,
    };
    const base = {
      id: "support-analysis:" + s.id,
      version: 1,
      mediaRef: { id: "support-dialogue:" + s.id, version: 1 },
      status: "authored",
      uncertainty,
      weightsProvisional: true,
      hypotheses: [
        { id: "person-one", weight: 0.5, difficultyOffset: 0, answers },
        {
          id: "person-two",
          weight: 0.5,
          difficultyOffset: 0.15,
          answers: copy(answers),
        },
      ],
    };
    if (s.id !== "uncertain-transcript") return [base];
    base.hypotheses[1].answers = Object.fromEntries(
      tasks.map((t) => [t.id, answersFor(t, true)]),
    );
    return [
      base,
      {
        ...copy(base),
        version: 2,
        uncertainty: {
          ...uncertainty,
          transcription: "authored correction: pas retained",
        },
        hypotheses: [copy(base.hypotheses[0])],
      },
    ];
  }),
  ...CATALOG.items.map((item) => ({
    id: "support-analysis:catalogue:" + item.id,
    version: 1,
    mediaRef: { id: item.id, version: item.version },
    status: "authored",
    weightsProvisional: true,
    uncertainty: {
      transcription: "existing authored catalogue",
      segmentation: "exact source anchors",
      construction: "no construction-generalization claim",
      meaning: "authored annotation; " + item.editorialStatus,
      scope: "task-specific phrase",
      variety: item.register,
    },
    hypotheses: [
      {
        id: "existing-authored-rubric",
        weight: 1,
        difficultyOffset: 0,
        answers: Object.fromEntries(
          catalogueTasks
            .filter((t) => t.mediaRef.id === item.id)
            .map((t) => [
              t.id,
              t.type === "form-recall"
                ? { full: t.accepted, partial: [] }
                : { choice: t.correctChoice, full: [], partial: [] },
            ]),
        ),
      },
    ],
  })),
]);
export function supportTask(ref) {
  const r = typeof ref === "string" ? { id: ref, version: 1 } : ref;
  return copy(
    SUPPORT_TASKS.find((t) => t.id === r?.id && t.version === r.version) ||
      null,
  );
}
export function supportAnalysis(ref) {
  return copy(
    SUPPORT_ANALYSES.find(
      (a) => a.id === ref?.id && a.version === ref.version,
    ) || null,
  );
}
export function supportTasksForSaved(cards) {
  const text = (s) =>
    String(s || "")
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[.!?]+$/u, "")
      .trim();
  const ids = new Set(
    cards
      .filter((c) => !c.archived)
      .flatMap((c) =>
        SUPPORT_TASKS.filter(
          (t) =>
            !t.momentKey &&
            text(c.front) === text(t.savedSource || t.source) &&
            (!c.provenance?.startsWith("Nabu source: ") ||
              c.provenance.startsWith(
                "Nabu source: " +
                  t.mediaRef.id +
                  "@" +
                  t.mediaRef.version +
                  ";",
              )),
        ).map((t) => t.id),
      ),
  );
  return SUPPORT_TASKS.filter((t) => ids.has(t.id)).map(copy);
}
