/* Private, in-memory playback cache. No browser persistence or provider keys. */
export function speechKey({text,language,scope,model}) {
 return JSON.stringify([scope,model,language,text.normalize('NFC').trim()]);
}
export function createSpeaker({loadAudio,onMessage}) {
 const entries=new Map(),maxEntries=24,maxBytes=16*1024*1024;
 let size=0,sequence=0,controller=null,player=null,audio=null,url=null,current='',pending='',playbackRate=null;
 function makePlayer(){
  const host=document.querySelector('dialog[open]')||document.querySelector('[data-audio-host]')||document.body;if(player?.isConnected){if(player.parentElement!==host)host.append(player);return;}
  player=document.createElement('aside');player.id='speech-player';player.className='speech-player';
  player.setAttribute('aria-label','Pronunciation player');player.hidden=true;
  player.innerHTML='<div class="speech-top"><span class="speech-provider">ELEVENLABS / AI-GENERATED VOICE</span><button type="button" class="icon-button" aria-label="Close audio player" data-speech-close>&times;</button></div><div class="speech-word" dir="auto"></div><p class="speech-status" role="status" aria-live="polite"></p><audio controls preload="metadata" aria-label="Word pronunciation"></audio><label class="speech-rate">Playback <select aria-label="Pronunciation playback speed"><option value="1">Natural speed</option><option value="0.85">Slower - 0.85x</option></select></label>';
  host.append(player);audio=player.querySelector('audio');
  player.querySelector('[data-speech-close]').addEventListener('click',stop);
  player.querySelector('select').addEventListener('change',()=>setRate(Number(player.querySelector('select').value)));
  audio.addEventListener('play',()=>status('Playing.'));
  audio.addEventListener('ended',()=>status('Ready to replay. No new generation needed.'));
  audio.addEventListener('error',()=>{if(current)status('The browser could not play this audio. Try a different browser.');});
 }
 function status(value){if(player)player.querySelector('.speech-status').textContent=value;}
 function setRate(value){
  const rate=value===0.85?0.85:1;playbackRate=rate;
  if(audio){audio.playbackRate=rate;if('preservesPitch' in audio)audio.preservesPitch=true;}
  if(player)player.querySelector('select').value=String(rate);
 }
 function release(){
  if(audio){audio.pause();audio.removeAttribute('src');audio.load();}
  if(url){URL.revokeObjectURL(url);url=null;}
 }
 function stop(){
  sequence++;controller?.abort();controller=null;pending='';current='';release();
  if(player)player.hidden=true;document.body.classList.remove('has-speech');
 }
 function clear(){stop();entries.clear();size=0;playbackRate=null;}
 function remember(key,blob){
  if(blob.size>maxBytes)return;
  if(entries.has(key)){size-=entries.get(key).size;entries.delete(key);}
  entries.set(key,blob);size+=blob.size;
  while(entries.size>maxEntries||size>maxBytes){const oldest=entries.keys().next().value;size-=entries.get(oldest).size;entries.delete(oldest);}
 }
 async function play(options){
  const text=String(options.text||'').trim();if(!text)return;
  if(text.length>2000)throw new Error('Listen to a selection of 2,000 characters or fewer.');
  const key=speechKey({...options,text});
  if(pending===key)return; // Repeated taps do not start another paid request.
  controller?.abort();const seq=++sequence;controller=new AbortController();const signal=controller.signal;
  pending=key;current='';makePlayer();release();player.hidden=false;document.body.classList.add('has-speech');
  player.querySelector('.speech-word').textContent=text;player.querySelector('.speech-word').title=text;
  status('Preparing pronunciation...');
  try{
   const cached=entries.get(key);const blob=cached||await loadAudio({text,language:options.language},signal);
   if(seq!==sequence)return;
   if(!(blob instanceof Blob)||!blob.size||!/^audio\/(mpeg|mp3)/i.test(blob.type))throw new Error('The server returned no playable pronunciation.');
   remember(key,blob);url=URL.createObjectURL(blob);audio.src=url;current=key;setRate(playbackRate??options.rate);
   status(cached?'Ready from this tab\'s audio cache.':'Ready.');
   try{await audio.play();}catch(error){if(seq===sequence)status(error.name==='NotAllowedError'?'Ready. Press the play button to listen.':'Ready. Press play; your browser may require another tap.');}
  }catch(error){
   if(seq!==sequence||error.name==='AbortError')return;
   status(error.message||'Pronunciation is unavailable.');onMessage?.(error.message||'Pronunciation is unavailable.');
  }finally{if(seq===sequence){pending='';controller=null;}}
 }
 return {play,stop,clear,setRate};
}
