import * as fs from "fs";

async function checkWorkflowRuns() {
  const url = "https://api.github.com/repos/Jayesh25-trade/transport-accounting/actions/runs?per_page=10";
  const resp = await fetch(url, { headers: { "User-Agent": "Backup-Checker" } });
  const data = await resp.json();

  console.log("Total Workflow Runs:", data.total_count);
  if (!data.workflow_runs || data.workflow_runs.length === 0) {
    console.log("No workflow runs found.");
    return;
  }

  for (const r of data.workflow_runs) {
    console.log(`\n--------------------------------------------------`);
    console.log(`Run ID: ${r.id}`);
    console.log(`Run Number: ${r.run_number}`);
    console.log(`Workflow Name: ${r.name}`);
    console.log(`Event: ${r.event}`);
    console.log(`Status: ${r.status}`);
    console.log(`Conclusion: ${r.conclusion}`);
    console.log(`Created At: ${r.created_at}`);
    console.log(`Head Commit: ${r.head_commit?.id?.slice(0, 7)} - ${r.head_commit?.message?.split("\n")[0]}`);
    console.log(`HTML URL: ${r.html_url}`);
  }
}

checkWorkflowRuns().catch(console.error);
