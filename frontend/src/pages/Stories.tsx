// Life-skills stories: pick a story, hear it one picture at a time (Next), choose what the hero should do
// (every choice explains what happens and why; a not-so-good choice just says "what might happen?" and the
// child tries again), see how it ends, the big idea and why, one quick check, and a mission for today.
// Soft story music plays underneath and gets quiet while Melo reads.
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, type Child } from "../api";
import { primeSpeech, speak, stopSpeaking } from "../audio/speech";
import { playSfx, unlockAudio } from "../audio/synth";
import { Melo, type MeloMood } from "../components/Melo";
import { L, type Text } from "../i18n";
import { STORIES, storyById, type Story, type StoryOption } from "../subjects/stories";
import { useTeacher } from "../teaching/persona";
import { KidShell, useChild } from "./KidHome";

const S = {
  stories: { en: "Stories", hi: "कहानियाँ", hinglish: "Kahaaniyaan" },
  pick: { en: "Pick a story! Each one is about something that happens to children like you.", hi: "एक कहानी चुनो! हर कहानी उन बातों की है जो तुम जैसे बच्चों के साथ होती हैं।", hinglish: "Ek kahaani chuno! Har kahaani un baaton ki hai jo tum jaise bachchon ke saath hoti hain." },
  next: { en: "Next", hi: "आगे", hinglish: "Aage" },
  back: { en: "Back", hi: "पीछे", hinglish: "Peeche" },
  again: { en: "Hear it again", hi: "फिर से सुनो", hinglish: "Phir se suno" },
  tryOther: { en: "Try another way", hi: "दूसरा तरीक़ा चुनो", hinglish: "Doosra tareeka chuno" },
  whatHappens: { en: "Hmm, what might happen?", hi: "हम्म, क्या हो सकता है?", hinglish: "Hmm, kya ho sakta hai?" },
  great: { en: "Great choice!", hi: "बहुत अच्छा चुना!", hinglish: "Bahut achha chuna!" },
  bigIdea: { en: "The big idea", hi: "बड़ी सीख", hinglish: "Badi seekh" },
  why: { en: "Why it matters", hi: "यह क्यों ज़रूरी है", hinglish: "Yeh kyon zaroori hai" },
  quick: { en: "Quick question", hi: "छोटा-सा सवाल", hinglish: "Chhota sa sawaal" },
  right: { en: "Yes! You understood the story.", hi: "हाँ! तुमने कहानी समझ ली।", hinglish: "Haan! Tumne kahaani samajh li." },
  notQuite: { en: "Not quite. Let's look again:", hi: "पूरा नहीं। फिर से देखो:", hinglish: "Poora nahi. Phir se dekho:" },
  mission: { en: "Try it today", hi: "आज करके देखो", hinglish: "Aaj karke dekho" },
  didIt: { en: "I did it!", hi: "मैंने कर लिया!", hinglish: "Maine kar liya!" },
  later: { en: "I'll do it later", hi: "बाद में करूँगा", hinglish: "Baad mein karunga" },
  proud: { en: "Wonderful! Your grown-up and Melo are proud of you.", hi: "शानदार! तुम्हारे बड़े और मेलो को तुम पर गर्व है।", hinglish: "Shaandaar! Tumhare bade aur Melo ko tum par garv hai." },
  moreStories: { en: "More stories", hi: "और कहानियाँ", hinglish: "Aur kahaaniyaan" },
  home: { en: "Home", hi: "घर", hinglish: "Ghar" },
  read: { en: "read", hi: "पढ़ी", hinglish: "padhi" },
  forAge: { en: "ages", hi: "उम्र", hinglish: "umar" },
} satisfies Record<string, Text>;

const topicId = (s: Story) => `story_${s.id}`;

export function StoryList() {
  const { id = "" } = useParams();
  const { child, error } = useChild(id);
  const [done, setDone] = useState<Set<string>>(new Set());
  const nav = useNavigate();
  useEffect(() => {
    api.subjectProgress(id, "vedas").then((p) => setDone(new Set(Object.keys(p.topics).filter((k) => k.startsWith("story_"))))).catch(() => {});
  }, [id]);
  useEffect(() => { if (child) void speak(L(S.pick, child.language), child.language); }, [child]);
  if (error) return <div className="center-screen"><p className="error">{error}</p></div>;
  if (!child) return <div className="center-screen"><div className="spinner" /></div>;
  const lang = child.language;
  // stories for the child's age first, unread before read
  const list = [...STORIES].sort((a, b) => {
    const fit = (s: Story) => (child.age >= s.ages[0] && child.age <= s.ages[1] ? 0 : 1);
    const read = (s: Story) => (done.has(topicId(s)) ? 1 : 0);
    return fit(a) - fit(b) || read(a) - read(b);
  });
  return (
    <KidShell child={child} music="story">
      <div className="lesson stories">
        <h1>📖 {L(S.stories, lang)}</h1>
        <Melo mood="happy" size={100} say={L(S.pick, lang)} />
        <div className="story-grid">
          {list.map((s) => (
            <button key={s.id} className={`story-card${done.has(topicId(s)) ? " read" : ""}`}
              onClick={async () => { primeSpeech(); await unlockAudio(); playSfx("pop"); nav(`/play/${id}/stories/${s.id}`); }}>
              <span className="story-cover" aria-hidden>{s.icon}</span>
              <strong>{L(s.title, lang)}</strong>
              <small>{L(s.skill, lang)}</small>
              <span className="muted small">{L(S.forAge, lang)} {s.ages[0]}–{s.ages[1]}{done.has(topicId(s)) ? ` · ✓ ${L(S.read, lang)}` : ""}</span>
            </button>
          ))}
        </div>
        <button className="btn ghost" onClick={() => nav(`/play/${id}`)}>🏠 {L(S.home, lang)}</button>
      </div>
    </KidShell>
  );
}

type Phase = { k: "page"; i: number } | { k: "ask" } | { k: "chose"; o: StoryOption } | { k: "after"; i: number }
  | { k: "idea" } | { k: "check" } | { k: "mission" };

/** The order of answers in the quick check, mixed per story so the right one is not always first. */
export function checkOrder(story: Story): Text[] {
  const all = [story.check.a, ...story.check.others];
  const shift = story.id.length % all.length;
  return [...all.slice(shift), ...all.slice(0, shift)];
}

export function StoryPage() {
  const { id = "", storyId = "" } = useParams();
  const { child, error } = useChild(id);
  const story = storyById(storyId);
  if (error) return <div className="center-screen"><p className="error">{error}</p></div>;
  if (!child) return <div className="center-screen"><div className="spinner" /></div>;
  if (!story) return <div className="center-screen"><p className="error">Story not found</p></div>;
  return <Reader child={child} story={story} />;
}

function Scene({ scene, mood }: { scene: string; mood?: "happy" | "sad" }) {
  // split into emoji clusters so each one can bob a little on its own
  const parts = useMemo(() => {
    const seg = typeof Intl !== "undefined" && "Segmenter" in Intl
      ? Array.from(new (Intl as any).Segmenter(undefined, { granularity: "grapheme" }).segment(scene), (x: any) => x.segment as string)
      : Array.from(scene);
    return seg.filter((g: string) => g.trim());
  }, [scene]);
  return (
    <div className={`story-scene ${mood ?? ""}`} aria-hidden>
      {parts.map((p, i) => <span key={`${p}${i}`} style={{ animationDelay: `${i * 0.18}s` }}>{p}</span>)}
    </div>
  );
}

function Reader({ child, story }: { child: Child; story: Story }) {
  const lang = child.language;
  const nav = useNavigate();
  useTeacher(child.id, "vedas");
  const [phase, setPhase] = useState<Phase>({ k: "page", i: 0 });
  const [tried, setTried] = useState<Set<number>>(new Set());
  const [firstGood, setFirstGood] = useState<boolean | null>(null);
  const [checked, setChecked] = useState<Text | null>(null);
  const [missionDone, setMissionDone] = useState(false);
  const saved = useRef(false);
  const name = (t: Text) => L(t, lang).replace(/\{name\}/g, child.name);
  const say = (t: string) => { stopSpeaking(); void speak(t, lang); };

  const hero = L(story.ask, lang);
  const text = (() => {
    switch (phase.k) {
      case "page": return L(story.pages[phase.i].text, lang);
      case "ask": return hero;
      case "chose": return `${L(phase.o.good ? S.great : S.whatHappens, lang)} ${L(phase.o.then, lang)}`;
      case "after": return L(story.after[phase.i].text, lang);
      case "idea": return `${L(story.bigIdea, lang)} ${L(story.why, lang)}`;
      case "check": return L(story.check.q, lang);
      case "mission": return name(story.tryToday);
    }
  })();
  // read every new step aloud (the child can tap 🔊 to hear it again)
  useEffect(() => { say(text); }, [text]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => stopSpeaking(), []);

  const record = (checkRight: boolean) => {
    if (saved.current) return;
    saved.current = true;
    const good = firstGood ? 1 : 0;
    void api.subjectRound(child.id, "vedas", topicId(story), {
      correct: good + (checkRight ? 1 : 0), total: 2, difficulty: 1, strand: "life",
      apply_correct: good, apply_total: 1, title: `Story: ${L(story.title, "en")} (${L(story.skill, "en")})`,
    }).catch(() => {});
  };

  const choose = (o: StoryOption, idx: number) => {
    if (firstGood === null) setFirstGood(o.good);
    playSfx(o.good ? "sparkle" : "pop");
    setTried((t) => new Set(t).add(idx));
    setPhase({ k: "chose", o });
  };

  const total = story.pages.length + 1 + story.after.length + 3;
  const at = phase.k === "page" ? phase.i : phase.k === "ask" || phase.k === "chose" ? story.pages.length
    : phase.k === "after" ? story.pages.length + 1 + phase.i : phase.k === "idea" ? total - 3 : phase.k === "check" ? total - 2 : total - 1;
  const melo: MeloMood = phase.k === "chose" ? (phase.o.good ? "cheer" : "encourage") : phase.k === "ask" ? "thinking" : phase.k === "mission" ? "happy" : "talking";

  const goNext = () => {
    playSfx("pop");
    if (phase.k === "page") setPhase(phase.i + 1 < story.pages.length ? { k: "page", i: phase.i + 1 } : { k: "ask" });
    else if (phase.k === "chose") setPhase(phase.o.good ? { k: "after", i: 0 } : { k: "ask" });
    else if (phase.k === "after") setPhase(phase.i + 1 < story.after.length ? { k: "after", i: phase.i + 1 } : { k: "idea" });
    else if (phase.k === "idea") setPhase({ k: "check" });
    else if (phase.k === "check") setPhase({ k: "mission" });
  };
  const goBack = () => {
    if (phase.k === "page" && phase.i > 0) setPhase({ k: "page", i: phase.i - 1 });
    else if (phase.k === "ask") setPhase({ k: "page", i: story.pages.length - 1 });
    else if (phase.k === "after" && phase.i > 0) setPhase({ k: "after", i: phase.i - 1 });
  };
  const canBack = (phase.k === "page" && phase.i > 0) || phase.k === "ask" || (phase.k === "after" && phase.i > 0);

  return (
    <KidShell child={child} music="story">
      <div className="lesson story-reader">
        <div className="row center wrap story-head">
          <span className="story-cover small" aria-hidden>{story.icon}</span>
          <h1>{L(story.title, lang)}</h1>
        </div>
        <div className="story-progress" aria-label={`${at + 1} / ${total}`}>
          {Array.from({ length: total }, (_, i) => <i key={i} className={i <= at ? "on" : ""} />)}
        </div>

        {(phase.k === "page" || phase.k === "after") && (
          <Scene scene={(phase.k === "page" ? story.pages[phase.i] : story.after[phase.i]).scene} />
        )}
        {(phase.k === "ask" || phase.k === "chose") && <Scene scene={story.pages[story.pages.length - 1].scene} />}
        {phase.k === "idea" && <Scene scene={`${story.icon}💡`} mood="happy" />}

        <div className="story-text card">
          <Melo mood={melo} size={70} />
          <p>{text}</p>
          <button className="btn ghost small" onClick={() => say(text)} aria-label={L(S.again, lang)}>🔊</button>
        </div>

        {phase.k === "ask" && (
          <div className="story-options">
            {story.options.map((o, i) => (
              <button key={i} className={`story-option${tried.has(i) && !o.good ? " tried" : ""}`} onClick={() => choose(o, i)}>
                {L(o.text, lang)}
              </button>
            ))}
          </div>
        )}

        {phase.k === "idea" && (
          <div className="story-idea card">
            <h2>💡 {L(S.bigIdea, lang)}</h2>
            <p className="big-idea">{L(story.bigIdea, lang)}</p>
            <h3>🤔 {L(S.why, lang)}</h3>
            <p>{L(story.why, lang)}</p>
          </div>
        )}

        {phase.k === "check" && (
          <div className="story-options">
            <h2>❓ {L(S.quick, lang)}</h2>
            {checkOrder(story).map((o, i) => {
              const right = o === story.check.a;
              const state = checked ? (right ? " right" : checked === o ? " wrong" : "") : "";
              return (
                <button key={i} className={`story-option${state}`} disabled={!!checked}
                  onClick={() => { setChecked(o); playSfx(right ? "sparkle" : "pop"); record(right);
                    say(right ? L(S.right, lang) : `${L(S.notQuite, lang)} ${L(story.check.a, lang)}. ${L(story.bigIdea, lang)}`); }}>
                  {L(o, lang)}
                </button>
              );
            })}
            {checked && <p className="story-feedback" role="status">{checked === story.check.a ? `🌟 ${L(S.right, lang)}` : `💛 ${L(S.notQuite, lang)} ${L(story.check.a, lang)}`}</p>}
          </div>
        )}

        {phase.k === "mission" && (
          <div className="story-idea card mission">
            <h2>🎯 {L(S.mission, lang)}</h2>
            <p className="big-idea">{name(story.tryToday)}</p>
            {missionDone ? <p className="story-feedback" role="status">✅ {L(S.proud, lang)}</p> : (
              <div className="row center wrap">
                <button className="btn primary" onClick={() => {
                  setMissionDone(true); playSfx("sparkle"); say(L(S.proud, lang));
                  void api.addNote(child.id, `Did the life-skills story mission (${L(story.skill, "en")}): ${L(story.tryToday, "en").replace(/\{name\}/g, child.name)}`).catch(() => {});
                }}>✅ {L(S.didIt, lang)}</button>
                <button className="btn ghost" onClick={() => nav(`/play/${child.id}/stories`)}>⏰ {L(S.later, lang)}</button>
              </div>
            )}
          </div>
        )}

        <div className="row center wrap story-nav">
          {canBack && <button className="btn ghost big" onClick={goBack}>◀ {L(S.back, lang)}</button>}
          {phase.k === "chose" && !phase.o.good && <button className="btn primary big" onClick={() => { playSfx("pop"); setPhase({ k: "ask" }); }}>🔁 {L(S.tryOther, lang)}</button>}
          {(phase.k === "page" || phase.k === "after" || phase.k === "idea" || (phase.k === "chose" && phase.o.good) || (phase.k === "check" && checked)) && (
            <button className="btn primary big" onClick={goNext}>{L(S.next, lang)} ▶</button>
          )}
          {phase.k === "mission" && <button className="btn ghost" onClick={() => nav(`/play/${child.id}/stories`)}>📖 {L(S.moreStories, lang)}</button>}
        </div>
      </div>
    </KidShell>
  );
}
