import { readFile, writeFile, mkdir, copyFile, readdir } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const root = new URL('../', import.meta.url);
const read = (path, encoding) => readFile(new URL(path, root), encoding);
const server = await read('server.mjs', 'utf8');
const routeDefinitions = server.slice(server.indexOf('const files ='), server.indexOf('const json ='));
const { files, vendorFiles } = runInNewContext(routeDefinitions + '\n({files, vendorFiles})');
const output = new URL('dist/server/', root);
await mkdir(output, { recursive: true });
const assetEntries = [];
for (const [route, [file, type]] of Object.entries(files)) {
  const content = await read('public/' + file, 'utf8');
  assetEntries.push([route, [type + '; charset=utf-8', content]]);
}
for (const file of (await readdir(new URL('public/logos/', root))).sort()) {
  if (!/^[a-z0-9-]+\.png$/.test(file)) continue;
  const logo = await read('public/logos/' + file);
  assetEntries.push(['/logos/' + file, ['image/png', logo.toString('base64'), true]]);
}
for (const [route, file] of Object.entries(vendorFiles)) {
  const ext = route.split('.').at(-1);
  const type = { css: 'text/css', svg: 'image/svg+xml', woff2: 'font/woff2', woff: 'font/woff', ttf: 'font/ttf' }[ext] ?? 'text/javascript';
  const content = await read('node_modules/' + file);
  assetEntries.push([route, [type, ['woff2', 'woff', 'ttf'].includes(ext) ? content.toString('base64') : content.toString('utf8'), ['woff2', 'woff', 'ttf'].includes(ext)]]);
}
const source = JSON.stringify(Object.fromEntries(assetEntries)).replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029');
await writeFile(new URL('assets.mjs', output), 'export const assets = Object.fromEntries(Object.entries(' + source +
  ').map(([route,[type,body,binary]]) => [route,[type,binary ? () => Uint8Array.from(atob(body), c => c.charCodeAt(0)) : body]]));\n');
const worker = await read('sites/worker.mjs', 'utf8');
await writeFile(new URL('index.js', output), worker.replace('../job-routes.mjs', './job-routes.mjs'));
await copyFile(new URL('sites/totp.mjs', root), new URL('totp.mjs', output));
const accounts = await read('sites/accounts.mjs', 'utf8');
await writeFile(new URL('accounts.mjs', output), accounts.replaceAll("'@noble/hashes/", "'./noble-hashes/"));
const hashingModules = new URL('noble-hashes/', output);
await mkdir(hashingModules, { recursive: true });
for (const file of ['pbkdf2.js', 'sha2.js', 'hmac.js', 'utils.js', '_md.js', '_u64.js', 'LICENSE']) {
  await copyFile(new URL('node_modules/@noble/hashes/' + file, root), new URL(file, hashingModules));
}
for (const name of ['job-routes', 'jobs', 'careeronestop', 'search', 'employer-jobs', 'regional-employer-feeds', 'qualifications']) {
  const module = await read(name + '.mjs', 'utf8');
  await writeFile(new URL(name + '.mjs', output), module.replaceAll('./public/business-majors.js', './business-majors.mjs'));
}
await copyFile(new URL('public/business-majors.js', root), new URL('business-majors.mjs', output));
