// The child's own view of the progress tracker: "My star map". The same spider charts as the parents see,
// but with pictures instead of numbers, stars instead of bands, and Melo reading out one thing the child is
// good at and one thing to practise next. Never a ranking, never a red mark.
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, type Tracker } from "../api";
import { speak } from "../audio/speech";
import { Melo } from "../components/Melo";
import { SpiderChart } from "../components/SpiderChart";
import { ResultsSummary, STAR_TIP } from "../components/ResultsSummary";
import { L, type Text } from "../i18n";
import { KidShell, useChild } from "./KidHome";

const TITLE: Text = { en: "My star map", hi: "मेरा सितारों का नक्शा", hinglish: "Mera star map" };
const GOOD: Text = { en: "You are great at", hi: "तुम बहुत अच्छे हो", hinglish: "Tum bahut achhe ho" };
const NEXT: Text = { en: "Let's practise", hi: "चलो अभ्यास करें", hinglish: "Chalo practice karein" };
const START: Text = { en: "Play a little and your stars will appear here!", hi: "थोड़ा खेलो, यहाँ सितारे दिखेंगे!", hinglish: "Thoda khelo, yahan stars dikhenge!" };
const stars = (v: number | null) => (v == null ? "·" : "⭐".repeat(Math.max(1, Math.min(5, Math.ceil(v / 20)))));

export function StarMap() {
  const { id = "" } = useParams();
  const { child } = useChild(id);
  const nav = useNavigate();
  const [t, setT] = useState<Tracker | null>(null);
  useEffect(() => { api.tracker(id).then(setT).catch(() => setT(null)); }, [id]);
  const lang = child?.language ?? "en";
  const areas = (t?.areas ?? []).filter((a) => a.axes.some((x) => x.final != null));
  const best = areas.flatMap((a) => a.axes).filter((x) => x.final != null).sort((a, b) => (b.final ?? 0) - (a.final ?? 0));
  const line = best.length
    ? `${L(GOOD, lang)} ${best[0].label}! ${best.length > 1 ? `${L(NEXT, lang)}: ${best[best.length - 1].label}.` : ""}`
    : L(START, lang);
  useEffect(() => { if (t && child) void speak(line, child.language, "proud"); }, [t, child]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!child) return <div className="center-screen"><div className="spinner" /></div>;
  return (
    <KidShell child={child} music="home">
      <div className="lesson wide">
        <h1>✨ {L(TITLE, lang)}</h1>
        <Melo mood={best.length ? "proud" : "happy"} size={110} say={line} />
        {t && <ResultsSummary t={t} lang={lang} kid />}
        <div className="star-maps">
          {areas.map((a) => (
            <div key={a.id} className="star-map-card">
              <SpiderChart kid size={260} showBefore={false} title={`${a.emoji} ${a.title}`}
                axes={a.axes.map((x) => ({ id: x.id, label: x.label, emoji: x.emoji, value: x.final, band: x.band }))} />
              <ul className="kid-stars">{a.axes.map((x) => {
                const tip = `${x.label}: ${x.band ?? "not yet"}${x.final != null ? ` (${Math.round(x.final)}/100)` : ""}. ${L(STAR_TIP, lang)}`;
                return <li key={x.id} tabIndex={0} title={tip} data-tip={tip}><span aria-hidden>{x.emoji}</span><span className="kid-star-label">{x.label}</span><span aria-label={x.band ?? "not yet"}>{stars(x.final)}</span></li>;
              })}</ul>
            </div>
          ))}
        </div>
        <button className="btn ghost" onClick={() => nav(`/play/${id}`)}>🏠</button>
      </div>
    </KidShell>
  );
}
