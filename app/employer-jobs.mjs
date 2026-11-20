import { regionalBoards, loadRegionalBoard, localCity as local } from './regional-employer-feeds.mjs';
import { qualificationEvidence } from './qualifications.mjs';
import { filterBusinessJobs, filterDirection } from './search.mjs';
import { entryBoards, loadEntryBoard } from './entry-employer-feeds.mjs';

const boards = [
  { board: 'vmlenterprisesolutions', company: 'VML/WPP Enterprise Solutions' },
  { board: 'pltfrm', company: 'PLTFRM' },
  { board: 'eko', company: 'eko' },
  { board: 'alertmedia', company: 'AlertMedia' },
  { board: 'dunnhumby', company: 'dunnhumby' },
  { board: 'sharkninjaoperatingllc', company: 'SharkNinja' },
  { board: 'dhpace', company: 'DH Pace' },
  { board: 'landor', company: 'Landor' },
  { board: 'tenstreet', company: 'Tenstreet' },
  { board: 'olsson', company: 'Olsson' },
  { board: 'kinders', company: "Kinder’s" },
  { board: 'wachter', company: 'Wachter', provider: 'Lever' },
  { board: 'cyderes', company: 'Cyderes', provider: 'Lever' },
  { board: 'elfbeauty', company: 'e.l.f. Beauty', provider: 'Lever' },
  { board: 'court-avenue', company: 'CourtAvenue', provider: 'Lever' },
  { board: 'UHP-UnlockHumanPotential', company: 'UHP', provider: 'Ashby' },
  { board: 'kevins-natural-foods', company: 'Kevin’s Natural Foods', provider: 'Ashby' },
  { board: 'skydio', company: 'Skydio', provider: 'Ashby' },
  { board: 'uberfreight', company: 'Uber Freight' },
  { board: 'revloncorporate', company: 'Revlon' },
  { board: 'harrys', company: "Harry’s" },
  { board: 'monsterenergy', company: 'Monster Energy' },
  { board: 'olipop', company: 'OLIPOP' },
  { board: 'plaud', company: 'Plaud', provider: 'Ashby' },
  { board: 'halter', company: 'Halter', provider: 'Ashby' },
  { board: 'coty', company: 'Coty', provider: 'Career site', origin: 'https://careers.coty.com' },
  { board: 'hershey', company: 'The Hershey Company', provider: 'Career site', origin: 'https://careers.thehersheycompany.com' },
  ...regionalBoards,
  ...entryBoards
];
export function plainText(html = '') {
  let text = String(html);
  for (let pass = 0; pass < 3; pass++) {
    text = text.replace(/&(?:amp|lt|gt|quot|apos|nbsp);|&#(?:x[0-9a-f]+|\d+);/gi, entity => {
      const named = {'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&nbsp;':' '};
      if (named[entity.toLowerCase()]) return named[entity.toLowerCase()];
      const number = entity.slice(2,-1); const point = number[0].toLowerCase() === 'x' ? parseInt(number.slice(1),16) : Number(number);
      return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : ' ';
    });
  }
  return text.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ')
    .replace(/<\/?(?:p|li|h[1-6]|div|br|ul|ol)\b[^>]*>/gi,'\n').replace(/<[^>]*>/g,' ')
    .split('\n').map(line=>line.replace(/\s+/g,' ').trim()).filter(Boolean).join('\n');
}
export function employerResults(data, {direction = '', keywords = '', location = ''} = {}, fetchedAt = new Date().toISOString(), { board, company, provider = 'Greenhouse' } = boards[0]) {
  if (!Array.isArray(data.jobs)) throw new Error('Invalid employer feed');
  // This is an explicitly regional pilot, not a radius search or nationwide feed.
  const regionRequested = local.test(location) || /northwest arkansas/i.test(location);
  let jobs = regionRequested ? data.jobs.flatMap(job => {
    const name = (job.location?.name || '').split(';').map(value => value.trim()).find(value =>
      (board === 'dunnhumby' && value === 'Bentonville') ||
      (local.test(value) && /\b(AR|Arkansas)\b/i.test(value)));
    return name ? [{ ...job, location: { name } }] : [];
  }) : [];
  if (direction) jobs = filterDirection({results:jobs},direction).results;
  else {
    const terms = keywords.toLowerCase().split(/\s+/).filter(Boolean);
    jobs = filterBusinessJobs({ results: jobs }).results.filter(job =>
      terms.every(term => (job.title || '').toLowerCase().includes(term)));
  }
  return jobs.flatMap(job => {
    const description = plainText(job.content);
    if (!description) return [];
    let link = null;
    try {const url = new URL(job.absolute_url); if(url.protocol === 'https:') link=url.href;} catch {}
    let sourceUrl = null;
    try {const url = new URL(job.sourceUrl); if(url.protocol === 'https:') sourceUrl=url.href;} catch {}
    const qualifications = qualificationEvidence(job.title,description,{full:true});
    if (sourceUrl) qualifications.notice = 'Experience wording extracted from a full description republished by the Northwest Arkansas job board. Confirm current requirements with the employer.';
    return {id:`${provider.toLowerCase()}:${board}:${job.id}`, title:job.title, company:job.company || company, location:job.location.name,
      description, link, source:job.source || (provider === 'Career site' ? `${company} Careers` : `Employer via ${provider}`),
      ...(sourceUrl ? {sourceUrl} : {}), descriptionKind:'full', fetchedAt, qualifications};
  });
}
const cache = new Map();

function normalizeAshby(payload, board) {
  if (!Array.isArray(payload.jobs)) throw new Error('Invalid Ashby feed');
  return {
    jobs: payload.jobs.filter(job => job.isListed === true && job.jobUrl).map(job => {
      const address = job.address?.postalAddress;
      const locations = [
        job.location,
        [address?.addressLocality, address?.addressRegion].filter(Boolean).join(', '),
        ...(job.secondaryLocations ?? []).flatMap(item => [
          item.location,
          [item.address?.addressLocality, item.address?.addressRegion].filter(Boolean).join(', ')
        ])
      ];
      const location = locations.find(value => value && local.test(value) && /\b(AR|Arkansas)\b/i.test(value))
        || (board === 'UHP-UnlockHumanPotential' && locations.includes('Bentonville (UHP Corporate Office)') ? 'Bentonville, AR' : '');
      return {
        id: job.jobUrl.split('/').filter(Boolean).at(-1),
        title: job.title,
        location: { name: location },
        absolute_url: job.jobUrl,
        content: job.descriptionHtml || job.descriptionPlain
      };
    })
  };
}

async function careerPage(origin, path) {
  const response = await fetch(new URL(path, origin), {
    signal: AbortSignal.timeout(8000),
    redirect: 'error'
  });
  if (response.status === 404 && path.startsWith('/job/')) return '';
  if (!response.ok) throw new Error('Career site unavailable');
  return response.text();
}

async function loadCareerSite(origin) {
  const cities = ['Bentonville', 'Rogers', 'Fayetteville', 'Springdale', 'Lowell'];
  const pages = await Promise.all(cities.map(city => careerPage(origin, '/search/?locationsearch=' + city)));
  const paths = new Set(pages.flatMap(html =>
    Array.from(html.matchAll(/href="(\/job\/[a-z0-9%_-]+\/\d+\/)"/gi), match => match[1])));
  const jobs = await Promise.all(Array.from(paths, async path => {
    const html = await careerPage(origin, path);
    if (!html) return null;
    const title = html.match(/<span\b[^>]*itemprop="title"[^>]*>([\s\S]*?)<\/span>/i)?.[1];
    const city = html.match(/<meta itemprop="addressLocality" content="([^"]+)"/i)?.[1];
    const state = html.match(/<meta itemprop="addressRegion" content="([^"]+)"/i)?.[1];
    const content = html.match(/<span class="jobdescription">([\s\S]*?)<\/span>\s*<\/span>\s*<\/div>/i)?.[1];
    if (!title || !city || !state || !content) throw new Error('Employer posting layout changed');
    return {
      id: path.split('/').at(-2),
      title: plainText(title),
      location: { name: `${city}, ${state}` },
      absolute_url: new URL(path, origin).href,
      content
    };
  }));
  return { jobs: jobs.filter(Boolean) };
}

async function loadBoard(config) {
  const { board, provider = 'Greenhouse' } = config;
  const key = `${provider}:${board}`;
  const saved = cache.get(key);
  if (saved && Date.now() - saved.time <= 10 * 60 * 1000) return saved;

  const regional = loadEntryBoard(config) || loadRegionalBoard(config);
  if (regional) {
    const entry = { data: await regional, time: Date.now(), fetchedAt: new Date().toISOString() };
    cache.set(key, entry);
    return entry;
  }

  if (provider === 'Career site') {
    const entry = { data: await loadCareerSite(config.origin), time: Date.now(), fetchedAt: new Date().toISOString() };
    cache.set(key, entry);
    return entry;
  }

  const endpoint = provider === 'Lever'
    ? `https://api.lever.co/v0/postings/${board}?mode=json`
    : provider === 'Ashby'
      ? `https://api.ashbyhq.com/posting-api/job-board/${board}`
      : `https://boards-api.greenhouse.io/v1/boards/${board}/jobs?content=true`;
  const response = await fetch(endpoint, {
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new Error('Employer feed unavailable');
  const payload = await response.json();
  const data = provider === 'Lever' && Array.isArray(payload) ? {
    jobs: payload.map(job => {
      const locations = Array.isArray(job.categories?.allLocations) ? job.categories.allLocations : [];
      const localLocation = [job.categories?.location, ...locations]
        .flatMap(value => typeof value === 'string' ? value.split(/\s+[/;]\s+/) : [])
        .find(value => local.test(value) && /\b(AR|Arkansas)\b/i.test(value));
      const sections = Array.isArray(job.lists) ? job.lists.map(section => section.content) : [];
      return {
        id: job.id,
        title: job.text,
        location: { name: localLocation || '' },
        absolute_url: job.hostedUrl,
        content: [job.description || job.descriptionPlain, ...sections, job.additional].filter(Boolean).join('\n')
      };
    })
  } : provider === 'Ashby' ? normalizeAshby(payload, board) : payload;
  if (!Array.isArray(data.jobs)) throw new Error('Invalid employer feed');
  const entry = { data, time: Date.now(), fetchedAt: new Date().toISOString() };
  cache.set(key, entry);
  return entry;
}

export async function getEmployerJobs(query) {
  const responses = await Promise.allSettled(boards.map(loadBoard));
  const jobs = [];
  let available = 0;
  let partial = 0;
  for (const [index, response] of responses.entries()) {
    if (response.status === 'rejected') continue;
    available++;
    const { data, fetchedAt } = response.value;
    if (data.partial) partial++;
    jobs.push(...employerResults(data, query, fetchedAt, boards[index]));
  }
  if (!available) throw new Error('Employer feeds unavailable');
  return { jobs, coverage: `${available} of ${boards.length} employer boards available across Northwest Arkansas.` +
    (partial ? ` ${partial} employer feeds returned partial results.` : '') };
}
