import { filterBusinessJobs } from './search.mjs';

export const localCity = /\b(?:Fayetteville|Springdale|Rogers|Bentonville|Lowell|Bella Vista|Centerton|Cave Springs|Benton County|Washington County|Siloam Springs|Farmington|Tontitown|Johnson|Pea Ridge|Gravette|Gentry|Prairie Grove|Elm Springs)\b/i;
export const arkansas = /\b(?:AR|Arkansas)\b/i;

export const regionalBoards = [
  { board: 'jbhunt', company: 'J.B. Hunt', provider: 'Workday', origin: 'https://jbhunt.wd501.myworkdayjobs.com', site: 'Careers' },
  { board: 'tysonfoods', company: 'Tyson Foods', provider: 'Workday', origin: 'https://tysonfoods.wd5.myworkdayjobs.com', site: 'TSN' },
  { board: 'pg', company: 'Procter & Gamble', provider: 'Workday', origin: 'https://pg.wd5.myworkdayjobs.com', site: '1000' },
  { board: 'walmart', company: 'Walmart / Sam’s Club', provider: 'Workday', origin: 'https://walmart.wd504.myworkdayjobs.com', site: 'WalmartExternal', cities: ['Bentonville', 'Rogers'] },
  { board: 'uasys', company: 'University of Arkansas', provider: 'Workday', origin: 'https://uasys.wd5.myworkdayjobs.com', site: 'UAF_External_Career_Site', cities: ['Fayetteville'] },
  { board: 'clorox', company: 'Clorox', provider: 'Workday', origin: 'https://clorox.wd1.myworkdayjobs.com', site: 'Clorox', cities: ['Bentonville', 'Rogers'] },
  { board: 'smucker', company: 'The J.M. Smucker Co.', provider: 'Workday', origin: 'https://smucker.wd5.myworkdayjobs.com', site: 'US_External_Careers', cities: ['Bentonville', 'Rogers'] },
  { board: 'genmills', company: 'General Mills', provider: 'Workday', origin: 'https://genmills.wd1.myworkdayjobs.com', site: 'GMI_External_Careers', cities: ['Rogers', 'Bentonville'] },
  { board: 'smithfieldfoods', company: 'Smithfield Foods', provider: 'Workday', origin: 'https://smithfieldfoods.wd1.myworkdayjobs.com', site: 'careers', cities: ['Rogers', 'Bentonville'] },
  { board: 'lindtspruengli', company: 'Lindt & Sprüngli', provider: 'Workday', origin: 'https://lindtspruengli.wd103.myworkdayjobs.com', site: 'lindtspruengligroupcareers', cities: ['Rogers', 'Bentonville'] },
  { board: 'breakthru', company: 'Breakthru Beverage Group', provider: 'Workday', origin: 'https://breakthru.wd5.myworkdayjobs.com', site: 'BBG-US', cities: ['Rogers', 'Bentonville'] },
  { board: 'spscommerce', company: 'SPS Commerce', provider: 'Workday', origin: 'https://spscommerce.wd108.myworkdayjobs.com', site: 'SPS', cities: ['Rogers', 'Bentonville'] },
  { board: 'conagrabrands', company: 'Conagra Brands', provider: 'Workday', origin: 'https://conagrabrands.wd1.myworkdayjobs.com', site: 'Careers_US', cities: ['Rogers', 'Bentonville'] },
  { board: 'mdlz', company: 'Mondelēz International', provider: 'Workday', origin: 'https://mdlz.wd3.myworkdayjobs.com', site: 'External', cities: ['Rogers', 'Bentonville'] },
  { board: 'treehouse', company: 'TreeHouse Foods', provider: 'Workday', origin: 'https://treehouse.wd1.myworkdayjobs.com', site: 'treehousecareers', cities: ['Rogers', 'Bentonville'] },
  { board: 'philips', company: 'Philips', provider: 'Workday', origin: 'https://philips.wd3.myworkdayjobs.com', site: 'jobs-and-careers', cities: ['Rogers', 'Bentonville'] },
  { board: 'medline', company: 'Medline', provider: 'Workday', origin: 'https://medline.wd5.myworkdayjobs.com', site: 'Medline', cities: ['Rogers', 'Bentonville'] },
  { board: 'uada', tenant: 'uasys', company: 'University of Arkansas System Division of Agriculture', provider: 'Workday', origin: 'https://uasys.wd5.myworkdayjobs.com', site: 'UADA_External_Career_Site', cities: ['Fayetteville'] },
  { board: 'acosta', company: 'Acosta Group', provider: 'Oracle Recruiting' },
  { board: 'simmons', company: 'Simmons Foods', provider: 'UKG' }
];

const arkansasFacet = 'cea6c5355e1b4983b5fd0640310385b5';
const oracleOrigin = 'https://eczy.fa.us2.oraclecloud.com';
const oracleApi = oracleOrigin + '/hcmRestApi/resources/latest/';
const simmonsBoard = 'https://recruiting2.ultipro.com/SIM1010SMPF/JobBoard/6f7aad9a-4c91-42aa-8356-8977aa25a2a4';

async function request(url, body) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(8000),
    redirect: 'error',
    ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {})
  });
  if (!response.ok) throw new Error(`Employer returned HTTP ${response.status}`);
  return response;
}

async function paginate(load, pageSize, maxPages) {
  const rows = [];
  let truncated = false;
  for (let page = 0; page < maxPages; page++) {
    const { items, total } = await load(page * pageSize);
    if (!Array.isArray(items) || !Number.isFinite(total)) throw new Error('Invalid employer results');
    rows.push(...items);
    if (rows.length >= total) break;
    if (!items.length || page === maxPages - 1) truncated = true;
    if (!items.length) break;
  }
  return { rows, truncated };
}

async function loadDescriptions(rows, toJob) {
  const candidates = filterBusinessJobs({ results: rows }).results;
  const jobs = [];
  let failed = 0;
  for (let offset = 0; offset < candidates.length; offset += 8) {
    const batch = await Promise.allSettled(candidates.slice(offset, offset + 8).map(toJob));
    for (const result of batch) {
      if (result.status === 'rejected') failed++;
      else if (result.value) jobs.push(result.value);
    }
  }
  if (failed && failed === candidates.length) throw new Error('Employer descriptions unavailable');
  return { jobs, partial: failed > 0 };
}

function localLocation(values) {
  return values.find(value => typeof value === 'string' && localCity.test(value) && arkansas.test(value));
}

const walmartBusinessFamilies = new Set([
  'Data Analytics and Management', 'Sales, Marketing and Business Development',
  'Finance', 'Supply Chain', 'Business Services', 'PMO', 'People',
  'Business Operations', 'Continuous Improvement', 'Purchasing',
  'Compliance Ethics and Legal', 'Communications and Corporate Affairs'
]);

async function workday({ board, origin, site, cities, tenant = board }) {
  const api = `${origin}/wday/cxs/${tenant}/${site}`;
  const pg = board === 'pg';
  const queries = cities ?? (pg ? ['Fayetteville', 'Bentonville', 'Rogers', 'Springdale', 'Lowell'] : ['']);
  const pages = await Promise.all(queries.map(async searchText => {
    const search = async (appliedFacets, offset) => (await request(api + '/jobs', {
      appliedFacets, limit: 20, offset, searchText
    })).json();
    let facets = searchText ? {} : { Location_Region_State_Province: [arkansasFacet] };
    if (board === 'walmart') {
      const initial = await search({}, 0);
      if (!initial.total) return { rows: [], truncated: false };
      const families = initial.facets?.find(facet => facet.facetParameter === 'jobFamilyGroup')?.values
        ?.filter(value => walmartBusinessFamilies.has(value.descriptor)).map(value => value.id);
      if (!families?.length) return { rows: [], truncated: true };
      facets = { jobFamilyGroup: families };
    }
    return paginate(async offset => {
      const data = await search(facets, offset);
      return { items: data.jobPostings, total: data.total };
    }, 20, 15);
  }));
  const knownFayetteville = value => (pg || tenant === 'uasys') && /^Fayetteville(?: Sales Office)?$/i.test(value);
  const postings = new Map(pages.flatMap(page => page.rows).map(job => [job.externalPath, job]));
  const rows = [...postings.values()].filter(job =>
    typeof job.externalPath === 'string' && /^\/job\/[a-z0-9_%./()-]+$/i.test(job.externalPath) &&
    !job.externalPath.includes('..') &&
    !/^Off-Site Employees \(Corp Use\)/i.test(job.locationsText) &&
    (localLocation([job.locationsText]) || knownFayetteville(job.locationsText) || !job.locationsText ||
      /locations$/i.test(job.locationsText)));
  const result = await loadDescriptions(rows, async job => {
    const { jobPostingInfo: info } = await (await request(api + job.externalPath)).json();
    if (!info?.posted || !info.canApply) return null;
    const locations = [info.location, ...(info.additionalLocations ?? []), job.locationsText];
    const name = localLocation(locations) ??
      (locations.some(knownFayetteville) ? 'Fayetteville, AR' : null);
    if (!name || !info.jobDescription || (board === 'walmart' && /\b(?:store|club)\b/i.test(name) && !/\b(?:home office|corporate)\b/i.test(name))) return null;
    return { id: info.jobReqId ?? job.externalPath, title: job.title, location: { name },
      absolute_url: origin + '/' + site + job.externalPath, content: info.jobDescription };
  });
  return { ...result, partial: result.partial || pages.some(page => page.truncated) };
}

async function acosta() {
  const { rows, truncated } = await paginate(async offset => {
    const url = oracleApi + 'recruitingCEJobRequisitions?finder=findReqs;siteNumber=CX_1,locationId=300000002116898,radius=40,radiusUnit=MI,limit=25,offset=' + offset + '&expand=requisitionList';
    const { items } = await (await request(url)).json();
    return { items: items?.[0]?.requisitionList, total: items?.[0]?.TotalJobsCount };
  }, 25, 10);
  const result = await loadDescriptions(rows.map(job => ({ ...job, title: job.Title })), async job => {
    if (!/^\d+$/.test(job.Id)) return null;
    const { items } = await (await request(oracleApi + 'recruitingCEJobRequisitionDetails?finder=ById;Id=' + job.Id + ',siteNumber=CX_1&expand=all')).json();
    const info = items?.[0];
    if (!info || (info.ExternalPostedEndDate && Date.parse(info.ExternalPostedEndDate) < Date.now())) return null;
    const name = localLocation([info.PrimaryLocation, ...(info.secondaryLocations ?? []).map(location => location.Name)]);
    if (!name) return null;
    return { id: job.Id, title: job.title, location: { name },
      absolute_url: oracleOrigin + '/hcmUI/CandidateExperience/en/sites/CX_1/job/' + job.Id,
      content: [info.ExternalDescriptionStr, info.ExternalQualificationsStr].filter(Boolean).join('\n') };
  });
  return { ...result, partial: result.partial || truncated };
}

async function simmons() {
  const { rows, truncated } = await paginate(async offset => {
    const data = await (await request(simmonsBoard + '/JobBoardView/LoadSearchResults', {
      opportunitySearch: {
        Top: 20, Skip: offset, QueryString: '', Filters: [],
        OrderBy: [{ Value: 'postedDateDesc', PropertyName: 'PostedDate', Ascending: false }]
      }
    })).json();
    return { items: data.opportunities, total: data.totalCount };
  }, 20, 20);
  const localRows = rows.flatMap(job => {
    const name = localLocation((job.Locations ?? []).map(({ Address }) =>
      [Address?.City, Address?.State?.Code].filter(Boolean).join(', ')));
    return name ? [{ ...job, title: job.Title, location: { name } }] : [];
  });
  const result = await loadDescriptions(localRows, async job => {
    if (!/^[a-f0-9-]{36}$/i.test(job.Id)) return null;
    const absolute_url = simmonsBoard + '/OpportunityDetail?opportunityId=' + job.Id;
    const html = await (await request(absolute_url)).text();
    const model = html.match(/new US\.Opportunity\.CandidateOpportunityDetail\((\{[^\r\n]*\})\);/)?.[1];
    if (!model) throw new Error('Simmons posting layout changed');
    const info = JSON.parse(model);
    return { id: job.Id, title: job.title, location: job.location, absolute_url, content: info.Description };
  });
  return { ...result, partial: result.partial || truncated };
}

export function loadRegionalBoard(board) {
  if (board.provider === 'Workday') return workday(board);
  if (board.provider === 'Oracle Recruiting') return acosta();
  if (board.provider === 'UKG') return simmons();
  return null;
}
