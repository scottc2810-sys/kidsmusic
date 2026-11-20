import { useEffect, useRef } from "react";
import type { Language, NoteEvent } from "../api";
import type { MicNoteInput } from "../audio/mic";
import { cameraAgrees, type CameraObserver } from "../vision/camera";

export interface ActivityProps {
  spec: Record<string, any>;
  lang: Language;
  source: "screen" | "mic";
  mic: MicNoteInput | null;
  camera: CameraObserver | null;
  onSubmit: (response: Record<string, unknown>) => void;
  locked: boolean; // true after submitting, while feedback shows
  reveal?: { correct?: number; melody?: number[] };
}

/**
 * Unified note input: on-screen piano presses and microphone detections both become NoteEvents
 * (with confidence and an optional camera cross-check), timestamped from activity start.
 */
export function useNoteInput(p: Pick<ActivityProps, "source" | "mic" | "camera" | "locked">, onNote: (n: NoteEvent) => void) {
  const t0 = useRef(performance.now());
  const cb = useRef(onNote);
  cb.current = onNote;
  const locked = useRef(p.locked);
  locked.current = p.locked;

  // Melo listens whenever the microphone is on: the child may answer on the screen keys or on a
  // real keyboard. Once a real-instrument note is heard, the answer is scored as "mic".
  const usedMic = useRef(false);
  useEffect(() => {
    t0.current = performance.now();
    if (!p.mic) return;
    return p.mic.onNote((n) => {
      if (locked.current) return;
      usedMic.current = true;
      cb.current({ midi: n.midi, t: Math.round(performance.now() - t0.current), conf: n.conf, camera_agrees: cameraAgrees(p.camera?.latest ?? null, n.midi) });
    });
  }, [p.mic, p.camera]);

  return {
    fromPiano: (midi: number) => {
      if (locked.current) return;
      cb.current({ midi, t: Math.round(performance.now() - t0.current), conf: 1 });
    },
    resetClock: () => { t0.current = performance.now(); usedMic.current = false; },
    /** "mic" when any note of this answer was heard from a real instrument. */
    sourceUsed: (): "screen" | "mic" => (usedMic.current ? "mic" : p.source),
  };
}

/** Call `fn` once after `ms` of inactivity; `poke()` restarts the timer. */
export function useIdle(ms: number, fn: () => void, active: boolean) {
  const timer = useRef<number | null>(null);
  const cb = useRef(fn);
  cb.current = fn;
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return () => {
    if (!active) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = window.setTimeout(() => cb.current(), ms);
  };
}

/** Submit `timed_out` if the child does nothing for a while (they may have wandered off). */
export function useNoResponseTimeout(ms: number, locked: boolean, onTimeout: () => void, deps: unknown[]) {
  const cb = useRef(onTimeout);
  cb.current = onTimeout;
  useEffect(() => {
    if (locked) return;
    const id = window.setTimeout(() => cb.current(), ms);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked, ...deps]);
}
