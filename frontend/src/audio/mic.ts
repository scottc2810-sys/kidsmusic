// Microphone note input: getUserMedia → AnalyserNode → YIN → NoteTracker.
// Ignores frames while the app itself is playing sound (so Melo's demo isn't "heard" as the child).

import { holdMusic } from "./hold";
import { DetectedNote, NoteTracker, rms, yin } from "./pitch";
import { audioContext, isBusy } from "./synth";
import { isSpeaking } from "./speech";

export class MicNoteInput {
  private stream: MediaStream | null = null;
  private analyser: AnalyserNode | null = null;
  private timer: number | null = null;
  private tracker: NoteTracker;
  private buf = new Float32Array(2048);
  private listeners = new Set<(n: DetectedNote) => void>();
  private levelListeners = new Set<(level: number) => void>();
  private t0 = performance.now();

  constructor() {
    this.tracker = new NoteTracker(3, (n) => this.listeners.forEach((l) => l(n)));
  }

  async start(): Promise<void> {
    if (this.stream) return;
    holdMusic(true); // background music off while Melo listens
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
    } catch (e) { holdMusic(false); throw e; }
    const ctx = audioContext();
    if (ctx.state !== "running") await ctx.resume().catch(() => {}); // a suspended context reads silence
    const src = ctx.createMediaStreamSource(this.stream);
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    src.connect(this.analyser);
    // Some browsers only process nodes that reach the destination: route through a muted gain (no feedback).
    const mute = ctx.createGain();
    mute.gain.value = 0;
    this.analyser.connect(mute).connect(ctx.destination);
    this.tracker.calibrate(25);
    this.timer = window.setInterval(() => this.tick(), 20);
  }

  resetClock() { this.t0 = performance.now(); }

  private tick() {
    if (!this.analyser) return;
    this.analyser.getFloatTimeDomainData(this.buf);
    const level = rms(this.buf);
    this.levelListeners.forEach((l) => l(level));
    if (isBusy() || isSpeaking()) return; // never treat Melo's own voice or demo as the child playing
    this.tracker.push(yin(this.buf, audioContext().sampleRate), level, performance.now() - this.t0);
  }

  onNote(cb: (n: DetectedNote) => void) { this.listeners.add(cb); return () => { this.listeners.delete(cb); }; }
  onLevel(cb: (l: number) => void) { this.levelListeners.add(cb); return () => { this.levelListeners.delete(cb); }; }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.stream) holdMusic(false);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.analyser = null;
  }
}
