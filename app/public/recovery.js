import { displayRecoveryCodes } from './recovery-codes.js';
const status = document.querySelector('#recovery-status');
let token;
function readRecoveryLink() {
  if (!location.hash) return;
  const fragment = new URLSearchParams(location.hash.slice(1));
  token = fragment.get('reset') || fragment.get('verify');
  const reset = fragment.has('reset');
  history.replaceState(null, '', location.pathname);
  const valid = /^[a-f0-9]{64}$/.test(token ?? '');
  document.querySelector('#email-reset-panel').hidden = !valid || !reset;
  document.querySelector('#confirm-email-panel').hidden = !valid || reset;
  document.querySelector('#email-reset-form').hidden = false;
  status.textContent = valid ? '' : 'This recovery link is invalid. Request a new link.';
}
readRecoveryLink();
window.addEventListener('hashchange', readRecoveryLink);

async function post(action, data) {
  const response = await fetch('/api/account/' + action, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data), signal: AbortSignal.timeout(35000)
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Please try again.');
  return body;
}
function errorMessage(error) {
  return error.name === 'TimeoutError' ? 'This took too long. Check your inbox or try signing in with your new password before resetting again.' :
    error instanceof TypeError ? 'Could not reach Commencely. Check your connection and try again.' : error.message;
}
function formAction(selector, action, extra, success) {
  const form = document.querySelector(selector);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('button');
    button.disabled = true; status.textContent = 'Checking your request…';
    try {
      const data = await post(action, { ...Object.fromEntries(new FormData(form)), ...extra() });
      form.reset(); status.textContent = success(data);
      if (data.recoveryCodes) displayRecoveryCodes(document.querySelector('#reset-recovery-codes'), data.recoveryCodes);
      if (selector === '#email-reset-form') { token = null; form.hidden = true; }
    } catch (error) { status.textContent = errorMessage(error); }
    finally { button.disabled = false; }
  });
}
formAction('#recovery-form', 'recover', () => ({}), () => 'Password updated. Sign in with your new password and your authenticator or another unused recovery code.');
formAction('#email-request-form', 'email-reset-request', () => ({}), data => data.message);
formAction('#email-reset-form', 'email-reset', () => ({ token }), data => data.message);
document.querySelector('#confirm-email').addEventListener('click', async event => {
  const button = event.currentTarget; button.disabled = true;
  status.textContent = 'Confirming your recovery email…';
  try {
    const data = await post('recovery-email-confirm', { token });
    token = null; status.textContent = data.message;
    document.querySelector('#confirm-email-panel').hidden = true;
  } catch (error) { status.textContent = errorMessage(error); button.disabled = false; }
});
try {
  const response = await fetch('/api/account/recovery-options', { cache: 'no-store', signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error();
  const data = await response.json();
  document.querySelector('#request-email-panel').hidden = !data.emailEnabled;
  document.querySelector('#email-unavailable').hidden = data.emailEnabled;
} catch {
  document.querySelector('#email-unavailable').hidden = false;
}
