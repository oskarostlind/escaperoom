"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { TidAudio } from "./audio";

type State = "setup" | "ready" | "running" | "saving" | "result";
type Result = { teamName: string; elapsedMs: number; diffMs: number; targetSec: number };
type BoardRow = { teamName: string; diffMs: number };

const TARGET_SEC = 60;
const MIN_RUN_MS = 1000; // skydd mot dubbeltryck direkt efter start

const WORDS = ["3", "7", "12", "42", "99", "18", "25", "60", "nu!", "snart", "vänta", "stopp?", "⏳", "5", "8", "51", "33", "59", "61", "halvvägs"];
const SHOUTS = ["NU!", "60!", "STOPP!", "SNART…", "FÖR SENT?", "TIDEN ÄR UTE", "30 KVAR", "10 KVAR"];

export default function TidClient() {
  const sp = useSearchParams();
  const showBoard = sp.get("board") === "1";

  const [state, setState] = useState<State>("setup");
  const [teamName, setTeamName] = useState("");
  const [participants, setParticipants] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [board, setBoard] = useState<BoardRow[]>([]);

  const stateRef = useRef<State>("setup");
  const startTsRef = useRef(0);
  const runIdRef = useRef<Promise<string> | null>(null);
  const audioRef = useRef<TidAudio | null>(null);
  const distRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const cleanupRef = useRef<() => void>(() => {});

  function go(s: State) {
    stateRef.current = s;
    setState(s);
  }

  const loadBoard = useCallback(async () => {
    if (!showBoard) return;
    try {
      const r = await fetch("/api/tid/board", { cache: "no-store" });
      const j = await r.json();
      if (j?.ok) setBoard(j.board);
    } catch {}
  }, [showBoard]);

  useEffect(() => { loadBoard(); }, [loadBoard]);
  useEffect(() => { if (state === "setup") setTimeout(() => nameInputRef.current?.focus(), 50); }, [state]);

  // ---------- flöde ----------
  function continueToReady() {
    setErr(null);
    if (!teamName.trim()) { setErr("Ange ett lagnamn."); return; }
    go("ready");
  }

  function startRun() {
    // Tiden börjar mätas vid tangenttrycket; registrering sker parallellt.
    startTsRef.current = performance.now();
    go("running");
    audioRef.current = new TidAudio();
    try { audioRef.current.start(); } catch {}
    startDistraction();

    runIdRef.current = (async () => {
      const res = await fetch("/api/tid/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ teamName: teamName.trim(), participants: participants.trim() || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Kunde inte starta rundan.");
      return data.runId as string;
    })();

    // Om registreringen misslyckas (t.ex. laget har redan kört) – avbryt direkt.
    runIdRef.current.catch((e: any) => {
      if (stateRef.current !== "running") return;
      abortRun();
      setErr(e?.message || "Kunde inte starta rundan.");
      go("setup");
    });
  }

  function abortRun() {
    audioRef.current?.stop(); audioRef.current = null;
    stopDistraction();
  }

  async function stopRun() {
    const elapsedMs = performance.now() - startTsRef.current;
    if (elapsedMs < MIN_RUN_MS) return;
    abortRun();
    go("saving");
    try {
      const runId = await runIdRef.current!;
      const res = await fetch("/api/tid/finish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ runId, elapsedMs: Math.round(elapsedMs) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Kunde inte spara resultatet.");
      setResult({
        teamName: data.run.teamName,
        elapsedMs: data.run.elapsedMs,
        diffMs: data.run.diffMs,
        targetSec: data.run.targetSec,
      });
      go("result");
      loadBoard();
    } catch (e: any) {
      setErr(e?.message || "Något gick fel när resultatet skulle sparas.");
      go("setup");
    }
  }

  function nextTeam() {
    setTeamName(""); setParticipants(""); setErr(null); setResult(null);
    go("setup");
  }

  // ---------- tangentbord ----------
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const s = stateRef.current;
      if (e.code === "Space") {
        if (s === "ready" || s === "running") e.preventDefault();
        if (e.repeat) return;
        if (s === "ready") startRun();
        else if (s === "running") stopRun();
        return;
      }
      if (e.key === "Enter") {
        if (s === "result") { e.preventDefault(); nextTeam(); }
      }
      if (e.key === "Escape" && s === "ready") go("setup");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamName, participants]);

  // ---------- visuella störningar (nivå: kaos) ----------
  function startDistraction() {
    const dist = distRef.current;
    if (!dist) return;
    dist.innerHTML = "";
    let alive = true;
    let raf = 0;
    const timeouts: number[] = [];

    const fake = document.createElement("div"); fake.className = "faketimer"; dist.appendChild(fake);
    const pulse = document.createElement("div"); pulse.className = "pulse"; dist.appendChild(pulse);
    const flash = document.createElement("div"); flash.className = "flash"; dist.appendChild(flash);
    const shout = document.createElement("div"); shout.className = "shout"; dist.appendChild(shout);

    const palette: string[] = ["rgba(245,200,66,.65)", "rgba(56,189,248,.62)", "rgba(248,113,113,.58)", "rgba(74,222,128,.6)"];
    const floaters: HTMLDivElement[] = [];
    for (let i = 0; i < 38; i++) {
      const el = document.createElement("div");
      el.className = "floater";
      el.style.fontSize = 34 + Math.random() * 96 + "px";
      el.style.color = palette[(Math.random() * palette.length) | 0] ?? palette[0]!;
      el.textContent = WORDS[(Math.random() * WORDS.length) | 0] ?? "60";
      dist.appendChild(el);
      floaters.push(el);
      animFloater(el);
    }

    function animFloater(el: HTMLDivElement) {
      const vw = window.innerWidth, vh = window.innerHeight;
      const sx = Math.random() * vw, sy = vh + 60, ex = Math.random() * vw, ey = -80;
      const dur = ((3 + Math.random() * 4) * 1000) / 1.35;
      const t0 = performance.now();
      function step(now: number) {
        if (!alive) { el.style.opacity = "0"; return; }
        const k = Math.min(1, (now - t0) / dur);
        el.style.transform = `translate(${sx + (ex - sx) * k}px,${sy + (ey - sy) * k}px) rotate(${(k * 90 - 45) | 0}deg)`;
        el.style.opacity = (Math.sin(k * Math.PI) * 0.9).toFixed(2);
        if (k < 1) requestAnimationFrame(step);
        else { el.textContent = WORDS[(Math.random() * WORDS.length) | 0] ?? "60"; animFloater(el); }
      }
      requestAnimationFrame(step);
    }

    // falsk timer: fel hastighet + jitter + slumpade hopp, byter ibland riktning (räknar ner)
    let rate = 0.6;
    let mode: "up" | "down" = "up";
    const retune = () => {
      if (!alive) return;
      rate = [0.45, 0.6, 0.8, 1.0, 1.25, 1.6][(Math.random() * 6) | 0] ?? 0.6;
      mode = Math.random() < 0.3 ? "down" : "up";
      fake.classList.toggle("alt", Math.random() < 0.4);
      timeouts.push(window.setTimeout(retune, 4000 + Math.random() * 6000));
    };
    timeouts.push(window.setTimeout(retune, 5000));

    // skrik på skärmen
    const shoutLoop = () => {
      if (!alive) return;
      shout.textContent = SHOUTS[(Math.random() * SHOUTS.length) | 0] ?? "NU!";
      shout.style.transition = "opacity .15s";
      shout.style.opacity = "1";
      timeouts.push(window.setTimeout(() => { shout.style.opacity = "0"; }, 900 + Math.random() * 700));
      timeouts.push(window.setTimeout(shoutLoop, 4000 + Math.random() * 7000));
    };
    timeouts.push(window.setTimeout(shoutLoop, 7000 + Math.random() * 5000));

    // enstaka blixtar (max ~1/s i snitt, aldrig snabba serier)
    const flashLoop = () => {
      if (!alive) return;
      flash.style.background = "rgba(255,255,255,.35)";
      timeouts.push(window.setTimeout(() => { flash.style.background = "rgba(255,255,255,0)"; }, 90));
      timeouts.push(window.setTimeout(flashLoop, 2500 + Math.random() * 6000));
    };
    timeouts.push(window.setTimeout(flashLoop, 6000));

    function loop(now: number) {
      if (!alive) return;
      const real = (now - startTsRef.current) / 1000;
      const jitter = Math.sin(real * 7) * 0.4;
      let shown = Math.max(0, real * rate + jitter);
      if (mode === "down") shown = Math.max(0, TARGET_SEC - shown);
      if (Math.random() < 0.02) shown = Math.random() * TARGET_SEC;
      fake.textContent = shown.toFixed(Math.random() < 0.5 ? 1 : 2);
      pulse.style.opacity = (0.5 + 0.5 * Math.sin((now / 600) * Math.PI)).toFixed(3);
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);

    cleanupRef.current = () => {
      alive = false;
      cancelAnimationFrame(raf);
      timeouts.forEach(clearTimeout);
      dist.innerHTML = "";
    };
  }
  function stopDistraction() { cleanupRef.current(); cleanupRef.current = () => {}; }
  useEffect(() => () => { cleanupRef.current(); audioRef.current?.stop(); }, []);

  // ---------- render ----------
  const running = state === "running";
  const abs = result ? Math.abs(result.diffMs) / 1000 : 0;
  const cls = abs <= 1 ? "good" : abs <= 3 ? "mid" : "bad";
  const sign = result && result.diffMs >= 0 ? "+" : "−";

  return (
    <div className={"tid" + (running ? " running" : "")}>
      <div className="distraction" ref={distRef} />

      {showBoard && board.length > 0 && (
        <div className="board">
          <h3>🏆 Topplista</h3>
          {board.map((r, i) => (
            <div key={i} className={`lbrow rank${i + 1}`}>
              <span className="lbname">{i + 1}. {r.teamName}</span>
              <span className="lbdiff">{r.diffMs >= 0 ? "+" : "−"}{(Math.abs(r.diffMs) / 1000).toFixed(2)}s</span>
            </div>
          ))}
        </div>
      )}

      <div className="wrap">
        {state === "setup" && (
          <div className="card">
            <h1>⏱️ Tidsspelet</h1>
            <p className="sub">
              Starta klockan med <kbd>Mellanslag</kbd> och stoppa den när ni tror att <b>60 sekunder</b> gått –
              utan att se tiden. Närmast vinner. <b>Ett försök per lag.</b>
            </p>
            <ul className="rules">
              <li>Hela laget får hjälpas åt – men inga klockor, mobiler eller andra hjälpmedel.</li>
              <li>Allt ni ser och hör på skärmen är där för att lura er.</li>
            </ul>
            <form onSubmit={(e) => { e.preventDefault(); continueToReady(); }}>
              <label htmlFor="tidTeam">Lagnamn</label>
              <input
                id="tidTeam" ref={nameInputRef} type="text" placeholder="t.ex. Glitterbomberna"
                value={teamName} onChange={(e) => setTeamName(e.target.value)} maxLength={64} autoComplete="off"
              />
              <label htmlFor="tidPart">Deltagare (valfritt)</label>
              <input
                id="tidPart" type="text" placeholder="Anna, Bo, Carla"
                value={participants} onChange={(e) => setParticipants(e.target.value)} maxLength={256} autoComplete="off"
              />
              <button className="btn" type="submit">Fortsätt →</button>
            </form>
            {err && <div className="err">{err}</div>}
          </div>
        )}

        {(state === "ready" || state === "running" || state === "saving") && (
          <div className="card">
            <div className="playmsg">{state === "ready" ? teamName.trim() : state === "saving" ? "Sparar…" : "Räknar…"}</div>
            <div className="big">
              {state === "ready" ? "Tryck MELLANSLAG för att starta" : state === "saving" ? "⏳" : "👀"}
            </div>
            <div className="target-pill">Måltid: {TARGET_SEC} s</div>
            <p className="hint">
              {state === "ready"
                ? <>Räkna i huvudet. Tryck <kbd>Mellanslag</kbd> igen när ni tror att 60 sekunder gått. (<kbd>Esc</kbd> = tillbaka)</>
                : <>Tryck <kbd>Mellanslag</kbd> när ni tror att {TARGET_SEC} sekunder gått.</>}
            </p>
            {state === "ready" && (
              <button className="btn ghost" onClick={startRun} style={{ marginTop: 18 }}>Starta med knapp i stället</button>
            )}
          </div>
        )}

        {state === "result" && result && (
          <div className="card">
            <p className="sub" style={{ marginBottom: 10 }}>{result.teamName} – mål {result.targetSec} s</p>
            <div className={"diff " + cls}>{sign}{abs.toFixed(2)} s</div>
            <p className="statline">
              Ni stoppade på {(result.elapsedMs / 1000).toFixed(2)} s {result.diffMs >= 0 ? "(för sent)" : "(för tidigt)"}
            </p>
            <p className="foot">
              {abs <= 0.5 ? "🎯 Otroligt nära!" : abs <= 2 ? "👏 Riktigt bra tidskänsla." : "😅 Störningarna gjorde sitt."} Resultatet är sparat – vinnaren avslöjas vid prisutdelningen.
            </p>
            <button className="btn" onClick={nextTeam} style={{ marginTop: 24 }}>Nästa lag →</button>
            <p className="hint"><kbd>Enter</kbd> = nästa lag</p>
          </div>
        )}
      </div>

      <div className="corner">Tidsspelet · Varvet 10 år</div>
    </div>
  );
}
