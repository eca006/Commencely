import test from 'node:test';
import assert from 'node:assert/strict';
import {resumeText,resumeHTML,hasResumeContent,blankTemplate,validateResumeFile} from './public/resume-model.js';
test('exports only provided facts and keeps multiline text',()=>{
  const model={name:'Jordan Sample',contact:'jordan@example.test',body:'EXPERIENCE\nCampus desk assistant\nAnswered visitor questions.'};
  assert.equal(resumeText(model),'Jordan Sample\n\njordan@example.test\n\nEXPERIENCE\nCampus desk assistant\nAnswered visitor questions.');
  assert.ok(resumeHTML(model).includes(model.body));
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
