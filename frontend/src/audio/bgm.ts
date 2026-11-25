// Background music: soft, original tunes composed on the fly (no recordings, no licences), so a menu, a story
// or a maths round never feels empty. A 2-bar tune is made, repeated, varied and answered (A A' B A), the way
// children's songs work: repetition is what makes music feel friendly to a young child.
//
// It never gets in the way of teaching:
// * quieter while Melo talks, silent while Melo plays notes or the child plays the piano (isBusy),
// * silent while the microphone listens (holdMusic), so Melo never hears its own music as the child,
// * silent when the page is hidden, and only on pages that ask for it (useBackgroundMusic).
// Parents set the volume (or switch it off) per device; children have a 🎵 button.
import { useEffect, useSyncExternalStore } from "react";
import { audioContext, isBusy } from "./synth";
import { isSpeaking } from "./speech";
import { musicHeld } from "./hold";

export type MusicMood = "home" | "calm" | "story" | "play";

/** A fixed tune (public-domain pieces in the Listening room): [semitones above the key, beats]; null = rest. */
export interface Piece { notes: [number | null, number][]; chords: number[][]; beatsPerBar: number }

export interface MoodDef {
  bpm: number;
  key: number; // midi of the home note
  prog: number[][]; // chords as semitones above the key, one per bar
  density: number; // chance of a melody note on each eighth
  melody: "pluck" | "box" | "flute";
  shaker: boolean;
  bass: boolean;
  drone?: boolean; // tanpura-like Pa Sa Sa Sa underneath and a steady Sa-Pa drone instead of chords (ragas)
  bells?: boolean; // a high bell now and then: the "bell hunt" listening game counts them
  piece?: Piece; // play this exact tune (looped) instead of composing one
}

const I = [0, 4, 7], IV = [5, 9, 12], V = [7, 11, 14], VI = [9, 12, 16], II = [2, 5, 9];
export const MOODS: Record<MusicMood, MoodDef> = {
  home: { bpm: 100, key: 60, prog: [I, V, VI, IV], density: 0.55, melody: "pluck", shaker: true, bass: true },
  calm: { bpm: 76, key: 65, prog: [I, VI, IV, V], density: 0.32, melody: "flute", shaker: false, bass: true },
  story: { bpm: 66, key: 62, prog: [I, IV, VI, V], density: 0.4, melody: "box", shaker: false, bass: false },
  play: { bpm: 112, key: 67, prog: [I, IV, II, V], density: 0.6, melody: "pluck", shaker: true, bass: true },
};
const PENTA = [0, 2, 4, 7, 9]; // major pentatonic: every note sounds good over every chord here

// --- preferences (per device) -----------------------------------------------------------------------------
const pref = (k: string, d: string) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const save = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };
let enabled = pref("melo.music", "on") !== "off";
let volume = Math.min(1, Math.max(0, Number(pref("melo.music.vol", "0.5")) || 0));
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const isMusicOn = () => enabled;
export const musicVolume = () => volume;
export function setMusicOn(on: boolean) { enabled = on; save("melo.music", on ? "on" : "off"); emit(); }
export function setMusicVolume(v: number) { volume = Math.min(1, Math.max(0, v)); save("melo.music.vol", String(volume)); emit(); }
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const useMusicOn = () => useSyncExternalStore(subscribe, isMusicOn, isMusicOn);

// --- composing ------------------------------------------------------------------------------------------
/** Small seeded random numbers, so a tune can be repeated exactly (repetition = a real tune, not noise). */
export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; };
}

/** One bar of melody as 8 eighth-note slots: a scale step (index into the pentatonic ladder) or null (rest). */
export function makeMotif(rand: () => number, density: number, start = 5): (number | null)[] {
  const out: (number | null)[] = [];
  let step = start;
  for (let i = 0; i < 8; i++) {
    const strong = i % 2 === 0;
    if (rand() < (strong ? density + 0.25 : density - 0.15)) {
      const move = Math.round((rand() - 0.5) * 4); // small steps: easy to hum
      step = Math.max(2, Math.min(10, step + move));
      out.push(step);
    } else out.push(null);
  }
  if (!out.some((x) => x !== null)) out[0] = start;
  return out;
}

/** A 4-bar phrase A A' B A: the second bar varies the ending, the third answers, the fourth comes home. */
export function makePhrase(seed: number, density: number): (number | null)[][] {
  const rand = rng(seed);
  const a = makeMotif(rand, density);
  const a2 = [...a.slice(0, 5), ...makeMotif(rand, density, a[4] ?? 5).slice(5)];
  const b = makeMotif(rand, density, 7);
  const home: (number | null)[] = [...a.slice(0, 4), 5, null, 5, null]; // ends on the home note
  return [a, a2, b, home];
}

const stepToSemi = (step: number) => Math.floor(step / 5) * 12 + PENTA[((step % 5) + 5) % 5] - 12;
const freq = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

// --- sound ----------------------------------------------------------------------------------------------
let out: GainNode | null = null;
let mood: string | null = null;
let cur: MoodDef | null = null;
let level = 0.22; // background level; the Listening room plays louder
let force = false; // the Listening room plays even when background music is switched off
let bellRand = rng(7);
let timer: number | null = null;
let nextTime = 0;
let stepIdx = 0;
let phrase: (number | null)[][] = [];
let phraseNo = 0;
let stopTimer: number | null = null;
let noise: AudioBuffer | null = null;

function bus(c: AudioContext): GainNode {
  if (!out) {
    out = c.createGain();
    out.gain.value = 0;
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 5000; // soft edges: background, not foreground
    out.connect(lp).connect(c.destination);
  }
  return out;
}

function tone(c: AudioContext, dest: AudioNode, f: number, t: number, dur: number, kind: "pluck" | "box" | "flute" | "pad" | "bass", g: number) {
  const env = c.createGain();
  env.connect(dest);
  const o = c.createOscillator();
  const parts: OscillatorNode[] = [o];
  o.frequency.value = f;
  if (kind === "pad") {
    o.type = "triangle";
    const o2 = c.createOscillator(); o2.type = "triangle"; o2.frequency.value = f; o2.detune.value = 7; parts.push(o2);
    const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 900;
    o.connect(lp); o2.connect(lp); lp.connect(env);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(g, t + 0.5);
    env.gain.setValueAtTime(g, t + dur - 0.3);
    env.gain.linearRampToValueAtTime(0, t + dur + 0.4);
  } else {
    o.type = kind === "flute" ? "sine" : kind === "bass" ? "sine" : "triangle";
    o.connect(env);
    if (kind === "box" || kind === "pluck") { // a bell-like overtone: music box / kalimba
      const o2 = c.createOscillator(); o2.type = "sine"; o2.frequency.value = f * (kind === "box" ? 4 : 2);
      const g2 = c.createGain(); g2.gain.value = kind === "box" ? 0.25 : 0.15;
      o2.connect(g2).connect(env); parts.push(o2);
    }
    const attack = kind === "flute" ? 0.08 : 0.005;
    const decay = kind === "bass" ? 0.5 : kind === "flute" ? dur : kind === "box" ? 1.1 : 0.55;
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(g, t + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }
  parts.forEach((p) => { p.start(t); p.stop(t + dur + 1.3); });
}

function shake(c: AudioContext, dest: AudioNode, t: number, g: number) {
  if (!noise) {
    noise = c.createBuffer(1, Math.floor(c.sampleRate * 0.08), c.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  }
  const s = c.createBufferSource(); s.buffer = noise;
  const hp = c.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 6000;
  const e = c.createGain(); e.gain.value = g;
  s.connect(hp).connect(e).connect(dest);
  s.start(t);
}

// --- events (Listening room: count bells, count chords, dance prompts) -----------------------------------
export type MusicEvent = { kind: "bar" | "bell"; index: number };
const eventListeners = new Set<(e: MusicEvent) => void>();
export function onMusicEvent(cb: (e: MusicEvent) => void): () => void { eventListeners.add(cb); return () => { eventListeners.delete(cb); }; }
function emitAt(c: AudioContext, t: number, e: MusicEvent) {
  window.setTimeout(() => eventListeners.forEach((l) => l(e)), Math.max(0, (t - c.currentTime) * 1000));
}

/** Eighth-note index → piece note starting there ([semitones, beats]), and the piece length in eighths. */
export function pieceIndex(piece: Piece): { at: Map<number, [number | null, number]>; eighths: number } {
  const at = new Map<number, [number | null, number]>();
  let e = 0;
  for (const n of piece.notes) { at.set(e, n); e += Math.max(1, Math.round(n[1] * 2)); }
  return { at, eighths: e };
}
const pieceCache = new WeakMap<Piece, ReturnType<typeof pieceIndex>>();

let bellCount = 0;
function scheduleStep(c: AudioContext, m: MoodDef, t: number) {
  const dest = bus(c);
  const eighth = 60 / m.bpm / 2;
  const perBar = (m.piece?.beatsPerBar ?? 4) * 2;
  const barNo = Math.floor(stepIdx / perBar);
  const slot = stepIdx % perBar;
  if (slot === 0) emitAt(c, t, { kind: "bar", index: barNo });

  if (m.piece) {
    let idx = pieceCache.get(m.piece);
    if (!idx) { idx = pieceIndex(m.piece); pieceCache.set(m.piece, idx); }
    const pos = stepIdx % idx.eighths;
    const chord = m.piece.chords[barNo % m.piece.chords.length];
    if (slot === 0) {
      chord.forEach((x) => tone(c, dest, freq(m.key - 12 + x), t, eighth * perBar, "pad", 0.04));
      if (m.bass) tone(c, dest, freq(m.key - 24 + chord[0]), t, eighth * 2, "bass", 0.15);
    }
    const n = idx.at.get(pos);
    if (n && n[0] !== null) tone(c, dest, freq(m.key + n[0]), t, eighth * 2 * n[1], m.melody, m.melody === "box" ? 0.1 : 0.12);
    stepIdx++;
    return;
  }

  const bar = barNo % 4;
  if (bar === 0 && slot === 0) {
    phrase = makePhrase(1000 + phraseNo * 7919 + m.bpm, m.density);
    // every other phrase is the same tune again: a child starts to recognise it
    phraseNo = phraseNo % 2 === 0 ? phraseNo + 1 : phraseNo;
  }
  const chord = m.drone ? [0, 7, 12] : m.prog[bar];
  if (slot === 0) chord.forEach((x) => tone(c, dest, freq(m.key - 12 + x), t, eighth * 8, "pad", m.drone ? 0.03 : 0.035));
  if (m.drone && slot % 2 === 0) tone(c, dest, freq(m.key - 24 + [7, 12, 12, 0][slot / 2]), t, eighth * 4, "pluck", 0.08); // tanpura: Pa Sa Sa Sa
  if (!m.drone && m.bass && (slot === 0 || slot === 4)) tone(c, dest, freq(m.key - 24 + chord[0]), t, eighth * 2, "bass", 0.16);
  if (m.shaker && slot % 2 === 1) shake(c, dest, t, 0.05);
  if (m.bells && slot === 6 && bellCount < 12 && bellRand() < 0.25) { // a countable number for a young child
    tone(c, dest, freq(m.key + 36), t, 1.2, "box", 0.14);
    emitAt(c, t, { kind: "bell", index: ++bellCount });
  }
  const step = phrase[bar]?.[slot];
  if (step != null) tone(c, dest, freq(m.key + 12 + stepToSemi(step)), t, eighth * 1.6, m.melody, m.melody === "box" ? 0.09 : 0.11);
  stepIdx++;
  if (stepIdx % 64 === 0) phraseNo++; // after the phrase has played twice: a new tune
}

/** How loud the music should be right now (0..1 of the parent's volume). */
export function duckLevel(state: { held: boolean; busy: boolean; speaking: boolean; hidden: boolean }): number {
  if (state.held || state.busy || state.hidden) return 0;
  return state.speaking ? 0.3 : 1;
}

function tick() {
  const c = audioContext();
  if (!mood || !cur) return;
  const m = cur;
  const lv = duckLevel({ held: musicHeld(), busy: isBusy(), speaking: isSpeaking(), hidden: typeof document !== "undefined" && document.hidden });
  const target = force ? lv * level : enabled ? lv * volume * level : 0;
  bus(c).gain.setTargetAtTime(target, c.currentTime, target < bus(c).gain.value ? 0.08 : 0.6);
  if (c.state !== "running") return;
  if (nextTime < c.currentTime) nextTime = c.currentTime + 0.05;
  const eighth = 60 / m.bpm / 2;
  while (nextTime < c.currentTime + 0.3) {
    scheduleStep(c, m, nextTime);
    nextTime += eighth;
  }
}

export function startMusic(m: MusicMood): void {
  playMusic(m, MOODS[m]);
}

/** Play any mood or piece. `opts.force`: play even when background music is off (the child chose to listen). */
export function playMusic(id: string, def: MoodDef, opts: { level?: number; force?: boolean; seed?: number } = {}): void {
  if (typeof window === "undefined") return;
  if (stopTimer) { clearTimeout(stopTimer); stopTimer = null; }
  level = opts.level ?? 0.22;
  force = !!opts.force;
  if (mood !== id) {
    mood = id; cur = def; stepIdx = 0; bellCount = 0;
    phraseNo = opts.seed ?? Math.floor(Math.random() * 50);
    bellRand = rng(phraseNo + 3);
  }
  if (!timer) timer = window.setInterval(tick, 60);
}

export function stopMusic(m?: string): void {
  if (m && mood !== m) return;
  if (stopTimer) clearTimeout(stopTimer);
  // a short grace period: moving from one page to the next keeps the tune going instead of restarting it
  stopTimer = window.setTimeout(() => {
    stopTimer = null;
    mood = null; cur = null; force = false;
    if (timer) { clearInterval(timer); timer = null; }
    if (out) { const c = audioContext(); out.gain.setTargetAtTime(0, c.currentTime, 0.2); }
  }, 450);
}

/** Pages that want background music call this with their mood; it stops when the page closes. */
export function useBackgroundMusic(m: MusicMood | null): void {
  useEffect(() => {
    if (!m) return;
    startMusic(m);
    return () => stopMusic(m);
  }, [m]);
}
