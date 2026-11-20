import { profileStorage, keyFor, id } from './profile-storage.js';
const storageKey = 'commencely-applications-v1';
const statuses = ['Saved', 'Applied', 'Interviewing', 'Offer', 'Closed'];
const list = document.querySelector('#saved-jobs');

const filters = document.querySelector('#tracker-filters');
const counts = document.querySelector('#tracker-counts');
let stageFilter = '';

function updateSummary(jobs) {
  const count = stage => stage ? jobs.filter(job => job.status === stage).length : jobs.length;
  for (const button of filters.querySelectorAll('button')) {
    const stage = button.dataset.stage;
    button.textContent = `${stage === 'Offer' ? 'Offer received' : stage || 'All tracked'} (${count(stage)})`;
    button.setAttribute('aria-pressed', String(stage === stageFilter));
  }
  counts.replaceChildren(...['', 'Applied', 'Interviewing', 'Offer'].map(stage => {
    const group = document.createElement('div');
    const term = document.createElement('dt');
    const value = document.createElement('dd');
    term.textContent = stage || 'Tracked';
    value.textContent = count(stage);
    group.append(term, value);
    return group;
  }));
}

function readJobs() {
  if (!id) return [];
  const jobs = JSON.parse(profileStorage.getItem(storageKey) ?? '[]');
  if (!Array.isArray(jobs)) throw new Error('Invalid saved jobs');
  return jobs;
}

function writeJobs(jobs) {
  if (!id) throw new Error('Sign in to save jobs.');
  profileStorage.setItem(storageKey, JSON.stringify(jobs));
}

export function jobSaveControl(job) {
  if (!id) {
    const control = document.createElement('a');
    control.href = '/sign-in';
    control.textContent = 'Sign in to save job';
    control.className = 'app-action';
    return { control, updateButton() {} };
  }
  const provider = job.source || 'Adzuna';
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
  updateSummary(jobs);
  const visible = stageFilter ? jobs.filter(job => job.status === stageFilter) : jobs;
  list.replaceChildren();
  if (!visible.length) {
    const empty = document.createElement('p');
    const search = document.createElement('a');
    search.href = '/jobs';
    search.textContent = 'Find jobs';
    empty.append(jobs.length ? 'No applications at this stage. ' : 'Your saved jobs will appear here. ', search);
    list.append(empty);
  }

  for (const job of visible) {
    const card = document.createElement('article');
    card.className = 'tracker-card';
    card.dataset.stage = job.status;
    const title = document.createElement('h2');
    title.textContent = job.title;
    const metadata = document.createElement('p');
    metadata.textContent = `${job.company} · ${job.location} · ${job.provider}`;
    const heading = document.createElement('div');
    heading.className = 'tracker-heading';
    const badge = document.createElement('span');
    badge.className = 'tracker-stage';
    badge.textContent = job.status;
    heading.append(title, badge);
    card.append(heading, metadata);

    if (typeof job.link === 'string' && /^https?:\/\//i.test(job.link)) {
      const link = document.createElement('a');
      link.href = job.link;
      link.textContent = 'View job';
      link.className = 'app-action';
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
        card.dataset.stage = job.status;
        badge.textContent = job.status;
        updateSummary(current);
        if (stageFilter && job.status !== stageFilter) {
          renderTracker();
          filters.querySelector('[aria-pressed="true"]')?.focus();
        }
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

if (list && id) {
  document.querySelector('#guest-tracker').hidden = true;
  list.hidden = false;
  document.querySelector('.tracker-toolbar').hidden = false;
  for (const stage of ['', ...statuses]) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.stage = stage;
    button.addEventListener('click', () => {
      stageFilter = stage;
      renderTracker();
    });
    filters.append(button);
  }
  document.querySelector('#export-tracker').addEventListener('click', () => {
    const notice = document.querySelector('#application-status');
    try {
      const jobs = readJobs();
      if (!jobs.length) {
        notice.textContent = 'Save a job before exporting your applications.';
        return;
      }
      const fields = ['title', 'company', 'location', 'provider', 'status', 'link'];
      const cell = value => {
        const text = String(value ?? '');
        const safe = /^\s*[=+@-]|^[\t\r\n]/.test(text) ? "'" + text : text;
        return '"' + safe.replaceAll('"', '""') + '"';
      };
      const csv = [fields.join(','), ...jobs.map(job => fields.map(field => cell(job[field])).join(','))].join('\r\n');
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'commencely-applications.csv';
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      notice.textContent = 'This browser could not export your applications.';
    }
  });
  renderTracker();
  window.addEventListener('storage', event => {
    if (event.key === keyFor(storageKey) || event.key === null) renderTracker();
  });
}
