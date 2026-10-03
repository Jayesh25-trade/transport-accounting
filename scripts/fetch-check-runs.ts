async function fetchCheckRuns() {
  const ref = "d6b659a";
  const url = `https://api.github.com/repos/Jayesh25-trade/transport-accounting/commits/${ref}/check-runs`;
  const resp = await fetch(url, { headers: { "User-Agent": "CheckRuns-Fetcher" } });
  const data = await resp.json();

  console.log("Check Runs Count:", data.check_runs?.length);
  if (data.check_runs) {
    for (const cr of data.check_runs) {
      console.log(`\nCheck Run: ${cr.name} | Status: ${cr.status} | Conclusion: ${cr.conclusion}`);
      console.log("Output Title:", cr.output?.title);
      console.log("Output Summary:", cr.output?.summary);
      console.log("Output Text:", cr.output?.text);
      console.log("Annotations Count:", cr.output?.annotations_count);
      if (cr.output?.annotations_url) {
        const annoResp = await fetch(cr.output.annotations_url, { headers: { "User-Agent": "CheckRuns-Fetcher" } });
        const annos = await annoResp.json();
        console.log("Annotations List:", JSON.stringify(annos, null, 2));
      }
    }
  }
}

fetchCheckRuns().catch(console.error);
