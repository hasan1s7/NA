/* Local, bounded reading aids. No provider calls or phonetic/mastery claims.
 * Nabu schemes are explicitly versioned, not claims of ISO/ALA/RR conformance.
 * Original input and source context are never rewritten by this module.
 */
export const READING_SCHEMES = Object.freeze({
 ru:{id:'nabu-ru-letters-v1',script:'Cyrl',label:'Russian letter transliteration'},
 ar:{id:'nabu-ar-written-v1',script:'Arab',label:'Arabic written-form transliteration'},
 ko:{id:'nabu-ko-syllables-v1',script:'Hang',label:'Hangul syllable transliteration'},
 ja:{id:'nabu-ja-kana-v1',script:'Jpan',label:'Japanese kana / Hepburn-style spelling'},
 'zh-CN':{id:'verified-word-reading-v1',script:'Hani',label:'Checked whole-word reading required'},
 en:{id:'original-latin-v1',script:'Latn',label:'Original Latin script'},
 es:{id:'original-latin-v1',script:'Latn',label:'Original Latin script'},
 fr:{id:'original-latin-v1',script:'Latn',label:'Original Latin script'},
 de:{id:'original-latin-v1',script:'Latn',label:'Original Latin script'},
 it:{id:'original-latin-v1',script:'Latn',label:'Original Latin script'},
 pt:{id:'original-latin-v1',script:'Latn',label:'Original Latin script'},
 tr:{id:'original-latin-v1',script:'Latn',label:'Original Latin script'}
});
const ruLetters='\u0430\u0431\u0432\u0433\u0434\u0435\u0451\u0436\u0437\u0438\u0439\u043a\u043b\u043c\u043d\u043e\u043f\u0440\u0441\u0442\u0443\u0444\u0445\u0446\u0447\u0448\u0449\u044a\u044b\u044c\u044d\u044e\u044f';
const ruValues=['a','b','v','g','d','e','yo','zh','z','i','y','k','l','m','n','o','p','r','s','t','u','f','kh','ts','ch','sh','shch','\u02ba','y','\u02b9','e','yu','ya'];
const ruMap=Object.fromEntries([...ruLetters].map((c,i)=>[c,ruValues[i]]));
function russian(text){
 return text.replace(/[\p{Script=Cyrillic}\p{M}]+/gu,word=>{
  const allCaps=word===word.toUpperCase()&&word!==word.toLowerCase();
  return [...word].map(c=>{const r=ruMap[c.toLowerCase()];if(r===undefined)return c;return allCaps?r.toUpperCase():c===c.toLowerCase()?r:r[0].toUpperCase()+r.slice(1);}).join('');
 });
}
const arLetters='\u0627\u0623\u0625\u0622\u0621\u0624\u0626\u0628\u062a\u062b\u062c\u062d\u062e\u062f\u0630\u0631\u0632\u0633\u0634\u0635\u0636\u0637\u0638\u0639\u063a\u0641\u0642\u0643\u0644\u0645\u0646\u0647\u0648\u064a\u0649\u0629\u0671';
const arValues=['\u0101','\u02be','\u02be','\u02be\u0101','\u02be','\u02be','\u02be','b','t','th','j','\u1e25','kh','d','dh','r','z','s','sh','\u1e63','\u1e0d','\u1e6d','\u1e93','\u02bf','gh','f','q','k','l','m','n','h','w','y','\u0101','\u1e97','\u02be'];
const arMap=Object.fromEntries([...arLetters].map((c,i)=>[c,arValues[i]]));
const arMarks={'\u064e':'a','\u064f':'u','\u0650':'i','\u064b':'an','\u064c':'un','\u064d':'in','\u0652':'','\u0670':'\u0101'};
function arabic(input){
 // Normalize presentation forms locally; never normalize the original stored text.
 const text=input.replace(/[\uFB50-\uFDFF\uFE70-\uFEFF]/gu,c=>c.normalize('NFKC')).normalize('NFC');
 const clusters=text.match(/[^\p{M}][\p{M}]*|[\p{M}]+/gu)||[];let out='';
 for(let i=0;i<clusters.length;i++){
  const [base,...marks]=[...clusters[i]];if(base==='\u0640')continue;
  if(!(base in arMap)){out+=clusters[i];continue;}
  // Shadda is applied to the consonant BEFORE vowel marks, regardless of Unicode order.
  let stem=arMap[base];if(marks.includes('\u0651'))stem+=stem;
  let vowels=marks.filter(m=>m!=='\u0651').map(m=>arMarks[m]??m).join('');
  // Fathatan's written support alif is not an additional long vowel.
  if(base==='\u0627'&&marks.includes('\u064b'))stem='';
  const next=clusters[i+1];
  if(vowels==='an'&&next==='\u0627')i++;
  else if((vowels==='a'&&(next==='\u0627'||next==='\u0649'))||(vowels==='u'&&next==='\u0648')||(vowels==='i'&&next==='\u064a')){
   vowels={a:'\u0101',u:'\u016b',i:'\u012b'}[vowels];i++;
  }
  out+=stem+vowels;
 }
 return out;
}
const koOnset=['g','kk','n','d','tt','r','m','b','pp','s','ss','','j','jj','ch','k','t','p','h'];
const koVowel=['a','ae','ya','yae','eo','e','yeo','ye','o','wa','wae','oe','yo','u','wo','we','wi','yu','eu','ui','i'];
const koFinal=['','k','k','ks','n','nj','nh','t','l','lk','lm','lb','ls','lt','lp','lh','m','p','ps','t','t','ng','t','t','k','t','p','h'];
function korean(text){return [...text].map(c=>{const n=c.codePointAt(0)-0xac00;return n<0||n>=11172?c:koOnset[Math.floor(n/588)]+koVowel[Math.floor(n%588/28)]+koFinal[n%28];}).join('');}
const kanaRows=[
 ['\u3042\u3044\u3046\u3048\u304a',['a','i','u','e','o']],
 ['\u304b\u304d\u304f\u3051\u3053',['ka','ki','ku','ke','ko']],
 ['\u3055\u3057\u3059\u305b\u305d',['sa','shi','su','se','so']],
 ['\u305f\u3061\u3064\u3066\u3068',['ta','chi','tsu','te','to']],
 ['\u306a\u306b\u306c\u306d\u306e',['na','ni','nu','ne','no']],
 ['\u306f\u3072\u3075\u3078\u307b',['ha','hi','fu','he','ho']],
 ['\u307e\u307f\u3080\u3081\u3082',['ma','mi','mu','me','mo']],
 ['\u3084\u3086\u3088',['ya','yu','yo']],
 ['\u3089\u308a\u308b\u308c\u308d',['ra','ri','ru','re','ro']],
 ['\u308f\u3090\u3091\u3092\u3093',['wa','wi','we','wo','n']],
 ['\u304c\u304e\u3050\u3052\u3054',['ga','gi','gu','ge','go']],
 ['\u3056\u3058\u305a\u305c\u305e',['za','ji','zu','ze','zo']],
 ['\u3060\u3062\u3065\u3067\u3069',['da','ji','zu','de','do']],
 ['\u3070\u3073\u3076\u3079\u307c',['ba','bi','bu','be','bo']],
 ['\u3071\u3074\u3077\u307a\u307d',['pa','pi','pu','pe','po']],
 ['\u3094',['vu']]
];
const kanaMap=Object.fromEntries(kanaRows.flatMap(([chars,values])=>[...chars].map((c,i)=>[c,values[i]])));
const digraphBases={'\u304d':'ky','\u304e':'gy','\u3057':'sh','\u3058':'j','\u3061':'ch','\u3062':'j','\u306b':'ny','\u3072':'hy','\u3073':'by','\u3074':'py','\u307f':'my','\u308a':'ry'};
const smallY={'\u3083':'a','\u3085':'u','\u3087':'o'};
const foreignKana={'\u3075\u3041':'fa','\u3075\u3043':'fi','\u3075\u3047':'fe','\u3075\u3049':'fo','\u3066\u3043':'ti','\u3067\u3043':'di','\u3068\u3045':'tu','\u3069\u3045':'du','\u3046\u3043':'wi','\u3046\u3047':'we','\u3046\u3049':'wo','\u3057\u3047':'she','\u3061\u3047':'che','\u3058\u3047':'je','\u3094\u3041':'va','\u3094\u3043':'vi','\u3094\u3047':'ve','\u3094\u3049':'vo'};
function japanese(input){
 const chars=[...input.replace(/[\uFF61-\uFF9F]+/gu,x=>x.normalize('NFKC')).normalize('NFC')].map(c=>c>='\u30a1'&&c<='\u30f6'?String.fromCharCode(c.charCodeAt(0)-0x60):c);
 let out='',lastVowel='',pending=false,partial=false;
 for(let i=0;i<chars.length;i++){
  const c=chars[i],next=chars[i+1]||'';
  if(c==='\u3063'){if(pending){out+='\u3063';partial=true;}pending=true;continue;}
  if(c==='\u30fc'){
   if(lastVowel)out+=lastVowel;else{out+=c;partial=true;}continue;
  }
  let r=foreignKana[c+next];if(r)i++;
  else if(digraphBases[c]&&smallY[next]){r=digraphBases[c]+smallY[next];i++;}
  else r=kanaMap[c];
  if(r!==undefined){
   if(pending){if(/^[bcdfghjklmpqrstvwxyz]/.test(r)&&!r.startsWith('n'))out+=r.startsWith('ch')?'t':r[0];else{out+='\u3063';partial=true;}pending=false;}
   if(c==='\u3093'&&/^[aeiouy]/.test(kanaMap[next]||''))r="n'";
   out+=r;lastVowel=r.match(/[aeiou]$/)?.[0]||'';
  }else{
   if(pending){out+='\u3063';partial=true;pending=false;}
   out+=c;lastVowel='';if(/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(c))partial=true;
  }
 }
 if(pending){out+='\u3063';partial=true;}
 return {text:out,partial};
}
function hasForeignLetters(text){return /[^\p{Script=Latin}\p{N}\p{P}\p{Z}\p{M}\p{S}\s\u02b9\u02ba\u02be\u02bf]/u.test(text);}
export function transliterate({text='',sourceLanguage='',sourceScript='',targetScript='Latn',scheme='auto',dictionaryReading=null}={}){
 const input=String(text).normalize('NFC'),rule=READING_SCHEMES[sourceLanguage];
 const result={input,sourceLanguage,sourceScript:sourceScript||rule?.script||'',targetScript,scheme:scheme==='auto'?rule?.id||'':scheme,output:'',text:'',available:false,status:'unavailable',method:rule?.label||'',warning:'',partial:false};
 const unavailable=warning=>({...result,warning});
 if(!input.trim())return unavailable('Choose a word first.');
 if(input.length>10000)return unavailable('A reading aid supports up to 10,000 characters.');
 if(!rule)return unavailable('This source language has no supported reading scheme. Enter a checked reading yourself.');
 if(targetScript!=='Latn')return unavailable('Only the Latin target script is supported.');
 if(sourceScript&&sourceScript!==rule.script)return unavailable('The requested script does not match this language scheme.');
 if(scheme!=='auto'&&scheme!==rule.id&&!(scheme==='dictionary'&&['ja','zh-CN'].includes(sourceLanguage)))return unavailable('That scheme is not implemented for this language.');
 const complete=(output,status,warning,partial=false,method=rule.label)=>({...result,output,text:output,available:!!output,status,method,warning,partial});
 const d=dictionaryReading;
 if(['ja','zh-CN'].includes(sourceLanguage)&&d&&String(d.input).normalize('NFC')===input&&d.sourceLanguage===sourceLanguage&&d.reading&&d.source&&d.targetScript==='Latn'&&d.verified===true){
  return {...complete(String(d.reading),'dictionary-derived',d.verified?'Recorded whole-word reading; context and names may still require checking.':'Approximate stored reading, without reliable tone marks. Not a verified Pinyin pronunciation guide.'),scheme:d.scheme||'dictionary',dictionarySource:d.source,quality:d.verified?'checked':'approximate'};
 }
 if(scheme==='dictionary')return unavailable('No verified whole-word dictionary reading was supplied.');
 if(rule.script==='Latn'){
  if(!/\p{Script=Latin}/u.test(input))return unavailable('This text is not in the selected Latin-script language. No conversion was applied.');
  const partial=hasForeignLetters(input);return complete(input,partial?'approximate':'rule-based','Already written in Latin script; this is not a pronunciation guide.'+(partial?' Other scripts are preserved unchanged.':''),partial);
 }
 if(sourceLanguage==='zh-CN')return unavailable('No whole-word reading is recorded for this text. Add a checked reading; tones are not guessed.');
 if(sourceLanguage==='ja'){
  if(/\p{Script=Han}/u.test(input))return unavailable('No reliable whole-word reading is supplied for these Japanese kanji. Add a checked reading; characters are not given fixed or Chinese pronunciations.');
  if(!/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(input))return unavailable('No supported Japanese kana was found. Choose the correct source language.');
  const r=japanese(input),partial=r.partial||hasForeignLetters(r.text);
  return complete(r.text,partial?'approximate':'rule-based','Kana spelling aid, not pronunciation. Particles and vowel spellings are retained; no kanji readings are guessed.'+(partial?' Unsupported sequences remain in the original script.':''),partial);
 }
 let output='',warning='';
 if(sourceLanguage==='ru'){
  if(![...input].some(c=>ruMap[c.toLowerCase()]!==undefined))return unavailable('No supported Russian letters were found. Choose the correct language.');
  output=russian(input);warning='Spelling aid, not phonetics. Stress and vowel reduction are not inferred; written stress marks are preserved.';
 }else if(sourceLanguage==='ar'){
  if(![...input.normalize('NFKC')].some(c=>arMap[c]!==undefined))return unavailable('No supported Arabic letters were found. Choose the correct language.');
  output=arabic(input);warning='Only written letters and marks are represented. Missing vowels, dialect, alif carriers and pronunciation are not guessed.';
 }else if(sourceLanguage==='ko'){
  if(!/[\uAC00-\uD7A3]/u.test(input))return unavailable('No complete Hangul syllables were found. Standalone jamo and Hanja need a checked reading.');
  output=korean(input);warning='Syllable-based spelling aid, not official Revised Romanization. Sound changes across syllables are not modeled.';
 }
 const partial=hasForeignLetters(output)||(sourceLanguage==='ar'&&/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/u.test(output));return complete(output.normalize('NFC'),sourceLanguage==='ru'&&!partial?'rule-based':'approximate',warning+(partial?' Unsupported letters or marks remain unchanged.':''),partial);
}
export function readingForCard(card={},bankReading=''){
 const input=String(card.front||'').normalize('NFC');
 if(card.readingMethod==='User reading aid (hidden)')return {input,sourceLanguage:card.sourceLang,targetScript:'Latn',scheme:'user',status:'user-provided',available:false,text:'',output:'',method:'Hidden by you',warning:'You cleared this reading aid. An automatic suggestion will not replace it.',hidden:true};
 if(card.reading)return {input,sourceLanguage:card.sourceLang,targetScript:'Latn',scheme:'user',status:'user-provided',available:true,text:card.reading,output:card.reading,method:card.readingMethod||'Saved reading aid',warning:'Your saved reading is kept as entered. It is not a pronunciation assessment.'};
 return transliterate({text:input,sourceLanguage:card.sourceLang,dictionaryReading:bankReading?{input,sourceLanguage:card.sourceLang,reading:bankReading,targetScript:'Latn',scheme:'nabu-bank-draft-v1',source:'Nabu bundled draft word bank',verified:false}:null});
}
