import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../public/nabu-graph.js';
import * as F from '../public/nabu-feature-tree.js';

test('transliteration is available for non-Latin-script terms',()=>{
  const ar=G.translation('essentials.thanks','ar','en');
  const ru=G.translation('essentials.thanks','ru','en');
  assert.equal(typeof ar.sourceTransliteration,'string');
  assert.equal(typeof ru.sourceTransliteration,'string');
  assert.ok(ar.sourceTransliteration.length>0);
  assert.ok(ru.sourceTransliteration.length>0);
});

test('compose can concatenate known terms without pretending to be a full sentence translator',()=>{
  const result=G.compose('water book','en','es');
  assert.equal(result.status,'found');
  assert.equal(result.direct,false);
  assert.equal(result.back,'agua libro');
  assert.equal(result.segments.length,2);
  assert.deepEqual(result.segments.map(s=>s.status),['found','found']);
});

test('compose reports unknown or ambiguous segments explicitly',()=>{
  const result=G.compose('light xyz','en','fr');
  assert.equal(result.status,'partial');
  assert.ok(result.ambiguousCount>=1 || result.unresolvedCount>=1);
  assert.ok(result.back.includes('['));
});

test('feature decision tree exports a connected rooted tree',()=>{
  const graph=F.exportFeatureTree();
  const stats=F.featureTreeStats();
  assert.equal(graph.nodes.length,stats.nodes);
  assert.equal(graph.edges.length,stats.edges);
  assert.equal(graph.nodes.find(n=>n.id==='root').depth,0);
  assert.ok(stats.leaves>=1);
  const ids=new Set(graph.nodes.map(n=>n.id));
  graph.edges.forEach(edge=>{assert.ok(ids.has(edge.from));assert.ok(ids.has(edge.to));});
});


test('unfinished or ambiguous composition cannot auto-save into the library',()=>{
 assert.equal(G.compositionCanSave(G.compose('water xyz','en','es')),false);
 assert.equal(G.compositionCanSave(G.compose('light water','en','es')),false);
 assert.equal(G.compositionCanSave(G.compose('water book','en','es')),true);
 assert.equal(G.compositionCanSave(null),false);
 assert.equal(G.compositionCanSave({status:'found',segments:[]}),false);
});
