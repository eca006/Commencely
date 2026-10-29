import {validateResumeFile} from './resume-model.js';
export async function readResumeText(file){
  const type=validateResumeFile(file);
  if(type==='txt')return file.text();
  if(type==='docx'){
    if(!window.mammoth)await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='/vendor/mammoth.js';script.onload=resolve;script.onerror=()=>reject(new Error('Word reader could not load.'));document.head.append(script);});
    return (await window.mammoth.extractRawText({arrayBuffer:await file.arrayBuffer()})).value;
  }
  const pdfjs=await import('/vendor/pdf.mjs');pdfjs.GlobalWorkerOptions.workerSrc='/vendor/pdf.worker.mjs';
  const task=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false});task.onPassword=()=>task.destroy();
  try{const pdf=await task.promise;if(pdf.numPages>20)throw new Error('Choose a resume up to 20 pages.');const pages=[];for(let page=1;page<=pdf.numPages;page++){const content=await (await pdf.getPage(page)).getTextContent();pages.push(content.items.map(item=>item.str+(item.hasEOL?'\n':' ')).join(''));}return pages.join('\n\n');}finally{await task.destroy().catch(()=>{});}
}
export async function keepOriginalResume(file){
  const db=await new Promise((resolve,reject)=>{const request=indexedDB.open('commencely-original-resume',1);request.onupgradeneeded=()=>request.result.createObjectStore('files');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
  try{await new Promise((resolve,reject)=>{const tx=db.transaction('files','readwrite');tx.objectStore('files').put({blob:file,name:file.name,type:file.type},'original');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}finally{db.close();}
}
export function parseResumeText(text=''){
  const result={importedText:'',summary:'',skills:'',education:[],experience:[],projects:[]};
  const sections={summary:'summary',profile:'summary','professional summary':'summary',skills:'skills','technical skills':'skills',education:'education','education and training':'education',experience:'experience','work experience':'experience','employment history':'experience',projects:'projects'};
  let key='importedText';const blocks={};
  for(const line of text.replace(/\r/g,'').split('\n')){const heading=line.trim().toLowerCase().replace(/:$/,'');if(sections[heading]){key=sections[heading];continue;}blocks[key]=(blocks[key]||'')+line+'\n';}
  for(const [field,content] of Object.entries(blocks)){const value=content.trim();if(!value)continue;if(field==='education')result.education=[{notes:value}];else if(field==='experience')result.experience=[{tasks:value}];else if(field==='projects')result.projects=[{contribution:value}];else result[field]=value;}
  return result;
}
