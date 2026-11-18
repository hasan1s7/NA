/**
 * Original Nabu portraits inspired by decorative arts associated with the
 * language choices. Every design retains the clay tablet, reed and crown.
 * The labels describe the artwork. They are independent of the wearer's identity.
 */
const designs = {
  en: { name: "Manuscript roses", paper: "#f1e0bb", robe: "#304c47", jewel: "#a2444a", trim: "#edbf79", motif: "rose", head: "petal", collar: "mantle", hair: ["crop", "waves"], faces: [2, 1] },
  ar: { name: "Damascene stars", paper: "#efddac", robe: "#155c59", jewel: "#24597a", trim: "#e6b85d", motif: "star", head: "tablet", collar: "woven", hair: ["braid", "curls"], faces: [2, 3] },
  "zh-CN": { name: "Jade cloud scrolls", paper: "#e2e7d0", robe: "#37655d", jewel: "#9e4636", trim: "#efbf80", motif: "cloud", head: "tablet", collar: "wrap", hair: ["knot", "knot"], faces: [1, 2] },
  fr: { name: "Gilded irises", paper: "#e9dfdb", robe: "#414568", jewel: "#6b4379", trim: "#edbc6c", motif: "iris", head: "petal", collar: "mantle", hair: ["waves", "crop"], faces: [3, 0] },
  ru: { name: "Painted rowan", paper: "#f0e3c3", robe: "#6f3340", jewel: "#ab4933", trim: "#edbe61", motif: "rowan", head: "arch", collar: "woven", hair: ["braid", "waves"], faces: [0, 1] },
  es: { name: "Talavera petals", paper: "#f6e4bc", robe: "#2d5a75", jewel: "#b65535", trim: "#f2c46c", motif: "petals", head: "petal", collar: "woven", hair: ["curls", "crop"], faces: [2, 3] },
  de: { name: "Woodcut oak", paper: "#e8e0c6", robe: "#3f5151", jewel: "#826441", trim: "#d8b577", motif: "oak", head: "arch", collar: "mantle", hair: ["crop", "curls"], faces: [1, 2] },
  it: { name: "Florentine marbling", paper: "#f0ddc0", robe: "#87483e", jewel: "#476f6e", trim: "#efc48a", motif: "marble", head: "arch", collar: "mantle", hair: ["waves", "curls"], faces: [1, 0] },
  ja: { name: "Indigo waves", paper: "#dfe8de", robe: "#2c4b70", jewel: "#517785", trim: "#ebbd7b", motif: "wave", head: "tablet", collar: "wrap", hair: ["crop", "knot"], faces: [0, 1] },
  ko: { name: "Painted lotus brackets", paper: "#e6e7ce", robe: "#3c6663", jewel: "#aa5148", trim: "#efb977", motif: "lotus", head: "petal", collar: "wrap", hair: ["knot", "crop"], faces: [1, 2] },
  pt: { name: "Cobalt tile fans", paper: "#ede9d7", robe: "#385678", jewel: "#497a99", trim: "#e7bc76", motif: "fan", head: "arch", collar: "woven", hair: ["curls", "waves"], faces: [3, 1] },
  tr: { name: "İznik tulips", paper: "#e8e4c7", robe: "#2e6075", jewel: "#a54048", trim: "#e3b569", motif: "tulip", head: "tablet", collar: "wrap", hair: ["braid", "curls"], faces: [1, 2] }
};

export const AVATAR_TRADITIONS = Object.freeze(
  Object.fromEntries(Object.entries(designs).map(([code, design]) => [code, design.name]))
);

// Miniature emblems double as a frame ornament and a woven shoulder seal.
const emblems = {
  rose: '<path fill="currentColor" d="M0-6C2-6 3-4 3-3c3-1 5 2 3 4l-2 1c1 3-2 5-4 3-2 2-5 0-4-3-4 0-5-4-2-5l2 0c0-2 1-3 2-3Z"/><circle r="1.8" fill="ivory"/>',
  star: '<path d="m0-7 2.1 3.2 3.8-1.1-.8 3.9L8 1 4 2.3l.3 4-3.6-1.8-3 2.6-.6-4-4-.5 2.7-3.1L-6-4.1l4 .4Z" fill="currentColor"/><path d="m0-2.3 2.2 2.3L0 2.4-2.2 0Z" fill="ivory"/>',
  cloud: '<path d="M-7 3h9c5 0 5-5 2-6-2-1-4 .4-4 2C-2-3-5-2-5 0m2 3h-4m5-2h3" fill="none" stroke="currentColor" stroke-width="1.8"/>',
  iris: '<path d="M0 6c-.2-4-2-8-6-10-1 4 1 7 5 7-2-3-2-7 1-10 3 3 3 7 1 10 4 0 6-3 5-7C2-2 .2 2 0 6Z" fill="currentColor"/><path d="M-2.4 3h4.8" stroke="ivory" stroke-width="1"/>',
  rowan: '<path d="M-5 5q2-7 10-10M-2 0q-4-1-4-4 4 0 4 4m4-2q2-4 5-4-1 4-5 4" fill="currentColor" stroke="currentColor" stroke-width=".9"/><g fill="currentColor"><circle cx="1.5" cy="2" r="2"/><circle cx="5.5" cy="1.1" r="1.8"/><circle cx="4" cy="5" r="1.8"/></g>',
  petals: '<g fill="currentColor"><path d="M0-1q-5-4 0-7 5 3 0 7m1 1q4-5 7 0-3 5-7 0M0 1q5 4 0 7-5-3 0-7m-1-1q-4 5-7 0 3-5 7 0Z"/><circle r="1.4"/></g>',
  oak: '<path d="M-5 6q1-4 2-5-4 1-4-2 3-1 5-1-3-2-2-5 4 0 5 3 1-3 4-3 2 4-2 7 3-1 4 0-1 4-6 3L-5 6Z" fill="currentColor"/><path d="M-4 4 3-4" fill="none" stroke="ivory" stroke-width="1"/>',
  marble: '<g fill="none" stroke="currentColor" stroke-width="1.55"><path d="M-6 4C-4-5 1 4 6-5M-4 6C-2-2 1 6 7-2M-7 1C-4-7 0 0 3-6"/></g>',
  wave: '<g fill="none" stroke="currentColor" stroke-width="1.55"><path d="M-7 3a7 7 0 0 1 14 0M-4.4 3a4.4 4.4 0 0 1 8.8 0M-1.8 3a1.8 1.8 0 0 1 3.6 0M-7 5.5h14"/></g>',
  lotus: '<path d="M-7-2q4-1 6 3-2-5 1-8 4 3 2 8 2-4 6-3-1 6-8 7-6-1-7-7Z" fill="currentColor"/><path d="M-5 6q5 2 10 0" fill="none" stroke="currentColor" stroke-width="1.2"/>',
  fan: '<g fill="none" stroke="currentColor" stroke-width="1.5"><path d="M0 5-6-1q6-8 12 0L0 5Zm0 0L-3-3m3 8 3-8m-3 8v-9M-6 5h3m6 0h3"/></g>',
  tulip: '<path d="M0 6V0m0 5q-2-4-6-3 1 3 6 3" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M0 2q-5-2-5-9l4 4 1-5 2 5 4-3Q4 1 0 2Z" fill="currentColor"/>'
};

// Skin, shadow and hair are drawn from the same palette across the series.
const complexions = [
  ["#e8b68d", "#cb8966", "#554037"],
  ["#d59c76", "#b77454", "#41332e"],
  ["#ba805c", "#965c46", "#342d2c"],
  ["#a26a4e", "#7e493b", "#2e292c"]
];

const locks = {
  crop: {
    back: "M29 48q-4-16 2-22 7-9 18-8 16-1 20 13 2 9-3 21l-6-12-23-4Z",
    fringe: "M31 41q-5-20 15-21 15-2 20 13-12 0-15-5-6 8-18 8Z",
    shine: "M36 30q7-7 16-6"
  },
  waves: {
    back: "M27 41c0-17 10-22 22-22 14 0 21 9 20 22-1 7 6 12 3 21l-7-2 3 7-13-1-17 1-14-2c7-10 0-14 3-24Z",
    fringe: "M30 41q-2-21 19-21 8-1 16 9l3 12q-11-2-16-12-6 10-20 10Z",
    shine: "M29 50q2 6-1 10m37-18q-1 8 3 13"
  },
  braid: {
    back: "M29 50q-4-30 17-31 23-2 22 27l-4 16-8-5-13 4-13 5-5-4 4-6-3-3Z",
    fringe: "M30 42q-4-20 15-22 18-4 22 16-12-1-18-8-5 8-18 10Z",
    shine: "m29 48 4 4-5 5 5 3-5 5m33-22 3 6"
  },
  knot: {
    back: "M29 47q-5-18 10-24-3-10 8-12 12-2 13 11 12 7 8 23l-4 9-7-12-22-2Z",
    fringe: "M30 43q-4-22 17-23 19-1 21 20-11-4-17-12-4 7-20 10Z",
    shine: "M42 18q5-7 11-3m-19 17 8-5"
  },
  curls: {
    back: "M26 42q-4-6 2-12-1-7 6-9 2-6 9-5 6-4 12 0 8-1 10 6 8 2 7 10 4 6-1 11l-2 10-9 5-23-7-10 4Z",
    fringe: "M29 40q-5-13 4-16 8-9 18-5 15-1 18 14l-2 8-5-8q-6 2-9-5-4 6-11 4-2 6-10 4Z",
    shine: "M30 32q1-6 7-6m18-5q5-1 8 3"
  }
};

// Side silhouettes and the writing hand remain legible in a 32px profile chip.
const feminineLocks = {
  braid: "M31 38q-6 3-5 9l2 4-3 5 3 4-3 4 2 4 5-3 1-5-2-4 2-5-2-4 2-4Z",
  waves: "M30 36q-6 5-3 16 1 6-4 12 7 0 10-8l-2 7q6-5 2-16Z",
  curls: "M31 37q-7 1-7 7-3 4 0 8-2 5 3 6-2 4-5 5 9 3 12-5l-2-4 2-6Z",
  knot: "M31 32q-4-5-8-2-4 2-3 6-3 4 .5 7-1.4 4 3 5 3 1 6-2l3-8Z",
  crop: "M31 36q-7 0-8 7 2-2 4-1-3 7 .5 12l4 2-1-7 3 3-1-8Z"
};

const diadems = {
  tablet: "M30 30 30 20 37 25 39 15 45 21 49 11 54 21 60 16 60 25 66 20 65 31Z",
  arch: "M30 30 31 22 37 25Q39 17 43 17l5-7 5 7q5 0 8 8l5-4-1 10Z",
  petal: "M30 30q-3-4-2-11l10 6q-1-7 3-10l7 7q1-8 5-11 5 6 2 13l9-8q4 8 0 15Z"
};

const neckline = {
  mantle: "M21 66q9-6 17-7l11 11 10-11q9 1 17 7L54 78l-6-5-5 5Z",
  woven: "M24 65l14-6 10 8 12-8 13 6-12 8-13 4-14-5Z",
  wrap: "m23 66 14-7 16 12 7-12 12 6-18 18-7-7Z"
};

function emblem(design, x, y, scale) {
  return `<g transform="translate(${x} ${y}) scale(${scale})" color="${design.jewel}">${emblems[design.motif]}</g>`;
}

/**
 * Return a self-contained original SVG. Unknown or non-string languages fall
 * back to the English manuscript portrait; any unrecognised form is masculine.
 * Only catalogued constants reach SVG markup, including its accessible name.
 */
export function avatarSvg(language, form) {
  const design = typeof language === "string" && Object.prototype.hasOwnProperty.call(designs, language)
    ? designs[language]
    : designs.en;
  const feminine = form === "feminine";
  const index = feminine ? 0 : 1;
  const [skin, shade, hair] = complexions[design.faces[index]];
  const style = design.hair[index];
  const lock = locks[style];
  const ink = "#382e2e";
  const bearded = !feminine && (style === "waves" || style === "curls");
  const jaw = feminine ? "M32 41q-1-15 16-17 18 2 17 17l-1 10q-4 12-15 13-12-2-16-13Z"
    : "M31 41q0-16 17-17 19 1 18 17l-1 11-6 8-9 5-11-4-7-9Z";
  const eyes = feminine ? "M37 43.5q2.2-1.9 5.5-.5m10 .2q2.6-1.9 5.4-.4" : "M37 42.8q2.8-1.1 5.7-.1m9.6.1q3.2-1.3 5.8-.7";
  const signature = `<path d="m40 77 3 1.2-2.4 1.7m5.7-3.2 3 1.2-2.3 1.7m-7 2.6 3 1.2-2.4 1.7m6-3.3 3 1.2-2.4 1.7" fill="none" stroke="#79462f" stroke-width="1.3"/>`;
  return `<svg class="nabu-avatar-art" width="96" height="96" viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${feminine ? "Feminine" : "Masculine"} Nabu scribe, ${design.name}" focusable="false">
    <g stroke-linecap="round" stroke-linejoin="round">
      <circle cx="48" cy="48" r="46.3" fill="${design.robe}"/>
      <circle cx="48" cy="48" r="43.8" fill="${design.paper}" stroke="${design.trim}" stroke-width="1.2"/>
      <circle cx="48" cy="46" r="29.6" fill="${design.trim}" opacity=".53"/><circle cx="48" cy="46" r="26.6" fill="none" stroke="${design.jewel}" stroke-width=".75" opacity=".65"/>
      ${emblem(design, 16, 36, .78)}${emblem(design, 80, 36, .78)}${emblem(design, 12.8, 51, .52)}${emblem(design, 83.2, 51, .52)}
      <path d="M22 22q4-5 10-7m32 0q6 2 10 7" fill="none" stroke="${design.jewel}" stroke-width="1.2"/><g fill="${design.jewel}"><circle cx="19" cy="26" r="1.35"/><circle cx="77" cy="26" r="1.35"/></g>
      <path d="${lock.back}" fill="${hair}" stroke="${ink}" stroke-width="1.25"/>
      <path d="M12 70q8-10 26-12h20q17 1 26 12a42.2 42.2 0 0 1-72 0Z" fill="${design.robe}" stroke="${ink}" stroke-width="1.45"/>
      <path d="M41 54v6l7 9 9-10-2-7" fill="${shade}" stroke="${ink}" stroke-width="1.2"/>
      <path d="${neckline[design.collar]}" fill="${design.jewel}" stroke="${design.trim}" stroke-width="1.55"/>
      <path d="m23 72 8 10m40-11-6 10" fill="none" stroke="${design.paper}" stroke-width="1.1" opacity=".58"/>
      <g fill="${shade}" stroke="${ink}" stroke-width="1.1"><ellipse cx="31.5" cy="45.5" rx="3.8" ry="5.4"/><ellipse cx="65" cy="45.2" rx="3.5" ry="5.3"/></g>
      <path d="${jaw}" fill="${skin}" stroke="${ink}" stroke-width="1.45"/>
      <path d="M60 37q5 9 0 19l-5 4q9-2 10-14l-1-8Z" fill="${shade}" opacity=".66"/>
      <path d="${lock.fringe}" fill="${hair}"/><path d="${lock.shine}" stroke="${design.trim}" stroke-width=".85" opacity=".65" fill="none"/>
      <path d="${diadems[design.head]}" fill="${design.robe}" stroke="${design.trim}" stroke-width="1.65"/>
      <path d="M31 28q16 4 33 0" fill="none" stroke="${design.trim}" stroke-width="1.3"/>
      <path d="m48 18 3 5-3 4-3-4Z" fill="${design.trim}"/>
      <g fill="none" stroke="${ink}"><path d="m36 39 7-1.6m9.5.2 6 1" stroke-width="${feminine ? 1.2 : 1.8}"/><path d="${eyes}" stroke-width="1.7"/><path d="m48.2 43-1.8 6.3 3.7.1" stroke-width="1.1"/></g>
      ${bearded ? `<path d="M33 48q3 4 7 6 8-4 16-.5 5-3 8.6-7l-.8 7.9-5.8 6.2-8.8 5-9.6-4.7-6.3-8Z" fill="${hair}"/><path d="m42 58 7 3 7-3m-10.3-3 3.1.4 3.3-.6" fill="none" stroke="${skin}" stroke-width="1"/>`
        : `<path d="m43.5 54.3 4.9.9 4.4-1.2" fill="none" stroke="${ink}" stroke-width="1.35"/><path d="m46 57.4 4.6-.1" stroke="${shade}" stroke-width="1.15"/>`}
      <g fill="${design.trim}" stroke="${design.robe}" stroke-width=".8"><circle cx="30.5" cy="50.2" r="${feminine ? 2.3 : 1.55}"/><circle cx="65.4" cy="50" r="${feminine ? 2.3 : 1.55}"/></g>
      ${feminine ? `<path d="${feminineLocks[style]}" fill="${hair}" stroke="${ink}" stroke-width="1.05"/><path d="m26 45 4 .8" stroke="${design.trim}" stroke-width="1.5"/><path d="m65.5 51 1.6 3.4-1.7 2.4-1.5-2.5Z" fill="${design.trim}" stroke="${design.robe}" stroke-width=".8"/>` : ""}
      <path d="m47.8 65.4 3.6 3.4-3.6 3.2-3.4-3.2Z" fill="${design.trim}" stroke="${ink}" stroke-width=".9"/>
      <g transform="rotate(${feminine ? 7 : -7} 47 80)"><rect x="33" y="72" width="29.5" height="16.8" rx="3.7" fill="#c78b63" stroke="${ink}" stroke-width="1.5"/><path d="M36 75q10-1.3 23-.6" stroke="#ebba8e" stroke-width="1.15" fill="none"/>${signature}</g>
      <g transform="${feminine ? "translate(96 0) scale(-1 1)" : "translate(0)"}"><path d="m62.5 83 .7-5.4 10.3-23.8 2.8 1.3-10.9 23.6Z" fill="${design.trim}" stroke="${ink}" stroke-width="1.2"/>
      <path d="m31 75q4-1 6 2 .7 2-2.7 2.6 3.1 1.9.8 3.5-5.3.2-6.5-3.9-.1-2.6 2.4-4.2Zm32 1.5q2-3 4.5-2.2 3.1 1 .8 5.3-1.1 2.2-3.3 2.6l-2.3-1.2q-1.5-1.2.1-2.7Z" fill="${skin}" stroke="${ink}" stroke-width="1.2"/></g>
    </g>
  </svg>`;
}
