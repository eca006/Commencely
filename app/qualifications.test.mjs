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

test('graduate search accepts zero to three years and excludes explicit higher requirements', () => {
  assert.equal(read('Account Assistant', 'No experience required.').graduateFit, 'potential');
  assert.equal(read('Account Specialist', '3–5 years of experience required.').graduateFit, 'potential');
  assert.equal(read('Account Specialist', '2 years of sales experience preferred. 5 years of work experience required.').graduateFit, 'outside');
  assert.equal(read('Senior Account Manager', '2 years of experience required.').graduateFit, 'outside');
  assert.equal(read('Junior Accountant', '').graduateFit, 'potential');
  assert.equal(read('Account Assistant', 'A degree in business.').graduateFit, 'unclear');
});

test('full qualifications can override a senior title when the stated minimum is within range', () => {
  assert.equal(read('Sr. Sales Analyst', '2-3 years of related experience.', { full: true }).graduateFit, 'potential');
  assert.equal(read('Senior Director', '2-3 years of related experience.', { full: true }).graduateFit, 'outside');
  assert.equal(read('Sr. Sales Analyst', '2 years preferred. 5 years of experience required.', { full: true }).graduateFit, 'outside');
});

test('a higher listed minimum excludes a posting with a separate lower experience figure', () => {
  const result = read('Fire Alarm Project Manager', '5+ years of project management experience. 3–4 years of fire alarm experience.', { full: true });
  assert.equal(result.graduateFit, 'outside');
});

test('zero experience requires a clear zero minimum and excludes conflicting minimums', () => {
  const full = { full: true };
  assert.equal(read('Assistant', 'No previous work experience is necessary.').zeroExperience, true);
  assert.equal(read('Assistant', 'Experience is not required.').zeroExperience, true);
  assert.equal(read('Assistant', 'No experience necessary — we’ll train you.').zeroExperience, true);
  assert.equal(read('Assistant', '0–1 years of experience required.').zeroExperience, true);
  assert.equal(read('Assistant', '0–2 years of experience.', full).zeroExperience, true);
  assert.equal(read('Logistics Specialist I', '0–1 years of related experience in Transportation, Logistics, Supply Chain, Customer Service, or a similar operational environment.', full).zeroExperience, true);
  assert.equal(read('Assistant', '0–2 years of experience preferred.', full).zeroExperience, false);
  assert.equal(read('Assistant', 'No experience required. Two years of sales experience required.', full).zeroExperience, false);
  assert.equal(read('Entry-level assistant', 'Training provided.').zeroExperience, false);
});

 test('basic field-list experience cannot be overridden by shorter leadership experience', () => {
  const result = read('Associate Manager of Operations', 'Basic Qualifications\n4+ years of relevant transportation, logistics, or supply chain experience.\n2+ years of leadership experience.\nPreferred Qualifications\n6 years of experience in operations.', { full: true });
  assert.equal(result.graduateFit, 'outside');
  assert.deepEqual(result.experience.map(item => item.status), ['required', 'required', 'preferred']);
  assert.equal(result.experience[0].years, '4+ years');
  assert.equal(read('Analyst', 'Business degree or 2 years of accounting experience required.', { full: true }).experience[0].status, 'unclear');
});
