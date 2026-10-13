const form = document.querySelector('#search');
const status = document.querySelector('#status');
const results = document.querySelector('#results');
form.addEventListener('submit', async event => {
  event.preventDefault();
  const button = form.querySelector('button');
  button.disabled = true;
  status.textContent = 'Loading jobs…';
  results.replaceChildren();
  try {
    const response = await fetch('/api/jobs?' + new URLSearchParams(new FormData(form)));
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Unable to load jobs.');
    status.textContent = data.jobs.length ? `Showing ${data.jobs.length} of ${data.count} matching jobs.` : 'No jobs found. Try a broader keyword or another nearby city.';
    for (const job of data.jobs) {
      const card = document.createElement('article');
      for (const [tag, text] of [['h2', job.title], ['p', `${job.company} · ${job.location}`], ['p', job.description]]) {
        const element = document.createElement(tag);
        element.textContent = text;
        card.append(element);
      }
      if (job.link) {
        const link = document.createElement('a');
        link.href = job.link; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = 'View job';
        card.append(link);
      }
      results.append(card);
    }
  } catch (error) { status.textContent = error.message; }
  finally { button.disabled = false; }
});
