import test from 'node:test';
import assert from 'node:assert/strict';
import {resumeText,resumeHTML,hasResumeContent,blankTemplate,validateResumeFile,resumeMarkup} from './public/resume-model.js';
test('exports only provided facts and keeps multiline text',()=>{
  const model={name:'Jordan Sample',contact:'jordan@example.test',body:'EXPERIENCE\nCampus desk assistant\nAnswered visitor questions.'};
  assert.equal(resumeText(model),'Jordan Sample\n\njordan@example.test\n\nEXPERIENCE\nCampus desk assistant\nAnswered visitor questions.');
  assert.match(resumeHTML(model), /<h2>EXPERIENCE<\/h2>/);
  assert.ok(resumeHTML(model).includes('Campus desk assistant'));
  assert.ok(resumeHTML(model).includes('Answered visitor questions.'));
  assert.equal(hasResumeContent({body:blankTemplate}),false);
});
test('HTML export escapes uploaded text instead of executing markup',()=>{
  const html=resumeHTML({name:'<script>alert(1)</script>',body:'<img src=x onerror=alert(1)>'});
  assert.ok(!html.includes('<script>')); assert.ok(!html.includes('<img'));
  assert.ok(html.includes('&lt;script&gt;'));
});
test('rejects unsupported, empty and oversize uploads',()=>{
  assert.equal(validateResumeFile({name:'resume.PDF',size:100}),'pdf');
  for(const file of [{name:'resume.doc',size:100},{name:'resume.txt',size:0},{name:'resume.pdf',size:6*1024*1024}])assert.throws(()=>validateResumeFile(file));
});

test('resume layout joins wrapped bullets and keeps all supplied words in order',()=>{
  const source='Jordan Sample\njordan@example.test\nPROFILE\nBusiness student focused on\npractical analytics.\nEXPERIENCE\nCampus assistant  2025–2026\n• Helped visitors and\nanswered questions.\n• Organized records.';
  const html=resumeMarkup({body:source});
  assert.match(html,/<h1>Jordan Sample<\/h1>/);
  assert.match(html,/<li>Helped visitors and answered questions.<\/li>/);
  const words=value=>value.replace(/[•]/g,'').replace(/\s+/g,' ').trim();
  assert.equal(words(html.replace(/<[^>]*>/g,' ')),words(source));
});
