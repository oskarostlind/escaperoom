export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { timeRuns } from "@/lib/schema";

/** Alla försök i Tidsspelet, rankade: avslutade först (närmast måltiden vinner), sedan påbörjade. */
export async function GET() {
  try {
    const rows = await db.select().from(timeRuns).orderBy(desc(timeRuns.createdAt));
    const finished = rows
      .filter((r) => r.finishedAt && r.diffMs != null)
      .sort((a, b) => Math.abs(a.diffMs!) - Math.abs(b.diffMs!));
    const pending = rows.filter((r) => !r.finishedAt);

    const out = [...finished, ...pending].map((r, i) => ({
      id: r.id,
      rank: r.finishedAt ? i + 1 : null,
      teamName: r.teamName,
      participants: r.participants ?? null,
      targetSec: r.targetSec,
      startedAt: (r.startedAt as Date)?.toISOString?.() ?? null,
      finishedAt: (r.finishedAt as Date | null)?.toISOString?.() ?? null,
      elapsedMs: r.elapsedMs ?? null,
      diffMs: r.diffMs ?? null,
    }));

    return NextResponse.json({ ok: true, runs: out });
  } catch (err: any) {
    console.error("admin/tid GET failed:", err?.message || err);
    return NextResponse.json({ ok: false, error: "DB error: " + (err?.message || "unknown") }, { status: 500 });
  }
}

/** Ta bort ett försök (så laget kan köra igen). */
export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "id saknas" }, { status: 400 });
  await db.delete(timeRuns).where(eq(timeRuns.id, id));
  return NextResponse.json({ ok: true });
}
