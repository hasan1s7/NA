import test from 'node:test';
import assert from 'node:assert/strict';
import {LANGUAGES} from '../public/nabu-core.js';
import {MOMENT_SCENES, sceneByLanguage} from '../public/nabu-moments.js';
import {supportTask, supportAnalysis} from '../public/nabu-support-tasks.js';
import {scoreSupportResponse} from '../public/nabu-support-cycle.js';

test('guided first use covers the canonical supported-language registry exactly',()=>{
  assert.deepEqual(MOMENT_SCENES.map(s=>s.language).sort(),LANGUAGES.map(([code])=>code).sort());
  assert.equal(new Set(MOMENT_SCENES.map(s=>s.key)).size, LANGUAGES.length);
});

for(const [language, label] of LANGUAGES) test(`${label}: original and changed scenes have bounded, independently keyed scoring`,()=>{
  const scene=sceneByLanguage(language);
  assert(scene, 'Missing first-use language');
  assert(scene.source.includes(scene.phrase), 'Help must anchor to an actual phrase');
  assert.notEqual(scene.source,scene.nextSource, 'Variation must change the scene');
  const [first,next]=['first','next'].map(stage=>supportTask(`moment-task:${scene.key}:${stage}`));
  assert.notEqual(first.mediaRef.id,next.mediaRef.id);
  for(const task of [first,next]) {
    assert.equal(task.language,language);
    assert.equal(task.condition.variety,scene.variety);
    assert(task.meaning && task.prompt);
    const analysis=supportAnalysis(task.analysisRef);
    assert.equal(analysis.weightsProvisional,true);
    assert.equal(new Set(task.options).size,3);
    const help=task.supports.find(s=>s.id==='translation');
    assert.equal(help.visibility,'hidden');
    assert.equal(help.type,language==='en'?'paraphrase':'translation');
    for(let choice=0;choice<task.options.length;choice++) {
      assert.equal(scoreSupportResponse(task,analysis,{choice}).outcome,
        choice===task.correctChoice?'correct':'incorrect');
    }
  }
});
