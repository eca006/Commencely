const form = document.querySelector('#recovery-form');
const status = document.querySelector('#recovery-status');
form.addEventListener('submit', async event => {
  event.preventDefault();
  const button = form.querySelector('button');
  button.disabled = true;
  status.textContent = 'Checking your recovery code…';
  try {
    const response = await fetch('/api/account/recover', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(new FormData(form))), signal: AbortSignal.timeout(35000)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Please try again.');
    form.reset();
    status.textContent = 'Password updated. Sign in with your new password and complete two-factor verification.';
  } catch (error) {
    status.textContent = error.name === 'TimeoutError' ? 'This took too long. Try signing in with your new password before resetting again.' : error.message;
  } finally { button.disabled = false; }
});
