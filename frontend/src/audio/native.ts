// Native-speaker recordings: play them (female and male voices take turns), and record short voice clips
// (the child's spoken word, or a family member recording a reference) as 16 kHz WAV for the server.
import type { NativeRef } from "../api";
import { pulseMouth } from "./mouth";
import { toWav16k } from "./recorder";

let current: HTMLAudioElement | null = null;
let turn = 0;

/** Play one of the recordings (alternating speakers each time). Slow = 75 % speed, same pitch.
 * If one fails (offline, a synthetic voice not recordable right now), the next one is tried. */
export async function playNative(refs: NativeRef[], slow = false): Promise<NativeRef | null> {
  if (!refs.length) return null;
  const start = turn++;
  for (let k = 0; k < refs.length; k++) {
    const ref = refs[(start + k) % refs.length];
    if (await playOne(ref, slow)) return ref;
    if (stopped) return null;
  }
  return null;
}

let stopped = false;

function playOne(ref: NativeRef, slow: boolean): Promise<boolean> {
  current?.pause();
  stopped = false;
  const a = new Audio(ref.url);
  current = a;
  a.playbackRate = slow ? 0.75 : 1;
  (a as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = true;
  return new Promise((resolve) => {
    const chatter = window.setInterval(() => pulseMouth(0.4 + Math.random() * 0.5), 150);
    const end = (ok: boolean) => { clearInterval(chatter); pulseMouth(0); resolve(ok); };
    a.onended = () => end(true);
    a.onpause = () => { if (current !== a || stopped) end(true); };
    a.onerror = () => end(false);
    a.play().catch(() => end(false));
  });
}

export const stopNative = () => { stopped = true; const a = current; current = null; a?.pause(); };

/** Record from the microphone until `stop()` is called (or maxMs). Resolves with a 16 kHz mono WAV. */
export async function recordClip(maxMs = 8000): Promise<{ stop: () => void; result: Promise<Blob | null> }> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  const rec = new MediaRecorder(stream);
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  let stopper: number;
  const result = new Promise<Blob | null>((resolve) => {
    rec.onstop = async () => {
      clearTimeout(stopper);
      stream.getTracks().forEach((t) => t.stop());
      try { resolve(chunks.length ? (await toWav16k(new Blob(chunks, { type: rec.mimeType }))).wav : null); } catch { resolve(null); }
    };
  });
  rec.start();
  const stop = () => { if (rec.state !== "inactive") rec.stop(); };
  stopper = window.setTimeout(stop, maxMs);
  return { stop, result };
}

/** Attribution line for the recording that just played. */
export const credit = (r: NativeRef | null) =>
  !r ? "" : r.origin === "tts" ? `🤖 ${r.license ?? "Synthetic voice"}${r.approx ? ` · ${r.approx}` : ""} · no native recording yet`
    : r.family ? `🎙️ ${r.speaker ?? "family"} (${r.gender})`
    : `🎙️ Native speaker ${r.speaker ?? ""}${r.gender !== "unknown" ? ` (${r.gender})` : ""} · ${r.license ?? "CC BY-SA"} · ${SOURCES[r.origin ?? ""] ?? "Lingua Libre"}`;

const SOURCES: Record<string, string> = { tatoeba: "Tatoeba", openslr: "Google / OpenSLR", commonvoice: "Mozilla Common Voice", lingualibre: "Lingua Libre" };
