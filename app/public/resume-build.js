import {buildGuidedResume,resumeMarkup,resumeStyles,resumeHTML,hasResumeContent} from './resume-model.js';
const style=document.createElement('style');style.textContent=resumeStyles;document.head.append(style);
const form=document.querySelector('#builder-form');
const status=document.querySelector('#builder-status');
const storageKey='commencely-builder-v1';
const steps=['About you','Education','Experience','Projects and skills','Review'];
const fields={
  education:[['school','Where did you study or train?'],['qualification','What did you study or earn?'],['dates','When did you attend or expect to finish?'],['notes','Any relevant courses, awards, or achievements? (optional)','textarea','Include only details you want on your resume.']],
  experience:[['role','What was your role or responsibility?'],['organization','Where did you do this?'],['dates','When did you do it?'],['tasks','What did you do?','textarea','Write one task per line. Think: What did you organize, help with, make, explain, or take care of?'],['results','What did your work help accomplish? (optional)','textarea','Write one result per line. A clear example is enough; only include numbers if you know they are accurate.']],
  projects:[['title','What was the project or activity called?'],['context','Was it for a class, club, yourself, or another organization?'],['dates','When did you work on it? (optional)'],['contribution','What did you personally do or make?','textarea','Write one contribution per line. Mention a tool or result only if it’s true.']]
};
let step=0;
let rowId=0;
let savedAnswers=null;
function addEntry(kind,values={}){
  const section=document.createElement('fieldset');section.dataset.kind=kind;
  const legend=document.createElement('legend');legend.textContent={education:'School or training',experience:'Experience',projects:'Project or activity'}[kind];section.append(legend);
  for(const [key,labelText,type,help] of fields[kind]){
    const id='answer-'+(++rowId);const label=document.createElement('label');label.htmlFor=id;label.textContent=labelText;
    const input=document.createElement(type==='textarea'?'textarea':'input');input.id=id;input.dataset.field=key;input.maxLength=type==='textarea'?4000:300;if(type==='textarea')input.rows=3;
    input.value=typeof values[key]==='string'?values[key]:'';section.append(label,input);
    if(help){const note=document.createElement('p');note.className='note';note.id=id+'-help';note.textContent=help;input.setAttribute('aria-describedby',note.id);section.append(note);}
  }
  const remove=document.createElement('button');remove.type='button';remove.textContent='Remove this '+({education:'education entry',experience:'experience',projects:'project'}[kind]);
  remove.addEventListener('click',()=>{if([...section.querySelectorAll('input,textarea')].some(input=>input.value.trim())&&!confirm('Remove this entry from your answers?'))return;section.remove();changed();});section.append(remove);
  document.getElementById(kind+'-entries').append(section);
}
function answers(){
  const result={};
  for(const name of ['name','city','email','phone','link','summary','skills'])result[name]=form.elements[name].value;
  for(const kind of Object.keys(fields))result[kind]=[...document.querySelectorAll('fieldset[data-kind="'+kind+'"]')].map(row=>Object.fromEntries([...row.querySelectorAll('[data-field]')].map(input=>[input.dataset.field,input.value])));
  return result;
}
function render(){
  const current=answers();const model=buildGuidedResume(current);
  document.querySelector('#resume-preview').innerHTML=resumeMarkup(model);
  document.querySelector('#resume-preview').hidden=step!==4;
  const content=hasResumeContent(model);
  for(const id of ['builder-download','builder-print','builder-edit'])document.getElementById(id).disabled=!content;
  document.querySelector('#builder-review-status').textContent=content?'Your answers are arranged below. Nothing has been added to your experience.':'Add at least one education, experience, project, or skill detail before downloading.';
  const saved=JSON.stringify(current)===savedAnswers;document.querySelector('#save-builder').textContent=saved?'Progress saved ✓':'Save progress on this browser';document.querySelector('#save-builder').disabled=saved;
}
function showStep(next,focus=true){
  step=next;
  for(const panel of document.querySelectorAll('[data-step]'))panel.hidden=Number(panel.dataset.step)!==step;
  document.querySelector('#builder-progress').textContent=`Step ${step+1} of 5 · ${steps[step]}`;
  document.querySelector('#builder-back').hidden=step===0;document.querySelector('#builder-next').hidden=step===4;
  document.querySelector('#builder-next').textContent='Next: '+(steps[step+1]||'Review');render();
  if(focus){const heading=document.querySelector('[data-step="'+step+'"] h2');heading.tabIndex=-1;heading.focus();heading.scrollIntoView({behavior:'smooth'});}
}
function changed(){status.textContent='Changes are not saved yet. Save your progress before leaving.';render();}
for(const button of document.querySelectorAll('[data-add]'))button.addEventListener('click',()=>{addEntry(button.dataset.add);changed();});
form.addEventListener('submit',event=>event.preventDefault());form.addEventListener('input',changed);
document.querySelector('#builder-next').addEventListener('click',()=>{const invalid=document.querySelector('[data-step="'+step+'"] :invalid');if(invalid){invalid.reportValidity();return;}showStep(Math.min(4,step+1));});
document.querySelector('#builder-back').addEventListener('click',()=>showStep(Math.max(0,step-1)));
document.querySelector('#save-builder').addEventListener('click',()=>{
  try{const current=answers();const serialized=JSON.stringify(current);localStorage.setItem(storageKey,serialized);if(localStorage.getItem(storageKey)!==serialized)throw new Error();savedAnswers=serialized;render();status.textContent='Progress saved on this browser. You can leave and return to your answers.';}
  catch{status.textContent='Could not save progress in this browser. Keep this page open and download your resume when ready.';}
});
document.querySelector('#builder-download').addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([resumeHTML(buildGuidedResume(answers()))],{type:'text/html;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download='Commencely-resume.html';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);status.textContent='Download requested. Check your browser downloads.';});
document.querySelector('#builder-print').addEventListener('click',()=>window.print());
document.querySelector('#builder-edit').addEventListener('click',()=>{
  const key='commencely-builder-edit-v1';const model=buildGuidedResume(answers());
  try{const previous=localStorage.getItem(key);if(previous&&previous!==JSON.stringify(model)&&!confirm('Replace your previous full-text builder copy with these answers?'))return;localStorage.setItem(key,JSON.stringify(model));location.href='/resume/edit?builder=1';}
  catch{status.textContent='Could not open a saved text copy. You can download your resume here instead.';}
});
let saved;
try{saved=JSON.parse(localStorage.getItem(storageKey));}catch{}
if(saved&&typeof saved==='object'&&!Array.isArray(saved)){
  for(const name of ['name','city','email','phone','link','summary','skills'])if(typeof saved[name]==='string')form.elements[name].value=saved[name];
  for(const kind of Object.keys(fields)){const entries=Array.isArray(saved[kind])?saved[kind].filter(entry=>entry&&typeof entry==='object').slice(0,30):[{}];for(const entry of entries)addEntry(kind,entry);}
  savedAnswers=JSON.stringify(answers());status.textContent='Your saved answers are ready. Continue through the steps to review your resume.';
}else for(const kind of Object.keys(fields))addEntry(kind);
showStep(0,false);
