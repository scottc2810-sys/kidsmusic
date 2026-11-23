import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NoteEvent } from "../api";
import { playNote, playSequence, sleep } from "../audio/synth";
import { NoteGuide } from "../components/NoteGuide";
import { Piano, rangeFor } from "../components/Piano";
import { sungName, t } from "../i18n";
import { keyLabel } from "../teaching/instrument";
import { type ActivityProps, useIdle, useNoResponseTimeout, useNoteInput } from "./common";

type Kind = "find_note" | "echo_melody" | "play_song" | "free_play";

const pcEq = (a: number, b: number) => ((a - b) % 12 + 12) % 12 === 0;

/** Piano activities. Works with the on-screen piano or a real instrument via the microphone. */
export function NotesActivity({ kind, spec, lang, source, mic, camera, onSubmit, locked, reveal, inst }: ActivityProps & { kind: Kind }) {
  const target: number[] = useMemo(
    () => (kind === "find_note" ? [spec.target] : kind === "free_play" ? [] : spec.notes),
    [kind, spec],
  );
  const keys: number[] = spec.keys ?? target;
  const [lo, hi] = rangeFor([...keys, ...target]);
  const [phase, setPhase] = useState<"listen" | "play">(kind === "free_play" ? "play" : "listen");
  const [lit, setLit] = useState<number | null>(null);
  const [pos, setPos] = useState(0); // guided-song pointer
  const [demoIdx, setDemoIdx] = useState<number | null>(null); // note sounding in Melo's demo
  const [mine, setMine] = useState<number[]>([]); // free play: the tune the child is making
  const [secondsLeft, setSecondsLeft] = useState<number>(spec.seconds ?? 0);
  const notes = useRef<NoteEvent[]>([]);
  const submitted = useRef(false);

  const submit = useCallback((extra: Record<string, unknown> = {}) => {
    if (submitted.current || locked) return;
    submitted.current = true;
    onSubmit({ source: input.sourceUsed(), notes: notes.current.slice(0, 400), ...extra });
  }, [locked, onSubmit]); // eslint-disable-line react-hooks/exhaustive-deps

  const demo = useCallback(async () => {
    if (kind === "free_play") return;
    setPhase("listen");
    if (kind === "find_note") {
      setLit(spec.highlight ? spec.target : null);
      playNote(spec.target, { duration: 1.0 });
      await sleep(1200);
      setLit(null);
    } else {
      const beats: number[] | undefined = spec.beats;
      const showKeys = kind === "play_song" || spec.highlight;
      await playSequence(target.map((m, i) => ({ midi: m, beats: beats?.[i] ?? 1, sing: sungName(m, lang) })), spec.bpm ?? 90,
        (i) => { setLit(i >= 0 && showKeys ? target[i] : null); setDemoIdx(i >= 0 ? i : null); }).done;
      setDemoIdx(null);
    }
    notes.current = [];
    setPos(0);
    input.resetClock();
    setPhase("play");
  }, [kind, spec, target]); // eslint-disable-line react-hooks/exhaustive-deps

  const started = useRef(false);
  useEffect(() => {
    if (locked || started.current) return; // start after Melo's instruction
    started.current = true;
    submitted.current = false;
    notes.current = [];
    const id = window.setTimeout(() => { if (kind !== "free_play") void demo(); }, 300);
    return () => clearTimeout(id);
  }, [spec, locked]); // eslint-disable-line react-hooks/exhaustive-deps

  // free play: countdown, then submit and play the child's own melody back
  useEffect(() => {
    if (kind !== "free_play" || locked) return;
    setSecondsLeft(spec.seconds);
    const id = window.setInterval(() => setSecondsLeft((s) => {
      if (s <= 1) { clearInterval(id); submit(); return 0; }
      return s - 1;
    }), 1000);
    return () => clearInterval(id);
  }, [kind, spec, locked, submit]);

  useEffect(() => {
    if (kind === "free_play" && reveal?.melody?.length) {
      void playSequence(reveal.melody.map((m) => ({ midi: m, beats: 0.5 })), 100, (i) => setLit(i >= 0 ? reveal.melody![i] : null)).done;
    }
  }, [kind, reveal]);

  const idleMs = kind === "play_song" ? 6000 : 2200;
  const poke = useIdle(idleMs, () => {
    if (kind === "free_play") return;
    const need = kind === "find_note" ? 1 : Math.ceil(target.length * 0.6);
    if (notes.current.length >= need) submit();
  }, phase === "play" && !locked);
  useNoResponseTimeout(kind === "play_song" ? 60000 : 35000, locked, () => {
    if (kind !== "free_play") submit({ timed_out: notes.current.length === 0 });
  }, [spec, phase]);

  const input = useNoteInput({ source, mic, camera, locked }, (n) => {
    if (phase !== "play" || submitted.current) return;
    notes.current.push(n);
    if (kind === "free_play") setMine((m) => [...m, n.midi].slice(-24));
    if (n.conf < 1 || source === "mic") { setLit(n.midi); window.setTimeout(() => setLit(null), 300); } // show the key Melo heard
    const count = notes.current.length;
    if (kind === "find_note") {
      if (pcEq(n.midi, spec.target) && (source === "mic" || n.midi === spec.target)) return submit();
      if (count >= spec.tries) return submit();
    } else if (kind === "echo_melody") {
      const recent = notes.current.slice(-target.length).map((x) => x.midi);
      if (recent.length === target.length && recent.every((m, i) => pcEq(m, target[i]))) return submit();
      if (count >= target.length + 4) return submit();
    } else if (kind === "play_song") {
      if (pos < target.length && pcEq(n.midi, target[pos])) {
        const nextPos = pos + 1;
        setPos(nextPos);
        if (nextPos >= target.length) return submit();
      }
      if (count >= target.length * 2 + 4) return submit();
    }
    poke();
  });

  const guidedGlow = kind === "play_song" && phase === "play"
    ? (spec.guided || pos === 0 ? target[pos] ?? null : null)
    : null;
  const highlight = kind === "free_play" ? spec.keys : spec.highlight || kind === "play_song" ? keys : undefined;

  return (
    <div className={`activity notes ${kind}`}>
      {kind === "play_song" && <h3 className="song-title">🎵 {spec.title}</h3>}
      {kind === "play_song" && (
        <div className="song-progress" aria-label="Song progress">
          <div style={{ width: `${(pos / Math.max(1, target.length)) * 100}%` }} />
        </div>
      )}
      {kind === "free_play" && <div className="countdown">⏳ {secondsLeft}</div>}
      {/* Show exactly what to press and when, wherever the lesson already reveals the keys. */}
      {((kind === "play_song" && spec.guided) || (kind === "echo_melody" && spec.highlight)) && (
        <NoteGuide notes={target} beats={kind === "play_song" ? spec.beats : undefined} lang={lang} bpm={spec.bpm ?? 90}
          active={phase === "listen" ? demoIdx : kind === "play_song" ? pos : null} done={phase === "play" && kind === "play_song" ? pos : 0}
          running={phase === "listen"} />
      )}
      {kind === "free_play" && mine.length > 0 && <NoteGuide notes={mine} lang={lang} label="Your tune" />}
      <p className="phase">{phase === "listen" ? t("listen", lang) : source === "mic" ? `🎤 ${t("yourTurn", lang)}` : t("yourTurn", lang)}</p>
      <Piano
        from={lo}
        to={hi}
        lang={lang}
        onPlay={input.fromPiano}
        highlight={highlight}
        dimOthers={kind === "find_note" && spec.highlight}
        glow={guidedGlow}
        lit={lit}
        disabled={locked || phase !== "play"}
        silent={false}
        labelFor={inst?.set ? (m) => keyLabel(m, inst, lang) : undefined}
        stickers={!!inst?.set && inst.labels === "colors"}
      />
      <div className="row">
        {kind !== "free_play" && (
          <button className="btn ghost" onClick={() => void demo()} disabled={phase === "listen" || locked}>🔁 {t("again", lang)}</button>
        )}
        {(kind === "play_song" || kind === "echo_melody" || kind === "free_play") && (
          <button className="btn" onClick={() => submit()} disabled={locked || notes.current.length === 0}>✅ {t("done", lang)}</button>
        )}
      </div>
    </div>
  );
}
