// The "note path": shows exactly what to press and when, so a child can follow along.
// One coloured block per note (same colour as its piano key), labelled with the note name and the
// song word. Width = how long the note lasts; dots under it = beats to count; "hold" for long notes.
import { useEffect, useRef } from "react";
import type { Language } from "../api";
import { L, noteLabel, type Text } from "../i18n";
import { KEY_COLORS } from "./Piano";

export interface NoteGuideProps {
  notes: number[];
  beats?: number[];
  words?: (string | null)[] | null;
  lang: Language;
  active?: number | null; // note being played / to press now
  done?: number; // notes already played correctly
  bpm?: number; // when set with `running`, the active block fills over its real duration
  running?: boolean;
  label?: string;
  hideNames?: boolean; // "little help": the child recalls which key; only words and beats stay
}

// Light key colours (yellow, teal, orange) need dark text to stay readable.
const DARK_TEXT = new Set([2, 3, 4, 5, 6]);

const HOLD: Text = { en: "hold", hi: "रुको", hinglish: "hold" };

export function NoteGuide({ notes, beats, words, lang, active = null, done = 0, bpm = 90, running = false, label, hideNames = false }: NoteGuideProps) {
  const row = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = active != null ? row.current?.children[active] as HTMLElement | undefined : undefined;
    el?.scrollIntoView?.({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [active]);
  if (!notes.length) return null;
  return (
    <div className="note-guide" aria-label={label ?? "Notes to play"}>
      <div className="ng-row" ref={row}>
        {notes.map((m, i) => {
          const b = beats?.[i] ?? 1;
          const state = i < done ? "done" : i === active ? "now" : "";
          return (
            <div key={i} className={`ng-note ${state}${hideNames && i >= done ? " hidden-name" : ""}`} style={{ ["--c" as string]: KEY_COLORS[m % 12], ["--t" as string]: DARK_TEXT.has(m % 12) ? "#2b2200" : "#fff", ["--w" as string]: String(Math.max(0.6, b)), ["--dur" as string]: `${(b * 60) / bpm}s` }}
              aria-label={`${noteLabel(m, "en")}${b >= 2 ? `, hold ${b} beats` : ""}`}>
              <span className="ng-block">
                <strong>{hideNames && i >= done ? "?" : noteLabel(m, lang)}</strong>
                {state === "now" && running && <i className="ng-fill" />}
                {state === "done" && <span className="ng-tick" aria-hidden>✓</span>}
              </span>
              <span className="ng-beats" aria-hidden>
                {b >= 1 ? Array.from({ length: Math.round(b) }, (_, k) => <i key={k} />) : <i className="half" />}
                {b >= 2 && <em>{L(HOLD, lang)}</em>}
              </span>
              {words?.[i] != null && <span className="ng-word">{words[i] || "~"}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
