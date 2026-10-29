export const templateColors=[
  {id:'default',name:'Black and white',hex:'#222222'}, {id:'asphalt',name:'Asphalt',hex:'#43484c'},
  {id:'taupe',name:'Taupe',hex:'#8b7669'}, {id:'navy',name:'Navy',hex:'#243e67'},
  {id:'blue',name:'Blue',hex:'#356baf'}, {id:'teal',name:'Teal',hex:'#167b85'},
  {id:'emerald',name:'Emerald',hex:'#286b54'}, {id:'gold',name:'Gold',hex:'#93651e'}, {id:'red',name:'Red',hex:'#a53540'}
];
export const careerFields=['Business & Finance','Healthcare','Tech & Data Science','Education','Legal','Sales','Management','Transport','Hospitality','Retail','Construction','Manufacturing','Creative & Design','Customer Service','Administration','Science','Public Service','Social Services','Agriculture','Student & Entry Level','Other'];
export const resumeTemplates=[
  {id:'classic',name:'Clear',tags:['Traditional','Simple'],hasPhoto:false,hasGraphics:false,columns:1,fields:['Business & Finance','Legal','Education','Administration'],font:'classic'},
  {id:'modern',name:'Outline',tags:['Modern','Simple'],hasPhoto:false,hasGraphics:true,columns:1,fields:['Tech & Data Science','Management','Sales'],font:'modern'},
  {id:'compact',name:'Essential',tags:['Compact','Simple'],hasPhoto:false,hasGraphics:false,columns:1,fields:['Student & Entry Level','Retail','Hospitality'],font:'compact'},
  {id:'column',name:'Balance',tags:['Two columns','Modern'],hasPhoto:false,hasGraphics:false,columns:2,fields:['Tech & Data Science','Business & Finance','Creative & Design'],font:'modern'},
  {id:'column-rule',name:'Structure',tags:['Two columns','Section rules'],hasPhoto:false,hasGraphics:true,columns:2,fields:['Management','Administration','Sales'],font:'modern'},
  {id:'portrait',name:'Profile',tags:['Photo optional','Simple'],hasPhoto:true,hasGraphics:false,columns:1,fields:['Creative & Design','Hospitality','Other'],font:'modern'},
  {id:'portrait-column',name:'Profile columns',tags:['Photo optional','Two columns'],hasPhoto:true,hasGraphics:true,columns:2,fields:['Creative & Design','Sales','Hospitality'],font:'modern'},
  {id:'serif-rule',name:'Academic',tags:['Traditional','Section rules'],hasPhoto:false,hasGraphics:true,columns:1,fields:['Education','Science','Public Service','Student & Entry Level'],font:'classic'}
];
export function filterTemplates(filters={}){
  return resumeTemplates.filter(template=>
    (!filters.hasPhoto||String(template.hasPhoto)===filters.hasPhoto)&&
    (!filters.hasGraphics||String(template.hasGraphics)===filters.hasGraphics)&&
    (!filters.columns||String(template.columns)===String(filters.columns))&&
    (!filters.fields?.length||filters.fields.some(field=>template.fields.includes(field)))
  );
}
export function templateDesign(id='classic',color='default',settings={}){
  const template=resumeTemplates.find(item=>item.id===id)||resumeTemplates[0];
  const palette=templateColors.find(item=>item.id===color)||templateColors[0];
  return {...settings,template:template.font,templateId:template.id,color:palette.id,columns:template.columns,graphics:template.hasGraphics,hasPhoto:template.hasPhoto};
}
export const templateSample={name:'Jordan Morgan',contact:'Fayetteville, AR | jordan@example.test | 479-555-0123',sections:[
  {key:'profile',title:'SUMMARY',entries:[{key:0,text:'Business student with experience organizing community events and helping visitors. Skills include scheduling, Excel, and clear communication.'}]},
  {key:'experience',title:'EXPERIENCE',entries:[{key:0,title:'Community volunteer',organization:'Example Community Center',dates:'May 2024 – Present',bullets:['Welcomed visitors and answered questions','Organized event supplies and schedules']}]},
  {key:'education',title:'EDUCATION',entries:[{key:0,title:'Business studies',organization:'Example College',dates:'Expected May 2027'}]},
  {key:'skills',title:'SKILLS',entries:[{key:0,bullets:['Microsoft Excel','Scheduling','Teamwork','Customer communication']}]}
]};
