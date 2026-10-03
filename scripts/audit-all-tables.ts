import { pool } from "../src/db";

async function main() {
  const res = await pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name ASC"
  );
  
  console.log("=== ALL POSTGRESQL TABLES IN PUBLIC SCHEMA ===");
  const auditResults: Record<string, number> = {};

  for (const row of res.rows) {
    const tableName = row.table_name;
    // Skip drizzle migrations table from business count if desired, but report it
    const countRes = await pool.query(`SELECT count(*) FROM "${tableName}"`);
    auditResults[tableName] = parseInt(countRes.rows[0].count, 10);
  }

  console.log(JSON.stringify(auditResults, null, 2));
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
