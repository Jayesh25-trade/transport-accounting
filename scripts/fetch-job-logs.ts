async function fetchJobDetails() {
  const runId = 36169336427;
  const url = `https://api.github.com/repos/Jayesh25-trade/transport-accounting/actions/runs/${runId}/jobs`;
  const resp = await fetch(url, { headers: { "User-Agent": "Backup-Failure-Checker" } });
  const data = await resp.json();

  if (data.jobs && data.jobs.length > 0) {
    const job = data.jobs[0];
    console.log("Job ID:", job.id);
    console.log("Job HTML URL:", job.html_url);
    console.log("Steps breakdown:");
    for (const step of job.steps) {
      console.log(`  Step ${step.number}: ${step.name} [${step.conclusion}]`);
    }
  }
}

fetchJobDetails().catch(console.error);
