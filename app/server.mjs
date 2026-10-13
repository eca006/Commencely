import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { normalizeJobs } from './jobs.mjs';

const files = { '/': ['index.html', 'text/html'], '/client.js': ['client.js', 'text/javascript'], '/style.css': ['style.css', 'text/css'] };
const json = (res, status, data) => {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
};
http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed.' });
    if (url.pathname === '/api/jobs') {
      const id = process.env.ADZUNA_APP_ID, key = process.env.ADZUNA_APP_KEY;
      if (!id || !key) return json(res, 503, { error: 'Add your Adzuna app ID and key to app/.env, then restart the app.' });
      const location = url.searchParams.get('location') || 'Fayetteville, Arkansas';
      const keywords = url.searchParams.get('keywords') || '';
      if (location.length > 120 || keywords.length > 120) return json(res, 400, { error: 'Keep search fields under 120 characters.' });
      const endpoint = new URL('https://api.adzuna.com/v1/api/jobs/us/search/1');
      endpoint.search = new URLSearchParams({ app_id: id, app_key: key, where: location, what: keywords, results_per_page: '10', 'content-type': 'application/json' });
      const upstream = await fetch(endpoint, { signal: AbortSignal.timeout(15000), headers: { Accept: 'application/json' } });
      if (!upstream.ok) return json(res, 502, { error: `Adzuna returned status ${upstream.status}. Check your credentials or try again later.` });
      return json(res, 200, normalizeJobs(await upstream.json()));
    }
    const file = files[url.pathname];
    if (!file) return json(res, 404, { error: 'Page not found.' });
    res.writeHead(200, { 'Content-Type': file[1] + '; charset=utf-8' });
    res.end(await readFile(new URL('./public/' + file[0], import.meta.url)));
  } catch {
    json(res, 502, { error: 'Unable to load jobs right now. Please try again.' });
  }
}).listen(Number(process.env.PORT || 3000), '127.0.0.1', () => console.log('Commencely: http://localhost:' + (process.env.PORT || 3000)));
