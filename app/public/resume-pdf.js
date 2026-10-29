// Uses local fonts and local resume data; no upload is required.
export function createResumePDF(model,JsPDF){
  const pdf=new JsPDF({unit:'mm',format:'letter'});
  const design=model.design||{};
  const font=design.template==='classic'||!design.template?'times':'helvetica';
  const size=design.size==='small'?10:design.size==='large'?12:11;
  const gap=design.spacing==='tight'?2:design.spacing==='relaxed'?5:3;
  const left=18,right=198,bottom=260,width=right-left;
  let y=19;
  const clean=text=>String(text||'').replace(/\t/g,' ').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'');
  function room(height){if(y+height>bottom){pdf.addPage();y=19;}}
  function text(value,{bold=false,pt=size,indent=0,align='left'}={}){
    if(!value)return;
    pdf.setFont(font,bold?'bold':'normal');pdf.setFontSize(pt);
    const lines=pdf.splitTextToSize(clean(value),width-indent);
    const lineHeight=pt*.43;
    for(const line of lines){room(lineHeight);pdf.text(line,align==='center'?108:left+indent,y,{align});y+=lineHeight;}
  }
  text(model.name,{bold:true,pt:22,align:design.template==='modern'?'left':'center'});
  y+=1;text(model.contact,{pt:9,align:design.template==='modern'?'left':'center'});y+=4;
  pdf.setDrawColor(65);pdf.line(left,y,right,y);y+=3;
  for(const section of model.sections||[]){
    room(18);y+=gap;text(section.title,{bold:true,pt:11});y+=1;
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
  pdf.setProperties({title:(model.name||'My')+' resume',creator:'Commencely'});
  return pdf;
}
export function downloadResumePDF(model){
  if(!window.jspdf?.jsPDF)throw new Error('PDF library unavailable');
  const pdf=createResumePDF(model,window.jspdf.jsPDF);
  const name=(model.name||'My').replace(/[^\p{L}\p{N} -]/gu,'').trim().replace(/\s+/g,'-');
  pdf.save((name||'My')+'-resume.pdf');
}
