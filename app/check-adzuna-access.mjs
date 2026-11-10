// Report response shape only. Never log credentials or the request URL.
const url = new URL('https://api.adzuna.com/v1/api/jobs/us/search/1');
url.search = new URLSearchParams({app_id:process.env.ADZUNA_APP_ID,app_key:process.env.ADZUNA_APP_KEY,where:'Fayetteville, Arkansas',what:'marketing',results_per_page:'10','content-type':'application/json'});
try {
  const response=await fetch(url,{signal:AbortSignal.timeout(15000)});
  if(!response.ok){console.log(JSON.stringify({status:response.status}));process.exit(1);}
  const data=await response.json();
  console.log(JSON.stringify({status:response.status,results:data.results?.length,descriptions:data.results?.map(job=>({characters:(job.description||'').length,truncated:/\.\.\.$|…$/.test(job.description||''),extraDescriptionFields:Object.keys(job).filter(key=>/description|qualif|experience/i.test(key))}))}));
} catch { console.log('Connection failed; credentials were not logged.');process.exitCode=1; }
