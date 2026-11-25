import { useEffect, useMemo, useRef, useState } from "react";
import type { Language } from "../api";
import { playNote } from "../audio/synth";
import { foldIntoRange, midiEcho, onMidiNote } from "../audio/midi";
import { noteLabel } from "../i18n";

const BLACK = new Set([1, 3, 6, 8, 10]);
// Rainbow colours per pitch class (C red ... B violet): a common early-years music convention.
const RAINBOW = ["#ff5a5f", "#ff5a5f", "#ff9f1c", "#ff9f1c", "#ffd23f", "#3bceac", "#3bceac", "#3a86ff", "#3a86ff", "#6c4cf1", "#6c4cf1", "#c77dff"];
// Okabe-Ito colours: told apart by children with red-green colour blindness (about 1 boy in 12).
const COLOUR_SAFE = ["#D55E00", "#D55E00", "#E69F00", "#E69F00", "#F0E442", "#009E73", "#009E73", "#56B4E9", "#56B4E9", "#0072B2", "#0072B2", "#CC79A7"];
export type Palette = "rainbow" | "colourblind";
const readPalette = (): Palette => { try { return localStorage.getItem("melo.palette") === "colourblind" ? "colourblind" : "rainbow"; } catch { return "rainbow"; } };
/** Key colours by pitch class. The same array is updated in place when the parent changes the palette. */
export const KEY_COLORS = [...(readPalette() === "colourblind" ? COLOUR_SAFE : RAINBOW)];
export const getPalette = readPalette;
export function setPalette(p: Palette) {
  try { localStorage.setItem("melo.palette", p); } catch { /* private mode */ }
  KEY_COLORS.splice(0, 12, ...(p === "colourblind" ? COLOUR_SAFE : RAINBOW));
}

// Computer keys: the home row plays the white keys, the row above plays the black key between them
// (a=C, w=C#, s=D, e=D#, d=E, f=F, t=F#, g=G ...), the layout most music software uses.
const WHITE_KEYS = ["a", "s", "d", "f", "g", "h", "j", "k", "l", ";"];
const BLACK_KEYS = ["w", "e", "r", "t", "y", "u", "i", "o", "p"];

/** Which on-screen key a computer key plays (null = none). */
export function keyForComputerKey(key: string, keys: number[]): number | null {
  const whites = keys.filter((k) => !BLACK.has(k % 12));
  const k = key.toLowerCase();
  const wi = WHITE_KEYS.indexOf(k);
  if (wi >= 0) return wi < whites.length ? whites[wi] : null;
  const bi = BLACK_KEYS.indexOf(k);
  if (bi >= 0 && bi < whites.length) {
    const black = whites[bi] + 1;
    return BLACK.has(black % 12) && keys.includes(black) ? black : null;
  }
  return null;
}

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
  const [down, setDown] = useState<number | null>(null);
  const cb = useRef(onPlay);
  cb.current = onPlay;

  const press = (m: number, sound = true) => {
    if (disabled) return;
    if (!silent && sound) playNote(m, { timbre: "piano", duration: 0.5 });
    setDown(m);
    window.setTimeout(() => setDown((d) => (d === m ? null : d)), 180);
    cb.current?.(m);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || disabled || e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const m = keyForComputerKey(e.key, keys);
      if (m != null) press(m);
    };
    window.addEventListener("keydown", onKey);
    // a real keyboard (USB / Bluetooth MIDI): played notes come in exactly
    const offMidi = onMidiNote((midi) => press(foldIntoRange(midi, from, to), midiEcho()));
    return () => { window.removeEventListener("keydown", onKey); offMidi(); };
  });

  const cls = (m: number) =>
    [
      "key",
      BLACK.has(m % 12) ? "black" : "white",
      hl.has(m) ? "hl" : dimOthers && highlight ? "dim" : "",
      glow === m ? "glow" : "",
      lit === m || down === m ? "lit" : "",
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
