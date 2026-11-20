// Camera observation (MediaPipe Hands, runs fully in the browser — frames never leave the device).
//
// After a parent marks the keyboard area and its first white key, fingertip positions are mapped
// to estimated keys. Estimates are *hints*: they confirm or question a microphone note; they are
// never used alone to mark a child's answer wrong.

import type { HandLandmarker } from "@mediapipe/tasks-vision";

// The hand-tracking files ship with the app (frontend/public/mediapipe, see scripts/fetch-mediapipe.mjs)
// so the camera works offline; the CDN is only a fallback for a build without them.
const TASKS_VERSION = "0.10.14";
const LOCAL = { wasm: "/mediapipe/wasm", model: "/mediapipe/hand_landmarker.task" };
const CDN = {
  wasm: `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VERSION}/wasm`,
  model: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
};
const FINGERTIPS = [4, 8, 12, 16, 20];
const WHITE_OFFSETS = [0, 2, 4, 5, 7, 9, 11];

export interface KeyboardCalibration { x: number; y: number; w: number; h: number; firstWhiteMidi: number; whiteKeys: number }

export interface Observation {
  handsVisible: number;
  fingertips: { x: number; y: number }[];
  estimatedKeys: number[]; // MIDI of keys under fingertips inside the keyboard area
  inKeyboard: boolean;
  flat: boolean; // fingers stretched flat instead of curved
  oneFinger: boolean; // poking with the index finger while the others are tucked away
}

type Point = { x: number; y: number; z?: number };
/** Angle (degrees) at joint `b` between `a` and `c`: about 180 for a straight finger, smaller when curled. */
export function jointAngle(a: Point, b: Point, c: Point): number {
  const u = [a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0)];
  const v = [c.x - b.x, c.y - b.y, (c.z ?? 0) - (b.z ?? 0)];
  const dot = u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  const len = Math.hypot(...u) * Math.hypot(...v);
  return len > 0 ? (Math.acos(Math.max(-1, Math.min(1, dot / len))) * 180) / Math.PI : 180;
}

// MediaPipe hand landmarks: [knuckle, middle joint, tip] for index, middle, ring and little finger.
const FINGERS: [number, number, number][] = [[5, 6, 8], [9, 10, 12], [13, 14, 16], [17, 18, 20]];

/** How one hand is held: a piano teacher wants curved fingers and more than one finger in use. */
export function handPosture(hand: Point[]): { flat: boolean; oneFinger: boolean } {
  const angles = FINGERS.map(([k, m, t]) => jointAngle(hand[k], hand[m], hand[t]));
  const straight = angles.filter((a) => a > 162).length;
  const curled = angles.slice(1).filter((a) => a < 115).length;
  return { flat: straight >= 3, oneFinger: angles[0] > 150 && curled >= 2 };
}

/** Running summary of what the camera saw while the child played one part (sent with the answer). */
export class HandStats {
  private frames = 0; private seen = 0; private flat = 0; private one = 0;
  add(o: Observation) {
    this.frames++;
    if (o.handsVisible > 0) { this.seen++; if (o.flat) this.flat++; if (o.oneFinger) this.one++; }
  }
  reset() { this.frames = this.seen = this.flat = this.one = 0; }
  summary() {
    const r = (x: number, of: number) => (of ? Math.round((x / of) * 100) / 100 : 0);
    return { frames: this.frames, seen: r(this.seen, this.frames), flat: r(this.flat, this.seen), one_finger: r(this.one, this.seen) };
  }
}

const calKey = (childId: string) => `melo.camera.calibration.${childId}`;

export function loadCalibration(childId: string): KeyboardCalibration | null {
  try {
    const raw = localStorage.getItem(calKey(childId));
    return raw ? (JSON.parse(raw) as KeyboardCalibration) : null;
  } catch {
    return null;
  }
}

export function saveCalibration(childId: string, cal: KeyboardCalibration | null) {
  try {
    if (cal) localStorage.setItem(calKey(childId), JSON.stringify(cal));
    else localStorage.removeItem(calKey(childId));
  } catch { /* storage unavailable: calibration just isn't remembered */ }
}

export function whiteIndexToMidi(first: number, idx: number): number {
  const startPc = WHITE_OFFSETS.indexOf(((first % 12) + 12) % 12);
  const base = first - WHITE_OFFSETS[Math.max(0, startPc)];
  const k = Math.max(0, startPc) + idx;
  return base + Math.floor(k / 7) * 12 + WHITE_OFFSETS[k % 7];
}

export function estimateKeys(tips: { x: number; y: number }[], cal: KeyboardCalibration): number[] {
  const out: number[] = [];
  for (const t of tips) {
    if (t.x < cal.x || t.x > cal.x + cal.w || t.y < cal.y || t.y > cal.y + cal.h) continue;
    const idx = Math.min(cal.whiteKeys - 1, Math.floor(((t.x - cal.x) / cal.w) * cal.whiteKeys));
    out.push(whiteIndexToMidi(cal.firstWhiteMidi, idx));
  }
  return out;
}

/** Does the camera agree with a heard note? true / false, or null when it can't tell. */
export function cameraAgrees(obs: Observation | null, midi: number): boolean | null {
  if (!obs || !obs.inKeyboard || obs.estimatedKeys.length === 0) return null;
  const pc = ((midi % 12) + 12) % 12;
  // allow one neighbouring key either side: fingertip landmarks are imprecise
  return obs.estimatedKeys.some((k) => {
    const d = Math.abs((((k % 12) - pc + 18) % 12) - 6);
    return d <= 2;
  });
}

export class CameraObserver {
  private video: HTMLVideoElement;
  private stream: MediaStream | null = null;
  private landmarker: HandLandmarker | null = null;
  private timer: number | null = null;
  latest: Observation | null = null;
  private listeners = new Set<(o: Observation) => void>();

  constructor(video: HTMLVideoElement, private calibration: KeyboardCalibration | null) {
    this.video = video;
  }

  setCalibration(cal: KeyboardCalibration | null) { this.calibration = cal; }

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: "user" }, audio: false });
    this.video.srcObject = this.stream;
    this.video.muted = true;
    this.video.playsInline = true;
    await this.video.play();
    const vision = await import("@mediapipe/tasks-vision");
    const load = async (src: typeof LOCAL) => vision.HandLandmarker.createFromOptions(await vision.FilesetResolver.forVisionTasks(src.wasm), {
      baseOptions: { modelAssetPath: src.model, delegate: "GPU" },
      runningMode: "VIDEO",
      numHands: 2,
    });
    try { this.landmarker = await load(LOCAL); } catch { this.landmarker = await load(CDN); }
    this.timer = window.setInterval(() => this.tick(), 66); // ~15 fps is plenty and saves battery
  }

  private tick() {
    if (!this.landmarker || this.video.readyState < 2) return;
    const res = this.landmarker.detectForVideo(this.video, performance.now());
    const tips = (res.landmarks ?? []).flatMap((hand) => FINGERTIPS.map((i) => ({ x: hand[i].x, y: hand[i].y })));
    const estimatedKeys = this.calibration ? estimateKeys(tips, this.calibration) : [];
    const postures = (res.landmarks ?? []).map((hand) => handPosture(hand));
    this.latest = { handsVisible: res.landmarks?.length ?? 0, fingertips: tips, estimatedKeys, inKeyboard: estimatedKeys.length > 0,
      flat: postures.length > 0 && postures.every((p) => p.flat), oneFinger: postures.length > 0 && postures.every((p) => p.oneFinger) };
    this.listeners.forEach((l) => l(this.latest!));
  }

  onObservation(cb: (o: Observation) => void) { this.listeners.add(cb); return () => { this.listeners.delete(cb); }; }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.landmarker?.close();
    this.landmarker = null;
  }
}
