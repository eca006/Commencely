import {safeResumePhoto} from './resume-model.js';
import {templateColors} from './resume-templates.js';
export function buildResumeWord(model,api){
  const {Document,Paragraph,TextRun,Table,TableRow,TableCell,WidthType,BorderStyle}=api;
  const design=model.design||{};const font=(design.font||design.template)==='classic'?'Times New Roman':'Arial';
  const size=design.size==='small'?20:design.size==='large'?24:22;
  const accent=(templateColors.find(color=>color.id===design.color)?.hex||'#222222').slice(1);
  const space=design.spacing==='tight'?60:design.spacing==='relaxed'?180:100;
  const paragraph=(text,options={})=>new Paragraph({children:[new TextRun({text:String(text||''),font,size,...options})],spacing:{after:space},...(options.bullet?{bullet:{level:0}}:{})});
  function sections(items){return items.flatMap(section=>[
    paragraph(section.title,{bold:true,color:accent}),
    ...section.entries.flatMap(entry=>[
      ...(entry.title?[paragraph(entry.title,{bold:true})]:[]),...(entry.dates?[paragraph(entry.dates,{size:18})]:[]),...(entry.organization?[paragraph(entry.organization)]:[]),...(entry.text?entry.text.split('\n').map(line=>paragraph(line)):[]),...(entry.bullets||[]).map(line=>paragraph(line,{bullet:true}))
    ])
  ]);}
  const children=[paragraph(model.name,{bold:true,size:40,color:accent}),paragraph(model.contact,{size:18})];
  if(design.hasPhoto&&safeResumePhoto(model.photo)){const data=Uint8Array.from(atob(model.photo.split(',')[1]),char=>char.charCodeAt(0));children.unshift(new Paragraph({children:[new api.ImageRun({data,type:model.photo.startsWith('data:image/png')?'png':'jpg',transformation:{width:70,height:70}})]}));}
  if(design.columns===2){
    const side=['skills','languages','certifications','awards','activities','references'];
    const noBorder={style:BorderStyle.NONE,size:0,color:'FFFFFF'};
    children.push(new Table({width:{size:100,type:WidthType.PERCENTAGE},borders:{top:noBorder,bottom:noBorder,left:noBorder,right:noBorder,insideHorizontal:noBorder,insideVertical:noBorder},rows:[new TableRow({children:[new TableCell({width:{size:32,type:WidthType.PERCENTAGE},children:sections((model.sections||[]).filter(section=>side.includes(section.key)))}),new TableCell({width:{size:68,type:WidthType.PERCENTAGE},children:sections((model.sections||[]).filter(section=>!side.includes(section.key)))})]})]}));
  }else children.push(...sections(model.sections||[]));
  const margin=design.margins==='narrow'?680:design.margins==='wide'?1360:1020;
  return new Document({styles:{default:{document:{run:{font,size}}}},sections:[{properties:{page:{margin:{top:margin,bottom:margin,left:margin,right:margin}}},children}]});
}
export async function downloadResumeWord(model){
  if(!window.docx)await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='/vendor/docx.js';script.onload=resolve;script.onerror=reject;document.head.append(script);});
  const blob=await window.docx.Packer.toBlob(buildResumeWord(model,window.docx));const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='Commencely-resume.docx';link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
