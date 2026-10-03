async function fetchAnnotations() {
  const jobId = 108184769408;
  const url = `https://api.github.com/repos/Jayesh25-trade/transport-accounting/actions/jobs/${jobId}/annotations`;
  const resp = await fetch(url, { headers: { "User-Agent": "Annotation-Fetcher" } });
  const data = await resp.json();

  console.log("Annotations Count:", Array.isArray(data) ? data.length : "Not array");
  console.log("Annotations Data:", JSON.stringify(data, null, 2));
}

fetchAnnotations().catch(console.error);
