import test from 'node:test';
import assert from 'node:assert/strict';
import { qualificationEvidence as read } from './qualifications.mjs';
test('distinguishes explicit required and preferred experience with evidence', () => {
  const result = read('Assistant', 'Two years of experience required. Sales experience preferred.');
  assert.deepEqual(result.experience.map(item => item.status), ['required', 'preferred']);
  assert.equal(result.experience[0].evidence, 'Two years of experience required.');
});
test('does not turn preferred minimum, alternatives, negation or truncation into a requirement', () => {
  for (const text of ['Minimum 2 years experience preferred.', 'Associate degree or office experience (minimum 2 years preferred).', 'No experience required.', 'Two years of experience required unless...', 'Experience required or equivalent education.']) {
    assert.equal(read('', text).experience[0].status, 'unclear');
  }
});
test('flags entry-level with years only as review and leaves missing evidence unknown', () => {
  assert.equal(read('Entry-level analyst', '2+ years of experience preferred.').experienceFlag, true);
  assert.equal(read('Analyst', '2 years experience required.').experienceFlag, false);
  assert.equal(read('Entry-level analyst', 'Training provided.').experienceFlag, false);
  assert.deepEqual(read('', '').experience, []);
  assert.equal(read('', 'Experience with spreadsheets.').experience[0].status, 'unclear');
  assert.deepEqual(read('', 'Creating an extraordinary experience for customers. We provide hands-on field experience that will stimulate you.').experience, []);
});
