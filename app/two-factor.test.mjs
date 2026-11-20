import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { accountRoute } from './sites/accounts.mjs';
import { authenticatorCode, authenticatorKey } from './sites/totp.mjs';

test('authenticator codes match RFC 6238', async () => {
  const secret = Buffer.from('12345678901234567890');
  assert.equal(authenticatorKey(secret), 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
  assert.equal(await authenticatorCode(secret.toString('hex'), 1), '287082');
});

test('account access requires a fresh second factor and recovery codes are single use', async () => {
  const sqlite = new DatabaseSync(':memory:');
  for (const migration of ['0000_accounts', '0001_two_factor', '0002_recovery']) {
    sqlite.exec(readFileSync(new URL('./drizzle/' + migration + '.sql', import.meta.url), 'utf8'));
  }
  const db = {
    prepare(sql) {
      return { bind(...parameters) {
        const statement = sqlite.prepare(sql);
        return {
          first(column) {
            const row = statement.get(...parameters);
            return column ? row?.[column] : row;
          },
          run() { return { meta: statement.run(...parameters) }; }
        };
      } };
    },
    batch: statements => statements.map(statement => statement.run())
  };
  function call(action, data, cookie) {
    const url = new URL('https://example.test/api/account/' + action);
    const headers = { Origin: url.origin, 'Content-Type': 'application/json' };
    if (cookie) headers.Cookie = cookie;
    return accountRoute(new Request(url, {
      method: data ? 'POST' : 'GET',
      headers,
      body: data ? JSON.stringify(data) : undefined
    }), url, db, (status, body, setCookie) => ({ status, body, setCookie }),
    async password => password);
  }

  const credentials = { login: 'qa@example.test', password: 'test-password' };
  const signup = await call('sign-up', { ...credentials, confirmation: credentials.password });
  assert.equal(signup.status, 202);
  assert.equal(signup.setCookie, undefined);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM accounts').get().count, 0);
  const { secret } = sqlite.prepare('SELECT secret FROM account_challenges').get();
  const code = await authenticatorCode(secret, Math.floor(Date.now() / 30_000));
  const verification = await call('verify', { challenge: signup.body.challenge, code });
  assert.equal(verification.status, 201);
  const cookie = verification.setCookie.split(';')[0];
  assert.equal((await call('session', null, cookie)).body.id, verification.body.id);
  assert.equal(verification.body.recoveryCodes.length, 10);
  assert.equal((await call('verify', { challenge: signup.body.challenge, code })).status, 410);

  const signIn = await call('sign-in', credentials);
  assert.equal(signIn.status, 202);
  assert.equal(signIn.body.setupKey, null);
  assert.equal(signIn.setCookie, undefined);
  const challenge = signIn.body.challenge;
  assert.equal((await call('verify', { challenge, code })).status, 401);
  const recovery = verification.body.recoveryCodes[0];
  assert.equal((await call('verify', { challenge, code: recovery })).status, 200);
  const retry = await call('sign-in', credentials);
  assert.equal((await call('verify', { challenge: retry.body.challenge, code: recovery })).status, 401);

  const reset = { login: credentials.login, code: verification.body.recoveryCodes[1], password: 'replacement-password', confirmation: 'replacement-password' };
  assert.equal((await call('recover', { ...reset, code: '0'.repeat(20) })).status, 401);
  assert.equal((await call('recover', { ...reset, confirmation: 'mismatch' })).status, 400);
  assert.equal((await call('recover', reset)).status, 200);
  assert.equal((await call('session', null, cookie)).body.id, null);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM sessions').get().count, 0);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM account_challenges').get().count, 0);
  assert.equal((await call('recover', reset)).status, 401);
  assert.equal((await call('sign-in', credentials)).status, 401);
  const afterReset = await call('sign-in', { ...credentials, password: reset.password });
  assert.equal(afterReset.status, 202);
  assert.equal(afterReset.setCookie, undefined);
  assert.equal((await call('verify', { challenge: afterReset.body.challenge, code: verification.body.recoveryCodes[2] })).status, 200);

});
