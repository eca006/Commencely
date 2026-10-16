// Conservative snippet cues, not a determination of eligibility.
export function qualificationEvidence(title = '', description = '') {
  const text = String(description).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const clauses = text.split(/(?<=[.!?;])\s+|[\n\r]+/).filter(Boolean);
  const experience = clauses.filter(clause => /\b(?:prior|previous|relevant|professional|work|office|sales)\s+experience\b|\bexperience\s+(?:with|in|is|required|preferred|needed|necessary|of)\b|\bexperienced\b|\bworked\b|\byears?\s+(?:in|of|experience)\b/i.test(clause)).map(evidence => {
    const required = /\b(required|must|mandatory|at least|minimum)\b/i.test(evidence);
    const preferred = /\b(preferred|desirable|ideally|nice to have|a plus)\b/i.test(evidence);
    // Negation, alternatives and mixed cues require review rather than a hard requirement.
    const uncertain = /\b(no|not|without|or|equivalent|unless)\b|\.\.\.|…/i.test(evidence);
    const status = uncertain || required && preferred ? 'unclear' : preferred ? 'preferred' : required ? 'required' : 'unclear';
    return { status, evidence };
  });
  const entryLevel = /\bentry[ -]level\b/i.test(title + ' ' + text);
  const years = experience.some(item => /\b(?:[1-9]\d*|one|two|three|four|five|six|seven|eight|nine|ten)(?:\s*[-–]\s*\d+)?\+?\s*(?:years?|yrs?)\b/i.test(item.evidence));
  return {
    experience,
    entryLevel,
    experienceFlag: entryLevel && years,
    notice: 'Qualification fit: not assessed. These are automated cues from a partial description; verify the full posting. No cue does not mean no experience is needed.'
  };
}
