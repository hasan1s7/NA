import test from 'node:test';
import assert from 'node:assert/strict';
import { selectLearnerDecision, DEFAULT_COST_PER_SECOND } from '../public/nabu-learner-policy.js';

const NOW = 1_000;
const close = (actual, expected, tolerance = 1e-10) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}`);
const task = (id, ids = ['root', 'pattern']) => ({id, version:1, language:'ar', mode:'recognition', components:ids.map(id => ({id, kind:id === 'root' ? 'root' : 'pattern'}))});
function fixture(overrides = {}) {
  const fit = {
    version:'test-joint-posterior', now:NOW,
    tasks:[task('target'), task('probe', ['pattern'])],
    samples:[{state:'root-gap'}, {state:'pattern-gap'}], sampleWeights:[.5, .5],
    scope:{actor:{kind:'local', id:'learner-a'}, persistence:'session'},
    diagnostics:{usable:true, inferenceStatus:'approximate-posterior', converged:true, warnings:[]},
    dataSummary:{acceptedObservations:12},
    ...overrides,
  };
  const actions = [
    {id:'root-help', kind:'support', taskId:'target', providedComponentIds:['root'], cost:.2, supportText:'The supplied root means write.'},
    {id:'pattern-help', kind:'support', taskId:'target', providedComponentIds:['pattern'], cost:.2},
    {id:'probe', kind:'diagnostic', taskId:'probe', cost:.1},
  ];
  const predictor = (_fit, t, {providedComponentIds}) => {
    if (t.id === 'probe') return [1, 0];
    if (providedComponentIds.includes('root')) return [1, 0];
    if (providedComponentIds.includes('pattern')) return [0, 1];
    return [0, 0];
  };
  return {fit, actions, predictor, targets:[{taskId:'target', weight:1}], now:NOW, constraints:{costPerSecond:0}};
}
function freeze(value) {
  if (value && typeof value === 'object') { Object.freeze(value); for (const v of Object.values(value)) freeze(v); }
  return value;
}
const candidate = (result, id) => result.candidates.find(c => c.id === id);

test('a diagnostic is selected only for a profitable change in downstream action', () => {
  const result = selectLearnerDecision(fixture());
  assert.equal(result.primary.id, 'probe');
  close(result.bestTerminal.expectedLoss, .7);
  close(result.primary.evsi, .5);
  close(result.primary.expectedDownstreamLoss, .2);
  close(result.primary.expectedLoss, .3);
  close(result.primary.netValue, .4);
  close(result.primary.predictiveCorrect, .5);
  assert.deepEqual(result.primary.branches.map(b => [b.outcome, b.probability, b.bestActionId]), [
    ['correct', .5, 'root-help'], ['incorrect', .5, 'pattern-help'],
  ]);
  assert.equal(result.primary.learningGain, null);
  assert.equal(result.primary.retentionGain, null);
  assert.equal(candidate(result, 'root-help').supportText, 'The supplied root means write.');
  assert.equal(result.candidates.filter(c => c.recommended).length, 1);
  assert.match(result.assumptions.diagnosticAssumption,/histories are held fixed/u);
  assert.match(result.assumptions.diagnosticAssumption,/real accepted response updates histories on refit/u);
});

test('likelihoods with guessing reweight the whole joint posterior instead of classifying it', () => {
  const input = fixture(), original = input.predictor;
  input.predictor = (...args) => args[1].id === 'probe' ? [.8, .2] : original(...args);
  const result = selectLearnerDecision(input);
  close(result.primary.evsi, .3);
  close(result.primary.expectedDownstreamLoss, .4);
  close(result.primary.expectedLoss, .5);
  close(result.primary.netValue, .2);
  close(result.primary.branches[0].posteriorEffectiveSampleSize, 1 / (.8 ** 2 + .2 ** 2));
});

test('an informative response has zero EVSI when the optimal action never changes', () => {
  const input = fixture();
  input.actions.push({id:'complete-help', kind:'support', taskId:'target', providedComponentIds:['root', 'pattern'], cost:.05});
  const original = input.predictor;
  input.predictor = (...args) => args[2].providedComponentIds.length === 2 ? [1, 1] : original(...args);
  const result = selectLearnerDecision(input), check = candidate(result, 'probe');
  assert.equal(result.primary.id, 'complete-help');
  close(check.evsi, 0);
  assert.equal(check.canChangeDecision, false);
  assert.equal(check.decisionRelevant, false);
  assert.equal(check.recommended, false);
});

test('an uninformative diagnostic receives no value for merely being an available exercise', () => {
  const input = fixture(), original = input.predictor;
  input.predictor = (...args) => args[1].id === 'probe' ? [.5, .5] : original(...args);
  const result = selectLearnerDecision(input);
  close(candidate(result, 'probe').evsi, 0);
  close(candidate(result, 'probe').netValue, -.1);
  assert.equal(result.primary.kind, 'support');
});

test('a known gap makes direct support preferable to another diagnostic', () => {
  const result = selectLearnerDecision(fixture({sampleWeights:[1, 0]}));
  assert.equal(result.primary.id, 'root-help');
  close(result.primary.expectedLoss, .2);
  close(candidate(result, 'probe').evsi, 0);
  const impossible = candidate(result, 'probe').branches.find(b => b.probability === 0);
  assert.equal(impossible.bestActionId, null);
  assert.equal(impossible.expectedLoss, null);
});

test('information must pay for its cost and the explicit minimum net improvement', () => {
  const input = fixture(); input.actions.at(-1).cost = .5;
  const breakEven = selectLearnerDecision(input);
  close(candidate(breakEven, 'probe').netValue, 0);
  assert.equal(breakEven.primary.kind, 'support');
  input.actions.at(-1).cost = .49;
  assert.equal(selectLearnerDecision(input).primary.id, 'probe');
  input.constraints.minimumDiagnosticNetValue = .02;
  assert.equal(selectLearnerDecision(input).primary.kind, 'support');
});

test('no-practice blocks diagnostics even if a caller tries to mark them as nonpractice', () => {
  const input = fixture(); input.constraints.avoidPractice = true;
  input.actions.at(-1).requiresPractice = false;
  const result = selectLearnerDecision(input);
  assert.equal(result.primary.kind, 'support');
  assert.equal(candidate(result, 'probe').available, false);
  assert.match(candidate(result, 'probe').blockedReasons.join(' '), /excluded practice/u);
  assert.equal(candidate(result, 'continue').available, true);
});

test('budget applies to the diagnostic and its subsequent action together', () => {
  const input = fixture(); input.constraints.timeBudgetSeconds = 3;
  for (const action of input.actions) action.seconds = 2;
  const result = selectLearnerDecision(input), check = candidate(result, 'probe');
  assert.equal(result.primary.kind, 'support');
  close(check.evsi, 0);
  close(check.delayAndConstraintPenalty, .3);
  close(check.netValue, -.4);
  assert.ok(check.branches.every(b => b.bestActionId === 'continue'));
  input.actions.at(-1).seconds = 4;
  assert.equal(candidate(selectLearnerDecision(input), 'probe').available, false);
});

test('the diagnostic can have positive EVSI but lose because of forecast delay', () => {
  const input = fixture(), original = input.predictor;
  input.actions.at(-1).seconds = 10; input.actions.at(-1).cost = .2;
  input.predictor = (...args) => {
    const values = original(...args);
    return args[1].id === 'target' && args[2].now > NOW ? values.map(p => p * .6) : values;
  };
  const result = selectLearnerDecision(input), check = candidate(result, 'probe');
  close(check.evsi, .3);
  close(check.delayAndConstraintPenalty, .2);
  close(check.expectedLoss, .8);
  close(check.netValue, -.1);
  assert.equal(result.primary.kind, 'support');
});

test('two goal decisions retain covariance through the shared posterior sample index', () => {
  const fit = fixture().fit;
  fit.tasks = [task('a', ['a-root']), task('b', ['b-root']), task('probe', ['pattern'])];
  fit.samples = [{}, {}, {}, {}]; fit.sampleWeights = [1, 1, 1, 1];
  const input = {
    fit, now:NOW, targets:[{taskId:'a'}, {taskId:'b'}], constraints:{costPerSecond:0},
    actions:[
      {id:'help-a', kind:'support', taskId:'a', providedComponentIds:['a-root'], cost:.1},
      {id:'help-b', kind:'support', taskId:'b', providedComponentIds:['b-root'], cost:.1},
      {id:'probe', kind:'diagnostic', taskId:'probe', cost:.05},
    ],
    predictor:(_fit, t, options) => t.id === 'probe' ? [1, 0, 1, 0] : options.providedComponentIds.length ? [1, 1, 1, 1] : t.id === 'a' ? [0, 1, 0, 1] : [1, 0, 1, 0],
  };
  const linked = selectLearnerDecision(input);
  assert.equal(linked.primary.id, 'probe');
  close(linked.primary.evsi, .25);
  close(linked.primary.expectedLoss, .15);
  assert.deepEqual(linked.primary.branches.map(b => b.bestActionId), ['help-a', 'help-b']);
  const original = input.predictor;
  input.predictor = (...args) => args[1].id === 'probe' ? [1, 1, 0, 0] : original(...args);
  const independent = selectLearnerDecision(input);
  close(candidate(independent, 'probe').predictiveCorrect, .5);
  close(candidate(independent, 'probe').evsi, 0);
  assert.equal(independent.primary.kind, 'support');
});

test('support affects only the explicit tasks and goal weights set the loss', () => {
  const input = fixture(); input.fit.tasks.push(task('second'));
  input.targets = [{taskId:'target', weight:3}, {taskId:'second', weight:1}];
  input.actions = [{id:'help', kind:'support', taskId:'target', providedComponentIds:['root']}];
  input.predictor = (_f, _t, opts) => opts.providedComponentIds.length ? [1, 1] : [0, 0];
  const result = selectLearnerDecision(input);
  close(result.primary.expectedLoss, .25);
  assert.deepEqual(result.primary.targetPredictions.map(p => [p.taskId, p.providedComponentIds]), [['target', ['root']], ['second', []]]);
  assert.deepEqual(result.targets.map(t => t.normalizedWeight), [.75, .25]);
});

test('unsupported components and unavailable support cannot bypass requirements', () => {
  const input = fixture(); input.actions = [
    {id:'invalid', kind:'support', taskId:'target', providedComponentIds:['imagined-skill']},
    {id:'missing', kind:'support', taskId:'target', providedComponentIds:['root'], available:false},
    {id:'empty', kind:'support', taskId:'target'},
  ];
  const result = selectLearnerDecision(input);
  assert.equal(result.primary.id, 'continue');
  assert.ok(result.candidates.filter(c => c.kind !== 'continue').every(c => c.available === false));
});

test('nonuniform weights are normalized without mutating caller data or scope', () => {
  const input = fixture({sampleWeights:[2, 6]});
  const before = structuredClone({...input, predictor:undefined});
  freeze(input.fit); freeze(input.actions); freeze(input.targets); freeze(input.constraints);
  const result = selectLearnerDecision(input);
  close(candidate(result, 'probe').predictiveCorrect, .25);
  close(candidate(result, 'pattern-help').expectedLoss, .45);
  close(candidate(result, 'probe').netValue, .15);
  close(result.trace.posteriorEffectiveSampleSize, 1 / (.25 ** 2 + .75 ** 2));
  assert.deepEqual({...input, predictor:undefined}, before);
  assert.deepEqual(result.trace.scope, input.fit.scope);
  assert.notEqual(result.trace.scope, input.fit.scope);
  result.trace.scope.persistence = 'changed-output-only';
  assert.equal(input.fit.scope.persistence, 'session');
});

test('Continue is available for absent evidence, unknown targets, and empty goals', () => {
  for (const changes of [
    {fit:null}, {fit:{...fixture().fit, samples:[]}},
    {fit:{...fixture().fit, diagnostics:{usable:false}}},
    {targets:[{taskId:'not-authored'}]}, {targets:[]},
  ]) {
    const result = selectLearnerDecision({...fixture(), ...changes});
    assert.equal(result.primary.id, 'continue');
    assert.equal(result.primary.available, true);
    assert.equal(result.primary.expectedLoss, null);
    assert.ok(['no-target', 'unavailable'].includes(result.status));
  }
  const input = fixture(); input.actions = [{id:'go', kind:'continue', available:false}];
  const result = selectLearnerDecision(input);
  assert.equal(result.primary.id, 'go');
  assert.equal(result.primary.available, true);
});

test('prior and bounded inference remain visible and unconverged diagnostics are withheld', () => {
  const prior = fixture(); prior.fit.diagnostics.inferenceStatus = 'prior-only';
  assert.equal(selectLearnerDecision(prior).status, 'prior-only');
  const bounded = fixture(); bounded.fit.diagnostics.converged = false;
  bounded.fit.diagnostics.truncated = true;
  const result = selectLearnerDecision(bounded);
  assert.equal(result.status, 'bounded');
  assert.equal(result.primary.kind, 'support');
  assert.equal(candidate(result, 'probe').available, false);
  assert.match(result.uncertainty.warnings.join(' '), /convergence/u);
});

test('zero improvement prefers Continue and authored seconds have visible utility units', () => {
  const input = fixture(); input.actions = [{id:'costly-help', kind:'support', taskId:'target', providedComponentIds:['root'], seconds:2}];
  input.constraints = {}; input.predictor = () => [.7, .7];
  const result = selectLearnerDecision(input);
  assert.equal(result.primary.id, 'continue');
  close(candidate(result, 'costly-help').effortCost, 2 * DEFAULT_COST_PER_SECOND);
  close(candidate(result, 'costly-help').expectedLoss, .3 + 2 * DEFAULT_COST_PER_SECOND);
  input.actions[0].seconds = 0;
  assert.equal(selectLearnerDecision(input).primary.id, 'continue');
});

test('invalid probabilities, weights, parameters, and effects fail explicitly', () => {
  const original = fixture();
  for (const sampleWeights of [[0, 0], [-1, 2], [1], [Infinity, 1]]) {
    assert.throws(() => selectLearnerDecision({...original, fit:{...original.fit, sampleWeights}}), /weight|mass|length/iu);
  }
  for (const probabilities of [[1.1, .2], [NaN, .2], [.2]]) {
    assert.throws(() => selectLearnerDecision({...original, predictor:() => probabilities}), /probability|predictor/iu);
  }
  assert.throws(() => selectLearnerDecision({...original, now:NaN}), /timestamp/u);
  assert.throws(() => selectLearnerDecision({...original, constraints:{costPerSecond:-1}}), /finite/u);
  assert.throws(() => selectLearnerDecision({...original, constraints:{avoidPractice:'yes'}}), /boolean/u);
  assert.throws(() => selectLearnerDecision({...original, targets:[{taskId:'target', weight:-1}]}), /weight/iu);
  assert.throws(() => selectLearnerDecision({...original, actions:[{id:'go', kind:'continue', cost:1}]}), /Continue/u);
  assert.throws(() => selectLearnerDecision({...original, actions:[{id:'d', kind:'diagnostic'}, {id:'d', kind:'diagnostic'}]}), /unique/u);
});

test('response branches form a probability distribution and the result serializes cleanly', () => {
  const result = selectLearnerDecision(fixture({sampleWeights:[Number.MAX_VALUE, Number.MAX_VALUE]}));
  close(candidate(result, 'probe').branches.reduce((sum, b) => sum + b.probability, 0), 1);
  assert.equal(result.constraints.timeBudgetSeconds, null);
  assert.equal(JSON.stringify(result).includes('NaN'), false);
  assert.deepEqual(JSON.parse(JSON.stringify(result)).primary, result.primary);
});

test('the combined decision work budget is checked before allocating predictions', () => {
  const input=fixture();
  input.fit.tasks=[...Array.from({length:32},(_,i)=>task('target-'+i)),task('probe',['pattern'])];
  input.fit.samples=Array.from({length:128},()=>({})); input.fit.sampleWeights=Array(128).fill(1);
  input.targets=Array.from({length:32},(_,i)=>({taskId:'target-'+i}));
  input.actions=Array.from({length:31},(_,i)=>({id:'help-'+i,kind:'support',taskId:'target-'+i,providedComponentIds:['root']}));
  input.actions.push(...Array.from({length:31},(_,i)=>({id:'probe-'+i,kind:'diagnostic',taskId:'probe'})));
  input.predictor=()=>{ throw Error('The predictor should not be called after the work-bound check.'); };
  const result=selectLearnerDecision(input);
  assert.equal(result.primary.id,'continue');
  assert.equal(result.status,'unavailable');
  assert.match(result.primary.reason,/work budget/u);
});
