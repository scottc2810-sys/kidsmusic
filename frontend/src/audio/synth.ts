// Small Web Audio synthesiser: piano, harmonium, flute, guitar, sitar, violin, santoor, xylophone,
// kalimba, tabla, drum and bell timbres + sequencing, teacher sound effects (clap, sparkle ...), plus Melo's
// singing voice (formant.ts) so the teacher can sing Sa Re Ga at the right pitch.
// Also exposes `isBusy()` so microphone input can ignore our own speaker output.
import { renderSyllable } from "./formant";
import { pulseMouth } from "./mouth";

export type Timbre = "piano" | "flute" | "drum" | "bell" | "guitar" | "harmonium" | "violin" | "sitar" | "santoor" | "xylophone" | "kalimba" | "tabla";
/** Every instrument Melo can play, in the order they are shown to a child. */
export const ALL_TIMBRES: Timbre[] = ["piano", "harmonium", "flute", "guitar", "violin", "sitar", "santoor", "xylophone", "kalimba", "tabla", "drum", "bell"];

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let busyUntil = 0;

export function audioContext(): AudioContext {
  if (!ctx) {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.8;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp).connect(ctx.destination);
  }
  return ctx;
}

/** Must be called from a user gesture at least once (browser autoplay policy). */
export async function unlockAudio(): Promise<void> {
  const c = audioContext();
  if (c.state !== "running") await c.resume().catch(() => {});
}

/** Wake the context if the browser suspended it (autoplay policy, tab sleep, device change). */
function ensureRunning(c: AudioContext) {
  if (c.state !== "running") void c.resume().catch(() => {});
}

/**
 * Unlock sound on the first tap/key anywhere in the app, so every page (free play, reloads,
 * deep links) has working audio, not only the ones that call unlockAudio() themselves.
 */
export function installAudioUnlock(onUnlock?: () => void): void {
  if (typeof window === "undefined") return;
  const handler = () => {
    void unlockAudio().then(() => { if (audioContext().state === "running") remove(); });
    onUnlock?.();
  };
  const events = ["pointerdown", "keydown", "touchend"] as const;
  const remove = () => events.forEach((e) => window.removeEventListener(e, handler, true));
  events.forEach((e) => window.addEventListener(e, handler, true));
}

export const audioState = (): AudioContextState | "none" => (ctx ? ctx.state : "none");

// --- Teacher's instrument and tuning (per device, set by the parent) -------------------------------
export type Tuning = "equal" | "pure";
// Pure (just) intonation offsets in cents from Sa = C: the sweet Ga, Dha and Ni of Indian music.
// "equal" matches a piano or electronic keyboard exactly, so it is the default for keyboard lessons.
const PURE_CENTS = [0, 12, 4, 16, -14, -2, -10, 2, 14, -16, 18, -12];
const pref = (k: string, d: string) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const savePref = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };
let tuning = pref("melo.tuning", "equal") as Tuning;
let teacherTimbre = pref("melo.instrument", "piano") as Timbre;
export const getTuning = () => tuning;
export function setTuning(t: Tuning) { tuning = t; savePref("melo.tuning", t); }
/** The instrument Melo demonstrates on (piano, harmonium, flute ...). */
export const getTeacherTimbre = () => teacherTimbre;
export function setTeacherTimbre(t: Timbre) { teacherTimbre = t; savePref("melo.instrument", t); }

export const midiToFreq = (m: number) =>
  440 * Math.pow(2, (m - 69) / 12) * (tuning === "pure" ? Math.pow(2, PURE_CENTS[((Math.round(m) % 12) + 12) % 12] / 1200) : 1);

function markBusy(endTime: number) {
  const c = audioContext();
  busyUntil = Math.max(busyUntil, performance.now() + (endTime - c.currentTime) * 1000 + 250);
}

/** True while (or shortly after) the app itself is making sound. */
export const isBusy = () => performance.now() < busyUntil;

function noiseBuffer(c: AudioContext, seconds: number): AudioBuffer {
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * seconds), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

// --- Plucked strings (Karplus-Strong): a burst of noise circulating in a delay line that loses its high
// end on every pass sounds like a real string. Rendered once per (instrument, note) and cached.
const pluckCache = new Map<string, { buf: AudioBuffer; rate: number }>();
function pluck(c: AudioContext, f: number, kind: "guitar" | "sitar"): { buf: AudioBuffer; rate: number } {
  const key = `${kind}|${Math.round(f * 100)}|${c.sampleRate}`;
  const hit = pluckCache.get(key);
  if (hit) return hit;
  const sr = c.sampleRate;
  const seconds = kind === "sitar" ? 2.6 : 1.8;
  const N = Math.max(2, Math.round(sr / f));
  const ring = new Float32Array(N);
  for (let i = 0; i < N; i++) ring[i] = Math.random() * 2 - 1;
  // a softer pluck for guitar (finger), brighter for sitar (wire plectrum)
  if (kind === "guitar") for (let i = 1; i < N; i++) ring[i] = 0.5 * (ring[i] + ring[i - 1]);
  const out = new Float32Array(Math.floor(sr * seconds));
  const decay = kind === "sitar" ? 0.9985 : 0.996;
  let idx = 0;
  for (let i = 0; i < out.length; i++) {
    const a = ring[idx], b = ring[(idx + 1) % N];
    let x = a;
    if (kind === "sitar") x = Math.tanh(a * 2.4) * 0.6 + a * 0.4; // jawari: the bridge buzz that makes a sitar shimmer
    out[i] = x;
    ring[idx] = decay * 0.5 * (a + b);
    idx = (idx + 1) % N;
  }
  const buf = c.createBuffer(1, out.length, sr);
  buf.getChannelData(0).set(out);
  // the averaging filter adds half a sample of delay: correct the pitch exactly with the playback rate
  const v = { buf, rate: f / (sr / (N + 0.5)) };
  if (pluckCache.size > 200) pluckCache.clear();
  pluckCache.set(key, v);
  return v;
}

export function playNote(midi: number, opts: { timbre?: Timbre; gain?: number; duration?: number; at?: number; dest?: AudioNode } = {}): number {
  const c = audioContext();
  ensureRunning(c);
  const out = opts.dest ?? master!;
  const timbre = opts.timbre ?? teacherTimbre;
  const g = Math.max(0.0001, opts.gain ?? 0.7);
  const t0 = opts.at ?? c.currentTime + 0.01;
  const dur = opts.duration ?? 0.6;
  const f = midiToFreq(midi);
  const env = c.createGain();
  env.connect(out);
  let end = t0 + dur;

  const osc = (type: OscillatorType, freq: number, gain: number, detune = 0) => {
    const o = c.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    o.detune.value = detune;
    const og = c.createGain();
    og.gain.value = gain;
    o.connect(og).connect(env);
    o.start(t0);
    return o;
  };

  switch (timbre) {
    case "piano": {
      // A struck string: bright at the hammer, then mellowing as it rings; slightly stretched
      // partials, two strings a hair apart, and a soft hammer thump. Low notes ring longer.
      const ring = Math.max(0.9, 2.6 - (midi - 48) * 0.035);
      end = t0 + Math.max(dur, 0.25) + ring * 0.5;
      const tone = c.createBiquadFilter();
      tone.type = "lowpass";
      tone.frequency.setValueAtTime(Math.min(12000, f * (6 + g * 8)), t0);
      tone.frequency.exponentialRampToValueAtTime(Math.max(700, f * 2.2), t0 + 0.9);
      tone.connect(env);
      env.gain.setValueAtTime(0, t0);
      env.gain.linearRampToValueAtTime(g, t0 + 0.004);
      env.gain.exponentialRampToValueAtTime(g * 0.45, t0 + 0.22);
      env.gain.exponentialRampToValueAtTime(g * 0.2, t0 + Math.max(dur, 0.3));
      env.gain.exponentialRampToValueAtTime(0.0001, end);
      const B = 0.0004; // string stiffness: upper partials sit a little sharp, as on a real piano
      [1, 2, 3, 4, 5, 6].forEach((k, i) => {
        const pf = f * k * Math.sqrt(1 + B * k * k);
        if (pf > 9000) return;
        const amp = [0.55, 0.3, 0.16, 0.1, 0.06, 0.04][i];
        for (const det of i < 2 ? [-2.5, 2.5] : [0]) {
          const o = c.createOscillator();
          o.type = "sine"; o.frequency.value = pf; o.detune.value = det;
          const og = c.createGain();
          og.gain.setValueAtTime(amp / (i < 2 ? 2 : 1), t0);
          og.gain.exponentialRampToValueAtTime(0.0001, t0 + (end - t0) / (1 + i * 0.45)); // high partials die first
          o.connect(og).connect(tone); o.start(t0); o.stop(end);
        }
      });
      const thump = c.createBufferSource();
      thump.buffer = noiseBuffer(c, 0.04);
      const tf = c.createBiquadFilter();
      tf.type = "bandpass"; tf.frequency.value = Math.min(3000, f * 3);
      const tg = c.createGain();
      tg.gain.setValueAtTime(0.25, t0);
      tg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.035);
      thump.connect(tf).connect(tg).connect(env); thump.start(t0);
      markBusy(Math.min(end, t0 + Math.max(dur, 0.25) + 0.45)); // the quiet tail must not keep Melo's ears shut
      return end;
    }
    case "harmonium": {
      // Reeds: steady, warm, slightly nasal; sound holds for the whole note (good for sargam).
      end = t0 + dur + 0.12;
      const lp = c.createBiquadFilter();
      lp.type = "lowpass"; lp.frequency.value = Math.min(6000, f * 7); lp.Q.value = 0.7;
      const body = c.createBiquadFilter();
      body.type = "peaking"; body.frequency.value = 1100; body.gain.value = 5; body.Q.value = 1.2;
      lp.connect(body).connect(env);
      env.gain.setValueAtTime(0, t0);
      env.gain.linearRampToValueAtTime(g * 0.5, t0 + 0.05);
      env.gain.setValueAtTime(g * 0.5, t0 + dur);
      env.gain.linearRampToValueAtTime(0.0001, end);
      for (const [mult, det, amp] of [[1, -3, 0.5], [1, 3, 0.5], [2, 0, 0.22]] as const) {
        const o = c.createOscillator();
        o.type = "sawtooth"; o.frequency.value = f * mult; o.detune.value = det;
        const og = c.createGain(); og.gain.value = amp;
        o.connect(og).connect(lp); o.start(t0); o.stop(end);
      }
      break;
    }
    case "flute": {
      end = t0 + dur + 0.15;
      env.gain.setValueAtTime(0, t0);
      env.gain.linearRampToValueAtTime(g * 0.8, t0 + 0.08);
      env.gain.setValueAtTime(g * 0.8, t0 + dur);
      env.gain.linearRampToValueAtTime(0.0001, end);
      const o = osc("sine", f, 0.9);
      const lfo = c.createOscillator();
      lfo.frequency.value = 5;
      const lg = c.createGain();
      lg.gain.value = f * 0.006;
      lfo.connect(lg).connect(o.frequency);
      lfo.start(t0);
      lfo.stop(end);
      o.stop(end);
      const n = c.createBufferSource();
      n.buffer = noiseBuffer(c, dur + 0.2);
      const bp = c.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = f * 2;
      const ng = c.createGain();
      ng.gain.value = 0.04;
      n.connect(bp).connect(ng).connect(env);
      n.start(t0);
      n.stop(end);
      break;
    }
    case "drum": {
      end = t0 + 0.4;
      env.gain.setValueAtTime(g, t0);
      env.gain.exponentialRampToValueAtTime(0.0001, end);
      const o = c.createOscillator();
      o.frequency.setValueAtTime(150, t0);
      o.frequency.exponentialRampToValueAtTime(50, t0 + 0.25);
      o.connect(env);
      o.start(t0);
      o.stop(end);
      const n = c.createBufferSource();
      n.buffer = noiseBuffer(c, 0.15);
      const ng = c.createGain();
      ng.gain.setValueAtTime(0.35, t0);
      ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
      n.connect(ng).connect(env);
      n.start(t0);
      break;
    }
    case "bell": {
      end = t0 + Math.max(dur, 0.5) + 1.4;
      env.gain.setValueAtTime(0, t0);
      env.gain.linearRampToValueAtTime(g * 0.7, t0 + 0.003);
      env.gain.exponentialRampToValueAtTime(0.0001, end);
      [osc("sine", f, 0.6), osc("sine", f * 2.76, 0.25), osc("sine", f * 5.4, 0.12), osc("sine", f * 8.93, 0.05)].forEach((o) => o.stop(end));
      break;
    }
    case "guitar":
    case "sitar": {
      const { buf, rate } = pluck(c, f, timbre);
      end = t0 + Math.min(buf.duration / rate, Math.max(dur, 0.3) + (timbre === "sitar" ? 2.0 : 1.2));
      const src = c.createBufferSource();
      src.buffer = buf; src.playbackRate.value = rate;
      const body = c.createBiquadFilter(); // wooden body resonance
      body.type = "peaking"; body.frequency.value = timbre === "sitar" ? 900 : 220; body.gain.value = 4; body.Q.value = 1;
      env.gain.setValueAtTime(g * (timbre === "sitar" ? 0.75 : 0.9), t0);
      env.gain.setValueAtTime(g * 0.8, Math.max(t0 + 0.01, end - 0.15));
      env.gain.linearRampToValueAtTime(0.0001, end);
      src.connect(body).connect(env);
      if (timbre === "sitar") { // a slow meend: the note slides up into place, as a sitar player pulls the string
        src.playbackRate.setValueAtTime(rate * 0.985, t0);
        src.playbackRate.exponentialRampToValueAtTime(rate, t0 + 0.12);
      }
      src.start(t0); src.stop(end);
      break;
    }
    case "violin": {
      // Bowed string: slow attack, bright sawtooth through a wooden body, vibrato that blooms after the start.
      end = t0 + dur + 0.18;
      const body = c.createBiquadFilter();
      body.type = "peaking"; body.frequency.value = 2800; body.gain.value = 6; body.Q.value = 1.4;
      const low = c.createBiquadFilter();
      low.type = "peaking"; low.frequency.value = 450; low.gain.value = 4; low.Q.value = 1;
      const lp = c.createBiquadFilter();
      lp.type = "lowpass"; lp.frequency.value = Math.min(9000, f * 10);
      lp.connect(low).connect(body).connect(env);
      env.gain.setValueAtTime(0, t0);
      env.gain.linearRampToValueAtTime(g * 0.38, t0 + 0.09);
      env.gain.setValueAtTime(g * 0.38, t0 + dur);
      env.gain.linearRampToValueAtTime(0.0001, end);
      const vib = c.createOscillator();
      vib.frequency.value = 5.6;
      const depth = c.createGain();
      depth.gain.setValueAtTime(0, t0);
      depth.gain.linearRampToValueAtTime(f * 0.006, t0 + Math.min(0.35, dur * 0.6));
      vib.connect(depth);
      for (const det of [-4, 4]) {
        const o = c.createOscillator();
        o.type = "sawtooth"; o.frequency.value = f; o.detune.value = det;
        depth.connect(o.frequency);
        const og = c.createGain(); og.gain.value = 0.5;
        o.connect(og).connect(lp); o.start(t0); o.stop(end);
      }
      vib.start(t0); vib.stop(end);
      const bow = c.createBufferSource(); // rosin noise on the bow
      bow.buffer = noiseBuffer(c, dur + 0.2);
      const bf = c.createBiquadFilter(); bf.type = "bandpass"; bf.frequency.value = f * 3; bf.Q.value = 2;
      const bg = c.createGain(); bg.gain.value = 0.03;
      bow.connect(bf).connect(bg).connect(env); bow.start(t0); bow.stop(end);
      break;
    }
    case "santoor": {
      // Hammered strings in groups of three, a hair apart: bright, shimmering, quickly fading.
      end = t0 + Math.max(dur, 0.3) + 1.3;
      env.gain.setValueAtTime(0, t0);
      env.gain.linearRampToValueAtTime(g * 0.5, t0 + 0.003);
      env.gain.exponentialRampToValueAtTime(g * 0.12, t0 + 0.35);
      env.gain.exponentialRampToValueAtTime(0.0001, end);
      for (const det of [-7, 0, 6]) {
        [1, 2, 3, 4].forEach((k, i) => {
          const o = c.createOscillator();
          o.type = "triangle"; o.frequency.value = f * k; o.detune.value = det;
          const og = c.createGain();
          og.gain.setValueAtTime([0.5, 0.25, 0.14, 0.08][i] / 3, t0);
          og.gain.exponentialRampToValueAtTime(0.0001, t0 + (end - t0) / (1 + i * 0.8));
          o.connect(og).connect(env); o.start(t0); o.stop(end);
        });
      }
      break;
    }
    case "xylophone": {
      // Wooden bar: a short knock, the main tone and the bar's tuned overtone (about 4x), all dying fast.
      end = t0 + 0.7;
      env.gain.setValueAtTime(g * 0.8, t0);
      env.gain.exponentialRampToValueAtTime(0.0001, end);
      [[1, 0.7, 0.6], [3.93, 0.22, 0.18], [9.2, 0.06, 0.06]].forEach(([k, amp, len]) => {
        const o = c.createOscillator(); o.type = "sine"; o.frequency.value = f * k;
        const og = c.createGain();
        og.gain.setValueAtTime(amp, t0); og.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
        o.connect(og).connect(env); o.start(t0); o.stop(end);
      });
      const knock = c.createBufferSource(); knock.buffer = noiseBuffer(c, 0.02);
      const kf = c.createBiquadFilter(); kf.type = "bandpass"; kf.frequency.value = Math.min(5000, f * 4);
      const kg = c.createGain(); kg.gain.value = 0.3;
      knock.connect(kf).connect(kg).connect(env); knock.start(t0);
      break;
    }
    case "kalimba": {
      // Thumb piano: a soft click, a round tone and a quickly vanishing high "tine" overtone.
      end = t0 + Math.max(dur, 0.3) + 1.1;
      env.gain.setValueAtTime(0, t0);
      env.gain.linearRampToValueAtTime(g * 0.7, t0 + 0.005);
      env.gain.exponentialRampToValueAtTime(0.0001, end);
      const o = c.createOscillator(); o.type = "sine"; o.frequency.value = f;
      const og = c.createGain(); og.gain.value = 0.7; o.connect(og).connect(env); o.start(t0); o.stop(end);
      const t = c.createOscillator(); t.type = "sine"; t.frequency.value = f * 5.9;
      const tg = c.createGain(); tg.gain.setValueAtTime(0.18, t0); tg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
      t.connect(tg).connect(env); t.start(t0); t.stop(end);
      break;
    }
    case "tabla": {
      // Low notes: bayan (the big drum, its pitch bends up with the palm). Higher: dayan "tin", a tuned ring.
      if (midi < 55) {
        end = t0 + 0.9;
        env.gain.setValueAtTime(g, t0);
        env.gain.exponentialRampToValueAtTime(0.0001, end);
        const o = c.createOscillator(); o.type = "sine";
        o.frequency.setValueAtTime(75, t0);
        o.frequency.linearRampToValueAtTime(105, t0 + 0.35); // the "ge" glide
        o.connect(env); o.start(t0); o.stop(end);
      } else {
        end = t0 + 0.75;
        env.gain.setValueAtTime(g * 0.8, t0);
        env.gain.exponentialRampToValueAtTime(0.0001, end);
        // the black syahi patch makes the dayan's overtones harmonic, so it has a clear pitch
        [[1, 0.6, 0.7], [2, 0.3, 0.45], [3, 0.18, 0.3], [4, 0.1, 0.2]].forEach(([k, amp, len]) => {
          const o = c.createOscillator(); o.type = "sine";
          o.frequency.setValueAtTime(f * k * 1.02, t0); o.frequency.exponentialRampToValueAtTime(f * k, t0 + 0.04);
          const og = c.createGain(); og.gain.setValueAtTime(amp, t0); og.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
          o.connect(og).connect(env); o.start(t0); o.stop(end);
        });
        const slap = c.createBufferSource(); slap.buffer = noiseBuffer(c, 0.03);
        const sf = c.createBiquadFilter(); sf.type = "highpass"; sf.frequency.value = 2000;
        const sg = c.createGain(); sg.gain.value = 0.25;
        slap.connect(sf).connect(sg).connect(env); slap.start(t0);
      }
      break;
    }
  }
  markBusy(end);
  return end;
}

// --- Melo's singing voice -------------------------------------------------------------------------
const SING_KEY = "melo.sing";
let singing = false; // off unless the parent turns it on: lessons are about playing the instrument
try { singing = localStorage.getItem(SING_KEY) === "1"; } catch { /* no storage */ }
/** Parent setting (per device): Melo sings the note names along with the piano. */
export const isSinging = () => singing;
export function setSinging(on: boolean) {
  singing = on;
  try { localStorage.setItem(SING_KEY, on ? "1" : "0"); } catch { /* private mode */ }
}

const voiceCache = new Map<string, AudioBuffer>();

/**
 * Sing (or, with `speech`, recite) one syllable at the pitch of `midi`. Returns the end time.
 * The voice is rendered once per (syllable, pitch, length) and cached.
 */
export function singNote(midi: number, syllable: string, opts: { at?: number; duration?: number; gain?: number; dest?: AudioNode; speech?: boolean } = {}): number {
  const c = audioContext();
  ensureRunning(c);
  const dur = Math.max(0.12, opts.duration ?? 0.6);
  const key = `${syllable}|${midi}|${Math.round(dur * 20)}|${opts.speech ? 1 : 0}`;
  let buf = voiceCache.get(key);
  if (!buf) {
    const data = renderSyllable(syllable, midiToFreq(midi), dur, c.sampleRate, { speech: opts.speech });
    buf = c.createBuffer(1, data.length, c.sampleRate);
    buf.getChannelData(0).set(data);
    if (voiceCache.size > 300) voiceCache.clear();
    voiceCache.set(key, buf);
  }
  const t0 = opts.at ?? c.currentTime + 0.01;
  const src = c.createBufferSource();
  src.buffer = buf;
  const g = c.createGain();
  g.gain.value = opts.gain ?? 0.75;
  src.connect(g).connect(opts.dest ?? master!);
  src.start(t0);
  const end = t0 + buf.duration;
  // Melo's beak opens with each sung syllable
  const startMs = Math.max(0, (t0 - c.currentTime) * 1000);
  for (let ms = 0; ms < buf.duration * 1000 - 80; ms += 140) window.setTimeout(() => pulseMouth(0.95), startMs + ms);
  window.setTimeout(() => pulseMouth(0), startMs + buf.duration * 1000);
  markBusy(end);
  return end;
}

export interface SeqNote { midi: number; beats?: number; gain?: number; timbre?: Timbre; /** syllable Melo sings on this note */ sing?: string | null }

/** Play a sequence; `onNote(i)` fires (approximately) as each note starts. Resolves when done. */
export function playSequence(notes: SeqNote[], bpm = 90, onNote?: (i: number) => void, startDelay = 0.15): { done: Promise<void>; cancel: () => void } {
  const c = audioContext();
  const beat = 60 / bpm;
  let t = c.currentTime + startDelay;
  const timers: number[] = [];
  // Own volume bus, so cancel() really silences notes that are already scheduled.
  const bus = c.createGain();
  bus.connect(master!);
  let end = t;
  notes.forEach((n, i) => {
    const d = (n.beats ?? 1) * beat;
    const sung = !!n.sing && singing;
    // Play like a person, not a music box: lean on the first note of the phrase and on long notes,
    // let quick notes pass lightly, and connect steps smoothly (legato).
    const melodic = !n.timbre || (n.timbre !== "drum" && n.timbre !== "bell");
    const shape = n.gain ?? (melodic && notes.length > 2 ? 0.62 + (i === 0 ? 0.12 : 0) + ((n.beats ?? 1) >= 2 ? 0.08 : (n.beats ?? 1) < 1 ? -0.08 : 0)
      + 0.06 * Math.sin((i / Math.max(1, notes.length - 1)) * Math.PI) : undefined);
    const hold = melodic && i < notes.length - 1 && Math.abs(notes[i + 1].midi - n.midi) <= 2 ? 1.0 : 0.9;
    // When Melo sings, the piano drops back so the voice leads and the key still gives the pitch.
    end = playNote(n.midi, { timbre: n.timbre, gain: sung ? (shape ?? 0.7) * 0.4 : shape, duration: d * hold, at: t, dest: bus });
    if (sung) end = Math.max(end, singNote(n.midi, n.sing!, { at: t, duration: d * 0.92, dest: bus }));
    const delayMs = (t - c.currentTime) * 1000;
    if (onNote) timers.push(window.setTimeout(() => onNote(i), delayMs));
    t += d;
  });
  let resolve!: () => void;
  const done = new Promise<void>((r) => (resolve = r));
  const finalMs = (t - c.currentTime) * 1000 + 50;
  timers.push(window.setTimeout(() => { onNote?.(-1); resolve(); bus.disconnect(); }, Math.max(finalMs, (end - c.currentTime) * 1000 + 100)));
  return {
    done,
    cancel: () => {
      timers.forEach(clearTimeout);
      bus.gain.setTargetAtTime(0, c.currentTime, 0.02); // quick fade, no click
      window.setTimeout(() => bus.disconnect(), 200);
      busyUntil = performance.now() + 250;
      onNote?.(-1);
      resolve();
    },
  };
}

/** Drum pattern (beats offsets), with a callback per hit for visuals. */
export function playRhythm(pattern: number[], bpm: number, onHit?: (i: number) => void) {
  return playSequence(
    pattern.map((p, i) => ({ midi: 48, timbre: "drum" as Timbre, beats: i < pattern.length - 1 ? pattern[i + 1] - p : 1 })),
    bpm, onHit,
  );
}

// --- Teacher sound effects: what a teacher does with hands and voice besides words ---------------------
export type Sfx = "sparkle" | "tada" | "clap" | "oops" | "pop";
/** A small sound for a reaction. Gentle by design: a mistake gets a soft "uh-oh", never a buzzer. */
export function playSfx(kind: Sfx): void {
  const c = audioContext();
  ensureRunning(c);
  const t = c.currentTime + 0.02;
  if (kind === "sparkle") { [84, 88, 91, 96].forEach((m, i) => playNote(m, { timbre: "bell", gain: 0.25, duration: 0.2, at: t + i * 0.06 })); return; }
  if (kind === "tada") {
    playNote(67, { timbre: "xylophone", gain: 0.5, at: t });
    [72, 76, 79, 84].forEach((m) => playNote(m, { timbre: "santoor", gain: 0.35, duration: 0.8, at: t + 0.14 }));
    return;
  }
  if (kind === "pop") { playNote(79, { timbre: "kalimba", gain: 0.4, duration: 0.15, at: t }); return; }
  if (kind === "oops") { // "uh-oh": two soft falling notes
    playNote(69, { timbre: "kalimba", gain: 0.35, duration: 0.2, at: t });
    playNote(64, { timbre: "kalimba", gain: 0.3, duration: 0.3, at: t + 0.18 });
    return;
  }
  // clap: three hand claps (noise bursts through a "hand" band-pass), a little uneven like real hands
  [0, 0.19, 0.37].forEach((dt, i) => {
    const at = t + dt + (Math.random() - 0.5) * 0.02;
    const n = c.createBufferSource(); n.buffer = noiseBuffer(c, 0.12);
    const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 1100 + i * 90; bp.Q.value = 0.9;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.7, at + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.11);
    n.connect(bp).connect(g).connect(master!); n.start(at); n.stop(at + 0.12);
    markBusy(at + 0.12);
  });
}

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
