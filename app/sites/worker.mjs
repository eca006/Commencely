import { jobRoute } from '../job-routes.mjs';
import { accountRoute } from './accounts.mjs';
import { assets } from './assets.mjs';

const json = (status, data, cookie) => Response.json(data, {
  status,
  headers: { 'Cache-Control': 'no-store', ...(cookie ? { 'Set-Cookie': cookie } : {}) }
});

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith('/api/account/')) return await accountRoute(request, url, env.DB, json);
      if (request.method !== 'GET') return json(405, { error: 'Method not allowed.' });
      if (url.pathname.startsWith('/api/')) {
        return await jobRoute(url, env, json) ?? json(404, { error: 'Page not found.' });
      }
      const asset = Object.hasOwn(assets, url.pathname) && assets[url.pathname];
      if (!asset) return new Response(assets['/404'][1], { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      const [type, body] = asset;
      return new Response(typeof body === 'string' ? body : body(), { headers: { 'Content-Type': type } });
    } catch {
      return json(503, { error: 'Commencely is temporarily unavailable. Please try again.' });
    }
  }
};
