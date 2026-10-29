export const skillGroups=[
  {roles:'cashier retail sales customer service restaurant',skills:['Customer service','Cash handling','Point-of-sale systems','Order accuracy','Inventory organization','Customer communication']},
  {roles:'office assistant administration receptionist operations',skills:['Scheduling','Data entry','Record keeping','Microsoft Word','Microsoft Excel','Phone communication','Project coordination']},
  {roles:'analyst analytics business data technology software',skills:['Microsoft Excel','SQL','Python','Data analysis','C#','Presentation preparation','Problem-solving']},
  {roles:'student volunteer first job general',skills:['Teamwork','Time management','Active listening','Organization','Written communication','Adaptability']}
];
export function findSkills(query=''){
  const search=query.trim().toLowerCase();
  const matches=skillGroups.flatMap(group=>group.roles.includes(search)||!search?group.skills:group.skills.filter(skill=>skill.toLowerCase().includes(search)));
  return [...new Set(matches)];
}
export function appendSkill(existing,skill){
  const lines=existing.split('\n').map(line=>line.trim()).filter(Boolean);
  if(!lines.some(line=>line.toLowerCase()===skill.toLowerCase()))lines.push(skill);
  return lines.join('\n');
}
export function summarySuggestions(answers={}){
  const clean=value=>typeof value==='string'?value.trim():'';
  const role=(answers.experience||[]).find(entry=>clean(entry.role));
  const education=(answers.education||[]).find(entry=>clean(entry.fieldOfStudy)||clean(entry.qualification));
  const skills=clean(answers.skills).split('\n').filter(Boolean).slice(0,3);
  const roleText=role?'Experience as '+clean(role.role)+(clean(role.organization)?' at '+clean(role.organization):'')+'.':'';
  const study=education?'Education in '+[clean(education.qualification),clean(education.fieldOfStudy)].filter(Boolean).join(' — ')+'.':'';
  const skillText=skills.length?'Skills include '+skills.join(', ')+'.':'';
  return [...new Set([[roleText,skillText],[study,skillText],[roleText,study,skillText]].map(parts=>parts.filter(Boolean).join(' ')).filter(Boolean))];
}
