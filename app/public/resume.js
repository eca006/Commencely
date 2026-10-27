import { blankTemplate, resumeText, resumeHTML, hasResumeContent, validateResumeFile, resumeMarkup, resumeStyles } from './resume-model.js';
const previewStyle=document.createElement('style');previewStyle.textContent=resumeStyles;document.head.append(previewStyle);
const form=document.querySelector('#resume-form');
const status=document.querySelector('#resume-status');
const importStatus=document.querySelector('#import-status');
const fileInput=document.querySelector('#resume-file');
const key='commencely-resume-v1';
const model=()=>Object.fromEntries(new FormData(form));
let savedDraftText=null;
let importedFilename='';
let originalFile=null;
let originalURL=null;
let originalRevision=0;
let pdfPreviewVersion=0;
let editingCopy=true;
async function originalStorage(action,value){
  const db=await new Promise((resolve,reject)=>{
    const request=indexedDB.open('commencely-original-resume',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('files');
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
  });
  try{return await new Promise((resolve,reject)=>{
    const transaction=db.transaction('files',action==='get'?'readonly':'readwrite');
    const store=transaction.objectStore('files');
    const request=action==='get'?store.get('original'):action==='put'?store.put(value,'original'):store.delete('original');
    transaction.oncomplete=()=>resolve(request.result);transaction.onerror=()=>reject(transaction.error);transaction.onabort=()=>reject(transaction.error);
  });}finally{db.close();}
}
function showEditable(show){
  editingCopy=show;
  document.querySelector('#editable-controls').hidden=!show;
  document.querySelector('#resume-preview').hidden=!show;
  document.querySelector('#save-imported-resume').hidden=!show;
}
async function previewOriginalPDF(file){
  const version=++pdfPreviewVersion;
  const container=document.querySelector('#original-pdf');container.replaceChildren();
  const note=document.querySelector('#original-preview-status');note.textContent='Loading your original PDF preview…';
  let task;
  try{
    const pdfjs=await import('/vendor/pdf.mjs');pdfjs.GlobalWorkerOptions.workerSrc='/vendor/pdf.worker.mjs';
    task=pdfjs.getDocument({data:new Uint8Array(await file.blob.arrayBuffer()),isEvalSupported:false});
    task.onPassword=()=>task.destroy();
    const pdf=await task.promise;
    if(pdf.numPages>20)throw new Error('Preview supports up to 20 pages.');
    for(let number=1;number<=pdf.numPages;number++){
      if(version!==pdfPreviewVersion)return;
      const page=await pdf.getPage(number);
      const viewport=page.getViewport({scale:1.7});
      const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
      canvas.setAttribute('role','img');canvas.setAttribute('aria-label',`Original PDF page ${number} of ${pdf.numPages}`);
      await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
      if(version!==pdfPreviewVersion)return;
      container.append(canvas);
    }
    if(version===pdfPreviewVersion)note.textContent=`Preview · ${pdf.numPages} page${pdf.numPages===1?'':'s'}`;
  }catch{if(version===pdfPreviewVersion)note.textContent='This PDF could not be previewed here. Download the original to view it; the file is unchanged.';}
  finally{if(task)await task.destroy().catch(()=>{});}
}
function showOriginal(file,message){
  originalFile=file;
  if(originalURL)URL.revokeObjectURL(originalURL);
  const pdf=/\.pdf$/i.test(file.name);
  originalURL=URL.createObjectURL(new Blob([file.blob],{type:pdf?'application/pdf':file.blob.type}));
  document.querySelector('#original-resume').hidden=false;
  document.querySelector('#original-filename').textContent=file.name;
  document.querySelector('#original-status').textContent=message;
  const frame=document.querySelector('#original-pdf');
  frame.hidden=!pdf;
  frame.replaceChildren();
  if(pdf)previewOriginalPDF(file);else{pdfPreviewVersion++;document.querySelector('#original-preview-status').textContent='';}
  document.querySelector('#original-word-note').hidden=!/\.docx$/i.test(file.name);
  document.querySelector('#download-original').href=originalURL;document.querySelector('#download-original').download=file.name;
  document.querySelector('#builder-entry').hidden=true;
  document.querySelector('#selected-resume').hidden=true;
  document.querySelector('#choose-resume').textContent='Replace resume';
  showEditable(false);
  render();
}
document.querySelector('#toggle-editable').addEventListener('click',()=>{
  showEditable(!editingCopy);
  if(editingCopy)document.querySelector('#editable-controls').scrollIntoView({behavior:'smooth'});
});
document.querySelector('#download-original').addEventListener('click',()=>{
  if(!originalFile)return;
  status.textContent='Original file download requested: '+originalFile.name;
  document.querySelector('#original-status').textContent='Download requested.';
});
originalStorage('get').then(file=>{
  if(!originalRevision&&file?.blob instanceof Blob)showOriginal(file,'Resume ready. Saved on this browser.');
}).catch(()=>{});
document.querySelector('#choose-resume').addEventListener('click',()=>fileInput.click());
function render(){
  const value=model();
  document.querySelector('#resume-preview').innerHTML=resumeMarkup(value);
  document.querySelector('#download-help').textContent=hasResumeContent(value)?'Your resume is ready. Choose a blue button to save a file to your computer.':'Import a resume or add your details first to enable downloads.';
  for(const id of ['download-resume','download-html','print-resume']) document.getElementById(id).disabled=!hasResumeContent(value);
  document.querySelector('#start-template').disabled=!!value.body.trim();
  const alreadySaved=JSON.stringify(value)===savedDraftText;
  const downloadLink=document.querySelector('.resume-download-link');
  downloadLink.href=originalFile?'#original-resume':'#resume-downloads';
  downloadLink.textContent=originalFile?'View / download your original resume ↓':'Go to download options ↓';
  document.querySelector('#selected-resume').textContent=originalFile?'Your original resume is available below.':alreadySaved&&hasResumeContent(value)?'Your saved resume is loaded below.':importedFilename?'Imported file: '+importedFilename:hasResumeContent(value)?'Your resume draft is loaded below.':'No resume imported yet.';
  document.querySelector('#choose-resume').disabled=fileInput.disabled;
  for(const id of ['save-resume','save-imported-resume']){
    const button=document.getElementById(id);
    button.disabled=!hasResumeContent(value)||alreadySaved;
    button.textContent=alreadySaved?'Resume saved ✓':'Save resume on this browser';
  }
}
form.addEventListener('input',()=>{render();importStatus.textContent='Changes are not saved yet. Choose Save resume on this browser to keep them.';status.textContent='Unsaved changes. Download your resume or save the draft on this browser.';});
try {
  const saved=JSON.parse(localStorage.getItem(key));
  if(saved && ['name','contact','body'].every(field=>typeof saved[field]==='string') && hasResumeContent(saved)){
    for(const field of ['name','contact','body']) form.elements[field].value=saved[field];
    savedDraftText=JSON.stringify(model());
    importStatus.textContent='Saved resume loaded. You do not need to upload it again. Edit below, or use Download to save a file to your computer.';
    status.textContent='Loaded your saved draft from this browser. Changes are saved only when you choose Save draft.';
  }else if(saved){
    importStatus.textContent='No saved resume text was found. Choose your original resume file again to restore it.';
    status.textContent='No resume text is available to download yet.';
  }
}catch{status.textContent='Browser storage is unavailable. You can still edit and download your resume.';}
document.querySelector('#start-template').addEventListener('click',()=>{showEditable(true);form.elements.body.value=blankTemplate;render();status.textContent='Replace the headings with your real details. Leave out sections you don’t need.';});
function saveDraft(){
  if(!hasResumeContent(model())){importStatus.textContent='Import a resume or enter your details before saving. Your saved copy has not been replaced.';return;}
  try{
    const serialized=JSON.stringify(model());
    localStorage.setItem(key,serialized);
    if(localStorage.getItem(key)!==serialized)throw new Error('Save could not be verified.');
    savedDraftText=serialized;
    status.textContent='Resume saved on this browser. Use Download below to save a file to your computer.';
    importStatus.textContent='Resume saved ✓ You can leave and return in this same browser. To save a file to your computer, use Download below.';
    render();
  }catch{status.textContent='Could not save this draft. Download it to keep a copy.';importStatus.textContent=status.textContent;}
}
for(const id of ['save-resume','save-imported-resume'])document.getElementById(id).addEventListener('click',saveDraft);
document.querySelector('#clear-resume').addEventListener('click',async()=>{
  if(!confirm('Clear the original uploaded file, current text draft, and their saved browser copies? Download it first if you want to keep it.'))return;
  try{localStorage.removeItem(key);status.textContent='Draft and saved browser copy cleared.';}catch{status.textContent='Draft cleared from the page, but browser storage could not be cleared. Remove site data in browser settings.';}
  originalRevision++;
  try{await originalStorage('delete');}catch{status.textContent='Text draft cleared, but the original file could not be removed from browser storage. Remove site data in browser settings to clear it.';}
  originalFile=null;if(originalURL)URL.revokeObjectURL(originalURL);originalURL=null;
  pdfPreviewVersion++;document.querySelector('#original-pdf').replaceChildren();
  document.querySelector('#original-resume').hidden=true;document.querySelector('#toggle-editable').hidden=true;document.querySelector('#builder-entry').hidden=false;document.querySelector('#selected-resume').hidden=false;document.querySelector('#choose-resume').textContent='Add my resume';showEditable(true);
  savedDraftText=null;importedFilename='';form.reset();fileInput.value='';importStatus.textContent='';render();
});
document.querySelector('#remove-original').addEventListener('click',()=>document.querySelector('#clear-resume').click());
fileInput.addEventListener('change',async()=>{
  const file=fileInput.files[0];if(!file)return;
  if(originalFile&&!confirm('Replace your current resume with this file?')){fileInput.value='';return;}
  fileInput.disabled=true;document.querySelector('#choose-resume').disabled=true;
  try{
    validateResumeFile(file);
    originalRevision++;
    const original={name:file.name,blob:file.slice(0,file.size,file.type)};
    showOriginal(original,'Adding your resume…');
    try{await originalStorage('put',original);document.querySelector('#original-status').textContent='Resume added. Saved on this browser.';}
    catch{document.querySelector('#original-status').textContent='Resume added for this visit. It could not be saved for next time.';}
  }catch(error){
    const message=error.message||'Could not add this file. Please try again.';
    if(originalFile)document.querySelector('#original-status').textContent=message;else importStatus.textContent=message;
  }finally{fileInput.disabled=false;fileInput.value='';render();}
});
function download(content,type,filename){const url=URL.createObjectURL(new Blob([content],{type}));const link=document.createElement('a');link.href=url;link.download=filename;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);status.textContent='Download requested. Check your browser downloads for '+filename+'.';}
document.querySelector('#download-resume').addEventListener('click',()=>download(resumeText(model()),'text/plain;charset=utf-8','Commencely-resume.txt'));
document.querySelector('#download-html').addEventListener('click',()=>download(resumeHTML(model()),'text/html;charset=utf-8','Commencely-resume.html'));
document.querySelector('#print-resume').addEventListener('click',()=>window.print());
render();
