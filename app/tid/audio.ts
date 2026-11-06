/**
 * Stressljud för Tidsspelet – allt syntetiseras med Web Audio (inga ljudfiler).
 *
 *  - Metronom som ljuger: börjar i 60 BPM (= sekunder) och driver sedan iväg,
 *    byter tempo, gör ritardando/accelerando, dubbelslag och plötsliga pauser.
 *  - Hjärtslag som accelererar under rundan.
 *  - Låg drone vars tonhöjd stiger sakta.
 *  - Slumpade stingers: larm-svep, "3-2-1"-pip som låter som att tiden är ute, dings.
 */
export class TidAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private timer: number | null = null;
  private running = false;
  private startAt = 0;

  // metronom
  private nextClick = 0;
  private bpm = 60;
  private bpmTarget = 60;
  private nextTempoChange = 0;
  private silentUntil = 0;

  // hjärtslag
  private nextBeat = 0;

  // stingers
  private nextStinger = 0;

  private drone: { o1: OscillatorNode; o2: OscillatorNode; g: GainNode } | null = null;

  start() {
    if (this.running) return;
    const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(this.ctx.destination);
    if (this.ctx.state === "suspended") this.ctx.resume();

    const t = this.ctx.currentTime;
    this.startAt = t;
    this.running = true;

    this.bpm = 60;
    this.bpmTarget = 60;
    this.nextClick = t + 0.05;
    this.nextTempoChange = t + 4 + Math.random() * 3; // ärlig i ~5 s, sen kaos
    this.silentUntil = 0;
    this.nextBeat = t + 0.4;
    this.nextStinger = t + 6 + Math.random() * 6;

    this.startDrone();
    this.timer = window.setInterval(() => this.schedule(), 25);
  }

  stop() {
    this.running = false;
    if (this.timer != null) { clearInterval(this.timer); this.timer = null; }
    if (this.ctx && this.master) {
      const t = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setValueAtTime(this.master.gain.value, t);
      this.master.gain.linearRampToValueAtTime(0, t + 0.15);
      const ctx = this.ctx;
      setTimeout(() => ctx.close().catch(() => {}), 400);
    }
    this.ctx = null; this.master = null; this.drone = null;
  }

  // ---- schemaläggare (lookahead 120 ms) ----
  private schedule() {
    if (!this.ctx || !this.master || !this.running) return;
    const now = this.ctx.currentTime;
    const ahead = now + 0.12;
    const elapsed = now - this.startAt;

    // tempoplan för metronomen
    if (now >= this.nextTempoChange) {
      const r = Math.random();
      if (r < 0.18) {
        // paus – tystnad som får en att tappa räkningen
        this.silentUntil = now + 1.5 + Math.random() * 2.5;
        this.nextTempoChange = this.silentUntil + 0.1;
      } else {
        // nytt måltempo, ibland nära 60 (lömskt), ibland långt ifrån
        this.bpmTarget = r < 0.45 ? 50 + Math.random() * 22 : 36 + Math.random() * 120;
        this.nextTempoChange = now + 3 + Math.random() * 6;
      }
    }
    // glid mot måltempo (ritardando/accelerando)
    this.bpm += (this.bpmTarget - this.bpm) * 0.08;

    // metronomklick
    while (this.nextClick < ahead) {
      const t = this.nextClick;
      if (t >= this.silentUntil) {
        this.click(t, Math.random() < 0.12 ? 1600 : 1100);
        if (Math.random() < 0.15) this.click(t + 0.11, 1400); // dubbelslag
      }
      this.nextClick += 60 / this.bpm;
    }

    // hjärtslag: 55 → 150 BPM under 60 s
    const hb = 55 + Math.min(1, elapsed / 60) * 95;
    while (this.nextBeat < ahead) {
      const t = this.nextBeat;
      this.thump(t, 0.9);
      this.thump(t + 0.16, 0.55);
      this.nextBeat += 60 / hb;
    }

    // drone stiger
    if (this.drone) {
      const f = 55 * Math.pow(2, Math.min(1, elapsed / 60) * 1.2);
      this.drone.o1.frequency.setTargetAtTime(f, now, 0.5);
      this.drone.o2.frequency.setTargetAtTime(f * 1.503, now, 0.5);
    }

    // stingers
    if (now >= this.nextStinger) {
      const r = Math.random();
      if (r < 0.35) this.countdownBeeps(now + 0.05);
      else if (r < 0.65) this.siren(now + 0.05);
      else this.ding(now + 0.05);
      this.nextStinger = now + 5 + Math.random() * 8;
    }
  }

  // ---- ljudbyggstenar ----
  private click(t: number, freq: number) {
    if (!this.ctx || !this.master) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "square";
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + 0.06);
  }

  private thump(t: number, vol: number) {
    if (!this.ctx || !this.master) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(90, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.18);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5 * vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + 0.25);
  }

  private startDrone() {
    if (!this.ctx || !this.master) return;
    const o1 = this.ctx.createOscillator();
    const o2 = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const lfo = this.ctx.createOscillator();
    const lfoG = this.ctx.createGain();
    o1.type = "sawtooth"; o2.type = "sawtooth";
    o1.frequency.value = 55; o2.frequency.value = 55 * 1.503;
    lfo.frequency.value = 0.35; lfoG.gain.value = 0.05;
    lfo.connect(lfoG).connect(g.gain);
    g.gain.value = 0.09;
    const filt = this.ctx.createBiquadFilter();
    filt.type = "lowpass"; filt.frequency.value = 420;
    o1.connect(filt); o2.connect(filt); filt.connect(g).connect(this.master);
    const t = this.ctx.currentTime;
    o1.start(t); o2.start(t); lfo.start(t);
    this.drone = { o1, o2, g };
  }

  private countdownBeeps(t: number) {
    if (!this.ctx || !this.master) return;
    // "pip pip pip PIIIP" – låter som att tiden är ute
    for (let i = 0; i < 3; i++) this.tone(t + i * 0.5, 880, 0.12, 0.3);
    this.tone(t + 1.5, 1320, 0.7, 0.35);
  }

  private siren(t: number) {
    if (!this.ctx || !this.master) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(500, t);
    o.frequency.linearRampToValueAtTime(1400, t + 0.6);
    o.frequency.linearRampToValueAtTime(500, t + 1.2);
    o.frequency.linearRampToValueAtTime(1400, t + 1.8);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.22, t + 0.05);
    g.gain.linearRampToValueAtTime(0.0001, t + 1.9);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + 2);
  }

  private ding(t: number) {
    this.tone(t, 2093, 0.9, 0.3, "sine");
    this.tone(t, 2637, 0.6, 0.12, "sine");
  }

  private tone(t: number, freq: number, dur: number, vol: number, type: OscillatorType = "square") {
    if (!this.ctx || !this.master) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
  }
}
