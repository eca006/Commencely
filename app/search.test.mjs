import test from 'node:test';
import assert from 'node:assert/strict';
import { filterBusinessJobs, filterDirection, directionSearch } from './search.mjs';
import { businessMajors, getBusinessMajor, matchesBusinessMajor } from './public/business-majors.js';
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

test('general business search covers business functions and excludes unrelated titles', () => {
  const results = [
    { title: 'Staff Accountant' }, { title: 'Talent Acquisition Coordinator' },
    { title: 'Shopper Insights Client Associate' }, { title: 'Supply Chain Specialist' },
    { title: 'Nursing Operations Manager' }, { title: 'CCTV Network Technician' }, { title: 'Project Engineer - Site Design' }
  ];
  assert.deepEqual(filterBusinessJobs({ results }).results, results.slice(0, 4));
});

test('business degree search includes adjacent job families and explicit business qualifications', () => {
  const related = [
    { title: 'Bank Teller' }, { title: 'Claims Examiner' }, { title: 'Production Scheduler' },
    { title: 'Inventory Control Associate' }, { title: 'Benefits Administrator' },
    { title: 'Event Planner' }, { title: 'Pricing Specialist' }, { title: 'Strategic Initiatives Associate' },
    { title: 'IT Support Technician' }, { title: 'ERP Implementation Consultant' },
    { title: 'Trade Compliance Associate' }, { title: 'Replenishment Specialist' },
    { title: 'Leasing Consultant' }, { title: 'Venture Capital Associate' },
    { title: 'Rotational Associate', description: 'Applicants should have a bachelor’s degree in business administration.' }
  ];
  const unrelated = [
    { title: 'Nurse' }, { title: 'Field Technician', description: 'Degree in business preferred.' },
    { title: 'Warehouse Loader', description: 'Join our growing business.' }
  ];
  assert.deepEqual(filterBusinessJobs({ results: [...related, ...unrelated] }).results, related);
});

test('each Walton major matches a representative role', () => {
  const examples = {
    accounting: 'Staff Accountant', economics: 'Econometric Analyst', finance: 'Credit Analyst',
    general: 'Business Analyst', hr: 'Talent Acquisition Coordinator', systems: 'ERP Analyst',
    innovation: 'Startup Associate', marketing: 'Brand Coordinator', leadership: 'Operations Coordinator',
    supply: 'Replenishment Analyst'
  };
  assert.deepEqual(Object.keys(businessMajors), Object.keys(examples));
  for (const [key, title] of Object.entries(examples)) {
    assert.equal(matchesBusinessMajor({ title }, getBusinessMajor(key)), true, key);
  }
  assert.equal(matchesBusinessMajor({ title: 'Brand Coordinator' }, getBusinessMajor('accounting')), false);
  assert.equal(matchesBusinessMajor({ title: 'Rotational Associate', description: 'Bachelor’s degree in accounting.' },
    getBusinessMajor('accounting')), true);
});
