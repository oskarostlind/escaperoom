"use client";

import { useEffect, useState } from "react";

type Run = {
  id: string;
  rank: number | null;
  teamName: string;
  participants: string | null;
  targetSec: number;
  startedAt: string | null;
  finishedAt: string | null;
  elapsedMs: number | null;
  diffMs: number | null;
};

function fmtDiff(ms: number | null) {
  if (ms == null) return "—";
  return `${ms >= 0 ? "+" : "−"}${(Math.abs(ms) / 1000).toFixed(2)} s`;
}

export default function TidAdmin() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/admin/tid", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Kunde inte hämta");
      setRuns(json.runs);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  async function remove(id: string) {
    await fetch(`/api/admin/tid?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    setConfirmId(null);
    load();
  }

  const f = filter.trim().toLowerCase();
  const shown = f
    ? runs.filter((r) => [r.teamName, r.participants || ""].join(" ").toLowerCase().includes(f))
    : runs;
  const finished = runs.filter((r) => r.finishedAt);
  const top3 = finished.slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Pallen */}
      <section className="rounded-xl border border-white/10 bg-black/20 p-4">
        <h2 className="mb-3 text-lg font-semibold">🏆 Pallen – Tidsspelet (närmast 60 s vinner)</h2>
        {top3.length === 0 ? (
          <div className="text-sm opacity-60">Inga avslutade försök ännu.</div>
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            {top3.map((r, i) => (
              <div
                key={r.id}
                className="rounded-lg border p-3"
                style={{ borderColor: i === 0 ? "rgba(245,200,66,.6)" : "rgba(255,255,255,.1)" }}
              >
                <div className="text-2xl">{["🥇", "🥈", "🥉"][i]}</div>
                <div className="font-bold text-lg">{r.teamName}</div>
                <div className="text-sm opacity-80">
                  {fmtDiff(r.diffMs)} · stoppade på {r.elapsedMs != null ? (r.elapsedMs / 1000).toFixed(2) : "?"} s
                </div>
                {r.participants && <div className="text-xs opacity-60 mt-1">{r.participants}</div>}
              </div>
            ))}
          </div>
        )}
        <div className="text-xs opacity-60 mt-3">
          {finished.length} avslutade · {runs.length - finished.length} påbörjade utan resultat
        </div>
      </section>

      {/* Lista */}
      <section className="rounded-xl border border-white/10 bg-black/20 p-4">
        <div className="flex flex-wrap items-end gap-3 mb-3">
          <h2 className="text-lg font-semibold flex-1">Alla försök</h2>
          <input
            className="rounded-md border border-white/10 bg-neutral-900 p-2 text-sm w-64"
            placeholder="Sök lag eller deltagare…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <button onClick={load} className="rounded-md border border-white/10 bg-neutral-900 px-3 py-2 text-sm">
            Uppdatera
          </button>
        </div>
        {error && <div className="text-sm text-red-400 mb-2">{error}</div>}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left opacity-70">
              <tr>
                <th className="py-2">#</th>
                <th>Lag</th>
                <th>Deltagare</th>
                <th>Avvikelse</th>
                <th>Stoppade på</th>
                <th>Kördes</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id} className="border-t border-white/5">
                  <td className="py-2 font-bold">{r.rank ?? "—"}</td>
                  <td className="font-semibold">{r.teamName}</td>
                  <td style={{ whiteSpace: "pre-wrap" }}>{r.participants || "—"}</td>
                  <td className="tabular-nums">{fmtDiff(r.diffMs)}</td>
                  <td className="tabular-nums">{r.elapsedMs != null ? (r.elapsedMs / 1000).toFixed(2) + " s" : "—"}</td>
                  <td>{r.startedAt ? new Date(r.startedAt).toLocaleTimeString("sv-SE") : "—"}</td>
                  <td>{r.finishedAt ? "Klar" : "Påbörjad"}</td>
                  <td className="text-right">
                    {confirmId === r.id ? (
                      <span className="inline-flex gap-1">
                        <button onClick={() => remove(r.id)} className="rounded border border-red-500/50 px-2 py-1 text-xs text-red-300">
                          Ta bort
                        </button>
                        <button onClick={() => setConfirmId(null)} className="rounded border border-white/10 px-2 py-1 text-xs">
                          Avbryt
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() => setConfirmId(r.id)}
                        className="rounded border border-white/10 px-2 py-1 text-xs opacity-70 hover:opacity-100"
                        title="Ta bort så laget kan köra igen"
                      >
                        Nollställ
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {shown.length === 0 && (
                <tr><td colSpan={8} className="py-4 opacity-60">Inga försök ännu.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
