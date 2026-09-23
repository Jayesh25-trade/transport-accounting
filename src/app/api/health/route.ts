import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";

export async function GET() {
  try {
    await db.execute(sql`SELECT 1`);
    return NextResponse.json(
      {
        status: "ok",
        db: "connected",
        timestamp: new Date().toISOString(),
        service: "transport-accounting-api",
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      {
        status: "error",
        db: "disconnected",
        timestamp: new Date().toISOString(),
        service: "transport-accounting-api",
      },
      { status: 503 }
    );
  }
}
