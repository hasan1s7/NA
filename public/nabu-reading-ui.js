/** Pure presentation helpers. No storage, network, provider or learning claims. */
export function escapeText(value) {
 return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
export function highlightContext(context, selected, selectedOffset=null) {
 const text=String(context||''), word=String(selected||'');
 if(!word)return escapeText(text);
 const index=Number.isInteger(selectedOffset)&&text.slice(selectedOffset,selectedOffset+word.length)===word?selectedOffset:text.indexOf(word);
 if(index<0)return escapeText(text);
 return escapeText(text.slice(0,index))+'<mark>'+escapeText(text.slice(index,index+word.length))+'</mark>'+escapeText(text.slice(index+word.length));
}
export function sourceExcerpt(text,start,length,max=1500) {
 text=String(text||'');start=Math.max(0,Math.min(text.length,start));
 const before=text.slice(0,start),after=text.slice(start+length),boundary=/[.!?\n\u3002\uff01\uff1f\u061f]/u;
 let left=0;for(let i=before.length-1;i>=0;i--)if(boundary.test(before[i])){left=i+1;break;}
 const ending=after.search(boundary);let right=ending<0?text.length:start+length+ending+1;
 // Keep the actual selection inside long source excerpts. Never replace it with an example.
 if(right-left>max){left=Math.max(left,start-Math.floor((max-length)/2));right=Math.min(right,left+max);}
 return text.slice(left,right).trim();
}
export function sameIdentity(a,b,identity) {
 if(!a?.front||!a?.back||!b?.front||!b?.back)return false;
 try{return identity(a)===identity(b);}catch{return false;}
}
export function captureSelection(selection,root,source) {
 if(!selection?.rangeCount||!root?.contains(selection.anchorNode)||!root.contains(selection.focusNode))return null;
 const text=selection.toString();if(!text.trim()||text.length>1000)return null;
 const range=selection.getRangeAt(0),before=range.cloneRange();before.selectNodeContents(root);before.setEnd(range.startContainer,range.startOffset);
 const start=before.toString().length+(text.length-text.trimStart().length),trimmed=text.trim();
 return {text:trimmed,context:sourceExcerpt(source,start,trimmed.length),start};
}
/** Isolate whole directional runs, not each word. Native buttons are bidi atoms;
 * without this, a Latin sentence inside Arabic can be reversed word by word.
 * DOM text, source offsets and original punctuation remain unchanged. */
export function readingMarkup(tokens,selected=-1) {
 const direction=value=>{for(const char of value){if(/[\p{Script=Arabic}\p{Script=Hebrew}]/u.test(char))return 'rtl';if(/\p{L}|\p{N}/u.test(char))return 'ltr';}return null;};
 const runs=[];let run={dir:null,html:''};
 for(let i=0;i<tokens.length;i++){
  const t=tokens[i],dir=direction(t.text);
  if(dir&&run.dir&&dir!==run.dir){
   // Boundary whitespace belongs between isolates. Keeping it at the end of an
   // LTR isolate can visually join its left edge to the next Arabic word.
   const gap=run.html.match(/\s+$/u)?.[0]||'';
   if(gap)run.html=run.html.slice(0,-gap.length);
   runs.push(run);if(gap)runs.push({raw:true,html:gap});run={dir,html:''};
  }
  else if(dir&&!run.dir)run.dir=dir;
  run.html+=t.word?`<button class="reader-token${selected===i?' selected':''}" data-action="reader-word" data-index="${i}" aria-label="Look up ${escapeText(t.text)}">${escapeText(t.text)}</button>`:escapeText(t.text);
 }
 if(run.html)runs.push(run);
 return runs.map(r=>r.raw?r.html:`<bdi class="reading-run" dir="${r.dir||'auto'}">${r.html}</bdi>`).join('');
}
/** dir=auto ignores isolated bdi descendants. Resolve the document's first strong
 * character from its untouched source, so the directional runs stay in order. */

/** Find checked multiword entries around a selected reader token.
 * This is meaning-aware phrase discovery from Nabu's existing word graph, not
 * morphology or free-form sentence parsing. Punctuation boundaries are respected. */
export function phraseOptionsAround(tokens,index,source,lookup,maxWords=6,maxResults=4) {
 const selected=tokens?.[index];
 if(!selected?.word||typeof lookup!=='function')return [];
 const wordIndexes=[];
 for(let i=0;i<tokens.length;i++)if(tokens[i]?.word)wordIndexes.push(i);
 const selectedWord=wordIndexes.indexOf(index);
 if(selectedWord<0)return [];
 const options=[];
 const left=Math.max(0,selectedWord-maxWords+1),right=Math.min(wordIndexes.length-1,selectedWord+maxWords-1);
 for(let a=left;a<=selectedWord;a++)for(let b=selectedWord;b<=right;b++){
  const width=b-a+1;if(width<2||width>maxWords)continue;
  const from=wordIndexes[a],to=wordIndexes[b],slice=tokens.slice(from,to+1);
  if(slice.some(t=>!t.word&&!/^[\s\u200b\u200c\u200d]*$/u.test(t.text)))continue;
  const text=slice.map(t=>t.text).join('').trim();if(!text)continue;
  const concepts=lookup(text,source)||[];
  for(const concept of concepts){
   const kind=concept.kind||'word';
   const priority=(kind==='expression'?30:kind==='phrase'?20:10)+width*2;
   options.push({text,start:tokens[from].start,length:text.length,conceptId:concept.id,kind,sense:concept.sense||'',priority});
  }
 }
 const seen=new Set();
 return options.sort((a,b)=>b.priority-a.priority||b.text.length-a.text.length).filter(x=>{const k=x.conceptId+'|'+x.text;if(seen.has(k))return false;seen.add(k);return true;}).slice(0,maxResults);
}

export function textDirection(value) {
 for(const char of String(value||'')){
  if(/[\p{Script=Arabic}\p{Script=Hebrew}]/u.test(char))return 'rtl';
  if(/\p{L}/u.test(char))return 'ltr';
 }
 return 'ltr';
}
