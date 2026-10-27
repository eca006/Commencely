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
.resume-document{box-sizing:border-box;background:#fff;color:#20252b;font:14px/1.55 Arial,sans-serif;padding:42px 46px;border:1px solid #d9dde3;max-width:794px;margin:24px auto;overflow-wrap:anywhere;box-shadow:0 3px 14px #15233b0d}
.resume-document .resume-header{border-bottom:2px solid #283d54;padding-bottom:16px;margin-bottom:22px}
.resume-document h1{font-size:28px;line-height:1.2;letter-spacing:.015em;margin:0 0 9px}
.resume-document .resume-contact{font-size:12px;color:#4a5563;margin:3px 0}
.resume-document h2{font-size:12px;text-transform:uppercase;letter-spacing:.1em;color:#283d54;border-bottom:1px solid #d9dde3;padding-bottom:6px;margin:25px 0 12px;break-after:avoid}
.resume-document p{margin:7px 0;white-space:pre-wrap}
.resume-document .resume-entry{font-weight:600;margin-top:14px;break-after:avoid}
.resume-document ul{padding-left:19px;margin:7px 0 14px}
.resume-document li{padding-left:3px;margin:5px 0;white-space:pre-wrap}
.resume-document li p{margin:0}
@media(max-width:600px){.resume-document{padding:24px 20px;font-size:13px}.resume-document h1{font-size:24px}}
@media print{.resume-document{max-width:none;margin:0!important;padding:0!important;border:0!important;box-shadow:none;font-size:10.5pt}.resume-document h1{font-size:22pt}.resume-document h2{font-size:10pt}.resume-document p,.resume-document li{orphans:2;widows:2}@page{margin:18mm}}
`;
const sectionHeading = text => /^(profile|summary|professional summary|objective|education|experience|work experience|professional experience|employment|employment history|projects|selected projects|selected AI and business technology projects|skills|technical skills|technical and analytical skills|certifications|certificates|awards|volunteer experience|volunteering|activities|leadership|references)$/i.test(text.trim());
const bullet = text => /^[•●▪‣*–-]\s+/.test(text);
export function resumeMarkup({name='',contact='',body=''}={}){
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
