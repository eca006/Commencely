import {directionSearch, filterDirection} from './search.mjs';
for (const direction of ['marketing', 'sales', 'operations']) {
  const url = new URL('https://api.adzuna.com/v1/api/jobs/us/search/1');
  url.search = new URLSearchParams({app_id: process.env.ADZUNA_APP_ID, app_key: process.env.ADZUNA_APP_KEY, where: 'Fayetteville, Arkansas', what: directionSearch(direction), results_per_page: '50', 'content-type': 'application/json'});
  try {
    const response = await fetch(url, {signal: AbortSignal.timeout(20000)});
    if (!response.ok) { console.log(direction, 'HTTP', response.status); continue; }
    const data = filterDirection(await response.json(), direction);
    console.log(JSON.stringify({direction, reviewed: data.reviewed, removed: data.removed, titles: data.results.slice(0,10).map(job => job.title)}));
  } catch { console.log(direction, 'Connection failed'); }
}
