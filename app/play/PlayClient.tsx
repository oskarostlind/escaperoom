"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

/* ---------------- Types ---------------- */
type CurrentOk =
  | {
      ok: true;
      finished: true;
      team: { id: string; step: number; total: number };
      totalTimeSec: number;
    }
  | {
      ok: true;
      finished: false;
      team: { id: string; step: number; total: number };
      clue: { id: string; title: string; icon: string; riddle: string; type: "digit" | "code" };
      deadline: string;
      timeLeftSec: number;
    };

type CurrentResp = CurrentOk | { ok: false; error: string };

/* ---------------- Utils ---------------- */
function mmss(s: number) {
  const v = Math.max(0, s);
  const m = Math.floor(v / 60).toString().padStart(2, "0");
  const ss = (v % 60).toString().padStart(2, "0");
  return `${m}:${ss}`;
}
function humanTime(total: number) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

/* ---------------- Page ---------------- */
export default function PlayClient() {
  const sp = useSearchParams();
  const teamId = sp.get("team");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const [lost, setLost] = useState(false); // -> tidsutgång

  const [step, setStep] = useState(0);
  const [total, setTotal] = useState(0);

  // (title tas bort från UI, men vi låter variabeln ligga kvar ifall du vill använda på admin)
  const [title, setTitle] = useState("");
  const [riddle, setRiddle] = useState("");
  const [type, setType] = useState<"digit" | "code">("digit");

  const [timeLeft, setTimeLeft] = useState(0);
  const [totalTime, setTotalTime] = useState<number | null>(null);

  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const deadlineRef = useRef<Date | null>(null);
  const tickerRef = useRef<number | null>(null);

  async function load() {
    if (!teamId) {
      setError("Saknar teamId.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setFeedback(null);

    const res = await fetch(`/api/clue/current?teamId=${encodeURIComponent(teamId)}`, {
      cache: "no-store",
    });
    const data: CurrentResp = await res.json();

    if (!data.ok) {
      setError((data as any).error || "Kunde inte hämta ledtråd.");
      setLoading(false);
      return;
    }

    setStep(data.team.step);
    setTotal(data.team.total);

    if ("finished" in data && data.finished) {
      // Spelet klart
      setFinished(true);
      setLost(false);
      setTotalTime(data.totalTimeSec);
      deadlineRef.current = null;
      setTimeLeft(0);
      setLoading(false);
      return;
    }

    // Pågående ledtråd
    const d = data as Extract<CurrentResp, { ok: true; finished: false }>;
    setFinished(false);
    setLost(false);
    setTitle(d.clue.title);
    setRiddle(d.clue.riddle);
    setType(d.clue.type);

    // Se till att deadline ALDRIG kan "bli längre" (fix för reset till 5:00)
    const incoming = new Date(d.deadline);
    if (deadlineRef.current && incoming > deadlineRef.current) {
      // behåll den kortare (tidigare) deadlinen
      // (om backend skickar felaktigt för lång deadline)
    } else {
      deadlineRef.current = incoming;
    }

    const now = new Date();
    const tl = Math.max(0, Math.floor(((deadlineRef.current ?? incoming).getTime() - now.getTime()) / 1000));
    setTimeLeft(tl);

    setAnswer("");
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  useEffect(() => {
    // 1 Hz ticker
    tickerRef.current = window.setInterval(async () => {
      if (!deadlineRef.current) return;
      const now = new Date();
      const tl = Math.max(0, Math.floor((deadlineRef.current.getTime() - now.getTime()) / 1000));
      setTimeLeft(tl);

      // TIMEOUT => auto-förlust
      if (tl <= 0 && !finished) {
        setFinished(true);
        setLost(true);
        setFeedback(null);
        // Best effort: tala om för backend (ignorera ev 404)
        try {
          await fetch("/api/team/timeout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ teamId }),
          });
        } catch {}
      }
    }, 1000);

    return () => {
      if (tickerRef.current) clearInterval(tickerRef.current);
    };
  }, [finished, teamId]);

  async function submit() {
    if (!teamId || submitting || finished) return;
    if (!/^\d+$/.test(answer)) {
      setFeedback("Endast siffror tillåtna.");
      return;
    }
    setSubmitting(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/clue/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ teamId, answer }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data?.error === "cooldown") {
          setFeedback(`Vänta ${data.retryAfterSec ?? 1}s…`);
          return;
        }
        setFeedback(data?.error || "Fel vid inskick.");
        return;
      }

      if (data.result === "correct") {
        if (data.finished) {
          setFinished(true);
          setLost(false);
          setFeedback("🎉 Klart! Grymt jobbat.");
          await load();
        } else {
          setFeedback("✅ Rätt! Går vidare…");
          await load(); // deadline hålls via "min"-logiken i load()
        }
      } else if (data.result === "wrong") {
        setFeedback(`❌ Fel! −${data.penaltyAppliedSec}s och ${data.cooldownSec}s cooldown.`);
        await load(); // backend kan flytta deadline bakåt; vi plockar upp det
      } else if (data.result === "finished") {
        setFinished(true);
        setLost(false);
        await load();
      }
    } finally {
      setSubmitting(false);
      setAnswer("");
    }
  }

  function tap(n: number) {
    if (finished) return;
    if (type === "digit") setAnswer(String(n));
    else setAnswer((prev) => (prev + String(n)).slice(0, 8));
  }

  /* ---------------- UI ---------------- */
  return (
    <div className="page-bg min-h-dvh text-white">
      {/* header som på startsidan */}
      <header className="sticky top-0 z-20 border-b border-white/10 bg-black/40 backdrop-blur">
        <div className="container flex items-center justify-between">
          <div className="hero">
            <span className="badge">Glitter &amp; Glamour</span>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Escaperoom</h1>
          </div>
          {!finished && (
            <div className="pill text-2xl font-bold" aria-live="polite">
              {mmss(timeLeft)}
            </div>
          )}
        </div>
      </header>

      <main className="container">
        {/* Toppen "Ledtråd x/y" tas bort — flyttas in i första kortet */}

        {loading ? (
          <div className="card">Laddar…</div>
        ) : error ? (
          <div className="card" style={{ borderColor: "rgba(255,70,100,.4)", background: "rgba(255,70,100,.08)" }}>
            {error}
          </div>
        ) : finished ? (
          <section
            className="mx-auto max-w-2xl card"
            style={{
              borderColor: lost ? "rgba(255,70,100,.45)" : "rgba(16,185,129,.35)",
              background: lost ? "rgba(255,70,100,.10)" : "rgba(5,150,105,.20)",
            }}
          >
            <div className="text-5xl mb-3">{lost ? "⏱️" : "🎉"}</div>
            <h2 className="text-2xl sm:text-3xl font-semibold mb-2">
              {lost ? "Tiden är slut!" : "Klart! Grymt jobbat."}
            </h2>

            {!lost ? (
              <p className="text-base opacity-90 mb-6">
                Klar tid:{" "}
                <span className="text-3xl font-bold tabular-nums align-middle">
                  {humanTime(totalTime ?? 0)}
                </span>
              </p>
            ) : (
              <p className="text-base opacity-90 mb-6">
                Ni hann inte klart inom 5 minuter. Försök igen!
              </p>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {/* 4) Ta bort "Till startsidan" enligt önskemål */}
              <button
                onClick={() =>
                  navigator.clipboard?.writeText(
                    lost ? "Tiden tog slut." : `Klar tid: ${humanTime(totalTime ?? 0)}`
                  )
                }
                className="btn-primary"
              >
                📋 {lost ? "Kopiera meddelande" : "Kopiera klar tid"}
              </button>
            </div>
          </section>
        ) : (
          // === Två cards (gåta + keypad) ===
          <div className="two-col">
            {/* Card 1: Gåtan (utan title, med "Ledtråd x/y" i hörnet) */}
            <section className="card">
              <div className="mb-3 flex items-center gap-3">
                {/* Titel borttagen helt */}
                <span className="ml-auto rounded-full border border-white/10 px-2.5 py-0.5 text-xs opacity-75">
                  Ledtråd {Math.min(step + 1, Math.max(total, 1))}/{Math.max(total, 1)} ·{" "}
                  {type === "digit" ? "1 siffra" : "Kod"}
                </span>
              </div>
              <article className="space-y-2 leading-relaxed opacity-95">
                {riddle.split("\n").map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </article>
              {feedback ? (
                <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3 text-sm opacity-90">
                  {feedback}
                </div>
              ) : null}
            </section>

            {/* Card 2: Svar + keypad */}
            <section className="card">
              <label htmlFor="answer" className="mb-2 block text-sm opacity-80">
                Skriv in svaret
              </label>
              <input
                id="answer"
                inputMode="numeric"
                pattern="[0-9]*"
                value={answer}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "");
                  setAnswer(type === "digit" ? v.slice(0, 1) : v.slice(0, 8));
                }}
                className="input mb-5 w-full text-2xl tabular-nums"
                placeholder={type === "digit" ? "En siffra (0–9)" : "Kod (endast siffror)"}
                aria-label={type === "digit" ? "En siffra 0–9" : "Kod, endast siffror"}
              />

              {/* Keypad in-card */}
              <div className="mx-auto w-full max-w-xs sm:max-w-sm">
                <div className="grid grid-cols-3 gap-2">
                  {[1,2,3,4,5,6,7,8,9].map((n) => (
                    <button key={n} className="kbd" onClick={() => tap(n)}>{n}</button>
                  ))}
                  <button className="kbd" onClick={() => setAnswer((p) => p.slice(0, -1))}>⌫</button>
                  <button className="kbd" onClick={() => tap(0)}>0</button>
                  <button
                    className="kbd-primary"
                    disabled={submitting || answer.length === 0}
                    onClick={submit}
                    aria-label="Skicka svar"
                  >
                    ✅
                  </button>
                </div>
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
