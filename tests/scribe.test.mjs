import test from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../public/nabu-scribe.js';
import * as C from '../public/nabu-core.js';
import * as U from '../public/nabu-reading-ui.js';
test('twelve language codes retain the agreed distinct pair without changing locale settings',()=>{
 assert.deepEqual(Object.keys(S.COUNCIL).sort(),C.LANGUAGES.map(x=>x[0]).sort());
 assert.equal(new Set(Object.values(S.COUNCIL).flat()).size,24);
 assert.deepEqual(S.COUNCIL['zh-CN'],['Li Bai','Yuen Ren Chao']);assert.deepEqual(S.COUNCIL.ar,['Imru’ al-Qais','Sibawayh']);
});
test('brief explanations retain material uncertainty and custom correction priority',()=>{
 assert.match(S.uncertainty({back:'agua'}, {}, {back:'water for irrigation'}),/saved correction/);
 assert.match(S.uncertainty({back:'agua'}, {}, null),/not.*disambiguated/);
 assert.equal(S.status({front:'x',choices:[1,2]}).name,'uncertain');
 assert.equal(S.status({front:'x',back:'y',saving:true}).name,'working');
});
test('self critique is grounded in a defect and includes evidence and a repair',()=>{
 assert.equal(S.assessment({back:'hello'}),null);
 const a=S.assessment({saveError:'disk quota'});assert.equal(a.evidence,'disk quota');assert.match(a.repair,/Retry Save/);
});
test('repeated source expressions highlight only their exact selected occurrence',()=>{
 assert.equal(U.highlightContext('water and water','water',10),'water and <mark>water</mark>');
 assert.equal(U.highlightContext('<script> and ماء','ماء',13),'&lt;script&gt; and <mark>ماء</mark>');
});
