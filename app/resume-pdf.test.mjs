import test from 'node:test';
import assert from 'node:assert/strict';
import {jsPDF} from 'jspdf';
import {createResumePDF} from './public/resume-pdf.js';
import {buildGuidedResume,arrangeResume} from './public/resume-model.js';
test('PDF export creates searchable text and paginates long resume content',()=>{
  const model=arrangeResume(buildGuidedResume({name:'Jordan Sample',experience:[{role:'Volunteer',tasks:Array.from({length:150},(_,index)=>'Task '+index+' organizing supplies and assisting visitors').join('\n')}],skills:'Excel'}),{hidden:['skills']},{template:'modern'});
  const pdf=createResumePDF(model,jsPDF);const data=pdf.output();
  assert.ok(data.startsWith('%PDF-'));assert.ok(data.includes('Jordan Sample'));assert.ok(data.includes('Task 149'));assert.ok(!data.includes('(Excel)'));assert.ok(pdf.getNumberOfPages()>1);
  for(const page of pdf.internal.pages.slice(1))assert.ok(page.some(command=>command.includes('Tj')));
});
