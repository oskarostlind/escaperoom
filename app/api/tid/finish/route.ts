export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { timeRuns } from "@/lib/schema";

/**
 * Sparar resultatet. elapsedMs mäts i klienten (performance.now) för att slippa nätverkslatens;
 * servern kontrollerar bara att värdet är rimligt mot startedAt.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const runId = typeof body?.runId === "string" ? body.runId : "";
    const elapsedMs = Number(body?.elapsedMs);

    if (!runId) return NextResponse.json({ ok: false, error: "runId saknas" }, { status: 400 });
    if (!Number.isFinite(elapsedMs) || elapsedMs < 0 || elapsedMs > 10 * 60 * 1000) {
      return NextResponse.json({ ok: false, error: "Ogiltig tid" }, { status: 400 });
    }

    const [run] = await db.select().from(timeRuns).where(eq(timeRuns.id, runId)).limit(1);
    if (!run) return NextResponse.json({ ok: false, error: "Rundan finns inte" }, { status: 404 });
    if (run.finishedAt) {
      return NextResponse.json({ ok: false, error: "Rundan är redan avslutad." }, { status: 409 });
    }

    const now = new Date();
    // Rimlighetskoll: servertid får inte avvika mer än 15 s från klientens mätning
    const serverElapsed = now.getTime() - (run.startedAt as Date).getTime();
    const sane = Math.abs(serverElapsed - elapsedMs) < 15_000;
    const finalElapsed = sane ? Math.round(elapsedMs) : Math.round(serverElapsed);

    const diffMs = finalElapsed - run.targetSec * 1000;

    const [updated] = await db
      .update(timeRuns)
      .set({ finishedAt: now, elapsedMs: finalElapsed, diffMs })
      .where(eq(timeRuns.id, runId))
      .returning();
    if (!updated) return NextResponse.json({ ok: false, error: "Rundan finns inte" }, { status: 404 });

    return NextResponse.json({
      ok: true,
      run: {
        id: updated.id,
        teamName: updated.teamName,
        targetSec: updated.targetSec,
        elapsedMs: updated.elapsedMs,
        diffMs: updated.diffMs,
      },
    });
  } catch (err: any) {
    console.error("tid/finish error:", err);
    return NextResponse.json({ ok: false, error: "Kunde inte spara resultatet." }, { status: 500 });
  }
}
