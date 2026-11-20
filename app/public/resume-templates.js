export const templateColors=[
  {id:'default',name:'White / default',hex:'#ffffff'}, {id:'asphalt',name:'Asphalt',hex:'#43484c'},
  {id:'taupe',name:'Taupe',hex:'#8b7669'}, {id:'navy',name:'Navy',hex:'#243e67'},
  {id:'blue',name:'Blue',hex:'#356baf'}, {id:'teal',name:'Teal',hex:'#167b85'},
  {id:'emerald',name:'Emerald',hex:'#286b54'}, {id:'gold',name:'Gold',hex:'#93651e'}, {id:'red',name:'Red',hex:'#a53540'}
];
export const careerFields=['Business & Finance','Healthcare','Tech & Data Science','Education','Legal','Sales','Management','Transport','Hospitality','Retail','Construction','Manufacturing','Creative & Design','Customer Service','Administration','Science','Public Service','Social Services','Agriculture','Student & Entry Level','Other'];
const baseTemplates=[
  {id:'classic',name:'Clear',tags:['Traditional','Simple'],hasPhoto:false,hasGraphics:false,columns:1,fields:['Business & Finance','Legal','Education','Administration'],font:'classic'},
  {id:'modern',name:'Outline',tags:['Modern','Simple'],hasPhoto:false,hasGraphics:true,columns:1,fields:['Tech & Data Science','Management','Sales'],font:'modern'},
  {id:'compact',name:'Essential',tags:['Compact','Simple'],hasPhoto:false,hasGraphics:false,columns:1,fields:['Student & Entry Level','Retail','Hospitality'],font:'compact'},
  {id:'column',name:'Balance',tags:['Two columns','Modern'],hasPhoto:false,hasGraphics:false,columns:2,fields:['Tech & Data Science','Business & Finance','Creative & Design'],font:'modern'},
  {id:'column-rule',name:'Structure',tags:['Two columns','Section rules'],hasPhoto:false,hasGraphics:true,columns:2,fields:['Management','Administration','Sales'],font:'modern'},
  {id:'portrait',name:'Profile',tags:['Photo optional','Simple'],hasPhoto:true,hasGraphics:false,columns:1,fields:['Creative & Design','Hospitality','Other'],font:'modern'},
  {id:'portrait-column',name:'Profile columns',tags:['Photo optional','Two columns'],hasPhoto:true,hasGraphics:true,columns:2,fields:['Creative & Design','Sales','Hospitality'],font:'modern'},
  {id:'serif-rule',name:'Academic',tags:['Traditional','Section rules'],hasPhoto:false,hasGraphics:true,columns:1,fields:['Education','Science','Public Service','Student & Entry Level'],font:'classic'}
];
const extraNames=['Ledger','Focus','Linework','Harbor','Studio','Civic','Precision','Foundation','Clarity','Canvas','Meridian','Campus','Practice','Craft','Horizon','Summit','Compass','Fieldwork','Metro','Vantage','Brief','Chapter','Workshop','Bridge','Signal','Keystone','Portfolio'];
const originalTemplates=[...baseTemplates,...extraNames.map((name,index)=>{
 const base=baseTemplates[index%baseTemplates.length];
 return {...base,id:'layout-'+(index+1),name,tags:[index%2?'Contemporary':'Traditional',index%3===0?'Compact':'Balanced'],headerAlign:index%2?'left':'center',sectionStyle:['plain','ruled','label'][Math.floor(index/2)%3],entryStyle:index%2?'lined':'standard',font:['classic','modern','compact'][Math.floor(index/4)%3],fields:[careerFields[index%careerFields.length],...base.fields]};
})];
// Keep retired IDs available when opening an existing draft.
const replacements = {
  'portrait-column': { id: 'framed-portrait', name: 'Framed Portrait', tags: ['Optional photo', 'Framed header', 'Right sidebar'], headerStyle: 'frame', sidebar: 'right' },
  'layout-1': { id: 'masthead', name: 'Masthead', tags: ['Dark header', 'One column'], headerStyle: 'band', headerAlign: 'left', hasGraphics: true },
  'layout-3': { id: 'folio', name: 'Folio', tags: ['Double rule', 'Centered serif'], headerStyle: 'double-rule', sectionStyle: 'plain', hasGraphics: false },
  'layout-15': { id: 'credentials', name: 'Credentials', tags: ['Right sidebar', 'Shaded headings'], sidebar: 'right', sectionStyle: 'label', hasGraphics: false, headerStyle: 'minimal' },
  'layout-16': { id: 'field-notes', name: 'Field Notes', tags: ['Side accent', 'Timeline entries'], headerStyle: 'accent', sectionStyle: 'plain', entryStyle: 'lined', hasGraphics: true },
  'layout-22': { id: 'dispatch', name: 'Dispatch', tags: ['Top rule', 'Compact headings'], headerStyle: 'top-rule', sectionStyle: 'label', entryStyle: 'standard' },
  'layout-25': { id: 'quiet-page', name: 'Quiet Page', tags: ['Unruled', 'Left-aligned serif'], headerStyle: 'minimal', headerAlign: 'left', sectionStyle: 'plain', entryStyle: 'standard' },
  'layout-26': { id: 'executive-brief', name: 'Executive Brief', tags: ['Split header', 'Section rules'], headerStyle: 'split', headerAlign: 'left', entryStyle: 'standard' },
  'layout-27': { id: 'spotlight', name: 'Spotlight', tags: ['Centered dark header', 'Shaded headings'], headerStyle: 'band', headerAlign: 'center', sectionStyle: 'label', hasGraphics: true }
};
const updatedTemplates = originalTemplates.map(template =>
  replacements[template.id] ? { ...template, ...replacements[template.id] } : template
);
const retiredLookalikes = new Set([
  'compact', 'layout-19', 'serif-rule', 'layout-9', 'layout-13', 'layout-21',
  'layout-8', 'layout-10', 'layout-17', 'layout-24'
]);
export const resumeTemplates = updatedTemplates.filter(template => !retiredLookalikes.has(template.id));
const templateById = new Map([...originalTemplates, ...updatedTemplates].map(template => [template.id, template]));

export function filterTemplates(filters={}){
  return resumeTemplates.filter(template=>
    (!filters.hasPhoto||String(template.hasPhoto)===filters.hasPhoto)&&
    (!filters.hasGraphics||String(template.hasGraphics)===filters.hasGraphics)&&
    (!filters.columns||String(template.columns)===String(filters.columns))&&
    (!filters.fields?.length||filters.fields.some(field=>template.fields.includes(field)))
  );
}
export function templateDesign(id='classic',color='default',settings={}){
  const template=templateById.get(id)||resumeTemplates[0];
  const palette=templateColors.find(item=>item.id===color)||templateColors[0];
  return {...settings,template:template.font,templateId:template.id,color:palette.id,columns:template.columns,graphics:template.hasGraphics,hasPhoto:template.hasPhoto,headerAlign:template.headerAlign|| (template.font==='classic'?'center':'left'),sectionStyle:template.sectionStyle|| (template.hasGraphics?'ruled':'plain'),entryStyle:template.entryStyle||'standard',headerStyle:template.headerStyle||'standard',sidebar:template.sidebar||'left'};
}
export const templateSample={name:'Jordan Morgan',contact:'Fayetteville, AR | jordan@example.test | 479-555-0123',sections:[
  {key:'profile',title:'SUMMARY',entries:[{key:0,text:'Business student with experience organizing community events and helping visitors. Skills include scheduling, Excel, and clear communication.'}]},
  {key:'experience',title:'EXPERIENCE',entries:[{key:0,title:'Community volunteer',organization:'Example Community Center',dates:'May 2024 – Present',bullets:['Welcomed visitors and answered questions','Organized event supplies and schedules']}]},
  {key:'education',title:'EDUCATION',entries:[{key:0,title:'Business studies',organization:'Example College',dates:'Expected May 2027'}]},
  {key:'skills',title:'SKILLS',entries:[{key:0,bullets:['Microsoft Excel','Scheduling','Teamwork','Customer communication']}]}
]};
