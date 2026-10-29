import {templateColors} from './resume-templates.js';
import {safeResumePhoto} from './resume-model.js';
// Uses local fonts and local resume data; no upload is required.
export function createResumePDF(model,JsPDF){
  const pdf=new JsPDF({unit:'mm',format:'letter'});
  const design=model.design||{};
  const font=(design.font||design.template)==='classic'||!design.template?'times':'helvetica';
  const size=design.size==='small'?10:design.size==='large'?12:11;
  const gap=design.spacing==='tight'?2:design.spacing==='relaxed'?5:3;
  const margin=design.margins==='narrow'?12:design.margins==='wide'?24:18;
  const fullLeft=margin,fullRight=216-margin,bottom=279-margin;
  let left=fullLeft,right=fullRight,width=right-left;
  const accent=templateColors.find(color=>color.id===design.color)?.hex||'#222222';
  let y=19;
  const clean=text=>String(text||'').replace(/\t/g,' ').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'');
  function room(height){if(y+height>bottom){const page=pdf.getCurrentPageInfo().pageNumber+1;if(page>pdf.getNumberOfPages())pdf.addPage();else pdf.setPage(page);y=19;}}
  function text(value,{bold=false,pt=size,indent=0,align='left'}={}){
    if(!value)return;
    pdf.setFont(font,bold?'bold':'normal');pdf.setFontSize(pt);
    const lines=pdf.splitTextToSize(clean(value),width-indent);
    const lineHeight=pt*.43;
    for(const line of lines){room(lineHeight);pdf.text(line,align==='center'?108:left+indent,y,{align});y+=lineHeight;}
  }
  if(design.hasPhoto&&safeResumePhoto(model.photo)){pdf.addImage(model.photo,model.photo.startsWith('data:image/png')?'PNG':'JPEG',98,y,20,20);y+=24;}
  pdf.setTextColor(accent);
  text(model.name,{bold:true,pt:22,align:design.template==='modern'?'left':'center'});
  pdf.setTextColor('#111111');
  y+=1;text(model.contact,{pt:9,align:design.template==='modern'?'left':'center'});y+=4;
  pdf.setDrawColor(accent);pdf.line(left,y,right,y);y+=3;
  const startY=y;const startPage=pdf.getCurrentPageInfo().pageNumber;
  function drawSections(sections){for(const section of sections){
    room(18);y+=gap;pdf.setTextColor(accent);text(section.title,{bold:true,pt:11});pdf.setTextColor('#111111');
    if(design.graphics){pdf.setDrawColor(accent);pdf.line(left,y,right,y);y+=4;}y+=1;
    for(const entry of section.entries){
      room(15);
      pdf.setFont(font,'bold');pdf.setFontSize(size);
      const titleWidth=pdf.getTextWidth(clean(entry.title));
      pdf.setFont(font,'normal');pdf.setFontSize(9);
      const dateWidth=pdf.getTextWidth(clean(entry.dates));
      if(entry.title&&entry.dates&&titleWidth+dateWidth+8<width){
        const startY=y;text(entry.title,{bold:true});pdf.setFont(font,'normal');pdf.setFontSize(9);pdf.text(clean(entry.dates),right,startY,{align:'right'});
      }else{if(entry.title)text(entry.title,{bold:true});if(entry.dates)text(entry.dates,{pt:9});}
      if(entry.organization)text(entry.organization);
      if(entry.text)text(entry.text);
      for(const bullet of entry.bullets||[]){
        pdf.setFont(font,'normal');pdf.setFontSize(size);
        const lines=pdf.splitTextToSize(clean(bullet),width-5);
        lines.forEach((line,index)=>{room(size*.43);if(index===0)pdf.text('•',left,y);pdf.text(line,left+5,y);y+=size*.43;});
        y+=.6;
      }
      y+=gap;
    }
  }
  }
  if(design.columns===2){
    const sideKeys=['skills','languages','certifications','awards','activities','references'];
    const sections=model.sections||[];
    right=fullLeft+(fullRight-fullLeft)*.32;width=right-left;drawSections(sections.filter(section=>sideKeys.includes(section.key)));
    pdf.setPage(startPage);y=startY;left=right+8;right=fullRight;width=right-left;drawSections(sections.filter(section=>!sideKeys.includes(section.key)));
  }else drawSections(model.sections||[]);
  pdf.setProperties({title:(model.name||'My')+' resume',creator:'Commencely'});
  return pdf;
}
export function downloadResumePDF(model){
  if(!window.jspdf?.jsPDF)throw new Error('PDF library unavailable');
  const pdf=createResumePDF(model,window.jspdf.jsPDF);
  const name=(model.name||'My').replace(/[^\p{L}\p{N} -]/gu,'').trim().replace(/\s+/g,'-');
  pdf.save((name||'My')+'-resume.pdf');
}
