import { displayRecoveryCodes } from './recovery-codes.js';
const form = document.querySelector('#account-form');
const signingUp = location.pathname === '/sign-up';
const message = document.querySelector('#account-status');
const confirmation = form.elements.confirmation;
const code = form.elements.code;
const accountFields = document.querySelector('#account-fields');
const verification = document.querySelector('#account-verification');
let challenge;
const submit = form.querySelector('button');
const session = await fetch('/api/account/session', { signal: AbortSignal.timeout(8000) })
  .then(response => response.json()).catch(() => ({}));
const signedIn = Boolean(session.id);
document.querySelector('#security-link').hidden = !signedIn;
document.querySelector('#signup-recovery-warning').hidden = !signingUp || signedIn;
document.querySelector('h1').textContent = signedIn ? 'Your account' : signingUp ? 'Create an account' : 'Sign in';
document.title = document.querySelector('h1').textContent + ' | Commencely';
accountFields.hidden = signedIn;
document.querySelector('#confirmation-field').hidden = !signingUp;
confirmation.required = signingUp && !signedIn;
confirmation.disabled = !confirmation.required;
form.elements.login.disabled = signedIn;
form.elements.password.disabled = signedIn;
form.elements.password.autocomplete = signingUp ? 'new-password' : 'current-password';
submit.textContent = signedIn ? 'Sign out' : signingUp ? 'Create account' : 'Sign in';
const alternate = document.querySelector('#account-alternate');
alternate.hidden = signedIn;
alternate.href = signingUp ? '/sign-in' : '/sign-up';
alternate.textContent = signingUp ? 'Already have an account? Sign in' : 'New to Commencely? Create an account';

submit.disabled = false;
message.textContent = '';
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!form.checkValidity()) {
    const field = form.querySelector('input:invalid');
    message.textContent = field.validationMessage;
    field.focus();
    return;
  }
  if (signingUp && !signedIn && !challenge && form.elements.password.value !== confirmation.value) {
    message.textContent = 'Passwords don’t match.';
    confirmation.focus();
    return;
  }
  submit.disabled = true;
  message.textContent = challenge ? 'Verifying your code…' : signedIn ? 'Signing out…' : signingUp ? 'Creating your account…' : 'Signing in…';
  try {
    const action = challenge ? 'verify' : signedIn ? 'sign-out' : signingUp ? 'sign-up' : 'sign-in';
    const response = await fetch('/api/account/' + action, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(challenge ? { challenge, code: code.value } : Object.fromEntries(new FormData(form))),
      signal: AbortSignal.timeout(35000)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Please try again.');
    if (data.challenge) {
      challenge = data.challenge;
      accountFields.hidden = true;
      for (const field of accountFields.querySelectorAll('input')) {
        field.value = '';
        field.disabled = true;
      }
      if (data.setupKey) {
        document.querySelector('#authenticator-setup').hidden = false;
        document.querySelector('#authenticator-key').textContent = data.setupKey;
      }
      verification.hidden = false;
      code.disabled = false;
      code.required = true;
      submit.textContent = 'Verify code';
      submit.disabled = false;
      alternate.hidden = true;
      message.textContent = '';
      code.focus();
      return;
    }
    try {
      localStorage.setItem('commencely-session-changed', crypto.randomUUID());
    } catch {
      // The account cookie is already set. Storage only notifies other tabs.
    }
    if (data.recoveryCodes) {
      form.hidden = true;
      message.textContent = '';
      displayRecoveryCodes(document.querySelector('#account-recovery'), data.recoveryCodes);
      return;
    }
    location.assign(signedIn ? '/sign-in' : '/');
  } catch (error) {
    message.textContent = error.name === 'TimeoutError'
      ? signingUp && !signedIn && challenge
        ? 'Account creation took too long. Try signing in before trying again.'
        : 'Commencely took too long to respond. Please try again.'
      : error instanceof TypeError ? 'Couldn’t reach Commencely. Please try again.' : error.message;
    submit.disabled = false;
  }
});
