import test from 'node:test';
import assert from 'node:assert/strict';
import { recommend, validAnswers } from './public/careers.js';
test('each answer contributes to its direction and explanations reflect actual choices', () => {
  const result = recommend({ interest: 'sales', strength: 'marketing', task: 'sales' });
  assert.equal(result[0].id, 'sales');
  assert.equal(result[0].score, 2);
  assert.equal(result[1].score, 1);
  assert.equal(result[2].score, 0);
  assert.match(result[0].explanation, /customer/);
  assert.match(result[2].explanation, /None of your answers/);
});
test('ties retain equal scores and incomplete profiles are rejected', () => {
  assert.deepEqual(recommend({ interest: 'marketing', strength: 'sales', task: 'operations' }).map(career => career.score), [1, 1, 1]);
  assert.equal(validAnswers(null), false);
  assert.throws(() => recommend({ interest: 'marketing' }));
});
