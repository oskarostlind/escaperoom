export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { timeRuns } from "@/lib/schema";

/** Publik topplista (visas bara om /tid öppnas med ?board=1). */
export async function GET() {
  const rows = await db
    .select({ teamName: timeRuns.teamName, diffMs: timeRuns.diffMs })
    .from(timeRuns)
    .where(isNotNull(timeRuns.finishedAt));
  const ranked = rows
    .filter((r) => r.diffMs != null)
    .sort((a, b) => Math.abs(a.diffMs!) - Math.abs(b.diffMs!))
    .slice(0, 15);
  return NextResponse.json({ ok: true, board: ranked });
}
