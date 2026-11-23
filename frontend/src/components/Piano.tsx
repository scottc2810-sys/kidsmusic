import { useEffect, useMemo, useRef } from "react";
import type { Language } from "../api";
import { playNote } from "../audio/synth";
import { noteLabel } from "../i18n";

const BLACK = new Set([1, 3, 6, 8, 10]);
// Rainbow colours per pitch class (C red ... B violet): a common early-years music convention.
export const KEY_COLORS = ["#ff5a5f", "#ff5a5f", "#ff9f1c", "#ff9f1c", "#ffd23f", "#3bceac", "#3bceac", "#3a86ff", "#3a86ff", "#6c4cf1", "#6c4cf1", "#c77dff"];
const KEYMAP = ["a", "s", "d", "f", "g", "h", "j", "k", "l", ";"];

export interface PianoProps {
  from?: number;
  to?: number;
  lang: Language;
  onPlay?: (midi: number) => void;
  highlight?: number[]; // keys that are part of this exercise
  dimOthers?: boolean;
  glow?: number | null; // the key to press next (guided mode)
  lit?: number | null; // key currently sounding (demo playback / detected by mic)
  disabled?: boolean;
  silent?: boolean; // don't make sound (e.g. real-instrument mode just displays)
  labelFor?: (midi: number) => string; // what is printed on the child's own keys (stickers); note names otherwise
  stickers?: boolean; // the child's keys have colour stickers: show the colour on every white key
}

export function Piano({ from = 60, to = 72, lang, onPlay, highlight, dimOthers, glow, lit, disabled, silent, labelFor, stickers }: PianoProps) {
  const keys = useMemo(() => Array.from({ length: to - from + 1 }, (_, i) => from + i), [from, to]);
  const whites = keys.filter((k) => !BLACK.has(k % 12));
  const hl = useMemo(() => new Set(highlight ?? []), [highlight]);
  const cb = useRef(onPlay);
  cb.current = onPlay;

  const press = (m: number) => {
    if (disabled) return;
    if (!silent) playNote(m, { timbre: "piano", duration: 0.5 });
    cb.current?.(m);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || disabled || (e.target as HTMLElement)?.tagName === "INPUT") return;
      const idx = KEYMAP.indexOf(e.key.toLowerCase());
      if (idx >= 0 && idx < whites.length) press(whites[idx]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const cls = (m: number) =>
    [
      "key",
      BLACK.has(m % 12) ? "black" : "white",
      hl.has(m) ? "hl" : dimOthers && highlight ? "dim" : "",
      glow === m ? "glow" : "",
      lit === m ? "lit" : "",
      stickers ? "sticker" : "",
    ].join(" ");

  const whiteW = 100 / whites.length;
  return (
    <div className={`piano ${disabled ? "disabled" : ""}`} role="group" aria-label="Piano keyboard">
      {whites.map((m) => (
        <button
          key={m}
          className={cls(m)}
          style={{ ["--key-color" as string]: KEY_COLORS[m % 12] }}
          onPointerDown={(e) => { e.preventDefault(); press(m); }}
          aria-label={`Key ${noteLabel(m, "en")}`}
          disabled={disabled}
        >
          <span className="key-label">{labelFor ? labelFor(m) : noteLabel(m, lang)}</span>
        </button>
      ))}
      {keys.filter((m) => BLACK.has(m % 12)).map((m) => {
        const leftWhites = whites.filter((w) => w < m).length;
        return (
          <button
            key={m}
            className={cls(m)}
            style={{ left: `calc(${leftWhites * whiteW}% - ${whiteW * 0.3}%)`, width: `${whiteW * 0.6}%`, ["--key-color" as string]: KEY_COLORS[m % 12] }}
            onPointerDown={(e) => { e.preventDefault(); press(m); }}
            aria-label={`Key ${noteLabel(m, "en")}`}
            disabled={disabled}
          />
        );
      })}
    </div>
  );
}

/** Range that comfortably fits a set of notes, snapped to C..C. */
export function rangeFor(notes: number[]): [number, number] {
  const lo = Math.min(60, ...notes);
  const hi = Math.max(72, ...notes);
  const pc = (m: number) => ((m % 12) + 12) % 12;
  return [lo - pc(lo), hi + ((12 - pc(hi)) % 12)];
}
