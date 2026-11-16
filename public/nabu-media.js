import * as T from './nabu-transliteration.js';
/* User-triggered helpers. No network, passive capture, provider keys or automatic grading. */
export const MAX_AUDIO_BYTES = 4 * 1024 * 1024;
export const MAX_RECORDING_SECONDS = 60;
export function readableError(error) {
 const names = {NotAllowedError:'Permission was not granted. Allow the microphone or screen share in your browser, then try again.',
 NotFoundError:'No microphone or audio source was found. Connect one or type the text instead.',
 NotReadableError:'The audio source is busy or unavailable. Close other recording apps and retry.',
 SecurityError:'Your browser blocked recording. Use the local Nabu server or an HTTPS address.',
 AbortError:'Recording was cancelled. Nothing was sent.'};
 return names[error?.name] || error?.message || 'Audio is unavailable. Type the text instead.';
}
export function safeSourceURL(value) {
 if(!value)return '';
 const u=new URL(value);
 if(!['http:','https:'].includes(u.protocol)||u.username||u.password)throw new Error('Use an HTTP(S) source address without credentials.');
 // Default capture deliberately omits query strings and fragments (often private tokens).
 const safe=new URL(u.origin+u.pathname);if(/(^|\.)youtube\.com$/.test(u.hostname)&&u.pathname==='/watch'&&/^[A-Za-z0-9_-]{11}$/.test(u.searchParams.get('v')||''))safe.searchParams.set('v',u.searchParams.get('v'));return safe.href;
}
export function romanize(value,language,bankReading='') {
 return T.readingForCard({front:value,sourceLang:language},bankReading);
}
export function createDeviceSpeaker({onMessage=()=>{}}={}) {
 let panel=null, utterance=null, sequence=0, last=null, timer=null;
 const synthesis=()=>globalThis.speechSynthesis;
 function status(text){if(panel)panel.querySelector('[data-voice-status]').textContent=text;}
 function controls(playing){if(panel){panel.querySelector('[data-voice-stop]').disabled=!playing;panel.querySelector('[data-voice-replay]').disabled=!last;}}
 function ensure(){
  const host=document.querySelector('dialog[open]')||document.querySelector('[data-audio-host]')||document.body;if(panel?.isConnected){if(panel.parentElement!==host)host.append(panel);return;}
  panel=document.createElement('aside');panel.className='speech-player';panel.id='device-speech-player';panel.setAttribute('aria-label','Device pronunciation player');
  panel.innerHTML='<div class="speech-top"><span>DEVICE VOICE</span><button type="button" class="icon-button" data-voice-close aria-label="Close device voice">&times;</button></div><div class="speech-word" dir="auto"></div><p role="status" aria-live="polite" data-voice-status></p><div class="button-row"><button type="button" class="button secondary" data-voice-replay>Replay</button><button type="button" class="button secondary" data-voice-stop>Stop</button></div>';
  host.append(panel);panel.querySelector('[data-voice-close]').onclick=()=>stop(true);panel.querySelector('[data-voice-stop]').onclick=()=>stop(false);panel.querySelector('[data-voice-replay]').onclick=()=>last&&play(last);controls(false);
 }
 function stop(hide=true){sequence++;clearTimeout(timer);synthesis()?.cancel?.();utterance=null;controls(false);if(panel){status('Stopped.');panel.hidden=hide;}if(hide)document.body.classList.remove('has-speech');}
 function voicesReady(){return new Promise(resolve=>{const s=synthesis();if(!s)return resolve([]);const first=s.getVoices();if(first.length)return resolve(first);let done=false;const finish=()=>{if(done)return;done=true;clearTimeout(id);s.removeEventListener?.('voiceschanged',finish);resolve(s.getVoices());};const id=setTimeout(finish,1500);s.addEventListener?.('voiceschanged',finish,{once:true});});}
 async function play(options){
  const value=String(options.text||'').trim();if(!value){onMessage('Choose or enter text before listening.');return;}
  if(value.length>2000){onMessage('Listen to 2,000 characters or fewer at a time.');return;}
  stop();ensure();panel.hidden=false;document.body.classList.add('has-speech');last={...options,text:value};controls(false);panel.querySelector('.speech-word').textContent=value;
  if(!synthesis()||typeof SpeechSynthesisUtterance==='undefined'){last=null;controls(false);status('Device speech is not supported here. Choose a configured cloud voice in Settings.');return;}
  const seq=++sequence;status('Finding a voice for this language...');const voices=await voicesReady();if(seq!==sequence)return;
  const language=options.language.toLowerCase(),base=language.split('-')[0];
  const matching=voices.filter(v=>v.lang?.toLowerCase().split('-')[0]===base);
  const voice=matching.find(v=>v.localService&&v.lang.toLowerCase()===language)||matching.find(v=>v.localService)||matching.find(v=>v.lang.toLowerCase()===language)||matching[0];
  if(!voice){status('No '+options.language+' voice is installed. Install one in your device settings or configure a cloud voice in Nabu.');return;}
  utterance=new SpeechSynthesisUtterance(value);utterance.voice=voice;utterance.lang=voice.lang;utterance.rate=options.rate===0.85?0.85:1;
  utterance.onstart=()=>{if(seq!==sequence)return;clearTimeout(timer);status('Playing with '+voice.name+(voice.localService?' (on-device).':' (device-provided online voice).'));controls(true);};
  utterance.onend=()=>{if(seq!==sequence)return;clearTimeout(timer);status('Finished. Replay to listen again.');controls(false);utterance=null;};
  utterance.onerror=e=>{if(seq!==sequence)return;clearTimeout(timer);controls(false);status(['canceled','interrupted'].includes(e.error)?'Stopped.':'The voice could not play. Retry, or select a different voice service in Settings.');};
  status('Starting playback...');controls(true);
  timer=setTimeout(()=>{if(seq===sequence){stop(false);status('The voice did not start. Press Replay once, or check device voices.');}},8000);
  try{synthesis().speak(utterance);}catch(e){stop(false);status(readableError(e));}
 }
 return {play,stop};
}
export function createRecorder({onState=()=>{},onReady=()=>{}}={}) {
 let stream=null,recorder=null,blob=null,timer=null,ticker=null,sequence=0,started=0,phase='idle';
 const notify=(state,message)=>{phase=state;onState({state,message,elapsed:started?Math.min(60,Math.floor((Date.now()-started)/1000)):0});};
 function release(){clearTimeout(timer);clearInterval(ticker);stream?.getTracks().forEach(t=>t.stop());stream=null;}
 function discard(){sequence++;if(recorder?.state==='recording')recorder.stop();recorder=null;release();blob=null;started=0;notify('idle','No recording.');}
 async function start(kind='microphone'){
  if(['requesting','recording','stopping'].includes(phase))throw new Error('Stop the current recording first.');
  if(!navigator.mediaDevices||typeof MediaRecorder==='undefined')throw new Error('Recording is not supported here. Use Chrome on localhost or HTTPS, or type your text.');
  discard();const seq=++sequence;notify('requesting',kind==='tab'?'Choose a browser tab and enable Share tab audio.':'Allow microphone access. Nothing is uploaded while recording.');
  let source;
  try{
   source=kind==='tab'?await navigator.mediaDevices.getDisplayMedia({video:true,audio:true}):await navigator.mediaDevices.getUserMedia({audio:true,video:false});
   if(seq!==sequence){source.getTracks().forEach(t=>t.stop());return;}
   stream=source;const tracks=source.getAudioTracks();if(!tracks.length)throw new Error('No audio was shared. Choose a browser tab and check Share tab audio, or use the microphone.');
   const format=['audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus','audio/mp4'].find(type=>MediaRecorder.isTypeSupported(type));
   if(!format)throw new Error('This browser has no supported audio recording format.');
   const chunks=[];let total=0,tooLarge=false,failed=false;
   recorder=new MediaRecorder(new MediaStream(tracks),{mimeType:format,audioBitsPerSecond:64000});
   recorder.ondataavailable=e=>{if(seq!==sequence||!e.data.size)return;total+=e.data.size;if(total>MAX_AUDIO_BYTES){tooLarge=true;stop();}else chunks.push(e.data);};
   recorder.onerror=()=>{if(seq!==sequence)return;failed=true;release();notify('error','Recording failed. Record again or type the text.');};
   recorder.onstop=()=>{if(seq!==sequence)return;release();recorder=null;if(failed)return;if(tooLarge){blob=null;notify('error','Recording exceeded 4 MB. Record a shorter excerpt.');return;}blob=new Blob(chunks,{type:format.split(';')[0]});if(!blob.size){notify('error','The recording was empty. Try again.');return;}notify('ready','Recording stopped. Listen before sending it for transcription.');onReady(blob);};
   source.getTracks().forEach(t=>t.addEventListener('ended',()=>{if(seq===sequence&&phase==='recording')stop();},{once:true}));
   recorder.start(250);started=Date.now();notify('recording','Recording. Stops automatically at 60 seconds.');
   ticker=setInterval(()=>notify('recording','Recording. Stops automatically at 60 seconds.'),500);timer=setTimeout(stop,MAX_RECORDING_SECONDS*1000);
  }catch(e){source?.getTracks().forEach(t=>t.stop());if(seq!==sequence)return;release();notify('error',readableError(e));throw new Error(readableError(e));}
 }
 function stop(){if(recorder?.state==='recording'){notify('stopping','Stopping recording...');recorder.stop();clearTimeout(timer);clearInterval(ticker);}else release();}
 return {start,stop,discard,getBlob:()=>blob,getState:()=>phase};
}
export function audioBase64(blob){return new Promise((resolve,reject)=>{if(!blob||blob.size>MAX_AUDIO_BYTES){reject(new Error('Record up to 4 MB.'));return;}const reader=new FileReader();reader.onerror=()=>reject(new Error('Could not read the recording.'));reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.readAsDataURL(blob);});}
