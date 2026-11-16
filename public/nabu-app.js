import * as Palette from './nabu-palette.js';
import * as Workspaces from './nabu-institutions.js';
import * as Local from './nabu-store.js';
import * as Scribe from './nabu-scribe.js';
import * as Explore from './nabu-explore-ui.js';
import * as IntentUI from './nabu-intent-ui.js';
import * as NextStepUI from './nabu-next-step-ui.js';
import * as LearnerUI from './nabu-learner-ui.js';
import * as X from './nabu-content.js';
import * as T from './nabu-transliteration.js';
import * as U from './nabu-reading-ui.js';
import * as M from './nabu-media.js';
import * as Art from './nabu-clipart.js';
import * as W from './nabu-word-tools.js';
import * as C from './nabu-core.js';
import * as DB from './nabu-account-store.js';
import * as S from './nabu-speech.js';
import * as G from './nabu-graph.js';
import * as L from './nabu-links.js';
import * as F from './nabu-feature-tree.js';
import * as Spatial from './nabu-spatial-graph.js';
import * as Syntax from './nabu-syntax.js';
const $ = (selector, root=document) => root.querySelector(selector);
const E = C.escapeHTML;
const paths = {
 translate:'M4 5h12M10 3v2M6 5c0 6 5 10 10 11M14 5c0 5-4 10-10 12M14 21l4-10 4 10M15.5 17h5',
 library:'M4 4h4v16H4zM10 4h4v16h-4zM16 5l3-1 4 15-3 1z',
 review:'M20 8a8 8 0 1 0 0 8M20 3v5h-5M12 7v5l3 2',
 exchange:'M4 7h15m-4-4 4 4-4 4M20 17H5m4-4-4 4 4 4',
 settings:'M9 4h6l1 3 3 1 1 6-3 2-1 3H9l-1-3-3-1-1-6 3-2zM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
 arrow:'M4 12h16m-5-5 5 5-5 5', plus:'M12 5v14M5 12h14', check:'m5 12 4 4L19 6',
 copy:'M8 8h12v12H8zM16 8V4H4v12h4', speaker:'M11 5 6 9H3v6h3l5 4zM15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14',
 swap:'M3 8h17m-4-4 4 4-4 4M21 16H4m4-4-4 4 4 4',
 leaf:'M20 3c-9 0-16 3-16 11a6 6 0 0 0 6 6c8 0 10-8 10-17zM5 19 15 9',
 edit:'m15 4 5 5-11 11H4v-5zM13 6l5 5', share:'M16 6 8 10M8 14l8 4M21 5a3 3 0 1 1-6 0 3 3 0 0 1 6 0M9 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0M21 19a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
 archive:'M3 4h18v5H3zM5 9v11h14V9M9 13h6', search:'M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0M15 15l6 6',
 download:'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5', upload:'M12 16V4m-5 5 5-5 5 5M4 17v4h16v-4',
 close:'m6 6 12 12M18 6 6 18', clock:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M12 7v5l3 2',
 shield:'m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6zM8 12l3 3 5-6',
 globe:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M3 12h18M12 3c-5 5-5 13 0 18M12 3c5 5 5 13 0 18',
 inbox:'M5 4h14l3 12v4H2v-4zM2 15h6l2 3h4l2-3h6', undo:'M8 4 3 9l5 5M3 9h11a6 6 0 0 1 0 12',
 spark:'m12 3 2.6 6.4L21 12l-6.4 2.6L12 21l-2.6-6.4L3 12l6.4-2.6z',
 logout:'M9 4H4v16h5M13 8l5 4-5 4M8 12h10', lock:'M5 10h14v11H5zM8 10V6a4 4 0 0 1 8 0v4',
 trash:'M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7',
 book:'M12 5c-3-2-6-2-10-1v15c4-1 7-1 10 1 3-2 6-2 10-1V4c-4-1-7-1-10 1zM12 5v15'
};
const icon = name => `<svg aria-hidden="true" viewBox="0 0 24 24"><path d="${paths[name] || (name==='reader'?paths.book:name==='graph'?paths.globe:paths.spark)}"/></svg>`;
const DEFAULTS = {palette:'green',explanationMode:'glance',nabuPresence:'visible',interfaceLanguage:'en',alias:'',sourceLang:'en',targetLang:'es',newLimit:20,consent:false,provider:'auto',speechProvider:'device',speechConsent:false,speechRate:1,autoLearning:false,notifications:false};
const state = {activityCount:0,activityKnown:false,reader:{text:'',title:'',draft:'',tokens:[],selectedIndex:-1,lookup:false,panelOpen:false,editing:false,syntaxHistory:{}},collaboration:null,accountHint:'',
 settings:{...DEFAULTS}, cards:[],logs:[],history:[], view:'translate', graph:{query:'',category:'',kind:'',limit:60,selectedId:'essentials.hello',mode:'2d',azimuth:28,tilt:28},
 translation:{front:'',back:'',sourceLang:'en',targetLang:'es',context:'',formality:'default',note:'',provider:'',busy:false,error:''},
 filters:{q:'',lang:'',deck:'',status:'',sort:'recent'},
 review:{cardId:null,revealed:false,typed:'',startedAt:0,count:0,undo:null,deck:'',busy:false},
 friendDraft:'',friends:{friends:[],incoming:[],outgoing:[]},libraries:[],libraryError:'',sharedPreview:null,pendingRecipient:'',backend:null,user:null,csrf:'',inbox:[],sent:[],blocks:[],exchangeTab:'inbox',exchangeError:'',
 shareCard:null,shareURL:'',importData:null,editorCard:null,editMode:false,receiving:null,
 toastAction:null,translationEpoch:0,abort:null,limit:60
};
let toastTimer, renderedReviewRevision, refreshTimer, pendingSpeech, renderedReaderTokens=null;
let readerReturnFocus=null, readerSelection=null;
let nextSteps=null,learner=null;
const deviceSpeaker=M.createDeviceSpeaker({onMessage:message=>toast(message,'',null,true)});
const speaker=S.createSpeaker({loadAudio:requestSpeech,onMessage:message=>toast(message,'',null,true)});
// Cross-tab notifications are optional; a privacy setting must not stop startup.
let channel = null;
try { if (typeof BroadcastChannel !== 'undefined') channel = new BroadcastChannel('nabu-words-changed'); } catch (error) { console.warn('Cross-tab notifications unavailable.', error); }
const main = $('#main');
const modal = $('#modal');
const langOptions = selected => C.LANGUAGES.map(([code,name])=>`<option value="${code}"${code===selected?' selected':''}>${name}</option>`).join('');
const deckOptions = (selected='', all=true) => (all?'<option value="">All collections</option>':'')+[...new Set(state.cards.filter(c=>!c.archived).map(c=>c.deck))].sort().map(d=>`<option value="${E(d)}"${d===selected?' selected':''}>${E(d)}</option>`).join('');
const activeCards = () => state.cards.filter(c=>!c.archived);
const queue = () => C.dueCards(state.cards,state.logs,Date.now(),state.settings.newLimit).filter(c=>!state.review.deck || c.deck===state.review.deck);
const findCard = id => state.cards.find(c=>c.id===id);
const byId = id => $(`[data-card-id="${id}"]`);
const dueLabel = card => card.archived ? 'Archived' : card.learningMode==='reference'?'Reference': card.schedule.state==='new' ? 'New word' : card.schedule.due<=Date.now() ? 'Ready to review' : `In ${C.intervalLabel(card.schedule.due-Date.now())}`;
function toast(message, actionLabel='', action=null, error=false) {
 const el=$('#toast');clearTimeout(toastTimer);state.toastAction=action;
 el.innerHTML=`<span>${E(message)}</span>${actionLabel?`<button data-action="toast-action">${E(actionLabel)}</button>`:''}`;
 el.className=`toast${error?' error':''}`;el.hidden=false;toastTimer=setTimeout(()=>{el.hidden=true;state.toastAction=null;},action?12000:6000);
}
function showError(error) {console.error(error);toast(error?.message || 'Something went wrong. Your existing words have not been removed.','',null,true);}
function modalError(message) {let el=$('#modal-error');if(!el){el=document.createElement('div');el.id='modal-error';el.className='error-banner';el.setAttribute('role','alert');$('#modal-body').prepend(el);}el.textContent=message;el.scrollIntoView({block:'nearest'});}
function showModal(title,body) {$('#modal-title').textContent=title;$('#modal-body').innerHTML=body;if(!modal.open)modal.showModal();}
function closeModal() {modal.close();$('#modal-body').replaceChildren();state.receiving=null;}
modal.addEventListener('close',()=>{if(modal.querySelector('#device-speech-player'))deviceSpeaker.stop();if(modal.querySelector('#speech-player'))speaker.stop();if(!modal.open){$('#modal-body').replaceChildren();placeWordPanel();}});
function navigate(view, push=true) {
 if(!['explore','translate','reader','graph','library','review','exchange','settings'].includes(view))view='translate';
 if(state.view==='reader'&&view!=='reader'){flushReaderSession();pauseSourceMedia();parkWordPanel();state.reader.panelOpen=false;}
 state.view=view;
 if(push)history.pushState({view},'',L.viewURL(view,location.href,!!state.backend?.cleanRoutes&&!window.NabuNative));
 if(view!=='reader')state.reader.lookup=false;
 if(view==='review' && state.review.sessionStarted&&!state.review.cardId)selectReview();
 render();main.focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});
 if(view==='exchange' && state.user)refreshSocial().catch(e=>{state.exchangeError=e.message;if(state.view==='exchange')render();});
}
function renderNav() {
 const due=new Set(C.practiceQueue(state.cards,state.logs,Date.now(),state.settings.newLimit,'',state.settings.speechProvider==='device'||!!state.backend?.speechEnabled).map(x=>x.card.id)).size;
 $('#navigation').innerHTML=[['explore','Explore'],['reader','Read'],['translate','Translate'],['library','Library'],['review','Review'],['exchange','Friends']].map(([id,label])=>`<button class="nav-item${(state.view===id||id==='translate'&&['graph'].includes(state.view))?' active':''}" data-action="go" data-view="${id}"${state.view===id?' aria-current="page"':''}>${icon(id)}<span>${label}</span>${id==='review'&&due?`<span class="badge">${due}</span>`:id==='exchange'&&state.activityCount?`<span class="badge" aria-label="${state.activityCount} pending items">${state.activityCount}</span>`:''}</button>`).join('');
 $('.breadcrumb').textContent=({explore:'Something worth understanding',reader:'Your reading space',translate:'Quick lookup',graph:'Word bank',library:'Your saved words',review:'A moment to remember',exchange:'Learning together',settings:'Make Nabu yours'}[state.view]);
 $('#settings-nav').innerHTML=`${icon('settings')}<span>Settings & data</span>`;
 $('#settings-nav').classList.toggle('active',state.view==='settings');
 $('#avatar').textContent=(state.settings.alias || state.user?.handle || 'N')[0].toUpperCase();
 const sync=DB.syncStatus(),statusLabel=sync.pending?sync.pending+' pending':({synced:'synced',cached:'last synced on device',offline:'offline cache',connecting:'connecting',syncing:'syncing',locked:'sign in required',paused:'paused',conflict:'needs attention'}[sync.state]||'on this device');
 $('#connection').textContent=state.user?`@${state.user.handle} / ${statusLabel}`:!navigator.onLine?'Offline':state.backend?'Sign in':'On this device';
 $('#connection').setAttribute('data-action',state.user?'sync-panel':'account');$('#connection').setAttribute('role','button');$('#connection').setAttribute('tabindex','0');
 $('#connection').classList.toggle('offline',!navigator.onLine);
 const storageLabel=$('#storage-label');if(storageLabel)storageLabel.textContent=state.user?savedLabel():DB.isCloud()?'Account locked':'Guest library on this device';
}
function openDisclosures(root){return new Set([...root.querySelectorAll('details[data-disclosure-key][open]')].map(el=>el.dataset.disclosureKey));}
function restoreDisclosures(root,keys){for(const el of root.querySelectorAll('details[data-disclosure-key]'))if(keys.has(el.dataset.disclosureKey))el.open=true;}
function render() {
 Palette.applyPalette(state.settings.palette);
 const expanded=openDisclosures(main);
 renderNav();document.body.dataset.view=state.view;
 // Passive saves and lookups must never replace the learner's document or move focus.
 if(state.view==='reader' && !state.reader.editing && $('#reader-text') && renderedReaderTokens===state.reader.tokens){nextSteps?.refresh();learner?.refresh();updateOutput();updateReaderSelection();return;}
 parkWordPanel();
 main.innerHTML=({explore:()=>explore.render(),translate:renderTranslate,reader:renderReader,graph:renderGraph,library:renderLibrary,review:renderFocusedReview,exchange:renderSocial,settings:renderSettings}[state.view])()+(['explore','reader'].includes(state.view)?'<details class="reading-tools" data-disclosure-key="reading-tools"><summary>Optional learning tools · intentions, next steps & evidence</summary>'+intents.render()+nextSteps.render()+(learner?.render()||'')+'</details>':'');
 renderedReaderTokens=state.view==='reader'?state.reader.tokens:null;
 restoreDisclosures(main,expanded);
 if(state.view==='reader'){updateReaderSelection();placeWordPanel();mountReaderMedia();queueReaderSession();}
 if(state.view==='graph')scheduleGraphCenter();
 if(state.libraryError)main.insertAdjacentHTML('afterbegin',`<div class="error-banner" role="alert">${E(state.libraryError)} <button class="text-button" data-action="account">Open account</button> <button class="text-button" data-action="refresh-library">Retry</button>${!state.user?'<button class="text-button" data-action="use-guest">Use guest library</button>':''}</div>`);
}
// Background refreshes must not replace the reader/translator input during
// focus, paste or composition. Those drafts are tab-local, not sync payloads.
function refreshPassiveUI(){
 renderNav();
 if(modal.open||['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)||document.activeElement?.isContentEditable)return;
 if(['translate','reader'].includes(state.view)){updateOutput();return;}
 if(state.view==='settings')return;
 render();
}
function pageHeading(kicker,title,description,actions='') {
 return `<div class="page-heading compact"><div><h1>${title}</h1>${description?`<p>${E(description)}</p>`:''}</div>${actions}</div>`;
}
function renderTranslate() {
 const t=state.translation;
 return `${renderTranslateTabs()}${pageHeading('','Translate','Automatically saved. Learn only what matters.')}
 <div class="translate-layout"><div><section class="panel translator" aria-label="Translator">
 ${languageBar()}
 <div class="translation-panes"><div class="source-pane"><label class="pane-label" for="translation-input">${E(C.languageName(t.sourceLang))}</label><textarea id="translation-input" class="translation-input" dir="auto" lang="${t.sourceLang}" maxlength="2000" spellcheck="false" placeholder="Type a word or phrase">${E(t.front)}</textarea><div class="pane-tools"><div class="result-tools"><button class="icon-button" data-action="speak-source" aria-label="Listen to source text">${icon('speaker')}</button><button class="icon-button" data-action="clear-translation" aria-label="Clear translation">${icon('close')}</button></div><span class="character-count" id="character-count">${t.front.length} / 2,000</span></div></div><div class="target-pane" id="translation-output" aria-live="polite" aria-atomic="false">${renderOutput()}</div></div>
 <div class="translator-toolbar"><button type="button" class="text-button" data-action="record-excerpt">Record an excerpt</button><div class="provider-note" id="provider-note">${providerLabel()}</div><div class="button-row"><button class="button secondary" data-action="translate-selection" id="selection-button" hidden>Selection</button><button class="button secondary" data-action="compose-translation">Concatenate</button><button class="button primary" data-action="translate" id="translate-button"${t.busy?' disabled':''}>${t.busy?'Translating...':`Translate ${icon('arrow')}`}</button></div></div>
 <div id="word-suggestions" class="word-suggestions">${renderSuggestions()}</div>
 </section>
 <div class="translation-meta"><span>${G.CONCEPTS.length} meanings offline. ${state.settings.provider==='local'?'Offline vocabulary only.':state.settings.provider==='public'?'Other text uses MyMemory with permission.':'Other text uses DeepL when connected.'}</span><span>Enter to translate</span></div>
 <details class="panel translation-options"${t.context?' open':''}><summary>Sentence context & tone</summary><label for="translation-context">Context for DeepL (optional)</label><textarea id="translation-context" class="input" rows="2" maxlength="1500" dir="auto" placeholder="The sentence around the word">${E(t.context)}</textarea><div class="context-controls"><span class="small-print">Sent to DeepL only for a cloud translation.</span><label for="translation-formality">Tone <select class="select" id="translation-formality"><option value="default"${t.formality==='default'?' selected':''}>Default</option><option value="prefer_more"${t.formality==='prefer_more'?' selected':''}>Formal</option><option value="prefer_less"${t.formality==='prefer_less'?' selected':''}>Casual</option></select></label></div>${state.backend?.translationEnabled?'<button class="text-button space-top" data-action="cloud-translate">Translate with DeepL instead</button>':''}</details>
 <div id="connections">${renderConnections(t.conceptId)}</div>
 <section class="recent-section"><div class="section-topline"><h2>Recent</h2><button class="text-button" data-action="go" data-view="library">Open library ${icon('arrow')}</button></div>${renderRecent()}</section></div>
 <aside class="translate-aside">${renderDaily()}<section class="panel starter-panel"><div class="section-topline"><h2>Start with a word</h2><span>Offline</span></div><div class="starter-words">${['food.water','essentials.hello','essentials.thanks','work.book','home.house','people.friend'].map(id=>{const c=G.concept(id);return `<button data-action="graph-word" data-id="${id}"><strong dir="auto" lang="${t.sourceLang}">${E(c.terms[t.sourceLang])}</strong><span dir="auto" lang="${t.targetLang}">${E(G.translation(c.id,t.sourceLang,t.targetLang).back)}</span>${icon('arrow')}</button>`;}).join('')}</div><button class="text-button" data-action="go" data-view="graph">Browse all ${G.CONCEPTS.length} ${icon('arrow')}</button></section></aside></div>`;
}
function languageBar(graph=false){const t=state.translation;return `<div class="translator-languagebar"><div class="language-slot"><span class="lang-dot">${C.languageCode(t.sourceLang)}</span><label class="sr-only" for="source-language">Learning language</label><select id="source-language" class="language-select">${langOptions(t.sourceLang)}</select></div><button class="swap-button" data-action="swap" aria-label="Swap languages">${icon('swap')}</button><div class="language-slot"><label class="sr-only" for="target-language">Meaning language</label><select id="target-language" class="language-select">${langOptions(t.targetLang)}</select><span class="lang-dot">${C.languageCode(t.targetLang)}</span></div></div>`;}
function providerLabel(){const p=state.translation.provider;return `${icon(p==='Word graph'?'book':'globe')}<span>${E(p||`${G.CONCEPTS.length} words & phrases offline`)}</span>`;}
function smallReading(text,language,stored=''){
 const r=T.readingForCard({front:text,sourceLang:language},stored);
 return r.available&&r.scheme!=='original-latin-v1'?`<small class="inline-reading" dir="auto" title="${E(r.method+'. '+r.warning)}">${E(r.text)} <span>(${E(r.status.replaceAll('-',' '))})</span></small>`:'';
}
function translitLine(label,value){return value?`<div class="transliteration-line"><span>${E(label)}</span><strong>${E(value)}</strong></div>`:'';}
function translitBlock(source,target,sourceLabel='Source romanization (draft)',targetLabel='Target romanization (draft)'){const parts=[translitLine(sourceLabel,source),translitLine(targetLabel,target)].filter(Boolean);return parts.length?`<div class="transliteration-block">${parts.join('')}</div>`:'';}
function renderComposition(t){
 if(!t.composed)return '';
 const summary=t.composed.ambiguousCount||t.composed.unresolvedCount?`Composed from known terms. ${t.composed.ambiguousCount?`${t.composed.ambiguousCount} ambiguous segment${t.composed.ambiguousCount===1?'':'s'}. `:''}${t.composed.unresolvedCount?`${t.composed.unresolvedCount} unknown segment${t.composed.unresolvedCount===1?'':'s'}.`:''}`:'Composed from known terms in the bank.';
 return `<details class="composition-breakdown" open><summary>Concatenation breakdown</summary><p class="small-print">${E(summary)} This is a rough composition helper, not a grammar-aware sentence translator.</p><div class="composition-list">${t.composed.segments.map(seg=>`<div class="composition-row ${seg.status}"><div><strong dir="auto">${E(seg.source)}</strong>${smallReading(seg.source,t.sourceLang)}</div><div>${seg.status==='found'?`<strong dir="auto">${E(seg.target)}</strong>${smallReading(seg.target,t.targetLang)}<span>${E(seg.sense||'Known term')}</span>`:seg.status==='ambiguous'?`<strong>Ambiguous</strong><span>${E(seg.choices.slice(0,2).map(c=>c.target).join(' / '))}</span>`:`<strong>Unknown</strong><span>Not in the offline bank</span>`}</div></div>`).join('')}</div></details>`;
}
function renderOutput(){
 const t=state.translation;
 if(t.busy)return `<div class="pane-label">${E(C.languageName(t.targetLang))}</div><div class="translation-loading"><span class="spinner" aria-hidden="true"></span><span>Translating...</span></div>`;
 if(t.choices?.length)return `<div class="pane-label">Choose the meaning</div><div class="sense-choices">${t.choices.map(c=>`<button data-action="choose-sense" data-id="${c.id}"><strong dir="auto" lang="${t.targetLang}">${E(c.terms[t.targetLang])}</strong><span>${E(c.sense)} <small>${E(G.CATEGORIES[c.category])}</small></span>${icon('arrow')}</button>`).join('')}</div>`;
 if(t.error)return `<div class="pane-label">Translation unavailable</div><div class="translation-error" role="alert">${E(t.error)}</div><button class="text-button" data-action="translate">Try again</button> <button class="text-button" data-action="add-manual">Add a translation</button>`;
 if(!t.back)return `<div class="pane-label">${E(C.languageName(t.targetLang))}</div><div class="placeholder-result"><p>${t.missing?'Not in the offline vocabulary.':'Translation'}</p></div>${t.missing?`<div class="missing-help">${state.backend?.translationEnabled?'<button class="button secondary" data-action="cloud-translate">Use DeepL</button>':'<button class="text-button" data-action="go" data-view="settings">Connect DeepL for other words</button>'}<button class="button secondary" data-action="compose-translation">Concatenate known terms</button><button class="text-button" data-action="add-manual">Add a translation</button></div>`:'<div class="pane-tools"><span class="character-count">Saved automatically after translation</span></div>'}`;
 const c=G.concept(t.conceptId),saved=findCard(t.savedCardId)||state.cards.find(x=>!x.archived&&C.identity(x)===C.identity(t));
 const sourceReading=T.readingForCard({...t,...(saved?{reading:saved.reading,readingMethod:saved.readingMethod}:{})}),targetReading=T.readingForCard({front:t.back,sourceLang:t.targetLang});
 const translits=translitBlock(sourceReading.available&&sourceReading.scheme!=='original-latin-v1'?sourceReading.text:'',targetReading.available&&targetReading.scheme!=='original-latin-v1'?targetReading.text:'','Source reading aid / '+sourceReading.status,'Meaning reading aid / '+targetReading.status);
 const composed=renderComposition(t);
 return `<div class="pane-label">${c?.kind?'Natural meaning / ':''}${E(C.languageName(t.targetLang))}</div><div class="translation-result" dir="auto" lang="${t.targetLang}">${E(saved?.back||t.back)}</div>${saved&&saved.back!==t.back?'<p class="word-provider">Your saved meaning</p>':''}${translits}${phraseDetails(c,t.sourceLang,t.targetLang)}${composed}${saved?`<div class="saved-controls">${W.imageFigure(saved,E)}<button class="text-button" data-action="show-context" data-card-id="${saved.id}">Context & media</button>${studyControl(saved)}${richDetails(saved)}</div>`:''}${c?`<div class="sense-label">${E(c.sense)} <span>${E(G.CATEGORIES[c.category])}</span></div>`:''}<div class="pane-tools"><div class="result-tools"><button class="icon-button" data-action="speak-target" aria-label="Listen to translation">${icon('speaker')}</button><button class="icon-button" data-action="copy-translation" aria-label="Copy translation">${icon('copy')}</button><button class="icon-button" data-action="edit-translation" aria-label="Edit saved translation">${icon('edit')}</button>${saved?`<button class="icon-button" data-action="share-card" data-id="${saved.id}" aria-label="Share this word">${icon('share')}</button>`:''}</div><span class="save-status" role="status">${t.saving?'Saving...':t.saveError?'Not saved':saved&&!saved.archived?icon('check')+' '+savedLabel():'Not saved'}</span></div>${t.saveError?`<div class="save-error" role="alert">${E(t.saveError)} ${t.composed&&!G.compositionCanSave(t.composed)?'<button class="text-button" data-action="edit-translation">Edit the meaning</button>':'<button class="text-button" data-action="retry-save">Retry save</button>'}</div>`:''}`;
}
function updateOutput(){
 queueReaderSession();
 if(state.view==='graph'){updateGraphSupport();return;}
 if(!['translate','reader'].includes(state.view))return;
 const out=$('#translation-output');
 const active=document.activeElement,focusAction=out?.contains(active)?active?.dataset?.action:null,focusMode=active?.dataset?.mode;
 if(out){const expanded=openDisclosures(out);const players=[...out.querySelectorAll('#device-speech-player,#speech-player')];players.forEach(p=>p.remove());out.innerHTML=state.view==='reader'?renderWordSupport(state.translation,'reader'):renderOutput();restoreDisclosures(out,expanded);for(const player of players)(out.querySelector('[data-audio-host]')||document.body).append(player);}
 if(focusAction){const replacement=[...out.querySelectorAll('[data-action]')].find(el=>el.dataset.action===focusAction&&(!focusMode||el.dataset.mode===focusMode));replacement?.focus({preventScroll:true});}
 if(state.view==='reader'){placeWordPanel();return;}
 const note=$('#provider-note');if(note)note.innerHTML=providerLabel();
 const b=$('#translate-button');if(b){b.disabled=state.translation.busy;b.innerHTML=state.translation.busy?'Translating...':`Translate ${icon('arrow')}`;}
 const links=$('#connections');if(links)links.innerHTML=renderConnections(state.translation.conceptId);
}
function renderSuggestions(){
 const t=state.translation,q=t.front.trim();if(!q||t.back||t.busy||t.choices?.length||q.length>100)return '';
 const results=G.search(q,t.sourceLang,t.targetLang,'',6).filter(c=>G.normalizeWord(c.terms[t.sourceLang],t.sourceLang).includes(G.normalizeWord(q,t.sourceLang))||(c.aliases[t.sourceLang]||[]).some(x=>G.normalizeWord(x,t.sourceLang).includes(G.normalizeWord(q,t.sourceLang))));
 if(results.length)return `<div class="suggestion-heading">In the word graph</div>${results.map(c=>`<button data-action="graph-word" data-id="${c.id}"><strong dir="auto">${E(c.terms[t.sourceLang])}</strong><span>${E(c.sense)}</span><small>${E(c.terms[t.targetLang])}</small></button>`).join('')}`;
 const detected=G.detect(q,t.sourceLang).filter(x=>x.language!==t.targetLang||t.sourceLang!==t.targetLang).slice(0,4);
 return detected.length?`<div class="suggestion-heading">Found in another language</div>${detected.map(({concept:c,language})=>`<button data-action="graph-word" data-id="${c.id}" data-source="${language}"><strong dir="auto">${E(c.terms[language])}</strong><span>${E(C.languageName(language))} / ${E(c.sense)}</span><small>Use ${C.languageCode(language)}</small></button>`).join('')}`:'';
}
function renderConnections(id){
 const c=G.concept(id);if(!c)return '';
 const t=state.translation;
 return `<section class="panel word-connections"><div class="section-topline"><h2>Forms across languages</h2><span>${G.LANGUAGES.length} linked forms</span></div><div class="language-links">${G.LANGUAGES.map(lang=>`<button class="language-link${lang===t.targetLang?' selected':''}${lang===t.sourceLang?' source':''}" data-action="graph-target" data-id="${c.id}" data-language="${lang}"${lang===t.sourceLang?' disabled':''} aria-label="${E(C.languageName(lang)+': '+c.terms[lang])}"${lang===t.targetLang?' aria-pressed="true"':' aria-pressed="false"'}><span>${E(C.languageName(lang))}${lang===t.sourceLang?' / source':''}</span><strong lang="${lang}" dir="auto">${E(c.terms[lang])}</strong>${smallReading(c.terms[lang],lang)}</button>`).join('')}</div>${c.note?`<details class="word-note"><summary>Usage note</summary><p>${E(c.note)}</p></details>`:''}<div class="related-words"><span>Related</span>${G.related(c.id,6).map(({concept:x,relation})=>`<button class="starter-chip" data-action="graph-word" data-id="${x.id}" title="${E(relation)}" lang="${t.sourceLang}" dir="auto">${E(x.terms[t.sourceLang])}</button>`).join('')}</div></section>`;
}
function renderRecent(){
 if(!state.history.length)return '<p class="recent-empty">Your translations will appear here.</p>';
 return `<div class="recent-list">${state.history.slice(0,5).map((t,i)=>`<button class="recent-row" data-action="recent" data-index="${i}"><span class="lang-dot">${C.languageCode(t.sourceLang)}</span><span class="recent-word" dir="auto">${E(t.front)}</span>${icon('arrow')}<span class="recent-meaning" dir="auto">${E(t.back)}</span><span class="lang-dot">${C.languageCode(t.targetLang)}</span></button>`).join('')}</div>`;
}
function renderDaily(){const s=C.statistics(state.cards,state.logs),due=queue().length;return `<section class="panel side-card"><div class="side-card-title"><span>Review</span>${icon('review')}</div><div class="daily-number">${due}<small>due now</small></div><button class="button ${due?'primary':'soft'} full-width" data-action="go" data-view="review">${due?'Start review':'Open review'} ${icon('arrow')}</button><div class="side-divider"></div><div class="side-stat"><span>Saved words</span><strong>${s.total}</strong></div><div class="side-stat no-margin"><span>Reviewed today</span><strong>${s.distinctToday}</strong></div></section>`;}
function graphMatches(){const t=state.translation;return G.search(state.graph.query,t.sourceLang,t.targetLang,state.graph.category,Infinity,state.graph.kind);}
function graphFilters(){const n=G.bankStats();return `<div class="bank-filters" role="group" aria-label="Entry type">${[['','All',n.total],['word','Words',n.words],['phrase','Phrases',n.phrases],['expression','Expressions',n.expressions]].map(([id,label,count])=>`<button class="bank-filter${state.graph.kind===id?' active':''}" data-action="bank-kind" data-kind="${id}" aria-pressed="${state.graph.kind===id}">${label}<span>${count.toLocaleString()}</span></button>`).join('')}</div>`;}
function renderGraph(){
 if(!G.concept(state.graph.selectedId))state.graph.selectedId='essentials.hello';
 return `${renderTranslateTabs()}${pageHeading('','A word opens a world.','Find a meaning. Keep what matters.',`<button class="button secondary" data-action="go" data-view="reader">${icon('book')} Read your own text</button>`)}<section class="graph-languages">${languageBar(true)}</section>${graphFilters()}<div class="graph-toolbar"><div class="search-field">${icon('search')}<label class="sr-only" for="graph-search">Search all words, phrases and expressions</label><input id="graph-search" class="input" type="search" placeholder="Find a word or phrase" value="${E(state.graph.query)}"></div><label class="sr-only" for="graph-category">Topic</label><select class="select" id="graph-category"><option value="">All topics</option>${Object.entries(G.CATEGORIES).filter(([id])=>!state.graph.kind||(state.graph.kind==='word'?!['phrases','expressions'].includes(id):id===state.graph.kind+'s')).map(([id,label])=>`<option value="${id}"${state.graph.category===id?' selected':''}>${E(label)}</option>`).join('')}</select><span id="graph-count" role="status" aria-live="polite">${graphMatches().length.toLocaleString()} entries</span></div><div class="graph-layout"><div id="graph-results">${renderGraphResults()}</div><aside id="graph-detail" aria-label="Selected word">${renderGraphDetail()}</aside></div><details class="graph-secondary" data-disclosure-key="meaning-map"><summary>Explore the meaning map<span>Connections and translations from the existing word bank.</span></summary><div id="graph-main-canvas">${renderConceptGraph()}</div><button class="text-button" data-action="export-graph">${icon('download')} Export graph</button></details>`;
}
function renderGraphResults(){const t=state.translation,list=graphMatches(),visible=list.slice(0,state.graph.limit);return list.length?`<div class="panel graph-list">${visible.map(c=>`<button class="graph-row${c.id===state.graph.selectedId?' active':''}" data-action="graph-word" data-id="${c.id}"${c.id===state.graph.selectedId?' aria-current="true"':''}><span><strong lang="${t.sourceLang}" dir="auto">${E(c.terms[t.sourceLang])}</strong><small>${E(c.kind==='expression'?C.languageName(c.origin)+' expression / '+c.sense:c.sense)}</small></span><span class="graph-row-target" lang="${t.targetLang}" dir="auto">${E(G.translation(c.id,t.sourceLang,t.targetLang).back)}</span>${icon('arrow')}</button>`).join('')}${visible.length<list.length?`<div class="bank-more"><p>${visible.length} of ${list.length.toLocaleString()} entries shown</p><button class="button secondary" data-action="bank-more">Show 60 more</button></div>`:''}</div>`:'<div class="empty-state"><h2>No matching entries</h2><p>Try another word, entry type or topic.</p><button class="text-button" data-action="reset-graph">Clear filters</button></div>';}
function refreshGraphResults(reset=true){const scroll=$('.graph-list')?.scrollTop||0;if(reset)state.graph.limit=60;$('#graph-results').innerHTML=renderGraphResults();$('#graph-count').textContent=graphMatches().length.toLocaleString()+' entries';if(!reset&&$('.graph-list'))$('.graph-list').scrollTop=scroll;}
function renderGraphDetail(){
 const c=G.concept(state.graph.selectedId);if(!c)return '<section class="word-support support-empty"><h2>Choose a word</h2><p>Its meaning will appear here.</p></section>';
 const t=state.translation,active=t.conceptId===c.id;
 const saved=state.cards.find(x=>!x.archived&&x.conceptId===c.id&&x.sourceLang===t.sourceLang&&x.targetLang===t.targetLang);
 const value={...G.translation(c.id,t.sourceLang,t.targetLang),conceptId:c.id,provider:'Word graph',context:saved?.context||'',...(active?{saving:t.saving,saveError:t.saveError,context:t.context||saved?.context||''}:{} )};
 return `<section class="word-support graph-selected">${renderWordSupport(value,'graph')}</section><details class="graph-secondary" data-disclosure-key="word-connections"><summary>Across languages</summary>${renderConnections(c.id)}</details>`;
}
function updateGraphSupport(){
 if(state.view!=='graph')return;
 const root=$('#graph-detail');if(root){const expanded=openDisclosures(root);const players=[...root.querySelectorAll('#device-speech-player,#speech-player')];players.forEach(p=>p.remove());root.innerHTML=renderGraphDetail();restoreDisclosures(root,expanded);for(const player of players)(root.querySelector('[data-audio-host]')||document.body).append(player);}
 for(const row of document.querySelectorAll('.graph-row')){const active=row.dataset.id===state.graph.selectedId;row.classList.toggle('active',active);if(active)row.setAttribute('aria-current','true');else row.removeAttribute('aria-current');}
 const map=$('#graph-main-canvas');if(map)map.innerHTML=renderConceptGraph();
}
// SVG presentation helpers are part of the shipping bundle, not test-only code.
function graphTextLines(label,max=23,maxLines=3){
 const value=String(label||'').trim();
 if(!value)return [];
 const parts=value.includes(' ')?value.split(/\s+/u):Array.from(value);
 const joined=value.includes(' ')?' ':'';
 const lines=[];let current='';
 for(const part of parts){
  const next=current?current+joined+part:part;
  if(Array.from(next).length>max&&current){lines.push(current);current=part;}
  else current=next;
  // A single long unbroken word or CJK segment needs a character fallback.
  while(Array.from(current).length>max){lines.push(Array.from(current).slice(0,max).join(''));current=Array.from(current).slice(max).join('');}
 }
 if(current)lines.push(current);
 if(lines.length>maxLines){const end=lines[maxLines-1];lines.length=maxLines;lines[maxLines-1]=Array.from(end).slice(0,max-1).join('')+'…';}
 return lines;
}
function scheduleGraphCenter(){
 requestAnimationFrame(()=>{
  const area=$('#graph-main-canvas .graph-scroll');if(!area||area.clientWidth>=area.scrollWidth)return;
  // Keep the centre of the graph in view when switching modes on mobile.
  area.scrollLeft=Math.max(0,(552/1200)*area.scrollWidth-area.clientWidth/2);
 });
}
function graphCard(node,pos,source,target,mode){
 const center=node.kind==='concept';
 const w=center?314:node.kind==='language'?(state.graph.allLanguages?168:248):node.kind==='usage'?180:224;
 const h=center?136:node.kind==='usage'?94:78;
 const x=pos.x-w/2,y=pos.y-h/2;
 const accent=node.kind==='concept'?'#24624f':node.kind==='component'?'#edf3e8':node.kind==='related'?'#f0f5ed':node.kind==='usage'?'#f5f0e3':'#ffffff';
 const clickable=['component','related','language','usage'].includes(node.kind);
 const action=node.kind==='language'?'graph-target':node.kind==='related'?'graph-word':node.kind==='component'?'graph-component':node.kind==='usage'?'graph-usage':'';
 const extra=node.kind==='language'?` data-id="${E(state.graph.selectedId)}" data-language="${E(node.lang)}"`:node.kind==='related'?` data-id="${E(node.conceptId)}"`:node.kind==='component'?` data-term="${E(node.label)}" data-source="${E(source)}"`:'';
 const attrs=clickable?`data-action="${action}"${extra} role="button" tabindex="0" aria-label="${E(node.label+(node.sub?' — '+node.sub:''))}"`:'';
 const labelMax=node.kind==='concept'?27:node.kind==='language'?state.graph.allLanguages?15:25:node.kind==='usage'?23:23;
 const textLines=graphTextLines(node.label,labelMax,center?3:2);
 const titleY=y+(center?35:node.kind==='usage'?23:27);
 const lines=textLines.map((line,i)=>`<tspan x="${pos.x.toFixed(2)}" dy="${i?18:0}">${E(line)}</tspan>`).join('');
 const subMax=node.kind==='concept'?45:node.kind==='usage'?24:node.kind==='language'?18:32;
 const subtitle=node.sub?graphTextLines(node.sub,subMax,node.kind==='usage'?2:1):[];
 return `<g class="map-card map-${node.kind}${clickable?' map-clickable':''}" ${attrs}><title>${E(node.label+(node.sub?' — '+node.sub:''))}</title><rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w}" height="${h}" rx="${center?21:16}" fill="${accent}" stroke="${node.kind==='concept'?'#194938':node.kind==='language'&&node.lang===target?'#24624f':'#cdddcf'}" stroke-width="${center?2:node.kind==='language'&&node.lang===target?2:1}"/><text x="${pos.x}" y="${titleY}" text-anchor="middle" font-size="${center?19:node.kind==='language'?13:14}" font-weight="${center?720:650}" fill="${center?'#fff':'#25352d'}">${lines}</text>${node.kind==='language'?`<text x="${x+14}" y="${y+15}" fill="#24624f" font-size="10" font-weight="700">${E(node.lang.toUpperCase())}</text>`:''}${subtitle.map((line,i)=>`<text x="${pos.x}" y="${y+h-17-(subtitle.length-1-i)*14}" text-anchor="middle" fill="${center?'#e1efdf':'#63736a'}" font-size="${center?11:node.kind==='usage'?11:10}">${E(line)}</text>`).join('')}</g>`;
}
function renderConceptGraph(){
 const c=G.concept(state.graph.selectedId)||G.concept('essentials.hello');if(!c)return '';
 const g=state.graph,t=state.translation,mode=g.mode==='3d'?'3d':'2d';
 const data=Spatial.scene(c,G.LANGUAGES,G.related(c.id,6),t.sourceLang,t.targetLang,{expanded:!!g.allLanguages});
 const p=n=>mode==='3d'?Spatial.project3D(n,g.azimuth??25,g.tilt??28):Spatial.project2D(n);
 const pos=new Map(data.nodes.map(n=>[n.id,p(n)]));
 const edges=data.links.map(e=>{const a=pos.get(e.from),b=pos.get(e.to);const start=e.kind==='translation'?{x:a.x+151,y:a.y}:e.kind==='usage'?{x:a.x,y:a.y+63}:{x:a.x+113,y:a.y};const end=e.kind==='translation'?{x:b.x-(g.allLanguages?88:125),y:b.y}:e.kind==='usage'?{x:b.x,y:b.y-49}:{x:b.x-154,y:b.y};return `<path class="map-edge ${e.kind}" d="M ${start.x.toFixed(1)} ${start.y.toFixed(1)} C ${((start.x+end.x)/2).toFixed(1)} ${start.y.toFixed(1)}, ${((start.x+end.x)/2).toFixed(1)} ${end.y.toFixed(1)}, ${end.x.toFixed(1)} ${end.y.toFixed(1)}"/>`;}).join('');
 const nodes=[...data.nodes].sort((a,b)=>p(a).depth-p(b).depth).map(n=>graphCard(n,p(n),t.sourceLang,t.targetLang,mode)).join('');
 const planes=mode==='3d'?`<g class="map-planes"><path d="M 65 488 L 1050 488 L 1150 550 L 155 550 Z"/><path d="M 250 125 L 1060 125 L 1120 178 L 195 178 Z"/></g>`:'';
 return `<section class="panel graph-visual-panel nabu-spatial"><div class="section-topline"><div><h2>Meaning map</h2><p class="small-print">${E(c.terms[t.sourceLang])} · ${E(c.sense)}</p></div><div class="spatial-switch" role="group" aria-label="Graph dimension"><button data-action="graph-mode" data-mode="2d" aria-pressed="${mode==='2d'}" class="${mode==='2d'?'active':''}">2D map</button><button data-action="graph-mode" data-mode="3d" aria-pressed="${mode==='3d'}" class="${mode==='3d'?'active':''}">3D layers</button></div></div>
 <div class="map-toolbar"><span><b>01</b> ${data.hasComponents?'Composition':'Related meanings'}</span><span><b>02</b> Natural translations</span><span><b>03</b> Usage & context</span><button class="text-button" data-action="graph-all-languages">${g.allLanguages?'Show fewer languages':'All 12 languages'}</button><button class="text-button" data-action="graph-russian-example">Try Russian idiom</button></div>
 ${mode==='3d'?`<div class="spatial-controls"><label>Rotate <input id="graph-azimuth" type="range" min="-65" max="65" step="5" value="${g.azimuth??25}" aria-label="Rotate the 3D graph"></label><label>Tilt <input id="graph-tilt" type="range" min="10" max="65" step="5" value="${g.tilt??28}" aria-label="Tilt the 3D graph"></label><button class="text-button" data-action="graph-reset-view">Reset view</button></div>`:''}
 <div class="graph-scroll" tabindex="0" aria-label="Scrollable ${mode} concept graph"><svg class="spatial-svg" viewBox="0 0 1200 730" role="group" aria-label="Interactive map of ${E(c.terms[t.sourceLang])}"><g class="map-guides"><text x="160" y="57">${data.hasComponents?'WORD BREAKDOWN':'SEMANTIC NEIGHBORS'}</text><text x="540" y="57">CORE MEANING</text><text x="990" y="57">TRANSLATIONS</text><text x="555" y="680">USE IN REAL LIFE</text></g>${planes}<g class="map-links">${edges}</g><g class="map-nodes">${nodes}</g></svg></div>
 <p class="small-print map-footer">Tap a translation to change the language. Tap a component to look it up. The map shows curated meanings, not guaranteed grammatical translations. The default view is 2D.</p></section>`;
}
function graphNodeText(label,x,y,max=30){
 const lines=graphTextLines(label,max,3);
 const top=y-(lines.length-1)*8;
 return `<text x="${x}" y="${top}" text-anchor="middle" dominant-baseline="middle">${lines.map((line,i)=>`<tspan x="${x}" dy="${i?16:0}">${E(line)}</tspan>`).join('')}</text>`;
}
function renderFeatureDecisionTree(){
 const data=F.exportFeatureTree(),leaves=data.nodes.filter(n=>n.depth===2),positions=new Map();
 leaves.forEach((n,i)=>positions.set(n.id,{x:825,y:70+i*92}));
 const middle=70+(leaves.length-1)*46;
 positions.set('root',{x:120,y:middle});
 for(const n of data.nodes.filter(n=>n.depth===1)){
  const children=leaves.filter(l=>l.parentId===n.id).map(l=>positions.get(l.id).y);
  positions.set(n.id,{x:400,y:children.reduce((a,b)=>a+b,0)/children.length});
 }
 const height=140+(leaves.length-1)*92;
 return `<section class="panel feature-tree-panel"><div class="section-topline"><h2>Feature decision tree</h2><span>${data.nodes.length} nodes</span></div><p class="small-print">Choose a goal, follow a branch, then use the matching feature. Account features still need the hosted backend. Scroll sideways to follow the full tree, or open a feature below.</p><div class="tree-scroll" tabindex="0" aria-label="Scrollable feature decision tree"><svg class="feature-tree" viewBox="0 0 1050 ${height}" role="img" aria-labelledby="feature-tree-title"><title id="feature-tree-title">Nabu features by learner goal</title>${data.edges.map(e=>{const a=positions.get(e.from),b=positions.get(e.to),start=a.x+(e.from==='root'?100:135),end=b.x-(b.x===825?155:135);return `<path class="feature-edge" d="M ${start} ${a.y} C ${(start+end)/2} ${a.y}, ${(start+end)/2} ${b.y}, ${end} ${b.y}"/>`;}).join('')}${data.nodes.map(n=>{const p=positions.get(n.id),w=n.depth===0?200:n.depth===1?270:310,h=n.depth===0?100:66;return `<g class="tree-node${n.depth===0?' root':''}"><rect x="${p.x-w/2}" y="${p.y-h/2}" width="${w}" height="${h}" rx="16"/>${graphNodeText(n.label,p.x,p.y,n.depth===0?22:n.depth===1?30:34)}</g>`;}).join('')}</svg></div><div class="feature-tree-grid">${leaves.map(n=>`<details><summary>${E(n.label)}</summary><ul>${n.features.map(f=>`<li>${E(f)}</li>`).join('')}</ul></details>`).join('')}</div></section>`;
}

function renderLibrary(){const total=activeCards().length,due=C.dueCards(state.cards,state.logs,Date.now(),state.settings.newLimit).length;
 return `${pageHeading('YOUR PERSONAL WORD COLLECTION','Library','Words you chose to keep. Return to them whenever you like.',`<div class="button-row"><button class="button secondary" data-action="import">${icon('upload')} Import</button><button class="button primary" data-action="add-manual">${icon('plus')} Add word</button></div>`)}
 <div class="stats-line"><span><strong>${total}</strong> saved words</span><span><strong>${due}</strong> ready to review</span><span><strong>${new Set(activeCards().map(c=>c.sourceLang)).size}</strong> languages</span></div>
 <div class="library-toolbar"><div class="search-field">${icon('search')}<label class="sr-only" for="library-search">Search words, meanings, and tags</label><input id="library-search" class="input" type="search" value="${E(state.filters.q)}" placeholder="Search words, translations or tags"></div><label class="sr-only" for="filter-language">Filter language</label><select id="filter-language" class="select"><option value="">All languages</option>${langOptions(state.filters.lang)}</select><label class="sr-only" for="filter-deck">Filter collection</label><select id="filter-deck" class="select">${deckOptions(state.filters.deck)}</select><label class="sr-only" for="filter-status">Filter status</label><select id="filter-status" class="select">${[['','All words'],['learning','Learning'],['reference','Reference'],['due','Ready to review'],['new','New words'],['archived','Archived']].map(([v,l])=>`<option value="${v}"${state.filters.status===v?' selected':''}>${l}</option>`).join('')}</select><label class="sr-only" for="filter-sort">Sort cards</label><select id="filter-sort" class="select">${[['recent','Newest first'],['alphabetical','Alphabetical'],['due','Due first']].map(([v,l])=>`<option value="${v}"${state.filters.sort===v?' selected':''}>${l}</option>`).join('')}</select></div>
 <div id="library-results">${renderLibraryResults()}</div>`;
}
function filteredCards(){const f=state.filters;
 let cards=state.cards.filter(c=>(f.status==='archived'?c.archived:!c.archived)&&(!f.lang||c.sourceLang===f.lang)&&(!f.deck||c.deck===f.deck)&&(!f.q||C.searchText([c.front,c.back,c.context,c.deck,...c.tags].join(' ')).includes(C.searchText(f.q)))&&(f.status!=='learning'||c.learningMode!=='reference')&&(f.status!=='reference'||c.learningMode==='reference')&&(f.status!=='due'||c.learningMode!=='reference'&&c.schedule.due<=Date.now())&&(f.status!=='new'||c.schedule.state==='new'));
 return cards.sort(f.sort==='alphabetical'?(a,b)=>a.front.localeCompare(b.front):f.sort==='due'?(a,b)=>a.schedule.due-b.schedule.due:(a,b)=>b.createdAt-a.createdAt);
}
function renderLibraryResults(){const cards=filteredCards();
 if(!cards.length)return `<div class="empty-state">${icon(state.cards.length?'search':'library')}<h2>${state.cards.length?'No matching words':'No saved words yet'}</h2><p>${state.cards.length?'Try a different search or filter. Your other words are still in your library.':'Save a word while reading, look one up, or add your own meaning.'}</p><div class="button-row">${state.cards.length?'<button class="button secondary" data-action="reset-filters">Clear filters</button>':'<button class="button primary" data-action="go" data-view="translate">Translate a word</button><button class="button secondary" data-action="add-manual">Add manually</button>'}</div></div>`;
 return `<div class="section-topline"><span>${cards.length} ${cards.length===1?'word':'words'}${cards.length>state.limit?` &middot; showing ${state.limit}`:''}</span><button class="text-button" data-action="learn-filtered">Learn these references</button><button class="text-button" data-action="export-tsv">${icon('download')} Export to Anki</button></div><div class="word-grid">${cards.slice(0,state.limit).map(renderWordCard).join('')}</div>${cards.length>state.limit?'<div class="list-footer"><button class="button secondary" data-action="load-more">Show more words</button></div>':''}`;
}
function renderWordCard(c){return `<article class="panel word-card" data-card-id="${c.id}"><div class="word-card-top"><span class="lang-dot">${C.languageCode(c.sourceLang)}</span><span class="pill ${c.archived?'':c.schedule.state==='new'?'sand':c.schedule.due<=Date.now()?'green':''}">${dueLabel(c)}</span></div><div class="word-card-body"><h2 class="card-word" lang="${c.sourceLang}" dir="auto">${E(c.front)}</h2><p class="card-meaning" lang="${c.targetLang}" dir="auto">${E(c.back)}</p>${c.conceptId&&G.concept(c.conceptId)?`<p class="card-sense">${E(G.concept(c.conceptId).sense)}</p>`:''}${c.context?`<p class="card-context" dir="auto">${E(c.context)}</p>`:''}</div><div class="word-card-extras">${W.imageFigure(c,E)}<button class="text-button" data-action="show-context" data-card-id="${c.id}">Context & media</button>${studyControl(c)}${richDetails(c)}</div><div class="word-card-footer"><span class="card-deck" title="${E(c.deck)}">${E(c.deck)}</span><div class="card-actions"><button class="icon-button" data-action="speak-card" data-id="${c.id}" aria-label="Listen to ${E(c.front)}">${icon('speaker')}</button><button class="icon-button" data-action="edit-card" data-id="${c.id}" aria-label="Edit ${E(c.front)}">${icon('edit')}</button><button class="icon-button" data-action="share-card" data-id="${c.id}" aria-label="Share ${E(c.front)}">${icon('share')}</button><button class="icon-button" data-action="archive-card" data-id="${c.id}" aria-label="${c.archived?'Restore':'Archive'} ${E(c.front)}">${icon(c.archived?'undo':'archive')}</button></div></div></article>`;}
function selectReview(){const r=state.review;const listen=state.settings.speechProvider==='device'||!!state.backend?.speechEnabled;const list=C.practiceQueue(state.cards,state.logs,Date.now(),state.settings.newLimit,r.deck,listen).filter(x=>(!r.practice||r.practice==='mixed'||x.mode===r.practice)&&!(r.skipped||[]).includes(x.card.id+':'+x.mode));const candidate=r.sessionStarted&&!r.sessionEnded?list[0]:null;const c=candidate?.card;r.cardId=c?.id||null;r.mode=candidate?.mode||'recognition';r.revealed=false;r.typed='';r.startedAt=Date.now();renderedReviewRevision=c?.revision;}
function renderInbox(){const list=state.exchangeTab==='inbox'?state.inbox:state.sent;
 return `<section class="recent-section"><div class="section-topline"><h2>Your exchange</h2><button class="text-button" data-action="refresh-inbox">${icon('review')} Refresh</button></div>${state.exchangeError?`<div class="error-banner" role="alert">${E(state.exchangeError)}</div>`:''}<div class="inbox-tabs"><button class="button ${state.exchangeTab==='inbox'?'soft':'secondary'}" data-action="exchange-tab" data-tab="inbox">Inbox (${state.inbox.length})</button><button class="button ${state.exchangeTab==='sent'?'soft':'secondary'}" data-action="exchange-tab" data-tab="sent">Sent (${state.sent.length})</button></div>${!list.length?`<div class="empty-state space-top">${icon('inbox')}<h2>${state.exchangeTab==='inbox'?'No incoming words':'No sent words'}</h2><p>Tell a friend your handle: @${E(state.user.handle)}. Only words sent to you appear in your inbox.</p></div>`:`<div class="inbox-list">${list.map(item=>`<article class="inbox-item"><div class="inbox-meta"><span>${state.exchangeTab==='inbox'?'From':'To'} @${E(state.exchangeTab==='inbox'?item.sender:item.recipient)} &middot; account message</span><span>${E(item.status)}</span></div><div class="inbox-word" dir="auto">${E(item.card.front)}</div><p class="inbox-meaning" dir="auto">${E(item.card.back)}</p>${item.message?`<p class="inbox-message" dir="auto">${E(item.message)}</p>`:''}${state.exchangeTab==='inbox'?`<div class="button-row">${item.status==='pending'?`<button class="button primary" data-action="accept-exchange" data-id="${item.id}">${icon('plus')} Add to my words</button><button class="button secondary" data-action="decline-exchange" data-id="${item.id}">Decline</button>`:''}<button class="text-button" data-action="block-user" data-handle="${E(item.sender)}">Block sender</button></div>`:''}</article>`).join('')}</div>`}</section>`;
}
function renderSettings(){return `${pageHeading('','Settings','')}
 <section class="panel settings-panel" aria-labelledby="palette-heading"><h2 id="palette-heading">Colour palette</h2><p>Choose a palette template. Original green is the default; your choice is remembered on this device.</p><div class="palette-options" role="group" aria-label="Colour palette templates">${Palette.PALETTES.map(p=>`<button type="button" class="palette-option" data-action="set-palette" data-palette="${p.id}" aria-pressed="${Palette.normalizePalette(state.settings.palette)===p.id}"><span class="palette-swatches" aria-hidden="true"><span></span><span></span><span></span></span><strong>${p.name}</strong><small>${p.description}</small></button>`).join('')}</div><p id="palette-status" class="palette-status" role="status" aria-live="polite">Current palette: ${Palette.PALETTES.find(p=>p.id===Palette.normalizePalette(state.settings.palette)).name}.</p></section>
 ${Palette.isPagesHost(location.hostname)?'<p class="pages-notice"><strong>GitHub Pages · local learning.</strong> Reading, offline word help, saving, notes, review and palettes work in this browser. Accounts, departmental workspaces and cloud services need the full Nabu server. Export a library backup before changing devices or site addresses.</p>':''}
 <section class="panel settings-panel"><h2>Workspaces & assignments</h2><p>Keep private learning separate from organization tasks. Manage reporting agreements, submissions and correction history.</p><button class="button secondary" data-action="workspaces">Open workspaces</button></section>
 <div class="settings-grid"><section class="panel settings-panel"><h2>Preferences</h2><form id="settings-form"><label class="checkbox-row"><input name="autoLearning" type="checkbox"${state.settings.autoLearning?' checked':''}>Automatically add new translations to Learning (otherwise save as Reference)</label><div class="form-grid"><div class="form-field"><label for="setting-source">Translate from</label><select class="select" id="setting-source" name="sourceLang">${langOptions(state.settings.sourceLang)}</select></div><div class="form-field"><label for="setting-target">Translate to</label><select class="select" id="setting-target" name="targetLang">${langOptions(state.settings.targetLang)}</select></div></div><div class="form-grid"><div class="form-field"><label for="setting-limit">New review cards per day</label><input class="input" type="number" id="setting-limit" name="newLimit" min="1" max="100" value="${state.settings.newLimit}" required></div><div class="form-field"><label for="setting-alias">Name on share links</label><input class="input" id="setting-alias" name="alias" value="${E(state.settings.alias)}" maxlength="40" placeholder="Optional"></div></div>
 <div class="form-field"><label for="setting-provider">Beyond the offline word bank</label><select class="select" name="provider" id="setting-provider"><option value="auto"${state.settings.provider==='auto'?' selected':''}>DeepL when connected; offline words otherwise</option><option value="workspace"${state.settings.provider==='workspace'?' selected':''}>DeepL</option><option value="public"${state.settings.provider==='public'?' selected':''}>MyMemory (public service)</option><option value="local"${state.settings.provider==='local'?' selected':''}>Offline words only</option></select><span class="help">Offline lookups do not call a translation provider. When signed in, saved cards and notes go to your account server. Other translations go to the selected provider.</span></div>
 <div class="divider"></div><h3>Reading experience</h3><p class="small-print">Interface language: English. This is separate from your learning and meaning languages; other interface translations are not bundled.</p><div class="form-grid"><div class="form-field"><label for="setting-mode">Default explanation</label><select class="select" name="explanationMode" id="setting-mode"><option value="glance"${state.settings.explanationMode!=='depth'?' selected':''}>At a glance</option><option value="depth"${state.settings.explanationMode==='depth'?' selected':''}>In depth</option></select></div><div class="form-field"><label for="setting-nabu">Nabu’s presence</label><select class="select" name="nabuPresence" id="setting-nabu">${[['visible','Small avatar'],['quiet','Quiet · no animation'],['hidden','Hidden']].map(([v,l])=>`<option value="${v}"${state.settings.nabuPresence===v?' selected':''}>${l}</option>`).join('')}</select></div></div><div class="divider"></div><h3>Voice</h3><div class="form-grid"><div class="form-field"><label for="setting-speech">Provider</label><select id="setting-speech" class="select" name="speechProvider"><option value="cloud"${state.settings.speechProvider==='cloud'?' selected':''}>ElevenLabs</option><option value="device"${state.settings.speechProvider==='device'?' selected':''}>Device voice</option></select></div><div class="form-field"><label for="setting-speech-rate">Playback speed</label><select id="setting-speech-rate" class="select" name="speechRate"><option value="1"${state.settings.speechRate===1?' selected':''}>1x</option><option value="0.85"${state.settings.speechRate===0.85?' selected':''}>0.85x</option></select></div></div><label class="checkbox-row"><input type="checkbox" name="speechConsent"${state.settings.speechConsent?' checked':''}>Allow requested text to be sent to ElevenLabs for AI-generated speech.</label><div class="button-row space-top"><button class="button primary" type="submit">Save preferences</button><button class="text-button" type="button" data-action="clear-audio">Clear audio cache</button></div></form>
 <div class="divider"></div><h3>Browser extension</h3><p class="small-print">Capture selected media, notes and transcripts into this same account library. Nothing is captured in the background.</p><button class="button secondary" data-action="extension-connections">Manage extension connections</button><div class="divider"></div><h3>Connected services</h3><p class="small-print space-top">DeepL: ${state.backend?.translationEnabled?'configured':'not connected'}<br>ElevenLabs: ${state.backend?.speechEnabled?'configured':'not connected'}</p><p class="small-print">API keys belong in the Nabu server, never in GitHub Pages or browser code.</p><button class="text-button" data-action="check-backend">Refresh connection</button>${state.user?'<button class="button secondary space-top" data-action="translation-memory">Translation memory & usage</button>':''}</section>
 <section class="panel settings-panel"><h2>Library & data</h2><p>${state.user?'Your library is cached on this device. Changes queue offline and sync while Nabu is open. Check the sync status before switching devices.':'Guest words are stored in this browser. Export a backup before changing the site address.'}</p><div class="button-row"><button class="button primary" data-action="export-backup">Library backup</button><button class="button secondary" data-action="import">Import</button><button class="button secondary" data-action="export-tsv">Export to Anki</button></div><p class="small-print space-top">JSON preserves word cards and review schedules. Separate captured-source history is included in server database backups, not this library export. Anki text export contains card content only.</p><div class="divider"></div><h3>Word graph</h3><p class="small-print space-top">${G.CONCEPTS.length} meanings / 12 languages / ${G.graphStats().translationEdges.toLocaleString()} translation links. Includes ${G.bankStats().phrases} everyday phrases and ${G.bankStats().expressions} source-language expressions. Dictionary-style starter entries, not unrestricted sentence translations. The full set has not been reviewed by native speakers.</p><div class="button-row"><button class="text-button" data-action="export-graph">Export graph JSON</button><button class="text-button" data-action="export-feature-tree">Export feature tree JSON</button></div>${renderFeatureDecisionTree()}<div class="divider"></div><h3>Storage</h3><button class="text-button" data-action="persist-storage">Request persistent storage</button><div class="danger-zone"><h3>Cleanup</h3><div class="button-row"><button class="button secondary" data-action="clear-history">Clear recent history</button><button class="button danger" data-action="reset-data">${state.user?'Clear account library':'Reset local data'}</button>${state.user?'<button class="button danger" data-action="delete-account">Delete account</button>':''}</div></div><details class="small-print space-top"><summary>Review & voice details</summary><p>The review scheduler is SM-2-inspired, not Anki sync or FSRS. Cloud pronunciation uses AI-generated speech; device voices vary. Signed-in libraries are stored on the server. Guest libraries stay local. Imported cards retain their schedules; old review-event logs stay in their original backup.</p></details></section></div>`;}
async function loadData(renderAfter=true){const data=await DB.snapshot();state.libraryError='';state.cards=data.cards;state.logs=data.logs;state.history=data.history;if(renderAfter)render();}
async function changed(renderAfter=true){await loadData(renderAfter);channel?.postMessage({changed:true});}
async function saveSettings(){state.settings.palette=Palette.applyPalette(state.settings.palette);await DB.setMeta('settings',state.settings);}
function invalidateTranslation(clearContext=false){
 state.translationEpoch++;state.abort?.abort();state.councilAbort?.abort();state.graph.selectedId='';
 Object.assign(state.translation,{busy:false,council:null,back:'',error:'',provider:'',conceptId:'',choices:[],missing:false,savedCardId:'',saving:false,saveError:'',note:'',contentAnnotationId:'',contextOffset:null,usage:'',provenance:'',composed:null,sourceTransliteration:'',backTransliteration:'',literalBackTransliteration:''});
 if(clearContext)state.translation.context='';
}
function networkFetch(url,options={}) {
 const u=new URL(url);
 if(window.NabuNative && u.pathname.startsWith('/api/') && u.protocol===location.protocol && u.host===new URL(location.href).host)return window.NabuNative.request(u.pathname,options);
 return fetch(url,options);
}
function timeoutFetch(url, options={}, signal, ms=18000){
 const controller=new AbortController();const abort=()=>controller.abort(signal?.reason);if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});
 const timer=setTimeout(()=>controller.abort(new DOMException('Translation took too long.','TimeoutError')),ms);
 return networkFetch(url,{...options,signal:controller.signal}).finally(()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);});
}
function decodeEntities(value){const t=document.createElement('textarea');t.innerHTML=value;return t.value;}
async function keepTranslation(epoch=state.translationEpoch){
 const t=state.translation;if(!t.back||t.busy||t.saving)return;
 if(t.composed&&!G.compositionCanSave(t.composed)){t.saving=false;t.saveError='Resolve unknown or ambiguous terms before saving this phrase.';updateOutput();return;}
 const item={...t},c=G.concept(t.conceptId);
 t.saving=true;t.saveError='';updateOutput();
 try{
  const result=await DB.commitTranslation({...item,deck:'My words',tags:c?[c.category]:[],note:phraseNote(c,item),learningMode:state.settings.autoLearning?'learning':'reference',...enrichCard(c,item.sourceLang,item.targetLang),...(item.composed?{learningMode:'reference',usage:'Word-by-word assembly; not a grammatical sentence translation.',provenance:'Nabu offline term concatenation / unverified draft'}:{})},()=>epoch===state.translationEpoch);
  if(!result)return;
  await loadData(false);channel?.postMessage({changed:true});
  if(epoch!==state.translationEpoch)return;
  t.savedCardId=result.card.id;t.saving=false;
  if(state.view==='reader')updateOutput();else if(['translate','graph'].includes(state.view))render();else renderNav();
 }catch(error){
  if(epoch!==state.translationEpoch)return;
  t.saving=false;t.saveError='Could not save. '+(error.message||'Check browser storage and retry.');
  updateOutput();if(state.view==='graph')render();
 }
}
async function rememberPair(){
 state.settings.sourceLang=state.translation.sourceLang;state.settings.targetLang=state.translation.targetLang;
 try{await saveSettings();}catch(error){console.warn('Language preferences could not be saved.',error);}
}
async function useGraph(id,source=state.translation.sourceLang,target=state.translation.targetLang){
 if(source===target)target=G.LANGUAGES.find(l=>l!==source&&l===state.settings.targetLang)||G.LANGUAGES.find(l=>l!==source);
 const value=G.translation(id,source,target);
 const reading=state.reader.lookup&&state.view==='reader'?{front:state.translation.front,context:state.translation.context,contextOffset:state.translation.contextOffset}:null;
 invalidateTranslation(true);
 Object.assign(state.translation,{front:value.front,back:value.back,sourceLang:source,targetLang:target,conceptId:id,literalBack:value.literalBack,literalGloss:value.literalGloss,provider:'Word graph',saving:false,missing:false,sourceTransliteration:value.sourceTransliteration||'',backTransliteration:value.backTransliteration||'',literalBackTransliteration:value.literalBackTransliteration||'',composed:null});
 if(reading){state.translation.context=reading.context;state.translation.front=reading.front;state.translation.contextOffset=reading.contextOffset;}
 state.graph.selectedId=id;
 const epoch=state.translationEpoch;
 if(state.view==='reader'){updateOutput();updateReaderSelection();}else if(state.view==='graph')updateGraphSupport();else render();
 if(!['reader','graph'].includes(state.view))await keepTranslation(epoch);
 await rememberPair();
}
async function translate(options={}){
 const t=state.translation,front=t.front.trim();
 if(!front){$('#translation-input')?.focus();throw new Error('Type or select a word before translating.');}
 if(front.length>C.MAX_TEXT)throw new Error('Use at most 2,000 characters.');
 if(t.sourceLang===t.targetLang)throw new Error('Choose two different languages.');
 if(!options.forceCloud&&(!t.context.trim()||!state.backend?.translationEnabled)){
  const found=G.resolve(front,t.sourceLang,t.targetLang);
  if(found.status==='found'&&!t.context.trim()){await useGraph(found.conceptId);return;}
  if(found.status==='found'&&t.context.trim()){invalidateTranslation();t.choices=[found.concept];if(state.view==='reader')updateOutput();else render();return;}
  if(found.status==='ambiguous'){
   invalidateTranslation();t.choices=found.candidates;if(state.view==='reader')updateOutput();else render();return;
  }
 }
 let provider=state.settings.provider==='local'?'local':state.settings.provider==='public'?'public':state.backend?.translationEnabled?'workspace':'local';
 if(options.forceCloud)provider=state.backend?.translationEnabled?'workspace':'local';
 if(provider==='local'){
  invalidateTranslation();t.missing=true;updateOutput();const el=$('#word-suggestions');if(el)el.innerHTML=renderSuggestions();return;
 }
 if(provider==='public'&&!state.settings.consent){
  showModal('Use online translation?',`<p class="modal-intro">This word is outside the offline vocabulary. MyMemory receives the text you translate. Do not send confidential information.</p><div class="modal-footer"><button class="button secondary" data-action="close-modal">Cancel</button><button class="button primary" data-action="allow-public">Allow & translate</button></div>`);return;
 }
 if(provider==='workspace'&&!state.user){state.resumeTranslation=true;openAuth('login');return;}
 state.abort?.abort();state.abort=new AbortController();const signal=state.abort.signal,epoch=++state.translationEpoch;
 const source=t.sourceLang,target=t.targetLang,context=t.context,formality=t.formality||'default';
 state.graph.selectedId='';
 Object.assign(t,{busy:true,error:'',back:'',provider:'',choices:[],conceptId:'',savedCardId:'',saveError:'',missing:false,composed:null,sourceTransliteration:'',backTransliteration:'',literalBackTransliteration:''});updateOutput();
 const sugg=$('#word-suggestions');if(sugg)sugg.innerHTML='';
 try{
  const key=JSON.stringify(['context-v1',provider,source,target,front.normalize('NFC'),provider==='workspace'?context:'',provider==='workspace'?formality:'default',state.backend?.translationEnglish||'',state.backend?.translationPortuguese||'']);
  const cached=await DB.cacheGet(key);let translated=cached;
  if(epoch!==state.translationEpoch)return;
  if(!translated){
   if(!navigator.onLine)throw new Error('Offline. The 1,026 built-in meanings still work.');
   if(provider==='workspace'){
    const response=await api('translate',{method:'POST',body:{text:front,sourceLang:source,targetLang:target,context,formality},signal,ms:35000});translated=response.translation;
   }else{
    const parts=[];
    for(const chunk of C.chunkText(front)){
     if(!chunk.trim())continue;
     const url=new URL('https://api.mymemory.translated.net/get');url.searchParams.set('q',chunk.trim());url.searchParams.set('langpair',`${source}|${target}`);
     const response=await timeoutFetch(url,{credentials:'omit',referrerPolicy:'no-referrer',cache:'no-store'},signal);
     if(!response.ok)throw new Error(response.status===429?'Translation limit reached. Try later.':'Translation service unavailable.');
     const data=await response.json();
     if(Number(data.responseStatus)!==200||data.quotaFinished)throw new Error('Translation service unavailable or quota reached.');
     if(typeof data.responseData?.translatedText!=='string'||!data.responseData.translatedText.trim())throw new Error('No translation returned.');
     parts.push(decodeEntities(data.responseData.translatedText).trim());
    }
    translated=parts.join(' ');
   }
   if(typeof translated!=='string'||!translated.trim())throw new Error('No translation returned.');
   if(translated.length>10000)throw new Error('The translation is too long. Translate a shorter passage.');
   // Cache failure must not discard an otherwise usable translation.
   try{await DB.cachePut(key,translated);}catch(error){console.warn('Translation caching failed.',error);}
  }
  if(epoch!==state.translationEpoch)return;
  Object.assign(t,{front,back:translated,provider:(cached?'Cached / ':'')+(provider==='workspace'?'DeepL':'MyMemory'),busy:false,saving:false,sourceTransliteration:G.transliterationOf(front,source)||'',backTransliteration:G.transliterationOf(translated,target)||'',literalBackTransliteration:'',composed:null});
  if(!['reader','graph'].includes(state.view))await keepTranslation(epoch);else updateOutput();
  await rememberPair();
 }catch(error){
  if(epoch!==state.translationEpoch)return;
  t.error=error.name==='TimeoutError'?'Translation timed out. Try again.':error.name==='AbortError'?'Translation interrupted. Try again.':error.message==='Failed to fetch'?'Cannot reach the translation service.':error.message;
  t.busy=false;updateOutput();
 }
}
async function copy(text){
 try{if(!navigator.clipboard?.writeText)throw new Error();await navigator.clipboard.writeText(text);toast('Copied. Ready to send.');}
 catch{showModal('Copy this text',`<p class="modal-intro">Your browser did not allow clipboard access. Select the text and copy it yourself.</p><textarea class="input" rows="5" id="copy-fallback" readonly>${E(text)}</textarea><div class="modal-footer"><button class="button primary" data-action="close-modal">Done</button></div>`);$('#copy-fallback').select();}
}
function renderServices(){
 const b=state.backend;
 return `<div class="service-strip"><div><span class="service-dot${b?.translationEnabled?' configured':''}"></span><strong>DeepL</strong><span>${b?.translationEnabled?'Configured on server':'Needs Nabu server + API credential'}</span></div><div><span class="service-dot${b?.speechEnabled?' configured':''}"></span><strong>Natural voice</strong><span>${b?.speechEnabled?'ElevenLabs configured':'ElevenLabs not configured'}</span></div><div class="service-action">${b?.translationEnabled&&state.settings.provider!=='workspace'?'<button class="text-button" data-action="enable-deepl">Use DeepL</button>':!state.user&&b?'<button class="text-button" data-action="auth" data-mode="login">Sign in to use services</button>':'<button class="text-button" data-action="go" data-view="settings">Service settings</button>'}</div></div>`;
}
async function requestSpeech(body,signal){
 const controller=new AbortController(),abort=()=>controller.abort();
 if(signal.aborted)abort();else signal.addEventListener('abort',abort,{once:true});
 const timer=setTimeout(()=>controller.abort(new DOMException('Speech generation took too long.','TimeoutError')),50000);
 try{
  const response=await networkFetch(L.apiURL('speech',location.href),{method:'POST',credentials:'same-origin',cache:'no-store',signal:controller.signal,headers:{'Content-Type':'application/json','Accept':'audio/mpeg','X-CSRF-Token':state.csrf,...(state.user?.id?{'X-Nabu-Account':state.user.id}:{})},body:JSON.stringify(body)});
  if(!response.ok){let data;try{data=await response.json();}catch{}if(response.status===401)expireAccount();throw new Error(typeof data?.detail==='string'?data.detail:'Pronunciation is unavailable. No replacement voice was used.');}
  const blob=await response.blob();if(blob.size>6*1024*1024)throw new Error('The pronunciation was unexpectedly large.');return blob;
 }catch(error){if(controller.signal.reason?.name==='TimeoutError')throw new Error('Speech generation timed out. Retry manually.');throw error;}
 finally{clearTimeout(timer);signal.removeEventListener('abort',abort);}
}
async function speak(value,language){
 pauseSourceMedia();
 if(!value?.trim())throw new Error('Choose or enter text before listening.');
 if(state.settings.speechProvider==='device')return speakDevice(value,language);
 if(!state.backend?.speechEnabled){pendingSpeech={value,language};showModal('Pronunciation',`<p class="modal-intro">ElevenLabs is not connected. You can use a device voice instead; pronunciation quality varies.</p><div class="modal-footer"><button class="button secondary" data-action="close-modal">Cancel</button><button class="button primary" data-action="use-device-voice">Use device voice</button></div>`);return;}
 if(!state.user){openAuth('login');return;}
 if(!state.backend.speechLanguages.includes(language))throw new Error(`No server voice is configured for ${C.languageName(language)}. Choose a voice for this language before using cloud speech.`);
 if(!state.settings.speechConsent){
  pendingSpeech={value,language};
  showModal('Enable pronunciation',`<p class="modal-intro">Nabu sends only the text you ask to hear to ElevenLabs through your server. The resulting voice is AI-generated. Your private notes and review history are not sent.</p><p class="small-print">Provider processing and retention follow your ElevenLabs plan. Audio is cached temporarily in this tab and on the server for repeat playback; it is not added to your backup. No audio is generated automatically.</p><div class="modal-footer"><button class="button secondary" data-action="close-modal">Not now</button><button class="button primary" data-action="allow-speech">Enable speech & listen</button></div>`);return;
 }
 deviceSpeaker.stop();
 window.speechSynthesis?.cancel?.();
 await speaker.play({text:value,language,scope:state.user.handle,model:state.backend.speechModel,rate:state.settings.speechRate});
}
function speakDevice(value,language){pauseSourceMedia();speaker.stop();return deviceSpeaker.play({text:value,language,rate:state.settings.speechRate});}

function openEditor(card=null,edit=false,received=null){
 state.editorSelection=null;state.editorCard=card?{...card}:null;state.editMode=edit;state.receiving=received;
 const c=card || {front:state.translation.front,back:state.translation.back,sourceLang:state.translation.sourceLang,targetLang:state.translation.targetLang,deck:'My words',context:state.translation.context||'',note:'',tags:[]};
 showModal(edit?'Edit word':received?'Shared word':'Add word',`${received?`<div class="info-banner">${icon('shield')}<div><strong>${received.verified?`From @${E(received.sender)}`:received.sender?`Shared by ${E(received.sender)}`:'Someone shared a word with you'}</strong>${received.verified?'Sent by a signed-in account.':'The name on a link is unverified. Anyone with the link can read this card.'} Review the meaning before you add it.</div></div>`:'<p class="modal-intro">A useful word, a clear meaning, and a bit of context. Edit the translation before saving when needed.</p>'}
 <form id="card-form"><div class="form-grid"><div class="form-field"><label for="card-source">Word language</label><select class="select" id="card-source" name="sourceLang">${langOptions(c.sourceLang)}</select></div><div class="form-field"><label for="card-target">Meaning language</label><select class="select" id="card-target" name="targetLang">${langOptions(c.targetLang)}</select></div></div><div class="form-field"><label for="card-front">Word or phrase</label><textarea class="input" id="card-front" name="front" maxlength="10000" rows="2" required dir="auto">${E(c.front)}</textarea></div><div class="form-field"><label for="card-back">Meaning</label><textarea class="input" id="card-back" name="back" maxlength="10000" rows="2" required dir="auto">${E(c.back)}</textarea></div><div class="form-field"><label for="card-context">Context in the word's language</label><textarea class="input" id="card-context" name="context" maxlength="1500" rows="2" dir="auto" placeholder="Where did you hear it? How is it used?">${E(c.context)}</textarea><span class="help">Shown on the front of a review card. Avoid giving away the answer.</span></div><div class="form-grid"><div class="form-field"><label for="card-deck">Collection</label><input class="input" id="card-deck" name="deck" list="deck-list" value="${E(c.deck||'My words')}" maxlength="64" required><datalist id="deck-list">${[...new Set(activeCards().map(x=>x.deck))].map(d=>`<option value="${E(d)}">`).join('')}</datalist></div><div class="form-field"><label for="card-tags">Tags, separated by commas</label><input class="input" id="card-tags" name="tags" value="${E((c.tags||[]).join(', '))}" placeholder="travel, work, everyday" maxlength="390"></div></div><div class="form-field"><label for="card-note">Private note</label><textarea class="input" id="card-note" name="note" maxlength="1000" rows="2" dir="auto">${E(c.note)}</textarea><span class="help">Shown after revealing the answer. Never included in shared words.</span></div>${!edit?'<label class="checkbox-row"><input type="checkbox" name="reverse">Also add a reverse card for producing the word. Each direction gets its own review schedule.</label>':'<p class="small-print">Editing keeps the review schedule. For a completely different meaning, add a new card instead.</p>'}<div class="modal-footer"><button type="button" class="button secondary" data-action="close-modal">Cancel</button><button type="submit" class="button primary" id="card-submit">${edit?'Save changes':'Add to my words'} ${icon('plus')}</button></div></form>`);
}
async function saveCardForm(form){
 const data=new FormData(form);const content=C.cardContent({...state.editorCard,...Object.fromEntries(data),attribution:state.editorCard?.attribution||'',conceptId:state.editorCard?.conceptId||''});
 const selection=state.editorSelection;const button=$('#card-submit');if(button.disabled)return;button.disabled=true;
 try{
  let result;
  if(state.editMode){await DB.editCard(state.editorCard.id,content,state.editorCard.revision);result={added:1,duplicates:0};}
  else{const inputs=[content];if(data.has('reverse'))inputs.push(C.reverseCard(content));result=await DB.addCards(inputs);}
  const receiving=state.receiving,editing=state.editMode;
  if(editing&&state.editorCard?.id===state.translation.savedCardId){Object.assign(state.translation,{front:content.front,back:content.back,sourceLang:content.sourceLang,targetLang:content.targetLang});}
  if(selection&&selection.epoch===state.translationEpoch&&selection.owner===(state.user?.id||'guest')&&content.front===selection.front&&content.sourceLang===selection.sourceLang&&content.targetLang===selection.targetLang){Object.assign(state.translation,{...content,provider:'Your meaning',busy:false,error:'',missing:false,choices:null,saveError:''});}
  closeModal();await changed();toast(editing?'Changes saved.':result.added?`${result.added===1?'Word':`${result.added} words`} added to your collection.`:'This word and meaning are already in your library.');
  if(receiving?.id){try{await api(`exchanges/${receiving.id}`,{method:'PATCH',body:{status:'accepted'}});await refreshExchange();}catch{toast('Saved locally. Inbox status could not update; accepting again will not duplicate the card.','',null,true);}}
 }catch(e){button.disabled=false;throw e;}
}
function publicShareURL(card) {
 const href=window.NabuNative?.apiOrigin ? window.NabuNative.apiOrigin+'/' : location.href;
 if(window.NabuNative&&!window.NabuNative.apiOrigin)return '';
 return L.legacyShareURL(card,C.encodeShare(card,state.settings.alias),href);
}
function openShare(card){
 if(!card)throw new Error('Choose a word from your library first.');
 state.shareCard=card;state.shareRequest=C.uid();state.shareInfo=null;
 state.shareURL=state.user&&state.backend?.shortLinks?'':publicShareURL(card);
 renderShareDialog();
}
function renderShareDialog(){
 const card=state.shareCard,hosted=!!(state.user&&state.backend?.shortLinks),info=state.shareInfo;
 showModal('Share word',`<div class="share-preview"><span class="pill">${E(C.languageName(card.sourceLang))} &rarr; ${E(C.languageName(card.targetLang))}</span><div class="share-word" dir="auto">${E(card.front)}</div><div class="share-meaning" dir="auto">${E(card.back)}</div>${card.context?`<p dir="auto">${E(card.context)}</p>`:''}</div>
 <p class="sender-note">Anyone with the link can read this word, meaning and displayed context. Private notes and review progress are never shared.</p>
 ${state.shareURL?`<label class="field-label" for="share-url">${info?'Short word link':'Self-contained word link'}</label><div class="link-box space-top"><input class="input" id="share-url" readonly value="${E(state.shareURL)}"><button class="button primary" data-action="copy-share">${icon('copy')} Copy</button></div>${navigator.share||window.NabuNative?'<button class="button secondary full-width space-top" data-action="native-share">Share with another app</button>':''}<p class="small-print space-top">${info?'Expires '+E(new Date(info.expiresAt).toLocaleDateString())+'. You can disable it at any time.':'This link carries the word inside it. It is longer, cannot expire or be revoked, and does not verify a sender.'}</p>${info?`<button class="text-button" data-action="revoke-current-link" data-slug="${E(info.slug)}">Disable this link</button>`:''}`:
 hosted?`<div class="form-field space-top"><label for="link-expiry">Link expires after</label><select id="link-expiry" class="select"><option value="7">7 days</option><option value="30" selected>30 days</option><option value="90">90 days</option></select></div><button class="button primary" data-action="create-short-link">Create short link ${icon('share')}</button><p class="small-print space-top">Creates a public snapshot on your Nabu server. Later edits to your card do not change this snapshot.</p>`:'<p class="small-print">Configure your HTTPS Nabu server to generate links that can be opened on other devices.</p>'}
 ${hosted&&!info?'<button class="text-button space-top" data-action="legacy-link">Use a self-contained link instead</button>':''}
 ${state.user?`<div class="divider"></div><h3>Send privately to a handle</h3><form id="send-form" class="space-top"><div class="form-field"><label for="send-handle">Recipient</label><input class="input" id="send-handle" name="recipient" list="friend-handles" value="${E(state.pendingRecipient||'')}" placeholder="friend_name" pattern="[A-Za-z0-9_]{3,24}" minlength="3" maxlength="24" required autocomplete="off"></div><datalist id="friend-handles">${(state.friends?.friends||[]).map(f=>`<option value="${E(f.handle)}">`).join('')}</datalist><div class="form-field"><label for="send-message">Message (optional)</label><input class="input" id="send-message" name="message" maxlength="280"></div><button class="button primary" type="submit">Send word ${icon('arrow')}</button></form>`:`<p class="small-print space-top">${state.backend?'Sign in for short, revocable links and private delivery.':'Hosted short links and accounts require the full Nabu backend, not GitHub Pages.'}</p>`}`);
}
async function createShortLink(button){
 const requestId=state.shareRequest,owner=state.user?.id,card=state.shareCard;
 if(!owner||!state.backend?.shortLinks)throw new Error('Sign in to your Nabu server first.');
 button.disabled=true;
 try{
  state.shareExpiry=state.shareAttempt===requestId?state.shareExpiry:Number($('#link-expiry').value);
  state.shareAttempt=requestId;
  const result=await api('word-links',{method:'POST',body:{card:C.sharePayload(card).card,expiresDays:state.shareExpiry,requestId}});
  const origin=window.NabuNative?.apiOrigin||new URL(location.href).origin;
  const u=new URL(result.url);if(u.origin!==origin||L.shareSlug(u.href)!==result.slug)throw new Error('The server returned an invalid sharing link.');
  if(state.user?.id!==owner||state.shareRequest!==requestId||!modal.open||$('#modal-title').textContent!=='Share word')return;
  state.shareURL=result.url;state.shareInfo=result;renderShareDialog();
 }finally{button.disabled=false;}
}
async function manageLinks(){
 if(!state.user)throw new Error('Sign in to manage your links.');
 const owner=state.user.id,result=await api('word-links');if(state.user?.id!==owner)return;
 showModal('My shared links',`<p class="modal-intro">Disable access here. A copy someone already saved stays in their library.</p><div class="managed-links">${result.links.length?result.links.map(link=>`<div class="managed-link"><strong dir="auto">${E(link.card.front)}</strong><small>Expires ${E(new Date(link.expiresAt).toLocaleDateString())}</small><div class="button-row"><button class="button secondary small" data-action="copy-managed-link" data-slug="${E(link.slug)}">Copy link</button><button class="button danger small" data-action="revoke-link" data-slug="${E(link.slug)}">Disable</button></div></div>`).join(''):'<p>No active links.</p>'}</div>`);
}

function pickShare(){const cards=activeCards();if(!cards.length){toast('Save a word first, then pass it along.');navigate('translate');return;}
 showModal('Choose a word',`<p class="modal-intro">Choose a word from your collection. Your private notes stay private.</p><div class="form-field"><label for="pick-share-search">Find a word</label><input class="input" id="pick-share-search" type="search" placeholder="Search your collection"></div><div id="share-picker">${renderSharePicker(cards)}</div>`);
}
function renderSharePicker(cards){return cards.slice(0,60).map(c=>`<button class="recent-row" data-action="share-card" data-id="${c.id}"><span class="lang-dot">${C.languageCode(c.sourceLang)}</span><span class="recent-word" dir="auto">${E(c.front)}</span><span class="recent-meaning" dir="auto">${E(c.back)}</span>${icon('arrow')}</button>`).join('')||'<p class="small-print">No matching words.</p>';}
async function download(filename,value,type){if(window.NabuNative?.exportFile)return window.NabuNative.exportFile(filename,value);const blob=new Blob([value],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
async function exportBackup(){await loadData(false);await download(`nabu-backup-${C.localDay(Date.now())}.json`,C.backup(state.cards,state.logs,state.settings),'application/json');toast('Backup prepared. Keep it somewhere safe.');}
async function exportTSV(){await loadData(false);if(!activeCards().length)throw new Error('There are no active cards to export.');await download(`nabu-words-${C.localDay(Date.now())}.tsv`,C.exportTSV(activeCards()),'text/tab-separated-values;charset=utf-8');toast('Anki-compatible TSV prepared. Schedules stay in your full backup.');}
function openImport(){state.importEpoch=(state.importEpoch||0)+1;state.importData=null;showModal('Import words',`<p class="modal-intro">Import a full Nabu JSON backup or a UTF-8 CSV / TSV with word, meaning, optional context, and optional tags. Existing cards are kept; duplicates are skipped.</p><div class="form-grid"><div class="form-field"><label for="import-source">Word language for CSV / TSV</label><select class="select" id="import-source">${langOptions(state.settings.sourceLang)}</select></div><div class="form-field"><label for="import-target">Meaning language for CSV / TSV</label><select class="select" id="import-target">${langOptions(state.settings.targetLang)}</select></div></div><div class="form-field"><label for="import-file">Choose a file (up to 5 MB)</label><input class="input" id="import-file" type="file" accept=".json,.csv,.tsv,.txt"><span class="help">JSON keeps its language metadata. Native .apkg archives are not supported; export notes as plain text from Anki first.</span></div><div id="import-preview"></div>`);}
async function previewImport(file){
 const epoch=(state.importEpoch||0)+1;state.importEpoch=epoch;state.importData=null;$('#import-preview').innerHTML='';$('#modal-error')?.remove();
 if(!file)return;if(file.size>5*1024*1024)throw new Error('The file is larger than 5 MB.');
 const sourceLang=$('#import-source').value,targetLang=$('#import-target').value;
 const raw=await file.text();if(epoch!==state.importEpoch||!modal.open||!$('#import-preview'))return;
 state.importData=C.parseImport(raw,{sourceLang,targetLang,deck:'Imported words'});
 const existing=new Set(state.cards.map(C.identity));let n=0;for(const c of state.importData.cards){const k=C.identity(c);if(!existing.has(k)){n++;existing.add(k);}}
 $('#import-preview').innerHTML=`<div class="import-summary"><strong>${n}</strong> new words to keep.<br>${state.importData.cards.length-n} existing or repeated words will be skipped.</div><p class="small-print">Nothing has been changed yet. Existing review schedules are never overwritten by an import.</p>${state.importData.settings?'<label class="checkbox-row"><input type="checkbox" id="import-preferences">Also restore the display name, language defaults, and new-word limit from this backup.</label>':''}<div class="modal-footer"><button class="button secondary" data-action="close-modal">Cancel</button><button class="button primary" data-action="confirm-import">Import words ${icon('plus')}</button></div>`;
}
async function api(path,{method='GET',body,signal,ms=18000}={}){
 const response=await timeoutFetch(L.apiURL(path,location.href),{method,credentials:'same-origin',cache:'no-store',headers:{'Accept':'application/json',...(state.user?.id?{'X-Nabu-Account':state.user.id}:{}),...(body?{'Content-Type':'application/json'}:{}),...(method!=='GET'&&state.csrf?{'X-CSRF-Token':state.csrf}:{})},...(body?{body:JSON.stringify(body)}:{})},signal,ms);
 let data;try{data=await response.json();}catch{throw new Error('The Nabu inbox server is not available at this address.');}
 if(!response.ok){if(response.status===401)expireAccount();if(response.status===409&&String(data.detail).includes('different account'))expireAccount(data.detail);const error=new Error(typeof data.detail==='string'?data.detail:'That request could not be completed. Please try again.');error.status=response.status;throw error;}
 return data;
}
async function checkBackend(){
 if(Palette.isPagesHost(location.hostname)){state.backend=null;await explore.configure();await intents.configure();render();return;}
 try{
  const config=await api('config',{ms:5000});if(config.service!=='nabu')throw new Error('Not Nabu');state.backend=config;
  const session=await api('session',{ms:5000});
  if(!session.user&&state.accountHint&&config.librarySync){expireAccount('Sign in again to open @'+state.accountHint+'\'s account library.');return;}
  if((session.user?.id||session.user?.handle||'')!==(state.user?.id||state.user?.handle||'')||DB.isCloud()!==!!(session.user&&config.librarySync))await activateAccount(session.user,session.csrf||'');
  else{state.user=session.user;state.csrf=session.csrf||'';}
 }catch(error){
  // An unreachable server is not an expired session. Reopen only the explicitly
  // remembered account; a known authentication rejection must stay locked.
  const cached=await DB.lastAccount();
  if(!state.user&&cached?.id&&state.accountHint===cached.handle&&!(await DB.getMeta('account-auth-required:'+cached.id,false))){
   state.backend={service:'nabu',librarySync:true,offlineSync:true};await activateAccount(cached,'');await DB.syncNow();
  }else if(state.user||DB.isCloud())state.libraryError=state.user?'Offline: your cached library is available. Pending changes sync when you reconnect.':'Sign in again to open your account library.';
  else state.backend=null;
 }
 await explore.configure();await intents.configure();if(state.user&&state.backend?.contentProgress)explore.sync();
 render();
}
async function refreshExchange(renderAfter=true){
 if(!state.user)return;const owner=state.user.id||state.user.handle;const data=await api('exchanges');if(owner!==(state.user?.id||state.user?.handle))return;state.inbox=data.inbox;state.sent=data.sent;state.exchangeError='';if(renderAfter&&state.view==='exchange'&&!$('#friend-form')?.contains(document.activeElement))render();
}
function openAuth(mode){showModal(mode==='register'?'Create account':'Sign in',`<p class="modal-intro">${mode==='register'?'Create a private online library. Add friends and share only the cards or collections you choose.':'Open your account library and friends. Guest words on this device stay separate until you import them.'}</p><form id="auth-form" data-mode="${mode}"><div class="form-field"><label for="auth-handle">Handle</label><input class="input" id="auth-handle" name="handle" pattern="[A-Za-z0-9_]{3,24}" minlength="3" maxlength="24" required autocomplete="username" autocapitalize="none" placeholder="your_name"><span class="help">3-24 letters, numbers, or underscores.</span></div><div class="form-field"><label for="auth-password">Password</label><input class="input" id="auth-password" type="password" name="password" minlength="${mode==='register'?12:1}" maxlength="128" required autocomplete="${mode==='register'?'new-password':'current-password'}"><span class="help">${mode==='register'?'Use at least 12 characters. Save the recovery code shown after registration.':'Passwords are case-sensitive.'}</span></div>${mode==='login'?'<button class="text-button" type="button" data-action="forgot-password">Forgot password?</button>':''}${mode==='register'&&state.backend?.inviteRequired?'<div class="form-field"><label for="auth-invite">Beta invitation code</label><input class="input" id="auth-invite" name="invite" maxlength="128" required autocomplete="off"></div>':''}<div class="modal-footer"><button class="button secondary" type="button" data-action="close-modal">Cancel</button><button class="button primary" type="submit">${mode==='register'?'Create account':'Sign in'} ${icon('arrow')}</button></div></form>`);}
async function openBlocks(){const data=await api('blocks');state.blocks=data.blocks;showModal('Blocked accounts',`<p class="modal-intro">Blocked accounts cannot send you words. Their past incoming exchanges are hidden from your inbox.</p>${state.blocks.length?state.blocks.map(handle=>`<div class="account-summary"><strong>@${E(handle)}</strong><button class="button secondary" data-action="unblock-user" data-handle="${E(handle)}">Unblock</button></div>`).join(''):'<p class="small-print">You have not blocked anyone.</p>'}`);}
function phraseDetails(c,source,target){
 if(!c||!c.kind)return '';
 const v=G.translation(c.id,source,target),saved=state.cards.find(x=>x.conceptId===c.id&&x.sourceLang===source&&x.targetLang===target),literal=saved?.literal||v.literalBack||(target==='en'?v.literalGloss:'');
 return literal?`<div class="literal-panel"><span class="pane-label">Literal wording / ${E(C.languageName(target))}</span><p lang="${target}" dir="auto">${E(literal)}</p><small>A wording guide, not the intended meaning.</small></div>`:'';
}
function phraseNote(c,t){
 if(!c)return t.note||'';
 const v=G.translation(c.id,t.sourceLang,t.targetLang);
 return [(v.literalBack?'Literal: '+v.literalBack:v.literalGloss?'Literal English gloss: '+v.literalGloss:''),c.note||''].filter(Boolean).join('\n').slice(0,1000);
}
async function activateAccount(user,csrf=''){
 if((state.user?.id||'guest')!==(user?.id||'guest'))window.dispatchEvent(new Event('nabu-account-change'));
 deviceSpeaker.stop();
 state.activityCount=0;state.activityKnown=false;state.reader={text:'',tokens:[],selectedIndex:-1,lookup:false};state.user=user;state.csrf=csrf;state.cards=[];state.logs=[];state.history=[];state.inbox=[];state.sent=[];
 state.friends={friends:[],incoming:[],outgoing:[]};state.libraries=[];state.libraryError='';state.exchangeError='';state.friendDraft='';state.sharedPreview=null;state.localImport=null;state.shareCard=null;state.shareURL='';state.pendingRecipient='';
 invalidateTranslation(true);state.translation.front='';state.review={cardId:null,revealed:false,typed:'',startedAt:0,count:0,undo:null,deck:'',busy:false};
 if(state.backend?.librarySync)DB.configure(user?api:null,user?.id||user?.handle||'',{offline:!!state.backend?.offlineSync});else DB.configure(null,'');
 if(user){await DB.rememberAccount(user);if(csrf)await DB.setMeta('account-auth-required:'+user.id,false);}
 state.accountHint=user?.handle||'';await DB.setMeta('accountHint',state.accountHint);
 try{await loadData(false);}catch(error){state.libraryError=error.message;}
 await explore.configure();await intents.configure();await loadReaderSession();
 render();
}
function expireAccount(message='Your session expired. Sign in again.'){
 window.dispatchEvent(new Event('nabu-account-change'));deviceSpeaker.stop();
 const previousId=state.user?.id;DB.lastAccount().then(u=>{const id=previousId||u?.id;if(id)return DB.setMeta('account-auth-required:'+id,true);}).catch(()=>{});
 if(previousId&&modal.open)closeModal();state.activityCount=0;state.activityKnown=false;state.reader={text:'',tokens:[],selectedIndex:-1,lookup:false};state.collaboration=null;state.sharedPreview=null;state.shareCard=null;
 speaker.clear();state.user=null;state.csrf='';state.cards=[];state.logs=[];state.history=[];state.inbox=[];state.sent=[];state.libraries=[];state.friends={friends:[],incoming:[],outgoing:[]};
 state.libraryError=message;DB.lock();invalidateTranslation(true);state.translation.front='';state.review.cardId=null;intents.configure();render();
}
function accountSummary(){
 if(!state.backend)return `<h2>Accounts need the Nabu server</h2><p class="muted">This static site can translate and save locally. Deploy the included server to enable accounts, friends and shared libraries.</p><button class="button secondary space-top" data-action="check-backend">Check connection</button>`;
 if(!state.user)return `<h2>Your words, on every device</h2><p class="muted">Create an account to save your library online and add friends.</p><div class="button-row space-top"><button class="button primary" data-action="auth" data-mode="register">Create account</button><button class="button secondary" data-action="auth" data-mode="login">Sign in</button></div>`;
 return `<div class="account-summary"><div><h2>@${E(state.user.handle)}</h2><p class="small-print">${E(savedLabel())}</p></div><button class="button secondary" data-action="logout">Sign out</button></div><div class="button-row space-top"><button class="text-button" data-action="sync-panel">Sync & pending changes</button><button class="text-button" data-action="recovery-settings">Recovery code</button><button class="text-button" data-action="import-local">Import this device's words</button><button class="text-button" data-action="blocks">Blocked accounts</button></div>`;
}
function friendRow(item,kind){return `<div class="friend-row"><strong>@${E(item.handle)}</strong><div class="button-row">${kind==='incoming'?`<button class="button primary small" data-action="accept-friend" data-id="${item.id}">Accept</button><button class="text-button" data-action="remove-friend" data-id="${item.id}">Decline</button>`:kind==='outgoing'?`<span class="small-print">Pending</span><button class="text-button" data-action="remove-friend" data-id="${item.id}">Cancel</button>`:`<button class="button secondary small" data-action="send-friend" data-handle="${E(item.handle)}">Send word</button><button class="icon-button" data-action="remove-friend" data-id="${item.id}" aria-label="Remove @${E(item.handle)}">${icon('close')}</button>`}</div></div>`;}
function renderFriends(){
 const f=state.friends||{friends:[],incoming:[],outgoing:[]};
 return `<section class="panel social-panel"><div class="section-topline"><h2>Friends <span class="count-label">${f.friends.length}</span></h2><button class="text-button" data-action="refresh-social">Refresh</button></div><form id="friend-form" class="inline-form"><label class="sr-only" for="friend-handle">Friend's exact handle</label><input class="input" id="friend-handle" name="handle" value="${E(state.friendDraft||'')}" placeholder="Friend's handle" pattern="@?[A-Za-z0-9_]{3,24}" maxlength="25" required autocomplete="off"><button class="button primary" type="submit">Add friend</button></form>${f.incoming.length?`<h3 class="space-top">Requests for you</h3>${f.incoming.map(x=>friendRow(x,'incoming')).join('')}`:''}${f.friends.length?f.friends.map(x=>friendRow(x,'friends')).join(''):'<p class="small-print space-top">Add someone by their exact handle. They must accept before you can share a collection.</p>'}${f.outgoing.length?`<h3 class="space-top">Sent requests</h3>${f.outgoing.map(x=>friendRow(x,'outgoing')).join('')}`:''}</section>`;
}
function renderSharedLibraries(){return `<section class="panel social-panel"><div class="section-topline"><h2>Shared libraries</h2><button class="button secondary small" data-action="publish-library">Share collection</button></div>${state.libraries.length?state.libraries.map(l=>`<button class="shared-library-row" data-action="open-shared" data-id="${l.id}"><span><strong>${E(l.title)}</strong><small>${l.owned?'Shared by you':'From @'+E(l.owner)} / ${l.count} cards / version ${l.revision}</small></span>${icon('arrow')}</button>`).join(''):'<p class="small-print">Share a collection with selected friends. Your notes and progress stay private.</p>'}</section>`;}
function renderSocial(){return `${pageHeading('','Friends','Add friends. Send words. Share collections.',state.user?'<button class="button primary" data-action="pick-share">Send a word</button>':'')}<section class="panel social-panel">${accountSummary()}${state.user&&state.backend?.shortLinks?'<button class="button secondary space-top" data-action="manage-links">My shared links</button>':''}${state.user?`<button class="text-button space-top" data-action="toggle-notifications">${state.settings.notifications?'Turn off':'Enable'} friend notifications while Nabu is open</button>`:''}</section>${state.exchangeError?`<div class="error-banner" role="alert">${E(state.exchangeError)}</div>`:''}${state.user?`<div class="social-grid">${renderFriends()}${renderSharedLibraries()}</div>${renderInbox()}`:`<section class="panel social-panel"><h2>Share without an account</h2><p class="small-print">Send a word through a link. Anyone with that link can read it.</p><button class="button secondary space-top" data-action="pick-share">Choose a word</button></section>`}`;}
async function refreshSocial(force=false){
 if(!state.user)return;const owner=state.user.id||state.user.handle;
 const [f,l,a]=await Promise.all([api('friends'),api('shared-libraries'),state.backend?.collaboration?api('activity'):Promise.resolve({pendingProposals:0})]);if(owner!==(state.user?.id||state.user?.handle))return;state.friends=f;state.libraries=l.libraries;
 await refreshExchange(false);const count=f.incoming.length+state.inbox.filter(x=>x.status==='pending').length+a.pendingProposals;
 if(state.activityKnown&&count>state.activityCount&&state.settings.notifications&&state.view!=='exchange'&&globalThis.Notification?.permission==='granted'){try{const notice=new Notification('Nabu',{body:'New friend activity is waiting. Open Friends to see it.',tag:'nabu-friends',silent:true});notice.onclick=()=>{window.focus();navigate('exchange');notice.close();};}catch{}}
 state.activityKnown=true;state.activityCount=count;renderNav();state.exchangeError='';if(state.view==='exchange'&&(force||(!modal.open&&!$('#friend-form')?.contains(document.activeElement))))render();
}
function openPublish(){
 if(!state.user)return openAuth('login');
 const friends=state.friends?.friends||[];
 if(!friends.length)throw new Error('Add a friend and have them accept first.');
 if(!activeCards().length)throw new Error('Translate a word to start your collection.');
 showModal('Share a collection',`<p class="modal-intro">Selected friends receive a private collection. You can grant contributor permissions after sharing. They can import their own copies. Notes, review schedules and history are excluded.</p><form id="publish-library-form"><div class="form-field"><label for="publish-deck">Collection</label><select class="select" id="publish-deck" name="deck">${deckOptions('',true)}</select><span class="help">Up to 300 active cards per snapshot. Larger libraries can be split into collections.</span></div><div class="form-field"><label for="publish-title">Shared title</label><input class="input" id="publish-title" name="title" maxlength="64" value="My words" required></div><div class="form-field"><label for="publish-description">Description (optional)</label><input class="input" id="publish-description" name="description" maxlength="280"></div><fieldset class="friend-checkboxes"><legend>Share with</legend>${friends.map(f=>`<label class="checkbox-row"><input type="checkbox" name="recipients" value="${E(f.handle)}">@${E(f.handle)}</label>`).join('')}</fieldset><div class="modal-footer"><button class="button secondary" type="button" data-action="close-modal">Cancel</button><button class="button primary" type="submit">Share collection</button></div></form>`);
}
async function openShared(id){
 const item=await api(`shared-libraries/${id}`);state.sharedPreview=item;
 showModal(item.title,`<p class="modal-intro">${item.count} cards from @${E(item.owner)}. ${E(item.description)}${item.owned?'':' Saving makes independent copies with fresh review schedules.'}</p><div class="shared-preview-list">${item.cards.map(c=>`<div class="shared-preview-word"><span dir="auto" lang="${c.sourceLang}">${E(c.front)}</span><span dir="auto" lang="${c.targetLang}">${E(c.back)}</span></div>`).join('')}</div>${item.owned?`<details class="space-top"><summary>Update snapshot</summary><p class="small-print">Publishing an update does not overwrite copies already saved by friends.</p><form id="update-shared-form"><label for="update-shared-deck">Use cards from</label><select class="select" id="update-shared-deck" name="deck">${deckOptions(item.title,true)}</select><button class="button secondary space-top" type="submit">Publish updated snapshot</button></form></details><details class="space-top"><summary>Who can open this</summary>${item.recipients.map(handle=>`<div class="friend-row"><span>@${E(handle)}</span><button class="text-button" data-action="revoke-shared-member" data-id="${item.id}" data-handle="${E(handle)}">Remove access</button></div>`).join('')}</details>`:''}<p class="small-print space-top">Revoking access cannot erase copies someone has already saved.</p><div class="modal-footer"><button class="button secondary" data-action="revoke-shared" data-id="${item.id}">${item.owned?'Stop sharing':'Leave shared library'}</button>${item.owned?'':`<button class="button primary" data-action="import-shared">Add to my library</button>`}</div>`);
}
async function previewLocalImport(){
 const local=await DB.localSnapshot();state.localImport=local;
 showModal('Import this device\'s words',`<p class="modal-intro">Copy ${local.cards.length} local cards into @${E(state.user.handle)}'s private online library. Notes and review schedules are included. Existing online cards are kept; duplicates are skipped.</p><p class="small-print">Your local library and historical review log stay on this device. Nothing is automatically shared with friends.</p><div class="modal-footer"><button class="button secondary" data-action="close-modal">Cancel</button><button class="button primary" data-action="confirm-local-import"${local.cards.length?'':' disabled'}>Copy to my account</button></div>`);
}

const actions={
 'workspaces':async()=>workspaces.open(),
 'graph-mode':async b=>{state.graph.mode=b.dataset.mode==='3d'?'3d':'2d';$('#graph-main-canvas').innerHTML=renderConceptGraph();scheduleGraphCenter();},
 'graph-all-languages':async()=>{state.graph.allLanguages=!state.graph.allLanguages;$('#graph-main-canvas').innerHTML=renderConceptGraph();scheduleGraphCenter();},
 'graph-russian-example':async()=>{await useGraph('expressions.fly_elephant','ru','en');},
 'graph-component':async b=>{const word=b.dataset.term;if(!word)return;invalidateTranslation(true);state.translation.sourceLang=b.dataset.source||state.translation.sourceLang;state.translation.targetLang=state.translation.sourceLang==='en'?'es':'en';state.translation.front=word;navigate('translate');await translate();},
 'graph-usage':async()=>{const target=$('#graph-detail');target?.scrollIntoView({behavior:'smooth',block:'start'});},
 'graph-reset-view':async()=>{state.graph.azimuth=28;state.graph.tilt=28;$('#graph-main-canvas').innerHTML=renderConceptGraph();scheduleGraphCenter();},
 'graph-word':async b=>{const source=b.dataset.source||state.translation.sourceLang;await useGraph(b.dataset.id,source);},
 'graph-target':async b=>{if(b.dataset.language!==state.translation.sourceLang)await useGraph(b.dataset.id,state.translation.sourceLang,b.dataset.language);},
 'choose-sense':async b=>useGraph(b.dataset.id),
 'reset-graph':async()=>{state.graph.query='';state.graph.category='';state.graph.kind='';state.graph.limit=60;render();},
 'bank-kind':async b=>{state.graph.kind=b.dataset.kind;state.graph.category='';state.graph.limit=60;render();},
 'bank-more':async()=>{state.graph.limit+=60;refreshGraphResults(false);},
 'export-graph':async()=>download('nabu-word-phrase-graph.json',JSON.stringify(G.exportGraph()),'application/json'),
 'translation-memory':async()=>{if(!state.user)return openAuth('login');const m=await api('language-memory');showModal('Private translation memory',`<p class="modal-intro">Translations are reused across sessions and server restarts. Your private text is never added to the public word bank.</p><dl class="memory-stats">${[['Stored translations',m.entries],['Server cache hits',m.cacheHits],['Provider attempts',m.providerAttempts],['Source characters submitted',m.submittedCharacters],['Characters reused from this cache',m.reusedCharacters]].map(([label,value])=>`<div><dt>${E(label)}</dt><dd>${Number(value).toLocaleString()}</dd></div>`).join('')}</dl><p class="small-print">These are application counters, not a provider invoice. Attempts include failures. Offline bank and browser-cache lookups are not counted. Up to ${Number(m.maxEntries).toLocaleString()} entries per account; older entries can be evicted.</p><div class="modal-footer"><button class="button secondary" data-action="confirm-clear-memory">Clear private translation memory</button><button class="button primary" data-action="close-modal">Done</button></div>`);},
 'confirm-clear-memory':async()=>showModal('Clear translation memory?',`<p class="modal-intro">Your saved cards and reviews stay intact. Repeating an uncached cloud translation may use the provider again. Usage counters and spending limits are not reset.</p><div class="modal-footer"><button class="button secondary" data-action="translation-memory">Cancel</button><button class="button danger" data-action="clear-memory">Clear memory</button></div>`),
 'clear-memory':async()=>{await api('language-memory',{method:'DELETE',body:{}});DB.clearCachedTranslations();closeModal();toast('Private translation memory cleared. Saved cards are untouched.');},
 'speak-graph':async b=>{const v=G.translation(b.dataset.id,state.translation.sourceLang,state.translation.targetLang);await speak(v.back,v.targetLang);},
 'export-feature-tree':async()=>download('nabu-feature-decision-tree.json',JSON.stringify(F.exportFeatureTree(),null,2),'application/json'),
 'compose-translation':async()=>{
  const t=state.translation,front=t.front.trim();if(!front)throw new Error('Type a word or phrase first.');
  if(front.length>C.MAX_TEXT)throw new Error('Use at most 2,000 characters.');
  const composed=G.compose(front,t.sourceLang,t.targetLang);if(!composed.segments?.length)throw new Error('Nothing to concatenate.');
  if(composed.direct){await useGraph(composed.segments[0].conceptId);return;}
  invalidateTranslation();Object.assign(state.translation,{front,back:composed.back,sourceLang:t.sourceLang,targetLang:t.targetLang,provider:'Concatenated terms',composed,missing:false,saving:false,sourceTransliteration:composed.sourceTransliteration||'',backTransliteration:composed.backTransliteration||''});
  render();await keepTranslation();await rememberPair();
 },
 'retry-save':async()=>keepTranslation(),
 'cloud-translate':async()=>translate({forceCloud:true}),
 'allow-public':async()=>{state.settings.consent=true;await saveSettings();closeModal();await translate();},
 'use-device-voice':async()=>{state.settings.speechProvider='device';await saveSettings();const pending=pendingSpeech;pendingSpeech=null;closeModal();if(pending)speakDevice(pending.value,pending.language);},

 'allow-speech':async()=>{state.settings.speechConsent=true;await saveSettings();const pending=pendingSpeech;pendingSpeech=null;closeModal();if(pending)await speak(pending.value,pending.language);},
 'clear-audio':async()=>{speaker.clear();toast('This tab\'s audio cache cleared. Server audio expires within one hour.');},
 'enable-deepl':async()=>{if(!state.backend?.translationEnabled)throw new Error('DeepL is not configured on the server.');state.settings.provider='workspace';await saveSettings();invalidateTranslation();render();toast('DeepL selected.');},
 'go':async b=>navigate(b.dataset.view), 'close-modal':async()=>closeModal(),
 'toast-action':async()=>{const fn=state.toastAction;$('#toast').hidden=true;state.toastAction=null;if(fn)await fn();},
 'translate':translate,
 'sample':async()=>useGraph('food.water'),
 'recent':async b=>{const item=state.history[Number(b.dataset.index)];if(!item)return;if(G.concept(item.conceptId)){await useGraph(item.conceptId,item.sourceLang,item.targetLang);return;}invalidateTranslation();Object.assign(state.translation,item,{busy:false,error:'',saving:false});render();await keepTranslation();await rememberPair();},
 'clear-translation':async()=>{invalidateTranslation(true);state.translation.front='';render();$('#translation-input').focus();},
 'swap':async()=>{const old={...state.translation};if(G.concept(old.conceptId)){await useGraph(old.conceptId,old.targetLang,old.sourceLang);return;}invalidateTranslation(true);Object.assign(state.translation,{sourceLang:old.targetLang,targetLang:old.sourceLang,front:old.back||old.front,back:old.back?old.front:'',provider:old.back?'Reversed translation':'',saving:false});render();if(old.back)await keepTranslation();await rememberPair();},
 'translate-selection':async()=>{const el=$('#translation-input'),selected=el.value.slice(el.selectionStart,el.selectionEnd).trim(),context=el.value;if(!selected)return;invalidateTranslation();state.translation.front=selected;state.translation.context=context.slice(0,1500);render();await translate();},
 'speak-source':async()=>speak(state.translation.front,state.translation.sourceLang),
 'speak-target':async()=>speak(panelSaved(state.translation)?.back||state.translation.back,state.translation.targetLang),
 'speak-card':async b=>{const c=findCard(b.dataset.id);if(c)await speak(c.front,c.sourceLang);},
 'speak-review':async()=>{const c=findCard(state.review.cardId);if(c)await speak(c.front,c.sourceLang);},
 'copy-translation':async()=>copy(panelSaved(state.translation)?.back||state.translation.back),
 'save-translation':async()=>keepTranslation(),
 'edit-translation':async()=>{const c=findCard(state.translation.savedCardId);if(c)openEditor(c,true);else openEditor({...state.translation,deck:'My words',tags:[]});},
 'add-manual':async()=>{const t=state.translation;const selected=['translate','reader','graph'].includes(state.view);openEditor({front:selected?t.front:'',back:'',sourceLang:t.sourceLang,targetLang:t.targetLang,context:selected?t.context||'':'',note:'',deck:'My words',tags:[],learningMode:state.view==='reader'?'reference':'learning'});if(state.view==='reader'&&state.reader.lookup)state.editorSelection={epoch:state.translationEpoch,owner:state.user?.id||'guest',front:t.front,sourceLang:t.sourceLang,targetLang:t.targetLang};},
 'edit-card':async b=>openEditor(findCard(b.dataset.id),true),
 'archive-card':async b=>{const c=findCard(b.dataset.id);if(!c)return;const archived=!c.archived;await DB.archiveCard(c.id,archived);await changed();toast(archived?'Word moved to your archive.':'Word restored.','Undo',async()=>{await DB.archiveCard(c.id,!archived);await changed();});},
 'share-card':async b=>openShare(findCard(b.dataset.id)), 'pick-share':async()=>pickShare(),
 'copy-share':async()=>{if(!state.shareURL)throw new Error('Create a link first.');await copy(state.shareURL);},
 'create-short-link':createShortLink,
 'retry-word-link':handleShare,
 'legacy-link':async()=>{state.shareInfo=null;state.shareURL=publicShareURL(state.shareCard);renderShareDialog();},
 'manage-links':manageLinks,
 'revoke-link':async b=>{await api('word-links/'+b.dataset.slug,{method:'DELETE',body:{}});await manageLinks();toast('Link disabled. Existing imported copies are unchanged.');},
 'revoke-current-link':async b=>{await api('word-links/'+b.dataset.slug,{method:'DELETE',body:{}});state.shareURL='';state.shareInfo=null;state.shareRequest=C.uid();renderShareDialog();toast('Link disabled.');},
 'copy-managed-link':async b=>copy((window.NabuNative?.apiOrigin||new URL(location.href).origin)+'/w/'+b.dataset.slug),
 'native-share':async()=>{try{await (window.NabuNative?.share||navigator.share.bind(navigator))({title:'A word from Nabu',text:`${state.shareCard.front} - ${state.shareCard.back}`,url:state.shareURL});}catch(e){if(e.name!=='AbortError')await copy(state.shareURL);}},
 'reset-filters':async()=>{state.filters={q:'',lang:'',deck:'',status:'',sort:'recent'};render();},
 'load-more':async()=>{state.limit+=60;$('#library-results').innerHTML=renderLibraryResults();},
 'reveal':async()=>{if(!state.review.cardId)return;state.review.typed=$('#review-typed')?.value||state.review.typed;state.review.revealed=true;render();},
 'grade':async b=>{const r=state.review;if(!r.revealed||r.busy||!r.cardId)return;r.busy=true;const id=r.cardId,revision=renderedReviewRevision;try{const result=await DB.gradeCard(id,Number(b.dataset.rating),revision,Date.now()-r.startedAt);r.undo=result.log.id;r.count++;await loadData(false);selectReview();channel?.postMessage({changed:true});}catch(e){await loadData(false);selectReview();throw e;}finally{r.busy=false;render();}},
 'undo-review':async()=>{if(!state.review.undo)return;await DB.undoReview(state.review.undo);state.review.undo=null;state.review.count=Math.max(0,state.review.count-1);await loadData(false);selectReview();render();channel?.postMessage({changed:true});toast('Last review undone.');},
 'export-backup':exportBackup,'export-tsv':exportTSV,'import':async()=>openImport(),
 'confirm-import':async b=>{if(!state.importData)return;b.disabled=true;const restore=$('#import-preferences')?.checked;const result=await DB.mergeImport(state.importData);if(restore&&state.importData.settings){Object.assign(state.settings,state.importData.settings);await saveSettings();}closeModal();await changed();toast(`${result.added} words imported. ${result.duplicates} duplicates skipped.`);},
 'persist-storage':async()=>{const persistent=await navigator.storage?.persist?.();toast(persistent?'Persistent storage granted. Keep exporting backups too.':'Your browser did not grant persistent storage. Export backups regularly.');},
 'clear-history':async()=>{await DB.clearTranslationHistory();if(state.user)await DB.syncNow();await changed();toast('Translation history and cache cleared. Saved words are untouched.');},
 'reset-data':async()=>showModal('A completely fresh start?',`<p class="modal-intro">${state.user?'This permanently clears your account library and reviews on the server. It does not delete your account or previously shared snapshots.':'This permanently removes guest words, schedules, settings, and translation history from this browser.'} Export a backup first.</p><button class="button secondary" data-action="export-backup">${icon('download')} Export backup first</button><form id="reset-form" class="space-top"><div class="form-field"><label for="reset-confirm">Type DELETE to confirm</label><input class="input" id="reset-confirm" name="confirm" pattern="DELETE" required autocomplete="off"></div><div class="modal-footer"><button type="button" class="button secondary" data-action="close-modal">Keep my words</button><button type="submit" class="button danger">${state.user?'Clear account library':'Delete local data'}</button></div></form>`),
 'check-backend':async()=>{await checkBackend();toast(state.backend?'Nabu server reached. Provider credentials still need a live request.':'No Nabu server here. Link sharing is still ready.');},
 'auth':async b=>openAuth(b.dataset.mode),
 'logout':async()=>{if((await DB.pendingChanges()).length){await openSync();throw new Error('Sync or export your pending changes before signing out.');}const uid=state.user?.id;speaker.clear();await api('logout',{method:'POST',body:{}});await DB.forgetAccount(uid);await activateAccount(null);toast('Signed out. Your account library stays on the server.');},
 'refresh-inbox':refreshExchange,
 'exchange-tab':async b=>{state.exchangeTab=b.dataset.tab;render();},
 'accept-exchange':async b=>{b.disabled=true;try{const item=state.inbox.find(x=>x.id===b.dataset.id);if(!item)return;await DB.addCards([{...item.card,deck:'From friends',attribution:`@${item.sender}`,tags:[],note:''}]);await DB.syncNow();if(DB.syncStatus().pending)throw new Error('Word is saved on this device; reconnect to finish accepting it.');await api(`exchanges/${item.id}`,{method:'PATCH',body:{status:'accepted'}});await changed(false);await refreshSocial();toast('Word added to your library.');}finally{b.disabled=false;}},
 'decline-exchange':async b=>{await api(`exchanges/${b.dataset.id}`,{method:'PATCH',body:{status:'declined'}});await refreshExchange();toast('Word declined. Nothing was added to your library.');},
 'block-user':async b=>{await api('blocks',{method:'POST',body:{handle:b.dataset.handle}});await refreshSocial();toast(`@${b.dataset.handle} can no longer send you words.`);},
 'blocks':openBlocks,
 'unblock-user':async b=>{await api(`blocks/${encodeURIComponent(b.dataset.handle)}`,{method:'DELETE',body:{}});await openBlocks();await refreshExchange();},
 'delete-account':async()=>showModal('Delete your account?',`<p class="modal-intro">This deletes your account library, reviews, friends, shared snapshots and exchanges from the server. Copies already saved by other users remain theirs. Guest words on this device are untouched. This cannot be undone.</p><form id="delete-account-form"><div class="form-field"><label for="delete-password">Current password</label><input class="input" id="delete-password" name="password" type="password" autocomplete="current-password" required></div><div class="modal-footer"><button class="button secondary" type="button" data-action="close-modal">Cancel</button><button class="button danger" type="submit">Delete account</button></div></form>`),
 'use-guest':async()=>{DB.configure(null,'');state.accountHint='';await DB.setMeta('accountHint','');state.libraryError='';await loadData(false);await explore.configure();await intents.configure();render();},
 'account':async()=>{if(state.user)navigate('exchange');else if(state.backend)openAuth('login');else navigate('exchange');},
 'refresh-library':async()=>{await checkBackend();await DB.syncNow();await loadData(false);state.libraryError='';render();toast('Library refreshed.');},
 'refresh-social':async()=>refreshSocial(),
 'accept-friend':async b=>{await api(`friends/${b.dataset.id}`,{method:'PATCH',body:{status:'accepted'}});await refreshSocial();toast('Friend added.');},
 'remove-friend':async b=>{await api(`friends/${b.dataset.id}`,{method:'DELETE',body:{}});await refreshSocial();toast('Connection removed. Shared access has been revoked.');},
 'send-friend':async b=>{state.pendingRecipient=b.dataset.handle;pickShare();},
 'publish-library':async()=>{await refreshSocial();openPublish();},
 'open-shared':async b=>openShared(b.dataset.id),
 'revoke-shared':async b=>{await api(`shared-libraries/${b.dataset.id}`,{method:'DELETE',body:{}});closeModal();await refreshSocial();toast('Access removed. Previously saved copies are unchanged.');},
 'revoke-shared-member':async b=>{await api(`shared-libraries/${b.dataset.id}/members/${encodeURIComponent(b.dataset.handle)}`,{method:'DELETE',body:{}});await openCollaboration(b.dataset.id);await refreshSocial();},
 'import-shared':async b=>{b.disabled=true;try{const latest=await api(`shared-libraries/${state.sharedPreview.id}`);const result=await DB.addCards(latest.cards.map(c=>({...c,deck:latest.title,attribution:'@'+latest.owner,tags:[],note:''})));closeModal();await changed();toast(`${result.added} cards added. ${result.duplicates} duplicates kept unchanged.`);}finally{b.disabled=false;}},
 'import-local':previewLocalImport,
 'confirm-local-import':async b=>{b.disabled=true;try{const result=await DB.mergeImport(state.localImport);closeModal();await changed();toast(`${result.added} cards copied to your account. Local cards remain on this device.`);}finally{b.disabled=false;}}

};
actions['set-palette']=async button=>{
 const id=Palette.normalizePalette(button.dataset.palette);
 state.settings.palette=Palette.applyPalette(id);
 for(const item of document.querySelectorAll('[data-action="set-palette"]'))item.setAttribute('aria-pressed',String(item.dataset.palette===id));
 const status=$('#palette-status');if(status)status.textContent='Saving palette…';
 try{await saveSettings();if(status&&state.settings.palette===id)status.textContent=Palette.PALETTES.find(p=>p.id===id).name+' saved on this device.';}
 catch(error){if(status&&state.settings.palette===id)status.textContent='Palette changed for this session. Could not save it; choose the palette again to retry.';}
};
// Account safety, focused practice, contextual reading and collaborative editing.
function renderTranslateTabs() {
 return `<nav class="workspace-tabs" aria-label="Language tools">${[['reader','Read your content'],['translate','Quick lookup'],['graph','Word bank']].map(([id,label])=>state.view===id?`<span class="workspace-current" aria-current="page">${label}</span>`:`<button class="button secondary" data-action="go" data-view="${id}">${label}</button>`).join('')}</nav>`;
}
function savedLabel(){const s=DB.syncStatus();return !state.user?'Saved on this device':s.pending?'Saved on this device / '+s.pending+' pending':s.state==='synced'?'Synced':s.state==='syncing'?'Syncing':s.state==='locked'?'Device copy / sign in to sync':s.state==='connecting'?'Opening device copy':s.state==='cached'?'Saved on this device / checking server':'Saved on this device / '+s.state;}
function studyControl(card){if(!card||card.archived)return '';return `<button class="button ${card.learningMode==='reference'?'primary':'secondary'} small" data-action="study-toggle" data-id="${card.id}">${card.learningMode==='reference'?'Learn this':'Learning / move to Reference'}</button>`;}
function enrichCard(c,source,target){
 if(!c)return {};
 const v=G.translation(c.id,source,target),d=c.details||{},answer=G.concept(d.replyId);
 return {literal:v.literalBack||(target==='en'?v.literalGloss:'')||'',usage:d.usage||c.note||'',example:d.examples?.[source]||'',
  reply:answer?(answer.meaningTerms||answer.terms)[source]:d.replies?.[source]||'',
  provenance:c.kind?'Nabu authored phrase bank / unverified draft':'Nabu authored word bank / unverified draft',reviewStatus:'draft'};
}
function richDetails(card){
 const c=G.concept(card.conceptId),d={...enrichCard(c,card.sourceLang,card.targetLang),...Object.fromEntries(Object.entries(card).filter(([k,v])=>['literal','usage','example','reply','provenance','reviewStatus'].includes(k)&&v))};
 if(!c&&!d.literal&&!d.usage&&!d.example&&!d.provenance)return '';
 return `<details class="breakdown" data-disclosure-key="${E((card.id||card.conceptId||'word')+':'+card.sourceLang+':'+card.targetLang)}"><summary>Break it down</summary>${d.literal?`<h3>Literal wording / ${E(C.languageName(card.targetLang))}</h3><p dir="auto">${E(d.literal)}</p>`:c?.kind?`<p class="small-print">${G.translation(c.id,card.sourceLang,card.targetLang).literalGloss?'English wording guide: '+E(G.translation(c.id,card.sourceLang,card.targetLang).literalGloss):'No source-specific literal breakdown for this direction.'}</p>${G.translation(c.id,card.sourceLang,card.targetLang).literalGloss?`<button class="text-button" data-action="localize-literal" data-id="${card.id}">Show literal guide in ${E(C.languageName(card.targetLang))}</button>`:''}`:''}${d.usage?`<h3>When to use it</h3><p>${E(d.usage)}</p>`:''}${d.example?`<h3>Example</h3><p dir="auto" lang="${card.sourceLang}">${E(d.example)}</p>`:''}${d.reply?`<h3>A possible reply</h3><p dir="auto" lang="${card.sourceLang}">${E(d.reply)}</p>`:''}<p class="small-print provenance">${E(d.provenance||'User-added content')} / ${E(d.reviewStatus||'draft')}. Review wording before relying on it.</p></details>`;
}
function openRecovery(code,reset=false){
 showModal(reset?'Password changed. Save your new recovery code.':'Save your recovery code',`<p class="modal-intro">This one-use code can reset your password. Keep it in a password manager. Anyone with this code and your handle can take over your account.</p><label for="recovery-code">Recovery code</label><input id="recovery-code" class="input recovery-secret" value="${E(code)}" readonly autocomplete="off" spellcheck="false"><p class="small-print space-top">The server stores only its hash. This code is not included in library backups. ${reset?'All previous sessions have been signed out.':'You can replace it in Settings using your current password.'}</p><div class="modal-footer"><button class="button secondary" data-action="download-recovery">Download code</button><button class="button primary" data-action="close-modal">I have saved it</button></div>`);
}
function openForgot(){
 showModal('Recover your account',`<p class="modal-intro">Use the recovery code you saved when you created the account or generated in Settings. No email address is needed.</p><form id="recovery-form"><div class="form-field"><label for="recover-handle">Handle</label><input id="recover-handle" name="handle" class="input" pattern="[A-Za-z0-9_]{3,24}" required autocomplete="username"></div><div class="form-field"><label for="recover-code">Recovery code</label><input id="recover-code" name="code" class="input" required autocomplete="off" minlength="20" maxlength="128"></div><div class="form-field"><label for="recover-password">New password</label><input id="recover-password" name="password" type="password" class="input" required minlength="12" maxlength="128" autocomplete="new-password"></div><p class="small-print">Accounts made in older builds need a recovery code generated while signed in. Without a valid code, self-service recovery is not possible.</p><div class="modal-footer"><button class="button secondary" type="button" data-action="auth" data-mode="login">Back</button><button class="button primary" type="submit">Reset password</button></div></form>`);
}
function openRecoverySettings(){showModal('Replace recovery code',`<p class="modal-intro">Your old code stops working immediately. This does not change your password.</p><form id="rotate-recovery-form"><label for="recovery-password">Current password</label><input class="input" id="recovery-password" name="password" type="password" required maxlength="128" autocomplete="current-password"><div class="modal-footer"><button class="button secondary" type="button" data-action="close-modal">Cancel</button><button class="button primary" type="submit">Create new code</button></div></form>`);}
async function openSync(){
 const s=DB.syncStatus(),pending=await DB.pendingChanges();
 showModal('Library sync',`<div class="sync-summary"><strong>${E(savedLabel())}</strong><p>${s.lastSync?'Last confirmed sync: '+E(new Date(s.lastSync).toLocaleString()):'No server confirmation yet.'}</p></div>${s.message?`<div class="error-banner">${E(s.message)}</div>`:''}<p class="small-print">Your account cache is stored on this device until you sign out. Changes upload only to the matching account. This page does not sync when the app is closed.</p>${pending.length?`<h3>${pending.length} pending change${pending.length===1?'':'s'}</h3><div class="pending-list">${pending.slice(0,20).map(o=>`<div><strong>${E(o.kind)}</strong><span>${E(o.payload.content?.front||o.payload.card?.front||findCard(o.payload.cardId)?.front||'Library update')}</span>${o.blocked?'<span class="pill">Needs attention</span>':''}</div>`).join('')}</div>`:'<p>No pending changes.</p>'}<div class="button-row space-top"><button class="button primary" data-action="sync-now">Sync now</button><button class="button secondary" data-action="export-pending">Export pending changes</button><button class="button secondary" data-action="export-backup">Library backup</button></div>${s.conflicts?`<section class="conflict-panel"><h3>Resolve a conflict</h3><p>The server has newer changes. Export first. Retrying an edit applies your pending text to the current card; retrying a review records it now. Using the server version removes <strong>all ${pending.length} queued changes</strong>, including dependent changes. A local audit copy is retained.</p><button class="button secondary" data-action="resolve-sync" data-choice="retry">Apply first change to current version</button><button class="button danger" data-action="confirm-server-copy">Use server version instead</button></section>`:''}`);
}
function readingTokens(text,language){
 if(globalThis.Intl?.Segmenter)return [...new Intl.Segmenter(language,{granularity:'word'}).segment(text)].map(x=>({text:x.segment,start:x.index,word:!!x.isWordLike}));
 let offset=0;return text.split(/(\s+|[.,!?;:\u3002\uff01\uff1f])/u).filter(Boolean).map(x=>{const v={text:x,start:offset,word:/[\p{L}\p{N}]/u.test(x)};offset+=x.length;return v;});
}
function readingContext(text,start,length){return U.sourceExcerpt(text,start,length);}
function renderReader(){
 if(state.reader.contentId){const content=explore.renderReader();if(content)return content;}
 const r=state.reader,reading=r.tokens.length&&!r.editing;
 const intro=reading?`<div class="reading-heading reading-active"><p>Read at your own pace.</p><button class="button secondary" data-action="edit-reader">${icon('edit')} Edit text</button></div>`:`<div class="reading-heading"><div><p class="eyebrow">AT YOUR OWN PACE</p><h1>Make it your reading.</h1><p>An article, a passage, a transcript. Something you want to understand.</p></div></div>`;
 if(!reading)return `${renderTranslateTabs()}${intro}<section class="panel reader-intake"><div class="intake-intro"><h2>${r.editing?'Your text, your pace.':'Bring something you want to read.'}</h2><p>Paste a passage from your content. Choose any word while you read; its meaning stays close by.</p></div>${languageBar()}<div class="form-field"><label for="reader-title">Title <span class="muted">(optional)</span></label><input id="reader-title" class="input" maxlength="180" dir="auto" value="${E(r.titleDraft??r.title??'')}" placeholder="The title of your article or passage"></div><label for="reader-input">Text to read</label><textarea class="input" id="reader-input" rows="7" maxlength="15000" dir="auto" placeholder="Paste your article excerpt or transcript here...">${E(r.draft??r.text)}</textarea><div id="reader-input-error" class="support-error" role="alert" hidden></div><div class="intake-bottom"><button class="button primary" data-action="read-text">${r.editing?'Return to reading':'Start reading'} ${icon('arrow')}</button><div class="button-row"><button class="text-button" data-action="record-excerpt">Record an excerpt</button>${r.editing?'<button class="text-button" data-action="cancel-reader-edit">Cancel edit</button>':''}</div></div><p class="privacy-note">${icon('lock')}<span>Your text and place are saved in this browser for this profile. Only a word you ask to translate and its surrounding sentence may go to your configured service. No automatic article or video import.</span></p><details><summary>Just exploring?</summary><p class="small-print">Open a clearly labeled sample, or start with your own content above.</p><button class="text-button" data-action="reader-example">Try an example</button></details></section>`;
 return `${renderTranslateTabs()}${intro}<div class="reader-layout"><article class="reader-panel"><div class="reader-toolbar">${languageBar()}<button class="text-button" data-action="reader-selection" id="reader-selection-button" hidden>Look up selection ${icon('arrow')}</button></div>${readerMediaMarkup()}<div class="reader-body"><p class="source-tag">${icon('book')} ${r.example?'Sample text':'Your text'}</p>${r.title?`<h1 class="reader-title" dir="auto">${E(r.title)}</h1>`:''}<div id="reader-text" class="reading-text" dir="${U.textDirection(r.text)}" lang="${state.translation.sourceLang}">${U.readingMarkup(r.tokens,r.selectedIndex)}</div></div><div class="reader-hint">${icon('spark')}<span>Tap a word for a short meaning. Nabu also surfaces known phrases around it; highlight any phrase to look it up together.</span></div></article><aside id="word-panel-host" aria-label="Word support"><section class="word-support reader-result" id="translation-output" aria-live="polite" aria-atomic="false">${renderWordSupport(state.translation,'reader')}</section></aside></div>`;
}
async function lookupReading(text,context,index=-1,start=null){
 if(!text.trim())throw new Error('Select a word or phrase inside your text.');
 if(text.length>1000)throw new Error('Choose a phrase shorter than 1,000 characters.');
 deviceSpeaker.stop();speaker.stop();
 readerReturnFocus=document.activeElement;
 const selectionStart=Number.isInteger(start)?start:index>=0?state.reader.tokens[index]?.start:null;
 const contextStart=selectionStart!==null?state.reader.text.lastIndexOf(context,selectionStart):-1;
 const phraseOptions=index>=0?U.phraseOptionsAround(state.reader.tokens,index,state.translation.sourceLang,G.lookup):[];
 invalidateTranslation(true);Object.assign(state.translation,{front:text.trim(),context,contextOffset:contextStart>=0?selectionStart-contextStart:null,back:'',busy:false,phraseOptions});state.reader.selectedIndex=index;state.reader.selectionStart=selectionStart;state.reader.selectionEnd=selectionStart===null?null:selectionStart+text.trim().length;state.reader.lookup=true;state.reader.panelOpen=true;
 updateReaderSelection();
 const found=G.resolve(text.trim(),state.translation.sourceLang,state.translation.targetLang);
 if(found.status==='found')await useGraph(found.conceptId);
 else if(found.status==='ambiguous'){state.translation.choices=found.candidates;updateOutput();}
 else{updateOutput();await translate();}
}
function updateReaderSelection(){
 if(state.view!=='reader')return;
 nextSteps?.refresh();
 for(const token of document.querySelectorAll('.reader-token')){const i=Number(token.dataset.index),t=state.reader.tokens[i],r=state.reader;const selected=r.panelOpen&&(i===r.selectedIndex||(Number.isInteger(r.selectionStart)&&t?.start>=r.selectionStart&&t?.start<r.selectionEnd));token.classList.toggle('selected',selected);token.setAttribute('aria-pressed',String(selected));}
}
function parkWordPanel(){
 const sheet=$('#word-sheet'),host=$('#word-panel-host'),panel=$('#word-sheet #translation-output');
 if(panel&&host)host.append(panel);
 if(sheet?.open){sheet.dataset.silent='true';sheet.close();}
 document.body.classList.remove('word-sheet-open');
}
function placeWordPanel(){
 // Do not place a newly modal mobile sheet above an open context editor.
 // The editor's close event restores the appropriate responsive panel.
 if(state.view!=='reader'||modal.open)return;
 const sheet=$('#word-sheet'),panel=$('#translation-output'),host=$('#word-panel-host');if(!sheet||!panel||!host)return;
 if(matchMedia('(max-width: 1000px)').matches&&state.reader.panelOpen){
  if(panel.parentElement!==$('#word-sheet-body'))$('#word-sheet-body').append(panel);
  if(!sheet.open){sheet.showModal();document.body.classList.add('word-sheet-open');}
 }else parkWordPanel();
}
function closeWordPanel(){
 state.reader.panelOpen=false;deviceSpeaker.stop();speaker.stop();parkWordPanel();updateOutput();updateReaderSelection();
 const trigger=readerReturnFocus?.isConnected?readerReturnFocus:$(`.reader-token[data-index="${state.reader.selectedIndex}"]`);trigger?.focus({preventScroll:true});
}
function panelSaved(t){
 const cards=state.cards.filter(c=>!c.archived&&c.sourceLang===t.sourceLang&&c.targetLang===t.targetLang);
 const exact=cards.find(c=>U.sameIdentity(c,t,C.identity));if(exact)return exact;
 // A corrected custom meaning changes identity. Reuse it only in the exact source context.
 const contextual=cards.filter(c=>C.normalize(c.front)===C.normalize(t.front)&&t.context&&c.context===t.context);
 return contextual.length===1?contextual[0]:null;
}
function renderStructureLens(item){
 const history=state.reader.syntaxHistory?.[item.id]||[],probs=Syntax.posterior(item,history),status=Syntax.evidenceLabel(item,probs),next=Syntax.nextDiagnostic(item,history),done=new Set(history);
 const analyses=item.analyses.map((a,i)=>`<article class="syntax-analysis${probs[i]===Math.max(...probs)?' leading':''}"><div class="syntax-analysis-top"><strong>${E(a.label)}</strong><span>${Math.round(probs[i]*100)}%</span></div><p>${E(a.meaning)}</p><code dir="auto">${E(a.structure)}</code></article>`).join('');
 const diagnostics=item.diagnostics.map(d=>{
  const ran=done.has(d.id),recommended=next?.diagnostic?.id===d.id;
  if(!ran)return `<button class="syntax-diagnostic${recommended?' recommended':''}" data-action="syntax-run" data-case="${E(item.id)}" data-diagnostic="${E(d.id)}"><span><strong>${E(d.compact||d.label)}</strong><small>${E(d.prompt)}</small></span>${recommended?'<em>Best next test</em>':icon('arrow')}</button>`;
  const outcome=d.observed==='unclear'?'Inconclusive':d.observed==='instrument'?'Instrumental reading':d.observed==='student'?'Student-associated reading':d.observed;
  return `<article class="syntax-result"><div class="syntax-result-top"><strong>${E(d.compact||d.label)}</strong><span>${E(outcome)}</span></div><blockquote dir="auto">${E(d.transformed)}</blockquote><p>${E(d.reading)}</p><small>${E(d.caveat)}</small></article>`;
 }).join('');
 return `<details class="syntax-lens" data-disclosure-key="syntax:${E(item.id)}"><summary><span>Structure lens</span><small>${E(item.shortLabel)} · 2 plausible readings</small></summary><div class="syntax-lens-body"><div class="syntax-status"><span class="syntax-status-label">${E(status.label)}</span><p>${E(status.detail)}</p></div><p class="syntax-note">${E(item.note)}</p><div class="syntax-analyses">${analyses}</div><div class="syntax-explain"><strong>Relative support</strong><span>Authored evidence weights, not calibrated parse probabilities.</span></div><div class="syntax-diagnostics"><h3>${history.length?'Evidence so far':'Test the structures'}</h3>${diagnostics}</div><div class="syntax-lens-footer"><p>Sentence-level evidence only. These tests never update your learner mastery or review schedule.</p>${history.length?`<button class="text-button" data-action="syntax-reset" data-case="${E(item.id)}">Reset diagnostics</button>`:''}</div></div></details>`;
}
function renderWordSupport(t,source){
 const empty=source==='reader'&&(!state.reader.lookup||!state.reader.panelOpen||!t.front);
 const header=`<div class="support-header"><span>${icon('book')} ${source==='reader'?'In context':'Word details'}</span>${source==='reader'&&!empty?`<button class="icon-button" data-action="close-word-panel" aria-label="Return to reading">${icon('close')}</button>`:''}</div>`;
 const presence=Scribe.renderPresence(empty?{}:t,state.settings.nabuPresence,E);
 if(empty)return `${header}<div class="support-body">${presence}<div class="support-empty"><h2>A word catches your eye?</h2><p>Select a word or phrase to understand it here.</p><p class="quiet-tip">Your place stays right here.</p></div></div>`;
 const c=G.concept(t.conceptId),saved=panelSaved(t),meaning=saved?.back||t.back;
 const deep=Scribe.mode(state.settings.explanationMode)==='depth';
 const modeBar=`<div class="support-modes" role="group" aria-label="Explanation mode"><button data-action="explanation-mode" data-mode="glance" aria-pressed="${!deep}" aria-controls="support-depth">At a glance</button><button data-action="explanation-mode" data-mode="depth" aria-pressed="${deep}" aria-controls="support-depth">In depth</button></div>`;
 const kind=c?(c.kind==='expression'?'Expression':c.kind==='phrase'?'Phrase':'Word'):t.front?.trim().includes(' ')?'Phrase':'Word';
 const heading=`<p class="word-language">${E(C.languageName(t.sourceLang))} / ${E(kind)}</p><div class="word-heading"><h2 id="support-word" dir="auto" lang="${t.sourceLang}">${E(t.front)}</h2><button class="icon-button" data-action="support-listen" data-text="${E(t.front)}" data-language="${t.sourceLang}" aria-label="Listen to ${E(t.front)}">${icon('speaker')}</button></div><p class="voice-availability">${E(voiceAvailability(t.sourceLang))}</p>`;
 const context=t.context?`<section class="word-source"><h3>${source==='reader'?'From your text':'Source context'}</h3><blockquote dir="auto" lang="${t.sourceLang}">${U.highlightContext(t.context,t.front,t.contextOffset)}</blockquote></section>`:'<p class="small-print">No source sentence attached.</p>';
 let body='';
 if(t.busy)body='<div class="support-loading" role="status"><span class="spinner" aria-hidden="true"></span>Looking up this selection…</div>';
 else if(t.choices?.length)body=`<p class="word-provider">Which meaning fits the sentence?</p><div class="sense-choices">${t.choices.map(x=>`<button data-action="choose-sense" data-id="${E(x.id)}"><strong dir="auto">${E(x.terms[t.targetLang])}</strong><span>${E(x.sense)}</span>${icon('arrow')}</button>`).join('')}</div>`;
 else if(t.error||!meaning)body=`<div class="support-error" role="${t.error?'alert':'status'}">${E(t.error||'This expression is not in the offline bank. No meaning has been invented.')}</div><div class="button-row"><button class="button secondary" data-action="translate">Retry lookup</button>${state.backend?.translationEnabled?'<button class="text-button" data-action="cloud-translate">Translate with DeepL</button>':''}<button class="text-button" data-action="add-manual">Add your own meaning</button></div>`;
 else body=`<p class="word-definition" dir="auto" lang="${t.targetLang}">${E(meaning)}</p>${saved&&saved.back!==t.back?'<p class="word-provider">Your saved meaning</p>':''}${c&&C.normalize(c.sense)!==C.normalize(t.front)&&C.normalize(c.sense)!==C.normalize(meaning)?`<p class="word-sense">${E(c.sense)}</p>`:''}`;
 const reading=T.readingForCard({...t,...(saved?{reading:saved.reading,readingMethod:saved.readingMethod}:{})},G.transliterationOf(t.front,t.sourceLang)||'');
 const details={...enrichCard(c,t.sourceLang,t.targetLang),...(t.usage?{usage:t.usage}:{}),...(saved||{})};
 const item=source==='reader'?explore.active():null;
 const syntaxCase=source==='reader'?Syntax.findCase(t.context||state.reader.text,t.sourceLang):null;
 const phrases=(t.phraseOptions||[]).filter(x=>x.text!==t.front).slice(0,3);
 const depth=`<section class="support-depth" id="support-depth" aria-label="In depth explanation"${deep?'':' hidden'}>
 <h3>Why this reading?</h3><p>${E(t.contentAnnotationId?t.usage||'This note is anchored to the selected expression in this passage.':c?'The spelling matches this entry in the bundled word bank. It is evidence for a possible sense, not a contextual parse.':t.provider?.includes('DeepL')?'The configured translator received the selected text and its supplied sentence context. No grammatical derivation was returned.':'Only the saved or supplied meaning is available. No further analysis has been invented.')}</p>
 ${details.usage?`<h3>Grammar & usage evidence</h3><p dir="auto">${E(details.usage)}</p>`:''}${item?.register?`<h3>Register</h3><p>${E(item.register)}</p>`:''}
 ${details.literal?`<h3>Literal wording · not necessarily the intended meaning</h3><p dir="auto">${E(details.literal)}</p>`:''}
 ${details.example?`<h3>Additional bank example · not your source</h3><p dir="auto" lang="${t.sourceLang}">${E(details.example)}</p>`:''}
 ${saved&&saved.back!==t.back&&t.back?`<details><summary>Compare with lookup result</summary><p dir="auto" lang="${t.targetLang}">${E(t.back)}</p><p>Your correction remains saved. Looking up again does not replace it.</p></details>`:''}
 <h3>Reading aid · separate from audio pronunciation</h3>${reading.available?`<p dir="auto" class="reading-output">${E(reading.text)}</p><p class="reading-status">${E(reading.status.replaceAll('-',' '))} / ${E(reading.method)}</p>`:''}<p>${E(reading.warning||'No supported automatic reading aid.')}</p>
 ${saved?.note?`<h3>Your private note</h3><p dir="auto">${E(saved.note)}</p>`:''}${meaning?`<div class="button-row"><button class="text-button" data-action="show-context" ${saved?`data-card-id="${saved.id}"`:c?`data-concept="${c.id}"`:''}>${saved?'Edit context, notes & reading aid':'Add notes & reading aid'}</button>${saved?`<button class="text-button" data-action="edit-card" data-id="${saved.id}">Correct saved meaning</button>`:''}</div>`:''}
 ${saved?W.imageFigure(saved,E):''}<h3>Sources & limits</h3><p>${E(details.provenance||t.provenance||t.provider||'Bundled offline bank')}. ${E(t.contentAnnotationId?item?.editorialStatus||'AI-assisted editorial draft.':'Historical perspectives cannot establish current usage. No regional form is marked wrong merely because it is unfamiliar.')}</p>
 ${(item?.sourceReferences||[]).map(ref=>`<p><a href="${E(ref.url)}" target="_blank" rel="noopener noreferrer">${E(ref.title)}</a> · ${E(ref.use)}</p>`).join('')}
 ${phrases.length?`<h3>Also in this passage</h3><div class="phrase-suggestions">${phrases.map(x=>`<button class="phrase-chip" data-action="support-phrase" data-text="${E(x.text)}" data-start="${x.start}"><span dir="auto">${E(x.text)}</span></button>`).join('')}</div>`:''}
 ${syntaxCase?renderStructureLens(syntaxCase):''}${Scribe.councilMarkup(t,E,C.languageName)}</section>`;
 const canSave=meaning&&!t.error&&!t.busy&&!t.choices?.length,contextChanged=!!(saved&&t.context&&saved.context!==t.context);
 const footer=canSave?`<div class="word-save">${t.saveError?`<p class="support-error" role="alert">${E(t.saveError)}</p>`:''}${saved&&!contextChanged&&!t.saving&&!t.saveError?`<div class="word-save-status" role="status">${icon('check')} ${E(savedLabel())}</div><button class="button secondary" data-action="show-context" data-card-id="${saved.id}">Edit context & note</button>`:`<button class="button primary" data-action="save-support-word"${t.saving?' disabled aria-busy="true"':''}>${t.saving?'Saving…':t.saveError?'Retry save':contextChanged?'Save this context':'Save word'} ${t.saving?'':icon('plus')}</button>`}<p class="save-footnote">${t.saving?'Keeping this word and its context.':saved&&contextChanged?'Updates this source sentence; notes and review history are preserved.':saved?'Kept in your library.':'Keep this word and its original context.'}</p></div>`:'';
 return `${header}<div class="support-body">${presence}${modeBar}${heading}${body}${context}<p class="support-uncertainty">${E(Scribe.uncertainty(t,c,saved))}</p>${footer}${depth}<div data-audio-host></div>${source==='reader'?'<button class="text-button" data-action="close-word-panel">Return to reading</button>':''}</div>`;
}
function voiceAvailability(language){
 if(state.settings.speechProvider==='cloud')return state.backend?.speechEnabled&&state.backend?.speechLanguages?.includes(language)?'Cloud voice configured; playback is checked when you press Listen.':'Cloud pronunciation unavailable. Listen offers device voice when available.';
 const voices=globalThis.speechSynthesis?.getVoices?.()||[];
 return voices.some(v=>v.lang?.split('-')[0].toLowerCase()===language.split('-')[0].toLowerCase())?'Device pronunciation available; press Listen.':'No matching device voice reported. Listen checks again and explains unavailable states.';
}
async function saveSupportWord(){
 if(state.view==='graph'&&state.translation.conceptId!==state.graph.selectedId){await useGraph(state.graph.selectedId);}
 const t=state.translation;if(t.saving)return;
 if(!t.back||t.busy||t.choices?.length)throw new Error('Choose a meaning before saving.');
 const epoch=state.translationEpoch,owner=state.user?.id||'guest',saved=panelSaved(t),item={...t},concept=G.concept(t.conceptId);
 const current=()=>epoch===state.translationEpoch&&owner===(state.user?.id||'guest');
 t.saving=true;t.saveError='';updateOutput();
 try{
  if(saved&&item.context&&saved.context!==item.context)await DB.editCard(saved.id,{...saved,context:item.context,...(item.contentAnnotationId?{provenance:item.provenance}:{} )},saved.revision);
  else if(!saved)await DB.commitTranslation({...item,deck:'My words',tags:concept?[concept.category]:[],note:'',learningMode:'reference',...enrichCard(concept,item.sourceLang,item.targetLang),...(item.contentAnnotationId?{usage:item.usage,provenance:item.provenance,reviewStatus:'draft'}:{})},current);
  if(owner!==(state.user?.id||'guest'))return;
  await loadData(false);channel?.postMessage({changed:true});
  if(!current())return;
  t.saving=false;const result=panelSaved(t);if(!result)throw new Error('The word was not confirmed in your library.');
  t.savedCardId=result.id;updateOutput();renderNav();
 }catch(error){if(!current())return;t.saving=false;t.saveError='Could not save. '+(error.message||'Try again.');updateOutput();}
}

function practiceCandidate(){
 const r=state.review;if(!r.sessionStarted||r.sessionEnded)return null;
 const canListen=state.settings.speechProvider==='device'||!!state.backend?.speechEnabled;
 return C.practiceQueue(state.cards,state.logs,Date.now(),state.settings.newLimit,r.deck,canListen).filter(x=>!r.practice||r.practice==='mixed'||x.mode===r.practice)[0]||null;
}
function evidenceMarkup(){const rows=Object.entries(C.evidenceSummary(state.logs));return `<details class="panel evidence-panel"><summary>Your practice evidence</summary><p class="small-print">Self-rated answers, not certified proficiency. Delayed recall uses reviews at least 24 hours after the previous review in the same mode.</p><div class="evidence-table">${rows.map(([m,s])=>`<div><strong>${E({recognition:'Meaning',production:'Production',listening:'Listening',cloze:'Sentence completion'}[m])}</strong><span>${s.attempts} attempts</span><span>${s.delayedAttempts?Math.round(100*s.delayedRecalled/s.delayedAttempts)+'% delayed recall / '+s.delayedAttempts+' checks':'No delayed evidence yet'}</span><span>${Math.round(s.seconds/60)} min</span></div>`).join('')}</div></details>`;}
function renderFocusedReview(){
 const r=state.review,learn=activeCards().filter(c=>c.learningMode!=='reference');
 const header=pageHeading('','Review','Five minutes. Your words. Separate progress for each skill.');
 if(!r.sessionStarted)return `${header}<section class="panel practice-start"><span class="eyebrow">A SMALL DAILY PRACTICE</span><h2>Make your words stick.</h2><p>${learn.length} cards in Learning. Saved references stay out of your review queue.</p><div class="form-grid"><div class="form-field"><label for="practice-mode">Practice</label><select class="select" id="practice-mode">${[['mixed','Mixed practice'],['recognition','Recall the meaning'],['production','Produce the word'],['listening','Listen and recall'],['cloze','Complete a sentence']].map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select></div><div class="form-field"><label for="practice-deck">Collection</label><select class="select" id="practice-deck">${deckOptions(r.deck)}</select></div></div><button class="button primary" data-action="start-practice">Review for five minutes ${icon('arrow')}</button><button class="text-button" data-action="go" data-view="library">Choose words to learn</button></section>${evidenceMarkup()}`;
 let c=findCard(r.cardId);if(!c&&!r.sessionEnded){selectReview();c=findCard(r.cardId);}
 const elapsed=Math.min(300,Math.floor((Date.now()-r.sessionStarted)/1000));
 if(r.sessionEnded||!c)return `${header}<section class="panel practice-start"><span class="eyebrow">SESSION FINISHED</span><h2>${r.count?'Good work.':'Nothing due in this practice mode.'}</h2><p>${r.count} answers recorded in ${Math.max(1,Math.round(elapsed/60))} minute${elapsed<90?'':'s'}. ${E(savedLabel())}.</p>${!r.count?'<p class="small-print">Move references into Learning. Listening needs a voice provider; sentence completion needs context containing the word.</p>':''}<div class="button-row"><button class="button primary" data-action="reset-practice">Choose another session</button><button class="button secondary" data-action="go" data-view="translate">Translate</button>${r.undo?'<button class="text-button" data-action="undo-review">Undo last answer</button>':''}</div></section>${evidenceMarkup()}`;
 renderedReviewRevision=c.revision;
 const mode=r.mode||'recognition',production=mode==='production',completion=mode==='cloze',listening=mode==='listening';
 const prompt=production?c.back:completion?C.clozeText(c):listening?'Listen, then recall the meaning.':c.front;
 const answer=production||completion?c.front:c.back,lang=production?c.targetLang:c.sourceLang,answerLang=production||completion?c.sourceLang:c.targetLang;
 const label={recognition:'Recall the meaning',production:'Produce the word',listening:'Listen and recall',cloze:'Complete the sentence'}[mode];
 const s=C.skillSchedule(c,mode),at=Date.now(),remaining=Math.max(0,300-elapsed);
 return `${header}<div class="review-wrap"><div class="review-topline"><span>${E(label)} / ${r.count} reviewed</span><span id="practice-clock" class="timer">${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')}</span><button class="text-button" data-action="end-practice">End session</button></div><section class="panel review-card"><div class="review-language"><span>${E(C.languageName(lang))}</span>${icon('arrow')}<span>${E(C.languageName(answerLang))}</span></div><h2 class="review-word${listening?' listening-prompt':''}" lang="${lang}" dir="auto">${E(prompt)}</h2>${mode==='recognition'&&c.context?`<p class="review-context" dir="auto">${E(c.context)}</p>`:''}${!production&&!completion?`<button class="button secondary" data-action="speak-review">${icon('speaker')} ${listening?'Play phrase':'Listen'}</button>`:''}${r.revealed?`<div class="review-answer" lang="${answerLang}" dir="auto">${E(answer)}</div>${listening?`<p lang="${c.sourceLang}" dir="auto">${E(c.front)}</p>`:''}${r.typed?`<p class="typed-comparison">You wrote: <span dir="auto">${E(r.typed)}</span></p>`:''}${c.note?`<p class="review-note" dir="auto">${E(c.note)}</p>`:''}<p class="review-key">Rate your recall honestly. Again means you forgot.</p>`:`<label class="review-prompt" for="review-typed">Your answer (optional)</label><input id="review-typed" class="input type-answer" dir="auto" lang="${answerLang}" autocomplete="off" value="${E(r.typed)}"><button class="button primary review-reveal" data-action="reveal">Reveal answer</button><span class="review-key">Space or Enter to reveal</span>`}</section>${r.revealed?`<div class="rating-row">${[[1,'Again','again'],[2,'Hard','hard'],[3,'Good','good'],[4,'Easy','easy']].map(([rating,label,cls])=>`<button class="rating-button ${cls}" data-action="grade" data-rating="${rating}"${r.busy?' disabled':''}><span>${label}</span><small>${C.intervalLabel(C.scheduleReview(s,rating,at).due-at)} / ${rating}</small></button>`).join('')}</div>`:''}<div class="review-footer"><button class="text-button" data-action="skip-practice">Skip without grading</button><button class="text-button" data-action="undo-review"${r.undo?'':' disabled'}>Undo last answer</button></div></div>`;
}
async function openCollaboration(id){
 const [item,collab]=await Promise.all([api(`shared-libraries/${id}`),api(`shared-libraries/${id}/collaboration`)]);
 state.sharedPreview=item;state.collaboration=collab;
 const editing=['owner','contributor'].includes(collab.role);
 showModal(item.title,`<div class="collection-meta"><span class="pill">${E(collab.role)}</span><span>Version ${item.revision} / ${item.count} entries / @${E(item.owner)}</span></div><p class="modal-intro">${E(item.description)} Shared entries have an approval history. Your notes and learning schedules remain private.</p><div class="button-row"><button class="button primary" data-action="import-shared">Import new words</button>${editing?'<button class="button secondary" data-action="propose-entry">Propose a word</button>':''}<button class="text-button" data-action="open-shared" data-id="${item.id}">Refresh</button></div><div class="shared-preview-list">${collab.entries.map(c=>`<div class="shared-preview-word"><span dir="auto" lang="${c.sourceLang}">${E(c.front)}</span><span dir="auto" lang="${c.targetLang}">${E(c.back)}</span>${editing?`<button class="text-button" data-action="propose-entry" data-entry="${c.entryId}">Suggest correction</button>`:''}</div>`).join('')}</div>${collab.proposals.length?`<h3 class="space-top">Proposals</h3>${collab.proposals.map(p=>`<article class="proposal-card"><div><strong dir="auto">${E(p.entry.front)} / ${E(p.entry.back)}</strong><p class="small-print">@${E(p.author)} / ${p.status} / based on version ${p.revision}</p>${p.entry.usage?`<p>${E(p.entry.usage)}</p>`:''}</div>${p.status==='pending'&&collab.role==='owner'?`<div class="button-row"><button class="button primary small" data-action="decide-proposal" data-id="${p.id}" data-status="accepted"${p.revision!==item.revision?' disabled':''}>Approve</button><button class="text-button" data-action="decide-proposal" data-id="${p.id}" data-status="declined">Decline</button>${p.revision!==item.revision?'<small>Stale proposal. Ask the contributor to resubmit.</small>':''}</div>`:''}</article>`).join('')}`:''}${collab.role==='owner'?`<details class="space-top"><summary>Contributor permissions</summary><p class="small-print">Viewers can import. Contributors can propose words and corrections. Only you approve publication.</p>${collab.members.map(m=>`<div class="friend-row"><strong>@${E(m.handle)}</strong><div class="button-row"><button class="button secondary small" data-action="member-role" data-handle="${E(m.handle)}" data-role="${m.role==='viewer'?'contributor':'viewer'}">${m.role==='viewer'?'Make contributor':'Make viewer'}</button><button class="text-button" data-action="revoke-shared-member" data-id="${item.id}" data-handle="${E(m.handle)}">Remove</button></div></div>`).join('')}<form id="add-contributor-form" class="space-top"><label for="collab-friend">Add an accepted friend</label><div class="inline-form"><select id="collab-friend" class="select" name="handle">${state.friends.friends.filter(f=>!collab.members.some(m=>m.handle===f.handle)).map(f=>`<option value="${E(f.handle)}">@${E(f.handle)}</option>`).join('')}</select><button type="submit" class="button secondary">Add contributor</button></div></form></details>`:''}${collab.events.length?`<details class="space-top"><summary>Change history</summary>${collab.events.map(e=>`<div class="change-event"><strong>${E(e.kind)} / version ${e.revision}</strong><small>@${E(e.actor)} / ${E(new Date(e.at).toLocaleString())}</small>${e.changes.before?`<p>Before: ${E(e.changes.before.front)} / ${E(e.changes.before.back)}</p>`:''}${e.changes.after?`<p>After: ${E(e.changes.after.front)} / ${E(e.changes.after.back)}</p>`:''}</div>`).join('')}</details>`:''}<p class="small-print space-top">Imported copies are independent. Updates never overwrite private notes or schedules. Removing access cannot erase a copy already imported.</p><div class="modal-footer"><button class="button secondary" data-action="revoke-shared" data-id="${item.id}">${item.owned?'Stop sharing':'Leave collection'}</button><button class="button primary" data-action="close-modal">Done</button></div>`);
}
function openProposal(entryId=''){
 const c=state.collaboration.entries.find(x=>x.entryId===entryId)||{front:'',back:'',sourceLang:state.settings.sourceLang,targetLang:state.settings.targetLang};
 state.proposalEntryId=entryId;
 showModal(entryId?'Suggest a correction':'Propose a word',`<p class="modal-intro">Only the owner can publish your proposal. Private notes and learning progress are never included.</p><form id="proposal-form"><div class="form-grid"><div class="form-field"><label for="proposal-source">Word language</label><select id="proposal-source" name="sourceLang" class="select">${langOptions(c.sourceLang)}</select></div><div class="form-field"><label for="proposal-target">Meaning language</label><select id="proposal-target" name="targetLang" class="select">${langOptions(c.targetLang)}</select></div></div>${[['front','Word or phrase',1000],['back','Meaning',1000],['literal','Literal guide',1500],['usage','When to use it',1500],['example','Example in the word language',1500],['reply','Possible reply',1500],['provenance','Source / explanation',300]].map(([key,label,max])=>`<div class="form-field"><label for="proposal-${key}">${label}</label><textarea class="input" id="proposal-${key}" name="${key}" maxlength="${max}" rows="2" dir="auto"${['front','back'].includes(key)?' required':''}>${E(c[key]||'')}</textarea></div>`).join('')}<div class="modal-footer"><button class="button secondary" type="button" data-action="open-shared" data-id="${state.sharedPreview.id}">Cancel</button><button class="button primary" type="submit">Submit proposal</button></div></form>`);
}
Object.assign(actions,{
 'toggle-notifications':async()=>{if(state.settings.notifications){state.settings.notifications=false;}else{if(!globalThis.Notification)throw new Error('This browser does not support desktop notifications. Your Friends badge still works.');const permission=await Notification.requestPermission();if(permission!=='granted')throw new Error('Notifications are not enabled. Check the Friends badge instead.');state.settings.notifications=true;}await DB.setMeta('settings',state.settings);render();},
 'study-toggle':async b=>{const c=findCard(b.dataset.id);if(!c)return;await DB.editCard(c.id,{...c,learningMode:c.learningMode==='reference'?'learning':'reference'},c.revision);await changed();toast(c.learningMode==='reference'?'Added to Learning.':'Kept in Reference. No review reminders.');},
 'learn-filtered':async()=>{const cards=filteredCards().filter(c=>!c.archived&&c.learningMode==='reference');for(const c of cards)await DB.editCard(c.id,{...c,learningMode:'learning'},c.revision);await changed();toast(cards.length+' cards moved to Learning.');},
 'forgot-password':async()=>openForgot(),
 'recovery-settings':async()=>openRecoverySettings(),
 'download-recovery':async()=>download('nabu-recovery-code.txt',`Nabu account recovery\nSite: ${window.NabuNative?.apiOrigin||location.origin}\nHandle: ${state.user?.handle||state.recoveryHandle||''}\nCode: ${$('#recovery-code').value}\nKeep private. One use. Replacing a code invalidates the old code.\n`,'text/plain'),
 'sync-panel':openSync,'sync-now':async()=>{await checkBackend();if(!state.user)return openAuth('login');await DB.syncNow();await loadData(false);renderNav();await openSync();},
 'export-pending':async()=>download('nabu-pending-changes.json',await DB.exportPending(),'application/json'),
 'confirm-server-copy':async()=>showModal('Discard pending changes?',`<p class="modal-intro">Use the server library and remove ALL queued changes from this device. Export them first. This is not a merge.</p><div class="button-row"><button class="button secondary" data-action="export-pending">Export pending changes</button><button class="button danger" data-action="resolve-sync" data-choice="server">Discard queue and use server</button><button class="text-button" data-action="sync-panel">Cancel</button></div>`),
 'resolve-sync':async b=>{await DB.resolveConflict(b.dataset.choice);await loadData(false);render();await openSync();},
 'read-text':async()=>{const text=$('#reader-input').value;if(!text.trim()){const error=$('#reader-input-error');error.hidden=false;error.textContent='Paste some text before you start reading.';$('#reader-input').focus();return;}state.reader.text=text;state.reader.draft=text;state.reader.title=$('#reader-title')?.value.trim()||'';state.reader.titleDraft=state.reader.title;state.reader.tokens=readingTokens(text,state.translation.sourceLang);state.reader.selectedIndex=-1;state.reader.lookup=false;state.reader.panelOpen=false;state.reader.editing=false;state.reader.example=false;state.reader.syntaxHistory={};readerSelection=null;render();},
 'edit-reader':async()=>{state.reader.editing=true;state.reader.draft=state.reader.text;state.reader.titleDraft=state.reader.title;parkWordPanel();render();$('#reader-input').focus();},
 'cancel-reader-edit':async()=>{state.reader.editing=false;state.reader.draft=state.reader.text;state.reader.titleDraft=state.reader.title;render();},
 'clear-reader':async()=>{state.reader={text:'',title:'',draft:'',tokens:[],selectedIndex:-1,lookup:false,panelOpen:false,editing:false,syntaxHistory:{}};invalidateTranslation(true);state.translation.front='';render();},
 'reader-example':async()=>{state.translation.sourceLang='en';state.translation.targetLang='es';state.reader.text='The researcher photographed the student with the telescope.';state.reader.draft=state.reader.text;state.reader.title='Two readings, one sentence';state.reader.titleDraft=state.reader.title;state.reader.example=true;state.reader.editing=false;state.reader.lookup=false;state.reader.panelOpen=false;state.reader.syntaxHistory={};state.reader.tokens=readingTokens(state.reader.text,'en');render();},
 'reader-word':async b=>{const i=Number(b.dataset.index),r=state.reader,t=r.tokens[i];if(t)await lookupReading(t.text,readingContext(r.text,t.start,t.text.length),i);},
 'support-phrase':async b=>{const text=b.dataset.text||'',start=Number(b.dataset.start);if(!text)return;await lookupReading(text,readingContext(state.reader.text,Number.isFinite(start)?start:0,text.length),-1,Number.isFinite(start)?start:null);},
 'syntax-run':async b=>{const item=Syntax.CASES.find(x=>x.id===b.dataset.case),diagnostic=item?.diagnostics.find(x=>x.id===b.dataset.diagnostic);if(!item||!diagnostic)return;state.reader.syntaxHistory=state.reader.syntaxHistory||{};const history=state.reader.syntaxHistory[item.id]||[];if(!history.includes(diagnostic.id))state.reader.syntaxHistory[item.id]=[...history,diagnostic.id];updateOutput();},
 'syntax-reset':async b=>{state.reader.syntaxHistory=state.reader.syntaxHistory||{};state.reader.syntaxHistory[b.dataset.case]=[];updateOutput();},
 'reader-selection':async()=>{const selected=U.captureSelection(window.getSelection(),$('#reader-text'),state.reader.text)||readerSelection;if(!selected)throw new Error('Highlight a phrase inside your text first.');await lookupReading(selected.text,selected.context,-1,selected.start);},
 'save-support-word':saveSupportWord,
 'close-word-panel':async()=>closeWordPanel(),
 'support-listen':async b=>{await speak(b.dataset.text,b.dataset.language);},
 'start-practice':async()=>{Object.assign(state.review,{practice:$('#practice-mode').value,deck:$('#practice-deck').value,sessionStarted:Date.now(),sessionEnded:false,count:0,undo:null,skipped:[]});selectReview();render();},
 'reset-practice':async()=>{state.review.sessionStarted=0;state.review.sessionEnded=false;state.review.cardId=null;render();},
 'end-practice':async()=>{state.review.sessionEnded=true;render();},
 'skip-practice':async()=>{state.review.skipped=state.review.skipped||[];state.review.skipped.push(state.review.cardId+':'+state.review.mode);selectReview();render();},
 'grade':async b=>{const r=state.review;if(!r.revealed||r.busy||!r.cardId)return;r.busy=true;try{const result=await DB.gradeCard(r.cardId,Number(b.dataset.rating),renderedReviewRevision,Math.min(300000,Date.now()-r.startedAt),Date.now(),r.mode||'recognition');r.undo=result.log.id;r.count++;await loadData(false);if(Date.now()-r.sessionStarted>=300000)r.sessionEnded=true;selectReview();channel?.postMessage({changed:true});render();}finally{r.busy=false;}},
 'open-shared':async b=>openCollaboration(b.dataset.id),
 'propose-entry':async b=>openProposal(b.dataset.entry||''),
 'member-role':async b=>{await api(`shared-libraries/${state.sharedPreview.id}/members`,{method:'PUT',body:{handle:b.dataset.handle,role:b.dataset.role}});await openCollaboration(state.sharedPreview.id);},
 'decide-proposal':async b=>{await api(`shared-libraries/${state.sharedPreview.id}/proposals/${b.dataset.id}`,{method:'PATCH',body:{status:b.dataset.status,revision:state.sharedPreview.revision}});await openCollaboration(state.sharedPreview.id);},
 'localize-literal':async b=>{
  const c=findCard(b.dataset.id);if(!c)return;const concept=G.concept(c.conceptId),v=G.translation(c.conceptId,c.sourceLang,c.targetLang);if(!v.literalGloss)throw new Error('No literal source guide for this phrase.');
  let literal=v.literalGloss;
  if(c.targetLang!=='en'){
   if(!state.user||!state.backend?.translationEnabled)throw new Error('This wording guide needs DeepL to display in '+C.languageName(c.targetLang)+'. Sign in on a server with DeepL configured.');
   const response=await api('translate',{method:'POST',body:{text:literal,sourceLang:'en',targetLang:c.targetLang,context:'Linguistic wording guide, not the idiomatic meaning.'},ms:35000});literal=response.translation;
  }
  await DB.editCard(c.id,{...c,literal,provenance:(c.provenance||'Nabu phrase bank')+' / literal guide '+(c.targetLang==='en'?'authored':'localized by DeepL')},c.revision);await changed();toast('Literal guide saved. It is an approximate wording guide, not a morpheme-level analysis.');
 }
});
async function handleUpgradeForm(form,data){
 if(form.id==='recovery-form'){const r=await api('recover',{method:'POST',body:data});const uid=state.user?.id;if(uid)await DB.forgetAccount(uid);state.recoveryHandle=data.handle;await activateAccount(null);openRecovery(r.recoveryCode,true);return true;}
 if(form.id==='rotate-recovery-form'){const r=await api('account/recovery',{method:'POST',body:data});openRecovery(r.recoveryCode);return true;}
 if(form.id==='proposal-form'){const id=state.sharedPreview.id;await api(`shared-libraries/${id}/proposals`,{method:'POST',body:{entryId:state.proposalEntryId||null,revision:state.sharedPreview.revision,entry:{...data,reviewStatus:'contributor'}}});await openCollaboration(id);return true;}
 if(form.id==='add-contributor-form'){if(!data.handle)throw new Error('Choose an accepted friend first.');await api(`shared-libraries/${state.sharedPreview.id}/members`,{method:'PUT',body:{handle:data.handle,role:'contributor'}});await openCollaboration(state.sharedPreview.id);return true;}
 return false;
}
const workspaces=Workspaces.createWorkspaceUI({api,getUser:()=>state.user,getMeta:DB.getMeta,mutateMeta:Local.mutateMeta,showModal,closeModal,download,escapeHTML:E,uid:C.uid});
const intents=IntentUI.installIntents({state,DB,C,E,actions,api,$});
const explore=Explore.installExplore({getIntentContext:()=>intents.getContext(),state,DB,C,U,E,actions,$,render,navigate,readingTokens,renderWordSupport,updateOutput,updateReaderSelection,placeWordPanel,invalidateTranslation,showModal,closeModal,api,download,icon,toast,stopSpeech:()=>{deviceSpeaker.stop();speaker.stop();},returnFocus:el=>{readerReturnFocus=el;},sameWord:(a,b)=>U.sameIdentity(a,b,C.identity),contentURL:(id,version)=>{const u=L.viewURL('reader',location.href,!!state.backend?.cleanRoutes&&!window.NabuNative);u.searchParams.set('content',id);u.searchParams.set('version',version);history.replaceState({view:'reader'},'',u);}});
function nextStepSource(){
 const r=state.reader,reading=state.view==='reader'&&!r.editing&&!!r.text;
 if(!reading)return {sourceLang:null,targetLang:state.translation.targetLang,hasMedia:false,format:'text'};
 const item=explore.active(),live=U.captureSelection(window.getSelection(),$('#reader-text'),r.text);
 let selected=live||(readerSelection?.tokenSet===r.tokens&&readerSelection?.sourceLang===state.translation.sourceLang&&readerSelection?.selectedIndex===r.selectedIndex?readerSelection:null);
 if(!selected&&r.lookup&&r.selectedIndex>=0){
  const token=r.tokens[r.selectedIndex],annotation=item?.annotations.find(a=>a.id===token?.annotationId);
  if(annotation){const segment=item.segments.find(s=>s.id===annotation.segmentId);let start=0;for(const s of item.segments){if(s.id===segment.id)break;start+=s.text.length+2;}selected={text:annotation.quote,start:start+X.scalarToUTF16(segment.text,annotation.start)};}
  else if(token)selected={text:token.text,start:token.start};
 }
 let start=selected?.start??null;
 // captureSelection trims its text. Advance only across the selected leading
 // whitespace; never search elsewhere and borrow another source occurrence.
 if(selected&&Number.isInteger(start)&&r.text.slice(start,start+selected.text.length)!==selected.text){while(start<r.text.length&&/\s/u.test(r.text[start]))start++;}
 return {contentId:item?.id||null,contentVersion:item?.version||null,sourceLang:state.translation.sourceLang,targetLang:state.translation.targetLang,text:r.text,selectedText:selected?.text||'',selectionStart:start,selectedIndex:r.selectedIndex,hasMedia:true,format:item?.genre||'text'};
}
nextSteps=NextStepUI.installNextSteps({state,DB,C,E,actions,api,$,intents,explore,getSource:nextStepSource,showModal,closeModal});
learner=LearnerUI.installLearnerSupport({state,C,E,actions,$,explore,intents,showModal,closeModal,download,stopSpeech:()=>{deviceSpeaker.stop();speaker.stop();}});
W.install({actions,state,C,DB,G,E,$,showModal,closeModal,modalError,toast,api,loadData,render,navigate,speak,openAuth,invalidateTranslation,readTranscript:(text,language)=>{state.translation.sourceLang=language;if(state.translation.targetLang===language)state.translation.targetLang=language==='en'?'es':'en';state.reader={text,draft:text,title:'',titleDraft:'',tokens:readingTokens(text,language),selectedIndex:-1,lookup:false,panelOpen:false,editing:false,example:false,syntaxHistory:{}};invalidateTranslation(true);navigate('reader');}});
let syncRenderTimer;

$('#word-sheet').addEventListener('close',()=>{document.body.classList.remove('word-sheet-open');if($('#word-sheet').dataset.silent){delete $('#word-sheet').dataset.silent;return;}closeWordPanel();});
$('#word-sheet').addEventListener('cancel',event=>{event.preventDefault();closeWordPanel();});
window.matchMedia('(max-width: 1000px)').addEventListener('change',()=>placeWordPanel());
document.addEventListener('selectionchange',()=>{if(state.view!=='reader')return;const selected=U.captureSelection(window.getSelection(),$('#reader-text'),state.reader.text);if(selected)readerSelection={...selected,tokenSet:state.reader.tokens,sourceLang:state.translation.sourceLang,selectedIndex:state.reader.selectedIndex};const button=$('#reader-selection-button');if(button)button.hidden=!selected;nextSteps?.refresh();});
document.addEventListener('click',event=>{if(event.target.closest('.reader-token'))readerSelection=null;},true);
window.addEventListener('nabu-account-change',()=>{state.reader={text:'',title:'',draft:'',tokens:[],selectedIndex:-1,lookup:false,panelOpen:false,editing:false,syntaxHistory:{}};readerSelection=null;readerReturnFocus=null;parkWordPanel();});

window.addEventListener('nabu-sync',()=>{clearTimeout(syncRenderTimer);syncRenderTimer=setTimeout(async()=>{renderNav();if(!state.user)return;try{await loadData(false);if(state.view!=='review')refreshPassiveUI();}catch{}},80);});
window.addEventListener('online',async()=>{try{if(state.user||state.accountHint){await checkBackend();if(state.user){await DB.syncNow();await loadData(false);render();}}}catch(e){showError(e);}});
window.addEventListener('beforeunload',event=>{if(DB.syncStatus().pending){event.preventDefault();event.returnValue='';}});
setInterval(()=>{
 if(state.view!=='review'||!state.review.sessionStarted||state.review.sessionEnded)return;
 const remaining=Math.max(0,300-Math.floor((Date.now()-state.review.sessionStarted)/1000)),clock=$('#practice-clock');
 if(clock)clock.textContent=Math.floor(remaining/60)+':'+String(remaining%60).padStart(2,'0');
},1000);

document.addEventListener('click',async event=>{
 const b=event.target.closest('[data-action]');if(!b||b.disabled)return;const fn=actions[b.dataset.action];if(!fn)return;
 event.preventDefault();try{await fn(b);}catch(e){if(e.code==='NABU_WORKSPACE_STALE')return;if(modal.open)modalError(e.message);else showError(e);}
});
document.addEventListener('submit',async event=>{
 const form=event.target;if(!(form instanceof HTMLFormElement))return;event.preventDefault();const button=form.querySelector('[type="submit"]');if(button?.disabled)return;
 try{
  if(form.id==='card-form'){await saveCardForm(form);return;}
  if(form.dataset.wsForm){if(button)button.disabled=true;await workspaces.submit(form);return;}
  if(button)button.disabled=true;
  const data=Object.fromEntries(new FormData(form));
  if(await handleUpgradeForm(form,data))return;
  if(form.id==='friend-form'){await api('friends',{method:'POST',body:{handle:data.handle.trim().replace(/^@/,'')}});state.friendDraft='';await refreshSocial(true);toast('Friend request sent.');}
  if(form.id==='publish-library-form'){
   const recipients=new FormData(form).getAll('recipients');if(!recipients.length)throw new Error('Choose at least one friend.');
   const cards=activeCards().filter(c=>!data.deck||c.deck===data.deck);if(!cards.length||cards.length>300)throw new Error('Choose a collection with 1 to 300 active cards.');
   await DB.syncNow();if(DB.syncStatus().pending)throw new Error('Sync the selected cards before sharing.');
   await api('shared-libraries',{method:'POST',body:{title:data.title.trim(),description:data.description,recipients,cardIds:cards.map(c=>c.id)}});closeModal();await refreshSocial();toast('Collection shared with selected friends.');
  }
  if(form.id==='update-shared-form'){
   const cards=activeCards().filter(c=>!data.deck||c.deck===data.deck);if(!cards.length||cards.length>300)throw new Error('Choose 1 to 300 active cards.');
   await api(`shared-libraries/${state.sharedPreview.id}`,{method:'PATCH',body:{cardIds:cards.map(c=>c.id),revision:state.sharedPreview.revision}});await openShared(state.sharedPreview.id);await refreshSocial();toast('Updated snapshot published.');
  }
  if(form.id==='settings-form'){
   if(data.sourceLang===data.targetLang)throw new Error('Choose two different default languages.');
   const limit=Number(data.newLimit);if(!Number.isInteger(limit)||limit<1||limit>100)throw new Error('Choose between 1 and 100 new words per day.');
   if(!['auto','local','public','workspace'].includes(data.provider))throw new Error('Choose a translation service.');
   if(!['cloud','device'].includes(data.speechProvider))throw new Error('Choose a supported voice service.');
   const speechRate=Number(data.speechRate);if(![1,0.85].includes(speechRate))throw new Error('Choose a supported playback speed.');
   state.settings.autoLearning=data.autoLearning==='on';
   const defaultsChanged=data.sourceLang!==state.settings.sourceLang||data.targetLang!==state.settings.targetLang;
   speaker.clear();
   state.settings={...state.settings,...data,speechRate,speechConsent:data.speechConsent==='on',newLimit:limit,alias:C.text(data.alias,'Display name',40)};await saveSettings();
   if(defaultsChanged){invalidateTranslation(true);state.translation.sourceLang=data.sourceLang;state.translation.targetLang=data.targetLang;}render();toast('Preferences saved.');
  }
  if(form.id==='reset-form'){
   if(data.confirm!=='DELETE')throw new Error('Type DELETE exactly to confirm.');
   speaker.clear();invalidateTranslation();await DB.clearAll();await explore.reload();await intents.refresh().catch(()=>{});state.settings={...DEFAULTS};state.graph={query:'',category:'',kind:'',limit:60,selectedId:'essentials.hello',mode:'2d',azimuth:28,tilt:28};state.review={cardId:null,revealed:false,typed:'',startedAt:0,count:0,undo:null,deck:'',busy:false};state.translation={front:'',back:'',sourceLang:'en',targetLang:'es',context:'',formality:'default',note:'',provider:'',busy:false,error:''};closeModal();await changed();toast(state.user?'Account library cleared. Account and shared snapshots remain.':'Local guest data removed.');
  }
  if(form.id==='auth-form'){
   const result=await api(form.dataset.mode==='register'?'register':'login',{method:'POST',body:data});speaker.clear();closeModal();await activateAccount(result.user,result.csrf);await refreshSocial();render();toast(`Signed in as @${state.user.handle}.`);if(result.recoveryCode)openRecovery(result.recoveryCode);if(state.resumeTranslation){state.resumeTranslation=false;await translate({forceCloud:true});}
  }
  if(form.id==='send-form'){
   const card=C.sharePayload(state.shareCard).card;
   await api('exchanges',{method:'POST',body:{recipient:data.recipient,message:data.message,card,requestId:form.dataset.requestId || (form.dataset.requestId=C.uid())}});
   state.pendingRecipient='';closeModal();await refreshExchange();toast('Word sent. Your friend can choose to keep it.');
  }
  if(form.id==='delete-account-form'){
   const uid=state.user?.id;speaker.clear();await api('account',{method:'DELETE',body:{password:data.password}});await DB.forgetAccount(uid);closeModal();await activateAccount(null);toast('Account and server library deleted. Guest words on this device are untouched.');
  }
 }catch(e){if(e.code==='NABU_WORKSPACE_STALE')return;if(modal.open)modalError(e.message);else showError(e);}finally{if(button)button.disabled=false;}
});
document.addEventListener('input',event=>{
 const el=event.target;
 if(el.id==='reader-input'){state.reader.draft=el.value;const error=$('#reader-input-error');if(error)error.hidden=true;}
 if(el.id==='reader-title')state.reader.titleDraft=el.value;
 if(el.id==='friend-handle')state.friendDraft=el.value;
 if(el.id==='graph-azimuth'||el.id==='graph-tilt'){state.graph[el.id==='graph-azimuth'?'azimuth':'tilt']=Number(el.value);return;}
 if(el.id==='graph-search'){state.graph.query=el.value;refreshGraphResults();}
 if(el.id==='translation-context'){const value=el.value;invalidateTranslation();state.translation.context=value;updateOutput();}
 if(el.id==='translation-input'){invalidateTranslation();state.translation.front=el.value;$('#character-count').textContent=`${el.value.length} / 2,000`;updateOutput();const suggest=$('#word-suggestions');if(suggest)suggest.innerHTML=renderSuggestions();}
 if(el.id==='library-search'){state.filters.q=el.value;state.limit=60;$('#library-results').innerHTML=renderLibraryResults();}
 if(el.id==='review-typed')state.review.typed=el.value;
 if(el.closest('#send-form'))delete el.closest('#send-form').dataset.requestId;
 if(el.id==='pick-share-search')$('#share-picker').innerHTML=renderSharePicker(activeCards().filter(c=>C.searchText(c.front+' '+c.back).includes(C.searchText(el.value))));
});
document.addEventListener('change',async event=>{
 const el=event.target;
 try{
  if(el.id==='graph-azimuth'||el.id==='graph-tilt'){$('#graph-main-canvas').innerHTML=renderConceptGraph();return;}
  if(el.id==='translation-formality'){invalidateTranslation();state.translation.formality=el.value;updateOutput();}
  if(el.id==='source-language'||el.id==='target-language'){
   if(state.view==='reader'){const source=el.id==='source-language'?el.value:state.translation.sourceLang,target=el.id==='target-language'?el.value:state.translation.targetLang;if(source===target){toast('Choose two different languages.','',null,true);el.value=el.id==='source-language'?state.translation.sourceLang:state.translation.targetLang;return;}invalidateTranslation(true);Object.assign(state.translation,{sourceLang:source,targetLang:target});state.reader.tokens=readingTokens(state.reader.text,source);state.reader.lookup=false;state.reader.panelOpen=false;render();await rememberPair();return;}
   const old={...state.translation},isSource=el.id==='source-language';let source=isSource?el.value:old.sourceLang,target=isSource?old.targetLang:el.value;
   if(source===target){if(isSource)target=old.sourceLang;else source=old.targetLang;}
   if(G.concept(old.conceptId)){await useGraph(old.conceptId,source,target);}else{invalidateTranslation(true);Object.assign(state.translation,{sourceLang:source,targetLang:target});render();await rememberPair();}
  }
  if(el.id==='graph-category'){state.graph.category=el.value;refreshGraphResults();}
  if(el.id==='translation-consent'){state.settings.consent=el.checked;await saveSettings();}
  if(el.id.startsWith('filter-')){const key={'filter-language':'lang','filter-deck':'deck','filter-status':'status','filter-sort':'sort'}[el.id];if(key){state.filters[key]=el.value;state.limit=60;$('#library-results').innerHTML=renderLibraryResults();}}
  if(el.id==='review-deck'){state.review.deck=el.value;selectReview();render();}
  if(el.id==='import-file')await previewImport(el.files[0]);
  if(el.id==='import-source'||el.id==='import-target'){state.importEpoch=(state.importEpoch||0)+1;state.importData=null;$('#import-preview').innerHTML='';$('#import-file').value='';}
 }catch(e){if(e.code==='NABU_WORKSPACE_STALE')return;if(modal.open)modalError(e.message);else showError(e);}
});
document.addEventListener('select',event=>{if(event.target.id==='translation-input'){const el=event.target;const button=$('#selection-button');if(button)button.hidden=!(el.selectionEnd>el.selectionStart);}});
document.addEventListener('keydown',event=>{
 if((event.key==='Enter'||event.key===' ')&&(event.target?.classList?.contains('spatial-clickable')||event.target?.classList?.contains('map-clickable'))){event.preventDefault();event.target.dispatchEvent(new MouseEvent('click',{bubbles:true}));return;}

 if(event.isComposing||modal.open)return;
 const editing=['INPUT','TEXTAREA','SELECT'].includes(event.target.tagName)||event.target.isContentEditable;
 if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){event.preventDefault();navigate('library');$('#library-search').focus();return;}
 if(event.key==='Enter'&&state.view==='translate'&&!event.shiftKey&&(event.target.id==='translation-input'||event.metaKey||event.ctrlKey)){event.preventDefault();translate().catch(showError);return;}
 if(state.view!=='review'||event.repeat)return;
 if(!state.review.revealed && ((event.key===' '&&!editing)||event.key==='Enter')){event.preventDefault();actions.reveal().catch(showError);}
 else if(state.review.revealed&&!editing&&['1','2','3','4'].includes(event.key)){event.preventDefault();actions.grade({dataset:{rating:event.key}}).catch(showError);}
});
window.addEventListener('online',()=>renderNav());window.addEventListener('offline',()=>renderNav());
window.addEventListener('pagehide',()=>{state.abort?.abort();speaker.clear();window.speechSynthesis?.cancel?.();});
channel?.addEventListener('message',async()=>{const id=state.review.cardId,revision=findCard(id)?.revision;await loadData(false);if(state.view==='review'&&findCard(id)?.revision!==revision)selectReview();refreshPassiveUI();});
async function handleShare(){
 const href=location.href,slug=L.shareSlug(href),token=L.legacyShareToken(href);
 if(!slug&&token===null)return;
 if(slug){
  showModal('Opening shared word','<p role="status">Checking this link...</p>');
  try{
   const payload=await api('word-links/'+slug,{ms:12000});
   if(location.href!==href||!modal.open||$('#modal-title').textContent!=='Opening shared word')return;
   openEditor({...C.cardContent(payload.card),deck:'From friends',attribution:'@'+payload.sender+' (Nabu word link)'},false,{sender:payload.sender,verified:true});
  }catch(error){
   if(location.href!==href||!modal.open||$('#modal-title').textContent!=='Opening shared word')return;
   showModal('Word link unavailable',`<p class="modal-intro">${E(error.status===404?'This link was disabled, expired or does not exist.':'Reconnect to check this link. Its contents are not stored in the URL.')}</p><button class="button primary" data-action="retry-word-link">Try again</button>`);
  }
  return;
 }
 history.replaceState(history.state,'',L.appBase(href));
 try{const payload=C.decodeShare(token);openEditor(payload.card,false,{sender:payload.sender,verified:false});}
 catch(e){showError(e);}
}
window.addEventListener('hashchange',()=>{if(L.legacyShareToken(location.href)!==null)handleShare();else navigate(L.viewFromURL(location.href),false);});
window.addEventListener('popstate',()=>{if(new URL(location.href).searchParams.has('content')){explore.restoreURL(location.href).catch(showError);return;}if(L.shareSlug(location.href)||L.legacyShareToken(location.href)!==null)handleShare();else navigate(L.viewFromURL(location.href),false);});
window.addEventListener('nabu-app-url',event=>{const path=window.NabuNative?.apiOrigin&&L.incomingAppURL(event.detail,window.NabuNative.apiOrigin);if(!path)return;history.pushState({},'',path);if(L.shareSlug(location.href))handleShare();else navigate(L.viewFromURL(location.href),false);});
window.addEventListener('nabu-app-resume',()=>{checkBackend().then(()=>state.user&&DB.syncNow()).catch(showError);});
window.addEventListener('nabu-app-back',()=>{if(modal.open)closeModal();else if(state.view!=='translate')navigate('translate');else window.NabuNative?.minimize?.();});

// Session content is device-local and explicitly scoped to the current account.
let readerSessionTimer,readerSessionWrite=Promise.resolve(),readerSessionSerial='',readerMediaURL='',readerMediaKey='',readerSessionError='',readerSessionPending=false;
const readerSessionKey=()=>state.accountHint&&!state.user?null:'nabu.reader.v1:'+(state.user?.id||'guest');
function readerSessionValue(){
 const r=state.reader;if(state.view!=='reader'||r.contentId||!r.text||r.editing)return null;
 const {tokens,...plain}=r;const t=state.translation;
 return {version:1,reader:plain,translation:{...t,busy:false,saving:false,council:t.council?{...t.council,busy:false}:null},scrollY:window.scrollY,updatedAt:Date.now()};
}
function readerSessionStatus(){
 const el=$('#reader-session-status');if(el)el.textContent=readerSessionError||(readerSessionPending?'Saving reading position…':'Text and place saved in this browser. Local media files must be reselected after a refresh.');
 const retry=$('[data-action="retry-reader-session"]');if(retry)retry.hidden=!readerSessionError;
}
function queueReaderSession(){if(readerSessionValue()){readerSessionPending=true;readerSessionStatus();}clearTimeout(readerSessionTimer);readerSessionTimer=setTimeout(()=>flushReaderSession(),180);}
function flushReaderSession(){
 clearTimeout(readerSessionTimer);const key=readerSessionKey(),value=readerSessionValue();if(!key||!value)return Promise.resolve();
 const serial=JSON.stringify({...value,updatedAt:0});if(serial===readerSessionSerial){readerSessionPending=false;readerSessionStatus();return readerSessionWrite;}
 readerSessionWrite=readerSessionWrite.catch(()=>{}).then(async()=>{try{await DB.setMeta(key,value);if(readerSessionKey()===key){state.resumeReader=value;readerSessionSerial=serial;readerSessionError='';readerSessionPending=false;readerSessionStatus();}}catch(e){if(readerSessionKey()===key){readerSessionPending=false;readerSessionError='Reading position could not save: '+(e.message||'storage unavailable')+'. Retry before closing.';readerSessionStatus();}}});return readerSessionWrite;
}
async function loadReaderSession(){const key=readerSessionKey();state.resumeReader=key?await DB.getMeta(key,null):null;}
async function restoreReaderSession(){
 const v=state.resumeReader;if(!v?.reader?.text||v.version!==1)return;
 const r=v.reader,t=v.translation;if(typeof r.text!=='string'||r.text.length>15000||!C.isLanguage(t?.sourceLang)||!C.isLanguage(t?.targetLang))return;
 invalidateTranslation(true);state.reader={...r,tokens:readingTokens(r.text,t.sourceLang),editing:false};Object.assign(state.translation,t,{busy:false,saving:false});
 navigate('reader');requestAnimationFrame(()=>window.scrollTo({top:Math.max(0,Number(v.scrollY)||0),behavior:'instant'}));
}
function readerMediaMarkup(){return `<section class="reader-media" aria-label="Optional local media"><div id="reader-media-player"></div><details class="source-media-options" data-disclosure-key="source-media-options"><summary>Audio or video · optional</summary><label for="reader-media-file">Play your audio or video alongside this text (optional)<input id="reader-media-file" type="file" accept="audio/*,video/*"></label><p id="reader-media-message">${state.reader.media?'Reselect '+E(state.reader.media.name)+' to resume at '+Math.floor(state.reader.media.time||0)+' seconds.':'Choose a local file. Nothing is uploaded; paste its transcript as your reading text.'}</p></details><p class="reader-session-status" id="reader-session-status" role="status">Saving reading position…</p><button class="text-button" data-action="retry-reader-session" hidden>Retry position save</button></section>`;}
function pauseSourceMedia(){const el=$('#source-media');if(el&&!el.paused)el.pause();}
function mountReaderMedia(){
 const host=$('#reader-media-player'),meta=state.reader.media;if(!host)return;
 if(host.firstElementChild||!readerMediaURL||!meta||meta.key!==readerMediaKey){readerSessionStatus();return;}
 const el=document.createElement(meta.type?.startsWith('video/')?'video':'audio');el.id='source-media';el.controls=true;el.preload='metadata';el.setAttribute('aria-label','Your source media');el.src=readerMediaURL;host.append(el);
 el.addEventListener('loadedmetadata',()=>{if(Number.isFinite(el.duration))el.currentTime=Math.min(meta.time||0,el.duration);});
 el.addEventListener('timeupdate',()=>{meta.time=el.currentTime;queueReaderSession();});el.addEventListener('pause',()=>{meta.time=el.currentTime;flushReaderSession();});
 el.addEventListener('play',()=>{deviceSpeaker.stop();speaker.stop();});
 el.addEventListener('error',()=>{$('#reader-media-message').textContent='This browser could not play the file. Choose another supported audio or video file; your text and saved position remain.';});
 $('#reader-media-message').textContent=meta.name+' · local file, never uploaded.';readerSessionStatus();
}
Object.assign(actions,{
 'explanation-mode':async b=>{
  const value=Scribe.mode(b.dataset.mode);state.settings.explanationMode=value;
  // Keep both subtrees mounted: mode changes cannot reset audio, edits or requests.
  for(const el of document.querySelectorAll('[data-action="explanation-mode"]'))el.setAttribute('aria-pressed',String(el.dataset.mode===value));
  const depth=$('#support-depth');if(depth)depth.hidden=value!=='depth';
  try{await saveSettings();}catch(e){toast('Mode changed for this session, but could not be remembered. Try again.','',null,true);}
 },
 'hide-scribe':async()=>{state.settings.nabuPresence='hidden';$('[data-action=explanation-mode]')?.focus({preventScroll:true});for(const el of document.querySelectorAll('.scribe-presence'))el.remove();try{await saveSettings();toast('Nabu hidden. You can restore him in Settings.');}catch(e){toast('Nabu is hidden for this session; the preference could not save.','',null,true);}},
 'resume-own-reader':async()=>{await loadReaderSession();await restoreReaderSession();},
 'retry-reader-session':async()=>{readerSessionSerial='';await flushReaderSession();},
 'ask-council':async()=>{
  const t=state.translation;if(t.council?.busy)return;
  const epoch=state.translationEpoch,owner=state.user?.id||'guest';t.council={...t.council,busy:true,error:''};
  state.councilAbort?.abort();const controller=new AbortController();state.councilAbort=controller;updateOutput();
  try{await api('council',{method:'POST',body:{text:t.front,context:t.context,sourceLang:t.sourceLang,explanationLang:t.targetLang,translate:t.council.translate!==false,question:t.council.question||''},signal:controller.signal,ms:15000});
   // 1.16 has no generative adapter. Never render an arbitrary response as live teaching.
   if(epoch===state.translationEpoch&&owner===(state.user?.id||'guest'))t.council.error=Scribe.COUNCIL_DEPENDENCY;
  }catch(e){if(epoch!==state.translationEpoch||owner!==(state.user?.id||'guest')||controller.signal.aborted)return;t.council.error=e.status===503?Scribe.COUNCIL_DEPENDENCY:'The council could not be reached. '+(e.message||'Reconnect and retry.')+' Your selection is unchanged.';}
  finally{if(epoch===state.translationEpoch&&owner===(state.user?.id||'guest')){t.council.busy=false;updateOutput();}}
 }
});
document.addEventListener('input',e=>{if(e.target.id==='council-question'){state.translation.council??={};state.translation.council.question=e.target.value;queueReaderSession();}});
document.addEventListener('change',e=>{
 if(e.target.id==='council-translation'){state.translation.council??={};state.translation.council.translate=e.target.checked;queueReaderSession();}
 if(e.target.id!=='reader-media-file')return;const file=e.target.files?.[0];if(!file)return;
 if(!/^(audio|video)\//.test(file.type)){$('#reader-media-message').textContent='Choose a browser-recognized audio or video file.';return;}
 pauseSourceMedia();deviceSpeaker.stop();speaker.stop();if(readerMediaURL)URL.revokeObjectURL(readerMediaURL);
 const key=JSON.stringify([file.name,file.size,file.lastModified]);const time=state.reader.media?.key===key?state.reader.media.time:0;
 readerMediaKey=key;readerMediaURL=URL.createObjectURL(file);state.reader.media={key,name:file.name,type:file.type,time};$('#reader-media-player').replaceChildren();mountReaderMedia();queueReaderSession();
});
window.addEventListener('scroll',()=>{if(!$('#word-sheet')?.open)queueReaderSession();},{passive:true});
window.addEventListener('pagehide',()=>{flushReaderSession();if(readerMediaURL)URL.revokeObjectURL(readerMediaURL);});
window.addEventListener('nabu-account-change',()=>{clearTimeout(readerSessionTimer);readerSessionSerial='';state.resumeReader=null;state.councilAbort?.abort();pauseSourceMedia();if(readerMediaURL)URL.revokeObjectURL(readerMediaURL);readerMediaURL='';readerMediaKey='';});

async function boot(){
 try{
  window.NabuStartup?.stage('Opening your private library...');
  await DB.openStore();
  window.NabuStartup?.stage('Loading your words and preferences...');
  const saved=await DB.getMeta('settings',{});state.settings={...DEFAULTS};
  if(saved&&typeof saved==='object'){
   state.settings.palette=Palette.normalizePalette(saved.palette);
   state.settings.explanationMode=Scribe.mode(saved.explanationMode);state.settings.nabuPresence=Scribe.presence(saved.nabuPresence);
   state.settings.alias=typeof saved.alias==='string'?saved.alias.slice(0,40):'';
   for(const key of ['sourceLang','targetLang'])if(C.isLanguage(saved[key]))state.settings[key]=saved[key];
   state.settings.newLimit=Number.isInteger(saved.newLimit)?C.clamp(saved.newLimit,1,100):DEFAULTS.newLimit;
   state.settings.consent=saved.consent===true;state.settings.provider=['auto','local','public','workspace'].includes(saved.provider)?saved.provider:DEFAULTS.provider;
   state.settings.autoLearning=saved.autoLearning===true;state.settings.notifications=saved.notifications===true;
   state.settings.speechProvider=['device','cloud'].includes(saved.speechProvider)?saved.speechProvider:DEFAULTS.speechProvider;state.settings.speechConsent=saved.speechConsent===true;state.settings.speechRate=saved.speechRate===0.85?0.85:1;
  }
  Palette.applyPalette(state.settings.palette);
  state.translation.sourceLang=state.settings.sourceLang;state.translation.targetLang=state.settings.targetLang;
  await loadData(false);state.accountHint=await DB.getMeta('accountHint','');
  if(state.accountHint){DB.lock();state.cards=[];state.logs=[];state.history=[];state.libraryError='Reconnecting to @'+state.accountHint+'...';}
  await explore.configure();await intents.configure();
  navigate(L.viewFromURL(location.href),false);
  window.NabuStartup?.ready();
  const launch=window.NabuNative?.launchURL;
  if(launch){const path=L.incomingAppURL(launch,window.NabuNative.apiOrigin);if(path)history.replaceState({},'',path);window.NabuNative.launchURL='';}
  await handleShare();
  await checkBackend().catch(showError);
  await explore.configure();await intents.configure();
  await explore.restoreURL(location.href).catch(e=>{showError(e);navigate('explore');});
  await loadReaderSession();if(state.view==='reader'&&!state.reader.contentId&&!state.reader.text)await restoreReaderSession();else if(state.view==='explore')render();
  // Offline installation never gates the local app or masks a successful boot.
  try { if (!window.NabuNative && 'serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register(new URL('nabu-sw.js',L.appBase(location.href)), {updateViaCache:'none'}).catch(error=>console.warn('Offline installation unavailable.',error)); } catch (error) { console.warn('Offline installation unavailable.',error); }
  refreshTimer=setInterval(()=>{
   if(document.hidden||modal.open||['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;renderNav();
   if(state.user){if(DB.syncStatus().state==='locked')checkBackend().then(()=>state.user&&DB.syncNow()).catch(()=>{});else DB.syncNow().catch(()=>{});}
   if(state.user){refreshSocial().catch(e=>{state.exchangeError=e.message;});if(state.backend?.contentProgress)explore.sync();}
   if(state.view==='review'&&state.review.sessionStarted&&!state.review.sessionEnded&&!state.review.cardId&&queue().length){selectReview();render();}
  },15000);
 }catch(e){console.error('Nabu startup failed:',e);if(window.NabuStartup)window.NabuStartup.fail(e);else main.innerHTML=`<div class="fatal"><h1>Your library could not open.</h1><p>${E(e.message)}</p><p>Check that browser storage is allowed, then reload. Nabu has not erased any existing data.</p><a class="button primary" href="./nabu-repair.html">Repair app loading</a></div>`;}
}
boot();

window.addEventListener('focus',()=>{if(state.user&&!modal.open&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)){loadData(false).then(()=>{if(state.view==='review')selectReview();refreshPassiveUI();}).catch(showError);}});

document.querySelector('#connection').addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();event.currentTarget.click();}});
