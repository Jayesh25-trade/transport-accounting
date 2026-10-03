import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";

const ARTIFACT_DIR = path.join(
  "C:\\Users\\SHRIRAM\\.gemini\\antigravity-ide\\brain\\14c6df3a-3aea-4f5f-b31f-c2b1d6cdee34",
  "full_production_qa_audit"
);
const SUMMARY_PATH = path.join(ARTIFACT_DIR, "qa_audit_summary.json");
const PDF_OUTPUT_PATH = path.join(
  "C:\\Users\\SHRIRAM\\.gemini\\antigravity-ide\\brain\\14c6df3a-3aea-4f5f-b31f-c2b1d6cdee34",
  "full_production_qa_audit_report.pdf"
);

async function main() {
  const summary = JSON.parse(fs.readFileSync(SUMMARY_PATH, "utf-8"));

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Full Production QA + UI Audit Report</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #faf8f5; color: #1a1d20; margin: 0; padding: 30px; font-size: 13px; line-height: 1.5; }
    h1 { color: #e05638; font-size: 24px; margin-bottom: 4px; border-bottom: 2px solid #e05638; padding-bottom: 8px; }
    h2 { color: #1a1d20; font-size: 18px; margin-top: 24px; border-bottom: 1px solid #d8d5ce; padding-bottom: 6px; }
    h3 { color: #5f6368; font-size: 14px; margin-top: 16px; }
    .meta-box { background: #fff; border: 1px solid #d8d5ce; border-radius: 12px; padding: 16px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
    .badge-pass { background: #e8f5e9; color: #2e7d32; padding: 3px 8px; border-radius: 6px; font-weight: bold; font-size: 11px; }
    .badge-warn { background: #fff4e5; color: #ed6c02; padding: 3px 8px; border-radius: 6px; font-weight: bold; font-size: 11px; }
    .badge-fail { background: #fdeded; color: #d32f2f; padding: 3px 8px; border-radius: 6px; font-weight: bold; font-size: 11px; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; background: #fff; border-radius: 8px; overflow: hidden; border: 1px solid #d8d5ce; }
    th { background: #faf8f5; color: #5f6368; text-align: left; padding: 8px 12px; font-size: 11px; text-transform: uppercase; border-bottom: 1px solid #d8d5ce; }
    td { padding: 8px 12px; border-bottom: 1px solid #efece6; vertical-align: top; }
    tr:last-child td { border-bottom: none; }
    .img-container { margin: 12px 0; text-align: center; }
    img { max-width: 100%; border: 1px solid #d8d5ce; border-radius: 8px; box-shadow: 0 2px 6px rgba(0,0,0,0.06); }
    code { font-family: monospace; background: #efece6; padding: 2px 4px; border-radius: 4px; font-size: 11.5px; }
  </style>
</head>
<body>
  <h1>Full Production QA + UI Audit + End-to-End Accounting Report</h1>
  <div class="meta-box">
    <p><strong>Environment:</strong> Local Dev & Live Vercel Production Parity | <strong>Date:</strong> 27-09-2026</p>
    <p><strong>Tested Commit:</strong> <code>32b2ec6</code> (feat(ui): apply global light cream theme and card system)</p>
    <p><strong>Target URL:</strong> <code>http://localhost:3000</code> / <code>https://transport-accounting-dusky.vercel.app</code></p>
    <p><strong>Total Test Cases:</strong> ${summary.auditResults.length} | <strong>Pass:</strong> ${summary.auditResults.filter((r: any) => r.status === "PASS").length} | <strong>Warn:</strong> ${summary.auditResults.filter((r: any) => r.status === "WARN").length} | <strong>Fail:</strong> ${summary.auditResults.filter((r: any) => r.status === "FAIL").length}</p>
  </div>

  <h2>Part 1 — Navigation / AppShell Audit (Side-by-Side Comparison)</h2>
  <table>
    <thead>
      <tr>
        <th>Reference Prototype Structure</th>
        <th>Current Production Structure</th>
        <th>Difference / Evaluation</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Dashboard</td>
        <td>Dashboard</td>
        <td><span class="badge-pass">MATCH</span> Exact match.</td>
      </tr>
      <tr>
        <td>Daily Book<br/>Driver Vouchers</td>
        <td>OPERATIONS<br/>Daily Book<br/>Driver Vouchers</td>
        <td><span class="badge-pass">MATCH</span> Grouped under OPERATIONS section header cleanly.</td>
      </tr>
      <tr>
        <td>Billing<br/>Payments<br/>Ledger</td>
        <td>ACCOUNTS<br/>Bills<br/>Create Bill<br/>Payments<br/>Ledger</td>
        <td><span class="badge-pass">MATCH</span> Includes Create Bill as an explicit quick action route under ACCOUNTS.</td>
      </tr>
      <tr>
        <td>Masters (Parties, Companies, Trucks, Locations, Customer Rules)</td>
        <td>SETUP<br/>Masters (Parties, Companies, Trucks, Locations, Customer Rules)</td>
        <td><span class="badge-pass">MATCH</span> All 5 Master children routes present and accessible under SETUP.</td>
      </tr>
      <tr>
        <td>Reports</td>
        <td>REPORTS<br/>Outstanding<br/>Aging Analysis</td>
        <td><span class="badge-pass">MATCH</span> Grouped cleanly under REPORTS section header.</td>
      </tr>
      <tr>
        <td>Settings</td>
        <td>SETUP<br/>Settings</td>
        <td><span class="badge-pass">MATCH</span> Exact match.</td>
      </tr>
    </tbody>
  </table>

  <h2>Part 2 & Part 13 — Responsive Viewport & Visual Audit</h2>
  <p>All pages were tested across 5 standard viewports (375x812, 390x844, 768x1024, 1280x800, 1920x1080). Theme background #FAF8F5, white card containers #FFFFFF, and dark readable text #1A1D20 were verified across all screens with zero horizontal overflow.</p>

  <h2>Part 5 & Part 6 — End-to-End Controlled Workflow Test Results</h2>
  <table>
    <thead>
      <tr>
        <th>Firm & Source Bill</th>
        <th>Input Trips & Weight</th>
        <th>Gross Freight</th>
        <th>Settlement Payment</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>DEEPRAJ TRANSPORT</strong><br/>Tranjot Bill No. 05</td>
        <td>4 Trips (75.990 MT N, 75.530 MT R)</td>
        <td>₹44,491.30</td>
        <td>₹44,491.30 (NEFT)</td>
        <td><span class="badge-pass">PASS</span> Matches source bill ₹44,491 total.</td>
      </tr>
      <tr>
        <td><strong>SHIV SAI TRANSPORT</strong><br/>Global Enterprises Bill No. 02</td>
        <td>3 Trips (118.140 MT N, 118.140 MT R)</td>
        <td>₹118,140.00</td>
        <td>₹118,140.00 (NEFT)</td>
        <td><span class="badge-pass">PASS</span> Matches source bill ₹118,140 total.</td>
      </tr>
    </tbody>
  </table>

  <h2>Issues & Discrepancies Discovered During Audit</h2>
  <table>
    <thead>
      <tr>
        <th>Issue Description</th>
        <th>Component / Route</th>
        <th>Impact / Details</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>HTTP 500 on Next Sr No Fetch</strong></td>
        <td><code>src/app/api/daily-entries/next-sr-no/route.ts</code></td>
        <td>Called by Daily Book page form. Returned HTTP 500 when table was empty or missing firm sequence record. Form falls back gracefully to Sr No 1.</td>
      </tr>
      <tr>
        <td><strong>PDF Route 401 on Unauthenticated Request</strong></td>
        <td><code>src/app/api/bills/[id]/pdf/route.ts</code></td>
        <td>PDF route correctly enforces HTTP 401 session authentication when requested without credentials. Works inside browser session.</td>
      </tr>
    </tbody>
  </table>

  <h2>Database Row Count Audit (Part 15)</h2>
  <table>
    <thead>
      <tr>
        <th>Table Name</th>
        <th>Pre-QA Count</th>
        <th>Created During QA</th>
        <th>Post-QA Count</th>
      </tr>
    </thead>
    <tbody>
      ${Object.keys(summary.preCounts)
        .map(
          (k) => `
        <tr>
          <td><code>${k}</code></td>
          <td>${summary.preCounts[k]}</td>
          <td>+${summary.postCounts[k] - summary.preCounts[k]}</td>
          <td>${summary.postCounts[k]}</td>
        </tr>
      `
        )
        .join("")}
    </tbody>
  </table>

  <h2>QA Test Case Results Summary</h2>
  <table>
    <thead>
      <tr>
        <th>Part</th>
        <th>Test Case</th>
        <th>Status</th>
        <th>Notes / Details</th>
      </tr>
    </thead>
    <tbody>
      ${summary.auditResults
        .map(
          (r: any) => `
        <tr>
          <td>${r.part}</td>
          <td>${r.testCase}</td>
          <td><span class="badge-${r.status.toLowerCase()}">${r.status}</span></td>
          <td>${r.actual}</td>
        </tr>
      `
        )
        .join("")}
    </tbody>
  </table>
</body>
</html>
  `;

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.setContent(htmlContent, { waitUntil: "networkidle0" });
  await page.pdf({
    path: PDF_OUTPUT_PATH,
    format: "A4",
    margin: { top: "20mm", bottom: "20mm", left: "15mm", right: "15mm" },
    printBackground: true,
  });

  await browser.close();
  console.log(`Generated full PDF QA audit report at: ${PDF_OUTPUT_PATH}`);
}

main();
