import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../public/nabu-graph.js';

test('ninety everyday phrases cover all twelve languages and English glosses',()=>{
 const phrases=G.CONCEPTS.filter(c=>c.kind==='phrase');assert.equal(phrases.length,90);
 for(const c of phrases)for(const l of G.LANGUAGES){assert(c.terms[l].length>0);assert(c.literalGlosses[l].length>0);}
});
test('thirty-six expressions include three sources from every supported language',()=>{
 const expressions=G.CONCEPTS.filter(c=>c.kind==='expression');assert.equal(expressions.length,36);
 assert.deepEqual(new Set(expressions.map(c=>c.origin)),new Set(G.LANGUAGES));
});
test('all 396 source-idiom directions have separate literal and natural target text',()=>{
 let count=0;
 for(const c of G.CONCEPTS.filter(c=>c.kind==='expression'))for(const target of G.LANGUAGES){
  if(target===c.origin)continue;const t=G.translation(c.id,c.origin,target);
  assert.equal(t.back,c.meaningTerms[target]);assert.equal(t.literalBack,c.literalTerms[target]);assert.equal(t.literalLanguage,target);count++;
 }
 assert.equal(count,396);
});
test('literal glosses are explicitly English, even with another target language',()=>{
 const t=G.translation('phrases.how_much','fr','ar');assert.equal(t.literalLanguage,'en');assert.equal(t.literalBack,'');assert(t.literalGloss);
});
test('a piece of cake is not mistranslated as food in the natural meaning field',()=>{
 const t=G.resolve("It's a piece of cake.",'en','es');assert.equal(t.back,'Es muy f\u00e1cil.');assert.equal(t.literalBack,'Es un trozo de pastel.');
});
test('smart apostrophes from phones resolve without losing sense identity',()=>{
 assert.equal(G.resolve('It\u2019s a piece of cake!','en','fr').conceptId,'expressions.piece_of_cake');
});
test('reverse translation into idiom origin returns its plain meaning, not fabricated literal text',()=>{
 const t=G.translation('expressions.piece_of_cake','es','en');assert.equal(t.back,"It's very easy.");assert.equal(t.literalBack,'');
});
test('unlisted expressions are never assigned invented literal translations',()=>{
 assert.equal(G.resolve('unlisted metaphoric phrase 123','en','fr').status,'missing');
});
