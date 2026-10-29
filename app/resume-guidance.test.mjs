import test from 'node:test';
import assert from 'node:assert/strict';
import {findSkills,appendSkill,summarySuggestions} from './public/resume-guidance.js';
import {filterTemplates,resumeTemplates,templateDesign} from './public/resume-templates.js';
import {parseResumeText} from './public/resume-import.js';
import {resumeMarkup,buildGuidedResume,arrangeResume} from './public/resume-model.js';
test('template filtering combines fields, photos, graphics, and columns; clearing restores all',()=>{
 const result=filterTemplates({hasPhoto:'false',hasGraphics:'true',columns:'2',fields:['Management']});assert.equal(result.length,1);assert.equal(result[0].id,'column-rule');assert.equal(filterTemplates().length,resumeTemplates.length);assert.equal(filterTemplates({hasPhoto:'true',columns:'2'}).length,1);
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
 const parsed=parseResumeText('Jordan Sample\njordan@example.test\nEXPERIENCE\nWelcomed visitors\nEDUCATION\nExample College\nSKILLS\nExcel');assert.match(parsed.importedText,/Jordan Sample/);assert.equal(parsed.experience[0].tasks,'Welcomed visitors');assert.equal(parsed.education[0].notes,'Example College');assert.equal(parsed.skills,'Excel');
});
