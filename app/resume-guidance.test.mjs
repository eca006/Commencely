import test from 'node:test';
import assert from 'node:assert/strict';
import {findSkills,appendSkill,summarySuggestions} from './public/resume-guidance.js';
import {filterTemplates,resumeTemplates,templateDesign,templateSample} from './public/resume-templates.js';
import {parseResumeText} from './public/resume-import.js';
import {resumeMarkup,resumeHTML,buildGuidedResume,arrangeResume} from './public/resume-model.js';
test('template filtering combines fields, photos, graphics, and columns; clearing restores all',()=>{
 const result=filterTemplates({hasPhoto:'false',hasGraphics:'true',columns:'2',fields:['Management']});assert.ok(result.length>0);assert.ok(result.some(item=>item.id==='column-rule'));assert.ok(result.every(item=>!item.hasPhoto&&item.hasGraphics&&item.columns===2&&item.fields.includes('Management')));assert.equal(filterTemplates().length,resumeTemplates.length);assert.ok(filterTemplates({hasPhoto:'true',columns:'2'}).every(item=>item.hasPhoto&&item.columns===2));
});
test('template switching changes layout without mutating resume answers',()=>{
 const source=buildGuidedResume({name:'Jordan',skills:'Excel',experience:[{role:'Volunteer',tasks:'Welcomed visitors'}]});const one=arrangeResume(source,{},templateDesign('classic','blue'));const two=arrangeResume(source,{},templateDesign('column','teal'));
 assert.equal(one.body,two.body);assert.match(resumeMarkup(two),/resume-columns/);assert.match(resumeMarkup(two),/Welcomed visitors/);assert.equal(source.design,undefined);
});
test('suggestions add only selected skills and use supplied resume facts',()=>{
 assert.ok(findSkills('cashier').includes('Cash handling'));assert.equal(appendSkill('Excel','excel'),'Excel');assert.deepEqual(summarySuggestions({}),[]);
 const options=summarySuggestions({experience:[{role:'Volunteer',organization:'Example Club'}],skills:'Excel'});assert.ok(options.every(value=>value.includes('Volunteer')||value.includes('Excel')));assert.ok(options.every(value=>!value.includes('years')));
});
test('import keeps unmatched text and recognized section text for review',()=>{
 const parsed=parseResumeText('Jordan Sample\njordan@example.test\nEXPERIENCE\nWelcomed visitors\nEDUCATION\nExample College\nSKILLS\nExcel');assert.equal(parsed.header.firstName,'Jordan');assert.equal(parsed.header.email,'jordan@example.test');assert.equal(parsed.importedText,'');assert.equal(parsed.experience[0].tasks,'Welcomed visitors');assert.equal(parsed.education[0].school,'Example College');assert.equal(parsed.skills,'Excel');
});

test('catalog excludes visual look-alikes while retaining their saved IDs',()=>{
 assert.equal(resumeTemplates.length,25);assert.equal(new Set(resumeTemplates.map(item=>item.id)).size,resumeTemplates.length);
 const variants = new Set(resumeTemplates.map(({id}) => {
   const design = templateDesign(id);
   const rule = design.graphics || design.sectionStyle === 'ruled';
   return JSON.stringify([design.hasPhoto, design.columns, rule,
     design.sectionStyle === 'label', design.entryStyle, design.headerStyle, design.sidebar]);
 }));
 assert.equal(variants.size, resumeTemplates.length);
 assert.equal(templateDesign('layout-1').headerStyle, 'standard');
 assert.equal(templateDesign('compact').template, 'compact');
 assert.equal(filterTemplates().some(({id}) => id === 'compact'), false);
 assert.equal(filterTemplates().some(({id}) => id === 'layout-1'), false);
 assert.equal(templateDesign('masthead').headerStyle, 'band');
 const right = resumeMarkup({...templateSample, design: templateDesign('credentials')});
 assert.ok(right.indexOf('resume-main') < right.indexOf('resume-side'));
});

test('photo templates display a photo slot in the picker and editor, with clean exports', () => {
 const photoTemplates = filterTemplates({hasPhoto:'true'});
 assert.ok(photoTemplates.length > 0);
 for (const {id} of photoTemplates) {
   const model = {...templateSample, design:templateDesign(id)};
   assert.equal((resumeMarkup({...model,photoSlot:'preview'}).match(/resume-photo-slot/g) ?? []).length,1);
   assert.match(resumeMarkup({...model,photoSlot:'upload'}),/<button[^>]+resume-photo-slot[^>]*>Add photo/);
   assert.doesNotMatch(resumeMarkup(model),/resume-photo-slot/);
   assert.doesNotMatch(resumeHTML(model),/>Add photo</);
   assert.match(resumeMarkup({...model,photoSlot:'upload',photo:'data:image/png;base64,AAAA'}),/<img class="resume-photo"/);
 }
 const withoutPhoto = {...templateSample, design:templateDesign('classic'), photoSlot:'preview'};
 assert.doesNotMatch(resumeMarkup(withoutPhoto),/resume-photo-slot/);
});

test('import separates project headings, education records, skills, and wrapped bullet text', () => {
 const parsed=parseResumeText(`SUMMARY
Business student using analytics
to support decisions.
SELECTED AI AND BUSINESS ANALYSIS PROJECTS
ResolveForward Pilot Evaluation | Power BI
• Built a dashboard to evaluate a pilot.
Medium-severity tickets averaged
35.37 minutes.
Commencely | Product requirements
• Turned findings into requirements.
EDUCATION
Master of Applied Business Analytics (MABA)
Expected Summer 2027
University of Arkansas, Fayetteville, Arkansas
Bachelor of Science in Business Administration
Graduated May 2026
University of Arkansas, Fayetteville, Arkansas
TECHNICAL AND ANALYTICAL SKILLS
- Analytics: Python, SQL,
Power BI
- Development: Node.js
EXPERIENCE
• Event Bartender  October 2026 – Present
• Sassafrass
• Provide bar service and assist guests.
• Server  May 2026 – Present
• Hideaway Pizza
• Help guests at tables.`);
 assert.equal(parsed.projects.length,2);
 assert.match(parsed.projects[0].title,/ResolveForward/);
 assert.equal(parsed.projects[0].contribution,'Built a dashboard to evaluate a pilot. Medium-severity tickets averaged 35.37 minutes.');
 assert.equal(parsed.education.length,2);
 assert.equal(parsed.education[0].dates,'Expected Summer 2027');
 assert.equal(parsed.skills,'Analytics: Python, SQL, Power BI\nDevelopment: Node.js');
 assert.equal(parsed.experience.length,2);
 assert.equal(parsed.experience[0].organization,'Sassafrass');
 assert.equal(parsed.experience[0].tasks,'Provide bar service and assist guests.');
 assert.equal(parsed.summary,'Business student using analytics to support decisions.');
});

test('import promotes contact information into the header and preserves unmatched text', () => {
 const parsed=parseResumeText('Jordan Sample\nFayetteville, Arkansas | 479-555-0123 | jordan@example.test\nlinkedin.com/in/jordan-sample | sample.github.io/portfolio/links.html\nAdditional note\nPROFILE\nBusiness graduate.');
 assert.deepEqual(parsed.header,{firstName:'Jordan',lastName:'Sample',email:'jordan@example.test',phone:'479-555-0123',city:'Fayetteville',state:'Arkansas',zip:'',link:'linkedin.com/in/jordan-sample | sample.github.io/portfolio/links.html'});
 assert.equal(parsed.importedText,'Additional note');
});
