import test from 'node:test';
import assert from 'node:assert/strict';
import { qualificationEvidence as read } from './qualifications.mjs';
import { minimumYears, matchesExperienceFilter, experienceSummary, compareExperience, jobMatchKey } from './public/job-preferences.js';

const full = {full: true};
test('company history, awards and future training are not applicant minimums', () => {
  const q = read('Sales Representative', `Founded on a legacy of more than 120 years in banking.
A Best Places to Work company 10 years in a row.
Our average sales representative hits six figures after three years of selling.
No experience necessary: we offer a paid, hands-on formal training program in sales and logistics.
Receive 6 months of direct training from experienced Logistics Account Executives.`, full);
  assert.equal(q.graduateFit, 'potential');
  assert.equal(q.zeroExperience, true);
  assert.equal(q.experience.some(item => item.years), false);
  assert.equal(read('Analyst', `We have experienced tremendous growth over the last 5 years.
Three plus years in customer operations, CPFR, replenishment, or retail analytics.`, full).graduateFit, 'potential');
  assert.equal(read('Driver Recruiter', 'In our 45+ years of being in business, we have become an international company.', full).graduateFit, 'potential');
  assert.equal(read('Sales Trainee', "Knowledge normally acquired through four years of college resulting in a Bachelor's degree or equivalent experience.", full).experience[0].years, null);
});

test('months count as experience but explicitly optional experience is not a minimum', () => {
  assert.equal(minimumYears('6+ months'), 0.5);
  assert.equal(minimumYears('Three plus years'), 3);
  assert.equal(minimumYears(null), null);
  const optional = read('Associate Accountant', 'Experience: 6+ months work experience preferred but not required.', full);
  assert.equal(optional.zeroExperience, true);
  assert.equal(read('Loan Processing Specialist', '6 or more months of loan processing experience.', full).zeroExperience, false);
  assert.equal(read('Teller', 'No banking experience required. 6 months of customer service experience required.', full).zeroExperience, false);
  assert.equal(read('Assistant', 'Experience preferred but not required for internal applicants.', full).zeroExperience, false);
});

test('higher minimums cannot hide after a zero-year range in the same sentence', () => {
  const q = read('Analyst', '0–2 years of office experience and 5 years of finance experience required.', full);
  assert.equal(q.zeroExperience, false);
  assert.equal(q.graduateFit, 'outside');
  assert.equal(q.experience[0].years, '5 years');
  assert.equal(read('Entry-level coordinator', 'No experience required. 5 years of experience in recruiting or human resources required.', full).graduateFit, 'outside');
});

test('full frontline business postings with no minimum stay separate from confirmed zero', () => {
  const q = read('Customer Service Representative', 'Strong communication skills. Cash handling experience preferred.', full);
  assert.equal(q.graduateFit, 'potential');
  assert.equal(q.zeroExperience, false);
  assert.match(experienceSummary(q), /not specified/);
  assert.equal(matchesExperienceFilter(q, 'graduate'), true);
  assert.equal(matchesExperienceFilter(q, 'zero'), false);
  assert.equal(read('Senior Director', 'Strong communication skills.', full).graduateFit, 'outside');
});

test('zero-year roles sort first while three-year minimums and optional ranges remain eligible', () => {
  const jobs = [
    {title:'Three', qualifications:read('Analyst', '3–5 years of finance experience required.', full)},
    {title:'Unknown', qualifications:read('Assistant', 'Business degree preferred.', full)},
    {title:'One', qualifications:read('Analyst', '1–3 years of finance experience required.', full)},
    {title:'Zero', qualifications:read('Analyst', '0–2 years of finance experience required.', full)}
  ];
  assert.deepEqual(jobs.sort(compareExperience).map(job => job.title), ['Zero', 'Unknown', 'One', 'Three']);
  assert.equal(matchesExperienceFilter(jobs[3].qualifications, 'stated'), true);
  assert.equal(matchesExperienceFilter(jobs[0].qualifications, 'zero'), true);
  assert.match(experienceSummary(jobs[0].qualifications), /^0 years/);
  const q = read('Analyst', 'One year of accounting experience required. Three years of finance experience required.', full);
  assert.match(experienceSummary(q), /^Three years/);
});

test('extended qualification headings keep required and preferred experience separate', () => {
  const q = read('Analyst', 'BASIC QUALIFICATIONS - candidates must have these:\n0–1 years of finance experience.\nPREFERRED QUALIFICATIONS – candidates stand out with:\n5 years of finance experience.', full);
  assert.deepEqual(q.experience.filter(item => item.years).map(item => item.status), ['required', 'preferred']);
  assert.equal(q.zeroExperience, true);
});

test('duplicates are recognized across providers in smaller Northwest Arkansas towns', () => {
  const job = {title:'Supply Chain Intern',company:'Local Company',location:'Gentry, AR, USA'};
  assert.equal(jobMatchKey(job), jobMatchKey({...job,location:'Gentry, Arkansas'}));
  assert.equal(jobMatchKey({...job,location:null}), null);
});
