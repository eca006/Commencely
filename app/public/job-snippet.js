const headings = [
  ['overview', /^(?:job (?:description|summary|overview)|position (?:summary|overview)|role (?:summary|overview)|overview|about (?:the|this) (?:job|role|position)|the opportunity)$/i],
  ['duties', /^(?:(?:key |primary |essential |job |core |role )?(?:duties|responsibilities|duties and responsibilities|functions|job functions)|what you(?:’ll|'ll| will) (?:do|own|handle)|how you(?:’ll|'ll| will) contribute|your day[- ]to[- ]day)$/i],
  ['requirements', /^(?:(?:minimum |required |basic |essential |job |position )?(?:qualifications|requirements|qualifications and requirements|skills and qualifications|education and experience)|what you(?:’ll|'ll| will) (?:need|bring)|what you bring|what we(?:’re|'re| are) looking for)$/i],
  ['preferred', /^(?:preferred (?:qualifications|requirements|skills|experience)|nice to have|bonus points)$/i],
  ['skip', /^(?:about us|about the company|who we are|our company|what we offer|why join us|(?:compensation and )?benefits|salary|pay range|equal opportunity|how to apply|key relationships|what .{1,35} offers)(?: and compensation)?$/i]
];

const requirementCue = /\b(?:minimum of|at least|must (?:have|be|hold|possess)|is required|are required|(?:years?|yrs?) of (?:relevant |professional )?experience|degree in|valid driver[’']?s license)\b/i;
const dutyCue = /^(?:(?:you will|you[’']ll|the (?:successful )?candidate will|responsible for)\b|(?:analyze|assist|build|collaborate|coordinate|create|deliver|develop|ensure|lead|maintain|manage|monitor|oversee|partner|prepare|provide|review|support|track|work)\b)/i;
const overviewCue = /\b(?:this (?:role|position|job)|you will be responsible|we (?:are|[’']re) (?:hiring|seeking|looking)|the successful candidate)\b/i;
const boilerplate = /^(?:apply (?:now|today)|equal opportunity employer|we are an equal opportunity|salary range|requisition id|all qualified applicants)\b/i;

function excerpt(value, limit = 175) {
  if (value.length <= limit) return value;
  const end = value.lastIndexOf(' ', limit - 1);
  return value.slice(0, end > limit * .6 ? end : limit - 1).replace(/[,;:]$/, '') + '…';
}

function sectionHeading(line) {
  const divider = line.indexOf(':');
  const label = (divider < 0 ? line : line.slice(0, divider)).trim().replace(/[.!…]+$/, '');
  const match = headings.find(([, pattern]) => pattern.test(label));
  if (match) return [match[0], divider < 0 ? '' : line.slice(divider + 1).trim()];
  if (/^about [A-Z0-9 &’'-]{2,55}$/i.test(label)) return ['skip', ''];
  return null;
}

export function jobSnippet(description) {
  const snippets = { overview: [], duties: [], requirements: [] };
  const seen = new Set();
  let section = '';
  let fallback = '';
  for (let line of String(description ?? '').split(/\r?\n|(?:\s*[•▪●]\s*)/u)) {
    line = line.replace(/^\s*[-–*]\s+/, '').replace(/\s+/g, ' ').trim();
    const heading = sectionHeading(line);
    if (heading) [section, line] = heading;
    if (section === 'skip' || section === 'preferred') continue;
    for (const sentence of line.split(/(?<=[.!?])\s+(?=[A-Z0-9])/)) {
      const value = sentence.trim();
      if (value.length < (section ? 12 : 18) || boilerplate.test(value)) continue;
      const inferred = overviewCue.test(value) ? 'overview'
        : requirementCue.test(value) ? 'requirements' : dutyCue.test(value) ? 'duties' : '';
      const label = section === 'overview' && snippets.overview.length ? inferred || section : section || inferred;
      if (!label) {
        if (!fallback && !/\b(?:preferred|benefits|salary|compensation|copyright)\b/i.test(value)) fallback = value;
        continue;
      }
      if (label === 'requirements' && /\b(?:preferred|nice to have|is a plus)\b/i.test(value)) continue;
      const key = value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
      const bucket = snippets[label];
      if (seen.has(key) || bucket.length >= (label === 'overview' ? 1 : 2)) continue;
      seen.add(key);
      bucket.push(excerpt(value));
    }
  }
  if (!snippets.overview.length && fallback) snippets.overview.push(excerpt(fallback));
  return snippets;
}
