import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { api, type AnswerResult, type Child, type NextActivity, type SessionDone, type StartSession } from "../api";
import { ChoiceActivity } from "../activities/ChoiceActivity";
import type { ActivityProps } from "../activities/common";
import { NotesActivity } from "../activities/NotesActivity";
import { RhythmActivity } from "../activities/RhythmActivity";
import { MicNoteInput } from "../audio/mic";
import { primeSpeech, speak, stopSpeaking } from "../audio/speech";
import { micErrorMessage } from "../audio/permissions";
import { playSequence, playSfx, unlockAudio } from "../audio/synth";
import { Confetti, Melo, type MeloMood } from "../components/Melo";
import { MOOD, musicReaction, type Emotion } from "../emotion";
import { L, noteLabel, t } from "../i18n";
import { CameraObserver, loadCalibration } from "../vision/camera";
import { KidShell, useChild } from "./KidHome";

type Phase = "intro" | "loading" | "activity" | "feedback" | "break" | "done" | "error";

const fanfare = () => playSequence([{ midi: 72, beats: 0.5 }, { midi: 76, beats: 0.5 }, { midi: 79, beats: 1 }], 160);

export function Lesson() {
  const { id = "" } = useParams();
  const q = new URLSearchParams(useLocation().search);
  const topic = q.get("topic"); // Music Basics practice
  const { child, error } = useChild(id);
  if (error) return <div className="center-screen"><p className="error">{error}</p></div>;
  if (!child) return <div className="center-screen"><div className="spinner" /></div>;
  return <LessonRunner child={child} topic={topic} focus={q.get("focus")} />;
}

function LessonRunner({ child, topic, focus }: { child: Child; topic: string | null; focus: string | null }) {
  const lang = child.language;
  const nav = useNavigate();
  const home = topic ? `/play/${child.id}/basics` : `/play/${child.id}`; // Basics practice returns to Basics
  const [phase, setPhase] = useState<Phase>("intro");
  const [mood, setMood] = useState<MeloMood>("happy");
  const [say, setSay] = useState("");
  const [session, setSession] = useState<StartSession | null>(null);
  const [act, setAct] = useState<NextActivity | null>(null);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [done, setDone] = useState<SessionDone | null>(null);
  const [stars, setStars] = useState(0);
  const [source, setSource] = useState<"screen" | "mic">("screen");
  const [hands, setHands] = useState<number | null>(null);
  const [ears, setEars] = useState(false); // the microphone is on: Melo hears a real keyboard too
  const [heard, setHeard] = useState<string | null>(null); // the last note Melo heard
  const [problem, setProblem] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [now, setNow] = useState(Date.now());
  const mic = useRef<MicNoteInput | null>(null);
  const cam = useRef<CameraObserver | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const sid = useRef<string | null>(null);
  const ended = useRef(false);
  const alive = useRef(true);

  const talk = useCallback(async (text: string, after: MeloMood = "idle", emotion?: Emotion) => {
    if (!alive.current) return;
    setSay(text);
    setMood("talking");
    await speak(text, lang, emotion);
    if (alive.current) setMood(after);
  }, [lang]);
  const run = useRef({ streak: 0, misses: 0 }); // how this sitting is going, for the teacher's reactions
  const [party, setParty] = useState(0);

  // cleanup: stop devices; close an unfinished lesson so the history stays accurate
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      stopSpeaking();
      mic.current?.stop();
      cam.current?.stop();
      if (sid.current && !ended.current) void api.endSession(sid.current).catch(() => {});
    };
  }, []);
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  const finish = (d: SessionDone) => {
    ended.current = true;
    setDone(d);
    setStars(d.stars);
    setPhase("done");
    void fanfare();
    void talk(d.message, "sleepy");
  };

  const next = useCallback(async () => {
    if (!sid.current) return;
    setPhase("loading");
    setResult(null);
    setMood("thinking");
    try {
      const n = await api.next(sid.current);
      if (n.done) return finish(n);
      setAct(n);
      setPhase("activity");
      setSpeaking(true); // activity is visible but waits for Melo to finish the instruction
      await talk(n.say, "listening");
      if (alive.current) setSpeaking(false);
    } catch (e) {
      setProblem((e as Error).message);
      setPhase("error");
    }
  }, [talk]); // eslint-disable-line react-hooks/exhaustive-deps

  const begin = async () => {
    primeSpeech(); // inside the tap: the greeting is spoken only after the (possibly slow) AI lesson plan
    await unlockAudio();
    setPhase("loading");
    let mode = child.mode;
    let listening = false;
    // Melo's ears: whenever the parent allowed the microphone, Melo listens to a real keyboard in
    // every mode (the screen keys keep working too). Without it, fall back to the screen gracefully.
    if (child.consent_microphone) {
      try {
        const m = new MicNoteInput();
        await m.start(); // getUserMedia shows the browser's permission prompt here if not decided yet
        m.onNote((n) => { setHeard(noteLabel(n.midi, lang)); window.setTimeout(() => setHeard(null), 1200); });
        mic.current = m; listening = true; setEars(true);
        if (mode === "real") setSource("mic");
      } catch (e) {
        mic.current = null;
        if (mode === "real") { mode = "screen"; setProblem(`${micErrorMessage(e).message} Using the screen piano for now.`); }
      }
    } else if (mode === "real") mode = "screen";
    if (mode === "real" && child.consent_camera && videoRef.current) {
      // With a marked keyboard area the camera cross-checks notes; without it, it still watches the hands.
      const c = new CameraObserver(videoRef.current, loadCalibration(child.id));
      c.start().then(() => { cam.current = c; c.onObservation((o) => setHands(o.handsVisible)); }).catch(() => { /* camera is optional */ });
    }
    try {
      const s = await api.startSession(child.id, mode, topic ?? undefined, listening, focus ?? undefined);
      sid.current = s.session_id;
      setSession(s);
      setStartedAt(Date.now());
      await talk(`${s.greeting} ${s.theme_line}`, "happy");
      await next();
    } catch (e) {
      setProblem((e as Error).message);
      setPhase("error");
    }
  };

  const submit = async (response: Record<string, unknown>) => {
    if (!sid.current || !act || phase !== "activity" || speaking) return;
    setPhase("feedback");
    try {
      const r = await api.answer(sid.current, act.attempt_id, response);
      setResult(r);
      setStars(r.stars);
      if (r.stars_earned) void fanfare();
      const happy = r.outcome === "success" || r.outcome === "partial";
      // React first, like a real teacher: a clap for a streak, pride after a comeback, a playful "uh-oh"
      // after a first slip and a soft, caring face after a second one. Then the words, in a matching voice.
      const prev = run.current;
      const streak = r.outcome === "success" ? prev.streak + 1 : 0;
      const feel = musicReaction(r.outcome, streak, prev.misses, r.events.includes("level_up"));
      run.current = { streak, misses: r.outcome === "miss" ? prev.misses + 1 : r.outcome === "success" ? 0 : prev.misses };
      if (feel.sfx && !r.stars_earned) playSfx(feel.sfx);
      if (feel.emotion === "celebrate") setParty((n) => n + 1);
      setMood(MOOD[feel.emotion]);
      await new Promise((res) => setTimeout(res, r.outcome === "success" ? 900 : feel.emotion === "empathetic" ? 900 : 500));
      await talk(r.say, happy ? MOOD[feel.emotion] : r.outcome === "miss" ? "encourage" : "idle", feel.emotion);
      if (!alive.current) return;
      if (r.events.includes("break_offer")) { setPhase("break"); return; }
      window.setTimeout(() => { if (alive.current) void next(); }, r.events.includes("check_mic") ? 2500 : 1200);
    } catch (e) {
      setProblem((e as Error).message);
      window.setTimeout(() => void next(), 1500);
    }
  };

  const signal = async (s: "tired" | "frustrated" | "want_game") => {
    if (!sid.current) return nav(home);
    stopSpeaking();
    setSpeaking(false);
    try {
      const r = await api.signal(sid.current, s);
      if (r.done) return finish(r as SessionDone);
      await talk((r as { say: string }).say, "happy");
      void next();
    } catch { nav(home); }
  };

  const minutes = session?.minutes ?? child.session_minutes;
  const elapsed = startedAt ? (now - startedAt) / 1000 : 0;
  const timePct = Math.min(100, (elapsed / (minutes * 60)) * 100);

  const props: ActivityProps | null = act ? {
    spec: act.spec, lang, source, mic: mic.current, camera: cam.current, onSubmit: submit,
    locked: phase !== "activity" || speaking, reveal: result?.reveal,
  } : null;

  return (
    <KidShell child={child} onExit={() => { mic.current?.stop(); cam.current?.stop(); }}>
      <div className="lesson">
        <div className="lesson-top">
          <div className="stars" aria-label={`${stars} stars`}>⭐ {stars}</div>
          {startedAt > 0 && <div className="time" aria-label="Lesson time"><div style={{ width: `${timePct}%` }} /></div>}
          {phase !== "intro" && phase !== "done" && (
            <div className="kid-controls">
              <button onClick={() => signal("tired")} aria-label={t("tired", lang)}>🌙<span>{t("tired", lang)}</span></button>
              <button onClick={() => signal("frustrated")} aria-label={t("tooHard", lang)}>🤔<span>{t("tooHard", lang)}</span></button>
              <button onClick={() => signal("want_game")} aria-label={t("game", lang)}>🎲<span>{t("game", lang)}</span></button>
            </div>
          )}
        </div>

        <div className={`teacher ${phase === "activity" ? "small" : ""}`}>
          <Confetti burst={party} />
          <Melo mood={mood} size={phase === "activity" || phase === "feedback" ? 96 : 170} say={say} />
          {result && phase === "feedback" && result.stars_earned > 0 && <div className="star-burst" aria-hidden>⭐</div>}
        </div>

        {ears && (
          <div className="sensor-status small" aria-live="polite">
            🎤 {t("earsOn", lang)}{heard && <strong className="heard-note"> · {heard}</strong>}
            {hands !== null && <span> · 📷 {hands > 0 ? t("handsSeen", lang) : t("handsNotSeen", lang)}</span>}
            {result?.events.includes("check_mic") && (
              <button className="btn small" onClick={() => setSource("screen")}>{t("useScreen", lang)}</button>
            )}
          </div>
        )}
        <video ref={videoRef} className="hidden-video" muted playsInline />

        {phase === "intro" && (
          <button className="btn huge" onClick={begin}>▶ {t("start", lang)}</button>
        )}
        {phase === "loading" && <p className="muted">{t("loading", lang)}</p>}
        {(phase === "activity" || phase === "feedback") && act && props && (
          <div className="stage" key={act.attempt_id}>
            {(act.type === "high_low" || act.type === "loud_soft" || act.type === "instrument_guess" || act.type === "same_different" || act.type === "fast_slow") && <ChoiceActivity kind={act.type} {...props} />}
            {act.type === "rhythm_tap" && <RhythmActivity {...props} />}
            {(act.type === "find_note" || act.type === "echo_melody" || act.type === "play_song" || act.type === "free_play") && <NotesActivity kind={act.type} {...props} />}
          </div>
        )}
        {phase === "break" && (
          <div className="big-choices two">
            <button className="big-choice bc-purple" onClick={() => signal("tired")}><span>🌙</span>{t("rest", lang)}</button>
            <button className="big-choice bc-green" onClick={() => void next()}><span>🎈</span>{t("easyGame", lang)}</button>
          </div>
        )}
        {phase === "done" && done && (
          <div className="done">
            <div className="star-row" aria-label={`${done.stars} stars`}>{"⭐".repeat(Math.min(12, Math.max(1, done.stars)))}</div>
            <Feeling childId={child.id} lang={lang} />
            <button className="btn huge" onClick={() => nav(home)}>🏠 {t("bye", lang)}</button>
          </div>
        )}
        {phase === "error" && (
          <div className="done">
            <p className="error">{problem}</p>
            <button className="btn" onClick={() => nav(home)}>{t("back", lang)}</button>
          </div>
        )}
        {problem && phase !== "error" && <p className="muted small">{problem}</p>}
      </div>
    </KidShell>
  );
}

/** "How did that feel?": the child's own rating, kept separate from the scores. "Hard" twice makes the next lesson gentler. */
function Feeling({ childId, lang }: { childId: string; lang: Child["language"] }) {
  const [sent, setSent] = useState<string | null>(null);
  const ask = L({ en: "How did that feel?", hi: "कैसा लगा?", hinglish: "Kaisa laga?" }, lang);
  const send = (f: "great" | "ok" | "hard") => { setSent(f); void api.feeling(childId, f, "music").catch(() => {}); };
  if (sent) return <p className="feeling-thanks">{sent === "hard" ? "💜" : "😊"} {L({ en: "Thank you for telling me!", hi: "बताने के लिए धन्यवाद!", hinglish: "Batane ke liye thank you!" }, lang)}</p>;
  return (
    <div className="feeling" role="group" aria-label={ask}>
      <p>{ask}</p>
      <button className="feeling-btn" onClick={() => send("great")} aria-label="great">😀</button>
      <button className="feeling-btn" onClick={() => send("ok")} aria-label="okay">🙂</button>
      <button className="feeling-btn" onClick={() => send("hard")} aria-label="hard">😕</button>
    </div>
  );
}
