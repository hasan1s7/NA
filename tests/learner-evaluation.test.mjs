import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runLearnerEvaluation, renderLearnerEvaluation, logisticNormalReference } from '../tools/evaluate_learner.mjs';

let cached;
const report = () => cached ??= runLearnerEvaluation();
function withoutTimings(value) {
  if (Array.isArray(value)) return value.map(withoutTimings);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([key]) => !['milliseconds','totalMilliseconds'].includes(key)).map(([key,v]) => [key,withoutTimings(v)]));
  return value;
}

test('independent quadrature respects symmetry and shifts with successes', () => {
  const prior=logisticNormalReference({successes:0,failures:0}),balanced=logisticNormalReference({successes:5,failures:5}),successful=logisticNormalReference({successes:8,failures:2});
  assert.ok(Math.abs(prior.mean-.5)<1e-10);
  assert.ok(Math.abs(balanced.mean-.5)<1e-10);
  assert.ok(balanced.variance<prior.variance);
  assert.ok(successful.mean>.65&&successful.mean<.8);
  assert.ok(successful.lower<successful.mean&&successful.upper>successful.mean);
});

test('evaluation emits actual checked numerical decisions and posterior outputs', () => {
  const result=report();
  assert.equal(result.checks.passed,true,JSON.stringify(result.checks));
  assert.equal(result.decisionCases.length,8);
  const profitable=result.decisionCases.find(c=>c.id==='profitable-diagnostic');
  assert.ok(Math.abs(profitable.observed.evsi-.5)<1e-10);
  assert.ok(Math.abs(profitable.observed.netValue-.4)<1e-10);
  assert.equal(result.numericalReference.passed,true);
  assert.ok(result.numericalReference.absoluteErrors.mean<.025);
  assert.ok(result.fitDiagnostics.every(f=>f.draws>0&&f.parameters>0&&f.milliseconds>=0));
  assert.equal(result.actualPosteriorDecision.primary.learningGain,null);
  assert.equal(result.actualPosteriorDecision.primary.retentionGain,null);
  assert.match(result.scope,/No human learners/u);
});

test('the cross-language report retains local vocabulary uncertainty and opposing evidence', () => {
  const scenarios=report().posteriorScenarios;
  assert.ok(scenarios.arabicReadingEvidence.ar.mean>scenarios.prior.ar.mean);
  assert.ok(scenarios.opposingSpanishEvidence.es.mean<scenarios.arabicReadingEvidence.es.mean);
  assert.equal(scenarios.arabicReadingEvidence.vocabulary.directCount,0);
  assert.equal(scenarios.arabicReadingEvidence.vocabulary.priorOnly,true);
  assert.ok(scenarios.arabicReadingEvidence.vocabulary.upper>scenarios.arabicReadingEvidence.vocabulary.lower);
  assert.ok(scenarios.elapsedTime.after30Days.mean<=scenarios.elapsedTime.now.mean);
});

test('identical seeds reproduce numerical records while observed wall time may differ', () => {
  const repeated=runLearnerEvaluation({seed:report().seed});
  assert.deepEqual(withoutTimings(repeated),withoutTimings(report()));
});

test('the Markdown companion includes quantitative results, reproducibility, and limits', () => {
  const text=renderLearnerEvaluation(report());
  assert.match(text,/\| profitable-diagnostic \| probe \| 0.3 \| 0.5 \| 0.4 \| Pass \|/u);
  assert.match(text,/Independent numerical reference/u);
  assert.match(text,/--seed 140015/u);
  assert.match(text,/All observations in this report are synthetic/u);
  assert.match(text,/Brier score/u);
  assert.match(text,/Converged/u);
  assert.equal(text.includes('undefined'),false);
  assert.equal(text.includes('NaN'),false);
});

test('CLI writes complete parseable JSON and Markdown output', async () => {
  const directory=await mkdtemp(join(tmpdir(),'nabu-learner-evaluation-'));
  try {
    const output=join(directory,'report.json');
    const cli=fileURLToPath(new URL('../tools/evaluate_learner.mjs',import.meta.url));
    const child=spawnSync(process.execPath,[cli,'--seed','140015','--output',output],{encoding:'utf8',timeout:30000});
    assert.equal(child.status,0,child.stderr||child.stdout);
    const files=JSON.parse(child.stdout),saved=JSON.parse(await readFile(output,'utf8'));
    assert.equal(files.jsonPath,output);
    assert.equal(saved.checks.passed,true);
    assert.ok((await readFile(files.markdownPath,'utf8')).startsWith('# Nabu learner model:'));
  } finally { await rm(directory,{recursive:true,force:true}); }
});

test('evaluation work settings are bounded and invalid inputs fail before inference', () => {
  for (const settings of [{seed:-1},{seed:2**32},{samples:63},{samples:1025},{burnIn:63},{burnIn:1025}]) assert.throws(()=>runLearnerEvaluation(settings),/integer/u);
  assert.throws(()=>logisticNormalReference({steps:101}),/even/u);
  assert.throws(()=>logisticNormalReference({successes:-1}),/integer/u);
});
