/** Original authored checks. Returning to an unanalysed excerpt never creates a rubric. */
import * as Moments from "./nabu-moments.js";
const definitions = [
  [
    "bend",
    "first",
    "شو عم يطلب الراكب من السوّاق؟",
    ["خفّف السرعة.", "وقّف السيارة هون.", "إطلع من السيارة."],
    0,
  ],
  [
    "bend",
    "next",
    "شو عم يقلّه لصاحبه؟",
    ["لازم يوصل هلّق.", "فيه ياخد وقته.", "نسي المعطف."],
    1,
  ],
  [
    "camille",
    "first",
    "La personne qui répond a-t-elle parlé du départ à Camille ?",
    ["Oui.", "Non.", "Elle ne se souvient plus."],
    1,
  ],
  [
    "camille",
    "next",
    "Quand la personne compte-t-elle lui en parler ?",
    ["Elle en a déjà parlé.", "Ce soir.", "Demain."],
    2,
  ],
  [
    "camille",
    "old-key",
    "Camille est-elle au courant du départ ?",
    ["Oui.", "Non.", "Le dialogue ne le dit pas."],
    1,
  ],
  [
    "dream",
    "first",
    "¿Qué cuenta esta persona?",
    ["Un viaje que compró.", "Algo que soñó.", "Una casa que quiere vender."],
    1,
  ],
  [
    "dream",
    "next",
    "¿Dónde estaba la estación?",
    ["En un sueño.", "En el camino al trabajo.", "En un plano."],
    0,
  ],
];
const correctionText =
  "Camille could have heard about the departure elsewhere. The dialogue establishes only what this speaker told Camille.";
const readingTasks = definitions.map(
  ([key, stage, prompt, options, answer]) => {
    const scene = Moments.sceneByKey(key),
      next = stage === "next";
    const id = "moment-task:" + key + ":" + stage,
      source = next ? scene.nextSource : scene.source,
      meaning = next ? scene.nextMeaning : scene.meaning;
    const image = next ? scene.nextImage : scene.image;
    return {
      id,
      version: 1,
      momentKey: key,
      momentStage: stage,
      sampleId: "moment:" + key + ":" + (next ? "next" : "first"),
      language: scene.language,
      title:
        stage === "old-key"
          ? "Review a historical answer key"
          : next
            ? scene.nextTitle
            : scene.title,
      type: "recognition",
      inputModality: "written",
      responseModality: "choice",
      source,
      sourceContext: source,
      meaning,
      prompt,
      options,
      mediaRef: {
        id: "moment-scene:" + key + ":" + (next ? "next" : "first"),
        version: 1,
      },
      analysisRef: { id: "moment-analysis:" + key + ":" + stage, version: 1 },
      targetIds: [
        stage === "old-key"
          ? "fr:demo:unfair-inference"
          : "moment-target:" + key,
      ],
      condition: {
        level: "construction",
        scopeId: "moment-target:" + key,
        itemId: "moment:" + key + ":" + (next ? "next" : "first"),
        contextId: key + ":" + (next ? "next" : "first"),
        speakerId: "written-dialogue",
        variety: scene.variety,
      },
      supports: [
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
          text: options.join(" / "),
        },
        ...(image
          ? [
              {
                id: "scene",
                type: "scene-context",
                visibility: "visible",
                role: "task",
                text: next ? scene.nextContext : scene.context,
              },
            ]
          : []),
        {
          id: "translation",
          type: "translation",
          visibility: "hidden",
          role: "extra",
          text: meaning,
        },
      ],
      image,
      alt: next ? scene.nextAlt : scene.alt,
      sceneContext: next ? scene.nextContext : scene.context,
      correctChoice: answer,
      scoring: "binary",
      guess: 1 / options.length,
      slip: 0.08,
      difficulty: 0,
      scoringReliability: 0.85,
      provenance:
        stage === "old-key"
          ? "Historical scoring demonstration. This question has a reviewed correction."
          : "Original Nabu scene. Written recognition with the displayed cues.",
      explanation: stage === "old-key" ? correctionText : meaning,
      answerPolicy:
        "The response is assessed only for this question and these cues.",
      ...(stage === "old-key"
        ? {
            reviewedCorrection: {
              label: "Apply the reviewed correction",
              note: correctionText,
            },
          }
        : {}),
    };
  },
);
const camille = readingTasks.find((t) => t.id === "moment-task:camille:first");
const extraFrench = (stage, fields) => ({
  ...camille,
  id: "moment-task:camille:" + stage,
  momentStage: stage,
  analysisRef: { id: "moment-analysis:camille:" + stage, version: 1 },
  condition: {
    ...camille.condition,
    contextId: "camille:" + stage,
    speakerId: stage === "listen" ? "device-synthetic-voice" : "written-author",
  },
  ...fields,
});
const listen = extraFrench("listen", {
  title: "Listen for what happened",
  inputModality: "auditory",
  source: "Je ne lui en ai pas parlé.",
  prompt: "La personne a-t-elle abordé le sujet ?",
  options: ["Oui.", "Non."],
  correctChoice: 1,
  guess: 0.5,
  provenance:
    "Original French sentence. Listening requires completed playback of an installed device voice.",
  supports: [
    {
      id: "choices",
      type: "options",
      visibility: "visible",
      role: "task",
      text: "Oui / Non",
    },
    {
      id: "transcript",
      type: "transcript",
      visibility: "hidden",
      role: "extra",
      text: "Je ne lui en ai pas parlé.",
    },
    {
      id: "translation",
      type: "translation",
      visibility: "hidden",
      role: "extra",
      text: "I did not talk to them about it.",
    },
  ],
});
const prompt =
  "Tu as parlé du départ à Camille ? Réponds que non en utilisant lui et en.";
const write = extraFrench("write", {
  title: "Write your reply",
  type: "contextual-production",
  responseModality: "text",
  source: "Je ne lui en ai pas parlé.",
  prompt,
  options: null,
  correctChoice: null,
  guess: 0.03,
  scoring: "ordinal",
  meaning: "I did not talk to them about it.",
  provenance:
    "Original writing prompt. Other possible phrasings are left for review.",
  supports: [
    {
      id: "prompt",
      type: "scene-context",
      visibility: "visible",
      role: "task",
      text: prompt,
    },
    {
      id: "example",
      type: "earlier-answer",
      visibility: "hidden",
      role: "extra",
      text: "Je ne lui en ai pas parlé.",
    },
  ],
  rubric: {
    full: ["Je ne lui en ai pas parlé.", "Je lui en ai pas parlé."],
    partial: ["Je ne lui ai pas parlé."],
    incorrect: ["Je lui en ai parlé."],
  },
});
export const MOMENT_TASKS = Object.freeze([...readingTasks, listen, write]);
export const MOMENT_ANALYSES = MOMENT_TASKS.flatMap((t) => {
  const analysis = {
    ...t.analysisRef,
    mediaRef: t.mediaRef,
    status: "authored",
    weightsProvisional: true,
    uncertainty: {
      transcription: "Authored text",
      segmentation: "Authored",
      construction: "Item-specific prompt",
      meaning: "Bounded to the dialogue",
      scope: "Question as written",
      variety: t.condition.variety,
    },
    hypotheses: [
      {
        id: "editorial-reading",
        weight: 1,
        difficultyOffset: 0,
        answers: {
          [t.id]: t.rubric || {
            choice: t.correctChoice,
            full: [],
            partial: [],
          },
        },
      },
    ],
  };
  return t.reviewedCorrection
    ? [
        analysis,
        {
          ...analysis,
          version: 2,
          status: "retired",
          retirementReason: correctionText,
        },
      ]
    : [analysis];
});
