import { useCallback, useEffect, useRef, useState } from "react";
import { playNote, playSequence, sleep, type Timbre } from "../audio/synth";
import { L, TIMBRE_ICON, TIMBRE_LABEL, t } from "../i18n";
import { type ActivityProps, useNoResponseTimeout } from "./common";

type Kind = "high_low" | "loud_soft" | "instrument_guess" | "same_different" | "fast_slow";

/** Listening games with big picture choices: high/low, loud/soft, instrument, same/different. */
export function ChoiceActivity({ kind, spec, lang, onSubmit, locked, reveal }: ActivityProps & { kind: Kind }) {
  const [playing, setPlaying] = useState<number | null>(null);
  const [chosen, setChosen] = useState<number | null>(null);
  const cancelled = useRef(false);

  const demo = useCallback(async () => {
    cancelled.current = false;
    if (kind === "high_low") {
      for (let i = 0; i < 2 && !cancelled.current; i++) {
        setPlaying(i);
        playNote(spec.notes[i], { duration: 0.9 });
        await sleep(1100);
      }
    } else if (kind === "loud_soft") {
      for (let i = 0; i < 2 && !cancelled.current; i++) {
        setPlaying(i);
        playNote(spec.note, { gain: spec.gains[i], duration: 0.9 });
        await sleep(1100);
      }
    } else if (kind === "fast_slow") {
      for (let i = 0; i < 2 && !cancelled.current; i++) {
        setPlaying(i);
        await playSequence(spec.notes.map((m: number) => ({ midi: m })), spec.bpms[i]).done;
        await sleep(600);
      }
    } else if (kind === "instrument_guess") {
      setPlaying(-2);
      await playSequence([{ midi: spec.note, timbre: spec.play as Timbre, beats: 1 }, { midi: spec.note + 4, timbre: spec.play as Timbre, beats: 1 },
        { midi: spec.note + 7, timbre: spec.play as Timbre, beats: 2 }], 100).done;
    } else {
      for (let i = 0; i < 2 && !cancelled.current; i++) {
        setPlaying(i);
        await playSequence((i === 0 ? spec.a : spec.b).map((m: number) => ({ midi: m })), 100).done;
        await sleep(500);
      }
    }
    setPlaying(null);
  }, [kind, spec]);

  const started = useRef(false);
  useEffect(() => {
    if (locked || started.current) return; // wait until Melo has finished the instruction
    started.current = true;
    const id = window.setTimeout(demo, 300);
    return () => { cancelled.current = true; clearTimeout(id); };
  }, [demo, locked]);

  useNoResponseTimeout(35000, locked, () => onSubmit({ timed_out: true }), [spec]);

  const choose = (i: number) => {
    if (locked || chosen !== null) return;
    setChosen(i);
    onSubmit({ choice: i });
  };

  let options: { icon: string; label: string }[];
  if (kind === "instrument_guess") {
    options = spec.options.map((o: string) => ({ icon: TIMBRE_ICON[o] ?? "🎵", label: (TIMBRE_LABEL[o] ? L(TIMBRE_LABEL[o], lang) : o) }));
  } else if (kind === "same_different") {
    options = [{ icon: "👯", label: t("same", lang) }, { icon: "🔀", label: t("different", lang) }];
  } else {
    const icons = kind === "high_low" ? ["🔊", "🔊"] : ["🔈", "🔈"];
    options = [{ icon: icons[0], label: t("sound1", lang) }, { icon: icons[1], label: t("sound2", lang) }];
  }

  return (
    <div className="activity choice">
      {kind === "high_low" && <div className="hint-row" aria-hidden><span>🐘 ↓</span><span>↑ 🐦</span></div>}
      {kind === "loud_soft" && <div className="hint-row" aria-hidden><span>🐱 soft</span><span>LOUD 🦁</span></div>}
      {kind === "fast_slow" && <div className="hint-row" aria-hidden><span>🐢 slow</span><span>FAST 🐇</span></div>}
      <div className={`choices n${options.length}`}>
        {options.map((o, i) => (
          <button
            key={i}
            className={["choice-btn", playing === i ? "playing" : "", chosen === i ? "chosen" : "",
              reveal?.correct === i ? "correct" : ""].join(" ")}
            onClick={() => choose(i)}
            disabled={locked}
          >
            <span className="choice-icon">{o.icon}</span>
            <span className="choice-label">{o.label}</span>
          </button>
        ))}
      </div>
      <button className="btn ghost" onClick={demo} disabled={playing !== null || locked}>🔁 {t("again", lang)}</button>
    </div>
  );
}
