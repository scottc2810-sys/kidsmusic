// "How music is made" in four tiny ideas, one card at a time with a Next button: one key = one sound,
// right = high / left = low, long and short, sounds in order = a song. Each card plays what it says.
import { useEffect, useRef, useState } from "react";
import type { Language } from "../languages";
import { speak, stopSpeaking } from "../audio/speech";
import { playSequence } from "../audio/synth";
import { L, t } from "../i18n";
import { CONCEPTS } from "../teaching/explain";
import type { InstrumentInfo } from "../teaching/instrument";
import { InstrumentView } from "./InstrumentView";

export function ConceptCards({ lang, inst, onDone }: { lang: Language; inst: InstrumentInfo; onDone: () => void }) {
  const [i, setI] = useState(0);
  const [lit, setLit] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);
  const c = CONCEPTS[i];
  const demo = async () => {
    setBusy(true);
    await playSequence(c.demo.map((d) => ({ midi: d.midi, beats: d.beats })), 90, (k) => setLit(k >= 0 ? c.demo[k].midi : null)).done;
    if (alive.current) { setLit(null); setBusy(false); }
  };
  useEffect(() => {
    alive.current = true;
    void (async () => { await speak(L(c.say, lang), lang, "calm"); if (alive.current) await demo(); })();
    return () => { alive.current = false; stopSpeaking(); };
  }, [i]); // eslint-disable-line react-hooks/exhaustive-deps
  const last = i === CONCEPTS.length - 1;
  return (
    <section className="concept card" aria-live="polite">
      <small className="muted">{t("howMusic", lang)} · {i + 1}/{CONCEPTS.length}</small>
      <span className="concept-icon" aria-hidden>{c.icon}</span>
      <h2>{L(c.title, lang)}</h2>
      <p>{L(c.say, lang)}</p>
      <InstrumentView inst={inst} lang={lang} from={48} to={72} lit={lit} tune={c.demo.map((d) => d.midi)} onPlay={() => { /* free to try */ }} />
      <div className="row center wrap">
        <button className="btn ghost" onClick={() => void demo()} disabled={busy}>🔊 {t("tryIt", lang)}</button>
        <button className="btn next-step" key={i} onClick={() => (last ? onDone() : setI(i + 1))}>{last ? `▶ ${t("letsGo", lang)}` : `👉 ${t("next", lang)}`}</button>
      </div>
    </section>
  );
}
