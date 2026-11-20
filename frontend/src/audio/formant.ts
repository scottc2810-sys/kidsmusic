// Melo's singing voice: a small formant ("source-filter") synthesiser, pure DSP with no Web Audio
// dependency so it can be unit-tested. It renders one sung or spoken syllable (Sa, Re, Ga, Dhin,
// Do, Mi ...) at an exact pitch, which browser text-to-speech cannot do.
//
// Model: a band-limited glottal sawtooth (plus a little breath) drives a cascade of formant
// resonators whose frequencies glide from the consonant's "locus" to the vowel; fricatives and
// stop bursts are filtered noise added in parallel.

export type Vowel = "a" | "e" | "i" | "o" | "u";
export interface Syllable { onset: string; vowel: Vowel; coda: string }

// Formant targets for a light, child-friendly voice (Hz): F1, F2, F3.
const VOWELS: Record<Vowel, [number, number, number]> = {
  a: [900, 1350, 2950], e: [520, 2250, 2950], i: [340, 2700, 3300], o: [520, 920, 2850], u: [390, 980, 2750],
};

type Kind = "fric" | "nasal" | "liquid" | "tap" | "stop";
interface Cons {
  kind: Kind; voiced: boolean; f: [number, number, number]; dur: number;
  noiseF?: number; noiseBW?: number; noiseAmp?: number; aspirated?: boolean;
}
const stop = (voiced: boolean, f: [number, number, number], noiseF: number, noiseBW: number, noiseAmp: number, aspirated = false): Cons =>
  ({ kind: "stop", voiced, f, dur: 0.045, noiseF, noiseBW, noiseAmp, aspirated });
const LABIAL: [number, number, number] = [300, 900, 2400];
const DENTAL: [number, number, number] = [300, 1600, 2700];
const VELAR: [number, number, number] = [300, 2200, 2500];
const CONS: Record<string, Cons> = {
  s: { kind: "fric", voiced: false, f: [320, 1700, 2700], dur: 0.11, noiseF: 6500, noiseBW: 2500, noiseAmp: 0.5 },
  sh: { kind: "fric", voiced: false, f: [320, 1900, 2600], dur: 0.11, noiseF: 3600, noiseBW: 1800, noiseAmp: 0.5 },
  f: { kind: "fric", voiced: false, f: [320, 1000, 2400], dur: 0.09, noiseF: 5500, noiseBW: 6000, noiseAmp: 0.16 },
  h: { kind: "fric", voiced: false, f: [500, 1500, 2600], dur: 0.07, noiseF: 1800, noiseBW: 3000, noiseAmp: 0.14 },
  m: { kind: "nasal", voiced: true, f: [280, 1000, 2400], dur: 0.08 },
  n: { kind: "nasal", voiced: true, f: [280, 1500, 2600], dur: 0.07 },
  l: { kind: "liquid", voiced: true, f: [360, 1150, 2700], dur: 0.07 },
  y: { kind: "liquid", voiced: true, f: [300, 2500, 3200], dur: 0.06 },
  w: { kind: "liquid", voiced: true, f: [320, 800, 2300], dur: 0.06 },
  v: { kind: "liquid", voiced: true, f: [320, 900, 2300], dur: 0.06 },
  r: { kind: "tap", voiced: true, f: [420, 1300, 1700], dur: 0.05 },
  b: stop(true, LABIAL, 900, 2500, 0.25), bh: stop(true, LABIAL, 900, 2500, 0.25, true),
  p: stop(false, LABIAL, 900, 2500, 0.4), ph: stop(false, LABIAL, 900, 2500, 0.4, true),
  d: stop(true, DENTAL, 3800, 2500, 0.35), dh: stop(true, DENTAL, 3800, 2500, 0.35, true),
  t: stop(false, DENTAL, 3800, 2500, 0.45), th: stop(false, DENTAL, 3800, 2500, 0.45, true),
  g: stop(true, VELAR, 2300, 1200, 0.4), gh: stop(true, VELAR, 2300, 1200, 0.4, true),
  k: stop(false, VELAR, 2300, 1200, 0.5), kh: stop(false, VELAR, 2300, 1200, 0.5, true),
  j: stop(true, [300, 2000, 2700], 3400, 2000, 0.4), ch: stop(false, [300, 2000, 2700], 3400, 2000, 0.5, true),
};

// Devanagari swars and tabla bols are sung with their open, long vowel (ग is sung "gaa").
const DEVANAGARI: [RegExp, string][] = [
  [/^सा?ं?$/, "sa"], [/^रें?$/, "re"], [/^गा?ं?$/, "ga"], [/^मा?ं?$/, "ma"], [/^पा?ं?$/, "pa"], [/^धा?ं?$/, "dha"], [/^न[िी]ं?$/, "ni"],
];
const VOWEL_OF: Record<string, Vowel> = { a: "a", aa: "a", e: "e", ee: "i", ay: "e", i: "i", o: "o", oo: "u", u: "u", ou: "o", ai: "e", au: "o" };

/** Split a syllable such as "Sa", "Dha", "Dhin", "Sol" or "ग" into onset consonant, vowel and coda. */
export function parseSyllable(text: string): Syllable {
  let s = text.trim().replace(/[.'’♭♯॒॑]|\((k|t)\)/g, "");
  for (const [re, lat] of DEVANAGARI) if (re.test(s)) { s = lat; break; }
  s = s.toLowerCase().replace(/[^a-z]/g, "");
  const m = /^(dh|bh|kh|gh|th|ph|ch|sh|[bcdfghjklmnprstvwyz])?([aeiouy]+)(ng|n|m|l|r)?$/.exec(s);
  if (!m) return { onset: "l", vowel: "a", coda: "" };
  const onset = m[1] === "c" ? "k" : m[1] === "z" ? "s" : m[1] ?? "";
  return { onset, vowel: VOWEL_OF[m[2]] ?? VOWEL_OF[m[2][0]] ?? "a", coda: m[3] === "ng" ? "n" : m[3] ?? "" };
}

export interface RenderOptions {
  /** Spoken recitation (tabla bols): a small falling pitch, no vibrato. Default: sung. */
  speech?: boolean;
}

const lerp = (a: number, b: number, x: number) => a + (b - a) * Math.max(0, Math.min(1, x));
/** Piecewise-linear envelope through [time, value] points. */
function env(points: [number, number][], t: number): number {
  if (t <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    if (t <= points[i][0]) {
      const [t0, v0] = points[i - 1];
      const [t1, v1] = points[i];
      return t1 > t0 ? v0 + ((v1 - v0) * (t - t0)) / (t1 - t0) : v1;
    }
  }
  return points[points.length - 1][1];
}

/** Two-pole resonator (Klatt): unity gain at DC, a peak at `f` with bandwidth `bw`. */
class Resonator {
  private a = 1; private b = 0; private c = 0; private y1 = 0; private y2 = 0;
  set(f: number, bw: number, sr: number) {
    const r = Math.exp(-Math.PI * bw / sr);
    this.c = -r * r;
    this.b = 2 * r * Math.cos((2 * Math.PI * Math.min(f, sr * 0.45)) / sr);
    this.a = 1 - this.b - this.c;
  }
  run(x: number) { const y = this.a * x + this.b * this.y1 + this.c * this.y2; this.y2 = this.y1; this.y1 = y; return y; }
}

/** Constant-peak band-pass (for fricative and burst noise). */
class BandPass {
  private b0 = 0; private a1 = 0; private a2 = 0; private x1 = 0; private x2 = 0; private y1 = 0; private y2 = 0;
  constructor(f: number, bw: number, sr: number) {
    const w = (2 * Math.PI * Math.min(f, sr * 0.45)) / sr;
    const alpha = Math.sin(w) / (2 * Math.max(0.3, f / bw));
    const a0 = 1 + alpha;
    this.b0 = alpha / a0; this.a1 = (-2 * Math.cos(w)) / a0; this.a2 = (1 - alpha) / a0;
  }
  run(x: number) {
    const y = this.b0 * (x - this.x2) - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

const CTRL = 32; // control-rate step (samples) for formant and envelope updates

/**
 * Render one syllable at `freq` Hz lasting `dur` seconds. Returns mono samples in -1..1.
 * Deterministic (seeded noise), so the same syllable always sounds the same.
 */
export function renderSyllable(text: string, freq: number, dur: number, sr: number, opts: RenderOptions = {}): Float32Array {
  const syl = parseSyllable(text);
  const n = Math.max(CTRL, Math.round(dur * sr));
  const total = n / sr;
  const V = VOWELS[syl.vowel];
  const C: Cons | undefined = CONS[syl.onset];
  const kind = C?.kind;

  // --- timeline (seconds) ---------------------------------------------------------------------
  const cDur = C ? Math.min(C.dur, total * 0.4) : 0;
  const burst = kind === "stop" ? 0.012 : 0;
  // when the vowel's voicing starts, and when the formants have reached the vowel
  const voiceOn = !C ? 0 : kind === "stop" ? cDur + burst + (C.voiced ? 0.004 : C.aspirated ? 0.05 : 0.016)
    : kind === "fric" ? Math.max(0, cDur - 0.015) : cDur;
  const glideEnd = voiceOn + (kind === "tap" ? 0.025 : 0.05);
  const codaLen = syl.coda ? Math.max(0.06, Math.min(0.12, total * 0.28)) : 0;
  const codaAt = total - codaLen;
  const codaF = syl.coda ? (CONS[syl.coda]?.f ?? CONS.n.f) : V;
  const release = Math.min(0.05, total * 0.25);

  // --- voiced amplitude -------------------------------------------------------------------------
  let av: [number, number][];
  if (!C) av = [[0, 0], [0.03, 1]];
  else if (kind === "nasal") av = [[0, 0], [0.015, 0.5], [cDur, 0.5], [cDur + 0.02, 1]];
  else if (kind === "liquid") av = [[0, 0], [0.015, 0.7], [cDur, 0.7], [cDur + 0.02, 1]];
  else if (kind === "tap") av = [[0, 0], [0.01, 0.7], [cDur * 0.4, 0.7], [cDur * 0.7, 0.3], [cDur + 0.02, 1]];
  else if (kind === "stop" && C.voiced) av = [[0, 0], [0.01, 0.22], [cDur + burst, 0.22], [voiceOn + (C.aspirated ? 0.06 : 0.025), 1]];
  else av = [[0, 0], [voiceOn, 0], [voiceOn + 0.03, 1]];
  if (syl.coda) av.push([codaAt, 1], [codaAt + 0.03, syl.coda === "l" || syl.coda === "r" ? 0.7 : 0.5]);
  av.push([total - release, av[av.length - 1][1]], [total, 0]);

  // --- noise amplitudes -----------------------------------------------------------------------
  const af: [number, number][] = kind === "fric" ? [[0, 0], [0.015, 1], [Math.max(0.016, cDur - 0.02), 1], [cDur + 0.005, 0]]
    : kind === "stop" ? [[cDur, 0], [cDur + 0.002, 1], [cDur + burst, 0.4], [cDur + burst + 0.008, 0]] : [[0, 0]];
  const ah: [number, number][] = C?.aspirated ? [[cDur + burst, 0], [cDur + burst + 0.008, 0.3], [cDur + burst + 0.05, 0.3], [cDur + burst + 0.07, 0.02]]
    : [[0, 0.02]];

  const r1 = new Resonator(), r2 = new Resonator(), r3 = new Resonator(), r4 = new Resonator();
  const noiseBP = C?.noiseF ? new BandPass(C.noiseF, C.noiseBW ?? 2000, sr) : null;
  const voiced = new Float32Array(n);
  const noise = new Float32Array(n);

  let seed = 0x2f6e2b1;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2147483648 - 1; };
  let phase = 0, glottal = 0, lastNoise = 0, f0 = freq, aV = 0, aF = 0, aH = 0;
  const lp = 1 - Math.exp((-2 * Math.PI * 2600) / sr); // soften the saw: a rounder, less buzzy voice

  for (let i = 0; i < n; i++) {
    if (i % CTRL === 0) {
      const t = i / sr;
      // pitch: a tiny scoop into the note, then gentle vibrato on long notes (sung); a small fall (spoken)
      if (opts.speech) f0 = freq * lerp(1.06, 0.94, t / total);
      else {
        const scoop = -35 * (1 - Math.min(1, Math.max(0, t - voiceOn) / 0.06));
        const depth = 14 * Math.min(1, Math.max(0, t - voiceOn - 0.3) / 0.3);
        f0 = freq * Math.pow(2, (scoop + depth * Math.sin(2 * Math.PI * 5.2 * t)) / 1200);
      }
      // formants: consonant locus -> vowel -> (coda)
      const x = C ? (t - (kind === "stop" || kind === "fric" ? voiceOn : cDur)) / Math.max(0.001, glideEnd - voiceOn) : 1;
      const y = syl.coda ? (t - codaAt) / 0.03 : 0;
      const start = C ? C.f : V;
      const f1 = lerp(lerp(start[0], Math.max(V[0], f0 * 1.02), x), codaF[0], y);
      const f2 = lerp(lerp(start[1], V[1], x), codaF[1], y);
      const f3 = lerp(lerp(start[2], V[2], x), codaF[2], y);
      const nasal = (kind === "nasal" && t < cDur) || (syl.coda === "n" || syl.coda === "m" ? y > 0.5 : false);
      r1.set(f1, nasal ? 80 : 90, sr);
      r2.set(f2, nasal ? 350 : 110, sr);
      r3.set(f3, nasal ? 450 : 170, sr);
      r4.set(3900, 300, sr);
      aV = env(av, t); aF = env(af, t); aH = env(ah, t);
    }
    // band-limited sawtooth (polyBLEP)
    const dt = f0 / sr;
    phase += dt;
    if (phase >= 1) phase -= 1;
    let saw = 2 * phase - 1;
    if (phase < dt) { const p = phase / dt; saw -= p + p - p * p - 1; }
    else if (phase > 1 - dt) { const p = (phase - 1) / dt; saw -= p * p + p + p + 1; }
    glottal += lp * (saw - glottal);
    const w = rand();
    const src = glottal * aV + w * aH * 0.5;
    voiced[i] = r4.run(r3.run(r2.run(r1.run(src))));
    if (noiseBP) { noise[i] = noiseBP.run(w - lastNoise) * aF; lastNoise = w; }
  }

  // Mix: the vowel sets the level; consonant noise is scaled relative to it.
  let pv = 1e-9, pn = 1e-9;
  for (let i = 0; i < n; i++) { pv = Math.max(pv, Math.abs(voiced[i])); pn = Math.max(pn, Math.abs(noise[i])); }
  const gv = 0.8 / pv;
  const gn = ((C?.noiseAmp ?? 0) * 0.6) / pn;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = Math.max(-1, Math.min(1, voiced[i] * gv + noise[i] * gn));
  return out;
}
