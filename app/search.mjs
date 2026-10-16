const searches = {
  marketing: { query: 'marketing', title: /\b(marketing|communications?|content|social media|public relations)\b/i },
  sales: { query: 'sales', title: /\b(sales|account representative|account executive|customer (service|success|support))\b/i },
  operations: { query: 'operations', title: /\b(operations?|business|administrative|office|project|logistics|supply chain)\b/i }
};
const clinical = /\b(RN|LPN|nurs(?:e|es|ing)|physician|surgeon|surgical|clinical|circulator|therapist|patient|operating room)\b/i;
export function directionSearch(direction) { return searches[direction]?.query; }
export function filterDirection(data, direction) {
  const rule = searches[direction];
  if (!rule || !Array.isArray(data.results)) throw new Error('Invalid direction or results');
  const reviewed = data.results.length;
  const results = data.results.filter(job => rule.title.test(job.title || '') && !clinical.test(job.title || ''));
  return { ...data, results, reviewed, removed: reviewed - results.length };
}
