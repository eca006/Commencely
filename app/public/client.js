import { businessMajors, getBusinessMajor, matchesBusinessMajor } from './business-majors.js';
import { jobSnippet } from './job-snippet.js';
import { employerLogo } from './employer-logos.js';
import { profileStorage, id } from './profile-storage.js';
import { recommend, validAnswers } from './careers.js';
import { jobSaveControl } from './applications.js?v=guest-access';

const homeView = document.querySelector('#home-view');
const careerView = document.querySelector('#careers');
const jobsView = document.querySelector('#jobs');

function showView() {
  const hash = window.location.hash;
  const jobsActive = location.pathname === '/jobs' || hash === '#jobs';
  homeView.hidden = jobsActive;
  careerView.hidden = jobsActive;
  jobsView.hidden = !jobsActive;
  document.title = `Commencely — ${jobsActive ? 'Find jobs' : 'Home'}`;
  for (const link of document.querySelectorAll('.app-nav [data-destination]')) {
    const active = link.dataset.destination === (jobsActive ? 'jobs' : 'home');
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
}

function openJobs() {
  if (location.pathname !== '/jobs') history.pushState(null, '', '/jobs');
  showView();
  document.querySelector('#job-search-title').focus();
}

window.addEventListener('hashchange', showView);
window.addEventListener('popstate', showView);
showView();

const saveControls = new Set();
function refreshSaveButtons() {
  for (const updateButton of saveControls) updateButton();
}
document.addEventListener('commencely-jobs-changed', refreshSaveButtons);
window.addEventListener('storage', refreshSaveButtons);

const questionnaire = document.querySelector('#questionnaire');
const directions = document.querySelector('#directions');
const profileStatus = document.querySelector('#profile-status');
const storageKey = 'commencely-profile-v1';
let lastSearch = null;
let lastCheckedAt = 0;
const refreshInterval = 15 * 60 * 1000;
let activeSearch = null;
let searchVersion = 0;
const autoStatus = document.querySelector('#automatic-search-status');
function showDirections(answers) {
  directions.replaceChildren();
  const ranked = recommend(answers);
  for (const career of ranked.filter(item => item.score === ranked[0].score)) {
    const article = document.createElement('article');
    for (const [tag, text] of [['h3', career.title], ['p', career.description], ['p', `${career.score} of 3 answers point toward this direction. ${career.explanation}`]]) {
      const element = document.createElement(tag); element.textContent = text; article.append(element);
    }
    const button = document.createElement('button');
    button.type = 'button'; button.textContent = 'Find jobs in this direction';
    button.addEventListener('click', () => {
      document.querySelector('#keywords').value = career.keyword;
      autoStatus.textContent = `You chose ${career.title}. You can switch directions any time.`;
      form.requestSubmit();
      openJobs();
    });
    article.append(button); directions.append(article);
  }
}
questionnaire.addEventListener('submit', event => {
  event.preventDefault();
  const answers = Object.fromEntries(new FormData(questionnaire));
  showDirections(answers);
  document.querySelector('#questionnaire-panel').open = false;
  try { profileStorage.setItem(storageKey, JSON.stringify(answers)); profileStatus.textContent = profileStorage.notice(id ? 'Career answers saved. Search again or switch directions below. Equal scores are ties.' : 'Career answers kept in this browser tab, including refreshes. Closing the tab ends this guest visit. Equal scores are ties.'); }
  catch { profileStatus.textContent = 'Directions ready. This browser could not save your answers.'; }
});
document.querySelector('#clear-profile').addEventListener('click', () => {
  try { profileStorage.removeItem(storageKey); profileStatus.textContent = 'Saved answers cleared.'; }
  catch { profileStatus.textContent = 'Could not clear browser storage. Use your browser settings to remove saved answers.'; }
  activeSearch?.abort(); searchVersion++;
  lastSearch = null;
  lastCheckedAt = 0;
  form.querySelector('button').disabled = false;
  results.replaceChildren();
  saveControls.clear();
  autoStatus.textContent = ''; status.textContent = 'Enter a search to load jobs.';
  questionnaire.reset(); directions.replaceChildren();
  document.querySelector('#questionnaire-panel').open = true;
});
try {
  const answers = JSON.parse(profileStorage.getItem(storageKey));
  if (validAnswers(answers)) {
    for (const field of ['interest', 'strength', 'task']) questionnaire.elements[field].value = answers[field];
    showDirections(answers); profileStatus.textContent = 'Career answers loaded. Search again or switch directions below—no need to answer again. Equal scores are ties.';
    document.querySelector('#questionnaire-panel').open = false;
  }
} catch {}
const form = document.querySelector('#search');
const status = document.querySelector('#status');
const results = document.querySelector('#results');
const sourceDetails = document.querySelector('#job-sources');
const sourceStatus = document.querySelector('#job-source-status');
const experienceFilter = document.querySelector('#experience-filter');
const majorFilter = document.querySelector('#business-major');
for (const [key, [label]] of Object.entries(businessMajors)) {
  majorFilter.add(new Option(label, key));
}

const loadMoreJobs = document.querySelector('#load-more-jobs');
let searchPages = null;

const yearWords = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

function statedExperience({ experience }) {
  return experience.filter(item => item.years && ['required', 'listed'].includes(item.status));
}

function minimumYears(years) {
  const first = years.toLowerCase().match(/^\d+|^[a-z]+/)?.[0];
  return first && /^\d+$/.test(first) ? Number(first) : yearWords.indexOf(first);
}

function matchesExperienceFilter(qualifications, filter) {
  if (qualifications.graduateFit === 'outside') return false;
  if (filter === 'zero') return qualifications.zeroExperience === true;
  if (filter === 'stated') {
    const minimums = statedExperience(qualifications).map(item => minimumYears(item.years));
    return !minimums.some(years => years > 3) &&
      (qualifications.noExperience || minimums.some(years => years >= 0 && years <= 3));
  }
  return qualifications.graduateFit === 'potential' || filter === 'broader';
}

function experienceSummary(qualifications) {
  const stated = statedExperience(qualifications);
  const primary = stated.find(item => item.status === 'required') ?? stated[0];
  if (primary) return primary.status === 'required' ? `${primary.years} required` : `${primary.years} listed`;
  if (qualifications.noExperience) return 'No experience required';
  const preferred = qualifications.experience.find(item => item.status === 'preferred' && item.years);
  if (preferred) return `${preferred.years} preferred`;
  if (qualifications.experienceLevel) {
    const level = qualifications.experienceLevel;
    return `${level[0].toUpperCase()}${level.slice(1)} in job title`;
  }
  if (qualifications.entryLevel) return 'Entry level mentioned';
  const ambiguous = qualifications.experience.find(item => item.years);
  if (ambiguous) return `${ambiguous.years} mentioned · check posting`;
  return 'Experience unspecified';
}

function renderJobSnippet(description) {
  const { overview, duties, requirements } = jobSnippet(description);
  const content = document.createElement('div');
  content.className = 'job-snippet';
  if (overview.length) {
    const summary = document.createElement('p');
    summary.className = 'job-snippet-overview';
    summary.textContent = overview[0];
    content.append(summary);
  }
  for (const [label, items, missing] of [
    ['What you’ll do', duties, 'Responsibilities are in the full posting.'],
    ['Requirements', requirements, 'Requirements weren’t stated in the available text.']
  ]) {
    const group = document.createElement('div');
    const heading = document.createElement('h3');
    heading.textContent = label;
    group.append(heading);
    if (items.length) {
      const list = document.createElement('ul');
      for (const item of items) {
        const line = document.createElement('li');
        line.textContent = item;
        list.append(line);
      }
      group.append(list);
    } else {
      const note = document.createElement('p');
      note.className = 'note';
      note.textContent = missing;
      group.append(note);
    }
    content.append(group);
  }
  return content;
}

function jobMatchKey(job) {
  const normalize = value => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const city = job.location.match(/\b(Fayetteville|Springdale|Rogers|Bentonville|Lowell|Bella Vista)\b/i)?.[0];
  if (!city || job.company === 'Company not listed' || job.title === 'Untitled job') return null;
  return [job.title, job.company, city].map(normalize).join('|');
}
try {
  const saved = JSON.parse(profileStorage.getItem('commencely-search-v1'));
  if (saved && typeof saved.keywords === 'string' && typeof saved.location === 'string') {
    const savedFilter = saved.experienceFilter ?? (saved.includeUnclear === 'yes' ? 'broader' : 'graduate');
    if (Array.from(experienceFilter.options).some(option => option.value === savedFilter)) {
      experienceFilter.value = savedFilter;
    }
    if (getBusinessMajor(saved.major)) majorFilter.value = saved.major;
    document.querySelector('#keywords').value = saved.keywords;
    document.querySelector('#location').value = saved.location;
  }
} catch {}
experienceFilter.addEventListener('change', () => form.requestSubmit());
majorFilter.addEventListener('change', () => form.requestSubmit());
document.querySelector('#browse-experience').addEventListener('click', () => {
  form.elements.keywords.value = '';
  experienceFilter.value = 'graduate';
  form.requestSubmit();
});
form.addEventListener('submit', async event => {
  event.preventDefault();
  activeSearch?.abort();
  const controller = new AbortController(); activeSearch = controller;
  const version = ++searchVersion;
  const button = form.querySelector('button');
  button.disabled = true;
  const params = new URLSearchParams(new FormData(form));
  const search = params.toString();
  const sameSearch = lastSearch === search;
  const more = event.submitter === loadMoreJobs && sameSearch && searchPages?.data.nextPage;
  lastSearch = search;
  lastCheckedAt = Date.now();
  loadMoreJobs.disabled = true;
  if (!more) loadMoreJobs.hidden = true;
  status.textContent = more ? 'Checking more Adzuna listings…'
    : sameSearch && results.childElementCount ? 'Checking for new jobs…' : 'Loading jobs…';
  if (!sameSearch) {
    sourceDetails.hidden = true;
    results.replaceChildren();
    saveControls.clear();
  }
  try { profileStorage.setItem('commencely-search-v1', JSON.stringify(Object.fromEntries(params))); } catch {}
  try {
    const load = async (endpoint, query = params) => {
      const response = await fetch(endpoint + '?' + query, {signal: controller.signal});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to load jobs.');
      return data;
    };
    const nextParams = new URLSearchParams(params);
    if (more) nextParams.set('page', String(more));
    const [adzuna, employer, careerOneStop] = more ? [
      { status: 'fulfilled', value: await load('/api/jobs', nextParams) },
      searchPages.employer, searchPages.careerOneStop
    ] : await Promise.allSettled([
      load('/api/jobs'), load('/api/employer-jobs'), load('/api/careeronestop-jobs')
    ]);
    if (version !== searchVersion) return;
    const careerData = careerOneStop.status === 'fulfilled' ? careerOneStop.value : null;
    if (adzuna.status === 'rejected' && employer.status === 'rejected' && !careerData?.configured) {
      throw new Error('Job sources are unavailable. Please try again.');
    }
    const data = adzuna.status === 'fulfilled' ? adzuna.value : {jobs:[],count:0};
    if (more) {
      data.jobs = Array.from(new Map([...searchPages.data.jobs, ...data.jobs]
        .map(job => [job.id || job.link || job, job])).values());
      data.supplementaryPartial ||= searchPages.data.supplementaryPartial;
      data.partial ||= data.supplementaryPartial;
    }
    searchPages = { data, employer, careerOneStop, expanded: Boolean(more) };
    loadMoreJobs.hidden = !data.nextPage;
    const employerJobs = employer.status === 'fulfilled' ? employer.value.jobs : [];
    const seenJobs = new Set();
    const careerJobs = careerData?.jobs ?? [];
    const combinedJobs = [
      ...employerJobs, ...careerJobs.filter(job => job.descriptionKind === 'full'),
      ...data.jobs, ...careerJobs.filter(job => job.descriptionKind !== 'full')
    ].filter(job => {
      const key = jobMatchKey(job);
      if (!key) return true;
      if (seenJobs.has(key)) return false;
      seenJobs.add(key);
      return true;
    });
    const filter = params.get('experienceFilter');
    const major = getBusinessMajor(params.get('major'));
    const majorJobs = combinedJobs.filter(job => matchesBusinessMajor(job, major));
    const visibleJobs = majorJobs.filter(job => matchesExperienceFilter(job.qualifications, filter));
    const resultText = `Showing ${visibleJobs.length} matching ${visibleJobs.length === 1 ? 'job' : 'jobs'}.`;
    const emptyMessage = visibleJobs.length ? '' : filter === 'zero'
      ? 'No jobs in this search confirmed a zero-year experience minimum.'
      : filter === 'stated'
      ? 'No postings had a clear minimum of three years or less. Try New graduate matches for a broader search.'
      : 'Try a broader keyword or change the experience filter.';
    status.textContent = [resultText, emptyMessage].filter(Boolean).join(' ');
    sourceDetails.hidden = false;
    sourceStatus.textContent = [
      `${majorJobs.length} business listings found before the experience filter.`,
      `Last checked at ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.`,
      employer.status === 'fulfilled' ? employer.value.coverage : 'Employer feeds are unavailable.',
      adzuna.status === 'rejected' ? 'Adzuna is unavailable.' : data.partial ? 'Some Adzuna results were unavailable.' : '',
      data.pageLimitReached ? 'More Adzuna pages are available beyond this search’s fetch limit.' : '',
      careerOneStop.status === 'rejected' ? 'CareerOneStop is unavailable.' :
        careerData?.configured ? (careerData.partial ? 'Some CareerOneStop results were unavailable.' : 'CareerOneStop checked.') : ''
    ].filter(Boolean).join(' ');
    results.replaceChildren();
    saveControls.clear();
    for (const job of visibleJobs) {
      const card = document.createElement('article');
      card.className = 'job-card';
      const title = document.createElement('h2');
      title.textContent = job.title;
      const experience = document.createElement('p');
      experience.className = 'job-experience-label';
      experience.textContent = experienceSummary(job.qualifications);
      const employer = document.createElement('p');
      const logo = employerLogo(job);
      if (logo) {
        const mark = document.createElement('img');
        mark.className = 'employer-logo';
        mark.src = logo;
        mark.alt = '';
        mark.loading = 'lazy';
        mark.addEventListener('error', () => mark.remove(), { once: true });
        employer.append(mark);
      }
      const name = document.createElement('span');
      name.textContent = `${job.company} · ${job.location}`;
      employer.append(name);
      const source = document.createElement('p');
      source.textContent = job.descriptionKind === 'full'
        ? `Full employer description · ${job.source} · Retrieved ${new Date(job.fetchedAt).toLocaleString()}`
        : `${job.source || 'Adzuna'} · Partial description`;
      employer.className = 'job-employer';
      source.className = 'job-source';
      card.append(employer, title, experience, renderJobSnippet(job.description), source);

      const details = document.createElement('details');
      const summary = document.createElement('summary');
      summary.textContent = 'View details';
      details.append(summary);
      if (job.qualifications.experience.length) {
        const qualification = document.createElement('section');
        qualification.className = 'job-experience';
        const heading = document.createElement('h3');
        heading.textContent = 'Experience wording';
        qualification.append(heading);
        for (const item of job.qualifications.experience) {
          const quote = document.createElement('blockquote');
          quote.textContent = item.evidence;
          qualification.append(quote);
        }
        details.append(qualification);
      }
      const body = document.createElement('p');
      body.textContent = job.description;
      body.style.whiteSpace = 'pre-line';
      details.append(body);
      card.append(details);
      const actions = document.createElement('div');
      actions.className = 'job-actions';
      if (job.link) {
        const link = document.createElement('a');
        link.href = job.link; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = 'View job';
        link.className = 'app-action';
        actions.append(link);
      }
      if (!job.source) {
        const attribution=document.createElement('a'); attribution.href='https://www.adzuna.com'; attribution.textContent='Adzuna'; attribution.style.cssText='display:block;min-width:116px;min-height:23px;font-size:23px'; card.append(attribution);
      }
      const { control, updateButton } = jobSaveControl(job);
      saveControls.add(updateButton);
      actions.prepend(control);
      card.append(actions);
      results.append(card);
    }
  } catch (error) { if (version === searchVersion) status.textContent = results.childElementCount ? `${error.message} Showing previous results.` : error.message; }
  finally {
    if (version === searchVersion) {
      button.disabled = false;
      loadMoreJobs.disabled = false;
    }
  }
});

function refreshJobsIfDue() {
  if (jobsView.hidden || document.hidden || searchPages?.expanded || form.querySelector('button[type="submit"]').disabled) return;
  const currentSearch = new URLSearchParams(new FormData(form)).toString();
  if (lastSearch !== null && currentSearch !== lastSearch) return;
  if (Date.now() - lastCheckedAt >= refreshInterval) form.requestSubmit();
}

window.addEventListener('hashchange', refreshJobsIfDue);
window.addEventListener('popstate', refreshJobsIfDue);
document.addEventListener('visibilitychange', refreshJobsIfDue);
window.setInterval(refreshJobsIfDue, 60 * 1000);
refreshJobsIfDue();
