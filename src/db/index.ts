import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

// Validate DATABASE_URL at startup
if (!process.env.DATABASE_URL) {
  throw new Error(
    "[DB] DATABASE_URL is not configured. Set it in .env.local."
  );
}

/**
 * PostgreSQL connection pool.
 * Uses pg Pool for connection reuse across API routes.
 * Pool size is kept conservative for a business-critical single-tenant app.
 */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,           // max 10 concurrent connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Gracefully handle pool errors without crashing the process
pool.on("error", (err) => {
  console.error("[DB] Unexpected pool error:", err.message);
});

/**
 * Drizzle ORM instance.
 * Import `db` wherever database access is needed.
 *
 * Usage:
 *   import { db } from "@/db";
 *   const firms = await db.select().from(schema.firms);
 */
export const db = drizzle(pool, { schema });

/**
 * Export pool directly for raw transaction access when needed.
 * Prefer using `db` via Drizzle unless raw SQL is necessary.
 */
export { pool };

export type DB = typeof db;
