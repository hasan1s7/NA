import test from 'node:test';
import assert from 'node:assert/strict';
import * as U from '../public/nabu-reading-ui.js';
import * as G from '../public/nabu-graph.js';

function tokenize(text,language){
 return [...new Intl.Segmenter(language,{granularity:'word'}).segment(text)].map(x=>({text:x.segment,start:x.index,word:!!x.isWordLike}));
}

const targetFor=source=>G.LANGUAGES.find(x=>x!==source)||'en';
const phrase=G.CONCEPTS.find(c=>c.kind==='phrase');
assert(phrase,'word graph must contain at least one phrase concept');

for(const lang of G.LANGUAGES){
 test(`universal reader resolves a checked phrase in ${lang}`,()=>{
  const text=phrase.terms[lang];
  const resolved=G.resolve(text,lang,targetFor(lang));
  assert(['found','ambiguous'].includes(resolved.status));
  if(resolved.status==='found')assert.equal(resolved.conceptId,phrase.id);
  else assert(resolved.candidates.some(c=>c.id===phrase.id));
  const tokens=tokenize(text,lang),wordIndexes=tokens.map((t,i)=>t.word?i:-1).filter(i=>i>=0);
  assert(wordIndexes.length>=1);
  // Multi-segment phrases are discoverable from any selected word. One-token
  // phrases already resolve directly when that token is clicked.
  if(wordIndexes.length>1){
   const mid=wordIndexes[Math.floor(wordIndexes.length/2)];
   const options=U.phraseOptionsAround(tokens,mid,lang,G.lookup);
   assert(options.some(x=>x.conceptId===phrase.id));
  }
 });
}

test('phrase discovery does not cross punctuation boundaries',()=>{
 const text='I need. help';
 const tokens=tokenize(text,'en');
 const i=tokens.findIndex(t=>t.text==='help');
 assert.deepEqual(U.phraseOptionsAround(tokens,i,'en',G.lookup).filter(x=>x.text.includes('I need')),[]);
});

test('longer known expression is ranked ahead of shorter overlap',()=>{
 const tokens=[{text:'one',start:0,word:true},{text:' ',start:3,word:false},{text:'two',start:4,word:true},{text:' ',start:7,word:false},{text:'three',start:8,word:true}];
 const fake=(text)=>text==='one two three'?[{id:'long',kind:'expression',sense:'long'}]:text==='two three'?[{id:'short',kind:'phrase',sense:'short'}]:[];
 const options=U.phraseOptionsAround(tokens,2,'en',fake);
 assert.equal(options[0].conceptId,'long');
});
