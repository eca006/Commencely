import { qualificationEvidence } from './qualifications.mjs';
import { filterDirection } from './search.mjs';

const board = 'vmlenterprisesolutions';
const company = 'VML/WPP Enterprise Solutions';
const local = /\b(Fayetteville|Springdale|Rogers|Bentonville|Lowell|Bella Vista)\b/i;
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
export function employerResults(data, {direction = '', keywords = '', location = ''} = {}, fetchedAt = new Date().toISOString()) {
  if (!Array.isArray(data.jobs)) throw new Error('Invalid employer feed');
  // This is an explicitly regional pilot, not a radius search or nationwide feed.
  const regionRequested = local.test(location) || /northwest arkansas/i.test(location);
  let jobs = regionRequested ? data.jobs.filter(job => local.test(job.location?.name || '') && /\b(AR|Arkansas)\b/i.test(job.location.name)) : [];
  if (direction) jobs = filterDirection({results:jobs},direction).results;
  else {
    const terms = keywords.toLowerCase().split(/\s+/).filter(Boolean);
    jobs = jobs.filter(job => terms.every(term => (job.title || '').toLowerCase().includes(term)));
  }
  return jobs.slice(0,10).map(job => {
    const description = plainText(job.content);
    let link = null;
    try {const url = new URL(job.absolute_url); if(url.protocol === 'https:') link=url.href;} catch {}
    return {id:`greenhouse:${board}:${job.id}`, title:job.title, company, location:job.location.name,
      description, link, source:'Employer via Greenhouse', descriptionKind:'full', fetchedAt,
      qualifications:qualificationEvidence(job.title,description,{full:true})};
  });
}
let cache;
export async function getEmployerJobs(query) {
  if (!cache || Date.now()-cache.time > 10*60*1000) {
    const response = await fetch(`https://boards-api.greenhouse.io/v1/boards/${board}/jobs?content=true`, {signal:AbortSignal.timeout(15000)});
    if (!response.ok) throw new Error('Employer feed unavailable');
    const data=await response.json();
    if (!Array.isArray(data.jobs)) throw new Error('Invalid employer feed');
    cache={data,time:Date.now(),fetchedAt:new Date().toISOString()};
  }
  return {jobs:employerResults(cache.data,query,cache.fetchedAt), coverage:'Employer pilot: one VML/WPP board across Northwest Arkansas; not restricted to the selected city.'};
}
