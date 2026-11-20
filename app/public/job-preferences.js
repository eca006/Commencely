export const localCity = /\b(?:Fayetteville|Springdale|Rogers|Bentonville|Lowell|Bella Vista|Centerton|Cave Springs|Benton County|Washington County|Siloam Springs|Farmington|Tontitown|Johnson|Pea Ridge|Gravette|Gentry|Prairie Grove|Elm Springs)\b/i;
export const arkansas = /\b(?:AR|Arkansas)\b/i;
const words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

export function jobMatchKey(job) {
  const normalize = value => String(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const city = String(job.location ?? '').match(localCity)?.[0];
  if (!city || !job.title || !job.company || job.company === 'Company not listed' || job.title === 'Untitled job') return null;
  return [job.title, job.company, city].map(normalize).join('|');
}

export function minimumYears(value) {
  if (!value) return null;
  const first = value.toLowerCase().match(/^\d+(?:\.\d+)?|^[a-z]+/)?.[0];
  const number = first && /^\d/.test(first) ? Number(first) : words.indexOf(first);
  return number < 0 ? null : /\bmonths?\b/i.test(value) ? number / 12 : number;
}

export function statedExperience({ experience = [] }) {
  return experience.filter(item => item.years && ['required', 'listed'].includes(item.status));
}

export function matchesExperienceFilter(qualifications, filter) {
  if (qualifications.graduateFit === 'outside') return false;
  if (filter === 'zero') return qualifications.zeroExperience === true;
  if (filter === 'stated') {
    const minimums = statedExperience(qualifications).map(item => minimumYears(item.years));
    return !minimums.some(years => years > 3) &&
      (qualifications.zeroExperience || minimums.some(years => years !== null && years >= 0 && years <= 3));
  }
  return qualifications.graduateFit === 'potential' || filter === 'broader';
}

export function experienceSummary(qualifications) {
  if (qualifications.zeroExperience) return '0 years · no experience minimum required';
  const primary = statedExperience(qualifications)
    .sort((a, b) => minimumYears(b.years) - minimumYears(a.years))[0];
  if (primary) return `${primary.years} ${primary.status === 'required' ? 'required' : 'listed'}`;
  const preferred = qualifications.experience.find(item => item.status === 'preferred' && item.years);
  if (preferred) return `${preferred.years} preferred · minimum not specified`;
  const ambiguous = qualifications.experience.find(item => item.years);
  if (ambiguous) return `${ambiguous.years} mentioned · check posting`;
  return 'Experience minimum not specified · check posting';
}

export function compareExperience(a, b) {
  const rank = ({qualifications: q}) => {
    if (q.zeroExperience) return 0;
    const minimums = statedExperience(q).map(item => minimumYears(item.years)).filter(value => value !== null);
    if (minimums.length) return 2 + Math.max(...minimums) / 10;
    return q.graduateFit === 'potential' ? 1 : 4;
  };
  return rank(a) - rank(b);
}
