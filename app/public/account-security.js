import { displayRecoveryCodes } from './recovery-codes.js';
const status = document.querySelector('#security-status');
const settings = document.querySelector('#security-settings');
const failure = error => error.name === 'TimeoutError' ?
  'This took too long. Check your email or sign-in status before trying the change again.' :
  error instanceof TypeError ? 'Could not reach Commencely. Check your connection and try again.' : error.message;

async function submit(form, action, done) {
  const button = form.querySelector('button');
  button.disabled = true; status.textContent = 'Checking your account…';
  try {
    const response = await fetch('/api/account/' + action, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(new FormData(form))), signal: AbortSignal.timeout(35000)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'The request could not be completed.');
    form.reset(); done(data);
  } catch (error) { status.textContent = failure(error); }
  finally { button.disabled = false; }
}

try {
  const response = await fetch('/api/account/recovery-settings', { cache: 'no-store', signal: AbortSignal.timeout(8000) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not load recovery settings.');
  document.querySelector('#remaining-codes').textContent = data.remainingCodes;
  document.querySelector('#verified-email').textContent = data.recoveryEmail || 'Not set';
  document.querySelector('#email-availability').textContent = data.emailEnabled ?
    'Use a verified email plus your authenticator or a recovery code to reset a forgotten password.' :
    'Email recovery is not enabled yet. Keep your recovery codes safe; no email-based reset is available until delivery is configured.';
  document.querySelector('#enroll-email-form').hidden = !data.emailEnabled;
  settings.hidden = false; status.textContent = '';
} catch (error) { status.textContent = failure(error); }

document.querySelector('#replace-codes-form').addEventListener('submit', event => {
  event.preventDefault();
  submit(event.currentTarget, 'recovery-codes', data => {
    settings.hidden = true;
    status.textContent = 'Codes replaced. Save your new codes before leaving this page.';
    displayRecoveryCodes(document.querySelector('#replacement-codes'), data.recoveryCodes);
    try { localStorage.setItem('commencely-session-changed', crypto.randomUUID()); } catch {}
  });
});
document.querySelector('#enroll-email-form').addEventListener('submit', event => {
  event.preventDefault();
  submit(event.currentTarget, 'recovery-email-start', data => { status.textContent = data.message; });
});
