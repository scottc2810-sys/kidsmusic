// Maths and Science for classes 1-5. Home: strands and topics (the child's class is highlighted, stars and
// level shown). A topic: concept cards with a diagram, one at a time with Next, then a round of 5 questions.
// Every answer gets its reason, and the child taps Next when ready. Difficulty adapts per topic on the server.
// The teacher (persona, voice, speed) is the one the parent chose for the subject.
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, type Child, type TopicProgress } from "../api";
import { primeSpeech, speak, stopSpeaking } from "../audio/speech";
import { playSfx, unlockAudio } from "../audio/synth";
import { Confetti, Melo, type MeloMood } from "../components/Melo";
import { L, t, type Text } from "../i18n";
import { MATHS_TOPICS, STRANDS, type Exercise, type Topic } from "../subjects/maths";
import { SCI_STRANDS, SCIENCE_TOPICS } from "../subjects/science";
import { VisualView } from "../subjects/Visuals";
import { useTeacher, type Subject as TeacherSubject } from "../teaching/persona";
import { KidShell, useChild } from "./KidHome";

type Subj = "maths" | "science";
const ROUND = 5;
const S = {
  maths: { en: "Maths", hi: "गणित", hinglish: "Maths" }, science: { en: "Science", hi: "विज्ञान", hinglish: "Science" },
  forClass: { en: "Class", hi: "कक्षा", hinglish: "Class" }, preschool: { en: "Pre-school", hi: "प्री-स्कूल", hinglish: "Pre-school" },
  learn: { en: "Learn it", hi: "सीखो", hinglish: "Seekho" }, practise: { en: "Practise", hi: "अभ्यास", hinglish: "Practice" },
  right: { en: "Right!", hi: "सही!", hinglish: "Sahi!" }, notQuite: { en: "Not quite.", hi: "पूरा सही नहीं।", hinglish: "Poora sahi nahi." },
  answerWas: { en: "The answer is", hi: "उत्तर है", hinglish: "Answer hai" }, showMe: { en: "Show me how", hi: "मुझे दिखाओ", hinglish: "Mujhe dikhao" },
  again: { en: "Play again", hi: "फिर से खेलो", hinglish: "Phir se khelo" }, topics: { en: "Other topics", hi: "दूसरे विषय", hinglish: "Doosre topics" },
  levelUp: { en: "Level up! The next questions will be a little harder.", hi: "लेवल बढ़ा! अगले सवाल थोड़े कठिन होंगे।", hinglish: "Level up! Agle sawaal thode tough honge." },
  levelDown: { en: "Let's make it a little easier and build it up again.", hi: "चलो थोड़ा आसान करके फिर से मज़बूत बनाते हैं।", hinglish: "Chalo thoda easy karke phir se mazboot banate hain." },
  score: { en: "right out of", hi: "सही, कुल", hinglish: "sahi, total" }, shapeLab: { en: "Shape Lab", hi: "आकृति प्रयोगशाला", hinglish: "Shape Lab" },
  shapeLabAbout: { en: "Join dots to make shapes, mix pieces, solve shape puzzles", hi: "बिंदु जोड़कर आकृतियाँ बनाओ, टुकड़े मिलाओ", hinglish: "Dots jod ke shapes banao, pieces mix karo" },
  forYou: { en: "for you", hi: "तुम्हारे लिए", hinglish: "tumhare liye" },
} satisfies Record<string, Text>;

const topicsOf = (s: Subj) => (s === "maths" ? MATHS_TOPICS : SCIENCE_TOPICS) as unknown as Topic[];
const strandsOf = (s: Subj) => (s === "maths" ? STRANDS : SCI_STRANDS) as { id: string; icon: string; title: Text }[];

function PersonaBadge({ name, emoji }: { name: string; emoji: string }) {
  return <span className="help-badge full" aria-label={`Teacher: ${name}`}>{emoji} {name}</span>;
}

export function SubjectHome({ subject }: { subject: Subj }) {
  const { id = "" } = useParams();
  const { child, error } = useChild(id);
  if (error) return <div className="center-screen"><p className="error">{error}</p></div>;
  if (!child) return <div className="center-screen"><div className="spinner" /></div>;
  return <Home child={child} subject={subject} />;
}

function Home({ child, subject }: { child: Child; subject: Subj }) {
  const nav = useNavigate();
  const lang = child.language;
  const teacher = useTeacher(child.id, subject as TeacherSubject);
  const [prog, setProg] = useState<Record<string, TopicProgress>>({});
  useEffect(() => { api.subjectProgress(child.id, subject).then((p) => setProg(p.topics)).catch(() => {}); }, [child.id, subject]);
  const grade = teacher.grade ?? Math.max(0, Math.min(5, child.age - 5));
  const said = useRef(false);
  useEffect(() => { if (teacher.prefs && !said.current) { said.current = true; void speak(teacher.hello(child.name, lang), lang); } }, [teacher.prefs]); // eslint-disable-line react-hooks/exhaustive-deps
  const open = async (path: string) => { primeSpeech(); await unlockAudio(); nav(path); };
  return (
    <KidShell child={child}>
      <div className="lesson subject-home">
        <div className="row center wrap"><h1>{subject === "maths" ? "🔢" : "🔬"} {L(S[subject], lang)}</h1><PersonaBadge name={teacher.persona.name} emoji={teacher.persona.emoji} />
          <span className="help-badge">{grade ? `${L(S.forClass, lang)} ${grade}` : L(S.preschool, lang)}</span></div>
        <Melo mood="happy" size={100} say={teacher.hello(child.name, lang)} />
        {subject === "maths" && (
          <button className="topic-card lab" onClick={() => void open(`/play/${child.id}/maths/shape-lab`)}>
            <span className="topic-icon">🧪</span><strong>{L(S.shapeLab, lang)}</strong><small>{L(S.shapeLabAbout, lang)}</small>
          </button>
        )}
        {strandsOf(subject).map((st) => (
          <section key={st.id} className="strand">
            <h2>{st.icon} {L(st.title, lang)}</h2>
            <div className="topic-grid">
              {topicsOf(subject).filter((tp) => tp.strand === st.id).map((tp) => {
                const p = prog[tp.id];
                const fits = grade >= tp.grades[0] && grade <= tp.grades[1];
                return (
                  <button key={tp.id} className={`topic-card${fits ? " fits" : ""}`} onClick={() => void open(`/play/${child.id}/${subject}/${tp.id}`)}>
                    <span className="topic-icon" aria-hidden>{tp.icon}</span>
                    <strong>{L(tp.title, lang)}</strong>
                    <small className="muted">{tp.grades[0] === 0 ? "KG" : `${L(S.forClass, lang)} ${tp.grades[0]}`}–{tp.grades[1]}{fits ? ` · ⭐ ${L(S.forYou, lang)}` : ""}</small>
                    {p && <small>⭐ {p.stars} · Lv {p.difficulty}</small>}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
        <button className="btn ghost" onClick={() => nav(`/play/${child.id}`)}>🏠 {t("back", lang)}</button>
      </div>
    </KidShell>
  );
}

export function SubjectTopic({ subject }: { subject: Subj }) {
  const { id = "", topic = "" } = useParams();
  const { child, error } = useChild(id);
  const tp = topicsOf(subject).find((x) => x.id === topic);
  if (error || !tp) return <div className="center-screen"><p className="error">{error ?? "Unknown topic"}</p></div>;
  if (!child) return <div className="center-screen"><div className="spinner" /></div>;
  return <TopicRunner key={tp.id} child={child} subject={subject} topic={tp} />;
}

/** A number pad for typed answers (older children): big keys, no keyboard needed. */
function NumPad({ onDone, disabled }: { onDone: (v: string) => void; disabled: boolean }) {
  const [v, setV] = useState("");
  return (
    <div className="numpad">
      <output className="numpad-out" aria-live="polite">{v || "?"}</output>
      <div className="numpad-keys">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "✓"].map((k) => (
          <button key={k} disabled={disabled || (k === "✓" && !v)} className={k === "✓" ? "ok" : ""}
            onClick={() => (k === "⌫" ? setV(v.slice(0, -1)) : k === "✓" ? onDone(v) : setV((v + k).slice(0, 6)))}>{k}</button>
        ))}
      </div>
    </div>
  );
}

function TopicRunner({ child, subject, topic }: { child: Child; subject: Subj; topic: Topic }) {
  const lang = child.language;
  const nav = useNavigate();
  const teacher = useTeacher(child.id, subject as TeacherSubject);
  const [phase, setPhase] = useState<"learn" | "practice" | "done">("learn");
  const [card, setCard] = useState(0);
  const [diff, setDiff] = useState(1);
  const [q, setQ] = useState<Exercise | null>(null);
  const [n, setN] = useState(0);
  const [right, setRight] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [mood, setMood] = useState<MeloMood>("happy");
  const [say, setSay] = useState("");
  const [party, setParty] = useState(0);
  const [result, setResult] = useState<{ earned: number; level_change: number } | null>(null);
  const alive = useRef(true);
  const grade = teacher.grade ?? Math.max(0, Math.min(5, child.age - 5));
  const typed = grade >= 3; // younger children pick; older ones type numbers

  useEffect(() => {
    alive.current = true;
    api.subjectProgress(child.id, subject).then((p) => {
      const known = p.topics[topic.id];
      // first time: start where the child's class sits in this topic's range
      setDiff(known ? known.difficulty : Math.max(1, Math.min(3, 1 + p.prefs.grade - topic.grades[0])));
      if (known && known.rounds > 0) setPhase("practice"); // seen before: straight to practice ("Show me how" is always there)
    }).catch(() => {});
    return () => { alive.current = false; stopSpeaking(); };
  }, [child.id, subject, topic]);

  const talk = useCallback(async (text: string, after: MeloMood = "listening") => {
    if (!alive.current) return;
    setSay(text); setMood("talking");
    await speak(text, lang);
    if (alive.current) setMood(after);
  }, [lang]);

  useEffect(() => { if (phase === "learn") void talk(L(topic.cards[card].say, lang)); }, [phase, card]); // eslint-disable-line react-hooks/exhaustive-deps

  const nextQuestion = useCallback(() => {
    const e = topic.make(diff, Math.random);
    setQ(e); setPicked(null);
    void talk(L(e.prompt, lang));
  }, [topic, diff, lang, talk]);
  useEffect(() => { if (phase === "practice" && !q) nextQuestion(); }, [phase, q, nextQuestion]);

  const answer = async (v: string) => {
    if (!q || picked != null) return;
    const ok = v.trim().toLowerCase() === q.answer.toLowerCase();
    setPicked(v);
    if (ok) { setRight((r) => r + 1); playSfx("sparkle"); setMood("cheer"); }
    else { playSfx("oops"); setMood("encourage"); }
    await talk(`${ok ? teacher.praise(lang) : `${teacher.encourage(lang)} ${L(S.answerWas, lang)} ${q.answer}.`} ${L(q.why, lang)}`, ok ? "happy" : "encourage");
  };
  const next = async () => {
    if (n + 1 < ROUND) { setN(n + 1); nextQuestion(); return; }
    const total = ROUND, correct = right;
    setPhase("done"); setQ(null);
    const r = await api.subjectRound(child.id, subject, topic.id, { correct, total, difficulty: diff }).catch(() => null);
    if (r) { setResult(r); setDiff(r.difficulty); }
    if (correct >= 4) setParty((p) => p + 1);
    await talk(`${correct} ${L(S.score, lang)} ${total}! ${r?.level_change ? L(r.level_change > 0 ? S.levelUp : S.levelDown, lang) : ""}`, "happy");
  };
  const restart = () => { setN(0); setRight(0); setResult(null); setQ(null); setPhase("practice"); };

  const c = topic.cards[card];
  return (
    <KidShell child={child}>
      <div className="lesson subject-topic">
        <Confetti burst={party} />
        <div className="row center wrap">
          <h1>{topic.icon} {L(topic.title, lang)}</h1>
          <PersonaBadge name={teacher.persona.name} emoji={teacher.persona.emoji} />
          {phase !== "learn" && <span className="help-badge">Lv {diff}</span>}
        </div>
        <Melo mood={mood} size={84} say={say} />
        {phase === "learn" && (
          <section className="concept card">
            <small className="muted">{L(S.learn, lang)} · {card + 1}/{topic.cards.length}</small>
            <h2>{L(c.title, lang)}</h2>
            {c.visual && <VisualView v={c.visual} />}
            <p>{L(c.say, lang)}</p>
            <div className="row center wrap">
              <button className="btn ghost" onClick={() => void talk(L(c.say, lang))}>🔊</button>
              {card > 0 && <button className="btn ghost" onClick={() => setCard(card - 1)}>⬅</button>}
              <button className="btn next-step" key={card} onClick={() => (card + 1 < topic.cards.length ? setCard(card + 1) : setPhase("practice"))}>
                {card + 1 < topic.cards.length ? `👉 ${t("next", lang)}` : `✏️ ${L(S.practise, lang)}`}
              </button>
            </div>
          </section>
        )}
        {phase === "practice" && q && (
          <section className="question card" aria-live="polite">
            <div className="step-dots">{Array.from({ length: ROUND }, (_, i) => <i key={i} className={i < n ? "done" : i === n ? "now" : ""} />)}</div>
            <p className="q-prompt">{L(q.prompt, lang)}</p>
            {q.visual && <VisualView v={q.visual} />}
            {typed && q.numeric
              ? <NumPad key={n} onDone={(v) => void answer(v)} disabled={picked != null} />
              : <div className={`choices n${q.choices.length}`}>
                {q.choices.map((ch) => (
                  <button key={ch} disabled={picked != null} onClick={() => void answer(ch)}
                    className={["choice-btn", picked === ch ? "chosen" : "", picked != null && ch === q.answer ? "correct" : ""].join(" ")}>
                    <span className="choice-text">{ch}</span>
                  </button>
                ))}
              </div>}
            {picked != null && (
              <div className="why-card" role="status">
                <span className="why-icon" aria-hidden>{picked.toLowerCase() === q.answer.toLowerCase() ? "✅" : "💡"}</span>
                <p>{picked.toLowerCase() === q.answer.toLowerCase() ? L(S.right, lang) : `${L(S.notQuite, lang)} ${L(S.answerWas, lang)} ${q.answer}.`} {L(q.why, lang)}</p>
              </div>
            )}
            <div className="row center wrap">
              {picked == null && <button className="btn ghost" onClick={() => { setCard(0); setPhase("learn"); }}>💡 {L(S.showMe, lang)}</button>}
              {picked != null && <button className="btn next-step" onClick={() => void next()}>👉 {t("next", lang)}</button>}
            </div>
          </section>
        )}
        {phase === "done" && (
          <section className="card concept">
            <span className="concept-icon">{right >= 4 ? "🏆" : right >= 2 ? "⭐" : "🌱"}</span>
            <h2>{right} / {ROUND}</h2>
            {result && <p>{"⭐".repeat(result.earned)}{result.level_change ? ` · ${L(result.level_change > 0 ? S.levelUp : S.levelDown, lang)}` : ""}</p>}
            <div className="row center wrap">
              <button className="btn big" onClick={restart}>🔁 {L(S.again, lang)}</button>
              <button className="btn big ghost" onClick={() => { setCard(0); setPhase("learn"); }}>💡 {L(S.learn, lang)}</button>
            </div>
          </section>
        )}
        <button className="btn ghost small" onClick={() => nav(`/play/${child.id}/${subject}`)}>⬅ {L(S.topics, lang)}</button>
      </div>
    </KidShell>
  );
}

