import { blankTemplate, resumeText, resumeHTML, hasResumeContent, validateResumeFile } from './resume-model.js';
const form=document.querySelector('#resume-form');
const status=document.querySelector('#resume-status');
const importStatus=document.querySelector('#import-status');
const fileInput=document.querySelector('#resume-file');
const key='commencely-resume-v1';
const model=()=>Object.fromEntries(new FormData(form));
function render(){
  const value=model();
  document.querySelector('#preview-name').textContent=value.name;
  document.querySelector('#preview-contact').textContent=value.contact;
  document.querySelector('#preview-body').textContent=value.body;
  for(const id of ['download-resume','download-html','print-resume']) document.getElementById(id).disabled=!hasResumeContent(value);
  document.querySelector('#start-template').disabled=!!value.body.trim();
}
form.addEventListener('input',()=>{render();status.textContent='Unsaved changes. Download your resume or save the draft on this browser.';});
try {
  const saved=JSON.parse(localStorage.getItem(key));
  if(saved && ['name','contact','body'].every(field=>typeof saved[field]==='string')){
    for(const field of ['name','contact','body']) form.elements[field].value=saved[field];
    status.textContent='Loaded your saved draft from this browser. Changes are saved only when you choose Save draft.';
  }
}catch{status.textContent='Browser storage is unavailable. You can still edit and download your resume.';}
document.querySelector('#start-template').addEventListener('click',()=>{form.elements.body.value=blankTemplate;render();status.textContent='Replace the headings with your real details. Leave out sections you don’t need.';});
document.querySelector('#save-resume').addEventListener('click',()=>{
  try{localStorage.setItem(key,JSON.stringify(model()));status.textContent='Draft saved on this browser. Anyone using this browser profile may be able to open it.';}
  catch{status.textContent='Could not save this draft. Download it to keep a copy.';}
});
document.querySelector('#clear-resume').addEventListener('click',()=>{
  if(!confirm('Clear the current resume draft and its saved browser copy? Download it first if you want to keep it.'))return;
  try{localStorage.removeItem(key);status.textContent='Draft and saved browser copy cleared.';}catch{status.textContent='Draft cleared from the page, but browser storage could not be cleared. Remove site data in browser settings.';}
  form.reset();fileInput.value='';importStatus.textContent='';render();
});
let mammothLoading;
function loadMammoth(){
  return mammothLoading ||= new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='/vendor/mammoth.js';script.onload=()=>resolve(window.mammoth);script.onerror=()=>{mammothLoading=null;reject(new Error('Word reader could not load. Try again.'));};document.head.append(script);});
}
fileInput.addEventListener('change',async()=>{
  const file=fileInput.files[0]; if(!file)return;
  if(resumeText(model()).trim() && !confirm('Replace the current draft with text from this file? Download or save your current draft first.')){fileInput.value='';return;}
  fileInput.disabled=true;form.inert=true;importStatus.textContent='Reading your resume locally…';
  document.querySelectorAll('.resume-tools button').forEach(button=>{button.disabled=true;});
  try{
    const type=validateResumeFile(file);let text='';
    if(type==='txt')text=await file.text();
    if(type==='docx'){const mammoth=await loadMammoth();const result=await mammoth.extractRawText({arrayBuffer:await file.arrayBuffer()});text=result.value;}
    if(type==='pdf'){
      const pdfjs=await import('/vendor/pdf.mjs');pdfjs.GlobalWorkerOptions.workerSrc='/vendor/pdf.worker.mjs';
      const task=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false});
      let passwordProtected=false;
      task.onPassword=()=>{passwordProtected=true;task.destroy();};
      let pdf;
      try{pdf=await task.promise;}catch(error){if(passwordProtected)throw new Error('Password-protected PDFs aren’t supported. Choose an unlocked copy.');throw error;}
      try{
        if(pdf.numPages>20)throw new Error('Choose a resume with 20 pages or fewer.');
        const pages=[];
        for(let i=1;i<=pdf.numPages;i++){const page=await pdf.getPage(i);const content=await page.getTextContent();pages.push(content.items.map(item=>item.str+(item.hasEOL?'\n':' ')).join(''));}
        text=pages.join('\n\n');
      }finally{await task.destroy();}
    }
    if(!text.trim())throw new Error('No readable text was found. Scanned PDFs need OCR first; you can also paste your resume text below.');
    if(text.length>50000)throw new Error('This file contains too much text. Use a shorter resume or paste the sections you need.');
    form.elements.name.value='';form.elements.contact.value='';form.elements.body.value=text;
    render();importStatus.textContent='Resume text imported. Review the text and layout before downloading. No experience or skills were added.';
    status.textContent='Imported draft is not saved. Download it or save the draft on this browser.';
  }catch(error){importStatus.textContent=error.message?.includes('password')?'Password-protected PDFs aren’t supported. Choose an unlocked copy.':error.message || 'Could not read this file. Try an unlocked PDF, a .docx, or plain text.';}
  finally{fileInput.disabled=false;form.inert=false;fileInput.value='';document.querySelector('#save-resume').disabled=false;document.querySelector('#clear-resume').disabled=false;render();}
});
function download(content,type,filename){const url=URL.createObjectURL(new Blob([content],{type}));const link=document.createElement('a');link.href=url;link.download=filename;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);status.textContent='Download requested. Check your browser downloads for '+filename+'.';}
document.querySelector('#download-resume').addEventListener('click',()=>download(resumeText(model()),'text/plain;charset=utf-8','Commencely-resume.txt'));
document.querySelector('#download-html').addEventListener('click',()=>download(resumeHTML(model()),'text/html;charset=utf-8','Commencely-resume.html'));
document.querySelector('#print-resume').addEventListener('click',()=>window.print());
render();
