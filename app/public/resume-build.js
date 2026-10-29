import {downloadResumePDF} from './resume-pdf.js';
import {buildGuidedResume,resumeText,resumeMarkup,resumeStyles,resumeHTML,hasResumeContent,suggestedGuidedResume,applyResumeEdits,arrangeResume,resumeSectionNames,resumeDesignClasses} from './resume-model.js';
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
let previewEdits={};
let wordingMode='clean';
let layout={order:Object.keys(resumeSectionNames),hidden:[]};
let design={template:'classic',size:'standard',spacing:'normal'};
let autosaveTimer;let ready=false;let previousWording=null;
const preview=document.querySelector('#resume-preview');
function snapshot(){return {...answers(),_previewEdits:previewEdits,_wordingMode:wordingMode,_layout:layout,_design:design};}
function currentResume(){return arrangeResume(applyResumeEdits(wordingMode==='clean'?suggestedGuidedResume(answers()):buildGuidedResume(answers()),previewEdits),layout,design);}
function saveState(){const saved=JSON.stringify(snapshot())===savedAnswers;document.querySelector('#save-builder').textContent=saved?'Progress saved ✓':'Save now';document.querySelector('#save-builder').disabled=saved;}
function discardPreviewEdits(){if(Object.keys(previewEdits).length&&!confirm('Rebuild the preview from your answers and replace your preview edits?'))return false;previewEdits={};return true;}

function addEntry(kind,values={}){
  const section=document.createElement('fieldset');section.dataset.kind=kind;
  const legend=document.createElement('legend');legend.textContent={education:'School or training',experience:'Experience',projects:'Project or activity'}[kind];section.append(legend);
  for(const [key,labelText,type,help] of fields[kind]){
    if(key==='dates'){
      const group=document.createElement('div');group.className='education-dates';
      const heading=document.createElement('p');heading.textContent=labelText;group.append(heading);
      const stored=document.createElement('input');stored.type='hidden';stored.dataset.field='dates';stored.value=values.dates||'';
      const controls={};
      const monthNames=['january','february','march','april','may','june','july','august','september','october','november','december'];
      const legacyMonths=[...(values.dates||'').matchAll(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})\b/gi)].map(match=>match[2]+'-'+String(monthNames.indexOf(match[1].toLowerCase())+1).padStart(2,'0'));
      const hasExpected=/expected/i.test(values.dates||'');
      const parsedStart=hasExpected&&legacyMonths.length===1?'':legacyMonths[0]||'';
      const parsedEnd=hasExpected&&legacyMonths.length===1?legacyMonths[0]:legacyMonths[1]||'';

      for(const [part,title] of [['start','Start month and year (optional)'],['end','Finish month and year (optional)']]){
        const id='answer-'+(++rowId);const label=document.createElement('label');label.htmlFor=id;label.textContent=title;
        const input=document.createElement('input');input.type='month';input.id=id;input.value=values[part+'Month']||(part==='start'?parsedStart:parsedEnd);input.dataset.field=part+'Month';controls[part]=input;group.append(label,input);
      }
      const label=document.createElement('label');label.textContent=kind==='education'?'Completion':'End date';const select=document.createElement('select');select.id='answer-'+(++rowId);label.htmlFor=select.id;select.dataset.field='completion';
      for(const [value,title] of (kind==='education'?[['','Completed / attended'],['expected','Expected to finish'],['present','Currently attending']]:[['','Finished'],['present','Present']])){const option=new Option(title,value);select.add(option);}
      select.value=values.completion||(/present/i.test(values.dates||'')?'present':kind==='education'&&hasExpected?'expected':'');group.append(label,select,stored);
      controls.end.disabled=select.value==='present';
      const old=document.createElement('p');old.className='note';old.textContent=stored.value?'Saved dates: '+stored.value:'';group.append(old);
      const update=()=>{controls.end.disabled=select.value==='present';const display=value=>{if(!value)return '';const [year,month]=value.split('-');return new Intl.DateTimeFormat('en-US',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(Number(year),Number(month)-1,1)));};const start=display(controls.start.value);const end=select.value==='present'?'Present':(select.value==='expected'&&controls.end.value?'Expected ':'')+display(controls.end.value);stored.value=[start,end].filter(Boolean).join(' – ');old.textContent='';};
      group.addEventListener('input',update);group.addEventListener('change',()=>{update();changed();});section.append(group);continue;
    }
    const id='answer-'+(++rowId);const label=document.createElement('label');label.htmlFor=id;label.textContent=labelText;
    const input=document.createElement(type==='textarea'?'textarea':'input');input.id=id;input.dataset.field=key;input.maxLength=type==='textarea'?4000:300;if(type==='textarea')input.rows=3;
    input.value=typeof values[key]==='string'?values[key]:'';section.append(label,input);
    if(kind==='education'&&['school','qualification'].includes(key)){
      const list=document.createElement('datalist');list.id=id+'-options';input.setAttribute('list',list.id);
      const choices=key==='school'?['University of Arkansas','NorthWest Arkansas Community College (NWACC)','Northwest Technical Institute','High school','Trade or vocational school','Online course or training','Employer training']:['High school diploma','GED','Associate degree','Bachelor’s degree','Master’s degree','Certificate or vocational training','Business','Nursing','Computer science','Information technology','Education','Marketing','Accounting','Welding','Healthcare training'];
      for(const choice of choices)list.append(new Option(choice));section.append(list);
      const hint=document.createElement('p');hint.className='note';hint.textContent='Choose a suggestion or type your own '+(key==='school'?'school or training provider.':'program, subject, or qualification.');section.append(hint);
    }
    if(help){const note=document.createElement('p');note.className='note';note.id=id+'-help';note.textContent=help;input.setAttribute('aria-describedby',note.id);section.append(note);}
  }
  const tools=document.createElement('div');tools.className='entry-actions';
  for(const [action,text] of [['up','Move up'],['down','Move down'],['copy','Duplicate']]){
    const button=document.createElement('button');button.type='button';button.dataset.entryAction=action;button.textContent=text;button.setAttribute('aria-label',text+' '+legend.textContent.toLowerCase());
    button.addEventListener('click',()=>{if(!discardPreviewEdits())return;
      if(action==='copy'){const value=Object.fromEntries([...section.querySelectorAll('[data-field]')].map(input=>[input.dataset.field,input.value]));addEntry(kind,value);}
      if(action==='up'&&section.previousElementSibling)section.parentElement.insertBefore(section,section.previousElementSibling);
      if(action==='down'&&section.nextElementSibling)section.parentElement.insertBefore(section.nextElementSibling,section);
      changed();});tools.append(button);
  }section.append(tools);
  const remove=document.createElement('button');remove.type='button';remove.textContent='Remove this '+({education:'education entry',experience:'experience',projects:'project'}[kind]);
  remove.addEventListener('click',()=>{const hasText=[...section.querySelectorAll('input,textarea')].some(input=>input.value.trim());if((hasText||Object.keys(previewEdits).length)&&!confirm('Remove this entry and rebuild the preview from your remaining answers?'))return;previewEdits={};section.remove();changed();});section.append(remove);
  document.getElementById(kind+'-entries').append(section);
}
function answers(){
  const result={};
  for(const name of ['name','city','email','phone','link','summary','skills','certifications','languages','awards'])result[name]=form.elements[name].value;
  for(const kind of Object.keys(fields))result[kind]=[...document.querySelectorAll('fieldset[data-kind="'+kind+'"]')].map(row=>Object.fromEntries([...row.querySelectorAll('[data-field]')].map(input=>[input.dataset.field,input.value])));
  return result;
}
function render(){
  const model=currentResume();
  preview.innerHTML=resumeMarkup(model);
  for(const node of preview.querySelectorAll('[data-resume-path]')){node.contentEditable='plaintext-only';node.setAttribute('role','textbox');node.setAttribute('aria-label','Edit '+node.textContent.slice(0,90));node.spellcheck=true;}
  preview.hidden=false;preview.className='resume-document '+resumeDesignClasses(design);
  const content=hasResumeContent(model);
  for(const id of ['builder-download','builder-print','builder-edit','builder-pdf','top-download'])document.getElementById(id).disabled=!content;
  document.querySelector('#builder-review-status').textContent=content?(wordingMode==='clean'?'Suggested wording is ready. Click any line in the preview to edit it.':'Your exact answers are shown. Click any line in the preview to edit it.'):'Add at least one education, experience, project, or skill detail before downloading.';
  for(const row of document.querySelectorAll('fieldset[data-kind]')){
    row.querySelector('[data-entry-action="up"]').disabled=!row.previousElementSibling;
    row.querySelector('[data-entry-action="down"]').disabled=!row.nextElementSibling;
  }
  saveState();renderChecklist();
}

function showStep(next,focus=true){
  step=next;
  for(const button of document.querySelectorAll('[data-go-step]')){const active=Number(button.dataset.goStep)===step;button.setAttribute('aria-current',active?'step':'false');}
  for(const panel of document.querySelectorAll('[data-step]'))panel.hidden=Number(panel.dataset.step)!==step;
  document.querySelector('#builder-progress').textContent=`Step ${step+1} of 5 · ${steps[step]}`;
  document.querySelector('#builder-back').hidden=step===0;document.querySelector('#builder-next').hidden=step===4;
  document.querySelector('#builder-next').textContent='Next: '+(steps[step+1]||'Review');render();
  if(focus){const heading=document.querySelector('[data-step="'+step+'"] h2');heading.tabIndex=-1;heading.focus();heading.scrollIntoView({behavior:'smooth'});}
}
function changed(){queueAutosave();status.textContent=Object.keys(previewEdits).length?'Answers updated. Your preview edits are kept; use Rebuild wording to start again from these answers.':'Changes are not saved yet. Save your progress before leaving.';render();}
for(const button of document.querySelectorAll('[data-add]'))button.addEventListener('click',()=>{if(!discardPreviewEdits())return;addEntry(button.dataset.add);changed();});
const phone=form.elements.phone;
phone.addEventListener('input',()=>{
  if(/[^\d\s()+.-]/.test(phone.value))return;
  const digits=phone.value.replace(/\D/g,'');if(digits.length>11||(digits.length===11&&!digits.startsWith('1')))return;
  const national=digits.length===11?digits.slice(1):digits;
  phone.value=(digits.length===11?'1-':'')+[national.slice(0,3),national.slice(3,6),national.slice(6,10)].filter(Boolean).join('-');
});
form.addEventListener('change',changed);
form.addEventListener('submit',event=>event.preventDefault());form.addEventListener('input',changed);
document.querySelector('#builder-next').addEventListener('click',()=>{const invalid=document.querySelector('[data-step="'+step+'"] :invalid');if(invalid){invalid.reportValidity();return;}showStep(Math.min(4,step+1));});
document.querySelector('#builder-back').addEventListener('click',()=>showStep(Math.max(0,step-1)));
document.querySelector('#save-builder').addEventListener('click',()=>{
  try{const serialized=JSON.stringify(snapshot());localStorage.setItem(storageKey,serialized);if(localStorage.getItem(storageKey)!==serialized)throw new Error();savedAnswers=serialized;render();status.textContent='Progress saved on this browser. You can leave and return to your answers.';}
  catch{status.textContent='Could not save progress in this browser. Keep this page open and download your resume when ready.';}
});
document.querySelector('#builder-download').addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([resumeHTML(currentResume())],{type:'text/html;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download='Commencely-resume.html';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);status.textContent='Download requested. Check your browser downloads.';});
document.querySelector('#builder-print').addEventListener('click',()=>window.print());
document.querySelector('#builder-edit').addEventListener('click',()=>{
  const key='commencely-builder-edit-v1';const model=currentResume();
  try{const previous=localStorage.getItem(key);if(previous&&previous!==JSON.stringify(model)&&!confirm('Replace your previous full-text builder copy with these answers?'))return;localStorage.setItem(key,JSON.stringify(model));location.href='/resume/edit?builder=1';}
  catch{status.textContent='Could not open a saved text copy. You can download your resume here instead.';}
});
let saved;
try{saved=JSON.parse(localStorage.getItem(storageKey));}catch{}
if(saved&&typeof saved==='object'&&!Array.isArray(saved)){
  for(const name of ['name','city','email','phone','link','summary','skills','certifications','languages','awards'])if(typeof saved[name]==='string')form.elements[name].value=saved[name];
  for(const kind of Object.keys(fields)){const entries=Array.isArray(saved[kind])?saved[kind].filter(entry=>entry&&typeof entry==='object').slice(0,30):[{}];for(const entry of entries)addEntry(kind,entry);}
  if(saved._previewEdits&&typeof saved._previewEdits==='object'&&!Array.isArray(saved._previewEdits))previewEdits=saved._previewEdits;
  wordingMode=saved._wordingMode==='exact'?'exact':'clean';
  if(saved._layout&&typeof saved._layout==='object')layout={order:Array.isArray(saved._layout.order)?saved._layout.order:Object.keys(resumeSectionNames),hidden:Array.isArray(saved._layout.hidden)?saved._layout.hidden:[]};

  savedAnswers=JSON.stringify(snapshot());status.textContent='Your saved answers are ready. Continue through the steps to review your resume.';
}else for(const kind of Object.keys(fields))addEntry(kind);
preview.addEventListener('input',event=>{
  const node=event.target.closest('[data-resume-path]');if(!node)return;
  previewEdits[node.dataset.resumePath]=node.innerText.trim();queueAutosave();
  status.textContent='Preview changes are not saved yet. Save progress to keep your wording.';saveState();
});
preview.addEventListener('paste',event=>{
  const node=event.target.closest('[data-resume-path]');if(!node)return;
  event.preventDefault();document.execCommand('insertText',false,event.clipboardData.getData('text/plain'));
});
preview.addEventListener('drop',event=>event.preventDefault());
let pendingWording=null;
const wordingFeedback=document.querySelector('#wording-feedback');
const wordingConfirmation=document.querySelector('#wording-confirmation');
function feedback(message){wordingFeedback.textContent=message;wordingFeedback.scrollIntoView({block:'nearest',behavior:'smooth'});}
function wordingCandidate(mode){return arrangeResume(applyResumeEdits(mode==='clean'?suggestedGuidedResume(answers()):buildGuidedResume(answers()),{}),layout,design);}
function applyWording(mode){
  const before=resumeText(currentResume());
  previousWording={previewEdits:{...previewEdits},wordingMode};document.querySelector('#undo-wording').hidden=false;
  previewEdits={};wordingMode=mode;pendingWording=null;wordingConfirmation.hidden=true;
  render();
  const changed=resumeText(currentResume())!==before;
  const message=changed?(mode==='clean'?'Updated the wording below from your answers. You can still click any line to edit it.':'Your exact answers are now shown below.'):(mode==='clean'?'The preview already uses the suggested wording. There are no further changes from the wording and common grammar corrections. You can edit any preview line or choose Use my exact answers.':'The preview already matches your exact answers.');
  feedback(message);status.textContent=message;queueAutosave();
}
function requestWording(mode){
  pendingWording=null;wordingConfirmation.hidden=true;
  if(Object.keys(previewEdits).length&&resumeText(currentResume())!==resumeText(wordingCandidate(mode))){
    pendingWording=mode;wordingConfirmation.hidden=false;
    feedback('Choose Replace preview wording below to rebuild, or Keep my edits.');return;
  }
  applyWording(mode);
}
document.querySelector('#rebuild-wording').addEventListener('click',()=>requestWording('clean'));
document.querySelector('#exact-wording').addEventListener('click',()=>requestWording('exact'));
document.querySelector('#confirm-wording').addEventListener('click',()=>{if(pendingWording)applyWording(pendingWording);});
document.querySelector('#cancel-wording').addEventListener('click',()=>{pendingWording=null;wordingConfirmation.hidden=true;feedback('Your preview edits were kept. Nothing was replaced.');});
for(const [index,name] of steps.entries()){
  const button=document.createElement('button');button.type='button';button.dataset.goStep=index;button.textContent=String(index+1).padStart(2,'0')+'  '+name;
  button.addEventListener('click',()=>showStep(index));document.querySelector('#builder-sections').append(button);
}
renderLayout();ready=true;showStep(0,false);
function renderLayout(){
  const container=document.querySelector('#layout-sections');container.replaceChildren();
  for(const [index,key] of layout.order.entries()){
    if(!Object.hasOwn(resumeSectionNames,key))continue;
    const row=document.createElement('div');row.className='layout-row';
    const label=document.createElement('label');const check=document.createElement('input');check.type='checkbox';check.checked=!layout.hidden.includes(key);label.append(check,document.createTextNode(resumeSectionNames[key]));
    check.addEventListener('change',()=>{layout.hidden=check.checked?layout.hidden.filter(value=>value!==key):[...layout.hidden,key];changed();});row.append(label);
    for(const [offset,text] of [[-1,'Up'],[1,'Down']]){const button=document.createElement('button');button.type='button';button.textContent=text;button.setAttribute('aria-label','Move '+resumeSectionNames[key]+' '+text.toLowerCase());button.disabled=index+offset<0||index+offset>=layout.order.length;button.addEventListener('click',()=>{[layout.order[index],layout.order[index+offset]]=[layout.order[index+offset],layout.order[index]];renderLayout();changed();});row.append(button);}
    container.append(row);
  }
}
function queueAutosave(){if(!ready)return;clearTimeout(autosaveTimer);autosaveTimer=setTimeout(persist,600);}
function persist(){
  try{const serialized=JSON.stringify(snapshot());localStorage.setItem(storageKey,serialized);savedAnswers=serialized;saveState();status.textContent='All changes saved in this browser.';}
  catch{status.textContent='Could not save automatically. Keep this page open and download a copy.';}
}
window.addEventListener('pagehide',()=>{if(ready)persist();});
function renderChecklist(){
  const model=currentResume();const checks=[['Name added',!!model.name],['Contact detail added',!!model.contact],['Education, experience, or skills added',hasResumeContent(model)]];
  const list=document.querySelector('#resume-checklist');list.replaceChildren();
  for(const [label,complete] of checks){const item=document.createElement('li');item.textContent=(complete?'Done: ':'To add: ')+label;item.className=complete?'complete':'';list.append(item);}
}
document.querySelector('#undo-wording').addEventListener('click',()=>{if(!previousWording)return;previewEdits=previousWording.previewEdits;wordingMode=previousWording.wordingMode;previousWording=null;document.querySelector('#undo-wording').hidden=true;render();queueAutosave();feedback('Restored your wording from before the last rebuild.');});
async function downloadPDF(){
  try{await downloadResumePDF(currentResume());status.textContent='PDF download requested. Check your browser downloads.';}
  catch{status.textContent='The PDF could not be created. You can use Print / Save as PDF instead.';}
}
for(const id of ['builder-pdf','top-download'])document.getElementById(id).addEventListener('click',downloadPDF);

