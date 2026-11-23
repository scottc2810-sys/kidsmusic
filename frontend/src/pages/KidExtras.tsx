import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { listenOnce, speak, speechRecognitionAvailable } from "../audio/speech";
import { playSequence } from "../audio/synth";
import { Melo, type MeloMood } from "../components/Melo";
import { NoteGuide } from "../components/NoteGuide";
import { InstrumentView } from "../components/InstrumentView";
import { explainPart } from "../teaching/explain";
import { useInstrument } from "../teaching/instrument";
import { useTeacher } from "../teaching/persona";
import { SongBuilder } from "./SongBuilder";
import { t } from "../i18n";
import { KidShell, useChild } from "./KidHome";

const IDEAS: { key: "ideaUp" | "ideaDown" | "ideaJump" | "ideaEcho"; icon: string; notes: number[]; beats: number[] }[] = [
  { key: "ideaUp", icon: "🪜", notes: [60, 62, 64, 65, 67], beats: [1, 1, 1, 1, 2] },
  { key: "ideaDown", icon: "🛝", notes: [67, 65, 64, 62, 60], beats: [1, 1, 1, 1, 2] },
  { key: "ideaJump", icon: "🐸", notes: [60, 67, 60, 67, 72], beats: [1, 1, 1, 1, 2] },
  { key: "ideaEcho", icon: "🐘", notes: [60, 60, 64, 64, 67], beats: [2, 0.5, 0.5, 1, 2] },
];
const COMPOSE_BPM = 100;

/** Turn the child's real tap times into note lengths (½, 1 or 2 beats) so their rhythm is kept. */
export function tuneBeats(times: number[], bpm = COMPOSE_BPM): number[] {
  const beatMs = 60000 / bpm;
  return times.map((t, i) => {
    if (i === times.length - 1) return 1;
    const b = Math.round(((times[i + 1] - t) / beatMs) * 2) / 2;
    return Math.min(2, Math.max(0.5, b));
  });
}

/** Make your own tune: clear steps, ideas to copy, and a picture of the tune with its timing. */
export function FreePiano() {
  const { id = "" } = useParams();
  const { child } = useChild(id);
  const nav = useNavigate();
  const [tune, setTune] = useState<{ midi: number; t: number }[]>([]);
  const [lit, setLit] = useState<number | null>(null);
  const [mood, setMood] = useState<MeloMood>("happy");
  const [say, setSay] = useState("");
  const [idea, setIdea] = useState<(typeof IDEAS)[number] | null>(null);
  const [ideaPos, setIdeaPos] = useState(0);
  const [demoAt, setDemoAt] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const intro = useRef(false);
  const inst = useInstrument(id);
  useTeacher(id, "music");
  const [guided, setGuided] = useState<boolean | null>(null); // make a song with Melo, step by step (default for the youngest)
  useEffect(() => {
    if (!child || intro.current || (guided ?? child.age <= 5)) return;
    intro.current = true;
    setSay(t("composeIntro", child.language)); setMood("talking");
    void speak(t("composeIntro", child.language), child.language).then(() => setMood("happy"));
  }, [child, guided]);
  if (!child) return <div className="center-screen"><div className="spinner" /></div>;
  const lang = child.language;
  const isGuided = guided ?? child.age <= 5;
  const tabs = (
    <div className="mode-switch" role="group" aria-label={t("composeTitle", lang)}>
      <button className={isGuided ? "sel" : ""} aria-pressed={isGuided} onClick={() => setGuided(true)}>👣 {t("buildSong", lang)}</button>
      <button className={!isGuided ? "sel" : ""} aria-pressed={!isGuided} onClick={() => setGuided(false)}>🎹 {t("freeKeys", lang)}</button>
    </div>
  );
  if (isGuided) {
    return (
      <KidShell child={child}>
        <div className="row center wrap"><h1>{t("composeTitle", lang)}</h1>{tabs}</div>
        <SongBuilder child={child} inst={inst} />
        <div className="row center"><button className="btn ghost" onClick={() => nav(`/play/${id}`)}>🏠 {t("back", lang)}</button></div>
      </KidShell>
    );
  }
  const talk = async (text: string, after: MeloMood = "happy") => { setSay(text); setMood("talking"); await speak(text, lang); setMood(after); };

  const press = (m: number) => {
    if (busy) return;
    setTune((x) => [...x, { midi: m, t: performance.now() }].slice(-24));
    if (idea && ideaPos < idea.notes.length && ((m - idea.notes[ideaPos]) % 12 + 12) % 12 === 0) {
      const np = ideaPos + 1;
      setIdeaPos(np);
      if (np >= idea.notes.length) {
        setMood("cheer");
        window.setTimeout(() => { setIdea(null); void talk(t("ideaDone", lang)); }, 700);
      }
    }
  };
  const playIdea = async (i: (typeof IDEAS)[number]) => {
    setBusy(true); setIdea(i); setIdeaPos(0); setTune([]);
    await playSequence(i.notes.map((m, k) => ({ midi: m, beats: i.beats[k] })), COMPOSE_BPM,
      (k) => { setLit(k >= 0 ? i.notes[k] : null); setDemoAt(k >= 0 ? k : null); }).done;
    setLit(null); setDemoAt(null); setBusy(false);
    await talk(`${explainPart([i.notes], 0, lang)} ${t("followIdea", lang)}`, "listening"); // the why: what shape this idea makes
  };
  const beats = tuneBeats(tune.map((n) => n.t));
  const playMine = async () => {
    if (!tune.length) return;
    setBusy(true); setMood("happy");
    await playSequence(tune.map((n, i) => ({ midi: n.midi, beats: beats[i] })), COMPOSE_BPM,
      (i) => { setLit(i >= 0 ? tune[i].midi : null); setDemoAt(i >= 0 ? i : null); }).done;
    setLit(null); setDemoAt(null); setBusy(false); setMood("cheer");
  };
  const following = idea && !busy ? idea : null;

  return (
    <KidShell child={child}>
      <div className="lesson compose">
        <h1>{t("composeTitle", lang)}</h1>
        {tabs}
        <Melo mood={mood} size={100} say={say} />
        <section className="card howto">
          <ol>
            <li>🎹 {t("composeStep1", lang)}</li>
            <li>⏱️ {t("composeStep2", lang)}</li>
            <li>▶️ {t("composeStep3", lang)}</li>
          </ol>
        </section>
        <div className="row center wrap" role="group" aria-label={t("tryIdea", lang)}>
          <span className="muted">{t("tryIdea", lang)}</span>
          {IDEAS.map((i) => <button key={i.key} className="chip" onClick={() => void playIdea(i)} disabled={busy}>{i.icon} {t(i.key, lang)}</button>)}
        </div>
        {idea && (
          <NoteGuide notes={idea.notes} beats={idea.beats} lang={lang} bpm={COMPOSE_BPM}
            active={busy ? demoAt : ideaPos < idea.notes.length ? ideaPos : null} done={busy ? 0 : ideaPos} running={busy} />
        )}
        <InstrumentView inst={inst} tune={idea?.notes ?? tune.map((n) => n.midi)} from={48} to={72} lang={lang} lit={lit} onPlay={press} disabled={busy}
          glow={following && ideaPos < following.notes.length ? following.notes[ideaPos] : null}
          highlight={following ? following.notes : undefined} />
        {tune.length > 0 && !idea && (
          <NoteGuide notes={tune.map((n) => n.midi)} beats={beats} lang={lang} bpm={COMPOSE_BPM}
            active={busy ? demoAt : null} running={busy} label={t("yourTune", lang)} />
        )}
        <div className="row center wrap">
          <button className="btn" onClick={() => void playMine()} disabled={busy || !tune.length}>▶️ {t("playMine", lang)}</button>
          <button className="btn ghost" onClick={() => { setTune([]); setIdea(null); }} disabled={busy || (!tune.length && !idea)}>🧽 {t("clear", lang)}</button>
          <button className="btn ghost" onClick={() => nav(`/play/${id}`)}>🏠 {t("back", lang)}</button>
        </div>
      </div>
    </KidShell>
  );
}

const QUICK: Record<string, string[]> = {
  en: ["What is a note?", "What is rhythm?", "Let's play a song!", "I'm tired"],
  hi: ["सुर क्या होता है?", "ताल क्या है?", "चलो गाना बजाएँ!", "मुझे नींद आ रही है"],
  hinglish: ["Note kya hota hai?", "Rhythm kya hai?", "Chalo gaana bajayein!", "Mujhe neend aa rahi hai"],
};

/** Conversational teacher (Claude when allowed by the parent; curated offline answers otherwise). */
export function TalkToMelo() {
  const { id = "" } = useParams();
  const { child } = useChild(id);
  const nav = useNavigate();
  const [mood, setMood] = useState<MeloMood>("happy");
  const [reply, setReply] = useState("");
  const [text, setText] = useState("");
  const [history, setHistory] = useState<{ from: string; text: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [heardHint, setHeardHint] = useState<string | null>(null);
  if (!child) return <div className="center-screen"><div className="spinner" /></div>;
  const lang = child.language;

  const send = async (msg: string) => {
    if (!msg.trim() || busy) return;
    setBusy(true);
    setMood("thinking");
    try {
      const r = await api.chat(child.id, msg, history);
      setHistory([...history, { from: "child", text: msg }, { from: "melo", text: r.reply }].slice(-10));
      setReply(r.reply);
      setMood("talking");
      await speak(r.reply, lang);
      setMood(r.wants_rest ? "sleepy" : "happy");
      if (r.wants_game) setTimeout(() => nav(`/play/${id}/lesson`), 1500);
    } catch (e) {
      setReply((e as Error).message);
      setMood("idle");
    } finally {
      setBusy(false);
      setText("");
    }
  };

  const voice = async () => {
    setHeardHint(null);
    setMood("listening");
    try { const heard = await listenOnce(lang); if (heard) await send(heard); else setMood("happy"); }
    catch (e) {
      setMood("happy");
      // "not-allowed" = the browser blocked the mic; tell the grown-up how to fix it instead of failing silently.
      if ((e as Error).message === "not-allowed" || (e as Error).message === "service-not-allowed")
        setHeardHint("Melo can't hear you yet. Ask a grown-up to allow the microphone (🔒 icon in the address bar).");
    }
  };

  return (
    <KidShell child={child}>
      <div className="lesson talk-page">
        <Melo mood={mood} size={160} say={reply} />
        <div className="chips big">
          {(QUICK[lang] ?? QUICK.en).map((q) => <button key={q} className="chip" onClick={() => send(q)} disabled={busy}>{q}</button>)}
        </div>
        <form className="row center" onSubmit={(e) => { e.preventDefault(); void send(text); }}>
          <input value={text} maxLength={300} onChange={(e) => setText(e.target.value)} aria-label="Message to Melo" />
          <button className="btn" disabled={busy}>{t("send", lang)}</button>
          {child.consent_microphone && speechRecognitionAvailable() && (
            <button type="button" className="btn ghost" onClick={voice} disabled={busy}>🎤 {t("speak", lang)}</button>
          )}
        </form>
        {heardHint && <p className="muted small" role="status">{heardHint}</p>}
        <button className="btn ghost" onClick={() => nav(`/play/${id}`)}>🏠 {t("back", lang)}</button>
      </div>
    </KidShell>
  );
}
