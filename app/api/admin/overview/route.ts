export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { teams, submissions } from "@/lib/schema";
import { desc } from "drizzle-orm";
import { CLUES, PICK_COUNT } from "@/data/clues";
import { resolveClue } from "@/lib/order";

const ROUND_DURATION_SEC = 5 * 60; // 300 sekunder

export async function GET() {
  try {
    const teamRows = await db.select().from(teams).orderBy(desc(teams.createdAt));

    const allSubs = await db
      .select({
        id: submissions.id,
        teamId: submissions.teamId,
        correct: submissions.correct,
        submittedAt: submissions.submittedAt,
        timeLeftAtSubmit: submissions.timeLeftAtSubmit,
      })
      .from(submissions);

    const wrongByTeam = new Map<string, number>();
    const lastCorrectByTeam = new Map<
      string,
      { submittedAt: Date; timeLeftAtSubmit: number | null }
    >();

    for (const s of allSubs) {
      if (!s.correct) {
        wrongByTeam.set(s.teamId, (wrongByTeam.get(s.teamId) || 0) + 1);
      } else {
        const prev = lastCorrectByTeam.get(s.teamId);
        if (!prev || (s.submittedAt as Date) > prev.submittedAt) {
          lastCorrectByTeam.set(s.teamId, {
            submittedAt: s.submittedAt as Date,
            timeLeftAtSubmit: (s.timeLeftAtSubmit as number | null) ?? null,
          });
        }
      }
    }

    const active = CLUES.filter((c) => c.active !== false);
    const defaultTotal = Math.min(PICK_COUNT, active.filter((c) => !c.final).length) + active.filter((c) => c.final).length;

    const teamsOut = teamRows.map((t) => {
      const startedAt = t.startedAt as Date | null;
      const completedAt = t.completedAt as Date | null;
      const penalties = Number((t.penaltiesSec as number | null) ?? 0);
      const last = lastCorrectByTeam.get(t.id);

      let actualDurationSec: number | null = null;
      let timeLeftAtFinishSec: number | null = null;

      if (startedAt && completedAt) {
        // Räkna hur lång tid det tog
        const elapsedSec = Math.max(
          0,
          Math.floor((completedAt.getTime() - startedAt.getTime()) / 1000)
        );
        const usedSec = elapsedSec + penalties;
        actualDurationSec = Math.min(ROUND_DURATION_SEC, usedSec);
        timeLeftAtFinishSec = Math.max(0, ROUND_DURATION_SEC - usedSec); // ✅ för UI-kompatibilitet
      } else if (last) {
        // Fallback om completedAt saknas
        const usedSec = ROUND_DURATION_SEC - (last.timeLeftAtSubmit ?? 0) + penalties;
        actualDurationSec = Math.min(ROUND_DURATION_SEC, Math.max(0, usedSec));
        timeLeftAtFinishSec = Math.max(0, ROUND_DURATION_SEC - actualDurationSec);
      }

      const order = Array.isArray(t.orderIds) ? (t.orderIds as unknown[]) : [];
      const totalClues = order.length > 0 ? order.length : defaultTotal;
      const clueOrder = order.map((e) => resolveClue(e, active)?.title ?? "?").join(" → ");

      return {
        id: t.id,
        teamName: t.teamName,
        clueOrder,
        participants: t.participants ?? null,
        createdAt: (t.createdAt as Date | undefined)?.toISOString?.() ?? null,
        startedAt: startedAt?.toISOString?.() ?? null,
        completedAt: completedAt?.toISOString?.() ?? null,
        finalCode: t.finalCode ?? null,
        step: t.step ?? 0,
        totalClues,
        wrongGuesses: wrongByTeam.get(t.id) || 0,
        // --- Viktigt: behåll båda fälten ---
        actualDurationSec,     // Hur lång tid det tog inkl. straff
        timeLeftAtFinishSec,   // För befintlig UI-rendering
      };
    });

    return NextResponse.json({ ok: true, teams: teamsOut });
  } catch (err: any) {
    console.error("overview GET failed:", err?.message || err);
    return NextResponse.json(
      { ok: false, error: "DB error: " + (err?.message || "unknown") },
      { status: 500 }
    );
  }
}
