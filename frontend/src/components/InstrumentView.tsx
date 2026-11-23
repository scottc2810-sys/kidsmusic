// The child's own instrument on screen: keys (keyboard, harmonium, melodica), bars (xylophone,
// glockenspiel) or a drum. Same props as the Piano, so lessons do not care which one is shown.
// Without an instrument profile this is exactly the standard screen piano.
import { useMemo } from "react";

import { playNote } from "../audio/synth";
import { barsCanPlay, isBlack, keyLabel, layoutOf, type InstrumentInfo } from "../teaching/instrument";
import { KEY_COLORS, Piano, type PianoProps } from "./Piano";

export interface InstrumentViewProps extends Omit<PianoProps, "labelFor" | "stickers"> {
  inst: InstrumentInfo;
  /** The notes of the tune being learned (decides whether bars can show it). */
  tune?: number[];
}

export function InstrumentView(props: InstrumentViewProps) {
  const { inst, tune = [], lang } = props;
  const layout = layoutOf(inst);
  if (layout === "pads") return <DrumPad {...props} />;
  if (layout === "bars" && barsCanPlay(tune)) return <Bars {...props} />;
  // keys: clip the window to the keys the real instrument has
  const lo = inst.set && inst.low != null ? Math.max(props.from ?? 60, inst.low) : props.from;
  const hi = inst.set && inst.high != null ? Math.min(props.to ?? 72, inst.high) : props.to;
  return (
    <>
      {inst.set && inst.low != null && inst.high != null && layout === "keys" && !inst.stand_in && (inst.high - inst.low) > ((hi ?? 72) - (lo ?? 60)) + 2 && (
        <MiniMap low={inst.low} high={inst.high} from={lo ?? 60} to={hi ?? 72} />
      )}
      <Piano {...props} from={lo} to={hi} labelFor={inst.set ? (m) => keyLabel(m, inst, lang) : undefined} stickers={inst.set && inst.labels === "colors"} />
    </>
  );
}

/** A thin picture of the whole real keyboard with the part on screen marked: "your hands go here". */
function MiniMap({ low, high, from, to }: { low: number; high: number; from: number; to: number }) {
  const keys = useMemo(() => Array.from({ length: high - low + 1 }, (_, i) => low + i).filter((m) => !isBlack(m)), [low, high]);
  return (
    <div className="mini-map" aria-label="Where this is on your keyboard">
      {keys.map((m) => <i key={m} className={`${m >= from && m <= to ? "on" : ""}${m % 12 === 0 && m === 60 ? " home" : ""}`} />)}
      <small>👆 This part of your keyboard</small>
    </div>
  );
}

/** Xylophone / glockenspiel: one row of coloured bars, long (low) on the left, short (high) on the right. */
function Bars({ inst, lang, onPlay, highlight, dimOthers, glow, lit, disabled, silent }: InstrumentViewProps) {
  const bars = useMemo(() => {
    const out: number[] = [];
    for (let m = inst.low ?? 60; m <= (inst.high ?? 72); m++) if (!isBlack(m)) out.push(m);
    return out;
  }, [inst.low, inst.high]);
  const hl = new Set(highlight ?? []);
  const press = (m: number) => { if (disabled) return; if (!silent) playNote(m, { timbre: "bell", duration: 0.8 }); onPlay?.(m); };
  return (
    <div className={`bars ${disabled ? "disabled" : ""}`} role="group" aria-label="Xylophone">
      {bars.map((m, i) => (
        <button key={m} disabled={disabled} aria-label={`Bar ${i + 1}`}
          className={["bar", hl.has(m) ? "hl" : dimOthers && highlight ? "dim" : "", glow === m ? "glow" : "", lit === m ? "lit" : ""].join(" ")}
          style={{ ["--key-color" as string]: KEY_COLORS[m % 12], height: `${100 - (i / Math.max(1, bars.length - 1)) * 45}%` }}
          onPointerDown={(e) => { e.preventDefault(); press(m); }}>
          <span>{keyLabel(m, inst, lang)}</span>
        </button>
      ))}
    </div>
  );
}

/** A drum: no high and low, only WHEN. Every tap counts as the next note, so the child learns rhythm. */
function DrumPad({ onPlay, glow, lit, disabled, silent }: InstrumentViewProps) {
  const press = () => { if (disabled) return; if (!silent) playNote(48, { timbre: "drum", duration: 0.3 }); onPlay?.(glow ?? 60); };
  return (
    <div className="drum-wrap">
      <button className={`drum-pad${glow != null ? " glow" : ""}${lit != null ? " lit" : ""}`} disabled={disabled} aria-label="Drum"
        onPointerDown={(e) => { e.preventDefault(); press(); }}>🥁</button>
    </div>
  );
}
