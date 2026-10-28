import {blankTemplate,resumeMarkup,resumeStyles,resumeText,resumeHTML,hasResumeContent} from './resume-model.js';
const style=document.createElement('style');style.textContent=resumeStyles;document.head.append(style);
const form=document.querySelector('#editor-form');
const status=document.querySelector('#editor-status');
const value=()=>Object.fromEntries(new FormData(form));
let storageKey=new URLSearchParams(location.search).has('builder')?'commencely-builder-edit-v1':'commencely-editor-blank-v1';
let savedText=null;
let ready=false;
function render(){
  const model=value();document.querySelector('#resume-preview').innerHTML=resumeMarkup(model);
  const content=hasResumeContent(model);
  for(const id of ['editor-txt','editor-html','editor-print'])document.getElementById(id).disabled=!ready||!content;
  const saved=JSON.stringify(model)===savedText;
  const button=document.querySelector('#save-edited');button.disabled=!ready||!content||saved;button.textContent=saved?'Edited version saved ✓':'Save edited version';
}
function populate(model){for(const field of ['name','contact','body'])form.elements[field].value=model[field]||'';}
async function getOriginal(){
  const db=await new Promise((resolve,reject)=>{const request=indexedDB.open('commencely-original-resume',1);request.onupgradeneeded=()=>request.result.createObjectStore('files');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
  try{return await new Promise((resolve,reject)=>{const transaction=db.transaction('files');const request=transaction.objectStore('files').get('original');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}finally{db.close();}
}
async function extract(file){
  if(/\.txt$/i.test(file.name))return file.blob.text();
  if(/\.docx$/i.test(file.name)){
    await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='/vendor/mammoth.js';script.onload=resolve;script.onerror=()=>reject(new Error('Word reader could not load.'));document.head.append(script);});
    return (await window.mammoth.extractRawText({arrayBuffer:await file.blob.arrayBuffer()})).value;
  }
  const pdfjs=await import('/vendor/pdf.mjs');pdfjs.GlobalWorkerOptions.workerSrc='/vendor/pdf.worker.mjs';
  const task=pdfjs.getDocument({data:new Uint8Array(await file.blob.arrayBuffer()),isEvalSupported:false});
  task.onPassword=()=>task.destroy();
  try{
    const pdf=await task.promise;if(pdf.numPages>20)throw new Error('Text editing supports resumes up to 20 pages.');
    const pages=[];
    for(let i=1;i<=pdf.numPages;i++){const page=await pdf.getPage(i);const text=await page.getTextContent();pages.push(text.items.map(item=>item.str+(item.hasEOL?'\n':' ')).join(''));}
    return pages.join('\n\n');
  }finally{await task.destroy().catch(()=>{});}
}
async function open(){
  try{
    const params=new URLSearchParams(location.search);
    const file=params.has('new')||params.has('builder')?null:await getOriginal();
    if(file?.blob instanceof Blob){
      const digest=await crypto.subtle.digest('SHA-256',await file.blob.arrayBuffer());
      storageKey='commencely-editor-v1-'+Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
    }
    let saved;try{saved=JSON.parse(localStorage.getItem(storageKey));}catch{}
    if(saved&&['name','contact','body'].every(field=>typeof saved[field]==='string')&&hasResumeContent(saved)){
      populate(saved);savedText=JSON.stringify(value());status.textContent='Your saved edited version is ready.';
    }else if(file){
      const text=await extract(file);
      if(!text.trim())throw new Error('This resume has no selectable text. Paste your text below to create an editable version. Your original is still on My resume.');
      if(text.length>50000)throw new Error('This file has too much text to edit here. Paste the sections you need below.');
      populate({body:text});status.textContent='Ready to edit. Review the imported text before saving.';
    }else{populate({body:blankTemplate});status.textContent='Add your details to start your resume.';}
  }catch(error){status.textContent=error.message||'Could not open the editable text. You can paste your text below; your original is unchanged.';}
  finally{ready=true;form.inert=false;render();}
}
form.addEventListener('submit',event=>event.preventDefault());
form.addEventListener('input',()=>{render();status.textContent='Unsaved changes. Save your edited version before leaving.';});
document.querySelector('#save-edited').addEventListener('click',()=>{
  if(!hasResumeContent(value()))return;
  try{const serialized=JSON.stringify(value());localStorage.setItem(storageKey,serialized);if(localStorage.getItem(storageKey)!==serialized)throw new Error();savedText=serialized;render();status.textContent='Edited version saved on this browser. Your original is unchanged.';}
  catch{status.textContent='Could not save in this browser. Download your edited version to keep it.';}
});
function download(text,type,filename){const url=URL.createObjectURL(new Blob([text],{type}));const link=document.createElement('a');link.href=url;link.download=filename;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);status.textContent='Download requested. Check your browser downloads.';}
document.querySelector('#editor-txt').addEventListener('click',()=>download(resumeText(value()),'text/plain;charset=utf-8','Commencely-edited-resume.txt'));
document.querySelector('#editor-html').addEventListener('click',()=>download(resumeHTML(value()),'text/html;charset=utf-8','Commencely-edited-resume.html'));
document.querySelector('#editor-print').addEventListener('click',()=>window.print());
open();
