// A shloka: Devanagari, transliteration, source, simple meaning and the everyday lesson, with a "recite"
// button (a Hindi / Sanskrit voice reads the Devanagari; otherwise the app voice reads the transliteration).
import { useState } from "react";
import { sayIn, speak } from "../audio/speech";
import { L, type Text } from "../i18n";
import type { Language } from "../languages";
import { SHLOKAS, shlokaOfTheDay, type Shloka } from "../subjects/shlokas";

const TXT = {
  recite: { en: "Recite", hi: "पाठ करो", hinglish: "Paath karo" }, meaning: { en: "Meaning", hi: "अर्थ", hinglish: "Arth" },
  lesson: { en: "For your life", hi: "जीवन के लिए", hinglish: "Jeevan ke liye" }, ofDay: { en: "Shloka of the day", hi: "आज का श्लोक", hinglish: "Aaj ka shlok" },
} satisfies Record<string, Text>;

export async function recite(sh: Shloka, lang: Language) {
  const ok = await sayIn(sh.dev, "hi-IN", 0.7);
  if (!ok) await speak(sh.iast.replace(/\|/g, ","), lang);
}

export function ShlokaView({ sh, lang, compact = false }: { sh: Shloka; lang: Language; compact?: boolean }) {
  const [busy, setBusy] = useState(false);
  return (
    <figure className={`shloka${compact ? " compact" : ""}`}>
      <blockquote lang="sa" className="shloka-dev">{sh.dev}</blockquote>
      <p className="shloka-iast" lang="sa-Latn">{sh.iast}</p>
      <figcaption className="muted small">— {sh.source}</figcaption>
      {!compact && <p><strong>{L(TXT.meaning, lang)}:</strong> {L(sh.meaning, lang)}</p>}
      {!compact && <p>🌟 <strong>{L(TXT.lesson, lang)}:</strong> {L(sh.lesson, lang)}</p>}
      <button className="btn ghost small" disabled={busy} onClick={() => { setBusy(true); void recite(sh, lang).finally(() => setBusy(false)); }}>🔊 {L(TXT.recite, lang)}</button>
    </figure>
  );
}

/** One shloka a day for a subject, linking it to its Vedic roots (music: Sāma Veda, maths: Vedāṅga Jyotiṣa …). */
export function ShlokaOfTheDay({ subject, lang }: { subject: string; lang: Language }) {
  const sh = shlokaOfTheDay(subject);
  const [open, setOpen] = useState(false);
  return (
    <details className="card shloka-day" open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary>🪔 {L(TXT.ofDay, lang)}: <span lang="sa">{sh.dev.split("।")[0]}…</span></summary>
      <ShlokaView sh={sh} lang={lang} />
    </details>
  );
}

export const shlokaById = (id: string) => SHLOKAS[id];
