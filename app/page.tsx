// app/page.tsx
"use client";

import { useState } from "react";

export default function Home() {
  const [teamName, setTeamName] = useState("");
  const [participants, setParticipants] = useState(""); // NEW
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function startGame() {
    setErr(null);
    if (!accepted) {
      setErr("Du måste godkänna reglerna först.");
      return;
    }
    if (!teamName.trim()) {
      setErr("Ange ett lagnamn.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/team/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          teamName: teamName.trim(),
          participants: participants.trim() || null, // NEW
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Något gick fel. Försök igen.");
      }

      window.location.href = `/play?team=${encodeURIComponent(data.teamId)}`;
    } catch (e: any) {
      setErr(e.message || "Något gick fel. Försök igen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="container">
      <div className="hero">
        <span className="ghost">✨</span>
        <div>
          <div className="badge">Glitter &amp; Glamour · Varvet 10 år</div>
          <h1>Hinner ni ut innan festen börjar?</h1>
          <div className="note">5 minuter. En siffra per gåta. Noll nåd.</div>
        </div>
      </div>

      <div className="two-col">
        <section className="card">
          <h2>Regler & Info</h2>
          <ul className="rules">
            <li><strong>Tid:</strong> 5 minuter.</li>
            <li><strong>Fel siffra:</strong> –30 sek + 3 sek cooldown.</li>
            <li><strong>Flöde:</strong> En ledtråd åt gången. Rätt siffra låser upp nästa.</li>
            <li><strong>Säkerhet:</strong> Max 4 i bastun. Rör inte aggregatet. Rör inget utan ikon.</li>
            <li><strong>Integritet:</strong> Vi loggar lag, start/slut, fel och tider för statistik.</li>
          </ul>

          <div className="callout">
            Tips: Välj ett unikt lagnamn så vi kan spara er runda.
          </div>
        </section>

        <section className="card">
          <h2>Starta runda</h2>

          <div className="field">
            <label htmlFor="team">Lagnamn</label>
            <input
              id="team"
              className="input"
              placeholder="Ex. Glitterbomberna"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              maxLength={64}
              autoComplete="off"
            />
          </div>

          {/* NEW: Deltagare */}
          <div className="field">
            <label htmlFor="participants">Deltagare</label>
            <input
              id="participants"
              className="input"
              placeholder="Ex. Anna, Bo, Carla"
              value={participants}
              onChange={(e) => setParticipants(e.target.value)}
              maxLength={256}
              autoComplete="off"
            />
          </div>

          <label className="checkbox">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
            />
            Vi har läst och godkänner reglerna.
          </label>

          <div className="actions">
            <button className="button" disabled={busy} onClick={startGame}>
              {busy ? "Startar..." : "Starta"}
            </button>
          </div>

          {err && (
            <div className="callout error" role="alert" style={{ marginTop: 12 }}>
              {err}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
