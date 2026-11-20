import assert from 'node:assert/strict';
import { test } from 'node:test';
import { jobSnippet } from './public/job-snippet.js';

test('job cards extract role, responsibilities, and requirements from employer sections', () => {
  const preview = jobSnippet(`ABOUT PLTFRM
A marketing paragraph about the company.
ABOUT THE ROLE
We are hiring an account manager for digital retail partners.
WHAT YOU’LL OWN
Build and manage digital channel strategies.
Coordinate promotions across the sales and media teams.
A third duty is available in the original posting.
WHAT YOU’LL BRING
3–5 years of digital account management experience.
Hands-on experience with a major retail platform.
What PLTFRM offers
Competitive salary and comprehensive benefits.`);

  assert.deepEqual(preview, {
    overview: ['We are hiring an account manager for digital retail partners.'],
    duties: ['Build and manage digital channel strategies.', 'Coordinate promotions across the sales and media teams.'],
    requirements: ['3–5 years of digital account management experience.', 'Hands-on experience with a major retail platform.']
  });
});

test('a partial posting never fills an empty requirements list with preferred qualifications', () => {
  const preview = jobSnippet('You will coordinate project schedules.\nA degree in marketing is preferred.');
  assert.deepEqual(preview.duties, ['You will coordinate project schedules.']);
  assert.deepEqual(preview.requirements, []);
  assert.deepEqual(jobSnippet(null), { overview: [], duties: [], requirements: [] });
});
