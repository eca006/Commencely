const storageKey = 'commencely-applications-v1';
const statuses = ['Saved', 'Applied', 'Interviewing', 'Offer', 'Closed'];
const list = document.querySelector('#saved-jobs');

function readJobs() {
  const jobs = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
  if (!Array.isArray(jobs)) throw new Error('Invalid saved jobs');
  return jobs;
}

function writeJobs(jobs) {
  localStorage.setItem(storageKey, JSON.stringify(jobs));
}

export function jobSaveControl(job) {
  const provider = job.descriptionKind === 'full' ? job.source : 'Adzuna';
  const key = `${provider}:${job.id || job.link || JSON.stringify([job.title, job.company, job.location])}`;
  const control = document.createElement('div');
  const button = document.createElement('button');
  button.type = 'button';
  const notice = document.createElement('span');
  notice.setAttribute('role', 'status');
  control.append(button, ' ', notice);

  function updateButton() {
    try {
      const saved = readJobs().some(entry => entry.key === key);
      button.textContent = saved ? 'Saved to tracker' : 'Save job';
      button.disabled = saved;
    } catch {
      button.textContent = 'Save job';
    }
  }

  button.addEventListener('click', () => {
    try {
      const jobs = readJobs();
      if (!jobs.some(entry => entry.key === key)) {
        const { title, company, location, link } = job;
        writeJobs([{ key, title, company, location, link, provider, status: 'Saved' }, ...jobs]);
      }
      notice.textContent = 'Job saved.';
      document.dispatchEvent(new Event('commencely-jobs-changed'));
    } catch {
      notice.textContent = 'This browser could not save the job.';
    }
  });

  updateButton();
  return { control, updateButton };
}

function renderTracker() {
  const notice = document.querySelector('#application-status');
  let jobs;
  try {
    jobs = readJobs();
  } catch {
    notice.textContent = 'This browser could not load saved jobs.';
    return;
  }
  list.replaceChildren();
  if (!jobs.length) {
    const empty = document.createElement('p');
    const search = document.createElement('a');
    search.href = '/';
    search.textContent = 'Find jobs';
    empty.append('Your saved jobs will appear here. ', search);
    list.append(empty);
  }

  for (const job of jobs) {
    const card = document.createElement('article');
    const title = document.createElement('h2');
    title.textContent = job.title;
    const metadata = document.createElement('p');
    metadata.textContent = `${job.company} · ${job.location} · ${job.provider}`;
    card.append(title, metadata);

    if (typeof job.link === 'string' && /^https?:\/\//i.test(job.link)) {
      const link = document.createElement('a');
      link.href = job.link;
      link.textContent = 'View job';
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      card.append(link);
    }

    const actions = document.createElement('div');
    actions.className = 'entry-actions';
    const label = document.createElement('label');
    const select = document.createElement('select');
    select.setAttribute('aria-label', `Application status for ${job.title} at ${job.company}`);
    for (const status of statuses) select.add(new Option(status, status));
    select.value = job.status;
    label.append('Application status ', select);
    select.addEventListener('change', () => {
      try {
        const current = readJobs();
        const entry = current.find(item => item.key === job.key);
        if (!entry) {
          renderTracker();
          notice.textContent = 'That job was already removed.';
          return;
        }
        entry.status = select.value;
        writeJobs(current);
        job.status = select.value;
        notice.textContent = `${job.title} marked ${select.value.toLowerCase()}.`;
      } catch {
        select.value = job.status;
        notice.textContent = 'This browser could not update the application status.';
      }
    });

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = 'Remove job';
    remove.setAttribute('aria-label', `Remove ${job.title} at ${job.company}`);
    remove.addEventListener('click', () => {
      try {
        writeJobs(readJobs().filter(item => item.key !== job.key));
        renderTracker();
        (list.querySelector('select, a') ?? list).focus();
        notice.textContent = `${job.title} removed.`;
      } catch {
        notice.textContent = 'This browser could not remove the job.';
      }
    });
    actions.append(label, remove);
    card.append(actions);
    list.append(card);
  }
}

if (list) {
  renderTracker();
  window.addEventListener('storage', event => {
    if (event.key === storageKey || event.key === null) renderTracker();
  });
}
