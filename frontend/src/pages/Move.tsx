// Move & stretch 🤸: exercises and yoga asanas with real videos and photos, steps read aloud one at a time,
// then "let's do it": a drum beat to count jumps with (and FREEZE calls in the dance), or a soft chime and
// "breathe in / out" to hold a pose. Stars and confetti at the end, and the learning graph hears about it.
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, type Child } from "../api";
import { primeSpeech, speak, stopSpeaking } from "../audio/speech";
import { playNote, playSfx, sleep, unlockAudio } from "../audio/synth";
import { Confetti, Melo } from "../components/Melo";
import { L, type Text } from "../i18n";
import { MOVES, type Move } from "../subjects/move";
import { MOVE_MEDIA } from "../subjects/moveMedia";
import { KidShell, useChild } from "./KidHome";

const T = (en: string, hi: string, hinglish: string): Text => ({ en, hi, hinglish });
const S = {
  title: T("Move & stretch", "चलो-फिरो और खिंचो", "Chalo-phiro aur khincho"),
  pick: T("Let's move! Pick an exercise or a yoga pose.", "चलो हिलें-डुलें! कोई कसरत या योग आसन चुनो।", "Chalo hilein-dulein! Koi kasrat ya yog aasan chuno."),
  exercises: T("Exercises", "कसरत", "Kasrat"), yoga: T("Yoga asanas", "योग आसन", "Yog aasan"),
  steps: T("How to do it", "कैसे करें", "Kaise karein"), next: T("Next", "आगे", "Aage"), go: T("Let's do it!", "चलो करें!", "Chalo karein!"),
  watch: T("Watch first", "पहले देखो", "Pehle dekho"), pose: T("This is the pose", "यह आसन ऐसा दिखता है", "Yeh aasan aisa dikhta hai"),
  guideSound: T("Hear the guide", "गाइड सुनो", "Guide suno"),
  breatheIn: T("Breathe in...", "साँस अंदर...", "Saans andar..."), breatheOut: T("...and out", "...और बाहर", "...aur bahar"),
  freeze: T("FREEZE!", "रुक जाओ!", "Ruk jaao!"), dance: T("Dance!", "नाचो!", "Naacho!"),
  done: T("You did it!", "तुमने कर लिया!", "Tumne kar liya!"), why: T("Why it's good for you", "यह क्यों अच्छा है", "Yeh kyon achha hai"),
  careful: T("Be careful", "ध्यान रखो", "Dhyaan rakho"), another: T("Next activity", "अगली गतिविधि", "Agli gatividhi"),
  all: T("All activities", "सारी गतिविधियाँ", "Saari gatividhiyaan"), home: T("Home", "घर", "Ghar"),
  parents: T("For grown-ups: stay close, use a soft mat, and stop if anything hurts. Children copy best when you do it with them!",
    "बड़ों के लिए: पास रहें, नरम चटाई इस्तेमाल करें, और कुछ दुखे तो रुक जाएँ। आप साथ करेंगे तो बच्चे सबसे अच्छा सीखते हैं!",
    "Badon ke liye: paas rahein, naram chataai use karein, aur kuch dukhe toh ruk jaayein. Aap saath karenge toh bachche sabse achha seekhte hain!"),
};
const doneKey = (child: string) => `melo.move.done.${child}`;
const loadDone = (child: string): Set<string> => { try { return new Set(JSON.parse(localStorage.getItem(doneKey(child)) || "[]")); } catch { return new Set(); } };
const NUMBERS = ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

export function MoveHome() {
  const { id = "" } = useParams();
  const { child, error } = useChild(id);
  const nav = useNavigate();
  useEffect(() => { if (child) void speak(L(S.pick, child.language), child.language); }, [child]);
  if (error) return <div className="center-screen"><p className="error">{error}</p></div>;
  if (!child) return <div className="center-screen"><div className="spinner" /></div>;
  const lang = child.language;
  const done = loadDone(child.id);
  const card = (m: Move) => (
    <button key={m.id} className={`move-card kind-${m.kind}${done.has(m.id) ? " done" : ""}`}
      onClick={async () => { primeSpeech(); await unlockAudio(); playSfx("pop"); nav(`/play/${id}/move/${m.id}`); }}>
      {m.photo && MOVE_MEDIA[m.photo] ? <img src={MOVE_MEDIA[m.photo].src} alt="" loading="lazy" /> : <span className="move-icon" aria-hidden>{m.icon}</span>}
      <strong>{m.icon} {L(m.name, lang)}</strong>
      {m.sanskrit && <small className="muted">{m.sanskrit}</small>}
      {done.has(m.id) && <span className="move-tick" aria-label="done">✅</span>}
    </button>
  );
  return (
    <KidShell child={child} music="play">
      <div className="lesson move-home">
        <h1>🤸 {L(S.title, lang)}</h1>
        <Melo mood="happy" size={90} say={L(S.pick, lang)} />
        <h2>🏃 {L(S.exercises, lang)}</h2>
        <div className="move-grid">{MOVES.filter((m) => m.kind === "exercise").map(card)}</div>
        <h2>🧘 {L(S.yoga, lang)}</h2>
        <div className="move-grid">{MOVES.filter((m) => m.kind === "yoga").map(card)}</div>
        <p className="muted small listen-note">{L(S.parents, lang)}</p>
        <button className="btn ghost" onClick={() => nav(`/play/${id}`)}>🏠 {L(S.home, lang)}</button>
      </div>
    </KidShell>
  );
}

export function MovePage() {
  const { id = "", moveId = "" } = useParams();
  const { child, error } = useChild(id);
  const move = MOVES.find((m) => m.id === moveId);
  if (error) return <div className="center-screen"><p className="error">{error}</p></div>;
  if (!child || !move) return <div className="center-screen"><div className="spinner" /></div>;
  return <Session key={move.id} child={child} move={move} />;
}

function Media({ k, sound }: { k?: string; sound?: boolean }) {
  const m = k ? MOVE_MEDIA[k] : undefined;
  if (!m) return null;
  return (
    <figure className="move-media">
      {m.kind === "video"
        ? <video src={m.src} autoPlay loop playsInline muted={!sound} preload="auto" aria-label={m.title} />
        : <img src={m.src} alt={m.title} />}
      <figcaption className="listen-video-credit">{m.kind === "video" ? "🎬" : "📷"} {m.title} · {m.author} · {m.licence} ·{" "}
        <a href={m.page} target="_blank" rel="noreferrer">Wikimedia Commons</a></figcaption>
    </figure>
  );
}

type Phase = { k: "steps"; i: number } | { k: "doing" } | { k: "done" };

function Session({ child, move }: { child: Child; move: Move }) {
  const lang = child.language;
  const nav = useNavigate();
  const [phase, setPhase] = useState<Phase>({ k: "steps", i: 0 });
  const [guideSound, setGuideSound] = useState(false);
  const [count, setCount] = useState(0);
  const [cue, setCue] = useState<string>("");
  const [party, setParty] = useState(0);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; stopSpeaking(); }, []);
  useEffect(() => {
    if (phase.k === "steps") { stopSpeaking(); void speak(L(move.steps[phase.i], lang), lang); }
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async () => {
    setPhase({ k: "doing" }); stopSpeaking(); setGuideSound(false);
    await unlockAudio();
    const a = move.action;
    if (a.type === "count") {
      const beat = 60000 / a.bpm;
      const freezeDance = move.id === "freeze_dance";
      await speak(L(freezeDance ? S.dance : S.go, lang), lang);
      for (let n = 1; n <= a.n && alive.current; n++) {
        if (freezeDance && n % 8 === 0) { // stop the music: FREEZE like a statue for three beats
          setCue(L(S.freeze, lang)); playSfx("pop"); void speak(L(S.freeze, lang), lang);
          await sleep(beat * 3); setCue(L(S.dance, lang));
        }
        setCount(n);
        playNote(n % 4 === 1 ? 48 : 55, { timbre: "drum", duration: 0.2, gain: 0.9 });
        if (a.bpm <= 70 && n <= 10) void speak(lang === "hi" ? String(n) : NUMBERS[n - 1] ?? String(n), "en");
        await sleep(beat);
      }
    } else {
      playNote(84, { timbre: "bell", duration: 1.5 });
      for (let b = 1; b <= a.breaths && alive.current; b++) {
        setCount(b);
        setCue(L(S.breatheIn, lang)); playNote(72, { timbre: "bell", duration: 0.8, gain: 0.3 });
        await sleep(3000);
        if (!alive.current) return;
        setCue(L(S.breatheOut, lang)); playNote(67, { timbre: "bell", duration: 0.8, gain: 0.3 });
        await sleep(4000);
      }
      playNote(84, { timbre: "bell", duration: 1.5 });
    }
    if (!alive.current) return;
    setPhase({ k: "done" }); setParty((p) => p + 1); playSfx("tada");
    void speak(`${L(S.done, lang)} ${L(move.why, lang)}`, lang);
    const d = loadDone(child.id); d.add(move.id);
    try { localStorage.setItem(doneKey(child.id), JSON.stringify([...d])); } catch { /* private */ }
    void api.addNote(child.id, `Move & stretch · ${L(move.name, "en")}${move.sanskrit ? ` (${move.sanskrit.split("·")[1]?.trim()})` : ""}: done (${a.type === "count" ? `${a.n} times` : `${a.breaths} breaths`})`).catch(() => {});
  };

  const idx = MOVES.findIndex((m) => m.id === move.id);
  const nextMove = MOVES[(idx + 1) % MOVES.length];
  const breathing = move.action.type === "hold";
  return (
    <KidShell child={child}>
      <div className="lesson move-session">
        <Confetti burst={party} />
        <div className="row center wrap"><span className="listen-icon" aria-hidden>{move.icon}</span><h1>{L(move.name, lang)}</h1></div>
        {move.sanskrit && <p className="muted">{move.sanskrit}</p>}

        {phase.k === "steps" && (
          <>
            <Media k={move.video} sound={move.guideVideo && guideSound} />
            {move.guideVideo && <button className={`chip${guideSound ? " on" : ""}`} onClick={() => setGuideSound(!guideSound)}>🔊 {L(S.guideSound, lang)}</button>}
            {move.video && move.photo && <h3>📷 {L(S.pose, lang)}</h3>}
            {move.photo && <Media k={move.photo} />}
            <div className="card move-step">
              <div className="story-progress">{move.steps.map((_, x) => <i key={x} className={x <= phase.i ? "on" : ""} />)}</div>
              <p className="listen-how">{phase.i + 1}. {L(move.steps[phase.i], lang)}</p>
              <div className="row center wrap">
                <button className="btn ghost" onClick={() => void speak(L(move.steps[phase.i], lang), lang)}>🔊</button>
                {phase.i + 1 < move.steps.length
                  ? <button className="btn primary big" onClick={() => { playSfx("pop"); setPhase({ k: "steps", i: phase.i + 1 }); }}>{L(S.next, lang)} ▶</button>
                  : <button className="btn primary big" onClick={() => void run()}>🚀 {L(S.go, lang)}</button>}
              </div>
            </div>
            {move.careful && <p className="card notice small">⚠️ {L(S.careful, lang)}: {L(move.careful, lang)}</p>}
          </>
        )}

        {phase.k === "doing" && (
          <div className="move-doing" aria-live="polite">
            {move.video && <Media k={move.video} />}
            {breathing ? (
              <>
                <div className="breath-circle" />
                <p className="breath-words">{cue}</p>
                <p className="move-count">{count} / {move.action.type === "hold" ? move.action.breaths : 0}</p>
              </>
            ) : (
              <>
                {cue && <p className="move-cue">{cue}</p>}
                <p className="move-count big">{count}<small> / {move.action.type === "count" ? move.action.n : 0}</small></p>
                <p className="muted">🥁</p>
              </>
            )}
          </div>
        )}

        {phase.k === "done" && (
          <div className="card abc-summary" role="status">
            <Melo mood="cheer" size={90} />
            <h2>🎉 {L(S.done, lang)}</h2>
            <p className="rain-stars" style={{ fontSize: "2.4rem" }}>⭐⭐⭐</p>
            <h3>💡 {L(S.why, lang)}</h3>
            <p>{L(move.why, lang)}</p>
            <div className="row center wrap">
              <button className="btn primary big" onClick={() => nav(`/play/${child.id}/move/${nextMove.id}`)}>{nextMove.icon} {L(S.another, lang)}</button>
              <button className="btn ghost" onClick={() => nav(`/play/${child.id}/move`)}>🤸 {L(S.all, lang)}</button>
            </div>
          </div>
        )}
      </div>
    </KidShell>
  );
}
