import {resumeTemplates,templateColors,careerFields,filterTemplates,templateDesign,templateSample} from './resume-templates.js';
import {resumeMarkup,resumeDesignClasses} from './resume-model.js';
export function initResumePicker({filters={},getDesign,setDesign,onChoose,onStage}){
  const state={hasPhoto:'',hasGraphics:'',columns:'',fields:[],...filters};
  let filtered=[],previewIndex=0,recommendationStep=0;
  const previewDialog=document.querySelector('#template-dialog');
  const recommendations=document.querySelector('#recommendation-dialog');
  const palette=()=>getDesign().color||'default';
  function colors(container){
    container.replaceChildren();
    for(const color of templateColors){const button=document.createElement('button');button.type='button';button.className='color-swatch';button.style.backgroundColor=color.hex;button.title=color.name;button.setAttribute('aria-label',color.name);button.setAttribute('aria-pressed',String(palette()===color.id));button.addEventListener('click',()=>{setDesign({...getDesign(),color:color.id});render();if(previewDialog.open)renderPreview();if(recommendations.open)renderRecommendation();});container.append(button);}
  }
  function render(){
    filtered=filterTemplates(state);
    for(const [key,id] of [['hasPhoto','filter-photo'],['hasGraphics','filter-graphics'],['columns','filter-columns']])document.getElementById(id).value=state[key];
    colors(document.querySelector('#picker-colors'));
    document.querySelector('#template-count').textContent='Showing '+filtered.length+' template'+(filtered.length===1?'':'s');
    const chips=document.querySelector('#active-template-filters');chips.replaceChildren();
    const labels={hasPhoto:state.hasPhoto==='true'?'With photo':'Without photo',hasGraphics:state.hasGraphics==='true'?'With section rules':'Without section rules',columns:state.columns+' column'+(state.columns==='2'?'s':'')};
    for(const key of ['hasPhoto','hasGraphics','columns'])if(state[key]){const button=document.createElement('button');button.type='button';button.textContent='Remove '+labels[key];button.addEventListener('click',()=>{state[key]='';render();});chips.append(button);}
    for(const field of state.fields){const button=document.createElement('button');button.type='button';button.textContent='Remove '+field;button.addEventListener('click',()=>{state.fields=state.fields.filter(item=>item!==field);render();});chips.append(button);}
    if(chips.children.length){const clear=document.createElement('button');clear.type='button';clear.textContent='Clear all filters';clear.addEventListener('click',clearFilters);chips.append(clear);}
    const grid=document.querySelector('#template-grid');grid.replaceChildren();
    if(!filtered.length){const text=document.createElement('p');text.textContent='No templates match these filters. Remove a filter or clear all to see more layouts.';grid.append(text);}
    filtered.forEach((template,index)=>{
      const card=document.createElement('div');card.className='template-card';
      const paper=document.createElement('div');paper.className='template-thumbnail resume-document '+resumeDesignClasses(templateDesign(template.id,palette()));paper.innerHTML=resumeMarkup({...templateSample,design:templateDesign(template.id,palette())});paper.setAttribute('aria-hidden','true');
      const preview=document.createElement('button');preview.type='button';preview.className='template-preview-button';preview.textContent='Preview';preview.setAttribute('aria-label','Preview '+template.name);preview.addEventListener('click',()=>{previewIndex=index;renderPreview();previewDialog.showModal();});
      const choose=document.createElement('button');choose.type='button';choose.textContent='Choose template';choose.setAttribute('aria-label','Choose '+template.name+' template');choose.addEventListener('click',()=>chooseTemplate(template));card.append(paper,preview,choose);grid.append(card);
    });
    onStage(null,{...state,fields:[...state.fields]});
  }
  function clearFilters(){Object.assign(state,{hasPhoto:'',hasGraphics:'',columns:'',fields:[]});render();}
  function chooseTemplate(template){setDesign(templateDesign(template.id,palette(),getDesign()));if(previewDialog.open)previewDialog.close();onChoose();}
  function renderPreview(){
    if(!filtered.length)return;previewIndex=(previewIndex+filtered.length)%filtered.length;
    const template=filtered[previewIndex];const design=templateDesign(template.id,palette());
    document.querySelector('#template-position').textContent=(previewIndex+1)+' of '+filtered.length;
    document.querySelector('#template-dialog-title').textContent=template.name;document.querySelector('#template-tags').textContent=template.tags.join(' · ');
    const paper=document.querySelector('#template-large');paper.className='resume-document '+resumeDesignClasses(design);paper.innerHTML=resumeMarkup({...templateSample,design});
    const details=document.querySelector('#template-details');details.replaceChildren();
    for(const text of [template.columns+' column'+(template.columns===2?'s':''),'Editable text and section order','Selectable text in PDF exports','PDF, Word, HTML, and TXT downloads',template.hasPhoto?'Optional photo area; add your own photo':'No photo']){const item=document.createElement('li');item.textContent=text;details.append(item);}colors(document.querySelector('#modal-colors'));
  }
  for(const [key,id] of [['hasPhoto','filter-photo'],['hasGraphics','filter-graphics'],['columns','filter-columns']])document.getElementById(id).addEventListener('change',event=>{state[key]=event.target.value;render();});
  document.querySelector('#template-previous').addEventListener('click',()=>{previewIndex--;renderPreview();});document.querySelector('#template-next').addEventListener('click',()=>{previewIndex++;renderPreview();});
  document.querySelector('#close-template-preview').addEventListener('click',()=>previewDialog.close());document.querySelector('#use-template').addEventListener('click',()=>chooseTemplate(filtered[previewIndex]));
  document.querySelector('#intro-continue').addEventListener('click',()=>{onStage('templates');render();recommendationStep=0;renderRecommendation();recommendations.showModal();});document.querySelector('#picker-back').addEventListener('click',()=>onStage('intro'));
  document.querySelector('#open-recommendations').addEventListener('click',()=>{recommendationStep=0;renderRecommendation();recommendations.showModal();});
  for(const id of ['close-recommendations','recommendation-skip'])document.getElementById(id).addEventListener('click',()=>recommendations.close());
  document.querySelector('#recommendation-back').addEventListener('click',()=>{recommendationStep=Math.max(0,recommendationStep-1);renderRecommendation();});
  document.querySelector('#recommendation-next').addEventListener('click',()=>{if(recommendationStep===3){recommendations.close();return;}recommendationStep++;renderRecommendation();});
  function renderRecommendation(){
    document.querySelector('#recommendation-progress').textContent='Question '+(recommendationStep+1)+' of 4';document.querySelector('#recommendation-back').disabled=recommendationStep===0;document.querySelector('#recommendation-next').textContent=recommendationStep===3?'Show results':'Next';
    const content=document.querySelector('#recommendation-content');content.replaceChildren();const heading=document.createElement('h3');heading.textContent=['Pick a color','Include a photo?','Choose a layout','What fields interest you?'][recommendationStep];content.append(heading);
    if(recommendationStep===0){const note=document.createElement('p');note.textContent='You can change colors anytime.';const options=document.createElement('div');options.className='color-options';colors(options);content.append(note,options);}
    if(recommendationStep===1||recommendationStep===2){const key=recommendationStep===1?'hasPhoto':'columns';const choices=recommendationStep===1?[['true','With an optional photo'],['false','Without a photo']]:[['1','One column — a single reading order'],['2','Two columns — a side column for skills and extras']];for(const [value,label] of choices){const button=document.createElement('button');button.type='button';button.textContent=label;button.setAttribute('aria-pressed',String(state[key]===value));button.addEventListener('click',()=>{state[key]=value;render();renderRecommendation();});content.append(button);}}
    if(recommendationStep===3){const list=document.createElement('div');list.className='career-field-list';for(const field of careerFields){const label=document.createElement('label');const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=state.fields.includes(field);label.append(checkbox,document.createTextNode(field));checkbox.addEventListener('change',()=>{state.fields=checkbox.checked?[...state.fields,field]:state.fields.filter(item=>item!==field);render();});list.append(label);}content.append(list);}
  }
  render();return {render,getFilters:()=>({...state,fields:[...state.fields]})};
}
