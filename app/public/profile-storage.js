const session = await fetch('/api/account/session', { cache: 'no-store', signal: AbortSignal.timeout(8000) })
  .then(response => response.ok ? response.json() : null)
  .catch(() => null);
const id = session?.id ?? null;
const guestPrefix = 'commencely-guest:';
const keyFor = key => id ? `account:${id}:${key}` : guestPrefix + key;
const memory = new Map();
let persistent = null;
let warning;
function useTemporaryStorage() {
  persistent = null;
  if (warning) return;
  warning = document.createElement('p');
  warning.className = 'storage-warning';
  warning.setAttribute('role', 'status');
  warning.textContent = 'Browser storage is unavailable. You can still use Commencely, but drafts and saved changes are temporary on this page. They will be lost when you refresh or leave this page. Download your résumé before leaving.';
  document.body.prepend(warning);
}
try {
  // Storage getters themselves can throw. Probe reads and writes before use.
  persistent = id ? localStorage : sessionStorage;
  const probe = keyFor('storage-check:' + crypto.randomUUID());
  persistent.getItem(probe);
  persistent.setItem(probe, '1');
  persistent.removeItem(probe);
} catch { useTemporaryStorage(); }

export const profileStorage = {
  getItem(key) {
    const name = keyFor(key);
    if (persistent) {
      try {
        const value = persistent.getItem(name);
        if (value === null) memory.delete(name); else memory.set(name, value);
        return value;
      } catch { useTemporaryStorage(); }
    }
    return memory.get(name) ?? null;
  },
  setItem(key, value) {
    const name = keyFor(key);
    memory.set(name, String(value));
    if (persistent) {
      try { persistent.setItem(name, String(value)); }
      catch { useTemporaryStorage(); }
    }
  },
  removeItem(key) {
    const name = keyFor(key);
    memory.delete(name);
    if (persistent) {
      try { persistent.removeItem(name); }
      catch { useTemporaryStorage(); }
    }
  },
  notice(message) {
    return persistent ? message : 'Changes kept temporarily on this page only. They cannot be retained after refresh or navigation. Download a copy before leaving.';
  }
};

// Normal guest visits keep the same file key through refresh and navigation.
export const guestSession = id ? null : (() => {
  let value = profileStorage.getItem('session');
  if (!value) { value = crypto.randomUUID(); profileStorage.setItem('session', value); }
  return value;
})();
export { id, keyFor };

window.addEventListener('storage', event => {
  if (event.key === 'commencely-session-changed') location.reload();
});
const accountLink = document.querySelector('[data-account-link]');
if (id && accountLink) accountLink.textContent = 'Account';
