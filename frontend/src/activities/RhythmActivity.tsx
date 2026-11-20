import { useCallback, useEffect, useRef, useState } from "react";
import { playNote, playRhythm, sleep } from "../audio/synth";
import { t } from "../i18n";
import { type ActivityProps, useIdle, useNoResponseTimeout } from "./common";

/** Melo drums a pattern; the child taps it back on a big drum (or Space bar). */
export function RhythmActivity({ spec, lang, onSubmit, locked }: ActivityProps) {
  const pattern: number[] = spec.pattern;
  const [phase, setPhase] = useState<"listen" | "play">("listen");
  const [hit, setHit] = useState(-1);
  const [taps, setTaps] = useState<number[]>([]);
  const t0 = useRef<number | null>(null);
  const tapsRef = useRef<number[]>([]);

  const demo = useCallback(async () => {
    setPhase("listen");
    tapsRef.current = [];
    setTaps([]);
    t0.current = null;
    await playRhythm(pattern, spec.bpm, setHit).done;
    setHit(-1);
    await sleep(300);
    setPhase("play");
  }, [pattern, spec.bpm]);

  const started = useRef(false);
  useEffect(() => {
    if (locked || started.current) return;
    started.current = true;
    const id = window.setTimeout(demo, 300);
    return () => clearTimeout(id);
  }, [demo, locked]);

  const finish = useCallback(() => {
    if (!locked && tapsRef.current.length) onSubmit({ taps: tapsRef.current });
  }, [locked, onSubmit]);
  const poke = useIdle(Math.max(1400, (60000 / spec.bpm) * 2), finish, phase === "play" && !locked);
  useNoResponseTimeout(30000, locked || taps.length > 0, () => onSubmit({ timed_out: true, taps: [] }), [spec]);

  const tap = () => {
    if (phase !== "play" || locked) return;
    const now = performance.now();
    if (t0.current === null) t0.current = now;
    playNote(48, { timbre: "drum", gain: 0.6 });
    tapsRef.current = [...tapsRef.current, Math.round(now - t0.current)];
    setTaps(tapsRef.current);
    if (tapsRef.current.length >= pattern.length + 6) finish();
    else poke();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.code === "Space" && !e.repeat) { e.preventDefault(); tap(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="activity rhythm">
      <div className="beats" aria-hidden>
        {pattern.map((_, i) => <span key={i} className={`beat ${hit === i ? "on" : ""} ${taps.length > i ? "tapped" : ""}`} />)}
      </div>
      <p className="phase">{phase === "listen" ? t("listen", lang) : t("tapHere", lang)}</p>
      <button className={`drum ${phase === "play" ? "ready" : ""}`} onPointerDown={(e) => { e.preventDefault(); tap(); }} disabled={locked || phase !== "play"}
        aria-label="Drum">🥁</button>
      <button className="btn ghost" onClick={demo} disabled={phase === "listen" || locked}>🔁 {t("again", lang)}</button>
    </div>
  );
}
