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

const bulletLine = /^[•●▪‣*–-]\s+/;
const dateLine = /(?:January|February|March|April|May|June|July|August|September|October|November|December|Spring|Summer|Fall|Winter|Expected|Graduated|Present|Current|20\d{2})/i;
const degreeLine = /^(?:Master|Bachelor|Associate|Doctor|MBA|MABA|B\.?S\.?|B\.?A\.?|M\.?S\.?|M\.?A\.?|High School|Certificate)\b/i;

function headingKey(line) {
  const heading = line.trim().toLowerCase().replace(/:$/, '');
  if (/^(?:professional )?(?:summary|profile|objective)$/.test(heading)) return 'summary';
  if (/^(?:(?:technical|analytical|technical and analytical|core|professional) )?skills$/.test(heading)) return 'skills';
  if (/^(?:education|education and training)$/.test(heading)) return 'education';
  if (/^(?:(?:work|professional|volunteer) )?experience$|^employment history$/.test(heading)) return 'experience';
  if (/^(?:(?:selected|ai|business|analysis|and|technology|academic|personal) )*projects$/.test(heading)) return 'projects';
  return null;
}

function importEntries(lines, kind) {
  const entries = [];
  let current;
  let inBullets = false;
  const textField = kind === 'experience' ? 'tasks' : kind === 'projects' ? 'contribution' : 'notes';
  const titleField = kind === 'experience' ? 'role' : kind === 'projects' ? 'title' : 'qualification';
  function start(title = '') {
    current = { [titleField]: title, [textField]: '' };
    entries.push(current);
    inBullets = false;
  }
  function append(value, continuation = false) {
    current[textField] += (current[textField] ? continuation ? ' ' : '\n' : '') + value;
  }
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (!current) start();
    if (bulletLine.test(line)) {
      const value = line.replace(bulletLine, '');
      if (kind === 'experience' && dateLine.test(value) && value.length < 150 && !/[.!?]$/.test(value)) {
        if (current[titleField] || current[textField]) start(value);
        else current[titleField] = value;
        inBullets = false;
        continue;
      }
      if (kind === 'experience' && current.role && !current.organization && !inBullets &&
          value.length < 100 && !/[.!?]$/.test(value)) {
        current.organization = value;
        continue;
      }
      append(value);
      inBullets = true;
      continue;
    }
    const looksLikeTitle = line.length < 150 && !/[.!?]$/.test(line) &&
      (/\|/.test(line) || dateLine.test(line) || /^[A-Z][^a-z]*$/.test(line) ||
        /^(?:[A-Z][\w’'-]*)(?: (?:[A-Z][\w’'-]*|and|of|in|for|the|&|–|-)){1,9}$/.test(line));
    if (kind === 'education' && degreeLine.test(line)) {
      if (current[titleField] || current[textField] || current.school) start(line);
      else current[titleField] = line;
      inBullets = false;
    } else if (kind === 'education' && !inBullets && dateLine.test(line)) {
      current.dates = [current.dates, line].filter(Boolean).join(' · ');
    } else if (kind === 'education' && !inBullets && /university|college|school|institute/i.test(line)) {
      current.school = [current.school, line].filter(Boolean).join(' · ');
    } else if (kind !== 'education' && looksLikeTitle) {
      if (inBullets || !current[titleField]) {
        if (inBullets) start(line);
        else current[titleField] = line;
        inBullets = false;
      } else if (kind === 'experience' && !current.organization) {
        current.organization = line;
      } else append(line);
    } else append(line, inBullets);
  }
  return entries.filter(entry => Object.values(entry).some(Boolean));
}

export function extractResumeHeader(text = '') {
  const header = {};
  const lines = text.split(/\r?\n/).map(line => line.replace(bulletLine, '').trim()).filter(Boolean);
  const first = lines[0] ?? '';
  const hasContact = lines.slice(0, 6).some(line => /@|\b(?:linkedin\.com|github\.io)\b|\d[\d ().+-]{7,}\d/i.test(line));
  if (hasContact && /^[\p{L} .’'-]{3,80}$/u.test(first) && first.split(/\s+/).length <= 6) {
    const parts = first.split(/\s+/);
    header.firstName = parts.shift();
    header.lastName = parts.join(' ');
    lines.shift();
  }
  const remaining = [];
  const links = [];
  for (const line of lines) {
    let rest = line;
    rest = rest.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, value => {
      if (header.email) return value;
      header.email = value; return '';
    });
    rest = rest.replace(/(?:\+?\d[\d ().-]{7,}\d)/g, value => {
      if (header.phone) return value;
      header.phone = value.trim(); return '';
    });
    rest = rest.replace(/(?:https?:\/\/|www\.|linkedin\.com\/|[\w-]+\.github\.io\/)[^\s|]+/gi, value => {
      links.push(value); return '';
    });
    rest = rest.replace(/^[\s|,]+|[\s|,]+$/g, '').trim();
    const location = rest.match(/^([\p{L} .'-]+),\s*([\p{L} ]+?)(?:\s+(\d{5}(?:-\d{4})?))?$/u);
    if (location && !header.city && header.firstName) {
      header.city = location[1]; header.state = location[2]; header.zip = location[3] ?? '';
    } else if (rest) remaining.push(rest);
  }
  if (links.length) header.link = links.join(' | ');
  return { header, remaining: remaining.join('\n') };
}

export function parseResumeText(text = '') {
  const result = { importedText: '', summary: '', skills: '', education: [], experience: [], projects: [] };
  const blocks = {};
  let key = 'importedText';
  for (const line of text.replace(/\r/g, '').split('\n')) {
    const heading = headingKey(line);
    if (heading) key = heading;
    else (blocks[key] ??= []).push(line);
  }
  for (const [field, lines] of Object.entries(blocks)) {
    if (['education', 'experience', 'projects'].includes(field)) result[field] = importEntries(lines, field);
    else if (field === 'summary') result[field] = lines.map(line => line.trim()).filter(Boolean).join(' ');
    else if (field === 'skills') {
      const skills = [];
      for (const raw of lines) {
        const line = raw.trim();
        if (!line) continue;
        if (bulletLine.test(line) || !skills.length) skills.push(line.replace(bulletLine, ''));
        else skills[skills.length - 1] += ' ' + line;
      }
      result[field] = skills.join('\n');
    } else result[field] = lines.join('\n').trim();
  }
  const { header, remaining } = extractResumeHeader(result.importedText);
  result.header = header;
  result.importedText = remaining;
  return result;
}
