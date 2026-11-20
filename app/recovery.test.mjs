import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { randomBytes, createHash } from 'node:crypto';
import { accountRoute } from './sites/accounts.mjs';
import { authenticatorCode } from './sites/totp.mjs';
import { createRecoveryMail } from './sites/recovery-mail.mjs';
import { runInNewContext } from 'node:vm';

const hash = value => createHash('sha256').update(value).digest('hex');
function fixture(t) {
  const sqlite = new DatabaseSync(':memory:');
  t.after(() => sqlite.close());
  for (const migration of ['0000_accounts', '0001_two_factor', '0002_recovery']) {
    sqlite.exec(readFileSync(new URL('./drizzle/' + migration + '.sql', import.meta.url), 'utf8'));
  }
  const db = {
    prepare(sql) { return { bind(...args) {
      const statement = sqlite.prepare(sql);
      return {
        first(column) { const row = statement.get(...args); return column ? row?.[column] : row; },
        run() { return { meta: statement.run(...args) }; }
      };
    } }; },
    batch(statements) {
      sqlite.exec('BEGIN');
      try { const result = statements.map(s => s.run()); sqlite.exec('COMMIT'); return result; }
      catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    }
  };
  const codes = Array.from({ length: 10 }, () => randomBytes(10).toString('hex'));
  const secret = randomBytes(20).toString('hex');
  const credentials = { login: 'local-fixture@example.test', password: 'fixture-password' };
  sqlite.prepare('INSERT INTO accounts (id, login, salt, hash, totp_secret, recovery_hashes) VALUES (?, ?, ?, ?, ?, ?)')
    .run('fixture-account', credentials.login, 'fixture-salt', credentials.password, secret, JSON.stringify(codes.map(hash)));
  const cookieToken = randomBytes(32).toString('hex');
  const cookie = 'commencely_session=' + cookieToken;
  sqlite.prepare('INSERT INTO sessions (token, account, expires, two_factor_verified) VALUES (?, ?, ?, 1)')
    .run(hash(cookieToken), 'fixture-account', Math.floor(Date.now() / 1000) + 1000);
  const messages = [], pending = [];
  const mail = {
    enabled: true, origin: 'https://example.test',
    async send(message) { messages.push(message); },
    enqueue(task) { pending.push(task.catch(() => {})); }
  };
  async function call(action, data, session = cookie, options = {}) {
    const url = new URL('https://example.test/api/account/' + action);
    const request = new Request(url, {
      method: data === undefined ? 'GET' : 'POST',
      headers: { Origin: url.origin, 'Content-Type': 'application/json', ...(session ? { Cookie: session } : {}) },
      body: data === undefined ? undefined : JSON.stringify(data)
    });
    const result = await accountRoute(request, url, db, (status, body, setCookie) => ({ status, body, setCookie }),
      async value => value, { mail, clientAddress: '192.0.2.1', ...options });
    await Promise.all(pending.splice(0));
    return result;
  }
  const account = () => sqlite.prepare('SELECT * FROM accounts').get();
  const link = kind => messages.findLast(m => m.text.includes('#' + kind + '='))?.text.match(new RegExp('#' + kind + '=([a-f0-9]{64})'))?.[1];
  async function enroll() {
    assert.equal((await call('recovery-email-start', { ...credentials, email: 'recovery-fixture@example.test', code: codes[0] })).status, 200);
    assert.equal(account().recovery_email, null);
    assert.equal((await call('recovery-email-confirm', { token: link('verify') }, null)).status, 200);
  }
  async function resetLink() {
    assert.equal((await call('email-reset-request', { login: credentials.login }, null)).status, 200);
    return link('reset');
  }
  return { sqlite, db, call, mail, messages, codes, secret, credentials, cookie, cookieToken, account, link, enroll, resetLink };
}

test('recovery email requires signed-in fresh proof and explicit email confirmation', async t => {
  const f = fixture(t);
  assert.equal((await f.call('recovery-settings')).body.recoveryEmail, null);
  assert.equal((await f.call('recovery-settings', undefined, null)).status, 401);
  const data = { ...f.credentials, code: f.codes[0], email: 'recovery-fixture@example.test' };
  assert.equal((await f.call('recovery-email-start', data, null)).status, 401);
  assert.equal((await f.call('recovery-email-start', { ...data, password: 'wrong-password' })).status, 401);
  assert.equal((await f.call('recovery-email-start', data)).status, 200);
  const token = f.link('verify');
  assert.equal(f.account().recovery_email, null);
  assert.equal(f.sqlite.prepare('SELECT token FROM recovery_requests').get().token, hash(token));
  assert.equal((await f.call('recovery-email-start', data)).status, 401);
  assert.equal((await f.call('recovery-email-confirm', { token }, null)).status, 200);
  assert.equal(f.account().recovery_email, data.email);
  assert.equal((await f.call('session')).body.id, null);
  assert.equal((await f.call('recovery-email-confirm', { token }, null)).status, 410);
  assert.equal(f.account().login, f.credentials.login);
});

test('reset requests do not disclose whether an account exists or has verified email', async t => {
  const f = fixture(t);
  const unknown = await f.call('email-reset-request', { login: 'unknown@example.test' }, null);
  const unenrolled = await f.call('email-reset-request', { login: f.credentials.login }, null);
  assert.deepEqual(unknown, unenrolled);
  assert.equal(f.messages.length, 0);
  await f.enroll();
  const enrolled = await f.call('email-reset-request', { login: f.credentials.login }, null);
  assert.deepEqual(enrolled, unknown);
  assert.equal(JSON.stringify(enrolled).includes(f.link('reset')), false);
});

test('email link alone cannot reset a password; a valid factor preserves 2FA and account identity', async t => {
  const f = fixture(t); await f.enroll();
  const token = await f.resetLink();
  const data = { token, password: 'new-fixture-password', confirmation: 'new-fixture-password' };
  const before = f.account();
  assert.equal((await f.call('email-reset', data, null)).status, 401);
  assert.equal(f.account().hash, before.hash);
  assert.equal((await f.call('email-reset', { ...data, confirmation: 'mismatch', code: f.codes[1] }, null)).status, 400);
  assert.equal((await f.call('email-reset', { ...data, code: f.codes[1] }, null)).status, 200);
  assert.equal(f.account().id, before.id);
  assert.equal(f.account().totp_secret, before.totp_secret);
  assert.equal(f.account().hash, data.password);
  assert.equal(JSON.parse(f.account().recovery_hashes).includes(hash(f.codes[1])), false);
  assert.equal((await f.call('email-reset', { ...data, code: f.codes[2] }, null)).status, 410);
});

test('email reset accepts a fresh authenticator code and rejects a replay', async t => {
  const f = fixture(t); await f.enroll();
  const token = await f.resetLink();
  const code = await authenticatorCode(f.secret, Math.floor(Date.now() / 30_000));
  const data = { token, code, password: 'new-fixture-password', confirmation: 'new-fixture-password' };
  assert.equal((await f.call('email-reset', data, null)).status, 200);
  const again = await f.resetLink();
  assert.equal((await f.call('email-reset', { ...data, token: again }, null)).status, 401);
});

test('expired, replaced, wrong-purpose and exhausted links cannot change an account', async t => {
  const f = fixture(t); await f.enroll();
  const first = await f.resetLink(), second = await f.resetLink();
  const data = { password: 'new-fixture-password', confirmation: 'new-fixture-password', code: f.codes[1] };
  assert.equal((await f.call('email-reset', { ...data, token: first }, null)).status, 410);
  assert.equal((await f.call('recovery-email-confirm', { token: second }, null)).status, 410);
  f.sqlite.prepare('UPDATE recovery_requests SET expires = 0').run();
  assert.equal((await f.call('email-reset', { ...data, token: second }, null)).status, 410);
  const third = await f.resetLink();
  for (let i = 0; i < 5; i++) assert.equal((await f.call('email-reset', { ...data, token: third, code: 'invalid' }, null)).status, 401);
  assert.equal((await f.call('email-reset', { ...data, token: third }, null)).status, 410);
  assert.equal(f.account().hash, f.credentials.password);
});

test('concurrent reset attempts succeed at most once and stale sessions remain invalid', async t => {
  const f = fixture(t); await f.enroll();
  const before = f.account().security_version;
  const token = await f.resetLink();
  const data = { token, code: f.codes[1], password: 'new-fixture-password', confirmation: 'new-fixture-password' };
  const responses = await Promise.all([f.call('email-reset', data, null), f.call('email-reset', data, null)]);
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 410]);
  assert.equal(f.account().security_version, before + 1);
  f.sqlite.prepare('INSERT INTO sessions (token, account, expires, two_factor_verified, account_version) VALUES (?, ?, ?, 1, ?)')
    .run(hash(f.cookieToken), f.account().id, Math.floor(Date.now() / 1000) + 1000, before);
  assert.equal((await f.call('session')).body.id, null);
});

test('code replacement requires password and fresh second factor, and invalidates old access', async t => {
  const f = fixture(t);
  assert.equal((await f.call('recovery-codes', { password: 'wrong', code: f.codes[0] })).status, 401);
  const rotation = await f.call('recovery-codes', { ...f.credentials, code: f.codes[0] });
  assert.equal(rotation.status, 200);
  assert.equal(rotation.body.recoveryCodes.length, 10);
  assert.equal(new Set(rotation.body.recoveryCodes).size, 10);
  assert.equal((await f.call('session')).body.id, null);
  const hashes = JSON.parse(f.account().recovery_hashes);
  assert.equal(hashes.includes(hash(f.codes[1])), false);
  assert.equal(hashes.includes(hash(rotation.body.recoveryCodes[0])), true);
});

test('last-code password reset is blocked without consuming it, but password sign-in replaces it', async t => {
  const f = fixture(t);
  f.sqlite.prepare('UPDATE accounts SET recovery_hashes = ?').run(JSON.stringify([hash(f.codes[0])]));
  const result = await f.call('recover', { ...f.credentials, code: f.codes[0], password: 'next-fixture-password', confirmation: 'next-fixture-password' }, null);
  assert.equal(result.status, 400);
  assert.match(result.body.error, /last recovery code/);
  assert.equal(JSON.parse(f.account().recovery_hashes).length, 1);
  const start = await f.call('sign-in', f.credentials, null);
  const login = await f.call('verify', { challenge: start.body.challenge, code: f.codes[0] }, null);
  assert.equal(login.status, 200);
  assert.equal(login.body.recoveryCodes.length, 10);
});

test('email reset using the final backup code issues replacements instead of stranding the user', async t => {
  const f = fixture(t); await f.enroll();
  f.sqlite.prepare('UPDATE accounts SET recovery_hashes = ?').run(JSON.stringify([hash(f.codes[1])]));
  const token = await f.resetLink();
  const result = await f.call('email-reset', { token, code: f.codes[1], password: 'next-fixture-password', confirmation: 'next-fixture-password' }, null);
  assert.equal(result.status, 200);
  assert.equal(result.body.recoveryCodes.length, 10);
});

test('missing email configuration fails closed without changing the account', async t => {
  const f = fixture(t); f.mail.enabled = false;
  const before = f.account();
  assert.equal((await f.call('recovery-options')).body.emailEnabled, false);
  assert.equal((await f.call('email-reset-request', { login: f.credentials.login }, null)).status, 503);
  assert.equal((await f.call('recovery-email-start', { ...f.credentials, email: 'recovery@example.test', code: f.codes[0] })).status, 503);
  assert.deepEqual(f.account(), before);
});

test('confirmation delivery failures leave the address unchanged and expose no provider details', async t => {
  const f = fixture(t);
  f.mail.send = async () => { throw new Error('Private provider failure detail'); };
  const result = await f.call('recovery-email-start', { ...f.credentials, email: 'recovery@example.test', code: f.codes[0] });
  assert.equal(result.status, 503);
  assert.equal(JSON.stringify(result).includes('Private provider'), false);
  assert.equal(f.account().recovery_email, null);
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS n FROM recovery_requests').get().n, 0);
});

test('reset email requests are throttled while responses stay generic', async t => {
  const f = fixture(t); await f.enroll();
  const before = f.messages.length;
  let expected;
  for (let i = 0; i < 8; i++) {
    const response = await f.call('email-reset-request', { login: f.credentials.login }, null);
    expected ??= response;
    assert.deepEqual(response, expected);
  }
  assert.equal(f.messages.length - before, 5);
});

test('recovery mutations reject cross-origin requests', async t => {
  const f = fixture(t);
  const url = new URL('https://example.test/api/account/recovery-codes');
  const request = new Request(url, { method: 'POST', headers: { Origin: 'https://other.test', 'Content-Type': 'application/json' }, body: '{}' });
  const response = await accountRoute(request, url, f.db, (status, body) => ({ status, body }));
  assert.equal(response.status, 403);
});

test('mail adapter is disabled by default, pins the public origin, and sanitizes failures', async () => {
  assert.equal(createRecoveryMail({}).enabled, false);
  const env = { ACCOUNT_EMAIL_RECOVERY: 'enabled', ACCOUNT_PUBLIC_ORIGIN: 'https://example.test', ACCOUNT_EMAIL_FROM: 'sender@example.test', RESEND_API_KEY: 'fixture-not-a-real-credential' };
  assert.equal(createRecoveryMail({ ...env, ACCOUNT_PUBLIC_ORIGIN: 'https://example.test/unexpected' }).enabled, false);
  let sent;
  const mail = createRecoveryMail(env, { fetchImpl: async (url, request) => { sent = { url, request }; return new Response('{}'); } });
  await mail.send({ to: 'recipient@example.test', subject: 'Fixture', text: 'Test message' });
  assert.equal(sent.url, 'https://api.resend.com/emails');
  assert.deepEqual(JSON.parse(sent.request.body).to, ['recipient@example.test']);
  const failing = createRecoveryMail(env, { fetchImpl: async () => new Response('provider details', { status: 500 }) });
  await assert.rejects(() => failing.send({ to: 'recipient@example.test', text: 'test' }), /^Error: Email delivery failed\.$/);
});

test('recovery links work on initial load and same-page hash navigation without mutating GETs', async () => {
  const source = readFileSync(new URL('./public/recovery.js', import.meta.url), 'utf8')
    .replace("import { displayRecoveryCodes } from './recovery-codes.js';", '');
  const nodes = new Map(), handlers = {}, calls = [];
  const node = selector => {
    if (!nodes.has(selector)) nodes.set(selector, { hidden: true, textContent: '', addEventListener() {} });
    return nodes.get(selector);
  };
  const location = { pathname: '/account-help', hash: '#reset=' + 'a'.repeat(64) };
  await runInNewContext('(async()=>{' + source + '})()', {
    document: { querySelector: node }, location, URLSearchParams, AbortSignal,
    history: { replaceState() { location.hash = ''; } },
    window: { addEventListener(name, handler) { handlers[name] = handler; } },
    fetch: async (url, options) => {
      calls.push({ url, method: options.method ?? 'GET' });
      return { ok: true, json: async () => ({ emailEnabled: true }) };
    }
  });
  assert.equal(node('#email-reset-panel').hidden, false);
  assert.equal(location.hash, '');
  location.hash = '#verify=' + 'b'.repeat(64); handlers.hashchange();
  assert.equal(node('#email-reset-panel').hidden, true);
  assert.equal(node('#confirm-email-panel').hidden, false);
  assert.equal(location.hash, '');
  location.hash = '#reset=invalid'; handlers.hashchange();
  assert.equal(node('#email-reset-panel').hidden, true);
  assert.equal(node('#confirm-email-panel').hidden, true);
  assert.match(node('#recovery-status').textContent, /invalid/);
  assert.deepEqual(calls, [{ url: '/api/account/recovery-options', method: 'GET' }]);
});
