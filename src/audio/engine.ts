import { h } from "../dom";
import { ESSENTIAL, type Cue } from "./cues";

/**
 * Stadium sound, synthesised with Web Audio so the game ships no audio files.
 *
 * The bed is a Nigerian supporters' section: a roar of voices, a supporters' band (shekere shakers, congas, an agogo
 * bell, a dundun and a talking drum playing a highlife-style pattern in short phrases), plastic corneta horns and
 * hand claps, all swelling with the play. On top sit the pitch sounds (referee's whistle, boot on ball, tackles,
 * the upright) and crowd reactions (roar, groan, gasp, boo, applause, chant).
 */

// ---------------------------------------------------------------- preferences (shared by every match)

interface Prefs {
  muted: boolean;
  /** 0 to 1. */
  volume: number;
}
const KEY = "dominion:sound";

function loadPrefs(): Prefs {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<Prefs> | null;
    return { muted: raw?.muted === true, volume: typeof raw?.volume === "number" ? Math.min(1, Math.max(0, raw.volume)) : 0.7 };
  } catch {
    return { muted: false, volume: 0.7 };
  }
}
let prefs: Prefs = loadPrefs();
const listeners = new Set<() => void>();
export const soundPrefs = (): Readonly<Prefs> => prefs;
export function setSoundPrefs(p: Partial<Prefs>): void {
  prefs = { ...prefs, ...p };
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // storage unavailable: the choice lasts until the app closes
  }
  listeners.forEach((f) => f());
}

/** Mute button and volume slider for the match controls. */
export function soundControls(): HTMLElement {
  const btn = h("button", { class: "sound-btn", title: "Turn the stadium sound on or off" });
  const vol = h("input", { type: "range", min: "0", max: "100", step: "5", title: "Volume", class: "sound-vol" });
  const sync = () => {
    btn.textContent = prefs.muted || prefs.volume === 0 ? "🔇 Sound off" : "🔊 Sound";
    btn.classList.toggle("active", !prefs.muted && prefs.volume > 0);
    vol.value = String(Math.round(prefs.volume * 100));
    vol.disabled = prefs.muted;
  };
  btn.onclick = () => setSoundPrefs({ muted: !prefs.muted, ...(prefs.volume === 0 && prefs.muted ? { volume: 0.7 } : {}) });
  vol.oninput = () => setSoundPrefs({ volume: Number(vol.value) / 100 });
  listeners.add(sync);
  sync();
  return h("span", { class: "sound-controls" }, btn, vol);
}

// ---------------------------------------------------------------- the stadium

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
/** 16th-note length of the supporters' band: about 108 beats a minute. */
const STEP = 60 / 108 / 4;

export class StadiumAudio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private bed!: GainNode;
  private fx!: GainNode;
  private band!: GainNode;
  private noiseBuf!: AudioBuffer;
  private timer = 0;
  private nextTime = 0;
  private step = 0;
  private bar = 0;
  private bandBars = 0;
  private bandOn = false;
  private tension = 0;
  private surge = 0;
  private surgeRate = 0.1;
  private duckUntil = 0;
  private started = false;
  private paused = false;
  private skipping = false;
  private fading = false;
  private disposed = false;
  private speed = 1;
  private lastTick = 0;
  private readonly onPrefs = () => this.applyVolume();
  private readonly unlock = () => {
    if (this.ctx && this.ctx.state === "suspended" && !this.paused) void this.ctx.resume();
  };

  constructor(private readonly opts: { derby?: boolean } = {}) {}

  /** True where Web Audio exists (it does not in the test runner). */
  private get supported(): boolean {
    return typeof window !== "undefined" && typeof window.AudioContext !== "undefined";
  }

  // ---------------------------------------------------------------- lifecycle

  /** Opens the stadium: the crowd comes up and the band warms up. Safe to call more than once. */
  start(): void {
    if (this.started || this.disposed || !this.supported) return;
    this.started = true;
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.master = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);
    this.bed = ctx.createGain();
    this.bed.gain.value = 0;
    this.fx = ctx.createGain();
    this.band = ctx.createGain();
    this.band.gain.value = 0.55;
    this.bed.connect(this.master);
    this.fx.connect(this.master);
    this.band.connect(this.master);
    this.noiseBuf = pinkNoise(ctx, 4);
    this.buildBed();
    this.applyVolume(true);
    listeners.add(this.onPrefs);
    for (const t of ["pointerdown", "keydown", "touchstart"]) document.addEventListener(t, this.unlock, true);
    this.nextTime = ctx.currentTime + 0.15;
    this.lastTick = performance.now();
    this.timer = window.setInterval(() => this.tick(), 50);
    void ctx.resume().catch(() => undefined);
  }

  /** The match is paused: freeze every sound where it is. Only meaningful once the match has kicked off. */
  setPaused(p: boolean): void {
    this.paused = p;
    if (!this.ctx) return;
    if (p) void this.ctx.suspend().catch(() => undefined);
    else void this.ctx.resume().catch(() => undefined);
  }

  /** Skip to the end: the crowd drops to a murmur while the events fly past. */
  setSkipping(s: boolean): void {
    this.skipping = s;
  }

  setSpeed(s: number): void {
    this.speed = s;
  }

  /** 0 (midfield) to 1 (a try line): the crowd and the band lean in as play gets close. */
  setTension(t: number): void {
    this.tension = t;
  }

  /** Full time: the crowd keeps celebrating, then fades away over several seconds. */
  finish(): void {
    if (!this.ctx) return;
    this.fading = true;
    this.tension = 0;
    this.bandBars = 0;
    this.bandOn = false;
    const t = this.ctx.currentTime;
    this.bed.gain.cancelScheduledValues(t);
    this.bed.gain.setTargetAtTime(0, t + 4, 3);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (!this.started) return;
    window.clearInterval(this.timer);
    listeners.delete(this.onPrefs);
    for (const t of ["pointerdown", "keydown", "touchstart"]) document.removeEventListener(t, this.unlock, true);
    const ctx = this.ctx;
    if (!ctx) return;
    try {
      this.master.gain.setTargetAtTime(0, ctx.currentTime, 0.08);
    } catch {
      // the context was already closed
    }
    window.setTimeout(() => void ctx.close().catch(() => undefined), 400);
  }

  private applyVolume(snap = false): void {
    if (!this.ctx) return;
    const v = prefs.muted ? 0 : prefs.volume * prefs.volume * 0.9;
    if (snap) this.master.gain.value = v;
    else this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.04);
  }

  // ---------------------------------------------------------------- crowd bed

  private bedLevel!: GainNode;
  private voiceLevel!: GainNode;

  private buildBed(): void {
    const ctx = this.ctx!;
    const loop = (): AudioBufferSourceNode => {
      const s = ctx.createBufferSource();
      s.buffer = this.noiseBuf;
      s.loop = true;
      s.start(0, rnd(0, 3));
      return s;
    };
    // Roar of the terraces: broad band of noise, slowly breathing.
    const roar = ctx.createBiquadFilter();
    roar.type = "bandpass";
    roar.frequency.value = 650;
    roar.Q.value = 0.35;
    const roarLow = ctx.createBiquadFilter();
    roarLow.type = "lowpass";
    roarLow.frequency.value = 3200;
    this.bedLevel = ctx.createGain();
    this.bedLevel.gain.value = 1;
    loop().connect(roar).connect(roarLow).connect(this.bedLevel).connect(this.bed);
    const breath = ctx.createOscillator();
    breath.frequency.value = 0.11;
    const depth = ctx.createGain();
    depth.gain.value = 0.25;
    breath.connect(depth).connect(this.bedLevel.gain);
    breath.start();
    // Voices: two vowel-like resonances that drift, so the noise reads as thousands of people talking and singing.
    const v1 = ctx.createBiquadFilter();
    v1.type = "bandpass";
    v1.frequency.value = 520;
    v1.Q.value = 2.5;
    const v2 = ctx.createBiquadFilter();
    v2.type = "bandpass";
    v2.frequency.value = 1350;
    v2.Q.value = 3;
    this.voiceLevel = ctx.createGain();
    this.voiceLevel.gain.value = 0.55;
    const src = loop();
    src.connect(v1).connect(this.voiceLevel);
    src.connect(v2).connect(this.voiceLevel);
    this.voiceLevel.connect(this.bed);
    const drift = ctx.createOscillator();
    drift.frequency.value = 0.07;
    const driftDepth = ctx.createGain();
    driftDepth.gain.value = 160;
    drift.connect(driftDepth);
    driftDepth.connect(v1.frequency);
    driftDepth.connect(v2.frequency);
    drift.start();
  }

  // ---------------------------------------------------------------- clock: crowd level and the band

  private tick(): void {
    const ctx = this.ctx;
    if (!ctx || this.disposed) return;
    const now = performance.now();
    const dt = Math.min(0.25, (now - this.lastTick) / 1000);
    this.lastTick = now;
    if (this.paused) return;
    this.surge = Math.max(0, this.surge - this.surgeRate * dt);
    if (!this.fading) {
      const derby = this.opts.derby ? 1.25 : 1;
      let level = (0.3 + 0.35 * this.tension + this.surge * 0.9) * derby;
      if (ctx.currentTime < this.duckUntil) level *= 0.35;
      if (this.skipping) level *= 0.4;
      this.bed.gain.setTargetAtTime(level, ctx.currentTime, 0.2);
    }
    if (this.fading) return;
    if (this.skipping) {
      this.nextTime = Math.max(this.nextTime, ctx.currentTime + 0.1);
      return;
    }
    while (this.nextTime < ctx.currentTime + 0.2) {
      this.schedule(this.step, this.nextTime);
      this.nextTime += STEP * (this.step % 2 === 1 ? 1.12 : 0.88); // a light swing
      this.step = (this.step + 1) % 16;
      if (this.step === 0) this.nextBar();
    }
  }

  private nextBar(): void {
    this.bar++;
    if (this.bandBars > 0) this.bandBars--;
    const excited = this.surge > 0.25 || this.tension > 0.6;
    if (this.bandBars === 0) {
      // The band plays in phrases with gaps between, longer and more often when the match is hot.
      this.bandOn = excited || (!this.bandOn && Math.random() < 0.6);
      this.bandBars = this.bandOn ? Math.round(rnd(6, 14)) : Math.round(rnd(3, 7));
    } else if (excited && !this.bandOn) {
      this.bandOn = true;
      this.bandBars = 4;
    }
  }

  private energy(): number {
    return Math.min(1, 0.3 + this.tension * 0.35 + this.surge * 0.6) * (this.opts.derby ? 1.1 : 1);
  }

  /** One 16th of the band's pattern. Each instrument only joins above its own energy threshold. */
  private schedule(step: number, t: number): void {
    if (!this.bandOn) {
      if (step === 0 && Math.random() < 0.18) this.horn(t, rnd(0.4, 0.9), 0.35);
      return;
    }
    const e = this.energy();
    const accent = step % 4 === 0 ? 1 : step % 2 === 0 ? 0.75 : 0.5;
    this.shaker(t, 0.5 * accent);
    if ([0, 3, 6, 10, 12].includes(step) && e > 0.28) this.agogo(t, step % 6 === 0 ? 0 : 1, 0.7);
    if ([4, 12].includes(step) && e > 0.25) this.conga(t, 330, 0.8);
    if ([0, 6, 10, 11].includes(step) && e > 0.3) this.conga(t, 210, step === 0 ? 0.9 : 0.6);
    if ([0, 10].includes(step) && e > 0.4) this.dundun(t, 0.9);
    if ([4, 12].includes(step) && e > 0.55) this.clap(t, 0.7);
    if (step === 14 && this.bar % 4 === 3 && e > 0.45) this.talkingDrum(t, 0.8);
    if (step === 8 && e > 0.6 && Math.random() < 0.3) this.horn(t, rnd(0.4, 0.8), 0.5);
  }

  // ---------------------------------------------------------------- cues

  /** Plays cues relative to now. Does nothing before start(), while paused or skipping, or when muted. */
  play(cues: readonly Cue[]): void {
    const ctx = this.ctx;
    if (!ctx || this.paused || this.skipping || this.disposed || prefs.muted) return;
    const t0 = ctx.currentTime + 0.02;
    for (const c of cues) {
      if (this.speed >= 4 && !ESSENTIAL.has(c.name)) continue;
      const t = t0 + c.at / Math.max(1, this.speed >= 4 ? 2 : 1);
      const l = c.level;
      switch (c.name) {
        case "whistle": this.whistle(t, 0.5, l); break;
        case "whistleLong": this.whistle(t, 1.1, l); break;
        case "whistleDouble": this.whistle(t, 0.28, l); this.whistle(t + 0.4, 0.5, l); break;
        case "whistleFull": this.whistle(t, 0.35, l); this.whistle(t + 0.5, 0.35, l); this.whistle(t + 1, 1.2, l); break;
        case "kick": this.kick(t, l); break;
        case "tackle": this.tackle(t, l); break;
        case "post": this.post(t, l); break;
        case "roar": this.roar(t, l, 3.2); this.boost(0.9 * l, 6); break;
        case "cheer": this.roar(t, l * 0.8, 2.1); this.boost(0.55 * l, 4); break;
        case "applause": this.applause(t, l, 2.6); this.boost(0.25 * l, 3); break;
        case "groan": this.vowel(t, l, 1.3, 215, 150, [520, 980]); break;
        case "boo": this.vowel(t, l, 1.9, 135, 110, [330, 700]); break;
        case "gasp": this.gasp(t, l); break;
        case "hush": this.duckUntil = ctx.currentTime + c.at + 3.5; break;
        case "swell": this.swell(t, l); break;
        case "horns": this.horns(t, l); break;
        case "drumFill": this.drumFill(t, l); this.bandOn = true; this.bandBars = Math.max(this.bandBars, 6); break;
        case "chant": this.chant(t, l); break;
      }
    }
  }

  /** Lifts the crowd bed for a while: `amount` of surge, fading over `seconds`. */
  private boost(amount: number, seconds: number): void {
    this.surge = Math.min(1.2, this.surge + amount);
    this.surgeRate = Math.max(0.05, this.surge / seconds);
  }

  // ---------------------------------------------------------------- synth building blocks

  private noise(t: number, dur: number): AudioBufferSourceNode {
    const s = this.ctx!.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = true;
    s.start(t, rnd(0, 3));
    s.stop(t + dur + 0.05);
    return s;
  }

  /** A gain node with an attack/decay envelope, already connected to `dest`. */
  private env(t: number, attack: number, peak: number, hold: number, release: number, dest: AudioNode): GainNode {
    const g = this.ctx!.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.setValueAtTime(peak, t + attack + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
    g.connect(dest);
    return g;
  }

  private osc(type: OscillatorType, f0: number, f1: number, t: number, dur: number): OscillatorNode {
    const o = this.ctx!.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    o.start(t);
    o.stop(t + dur + 0.1);
    return o;
  }

  private filter(type: BiquadFilterType, f: number, q = 1): BiquadFilterNode {
    const b = this.ctx!.createBiquadFilter();
    b.type = type;
    b.frequency.value = f;
    b.Q.value = q;
    return b;
  }

  // ---------------------------------------------------------------- pitch sounds

  /** Referee's pea whistle: a bright tone with a fast warble. */
  private whistle(t: number, dur: number, level: number): void {
    const ctx = this.ctx!;
    const f = rnd(2850, 3050);
    const o = this.osc("sine", f * 0.96, f, t, 0.06);
    o.stop(t + dur + 0.1);
    const o2 = this.osc("triangle", f * 2.01, f * 2.01, t, dur);
    const trill = ctx.createGain();
    trill.gain.value = 0.7;
    const lfo = ctx.createOscillator();
    lfo.type = "square";
    lfo.frequency.value = 34;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 0.3;
    lfo.connect(lfoDepth).connect(trill.gain);
    lfo.start(t);
    lfo.stop(t + dur + 0.1);
    const g = this.env(t, 0.02, 0.2 * level, Math.max(0, dur - 0.08), 0.07, this.fx);
    const o2g = ctx.createGain();
    o2g.gain.value = 0.12;
    o.connect(trill);
    o2.connect(o2g).connect(trill);
    trill.connect(g);
    const breath = this.noise(t, dur);
    const bf = this.filter("highpass", 3500);
    const bg = this.env(t, 0.02, 0.03 * level, Math.max(0, dur - 0.08), 0.07, this.fx);
    breath.connect(bf).connect(bg);
  }

  /** Boot on ball: a low thump and a short slap. */
  private kick(t: number, level: number): void {
    const g = this.env(t, 0.002, 0.7 * level, 0.01, 0.16, this.fx);
    this.osc("sine", 170, 48, t, 0.14).connect(g);
    const slap = this.noise(t, 0.05);
    slap.connect(this.filter("lowpass", 2200)).connect(this.env(t, 0.001, 0.28 * level, 0.005, 0.04, this.fx));
  }

  /** A tackle: a body-weight thud with a rush of breath. */
  private tackle(t: number, level: number): void {
    const g = this.env(t, 0.004, 0.55 * level, 0.02, 0.22, this.fx);
    this.osc("sine", 110, 38, t, 0.2).connect(g);
    this.noise(t, 0.2).connect(this.filter("lowpass", 700)).connect(this.env(t, 0.003, 0.35 * level, 0.01, 0.16, this.fx));
    this.noise(t, 0.12).connect(this.filter("bandpass", 1600, 0.7)).connect(this.env(t, 0.003, 0.1 * level, 0.01, 0.08, this.fx));
  }

  /** The ball hits the upright: a short metallic ring. */
  private post(t: number, level: number): void {
    for (const [f, a] of [[610, 0.22], [1480, 0.14], [2650, 0.09], [4100, 0.05]] as const) {
      const o = this.osc("sine", f, f * 0.995, t, 1.3);
      o.connect(this.env(t, 0.001, a * level, 0.01, 1.2 / (f / 600), this.fx));
    }
    this.noise(t, 0.03).connect(this.filter("highpass", 2500)).connect(this.env(t, 0.001, 0.2 * level, 0, 0.03, this.fx));
  }

  // ---------------------------------------------------------------- crowd reactions

  /** A big shout: noise swelling through the vowels with a chorus of voices on top. */
  private roar(t: number, level: number, dur: number): void {
    const ctx = this.ctx!;
    const n = this.noise(t, dur + 2);
    const bp = this.filter("bandpass", 500, 0.6);
    bp.frequency.setValueAtTime(450, t);
    bp.frequency.linearRampToValueAtTime(1100, t + dur * 0.35);
    bp.frequency.linearRampToValueAtTime(700, t + dur + 1.2);
    n.connect(bp).connect(this.env(t, 0.22, 0.75 * level, dur * 0.5, dur * 0.5 + 1.2, this.fx));
    const hiss = this.filter("highpass", 2400);
    this.noise(t, dur + 2).connect(hiss).connect(this.env(t, 0.3, 0.14 * level, dur * 0.4, dur * 0.5 + 1, this.fx));
    // "Aaaah": detuned sawtooth voices through two formants.
    const chorus = ctx.createGain();
    chorus.gain.value = 1;
    const f1 = this.filter("bandpass", 700, 4);
    const f2 = this.filter("bandpass", 1150, 5);
    chorus.connect(f1);
    chorus.connect(f2);
    const vg = this.env(t, 0.3, 0.17 * level, dur * 0.45, dur * 0.5 + 0.8, this.fx);
    f1.connect(vg);
    f2.connect(vg);
    for (let i = 0; i < 7; i++) {
      const base = rnd(150, 300);
      const o = this.osc("sawtooth", base, base * rnd(1.05, 1.2), t, dur * 0.4);
      o.frequency.exponentialRampToValueAtTime(base * rnd(0.85, 1.05), t + dur + 1.2);
      o.stop(t + dur + 1.4);
      o.connect(chorus);
    }
  }

  /** Falling "ooooh": a few voices dropping in pitch through two formants. */
  private vowel(t: number, level: number, dur: number, hi: number, lo: number, formants: [number, number]): void {
    const mix = this.ctx!.createGain();
    const g = this.env(t, 0.18, 0.2 * level, dur * 0.3, dur * 0.7, this.fx);
    for (const f of formants) mix.connect(this.filter("bandpass", f, 4)).connect(g);
    for (let i = 0; i < 6; i++) {
      const k = rnd(0.9, 1.15);
      const o = this.osc("sawtooth", hi * k, lo * k, t, dur);
      const vib = this.ctx!.createOscillator();
      vib.frequency.value = rnd(4.5, 6.5);
      const vd = this.ctx!.createGain();
      vd.gain.value = hi * 0.02;
      vib.connect(vd).connect(o.frequency);
      vib.start(t);
      vib.stop(t + dur + 0.1);
      o.connect(mix);
    }
    this.noise(t, dur).connect(this.filter("bandpass", 600, 0.7)).connect(this.env(t, 0.15, 0.09 * level, dur * 0.3, dur * 0.7, this.fx));
  }

  /** A sharp intake of breath rising to a short "ooh!". */
  private gasp(t: number, level: number): void {
    const n = this.noise(t, 0.7);
    const hp = this.filter("bandpass", 1800, 0.8);
    hp.frequency.setValueAtTime(1200, t);
    hp.frequency.linearRampToValueAtTime(2600, t + 0.45);
    n.connect(hp).connect(this.env(t, 0.35, 0.28 * level, 0.05, 0.3, this.fx));
    this.vowel(t + 0.25, level * 0.5, 0.7, 330, 300, [450, 900]);
  }

  /** Applause: lots of tiny claps at random moments. */
  private applause(t: number, level: number, dur: number): void {
    const bus = this.env(t, 0.4, 0.5 * level, dur * 0.6, dur * 0.5, this.fx);
    const n = Math.round(dur * 55);
    for (let i = 0; i < n; i++) {
      const at = t + rnd(0, dur);
      const g = this.ctx!.createGain();
      g.gain.setValueAtTime(rnd(0.2, 0.7), at);
      g.gain.exponentialRampToValueAtTime(0.001, at + 0.018);
      g.connect(bus);
      this.noise(at, 0.02).connect(this.filter("bandpass", rnd(1400, 3200), 1.2)).connect(g);
    }
  }

  /** The crowd drawing breath as an attack builds. */
  private swell(t: number, level: number): void {
    this.noise(t, 2.2).connect(this.filter("bandpass", 900, 0.5)).connect(this.env(t, 1.8, 0.28 * level, 0.1, 0.5, this.fx));
    this.boost(0.18 * level, 3);
  }

  // ---------------------------------------------------------------- the band and the horns

  /** A vuvuzela-style plastic horn: a buzzy, nasal tone near B-flat. */
  private horn(t: number, dur: number, level: number, pitch = 233): void {
    const mix = this.ctx!.createGain();
    const lp = this.filter("lowpass", 1700);
    const peak = this.filter("peaking", pitch * 5, 1.5);
    peak.gain.value = 8;
    mix.connect(peak).connect(lp).connect(this.env(t, 0.06, 0.16 * level, dur, 0.1, this.band));
    for (const d of [1, 1.006, 0.994]) {
      const o = this.osc("sawtooth", pitch * d * 0.98, pitch * d, t, 0.08);
      o.stop(t + dur + 0.25);
      const trem = this.ctx!.createOscillator();
      trem.frequency.value = 9;
      const td = this.ctx!.createGain();
      td.gain.value = pitch * 0.004;
      trem.connect(td).connect(o.frequency);
      trem.start(t);
      trem.stop(t + dur + 0.25);
      o.connect(mix);
    }
  }

  /** Several corneta horns, a little out of tune with each other, blowing at slightly different moments. */
  private horns(t: number, level: number): void {
    const n = 3 + Math.round(level);
    for (let i = 0; i < n; i++) this.horn(t + rnd(0, 0.4), rnd(0.7, 1.5), level * 0.8, 233 * rnd(0.97, 1.09));
  }

  /** Shekere: a beaded gourd, a bright "tsss" of noise. */
  private shaker(t: number, level: number): void {
    this.noise(t, 0.08).connect(this.filter("highpass", 5500)).connect(this.env(t, 0.008, 0.07 * level, 0.01, 0.05, this.band));
  }

  /** Agogo bell: two metallic notes, high and low. */
  private agogo(t: number, hi: number, level: number): void {
    const f = hi ? 1180 : 790;
    for (const [m, a] of [[1, 0.1], [2.76, 0.05]] as const) this.osc("square", f * m, f * m, t, 0.2).connect(this.filter("bandpass", f * m, 5)).connect(this.env(t, 0.001, a * level, 0, 0.18, this.band));
  }

  /** Conga: a pitched skin hit that drops quickly, with a slap. */
  private conga(t: number, f: number, level: number): void {
    this.osc("sine", f * 1.35, f, t, 0.05).connect(this.env(t, 0.002, 0.3 * level, 0.01, 0.2, this.band));
    this.noise(t, 0.04).connect(this.filter("bandpass", 2200, 1)).connect(this.env(t, 0.001, 0.08 * level, 0, 0.04, this.band));
  }

  /** Dundun: the deep bass drum of the band. */
  private dundun(t: number, level: number): void {
    this.osc("sine", 95, 55, t, 0.3).connect(this.env(t, 0.003, 0.5 * level, 0.02, 0.35, this.band));
    this.noise(t, 0.03).connect(this.filter("lowpass", 900)).connect(this.env(t, 0.001, 0.15 * level, 0, 0.03, this.band));
  }

  /** Hand clap. */
  private clap(t: number, level: number): void {
    for (let i = 0; i < 3; i++) {
      const at = t + i * 0.011;
      this.noise(at, 0.04).connect(this.filter("bandpass", 1500, 0.9)).connect(this.env(at, 0.001, 0.14 * level, 0, 0.05, this.band));
    }
  }

  /** Talking drum: a squeezed skin whose pitch bends up and back. */
  private talkingDrum(t: number, level: number): void {
    const o = this.osc("triangle", 190, 190, t, 0.5);
    o.frequency.exponentialRampToValueAtTime(330, t + 0.12);
    o.frequency.exponentialRampToValueAtTime(240, t + 0.32);
    o.frequency.exponentialRampToValueAtTime(420, t + 0.45);
    o.connect(this.env(t, 0.004, 0.32 * level, 0.1, 0.35, this.band));
  }

  /** A celebratory drum roll that speeds up, ending on the dundun. */
  private drumFill(t: number, level: number): void {
    let at = t;
    let gap = 0.16;
    for (let i = 0; i < 12; i++) {
      this.conga(at, i % 2 ? 330 : 240, (0.6 + i / 30) * level);
      if (i % 3 === 0) this.shaker(at, level);
      at += gap;
      gap = Math.max(0.055, gap * 0.88);
    }
    this.dundun(at, level);
    this.clap(at, level);
    this.talkingDrum(at + 0.1, level * 0.8);
  }

  /** A sung chant, "O-lé, o-lé, o-lé": the terraces answering the band. */
  private chant(t: number, level: number): void {
    const notes = [262, 262, 330, 294, 262, 330, 392];
    const lens = [0.28, 0.28, 0.4, 0.28, 0.28, 0.28, 0.7];
    let at = t;
    notes.forEach((f, i) => {
      const mix = this.ctx!.createGain();
      const g = this.env(at, 0.03, 0.13 * level, lens[i] * 0.7, 0.14, this.fx);
      mix.connect(this.filter("bandpass", i % 2 ? 800 : 600, 3)).connect(g);
      mix.connect(this.filter("bandpass", 1500, 4)).connect(g);
      for (let v = 0; v < 5; v++) this.osc("sawtooth", f * rnd(0.985, 1.015), f * rnd(0.985, 1.015), at, lens[i] + 0.15).connect(mix);
      at += lens[i] + 0.04;
    });
    this.bandOn = true;
    this.bandBars = Math.max(this.bandBars, 4);
  }
}

/** Pink-ish noise (Paul Kellet's filter), which sounds more natural than white for a crowd. */
function pinkNoise(ctx: AudioContext, seconds: number): AudioBuffer {
  const buf = ctx.createBuffer(1, Math.round(ctx.sampleRate * seconds), ctx.sampleRate);
  const d = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < d.length; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856;
    b4 = 0.55 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.016898;
    d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
    b6 = w * 0.115926;
  }
  return buf;
}
