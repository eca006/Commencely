import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { normalizeJobs } from './jobs.mjs';
import { directionSearch, filterDirection } from './search.mjs';
import { getEmployerJobs } from './employer-jobs.mjs';

const files = { '/resume/edit': ['resume-edit.html', 'text/html'], '/resume-edit.js': ['resume-edit.js', 'text/javascript'], '/support': ['support.html', 'text/html'], '/': ['index.html', 'text/html'], '/client.js': ['client.js', 'text/javascript'], '/careers.js': ['careers.js', 'text/javascript'], '/style.css': ['style.css', 'text/css'], '/resume': ['resume.html','text/html'], '/resume.js':['resume.js','text/javascript'], '/resume-model.js':['resume-model.js','text/javascript'] };
const vendorFiles = {
  '/vendor/pdf.mjs':'pdfjs-dist/build/pdf.mjs',
  '/vendor/pdf.worker.mjs':'pdfjs-dist/build/pdf.worker.mjs',
  '/vendor/mammoth.js':'mammoth/mammoth.browser.min.js'
};
const json = (res, status, data) => {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
};
http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed.' });
    if (vendorFiles[url.pathname]) {
      const content = await readFile(new URL('./node_modules/'+vendorFiles[url.pathname],import.meta.url));
      res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8'}); return res.end(content);
    }
    if (url.pathname === '/api/employer-jobs') {
      const query=Object.fromEntries(['direction','keywords','location'].map(key=>[key,url.searchParams.get(key)||'']));
      if (query.direction && !directionSearch(query.direction) || Object.values(query).some(value=>value.length>120)) return json(res,400,{error:'Invalid search.'});
      try { return json(res,200,await getEmployerJobs(query)); }
      catch { return json(res,502,{error:'Employer feed unavailable. Adzuna results may still be available.'}); }
    }
    if (url.pathname === '/api/jobs') {
      const id = process.env.ADZUNA_APP_ID, key = process.env.ADZUNA_APP_KEY;
      if (!id || !key) return json(res, 503, { error: 'Add your Adzuna app ID and key to app/.env, then restart the app.' });
      const location = url.searchParams.get('location') || 'Fayetteville, Arkansas';
      const keywords = url.searchParams.get('keywords') || '';
      const direction = url.searchParams.get('direction');
      if (direction && !directionSearch(direction)) return json(res, 400, { error: 'Choose a valid career direction.' });
      if (location.length > 120 || keywords.length > 120) return json(res, 400, { error: 'Keep search fields under 120 characters.' });
      const endpoint = new URL('https://api.adzuna.com/v1/api/jobs/us/search/1');
      endpoint.search = new URLSearchParams({ app_id: id, app_key: key, where: location, what: direction ? directionSearch(direction) : keywords, results_per_page: direction ? '50' : '10', 'content-type': 'application/json' });
      const upstream = await fetch(endpoint, { signal: AbortSignal.timeout(15000), headers: { Accept: 'application/json' } });
      if (!upstream.ok) return json(res, 502, { error: [401, 403].includes(upstream.status) ? 'Adzuna could not authorize this search. Check your server credentials and account access.' : `Adzuna returned status ${upstream.status}. Please try again later.` });
      const raw = await upstream.json();
      if (!direction) return json(res, 200, normalizeJobs(raw));
      const filtered = filterDirection(raw, direction);
      const normalized = normalizeJobs(filtered);
      return json(res, 200, { ...normalized, jobs: normalized.jobs.slice(0, 10), reviewed: filtered.reviewed, removed: filtered.removed, relevant: normalized.jobs.length });
    }
    const file = files[url.pathname];
    if (!file) return json(res, 404, { error: 'Page not found.' });
    res.writeHead(200, { 'Content-Type': file[1] + '; charset=utf-8' });
    res.end(await readFile(new URL('./public/' + file[0], import.meta.url)));
  } catch {
    json(res, 502, { error: 'Unable to load jobs right now. Please try again.' });
  }
}).listen(Number(process.env.PORT || 3000), '127.0.0.1', () => console.log('Commencely: http://localhost:' + (process.env.PORT || 3000)));
