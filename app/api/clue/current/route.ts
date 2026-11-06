export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { teams, submissions } from "@/lib/schema";
import { resolveClue } from "@/lib/order";

const DEFAULT_CLUE_SECONDS = 5 * 60;

async function getClues(): Promise<any[]> {
  const mod: any = await import("../../../../data/clues");
  return mod?.CLUES ?? mod?.default ?? mod?.clues ?? [];
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const teamId = searchParams.get("teamId");

    if (!teamId) {
      return NextResponse.json({ ok: false, error: "Missing teamId" }, { status: 400 });
    }

    const [team] = await db.select().from(teams).where(eq(teams.id, teamId));
    if (!team) {
      return NextResponse.json({ ok: false, error: "Team not found" }, { status: 404 });
    }

    const ALL = await getClues();
    const active = ALL.filter((c) => !!c?.active);
    const orderIds: unknown[] =
      Array.isArray(team.orderIds) && (team.orderIds as unknown[]).length > 0
        ? (team.orderIds as unknown[])
        : active.map((c: any) => c.id);
    const total = orderIds.length;

    // === OM SPELET ÄR KLART ===
    if (team.completedAt && team.startedAt) {
      const startedAtMs = (team.startedAt as Date).getTime();
      const completedAtMs = (team.completedAt as Date).getTime();
      const penalties = Number(team.penaltiesSec ?? 0);

      const elapsedSec = Math.max(0, Math.floor((completedAtMs - startedAtMs) / 1000));
      const totalTimeSec = Math.min(DEFAULT_CLUE_SECONDS, elapsedSec + penalties); // ✅ inkluderar straff

      return NextResponse.json({
        ok: true,
        finished: true,
        team: { id: team.id, step: team.step ?? 0, total },
        totalTimeSec,
      });
    }

    // === OM SPELET PÅGÅR ===
    const step = Math.max(0, Math.min(Number(team.step ?? 0), Math.max(total - 1, 0)));
    const current = resolveClue(orderIds[step], active);

    if (!current) {
      return NextResponse.json({ ok: false, error: "No current clue" }, { status: 400 });
    }

    const startedAtMs = (team.startedAt as Date | null)?.getTime() ?? Date.now();
    const penalties = Number((team.penaltiesSec as number | null) ?? 0);

    // korrekt: dra av straff istället för att lägga till
    const now = Date.now();
    const elapsedSec = Math.max(0, Math.floor((now - startedAtMs) / 1000));
    const timeLeftSec = Math.max(0, DEFAULT_CLUE_SECONDS - elapsedSec - penalties);
    const deadline = new Date(now + timeLeftSec * 1000);

    return NextResponse.json({
      ok: true,
      finished: false,
      team: { id: team.id, step, total },
      clue: {
        id: current.id ?? String(step),
        title: current.title ?? "",
        icon: current.icon ?? "",
        riddle: current.riddle ?? "",
        type: current.type ?? "digit",
      },
      deadline: deadline.toISOString(),
      timeLeftSec,
    });
  } catch (err: any) {
    console.error("current GET error:", err);
    return NextResponse.json(
      { ok: false, error: "Internal error" },
      { status: 500 }
    );
  }
}
