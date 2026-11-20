// App-runtime configuration only. Never return provider errors or credentials.
export function createRecoveryMail(env, { fetchImpl = fetch, schedule } = {}) {
  let origin;
  try {
    const url = new URL(env.ACCOUNT_PUBLIC_ORIGIN);
    const local = ['localhost', '127.0.0.1'].includes(url.hostname);
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/' ||
        (url.protocol !== 'https:' && !(local && url.protocol === 'http:'))) throw new Error();
    origin = url.origin;
  } catch { origin = null; }
  const enabled = env.ACCOUNT_EMAIL_RECOVERY === 'enabled' && Boolean(origin) &&
    typeof env.RESEND_API_KEY === 'string' && Boolean(env.RESEND_API_KEY) &&
    /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(env.ACCOUNT_EMAIL_FROM ?? '');
  return {
    enabled, origin,
    async send({ to, subject, text }) {
      if (!enabled) throw new Error('Email recovery is not configured.');
      const response = await fetchImpl('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: env.ACCOUNT_EMAIL_FROM, to: [to], subject, text }),
        signal: AbortSignal.timeout(10000)
      });
      if (!response.ok) throw new Error('Email delivery failed.');
    },
    enqueue(task) {
      const safe = task.catch(() => {
        // No email addresses, links, reset tokens, or provider responses in logs.
        console.error('Account recovery notification delivery failed.');
      });
      if (schedule) schedule(safe);
    }
  };
}
