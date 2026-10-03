import * as fs from "fs";

async function monitorRun() {
  console.log("==================================================");
  console.log("MONITORING GITHUB ACTIONS BACKUP WORKFLOW RUN");
  console.log("Repository: Jayesh25-trade/transport-accounting");
  console.log("Workflow: Production Off-Site Logical Backup (Cloudflare R2)");
  console.log("==================================================");

  const initialUrl = "https://api.github.com/repos/Jayesh25-trade/transport-accounting/actions/runs?per_page=5";
  const initResp = await fetch(initialUrl, { headers: { "User-Agent": "Backup-Monitor" } });
  const initData = await initResp.json();
  const knownRunIds = new Set((initData.workflow_runs || []).map((r: any) => r.id));

  console.log("Known initial run IDs:", Array.from(knownRunIds));
  console.log("Waiting for new workflow_dispatch run to be triggered...\n");

  let newRun: any = null;
  const maxAttempts = 60; // 5 minutes max polling window

  for (let i = 1; i <= maxAttempts; i++) {
    const resp = await fetch(initialUrl, { headers: { "User-Agent": "Backup-Monitor" } });
    if (resp.ok) {
      const data = await resp.json();
      const runs = data.workflow_runs || [];
      const found = runs.find((r: any) => !knownRunIds.has(r.id) && r.name.includes("Off-Site"));
      if (found) {
        newRun = found;
        console.log(`\n🎉 New Workflow Run Detected!`);
        console.log(`- Run ID: ${newRun.id}`);
        console.log(`- Run Number: ${newRun.run_number}`);
        console.log(`- Status: ${newRun.status}`);
        console.log(`- Created At: ${newRun.created_at}`);
        console.log(`- HTML URL: ${newRun.html_url}`);
        break;
      }
    }
    process.stdout.write(`Attempt ${i}/${maxAttempts}: Waiting for run trigger...\r`);
    await new Promise(r => setTimeout(r, 5000));
  }

  if (!newRun) {
    console.log("\n⚠️ No new workflow run detected within the 5-minute window.");
    process.exit(1);
  }

  // Poll until run completes
  console.log("\nMonitoring run progress until completion...");
  while (true) {
    const runUrl = `https://api.github.com/repos/Jayesh25-trade/transport-accounting/actions/runs/${newRun.id}`;
    const resp = await fetch(runUrl, { headers: { "User-Agent": "Backup-Monitor" } });
    if (resp.ok) {
      const runData = await resp.json();
      console.log(`- Status: ${runData.status} | Conclusion: ${runData.conclusion || "in_progress"}`);
      if (runData.status === "completed") {
        console.log("\n==================================================");
        console.log(`WORKFLOW RUN COMPLETED WITH CONCLUSION: ${runData.conclusion?.toUpperCase()}`);
        console.log("==================================================");
        console.log(`Run ID: ${runData.id}`);
        console.log(`Run Number: ${runData.run_number}`);
        console.log(`Conclusion: ${runData.conclusion}`);
        console.log(`Started At: ${runData.run_started_at || runData.created_at}`);
        console.log(`Updated At: ${runData.updated_at}`);
        console.log(`HTML URL: ${runData.html_url}`);
        break;
      }
    }
    await new Promise(r => setTimeout(r, 10000));
  }
}

monitorRun().catch(err => {
  console.error("Monitor Error:", err);
  process.exit(1);
});
