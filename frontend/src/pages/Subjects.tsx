// Maths and Science for classes 1-5. Home: strands and topics (the child's class is highlighted, stars and
// level shown). A topic: concept cards with a diagram, one at a time with Next, then a round of 5 questions.
// Every answer gets its reason, and the child taps Next when ready. Difficulty adapts per topic on the server.
// The teacher (persona, voice, speed) is the one the parent chose for the subject.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, type Child, type TopicProgress } from "../api";
import { primeSpeech, speak, stopSpeaking } from "../audio/speech";
import { playSfx, unlockAudio } from "../audio/synth";
import { Confetti, Melo, type MeloMood } from "../components/Melo";
import { L, t, type Text } from "../i18n";
import { ShlokaOfTheDay } from "../components/ShlokaCard";
import { STRANDS_OF, SUBJECT_INFO, TOPICS, type SubjectId } from "../subjects/index";
import { T as TX, type Exercise, type Topic } from "../subjects/maths";
import { missionFor } from "../subjects/missions";
import { AskedLog, drawFresh, drawRevision, nearLevels, qid, TaughtLog, teachFirst, type Teach } from "../subjects/teachfirst";
import { VisualView } from "../subjects/Visuals";
import { useTeacher, type Subject as TeacherSubject } from "../teaching/persona";
import { KidShell, useChild } from "./KidHome";

type Subj = SubjectId;
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
  realLife: { en: "Real life", hi: "असली जीवन", hinglish: "Real life" },
  realLifeTip: { en: "A real-life question: it checks that you can USE what you learned, not only remember it.", hi: "असली जीवन का सवाल: यह देखता है कि तुम सीखा हुआ इस्तेमाल कर पाते हो।", hinglish: "Real life ka sawaal: yeh dekhta hai ki tum seekha hua use kar paate ho." },
  growing: { en: "You've mastered every level! Melo is writing new, harder questions just for you.", hi: "तुमने हर लेवल पार कर लिया! मेलो तुम्हारे लिए नए, कठिन सवाल लिख रहा है।", hinglish: "Tumne har level paar kar liya! Melo tumhare liye naye, tough sawaal likh raha hai." },
  beyond: { en: "Beyond", hi: "आगे", hinglish: "Beyond" },
  stepByStep: { en: "Step by step", hi: "एक-एक क़दम", hinglish: "Step by step" }, nextStep: { en: "Next step", hi: "अगला क़दम", hinglish: "Agla step" },
  learnFirst: { en: "Learn this first", hi: "पहले यह सीखो", hinglish: "Pehle yeh seekho" },
  watchMe: { en: "Watch me solve one", hi: "देखो, मैं एक हल करता हूँ", hinglish: "Dekho, main ek solve karta hoon" },
  nowYou: { en: "Now you try!", hi: "अब तुम करो!", hinglish: "Ab tum karo!" },
  because: { en: "Why?", hi: "क्यों?", hinglish: "Kyun?" },
  revise: { en: "Revise", hi: "दोहराओ", hinglish: "Dohraao" },
  revision: { en: "Revision: questions you've met before, the tricky ones first.", hi: "दोहराना: पहले आए सवाल, कठिन वाले पहले।", hinglish: "Revision: pehle aaye sawaal, mushkil wale pehle." },
  nothingToRevise: { en: "Nothing to revise here yet: learn this topic first!", hi: "अभी दोहराने को कुछ नहीं: पहले यह विषय सीखो!", hinglish: "Abhi dohraane ko kuch nahi: pehle yeh topic seekho!" },
  newQuestions: { en: "New questions", hi: "नए सवाल", hinglish: "Naye sawaal" },
  allAsked: { en: "You've answered every question in this topic! Try another topic, or look at the cards again.", hi: "तुमने इस विषय का हर सवाल कर लिया! दूसरा विषय चुनो, या कार्ड फिर से देखो।", hinglish: "Tumne is topic ka har sawaal kar liya! Doosra topic chuno, ya cards phir se dekho." },
  mission: { en: "Your mission", hi: "तुम्हारा मिशन", hinglish: "Tumhara mission" },
  iDidIt: { en: "I did it!", hi: "मैंने कर लिया!", hinglish: "Maine kar liya!" },
  missionDone: { en: "Mission done: you used it in real life!", hi: "मिशन पूरा: तुमने इसे असली जीवन में किया!", hinglish: "Mission poora: tumne ise real life mein kiya!" },
} satisfies Record<string, Text>;

const topicsOf = (s: Subj) => TOPICS[s] as unknown as Topic[];
const strandsOf = (s: Subj) => STRANDS_OF[s];
/** A question the AI brain wrote for this child (challenge level 6+), in the shape of a normal exercise. */
interface ChallengeItem { prompt: string; choices: string[]; answer: string; why: string; steps?: string[]; apply?: boolean }
const fromChallenge = (c: ChallengeItem): Exercise => ({ prompt: TX(c.prompt), choices: c.choices, answer: c.answer, why: TX(c.why),
  steps: (c.steps ?? []).map((x) => TX(x)), apply: !!c.apply });

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
        <div className="row center wrap"><h1>{SUBJECT_INFO[subject].icon} {L(SUBJECT_INFO[subject].title, lang)}</h1><PersonaBadge name={teacher.persona.name} emoji={teacher.persona.emoji} />
          <span className="help-badge">{grade ? `${L(S.forClass, lang)} ${grade}` : L(S.preschool, lang)}</span></div>
        <Melo mood="happy" size={100} say={teacher.hello(child.name, lang)} />
        <ShlokaOfTheDay subject={subject} lang={lang} />
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
                  <div key={tp.id} className="topic-wrap">
                  <button className={`topic-card${fits ? " fits" : ""}`} onClick={() => void open(`/play/${child.id}/${subject}/${tp.id}`)}>
                    <span className="topic-icon" aria-hidden>{tp.icon}</span>
                    <strong>{L(tp.title, lang)}</strong>
                    <small className="muted">{tp.grades[0] === 0 ? "KG" : `${L(S.forClass, lang)} ${tp.grades[0]}`}–{tp.grades[1]}{fits ? ` · ⭐ ${L(S.forYou, lang)}` : ""}</small>
                    {p && <small>⭐ {p.stars} · Lv {p.difficulty}</small>}
                  </button>
                  {p && p.rounds > 0 && (
                    <button className="btn ghost small topic-revise" onClick={() => void open(`/play/${child.id}/${subject}/${tp.id}?revise=1`)}
                      aria-label={`${L(S.revise, lang)}: ${L(tp.title, lang)}`}>🔁 {L(S.revise, lang)}</button>
                  )}
                  </div>
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
  const [shown, setShown] = useState(0); // steps of the worked solution revealed so far
  const [applied, setApplied] = useState({ right: 0, total: 0 }); // real-life questions in this round
  const [pool, setPool] = useState<{ level: number; items: ChallengeItem[] } | null>(null); // AI challenge level beyond 5
  const asked = useRef<string[]>([]);
  // teach before asking: a new fact is shown first, a new level starts with a worked example
  const [teach, setTeach] = useState<Teach | null>(null);
  const taughtLog = useMemo(() => new TaughtLog(child.id, subject, topic.id), [child.id, subject, topic.id]);
  // never the same question twice: what this child has been shown in this topic, and in this round
  const askedLog = useMemo(() => new AskedLog(child.id, subject, topic.id), [child.id, subject, topic.id]);
  const roundSeen = useRef<Set<string>>(new Set());
  const [roundTotal, setRoundTotal] = useState(ROUND);
  const [usedUp, setUsedUp] = useState(false); // every question of this topic has been asked
  // revision: questions already met (slips first), chosen on purpose; never moves the level
  const [params] = useSearchParams();
  const [revise, setRevise] = useState(params.get("revise") === "1");
  const [noRevision, setNoRevision] = useState(false);
  const justTaught = useRef(false); // the question on screen was taught a moment ago
  const mission = missionFor(topic.id, child.name); // one small real-life task, in the child's name
  const [missionDone, setMissionDone] = useState(false);
  const taughtN = useRef(0); // such answers in this round (they show learning; the next round checks memory)
  const [mood, setMood] = useState<MeloMood>("happy");
  const [say, setSay] = useState("");
  const [party, setParty] = useState(0);
  const [result, setResult] = useState<{ earned: number; level_change: number; challenge_started?: boolean } | null>(null);
  const alive = useRef(true);
  const grade = teacher.grade ?? Math.max(0, Math.min(5, child.age - 5));
  const typed = grade >= 3; // younger children pick; older ones type numbers

  useEffect(() => {
    alive.current = true;
    api.subjectProgress(child.id, subject).then((p) => {
      const known = p.topics[topic.id];
      // first time: start where the child's class sits in this topic's range
      setDiff(known ? known.difficulty : Math.max(1, Math.min(3, 1 + p.prefs.grade - topic.grades[0])));
      if (known && known.difficulty >= 5) loadChallenges();
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

  /** The newest AI-written level for this topic, if the child has mastered the built-in ones. */
  const loadChallenges = () => {
    api.subjectChallenges(child.id, subject, topic.id).then((c) => {
      const last = c.levels[c.levels.length - 1];
      if (last && last.items.length) setPool({ level: last.level, items: last.items as ChallengeItem[] });
    }).catch(() => {});
  };
  const level = pool ? pool.level : diff;
  /** The next question this child has never seen (false = the topic is used up). */
  const nextQuestion = useCallback((): boolean => {
    const make = (d: number, rng: () => number) => pool ? fromChallenge(pool.items[Math.floor(rng() * pool.items.length)]) : topic.make(d, rng);
    const levels = pool ? [pool.level] : nearLevels(diff);
    if (revise) {
      const r = drawRevision(make, askedLog, Math.random, roundSeen.current);
      if (!r) return false;
      roundSeen.current.add(qid(r));
      asked.current = [...asked.current, r.prompt.en].slice(-3);
      setQ(r); setPicked(null); setShown(0); setTeach(null); justTaught.current = false;
      void talk(L(r.prompt, lang));
      return true;
    }
    const e = drawFresh(make, levels, askedLog, Math.random, roundSeen.current);
    if (!e) return false;
    const shown = (x: Exercise) => { askedLog.add(x); roundSeen.current.add(qid(x)); };
    shown(e);
    asked.current = [...asked.current, e.prompt.en].slice(-3);
    setQ(e); setPicked(null); setShown(0); justTaught.current = false;
    const lesson = teachFirst(e, level, taughtLog, (rng) => drawFresh(make, levels, askedLog, rng, new Set([...roundSeen.current])) ?? e);
    if (lesson?.kind === "example" && lesson.e !== e) shown(lesson.e); // a worked example is never asked later
    setTeach(lesson);
    if (!lesson) { void talk(L(e.prompt, lang)); return true; }
    const x = lesson.e;
    void talk(lesson.kind === "fact"
      ? `${L(S.learnFirst, lang)}. ${L(x.prompt, lang)} ${L(S.answerWas, lang)} ${x.answer}. ${L(x.why, lang)}`
      : `${L(S.watchMe, lang)}. ${L(x.prompt, lang)}`);
    return true;
  }, [topic, diff, lang, talk, pool, level, taughtLog, askedLog, revise]);
  /** Done learning: remember it was taught, then ask the question. */
  const askNow = () => {
    if (!teach || !q) return;
    if (teach.kind === "fact") { taughtLog.learnFact(q); justTaught.current = true; } else taughtLog.learnLevel(level);
    setTeach(null); setShown(0);
    void talk(`${L(S.nowYou, lang)} ${L(q.prompt, lang)}`);
  };
  useEffect(() => {
    if (phase !== "practice" || q || n !== 0) return;
    if (revise) {
      if (!nextQuestion()) { setRevise(false); setNoRevision(true); void talk(L(S.nothingToRevise, lang)); }
      return;
    }
    if (!usedUp && !nextQuestion()) { setUsedUp(true); void talk(L(S.allAsked, lang), "happy"); }
  }, [phase, q, nextQuestion]); // eslint-disable-line react-hooks/exhaustive-deps

  const answer = async (v: string) => {
    if (!q || picked != null) return;
    const ok = v.trim().toLowerCase() === q.answer.toLowerCase();
    setPicked(v);
    if (justTaught.current) taughtN.current += 1;
    if (!ok) askedLog.setMissed(q, true); // revised first next time
    else if (revise) askedLog.setMissed(q, false); // remembered now
    if (q.apply) setApplied((a) => ({ right: a.right + (ok ? 1 : 0), total: a.total + 1 }));
    if (ok) { setRight((r) => r + 1); playSfx("sparkle"); setMood("cheer"); }
    else { playSfx("oops"); setMood("encourage"); }
    await talk(`${ok ? teacher.praise(lang) : `${teacher.encourage(lang)} ${L(S.answerWas, lang)} ${q.answer}.`} ${L(q.why, lang)}`, ok ? "happy" : "encourage");
    if (!ok && q.steps?.length && alive.current) showStep(1, q); // after a slip, walk through it together
  };
  /** Reveal the worked solution up to step k and say that step. */
  const showStep = (k: number, e: Exercise | null = q) => {
    if (!e?.steps) return;
    setShown(k);
    void talk(L(e.steps[k - 1], lang));
  };
  const next = async () => {
    if (n + 1 < ROUND && nextQuestion()) { setN(n + 1); return; }
    const total = n + 1, correct = right; // shorter when the topic ran out of new questions
    const ranOut = total < ROUND && !revise;
    if (ranOut) setUsedUp(true);
    setRoundTotal(total);
    setPhase("done"); setQ(null);
    const r = await api.subjectRound(child.id, subject, topic.id, { correct, total, difficulty: level, strand: topic.strand,
      apply_correct: applied.right, apply_total: applied.total, title: L(topic.title, "en"), examples: asked.current, taught: taughtN.current, revision: revise }).catch(() => null);
    if (r) { setResult(r); setDiff(r.difficulty); if (r.difficulty >= 5) loadChallenges(); }
    if (correct >= Math.ceil(total * 0.8)) setParty((p) => p + 1);
    await talk(`${correct} ${L(S.score, lang)} ${total}! ${ranOut ? L(S.allAsked, lang) : ""} ${r?.challenge_started ? L(S.growing, lang) : r?.level_change ? L(r.level_change > 0 ? S.levelUp : S.levelDown, lang) : ""}${mission ? ` ${L(S.mission, lang)}: ${mission}` : ""}`, "happy");
  };
  /** Switch between a revision round and new questions, starting a fresh round. */
  const startMode = (rev: boolean) => { setNoRevision(false); setRevise(rev); restart(); };
  const restart = () => { roundSeen.current = new Set(); taughtN.current = 0; setN(0); setRight(0); setApplied({ right: 0, total: 0 }); setResult(null); setQ(null); setPhase("practice"); };

  const c = topic.cards[card];
  return (
    <KidShell child={child}>
      <div className="lesson subject-topic">
        <Confetti burst={party} />
        <div className="row center wrap">
          <h1>{topic.icon} {L(topic.title, lang)}</h1>
          <PersonaBadge name={teacher.persona.name} emoji={teacher.persona.emoji} />
          {phase !== "learn" && <span className="help-badge" title={pool ? "Questions Melo's AI teacher wrote for you after you mastered all 5 levels" : "Difficulty level of this topic (1-5), it moves with your results"}>
            {pool ? `⭐ ${L(S.beyond, lang)} · Lv ${level}` : `Lv ${diff}`}</span>}
          {revise && phase !== "learn" && <span className="help-badge" title={L(S.revision, lang)}>🔁 {L(S.revise, lang)}</span>}
        </div>
        <Melo mood={mood} size={84} say={say} />
        {phase === "learn" && (
          <section className="concept card">
            <small className="muted">{L(S.learn, lang)} · {card + 1}/{topic.cards.length}</small>
            <h2>{L(c.title, lang)}</h2>
            {c.visual && <VisualView v={c.visual} lang={lang} />}
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
        {phase === "practice" && q && teach && (() => {
          const x = teach.e;
          const steps = teach.kind === "example" ? x.steps ?? [] : [];
          const more = shown < steps.length;
          return (
            <section className="concept card teach-first" aria-live="polite">
              <small className="muted">{teach.kind === "fact" ? `💡 ${L(S.learnFirst, lang)}` : `👀 ${L(S.watchMe, lang)}`}</small>
              <p className="q-prompt">{L(x.prompt, lang)}</p>
              {x.visual && <VisualView v={x.visual} lang={lang} />}
              {steps.length > 0 && shown > 0 && (
                <ol className="worked" aria-label={L(S.stepByStep, lang)}>
                  {steps.slice(0, shown).map((st, i) => <li key={i} className={i === shown - 1 ? "now" : ""}>{L(st, lang)}</li>)}
                </ol>
              )}
              {!more && (
                <div className="why-card" role="status">
                  <span className="why-icon" aria-hidden>✅</span>
                  <p><b>{L(S.answerWas, lang)} {x.answer}.</b> {L(x.why, lang)}</p>
                </div>
              )}
              <div className="row center wrap">
                <button className="btn ghost" onClick={() => void talk(more ? L(x.prompt, lang) : `${L(S.answerWas, lang)} ${x.answer}. ${L(x.why, lang)}`)}>🔊</button>
                {more
                  ? <button className="btn next-step" key={`s${shown}`} onClick={() => showStep(shown + 1, x)}>👣 {L(S.nextStep, lang)} ({shown + 1}/{steps.length})</button>
                  : <button className="btn next-step" onClick={askNow}>✏️ {L(S.nowYou, lang)}</button>}
              </div>
            </section>
          );
        })()}
        {phase === "practice" && revise && n === 0 && q && !picked && (
          <p className="muted center">🔁 {L(S.revision, lang)}</p>
        )}
        {phase === "practice" && !q && noRevision && !usedUp && (
          <section className="card concept" role="status">
            <span className="concept-icon">🌱</span>
            <p>{L(S.nothingToRevise, lang)}</p>
            <div className="row center wrap">
              <button className="btn big" onClick={() => startMode(false)}>✏️ {L(S.practise, lang)}</button>
              <button className="btn big ghost" onClick={() => { setCard(0); setPhase("learn"); }}>💡 {L(S.learn, lang)}</button>
            </div>
          </section>
        )}
        {phase === "practice" && !q && usedUp && (
          <section className="card concept" role="status">
            <span className="concept-icon">🌟</span>
            <p>{L(S.allAsked, lang)}</p>
            <div className="row center wrap">
              {askedLog.deck.length > 0 && <button className="btn big" onClick={() => startMode(true)}>🔁 {L(S.revise, lang)}</button>}
              <button className="btn big ghost" onClick={() => { setCard(0); setPhase("learn"); }}>💡 {L(S.learn, lang)}</button>
            </div>
          </section>
        )}
        {phase === "practice" && q && !teach && (
          <section className="question card" aria-live="polite">
            <div className="step-dots">{Array.from({ length: ROUND }, (_, i) => <i key={i} className={i < n ? "done" : i === n ? "now" : ""} />)}</div>
            {q.apply && <span className="tip-badge real" tabIndex={0} title={L(S.realLifeTip, lang)} data-tip={L(S.realLifeTip, lang)}>🌍 {L(S.realLife, lang)}</span>}
            <p className="q-prompt">{L(q.prompt, lang)}</p>
            {q.visual && <VisualView v={q.visual} lang={lang} />}
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
            {picked != null && shown > 0 && q.steps && (
              <ol className="worked" aria-label={L(S.stepByStep, lang)}>
                {q.steps.slice(0, shown).map((st, i) => <li key={i} className={i === shown - 1 ? "now" : ""}>{L(st, lang)}</li>)}
              </ol>
            )}
            {picked != null && (
              <div className="why-card" role="status">
                <span className="why-icon" aria-hidden>{picked.toLowerCase() === q.answer.toLowerCase() ? "✅" : "💡"}</span>
                <p>{picked.toLowerCase() === q.answer.toLowerCase() ? L(S.right, lang) : `${L(S.notQuite, lang)} ${L(S.answerWas, lang)} ${q.answer}.`} {L(q.why, lang)}</p>
              </div>
            )}
            <div className="row center wrap">
              {picked == null && <button className="btn ghost" onClick={() => { setCard(0); setPhase("learn"); }}>💡 {L(S.showMe, lang)}</button>}
              {picked != null && q.steps && shown === 0 && <button className="btn ghost" onClick={() => showStep(1)}>👣 {L(S.stepByStep, lang)}</button>}
              {picked != null && q.steps && shown > 0 && shown < q.steps.length && <button className="btn" onClick={() => showStep(shown + 1)}>👣 {L(S.nextStep, lang)} ({shown + 1}/{q.steps.length})</button>}
              {picked != null && <button className="btn next-step" onClick={() => void next()}>👉 {t("next", lang)}</button>}
            </div>
          </section>
        )}
        {phase === "done" && (
          <section className="card concept">
            <span className="concept-icon">{right >= Math.ceil(roundTotal * 0.8) ? "🏆" : right * 2 >= roundTotal ? "⭐" : "🌱"}</span>
            <h2>{right} / {roundTotal}</h2>
            {usedUp && <p>🌟 {L(S.allAsked, lang)}</p>}
            {result && <p>{"⭐".repeat(result.earned)}{result.level_change ? ` · ${L(result.level_change > 0 ? S.levelUp : S.levelDown, lang)}` : ""}</p>}
            {applied.total > 0 && <p className="tip-badge real" title={L(S.realLifeTip, lang)}>🌍 {L(S.realLife, lang)}: {applied.right}/{applied.total}</p>}
            {result?.challenge_started && <p>✨ {L(S.growing, lang)}</p>}
            {mission && (
              <div className="why-card mission" role="status">
                <span className="why-icon" aria-hidden>🎯</span>
                <p><b>{L(S.mission, lang)}:</b> {mission}</p>
                {missionDone
                  ? <span className="tip-badge real">✅ {L(S.missionDone, lang)}</span>
                  : <button className="btn small" onClick={() => {
                    setMissionDone(true); playSfx("sparkle");
                    void api.addNote(child.id, `Did the real-life mission for ${subject} · ${L(topic.title, "en")}: ${mission}`).catch(() => {});
                    void talk(`${teacher.praise(lang)} ${L(S.missionDone, lang)}`, "cheer");
                  }}>🙌 {L(S.iDidIt, lang)}</button>}
              </div>
            )}
            <div className="row center wrap">
              {revise
                ? <button className="btn big" onClick={restart}>🔁 {L(S.revise, lang)}</button>
                : !usedUp && <button className="btn big" onClick={restart}>▶️ {L(S.again, lang)}</button>}
              {revise && !usedUp && <button className="btn big ghost" onClick={() => startMode(false)}>✏️ {L(S.newQuestions, lang)}</button>}
              {!revise && askedLog.deck.length > 0 && <button className="btn big ghost" onClick={() => startMode(true)}>🔁 {L(S.revise, lang)}</button>}
              <button className="btn big ghost" onClick={() => { restart(); setCard(0); setPhase("learn"); }}>💡 {L(S.learn, lang)}</button>
            </div>
          </section>
        )}
        <button className="btn ghost small" onClick={() => nav(`/play/${child.id}/${subject}`)}>⬅ {L(S.topics, lang)}</button>
      </div>
    </KidShell>
  );
}

