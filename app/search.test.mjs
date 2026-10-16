import test from 'node:test';
import assert from 'node:assert/strict';
import { filterDirection, directionSearch } from './search.mjs';
test('operations excludes observed nursing false positive and keeps business titles', () => {
  const data = { count: 100, results: ['Travel OR Circulator RN - $1,944 per week', 'Operations Manager', 'Business Operations Coordinator', 'Clinical Operations Coordinator', 'Marketing Intern'].map(title => ({title})) };
  const filtered = filterDirection(data, 'operations');
  assert.deepEqual(filtered.results.map(job => job.title), ['Operations Manager', 'Business Operations Coordinator']);
  assert.equal(filtered.reviewed, 5);
  assert.equal(filtered.removed, 3);
  assert.equal(filtered.count, 100);
});
test('each career requires a relevant title and does not infer qualification', () => {
  const raw = {results: [{title:'Product Marketing Intern'}, {title:'Sales Representative'}, {title:'Registered Nurse'}, {description:'marketing sales operations'}]};
  assert.deepEqual(filterDirection(raw, 'marketing').results.map(job => job.title), ['Product Marketing Intern']);
  assert.deepEqual(filterDirection(raw, 'sales').results.map(job => job.title), ['Sales Representative']);
  assert.equal(directionSearch('operations'), 'operations');
  assert.equal(directionSearch('invalid'), undefined);
  assert.throws(() => filterDirection(raw, 'invalid'));
});
