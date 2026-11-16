// Generated vocabulary plus an indexed, sense-aware translation graph.
// Translation edges are complete within each sense; semantic edges are not translations.
export const LANGUAGES = Object.freeze([...DATA.languages]);
export const CATEGORIES = Object.freeze({...DATA.categories});
export const CONCEPTS = Object.freeze(DATA.concepts.map(c => Object.freeze({
 ...c,
 terms:Object.freeze({...c.terms}),
 transliterations:Object.freeze({...c.transliterations}),
 aliases:Object.freeze(Object.fromEntries(Object.entries(c.aliases).map(([k,v])=>[k,Object.freeze([...v])]))),
 ...(c.meaningTerms?{meaningTerms:Object.freeze({...c.meaningTerms}),meaningTransliterations:Object.freeze({...c.meaningTransliterations})}:{}),
 ...(c.literalTerms?{literalTerms:Object.freeze({...c.literalTerms}),literalTransliterations:Object.freeze({...c.literalTransliterations})}:{}),
})));
const byID = new Map(CONCEPTS.map(c=>[c.id,c]));
const indexes = new Map(LANGUAGES.map(l=>[l,new Map()]));
const translitIndexes = new Map(LANGUAGES.map(l=>[l,new Map()]));

export function normalizeWord(value,lang='en') {
 if(typeof value!=='string')return '';
 let s=value.replace(/[\u2018\u2019]/gu,"'").normalize('NFKC').replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/gu,'').trim();
 s=s.replace(/^[\s\p{P}]+|[\s\p{P}]+$/gu,'').replace(/\s+/gu,' ');
 if(lang==='ar')s=s.replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/gu,'');
 return s.toLocaleLowerCase(lang==='tr'?'tr':'en');
}
for(const c of CONCEPTS)for(const lang of LANGUAGES){
 for(const term of [c.terms[lang],...(c.aliases[lang]||[]),...(c.meaningTerms?[c.meaningTerms[lang]]:[])]){
  const key=normalizeWord(term,lang),index=indexes.get(lang);
  if(!index.has(key))index.set(key,[]);
  if(!index.get(key).includes(c))index.get(key).push(c);
 }
 const translit=c.transliterations?.[lang] || c.meaningTransliterations?.[lang] || '';
 if(translit){
  const tIndex=translitIndexes.get(lang);
  const key=normalizeWord(c.terms[lang],lang);
  if(!tIndex.has(key))tIndex.set(key,translit);
 }
}
export function concept(id){return byID.get(id)||null;}
export function lookup(text,source){return [...(indexes.get(source)?.get(normalizeWord(text,source))||[])];}
export function transliterationOf(text,lang){
 const key=normalizeWord(text,lang);
 if(!key)return '';
 const direct=translitIndexes.get(lang)?.get(key);
 if(direct)return direct;
 const candidate=lookup(text,lang)[0];
 if(candidate)return candidate.transliterations?.[lang]||candidate.meaningTransliterations?.[lang]||'';
 return '';
}
export function resolve(text,source,target,id=''){
 if(!LANGUAGES.includes(source)||!LANGUAGES.includes(target))throw new Error('Unsupported language.');
 if(source===target)throw new Error('Choose two different languages.');
 const candidates=lookup(text,source);
 if(id){const c=concept(id);if(!c||!candidates.includes(c))return {status:'missing',candidates:[]};return result(c,source,target);}
 if(!candidates.length)return {status:'missing',candidates:[]};
 if(candidates.length>1)return {status:'ambiguous',candidates};
 return result(candidates[0],source,target);
}
function result(c,source,target){
 const expression=c.kind==='expression';
 // Idioms translate to their meaning, never blindly into a different-language metaphor.
 const back=expression?c.meaningTerms[target]:c.terms[target];
 const literalBack=expression&&source===c.origin?c.literalTerms[target]:'';
 return {status:'found',concept:c,front:c.terms[source],back,sourceLang:source,targetLang:target,conceptId:c.id,
  literalBack,literalGloss:c.literalGlosses?.[source]||'',literalLanguage:literalBack?target:c.literalGlosses?'en':'',
  sourceTransliteration:c.transliterations?.[source]||'',
  backTransliteration:expression?(c.meaningTransliterations?.[target]||''):(c.transliterations?.[target]||''),
  literalBackTransliteration:literalBack?(c.literalTransliterations?.[target]||''):'',
 };
}
export function translation(id,source,target){
 const c=concept(id);if(!c)throw new Error('Unknown word meaning.');
 if(!LANGUAGES.includes(source)||!LANGUAGES.includes(target)||source===target)throw new Error('Choose two supported, different languages.');
 return result(c,source,target);
}
// Cache normalized search text per source language; display spellings are untouched.
const searchIndexes=new Map();
function folded(value,lang){return normalizeWord(value,lang).normalize('NFD').replace(/\p{M}/gu,'');}
function searchIndex(source){
 if(!searchIndexes.has(source))searchIndexes.set(source,CONCEPTS.map((c,index)=>{
  const local=[c.terms[source],...(c.aliases[source]||[])];
  return {c,index,exact:local.map(s=>normalizeWord(s,source)),local:local.map(s=>folded(s,source)),
   all:[c.sense,...Object.values(c.terms),...Object.values(c.meaningTerms||{}),...Object.values(c.literalTerms||{}),...Object.values(c.aliases).flat()].map(s=>folded(s,source))};
 }));return searchIndexes.get(source);
}
export function bankStats(){return {total:CONCEPTS.length,words:CONCEPTS.filter(c=>!c.kind||c.kind==='word').length,phrases:CONCEPTS.filter(c=>c.kind==='phrase').length,expressions:CONCEPTS.filter(c=>c.kind==='expression').length};}
export function search(query='',source='en',target='es',category='',limit=Infinity,kind=''){
 if(!LANGUAGES.includes(source)||!LANGUAGES.includes(target))return [];
 const raw=normalizeWord(query,source),q=folded(query,source);
 const cap=Number.isFinite(limit)?Math.max(0,Math.floor(limit)):CONCEPTS.length;
 return searchIndex(source).filter(x=>(!category||x.c.category===category)&&(!kind||(x.c.kind||'word')===kind)).map(x=>{
  const score=!q?1:x.exact.includes(raw)?100:x.local.some(s=>s.startsWith(q))?80:x.local.some(s=>s.includes(q))?60:x.all.some(s=>s.includes(q))?30:0;
  return {...x,score};
 }).filter(x=>x.score).sort((a,b)=>b.score-a.score||a.index-b.index).slice(0,cap).map(x=>x.c);
}
export function detect(text,exclude=''){
 const result=[];for(const lang of LANGUAGES)if(lang!==exclude)for(const c of lookup(text,lang))result.push({concept:c,language:lang});
 return result;
}
export function related(id,limit=8){
 const c=concept(id);if(!c)return [];
 const explicit=DATA.bridges.filter(([a,b])=>a===id||b===id).map(([a,b,relation])=>({concept:concept(a===id?b:a),relation}));
 const seen=new Set([id,...explicit.map(x=>x.concept.id)]);
 const same=CONCEPTS.filter(x=>x.category===c.category&&!seen.has(x.id)).map(x=>({concept:x,relation:CATEGORIES[c.category]}));
 return [...explicit,...same].slice(0,limit);
}
export function translationNeighbors(id,source){
 if(!concept(id)||!LANGUAGES.includes(source))return [];
 return LANGUAGES.filter(l=>l!==source).map(target=>translation(id,source,target));
}
export function graphStats(){return {concepts:CONCEPTS.length,languages:LANGUAGES.length,nodes:CONCEPTS.length*LANGUAGES.length,translationEdges:CONCEPTS.length*LANGUAGES.length*(LANGUAGES.length-1),languagePairs:LANGUAGES.length*(LANGUAGES.length-1)};}
export function exportGraph(){
 const nodes=[],edges=[],semanticEdges=[];
 for(const c of CONCEPTS)for(const source of LANGUAGES){
  nodes.push({id:c.id+':'+source,conceptId:c.id,language:source,text:c.terms[source],transliteration:c.transliterations?.[source]||'',sense:c.sense,category:c.category});
  for(const target of LANGUAGES)if(source!==target)edges.push({from:c.id+':'+source,to:c.id+':'+target,type:'translation'});
 }
 for(const category of Object.keys(CATEGORIES)){
  const entries=CONCEPTS.filter(c=>c.category===category);
  for(let i=0;i<entries.length;i++)for(let j=i+1;j<entries.length;j++)semanticEdges.push({from:entries[i].id,to:entries[j].id,type:'same-topic'});
 }
 for(const [from,to,relation] of DATA.bridges)semanticEdges.push({from,to,type:relation});
 return {version:DATA.version,...graphStats(),provenance:DATA.provenance,nodes,edges,conceptLinks:semanticEdges};
}
function tokenize(text){return text.match(/\p{L}[\p{L}\p{M}\p{N}'’\-]*|\p{N}+|[^\p{L}\p{M}\p{N}]+/gu)?.map(value=>({text:value,word:/[\p{L}\p{N}]/u.test(value)}))||[];}
function foundSegment(sourceText,resolved){
 return {
  status:'found',
  source:resolved.front||sourceText,
  target:resolved.back,
  conceptId:resolved.conceptId,
  sense:resolved.concept?.sense||'',
  sourceTransliteration:resolved.sourceTransliteration||'',
  targetTransliteration:resolved.backTransliteration||''
 };
}
export function compose(text,source,target,maxSpan=4){
 if(!LANGUAGES.includes(source)||!LANGUAGES.includes(target))throw new Error('Unsupported language.');
 if(source===target)throw new Error('Choose two different languages.');
 const direct=resolve(text,source,target);
 if(direct.status==='found')return {status:'found',front:direct.front,back:direct.back,sourceLang:source,targetLang:target,direct:true,segments:[foundSegment(text,direct)],unresolvedCount:0,ambiguousCount:0,sourceTransliteration:direct.sourceTransliteration||'',backTransliteration:direct.backTransliteration||''};
 const tokens=tokenize(text.normalize('NFC'));
 const segments=[];let i=0,unresolved=0,ambiguous=0;
 while(i<tokens.length){
  const token=tokens[i];
  if(!token.word){segments.push({status:'separator',source:token.text,target:token.text});i++;continue;}
  const spans=[{end:i,resolved:resolve(token.text,source,target),text:token.text}];
  let end=i, words=1;
  while(words<maxSpan){
   const sep=tokens[end+1],next=tokens[end+2];
   if(!sep||!next||sep.word||!next.word||!/^[\s]+$/u.test(sep.text))break;
   end+=2;words++;
   const textPart=tokens.slice(i,end+1).map(x=>x.text).join('');
   spans.push({end,resolved:resolve(textPart.trim(),source,target),text:textPart.trim()});
  }
  let chosen=spans.slice().reverse().find(x=>x.resolved.status==='found');
  if(chosen){segments.push(foundSegment(chosen.text,chosen.resolved));i=chosen.end+1;continue;}
  const ambig=spans.slice().reverse().find(x=>x.resolved.status==='ambiguous');
  if(ambig){
   ambiguous++;
   segments.push({status:'ambiguous',source:ambig.text,target:'',choices:ambig.resolved.candidates.map(c=>({id:c.id,sense:c.sense,target:c.meaningTerms?.[target]||c.terms[target],targetTransliteration:c.meaningTransliterations?.[target]||c.transliterations?.[target]||''}))});
   i=ambig.end+1;continue;
  }
  unresolved++;
  segments.push({status:'missing',source:token.text,target:'',sourceTransliteration:transliterationOf(token.text,source)||''});
  i++;
 }
 const back=segments.map(segment=>segment.status==='separator'?segment.target:segment.status==='found'?segment.target:segment.status==='ambiguous'?`[${segment.source}?]`:`[${segment.source}]`).join('').trim();
 const wordSegments=segments.filter(x=>x.status!=='separator');
 return {status:unresolved||ambiguous?'partial':'found',front:text,back,sourceLang:source,targetLang:target,direct:false,segments:wordSegments,unresolvedCount:unresolved,ambiguousCount:ambiguous,
  sourceTransliteration:wordSegments.map(s=>s.sourceTransliteration).filter(Boolean).join(' • '),
  backTransliteration:wordSegments.map(s=>s.targetTransliteration).filter(Boolean).join(' • ')
 };
}

/** Only fully resolved term assemblies can be auto-saved as draft reference. */
export function compositionCanSave(value){
 return !!value && value.status==='found' && value.segments?.length>0 &&
  !value.unresolvedCount && !value.ambiguousCount && value.segments.every(s=>s.status==='found');
}
