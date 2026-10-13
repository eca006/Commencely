import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeJobs } from './jobs.mjs';
test('excludes salary and private fields and blocks unsafe listing links', () => {
  const result = normalizeJobs({ count: 1, results: [{ title: 'Marketing', redirect_url: 'javascript:alert(1)', salary_min: 100, app_key: 'secret' }] });
  assert.equal(result.jobs[0].link, null);
  assert.equal(result.jobs[0].company, 'Company not listed');
  assert.ok(!JSON.stringify(result).includes('secret'));
  assert.ok(!JSON.stringify(result).includes('salary'));
});
test('retains listing links and handles empty searches', () => {
  assert.deepEqual(normalizeJobs({ count: 0, results: [] }), { count: 0, jobs: [] });
  assert.equal(normalizeJobs({ results: [{ redirect_url: 'https://www.adzuna.com/jobs/1' }] }).jobs[0].link, 'https://www.adzuna.com/jobs/1');
  assert.throws(() => normalizeJobs({}));
});
