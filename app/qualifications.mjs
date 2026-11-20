// Conservative snippet cues, not a determination of eligibility.
import { minimumYears } from './public/job-preferences.js';
const seniorTitle = /\b(senior|sr\.?|director|principal|vice president|vp|head of|chief)\b/i;

export function qualificationEvidence(title = '', description = '', {full = false} = {}) {
  const text = String(description).replace(/<[^>]*>/g, ' ').replace(/[^\S\n]+/g, ' ').trim();
  const clauses = text.split(/(?<=[.!?;])\s+|[\n\r]+/).filter(Boolean);
  let heading = '';
  const experience = clauses.map(evidence => {
    if (/^(?:(?:basic|minimum|required) qualifications|minimum requirements)(?:\s*[:–—-].*)?$/i.test(evidence.trim())) heading = 'required';
    else if (/^preferred qualifications(?:\s*[:–—-].*)?$/i.test(evidence.trim())) heading = 'preferred';
    else if (/^(?:responsibilities|benefits|about us):?$/i.test(evidence.trim())) heading = '';
    return { evidence, heading };
  }).filter(({evidence}) => {
    const requirement = /\b(?:require[ds]?|must|mandatory|minimum|at least|candidate|applicant)\b/i.test(evidence);
    const companyHistory = /\b(?:founded|established|legacy|years? in a row|years? (?:of being )?in business|years? of (?:growth|success)|revenue run rate)\b|we (?:have|['’]ve) (?:experienced|been around)|our average.{0,80}\bafter\b/i.test(evidence);
    const futureTraining = /\b(?:receive|provide[ds]?|offer|undergo|participate in)\b.{0,65}\b(?:training|onboarding)\b/i.test(evidence);
    if ((companyHistory || futureTraining) && !requirement) return false;
    return /\b(?:prior|previous|relevant|professional|work|office|sales|banking)\s+experience\b|\bexperience\s+(?:with|in|is|required|preferred|needed|necessary|of)\b|\bexperienced\b|\bworked\b|\b(?:years?|yrs?|months?)\s+(?:in|of|experience)\b|\b(?:years?|yrs?|months?)\b.{0,60}\bexperience\b/i.test(evidence);
  }).map(({evidence, heading}) => {
    const required = heading === 'required' || /\b(required|must|mandatory|at least|minimum)\b/i.test(evidence);
    const preferred = heading === 'preferred' || /\b(preferred|desirable|ideally|nice to have|a plus)\b/i.test(evidence);
    // Negation, alternatives and mixed cues require review rather than a hard requirement.
    const requirementText = evidence
      .replace(/\b(?:years?|yrs?)\s+or more\b/gi, 'years')
      .replace(/\bor more\s+(?=years?\b|yrs?\b)/gi, '')
      .replace(/\bor (?:a |an )?(?:similar|related) (?:[\w-]+ ){0,3}(?:field|industry|environment|setting|role)\b/gi, '');
    const fieldList = /\b(?:transportation|logistics|supply chain|accounting|finance|marketing|sales|operations|business|customer service)\b/i;
    const withoutFieldOr = requirementText.replace(/,\s*or\s+(?=(?:supply chain|logistics|transportation|finance|accounting|marketing|sales|operations|customer service)\b)/gi, '');
    const reviewed = fieldList.test(requirementText) ? withoutFieldOr : requirementText;
    const uncertain = /\b(no|not|without|or|equivalent|unless)\b|\.\.\.|…/i.test(reviewed);
    const status = uncertain || required && preferred ? 'unclear' : preferred ? 'preferred' : required ? 'required' : full ? 'listed' : 'unclear';
    const figures = [...evidence.matchAll(/\b(?:\d+(?:\s*(?:[-–—‑]|to)\s*\d+)?\+?|zero|one|two|three|four|five|six|seven|eight|nine|ten)(?:\s+or\s+more|\s+plus)?\s*(?:years?|yrs?|months?)\b/gi)]
      .filter(match => !/^\s+(?:of\s+)?(?:college|university|school|education)\b/i.test(evidence.slice(match.index + match[0].length)))
      .map(match => match[0]);
    // A shorter figure must not hide a higher minimum in the same sentence.
    const years = figures.sort((a, b) => minimumYears(b) - minimumYears(a))[0] || null;
    return { status, evidence, years };
  });
  const entryLevel = /\bentry[ -]level\b/i.test(title + ' ' + text);
  const years = experience.some(item => /\b(?:[1-9]\d*|one|two|three|four|five|six|seven|eight|nine|ten)(?:\s*[-–]\s*\d+)?\+?\s*(?:years?|yrs?)\b/i.test(item.evidence));
  const titleLevel = title.match(/\b(entry[ -]level|junior|senior|trainee|apprentice(?:ship)?|intern(?:ship)?)\b/i)?.[0].toLowerCase();
  const experienceLevel = titleLevel?.replace('entry level', 'entry-level') ?? null;
  const noExperience = clauses.some(clause =>
    /^\s*(?:[-•]\s*)?(?:no (?:(?:prior|previous|professional|work|relevant|banking|sales|industry) )*experience (?:is )?(?:required|needed|necessary)|experience (?:is )?not (?:required|necessary))(?:\s*[,;:–—-]\s*(?:training (?:is |will be )?provided|we(?:['’]ll| will) train(?: you)?|we (?:offer|provide) (?:a )?(?:paid[,\s-]*)?(?:hands-on[,\s-]*)?(?:formal )?training(?: program)?(?: in [\w ,&-]+)?))?[.!]?\s*$/i.test(clause) ||
    /^(?:experience:\s*)?(?:\d+\+?\s*(?:months?|years?)\s+)?(?:(?:prior|previous|professional|work|relevant|banking|sales) )*experience (?:is )?preferred(?:,? but| and) not required[.!]?\s*$/i.test(clause)
  );
  const statedMinimums = experience
    .filter(item => item.status === 'required' || item.status === 'listed')
    .map(item => minimumYears(item.years));
  const zeroExperience = (noExperience || statedMinimums.includes(0)) &&
    !experience.some(item => item.status !== 'preferred' && minimumYears(item.years) > 0 &&
      !/preferred(?:,? but| and) not required[.!]?\s*$/i.test(item.evidence));
  const withinRange = experience.some(item => {
    const minimum = minimumYears(item.years);
    return minimum !== null && minimum >= 0 && minimum <= 3;
  });
  const aboveRange = experience.some(item => item.status !== 'preferred' && minimumYears(item.years) > 3);
  const entryLevelTitle = ['entry-level', 'junior', 'trainee', 'apprentice', 'apprenticeship', 'intern', 'internship'].includes(experienceLevel);
  const entryLevelPosting = !aboveRange && clauses.some(clause =>
    /^(?:this is an? |we are hiring an? )?entry[- ]level (?:position|role|job)\b/i.test(clause.trim())
  );
  const statedEarlyCareer = !aboveRange && experience.some(item => {
    const minimum = minimumYears(item.years);
    return ['required', 'listed'].includes(item.status) && minimum !== null && minimum >= 0 && minimum <= 3;
  });
  const graduateFit = (seniorTitle.test(title) && !(full && statedEarlyCareer && /\b(?:senior|sr\.?)\b/i.test(title)
    && !/\b(?:director|principal|vice president|vp|head of|chief)\b/i.test(title))) || aboveRange
    ? 'outside'
    : zeroExperience || withinRange || entryLevelTitle || entryLevelPosting ||
      (full && !aboveRange && /\b(?:assistant|associate|coordinator|clerk|teller|representative|specialist|analyst|accountant|recruiter|administrator)\b/i.test(title))
      ? 'potential'
      : 'unclear';
  return {
    experience,
    entryLevel,
    experienceLevel,
    graduateFit,
    noExperience,
    zeroExperience,
    experienceFlag: entryLevel && years,
    notice: full ? 'Qualification fit: not assessed. Experience wording extracted from the full employer-posted description. Listed qualifications are not automatically labeled mandatory; alternatives may apply.' : 'Qualification fit: not assessed. These are automated cues from a partial description; verify the full posting. No cue does not mean no experience is needed.'
  };
}
