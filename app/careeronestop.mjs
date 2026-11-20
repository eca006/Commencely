import { plainText } from './employer-jobs.mjs';
import { qualificationEvidence } from './qualifications.mjs';
import { directionSearch, filterBusinessJobs, filterDirection } from './search.mjs';

export async function getCareerOneStopJobs({ location, direction, keywords }, credentials, fetcher = fetch) {
  const { userId, token } = credentials;
  if (!userId || !token) return { jobs: [], configured: false };

  const request = async (segments, params) => {
    const url = new URL('/v2/jobsearch/' + [userId, ...segments].map(encodeURIComponent).join('/'), 'https://api.careeronestop.org');
    url.search = new URLSearchParams(params);
    const response = await fetcher(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(6500)
    });
    if (!response.ok) throw new Error('CareerOneStop is unavailable.');
    return response.json();
  };

  const keyword = direction ? directionSearch(direction) : keywords.trim();
  const searches = keyword ? [keyword] : ['business', 'accounting', 'sales'];
  const lists = await Promise.allSettled(searches.map(async term => {
    const result = await request([term, location, 25, 0, 0, 0, 40, 30], { enableJobDescriptionSnippet: true });
    if (!Array.isArray(result.Jobs)) throw new Error('Unexpected CareerOneStop response.');
    return result.Jobs;
  }));
  const successful = lists.filter(result => result.status === 'fulfilled');
  if (!successful.length) throw new Error('CareerOneStop is unavailable.');

  const postings = new Map();
  for (const result of successful) {
    for (const row of result.value) {
      if (!row.JvId || typeof row.JobTitle !== 'string') continue;
      postings.set(String(row.JvId), { ...row, title: row.JobTitle });
    }
  }
  const candidates = { results: [...postings.values()] };
  const filtered = direction ? filterDirection(candidates, direction) : filterBusinessJobs(candidates);
  const jobs = [];
  let partial = successful.length !== lists.length;
  const maxDetails = 24;
  for (let start = 0; start < filtered.results.length; start += 6) {
    const batch = filtered.results.slice(start, start + 6);
    const details = await Promise.allSettled(batch.map(async (row, index) =>
      start + index < maxDetails ? request([row.JvId], { isHtml: false }) : null
    ));
    for (const [index, result] of details.entries()) {
      const row = batch[index];
      if (result.status === 'rejected') partial = true;
      const detail = result.status === 'fulfilled' ? result.value : null;
      const fullDescription = plainText(detail?.Description || '');
      const description = fullDescription || plainText(row.DescriptionSnippet || '');
      let link;
      try { link = new URL(detail?.URL || row.URL); } catch { continue; }
      if (!['https:', 'http:'].includes(link.protocol)) continue;
      jobs.push({
        id: `careeronestop:${row.JvId}`, title: row.title,
        company: row.Company || 'Company not listed', location: row.Location || 'Location not listed',
        link: link.href, source: 'CareerOneStop',
        descriptionKind: fullDescription ? 'full' : 'snippet',
        description: description || 'Description unavailable.',
        fetchedAt: new Date().toISOString(),
        qualifications: qualificationEvidence(row.title, description, { full: Boolean(fullDescription) })
      });
    }
  }
  return { jobs, configured: true, partial };
}
