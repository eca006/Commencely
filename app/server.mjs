import { jobRoute } from './job-routes.mjs';
import { accountRequest } from './accounts.mjs';
import http from 'node:http';
import { readFile } from 'node:fs/promises';

const files = { '/resume-word.js':['resume-word.js','text/javascript'], '/resume-templates.js':['resume-templates.js','text/javascript'], '/resume-picker.js':['resume-picker.js','text/javascript'], '/resume-import.js':['resume-import.js','text/javascript'], '/resume-guidance.js':['resume-guidance.js','text/javascript'], '/resume-pdf.js':['resume-pdf.js','text/javascript'], '/resume/build': ['resume-build.html','text/html'], '/resume-build.js': ['resume-build.js','text/javascript'], '/resume/edit': ['resume-edit.html', 'text/html'], '/resume-edit.js': ['resume-edit.js', 'text/javascript'], '/support': ['support.html', 'text/html'], '/': ['index.html', 'text/html'], '/jobs': ['index.html', 'text/html'], '/client.js': ['client.js', 'text/javascript'], '/careers.js': ['careers.js', 'text/javascript'], '/style.css': ['style.css', 'text/css'], '/resume': ['resume.html','text/html'], '/resume.js':['resume.js','text/javascript'], '/resume-model.js':['resume-model.js','text/javascript'] };

for(const path of ['/build-resume/start','/build-resume','/build-resume/choose-template','/build-resume/select-resume',...['cntc','expr','educ','skil','summ','addl','final'].map(section=>'/build-resume/section/'+section)])files[path]=['resume-build.html','text/html'];
files['/resume-builder.css']=['resume-builder.css','text/css'];
Object.assign(files, {
  '/404': ['404.html', 'text/html'],
  '/404.js': ['404.js', 'text/javascript'],
  '/account-help': ['account-help.html', 'text/html'],
  '/account-security': ['account-security.html', 'text/html'],
  '/account-security.js': ['account-security.js', 'text/javascript'],
  '/recovery-codes.js': ['recovery-codes.js', 'text/javascript'],
  '/recovery.js': ['recovery.js', 'text/javascript'],
  '/sign-in': ['account.html', 'text/html'],
  '/sign-up': ['account.html', 'text/html'],
  '/account.js': ['account.js', 'text/javascript'],
  '/profile-storage.js': ['profile-storage.js', 'text/javascript'],
  '/resume-storage.js': ['resume-storage.js', 'text/javascript'],
  '/budget': ['budget.html', 'text/html'],
  '/budget.js': ['budget.js', 'text/javascript'],
  '/business-majors.js': ['business-majors.js', 'text/javascript'],
  '/job-snippet.js': ['job-snippet.js', 'text/javascript'],
  '/employer-logos.js': ['employer-logos.js', 'text/javascript'],
  '/applications': ['applications.html', 'text/html'],
  '/applications.js': ['applications.js', 'text/javascript']
});
const vendorFiles = {
  '/vendor/phosphor.css':'@phosphor-icons/web/src/regular/style.css',
  '/vendor/Phosphor.woff2':'@phosphor-icons/web/src/regular/Phosphor.woff2',
  '/vendor/Phosphor.woff':'@phosphor-icons/web/src/regular/Phosphor.woff',
  '/vendor/Phosphor.ttf':'@phosphor-icons/web/src/regular/Phosphor.ttf',
  '/vendor/Phosphor.svg':'@phosphor-icons/web/src/regular/Phosphor.svg',
  '/vendor/docx.js':'docx/dist/index.iife.js',
  '/vendor/jspdf.js':'jspdf/dist/jspdf.umd.min.js',
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
    if (url.pathname.startsWith('/api/account/')) return await accountRequest(req, res, url.pathname);
    if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed.' });
    if (vendorFiles[url.pathname]) {
      const content = await readFile(new URL('./node_modules/'+vendorFiles[url.pathname],import.meta.url));
      const mime=url.pathname.endsWith('.css')?'text/css; charset=utf-8':url.pathname.endsWith('.woff2')?'font/woff2':url.pathname.endsWith('.woff')?'font/woff':url.pathname.endsWith('.ttf')?'font/ttf':url.pathname.endsWith('.svg')?'image/svg+xml':'text/javascript; charset=utf-8';
      res.writeHead(200,{'Content-Type':mime}); return res.end(content);
    }
    if (url.pathname.startsWith('/api/')) {
      const handled = await jobRoute(url, process.env, (status, data) => {
        json(res, status, data);
        return true;
      });
      if (handled) return;
    }
    if (/^\/logos\/[a-z0-9-]+\.png$/.test(url.pathname)) {
      const logo = await readFile(new URL('./public' + url.pathname, import.meta.url)).catch(() => null);
      if (!logo) return json(res, 404, { error: 'Page not found.' });
      res.writeHead(200, { 'Content-Type': 'image/png' });
      return res.end(logo);
    }
    const file = files[url.pathname];
    if (!file) {
      if (url.pathname.startsWith('/api/')) return json(res, 404, { error: 'Page not found.' });
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(await readFile(new URL('./public/404.html', import.meta.url)));
    }
    res.writeHead(200, {
      'Content-Type': file[1] + '; charset=utf-8',
      ...(['/account-help', '/account-security', '/sign-in', '/sign-up'].includes(url.pathname) ?
        { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } : {})
    });
    res.end(await readFile(new URL('./public/' + file[0], import.meta.url)));
  } catch {
    if (req.url.startsWith('/api/account/')) return json(res, 503, { error: 'Account service is temporarily unavailable. Please try again.' });
    json(res, 502, { error: 'Unable to load jobs right now. Please try again.' });
  }
}).listen(Number(process.env.PORT || 3000), '127.0.0.1', () => console.log('Commencely: http://localhost:' + (process.env.PORT || 3000)));
