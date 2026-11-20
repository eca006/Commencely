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
  const accent=design.color==='default'||!design.color?'#222222':templateColors.find(color=>color.id===design.color)?.hex||'#222222';
  let y=19;
  const clean=text=>String(text||'').replace(/\t/g,' ').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'');
  function room(height){if(y+height>bottom){const page=pdf.getCurrentPageInfo().pageNumber+1;if(page>pdf.getNumberOfPages())pdf.addPage();else pdf.setPage(page);y=19;}}
  function text(value,{bold=false,pt=size,indent=0,align='left'}={}){
    if(!value)return;
    pdf.setFont(font,bold?'bold':'normal');pdf.setFontSize(pt);
    const lines=pdf.splitTextToSize(clean(value),width-indent);
    const lineHeight=pt*.43;
    for(const line of lines){room(lineHeight);pdf.text(line,align==='center'?left+width/2:align==='right'?right:left+indent,y,{align});y+=lineHeight;}
  }
  if(design.hasPhoto&&safeResumePhoto(model.photo)){pdf.addImage(model.photo,model.photo.startsWith('data:image/png')?'PNG':'JPEG',98,y,20,20);y+=24;}
  const headerStyle = design.headerStyle || 'standard';
  const headerAlign = design.headerAlign || (design.template === 'modern' ? 'left' : 'center');
  const headerTop = y;
  const headerWidth = width;
  const panel = headerStyle === 'band' || headerStyle === 'frame';
  const band = headerStyle === 'band';
  if (panel) {
    const innerWidth = width - 10;
    const countLines = (value, pt, variant) => {
      pdf.setFont(font, variant); pdf.setFontSize(pt);
      return value ? pdf.splitTextToSize(clean(value), innerWidth).length : 0;
    };
    const height = 10 + countLines(model.name, 22, 'bold') * 9.46 + countLines(model.contact, 9, 'normal') * 3.87;
    pdf.setDrawColor(accent); pdf.setFillColor(accent);
    pdf.rect(fullLeft, y - 7, width, height, band ? 'F' : 'S');
    left += 5; right -= 5; width -= 10;
  } else if (headerStyle === 'top-rule') {
    pdf.setFillColor(accent); pdf.rect(left, y - 7, width, 2, 'F'); y += 2;
  } else if (headerStyle === 'accent') {
    left += 5; width -= 5;
  } else if (headerStyle === 'split') {
    right = fullLeft + headerWidth * .54; width = right - left;
  }

  pdf.setTextColor(band ? '#ffffff' : accent);
  text(model.name, { bold: true, pt: 22, align: headerAlign });
  pdf.setTextColor(band ? '#ffffff' : '#111111');
  if (headerStyle === 'split') {
    const nameBottom = y;
    left = fullLeft + headerWidth * .58;
    right = fullRight; width = right - left; y = headerTop;
    text(model.contact, { pt: 9, align: 'right' });
    y = Math.max(y, nameBottom);
  } else {
    y += 1; text(model.contact, { pt: 9, align: headerAlign });
  }
  pdf.setTextColor('#111111'); pdf.setDrawColor(accent);
  left = fullLeft; right = fullRight; width = headerWidth; y += 4;
  if (headerStyle === 'accent') {
    pdf.setFillColor(accent); pdf.rect(left, headerTop - 6, 1.5, y - headerTop + 3, 'F');
  } else if (['standard', 'double-rule', 'split'].includes(headerStyle)) {
    pdf.line(left, y, right, y);
    if (headerStyle === 'double-rule') pdf.line(left, y + 1.2, right, y + 1.2);
  }
  y += 3;
  const startY=y;const startPage=pdf.getCurrentPageInfo().pageNumber;
  function drawSections(sections){for(const section of sections){
    room(18);y+=gap;
    if (design.sectionStyle === 'label') {
      pdf.setFillColor('#eeeeee'); pdf.rect(left, y - 4, width, 6, 'F');
    }
    pdf.setTextColor(accent);text(section.title,{bold:true,pt:11});pdf.setTextColor('#111111');
    if(design.graphics||design.sectionStyle==='ruled'){pdf.setDrawColor(accent);pdf.line(left,y,right,y);y+=4;}y+=1;
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
    const sidebar = sections.filter(section => sideKeys.includes(section.key));
    const main = sections.filter(section => !sideKeys.includes(section.key));
    const sidebarWidth = headerWidth * .32;
    if (design.sidebar === 'right') {
      right = fullRight - sidebarWidth - 8; width = right - left; drawSections(main);
      pdf.setPage(startPage); y = startY; left = fullRight - sidebarWidth; right = fullRight; width = right - left;
      drawSections(sidebar);
    } else {
      right = fullLeft + sidebarWidth; width = right - left; drawSections(sidebar);
      pdf.setPage(startPage); y = startY; left = right + 8; right = fullRight; width = right - left;
      drawSections(main);
    }
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
