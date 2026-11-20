import { authenticatorCode, authenticatorKey } from './totp.mjs';
import { pbkdf2 } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { recoveryRoute, recoverySettings, sessionAccount } from './recovery.mjs';

const challengeLifetime = 600;
const lifetime = 7 * 86400;
const passwordIterations = 600_000;
const encoder = new TextEncoder();
const hex = bytes => Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
const random = length => hex(crypto.getRandomValues(new Uint8Array(length)));
const digest = async token => hex(await crypto.subtle.digest('SHA-256', encoder.encode(token)));

async function passwordHash(password, salt) {
  const passwordBytes = encoder.encode(password);
  const saltBytes = encoder.encode(salt);
  const key = await crypto.subtle.importKey('raw', passwordBytes, 'PBKDF2', false, ['deriveBits']);
  try {
    return hex(await crypto.subtle.deriveBits({
      name: 'PBKDF2', hash: 'SHA-256', salt: saltBytes, iterations: passwordIterations
    }, key, 256));
  } catch (error) {
    if (error.name !== 'NotSupportedError') throw error;
    // Some hosted Workers cap native PBKDF2. Preserve the stored hash format.
    return hex(pbkdf2(sha256, passwordBytes, saltBytes, { c: passwordIterations, dkLen: 32 }));
  }
}

function equalHash(first, second) {
  let difference = first.length ^ second.length;
  for (let index = 0; index < first.length; index++) difference |= first.charCodeAt(index) ^ second.charCodeAt(index);
  return difference === 0;
}

function identifier(value) {
  if (typeof value !== 'string' || value.length > 254) return null;
  const input = value.trim().toLowerCase();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input)) return input;
  if (!/^\+?[\d().\s-]+$/.test(input)) return null;
  const digits = input.replace(/\D/g, '');
  if (!input.startsWith('+') && digits.length === 10) return '+1' + digits;
  if (!input.startsWith('+') && /^1\d{10}$/.test(digits)) return '+' + digits;
  return input.startsWith('+') && /^\d{8,15}$/.test(digits) ? '+' + digits : null;
}

export async function accountRoute(request, url, db, json, derive = passwordHash, services = {}) {
  const action = url.pathname.split('/').at(-1);
  const token = request.headers.get('Cookie')?.match(/(?:^|;\s*)commencely_session=([a-f0-9]{64})(?:;|$)/)?.[1];
  const now = Math.floor(Date.now() / 1000);
  if (action === 'recovery-options' && request.method === 'GET') {
    return json(200, { emailEnabled: Boolean(services.mail?.enabled) });
  }
  if (action === 'session' && request.method === 'GET') {
    const account = await sessionAccount(db, token, now);
    return json(200, { id: account?.id ?? null });
  }
  if (action === 'recovery-settings' && request.method === 'GET') {
    const settings = await recoverySettings(db, token, now, services.mail);
    return settings ? json(200, settings) : json(401, { error: 'Sign in to manage recovery settings.' });
  }
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed.' });
  if (request.headers.get('Origin') !== url.origin || request.headers.get('Content-Type') !== 'application/json') {
    return json(403, { error: 'Open Commencely to continue.' });
  }
  const cookie = 'Path=/; HttpOnly; SameSite=Strict' + (url.protocol === 'https:' ? '; Secure' : '');
  if (action === 'sign-out') {
    if (token) await db.prepare('DELETE FROM sessions WHERE token = ?').bind(await digest(token)).run();
    return json(200, {}, 'commencely_session=; Max-Age=0; ' + cookie);
  }
  const signup = action === 'sign-up';
  const recoveryAction = ['recovery-codes', 'recovery-email-start', 'recovery-email-confirm', 'email-reset-request', 'email-reset'].includes(action);
  if (!signup && action !== 'sign-in' && action !== 'verify' && action !== 'recover' && !recoveryAction) return json(404, { error: 'Page not found.' });
  let data;
  try {
    const body = await request.text();
    if (body.length > 4096) return json(413, { error: 'Request is too large.' });
    data = JSON.parse(body);
  } catch {
    return json(400, { error: 'Invalid request.' });
  }
  if (recoveryAction) return recoveryRoute({ action, data, db, json, now, token, derive, services });
  if (action === 'recover') return recoverAccount(data, db, json, now, derive, services);
  if (action === 'verify') return verifyChallenge(data, db, json, now, token, cookie);

  const login = identifier(data?.login);
  const password = data?.password;
  if (!login || typeof password !== 'string' || password.length < 8 || password.length > 128) {
    return json(400, { error: 'Enter a valid email or phone number and a password of 8–128 characters.' });
  }
  if (signup && password !== data.confirmation) return json(400, { error: 'Passwords don’t match.' });
  const account = await db.prepare('SELECT id, salt, hash, totp_secret, security_version FROM accounts WHERE login = ?').bind(login).first();
  if (signup && account) return alreadyRegistered(json);
  const salt = account?.salt ?? random(16);
  const hash = await derive(password, salt);
  if (!signup && (!account || !equalHash(hash, account.hash))) {
    return json(401, { error: 'Email, phone number, or password is incorrect.' });
  }

  const challenge = random(32);
  const secretBytes = account?.totp_secret ? null : crypto.getRandomValues(new Uint8Array(20));
  await db.batch([
    db.prepare('DELETE FROM account_challenges WHERE expires <= ?').bind(now),
    db.prepare('INSERT INTO account_challenges (token, account, login, salt, hash, secret, expires, account_version) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(await digest(challenge), account?.id ?? random(16), login, signup ? salt : null,
        signup ? hash : null, secretBytes ? hex(secretBytes) : null, now + challengeLifetime, account?.security_version ?? 0)
  ]);
  return json(202, { challenge, setupKey: secretBytes ? authenticatorKey(secretBytes) : null });
}

function alreadyRegistered(json) {
  return json(409, { error: 'An account already uses that email or phone number.' });
}

async function verifyChallenge(data, db, json, now, oldToken, cookie) {
  if (typeof data?.challenge !== 'string' || !/^[a-f0-9]{64}$/.test(data.challenge)) {
    return json(400, { error: 'Start sign-in or account setup again.' });
  }
  const code = typeof data.code === 'string' ? data.code.trim().toLowerCase().replaceAll('-', '') : '';
  const isAuthenticatorCode = /^\d{6}$/.test(code);
  if (!isAuthenticatorCode && !/^[a-f0-9]{20}$/.test(code)) {
    return json(400, { error: 'Enter a six-digit authenticator code or a recovery code.' });
  }
  const challengeToken = await digest(data.challenge);
  const challenge = await db.prepare(
    'UPDATE account_challenges SET attempts = attempts + 1 WHERE token = ? AND expires > ? AND attempts < 5 RETURNING *'
  ).bind(challengeToken, now).first();
  if (!challenge) return json(410, { error: 'This verification request expired or had too many attempts. Start again.' });

  const signup = challenge.hash !== null;
  const account = signup ? null : await db.prepare(
    'SELECT totp_secret, totp_step, recovery_hashes, security_version FROM accounts WHERE id = ?'
  ).bind(challenge.account).first();
  if (!signup && (!account || account.security_version !== challenge.account_version || Boolean(challenge.secret) === Boolean(account.totp_secret))) {
    return json(410, { error: 'Your account setup changed. Start sign-in again.' });
  }
  if (account) {
    const window = Math.floor(now / 300);
    const allowed = await db.prepare(
      'UPDATE accounts SET verification_count = CASE WHEN verification_window = ? THEN verification_count + 1 ELSE 1 END, verification_window = ? WHERE id = ? AND (verification_window <> ? OR verification_count < 10)'
    ).bind(window, window, challenge.account, window).run();
    if (!allowed.meta.changes) return json(429, { error: 'Too many verification attempts. Wait a few minutes and try again.' });
  }

  let acceptedStep = null;
  let recoveryHashes = JSON.parse(account?.recovery_hashes ?? '[]');
  if (isAuthenticatorCode) {
    const step = Math.floor(now / 30);
    for (const candidate of [step, step - 1, step + 1]) {
      if (candidate > (account?.totp_step ?? -1)
        && equalHash(await authenticatorCode(challenge.secret ?? account.totp_secret, candidate), code)) {
        acceptedStep = candidate;
        break;
      }
    }
    if (acceptedStep === null) return json(401, { error: 'That authenticator code is invalid or was already used. Try a fresh code.' });
  } else {
    const codeHash = await digest(code);
    if (!recoveryHashes.includes(codeHash)) return json(401, { error: 'That recovery code is invalid or was already used.' });
    recoveryHashes = recoveryHashes.filter(hash => hash !== codeHash);
  }

  // A challenge can issue at most one session, even when requests overlap.
  const consumed = await db.prepare('DELETE FROM account_challenges WHERE token = ?').bind(challengeToken).run();
  if (!consumed.meta.changes) return json(410, { error: 'This verification request was already used. Start again.' });
  // A successful password + last-backup-code sign-in must not strand the user.
  const recoveryCodes = challenge.secret || (!isAuthenticatorCode && recoveryHashes.length === 0) ?
    Array.from({ length: 10 }, () => random(10)) : null;
  if (recoveryCodes) recoveryHashes = await Promise.all(recoveryCodes.map(digest));
  const recovery = JSON.stringify(recoveryHashes);
  let update;
  if (signup) {
    update = db.prepare('INSERT INTO accounts (id, login, salt, hash, totp_secret, totp_step, recovery_hashes) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(login) DO NOTHING')
      .bind(challenge.account, challenge.login, challenge.salt, challenge.hash, challenge.secret, acceptedStep, recovery);
  } else if (challenge.secret) {
    update = db.prepare('UPDATE accounts SET totp_secret = ?, totp_step = ?, recovery_hashes = ? WHERE id = ? AND totp_secret IS NULL AND security_version = ?')
      .bind(challenge.secret, acceptedStep, recovery, challenge.account, challenge.account_version);
  } else if (isAuthenticatorCode) {
    update = db.prepare('UPDATE accounts SET totp_step = ? WHERE id = ? AND totp_step < ? AND security_version = ?')
      .bind(acceptedStep, challenge.account, acceptedStep, challenge.account_version);
  } else {
    update = db.prepare('UPDATE accounts SET recovery_hashes = ? WHERE id = ? AND recovery_hashes = ? AND security_version = ?')
      .bind(recovery, challenge.account, account.recovery_hashes, challenge.account_version);
  }

  if (!(await update.run()).meta.changes) {
    return signup ? alreadyRegistered(json) : json(410, { error: 'That code was already used or your setup changed. Start again.' });
  }

  const session = random(32);
  await db.batch([
    db.prepare('DELETE FROM sessions WHERE expires <= ? OR token = ?').bind(now, oldToken ? await digest(oldToken) : ''),
    db.prepare('INSERT INTO sessions (token, account, expires, two_factor_verified, account_version) VALUES (?, ?, ?, 1, ?)')
      .bind(await digest(session), challenge.account, now + lifetime, challenge.account_version)
  ]);
  return json(signup ? 201 : 200, { id: challenge.account, recoveryCodes },
    'commencely_session=' + session + '; Max-Age=' + lifetime + '; ' + cookie);
}

async function recoverAccount(data, db, json, now, derive, services) {
  const login = identifier(data?.login);
  const code = typeof data?.code === 'string' ? data.code.trim().toLowerCase().replaceAll('-', '') : '';
  if (!login || !/^[a-f0-9]{20}$/.test(code) || typeof data.password !== 'string' ||
      data.password.length < 8 || data.password.length > 128 || data.password !== data.confirmation) {
    return json(400, { error: 'Enter your account, recovery code, and matching passwords of 8–128 characters.' });
  }
  const account = await db.prepare('SELECT id, recovery_hashes, recovery_email, security_version FROM accounts WHERE login = ?').bind(login).first();
  const invalid = () => json(401, { error: 'The account or recovery code is incorrect or the code was already used.' });
  if (!account) return invalid();
  const window = Math.floor(now / 300);
  const allowed = await db.prepare(
    'UPDATE accounts SET verification_count = CASE WHEN verification_window = ? THEN verification_count + 1 ELSE 1 END, verification_window = ? WHERE id = ? AND (verification_window <> ? OR verification_count < 10)'
  ).bind(window, window, account.id, window).run();
  if (!allowed.meta.changes) return json(429, { error: 'Too many recovery attempts. Wait a few minutes and try again.' });
  const hash = await digest(code);
  const codes = JSON.parse(account.recovery_hashes);
  if (!codes.includes(hash)) return invalid();
  if (codes.length < 2) return json(400, { error: 'This is your last recovery code. Do not spend it on a password reset: you would still need another code or your authenticator to sign in. Use verified-email recovery with your authenticator, or sign in with your current password and this code to replace your recovery codes.' });
  const salt = random(16);
  const password = await derive(data.password, salt);
  const updated = await db.prepare('UPDATE accounts SET salt = ?, hash = ?, recovery_hashes = ?, security_version = security_version + 1 WHERE id = ? AND recovery_hashes = ? AND security_version = ?')
    .bind(salt, password, JSON.stringify(codes.filter(value => value !== hash)), account.id, account.recovery_hashes, account.security_version).run();
  if (!updated.meta.changes) return invalid();
  await db.batch([
    db.prepare('DELETE FROM sessions WHERE account = ? AND account_version < ?').bind(account.id, account.security_version + 1),
    db.prepare('DELETE FROM account_challenges WHERE account = ? AND account_version < ?').bind(account.id, account.security_version + 1),
    db.prepare('DELETE FROM recovery_requests WHERE account = ? AND account_version < ?').bind(account.id, account.security_version + 1)
  ]);
  if (services.mail?.enabled && account.recovery_email) services.mail.enqueue(services.mail.send({
    to: account.recovery_email, subject: 'Commencely password changed',
    text: 'Your password was reset using a recovery code. Existing sessions and recovery links were revoked. Two-factor authentication remains enabled.'
  }));
  return json(200, {});
}
