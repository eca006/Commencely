import test from 'node:test';
import assert from 'node:assert/strict';
import * as docx from 'docx';
import {buildResumeWord} from './public/resume-word.js';
import {buildGuidedResume,arrangeResume} from './public/resume-model.js';
import {templateDesign} from './public/resume-templates.js';
test('Word download creates a real docx package for a two-column resume',async()=>{
 const model=arrangeResume(buildGuidedResume({name:'Jordan Sample',skills:'Excel',experience:[{role:'Volunteer',tasks:'Welcomed visitors'}]}),{},templateDesign('column','teal'));
 const result=await docx.Packer.toBuffer(buildResumeWord(model,docx));assert.equal(result.subarray(0,2).toString(),'PK');assert.ok(result.length>5000);
});
