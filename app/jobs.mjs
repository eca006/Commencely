import { qualificationEvidence } from './qualifications.mjs';
export function normalizeJobs(data) {
  if (!Array.isArray(data.results)) throw new Error('Invalid response');
  return {
    count: Number.isFinite(data.count) ? data.count : data.results.length,
    jobs: data.results.map(job => {
      let link = null;
      try {
        const url = new URL(job.redirect_url);
        if (['https:', 'http:'].includes(url.protocol)) link = url.href;
      } catch {}
      return {
        id: String(job.id || ''), title: job.title || 'Untitled job',
        company: job.company?.display_name || 'Company not listed',
        location: job.location?.display_name || 'Location not listed',
        description: job.description || 'Description unavailable.', link,
        qualifications: qualificationEvidence(job.title, job.description)
      };
    })
  };
}
