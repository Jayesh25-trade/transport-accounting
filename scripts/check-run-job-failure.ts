async function checkJobFailure() {
  const runId = 36173009572;
  const url = `https://api.github.com/repos/Jayesh25-trade/transport-accounting/actions/runs/${runId}/jobs`;
  const resp = await fetch(url, { headers: { "User-Agent": "Backup-Failure-Checker" } });
  const data = await resp.json();

  console.log("Job Count:", data.jobs?.length);
  if (!data.jobs) return;

  for (const job of data.jobs) {
    console.log(`\nJob Name: ${job.name} | Status: ${job.status} | Conclusion: ${job.conclusion}`);
    for (const step of job.steps || []) {
      console.log(`  Step [${step.number}]: ${step.name} -> Status: ${step.status} | Conclusion: ${step.conclusion}`);
    }
  }
}

checkJobFailure().catch(console.error);
