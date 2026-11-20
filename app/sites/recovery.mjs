import { authenticatorCode } from './totp.mjs';

const encoder = new TextEncoder();
const hex = bytes => Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
const random = size => hex(crypto.getRandomValues(new Uint8Array(size)));
const digest = async value => hex(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))));
const normalizeCode = value => typeof value === 'string' ? value.trim().toLowerCase().replaceAll('-', '') : '';
const emailAddress = value => typeof value === 'string' && value.length <= 254 &&
  /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value.trim()) ? value.trim().toLowerCase() : null;
const validPassword = data => typeof data?.password === 'string' && data.password.length >= 8 &&
  data.password.length <= 128 && data.password === data.confirmation;
const genericRequest = { message: 'If this account has a verified recovery email, a reset link will be sent. Check your inbox and spam folder.' };
const expired = json => json(410, { error: 'This link expired, was already used, or your account changed. Request a new link.' });
function loginIdentifier(value) {
  if (typeof value !== 'string' || value.length > 254) return '';
  const input = value.trim().toLowerCase();
  if (input.includes('@')) return input;
  if (!/^\+?[\d().\s-]+$/.test(input)) return '';
  const digits = input.replace(/\D/g, '');
  if (!input.startsWith('+') && digits.length === 10) return '+1' + digits;
  if (!input.startsWith('+') && /^1\d{10}$/.test(digits)) return '+' + digits;
  return input.startsWith('+') && /^\d{8,15}$/.test(digits) ? '+' + digits : '';
}

export async function sessionAccount(db, token, now) {
  if (!token) return null;
  return db.prepare(`SELECT a.* FROM accounts a JOIN sessions s ON s.account = a.id
    WHERE s.token = ? AND s.expires > ? AND s.two_factor_verified = 1
    AND s.account_version = a.security_version`).bind(await digest(token), now).first();
}

async function limit(db, key, now, maximum, seconds = 3600) {
  const window = Math.floor(now / seconds);
  const result = await db.prepare(`INSERT INTO recovery_limits (key, window, count) VALUES (?, ?, 1)
    ON CONFLICT(key) DO UPDATE SET
      count = CASE WHEN window = excluded.window THEN count + 1 ELSE 1 END,
      window = excluded.window
    WHERE window <> excluded.window OR count < ?
    RETURNING count`).bind(await digest(key), window, maximum).first();
  return Boolean(result);
}

async function allowFactor(db, account, now) {
  const window = Math.floor(now / 300);
  return Boolean((await db.prepare(`UPDATE accounts SET
    verification_count = CASE WHEN verification_window = ? THEN verification_count + 1 ELSE 1 END,
    verification_window = ? WHERE id = ? AND (verification_window <> ? OR verification_count < 10)`)
    .bind(window, window, account.id, window).run()).meta.changes);
}

function equal(first, second) {
  let difference = first.length ^ second.length;
  for (let i = 0; i < first.length; i++) difference |= first.charCodeAt(i) ^ second.charCodeAt(i);
  return difference === 0;
}

async function factor(account, value, now) {
  const code = normalizeCode(value);
  if (/^\d{6}$/.test(code) && account.totp_secret) {
    const current = Math.floor(now / 30);
    for (const step of [current, current - 1, current + 1]) {
      if (step > account.totp_step && equal(await authenticatorCode(account.totp_secret, step), code)) {
        return { step, hashes: account.recovery_hashes };
      }
    }
  } else if (/^[a-f0-9]{20}$/.test(code)) {
    const hash = await digest(code);
    const codes = JSON.parse(account.recovery_hashes);
    if (codes.includes(hash)) return {
      step: account.totp_step, hashes: JSON.stringify(codes.filter(item => item !== hash))
    };
  }
  return null;
}

const proofWhere = 'id = ? AND security_version = ? AND totp_step = ? AND recovery_hashes = ?';
const proofArgs = account => [account.id, account.security_version, account.totp_step, account.recovery_hashes];

async function freshProof(db, account, data, now, derive) {
  if (!await allowFactor(db, account, now)) return null;
  if (typeof data?.password !== 'string' || data.password.length > 128 ||
      !equal(await derive(data.password, account.salt), account.hash)) return null;
  return factor(account, data.code, now);
}

async function clearOldAccess(db, account, version) {
  // Keep any NEW sessions created after the committed security change.
  await db.batch([
    db.prepare('DELETE FROM sessions WHERE account = ? AND account_version < ?').bind(account, version),
    db.prepare('DELETE FROM account_challenges WHERE account = ? AND account_version < ?').bind(account, version),
    db.prepare('DELETE FROM recovery_requests WHERE account = ? AND account_version < ?').bind(account, version)
  ]);
}

function notify(mail, email, text) {
  if (mail?.enabled && email) mail.enqueue(mail.send({ to: email, subject: 'Commencely account security change', text }));
}

async function makeRequest(db, account, kind, email, now) {
  const token = random(32);
  const hash = await digest(token);
  await db.batch([
    db.prepare('DELETE FROM recovery_requests WHERE expires <= ? OR (account = ? AND kind = ?)').bind(now, account.id, kind),
    db.prepare('INSERT INTO recovery_requests (token, account, kind, email, account_version, expires) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(hash, account.id, kind, email, account.security_version, now + 900)
  ]);
  return { token, hash };
}

export async function recoverySettings(db, token, now, mail) {
  const account = await sessionAccount(db, token, now);
  return account ? {
    recoveryEmail: account.recovery_email, remainingCodes: JSON.parse(account.recovery_hashes).length,
    emailEnabled: Boolean(mail?.enabled)
  } : null;
}

export async function recoveryRoute({ action, data, db, json, now, token, derive, services = {} }) {
  const mail = services.mail;
  const denied = () => json(401, { error: 'Sign in again to manage recovery settings.' });
  const badProof = () => json(401, { error: 'Check your current password and use a fresh authenticator or unused recovery code. Too many attempts? Wait five minutes.' });
  const disabled = () => json(503, { error: 'Email recovery is not available. Use a saved recovery code instead.' });
  if (!await limit(db, 'ip:' + (services.clientAddress ?? 'unavailable'), now, 60)) {
    return json(429, { error: 'Too many recovery requests. Wait an hour and try again.' });
  }
  await db.prepare('DELETE FROM recovery_limits WHERE window < ?').bind(Math.floor(now / 3600) - 2).run();
  if (action === 'recovery-codes' || action === 'recovery-email-start') {
    const account = await sessionAccount(db, token, now);
    if (!account) return denied();
    if (action === 'recovery-email-start' && !mail?.enabled) return disabled();
    const email = action === 'recovery-email-start' ? emailAddress(data?.email) : null;
    if (action === 'recovery-email-start' && !email) return json(400, { error: 'Enter a valid recovery email address.' });
    if (action === 'recovery-email-start' && !await limit(db, 'enroll:' + account.id, now, 5)) {
      return json(429, { error: 'Too many confirmation emails. Wait an hour and try again.' });
    }
    const proof = await freshProof(db, account, data, now, derive);
    if (!proof) return badProof();
    if (action === 'recovery-codes') {
      const codes = Array.from({ length: 10 }, () => random(10));
      const hashes = JSON.stringify(await Promise.all(codes.map(digest)));
      const updated = await db.prepare(`UPDATE accounts SET recovery_hashes = ?, totp_step = ?,
        security_version = security_version + 1 WHERE ${proofWhere}`)
        .bind(hashes, proof.step, ...proofArgs(account)).run();
      if (!updated.meta.changes) return badProof();
      await clearOldAccess(db, account.id, account.security_version + 1);
      notify(mail, account.recovery_email, 'Your recovery codes were replaced and existing sessions were revoked. Old recovery codes no longer work.');
      return json(200, { recoveryCodes: codes, signedOut: true });
    }
    if (JSON.parse(proof.hashes).length === 0 && /^[a-f0-9]{20}$/.test(normalizeCode(data.code))) {
      return json(400, { error: 'Replace your recovery codes before using your last code to change your email.' });
    }
    const updated = await db.prepare(`UPDATE accounts SET recovery_hashes = ?, totp_step = ? WHERE ${proofWhere}`)
      .bind(proof.hashes, proof.step, ...proofArgs(account)).run();
    if (!updated.meta.changes) return badProof();
    const link = await makeRequest(db, account, 'verify', email, now);
    try {
      await mail.send({ to: email, subject: 'Confirm your Commencely recovery email',
        text: `You requested this address as your recovery email. Open the link, then choose Confirm email within 15 minutes:\n${mail.origin}/account-help#verify=${link.token}\n\nIf you did not request this, do not confirm. This link alone cannot reset a password.` });
    } catch {
      await db.prepare('DELETE FROM recovery_requests WHERE token = ?').bind(link.hash).run();
      return json(503, { error: 'The confirmation email could not be sent. Your recovery email has not changed. Try again with a fresh code.' });
    }
    return json(200, { message: 'Confirmation email sent. Your recovery address will not change until you confirm it. Confirming signs out existing sessions.' });
  }
  if (action === 'email-reset-request') {
    if (!mail?.enabled) return disabled();
    // Count known and unknown identifiers the same way; never disclose enrollment.
    const login = loginIdentifier(data?.login);
    if (!await limit(db, 'reset:' + login, now, 5) ||
        !await limit(db, 'email-global', now, 100)) return json(200, genericRequest);
    const account = await db.prepare('SELECT * FROM accounts WHERE login = ?').bind(login).first();
    if (account?.recovery_email) {
      const link = await makeRequest(db, account, 'reset', account.recovery_email, now);
      // Enqueue delivery: provider latency/failure must not reveal account existence.
      mail.enqueue(mail.send({ to: account.recovery_email, subject: 'Reset your Commencely password',
        text: `Open this link within 15 minutes:\n${mail.origin}/account-help#reset=${link.token}\n\nYou must also provide an authenticator or unused recovery code. If you did not request this, ignore this email. Your password has not changed.` })
        .catch(async () => { await db.prepare('DELETE FROM recovery_requests WHERE token = ?').bind(link.hash).run(); throw new Error('Delivery failed'); }));
    }
    return json(200, genericRequest);
  }
  if (action === 'recovery-email-confirm' || action === 'email-reset') {
    if (!mail?.enabled) return disabled();
    if (typeof data?.token !== 'string' || !/^[a-f0-9]{64}$/.test(data.token)) return expired(json);
    const request = await db.prepare(`UPDATE recovery_requests SET attempts = attempts + 1
      WHERE token = ? AND kind = ? AND expires > ? AND attempts < 5 RETURNING *`)
      .bind(await digest(data.token), action === 'email-reset' ? 'reset' : 'verify', now).first();
    if (!request) return expired(json);
    const account = await db.prepare('SELECT * FROM accounts WHERE id = ?').bind(request.account).first();
    if (!account || account.security_version !== request.account_version) return expired(json);
    let proof = { step: account.totp_step, hashes: account.recovery_hashes };
    let salt = account.salt, password = account.hash, recoveryCodes = null;
    if (action === 'email-reset') {
      if (account.recovery_email !== request.email) return expired(json);
      if (!validPassword(data)) return json(400, { error: 'Enter matching passwords of 8–128 characters.' });
      if (!await allowFactor(db, account, now)) return json(429, { error: 'Too many verification attempts. Wait five minutes and request another link.' });
      proof = await factor(account, data.code, now);
      if (!proof) return json(401, { error: 'Enter a fresh authenticator or unused recovery code. Email access alone cannot reset your password.' });
      if (JSON.parse(proof.hashes).length === 0 && /^[a-f0-9]{20}$/.test(normalizeCode(data.code))) {
        recoveryCodes = Array.from({ length: 10 }, () => random(10));
        proof.hashes = JSON.stringify(await Promise.all(recoveryCodes.map(digest)));
      }
      salt = random(16); password = await derive(data.password, salt);
    }
    const updated = await db.prepare(`UPDATE accounts SET recovery_email = ?, salt = ?, hash = ?,
      totp_step = ?, recovery_hashes = ?, security_version = security_version + 1
      WHERE ${proofWhere} AND EXISTS (SELECT 1 FROM recovery_requests WHERE token = ? AND expires > ?)`)
      .bind(action === 'recovery-email-confirm' ? request.email : account.recovery_email,
      salt, password, proof.step, proof.hashes, ...proofArgs(account), request.token, now).run();
    if (!updated.meta.changes) return expired(json);
    await clearOldAccess(db, account.id, account.security_version + 1);
    const message = action === 'email-reset' ?
      'Your password was reset. Existing sessions and reset links were revoked. Two-factor authentication remains enabled.' :
      'Your recovery email was confirmed. Existing sessions and recovery links were revoked.';
    notify(mail, request.email, message);
    if (action === 'recovery-email-confirm' && account.recovery_email && account.recovery_email !== request.email) {
      notify(mail, account.recovery_email, 'Your recovery email was changed. Existing sessions were revoked.');
    }
    return json(200, { message: message + ' Sign in again to continue.', ...(recoveryCodes ? { recoveryCodes } : {}) });
  }
  return json(404, { error: 'Page not found.' });
}
