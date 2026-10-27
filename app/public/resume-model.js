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
export function resumeHTML({name='',contact='',body=''} = {}) {
  const model={name,contact,body};
  return '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Resume</title><style>body{max-width:760px;margin:40px auto;padding:0 24px;font:12pt/1.5 Arial,sans-serif;color:#111}h1{font-size:22pt}pre{font:inherit;white-space:pre-wrap;overflow-wrap:anywhere}@media print{body{margin:0;max-width:none}@page{margin:18mm}}</style>' + (model.name.trim()?'<h1>'+escape(model.name)+'</h1>':'') + (model.contact.trim()?'<p>'+escape(model.contact)+'</p>':'') + '<pre>'+escape(model.body)+'</pre></html>';
}
