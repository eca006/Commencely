import test from 'node:test';
import assert from 'node:assert/strict';
import { plainText, employerResults } from './employer-jobs.mjs';
test('preserves qualification bullets and nested entities as plain text',()=>{
  assert.equal(plainText('&lt;ul&gt;&lt;li&gt;1–3 years of experience&lt;/li&gt;&lt;li&gt;Agency experience preferred.&lt;/li&gt;&lt;/ul&gt;'),'1–3 years of experience\nAgency experience preferred.');
  assert.equal(plainText('<script>bad()</script><p>A &amp;amp; B</p>'),'A & B');
});
test('employer feed limits geography and topic and extracts experience from full text',()=>{
  const raw={jobs:[
    {id:1,title:'Specialist, Amazon Operations',location:{name:'Rogers, Arkansas'},absolute_url:'https://example.com/job',content:'<h2>Qualifications</h2><li>1-3 years of hands-on experience managing catalogs.</li><li>Prior experience in an agency setting is highly preferred.</li>'},
    {id:2,title:'Operations Coordinator',location:{name:'Rogers, Minnesota'},content:'No experience required.'}
  ]};
  const jobs=employerResults(raw,{direction:'operations',location:'Fayetteville, Arkansas'},'2026-10-16T12:00:00Z');
  assert.equal(jobs.length,1); assert.equal(jobs[0].descriptionKind,'full');
  assert.equal(jobs[0].qualifications.experience[0].years,'1-3 years');
  assert.equal(jobs[0].qualifications.experience[0].status,'listed');
  assert.equal(jobs[0].qualifications.experience[1].status,'preferred');
  assert.equal(jobs[0].fetchedAt,'2026-10-16T12:00:00Z');
  assert.deepEqual(employerResults(raw,{direction:'operations',location:'Seattle, Washington'}),[]);
  assert.deepEqual(employerResults(raw,{direction:'marketing',location:'Rogers, Arkansas'}),[]);
});
