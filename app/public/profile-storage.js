const session = await fetch('/api/account/session', { cache: 'no-store', signal: AbortSignal.timeout(8000) })
  .then(response => response.ok ? response.json() : null)
  .catch(() => null);
const id = session?.id ?? null;
const guestPrefix = 'commencely-guest:';
const keyFor = key => id ? `account:${id}:${key}` : guestPrefix + key;
const storage = () => id ? localStorage : sessionStorage;

// sessionStorage keeps guest work through refreshes and internal navigation.
export const guestSession = id ? null : (() => {
  const key = guestPrefix + 'session';
  let value = sessionStorage.getItem(key);
  if (!value) { value = crypto.randomUUID(); sessionStorage.setItem(key, value); }
  return value;
})();

export const profileStorage = {
  getItem: key => storage().getItem(keyFor(key)),
  setItem: (key, value) => storage().setItem(keyFor(key), value),
  removeItem: key => storage().removeItem(keyFor(key))
};
export { id, keyFor };

window.addEventListener('storage', event => {
  if (event.key === 'commencely-session-changed') location.reload();
});
const accountLink = document.querySelector('[data-account-link]');
if (id && accountLink) accountLink.textContent = 'Account';
