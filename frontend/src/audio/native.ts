// Native-speaker recordings: play them (female and male voices take turns), and record short voice clips
// (the child's spoken word, or a family member recording a reference) as 16 kHz WAV for the server.
import type { NativeRef } from "../api";
import { pulseMouth } from "./mouth";
import { toWav16k } from "./recorder";

let current: HTMLAudioElement | null = null;
let turn = 0;

/** Play one of the native recordings (alternating speakers each time). Slow = 75 % speed, same pitch. */
export function playNative(refs: NativeRef[], slow = false): Promise<NativeRef | null> {
  if (!refs.length) return Promise.resolve(null);
  const ref = refs[turn++ % refs.length];
  current?.pause();
  const a = new Audio(ref.url);
  current = a;
  a.playbackRate = slow ? 0.75 : 1;
  (a as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = true;
  return new Promise((resolve) => {
    const chatter = window.setInterval(() => pulseMouth(0.4 + Math.random() * 0.5), 150);
    const done = () => { clearInterval(chatter); pulseMouth(0); resolve(ref); };
    a.onended = done;
    a.onerror = () => { clearInterval(chatter); pulseMouth(0); resolve(null); };
    a.play().catch(() => { clearInterval(chatter); resolve(null); });
  });
}

export const stopNative = () => { current?.pause(); current = null; };

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
  !r ? "" : r.family ? `🎙️ ${r.speaker ?? "family"} (${r.gender})`
    : `🎙️ Native speaker ${r.speaker ?? ""}${r.gender !== "unknown" ? ` (${r.gender})` : ""} · ${r.license ?? "CC BY-SA"} · ${SOURCES[r.origin ?? ""] ?? "Lingua Libre"}`;

const SOURCES: Record<string, string> = { tatoeba: "Tatoeba", openslr: "Google / OpenSLR", commonvoice: "Mozilla Common Voice", lingualibre: "Lingua Libre" };
