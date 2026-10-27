import { careers, recommend, validAnswers } from './careers.js';
const questionnaire = document.querySelector('#questionnaire');
const directions = document.querySelector('#directions');
const profileStatus = document.querySelector('#profile-status');
const storageKey = 'commencely-profile-v1';
let loadedAnswers = null;
let savedSearch = null;
let activeSearch = null;
let searchVersion = 0;
const autoStatus = document.querySelector('#automatic-search-status');
function searchFromAnswers(answers) {
  const ranked = recommend(answers);
  const tied = ranked.filter(career => career.score === ranked[0].score);
  if (tied.length > 1) {
    activeSearch?.abort(); searchVersion++;
    results.replaceChildren();
    form.querySelector('button').disabled = false;
    autoStatus.textContent = 'Your answers point equally toward all three directions. Choose “Find jobs in this direction” on any direction below to start. None is a stronger fit.';
    status.textContent = 'Choose a career direction above, or use the search form.';
    return;
  }
  const career = ranked[0];
  directionSelect.value = career.id;
  document.querySelector('#keywords').value = career.keyword;
  autoStatus.textContent = `Jobs below use ${career.title} because ${career.score} of your 3 answers point here. This reflects interests, not qualifications. You can switch directions or search below.`;
  form.requestSubmit();
  return true;
}
function showDirections(answers) {
  directions.replaceChildren();
  for (const career of recommend(answers)) {
    const article = document.createElement('article');
    for (const [tag, text] of [['h3', career.title], ['p', career.description], ['p', `${career.score} of 3 answers point toward this direction. ${career.explanation}`]]) {
      const element = document.createElement(tag); element.textContent = text; article.append(element);
    }
    const button = document.createElement('button');
    button.type = 'button'; button.textContent = 'Find jobs in this direction';
    button.addEventListener('click', () => {
      document.querySelector('#keywords').value = career.keyword;
      document.querySelector('#direction').value = career.id;
      autoStatus.textContent = `You chose ${career.title}. You can switch directions any time.`;
      form.requestSubmit();
      document.querySelector('#job-search-title').scrollIntoView({ behavior: 'smooth' });
    });
    article.append(button); directions.append(article);
  }
}
questionnaire.addEventListener('submit', event => {
  event.preventDefault();
  const answers = Object.fromEntries(new FormData(questionnaire));
  loadedAnswers = answers;
  showDirections(answers);
  if (searchFromAnswers(answers)) document.querySelector('#job-search-title').scrollIntoView({behavior:'smooth'});
  document.querySelector('#questionnaire-panel').open = false;
  try { localStorage.setItem(storageKey, JSON.stringify(answers)); profileStatus.textContent = 'Career answers saved. Search again or switch directions below—no need to answer again. Equal scores are ties.'; }
  catch { profileStatus.textContent = 'Directions ready. This browser could not save your answers.'; }
});
document.querySelector('#clear-profile').addEventListener('click', () => {
  try { localStorage.removeItem(storageKey); profileStatus.textContent = 'Saved answers cleared.'; }
  catch { profileStatus.textContent = 'Could not clear browser storage. Use your browser settings to remove saved answers.'; }
  loadedAnswers = null; activeSearch?.abort(); searchVersion++;
  form.querySelector('button').disabled = false; results.replaceChildren();
  autoStatus.textContent = ''; status.textContent = 'Enter a search to load jobs.';
  questionnaire.reset(); directions.replaceChildren();
  document.querySelector('#questionnaire-panel').open = true;
});
try {
  const answers = JSON.parse(localStorage.getItem(storageKey));
  if (validAnswers(answers)) {
    loadedAnswers = answers;
    for (const field of ['interest', 'strength', 'task']) questionnaire.elements[field].value = answers[field];
    showDirections(answers); profileStatus.textContent = 'Career answers loaded. Search again or switch directions below—no need to answer again. Equal scores are ties.';
    document.querySelector('#questionnaire-panel').open = false;
  }
} catch {}
const form = document.querySelector('#search');
const status = document.querySelector('#status');
const results = document.querySelector('#results');
const directionSelect = document.querySelector('#direction');
directionSelect.addEventListener('change', () => {
  const career = careers.find(item => item.id === directionSelect.value);
  if (career) document.querySelector('#keywords').value = career.keyword;
});
document.querySelector('#keywords').addEventListener('input', () => { directionSelect.value = ''; });
try {
  const saved = JSON.parse(localStorage.getItem('commencely-search-v1'));
  if (saved && typeof saved.keywords === 'string' && typeof saved.location === 'string') {
    savedSearch = saved;
    document.querySelector('#keywords').value = saved.keywords;
    document.querySelector('#location').value = saved.location;
    directionSelect.value = careers.some(item => item.id === saved.direction) ? saved.direction : '';
  }
} catch {}
form.addEventListener('submit', async event => {
  event.preventDefault();
  activeSearch?.abort();
  const controller = new AbortController(); activeSearch = controller;
  const version = ++searchVersion;
  const button = form.querySelector('button');
  button.disabled = true;
  status.textContent = 'Loading jobs…';
  results.replaceChildren();
  try { localStorage.setItem('commencely-search-v1', JSON.stringify(Object.fromEntries(new FormData(form)))); } catch {}
  try {
    const params = new URLSearchParams(new FormData(form));
    const load = async endpoint => {
      const response = await fetch(endpoint + '?' + params, {signal: controller.signal});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to load jobs.');
      return data;
    };
    const [adzuna, employer] = await Promise.allSettled([load('/api/jobs'),load('/api/employer-jobs')]);
    if (version !== searchVersion) return;
    if (adzuna.status === 'rejected' && employer.status === 'rejected') throw new Error('Both job sources are unavailable. Please try again.');
    const data = adzuna.status === 'fulfilled' ? adzuna.value : {jobs:[],count:0};
    const employerJobs = employer.status === 'fulfilled' ? employer.value.jobs : [];
    status.textContent = data.reviewed !== undefined
      ? `Showing ${data.jobs.length} of ${data.relevant} listings retained from ${data.reviewed} reviewed results. ${data.removed} excluded by title relevance checks. This checks career-topic relevance, not qualifications or entry-level status. Editing the keyword switches to a general search; changing location keeps your career direction.`
      : data.jobs.length ? `Showing ${data.jobs.length} of ${data.count} matching jobs. General keyword search; career relevance is not checked.` : 'No jobs found. Try a broader keyword or another nearby city.';
    if (data.reviewed !== undefined && !data.jobs.length) status.textContent += ' No suitable titles were found in this sample. Try another nearby city; this does not mean no suitable jobs exist.';
    status.textContent = `${employerJobs.length} full-description employer listings shown first. ` + (adzuna.status === 'fulfilled' ? 'Adzuna: ' + status.textContent : 'Adzuna is currently unavailable.') + ' ' + (employer.status === 'fulfilled' ? employer.value.coverage : 'Employer feed is currently unavailable.');
    for (const job of [...employerJobs,...data.jobs]) {
      const card = document.createElement('article');
      for (const [tag, text] of [['h2', job.title], ['p', `${job.company} · ${job.location}`], ['p', job.descriptionKind === 'full' ? `Full employer description · ${job.source} · Retrieved ${new Date(job.fetchedAt).toLocaleString()}` : 'Adzuna · Partial description']]) {
        const element = document.createElement(tag);
        element.textContent = text;
        card.append(element);
      }
      const qualification = document.createElement('section');
      const heading = document.createElement('h3'); heading.textContent = 'Experience and qualifications'; qualification.append(heading);
      const notice = document.createElement('p'); notice.textContent = job.qualifications.notice; qualification.append(notice);
      if (job.qualifications.experienceFlag) {
        const flag = document.createElement('p');
        flag.textContent = 'Review entry-level wording: this description mentions entry-level and prior years of experience. Read the evidence below; experience may be preferred, required, or an alternative.';
        qualification.append(flag);
      }
      if (!job.qualifications.experience.length) {
        const unknown = document.createElement('p'); unknown.textContent = job.descriptionKind === 'full' ? 'Prior experience not confirmed: no explicit experience cue was identified in the supplied employer description. This does not establish that experience is unnecessary.' : 'Experience requirements not confirmed. The available snippet does not establish prior experience requirements. This does not mean no experience is needed. Use “View job” to check the full posting.'; qualification.append(unknown);
      }
      for (const item of job.qualifications.experience) {
        const label = document.createElement('p');
        label.textContent = (item.years ? `Prior experience: ${item.years} · ` : '') + ({required: 'Required wording detected', preferred: 'Preferred wording detected', listed:'Listed experience — not explicitly labeled required or preferred', unclear: 'Unclear — review wording and alternatives'})[item.status];
        const quote = document.createElement('blockquote'); quote.textContent = item.evidence;
        qualification.append(label, quote);
      }
      card.append(qualification);
      const description = document.createElement('details');
      const summary = document.createElement('summary'); summary.textContent = job.descriptionKind === 'full' ? 'Read full employer description here' : 'Read available description snippet';
      const body = document.createElement('p'); body.textContent = job.description; body.style.whiteSpace = 'pre-line'; description.append(summary, body); card.append(description);
      if (job.link) {
        const link = document.createElement('a');
        link.href = job.link; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = 'View job';
        card.append(link);
      }
      if (job.descriptionKind !== 'full') {
        const attribution=document.createElement('a'); attribution.href='https://www.adzuna.com'; attribution.textContent='Adzuna'; attribution.style.cssText='display:block;min-width:116px;min-height:23px;font-size:23px'; card.append(attribution);
      }
      results.append(card);
    }
  } catch (error) { if (version === searchVersion) status.textContent = error.message; }
  finally { if (version === searchVersion) button.disabled = false; }
});

if (loadedAnswers) {
  if (savedSearch && document.querySelector('#location').value.trim()) {
    autoStatus.textContent = 'Your last search loads automatically below. Your career answers are still saved; switch directions below whenever you want.';
    form.requestSubmit();
  } else searchFromAnswers(loadedAnswers);
}
