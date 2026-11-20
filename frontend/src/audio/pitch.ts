// Real-time pitch detection (YIN) and note-onset tracking for microphone input.

export interface PitchResult { freq: number; clarity: number }

export function yin(buf: Float32Array, sampleRate: number, threshold = 0.15, fmin = 65, fmax = 1600): PitchResult {
  const tauMin = Math.floor(sampleRate / fmax);
  const tauMax = Math.min(Math.floor(sampleRate / fmin), Math.floor(buf.length / 2));
  const W = buf.length - tauMax;
  const d = new Float32Array(tauMax + 1);
  for (let tau = 1; tau <= tauMax; tau++) {
    let s = 0;
    for (let j = 0; j < W; j++) {
      const diff = buf[j] - buf[j + tau];
      s += diff * diff;
    }
    d[tau] = s;
  }
  // cumulative mean normalised difference
  const cmnd = new Float32Array(tauMax + 1);
  cmnd[0] = 1;
  let running = 0;
  for (let tau = 1; tau <= tauMax; tau++) {
    running += d[tau];
    cmnd[tau] = running > 0 ? (d[tau] * tau) / running : 1;
  }
  let tau = -1;
  for (let t = tauMin; t < tauMax; t++) {
    if (cmnd[t] < threshold) {
      while (t + 1 < tauMax && cmnd[t + 1] < cmnd[t]) t++;
      tau = t;
      break;
    }
  }
  if (tau < 0) return { freq: 0, clarity: 0 };
  // parabolic interpolation
  const a = cmnd[tau - 1] ?? cmnd[tau];
  const b = cmnd[tau];
  const c = cmnd[tau + 1] ?? cmnd[tau];
  const denom = a - 2 * b + c;
  const shift = Math.abs(denom) > 1e-9 ? Math.max(-1, Math.min(1, (0.5 * (a - c)) / denom)) : 0;
  return { freq: sampleRate / (tau + shift), clarity: Math.max(0, Math.min(1, 1 - b)) };
}

export const freqToMidi = (f: number) => 69 + 12 * Math.log2(f / 440);

export function rms(buf: Float32Array): number {
  let s = 0;
  for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
  return Math.sqrt(s / buf.length);
}

export interface DetectedNote { midi: number; t: number; conf: number }

/**
 * Turns a stream of (pitch, clarity, level) frames into discrete note onsets.
 * A note is emitted once its pitch is stable for `stableFrames` frames above the noise gate;
 * the same pitch re-triggers only after the level drops (release) or jumps (new attack).
 */
export class NoteTracker {
  private candidate = -1;
  private count = 0;
  private clarities: number[] = [];
  private active = -1;
  private lastLevel = 0;
  private noiseFloor = 0.002;
  private calibrating = 0;

  constructor(private stableFrames = 3, private onNote: (n: DetectedNote) => void = () => {}) {}

  calibrate(frames = 25) { this.calibrating = frames; this.noiseFloor = 0.002; }

  get gate() { return Math.max(0.01, this.noiseFloor * 3); }

  push(p: PitchResult, level: number, tMs: number) {
    if (this.calibrating > 0) {
      this.noiseFloor = Math.max(this.noiseFloor, level);
      this.calibrating--;
      return;
    }
    const attack = level > this.lastLevel * 1.8 && level > this.gate * 1.5;
    this.lastLevel = level;
    if (level < this.gate || p.freq <= 0 || p.clarity < 0.5) {
      this.candidate = -1;
      this.count = 0;
      this.clarities = [];
      if (level < this.gate) this.active = -1; // released: the same note can trigger again
      return;
    }
    const m = Math.round(freqToMidi(p.freq));
    if (m < 21 || m > 108) return;
    if (attack && m === this.active) this.active = -1; // re-struck same key
    if (m === this.candidate) {
      this.count++;
      this.clarities.push(p.clarity);
    } else {
      this.candidate = m;
      this.count = 1;
      this.clarities = [p.clarity];
    }
    if (this.count === this.stableFrames && m !== this.active) {
      this.active = m;
      const conf = this.clarities.reduce((s, x) => s + x, 0) / this.clarities.length;
      this.onNote({ midi: m, t: tMs, conf: Math.round(conf * 100) / 100 });
    }
  }
}
