import { getBusinessMajor } from './public/business-majors.js';
import { getCareerOneStopJobs } from './careeronestop.mjs';
import { normalizeJobs } from './jobs.mjs';
import { businessDegreeSearches, businessSearchKeywords, directionSearch, filterBusinessJobs, filterDirection } from './search.mjs';
import { getEmployerJobs } from './employer-jobs.mjs';

export async function jobRoute(url, env, json) {
    if (url.pathname === '/api/careeronestop-jobs') {
      const direction = url.searchParams.get('direction') || '';
      const keywords = url.searchParams.get('keywords') || '';
      const location = url.searchParams.get('location') || 'Fayetteville, Arkansas';
      if ((direction && !directionSearch(direction)) || keywords.length > 120 || location.length > 120) {
        return json( 400, { error: 'Invalid search.' });
      }
      const credentials = {
        userId: env.CAREERONESTOP_USER_ID,
        token: env.CAREERONESTOP_API_TOKEN
      };
      try {
        return json( 200, await getCareerOneStopJobs({ direction, keywords, location }, credentials));
      } catch {
        return json( 502, { error: 'CareerOneStop is unavailable.' });
      }
    }
    if (url.pathname === '/api/employer-jobs') {
      const query=Object.fromEntries(['direction','keywords','location'].map(key=>[key,url.searchParams.get(key)||'']));
      if (query.direction && !directionSearch(query.direction) || Object.values(query).some(value=>value.length>120)) return json(400,{error:'Invalid search.'});
      try { return json(200,await getEmployerJobs(query)); }
      catch { return json(502,{error:'Employer feed unavailable. Adzuna results may still be available.'}); }
    }
    if (url.pathname === '/api/jobs') {
      const id = env.ADZUNA_APP_ID, key = env.ADZUNA_APP_KEY;
      if (!id || !key) return json( 503, { error: 'Add your Adzuna app ID and key to app/.env, then restart the app.' });
      const location = url.searchParams.get('location') || 'Fayetteville, Arkansas';
      const keywords = url.searchParams.get('keywords') || '';
      const direction = url.searchParams.get('direction');
      if (direction && !directionSearch(direction)) return json( 400, { error: 'Choose a valid career direction.' });
      if (location.length > 120 || keywords.length > 120) return json( 400, { error: 'Keep search fields under 120 characters.' });
      const experienceSearch = url.searchParams.get('experienceOnly') === 'yes';
      const firstPage = Number(url.searchParams.get('page') ?? 1);
      if (!Number.isSafeInteger(firstPage) || firstPage < 1 || firstPage > 1000 ||
          (firstPage !== 1 && (!experienceSearch || direction))) {
        return json(400, { error: 'Invalid results page.' });
      }
      const pageSize = direction || experienceSearch ? 50 : 10;
      const params = new URLSearchParams({
        app_id: id, app_key: key, where: location,
        what: direction ? directionSearch(direction) : keywords,
        results_per_page: String(pageSize), 'content-type': 'application/json'
      });
      const major = getBusinessMajor(url.searchParams.get('major'));
      const majorTerms = major?.[1];
      const broadGraduateSearch = experienceSearch && !direction && !keywords.trim() && !majorTerms;
      if (!direction && !keywords.trim()) {
        params.set('what_or', majorTerms || businessSearchKeywords);
        if (experienceSearch) params.set('distance', '40');
      }

      let requests = 0;
      const requestPage = async (page, searchParams) => {
        requests += 1;
        const endpoint = new URL(`https://api.adzuna.com/v1/api/jobs/us/search/${page}`);
        endpoint.search = searchParams;
        const response = await fetch(endpoint, {
          signal: AbortSignal.timeout(8000), headers: { Accept: 'application/json' }
        });
        if (!response.ok) {
          const error = new Error([401, 403].includes(response.status)
            ? 'Adzuna could not authorize this search. Check your server credentials and account access.'
            : `Adzuna returned status ${response.status}. Please try again later.`);
          error.status = response.status;
          throw error;
        }
        const data = await response.json();
        if (!Array.isArray(data.results)) throw new Error('Invalid Adzuna response.');
        return data;
      };
      const fetchPage = async (page, searchParams = params) => {
        try { return await requestPage(page, searchParams); }
        catch (error) {
          if (requests >= 39 || (error.status && error.status !== 429 && error.status < 500)) throw error;
          await new Promise(resolve => setTimeout(resolve, 350));
          if (requests >= 39) throw error;
          return requestPage(page, searchParams);
        }
      };

      let raw;
      try { raw = await fetchPage(firstPage); }
      catch (error) { return json( 502, { error: error.message }); }

      let pageLimitReached = false;
      const additionalPages = (first, start, limit) => {
        const totalPages = Math.min(1000, Math.ceil(first.count / pageSize));
        if (first.results.length < pageSize || !(totalPages > start)) return [];
        const last = Math.min(totalPages, start + limit - 1);
        pageLimitReached ||= totalPages > last;
        return Array.from({ length: last - start }, (_, index) => start + index + 1);
      };
      async function fetchPages(numbers, searchParams) {
        const pages = [];
        for (let index = 0; index < numbers.length; index += 4) {
          pages.push(...await Promise.allSettled(numbers.slice(index, index + 4)
            .map(page => fetchPage(page, searchParams))));
        }
        return pages;
      }
      const primaryPages = experienceSearch ? additionalPages(raw, firstPage, 12) : [];
      const primaryResults = fetchPages(primaryPages, params);
      const extraSearches = [];
      if (broadGraduateSearch && firstPage === 1) {
        const entryLevel = new URLSearchParams(params);
        entryLevel.set('what_phrase', 'entry level');
        const graduate = new URLSearchParams(params);
        graduate.set('what_or', 'junior graduate trainee apprenticeship');

        for (const searchParams of [entryLevel, graduate]) {
          extraSearches.push(fetchPage(1, searchParams).then(async first => {
            const pages = await fetchPages(additionalPages(first, 1, 6), searchParams);
            return {
              results: first.results.concat(pages.flatMap(page =>
                page.status === 'fulfilled' ? page.value.results : [])),
              partial: pages.some(page => page.status === 'rejected')
            };
          }));
        }
        extraSearches.push((async () => {
          const results = [];
          let partial = false;
          for (let index = 0; index < businessDegreeSearches.length; index += 3) {
            const batch = await Promise.allSettled(businessDegreeSearches.slice(index, index + 3).map(terms => {
              const degreeParams = new URLSearchParams(params);
              degreeParams.set('what_or', terms);
              return fetchPage(1, degreeParams);
            }));
            for (const page of batch) {
              if (page.status === 'fulfilled') results.push(...page.value.results);
              else partial = true;
            }
          }
          return { results, partial };
        })());
      }

      const [main, extras] = await Promise.all([primaryResults, Promise.allSettled(extraSearches)]);
      const firstMissing = primaryPages[main.findIndex(page => page.status === 'rejected')];
      const nextUnchecked = primaryPages.length &&
        Math.min(1000, Math.ceil(raw.count / pageSize)) > firstPage + primaryPages.length
        ? firstPage + primaryPages.length + 1 : null;
      const nextPage = direction ? null : firstMissing ?? nextUnchecked;
      const supplementaryPartial = extras.some(page => page.status === 'rejected' || page.value.partial);
      const partial = Boolean(firstMissing) || supplementaryPartial;
      if (main.length || extras.length) {
        const unique = new Map(raw.results.map(job => [job.id ?? job.redirect_url ?? job, job]));
        for (const page of [...main, ...extras]) {
          if (page.status === 'rejected') continue;
          for (const job of page.value.results) {
            const key = job.id ?? job.redirect_url ?? job;
            if (!unique.has(key)) unique.set(key, job);
          }
        }
        raw.results = [...unique.values()];
      }

      const filtered = direction ? filterDirection(raw, direction) : filterBusinessJobs(raw);
      const normalized = normalizeJobs(filtered);
      return json( 200, {
        ...normalized, partial, supplementaryPartial, pageLimitReached, nextPage,
        jobs: direction && !experienceSearch ? normalized.jobs.slice(0, 10) : normalized.jobs
      });
    }
}
