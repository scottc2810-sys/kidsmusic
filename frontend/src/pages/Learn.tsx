// Language learning: listen, speak, read and write a new language through pictures.
// The server chooses each small activity and adapts it; this page plays it. Melo explains in the
// child's own language and says every new word in the language being learned. No timer, no
// pressure: a child can replay a word slowly as often as they like, or ask for another one.
// Melo reacts like a one-on-one teacher: the server sends an emotion for every answer (excited after a
// streak, proud after a comeback, playful after a first slip, gentle after a second), which drives the
// face, the voice and a small sound. If the child goes quiet, Melo notices and helps, instead of waiting forever.
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, type Child, type JourneyStep, type LearnActivity, type LearnAnswer, type LearnSkill, type LearnStatus, type NativeRef } from "../api";
import { hasVoiceFor, isSpeaking, listenIn, primeSpeech, sayIn, speak, speechRecognitionAvailable, stopSpeaking } from "../audio/speech";
import { credit, playNative, recordClip, stopNative } from "../audio/native";
import { playSequence, playSfx, unlockAudio, type Sfx } from "../audio/synth";
import { Confetti, Melo, type MeloMood } from "../components/Melo";
import { isEmotion, MOOD, type Emotion } from "../emotion";
import { L, t, topicTitle, type StrKey, type Text } from "../i18n";
import { KidShell, useChild } from "./KidHome";

const SKILL_ICON: Record<LearnSkill, string> = { listen: "👂", speak: "🗣️", read: "📖", write: "✍️" };
const SKILLS: LearnSkill[] = ["listen", "speak", "read", "write"];
const skillKey = (s: LearnSkill) => (`skill_${s}`) as StrKey;
const chime = () => playSequence([{ midi: 76, beats: 0.5, timbre: "bell" }, { midi: 84, beats: 1, timbre: "bell" }], 200);

// When the child goes quiet, a teacher notices: first a warm "take your time", then real help.
const NUDGE_AFTER_MS = [14000, 28000];
const NUDGE: Text[] = [
  { en: "Take your time. I'm right here. Which one do you think?", hi: "आराम से सोचो। मैं यहीं हूँ। तुम्हें कौन सा लगता है?",
    hinglish: "Aaraam se socho. Main yahin hoon. Tumhe kaunsa lagta hai?" },
  { en: "Let's listen once more, nice and slow. You can do it!", hi: "चलो एक बार और धीरे से सुनते हैं। तुम कर सकते हो!",
    hinglish: "Chalo ek baar aur dheere se sunte hain. Tum kar sakte ho!" },
];
const STREAK: Text = { en: "in a row", hi: "लगातार", hinglish: "lagaatar" };
const HOME_TIP: Text = { en: "For grown-ups: practise at home", hi: "बड़ों के लिए: घर पर अभ्यास", hinglish: "Bado ke liye: ghar par practice" };

function Stages({ stage }: { stage: number }) {
  return <span className="stage-stars" aria-label={`stage ${stage} of 5`}>{"★".repeat(stage)}{"☆".repeat(5 - stage)}</span>;
}

/** Pick a language: every language shows where the child is on the listen-speak-read-write scale. */
export function LanguageList() {
  const { id = "" } = useParams();
  const { child, error } = useChild(id);
  const nav = useNavigate();
  const [langs, setLangs] = useState<LearnStatus[] | null>(null);
  useEffect(() => { api.learnOverview(id).then(setLangs).catch(() => setLangs([])); }, [id]);
  useEffect(() => { if (child) void speak(t("pickLanguage", child.language), child.language); }, [child]);
  if (error) return <div className="center-screen"><p className="error">{error}</p></div>;
  if (!child || !langs) return <div className="center-screen"><div className="spinner" /></div>;
  const lang = child.language;
  const open = async (code: string) => { primeSpeech(); await unlockAudio(); nav(`/play/${id}/learn/${code}`); };
  return (
    <KidShell child={child}>
      <div className="lesson learn wide">
        <Melo mood="happy" size={110} say={t("pickLanguage", lang)} />
        <button className="btn big" onClick={() => nav(`/play/${id}/learn-compare`)}>🔀 {t("compare", lang)}</button>
        <div className="lang-grid">
          {[...langs].sort((a, b) => Number(b.started) - Number(a.started)).map((s) => (
            <button key={s.language.code} className={`lang-card${s.started ? " started" : ""}`} onClick={() => void open(s.language.code)}>
              <span className="lang-flag" aria-hidden>{s.language.flag}</span>
              <strong dir="auto">{s.language.native}</strong>
              <small>{s.language.name}</small>
              <Stages stage={s.stage} />
              {s.started && <small className="muted">{s.words_known}/{s.words_total} {t("wordsKnown", lang)}</small>}
            </button>
          ))}
        </div>
        <button className="btn ghost" onClick={() => nav(`/play/${id}`)}>🏠 {t("back", lang)}</button>
      </div>
    </KidShell>
  );
}

export function LanguageLesson() {
  const { id = "", lang = "" } = useParams();
  const [params] = useSearchParams();
  const { child, error } = useChild(id);
  if (error) return <div className="center-screen"><p className="error">{error}</p></div>;
  if (!child) return <div className="center-screen"><div className="spinner" /></div>;
  return <Runner key={lang} child={child} code={lang} startTopic={params.get("topic")} />;
}

function Runner({ child, code, startTopic }: { child: Child; code: string; startTopic: string | null }) {
  const ui = child.language;
  const nav = useNavigate();
  const [status, setStatus] = useState<LearnStatus | null>(null);
  const [act, setAct] = useState<LearnActivity | null>(null);
  const [result, setResult] = useState<LearnAnswer | null>(null);
  const [phase, setPhase] = useState<"intro" | "loading" | "activity" | "feedback" | "error">("intro");
  const [mood, setMood] = useState<MeloMood>("happy");
  const [say, setSay] = useState("");
  const [focus, setFocus] = useState<LearnSkill | null>(null);
  const [topic, setTopic] = useState<string | null>(startTopic); // null = picture words; else a conversation topic
  const topicRef = useRef(topic);
  topicRef.current = topic;
  const [stars, setStars] = useState(0);
  const [streak, setStreak] = useState(0);
  const [party, setParty] = useState(0); // bumps to fire the confetti
  const touched = useRef(Date.now()); // last time the child (or Melo) did something
  const nudges = useRef(0);
  const [problem, setProblem] = useState<string | null>(null);
  const alive = useRef(true);
  const focusRef = useRef(focus);
  focusRef.current = focus;
  const canSpeak = child.consent_microphone && speechRecognitionAvailable();
  const locale = status?.language.locale ?? "en-US";

  useEffect(() => {
    alive.current = true;
    api.learnStatus(child.id, code).then(setStatus).catch((e) => { setProblem(e.message); setPhase("error"); });
    return () => { alive.current = false; stopSpeaking(); stopNative(); void api.learnEnd(child.id, code); };
  }, [child.id, code]);

  const talk = useCallback(async (text: string, after: MeloMood = "listening", emotion?: Emotion) => {
    if (!alive.current || !text) return;
    setSay(text); setMood("talking");
    await speak(text, ui, emotion);
    if (alive.current) { setMood(after); touched.current = Date.now(); }
  }, [ui]);
  /** Say a word in the language being learned (slowly on request). */
  const [voiceCredit, setVoiceCredit] = useState("");
  /** Say a word: a real native speaker when we have one (female and male take turns), else the device voice. */
  const sayWord = useCallback(async (text: string | null | undefined, slow = false, refs?: NativeRef[]) => {
    if (!text || !alive.current) return;
    setMood("talking");
    const played = refs?.length ? await playNative(refs, slow) : null;
    setVoiceCredit(played ? credit(played) : "");
    if (!played) await sayIn(text, locale, slow ? 0.6 : 0.85);
    if (alive.current) setMood("listening");
  }, [locale]);
  /** Native recordings belong to the activity's word; a conversation question is spoken by Melo. */
  const refsOf = (a: LearnActivity | null) => (a && !a.spec.question ? a.native ?? [] : []);

  const modelOf = (a: LearnActivity): string | null => {
    const s = a.spec;
    if (a.type === "listen_pick") return s.word;
    if (a.type === "letter_sound") return s.say;
    if (a.type === "say_word") return s.question ?? (s.model ? s.word : null); // a conversation: Melo asks the question
    if (a.type === "reply_pick") return s.question;
    if (a.type === "trace" || a.type === "spell") return s.hear;
    return null; // read_pick: the child reads; no sound until the answer
  };

  const next = useCallback(async () => {
    setPhase("loading"); setResult(null); setMood("thinking");
    try {
      const a = await api.learnNext(child.id, code, { focus: focusRef.current ?? undefined, speech: canSpeak, topic: topicRef.current ?? undefined });
      if (!alive.current) return;
      setAct(a); setPhase("activity");
      nudges.current = 0;
      await talk(a.say, "listening", isEmotion(a.emotion) ? a.emotion : undefined);
      await sayWord(modelOf(a), false, refsOf(a));
      touched.current = Date.now();
    } catch (e) { setProblem((e as Error).message); setPhase("error"); }
  }, [child.id, code, canSpeak, talk, sayWord]);

  const begin = async () => { primeSpeech(); await unlockAudio(); await next(); };

  // A teacher notices a quiet child: after a while a warm nudge, later real help (hear it again, slowly).
  useEffect(() => {
    if (phase !== "activity" || !act) return;
    const id = window.setInterval(() => {
      if (!alive.current || isSpeaking()) { touched.current = Math.max(touched.current, Date.now() - 1000); return; }
      const idle = Date.now() - touched.current;
      const n = nudges.current;
      if (n >= NUDGE_AFTER_MS.length || idle < NUDGE_AFTER_MS[n] - (n ? NUDGE_AFTER_MS[n - 1] : 0)) return;
      nudges.current = n + 1;
      touched.current = Date.now();
      void (async () => {
        await talk(L(NUDGE[n], ui), "listening", n === 0 ? "curious" : "warm");
        if (n === 1) await sayWord(modelOf(act) ?? act.spec.word ?? act.spec.say ?? act.spec.hear, true);
      })();
    }, 1000);
    return () => clearInterval(id);
  }, [phase, act, talk, sayWord, ui]);

  const answer = async (response: Record<string, unknown>) => {
    if (!act || phase !== "activity") return;
    setPhase("feedback");
    try {
      const r = await api.learnAnswer(child.id, act.attempt_id, response);
      if (!alive.current) return;
      setResult(r); setStatus(r.status);
      setStreak(r.streak ?? 0);
      const feel: Emotion = isEmotion(r.emotion) ? r.emotion : r.outcome === "success" ? "excited" : r.outcome === "miss" ? "warm" : "calm";
      if (r.star) setStars((n) => n + 1);
      // first the face and a small sound (a clap, a sparkle, a soft "uh-oh"), then the words: that is how people react
      if (r.sfx) playSfx(r.sfx as Sfx); else if (r.star) void chime();
      if (feel === "celebrate") setParty((n) => n + 1);
      setMood(MOOD[feel]);
      await new Promise((res) => setTimeout(res, feel === "empathetic" ? 900 : 550));
      // after the words Melo keeps the feeling, but a sad face turns into a kind, encouraging one
      await talk(r.say, feel === "empathetic" || r.outcome === "miss" ? "encourage" : MOOD[feel], feel);
      if (!response.skipped) await sayWord(r.reveal.word, false, r.reveal.native); // hear the right word once more: that is how it sticks
      if (alive.current) window.setTimeout(() => { if (alive.current) void next(); }, r.outcome === "success" ? 600 : 1400);
    } catch (e) { setProblem((e as Error).message); setPhase("error"); }
  };

  if (phase === "error" || !status) {
    return (
      <KidShell child={child}>
        <div className="lesson">{problem ? <p className="error">{problem}</p> : <div className="spinner" />}
          <button className="btn ghost" onClick={() => nav(`/play/${child.id}/learn`)}>⬅ {t("back", ui)}</button></div>
      </KidShell>
    );
  }
  const lang = status.language;
  const busy = phase !== "activity";
  return (
    <KidShell child={child}>
      <div className="lesson learn" onPointerDown={() => { touched.current = Date.now(); }}>
        <Confetti burst={party} />
        <div className="learn-head">
          <h1><span aria-hidden>{lang.flag}</span> <span dir="auto">{lang.native}</span></h1>
          <span className="stars" aria-label={`${stars} stars`}>⭐ {stars}{streak >= 2 && <small className="streak"> · 🔥 {streak} {L(STREAK, ui)}</small>}</span>
        </div>
        <div className="skill-chips" role="group" aria-label="Skills">
          <button className={`skill-chip${focus === null ? " sel" : ""}`} onClick={() => setFocus(null)}>🌈 {t("allSkills", ui)}</button>
          {SKILLS.map((s) => (
            <button key={s} className={`skill-chip${focus === s ? " sel" : ""}`} disabled={s === "speak" && !canSpeak}
              title={s === "speak" && !canSpeak ? "Speaking needs the microphone (parent settings) and Chrome or Edge" : status.skills[s].stage_name}
              onClick={() => setFocus(s)}>
              {SKILL_ICON[s]} {t(skillKey(s), ui)} <Stages stage={status.skills[s].stage} />
            </button>
          ))}
        </div>
        <div className="topic-chips" role="tablist" aria-label={t("conversations", ui)}>
          <button role="tab" aria-selected={topic === null} className={`skill-chip${topic === null ? " sel" : ""}`} onClick={() => setTopic(null)}>
            🔤 {t("words", ui)} <small>{status.words_known}/{status.words_total}</small>
          </button>
          {status.topics.map((tp) => (
            <button key={tp.id} role="tab" aria-selected={topic === tp.id} className={`skill-chip${topic === tp.id ? " sel" : ""}`} onClick={() => setTopic(tp.id)}>
              {tp.emoji} {topicTitle(tp.id, tp.title, ui)} <small>{tp.known}/{tp.total}</small>
            </button>
          ))}
        </div>
        <Melo mood={mood} size={phase === "intro" ? 150 : 92} say={say} />
        {!hasVoiceFor(lang.locale) && (
          <p className="muted small">No {lang.name} voice is installed on this device, so words are shown but not spoken. Add it in your system's speech settings, or open Melo in Microsoft Edge.</p>
        )}

        {phase === "intro" && (
          <>
            <p className="learn-scale">{t("stage", ui)} {status.stage}/5 · {status.words_known}/{status.words_total} {t("wordsKnown", ui)}</p>
            {status.journey && <Journey steps={status.journey} ui={ui} />}
            <button className="btn huge" onClick={() => void begin()}>▶ {t("start", ui)}</button>
          </>
        )}
        {phase === "loading" && <p className="muted">{t("loading", ui)}</p>}
        {(phase === "activity" || phase === "feedback") && act && (
          <div className="stage learn-stage" key={act.attempt_id} dir={lang.rtl ? "rtl" : "ltr"}>
            {(act.type === "listen_pick" || act.type === "read_pick" || act.type === "letter_sound" || act.type === "reply_pick") && (
              <Pick act={act} busy={busy} result={result} onPick={(i) => void answer({ choice: i })} />
            )}
            {act.type === "say_word" && <Say act={act} busy={busy} locale={lang.locale} ui={ui} result={result} childId={child.id} onHeard={(heard) => void answer({ heard })} />}
            {act.type === "trace" && <TracePad key={act.attempt_id} glyph={act.spec.glyph} guide={act.spec.guide} emoji={act.spec.emoji} busy={busy} ui={ui} onDone={(r) => void answer(r)} />}
            {act.type === "spell" && <Spell act={act} busy={busy} ui={ui} onDone={(text) => void answer({ text })} />}
          </div>
        )}
        {voiceCredit && (phase === "activity" || phase === "feedback") && <p className="voice-credit">{voiceCredit}</p>}
        {phase === "activity" && act && (
          <div className="row center wrap">
            {modelOf(act) !== null || act.type === "say_word" ? (
              <>
                <button className="btn ghost" onClick={() => void sayWord(modelOf(act) ?? act.spec.word ?? act.spec.say ?? act.spec.hear, false, refsOf(act))}>🔊 {t("hearIt", ui)}</button>
                <button className="btn ghost" onClick={() => void sayWord(modelOf(act) ?? act.spec.word ?? act.spec.say ?? act.spec.hear, true, refsOf(act))}>🐢 {t("slower", ui)}</button>
              </>
            ) : null}
            <button className="btn ghost" onClick={() => void answer({ skipped: true })}>⏭ {t("anotherOne", ui)}</button>
          </div>
        )}
        <button className="btn ghost small" onClick={() => nav(`/play/${child.id}/learn`)}>⬅ {t("back", ui)}</button>
      </div>
    </KidShell>
  );
}

type Opt = { emoji?: string; text?: string };

function Pick({ act, busy, result, onPick }: { act: LearnActivity; busy: boolean; result: LearnAnswer | null; onPick: (i: number) => void }) {
  const [chosen, setChosen] = useState<number | null>(null);
  const s = act.spec;
  const options: Opt[] = s.options;
  const correct = result?.reveal.correct;
  return (
    <div className="activity learn-pick">
      {act.type === "read_pick" && s.prompt && (
        <div className="learn-prompt">
          {s.prompt.emoji ? <span className="learn-emoji">{s.prompt.emoji}</span> : <strong className="learn-word" dir="auto">{s.prompt.text}</strong>}
          {s.prompt.roman && <small className="roman">{s.prompt.roman}</small>}
        </div>
      )}
      {act.type === "listen_pick" && (
        <div className="learn-prompt">
          <span className="learn-emoji" aria-hidden>🔊</span>
          {(s.show_word || result) && <strong className="learn-word small" dir="auto">{s.word}</strong>}
          {s.roman && <small className="roman">{s.roman}</small>}
        </div>
      )}
      {act.type === "letter_sound" && <div className="learn-prompt"><span className="learn-emoji" aria-hidden>{s.barakhadi ? "🔤" : "🔊"}</span></div>}
      {act.type === "reply_pick" && (
        <div className="learn-prompt">
          <div className="reply-question"><span aria-hidden>🦉💬</span>{(s.show_question || result) ? <span dir="auto">{s.question}</span> : <span aria-hidden>🔊 …</span>}</div>
          {s.roman && <small className="roman">{s.roman}</small>}
          <span className="learn-emoji small" aria-hidden>🙋</span>
        </div>
      )}
      <div className={`choices n${options.length}`}>
        {options.map((o, i) => (
          <button key={i} disabled={busy} dir="auto"
            className={["choice-btn", chosen === i ? "chosen" : "", correct === i ? "correct" : "", s.glow === i && chosen === null ? "glow" : ""].join(" ")}
            onClick={() => { if (chosen === null) { setChosen(i); onPick(i); } }}>
            {o.emoji ? <span className="choice-icon">{o.emoji}</span> : <span className="choice-text">{o.text}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

function Say({ act, busy, locale, ui, result, childId, onHeard }: {
  act: LearnActivity; busy: boolean; locale: string; ui: Child["language"]; result: LearnAnswer | null; childId: string; onHeard: (heard: string[]) => void;
}) {
  const [listening, setListening] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const s = act.spec;
  const go = async () => {
    setNote(null); setListening(true);
    // record the child's voice at the same time, to compare it with native speakers (only the score is kept)
    const clip = await recordClip(9000).catch(() => null);
    let heard: string[] = [];
    let blocked = false;
    try { heard = await listenIn(locale); }
    catch (e) {
      const m = (e as Error).message;
      blocked = m === "not-allowed" || m === "service-not-allowed";
      if (blocked) setNote("Melo can't hear yet. Ask a grown-up to allow the microphone (🔒 icon in the address bar).");
    } finally {
      clip?.stop();
      const wav = clip ? await clip.result : null;
      if (wav && (act.native?.length ?? 0) > 0) await api.learnVoice(childId, act.attempt_id, wav).catch(() => null);
      setListening(false);
    }
    if (!blocked) onHeard(heard); // nothing heard is never the child's fault; a blocked microphone waits for a grown-up
  };
  return (
    <div className="activity learn-say">
      {s.question ? <div className="reply-question"><span aria-hidden>🦉💬</span><span dir="auto">{s.question}</span></div>
        : <span className="learn-emoji big">{s.emoji}</span>}
      {s.show_word && <strong className="learn-word" dir="auto">{s.word}</strong>}
      {s.question && result && <strong className="learn-word small" dir="auto">🙋 {s.word}</strong>}
      {s.roman && <small className="roman">{s.roman}</small>}
      <button className={`mic-btn${listening ? " on" : ""}`} onClick={() => void go()} disabled={busy || listening} aria-label={t("sayIt", ui)}>🎤</button>
      <p className="phase">{listening ? t("listening", ui) : t("sayIt", ui)}</p>
      {result?.reveal.heard && <p className="small muted">{t("heardYou", ui)}: <span dir="auto">“{result.reveal.heard}”</span></p>}
      {result?.reveal.pronunciation != null && (
        <p className="pron-score" title="Compared with recordings by native speakers. An estimate: microphones and rooms differ.">
          {"⭐".repeat(Math.max(1, Math.ceil(result.reveal.pronunciation / 20)))} <small className="muted">sounds {Math.round(result.reveal.pronunciation)}% like native speakers</small>
        </p>
      )}
      {note && <p className="muted small">{note}</p>}
    </div>
  );
}

/** The road from first sounds to little conversations, with the current stage glowing and a tip for grown-ups. */
function Journey({ steps, ui }: { steps: JourneyStep[]; ui: Child["language"] }) {
  const now = steps.find((x) => x.current) ?? steps[steps.length - 1];
  return (
    <>
      <div className="journey" role="list" aria-label="Learning journey">
        {steps.map((x) => (
          <div key={x.stage} role="listitem" className={`journey-step${x.reached ? " reached" : ""}${x.current ? " current" : ""}`}
            title={`${x.title}: listen ${x.listen}; read ${x.read}; write ${x.write}; speak ${x.speak}`}>
            <b aria-hidden>{x.reached ? "✅" : x.emoji}</b><span>{x.title}</span>
          </div>
        ))}
      </div>
      <details className="journey-tip muted small">
        <summary>👪 {L(HOME_TIP, ui)}</summary>
        <p><strong>{now.emoji} {now.title}:</strong> 👂 {now.listen} · 📖 {now.read} · ✍️ {now.write} · 🗣️ {now.speak}</p>
        <p>💡 {now.home}</p>
      </details>
    </>
  );
}

export function Spell({ act, busy, ui, onDone }: { act: LearnActivity; busy: boolean; ui: Child["language"]; onDone: (text: string) => void }) {
  const tiles: string[] = act.spec.tiles;
  const joiner: string = act.spec.joiner ?? "";
  const [picked, setPicked] = useState<number[]>([]);
  const full = picked.length >= act.spec.length;
  return (
    <div className="activity learn-spell">
      <span className="learn-emoji big">{act.spec.emoji}</span>
      {act.spec.show_text && <p className="learn-word small copy-model" dir="auto">{act.spec.show_text}</p>}
      {act.spec.roman && <small className="roman">{act.spec.roman}</small>}
      <div className="spell-slots" aria-label="Your word">
        {Array.from({ length: act.spec.length }, (_, i) => (
          <button key={i} className={`spell-slot${picked[i] != null ? " filled" : ""}`} disabled={busy || picked[i] == null}
            onClick={() => setPicked(picked.filter((_, k) => k !== i))}>{picked[i] != null ? tiles[picked[i]] : ""}</button>
        ))}
      </div>
      <div className="spell-tiles">
        {tiles.map((tile, i) => (
          <button key={i} className="spell-tile" disabled={busy || full || picked.includes(i)} onClick={() => setPicked([...picked, i])}>{tile}</button>
        ))}
      </div>
      <div className="row center">
        <button className="btn ghost" onClick={() => setPicked([])} disabled={busy || !picked.length}>🧽 {t("clear", ui)}</button>
        <button className="btn" onClick={() => onDone(picked.map((i) => tiles[i]).join(joiner))} disabled={busy || !full}>✅ {t("done", ui)}</button>
      </div>
    </div>
  );
}

const PAD = 300;
const FONTS = '"Noto Sans", "Segoe UI", "Nirmala UI", "Mangal", "Microsoft YaHei", "PingFang SC", "Malgun Gothic", "Arial Unicode MS", sans-serif';

/** How much of the letter the strokes cover, and how much of the drawing fell outside it. */
export function traceScore(mask: Uint8Array, tolerant: Uint8Array, strokes: Uint8Array): { coverage: number; spill: number } {
  let glyph = 0, covered = 0, drawn = 0, outside = 0;
  for (let i = 0; i < mask.length; i++) {
    if (mask[i]) { glyph++; if (strokes[i]) covered++; }
    if (strokes[i]) { drawn++; if (!tolerant[i]) outside++; }
  }
  return { coverage: glyph ? Math.round((covered / glyph) * 100) / 100 : 0, spill: drawn ? Math.round((outside / drawn) * 100) / 100 : 0 };
}

/** Trace a letter with a finger or the mouse. The letter is drawn faintly underneath as the guide. */
function TracePad({ glyph, guide, emoji, busy, ui, onDone }: {
  glyph: string; guide: boolean; emoji?: string; busy: boolean; ui: Child["language"];
  onDone: (r: { strokes: number; coverage: number; spill: number }) => void;
}) {
  const view = useRef<HTMLCanvasElement>(null);
  const ink = useRef<HTMLCanvasElement | null>(null);
  const masks = useRef<{ mask: Uint8Array; tolerant: Uint8Array } | null>(null);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [strokes, setStrokes] = useState(0);

  const paintGlyph = (ctx: CanvasRenderingContext2D, outline: number) => {
    let size = PAD * 0.72;
    ctx.font = `${size}px ${FONTS}`;
    const w = ctx.measureText(glyph).width;
    if (w > PAD * 0.8) { size *= (PAD * 0.8) / w; ctx.font = `${size}px ${FONTS}`; }
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    if (outline) { ctx.lineWidth = outline; ctx.lineJoin = "round"; ctx.strokeText(glyph, PAD / 2, PAD / 2 + size * 0.04); }
    ctx.fillText(glyph, PAD / 2, PAD / 2 + size * 0.04);
  };
  const alpha = (c: HTMLCanvasElement) => {
    const d = c.getContext("2d")!.getImageData(0, 0, PAD, PAD).data;
    const out = new Uint8Array(PAD * PAD);
    for (let i = 0; i < out.length; i++) out[i] = d[i * 4 + 3] > 80 ? 1 : 0;
    return out;
  };
  const redraw = useCallback(() => {
    const c = view.current?.getContext("2d");
    if (!c) return;
    c.clearRect(0, 0, PAD, PAD);
    c.fillStyle = guide ? "#cfc6f5" : "#e9e5f8"; c.strokeStyle = "transparent";
    paintGlyph(c, 0);
    if (ink.current) c.drawImage(ink.current, 0, 0);
  }, [glyph, guide]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const make = () => { const c = document.createElement("canvas"); c.width = c.height = PAD; return c; };
    const a = make(), b = make();
    const ca = a.getContext("2d")!, cb = b.getContext("2d")!;
    ca.fillStyle = "#000"; paintGlyph(ca, 0);
    cb.fillStyle = "#000"; cb.strokeStyle = "#000"; paintGlyph(cb, 34); // forgiving: a wobbly line near the letter still counts
    masks.current = { mask: alpha(a), tolerant: alpha(b) };
    ink.current = make();
    setStrokes(0);
    redraw();
  }, [glyph, redraw]); // eslint-disable-line react-hooks/exhaustive-deps

  const at = (e: React.PointerEvent) => {
    const r = view.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * PAD, y: ((e.clientY - r.top) / r.height) * PAD };
  };
  const line = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const c = ink.current!.getContext("2d")!;
    c.strokeStyle = "#6c4cf1"; c.lineWidth = 20; c.lineCap = "round"; c.lineJoin = "round";
    c.beginPath(); c.moveTo(from.x, from.y); c.lineTo(to.x, to.y); c.stroke();
    redraw();
  };
  const down = (e: React.PointerEvent) => { if (busy) return; e.preventDefault(); view.current?.setPointerCapture(e.pointerId); const p = at(e); last.current = p; line(p, p); };
  const move = (e: React.PointerEvent) => { if (!last.current) return; const p = at(e); line(last.current, p); last.current = p; };
  const up = () => { if (last.current) { last.current = null; setStrokes((n) => n + 1); } };
  const clear = () => { ink.current!.getContext("2d")!.clearRect(0, 0, PAD, PAD); setStrokes(0); redraw(); };
  const finish = () => { if (masks.current && ink.current) onDone({ strokes, ...traceScore(masks.current.mask, masks.current.tolerant, alpha(ink.current)) }); };

  return (
    <div className="activity learn-trace">
      {emoji && <span className="learn-emoji">{emoji}</span>}
      <canvas ref={view} width={PAD} height={PAD} className="trace-pad" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up}
        aria-label={`Trace ${glyph}`} />
      <div className="row center">
        <button className="btn ghost" onClick={clear} disabled={busy || !strokes}>🧽 {t("clear", ui)}</button>
        <button className="btn" onClick={finish} disabled={busy || !strokes}>✅ {t("done", ui)}</button>
      </div>
    </div>
  );
}
