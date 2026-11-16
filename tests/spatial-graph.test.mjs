import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../public/nabu-graph.js';
import * as S from '../public/nabu-spatial-graph.js';

test('2D map defaults to five prioritized translations and supports all eleven',()=>{
 const c=G.concept('essentials.hello');
 const compact=S.scene(c,G.LANGUAGES,G.related(c.id,6),'en','es');
 const expanded=S.scene(c,G.LANGUAGES,G.related(c.id,6),'en','es',{expanded:true});
 assert.equal(compact.nodes.filter(n=>n.kind==='concept').length,1);
 assert.equal(compact.nodes.filter(n=>n.kind==='language').length,5);
 assert.equal(expanded.nodes.filter(n=>n.kind==='language').length,11);
 assert.equal(compact.nodes.find(n=>n.kind==='language').lang,'es');
 assert.equal(compact.nodes.filter(n=>n.kind==='usage').length,3);
 assert.ok(compact.nodes.filter(n=>n.kind==='related').length<=4);
 assert.ok(compact.links.every(e=>compact.nodes.some(n=>n.id===e.to)));
});
test('Russian idiom has meaningful grammatical components, not arbitrary nearby phrases',()=>{
 const c=G.concept('expressions.fly_elephant');
 const view=S.scene(c,G.LANGUAGES,G.related(c.id,6),'ru','en');
 assert.equal(view.hasComponents,true);
 assert.deepEqual(view.nodes.filter(n=>n.kind==='component').map(n=>n.label),['делать','из','мухи','слона']);
 assert.ok(view.nodes.filter(n=>n.kind==='component').every(n=>n.sub));
 assert.equal(view.nodes.find(n=>n.id==='language:en').label,'Exaggerate a small problem.');
});
test('2D coordinates are readable and 3D projection responds to rotation and tilt',()=>{
 const n={x:170,y:40,z:190};
 assert.deepEqual(S.project2D(n),{x:170,y:40,depth:0});
 const a=S.project3D(n,28,28),b=S.project3D(n,55,45);
 assert.ok(Number.isFinite(a.x)&&Number.isFinite(a.y));
 assert.notEqual(a.x,b.x);
 assert.notEqual(a.y,b.y);
});
test('graph palette preserves Nabu greens, lime and sand',()=>{
 assert.equal(S.PALETTE.green,'#24624f');
 assert.equal(S.PALETTE.lime,'#dbe9ba');
 assert.equal(S.PALETTE.sand,'#f0eade');
});
