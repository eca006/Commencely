import { businessMajors } from './public/business-majors.js';

const majorRolePatterns = Object.values(businessMajors).map(([, , pattern]) => pattern).filter(Boolean);
const searches = {
  marketing: { query: 'marketing', title: /\b(marketing|communications?|content|social media|public relations)\b/i },
  sales: { query: 'sales', title: /\b(sales|account representative|account executive|customer (service|success|support))\b/i },
  operations: { query: 'operations', title: /\b(operations?|business|administrative|office|project|logistics|supply chain)\b/i }
};
const nonBusiness = /\b(RN|LPN|nurs(?:e|es|ing)|physician|surgeon|surgical|clinical|circulator|therapist|patient|operating room|engineer(?:s|ing)?|technician|software developer|electrician|plumber)\b/i;
const businessTitles = /\b(account (?:manager|specialist|coordinator|director|lead)|accounting|accountant|bookkeep(?:er|ing)|auditor|audit|payroll|financ(?:e|ial)|controller|human resources|HR (?:assistant|coordinator|generalist|manager|specialist)|recruit(?:er|ing|ment)|talent acquisition|procurement|purchas(?:ing|er)|merchandis(?:er|ing)|category (?:manager|management|analyst)|shopper insights|market research|commercial execution|product (?:manager|management|marketing)|brand (?:manager|management)|buyer|compliance|consult(?:ant|ing)|analyst|analytics|e[- ]?commerce|customer experience|executive assistant|program (?:assistant|associate|coordinator|specialist|manager)|territory manager|billing|treasury|underwrit(?:er|ing)|management trainee|leadership development|demand plan(?:ner|ning)|inventory plan(?:ner|ning)|admissions (?:advisor|specialist|coordinator)|enrollment (?:advisor|specialist|coordinator))\b/i;
const relatedBusinessTitles = [
  /\b(credit|collections?|bank(?:er|ing)|teller|loans?|mortgage|lending|insurance|claims|risk|tax|actuar(?:y|ial)|economist|pricing|costing|financial planning|investment|wealth|revenue cycle|accounts (?:payable|receivable))\b/i,
  /\b(customer (?:care|relations)|client (?:services?|relations|success|support|associate|advisor|adviser)|relationship (?:manager|associate|advisor|adviser)|field representative|inside sales|retail management|store (?:manager|lead)|assistant manager|district manager|franchise|partnerships?|fundrais(?:er|ing))\b/i,
  /\b(sourcing|supplier (?:relations|management)|transportation (?:specialist|coordinator|planner)|freight (?:broker|coordinator|specialist)|dispatch(?:er| coordinator)|inventory (?:control|specialist|coordinator)|demand planning|production (?:planner|scheduler)|workforce (?:planning|management)|vendor (?:manager|management|relations)|contract (?:administrator|specialist)|grants? (?:administrator|coordinator|specialist))\b/i,
  /\b(benefits (?:assistant|specialist|coordinator|administrator)|compensation|employee relations|people operations|training (?:coordinator|specialist)|learning and development|organizational development|public affairs|government relations|community outreach|event (?:planner|coordinator|manager)|copywriter|market intelligence|digital media|advertising|campaign|sponsorship|strategic initiatives|strategy (?:associate|specialist|coordinator)|change management|data reporting|business intelligence|process improvement|quality assurance (?:analyst|coordinator))\b/i,
  /\b(real estate|property (?:manager|management|administrator|coordinator)|leasing (?:agent|associate|consultant|specialist)|economic development|policy (?:assistant|researcher|associate)|venture (?:capital|associate)|innovation (?:associate|coordinator|specialist|manager)|startup operations|trade compliance|import[- /]export|customs (?:broker|specialist)|global sourcing|demand forecast(?:er|ing)|replenishment)\b/i
];
const businessTechnologyTitles = /\b(?:information systems|business systems|enterprise applications?|enterprise resource planning|ERP|SAP|Workday|NetSuite|IT audit|IT governance|IT compliance|IT support (?:analyst|specialist|technician)|systems administrator|cybersecurity (?:analyst|associate|specialist)|information security (?:analyst|associate|specialist)|data governance|data stewardship|master data)\b/i;
const businessDegree = /\b(?:degree|bachelor(?:['’]s)?|major)\s+(?:in|with a major in)\s+(?:business(?: administration| management| analytics)?|international business|accounting|finance|marketing|economics|human resource(?:s| management)|supply chain management|(?:management )?information systems|entrepreneurship|organizational management|organizational leadership)\b/i;
// Keep the broad search, and give smaller degree-aligned job families their own Adzuna queries.
export const businessDegreeSearches = [
  'accounting audit tax bookkeeping payroll financial banking lending wealth investment insurance actuarial leasing',
  'economist econometrics economic policy research forecasting intelligence grants development trade customs export',
  'analytics cybersecurity information systems ERP SAP Workday enterprise data governance',
  'human resources recruiting benefits compensation employee relations training leadership workforce administration strategy innovation venture',
  'marketing advertising communications brand retail merchandising category sales accounts customer ecommerce events',
  'supply chain logistics freight transportation procurement sourcing inventory replenishment production scheduling distribution'
];
export const businessSearchKeywords = [
  'marketing sales operations accounting finance recruiting procurement logistics merchandising analyst business billing coordinator trainee administrative payroll compliance buyer',
  'banking teller lending insurance claims risk tax investment economist pricing revenue inventory sourcing transportation freight contracts grants benefits workforce advertising fundraising'
].join(' ');
export function filterBusinessJobs(data) {
  return {
    ...data,
    results: data.results.filter(({ title = '', description = '', content = '' }) =>
      businessTechnologyTitles.test(title) || (!nonBusiness.test(title) && (
        businessTitles.test(title) ||
        relatedBusinessTitles.some(pattern => pattern.test(title)) ||
        majorRolePatterns.some(pattern => pattern.test(title)) ||
        Object.values(searches).some(rule => rule.title.test(title)) ||
        businessDegree.test(String(description || content).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' '))
      )))
  };
}

export function directionSearch(direction) { return searches[direction]?.query; }
export function filterDirection(data, direction) {
  const rule = searches[direction];
  if (!rule || !Array.isArray(data.results)) throw new Error('Invalid direction or results');
  const reviewed = data.results.length;
  const results = data.results.filter(job => rule.title.test(job.title || '') && !nonBusiness.test(job.title || ''));
  return { ...data, results, reviewed, removed: reviewed - results.length };
}
