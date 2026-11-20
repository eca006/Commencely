// Conservative snippet cues, not a determination of eligibility.
const numberWords = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const seniorTitle = /\b(senior|sr\.?|director|principal|vice president|vp|head of|chief)\b/i;

function minimumYears(value) {
  if (!value) return null;
  const first = value.toLowerCase().match(/^\d+|^[a-z]+/)?.[0];
  if (!first) return null;
  return /^\d+$/.test(first) ? Number(first) : numberWords.indexOf(first);
}

export function qualificationEvidence(title = '', description = '', {full = false} = {}) {
  const text = String(description).replace(/<[^>]*>/g, ' ').replace(/[^\S\n]+/g, ' ').trim();
  const clauses = text.split(/(?<=[.!?;])\s+|[\n\r]+/).filter(Boolean);
  let heading = '';
  const experience = clauses.map(evidence => {
    if (/^(?:basic|minimum|required) qualifications:?$/i.test(evidence.trim())) heading = 'required';
    else if (/^preferred qualifications:?$/i.test(evidence.trim())) heading = 'preferred';
    else if (/^(?:responsibilities|benefits|about us):?$/i.test(evidence.trim())) heading = '';
    return { evidence, heading };
  }).filter(({evidence}) => /\b(?:prior|previous|relevant|professional|work|office|sales)\s+experience\b|\bexperience\s+(?:with|in|is|required|preferred|needed|necessary|of)\b|\bexperienced\b|\bworked\b|\b(?:years?|yrs?)\s+(?:in|of|experience)\b|\b(?:years?|yrs?)\b.{0,60}\bexperience\b/i.test(evidence)).map(({evidence, heading}) => {
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
    const years = evidence.match(/\b(?:\d+(?:\s*(?:[-–]|to)\s*\d+)?\+?|zero|one|two|three|four|five|six|seven|eight|nine|ten)(?:\s+or\s+more)?\s*(?:years?|yrs?)\b/i)?.[0] || null;
    return { status, evidence, years };
  });
  const entryLevel = /\bentry[ -]level\b/i.test(title + ' ' + text);
  const years = experience.some(item => /\b(?:[1-9]\d*|one|two|three|four|five|six|seven|eight|nine|ten)(?:\s*[-–]\s*\d+)?\+?\s*(?:years?|yrs?)\b/i.test(item.evidence));
  const titleLevel = title.match(/\b(entry[ -]level|junior|senior|trainee|apprentice(?:ship)?|intern(?:ship)?)\b/i)?.[0].toLowerCase();
  const experienceLevel = titleLevel?.replace('entry level', 'entry-level') ?? null;
  const noExperience = clauses.some(clause =>
    /^\s*(?:[-•]\s*)?(?:no (?:(?:prior|previous|professional|work|relevant) )*experience (?:is )?(?:required|needed|necessary)|experience (?:is )?not (?:required|necessary))(?:\s*[,;:–—-]\s*(?:training (?:is |will be )?provided|we(?:['’]ll| will) train(?: you)?))?[.!]?\s*$/i.test(clause)
  );
  const statedMinimums = experience
    .filter(item => item.status === 'required' || item.status === 'listed')
    .map(item => minimumYears(item.years));
  const zeroExperience = (noExperience || statedMinimums.includes(0)) &&
    !statedMinimums.some(minimum => minimum > 0);
  const statedAboveRange = experience.some(item => ['required', 'listed'].includes(item.status) && minimumYears(item.years) > 3);
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
    && !/\b(?:director|principal|vice president|vp|head of|chief)\b/i.test(title))) || statedAboveRange
    ? 'outside'
    : noExperience || withinRange || entryLevelTitle || entryLevelPosting
      ? 'potential'
      : aboveRange ? 'outside' : 'unclear';
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
