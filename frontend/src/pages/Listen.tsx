// The Listening room 🎧: pick music for how you want to feel, say how you feel now, listen while doing a small
// task (breathe, count bells, dance, count chords, hum), then say how you feel after. Before/after goes to the
// learning graph so parents and the AI teacher can see what helps this child.
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, type Child } from "../api";
import { onMusicEvent, playMusic, stopMusic } from "../audio/bgm";
import { primeSpeech, speak, stopSpeaking } from "../audio/speech";
import { playSfx, unlockAudio } from "../audio/synth";
import { Melo } from "../components/Melo";
import { L, type Text } from "../i18n";
import { DANCE_MOVES, MOODS_FACES, TRACKS, type Track } from "../subjects/listening";
import { KidShell, useChild } from "./KidHome";

const S = {
  title: { en: "Listening room", hi: "सुनने का कमरा", hinglish: "Sunne ka kamra" },
  pick: { en: "How do you want to feel? Pick some music.", hi: "तुम कैसा महसूस करना चाहते हो? कोई संगीत चुनो।", hinglish: "Tum kaisa mehsoos karna chahte ho? Koi sangeet chuno." },
  before: { en: "How do you feel right now?", hi: "अभी तुम कैसा महसूस कर रहे हो?", hinglish: "Abhi tum kaisa mehsoos kar rahe ho?" },
  after: { en: "And how do you feel now?", hi: "और अब कैसा महसूस कर रहे हो?", hinglish: "Aur ab kaisa mehsoos kar rahe ho?" },
  howLong: { en: "How long?", hi: "कितनी देर?", hinglish: "Kitni der?" },
  min: { en: "min", hi: "मिनट", hinglish: "min" },
  play: { en: "Play", hi: "चलाओ", hinglish: "Chalaao" },
  stop: { en: "Stop", hi: "रोको", hinglish: "Roko" },
  why: { en: "Why it helps", hi: "यह क्यों मदद करता है", hinglish: "Yeh kyon madad karta hai" },
  breatheIn: { en: "Breathe in...", hi: "साँस अंदर...", hinglish: "Saans andar..." },
  breatheOut: { en: "...and out", hi: "...और बाहर", hinglish: "...aur bahar" },
  howManyBells: { en: "How many bells did you hear?", hi: "तुमने कितनी घंटियाँ सुनीं?", hinglish: "Tumne kitni ghantiyaan suni?" },
  bellsRight: { en: "Exactly right! Super listening ears!", hi: "बिल्कुल सही! बहुत तेज़ कान!", hinglish: "Bilkul sahi! Bahut tez kaan!" },
  bellsWere: { en: "There were {n} bells. Bells hide well! Next time you'll catch more.", hi: "{n} घंटियाँ थीं। घंटियाँ अच्छी तरह छिपती हैं! अगली बार और पकड़ोगे।", hinglish: "{n} ghantiyaan thin. Ghantiyaan achhi tarah chhupti hain! Agli baar aur pakdoge." },
  chord: { en: "Chord", hi: "कॉर्ड", hinglish: "Chord" },
  better: { en: "The music helped you feel better!", hi: "संगीत से तुम्हें अच्छा लगा!", hinglish: "Sangeet se tumhe achha laga!" },
  same: { en: "Thanks for listening. Some days other music helps more: try another one next time.", hi: "सुनने के लिए धन्यवाद। कभी-कभी दूसरा संगीत ज़्यादा मदद करता है: अगली बार कोई और आज़माओ।", hinglish: "Sunne ke liye dhanyavaad. Kabhi-kabhi doosra sangeet zyada madad karta hai: agli baar koi aur aazmaao." },
  more: { en: "More music", hi: "और संगीत", hinglish: "Aur sangeet" },
  home: { en: "Home", hi: "घर", hinglish: "Ghar" },
  parentNote: { en: "For grown-ups: music can change mood, breathing and attention for a while. It is not a treatment, and it does not make children smarter by itself; listening actively (noticing, counting, moving) is what trains attention.", hi: "बड़ों के लिए: संगीत कुछ समय के लिए मूड, साँस और ध्यान बदल सकता है। यह इलाज नहीं है और अपने-आप बच्चों को होशियार नहीं बनाता; ध्यान से सुनना (गिनना, पहचानना, हिलना) ही ध्यान को मज़बूत करता है।", hinglish: "Badon ke liye: sangeet kuch samay ke liye mood, saans aur dhyaan badal sakta hai. Yeh ilaaj nahi hai aur apne-aap bachchon ko hoshiyaar nahi banaata; dhyaan se sunna (ginna, pehchaanna, hilna) hi dhyaan ko mazboot karta hai." },
} satisfies Record<string, Text>;

export function ListenRoom() {
  const { id = "" } = useParams();
  const { child, error } = useChild(id);
  const [track, setTrack] = useState<Track | null>(null);
  const nav = useNavigate();
  useEffect(() => { if (child && !track) void speak(L(S.pick, child.language), child.language); }, [child, track]);
  if (error) return <div className="center-screen"><p className="error">{error}</p></div>;
  if (!child) return <div className="center-screen"><div className="spinner" /></div>;
  const lang = child.language;
  if (track) return <Session child={child} track={track} onDone={() => setTrack(null)} />;
  return (
    <KidShell child={child}>
      <div className="lesson listen-room">
        <h1>🎧 {L(S.title, lang)}</h1>
        <Melo mood="happy" size={90} say={L(S.pick, lang)} />
        <div className="listen-grid">
          {TRACKS.map((t) => (
            <button key={t.id} className={`listen-card task-${t.task}`} onClick={async () => { primeSpeech(); await unlockAudio(); playSfx("pop"); setTrack(t); }}>
              <span className="listen-icon" aria-hidden>{t.icon}</span>
              <strong>{L(t.title, lang)}</strong>
              <span className="listen-goal">{L(t.goal, lang)}</span>
            </button>
          ))}
        </div>
        <p className="muted small listen-note">{L(S.parentNote, lang)}</p>
        <button className="btn ghost" onClick={() => nav(`/play/${id}`)}>🏠 {L(S.home, lang)}</button>
      </div>
    </KidShell>
  );
}

type Step = "before" | "playing" | "bells" | "after" | "done";

function Session({ child, track, onDone }: { child: Child; track: Track; onDone: () => void }) {
  const lang = child.language;
  const [step, setStep] = useState<Step>("before");
  const [before, setBefore] = useState<number | null>(null);
  const [after, setAfter] = useState<number | null>(null);
  const [minutes, setMinutes] = useState(3);
  const [left, setLeft] = useState(0);
  const [bar, setBar] = useState(0);
  const [bellGuess, setBellGuess] = useState<number | null>(null);
  const bells = useRef(0);
  const say = (t: Text) => { stopSpeaking(); void speak(L(t, lang), lang); };

  useEffect(() => { say(S.before); return () => { stopMusic(`listen_${track.id}`); stopSpeaking(); }; }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => onMusicEvent((e) => {
    if (e.kind === "bar") setBar(e.index);
    if (e.kind === "bell") bells.current = e.index;
  }), []);
  useEffect(() => {
    if (step !== "playing") return;
    const t = window.setInterval(() => setLeft((s) => {
      if (s <= 1) { window.clearInterval(t); finish(); return 0; }
      return s - 1;
    }), 1000);
    return () => window.clearInterval(t);
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  const begin = async () => {
    await unlockAudio();
    bells.current = 0;
    setLeft(minutes * 60);
    setStep("playing");
    say(track.how);
    playMusic(`listen_${track.id}`, track.def, { level: 0.5, force: true });
  };
  const finish = () => {
    stopMusic(`listen_${track.id}`);
    playSfx("sparkle");
    if (track.task === "bells") { setStep("bells"); say(S.howManyBells); } else { setStep("after"); say(S.after); }
  };
  const save = (a: number) => {
    setAfter(a);
    setStep("done");
    const better = before !== null && a > before;
    say(better ? S.better : S.same);
    const bellTxt = track.task === "bells" ? `, counted ${bellGuess ?? "?"} of ${bells.current} bells` : "";
    void api.addNote(child.id, `Listening room · ${L(track.title, "en")} (${L(track.goal, "en")}), ${minutes} min: felt ${MOODS_FACES[before ?? 2]} before, ${MOODS_FACES[a]} after${bellTxt}`).catch(() => {});
  };

  const Faces = ({ onPick, chosen }: { onPick: (i: number) => void; chosen: number | null }) => (
    <div className="listen-faces" role="radiogroup">
      {MOODS_FACES.map((f, i) => (
        <button key={f} role="radio" aria-checked={chosen === i} className={`listen-face${chosen === i ? " on" : ""}`} onClick={() => { playSfx("pop"); onPick(i); }}>{f}</button>
      ))}
    </div>
  );

  const mm = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
  const perCycle = track.def.piece ? 8 : 4;
  const bellChoices = Array.from(new Set([bells.current, Math.max(0, bells.current - 1), bells.current + 1, bells.current + 2])).sort((a, b) => a - b);

  return (
    <KidShell child={child}>
      <div className={`lesson listen-session task-${track.task}`} style={{ ["--bpm" as string]: String(track.def.bpm) }}>
        <div className="row center wrap"><span className="listen-icon" aria-hidden>{track.icon}</span><h1>{L(track.title, lang)}</h1></div>
        <p className="listen-goal">{L(track.goal, lang)}</p>

        {step === "before" && (
          <div className="card listen-panel">
            <h2>{L(S.before, lang)}</h2>
            <Faces chosen={before} onPick={setBefore} />
            <h3>{L(S.howLong, lang)}</h3>
            <div className="row center wrap">
              {[1, 3, 5, 10].map((m) => (
                <button key={m} className={`chip${minutes === m ? " on" : ""}`} onClick={() => setMinutes(m)}>{m} {L(S.min, lang)}</button>
              ))}
            </div>
            <details className="listen-why"><summary>🤔 {L(S.why, lang)}</summary><p>{L(track.why, lang)}</p></details>
            <button className="btn primary big" disabled={before === null} onClick={() => void begin()}>▶ {L(S.play, lang)}</button>
          </div>
        )}

        {step === "playing" && (
          <div className="listen-stage">
            <p className="listen-how">{L(track.how, lang)}</p>
            {track.task === "breathe" && (
              <div className="breath-wrap" aria-live="polite">
                <div className="breath-circle" />
                <BreathWords lang={lang} />
              </div>
            )}
            {track.task === "dance" && <div className="dance-move" aria-live="polite">{L(DANCE_MOVES[Math.floor(bar / 2) % DANCE_MOVES.length], lang)}</div>}
            {track.task === "count8" && (
              <div className="chord-count" aria-live="polite">
                {Array.from({ length: perCycle }, (_, i) => <span key={i} className={bar % perCycle === i ? "on" : ""}>{i + 1}</span>)}
                <small>{L(S.chord, lang)} {(bar % perCycle) + 1}</small>
              </div>
            )}
            {(track.task === "bells" || track.task === "hum") && <div className="listen-pulse" aria-hidden>{track.task === "bells" ? "🔔" : "🎶"}</div>}
            <p className="listen-timer">⏳ {mm}</p>
            <button className="btn ghost" onClick={finish}>⏹ {L(S.stop, lang)}</button>
          </div>
        )}

        {step === "bells" && (
          <div className="card listen-panel">
            <h2>🔔 {L(S.howManyBells, lang)}</h2>
            <div className="row center wrap">
              {bellChoices.map((n) => (
                <button key={n} className="chip big-num" disabled={bellGuess !== null} onClick={() => { setBellGuess(n); playSfx(n === bells.current ? "tada" : "pop");
                  void speak(n === bells.current ? L(S.bellsRight, lang) : L(S.bellsWere, lang).replace("{n}", String(bells.current)), lang); }}>{n}</button>
              ))}
            </div>
            {bellGuess !== null && (
              <>
                <p className="story-feedback">{bellGuess === bells.current ? `🌟 ${L(S.bellsRight, lang)}` : `💛 ${L(S.bellsWere, lang).replace("{n}", String(bells.current))}`}</p>
                <button className="btn primary big" onClick={() => { setStep("after"); say(S.after); }}>▶</button>
              </>
            )}
          </div>
        )}

        {step === "after" && (
          <div className="card listen-panel">
            <h2>{L(S.after, lang)}</h2>
            <Faces chosen={after} onPick={save} />
          </div>
        )}

        {step === "done" && (
          <div className="card listen-panel" role="status">
            <p className="listen-result">{MOODS_FACES[before ?? 2]} → {MOODS_FACES[after ?? 2]}</p>
            <p className="story-feedback">{L(before !== null && after !== null && after > before ? S.better : S.same, lang)}</p>
            <p className="small">{L(track.why, lang)}</p>
            <button className="btn primary big" onClick={onDone}>🎧 {L(S.more, lang)}</button>
          </div>
        )}
      </div>
    </KidShell>
  );
}

/** "Breathe in..." for 4 seconds, "...and out" for 6: a longer out-breath is what slows the heart. */
function BreathWords({ lang }: { lang: Child["language"] }) {
  const [inhale, setInhale] = useState(true);
  useEffect(() => {
    let alive = true;
    let t: number;
    const loop = (inn: boolean) => { if (!alive) return; setInhale(inn); t = window.setTimeout(() => loop(!inn), inn ? 4000 : 6000); };
    loop(true);
    return () => { alive = false; window.clearTimeout(t); };
  }, []);
  return <p className="breath-words">{L(inhale ? S.breatheIn : S.breatheOut, lang)}</p>;
}
