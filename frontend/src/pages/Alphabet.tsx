// Alphabets 🔤: every letter of every language Melo teaches, with four ways to learn it, the same as words:
// 📖 read (see the letter, find its sound), 👂 listen (hear it, find the letter), ✍️ write (trace it), 🗣️ speak (say it).
// Melo teaches a letter before asking it (picture word, sound, how it's said), one small set of 5 at a time.
// The comparison view puts the letters of different languages side by side, lined up by their sound:
// क ક ক க క ಕ ਕ К K ك ㄱ か are all "k".
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, type AbcCell, type AbcLetter, type AbcSkill, type AlphabetCompare, type AlphabetData, type Child, type LearnStatus } from "../api";
import { listenIn, primeSpeech, sayIn, speak, speechRecognitionAvailable, stopSpeaking } from "../audio/speech";
import { playNative } from "../audio/native";
import { playSfx, unlockAudio } from "../audio/synth";
import { Confetti, Melo, type MeloMood } from "../components/Melo";
import { L, type Text } from "../i18n";
import { KidShell, useChild } from "./KidHome";
import { TracePad } from "./Learn";
import { repeatTimes, wordRepeats } from "../audio/repeat";

const T = (en: string, hi: string, hinglish: string): Text => ({ en, hi, hinglish });
const S = {
  title: T("Alphabets", "वर्णमाला", "Varnmaala"),
  pick: T("Which alphabet shall we learn?", "कौन-सी वर्णमाला सीखें?", "Kaun si varnmaala seekhein?"),
  compare: T("Compare alphabets", "वर्णमालाएँ मिलाओ", "Varnmaalaayein milaao"),
  compareWhy: T("Letters that make the same sound sit in the same row. Tap any letter to hear it!", "एक जैसी आवाज़ वाले अक्षर एक ही पंक्ति में हैं। किसी भी अक्षर को छूकर सुनो!", "Ek jaisi awaaz waale akshar ek hi line mein hain. Kisi bhi akshar ko chhookar suno!"),
  chart: T("Tap a letter to hear it and see a word that starts with it.", "किसी अक्षर को छूकर सुनो और उससे शुरू होने वाला शब्द देखो।", "Kisi akshar ko chhookar suno aur usse shuru hone waala shabd dekho."),
  read: T("Read", "पढ़ो", "Padho"), listen: T("Listen", "सुनो", "Suno"), write: T("Write", "लिखो", "Likho"), speak: T("Speak", "बोलो", "Bolo"),
  play: T("Play & learn", "खेलो और सीखो", "Khelo aur seekho"),
  game_listen: T("Balloon pop", "गुब्बारा फोड़ो", "Gubbaara phodo"), game_read: T("Sound bubbles", "आवाज़ के बुलबुले", "Awaaz ke bulbule"),
  game_write: T("Magic tracing", "जादुई लिखावट", "Jaadui likhaawat"), game_speak: T("Parrot talk", "तोते की बातें", "Tote ki baatein"),
  how_listen: T("Hear a letter, pop its balloon!", "अक्षर सुनो, उसका गुब्बारा फोड़ो!", "Akshar suno, uska gubbaara phodo!"),
  how_read: T("See a letter, tap the bubble with its sound!", "अक्षर देखो, उसकी आवाज़ वाला बुलबुला छुओ!", "Akshar dekho, uski awaaz waala bulbula chhuo!"),
  how_write: T("Trace the letter with your finger and watch it sparkle!", "उँगली से अक्षर पर लिखो और चमकते देखो!", "Ungli se akshar par likho aur chamakte dekho!"),
  how_speak: T("Say it back like a parrot!", "तोते की तरह दोहराओ!", "Tote ki tarah dohraao!"),
  start: T("Play", "खेलो", "Khelo"),
  allLetters: T("All the letters (tap to hear)", "सारे अक्षर (छूकर सुनो)", "Saare akshar (chhookar suno)"),
  learnFirst: T("Learn this first", "पहले यह सीखो", "Pehle yeh seekho"),
  next: T("Next", "आगे", "Aage"),
  readQ: T("How does this letter sound?", "यह अक्षर कैसे बोलते हैं?", "Yeh akshar kaise bolte hain?"),
  listenQ: T("Listen! Which letter is it?", "सुनो! कौन-सा अक्षर है?", "Suno! Kaun sa akshar hai?"),
  writeQ: T("Trace the letter with your finger.", "उँगली से अक्षर पर लिखो।", "Ungli se akshar par likho."),
  speakQ: T("Listen, then say it out loud!", "सुनो, फिर ज़ोर से बोलो!", "Suno, phir zor se bolo!"),
  sayNow: T("Say it now", "अब बोलो", "Ab bolo"),
  selfCheck: T("Did it sound like Melo?", "क्या मेलो जैसा लगा?", "Kya Melo jaisa laga?"),
  yes: T("Yes!", "हाँ!", "Haan!"), again: T("Try again", "फिर से", "Phir se"),
  heard: T("Melo heard", "मेलो ने सुना", "Melo ne suna"),
  right: T("Yes, well done!", "हाँ, शाबाश!", "Haan, shaabaash!"),
  wrong: T("Not quite. This one is", "पूरा नहीं। यह है", "Poora nahi. Yeh hai"),
  done: T("Round done!", "राउंड पूरा!", "Round poora!"),
  learned: T("New letters learned", "नए अक्षर सीखे", "Naye akshar seekhe"),
  known: T("letters known", "अक्षर आते हैं", "akshar aate hain"),
  more: T("Another round", "एक और राउंड", "Ek aur round"),
  chartBtn: T("All letters", "सारे अक्षर", "Saare akshar"),
  langs: T("Languages", "भाषाएँ", "Bhaashaayein"),
  startsWith: T("starts with", "से शुरू", "se shuru"),
  home: T("Back", "वापस", "Waapas"),
  group_vowel: T("Vowels", "स्वर", "Swar"), group_consonant: T("Consonants", "व्यंजन", "Vyanjan"), group_letter: T("Letters", "अक्षर", "Akshar"),
  group_extra: T("Extra letters", "अतिरिक्त अक्षर", "Extra akshar"), group_syllable: T("Syllables", "अक्षर (ध्वनियाँ)", "Syllables"),
  group_initial: T("Starting sounds", "शुरुआती ध्वनियाँ", "Shuruaati dhvaniyaan"), group_final: T("Ending sounds", "अंतिम ध्वनियाँ", "Antim dhvaniyaan"),
  group_voiced: T("With dots and circles (voiced)", "बिंदु और गोले वाले (घोष)", "Bindu aur gole waale"), group_katakana: T("Katakana", "काताकाना", "Katakana"),
  group_joined: T("Joined letters", "संयुक्त अक्षर", "Sanyukt akshar"),
  onlyHere: T("Only in", "सिर्फ़", "Sirf"),
} satisfies Record<string, Text>;

const SKILLS: { id: AbcSkill; icon: string; game: string }[] = [
  { id: "listen", icon: "👂", game: "🎈" }, { id: "read", icon: "📖", game: "🫧" }, { id: "write", icon: "✍️", game: "✨" }, { id: "speak", icon: "🗣️", game: "🦜" }];
const BALLOON = ["#ff6b8b", "#ffb703", "#4cc9f0", "#7ae582", "#a78bfa", "#ff9f1c"];
type Prog = Record<string, Partial<Record<AbcSkill, AbcCell>>>;
const learnedSkill = (p: Prog, i: number, s: AbcSkill) => (p[String(i)]?.[s]?.streak ?? 0) >= 2;
const seenKey = (child: string, code: string) => `melo.abc.seen.${child}.${code}`;
const loadSeen = (child: string, code: string): Set<number> => { try { return new Set(JSON.parse(localStorage.getItem(seenKey(child, code)) || "[]")); } catch { return new Set(); } };
const saveSeen = (child: string, code: string, s: Set<number>) => { try { localStorage.setItem(seenKey(child, code), JSON.stringify([...s])); } catch { /* private mode */ } };

/** Big letter to show: the letter itself (Latin and Cyrillic show capital and small together). */
export const display = (l: Pick<AbcLetter, "char">) => l.char;
/** What a child traces: one glyph (the capital of a Latin pair, the pinyin letter of a Chinese initial). */
export const traceGlyph = (l: Pick<AbcLetter, "char" | "group">) =>
  l.group === "initial" || l.group === "final" ? l.char.split(" ")[0] : [...l.char].length === 2 && /\p{Lu}/u.test(l.char[0]) ? l.char[0] : l.char;

/** The next letters to practise for a skill: the first ones (in teaching order) not yet learned. */
export function nextSet(letters: Pick<AbcLetter, "i">[], prog: Prog, skill: AbcSkill, size = 5): number[] {
  const todo = letters.filter((l) => !learnedSkill(prog, l.i, skill)).map((l) => l.i);
  return (todo.length ? todo : letters.map((l) => l.i).slice(-size)).slice(0, size);
}

/** Two other letters to choose from: neighbours in the alphabet, with a different romanisation. */
export function distractors(letters: AbcLetter[], i: number, n = 2): AbcLetter[] {
  const me = letters[i];
  const near = letters.filter((l) => l.i !== i && l.roman !== me.roman && l.char !== me.char)
    .sort((a, b) => Math.abs(a.i - i) - Math.abs(b.i - i));
  return near.slice(0, n);
}

/** Say a letter as many times as the parent chose (Settings: letters and words). */
async function sayLetter(code: string, locale: string, l: Pick<AbcLetter, "item" | "say" | "roman">, ui: Child["language"]) {
  await repeatTimes(wordRepeats(), () => sayLetterOnce(code, locale, l, ui));
}

async function sayLetterOnce(code: string, locale: string, l: Pick<AbcLetter, "item" | "say" | "roman">, ui: Child["language"]) {
  try {
    const refs = await api.nativeRefs(code, l.item);
    if (refs.length && (await playNative(refs))) return;
  } catch { /* offline: fall back */ }
  if (await sayIn(l.say, locale, 0.7)) return;
  await speak(l.roman, ui);
}

// --- choose a language ------------------------------------------------------------------------------------
export function AlphabetHome() {
  const { id = "" } = useParams();
  const { child, error } = useChild(id);
  const nav = useNavigate();
  const [langs, setLangs] = useState<LearnStatus[] | null>(null);
  useEffect(() => { api.learnOverview(id).then(setLangs).catch(() => setLangs([])); }, [id]);
  useEffect(() => { if (child) void speak(L(S.pick, child.language), child.language); }, [child]);
  if (error) return <div className="center-screen"><p className="error">{error}</p></div>;
  if (!child || !langs) return <div className="center-screen"><div className="spinner" /></div>;
  const lang = child.language;
  return (
    <KidShell child={child} music="home">
      <div className="lesson learn wide abc-home">
        <h1>🔤 {L(S.title, lang)}</h1>
        <Melo mood="happy" size={90} say={L(S.pick, lang)} />
        <button className="btn big" onClick={() => nav(`/play/${id}/alphabet-compare`)}>🔀 {L(S.compare, lang)}</button>
        <div className="lang-grid">
          {[...langs].sort((a, b) => Number(b.started) - Number(a.started)).map((s) => (
            <button key={s.language.code} className="lang-card" onClick={async () => { primeSpeech(); await unlockAudio(); playSfx("pop"); nav(`/play/${id}/alphabet/${s.language.code}`); }}>
              <span className="lang-flag" aria-hidden>{s.language.flag}</span>
              <strong dir="auto">{s.language.native}</strong>
              <small>{s.language.name}</small>
            </button>
          ))}
        </div>
        <button className="btn ghost" onClick={() => nav(`/play/${id}/learn`)}>◀ {L(S.home, lang)}</button>
      </div>
    </KidShell>
  );
}

// --- one alphabet: chart + practice -------------------------------------------------------------------------
export function AlphabetPage() {
  const { id = "", code = "" } = useParams();
  const { child, error } = useChild(id);
  const [abc, setAbc] = useState<AlphabetData | null>(null);
  const [prog, setProg] = useState<Prog>({});
  const [skill, setSkill] = useState<AbcSkill | null>(null);
  const [open, setOpen] = useState<AbcLetter | null>(null);
  const nav = useNavigate();
  useEffect(() => { api.alphabet(code).then(setAbc).catch(() => setAbc(null)); }, [code]);
  const reload = useCallback(() => { api.alphabetProgress(id, code).then((p) => setProg(p.letters)).catch(() => {}); }, [id, code]);
  useEffect(reload, [reload]);
  useEffect(() => { if (child && abc) void speak(L(S.chart, child.language), child.language); }, [child, abc]);
  if (error) return <div className="center-screen"><p className="error">{error}</p></div>;
  if (!child || !abc) return <div className="center-screen"><div className="spinner" /></div>;
  const lang = child.language;
  if (skill) return <Practice child={child} abc={abc} prog={prog} skill={skill} onDone={() => { setSkill(null); reload(); }} />;
  const groups = [...new Set(abc.letters.map((l) => l.group))];
  const known = abc.letters.filter((l) => SKILLS.some((s) => learnedSkill(prog, l.i, s.id))).length;
  return (
    <KidShell child={child} music="home">
      <div className="lesson learn wide abc-page" dir="ltr">
        <h1>{abc.flag} <span dir="auto">{abc.native}</span>{abc.native !== abc.name && <span className="abc-en"> ({abc.name})</span>} · {L(S.title, lang)}</h1>
        <p className="muted">{known}/{abc.letters.length} {L(S.known, lang)}</p>
        <h2 className="abc-play-title">🎮 {L(S.play, lang)}</h2>
        <div className="abc-games">
          {SKILLS.map((s) => {
            const done = abc.letters.filter((l) => learnedSkill(prog, l.i, s.id)).length;
            return (
              <button key={s.id} className={`abc-game game-${s.id}`} onClick={async () => { primeSpeech(); await unlockAudio(); playSfx("pop"); setSkill(s.id); }}>
                <span className="abc-game-icon" aria-hidden>{s.game}</span>
                <strong>{L(S[`game_${s.id}` as keyof typeof S], lang)}</strong>
                <span className="abc-game-skill">{s.icon} {L(S[s.id], lang)}</span>
                <small>{L(S[`how_${s.id}` as keyof typeof S], lang)}</small>
                <span className="abc-game-bar" aria-label={`${done}/${abc.letters.length}`}><i style={{ width: `${(100 * done) / abc.letters.length}%` }} /></span>
                <small className="muted">{done}/{abc.letters.length} · ▶ {L(S.start, lang)}</small>
              </button>
            );
          })}
        </div>
        <h2 className="abc-play-title">🔤 {L(S.allLetters, lang)}</h2>
        {open && <LetterCard abc={abc} letter={open} child={child} onClose={() => setOpen(null)} />}
        {groups.map((g) => (
          <section key={g} className="abc-group">
            <h2>{L((S as Record<string, Text>)[`group_${g}`] ?? S.group_letter, lang)}</h2>
            <div className={`abc-chart${abc.rtl ? " rtl" : ""}`} dir={abc.rtl ? "rtl" : "ltr"}>
              {abc.letters.filter((l) => l.group === g).map((l) => (
                <button key={l.i} className="abc-tile" onClick={() => { setOpen(l); void sayLetter(abc.code, abc.locale, l, lang); }} aria-label={`${l.char} ${l.roman}`}>
                  <span className="abc-char" dir="auto">{display(l)}</span>
                  <small>{l.roman}</small>
                  <span className="abc-dots" aria-hidden>{SKILLS.map((s) => <i key={s.id} className={learnedSkill(prog, l.i, s.id) ? "on" : ""} />)}</span>
                </button>
              ))}
            </div>
          </section>
        ))}
        <div className="row center wrap">
          <button className="btn" onClick={() => nav(`/play/${id}/alphabet-compare?with=${code}`)}>🔀 {L(S.compare, lang)}</button>
          <button className="btn ghost" onClick={() => nav(`/play/${id}/alphabet`)}>◀ {L(S.langs, lang)}</button>
        </div>
      </div>
    </KidShell>
  );
}

function LetterCard({ abc, letter, child, onClose }: { abc: AlphabetData; letter: AbcLetter; child: Child; onClose?: () => void }) {
  const lang = child.language;
  return (
    <div className="card abc-card" role="dialog" aria-label={letter.char}>
      <span className="abc-big" dir="auto">{display(letter)}</span>
      <p className="abc-roman">{letter.roman}{letter.name ? ` · ${letter.name}` : ""}</p>
      {letter.example && (
        <p className="abc-example"><span aria-hidden>{letter.example.emoji}</span> <strong dir="auto">{letter.example.word}</strong>
          {letter.example.roman ? ` (${letter.example.roman})` : ""} · {letter.example.meaning} · {L(S.startsWith, lang)} <span dir="auto">{traceGlyph(letter)}</span></p>
      )}
      <div className="row center">
        <button className="btn" onClick={() => void sayLetter(abc.code, abc.locale, letter, lang)}>🔊</button>
        {onClose && <button className="btn ghost" onClick={onClose}>✖</button>}
      </div>
    </div>
  );
}

// --- a round of 5 letters for one skill ----------------------------------------------------------------------
type Step = { kind: "teach" | "ask"; i: number };

function Practice({ child, abc, prog, skill, onDone }: { child: Child; abc: AlphabetData; prog: Prog; skill: AbcSkill; onDone: () => void }) {
  const lang = child.language;
  const set = useMemo(() => nextSet(abc.letters, prog, skill), []); // eslint-disable-line react-hooks/exhaustive-deps
  const steps = useMemo<Step[]>(() => {
    const seen = loadSeen(child.id, abc.code);
    return set.flatMap((i) => (seen.has(i) ? [{ kind: "ask" as const, i }] : [{ kind: "teach" as const, i }, { kind: "ask" as const, i }]));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [k, setK] = useState(0);
  const [answer, setAnswer] = useState<string | null>(null);
  const [results, setResults] = useState<{ i: number; ok: boolean }[]>([]);
  const [summary, setSummary] = useState<{ right: number; total: number; newly: number[]; known: number; of: number; stars: number } | null>(null);
  const [heard, setHeard] = useState<string | null>(null);
  const [selfCheck, setSelfCheck] = useState(false);
  const [mood, setMood] = useState<MeloMood>("talking");
  const [streak, setStreak] = useState(0);
  const [party, setParty] = useState(0);
  const step = steps[k];
  const letter = step ? abc.letters[step.i] : null;
  const choices = useMemo(() => {
    if (!letter) return [];
    const all = [letter, ...distractors(abc.letters, letter.i)];
    const shift = letter.i % all.length;
    return [...all.slice(shift), ...all.slice(0, shift)];
  }, [letter, abc.letters]);
  const canHear = child.consent_microphone && speechRecognitionAvailable();

  useEffect(() => {
    if (!letter || summary) return;
    setAnswer(null); setHeard(null); setSelfCheck(false); setMood("talking");
    stopSpeaking();
    void (async () => {
      if (step.kind === "teach") {
        await speak(L(S.learnFirst, lang), lang);
        await sayLetter(abc.code, abc.locale, letter, lang);
        const seen = loadSeen(child.id, abc.code); seen.add(letter.i); saveSeen(child.id, abc.code, seen);
        return;
      }
      const q = { read: S.readQ, listen: S.listenQ, write: S.writeQ, speak: S.speakQ }[skill];
      await speak(L(q, lang), lang);
      if (skill !== "read") await sayLetter(abc.code, abc.locale, letter, lang);
      setMood("listening");
    })();
  }, [k, summary]); // eslint-disable-line react-hooks/exhaustive-deps

  const finishRound = async (all: { i: number; ok: boolean }[]) => {
    try {
      const r = await api.alphabetRound(child.id, abc.code, skill, all);
      setSummary({ right: r.right, total: r.total, newly: r.newly_learned, known: r.known, of: r.of, stars: r.stars });
    } catch {
      const right = all.filter((x) => x.ok).length;
      setSummary({ right, total: all.length, newly: [], known: 0, of: abc.letters.length, stars: right === all.length ? 3 : 1 });
    }
    playSfx("tada"); setMood("cheer"); setParty((p) => p + 1);
    void speak(L(S.done, lang), lang);
  };
  const judge = (ok: boolean) => {
    if (!letter) return;
    playSfx(ok ? "sparkle" : "oops");
    setMood(ok ? "cheer" : "encourage");
    setStreak((n) => { const v = ok ? n + 1 : 0; if (ok && v > 0 && v % 3 === 0) setParty((p) => p + 1); return v; });
    void speak(ok ? L(S.right, lang) : `${L(S.wrong, lang)} ${letter.roman}`, lang);
    if (!ok) void sayLetter(abc.code, abc.locale, letter, lang);
    setResults((r) => [...r, { i: letter.i, ok }]);
  };
  const next = () => {
    playSfx("pop");
    if (k + 1 < steps.length) { setK(k + 1); return; }
    void finishRound(results);
  };
  const answered = !!step && step.kind === "ask" && results.some((r) => r.i === step.i);

  const listenNow = async () => {
    try {
      const said = await listenIn(abc.locale, 5000);
      const norm = (x: string) => x.toLowerCase().replace(/[\s.,!?।]/g, "");
      const targets = [letter!.say, letter!.char, letter!.roman, letter!.name, letter!.example?.word ?? ""].filter(Boolean).map(norm);
      setHeard(said[0] ?? "…");
      const ok = said.some((s) => targets.some((t) => t && (norm(s).includes(t) || t.includes(norm(s)) && norm(s).length > 0)));
      if (ok) judge(true); else setSelfCheck(true);
    } catch { setSelfCheck(true); }
  };

  if (summary) {
    return (
      <KidShell child={child}>
        <div className="lesson abc-summary" role="status">
          <Melo mood="cheer" size={100} />
          <h2>🎉 {L(S.done, lang)}</h2>
          <p className="rain-stars" style={{ fontSize: "2.4rem" }}>{"⭐".repeat(summary.stars)}{"☆".repeat(3 - summary.stars)}</p>
          <p>{summary.right}/{summary.total}</p>
          {summary.newly.length > 0 && <p>{L(S.learned, lang)}: <span className="abc-new" dir="auto">{summary.newly.map((i) => display(abc.letters[i])).join("  ")}</span></p>}
          <p className="muted">{summary.known}/{summary.of} {L(S.known, lang)}</p>
          <div className="row center wrap">
            <button className="btn primary big" onClick={onDone}>🔤 {L(S.chartBtn, lang)}</button>
          </div>
        </div>
      </KidShell>
    );
  }
  if (!letter) return null;
  return (
    <KidShell child={child}>
      <div className="lesson abc-practice">
        <Confetti burst={party} />
        <div className="abc-round-head">
          <span className="abc-game-icon" aria-hidden>{SKILLS.find((x) => x.id === skill)?.game}</span>
          <strong>{L(S[`game_${skill}` as keyof typeof S], lang)}</strong>
          {streak >= 2 && <span className="rain-streak">🔥 {streak}</span>}
        </div>
        <div className="story-progress">{steps.map((_, x) => <i key={x} className={x <= k ? "on" : ""} />)}</div>
        <Melo mood={mood} size={70} />
        {step.kind === "teach" && (
          <>
            <h2>🌟 {L(S.learnFirst, lang)}</h2>
            <LetterCard abc={abc} letter={letter} child={child} />
            <button className="btn primary big" onClick={next}>{L(S.next, lang)} ▶</button>
          </>
        )}
        {step.kind === "ask" && skill === "read" && (
          <>
            <h2>{L(S.readQ, lang)}</h2>
            <span className="abc-big" dir="auto">{display(letter)}</span>
            <div className="abc-bubbles">
              {choices.map((c, x) => (
                <button key={c.i} className={`abc-bubble${answer ? (c.i === letter.i ? " right" : answer === String(c.i) ? " wrong" : " fade") : ""}`} disabled={answered}
                  style={{ animationDelay: `${x * 0.4}s` }} onClick={() => { setAnswer(String(c.i)); judge(c.i === letter.i); }}>{c.roman}</button>
              ))}
            </div>
          </>
        )}
        {step.kind === "ask" && skill === "listen" && (
          <>
            <h2>{L(S.listenQ, lang)}</h2>
            <button className="btn big" onClick={() => void sayLetter(abc.code, abc.locale, letter, lang)}>🔊</button>
            <div className="abc-balloons">
              {choices.map((c, x) => (
                <button key={c.i} className={`abc-balloon${answer ? (c.i === letter.i ? " popped" : answer === String(c.i) ? " wrong" : " fade") : ""}`} disabled={answered}
                  style={{ ["--b" as string]: BALLOON[(c.i + x) % BALLOON.length], animationDelay: `${x * 0.5}s` }}
                  onClick={() => { setAnswer(String(c.i)); judge(c.i === letter.i); }} aria-label={c.char}>
                  <span className="abc-char" dir="auto">{c.i === letter.i && answer ? "💥" : display(c)}</span>
                </button>
              ))}
            </div>
          </>
        )}
        {step.kind === "ask" && skill === "write" && (
          <>
            <h2>{L(S.writeQ, lang)}</h2>
            {!answered ? (
              <TracePad key={`${letter.i}-${k}`} glyph={traceGlyph(letter)} guide emoji={letter.example?.emoji} busy={false} ui={lang}
                onDone={(r) => judge(r.coverage >= 0.45 && r.spill <= 0.45)} />
            ) : <span className="abc-big" dir="auto">{traceGlyph(letter)}</span>}
          </>
        )}
        {step.kind === "ask" && skill === "speak" && (
          <>
            <h2>🦜 {L(S.speakQ, lang)}</h2>
            <span className="abc-big" dir="auto">{display(letter)}</span>
            <p className="abc-roman">{letter.roman}</p>
            <div className="row center wrap">
              <button className="btn" onClick={() => void sayLetter(abc.code, abc.locale, letter, lang)}>🔊</button>
              {!answered && canHear && !selfCheck && <button className="btn primary big" onClick={() => void listenNow()}>🎤 {L(S.sayNow, lang)}</button>}
            </div>
            {heard && <p className="muted">{L(S.heard, lang)}: “{heard}”</p>}
            {!answered && (selfCheck || !canHear) && (
              <div className="row center wrap">
                <p className="abc-roman">{L(S.selfCheck, lang)}</p>
                <button className="btn primary" onClick={() => judge(true)}>👍 {L(S.yes, lang)}</button>
                <button className="btn ghost" onClick={() => { setSelfCheck(false); setHeard(null); void sayLetter(abc.code, abc.locale, letter, lang); }}>🔁 {L(S.again, lang)}</button>
              </div>
            )}
          </>
        )}
        {answered && <button className="btn primary big" onClick={next}>{L(S.next, lang)} ▶</button>}
        <button className="btn ghost small" onClick={onDone}>✖</button>
      </div>
    </KidShell>
  );
}

// --- compare alphabets ---------------------------------------------------------------------------------------
export function AlphabetCompareView() {
  const { id = "" } = useParams();
  const { child, error } = useChild(id);
  const nav = useNavigate();
  const [all, setAll] = useState<LearnStatus[] | null>(null);
  const [chosen, setChosen] = useState<string[]>([]);
  const [data, setData] = useState<AlphabetCompare | null>(null);
  useEffect(() => {
    api.learnOverview(id).then((ls) => {
      setAll(ls);
      const w = new URLSearchParams(window.location.search).get("with");
      const started = ls.filter((s) => s.started).map((s) => s.language.code);
      const pick = [...new Set([w, ...started, "hi", "en", "ta"].filter((x): x is string => !!x && ls.some((s) => s.language.code === x)))].slice(0, 4);
      setChosen(pick);
    }).catch(() => setAll([]));
  }, [id]);
  useEffect(() => { if (chosen.length) api.alphabetCompare(chosen).then(setData).catch(() => setData(null)); }, [chosen]);
  useEffect(() => { if (child) void speak(L(S.compareWhy, child.language), child.language); }, [child]);
  if (error) return <div className="center-screen"><p className="error">{error}</p></div>;
  if (!child || !all) return <div className="center-screen"><div className="spinner" /></div>;
  const lang = child.language;
  const toggle = (c: string) => setChosen((x) => (x.includes(c) ? (x.length > 1 ? x.filter((y) => y !== c) : x) : [...x, c]));
  return (
    <KidShell child={child} music="home">
      <div className="lesson learn wide abc-compare">
        <h1>🔀 {L(S.compare, lang)}</h1>
        <p>{L(S.compareWhy, lang)}</p>
        <div className="chips">
          {all.map((s) => (
            <button key={s.language.code} className={`chip${chosen.includes(s.language.code) ? " on" : ""}`} onClick={() => toggle(s.language.code)} aria-pressed={chosen.includes(s.language.code)}>
              {s.language.flag} <span dir="auto">{s.language.native}</span>{s.language.native !== s.language.name && <small className="abc-en"> {s.language.name}</small>}
            </button>
          ))}
        </div>
        {data && (
          <div className="compare-scroll">
            <table className="abc-table">
              <thead><tr><th>🔊</th>{data.langs.map((l) => <th key={l.code}>{l.flag} <span dir="auto">{l.native}</span>{l.native !== l.name && <><br /><small className="abc-en">{l.name}</small></>}</th>)}</tr></thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.sound}>
                    <th scope="row" title={r.hint}><small>{r.hint}</small>
                      {Object.keys(r.cells).length === 1 && data.langs.length > 1 && <small className="abc-only"> · {L(S.onlyHere, lang)} {data.langs.find((l) => r.cells[l.code])?.name}</small>}</th>
                    {data.langs.map((l) => (
                      <td key={l.code}>
                        {(r.cells[l.code] ?? []).map((c) => (
                          <button key={c.item} className="abc-cell" onClick={() => void sayLetter(l.code, l.locale, { item: c.item, say: c.say, roman: c.roman }, lang)}>
                            <span dir="auto">{c.char}</span><small>{c.roman}</small>
                          </button>
                        ))}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <button className="btn ghost" onClick={() => nav(`/play/${id}/alphabet`)}>◀ {L(S.title, lang)}</button>
      </div>
    </KidShell>
  );
}
