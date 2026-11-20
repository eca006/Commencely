export const businessMajors = {
  accounting: ['Accounting', 'accounting accountant audit tax bookkeeping payroll billing', /\b(account(?:ing|ant|s payable|s receivable)|audit|tax|bookkeep|payroll|billing|controller)\w*\b/i],
  economics: ['Economics', 'economist economics econometrics policy forecasting research economic development', /\b(econom(?:ist|ics|etric|ic development)|policy (?:analyst|research|associate)|market research|forecast(?:er|ing)|research analyst)\w*\b/i],
  finance: ['Finance', 'finance financial bank teller lending investment insurance risk tax real estate leasing', /\b(financ(?:e|ial)|bank(?:er|ing)|teller|credit|loan|lending|investment|wealth|treasury|insurance|claims|actuar|risk|real estate|leasing|mortgage)\w*\b/i],
  general: ['General Business', '', null],
  hr: ['Human Resource Management', 'human resources recruiting talent benefits compensation training workforce payroll', /\b(human resources|HR|recruit|talent|benefits|compensation|employee relations|people operations|workforce|payroll|learning and development|training (?:specialist|coordinator))\w*\b/i],
  systems: ['Information Systems', 'business systems information systems analytics cybersecurity ERP SAP Workday data governance', /\b(information systems|business systems|business intelligence|systems administrator|data (?:analyst|governance|steward)|master data|analytics|cybersecurity|information security|ERP|SAP|Workday|NetSuite|IT (?:audit|governance|support|compliance)|enterprise applications?)\b/i],
  innovation: ['Innovation and Entrepreneurship', 'innovation entrepreneur venture startup product strategy partnerships business development', /\b(innovation|entrepreneur|venture|startup|product (?:manager|management|owner|analyst|specialist)|business development|strategic initiatives|strategy|partnership)\w*\b/i],
  marketing: ['Marketing', 'marketing advertising communications brand retail merchandising sales ecommerce market research', /\b(marketing|brand|advertis|campaign|communications?|public relations|digital media|content|shopper insights|market research|copywriter|merchandis|e[- ]?commerce|sales|category (?:manager|management|analyst))\w*\b/i],
  leadership: ['Organizational Management and Leadership', 'operations project program management leadership workforce change management business administration', /\b(operations?|project|program|management trainee|leadership|organizational development|change management|workforce|process improvement|administrative|office manager)\b/i],
  supply: ['Supply Chain Management', 'supply chain logistics freight transportation procurement sourcing inventory planning distribution', /\b(supply chain|logistics|freight|transportation|procurement|sourcing|purchasing|buyer|inventory|demand plann|production plann|production schedul|replenishment|distribution|trade compliance|customs)\w*\b/i]
};

export function getBusinessMajor(key) {
  return Object.hasOwn(businessMajors, key) ? businessMajors[key] : null;
}

export function matchesBusinessMajor(job, major) {
  if (!major?.[2]) return true;
  const [label, , roles] = major;
  if (roles.test(job.title ?? '')) return true;
  const description = String(job.description ?? '').replace(/<[^>]*>/g, ' ');
  return description.split(/(?<=[.!?;])\s+|\r?\n/).some(line =>
    /\b(?:degree|major|bachelor)\b/i.test(line) &&
    (line.toLowerCase().includes(label.toLowerCase()) || roles.test(line))
  );
}
