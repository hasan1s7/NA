import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as G from '../public/nabu-graph.js';
import * as C from '../public/nabu-core.js';
const read=name=>JSON.parse(fs.readFileSync(new URL('../data/expansion/'+name,import.meta.url),'utf8'));

test('each bank component is exactly tripled, not just the overall count',()=>{
 assert.deepEqual(G.bankStats(),{total:1026,words:900,phrases:90,expressions:36});
 const m=read('manifest.json');for(const k of ['words','phrases','expressions'])assert.equal(m.current[k],m.previous[k]*3);
});
test('all legacy concept IDs, senses and spellings survive unchanged',()=>{
 const m=read('legacy-manifest.json');assert.equal(m.ids.length,342);
 for(const id of m.ids){const c=G.concept(id);assert(c,id);assert.deepEqual(c.terms,m.identityFields[id].terms,id);assert.equal(c.sense,m.identityFields[id].sense,id);}
});
test('24 new word topics contain 25 distinct entries each',()=>{
 const counts=new Map();for(const c of G.CONCEPTS.filter(c=>c.edition&&!c.kind))counts.set(c.category,(counts.get(c.category)||0)+1);
 assert.equal(counts.size,24);assert([...counts.values()].every(x=>x===25));
 const words=G.CONCEPTS.filter(c=>!c.kind);assert.equal(new Set(words.map(c=>JSON.stringify(c.terms))).size,900);
});
test('unlimited search exposes all 1026 entries beyond the old thousand-row cap',()=>{
 const r=G.search();assert.equal(r.length,1026);assert.equal(r.at(-1).id,'expressions.flea_camel');
 assert.equal(G.search('','en','es','',5).length,5);assert.equal(G.search('','en','es','',0).length,0);
});
test('entry-type filters are exhaustive and mutually exclusive',()=>{
 const sets=['word','phrase','expression'].map(k=>G.search('','en','es','',Infinity,k));
 assert.deepEqual(sets.map(x=>x.length),[900,90,36]);assert.equal(new Set(sets.flat().map(c=>c.id)).size,1026);
 assert.equal(G.search('','en','es','wildlife',Infinity,'phrase').length,0);
});
test('search finds source idioms even when two other languages are selected',()=>{
 const c=G.concept('expressions.snake_feet');assert(G.search(c.terms['zh-CN'],'es','ar').some(x=>x.id===c.id));
 assert(G.search('flea','en','ja').some(x=>x.id==='expressions.flea_camel'));
});
test('three expressions are supplied in every source language',()=>{
 for(const lang of G.LANGUAGES)assert.equal(G.CONCEPTS.filter(c=>c.kind==='expression'&&c.origin===lang).length,3);
});
test('Spanish inverted punctuation and outer quotation marks do not block exact lookup',()=>{
 const c=G.concept('phrases.seat_taken');const text=c.terms.es.replace(/^[\u00bf\u00a1]|[!?]$/g,'');
 assert.equal(G.resolve(text,'es','ja',c.id).conceptId,c.id);
 assert.equal(G.resolve('\u201cwater\u201d','en','ar').conceptId,'food.water');
 assert.equal(G.resolve('si','es','en').status,'missing');
});
test('new expression meanings never silently replace the meaning with the literal image',()=>{
 for(const c of G.CONCEPTS.filter(c=>c.edition&&c.kind==='expression'))for(const lang of G.LANGUAGES){
  if(lang===c.origin)continue;const r=G.translation(c.id,c.origin,lang);assert.equal(r.back,c.meaningTerms[lang]);assert.equal(r.literalBack,c.literalTerms[lang]);
 }
});
test('new phrases and expressions have complete usage, examples, replies and honest provenance',()=>{
 const all=G.CONCEPTS.filter(c=>c.edition&&c.kind);assert.equal(all.length,84);
 for(const c of all){assert.equal(c.details.reviewStatus,'draft');assert.match(c.details.provenance,/unverified/);for(const lang of G.LANGUAGES){assert(c.details.examples[lang]?.trim(),c.id+lang);assert(c.details.replies[lang]?.trim(),c.id+lang);}}
});
test('new homographs retain separate card identities and senses',()=>{
 for(const pair of [['animals.mouse','technology.mouse'],['actions.sleep','wellbeing.sleep'],['wildlife.fly','movement.fly']]){
  const a=G.translation(pair[0],'en','es'),b=G.translation(pair[1],'en','es');assert.notEqual(C.identity(a),C.identity(b));assert.equal(G.resolve(a.front,'en','es').status,'ambiguous');
 }
});
test('expanded records keep backup identity without exporting private progress in a share',()=>{
 const card=C.newCard({...G.translation('expressions.spill_beans','en','es'),note:'private sample'});
 const restored=C.parseImport(C.backup([card],[],{}),{sourceLang:'en',targetLang:'es'}).cards[0];assert.equal(C.identity(card),C.identity(restored));
 const shared=JSON.stringify(C.sharePayload(card));assert(!shared.includes('private sample'));assert(!shared.includes('schedule'));
});
