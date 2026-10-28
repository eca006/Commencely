export const blankTemplate = 'EDUCATION\n\nEXPERIENCE\n\nPROJECTS\n\nSKILLS\n';
export function resumeText({name='',contact='',body=''}) {
  return [name,contact,body].filter(value=>value.trim()).join('\n\n');
}
export function hasResumeContent(model) {
  return !!model.body.trim() && model.body.trim() !== blankTemplate.trim();
}
export function validateResumeFile(file) {
  if (!/\.(pdf|docx|txt)$/i.test(file.name)) throw new Error('Choose a PDF, .docx, or .txt file. Older .doc files are not supported.');
  if (!file.size) throw new Error('This file is empty. Choose another file.');
  if (file.size > 5*1024*1024) throw new Error('This file is larger than 5 MB. Choose a smaller copy.');
  return file.name.split('.').pop().toLowerCase();
}
const escape = value => value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
// Shared by the on-screen preview and the formatted download.
export const resumeStyles = `
.resume-document{box-sizing:border-box;background:#fff;color:#111;font:15px/1.35 Georgia,"Times New Roman",serif;padding:40px 46px;border:1px solid #ddd;max-width:794px;margin:24px auto;overflow-wrap:anywhere;box-shadow:none}
.resume-document .resume-header{text-align:center;border-bottom:1px solid #111;padding-bottom:12px;margin-bottom:17px}
.resume-document h1{font:700 26px/1.2 Georgia,"Times New Roman",serif;letter-spacing:0;margin:0 0 7px}
.resume-document .resume-contact{font-size:12px;color:#111;margin:3px 0}
.resume-document h2{font:700 14px/1.3 Georgia,"Times New Roman",serif;letter-spacing:0;color:#111;border:0;padding:0;margin:19px 0 7px;break-after:avoid}
.resume-document p{margin:5px 0;white-space:pre-wrap}
.resume-document .resume-entry{font-weight:700;margin-top:11px;break-after:avoid}
.resume-document ul{padding-left:18px;margin:5px 0 10px}
.resume-document li{padding-left:1px;margin:3px 0;white-space:pre-wrap}
.resume-document li p{margin:0}
.resume-document .resume-entry-heading{display:flex;justify-content:space-between;align-items:baseline;gap:8px 20px;flex-wrap:wrap;margin-top:11px;break-after:avoid}
.resume-document .resume-entry-title{font-weight:700;margin:0}
.resume-document .resume-dates{font-weight:400;margin:0;font-size:.95em}
.resume-document .resume-organization{margin:2px 0 5px}

@media(max-width:600px){.resume-document{padding:24px 20px;font-size:14px}.resume-document h1{font-size:24px}}
@media print{.resume-document{max-width:none;margin:0!important;padding:0!important;border:0!important;box-shadow:none;font-size:11pt}.resume-document h1{font-size:20pt}.resume-document h2{font-size:11pt}.resume-document p,.resume-document li{orphans:2;widows:2}@page{margin:18mm}}
`;
const sectionHeading = text => /^(profile|summary|professional summary|objective|education|experience|work experience|professional experience|employment|employment history|projects|selected projects|selected AI and business technology projects|skills|technical skills|technical and analytical skills|certifications|certificates|awards|volunteer experience|volunteering|activities|leadership|references)$/i.test(text.trim());
const bullet = text => /^[•●▪‣*–-]\s+/.test(text);
export function resumeMarkup({name='',contact='',body='',sections}={}){
  if(Array.isArray(sections))return guidedMarkup({name,contact,sections});
  const lines=body.replace(/\r\n?/g,'\n').split('\n');
  let cursor=0;
  const output=[];
  const firstSection=lines.findIndex(sectionHeading);
  const firstLine=lines.findIndex(line=>line.trim());
  const canUseHeader=!name.trim()&&firstSection>firstLine&&firstLine>=0&&/^[\p{L} .’'-]{3,80}$/u.test(lines[firstLine].trim())&&lines[firstLine].trim().split(/\s+/).length<=5;
  const headerName=name.trim()||(canUseHeader?lines[firstLine].trim():'');
  const contacts=contact.trim()?[contact.trim()]:[];
  if(canUseHeader){
    cursor=firstSection;
    contacts.push(...lines.slice(firstLine+1,firstSection).map(line=>line.trim()).filter(Boolean));
  }
  if(headerName||contacts.length)output.push('<header class="resume-header">'+(headerName?'<h1>'+escape(headerName)+'</h1>':'')+contacts.map(line=>'<p class="resume-contact">'+escape(line)+'</p>').join('')+'</header>');
  let paragraph=[];let list=[];let item=[];
  const flushParagraph=()=>{if(paragraph.length){output.push('<p>'+escape(paragraph.join(' '))+'</p>');paragraph=[];}};
  const flushItem=()=>{if(item.length){list.push('<li>'+escape(item.join(' '))+'</li>');item=[];}};
  const flushList=()=>{flushItem();if(list.length){output.push('<ul>'+list.join('')+'</ul>');list=[];}};
  for(let i=cursor;i<lines.length;i++){
    const line=lines[i].trim();
    if(!line){flushParagraph();flushItem();continue;}
    if(sectionHeading(line)){flushParagraph();flushList();output.push('<h2>'+escape(line)+'</h2>');continue;}
    if(bullet(line)){flushParagraph();flushItem();item.push(line.replace(/^[•●▪‣*–-]\s+/,''));continue;}
    const next=lines.slice(i+1).find(value=>value.trim())?.trim()||'';
    const entry=(bullet(next)&&!item.length)||/\t| {2,}/.test(line)||(/\|/.test(line)&&line.length<140);
    if(entry){flushParagraph();flushList();output.push('<p class="resume-entry">'+escape(line)+'</p>');}
    else if(item.length)item.push(line);
    else{flushList();paragraph.push(line);}
  }
  flushParagraph();flushList();
  return output.join('\n');
}
export function resumeHTML(model={}) {
  return '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Resume</title><style>'+resumeStyles+'</style><article class="resume-document">'+resumeMarkup(model)+'</article></html>';
}

export function buildGuidedResume(answers={}){
  const clean=value=>typeof value==='string'?value.trim():'';
  const lines=value=>clean(value).split('\n').map(line=>line.trim()).filter(Boolean);
  const blocks=[];
  const sections=[];
  if(clean(answers.summary))sections.push({title:'PROFILE',entries:[{text:clean(answers.summary)}]});
  for(const [kind,title,titleField,organizationField,textField] of [
    ['education','EDUCATION','qualification','school','notes'],
    ['experience','EXPERIENCE','role','organization',null],
    ['projects','PROJECTS','title','context',null]
  ]){
    const entries=(answers[kind]||[]).map(item=>({title:clean(item[titleField]),organization:clean(item[organizationField]),dates:clean(item.dates),text:textField?clean(item[textField]):'',bullets:(kind==='experience'?[...lines(item.tasks),...lines(item.results)]:kind==='projects'?lines(item.contribution):[]).map(line=>line.replace(/^[•*]\s+/,''))})).filter(item=>item.title||item.organization||item.dates||item.text||item.bullets.length);
    if(entries.length)sections.push({title,entries});
  }
  if(lines(answers.skills).length)sections.push({title:'SKILLS',entries:[{bullets:lines(answers.skills).map(line=>line.replace(/^[•*]\s+/,''))}]});
  if(clean(answers.summary))blocks.push('PROFILE\n'+clean(answers.summary));
  const education=(answers.education||[]).map(item=>{
    const details=[clean(item.qualification),clean(item.school),clean(item.dates),clean(item.notes)].filter(Boolean);
    return details.join('\n');
  }).filter(Boolean);
  if(education.length)blocks.push('EDUCATION\n'+education.join('\n\n'));
  const experience=(answers.experience||[]).map(item=>{
    const details=[clean(item.role),clean(item.organization),clean(item.dates)].filter(Boolean);
    const bullets=[...lines(item.tasks),...lines(item.results)].map(line=>'• '+line.replace(/^[•*]\s+/,''));
    return [...details,...bullets].join('\n');
  }).filter(Boolean);
  if(experience.length)blocks.push('EXPERIENCE\n'+experience.join('\n\n'));
  const projects=(answers.projects||[]).map(item=>{
    const details=[clean(item.title),clean(item.context),clean(item.dates)].filter(Boolean);
    return [...details,...lines(item.contribution).map(line=>'• '+line.replace(/^[•*]\s+/,''))].join('\n');
  }).filter(Boolean);
  if(projects.length)blocks.push('PROJECTS\n'+projects.join('\n\n'));
  const skills=lines(answers.skills);
  if(skills.length)blocks.push('SKILLS\n'+skills.map(line=>'• '+line.replace(/^[•*]\s+/,'')).join('\n'));
  return {name:clean(answers.name),contact:['city','email','phone','link'].map(field=>clean(answers[field])).filter(Boolean).join(' | '),body:blocks.join('\n\n'),sections};
}

function guidedMarkup({name,contact,sections}){
  const output=[];
  if(name||contact)output.push('<header class="resume-header">'+(name?'<h1>'+escape(name)+'</h1>':'')+(contact?'<p class="resume-contact">'+escape(contact)+'</p>':'')+'</header>');
  for(const section of sections){
    output.push('<section><h2>'+escape(section.title)+'</h2>');
    for(const entry of section.entries){
      if(entry.title||entry.dates)output.push('<div class="resume-entry-heading">'+(entry.title?'<p class="resume-entry-title">'+escape(entry.title)+'</p>':'')+(entry.dates?'<p class="resume-dates">'+escape(entry.dates)+'</p>':'')+'</div>');
      if(entry.organization)output.push('<p class="resume-organization">'+escape(entry.organization)+'</p>');
      if(entry.text)output.push('<p>'+escape(entry.text)+'</p>');
      if(entry.bullets?.length)output.push('<ul>'+entry.bullets.map(line=>'<li>'+escape(line)+'</li>').join('')+'</ul>');
    }
    output.push('</section>');
  }
  return output.join('\n');
}
