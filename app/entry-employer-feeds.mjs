import { filterBusinessJobs } from './search.mjs';
import { localCity, arkansas } from './public/job-preferences.js';

export const entryBoards = [
  { board: 'tql', company: 'Total Quality Logistics', provider: 'Avature', origin: 'https://careers.tql.com' },
  { board: 'firstsecurity', company: 'First Security Bank', provider: 'AppOne', origin: 'https://fsbank.com' },
  { board: 'firstwestern', company: 'First Western Bank', provider: 'ApplicantPro', origin: 'https://fwbank.applicantpro.com' },
  { board: 'generations', company: 'Generations Bank', provider: 'ApplicantPro', origin: 'https://mygenerations.isolvedhire.com' },
  { board: 'ozk', company: 'Bank OZK', provider: 'Jibe', origin: 'https://careers.ozk.com' },
  { board: 'careersnwa', company: 'Northwest Arkansas job board', provider: 'Getro', origin: 'https://talent.careersnwa.com' }
];

const localLocation = values => values.find(value => typeof value === 'string' && localCity.test(value) && arkansas.test(value));
const decode = value => String(value).replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'");
const https = value => { try { const url = new URL(value); return url.protocol === 'https:' ? url.href : null; } catch { return null; } };

async function request(url, timeout = 8000) {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeout), redirect: 'error' });
  if (!response.ok) throw new Error(`Job source returned HTTP ${response.status}`);
  return response;
}

// Read published structured data only. Never execute scripts from a careers page.
export function structuredPostings(html) {
  const flatten = item => Array.isArray(item) ? item.flatMap(flatten) :
    item && typeof item === 'object' ? [item, ...flatten(item['@graph'] ?? [])] : [];
  return [...html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .flatMap(match => { try { return flatten(JSON.parse(match[1])); } catch { return []; } })
    .filter(item => item['@type'] === 'JobPosting' || Array.isArray(item['@type']) && item['@type'].includes('JobPosting'));
}

export function normalizeStructuredPosting(job, url, now = Date.now()) {
  const places = Array.isArray(job.jobLocation) ? job.jobLocation : [job.jobLocation];
  const location = localLocation(places.map(place => {
    const address = place?.address;
    return [address?.addressLocality, address?.addressRegion].filter(Boolean).join(', ');
  }));
  // ApplicantPro sometimes publishes a non-ISO timestamp: preserve its expiry date.
  const expiry = Date.parse(job.validThrough) || Date.parse(job.validThrough?.match(/^\d{4}-\d{2}-\d{2}/)?.[0] + 'T23:59:59Z');
  if (!location || !job.title || !job.description || !https(url) ||
      job.validThrough && (!Number.isFinite(expiry) || expiry < now)) return null;
  return { id: url, title: decode(job.title), location: { name: location }, content: job.description, absolute_url: url };
}

async function details(urls, load, batchSize = 8) {
  const jobs = [];
  let failures = 0;
  for (let offset = 0; offset < urls.length; offset += batchSize) {
    const batch = await Promise.allSettled(urls.slice(offset, offset + batchSize).map(load));
    for (const result of batch) {
      if (result.status === 'rejected') failures++;
      else if (result.value) jobs.push(result.value);
    }
  }
  if (urls.length && failures === urls.length) throw new Error('All job descriptions unavailable');
  return { jobs, partial: failures > 0 };
}

async function structuredDetails(url) {
  const html = await (await request(url)).text();
  if (/\b(?:this (?:job|position|posting) (?:is |has )?(?:closed|expired|no longer available)|no longer accepting applications)\b/i.test(html.replace(/<[^>]*>/g, ' '))) return null;
  const postings = structuredPostings(html);
  if (!postings.length) throw new Error('Job description layout changed');
  return normalizeStructuredPosting(postings[0], url);
}

async function applicantPro(board) {
  const xml = await (await request(board.origin + '/sitemap.xml')).text();
  if (!/<urlset\b/i.test(xml)) throw new Error('Invalid careers sitemap');
  const paths = [...new Set([...xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)].map(match => decode(match[1].trim())))]
    .filter(value => { try { const url = new URL(value); return url.origin === board.origin && /^\/jobs\/\d+(?:\.html)?$/.test(url.pathname); } catch { return false; } });
  const result = await details(paths.slice(0, 96), structuredDetails);
  return { ...result, partial: result.partial || paths.length > 96 };
}

async function tql(board) {
  const searches = await Promise.allSettled(['Fayetteville', 'Rogers'].map(city =>
    request(`${board.origin}/en_US/TQLexternalcareers/SearchJobs/?search=${city}&jobRecordsPerPage=50`).then(response => response.text())));
  const pages = searches.filter(page => page.status === 'fulfilled').map(page => page.value);
  if (!pages.length) throw new Error('TQL search unavailable');
  const paths = [...new Set(pages.flatMap(html => [...html.matchAll(/href\s*=\s*["']([^"']*\/JobDetail[^"']*)/gi)].map(match => decode(match[1]))))]
    .filter(value => { try { const url = new URL(value); return url.origin === board.origin && /^\/en_US\/TQLexternalcareers\/JobDetail\//.test(url.pathname); } catch { return false; } });
  const result = await details(paths.slice(0, 32), async url => {
    const job = await structuredDetails(url);
    // These postings recruit in NWA but require moving to another state.
    return job && !/fast.track program|relocation (?:provided|required)/i.test(job.title) ? job : null;
  });
  return { ...result, partial: searches.some(page => page.status === 'rejected') || result.partial ||
    paths.length > 32 || pages.some(html => /jobOffset=[1-9]\d*/i.test(html)) };
}

async function firstSecurity(board) {
  const html = await (await request(board.origin + '/about/join-us/')).text();
  const region = html.match(/Northwest Arkansas Openings[\s\S]*?(?=<h[1-4]\b|$)/i)?.[0];
  if (!region) throw new Error('Regional careers section unavailable');
  const urls = [...new Set([...region.matchAll(/https:\/\/www\.appone\.com\/MainInfoReq\.asp\?R_ID=\d+/gi)].map(match => match[0]))];
  const result = await details(urls.slice(0, 32), async url => {
    const page = await (await request(url)).text();
    const meta = name => {
      const tag = [...page.matchAll(/<meta\b[^>]*>/gi)].map(match => match[0])
        .find(value => new RegExp(`(?:itemprop|name)\\s*=\\s*["']${name}["']`, 'i').test(value));
      return tag?.match(/content\s*=\s*"([^"]*)"/i)?.[1];
    };
    const title = meta('title');
    const content = meta('description');
    const location = localLocation([[meta('addressLocality'), meta('addressRegion')].filter(Boolean).join(', ')]);
    if (!title || !content) throw new Error('Bank posting layout changed');
    if (!location || /this position is (?:closed|no longer accepting)/i.test(page.replace(/<[^>]*>/g, ' '))) return null;
    return { id: url, title: decode(title), content: decode(content), location: {name: location}, absolute_url: url };
  });
  return {...result, partial:result.partial || urls.length > 32};
}

async function jibe(board) {
  const found = new Map();
  let total = Infinity;
  let partial = false;
  for (let page = 1; page <= 4 && found.size < total; page++) {
    let data;
    try {
      data = await (await request(`${board.origin}/api/jobs?limit=100&page=${page}`)).json();
      if (!Array.isArray(data.jobs) || !Number.isFinite(Number(data.totalCount))) throw new Error('Invalid bank jobs feed');
    } catch (error) {
      if (!found.size) throw error;
      partial = true;
      break;
    }
    total = Number(data.totalCount);
    const previous = found.size;
    for (const {data: job} of data.jobs) {
      if (!job || !/^\d+$/.test(job.slug)) continue;
      found.set(job.slug, job);
    }
    if (!data.jobs.length || found.size === previous) break;
  }
  return { partial: partial || found.size < total, jobs: [...found.values()].flatMap(job => {
    const location = localLocation([[job.city, job.state].filter(Boolean).join(', ')]);
    return location && job.internal !== true && job.searchable !== false && job.applyable === true && job.title && job.description ? [{
      id: job.slug, title: job.title, location: {name: location}, content: job.description,
      absolute_url: `${board.origin}/jobs/${job.slug}?lang=en-us`
    }] : [];
  }) };
}

export function getroState(html) {
  const json = html.match(/<script\b[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i)?.[1];
  if (!json) throw new Error('Regional job board layout changed');
  const state = JSON.parse(json).props?.pageProps?.initialState?.jobs;
  if (!state) throw new Error('Invalid regional job board');
  return state;
}

async function getro(board) {
  const queries = ['accountant', 'analyst', 'coordinator', 'assistant', 'trainee', 'recruiter'];
  const pages = await Promise.allSettled(queries.map(async query =>
    getroState(await (await request(`${board.origin}/jobs?q=${query}`)).text())));
  const found = new Map();
  let partial = pages.some(page => page.status === 'rejected');
  if (pages.every(page => page.status === 'rejected')) throw new Error('Regional job board unavailable');
  for (const page of pages) {
    if (page.status === 'rejected') continue;
    if (!Array.isArray(page.value.found)) throw new Error('Invalid regional search results');
    partial ||= page.value.total > page.value.found.length;
  }
  // Interleave job families so accounting cannot use up the entire search budget.
  const lists = pages.filter(page => page.status === 'fulfilled').map(page => page.value.found);
  for (let index = 0; index < Math.max(0, ...lists.map(list => list.length)); index++) {
    for (const list of lists) {
      const job = list[index];
      if (!job) continue;
      if (localLocation(job.locations ?? []) && filterBusinessJobs({results:[job]}).results.length &&
          !/\b(?:director|principal|chief|vice president)\b/i.test(job.title)) found.set(job.id, job);
    }
  }
  const priority = job => /\b(?:assistant|associate|trainee|intern|junior|entry.level)\b/i.test(job.title) ? 0 :
    /\b(?:senior|sr\.?|manager|lead)\b/i.test(job.title) ? 2 : 1;
  const candidates = [...found.values()].sort((a, b) => priority(a) - priority(b));
  const result = await details(candidates.slice(0, 24), async item => {
    if (!/^[a-z0-9-]+$/.test(item.organization?.slug) || !/^[a-z0-9-]+$/.test(item.slug)) return null;
    const sourceUrl = `${board.origin}/companies/${item.organization.slug}/jobs/${item.slug}`;
    const job = getroState(await (await request(sourceUrl, 3500)).text()).currentJob;
    if (!job) throw new Error('Regional job description missing');
    const location = localLocation((job.locations ?? []).map(value => value.name));
    if (job.status !== 'active' || job.visibility !== 'visible' || job.closedAt || job.deactivatedAt ||
        job.expiresAt && (!Number.isFinite(Date.parse(job.expiresAt)) || Date.parse(job.expiresAt) < Date.now()) ||
        !location || !job.description || !https(job.url)) return null;
    return { id: job.id, title: job.title, company: job.organization?.name,
      location: {name: location}, content: job.description, absolute_url: https(job.url),
      source: 'Northwest Arkansas job board (Getro)', sourceUrl };
  }, 12);
  return {...result, partial: partial || result.partial || candidates.length > 24};
}

export function loadEntryBoard(board) {
  if (board.provider === 'ApplicantPro') return applicantPro(board);
  if (board.provider === 'Avature') return tql(board);
  if (board.provider === 'AppOne') return firstSecurity(board);
  if (board.provider === 'Jibe') return jibe(board);
  if (board.provider === 'Getro') return getro(board);
  return null;
}
