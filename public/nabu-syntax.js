/**
 * Nabu 1.13 structural ambiguity support.
 *
 * This is an authored, bounded evidence layer: it does not parse arbitrary
 * sentences, call a model, or update learner mastery. Each case declares two
 * plausible analyses and a small set of diagnostics with explicit outcome
 * distributions. The UI may therefore preserve uncertainty rather than invent
 * a single structure.
 */

export const CASES = Object.freeze([
  {
    id: 'en-pp-telescope-1',
    language: 'en',
    source: 'The researcher photographed the student with the telescope.',
    shortLabel: 'PP attachment',
    note: 'The phrase “with the telescope” can describe the student or the photographing event.',
    analyses: [
      {
        id: 'np',
        label: 'Student-associated',
        meaning: 'The student is the one associated with the telescope.',
        structure: '[VP photographed [NP the student [PP with the telescope]]]'
      },
      {
        id: 'vp',
        label: 'Instrumental',
        meaning: 'The researcher used the telescope to take the photograph.',
        structure: '[VP [VP photographed the student] [PP with the telescope]]'
      }
    ],
    prior: [0.5, 0.5],
    diagnostics: [
      {
        id: 'movement',
        label: 'Move the phrase',
        compact: 'Movement',
        prompt: 'Move “with the telescope” to the front.',
        transformed: 'With the telescope, the researcher photographed the student.',
        outcomes: ['student', 'instrument', 'unclear'],
        distributions: [
          [0.28, 0.18, 0.54],
          [0.06, 0.82, 0.12]
        ],
        observed: 'instrument',
        reliability: 0.9,
        reading: 'The moved sentence strongly prefers the instrumental reading.',
        caveat: 'Grammaticality alone is not decisive: movement can force reinterpretation.'
      },
      {
        id: 'substitution',
        label: 'Substitute a nominal',
        compact: 'Substitution',
        prompt: 'Replace the student phrase with a nominal proform.',
        transformed: 'The researcher photographed the one with the telescope.',
        outcomes: ['student', 'instrument', 'unclear'],
        distributions: [
          [0.78, 0.05, 0.17],
          [0.34, 0.38, 0.28]
        ],
        observed: 'student',
        reliability: 0.65,
        reading: 'This makes a student-associated grouping easy to recover.',
        caveat: 'Reference and discourse can make substitution look cleaner than the original syntax warrants.'
      },
      {
        id: 'coordination',
        label: 'Coordinate a parallel phrase',
        compact: 'Coordination',
        prompt: 'Coordinate with a parallel student + instrument phrase.',
        transformed: 'The researcher photographed the student with the telescope and the professor with the binoculars.',
        outcomes: ['student', 'instrument', 'unclear'],
        distributions: [
          [0.27, 0.15, 0.58],
          [0.19, 0.22, 0.59]
        ],
        observed: 'unclear',
        reliability: 0.45,
        reading: 'Both analyses can survive this coordination pattern.',
        caveat: 'This diagnostic is intentionally inconclusive; coordination is not a universal constituency theorem.'
      }
    ]
  },
  {
    id: 'es-pp-telescopio-1',
    language: 'es',
    source: 'La investigadora fotografió al estudiante con el telescopio.',
    shortLabel: 'Adjunción de PP',
    note: '“Con el telescopio” puede asociarse con el estudiante o con el evento de fotografiar.',
    analyses: [
      {
        id: 'np',
        label: 'Asociado al estudiante',
        meaning: 'El estudiante es quien está asociado con el telescopio.',
        structure: '[VP fotografió [NP al estudiante [PP con el telescopio]]]'
      },
      {
        id: 'vp',
        label: 'Instrumental',
        meaning: 'La investigadora utilizó el telescopio para fotografiar.',
        structure: '[VP [VP fotografió al estudiante] [PP con el telescopio]]'
      }
    ],
    prior: [0.5, 0.5],
    diagnostics: [
      {
        id: 'movement',
        label: 'Mover la frase',
        compact: 'Movimiento',
        prompt: 'Mueve “con el telescopio” al principio.',
        transformed: 'Con el telescopio, la investigadora fotografió al estudiante.',
        outcomes: ['student', 'instrument', 'unclear'],
        distributions: [[0.25,0.2,0.55],[0.06,0.82,0.12]],
        observed: 'instrument',
        reliability: 0.9,
        reading: 'La frase desplazada favorece fuertemente la lectura instrumental.',
        caveat: 'El movimiento puede cambiar la lectura; la mera gramaticalidad no resuelve todo.'
      },
      {
        id: 'substitution',
        label: 'Sustituir el nominal',
        compact: 'Sustitución',
        prompt: 'Haz explícita la lectura nominal con un sustituto.',
        transformed: 'La investigadora fotografió al que tenía el telescopio.',
        outcomes: ['student', 'instrument', 'unclear'],
        distributions: [[0.82,0.04,0.14],[0.30,0.42,0.28]],
        observed: 'student',
        reliability: 0.62,
        reading: 'La sustitución recupera con facilidad la lectura asociada al estudiante.',
        caveat: 'Es una intervención semánticamente fuerte, por eso recibe menor peso.'
      },
      {
        id: 'coordination',
        label: 'Coordinar',
        compact: 'Coordinación',
        prompt: 'Añade un segundo estudiante con un instrumento paralelo.',
        transformed: 'La investigadora fotografió al estudiante con el telescopio y al profesor con los binoculares.',
        outcomes: ['student', 'instrument', 'unclear'],
        distributions: [[0.26,0.15,0.59],[0.19,0.21,0.60]],
        observed: 'unclear',
        reliability: 0.45,
        reading: 'La coordinación no separa limpiamente las dos estructuras.',
        caveat: 'Nabu conserva la ambigüedad en lugar de forzar una conclusión.'
      }
    ]
  },
  {
    id: 'ar-pp-telescope-1',
    language: 'ar',
    source: 'صوّر الباحث الطالب بالمنظار.',
    shortLabel: 'تعلّق شبه الجملة',
    note: 'قد تُفهم «بالمنظار» على أنها مرتبطة بالطالب أو بطريقة التصوير.',
    analyses: [
      {
        id: 'np',
        label: 'مرتبطة بالطالب',
        meaning: 'المنظار مرتبط بالطالب في القراءة المقصودة.',
        structure: '[VP صوّر [NP الطالب [PP بالمنظار]]]'
      },
      {
        id: 'vp',
        label: 'أداة للتصوير',
        meaning: 'استخدم الباحث المنظار في عملية التصوير.',
        structure: '[VP [VP صوّر الباحث الطالب] [PP بالمنظار]]'
      }
    ],
    prior: [0.5, 0.5],
    diagnostics: [
      {
        id: 'movement',
        label: 'قدّم شبه الجملة',
        compact: 'التقديم',
        prompt: 'قدّم «بالمنظار» إلى أول الجملة.',
        transformed: 'بالمنظار، صوّر الباحث الطالب.',
        outcomes: ['student', 'instrument', 'unclear'],
        distributions: [[0.20,0.25,0.55],[0.05,0.84,0.11]],
        observed: 'instrument',
        reliability: 0.9,
        reading: 'التقديم يجعل قراءة الأداة في التصوير أوضح بكثير.',
        caveat: 'لكن التقديم قد يفرض إعادة تحليل، لذلك لا تكفي سلامة الجملة وحدها.'
      },
      {
        id: 'substitution',
        label: 'اجعل القراءة الاسمية صريحة',
        compact: 'الاستبدال',
        prompt: 'استبدل العبارة بتعبير يوضح ارتباط المنظار بالطالب.',
        transformed: 'صوّر الباحث الطالب الذي معه المنظار.',
        outcomes: ['student', 'instrument', 'unclear'],
        distributions: [[0.84,0.03,0.13],[0.27,0.45,0.28]],
        observed: 'student',
        reliability: 0.58,
        reading: 'هذه الصياغة تستعيد قراءة ارتباط المنظار بالطالب.',
        caveat: 'الصياغة أكثر صراحة من الأصل، لذلك وزنها أقل من اختبار التقديم.'
      },
      {
        id: 'coordination',
        label: 'نسّق عبارتين متوازيتين',
        compact: 'العطف',
        prompt: 'اعطف طالباً آخر مع أداة أخرى.',
        transformed: 'صوّر الباحث الطالب بالمنظار والأستاذ بالكاميرا.',
        outcomes: ['student', 'instrument', 'unclear'],
        distributions: [[0.25,0.17,0.58],[0.18,0.22,0.60]],
        observed: 'unclear',
        reliability: 0.4,
        reading: 'العطف هنا لا يفصل بوضوح بين التحليلين.',
        caveat: 'هذه نتيجة غير حاسمة مقصودة؛ لا يدّعي Nabu أن العطف اختبار قطعي.'
      }
    ]
  }
]);


export function normalizeSyntaxText(value) {
  return String(value || '')
    .normalize('NFC')
    .toLocaleLowerCase()
    .replace(/[\u061f\u060c.,!?;:…“”"'«»()\[\]{}]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

export function findCase(text, language = '') {
  const haystack = normalizeSyntaxText(text);
  if (!haystack) return null;
  return CASES.find(item => (!language || item.language === language) && haystack.includes(normalizeSyntaxText(item.source))) || null;
}

function normalizeProbabilities(values) {
  const clean = values.map(v => Number.isFinite(v) && v > 0 ? v : 0);
  const total = clean.reduce((a,b) => a+b, 0);
  if (!total) return clean.map(() => 1 / clean.length);
  return clean.map(v => v / total);
}

export function posterior(item, history = []) {
  if (!item?.analyses?.length) return [];
  let probs = normalizeProbabilities(item.prior?.length === item.analyses.length ? item.prior : item.analyses.map(() => 1));
  const used = new Set();
  for (const id of history || []) {
    if (used.has(id)) continue;
    used.add(id);
    const diagnostic = item.diagnostics.find(d => d.id === id);
    if (!diagnostic) continue;
    const outcomeIndex = diagnostic.outcomes.indexOf(diagnostic.observed);
    if (outcomeIndex < 0) continue;
    const reliability = Math.max(0, Math.min(1, diagnostic.reliability ?? 1));
    probs = probs.map((p, i) => {
      const likelihood = diagnostic.distributions?.[i]?.[outcomeIndex] ?? 1;
      return p * Math.pow(Math.max(likelihood, 1e-9), reliability);
    });
    probs = normalizeProbabilities(probs);
  }
  return probs;
}

export function entropy(probs) {
  return (probs || []).reduce((sum,p) => p > 0 ? sum - p * Math.log2(p) : sum, 0);
}

export function informationGain(item, diagnostic, prior = null) {
  if (!item?.analyses?.length || !diagnostic?.outcomes?.length) return 0;
  const weights = normalizeProbabilities(prior || item.prior || item.analyses.map(() => 1));
  const mixture = diagnostic.outcomes.map((_, y) => weights.reduce((sum,w,i) => sum + w * (diagnostic.distributions?.[i]?.[y] || 0), 0));
  let mi = 0;
  for (let i=0;i<item.analyses.length;i++) {
    for (let y=0;y<diagnostic.outcomes.length;y++) {
      const q = diagnostic.distributions?.[i]?.[y] || 0;
      const m = mixture[y] || 0;
      if (q > 0 && m > 0) mi += weights[i] * q * Math.log2(q/m);
    }
  }
  return mi * Math.max(0, Math.min(1, diagnostic.reliability ?? 1));
}

export function nextDiagnostic(item, history = []) {
  if (!item) return null;
  const used = new Set(history || []);
  const current = posterior(item, history);
  return item.diagnostics
    .filter(d => !used.has(d.id))
    .map(d => ({diagnostic:d, information:informationGain(item,d,current)}))
    .sort((a,b) => b.information-a.information || a.diagnostic.id.localeCompare(b.diagnostic.id))[0] || null;
}

export function evidenceLabel(item, probs) {
  if (!item || !probs?.length) return {label:'Unresolved', detail:'The available evidence does not separate the analyses.'};
  let best = 0;
  for (let i=1;i<probs.length;i++) if (probs[i] > probs[best]) best = i;
  const p = probs[best];
  if (p < 0.62) return {label:'Still unresolved', detail:'The diagnostics conflict or remain weak. Nabu keeps both readings available.'};
  if (p < 0.82) return {label:'Leans '+item.analyses[best].label, detail:'One analysis has more support, but the sentence is still meaningfully ambiguous.'};
  return {label:'Strongly favors '+item.analyses[best].label, detail:'The authored diagnostics strongly favor this analysis for this case; this is not a universal parsing claim.'};
}
