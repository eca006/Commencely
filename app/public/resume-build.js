import {downloadResumeWord} from './resume-word.js';
import {initResumePicker} from './resume-picker.js';
import {templateDesign} from './resume-templates.js';
import {readResumeText,keepOriginalResume,parseResumeText} from './resume-import.js';
import {findSkills,appendSkill,summarySuggestions} from './resume-guidance.js';
import {downloadResumePDF} from './resume-pdf.js';
import {buildGuidedResume,resumeText,resumeMarkup,resumeStyles,resumeHTML,hasResumeContent,suggestedGuidedResume,applyResumeEdits,arrangeResume,resumeSectionNames,resumeDesignClasses,cleanResumeWording} from './resume-model.js';
const style=document.createElement('style');style.textContent=resumeStyles;document.head.append(style);
const form=document.querySelector('#builder-form');
const status=document.querySelector('#builder-status');
const storageKey='commencely-builder-v1';
const steps=['Header','Experience','Education','Skills','Summary','Additional details','Finalize'];
const stepCopy=[['Let’s start with your header','Include your full name and ways for employers to reach you.'],['Let’s work on your experience','Start with your most recent experience. Paid work, volunteering, and other responsibilities count.'],['Add your education and training','Include courses or programs you have attended, even if unfinished.'],['Choose your skills','Select skills that fit the work you want to do.'],['Craft your summary','Use your own words or choose an option based on your answers.'],['Add optional details','Choose what else you’d like an employer to know.'],['Review and finish','Check the details, edit your wording, and download your resume.']];
const answerFields=['firstName','lastName','city','state','zip','email','phone','link','summary','skills','certifications','languages','awards','activities','references','importedText','customTitle','customText'];
let selectedExtras=[];let educationLevel='';
let stage='intro';let filters={};let maxStep=0;let changingTemplate=false;let photo='';let pickerUI;let importedFile=null;

const fields={
  education:[['school','School name'],['location','School location (optional)'],['qualification','Degree or qualification'],['fieldOfStudy','Field of study (optional)'],['dates','When did you attend or expect to finish?'],['notes','Any relevant courses, awards, or achievements? (optional)','textarea','Include only details you want on your resume.']],
  experience:[['role','Job title or responsibility'],['organization','Employer or organization'],['location','Location (optional)'],['dates','When did you do it?'],['tasks','What did you do?','textarea','Write one task per line. Think: What did you organize, help with, make, explain, or take care of?'],['results','What did your work help accomplish? (optional)','textarea','Write one result per line. A clear example is enough; only include numbers if you know they are accurate.']],
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
function snapshot(){return {...answers(),_previewEdits:previewEdits,_wordingMode:wordingMode,_layout:layout,_design:design,_selectedExtras:selectedExtras,_educationLevel:educationLevel,_stage:stage,_filters:filters,_step:step,_maxStep:maxStep,_photo:photo};}
function currentResume(mode=wordingMode,edits=previewEdits){
  const values=answers();if(!selectedExtras.includes('link'))values.link='';
  const hidden=[...layout.hidden,...['projects','certifications','languages','awards','activities','references','importedText','customText'].filter(key=>!selectedExtras.includes(key))];
  const model=arrangeResume(applyResumeEdits(mode==='clean'?suggestedGuidedResume(values):buildGuidedResume(values),edits),{...layout,hidden},design);model.photo=photo;return model;
}
function saveState(){const saved=JSON.stringify(snapshot())===savedAnswers;document.querySelector('#save-builder').textContent=saved?'Progress saved ✓':'Save now';document.querySelector('#save-builder').disabled=saved;}
function discardPreviewEdits(){if(Object.keys(previewEdits).length&&!confirm('Rebuild the preview from your answers and replace your preview edits?'))return false;previewEdits={};return true;}

function addEntry(kind,values={}){
  const section=document.createElement('fieldset');section.dataset.kind=kind;
  const legend=document.createElement('legend');legend.textContent={education:'School or training',experience:'Experience',projects:'Project or activity'}[kind];section.append(legend);
  for(const [key,labelText,type,help] of fields[kind]){
    if(key==='dates'){addDateFields(section,kind,values,labelText);continue;}
    const id='answer-'+(++rowId);const label=document.createElement('label');label.htmlFor=id;label.textContent=labelText;
    const input=document.createElement(type==='textarea'?'textarea':'input');input.id=id;input.dataset.field=key;input.maxLength=type==='textarea'?4000:300;if(type==='textarea')input.rows=3;
    input.value=typeof values[key]==='string'?values[key]:'';const field=document.createElement('div');field.className='entry-field'+(type==='textarea'||key==='location'?' full-width':'');section.append(field);field.append(label,input);
    if(kind==='education'&&['school','qualification'].includes(key)){
      const list=document.createElement('datalist');list.id=id+'-options';input.setAttribute('list',list.id);
      const choices=key==='school'?['University of Arkansas','NorthWest Arkansas Community College (NWACC)','Northwest Technical Institute','High school','Trade or vocational school','Online course or training','Employer training']:['High school diploma','GED','Associate degree','Bachelor’s degree','Master’s degree','Certificate or vocational training','Business','Nursing','Computer science','Information technology','Education','Marketing','Accounting','Welding','Healthcare training'];
      for(const choice of choices)list.append(new Option(choice));field.append(list);
      const hint=document.createElement('p');hint.className='note';hint.textContent='Choose a suggestion or type your own '+(key==='school'?'school or training provider.':'program, subject, or qualification.');field.append(hint);
    }
    if(help){const note=document.createElement('p');note.className='note';note.id=id+'-help';note.textContent=help;input.setAttribute('aria-describedby',note.id);field.append(note);}
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
  for(const name of answerFields)result[name]=form.elements[name].value;
  for(const kind of Object.keys(fields))result[kind]=[...document.querySelectorAll('fieldset[data-kind="'+kind+'"]')].map(row=>Object.fromEntries([...row.querySelectorAll('[data-field]')].map(input=>[input.dataset.field,input.value])));
  result.name=[result.firstName,result.lastName].filter(Boolean).join(' ');
  return result;
}
function render(){
  const model=currentResume();
  preview.innerHTML=resumeMarkup(model);
  for(const node of preview.querySelectorAll('[data-resume-path]')){node.contentEditable='plaintext-only';node.setAttribute('role','textbox');node.setAttribute('aria-label','Edit '+node.textContent.slice(0,90));node.spellcheck=true;}
  preview.hidden=false;preview.className='resume-document '+resumeDesignClasses(design);
  const content=hasResumeContent(model);
  for(const id of ['builder-download','builder-print','builder-edit','builder-pdf','top-download','builder-text','builder-word'])document.getElementById(id).disabled=!content;
  document.querySelector('#builder-review-status').textContent=content?(wordingMode==='clean'?'Suggested wording is ready. Click any line in the preview to edit it.':'Your exact answers are shown. Click any line in the preview to edit it.'):'Add at least one education, experience, project, or skill detail before downloading.';
  for(const row of document.querySelectorAll('fieldset[data-kind]')){
    row.querySelector('[data-entry-action="up"]').disabled=!row.previousElementSibling;
    row.querySelector('[data-entry-action="down"]').disabled=!row.nextElementSibling;
  }
  document.querySelector('#photo-field').hidden=!design.hasPhoto;
  saveState();renderChecklist();
}

function showStep(next,focus=true){
  if(next>maxStep)return;step=next;if(stage==='wizard')history.replaceState(null,'','#section-'+step);
  for(const button of document.querySelectorAll('[data-go-step]')){const active=Number(button.dataset.goStep)===step;button.setAttribute('aria-current',active?'step':'false');button.disabled=Number(button.dataset.goStep)>maxStep;button.title=steps[Number(button.dataset.goStep)]+(button.disabled?' — complete the preceding section first':'');}
  for(const panel of document.querySelectorAll('[data-step]'))panel.hidden=Number(panel.dataset.step)!==step;
  document.querySelector('#builder-progress').textContent=`Step ${step+1} of ${steps.length} · ${steps[step]}`;
  document.querySelector('#builder-back').hidden=false;document.querySelector('#builder-next').hidden=step===steps.length-1;
  document.querySelector('#builder-next').textContent='Continue';
  document.querySelector('#step-heading').textContent=stepCopy[step][0];document.querySelector('#step-description').textContent=stepCopy[step][1];
  if(step===4)renderSummaries();render();

  if(focus){const heading=document.querySelector('#step-heading');heading.tabIndex=-1;heading.focus();heading.scrollIntoView({behavior:'smooth'});}
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
document.querySelector('#builder-next').addEventListener('click',()=>{const invalid=document.querySelector('[data-step="'+step+'"] :invalid');if(invalid){invalid.reportValidity();return;}maxStep=Math.max(maxStep,Math.min(steps.length-1,step+1));showStep(Math.min(steps.length-1,step+1));queueAutosave();});
document.querySelector('#builder-back').addEventListener('click',()=>{if(step===0)setStage('choice');else showStep(step-1);queueAutosave();});
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
  for(const name of answerFields)if(typeof saved[name]==='string')form.elements[name].value=saved[name];
  if(!saved.firstName&&typeof saved.name==='string'){const parts=saved.name.trim().split(/\s+/);form.elements.firstName.value=parts.shift()||'';form.elements.lastName.value=parts.join(' ');}
  if(!saved.state&&typeof saved.city==='string'){const match=saved.city.match(/^(.*?)[, ]+([A-Z]{2})$/);if(match){form.elements.city.value=match[1];form.elements.state.value=match[2];}}
  selectedExtras=Array.isArray(saved._selectedExtras)?saved._selectedExtras:[];educationLevel=typeof saved._educationLevel==='string'?saved._educationLevel:'';
  for(const name of ['certifications','languages','awards','activities','references','link','importedText','customText'])if(!Array.isArray(saved._selectedExtras)&&form.elements[name].value.trim()&&!selectedExtras.includes(name))selectedExtras.push(name);
  if(!Array.isArray(saved._selectedExtras)&&saved.projects?.some(entry=>Object.values(entry).some(value=>typeof value==='string'&&value.trim()))&&!selectedExtras.includes('projects'))selectedExtras.push('projects');
  for(const kind of Object.keys(fields)){const entries=Array.isArray(saved[kind])?saved[kind].filter(entry=>entry&&typeof entry==='object').slice(0,30):[{}];for(const entry of entries)addEntry(kind,entry);}
  if(saved._previewEdits&&typeof saved._previewEdits==='object'&&!Array.isArray(saved._previewEdits)){
    const source=buildGuidedResume(answers());
    for(const [path,value] of Object.entries(saved._previewEdits)){const match=path.match(/^sections\.(\d+)\.(.*)$/);const section=match&&source.sections[Number(match[1])];previewEdits[section?'sections.'+section.key+'.'+match[2]:path]=value;}
  }
  wordingMode=saved._wordingMode==='exact'?'exact':'clean';
  if(saved._layout&&typeof saved._layout==='object')layout={order:Array.isArray(saved._layout.order)?saved._layout.order:Object.keys(resumeSectionNames),hidden:Array.isArray(saved._layout.hidden)?saved._layout.hidden:[]};

  for(const key of Object.keys(resumeSectionNames))if(!layout.order.includes(key))layout.order.push(key);
  if(saved._design&&typeof saved._design==='object')design=templateDesign(saved._design.templateId||saved._design.template,saved._design.color,{size:saved._design.size||'standard',spacing:saved._design.spacing||'normal',margins:saved._design.margins||'standard',font:saved._design.font});
  stage=['intro','templates','choice','wizard'].includes(saved._stage)?saved._stage:'intro';filters=saved._filters&&typeof saved._filters==='object'?saved._filters:{};
  maxStep=Number.isInteger(saved._maxStep)?Math.max(0,Math.min(6,saved._maxStep)):0;step=Number.isInteger(saved._step)?Math.max(0,Math.min(maxStep,saved._step)):0;
  photo=typeof saved._photo==='string'?saved._photo:'';
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
function wordingCandidate(mode){return currentResume(mode,{});}
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
  const button=document.createElement('button');button.type='button';button.dataset.goStep=index;const number=document.createElement('span');number.className='step-number';number.textContent=String(index+1);const label=document.createElement('span');label.className='step-label';label.textContent=name;button.append(number,label);button.setAttribute('aria-label',String(index+1)+' '+name);
  button.addEventListener('click',()=>showStep(index));document.querySelector('#builder-sections').append(button);
}

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


function addDateFields(section,kind,values,labelText){
  const group=document.createElement('div');group.className='education-dates';
  const heading=document.createElement('p');heading.textContent=labelText;group.append(heading);
  const stored=document.createElement('input');stored.type='hidden';stored.dataset.field='dates';stored.value=values.dates||'';group.append(stored);
  const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
  const matches=[...(values.dates||'').matchAll(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/gi)].map(match=>match[2]+'-'+String(months.findIndex(month=>month.toLowerCase()===match[1].toLowerCase())+1).padStart(2,'0'));
  const expected=/expected/i.test(values.dates||'');
  const controls={};
  for(const part of ['start','end']){
    const box=document.createElement('fieldset');box.className='date-pair';const legend=document.createElement('legend');legend.textContent=part==='start'?'Start date':kind==='education'?'Graduation or finish date':'End date';box.append(legend);
    const value=values[part+'Month']||(part==='start'?expected&&matches.length===1?'':matches[0]||'':expected&&matches.length===1?matches[0]:matches[1]||'');
    const hidden=document.createElement('input');hidden.type='hidden';hidden.dataset.field=part+'Month';hidden.value=value;box.append(hidden);
    const parts=value.split('-');const picks=[];
    for(const component of ['month','year']){
      const label=document.createElement('label');label.textContent=legend.textContent+' '+component;label.className='date-label';
      const select=document.createElement('select');select.id='answer-'+(++rowId);label.htmlFor=select.id;select.add(new Option(component==='month'?'Month':'Year',''));
      if(component==='month')months.forEach((month,index)=>select.add(new Option(month,String(index+1).padStart(2,'0'))));
      else {const yearNow=new Date().getFullYear();for(let year=yearNow+12;year>=1940;year--)select.add(new Option(String(year),String(year)));if(parts[0]&&!Array.from(select.options).some(option=>option.value===parts[0]))select.add(new Option(parts[0],parts[0]));}
      select.value=component==='month'?parts[1]||'':parts[0]||'';picks.push(select);box.append(label,select);
    }
    controls[part]={hidden,month:picks[0],year:picks[1]};group.append(box);
  }
  const label=document.createElement('label');const present=document.createElement('input');present.type='checkbox';present.checked=values.completion==='present'||/present/i.test(values.dates||'');
  label.className='current-date';label.append(present,document.createTextNode(kind==='education'?'I’m still enrolled':kind==='experience'?'I currently work here':'I’m still working on this'));group.append(label);
  const completion=document.createElement('input');completion.type='hidden';completion.dataset.field='completion';completion.value=present.checked?'present':values.completion||'';group.append(completion);
  const expectedLabel=document.createElement('label');const expectedCheck=document.createElement('input');expectedCheck.type='checkbox';expectedCheck.checked=values.completion==='expected'||expected;expectedLabel.className='current-date';expectedLabel.append(expectedCheck,document.createTextNode('This is my expected finish date'));if(kind==='education')group.append(expectedLabel);
  const old=document.createElement('p');old.className='note';old.textContent=stored.value?'Saved dates: '+stored.value:'';group.append(old);
  const disable=()=>{for(const select of [controls.end.month,controls.end.year])select.disabled=present.checked&&!(kind==='education'&&expectedCheck.checked);};disable();
  const update=()=>{
    disable();completion.value=kind==='education'&&expectedCheck.checked?'expected':present.checked?'present':'';
    const display=part=>{const c=controls[part];c.hidden.value=c.year.value?c.year.value+(c.month.value?'-'+c.month.value:''):'';return [c.month.value?months[Number(c.month.value)-1]:'',c.year.value].filter(Boolean).join(' ');};
    const start=display('start');const endValue=display('end');const end=present.checked&&!(kind==='education'&&expectedCheck.checked)?'Present':(completion.value==='expected'&&endValue?'Expected ':'')+endValue;
    stored.value=[start,end].filter(Boolean).join(' – ');old.textContent='';
  };
  group.addEventListener('input',update);group.addEventListener('change',()=>{update();changed();});section.append(group);
}
function renderExtraOptions(){
  const labels={projects:'Projects',languages:'Languages',awards:'Awards and honors',certifications:'Certifications and licenses',activities:'Activities',link:'Websites and social links',references:'References',importedText:'Other imported details',customText:'Custom section'};
  const container=document.querySelector('#additional-options');container.replaceChildren();
  for(const [key,text] of Object.entries(labels)){
    const label=document.createElement('label');const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=selectedExtras.includes(key);label.append(checkbox,document.createTextNode(text));container.append(label);
    const panel=document.querySelector('[data-extra="'+key+'"]');panel.hidden=!checkbox.checked;
    checkbox.addEventListener('change',()=>{selectedExtras=checkbox.checked?[...selectedExtras,key]:selectedExtras.filter(value=>value!==key);panel.hidden=!checkbox.checked;changed();});
  }
}
function renderSkillSuggestions(){
  const container=document.querySelector('#skill-suggestions');container.replaceChildren();
  const items=findSkills(document.querySelector('#skill-search').value);
  const selected=form.elements.skills.value.split('\n').map(value=>value.trim().toLowerCase());
  for(const skill of items){const button=document.createElement('button');button.type='button';button.textContent=(selected.includes(skill.toLowerCase())?'Added: ':'Add: ')+skill;button.disabled=selected.includes(skill.toLowerCase());button.addEventListener('click',()=>{form.elements.skills.value=appendSkill(form.elements.skills.value,skill);changed();renderSkillSuggestions();});container.append(button);}
  document.querySelector('#skill-search-status').textContent=items.length?'Only add skills you have.':'No suggestions found. You can write your own skill.';
}
document.querySelector('#skill-search').addEventListener('input',renderSkillSuggestions);
form.elements.skills.addEventListener('input',renderSkillSuggestions);
document.querySelector('#polish-skills').addEventListener('click',()=>{form.elements.skills.value=cleanResumeWording(form.elements.skills.value).split('\n').map(line=>line.replace(/\.$/,'')).join('\n');changed();renderSkillSuggestions();});
let previousSummary='';
function replaceSummary(value){previousSummary=form.elements.summary.value;form.elements.summary.value=value;document.querySelector('#undo-summary').hidden=false;changed();document.querySelector('#summary-status').textContent='Summary updated. You can edit it or undo this change.';}
function renderSummaries(){
  const container=document.querySelector('#summary-suggestions');container.replaceChildren();
  for(const value of summarySuggestions(answers())){const button=document.createElement('button');button.type='button';button.textContent=cleanResumeWording(value);button.addEventListener('click',()=>replaceSummary(cleanResumeWording(value)));container.append(button);}
  if(!container.children.length){const note=document.createElement('p');note.textContent='Add education, experience, or skills to get suggestions, or write your own summary.';container.append(note);}
}
document.querySelector('#refresh-summaries').addEventListener('click',renderSummaries);
document.querySelector('#polish-summary').addEventListener('click',()=>replaceSummary(cleanResumeWording(form.elements.summary.value)));
document.querySelector('#undo-summary').addEventListener('click',()=>{form.elements.summary.value=previousSummary;document.querySelector('#undo-summary').hidden=true;changed();});
function setupEducationChoices(){
  const container=document.querySelector('#education-choices');
  for(const value of ['High school or GED','Associate degree','Bachelor’s degree','Master’s or higher','Some college','Vocational training','Prefer not to answer']){
    const button=document.createElement('button');button.type='button';button.textContent=value;button.setAttribute('aria-pressed',String(value===educationLevel));
    button.addEventListener('click',()=>{educationLevel=value;for(const item of container.children)item.setAttribute('aria-pressed',String(item===button));const input=document.querySelector('#education-entries [data-field="qualification"]');if(input&&!input.value&&value!=='Prefer not to answer')input.value=value;changed();});container.append(button);
  }
}
const previewDialog=document.querySelector('#preview-dialog');
document.querySelector('#zoom-preview').addEventListener('click',()=>{document.querySelector('#large-preview').className='resume-document '+resumeDesignClasses(design);document.querySelector('#large-preview').innerHTML=resumeMarkup(currentResume());previewDialog.showModal();});
document.querySelector('#close-preview').addEventListener('click',()=>previewDialog.close());
const tipsDialog=document.querySelector('#tips-dialog');
document.querySelector('#show-tips').addEventListener('click',()=>{
  const model=currentResume();const tips=[];
  if(!model.name)tips.push('Add your name in Header.');if(!model.contact)tips.push('Add at least one contact detail in Header.');
  if(!hasResumeContent(model))tips.push('Add education, skills, experience, or another detail.');
  if(form.elements.skills.value.split('\n').filter(value=>value.trim()).length<6)tips.push('Consider adding more relevant skills you can demonstrate. Six to eight is a starting point, not a requirement.');
  tips.push('List the most recent education and experience first.','Check dates, spelling, and every statement before sending.','Use Rebuild wording in Finalize for common wording and grammar corrections.');
  const list=document.querySelector('#detailed-tips');list.replaceChildren();for(const text of tips){const item=document.createElement('li');item.textContent=text;list.append(item);}tipsDialog.showModal();
});
document.querySelector('#close-tips').addEventListener('click',()=>tipsDialog.close());



function setStage(next,newFilters){
  if(newFilters)filters=newFilters;
  if(next)stage=next;
  document.querySelector('#builder-start').hidden=stage==='wizard';document.querySelector('#wizard-shell').hidden=stage!=='wizard';
  for(const [key,id] of [['intro','builder-intro'],['templates','template-picker'],['choice','build-choice']])document.getElementById(id).hidden=stage!==key;
  if(next){history.replaceState(null,'','#'+(stage==='wizard'?'section-'+step:stage));window.scrollTo({top:0});}
  queueAutosave();
}
function downloadText(){const url=URL.createObjectURL(new Blob([resumeText(currentResume())],{type:'text/plain;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download='Commencely-resume.txt';link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}
document.querySelector('#builder-text').addEventListener('click',downloadText);
document.querySelector('#change-template').addEventListener('click',()=>{changingTemplate=true;setStage('templates');pickerUI.render();});
document.querySelector('#choice-back').addEventListener('click',()=>setStage('templates'));
for(const input of document.querySelectorAll('[name="build-mode"]'))input.addEventListener('change',()=>{document.querySelector('#import-options').hidden=document.querySelector('[name="build-mode"]:checked').value!=='import';});
document.querySelector('#builder-import-file').addEventListener('change',async event=>{
  const file=event.target.files[0];if(!file)return;const status=document.querySelector('#import-status');status.textContent='Reading your file locally…';
  try{const text=await readResumeText(file);if(!text.trim())throw new Error('No selectable text was found. Paste your resume text below instead.');if(text.length>50000)throw new Error('This resume has more than 50,000 characters. Paste the sections you need below.');document.querySelector('#import-review').value=text;importedFile=file;status.textContent='Text ready. Review it, then continue. Your original file will be kept unchanged.';}
  catch(error){importedFile=null;status.textContent=error.message||'Could not read this file. Paste your text below instead.';}
});
document.querySelector('#choice-continue').addEventListener('click',async()=>{
  if(document.querySelector('[name="build-mode"]:checked').value==='import'){
    const text=document.querySelector('#import-review').value.trim();if(!text){document.querySelector('#import-status').textContent='Choose a resume file or paste your text before continuing.';return;}
    if(hasResumeContent(currentResume())&&!document.querySelector('#replace-import').checked){document.querySelector('#import-status').textContent='To replace the current builder sections, check the replacement option below. Your contact details and original file will be kept.';return;}
    try{if(importedFile)await keepOriginalResume(importedFile);}catch{document.querySelector('#import-status').textContent='The original could not be saved in this browser. Keep your own copy before importing.';return;}
    const parsed=parseResumeText(text);previewEdits={};wordingMode='exact';
    for(const name of ['summary','skills','importedText','certifications','languages','awards','activities','references'])form.elements[name].value=parsed[name]||'';
    for(const kind of Object.keys(fields)){document.getElementById(kind+'-entries').replaceChildren();for(const value of parsed[kind]?.length?parsed[kind]:[{}])addEntry(kind,value);}
    selectedExtras=['importedText','projects'].filter(key=>key==='projects'?parsed.projects.length:parsed.importedText);renderExtraOptions();renderSkillSuggestions();
    status.textContent='Imported text is ready. Check each section and add your header details. The original file is unchanged.';
  }
  setStage('wizard');showStep(step,false);queueAutosave();
});
document.querySelector('#builder-photo').addEventListener('change',event=>{
  const file=event.target.files[0];if(!file)return;const status=document.querySelector('#photo-status');
  if(!['image/jpeg','image/png'].includes(file.type)||file.size>300000){status.textContent='Choose a JPG or PNG smaller than 300 KB.';return;}
  const reader=new FileReader();reader.onload=()=>{photo=reader.result;status.textContent='Photo added locally.';changed();};reader.onerror=()=>{status.textContent='Could not read this photo.';};reader.readAsDataURL(file);
});
document.querySelector('#remove-photo').addEventListener('click',()=>{photo='';document.querySelector('#builder-photo').value='';document.querySelector('#photo-status').textContent='Photo removed.';changed();});
let zoom=1;
function setZoom(value){zoom=Math.max(.6,Math.min(1.6,value));document.querySelector('#large-preview').style.zoom=zoom;document.querySelector('#zoom-value').textContent=Math.round(zoom*100)+'%';}
for(const [id,change] of [['zoom-in',.1],['zoom-out',-.1]])document.getElementById(id).addEventListener('click',()=>setZoom(zoom+change));document.querySelector('#zoom-reset').addEventListener('click',()=>setZoom(1));
for(const field of ['font','size','spacing','margins']){const select=document.querySelector('#finish-'+field);select.value=design[field]||({font:design.template==='classic'?'classic':'modern',size:'standard',spacing:'normal',margins:'standard'}[field]);select.addEventListener('change',()=>{design[field]=select.value;changed();});}
renderLayout();renderExtraOptions();renderSkillSuggestions();setupEducationChoices();
pickerUI=initResumePicker({filters,getDesign:()=>design,setDesign:value=>{design=value;render();queueAutosave();},onChoose:()=>{if(changingTemplate){changingTemplate=false;setStage('wizard');showStep(step,false);}else setStage('choice');},onStage:setStage});
ready=true;setStage(stage);showStep(step,false);

document.querySelector('#builder-word').addEventListener('click',async()=>{try{await downloadResumeWord(currentResume());status.textContent='Word download requested.';}catch{status.textContent='Could not create the Word file. PDF and text downloads are available.';}});

document.querySelector('#top-preview').addEventListener('click',()=>document.querySelector('#zoom-preview').click());
