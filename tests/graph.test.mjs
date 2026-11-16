import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../public/nabu-graph.js';
import * as C from '../public/nabu-core.js';

test('exactly 1026 complete concepts and 132 language directions',()=>{
 assert.deepEqual(G.graphStats(),{concepts:1026,languages:12,nodes:12312,translationEdges:135432,languagePairs:132});
 assert.deepEqual(new Set(G.LANGUAGES),new Set(C.LANGUAGES.map(x=>x[0])));
 assert.equal(new Set(G.CONCEPTS.map(c=>c.id)).size,1026);
});
test('all 135,432 directed translations and round trips preserve the intended concept',()=>{
 let edges=0;
 for(const c of G.CONCEPTS)for(const source of G.LANGUAGES)for(const target of G.LANGUAGES){
  if(source===target)continue;
  const r=G.resolve(c.terms[source],source,target,c.id);
  assert.equal(r.status,'found',c.id+':'+source);assert.equal(r.back,c.meaningTerms?.[target]||c.terms[target]);assert.equal(r.conceptId,c.id);
  const reverse=G.resolve(r.back,target,source,c.id);assert.equal(reverse.back,c.meaningTerms?.[source]||c.terms[source]);edges++;
 }
 assert.equal(edges,135432);
});
test('all authored aliases resolve to the same sense',()=>{
 for(const c of G.CONCEPTS)for(const [lang,terms] of Object.entries(c.aliases))for(const term of terms)assert(G.lookup(term,lang).some(x=>x.id===c.id),c.id+' '+term);
});
test('every concept participates in one connected topic/semantic graph',()=>{
 const data=G.exportGraph(),adj=new Map(G.CONCEPTS.map(c=>[c.id,new Set()]));
 for(const e of data.conceptLinks){adj.get(e.from).add(e.to);adj.get(e.to).add(e.from);}
 const visited=new Set(),todo=[G.CONCEPTS[0].id];while(todo.length){const id=todo.pop();if(visited.has(id))continue;visited.add(id);todo.push(...adj.get(id));}
 assert.equal(visited.size,1026);assert.equal(data.nodes.length,12312);assert.equal(data.edges.length,135432);
 const ids=new Set(data.nodes.map(n=>n.id));assert(data.edges.every(e=>ids.has(e.from)&&ids.has(e.to)&&e.from!==e.to));
 assert.equal(new Set(data.edges.map(e=>e.from+'>'+e.to)).size,135432);
});
test('ambiguous light, orange, fish, and work never choose silently',()=>{
 for(const word of ['light','orange','fish','work','answer','help','cold']){
  const r=G.resolve(word,'en','fr');assert.equal(r.status,'ambiguous',word);assert(r.candidates.length>=2);
 }
});
test('non-English homographs remain sense-aware',()=>{
 assert.equal(G.resolve('ma\u00f1ana','es','en').status,'ambiguous');
 assert.equal(G.resolve('o','tr','en').status,'ambiguous');
 assert.equal(G.resolve('\u6708','ja','en').status,'ambiguous');
 assert.equal(G.resolve('\u95ee\u9898','zh-CN','en').status,'ambiguous');
});
test('no English-pivot fallback or unrequested translation of unknown words',()=>{
 assert.equal(G.resolve('unlisted-phrase-123','ar','ja').status,'missing');
 assert.equal(G.resolve('water','es','ar').status,'missing');
 assert.equal(G.translation('food.water','ar','ja').back,'\u6c34');
});
test('normalization handles punctuation, decomposed accents and Arabic vocalization',()=>{
 assert.equal(G.resolve('  WATER! ','en','es').conceptId,'food.water');
 assert.equal(G.resolve('cafe\u0301','fr','en').conceptId,'food.coffee');
 assert.equal(G.resolve('\u0634\u064f\u0643\u0652\u0631\u064b\u0627','ar','en').conceptId,'essentials.thanks');
 assert.equal(G.resolve('si','es','en').status,'missing');
 assert.equal(G.resolve('s\u00ed','es','en').conceptId,'essentials.yes');
});
test('Turkish case normalization uses the Turkish locale',()=>{
 assert.equal(G.resolve('\u0130S\u0130M','tr','en').conceptId,'essentials.name');
 assert.equal(G.resolve('I\u015eIK','tr','en').conceptId,'home.light');
});
test('lookup rejects same-language pairs, bad languages and wrong sense IDs',()=>{
 assert.throws(()=>G.translation('food.water','en','en'));
 assert.throws(()=>G.resolve('water','xx','en'));
 assert.equal(G.resolve('water','en','es','food.milk').status,'missing');
 assert.throws(()=>G.translation('fake.sense','en','es'));
});
test('search can discover all scripts but fuzzy search never becomes automatic translation',()=>{
 assert(G.search('agua','en','fr').some(c=>c.id==='food.water'));
 assert(G.search('cafe','fr','en').some(c=>c.id==='food.coffee'));
 assert.equal(G.resolve('cafe','fr','en').status,'missing');
 for(const category of Object.keys(G.CATEGORIES))assert.equal(G.search('','en','es',category).length,G.CONCEPTS.filter(c=>c.category===category).length);
});
test('each concept has all eleven target-language neighbors',()=>{
 for(const c of G.CONCEPTS)for(const source of G.LANGUAGES){const n=G.translationNeighbors(c.id,source);assert.equal(n.length,11);assert(n.every(x=>x.sourceLang!==x.targetLang));}
});
test('sense identity separates visually identical cards and preserves user edits',()=>{
 const a=G.translation('food.fish','en','de'),b=G.translation('animals.fish','en','de');
 assert.equal(a.front,b.front);assert.equal(a.back,b.back);assert.notEqual(C.identity(a),C.identity(b));
 assert.equal(C.identity(a),C.identity({...a,back:'My preferred wording',note:'private'}));
});
test('concept identity survives a full backup and reverse cards use independent directions',()=>{
 const c=C.newCard(G.translation('food.water','en','ar'));const reverse=C.reverseCard(c);
 assert.notEqual(C.identity(c),C.identity(reverse));assert.notEqual(c.id,reverse.id);
 const loaded=C.parseImport(C.backup([c],[],{}),{sourceLang:'en',targetLang:'ar'});
 assert.equal(loaded.cards[0].conceptId,c.conceptId);assert.equal(C.identity(loaded.cards[0]),C.identity(c));
});
test('share payload still excludes private notes, schedules and internal graph metadata',()=>{
 const c=C.newCard({...G.translation('food.water','ar','ja'),note:'secret'});
 assert.deepEqual(Object.keys(C.sharePayload(c).card).sort(),['back','context','front','sourceLang','targetLang']);
});
test('large translation cards are saved without silent truncation; sharing stays bounded',()=>{
 const c=C.newCard({front:'a'.repeat(2000),back:'b'.repeat(4000),sourceLang:'en',targetLang:'es'});
 assert.equal(c.back.length,4000);assert.throws(()=>C.sharePayload(c),/shorter/);
});
