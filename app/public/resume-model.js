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
  if(clean(answers.summary))sections.push({key:'profile',title:'PROFILE',entries:[{key:0,text:clean(answers.summary)}]});
  for(const [kind,title,titleField,organizationField,textField] of [
    ['education','EDUCATION','qualification','school','notes'],
    ['experience','EXPERIENCE','role','organization',null],
    ['projects','PROJECTS','title','context',null]
  ]){
    const entries=(answers[kind]||[]).map((item,index)=>({key:index,title:clean(item[titleField]),organization:clean(item[organizationField]),dates:clean(item.dates),text:textField?clean(item[textField]):'',bullets:(kind==='experience'?[...lines(item.tasks),...lines(item.results)]:kind==='projects'?lines(item.contribution):[]).map(line=>line.replace(/^[•*]\s+/,''))})).filter(item=>item.title||item.organization||item.dates||item.text||item.bullets.length);
    if(entries.length)sections.push({key:kind,title,entries});
  }
  if(lines(answers.skills).length)sections.push({key:'skills',title:'SKILLS',entries:[{key:0,bullets:lines(answers.skills).map(line=>line.replace(/^[•*]\s+/,''))}]});
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
  const node=(tag,text,path,className='')=>'<'+tag+' data-resume-path="'+path+'"'+(className?' class="'+className+'"':'')+'>'+escape(text)+'</'+tag+'>';
  if(name||contact)output.push('<header class="resume-header">'+(name?node('h1',name,'name'):'')+(contact?node('p',contact,'contact','resume-contact'):'')+'</header>');
  sections.forEach((section,sectionIndex)=>{
    const sectionPath='sections.'+(section.key??sectionIndex);
    output.push('<section class="resume-section">'+node('h2',section.title,sectionPath+'.title'));
    section.entries.forEach((entry,entryIndex)=>{
      const path=sectionPath+'.entries.'+(entry.key??entryIndex);
      output.push('<div class="resume-record">');
      if(entry.title||entry.dates)output.push('<div class="resume-entry-heading">'+(entry.title?node('p',entry.title,path+'.title','resume-entry-title'):'')+(entry.dates?node('p',entry.dates,path+'.dates','resume-dates'):'')+'</div>');
      if(entry.organization)output.push(node('p',entry.organization,path+'.organization','resume-organization'));
      if(entry.text)output.push(node('p',entry.text,path+'.text'));
      if(entry.bullets?.length)output.push('<ul>'+entry.bullets.map((line,index)=>node('li',line,path+'.bullets.'+index)).join('')+'</ul>');
      output.push('</div>');
    });
    output.push('</section>');
  });
  return output.join('\n');
}

function professionalCapitalization(text){
  const terms={excel:'Excel',powerpoint:'PowerPoint',microsoft:'Microsoft',word:'Word',google:'Google',linkedin:'LinkedIn',javascript:'JavaScript',html:'HTML',css:'CSS',sql:'SQL',python:'Python',cpr:'CPR',ged:'GED',gpa:'GPA'};
  return text.replace(/c#/gi,'C#').replace(/\b(excel|powerpoint|microsoft|word|google|linkedin|javascript|html|css|sql|python|cpr|ged|gpa)\b/gi,word=>terms[word.toLowerCase()]);
}
function fixCommonSpelling(text=''){
  const corrections={univeristy:'university',universtiy:'university',universiy:'university',assitant:'assistant',assisstant:'assistant',managment:'management',manger:'manager',buisness:'business',bussiness:'business',analitics:'analytics',anayltics:'analytics',comunication:'communication',communciation:'communication',orginized:'organized',schedual:'schedule',schedualed:'scheduled',maintianed:'maintained',developement:'development'};
  return text.replace(/\b(univeristy|universtiy|universiy|assitant|assisstant|managment|manger|buisness|bussiness|analitics|anayltics|comunication|communciation|orginized|schedual|schedualed|maintianed|developement)\b/gi,word=>corrections[word.toLowerCase()]);
}
function headingCapitalization(text=''){
  const minor=new Set(['of','and','in','at','for','the','to','or','a','an']);
  return professionalCapitalization(fixCommonSpelling(text).trim().split(/(\s+)/).map((word,index)=>{
    if(!word.trim())return word;
    if(index>0&&minor.has(word.toLowerCase()))return word.toLowerCase();
    return word.charAt(0).toUpperCase()+word.slice(1).replace(/(['’])S\b/g,'$1s');
  }).join(''));
}
function capitalizeMonths(text=''){
  return text.replace(/\b(january|february|march|april|may|june|july|august|september|october|november|december|present|expected)\b/gi,word=>word.charAt(0).toUpperCase()+word.slice(1).toLowerCase());
}
// Apply narrow corrections only where the intended grammar is unambiguous.
export function correctResumeGrammar(text=''){
  return fixCommonSpelling(text)
    .replace(/\b(i) (?:is|are)\b/gi,'I am')
    .replace(/\b(i) were\b/gi,'I was')
    .replace(/\b(i) has\b/gi,'I have')
    .replace(/\b(they|we|you) was\b/gi,'$1 were')
    .replace(/\b(they|we|you) has\b/gi,'$1 have')
    .replace(/\b(he|she|it) have\b/gi,'$1 has')
    .replace(/\b(did(?: not|n['’]t)?|does(?: not|n['’]t)?|do(?: not|n['’]t)?) (helped|worked|managed|organized|created|assisted|used|answered|handled|supported)\b/gi,(_,aux,verb)=>aux+' '+({helped:'help',worked:'work',managed:'manage',organized:'organize',created:'create',assisted:'assist',used:'use',answered:'answer',handled:'handle',supported:'support'}[verb.toLowerCase()]))
    .replace(/\b(responsable|responsibile)\b/gi,'responsible')
    .replace(/\b(costumer service)\b/gi,'customer service')
    .replace(/\brecieve\b/gi,'receive').replace(/\brecieved\b/gi,'received')
    .replace(/\bexperiance\b/gi,'experience')
    .replace(/\b(an) (team|customer|project|resume|school)\b/gi,'a $2')
    .replace(/\b(a) (employee|organization|office|interview|internship|assistant|award)\b/gi,'an $2')
    .replace(/[ \t]+([,.;:!?])/g,'$1')
    .replace(/([,;:!?])(?=[A-Za-z])/g,'$1 ')
    .replace(/\b(the|and|with|for|to)\s+\1\b/gi,'$1');
}
export function cleanResumeWording(text=''){
  return text.split('\n').map(line=>{
    let value=correctResumeGrammar(line).trim().replace(/^[•*–-]\s*/, '').replace(/[ \t]+/g,' ');
    if(!value)return '';
    value=value.replace(/^i (?:was|am) responsible for\s+/i,'Responsible for ')
      .replace(/^i (?:was|am) in charge of\s+/i,'Handled ')
      .replace(/^i\s+(?!(?:am|was|have|had|can|could|may|might|must|should|would|will|do|did|don['’]t|didn['’]t)\b)/i,'');
    const replacements=[[/^help(?:ed)? (?:out )?with\s+/i,'Assisted with '],[/^worked (?:(?:at|on) )?(?:the )?cash register\b/i,'Operated the cash register'],[/^talked to customers\b/i,'Communicated with customers'],[/^answered (?:the )?phones\b/i,'Answered phone calls'],[/^put away supplies\b/i,'Organized and stored supplies'],[/^made (?:an? )?spreadsheet\b/i,'Created a spreadsheet'],[/^made (?:an? )?presentation\b/i,'Created a presentation'],[/^kept (?:the )?work area clean\b/i,'Maintained a clean work area'],[/^took care of\s+/i,'Cared for ']];
    for(const [pattern,replacement] of replacements)value=value.replace(pattern,replacement);
    value=professionalCapitalization(value).replace(/\bi\b/g,'I');
    value=value.replace(/([.!?]\s+)([a-z])/g,(_,space,letter)=>space+letter.toUpperCase());
    value=value.charAt(0).toUpperCase()+value.slice(1);
    return /[.!?:;]$/.test(value)?value:value+'.';
  }).join('\n');
}
export function suggestedGuidedResume(answers){
  const copy={...answers,name:headingCapitalization(answers.name||''),city:headingCapitalization(answers.city||''),summary:cleanResumeWording(answers.summary||''),skills:professionalCapitalization(answers.skills||'').split('\n').map(line=>line.charAt(0).toUpperCase()+line.slice(1)).join('\n')};
  for(const [kind,fields] of [['education',['notes']],['experience',['tasks','results']],['projects',['contribution']]])copy[kind]=(answers[kind]||[]).map(entry=>{
    const result={...entry};
    if(typeof result.dates==='string')result.dates=capitalizeMonths(result.dates);
    for(const field of fields)result[field]=cleanResumeWording(typeof entry[field]==='string'?entry[field]:'').split('\n').map(line=>line.replace(/[.]+$/,'')).join('\n');
    for(const field of ['school','qualification','role','organization','title','context'])if(typeof result[field]==='string')result[field]=headingCapitalization(result[field]);
    return result;
  });
  return buildGuidedResume(copy);
}
export function guidedBody(sections=[]){
  return sections.map(section=>[section.title,...section.entries.map(entry=>[entry.title,entry.organization,entry.dates,entry.text,...(entry.bullets||[]).map(line=>'• '+line)].filter(Boolean).join('\n'))].join('\n\n')).join('\n\n');
}
export function applyResumeEdits(model,edits={}){
  const result=JSON.parse(JSON.stringify(model));
  for(const [path,text] of Object.entries(edits)){
    if(typeof text!=='string'||text.length>5000)continue;
    const parts=path.split('.');
    if(parts.length===1&&['name','contact'].includes(path)){result[path]=text;continue;}
    if(!/^sections\.(?:\d+|profile|education|experience|projects|skills)\.(title|entries\.\d+\.(title|organization|dates|text|bullets\.\d+))$/.test(path))continue;
    const sectionIndex=/^\d+$/.test(parts[1])?Number(parts[1]):result.sections.findIndex(section=>section.key===parts[1]);
    if(sectionIndex<0||!result.sections[sectionIndex])continue;parts[1]=String(sectionIndex);
    if(parts[2]==='entries'){const index=result.sections[sectionIndex].entries.findIndex((entry,index)=>(entry.key??index)===Number(parts[3]));if(index<0)continue;parts[3]=String(index);}
    let target=result;
    for(const part of parts.slice(0,-1))target=target?.[part];
    const key=parts.at(-1);if(target&&Object.hasOwn(target,key))target[key]=text;
  }
  result.body=guidedBody(result.sections);return result;
}
