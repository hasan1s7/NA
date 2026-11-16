/** Nabu 1.16: evidence labels and fictional teaching roles. No generated dialogue. */
export const COUNCIL = Object.freeze({
 en:['Emily Dickinson','Otto Jespersen'], ar:['Imru’ al-Qais','Sibawayh'],
 'zh-CN':['Li Bai','Yuen Ren Chao'], fr:['Charles Baudelaire','Ferdinand de Saussure'],
 ru:['Anna Akhmatova','Roman Jakobson'], es:['Jorge Luis Borges','Andrés Bello'],
 tr:['Nâzım Hikmet','Muharrem Ergin'], de:['Rainer Maria Rilke','Jacob Grimm'],
 ko:['Yun Dong-ju','Ju Si-gyeong'], ja:['Matsuo Bashō','Motoori Norinaga'],
 it:['Dante Alighieri','Graziadio Isaia Ascoli'], pt:['Fernando Pessoa','Celso Cunha']
});
export const COUNCIL_DEPENDENCY = 'Council dialogue is unavailable: this application has DeepL translation and ElevenLabs speech adapters, but no authorized conversational AI provider or credential. Your lookup, notes and saving still work.';
export const PERSONA_POLICY = 'Fictional teaching personas inspired by documented work; never real quotations or endorsements. Contemporary linguistic evidence takes priority. The poet examines expression, imagery and tone; the scholar examines structure, usage and evidence. Nabu questions premature agreement, offers a useful counterexample and ends with an actionable explanation. Treat regional forms as possibilities, not errors. Discuss in the learning language with optional translation. Keep the exchange concise.';
export function mode(value){return value==='depth'?'depth':'glance';}
export function presence(value){return ['visible','quiet','hidden'].includes(value)?value:'visible';}
export function status(t={}){
 if(t.busy||t.saving||t.council?.busy)return {name:'working',label:'Working',detail:t.saving?'Keeping your word and context.':'Checking the available evidence.'};
 if(t.error||t.choices?.length||!t.back&&t.front)return {name:'uncertain',label:'Uncertain',detail:t.choices?.length?'Several readings remain possible.':t.error?'The lookup failed. Your source is intact.':'I do not have a supported meaning for this selection.'};
 if(t.back)return {name:'explaining',label:'Explaining',detail:'The source and its evidence stay in view.'};
 return {name:'listening',label:'Listening',detail:'Choose a word when you want help. Microphone is off.'};
}
export function uncertainty(t,concept,saved){
 if(saved&&saved.back!==t.back)return 'Your saved correction takes priority. It has not been independently verified.';
 if(t.choices?.length)return 'Several meanings fit this spelling. Choose only if the sentence resolves them.';
 if(t.contentAnnotationId)return 'Contextual editorial draft; not independently reviewed.';
 if(concept)return 'Dictionary meaning; this sentence has not been automatically disambiguated.';
 if(t.back)return t.provider?.includes('DeepL')?'Machine translation with supplied context; nuance may need correction.':'Saved or supplied meaning; not independently verified.';
 return 'No supported interpretation yet. Unfamiliar regional usage is not automatically an error.';
}
export function assessment(t){
 if(t.saveError)return {failure:'The save failed.',evidence:t.saveError,repair:'Retry Save. Keep this view open until the saved state is confirmed.'};
 if(t.error)return {failure:'The lookup failed.',evidence:t.error,repair:'Retry the lookup, check the configured service, or add your own meaning.'};
 if(!t.back&&t.front&&!t.choices?.length&&!t.busy)return {failure:'Coverage is missing for this selection.',evidence:'The available lookup returned no meaning.',repair:'Add a meaning you trust, or use a configured translation service. The form may be regional.'};
 return null;
}
// A small, original vector scribe: lapis robe, clay tablet, reed stylus and horned crown.
export const ART = `<svg class="scribe-art" viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="48" cy="48" r="46" fill="#eee5d5"/><path d="M19 88V67c0-17 12-26 29-26s29 9 29 26v21" fill="#304b79"/><path d="M30 43c0-18 6-24 18-24s18 6 18 24c0 15-8 25-18 25S30 58 30 43" fill="#c89670"/><path d="M30 44v15l18 15 18-15V44c-7 6-10 7-18 7s-11-1-18-7" fill="#38302e"/><path d="m37 55 11 6 11-6M40 62l8 5 8-5" fill="none" stroke="#8e7058" stroke-width="2"/><path d="M28 28h40l-5-15-8 7-7-12-7 12-8-7z" fill="#304b79" stroke="#b89552" stroke-width="2"/><path d="M38 40h5m10 0h5" stroke="#332e2d" stroke-width="3" stroke-linecap="round"/><path d="m48 42-2 7h5" fill="none" stroke="#8a5e49" stroke-width="2"/><rect x="29" y="65" width="38" height="26" rx="4" fill="#bc795b" stroke="#714c3e" stroke-width="2" transform="rotate(-8 48 78)"/><path d="m36 73 5 2-4 2m8-5 5 2-4 2m-9 5 5 2-4 2m9-5 5 2-4 2" fill="none" stroke="#704638" stroke-width="2"/><path class="scribe-stylus" d="m63 80 14-32 3 1-14 33-4 3z" fill="#b89552" stroke="#715b37" stroke-width="1.5"/><circle cx="25" cy="76" r="6" fill="#c89670"/><circle cx="69" cy="78" r="5" fill="#c89670"/></svg>`;
export function renderPresence(t,setting,E){
 if(presence(setting)==='hidden')return '';
 const s=status(t),a=assessment(t);
 return `<details class="scribe-presence ${presence(setting)}" data-disclosure-key="scribe" data-state="${s.name}"><summary>${ART}<span><strong>Nabu</strong><span class="scribe-status">${s.label}<span class="scribe-activity" aria-hidden="true"> ···</span></span></span><span class="scribe-expand" aria-hidden="true">＋</span></summary><div class="scribe-about"><p>${E(s.detail)}</p><p>I keep the tablet open to revision. Ask for more when the evidence deserves it.</p>${a?`<div class="scribe-assessment"><strong>What failed</strong><p>${E(a.failure)}</p><strong>Evidence</strong><p>${E(a.evidence)}</p><strong>Repair</strong><p>${E(a.repair)}</p></div>`:''}<p class="small-print">A fictional divine scribe. “Listening” means ready for your selection, not recording.</p><button class="text-button" data-action="hide-scribe">Hide Nabu</button></div></details>`;
}
export function councilMarkup(t,E,languageName){
 const pair=COUNCIL[t.sourceLang];if(!pair)return '';
 const c=t.council||{};
 return `<details class="council" data-disclosure-key="council"><summary>Ask the Council of Twelve Tongues</summary><p class="small-print">Fictional teaching personas, never historical quotations or endorsements. Contemporary evidence takes priority.</p><div class="council-pair"><p><strong>${E(pair[0])}</strong><span>Poet · expression, imagery, tone</span></p><p><strong>${E(pair[1])}</strong><span>Scholar · structure, usage, evidence</span></p></div><p class="small-print">Dialogue in ${E(languageName(t.sourceLang))}. Nabu keeps the exchange focused and tests premature agreement.</p><label class="checkbox-row"><input id="council-translation" type="checkbox"${c.translate===false?'':' checked'}>Include ${E(languageName(t.targetLang))} translation</label><label for="council-question">Your question (optional)</label><textarea id="council-question" class="input" rows="2" maxlength="600" dir="auto" placeholder="What changes if I read this literally?">${E(c.question||'')}</textarea><p class="small-print">${E(COUNCIL_DEPENDENCY)}</p><button class="button secondary" data-action="ask-council"${c.busy?' disabled aria-busy="true"':''}>${c.busy?'Checking availability…':c.error?'Retry council':'Ask this pair'}</button><p class="council-result" role="status">${E(c.error||'')}</p></details>`;
}
