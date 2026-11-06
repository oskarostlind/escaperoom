"use client";

import { useEffect, useMemo, useState } from "react";
import TidAdmin from "./TidAdmin";

type Tab = "escaperoom" | "tid";

type TeamRow = {
  id: string;
  teamName: string;
  participants?: string | null;
  createdAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  step?: number | null;
  totalClues?: number | null;
  wrongGuesses: number;
  timeLeftAtFinishSec?: number | null;
};

type OverviewResp = {
  ok: true;
  teams: TeamRow[];
};

type DatePreset = "all" | "today" | "yesterday" | "7d" | "thisweek" | "30d" | "custom";
type StatusFilter = "all" | "klar" | "ongoing" | "notstarted";

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("escaperoom");
  const [data, setData] = useState<OverviewResp | null>(null);
  const [filter, setFilter] = useState("");
  const [sortKey, setSortKey] = useState<keyof TeamRow>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // nya filterstates
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [rangeStart, setRangeStart] = useState<string>("");
  const [rangeEnd, setRangeEnd] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  async function load() {
    try {
      const res = await fetch("/api/admin/overview", { cache: "no-store" });
      if (!res.ok) {
        console.error("overview error:", await res.text().catch(() => ""));
        return;
      }
      const json = (await res.json()) as OverviewResp;
      if (json?.ok) setData(json);
    } catch (e) {
      console.error("overview fetch failed:", e);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function toggleExpand(id: string) {
    setExpanded((p) => ({ ...p, [id]: !p[id] }));
  }

  function fmtSecs(secs?: number | null) {
    if (secs == null) return "—";
    const s = Math.max(0, Math.floor(secs));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}m ${String(r).padStart(2, "0")}s`;
  }

  // helpers för datumfiltrering
  function getComparableDate(t: TeamRow): Date | null {
    // använd starttid om den finns, annars createdAt
    const iso = t.startedAt ?? t.createdAt ?? null;
    return iso ? new Date(iso) : null;
  }
  function startOfToday() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }
  function endOfToday() {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d;
  }
  function startOfYesterday() {
    const d = startOfToday();
    d.setDate(d.getDate() - 1);
    return d;
  }
  function endOfYesterday() {
    const d = endOfToday();
    d.setDate(d.getDate() - 1);
    return d;
  }
  function startOfThisWeekMonday() {
    const d = startOfToday();
    const day = d.getDay(); // 0=Sun..6=Sat
    const diff = (day + 6) % 7; // måndag=0
    d.setDate(d.getDate() - diff);
    return d;
  }
  function dateRangeForPreset(p: DatePreset): [Date | null, Date | null] {
    switch (p) {
      case "today":
        return [startOfToday(), endOfToday()];
      case "yesterday":
        return [startOfYesterday(), endOfYesterday()];
      case "7d": {
        const end = endOfToday();
        const start = new Date(end);
        start.setDate(start.getDate() - 6);
        start.setHours(0, 0, 0, 0);
        return [start, end];
      }
      case "thisweek": {
        const start = startOfThisWeekMonday();
        const end = endOfToday();
        return [start, end];
      }
      case "30d": {
        const end = endOfToday();
        const start = new Date(end);
        start.setDate(start.getDate() - 29);
        start.setHours(0, 0, 0, 0);
        return [start, end];
      }
      case "custom": {
        const s = rangeStart ? new Date(rangeStart + "T00:00:00") : null;
        const e = rangeEnd ? new Date(rangeEnd + "T23:59:59") : null;
        return [s, e];
      }
      default:
        return [null, null]; // "all"
    }
  }
  function inRange(d: Date | null, start: Date | null, end: Date | null) {
    if (!d) return false; // om ingen tid → exkludera i datumfilter
    if (start && d < start) return false;
    if (end && d > end) return false;
    return true;
  }

  const filteredTeams = useMemo(() => {
    if (!data) return [];
    const f = filter.trim().toLowerCase();
    let arr = data.teams;

    // textfilter
    if (f) {
      arr = arr.filter((t) =>
        [t.teamName, t.participants || ""].join(" ").toLowerCase().includes(f)
      );
    }

    // statusfilter
    if (statusFilter !== "all") {
      arr = arr.filter((t) => {
        const result = t.completedAt
          ? "klar"
          : t.startedAt
          ? "ongoing"
          : "notstarted";
        return result === statusFilter;
      });
    }

    // datumfilter
    const [start, end] = dateRangeForPreset(datePreset);
    if (start || end) {
      arr = arr.filter((t) => inRange(getComparableDate(t), start, end));
    }

    // sortering
    arr = [...arr].sort((a, b) => {
      const A = (a[sortKey] ?? "") as any;
      const B = (b[sortKey] ?? "") as any;
      if (A < B) return sortDir === "asc" ? -1 : 1;
      if (A > B) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [data, filter, sortKey, sortDir, datePreset, rangeStart, rangeEnd, statusFilter]);

  // Pallen: klara lag med mest tid kvar först; därefter ej klara efter antal lösta gåtor
  const escapeRanking = useMemo(() => {
    if (!data) return [];
    const done = data.teams
      .filter((t) => t.completedAt)
      .sort((a, b) => (b.timeLeftAtFinishSec ?? 0) - (a.timeLeftAtFinishSec ?? 0) || a.wrongGuesses - b.wrongGuesses);
    const rest = data.teams
      .filter((t) => !t.completedAt && t.startedAt)
      .sort((a, b) => (b.step ?? 0) - (a.step ?? 0) || a.wrongGuesses - b.wrongGuesses);
    return [...done, ...rest];
  }, [data]);

  // om presetet byts från custom -> nolla custom-fält för tydlighet
  useEffect(() => {
    if (datePreset !== "custom") {
      setRangeStart("");
      setRangeEnd("");
    }
  }, [datePreset]);

  return (
    <main className="min-h-screen p-6 space-y-8">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold">Admin</h1>
          <div className="inline-flex rounded-lg border border-white/10 overflow-hidden text-sm">
            <button
              onClick={() => setTab("escaperoom")}
              className={"px-4 py-2 " + (tab === "escaperoom" ? "bg-white/15 font-semibold" : "bg-neutral-900 opacity-70")}
            >
              🎃 Escaperoom
            </button>
            <button
              onClick={() => { setTab("tid"); }}
              className={"px-4 py-2 " + (tab === "tid" ? "bg-white/15 font-semibold" : "bg-neutral-900 opacity-70")}
            >
              ⏱️ Tidsspelet
            </button>
          </div>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            fetch("/api/admin/login", { method: "DELETE" }).then(
              () => (window.location.href = "/")
            );
          }}
        >
          <button className="rounded-md border border-white/10 bg-neutral-900 px-3 py-1.5">
            Logga ut
          </button>
        </form>
      </div>

      {tab === "tid" && <TidAdmin />}

      {tab === "escaperoom" && (
      <>
      {/* Pallen */}
      <section className="rounded-xl border border-white/10 bg-black/20 p-4">
        <h2 className="mb-3 text-lg font-semibold">🏆 Pallen – Escaperoom (mest tid kvar vinner)</h2>
        {escapeRanking.filter((t) => t.completedAt).length === 0 ? (
          <div className="text-sm opacity-60">Inget lag har gått i mål ännu.</div>
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            {escapeRanking.filter((t) => t.completedAt).slice(0, 3).map((t, i) => (
              <div
                key={t.id}
                className="rounded-lg border p-3"
                style={{ borderColor: i === 0 ? "rgba(245,200,66,.6)" : "rgba(255,255,255,.1)" }}
              >
                <div className="text-2xl">{["🥇", "🥈", "🥉"][i]}</div>
                <div className="font-bold text-lg">{t.teamName}</div>
                <div className="text-sm opacity-80">
                  {fmtSecs(t.timeLeftAtFinishSec)} kvar · {t.wrongGuesses} fel
                </div>
                {t.participants && <div className="text-xs opacity-60 mt-1">{t.participants}</div>}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Filter & sort */}
      <section className="rounded-xl border border-white/10 bg-black/20 p-4">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 items-end">
          {/* textfilter */}
          <div className="col-span-2">
            <label className="text-xs opacity-70">Filtrera</label>
            <input
              className="w-full rounded-md border border-white/10 bg-neutral-900 p-2"
              placeholder="Sök på gruppnamn eller deltagare…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>

          {/* status */}
          <div>
            <label className="text-xs opacity-70">Status</label>
            <select
              className="w-full rounded-md border border-white/10 bg-neutral-900 p-2"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            >
              <option value="all">Alla</option>
              <option value="klar">Klar</option>
              <option value="ongoing">Pågår/Timeout?</option>
              <option value="notstarted">Inte startad</option>
            </select>
          </div>

          {/* datum-preset */}
          <div>
            <label className="text-xs opacity-70">Datum</label>
            <select
              className="w-full rounded-md border border-white/10 bg-neutral-900 p-2"
              value={datePreset}
              onChange={(e) => setDatePreset(e.target.value as DatePreset)}
            >
              <option value="all">Alla datum</option>
              <option value="today">Idag</option>
              <option value="yesterday">Igår</option>
              <option value="7d">Senaste 7 dagarna</option>
              <option value="thisweek">Denna vecka (M–S)</option>
              <option value="30d">Senaste 30 dagarna</option>
              <option value="custom">Eget intervall…</option>
            </select>
          </div>

          {/* custom range */}
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs opacity-70">Från</label>
              <input
                type="date"
                disabled={datePreset !== "custom"}
                className="w-full rounded-md border border-white/10 bg-neutral-900 p-2 disabled:opacity-50"
                value={rangeStart}
                onChange={(e) => setRangeStart(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <label className="text-xs opacity-70">Till</label>
              <input
                type="date"
                disabled={datePreset !== "custom"}
                className="w-full rounded-md border border-white/10 bg-neutral-900 p-2 disabled:opacity-50"
                value={rangeEnd}
                onChange={(e) => setRangeEnd(e.target.value)}
              />
            </div>
          </div>

          {/* sortering */}
          <div>
            <label className="text-xs opacity-70">Sortera på</label>
            <select
              className="w-full rounded-md border border-white/10 bg-neutral-900 p-2"
              value={sortKey as string}
              onChange={(e) => setSortKey(e.target.value as keyof TeamRow)}
            >
              <option value="createdAt">Skapad</option>
              <option value="startedAt">Starttid</option>
              <option value="completedAt">Sluttid</option>
              <option value="teamName">Gruppnamn</option>
              <option value="wrongGuesses">Felgissningar</option>
              <option value="step">Steg</option>
              <option value="timeLeftAtFinishSec">Tid kvar när klar</option>
            </select>
          </div>
          <div>
            <label className="text-xs opacity-70">Riktning</label>
            <select
              className="w-full rounded-md border border-white/10 bg-neutral-900 p-2"
              value={sortDir}
              onChange={(e) => setSortDir(e.target.value as "asc" | "desc")}
            >
              <option value="desc">Fallande</option>
              <option value="asc">Stigande</option>
            </select>
          </div>

          <div className="flex gap-2">
            <button
              onClick={load}
              className="flex-1 rounded-md border border-white/10 bg-neutral-900 px-3 py-2"
            >
              Uppdatera
            </button>
            <button
              onClick={() => {
                setFilter("");
                setDatePreset("all");
                setRangeStart("");
                setRangeEnd("");
                setStatusFilter("all");
              }}
              className="flex-1 rounded-md border border-white/10 bg-neutral-900 px-3 py-2"
            >
              Rensa filter
            </button>
          </div>
        </div>
      </section>

      {/* Teams (read-only) */}
      <section className="rounded-xl border border-white/10 bg-black/20 p-4">
        <h2 className="mb-3 text-lg font-semibold">Grupper</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left opacity-70">
              <tr>
                <th className="py-2">Grupp</th>
                <th>Spelare</th>
                <th>Deltagare</th>
                <th>Start</th>
                <th>Tid kvar när klar</th>
                <th>Steg</th>
                <th>Felgissn.</th>
                <th>Resultat</th>
              </tr>
            </thead>

            <tbody>
              {filteredTeams.map((t) => {
                const members = (t.participants || "")
                  .split(/[,\n]/)
                  .map((s) => s.trim())
                  .filter(Boolean);
                const playersCount = members.length || 0;

                const result = t.completedAt
                  ? "Klar"
                  : t.startedAt
                  ? "Pågår/Timeout?"
                  : "Inte startad";

                return (
                  <tr key={t.id} className="border-top border-white/5">
                    <td className="py-2">
                      <button
                        className="underline decoration-dotted"
                        onClick={() => toggleExpand(t.id)}
                        title="Visa medlemmar"
                      >
                        {t.teamName}
                      </button>
                    </td>
                    <td>{playersCount}</td>
                    <td style={{ whiteSpace: "pre-wrap" }}>
                      {t.participants || "—"}
                    </td>
                    <td>
                      {t.startedAt
                        ? new Date(t.startedAt).toLocaleString()
                        : "—"}
                    </td>
                    <td>
                      {t.completedAt ? fmtSecs(t.timeLeftAtFinishSec) : "—"}
                    </td>
                    <td>
                      {t.step ?? 0}/{t.totalClues ?? "?"}
                    </td>
                    <td>{t.wrongGuesses}</td>
                    <td>{result}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Expanders med deltagare */}
        <div className="mt-3 space-y-3">
          {filteredTeams
            .filter((t) => expanded[t.id])
            .map((t) => {
              const members = (t.participants || "")
                .split(/[,\n]/)
                .map((s) => s.trim())
                .filter(Boolean);
              return (
                <div key={t.id} className="rounded-lg border border-white/10 p-3">
                  <div className="text-sm font-semibold opacity-80 mb-1">
                    Medlemmar i <span className="opacity-100">{t.teamName}</span>
                  </div>
                  {members.length ? (
                    <ul className="list-disc pl-5 text-sm space-y-0.5">
                      {members.map((m, i) => (
                        <li key={i}>{m}</li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-sm opacity-60">Inga registrerade namn.</div>
                  )}
                </div>
              );
            })}
        </div>
      </section>
      </>
      )}
    </main>
  );
}
