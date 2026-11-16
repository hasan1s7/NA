import * as T from './nabu-transliteration.js';
import * as I from './nabu-illustrations.js';
import * as U from './nabu-reading-ui.js';
import * as M from './nabu-media.js';
import * as Art from './nabu-clipart.js';
/* Integrates with existing DB, account isolation, revision checks and modal UI. */
export function imageFigure(card,escape){
 const selection=I.selectedIllustration(card),asset=selection.asset;
 if(!asset)return selection.message?`<p class="illustration-notice small-print" role="status">${escape(selection.message)}</p>`:'';
 return `<figure class="word-image" data-illustration-id="${asset.id}"><div class="illustration-art" aria-busy="true"><img data-illustration-img="${asset.id}" src="${asset.src}" width="80" height="80" alt="${escape(asset.alt)}"><span class="illustration-error" role="status" hidden></span></div><figcaption>${escape(asset.label)}<span class="illustration-provenance">${escape(selection.message)}</span><a href="${asset.source}" target="_blank" rel="noopener noreferrer">OpenMoji</a> / <a href="${asset.licenseUrl}" target="_blank" rel="noopener noreferrer">CC BY-SA 4.0</a><button class="text-button" type="button" data-action="retry-illustration" hidden>Retry image</button></figcaption></figure>`;
}
export function install({actions,state,C,DB,G,E,$,showModal,closeModal,modalError,toast,api,loadData,render,navigate,speak,openAuth,invalidateTranslation,readTranscript}) {
 function imageEvent(event,failed){
  const image=event.target;if(!image?.matches?.('img[data-illustration-img]'))return;
  const frame=image.closest('[data-illustration-id]');
  if(!frame){if(failed){image.hidden=true;const label=image.closest('label');if(label&&!label.querySelector('.illustration-error')){const notice=document.createElement('span');notice.className='illustration-error';notice.textContent='Image unavailable';label.append(notice);}}return;}
  image.hidden=failed;frame.querySelector('.illustration-art').setAttribute('aria-busy','false');
  const notice=frame.querySelector('.illustration-error');notice.hidden=!failed;notice.textContent=failed?'Illustration could not load. Your word and note are still available.':'';
  frame.querySelector('[data-action="retry-illustration"]').hidden=!failed;
 }
 document.addEventListener('error',e=>imageEvent(e,true),true);
 document.addEventListener('load',e=>imageEvent(e,false),true);
 let recordDestination='translate';
 let current=null,contextOwner='',contextGeneration=0,recordURL='',recordText='',recordLanguage='en',recordGeneration=0,transcriptionAbort=null;
 let recorded=null,recordingState='idle';
 const recorder=M.createRecorder({onState:s=>{recordingState=s.state;const el=$('#record-status');if(el)el.textContent=s.message+(s.state==='recording'?' '+s.elapsed+'s / 60s':'');updateRecordButtons();},onReady:blob=>{recorded=blob;if(recordURL)URL.revokeObjectURL(recordURL);recordURL=URL.createObjectURL(blob);const player=$('#record-preview');if(player){player.src=recordURL;player.hidden=false;}updateRecordButtons();}});
 function contextIsCurrent(generation){return generation===contextGeneration&&contextOwner===(state.user?.id||'guest')&&!!$('#word-context-form');}
 async function openContext(button){
  contextGeneration++;const generation=contextGeneration;contextOwner=state.user?.id||'guest';
  const id=button?.dataset?.cardId;let saved=id?state.cards.find(c=>c.id===id):null;
  const fromReader=state.view==='reader'&&state.reader.lookup;
  const conceptId=button?.dataset?.concept||(fromReader?state.translation.conceptId:state.graph.selectedId)||state.translation.conceptId;
  const concept=G.concept(saved?saved.conceptId:conceptId);
  if(!saved&&concept)saved=state.cards.find(c=>!c.archived&&c.conceptId===concept.id&&c.sourceLang===state.translation.sourceLang&&c.targetLang===state.translation.targetLang);
  const resolved=saved||(concept?{...G.translation(concept.id,state.translation.sourceLang,state.translation.targetLang),conceptId:concept.id,learningMode:'reference',deck:'My words',context:'',note:''}:fromReader&&state.translation.back?{...state.translation,learningMode:'reference',deck:'My words'}:null);
  const value=resolved?{...resolved,...(fromReader?{front:state.translation.front,context:state.translation.context}: {})}:null;
  if(!value?.front||!value?.back)throw new Error('Translate or select a saved word before opening its context.');
  current={...value,imageDismissed:[...(value.imageDismissed||[])]};
  const suggested=M.romanize(value.front,value.sourceLang,G.transliterationOf(value.front,value.sourceLang)||'');
  const effective=T.readingForCard(value,G.transliterationOf(value.front,value.sourceLang)||'');
  current.suggestedReading=suggested;current.readingTouched=false;current.autoReadingChosen=false;
  let confirmed=saved?JSON.stringify(C.cardContent(saved)):null,saving=false,saveFailed=false;
  const request=I.illustrationRequest(value,concept),candidates=I.illustrationCandidates(request);
  const choices=value.conceptId?candidates:Art.CLIPART;
  const imageInfo=value.conceptId?(candidates.length?'Matched to the selected dictionary meaning. Check it against your source before choosing.':'No checked illustration for this dictionary meaning. The word works without one.'):'No concept is linked to this word. Choose a labelled concept only if it explains your meaning; spelling is not enough.';
  const readingMarkup=r=>`<p class="reading-status">${E(r.status.replaceAll('-',' '))} / ${E(r.method||'Reading aid')}</p>${r.available?`<p class="reading-output" dir="auto">${E(r.text)}</p>`:''}<p class="small-print">${E(r.warning)}</p>`;
  showModal('Meaning in context',`<section class="meaning-summary"><span class="pane-label">${E(C.languageName(value.sourceLang))} / ${E(C.languageName(value.targetLang))}</span><h2 dir="auto" lang="${value.sourceLang}">${E(value.front)}</h2><p class="context-meaning" dir="auto" lang="${value.targetLang}">${E(value.back)}</p>${concept?`<p class="small-print">Dictionary sense: ${E(concept.sense)}. Confirm that it fits your sentence; this is not automatic context disambiguation.</p>`:''}<div id="context-image-preview">${imageFigure(value,E)}</div></section>${value.context?`<div class="source-preview" dir="auto" lang="${value.sourceLang}">${U.highlightContext(value.context,value.front)}</div>`:''}
  <div class="button-row"><button type="button" class="button secondary" data-action="context-listen">Listen to word</button><button type="button" class="button secondary" data-action="context-listen-sentence">Listen to sentence</button><button type="button" class="text-button" data-action="toggle-reading" aria-expanded="false" aria-controls="context-reading">Show transliteration</button></div>
  <section id="context-reading" class="media-reveal" hidden><h3>Reading aid</h3><div id="effective-reading">${readingMarkup(effective)}</div>${suggested.available?`<details class="reading-suggestion"${value.reading||effective.hidden?'':' open'}><summary>Automatic suggestion / ${E(suggested.method)}</summary>${readingMarkup(suggested)}<button class="text-button" type="button" data-action="use-reading">Use this draft reading</button><span id="reading-already-used" class="small-print" hidden>This suggestion is already in your editable field.</span></details>`:''}</section>
  <form id="word-context-form" class="space-top"><div class="form-field"><label for="word-context">Original sentence or excerpt</label><textarea id="word-context" name="context" class="input" rows="3" maxlength="1500" dir="auto" placeholder="Paste the sentence where you met this word">${E(value.context||'')}</textarea><span class="help">Your source context is preserved. It is not replaced by an invented example.</span></div>
  ${value.example?`<details><summary>Bank example (not your source)</summary><p dir="auto">${E(value.example)}</p></details>`:''}
  <div class="form-field"><label for="word-note">Your private note</label><textarea id="word-note" name="note" class="input" rows="3" maxlength="1000" dir="auto">${E(value.note||'')}</textarea></div>
  <details class="word-details"><summary>Reading aid & optional illustration</summary><div class="form-field"><label for="word-reading">Your reading aid (optional)</label><input id="word-reading" name="reading" class="input" maxlength="1000" value="${E(value.reading||'')}" dir="auto"><span class="help">Your corrections take priority. Clearing a saved reading keeps it hidden until you explicitly choose another.</span><button class="text-button" type="button" data-action="clear-reading"${value.reading?'':' hidden'}>Clear this reading aid</button></div>
  <fieldset class="clipart-picker"><legend>Optional illustration</legend><p class="small-print">${E(imageInfo)}</p><div class="clipart-grid"><label class="clipart-choice"><input type="radio" name="imageId" value=""${!value.imageId?' checked':''}><span>No image</span></label>${choices.map(a=>`<label class="clipart-choice"><input type="radio" name="imageId" value="${a.id}"${value.imageId===a.id?' checked':''}><img width="64" height="64" src="${a.src}" alt="${E(a.alt)}" data-illustration-img="${a.id}"><span>${E(a.label)}</span><small>${E(a.sense)}</small>${current.imageDismissed.includes(a.id)?'<small>Previously flagged. Selecting it restores your choice.</small>':''}</label>`).join('')}</div>
  <div class="button-row"><button class="text-button" type="button" data-action="remove-illustration"${value.imageId?'':' hidden'}>Remove illustration</button><button class="text-button" type="button" data-action="flag-illustration"${value.imageId?'':' hidden'}>Not right for this meaning</button></div><p id="illustration-choice-status" class="small-print" role="status"></p><p class="small-print">Local, reusable artwork only. No image provider is connected and your sentence is not sent anywhere. Artwork: <a href="https://openmoji.org/" target="_blank" rel="noopener noreferrer">OpenMoji</a>, <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer">CC BY-SA 4.0</a>.</p></fieldset></details>
  <div class="modal-footer"><button class="button secondary" type="button" data-action="close-modal">Close</button><button class="button primary" type="submit">${saved?'Save context & note':'Save word, context & note'}</button></div><p id="context-save-status" class="small-print" role="status"></p></form><section id="captured-sources" class="space-top"></section>`);
  const form=$('#word-context-form');
  function content(){
   const data=Object.fromEntries(new FormData(form));
   let method=value.readingMethod||'';
   if(current.readingTouched){method=data.reading.trim()?(current.autoReadingChosen&&data.reading===suggested.text?suggested.method:'User reading aid'):'User reading aid (hidden)';}
   return C.cardContent({...current,...data,readingMethod:method});
  }
  function changed(){
   if(!contextIsCurrent(generation))return;
   const input=$('#word-reading'),use=$('[data-action="use-reading"]'),clear=$('[data-action="clear-reading"]');
   if(use)use.hidden=input.value===suggested.text;
   if($('#reading-already-used'))$('#reading-already-used').hidden=!use?.hidden;
   if(clear)clear.hidden=!input.value;
   if(!saving){const submit=form.querySelector('[type=submit]');try{submit.disabled=confirmed===JSON.stringify(content());}catch{submit.disabled=false;}submit.textContent=submit.disabled?'No changes to save':saveFailed?'Retry save':current.id?'Save context & note':'Save word, context & note';}
  }
  function updateImage(message){
   const radio=form.querySelector(`input[name="imageId"][value="${current.imageId||''}"]`);if(radio)radio.checked=true;
   $('#context-image-preview').innerHTML=imageFigure(current,E);
   for(const key of ['remove-illustration','flag-illustration'])$(`[data-action="${key}"]`).hidden=!current.imageId;
   $('#illustration-choice-status').textContent=message;changed();
  }
  current.updateImage=updateImage;current.formChanged=changed;current.readingMarkup=readingMarkup;
  form.addEventListener('input',e=>{if(e.target.id==='word-reading'){
   current.readingTouched=true;current.autoReadingChosen=false;
   const draftReading=e.target.value.trim();const preview=T.readingForCard({...value,reading:draftReading,readingMethod:draftReading?'User reading aid':'User reading aid (hidden)'});
   preview.warning=draftReading?'Your edited reading is not saved yet. Save to keep it.':'Reading cleared in this draft. Save to keep it hidden.';
   $('#effective-reading').innerHTML=readingMarkup(preview);
  }changed();});
  form.addEventListener('change',e=>{
   if(e.target.name==='imageId'){
    try{const choice=I.applyIllustrationChoice(current,e.target.value);current.imageId=choice.imageId;current.imageDismissed=choice.imageDismissed||[];updateImage(choice.imageId?'Illustration chosen. Save to keep it with this meaning.':'Illustration removed from this draft. Save to keep the change.');}
    catch(error){modalError(error.message);updateImage('Your prior choice is unchanged.');}
   }changed();
  });
  form.addEventListener('submit',async event=>{
   event.preventDefault();event.stopImmediatePropagation();const button=form.querySelector('[type=submit]');if(saving||button.disabled)return;
   saving=true;saveFailed=false;button.disabled=true;button.textContent='Saving...';button.setAttribute('aria-busy','true');$('#modal-error')?.remove();$('#context-save-status').textContent='Saving your context, reading aid and illustration choice...';
   try{
    const submitted=content();
    if(!contextIsCurrent(generation))throw new Error('The active account changed. Reopen this word.');
    if(current.id)await DB.editCard(current.id,submitted,current.revision);
    else{const result=await DB.addCards([submitted]);if(!contextIsCurrent(generation))return;if(!result.added){const snapshot=await DB.snapshot();const found=snapshot.cards.find(c=>C.identity(c)===C.identity(submitted));if(!found)throw new Error('Could not find the saved word. Retry.');await DB.editCard(found.id,submitted,found.revision);}}
    await loadData(false);if(!contextIsCurrent(generation))return;
    const actual=state.cards.find(c=>C.identity(c)===C.identity(submitted));if(!actual)throw new Error('Save was not confirmed. Retry.');
    // Keep live form input if the learner edited while the request was pending.
    current.id=actual.id;current.revision=actual.revision;confirmed=JSON.stringify(C.cardContent(actual));render();
    const latestChanged=JSON.stringify(content())!==confirmed;
    const confirmation=state.user?(DB.syncStatus().pending?'Saved on this device; waiting to sync.':'Saved to your account library.'):'Saved in this browser.';
    $('#context-save-status').textContent=confirmation+(latestChanged?' Your newer edits are not saved yet.':'');
    $('#illustration-choice-status').textContent=latestChanged?'Save again to keep any newer illustration or reading changes.':'';
    if(!latestChanged)$('#effective-reading').innerHTML=readingMarkup(T.readingForCard(actual));
   }catch(error){saveFailed=true;if(contextIsCurrent(generation)){modalError(error.message+' Your edits are still here.');$('#context-save-status').textContent='Not saved. Your edits are here; retry saving.';}}
   finally{saving=false;button.removeAttribute('aria-busy');changed();}
  });
  changed();await loadCaptures(generation);
 }
 async function loadCaptures(generation=contextGeneration){
  const target=$('#captured-sources');if(!target)return;
  if(!state.user||!current?.id){target.textContent='Signed-in extension captures link their original sources here.';return;}
  target.textContent='Loading captured sources...';
  try{const data=await api('captures/'+current.id);if(!contextIsCurrent(generation))return;
   target.innerHTML='<h3>Captured sources</h3>'+(!data.captures.length?'<p class="small-print">No extension captures for this word yet.</p>':data.captures.map(c=>`<article class="capture-source">${c.source_url?`<a href="${E(c.source_url)}" target="_blank" rel="noopener noreferrer">${E(c.source_title||'Open original source')}</a>`:`<strong>${E(c.source_title||'Captured excerpt')}</strong>`}${c.offset_seconds!==null?`<span class="small-print">At ${Math.floor(c.offset_seconds/60)}:${String(Math.floor(c.offset_seconds%60)).padStart(2,'0')}</span>`:''}<p dir="auto">${E(c.context)}</p>${c.note?`<p dir="auto">Note: ${E(c.note)}</p>`:''}</article>`).join(''));
  }catch(error){if(contextIsCurrent(generation))target.innerHTML=`<p role="alert">Sources could not load: ${E(error.message)}</p><button class="text-button" data-action="reload-captures">Retry sources</button>`;}
 }
 function updateRecordButtons(){
  const recording=['recording','requesting','stopping'].includes(recordingState);
  const start=$('#start-microphone'),stop=$('#stop-microphone'),transcribe=$('#transcribe-audio'),discard=$('#discard-audio');
  if(start)start.disabled=recording;if(stop)stop.disabled=!['recording','requesting'].includes(recordingState);
  if(transcribe)transcribe.disabled=!recorded||recording||!state.backend?.transcriptionEnabled||!!transcriptionAbort;
  if(discard)discard.disabled=!recorded&&!recording;
 }
 function openRecorder(){
  recordDestination=state.view;
  recordLanguage=state.translation.sourceLang;
  showModal('Record a short excerpt',`<p class="modal-intro">Record your microphone for up to 60 seconds. Audio stays in this tab until you press Transcribe. Review and edit the result before using it.</p><label for="record-language">Spoken language</label><select id="record-language" class="select">${C.LANGUAGES.map(([code,name])=>`<option value="${code}"${code===recordLanguage?' selected':''}>${E(name)}</option>`).join('')}</select><div class="button-row space-top"><button id="start-microphone" class="button primary" data-action="start-microphone">Start microphone</button><button id="stop-microphone" class="button secondary" data-action="stop-microphone" disabled>Stop recording</button></div><p id="record-status" role="status">${recorded?'Your previous recording is ready.':'No recording.'}</p><audio id="record-preview" controls${recordURL?` src="${recordURL}"`:' hidden'}></audio>
  <p class="small-print">${state.backend?.transcriptionEnabled?'Transcription runs on your Nabu server, without a paid speech API. Audio is deleted from the server after processing.':'Local transcription needs one-time server setup. Recording and manual transcription still work.'}</p><div class="button-row"><button id="transcribe-audio" class="button secondary" data-action="transcribe-audio" disabled>Transcribe recording</button><button class="text-button" data-action="transcription-setup">Setup instructions</button><button id="discard-audio" class="text-button" data-action="discard-audio" disabled>Discard recording</button></div><div class="form-field space-top"><label for="record-transcript">Transcript - review or type it yourself</label><textarea id="record-transcript" class="input" rows="5" dir="auto" placeholder="Your editable transcript">${E(recordText)}</textarea></div><div class="modal-footer"><button class="button secondary" data-action="close-modal">Close</button><button class="button primary" data-action="use-transcript">Use edited transcript</button></div>`);
  $('#record-transcript').addEventListener('input',e=>{recordText=e.target.value;});
  updateRecordButtons();
 }
 async function openConnections(){
  if(!state.user){openAuth('login');return;}
  const owner=state.user.id;const data=await api('extension-tokens');if(state.user?.id!==owner)return;
  showModal('Chrome extension connections',`<p class="modal-intro">Load the supplied chrome-extension folder in Chrome's Extensions page. Paste its extension ID below. Each connection can save captures to this account, but cannot read your whole library. Tokens expire and can be revoked here.</p><form id="extension-token-form"><div class="form-field"><label for="extension-id">Extension ID (32 letters, from chrome://extensions)</label><input id="extension-id" class="input" name="extensionId" pattern="[a-p]{32}" minlength="32" maxlength="32" required autocomplete="off"></div><div class="form-field"><label for="extension-label">Device label</label><input id="extension-label" name="label" class="input" value="My Chrome extension" maxlength="60" required></div><button class="button primary" type="submit">Create 30-day connection</button></form><section id="new-extension-token" class="space-top" role="status"></section><h3 class="space-top">Existing connections</h3>${data.tokens.length?data.tokens.map(t=>`<div class="capture-source"><strong>${E(t.label)}</strong><p class="small-print">${E(t.extension_id)} / expires ${E(new Date(t.expires_at).toLocaleDateString())}</p><button class="text-button" data-action="revoke-extension-token" data-id="${t.id}">Revoke connection</button></div>`).join(''):'<p>No extension connections.</p>'}<div class="modal-footer"><button class="button secondary" data-action="close-modal">Close</button></div>`);
  $('#extension-token-form').addEventListener('submit',async event=>{event.preventDefault();event.stopImmediatePropagation();const form=event.currentTarget,button=form.querySelector('button');if(button.disabled)return;button.disabled=true;try{const r=await api('extension-tokens',{method:'POST',body:{...Object.fromEntries(new FormData(form)),days:30}});if(state.user?.id!==owner||!$('#new-extension-token'))return;$('#new-extension-token').innerHTML=`<label for="new-token">Copy this token into the extension's connection settings. It is shown only here.</label><textarea id="new-token" class="input" readonly rows="3">${E(r.token)}</textarea><p class="small-print">Treat this like a password. Do not send it in messages. It authorizes captures to @${E(state.user.handle)} until ${E(new Date(r.expiresAt).toLocaleDateString())} or revocation.</p>`;$('#new-token').select();}catch(e){modalError(e.message);}finally{button.disabled=false;}});
 }
 function contextSpeech(value,language){if(state.settings.speechProvider!=='device'&&(!state.backend?.speechEnabled||!state.user||!state.settings.speechConsent))throw new Error('Save your note first, then choose Device voice or enable cloud pronunciation in Settings. Your edits remain here.');return speak(value,language);}
 Object.assign(actions,{
  'show-context':openContext,
  'graph-usage':()=>openContext({dataset:{concept:state.graph.selectedId}}),
  'reload-captures':()=>loadCaptures(),
  'context-listen':()=>contextSpeech(current.front,current.sourceLang),
  'context-listen-sentence':()=>{const text=$('#word-context')?.value.trim();if(!text)throw new Error('Paste a sentence in Original sentence before listening.');return contextSpeech(text,current.sourceLang);},
  'toggle-reading':button=>{const block=$('#context-reading');block.hidden=!block.hidden;button.textContent=block.hidden?'Show transliteration':'Hide transliteration';button.setAttribute('aria-expanded',String(!block.hidden));},
  'use-reading':()=>{
   const input=$('#word-reading'),draft=current?.suggestedReading;if(!input||!draft?.available)throw new Error('No automatic reading is available. Enter a checked reading instead.');
   if(input.value&&input.value!==draft.text&&!window.confirm('Replace your current reading with this automatic suggestion?'))return;
   input.value=draft.text;current.readingTouched=true;current.autoReadingChosen=true;
   $('#effective-reading').innerHTML=current.readingMarkup(draft);current.formChanged();
   const details=input.closest('details');if(details)details.open=true;input.focus();
  },
  'clear-reading':()=>{const input=$('#word-reading');input.value='';current.readingTouched=true;current.autoReadingChosen=false;$('#effective-reading').innerHTML='<p>Reading hidden by you. Save to keep it hidden.</p>';current.formChanged();input.focus();},
  'remove-illustration':()=>{current.imageId='';current.updateImage('Illustration removed from this draft. Save to keep the change.');},
  'flag-illustration':()=>{const rejected=I.rejectIllustration(current);current.imageId=rejected.imageId;current.imageDismissed=rejected.imageDismissed;current.updateImage('Marked incorrect for this meaning and removed from this draft. Save to keep your feedback.');},
  'retry-illustration':button=>{const frame=button.closest('[data-illustration-id]'),asset=Art.CLIPART.find(a=>a.id===frame?.dataset.illustrationId);if(!asset)throw new Error('This illustration is not bundled. Choose another or remove it.');const image=frame.querySelector('img');frame.querySelector('.illustration-art').setAttribute('aria-busy','true');frame.querySelector('.illustration-error').textContent='Loading illustration...';button.hidden=true;image.src=asset.src;},
  'record-excerpt':openRecorder,
  'start-microphone':async()=>{recordLanguage=$('#record-language').value;recorded=null;if(recordURL)URL.revokeObjectURL(recordURL);recordURL='';const player=$('#record-preview');player.removeAttribute('src');player.hidden=true;recordText=$('#record-transcript').value;await recorder.start();},
  'stop-microphone':()=>{if(recordingState==='requesting')recorder.discard();else recorder.stop();},
  'discard-audio':()=>{recordGeneration++;transcriptionAbort?.abort();transcriptionAbort=null;recorder.discard();recorded=null;if(recordURL)URL.revokeObjectURL(recordURL);recordURL='';const player=$('#record-preview');if(player){player.removeAttribute('src');player.hidden=true;}updateRecordButtons();},
  'transcription-setup':()=>{const panel=document.createElement('div');panel.className='info-banner';panel.textContent=state.backend?.transcriptionSetup||'Start the full Nabu server. Install requirements-speech.txt and FFmpeg, run tools/setup_speech.py, configure NABU_WHISPER_MODEL_DIR and restart. See MEDIA_SETUP.md.';const existing=$('#transcription-setup');if(existing){existing.remove();return;}panel.id='transcription-setup';$('#record-status').after(panel);},
  'transcribe-audio':async()=>{if(!recorded)throw new Error('Record an excerpt first.');if(!state.backend?.transcriptionEnabled)throw new Error('Complete the local transcription setup first.');if(!state.user)throw new Error('Sign in before using the server transcriber. Your recording remains in this tab.');if(transcriptionAbort)return;const owner=state.user.id,generation=++recordGeneration;const before=$('#record-transcript').value;transcriptionAbort=new AbortController();updateRecordButtons();$('#record-status').textContent='Transcribing on your Nabu server...';try{const r=await api('transcribe',{method:'POST',body:{audio:await M.audioBase64(recorded),mime:recorded.type.split(';')[0],language:$('#record-language').value},signal:transcriptionAbort.signal,ms:120000});if(generation!==recordGeneration||state.user?.id!==owner||!$('#record-transcript'))return;if($('#record-transcript').value!==before){$('#record-status').textContent='Transcript ready. Your manual edits were preserved.';const result=document.createElement('textarea');result.className='input';result.value=r.text;result.readOnly=true;result.setAttribute('aria-label','New machine transcript');$('#record-status').after(result);}else{recordText=r.text;$('#record-transcript').value=r.text;$('#record-status').textContent='Draft transcript ready. Correct it before using it.';}}catch(e){if(generation===recordGeneration&&$('#record-status'))$('#record-status').textContent=(e.name==='AbortError'?'Transcription cancelled.':e.message)+' The recording is still in this tab.';}finally{if(generation===recordGeneration){transcriptionAbort=null;updateRecordButtons();}}},
  'use-transcript':()=>{const text=$('#record-transcript').value.trim();if(!text)throw new Error('Enter or transcribe some text first.');if(text.length>2000)throw new Error('Use 2,000 characters or fewer. Copy a shorter excerpt from this transcript.');recordText=text;if(recordDestination==='reader'&&readTranscript){const language=$('#record-language').value;closeModal();readTranscript(text,language);return;}invalidateTranslation(true);state.translation.front=text;state.translation.back='';state.translation.context='';state.translation.conceptId='';state.translation.savedCardId='';state.translation.error='';state.translation.sourceLang=$('#record-language').value;if(state.translation.targetLang===state.translation.sourceLang)state.translation.targetLang=state.translation.sourceLang==='en'?'es':'en';closeModal();navigate('translate');toast('Transcript inserted. Review it, then translate when ready.');},
  'extension-connections':openConnections,
  'revoke-extension-token':async button=>{await api('extension-tokens/'+button.dataset.id,{method:'DELETE',body:{}});await openConnections();toast('Extension connection revoked.');}
 });
 document.querySelector('#modal').addEventListener('close',()=>{recordGeneration++;transcriptionAbort?.abort();transcriptionAbort=null;recorder.stop();contextGeneration++;});
 window.addEventListener('nabu-account-change',()=>{contextGeneration++;recordGeneration++;transcriptionAbort?.abort();transcriptionAbort=null;recorder.discard();recorded=null;recordText='';current=null;if(recordURL)URL.revokeObjectURL(recordURL);recordURL='';if(document.querySelector('#modal')?.open)closeModal();});
 window.addEventListener('beforeunload',()=>{recorder.discard();if(recordURL)URL.revokeObjectURL(recordURL);});
 return {openContext,openRecorder};
}
