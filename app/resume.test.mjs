import test from 'node:test';
import assert from 'node:assert/strict';
import {resumeText,resumeHTML,hasResumeContent,blankTemplate,validateResumeFile,resumeMarkup,buildGuidedResume,cleanResumeWording,suggestedGuidedResume,applyResumeEdits} from './public/resume-model.js';
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

test('guided builder supports a first resume without paid work or invented claims',()=>{
  const result=buildGuidedResume({name:'Jordan Sample',email:'jordan@example.test',education:[{school:'Example School',qualification:'Business course',dates:'Expected 2027'}],skills:'Excel — basic\nSpanish',experience:[{}],projects:[]});
  assert.equal(result.name,'Jordan Sample');assert.equal(result.contact,'jordan@example.test');
  assert.ok(!result.body.includes('EXPERIENCE'));assert.ok(!result.body.includes('PROJECTS'));assert.ok(!result.body.includes('PROFILE'));
  assert.match(result.body,/Expected 2027/);assert.match(result.body,/• Excel — basic/);
  assert.equal(hasResumeContent(buildGuidedResume({name:'Jordan',education:[{}]})),false);
});
test('guided builder preserves entered tasks and results without inventing numbers',()=>{
  const result=buildGuidedResume({experience:[{role:'Volunteer',organization:'Community club',tasks:'Welcomed visitors\nOrganized supplies',results:'Kept supplies easy to find'}],projects:[{title:'Class project',contribution:'Made a spreadsheet'}]});
  assert.match(result.body,/• Welcomed visitors\n• Organized supplies\n• Kept supplies easy to find/);
  assert.match(result.body,/PROJECTS\nClass project\n• Made a spreadsheet/);assert.ok(!/\d/.test(result.body));
});

test('guided dates remain plain metadata beside each role, course, and project',()=>{
  const model=buildGuidedResume({name:'Jordan',education:[{qualification:'Business course',school:'Example School',dates:'Expected 2027'}],experience:[{role:'Volunteer',organization:'Community club',dates:'May 2024 – Present',tasks:'Welcomed visitors'}],projects:[{title:'Class project',dates:'Spring 2026',contribution:'Made a spreadsheet'}]});
  for(const html of [resumeMarkup(model),resumeHTML(model)]){
    for(const date of ['Expected 2027','May 2024 – Present','Spring 2026']){
      assert.ok(new RegExp('<p[^>]*class="resume-dates"[^>]*>'+date+'</p>').test(html));
      assert.ok(!html.includes('<h2>'+date));assert.ok(!html.includes('<p class="resume-entry">'+date));
    }
    assert.match(html,/<p[^>]*class="resume-entry-title"[^>]*>Volunteer<\/p>/);
    assert.match(html,/<p[^>]*class="resume-organization"[^>]*>Community club<\/p>/);
  }
});

test('wording suggestions clean supplied duties without adding metrics or removing negation',()=>{
  assert.equal(cleanResumeWording('i helped customers\ni used Excel 2 days a week'),'Helped customers.\nUsed Excel 2 days a week.');
  assert.equal(cleanResumeWording('I did not manage staff'),'I did not manage staff.');
  const model=suggestedGuidedResume({experience:[{role:'Volunteer',tasks:'i organized supplies',results:''}]});
  assert.deepEqual(model.sections[0].entries[0].bullets,['Organized supplies.']);assert.ok(!/\d/.test(model.body));
});
test('preview edits replace generated wording in HTML and editable text without accepting arbitrary object paths',()=>{
  const model=suggestedGuidedResume({experience:[{role:'Volunteer',dates:'2024',tasks:'i helped visitors'}]});
  const edited=applyResumeEdits(model,{'sections.0.entries.0.bullets.0':'Answered visitor questions.','__proto__.polluted':'bad'});
  assert.match(edited.body,/Answered visitor questions/);assert.ok(!edited.body.includes('Helped visitors'));
  assert.ok(resumeHTML(edited).includes('Answered visitor questions.'));assert.equal({}.polluted,undefined);
  assert.equal(model.sections[0].entries[0].bullets[0],'Helped visitors.');
});

test('preview edits stay with their original section and entry when blank entries disappear',()=>{
  const answers={education:[{}],experience:[{}, {role:'Volunteer',tasks:'i helped visitors'}]};
  const model=suggestedGuidedResume(answers);
  const edited=applyResumeEdits(model,{'sections.education.entries.0.title':'Wrong target','sections.experience.entries.0.title':'Wrong entry','sections.experience.entries.1.bullets.0':'Welcomed visitors.'});
  assert.ok(!edited.body.includes('Wrong'));assert.ok(edited.body.includes('Welcomed visitors.'));
});
