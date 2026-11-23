// Results per subject and combined: 🧠 learned, 🌍 uses it in real life, 🔁 remembers, and the overall score
// (learned 45 %, applied 35 %, remembered 20 %). Every icon explains itself on hover or keyboard focus, so a
// parent (or a child) knows exactly what each number and star means.
import type { Tracker } from "../api";
import { L, type Text } from "../i18n";
import type { Language } from "../languages";

export const PART_INFO: Record<"score" | "learned" | "applied" | "remembered", { icon: string; label: Text; tip: Text }> = {
  score: { icon: "⭐", label: { en: "Overall", hi: "कुल", hinglish: "Overall" },
    tip: { en: "Overall result: 45 % what was learned, 35 % using it in real life, 20 % remembering it after a break. Not just activities done.", hi: "कुल परिणाम: 45% सीखा, 35% असली जीवन में उपयोग, 20% बाद में याद। सिर्फ़ गतिविधियाँ नहीं।", hinglish: "Overall result: 45% seekha, 35% real life mein use, 20% baad mein yaad. Sirf activities nahi." } },
  learned: { icon: "🧠", label: { en: "Learned", hi: "सीखा", hinglish: "Seekha" },
    tip: { en: "Learned: the skills shown in the activities (highest level reached and recent accuracy) and the concepts completed.", hi: "सीखा: गतिविधियों में दिखाए कौशल (सबसे ऊँचा स्तर और हाल की सटीकता) और पूरे किए गए विषय।", hinglish: "Seekha: activities mein dikhaye skills (sabse ooncha level aur haal ki accuracy) aur poore kiye gaye concepts." } },
  applied: { icon: "🌍", label: { en: "Uses it in real life", hi: "असली जीवन में उपयोग", hinglish: "Real life mein use" },
    tip: { en: "Uses it in real life: everyday-situation questions (shopping, sharing, safety, choices), story sums, whole songs and the real instrument, real conversations.", hi: "असली जीवन में उपयोग: रोज़ की स्थितियों वाले सवाल, कहानी वाले सवाल, पूरे गाने और असली बाजा, असली बातचीत।", hinglish: "Real life mein use: roz ki situations wale sawaal, story sums, poore gaane aur asli instrument, asli baatcheet." } },
  remembered: { icon: "🔁", label: { en: "Remembers", hi: "याद रखता है", hinglish: "Yaad rakhta hai" },
    tip: { en: "Remembers: right again after a break of a day or more, the sign that learning has really stuck.", hi: "याद: एक दिन या ज़्यादा के बाद फिर सही, यानी सीखा हुआ सच में टिक गया।", hinglish: "Yaad: ek din ya zyada ke baad phir sahi, yaani seekha hua sach mein tik gaya." } },
};
export const STAR_TIP: Text = { en: "Stars: ⭐ 0-20, ⭐⭐ 21-40, ⭐⭐⭐ 41-60, ⭐⭐⭐⭐ 61-80, ⭐⭐⭐⭐⭐ 81-100 on this skill.", hi: "सितारे: ⭐ 0-20 … ⭐⭐⭐⭐⭐ 81-100 इस कौशल में।", hinglish: "Stars: ⭐ 0-20 … ⭐⭐⭐⭐⭐ 81-100 is skill mein." };
const stars = (v: number | null | undefined) => (v == null ? "·" : "⭐".repeat(Math.max(1, Math.min(5, Math.ceil(v / 20)))));

function Row({ k, v, lang, kid }: { k: keyof typeof PART_INFO; v: number | null | undefined; lang: Language; kid: boolean }) {
  const info = PART_INFO[k];
  const tip = L(info.tip, lang);
  return (
    <div className="result-row" tabIndex={0} title={tip} data-tip={tip} aria-label={`${L(info.label, lang)}: ${v ?? "not yet"}. ${tip}`}>
      <span aria-hidden>{info.icon}</span>
      {kid ? <span>{stars(v)}</span> : <><span className="meter"><i style={{ width: `${v ?? 0}%` }} /></span><span>{v == null ? "–" : Math.round(v)}</span></>}
    </div>
  );
}

export function ResultsSummary({ t, lang = "en", kid = false }: { t: Tracker; lang?: Language; kid?: boolean }) {
  const o = t.overall;
  if (!o) return null;
  const areas = o.areas.filter((a) => a.score != null || a.learned != null);
  return (
    <section className="card">
      <h2>{kid ? "✨" : "🏆"} {L({ en: "Results", hi: "परिणाम", hinglish: "Results" }, lang)}</h2>
      {!kid && <p className="muted small">Each subject is judged on what was learned, whether it can be USED in real life, and whether it was remembered later, not only on activities done.
        Hover or tap any icon for what it means.</p>}
      <div className="results-grid">
        <div className="result-tile overall">
          <h3 title={L(PART_INFO.score.tip, lang)} data-tip={L(PART_INFO.score.tip, lang)} tabIndex={0}>🌈 {L({ en: "All subjects", hi: "सभी विषय", hinglish: "Sab subjects" }, lang)}</h3>
          <div className="result-big" title={L(PART_INFO.score.tip, lang)}>{kid ? stars(o.score) : o.score == null ? "–" : Math.round(o.score)}</div>
          <Row k="learned" v={o.learned} lang={lang} kid={kid} /><Row k="applied" v={o.applied} lang={lang} kid={kid} /><Row k="remembered" v={o.remembered} lang={lang} kid={kid} />
        </div>
        {areas.map((a) => (
          <div key={a.id} className="result-tile">
            <h3>{a.emoji} {a.title}</h3>
            <Row k="score" v={a.score} lang={lang} kid={kid} />
            <Row k="learned" v={a.learned} lang={lang} kid={kid} /><Row k="applied" v={a.applied} lang={lang} kid={kid} /><Row k="remembered" v={a.remembered} lang={lang} kid={kid} />
          </div>
        ))}
      </div>
    </section>
  );
}
