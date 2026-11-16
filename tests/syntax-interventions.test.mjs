import test from 'node:test';
import assert from 'node:assert/strict';
import * as Syntax from '../public/nabu-syntax.js';

test('finds authored English, Spanish and Arabic ambiguity cases', () => {
  assert.equal(Syntax.findCase('The researcher photographed the student with the telescope.', 'en')?.id, 'en-pp-telescope-1');
  assert.equal(Syntax.findCase('La investigadora fotografió al estudiante con el telescopio.', 'es')?.id, 'es-pp-telescopio-1');
  assert.equal(Syntax.findCase('صوّر الباحث الطالب بالمنظار.', 'ar')?.id, 'ar-pp-telescope-1');
  assert.equal(Syntax.findCase('A completely unrelated sentence.', 'en'), null);
});

test('posterior begins unresolved and movement shifts toward VP attachment', () => {
  const item = Syntax.CASES.find(x => x.id === 'en-pp-telescope-1');
  assert.deepEqual(Syntax.posterior(item, []).map(x => Number(x.toFixed(3))), [0.5,0.5]);
  const p = Syntax.posterior(item, ['movement']);
  assert.ok(p[1] > 0.75, `expected instrumental posterior > .75, got ${p[1]}`);
});

test('substitution supports NP analysis while coordination stays weak', () => {
  const item = Syntax.CASES.find(x => x.id === 'en-pp-telescope-1');
  const substitution = Syntax.posterior(item, ['substitution']);
  assert.ok(substitution[0] > substitution[1]);
  const coordination = Syntax.posterior(item, ['coordination']);
  assert.ok(Math.abs(coordination[0]-coordination[1]) < 0.05);
});

test('active selector chooses an informative unused diagnostic', () => {
  const item = Syntax.CASES.find(x => x.id === 'en-pp-telescope-1');
  const first = Syntax.nextDiagnostic(item, []);
  assert.equal(first.diagnostic.id, 'movement');
  const second = Syntax.nextDiagnostic(item, ['movement']);
  assert.notEqual(second.diagnostic.id, 'movement');
  assert.ok(second.information >= 0);
});

test('entropy falls when a separating diagnostic is observed', () => {
  const item = Syntax.CASES.find(x => x.id === 'en-pp-telescope-1');
  const h0 = Syntax.entropy(Syntax.posterior(item, []));
  const h1 = Syntax.entropy(Syntax.posterior(item, ['movement']));
  assert.ok(h1 < h0);
});
