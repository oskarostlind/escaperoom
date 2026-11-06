export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { timeRuns } from "@/lib/schema";
import { TID_TARGET_SEC, teamKey } from "@/lib/tid";

/**
 * Registrerar laget och startar en runda i Tidsspelet.
 * Ett försök per lag: finns ett avslutat försök med samma lagnamn → 409.
 * Finns ett påbörjat men ej avslutat försök (t.ex. sidan laddades om) → startas om.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const teamName = typeof body?.teamName === "string" ? body.teamName.trim().slice(0, 64) : "";
    const participants =
      typeof body?.participants === "string" ? body.participants.trim().slice(0, 256) || null : null;

    if (!teamName) {
      return NextResponse.json({ ok: false, error: "Ange ett lagnamn." }, { status: 400 });
    }

    const key = teamKey(teamName);
    const [existing] = await db.select().from(timeRuns).where(eq(timeRuns.teamKey, key)).limit(1);

    const now = new Date();

    if (existing) {
      if (existing.finishedAt) {
        return NextResponse.json(
          { ok: false, error: `Laget "${existing.teamName}" har redan gjort sitt försök.` },
          { status: 409 }
        );
      }
      // Påbörjat men aldrig avslutat → starta om samma rad
      await db
        .update(timeRuns)
        .set({ teamName, participants, startedAt: now })
        .where(eq(timeRuns.id, existing.id));
      return NextResponse.json({ ok: true, runId: existing.id, targetSec: existing.targetSec });
    }

    const [row] = await db
      .insert(timeRuns)
      .values({ teamName, teamKey: key, participants, targetSec: TID_TARGET_SEC, startedAt: now })
      .returning({ id: timeRuns.id });
    if (!row) return NextResponse.json({ ok: false, error: "Kunde inte skapa laget." }, { status: 500 });

    return NextResponse.json({ ok: true, runId: row.id, targetSec: TID_TARGET_SEC });
  } catch (err: any) {
    console.error("tid/start error:", err);
    return NextResponse.json({ ok: false, error: "Kunde inte starta rundan." }, { status: 500 });
  }
}
