import { recommend, validAnswers } from './careers.js';
const questionnaire = document.querySelector('#questionnaire');
const directions = document.querySelector('#directions');
const profileStatus = document.querySelector('#profile-status');
const storageKey = 'commencely-profile-v1';
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
      form.requestSubmit();
      document.querySelector('#job-search-title').scrollIntoView({ behavior: 'smooth' });
    });
    article.append(button); directions.append(article);
  }
}
questionnaire.addEventListener('submit', event => {
  event.preventDefault();
  const answers = Object.fromEntries(new FormData(questionnaire));
  showDirections(answers);
  try { localStorage.setItem(storageKey, JSON.stringify(answers)); profileStatus.textContent = 'Answers saved in this browser. Ties share the same score; their order does not indicate a stronger fit.'; }
  catch { profileStatus.textContent = 'Directions ready. This browser could not save your answers.'; }
});
document.querySelector('#clear-profile').addEventListener('click', () => {
  try { localStorage.removeItem(storageKey); profileStatus.textContent = 'Saved answers cleared.'; }
  catch { profileStatus.textContent = 'Could not clear browser storage. Use your browser settings to remove saved answers.'; }
  questionnaire.reset(); directions.replaceChildren();
});
try {
  const answers = JSON.parse(localStorage.getItem(storageKey));
  if (validAnswers(answers)) {
    for (const field of ['interest', 'strength', 'task']) questionnaire.elements[field].value = answers[field];
    showDirections(answers); profileStatus.textContent = 'Loaded your saved answers. Ties share the same score; their order does not indicate a stronger fit.';
  }
} catch {}
const form = document.querySelector('#search');
const status = document.querySelector('#status');
const results = document.querySelector('#results');
for (const input of [document.querySelector('#keywords'), document.querySelector('#location')]) {
  input.addEventListener('input', () => { document.querySelector('#direction').value = ''; });
}
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
    status.textContent = data.reviewed !== undefined
      ? `Showing ${data.jobs.length} of ${data.relevant} listings retained from ${data.reviewed} reviewed results. ${data.removed} excluded by title relevance checks. This checks career-topic relevance, not qualifications or entry-level status. Editing the search fields switches to a general keyword search.`
      : data.jobs.length ? `Showing ${data.jobs.length} of ${data.count} matching jobs. General keyword search; career relevance is not checked.` : 'No jobs found. Try a broader keyword or another nearby city.';
    if (data.reviewed !== undefined && !data.jobs.length) status.textContent += ' No suitable titles were found in this sample. Try another nearby city; this does not mean no suitable jobs exist.';
    for (const job of data.jobs) {
      const card = document.createElement('article');
      for (const [tag, text] of [['h2', job.title], ['p', `${job.company} · ${job.location}`], ['p', job.description]]) {
        const element = document.createElement(tag);
        element.textContent = text;
        card.append(element);
      }
      const qualification = document.createElement('section');
      const heading = document.createElement('h3'); heading.textContent = 'Experience and qualifications'; qualification.append(heading);
      const notice = document.createElement('p'); notice.textContent = job.qualifications.notice; qualification.append(notice);
      if (job.qualifications.experienceFlag) {
        const flag = document.createElement('p');
        flag.textContent = 'Review entry-level wording: this snippet mentions entry-level and prior years of experience. Read the evidence below; experience may be preferred, required, or an alternative.';
        qualification.append(flag);
      }
      if (!job.qualifications.experience.length) {
        const unknown = document.createElement('p'); unknown.textContent = 'Experience: unknown — no experience cue found in this snippet.'; qualification.append(unknown);
      }
      for (const item of job.qualifications.experience) {
        const label = document.createElement('p');
        label.textContent = ({required: 'Required wording detected', preferred: 'Preferred wording detected', unclear: 'Unclear — review wording'})[item.status];
        const quote = document.createElement('blockquote'); quote.textContent = item.evidence;
        qualification.append(label, quote);
      }
      card.append(qualification);
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
