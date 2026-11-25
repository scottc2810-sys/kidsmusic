// Music Basics: the building blocks of any music. Each topic has
//   📖 Learn    – Melo explains with a hands-on explorer (tap, listen, clap along)
//   🎯 Practice – a short scored drill of that topic only (adaptive, counts toward progress)
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, type BasicsStatus, type Child, type Language } from "../api";
import { primeSpeech, speak, stopSpeaking } from "../audio/speech";
import { ALL_TIMBRES, playNote, playSequence, sleep, unlockAudio, type Timbre } from "../audio/synth";
import { Melo, type MeloMood } from "../components/Melo";
import { NoteGuide } from "../components/NoteGuide";
import { KEY_COLORS, Piano } from "../components/Piano";
import { L, TIMBRE_ICON, TIMBRE_LABEL, noteLabel, t, type Text } from "../i18n";
import { KidShell, useChild } from "./KidHome";

type L3 = Text;
type TopicId = "swars" | "rhythm" | "taal" | "high_low" | "loud_soft" | "fast_slow" | "instruments" | "ear" | "alankars";

interface Topic { id: TopicId; icon: string; title: L3; skill: string; practice: string | null; intro: L3 }

// Hindi lines use neutral forms ("हम… करें", "तुम… करो") so Melo stays gender-neutral.
export const TOPICS: Topic[] = [
  { id: "swars", icon: "🎵", skill: "pitch", practice: "swars",
    title: { en: "Swars (notes)", hi: "स्वर", hinglish: "Swar (notes)" },
    intro: { en: "Music has seven swars: Sa, Re, Ga, Ma, Pa, Dha, Ni. After Ni, Sa comes again, a little higher. Together they make a saptak. Tap each swar to hear it!",
      hi: "संगीत में सात स्वर होते हैं: सा, रे, ग, म, प, ध, नि। नि के बाद फिर से सा आता है, थोड़ा ऊँचा। ये मिलकर सप्तक बनाते हैं। हर स्वर छूकर सुनो!",
      hinglish: "Music mein saat swar hote hain: Sa, Re, Ga, Ma, Pa, Dha, Ni. Ni ke baad phir se Sa aata hai, thoda ooncha. Yeh milkar saptak banate hain. Har swar tap karke suno!" } },
  { id: "rhythm", icon: "🥁", skill: "rhythm", practice: "rhythm",
    title: { en: "Rhythm & beat", hi: "लय और ताल", hinglish: "Rhythm aur beat" },
    intro: { en: "Music has a heartbeat called the beat. Ta is one clap. Ti-ti is two quick claps. Ta-a is one long clap: hold for two. Let's clap along!",
      hi: "संगीत की एक धड़कन होती है, उसे ताल कहते हैं। 'ता' मतलब एक ताली। 'ति-ति' मतलब दो जल्दी तालियाँ। 'ता-आ' मतलब एक लंबी ताली, दो तक रुको। चलो साथ में ताली बजाएँ!",
      hinglish: "Music ki ek dhadkan hoti hai, use beat kehte hain. Ta matlab ek taali. Ti-ti matlab do jaldi taaliyan. Ta-a matlab ek lambi taali, do tak ruko. Chalo saath mein taali bajayein!" } },
  { id: "taal", icon: "👏", skill: "rhythm", practice: "rhythm",
    title: { en: "Taal (Indian rhythm)", hi: "ताल", hinglish: "Taal" },
    intro: { en: "A taal is a rhythm circle that repeats. Dadra has 6 beats, Keherwa has 8. Beat one is called sam: clap it strongly! On khali we wave instead of clapping.",
      hi: "ताल एक घूमता हुआ चक्र है। दादरा में 6 मात्राएँ हैं, कहरवा में 8। पहली मात्रा को सम कहते हैं, उस पर ज़ोर से ताली! खाली पर ताली नहीं, हाथ हिलाते हैं।",
      hinglish: "Taal ek ghoomta hua chakra hai. Dadra mein 6 maatra hain, Keherwa mein 8. Pehli maatra ko sam kehte hain, us par zor se taali! Khaali par taali nahi, haath hilaate hain." } },
  { id: "high_low", icon: "🐦", skill: "pitch", practice: "high_low",
    title: { en: "High & low", hi: "ऊँचा और नीचा", hinglish: "High aur low" },
    intro: { en: "Some sounds are high, like a tiny bird. Some are low, like a big elephant. On the piano, high sounds are on the right, low sounds on the left.",
      hi: "कुछ आवाज़ें ऊँची होती हैं, छोटी चिड़िया जैसी। कुछ नीची, बड़े हाथी जैसी। पियानो पर ऊँची आवाज़ें दाईं ओर, नीची बाईं ओर होती हैं।",
      hinglish: "Kuch sounds oonchi hoti hain, chhoti chidiya jaisi. Kuch neechi, bade haathi jaisi. Piano par oonchi sounds right side, neechi left side hoti hain." } },
  { id: "loud_soft", icon: "🦁", skill: "dynamics", practice: "loud_soft",
    title: { en: "Loud & soft", hi: "तेज़ और धीमी आवाज़", hinglish: "Loud aur soft" },
    intro: { en: "We can play the same note loud like a lion, or soft like a sleepy kitten. Musicians use loud and soft to tell a story!",
      hi: "एक ही सुर को हम शेर जैसा तेज़ या सोती बिल्ली जैसा धीमा बजा सकते हैं। संगीतकार तेज़ और धीमे से कहानी सुनाते हैं!",
      hinglish: "Ek hi note ko hum sher jaisa loud ya soti billi jaisa soft baja sakte hain. Musicians loud aur soft se kahani sunaate hain!" } },
  { id: "fast_slow", icon: "🐇", skill: "rhythm", practice: "fast_slow",
    title: { en: "Fast & slow", hi: "तेज़ और धीमा", hinglish: "Fast aur slow" },
    intro: { en: "The same tune can run fast like a rabbit, or walk slowly like a tortoise. How fast music goes is called its tempo, or laya.",
      hi: "एक ही धुन खरगोश जैसी तेज़ दौड़ सकती है, या कछुए जैसी धीरे चल सकती है। संगीत की चाल को लय कहते हैं।",
      hinglish: "Ek hi dhun khargosh jaisi fast daud sakti hai, ya kachhue jaisi dheere chal sakti hai. Music ki chaal ko laya ya tempo kehte hain." } },
  { id: "instruments", icon: "🎺", skill: "timbre", practice: "instruments",
    title: { en: "Instruments", hi: "बाजे", hinglish: "Instruments" },
    intro: { en: "Every instrument has its own voice. A flute sings softly, a drum goes boom, a bell rings bright. Tap each one to hear its voice!",
      hi: "हर बाजे की अपनी आवाज़ होती है। बाँसुरी मीठा गाती है, ढोल धम-धम करता है, घंटी चमकती आवाज़ में बजती है। हर एक छूकर सुनो!",
      hinglish: "Har instrument ki apni awaaz hoti hai. Flute meetha gaati hai, dhol dham-dham karta hai, ghanti chamakti awaaz mein bajti hai. Har ek tap karke suno!" } },
  { id: "ear", icon: "👂", skill: "melody", practice: "ear",
    title: { en: "Music ears", hi: "संगीत वाले कान", hinglish: "Music wale kaan" },
    intro: { en: "Good musicians listen carefully. Are two tunes the same, or is one note different? Listen, then copy the tune back!",
      hi: "अच्छे संगीतकार ध्यान से सुनते हैं। दो धुनें एक जैसी हैं, या एक सुर अलग है? सुनो, फिर धुन वैसे ही बजाओ!",
      hinglish: "Acche musicians dhyaan se sunte hain. Do dhunein ek jaisi hain, ya ek note alag hai? Suno, phir dhun waise hi bajao!" } },
  { id: "alankars", icon: "🎼", skill: "melody", practice: null,
    title: { en: "Alankars (sargam practice)", hi: "अलंकार", hinglish: "Alankar" },
    intro: { en: "Alankars are fun sargam patterns that make fingers and voice strong. Every musician practises them, even the great ones!",
      hi: "अलंकार सरगम के मज़ेदार पैटर्न हैं जो उँगलियों और आवाज़ को मज़बूत बनाते हैं। सभी संगीतकार इनका अभ्यास करते हैं!",
      hinglish: "Alankar sargam ke mazedaar patterns hain jo ungliyon aur awaaz ko mazboot banate hain. Sabhi musicians inki practice karte hain!" } },
];

const SCALE = [60, 62, 64, 65, 67, 69, 71, 72];

function useMelo(lang: Language) {
  const [mood, setMood] = useState<MeloMood>("happy");
  const [say, setSay] = useState("");
  const talk = async (text: string, after: MeloMood = "happy") => { setSay(text); setMood("talking"); await speak(text, lang); setMood(after); };
  return { mood, setMood, say, talk };
}

// ---- tiers: what unlocks as the child progresses (server decides the tier from mastery) ---------
const TIER_ICON = ["", "🌱", "🌿", "🌳"];
const TIER_NAME: Record<number, L3> = {
  1: { en: "Starter", hi: "शुरुआत", hinglish: "Starter" },
  2: { en: "Growing", hi: "बढ़ते हुए", hinglish: "Growing" },
  3: { en: "Big musician", hi: "बड़े संगीतकार", hinglish: "Big musician" },
};
const UNLOCK: L3 = { en: "Unlocks with more practice", hi: "और अभ्यास से खुलेगा", hinglish: "Aur practice se khulega" };

/** Topic grid: compact tiles that fit on one screen, with stars and the topic's tier. */
export function Basics() {
  const { id = "" } = useParams();
  const { child, error } = useChild(id);
  const nav = useNavigate();
  const [status, setStatus] = useState<BasicsStatus | null>(null);
  useEffect(() => { api.basics(id).then(setStatus).catch(() => {}); }, [id]);
  useEffect(() => { if (child) void speak(t("basics", child.language), child.language); }, [child]);
  if (error) return <div className="center-screen"><p className="error">{error}</p></div>;
  if (!child) return <div className="center-screen"><div className="spinner" /></div>;
  const lang = child.language;
  return (
    <KidShell child={child} music="home">
      <div className="lesson basics wide">
        <div className="basics-head">
          <button className="btn ghost small" onClick={() => nav(`/play/${id}`)}>🏠</button>
          <h1>📚 {t("basics", lang)}</h1>
        </div>
        <div className="basics-grid">
          {TOPICS.map((tp) => {
            const info = status?.tiers[tp.id];
            const stars = Math.round((info?.mastery ?? 0) * 3);
            const tier = info?.tier ?? 1;
            return (
              <button key={tp.id} className={`basics-tile skill-${tp.skill}`}
                onClick={async () => { primeSpeech(); await unlockAudio(); nav(`/play/${id}/basics/${tp.id}`); }}>
                <span className="tile-icon" aria-hidden>{tp.icon}</span>
                <span className="tile-title">{L(tp.title, lang)}</span>
                <span className="tile-meta">
                  <span className="basics-stars" aria-label={`${stars} of 3 stars`}>{"★".repeat(stars)}{"☆".repeat(3 - stars)}</span>
                  <span title={L(TIER_NAME[tier], lang)}>{TIER_ICON[tier]}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </KidShell>
  );
}

export function BasicsTopic() {
  const { id = "", topic = "" } = useParams();
  const { child, error } = useChild(id);
  if (error) return <div className="center-screen"><p className="error">{error}</p></div>;
  if (!child) return <div className="center-screen"><div className="spinner" /></div>;
  const tp = TOPICS.find((x) => x.id === topic);
  if (!tp) return <div className="center-screen"><p className="error">Unknown topic</p></div>;
  return <TopicPage key={tp.id} child={child} tp={tp} />;
}

/** One screen, no long scroll: topic tabs on top, Melo + actions beside the explorer. */
function TopicPage({ child, tp }: { child: Child; tp: Topic }) {
  const lang = child.language;
  const nav = useNavigate();
  const melo = useMelo(lang);
  const [status, setStatus] = useState<BasicsStatus | null>(null);
  const reload = () => api.basics(child.id).then(setStatus).catch(() => {});
  useEffect(() => { void reload(); }, [child.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const said = useRef(false);
  useEffect(() => {
    if (said.current) return;
    said.current = true;
    void melo.talk(L(tp.intro, lang));
    return () => stopSpeaking();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const info = status?.tiers[tp.id];
  const tier = info?.tier ?? 1;
  const Explorer = EXPLORERS[tp.id];
  const nextPct = info?.next ? Math.min(100, Math.round(Math.min(info.mastery / info.next.mastery, info.attempts / info.next.attempts) * 100)) : 100;
  return (
    <KidShell child={child}>
      <div className="lesson basics-topic wide">
        <nav className="topic-strip" aria-label="Topics">
          <button className="topic-chip" onClick={() => nav(`/play/${child.id}/basics`)}>📚</button>
          {TOPICS.map((x) => (
            <button key={x.id} className={`topic-chip${x.id === tp.id ? " sel" : ""}`} aria-current={x.id === tp.id ? "page" : undefined}
              onClick={() => nav(`/play/${child.id}/basics/${x.id}`, { replace: true })}>{x.icon} <span>{L(x.title, lang)}</span></button>
          ))}
        </nav>
        <div className="topic-layout">
          <aside className="topic-aside">
            <Melo mood={melo.mood} size={88} say={melo.say} />
            <div className="tier-box" title={info?.next ? `Next: ${Math.round(info.next.mastery * 100)}% mastery and ${info.next.attempts} tries` : ""}>
              <strong>{TIER_ICON[tier]} {L(TIER_NAME[tier], lang)}</strong>
              {info?.next && <div className="tier-bar" aria-label={`${nextPct}% to ${TIER_NAME[info.next.tier].en}`}><div style={{ width: `${nextPct}%` }} /></div>}
            </div>
            <div className="aside-actions">
              <button className="btn ghost" onClick={() => void melo.talk(L(tp.intro, lang))}>📖 {t("learn", lang)}</button>
              {tp.practice && <button className="btn" onClick={() => nav(`/play/${child.id}/lesson?topic=${tp.practice}`)}>🎯 {t("practice", lang)}</button>}
            </div>
          </aside>
          <section className="card explorer">
            <Explorer lang={lang} talk={melo.talk} childId={child.id} tier={tier} status={status} reload={reload} />
          </section>
        </div>
      </div>
    </KidShell>
  );
}

type ExplorerProps = {
  lang: Language; talk: (s: string, after?: MeloMood) => Promise<void>; childId: string;
  tier: number; status: BasicsStatus | null; reload: () => Promise<void> | void;
};

/** Small tab bar so each explorer shows one part at a time instead of a long page. Locked tabs open with progress. */
function Tabs({ tabs, tier, lang, children }: { tabs: { label: string; tier?: number }[]; tier: number; lang: Language; children: (i: number) => ReactNode }) {
  const [sel, setSel] = useState(0);
  const cur = tabs[sel];
  const locked = (cur.tier ?? 1) > tier;
  return (
    <div className="explore">
      <div className="tabs" role="tablist">
        {tabs.map((tb, i) => {
          const lk = (tb.tier ?? 1) > tier;
          return (
            <button key={i} role="tab" aria-selected={i === sel} className={`tab${i === sel ? " sel" : ""}${lk ? " locked" : ""}`} onClick={() => setSel(i)}>
              {lk ? "🔒 " : ""}{tb.label}{tb.tier && tb.tier > 1 ? ` ${TIER_ICON[tb.tier]}` : ""}
            </button>
          );
        })}
      </div>
      {locked ? (
        <div className="locked-panel">
          <span className="locked-icon" aria-hidden>{TIER_ICON[cur.tier ?? 2]}</span>
          <p><strong>{L(UNLOCK, lang)}</strong></p>
          <p className="muted small">{L(TIER_NAME[cur.tier ?? 2], lang)} · {t("practice", lang)} 🎯</p>
        </div>
      ) : children(sel)}
    </div>
  );
}

// ---- Swars ---------------------------------------------------------------------------------------
const SWAR: Record<number, { lat: string; hi: string; en: string }> = {
  55: { lat: ".Pa", hi: ".प", en: "G" }, 57: { lat: ".Dha", hi: ".ध", en: "A" }, 59: { lat: ".Ni", hi: ".नि", en: "B" },
  60: { lat: "Sa", hi: "सा", en: "C" }, 61: { lat: "Re♭", hi: "रे♭", en: "C♯" }, 62: { lat: "Re", hi: "रे", en: "D" },
  63: { lat: "Ga♭", hi: "ग♭", en: "E♭" }, 64: { lat: "Ga", hi: "ग", en: "E" }, 65: { lat: "Ma", hi: "म", en: "F" },
  66: { lat: "Ma♯", hi: "म♯", en: "F♯" }, 67: { lat: "Pa", hi: "प", en: "G" }, 68: { lat: "Dha♭", hi: "ध♭", en: "A♭" },
  69: { lat: "Dha", hi: "ध", en: "A" }, 70: { lat: "Ni♭", hi: "नि♭", en: "B♭" }, 71: { lat: "Ni", hi: "नि", en: "B" },
  72: { lat: "Sa'", hi: "सां", en: "C" }, 74: { lat: "Re'", hi: "रें", en: "D" }, 76: { lat: "Ga'", hi: "गं", en: "E" },
  77: { lat: "Ma'", hi: "मं", en: "F" }, 79: { lat: "Pa'", hi: "पं", en: "G" },
};
const swarName = (m: number, lang: Language) => (lang === "hi" ? SWAR[m]?.hi : SWAR[m]?.lat) ?? noteLabel(m, lang === "hi" ? "hi" : "hinglish");
const THAATS: { name: string; notes: number[]; say: L3 }[] = [
  { name: "Bilawal", notes: SCALE, say: { en: "Bilawal: all pure swars.", hi: "बिलावल: सब शुद्ध स्वर।", hinglish: "Bilawal: sab shuddh swar." } },
  { name: "Yaman", notes: [60, 62, 64, 66, 67, 69, 71, 72], say: { en: "Yaman uses tivra Ma, a little higher Ma.", hi: "यमन में तीव्र म है, थोड़ा ऊँचा म।", hinglish: "Yaman mein tivra Ma hai, thoda ooncha Ma." } },
  { name: "Kafi", notes: [60, 62, 63, 65, 67, 69, 70, 72], say: { en: "Kafi uses komal Ga and komal Ni, a little lower.", hi: "काफ़ी में कोमल ग और कोमल नि हैं, थोड़े नीचे।", hinglish: "Kafi mein komal Ga aur komal Ni hain, thode neeche." } },
  { name: "Bhairav", notes: [60, 61, 64, 65, 67, 68, 71, 72], say: { en: "Bhairav, a morning thaat, uses komal Re and komal Dha.", hi: "भैरव सुबह का थाट है, इसमें कोमल रे और कोमल ध हैं।", hinglish: "Bhairav subah ka thaat hai, ismein komal Re aur komal Dha hain." } },
];

function SwarTiles({ notes, lang, lit, onTap }: { notes: number[]; lang: Language; lit: number | null; onTap: (m: number) => void }) {
  return (
    <div className="swar-row" style={{ ["--n" as string]: String(notes.length) }}>
      {notes.map((m) => (
        <button key={m} className={`swar-tile${lit === m ? " lit" : ""}${[61, 63, 66, 68, 70].includes(m) ? " vikrit" : ""}`}
          style={{ ["--c" as string]: KEY_COLORS[m % 12] }} onClick={() => onTap(m)}>
          <strong>{swarName(m, lang)}</strong>
          {lang === "en" && <small>{SWAR[m]?.en}</small>}
        </button>
      ))}
    </div>
  );
}

function SwarExplorer({ lang, talk, tier, childId, status, reload }: ExplorerProps) {
  const [lit, setLit] = useState<number | null>(null);
  const [at, setAt] = useState<number | null>(null);
  const [seq, setSeq] = useState<number[]>(SCALE);
  const play = async (notes: number[], label: string) => {
    setSeq(notes);
    await talk(label, "listening");
    await playSequence(notes.map((m) => ({ midi: m })), 80, (i) => { setLit(i >= 0 ? notes[i] : null); setAt(i >= 0 ? i : null); }).done;
    setLit(null); setAt(null);
  };
  const tap = (m: number) => {
    playNote(m, { duration: 0.8 });
    setLit(m); window.setTimeout(() => setLit((x) => (x === m ? null : x)), 500);
    void speak(swarName(m, lang), lang);
  };
  const NL: Language = lang === "hi" ? "hi" : "hinglish"; // swars are always shown as sargam here
  const wide = [55, 57, 59, ...SCALE, 74, 76, 77, 79];
  return (
    <Tabs lang={lang} tier={tier} tabs={[{ label: "Saptak" }, { label: L({ en: "High & low", hi: "मंद्र-तार", hinglish: "Mandra-Taar" }, lang), tier: 2 },
      { label: L({ en: "Komal & tivra", hi: "कोमल-तीव्र", hinglish: "Komal-Tivra" }, lang), tier: 3 }, { label: L({ en: "✨ Made for you", hi: "✨ तुम्हारे लिए", hinglish: "✨ Tumhare liye" }, lang) }]}>
      {(i) => i === 0 ? (
        <>
          <SwarTiles notes={SCALE} lang={lang} lit={lit} onTap={tap} />
          <div className="row center wrap">
            <button className="btn" onClick={() => void play(SCALE, L({ en: "Aaroh: going up the stairs!", hi: "आरोह: सीढ़ी ऊपर चढ़ो!", hinglish: "Aaroh: seedhi upar chadho!" }, lang))}>⬆️ Aaroh</button>
            <button className="btn" onClick={() => void play([...SCALE].reverse(), L({ en: "Avroh: coming back down!", hi: "अवरोह: वापस नीचे आओ!", hinglish: "Avroh: wapas neeche aao!" }, lang))}>⬇️ Avroh</button>
          </div>
          <NoteGuide notes={seq} lang={NL} active={at} running={at != null} bpm={80} />
        </>
      ) : i === 1 ? (
        <>
          <p className="small">{L({ en: "Below Sa is the mandra (low) saptak, marked with a dot: .Pa .Dha .Ni. Above is the taar (high) saptak: Sa' Re' Ga'.",
            hi: "सा के नीचे मंद्र सप्तक है, बिंदु वाले: .प .ध .नि। ऊपर तार सप्तक है: सां रें गं।",
            hinglish: "Sa ke neeche mandra saptak hai, dot wale: .Pa .Dha .Ni. Upar taar saptak hai: Sa' Re' Ga'." }, lang)}</p>
          <SwarTiles notes={wide} lang={lang} lit={lit} onTap={tap} />
          <div className="row center wrap">
            <button className="btn" onClick={() => void play(wide, L({ en: "From low Pa all the way up to high Pa!", hi: "मंद्र प से तार प तक!", hinglish: "Mandra Pa se taar Pa tak!" }, lang))}>⬆️ .Pa → Pa'</button>
          </div>
          <Piano from={48} to={84} lang={lang} lit={lit} highlight={wide} />
        </>
      ) : i === 2 ? (
        <>
          <p className="small">{L({ en: "Re, Ga, Dha and Ni can be komal (soft, a little lower: ♭). Ma can be tivra (sharp, a little higher: ♯). Sa and Pa never change! Each thaat mixes them differently.",
            hi: "रे, ग, ध, नि कोमल हो सकते हैं (थोड़े नीचे: ♭)। म तीव्र हो सकता है (थोड़ा ऊँचा: ♯)। सा और प कभी नहीं बदलते! हर थाट इन्हें अलग मिलाता है।",
            hinglish: "Re, Ga, Dha aur Ni komal ho sakte hain (thode neeche: ♭). Ma tivra ho sakta hai (thoda ooncha: ♯). Sa aur Pa kabhi nahi badalte! Har thaat inhe alag milata hai." }, lang)}</p>
          <SwarTiles notes={[60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72]} lang={lang} lit={lit} onTap={tap} />
          <div className="row center wrap">
            {THAATS.map((th) => <button key={th.name} className="btn ghost" onClick={() => void play(th.notes, L(th.say, lang))}>🎶 {th.name}</button>)}
          </div>
          <NoteGuide notes={seq} lang={NL} active={at} running={at != null} bpm={80} />
        </>
      ) : <MadeForYou topic="swars" lang={lang} childId={childId} status={status} reload={reload} talk={talk} />}
    </Tabs>
  );
}

// ---- Rhythm ------------------------------------------------------------------------------------
const PATTERNS: { name: string; icon: string; beats: number[]; rest?: boolean[]; tier: number; say: L3 }[] = [
  { name: "Ta", icon: "🟦", beats: [1], tier: 1, say: { en: "Ta: one clap, one beat.", hi: "ता: एक ताली, एक मात्रा।", hinglish: "Ta: ek taali, ek beat." } },
  { name: "Ti-ti", icon: "🟨🟨", beats: [0.5, 0.5], tier: 1, say: { en: "Ti-ti: two quick claps in one beat.", hi: "ति-ति: एक मात्रा में दो जल्दी तालियाँ।", hinglish: "Ti-ti: ek beat mein do jaldi taaliyan." } },
  { name: "Ta-a", icon: "🟥━", beats: [2], tier: 1, say: { en: "Ta-a: one long clap. Hold for two beats.", hi: "ता-आ: एक लंबी ताली, दो मात्रा तक।", hinglish: "Ta-a: ek lambi taali, do beat tak." } },
  { name: "Ti-ri-ki-ta", icon: "🟩🟩🟩🟩", beats: [0.25, 0.25, 0.25, 0.25], tier: 2, say: { en: "Ti-ri-ki-ta: four very quick taps in one beat!", hi: "ति-रि-कि-ट: एक मात्रा में चार बहुत जल्दी थाप!", hinglish: "Ti-ri-ki-ta: ek beat mein chaar bahut jaldi taps!" } },
  { name: "Ta 🤫 Ta", icon: "🟦⬜🟦", beats: [1, 1, 1], rest: [false, true, false], tier: 2, say: { en: "A rest is a silent beat. Clap, shh, clap!", hi: "विश्राम मतलब चुप मात्रा। ताली, श्श्श, ताली!", hinglish: "Rest matlab chup beat. Taali, shh, taali!" } },
];

function RhythmExplorer({ lang, talk, tier }: ExplorerProps) {
  const playPattern = async (p: (typeof PATTERNS)[number], bpm = 80) => {
    await talk(L(p.say, lang), "listening");
    const beatMs = 60000 / bpm;
    for (let rep = 0; rep < 2; rep++) {
      for (let i = 0; i < p.beats.length; i++) {
        if (!p.rest?.[i]) playNote(48, { timbre: "drum", gain: 0.6 });
        await sleep(p.beats[i] * beatMs);
      }
    }
  };
  const cards = (min: number, max: number) => (
    <div className="row center wrap">
      {PATTERNS.filter((p) => p.tier >= min && p.tier <= max).map((p) => (
        <button key={p.name} className="pattern-card" onClick={() => void playPattern(p)}>
          <span className="pattern-icon">{p.icon}</span><strong>{p.name}</strong>
          <span className="ng-beats">{p.beats.map((b, i) => <i key={i} className={b < 1 ? "half" : ""} style={p.rest?.[i] ? { opacity: 0.2 } : undefined} />)}{p.beats[0] >= 2 && <em>hold</em>}</span>
        </button>
      ))}
    </div>
  );
  return (
    <Tabs lang={lang} tier={tier} tabs={[{ label: "Ta · Ti-ti · Ta-a" }, { label: L({ en: "Clap along", hi: "साथ में ताली", hinglish: "Saath mein taali" }, lang) },
      { label: "Ti-ri-ki-ta · 🤫", tier: 2 }, { label: L({ en: "Faster beat", hi: "तेज़ ताल", hinglish: "Fast beat" }, lang), tier: 3 }]}>
      {(i) => i === 0 ? cards(1, 1) : i === 1 ? <ClapAlong lang={lang} talk={talk} bpm={80} /> : i === 2 ? cards(2, 2) : <ClapAlong lang={lang} talk={talk} bpm={108} />}
    </Tabs>
  );
}

function ClapAlong({ lang, talk, bpm }: { lang: Language; talk: ExplorerProps["talk"]; bpm: number }) {
  const beatMs = 60000 / bpm;
  const [running, setRunning] = useState(false);
  const [pulse, setPulse] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [hits, setHits] = useState(0);
  const start = useRef(0);
  const timer = useRef<number | null>(null);
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);
  const toggle = async () => {
    if (running) { if (timer.current) clearInterval(timer.current); setRunning(false); return; }
    await talk(L({ en: "Clap on the big drum with me. One, two, three, four!", hi: "मेरे साथ बड़े ढोल पर ताली बजाओ। एक, दो, तीन, चार!", hinglish: "Mere saath bade dhol par taali bajao. Ek, do, teen, chaar!" }, lang), "listening");
    start.current = performance.now(); setHits(0); setFeedback(""); setRunning(true);
    const tick = () => { playNote(48, { timbre: "drum", gain: 0.5 }); setPulse(true); window.setTimeout(() => setPulse(false), 150); };
    tick();
    timer.current = window.setInterval(tick, beatMs);
  };
  const tap = () => {
    playNote(72, { timbre: "bell", gain: 0.3, duration: 0.1 });
    if (!running) return;
    const since = performance.now() - start.current;
    const off = since - Math.round(since / beatMs) * beatMs; // signed distance to the nearest beat
    if (Math.abs(off) < Math.min(130, beatMs * 0.2)) { setHits((h) => h + 1); setFeedback(L({ en: "✅ On the beat!", hi: "✅ ताल पर!", hinglish: "✅ Beat par!" }, lang)); }
    else setFeedback(off < 0 ? L({ en: "⏩ A bit early, wait for the drum", hi: "⏩ थोड़ा जल्दी, ढोल का इंतज़ार करो", hinglish: "⏩ Thoda jaldi, dhol ka wait karo" }, lang)
      : L({ en: "⏪ A bit late, clap with the drum", hi: "⏪ थोड़ा देर से, ढोल के साथ ताली", hinglish: "⏪ Thoda late, dhol ke saath taali" }, lang));
  };
  return (
    <div className="clap-row">
      <div className={`beat-heart${pulse ? " on" : ""}`} aria-hidden>🥁</div>
      <button className="tap-pad" onPointerDown={(e) => { e.preventDefault(); tap(); }} aria-label="Clap here">👏</button>
      <div className="clap-side">
        <button className="btn" onClick={() => void toggle()}>{running ? "⏹ " + t("stop", lang) : "▶️ " + L({ en: "Start", hi: "शुरू", hinglish: "Start" }, lang)}</button>
        <p className="small" aria-live="polite">{feedback}{running && hits > 0 ? ` · ${hits} ✅` : ""}</p>
        <span className="muted small">{bpm} bpm</span>
      </div>
    </div>
  );
}

// ---- Taal ----------------------------------------------------------------------------------------
const TAALS: { id: string; name: L3; bols: string[]; taali: number[]; khali: number[]; divisions: number[]; tier: number }[] = [
  { id: "dadra", name: { en: "Dadra · 6", hi: "दादरा · 6", hinglish: "Dadra · 6" }, bols: ["Dha", "Dhin", "Na", "Dha", "Tin", "Na"], taali: [0], khali: [3], divisions: [0, 3], tier: 1 },
  { id: "keherwa", name: { en: "Keherwa · 8", hi: "कहरवा · 8", hinglish: "Keherwa · 8" }, bols: ["Dha", "Ge", "Na", "Ti", "Na", "Ka", "Dhi", "Na"], taali: [0], khali: [4], divisions: [0, 4], tier: 1 },
  { id: "rupak", name: { en: "Rupak · 7", hi: "रूपक · 7", hinglish: "Rupak · 7" }, bols: ["Tin", "Tin", "Na", "Dhi", "Na", "Dhi", "Na"], taali: [3, 5], khali: [0], divisions: [0, 3, 5], tier: 2 },
  { id: "teentaal", name: { en: "Teentaal · 16", hi: "तीनताल · 16", hinglish: "Teentaal · 16" },
    bols: ["Dha", "Dhin", "Dhin", "Dha", "Dha", "Dhin", "Dhin", "Dha", "Dha", "Tin", "Tin", "Ta", "Ta", "Dhin", "Dhin", "Dha"],
    taali: [0, 4, 12], khali: [8], divisions: [0, 4, 8, 12], tier: 3 },
];

function bolSound(bol: string) {
  const b = bol.toLowerCase();
  if (b.startsWith("dh")) { playNote(43, { timbre: "drum", gain: 0.7 }); playNote(74, { timbre: "bell", gain: 0.18, duration: 0.2 }); }
  else if (b === "ge") playNote(40, { timbre: "drum", gain: 0.6 });
  else if (b === "ka") playNote(45, { timbre: "drum", gain: 0.25 });
  else playNote(b === "tin" || b === "ti" || b === "ta" ? 79 : 76, { timbre: "bell", gain: 0.3, duration: 0.15 });
}

function TaalExplorer({ lang, talk, tier }: ExplorerProps) {
  return (
    <Tabs lang={lang} tier={tier} tabs={TAALS.map((x) => ({ label: L(x.name, lang), tier: x.tier }))}>
      {(i) => <TaalPlayer key={TAALS[i].id} taal={TAALS[i]} lang={lang} talk={talk} />}
    </Tabs>
  );
}

function TaalPlayer({ taal, lang, talk }: { taal: (typeof TAALS)[number]; lang: Language; talk: ExplorerProps["talk"] }) {
  const [at, setAt] = useState<number | null>(null);
  const [cycle, setCycle] = useState(0);
  const stop = useRef(false);
  useEffect(() => () => { stop.current = true; }, []);
  const play = async () => {
    stop.current = false;
    await talk(taal.id === "rupak"
      ? L({ en: "Rupak is special: it starts on khali, so wave on beat one!", hi: "रूपक ख़ास है: यह खाली से शुरू होता है, तो पहली मात्रा पर हाथ हिलाओ!", hinglish: "Rupak khaas hai: yeh khaali se shuru hota hai, toh pehli maatra par haath hilaao!" }, lang)
      : L({ en: "Listen, and clap on the sam. Wave your hand on khali!", hi: "सुनो, और सम पर ताली बजाओ। खाली पर हाथ हिलाओ!", hinglish: "Suno, aur sam par taali bajao. Khaali par haath hilaao!" }, lang), "listening");
    for (let c = 0; c < 2 && !stop.current; c++) {
      setCycle(c + 1);
      for (let i = 0; i < taal.bols.length && !stop.current; i++) {
        setAt(i); bolSound(taal.bols[i]);
        await sleep(taal.bols.length > 8 ? 450 : 600);
      }
    }
    setAt(null); setCycle(0);
  };
  return (
    <>
      <div className={`taal-row${taal.bols.length > 8 ? " long" : ""}`} style={{ ["--n" as string]: String(Math.min(taal.bols.length, 8)) }}>
        {taal.bols.map((b, i) => (
          <div key={i} className={`taal-beat${at === i ? " now" : ""}${taal.divisions.includes(i) ? " vibhag" : ""}`}>
            <span className="taal-mark">{taal.taali.includes(i) ? (i === 0 ? "✋ sam" : "✋") : taal.khali.includes(i) ? "👋" : ""}</span>
            <strong>{b}</strong>
            <small>{i + 1}</small>
          </div>
        ))}
      </div>
      <div className="row center wrap">
        <button className="btn" onClick={() => void play()}>▶️ {L(taal.name, lang)}</button>
        {cycle > 0 && <span className="muted small">🔁 {cycle}/2</span>}
      </div>
    </>
  );
}

// ---- Sound qualities: high/low, loud/soft, fast/slow ----------------------------------------------
const PAIRS: Record<"high_low" | "loud_soft" | "fast_slow", { a: { icon: string; label: L3; play: () => Promise<void> }; b: { icon: string; label: L3; play: () => Promise<void> } }> = {
  high_low: {
    a: { icon: "🐦", label: { en: "High", hi: "ऊँचा", hinglish: "High" }, play: async () => { await playSequence([79, 81, 84].map((m) => ({ midi: m, beats: 0.5 })), 100).done; } },
    b: { icon: "🐘", label: { en: "Low", hi: "नीचा", hinglish: "Low" }, play: async () => { await playSequence([43, 41, 36].map((m) => ({ midi: m, beats: 1 })), 80).done; } },
  },
  loud_soft: {
    a: { icon: "🦁", label: { en: "Loud", hi: "तेज़", hinglish: "Loud" }, play: async () => { await playSequence([60, 64, 67].map((m) => ({ midi: m, gain: 0.95 })), 90).done; } },
    b: { icon: "🐱", label: { en: "Soft", hi: "धीमा", hinglish: "Soft" }, play: async () => { await playSequence([60, 64, 67].map((m) => ({ midi: m, gain: 0.12 })), 90).done; } },
  },
  fast_slow: {
    a: { icon: "🐇", label: { en: "Fast", hi: "तेज़", hinglish: "Fast" }, play: async () => { await playSequence([60, 62, 64, 65, 67].map((m) => ({ midi: m })), 170).done; } },
    b: { icon: "🐢", label: { en: "Slow", hi: "धीमा", hinglish: "Slow" }, play: async () => { await playSequence([60, 62, 64, 65, 67].map((m) => ({ midi: m })), 60).done; } },
  },
};

function PairExplorer({ lang, kind }: ExplorerProps & { kind: keyof typeof PAIRS }) {
  const pair = PAIRS[kind];
  const [on, setOn] = useState<"a" | "b" | null>(null);
  const play = async (k: "a" | "b") => { setOn(k); await pair[k].play(); setOn(null); };
  return (
    <div className="explore">
      <div className="choices n2">
        {(["a", "b"] as const).map((k) => (
          <button key={k} className={`choice-btn${on === k ? " playing" : ""}`} onClick={() => void play(k)} disabled={on !== null}>
            <span className="choice-icon">{pair[k].icon}</span><span className="choice-label">{L(pair[k].label, lang)}</span>
          </button>
        ))}
      </div>
      <button className="btn ghost" disabled={on !== null} onClick={() => void (async () => { await play("a"); await sleep(400); await play("b"); })()}>
        🔁 {L({ en: "Hear both", hi: "दोनों सुनो", hinglish: "Dono suno" }, lang)}
      </button>
    </div>
  );
}

// ---- Instruments -----------------------------------------------------------------------------------
// Each instrument plays a little phrase that suits it: tabla plays a theka (Dha Dhin...), not a scale.
const PHRASE: Partial<Record<Timbre, { midi: number; beats: number }[]>> = {
  tabla: [48, 62, 62, 48, 48, 62, 62, 48].map((m) => ({ midi: m, beats: 0.5 })),
  drum: [48, 48, 48, 48].map((m) => ({ midi: m, beats: 0.5 })),
  sitar: [60, 62, 64, 67, 64, 62, 60].map((m, i) => ({ midi: m, beats: i === 6 ? 2 : 0.5 })),
};
function InstrumentExplorer({ lang }: ExplorerProps) {
  const [on, setOn] = useState<Timbre | null>(null);
  const play = async (tb: Timbre) => {
    setOn(tb);
    const notes = PHRASE[tb] ?? [60, 64, 67, 72].map((m) => ({ midi: m, beats: 1 }));
    await playSequence(notes.map((n) => ({ ...n, timbre: tb })), 100).done;
    setOn(null);
  };
  return (
    <div className="choices n5">
      {ALL_TIMBRES.map((tb) => (
        <button key={tb} className={`choice-btn${on === tb ? " playing" : ""}`} onClick={() => void play(tb)}>
          <span className="choice-icon">{TIMBRE_ICON[tb] ?? "🎵"}</span><span className="choice-label">{(TIMBRE_LABEL[tb] ? L(TIMBRE_LABEL[tb], lang) : tb)}</span>
        </button>
      ))}
    </div>
  );
}

// ---- Music ears ------------------------------------------------------------------------------------
function EarExplorer({ lang, talk }: ExplorerProps) {
  const A = [60, 64, 67];
  const demo = async (same: boolean) => {
    await playSequence(A.map((m) => ({ midi: m })), 100).done;
    await sleep(500);
    await playSequence((same ? A : [60, 65, 67]).map((m) => ({ midi: m })), 100).done;
    await talk(same ? L({ en: "Those were the same!", hi: "ये दोनों एक जैसी थीं!", hinglish: "Yeh dono same thi!" }, lang)
      : L({ en: "The middle note was different. Did you hear it?", hi: "बीच वाला सुर अलग था। सुनाई दिया?", hinglish: "Beech wala note alag tha. Sunai diya?" }, lang));
  };
  return (
    <div className="row center wrap">
      <button className="btn" onClick={() => void demo(true)}>👯 {t("same", lang)}</button>
      <button className="btn" onClick={() => void demo(false)}>🔀 {t("different", lang)}</button>
    </div>
  );
}

// ---- Alankars: classics + exercises made for the child as they progress -----------------------------
const CLASSIC = [
  { id: "aaroh_avroh", title: "Aaroh & Avroh" }, { id: "alankar_1", title: "Sa Re Ga, Re Ga Ma…" }, { id: "alankar_2", title: "Sa Sa, Re Re…" },
];

function AlankarExplorer({ lang, childId, tier, status, reload, talk }: ExplorerProps) {
  const nav = useNavigate();
  const [done, setDone] = useState<Set<string>>(new Set());
  useEffect(() => {
    api.songs(childId).then((s) => setDone(new Set(s.filter((x) => x.progress.completed).map((x) => x.id)))).catch(() => {});
  }, [childId]);
  return (
    <Tabs lang={lang} tier={tier} tabs={[{ label: L({ en: "Classic", hi: "पारंपरिक", hinglish: "Classic" }, lang) }, { label: L({ en: "✨ Made for you", hi: "✨ तुम्हारे लिए", hinglish: "✨ Tumhare liye" }, lang) }]}>
      {(i) => i === 0 ? (
        <div className="exercise-list">
          {CLASSIC.map((x) => (
            <button key={x.id} className={`exercise-item${done.has(x.id) ? " done" : ""}`} onClick={() => nav(`/play/${childId}/songs/${x.id}?listen=1`)}>
              🎼 <span>{x.title}</span>{done.has(x.id) ? " ⭐" : ""}
            </button>
          ))}
        </div>
      ) : <MadeForYou topic="alankars" lang={lang} childId={childId} status={status} reload={reload} talk={talk}
            autoMake={CLASSIC.every((x) => done.has(x.id))} />}
    </Tabs>
  );
}

/**
 * Exercises Melo (Claude Code brain, or the offline generator) or Claude Code over MCP made for this child.
 * Each is a small step harder and stays inside the child's tier. When everything is finished, a new one is made.
 */
function MadeForYou({ topic, lang, childId, status, reload, talk, autoMake = false }: {
  topic: "swars" | "alankars"; lang: Language; childId: string; status: BasicsStatus | null;
  reload: ExplorerProps["reload"]; talk: ExplorerProps["talk"]; autoMake?: boolean;
}) {
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const mine = (status?.exercises ?? []).filter((e) => e.topic === topic);
  const make = async (force: boolean) => {
    setBusy(true); setErr(null);
    await talk(L({ en: "Let me make a new exercise just for you…", hi: "रुको, तुम्हारे लिए नया अभ्यास बनाते हैं…", hinglish: "Ruko, tumhare liye naya exercise banate hain…" }, lang), "thinking");
    try { await api.newExercise(childId, topic, force); await reload(); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };
  const tried = useRef(false);
  useEffect(() => {
    // all finished (or none yet, after the classics): make the next one automatically
    if (!status || busy || tried.current) return;
    if ((autoMake && mine.length === 0) || (mine.length > 0 && mine.every((e) => e.completed))) { tried.current = true; void make(true); }
  }, [status, autoMake]); // eslint-disable-line react-hooks/exhaustive-deps
  const brain = status?.brain && status.brain !== "offline" ? "🧠 Claude" : "🦉 Melo";
  return (
    <div className="exercise-list">
      {mine.length === 0 && !busy && <p className="muted small">{L({ en: "Finish the classics, or tap below for your first one.", hi: "पारंपरिक वाले पूरे करो, या नीचे दबाओ।", hinglish: "Classic wale poore karo, ya neeche tap karo." }, lang)}</p>}
      {mine.map((e) => (
        <button key={e.song_id} className={`exercise-item${e.completed ? " done" : ""}`} onClick={() => nav(`/play/${childId}/songs/${e.song_id}?listen=1`)}>
          {e.source === "offline" ? "🦉" : "✨"} <span>{e.title}</span> <small>{TIER_ICON[e.tier]}</small>{e.completed ? " ⭐" : ""}
        </button>
      ))}
      <button className="btn" onClick={() => void make(mine.length > 0)} disabled={busy}>
        {busy ? "…" : "＋"} {L({ en: "New exercise", hi: "नया अभ्यास", hinglish: "Naya exercise" }, lang)} <small className="muted">({brain})</small>
      </button>
      {err && <p className="error small">{err}</p>}
    </div>
  );
}

const EXPLORERS: Record<TopicId, (p: ExplorerProps) => JSX.Element> = {
  swars: SwarExplorer,
  rhythm: RhythmExplorer,
  taal: TaalExplorer,
  high_low: (p) => <PairExplorer {...p} kind="high_low" />,
  loud_soft: (p) => <PairExplorer {...p} kind="loud_soft" />,
  fast_slow: (p) => <PairExplorer {...p} kind="fast_slow" />,
  instruments: InstrumentExplorer,
  ear: EarExplorer,
  alankars: AlankarExplorer,
};
