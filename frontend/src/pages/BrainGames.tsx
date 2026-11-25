// Brain games 🧠: six short, playful games, each training one skill (working memory, sound memory, attention,
// logic, self-control, number sense). Each starts very easy and grows a small step after every good round,
// with sounds, a streak, confetti and stars. Every round is written to the learning graph.
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, type Child } from "../api";
import { primeSpeech, speak, stopSpeaking } from "../audio/speech";
import { playNote, playSfx, sleep, unlockAudio } from "../audio/synth";
import { Confetti, Melo } from "../components/Melo";
import { L, type Text } from "../i18n";
import {
  countRound, memoryDeck, nextLevel, oddRound, patternRound, SIMON_PADS, simonTune, starsFor, starsRound, starsScore, starsSpeed, type BrainGame,
} from "../teaching/brain";
import { KidShell, useChild } from "./KidHome";

const T = (en: string, hi: string, hinglish: string): Text => ({ en, hi, hinglish });
const GAMES: { id: BrainGame; icon: string; title: Text; skill: Text; how: Text; color: string }[] = [
  { id: "memory", icon: "🃏", color: "#ffd6e0", title: T("Memory match", "जोड़ी मिलाओ", "Jodi milaao"), skill: T("Memory", "याददाश्त", "Yaaddaasht"),
    how: T("Turn two cards. Find the pairs that match!", "दो कार्ड पलटो। मिलती जोड़ियाँ ढूँढो!", "Do card palto. Milti jodiyaan dhoondho!") },
  { id: "simon", icon: "🎹", color: "#fff1b8", title: T("Copy the tune", "धुन दोहराओ", "Dhun dohraao"), skill: T("Sound memory", "सुनने की याददाश्त", "Sunne ki yaaddaasht"),
    how: T("Listen and watch the colours, then play the same tune!", "सुनो और रंग देखो, फिर वही धुन बजाओ!", "Suno aur rang dekho, phir wahi dhun bajaao!") },
  { id: "odd", icon: "🔍", color: "#d4f1ff", title: T("Odd one out", "अलग वाला ढूँढो", "Alag waala dhoondho"), skill: T("Attention", "ध्यान", "Dhyaan"),
    how: T("One picture is different. Can you find it?", "एक तस्वीर अलग है। ढूँढ सकते हो?", "Ek tasveer alag hai. Dhoondh sakte ho?") },
  { id: "pattern", icon: "🔮", color: "#ece2ff", title: T("What comes next?", "आगे क्या आएगा?", "Aage kya aayega?"), skill: T("Logic", "तर्क", "Tark"),
    how: T("Look at the pattern. Which one comes next?", "पैटर्न देखो। आगे कौन-सा आएगा?", "Pattern dekho. Aage kaun sa aayega?") },
  { id: "stars", icon: "⭐", color: "#dff7d6", title: T("Catch the stars", "तारे पकड़ो", "Taare pakdo"), skill: T("Focus and self-control", "ध्यान और संयम", "Dhyaan aur sanyam"),
    how: T("Tap every star ⭐ quickly, but never the rain cloud 🌧️!", "हर तारे ⭐ को जल्दी छुओ, पर बादल 🌧️ को कभी नहीं!", "Har taare ⭐ ko jaldi chhuo, par baadal 🌧️ ko kabhi nahi!") },
  { id: "count", icon: "🔢", color: "#ffe3c4", title: T("Quick count", "झटपट गिनती", "Jhatpat ginti"), skill: T("Number sense", "संख्या की समझ", "Sankhya ki samajh"),
    how: T("Dots flash for a moment. How many did you see?", "बिंदु पल भर दिखेंगे। कितने देखे?", "Bindu pal bhar dikhenge. Kitne dekhe?") },
];
const S = {
  title: T("Brain games", "दिमाग़ के खेल", "Dimaag ke khel"),
  pick: T("Pick a game! Each one makes a different part of your brain stronger.", "एक खेल चुनो! हर खेल दिमाग़ के अलग हिस्से को मज़बूत करता है।", "Ek khel chuno! Har khel dimaag ke alag hisse ko mazboot karta hai."),
  level: T("Level", "स्तर", "Level"), start: T("Start", "शुरू", "Shuru"), again: T("Play again", "फिर खेलो", "Phir khelo"),
  games: T("All games", "सारे खेल", "Saare khel"), home: T("Home", "घर", "Ghar"),
  right: T("Yes!", "हाँ!", "Haan!"), oops: T("Oops, try the next one!", "उफ़, अगला आज़माओ!", "Oops, agla aazmaao!"),
  watch: T("Watch and listen...", "देखो और सुनो...", "Dekho aur suno..."), your: T("Your turn!", "तुम्हारी बारी!", "Tumhari baari!"),
  levelUp: T("Level up! It gets a little harder.", "स्तर बढ़ा! अब थोड़ा मुश्किल।", "Level badha! Ab thoda mushkil."),
  stay: T("Good playing! Let's practise this level again.", "बढ़िया खेले! इस स्तर का फिर अभ्यास करें।", "Badhiya khele! Is level ka phir abhyaas karein."),
  easier: T("Let's make it a bit easier, that's how brains grow.", "थोड़ा आसान करते हैं, ऐसे ही दिमाग़ बढ़ता है।", "Thoda aasaan karte hain, aise hi dimaag badhta hai."),
  howMany: T("How many dots?", "कितने बिंदु?", "Kitne bindu?"),
  why: T("For grown-ups: each game practises one skill (memory, attention, logic, self-control, number sense). Short daily play helps; no game makes a child 'smarter' on its own.",
    "बड़ों के लिए: हर खेल एक कौशल का अभ्यास कराता है (याददाश्त, ध्यान, तर्क, संयम, संख्या)। रोज़ थोड़ा खेलना मदद करता है; कोई खेल अपने-आप बच्चे को 'होशियार' नहीं बनाता।",
    "Badon ke liye: har khel ek skill ka abhyaas karaata hai (yaaddaasht, dhyaan, tark, sanyam, sankhya). Roz thoda khelna madad karta hai; koi khel apne-aap bachche ko 'hoshiyaar' nahi banaata."),
};
const levelKey = (child: string, g: BrainGame) => `melo.brain.${child}.${g}`;
const getLevel = (child: string, g: BrainGame) => { try { return Math.max(1, Number(localStorage.getItem(levelKey(child, g))) || 1); } catch { return 1; } };
const setLevelStore = (child: string, g: BrainGame, v: number) => { try { localStorage.setItem(levelKey(child, g), String(v)); } catch { /* private */ } };

export function BrainHome() {
  const { id = "" } = useParams();
  const { child, error } = useChild(id);
  const nav = useNavigate();
  useEffect(() => { if (child) void speak(L(S.pick, child.language), child.language); }, [child]);
  if (error) return <div className="center-screen"><p className="error">{error}</p></div>;
  if (!child) return <div className="center-screen"><div className="spinner" /></div>;
  const lang = child.language;
  return (
    <KidShell child={child} music="play">
      <div className="lesson brain-home">
        <h1>🧠 {L(S.title, lang)}</h1>
        <Melo mood="happy" size={90} say={L(S.pick, lang)} />
        <div className="brain-grid">
          {GAMES.map((g) => (
            <button key={g.id} className="brain-card" style={{ background: g.color }}
              onClick={async () => { primeSpeech(); await unlockAudio(); playSfx("pop"); nav(`/play/${id}/brain/${g.id}`); }}>
              <span className="brain-icon" aria-hidden>{g.icon}</span>
              <strong>{L(g.title, lang)}</strong>
              <span className="abc-game-skill">{L(g.skill, lang)}</span>
              <small className="muted">{L(S.level, lang)} {getLevel(child.id, g.id)}</small>
            </button>
          ))}
        </div>
        <p className="muted small listen-note">{L(S.why, lang)}</p>
        <button className="btn ghost" onClick={() => nav(`/play/${id}`)}>🏠 {L(S.home, lang)}</button>
      </div>
    </KidShell>
  );
}

export function BrainGamePage() {
  const { id = "", game = "memory" } = useParams();
  const { child, error } = useChild(id);
  const def = GAMES.find((g) => g.id === game);
  if (error) return <div className="center-screen"><p className="error">{error}</p></div>;
  if (!child || !def) return <div className="center-screen"><div className="spinner" /></div>;
  return <Round key={game} child={child} game={def} />;
}

type Result = { right: number; total: number };

function Round({ child, game }: { child: Child; game: (typeof GAMES)[number] }) {
  const lang = child.language;
  const nav = useNavigate();
  const [level, setLevel] = useState(getLevel(child.id, game.id));
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
  const [done, setDone] = useState<Result | null>(null);
  const [party, setParty] = useState(0);
  const [streak, setStreak] = useState(0);
  useEffect(() => { void speak(L(game.how, lang), lang); return () => stopSpeaking(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const hit = (ok: boolean) => {
    playSfx(ok ? "sparkle" : "oops");
    setStreak((n) => { const v = ok ? n + 1 : 0; if (v && v % 3 === 0) setParty((p) => p + 1); return v; });
  };
  const finish = (r: Result) => {
    const nl = nextLevel(level, r.right, r.total);
    setLevelStore(child.id, game.id, nl);
    setDone(r);
    setParty((p) => p + 1);
    playSfx(r.right >= r.total * 0.7 ? "tada" : "clap");
    void speak(L(nl > level ? S.levelUp : nl < level ? S.easier : S.stay, lang), lang);
    void api.addNote(child.id, `Brain game · ${L(game.title, "en")} (${L(game.skill, "en")}), level ${level}: ${r.right}/${r.total}${nl !== level ? `, now level ${nl}` : ""}`).catch(() => {});
    setLevel(nl);
  };
  const again = () => { setDone(null); setSeed(Math.floor(Math.random() * 1e9)); setStreak(0); };
  const props = { level, seed, onHit: hit, onDone: finish, lang };

  return (
    <KidShell child={child}>
      <div className="lesson brain-round">
        <Confetti burst={party} />
        <div className="abc-round-head">
          <span className="abc-game-icon" aria-hidden>{game.icon}</span>
          <strong>{L(game.title, lang)}</strong>
          <span className="muted">· {L(S.level, lang)} {level}</span>
          {streak >= 2 && <span className="rain-streak">🔥 {streak}</span>}
        </div>
        {!done && <p className="listen-how">{L(game.how, lang)}</p>}
        {done ? (
          <div className="card abc-summary" role="status">
            <Melo mood="cheer" size={90} />
            <p className="rain-stars" style={{ fontSize: "2.4rem" }}>{"⭐".repeat(starsFor(done.right, done.total))}{"☆".repeat(3 - starsFor(done.right, done.total))}</p>
            <p>{done.right}/{done.total}</p>
            <div className="row center wrap">
              <button className="btn primary big" onClick={again}>🔁 {L(S.again, lang)}</button>
              <button className="btn ghost" onClick={() => nav(`/play/${child.id}/brain`)}>🧠 {L(S.games, lang)}</button>
            </div>
          </div>
        ) : game.id === "memory" ? <Memory key={seed} {...props} />
          : game.id === "simon" ? <Simon key={seed} {...props} />
          : game.id === "odd" ? <Odd key={seed} {...props} />
          : game.id === "pattern" ? <Pattern key={seed} {...props} />
          : game.id === "stars" ? <Stars key={seed} {...props} />
          : <Count key={seed} {...props} />}
      </div>
    </KidShell>
  );
}

type GameProps = { level: number; seed: number; onHit: (ok: boolean) => void; onDone: (r: Result) => void; lang: Child["language"] };

function Memory({ level, seed, onHit, onDone }: GameProps) {
  const deck = useMemo(() => memoryDeck(level, seed), [level, seed]);
  const [open, setOpen] = useState<number[]>([]);
  const [found, setFound] = useState<Set<number>>(new Set());
  const [misses, setMisses] = useState(0);
  const lock = useRef(false);
  const flip = (i: number) => {
    if (lock.current || open.includes(i) || found.has(i)) return;
    playSfx("pop");
    const now = [...open, i];
    setOpen(now);
    if (now.length < 2) return;
    lock.current = true;
    const [a, b] = now;
    const ok = deck[a] === deck[b];
    window.setTimeout(() => {
      onHit(ok);
      if (ok) {
        const f = new Set(found); f.add(a); f.add(b); setFound(f);
        if (f.size === deck.length) { const pairs = deck.length / 2; onDone({ right: pairs, total: pairs + Math.floor(misses / 2) }); }
      } else setMisses((m) => m + 1);
      setOpen([]);
      lock.current = false;
    }, ok ? 400 : 900);
  };
  const cols = deck.length <= 4 ? 2 : deck.length <= 12 ? 4 : 4;
  return (
    <div className="memory-grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
      {deck.map((p, i) => (
        <button key={i} className={`memory-card${open.includes(i) || found.has(i) ? " up" : ""}${found.has(i) ? " found" : ""}`} onClick={() => flip(i)} aria-label={open.includes(i) || found.has(i) ? p : "card"}>
          <span>{open.includes(i) || found.has(i) ? p : "❓"}</span>
        </button>
      ))}
    </div>
  );
}

function Simon({ level, seed, onHit, onDone, lang }: GameProps) {
  const ROUNDS = 3;
  const [round, setRound] = useState(0);
  const tune = useMemo(() => simonTune(level, seed + round), [level, seed, round]);
  const [lit, setLit] = useState<number | null>(null);
  const [turn, setTurn] = useState(false);
  const [pos, setPos] = useState(0);
  const right = useRef(0);
  useEffect(() => {
    let alive = true;
    setTurn(false); setPos(0);
    void (async () => {
      await sleep(900);
      void speak(L(S.watch, lang), lang);
      await sleep(900);
      for (const p of tune) {
        if (!alive) return;
        setLit(p); playNote(SIMON_PADS[p].midi, { timbre: "xylophone", duration: 0.45 });
        await sleep(560); setLit(null); await sleep(220);
      }
      if (alive) { setTurn(true); void speak(L(S.your, lang), lang); }
    })();
    return () => { alive = false; };
  }, [tune]); // eslint-disable-line react-hooks/exhaustive-deps
  const press = (p: number) => {
    if (!turn) return;
    setLit(p); playNote(SIMON_PADS[p].midi, { timbre: "xylophone", duration: 0.35 });
    window.setTimeout(() => setLit(null), 250);
    const ok = tune[pos] === p;
    if (!ok || pos + 1 === tune.length) {
      setTurn(false);
      onHit(ok);
      if (ok) right.current++;
      if (round + 1 === ROUNDS) window.setTimeout(() => onDone({ right: right.current, total: ROUNDS }), 600);
      else window.setTimeout(() => setRound((r) => r + 1), 900);
    } else setPos(pos + 1);
  };
  return (
    <>
      <div className="story-progress">{Array.from({ length: ROUNDS }, (_, i) => <i key={i} className={i <= round ? "on" : ""} />)}</div>
      <div className="simon-pads">
        {SIMON_PADS.map((p, i) => (
          <button key={i} className={`simon-pad${lit === i ? " lit" : ""}`} style={{ ["--c" as string]: p.color }} disabled={!turn} onClick={() => press(i)} aria-label={`pad ${i + 1}`} />
        ))}
      </div>
      <p className="muted">{turn ? `${L(S.your, lang)} ${pos}/${tune.length}` : L(S.watch, lang)}</p>
    </>
  );
}

function useQuestions<T>(n: number, make: (i: number) => T) {
  const [i, setI] = useState(0);
  const [answered, setAnswered] = useState<number | null>(null);
  const right = useRef(0);
  const q = useMemo(() => make(i), [i]); // eslint-disable-line react-hooks/exhaustive-deps
  return { i, q, answered, setAnswered, right, next: () => { setAnswered(null); setI(i + 1); }, last: i + 1 >= n };
}

function Odd({ level, seed, onHit, onDone }: GameProps) {
  const N = 5;
  const { i, q, answered, setAnswered, right, next, last } = useQuestions(N, (k) => oddRound(level, seed + k));
  const tap = (c: number) => {
    if (answered !== null) return;
    const ok = c === q.odd;
    setAnswered(c); onHit(ok); if (ok) right.current++;
    window.setTimeout(() => (last ? onDone({ right: right.current, total: N }) : next()), 900);
  };
  const cols = Math.ceil(Math.sqrt(q.cells.length));
  return (
    <>
      <div className="story-progress">{Array.from({ length: N }, (_, x) => <i key={x} className={x <= i ? "on" : ""} />)}</div>
      <div className="odd-grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {q.cells.map((c, k) => (
          <button key={k} className={`odd-cell${answered !== null && k === q.odd ? " right" : answered === k ? " wrong" : ""}`} onClick={() => tap(k)}>{c}</button>
        ))}
      </div>
    </>
  );
}

function Pattern({ level, seed, onHit, onDone }: GameProps) {
  const N = 5;
  const { i, q, answered, setAnswered, right, next, last } = useQuestions(N, (k) => patternRound(level, seed + k));
  const pick = (k: number) => {
    if (answered !== null) return;
    const ok = q.choices[k] === q.answer;
    setAnswered(k); onHit(ok); if (ok) right.current++;
    window.setTimeout(() => (last ? onDone({ right: right.current, total: N }) : next()), 1000);
  };
  return (
    <>
      <div className="story-progress">{Array.from({ length: N }, (_, x) => <i key={x} className={x <= i ? "on" : ""} />)}</div>
      <div className="pattern-row">{q.shown.map((p, k) => <span key={k}>{p}</span>)}<span className="pattern-q">{answered !== null ? q.answer : "❓"}</span></div>
      <div className="abc-bubbles">
        {q.choices.map((c, k) => (
          <button key={k} className={`abc-bubble${answered !== null ? (c === q.answer ? " right" : answered === k ? " wrong" : " fade") : ""}`} onClick={() => pick(k)}>{c}</button>
        ))}
      </div>
    </>
  );
}

function Stars({ level, seed, onHit, onDone }: GameProps) {
  const items = useMemo(() => starsRound(level, seed), [level, seed]);
  const { showMs } = starsSpeed(level);
  const [k, setK] = useState(-1);
  const log = useRef<{ item: "go" | "nogo"; tapped: boolean }[]>([]);
  const tapped = useRef(false);
  useEffect(() => {
    let alive = true;
    void (async () => {
      await sleep(1200);
      for (let x = 0; x < items.length && alive; x++) {
        tapped.current = false;
        setK(x);
        await sleep(showMs);
        if (!alive) return;
        log.current.push({ item: items[x].item, tapped: tapped.current });
        if (!tapped.current && items[x].item === "nogo") playSfx("pop"); // a cloud left alone: well done
        setK(-1);
        await sleep(350);
      }
      if (alive) onDone(starsScore(log.current));
    })();
    return () => { alive = false; };
  }, [items]); // eslint-disable-line react-hooks/exhaustive-deps
  const cur = k >= 0 ? items[k] : null;
  return (
    <div className="stars-board">
      {Array.from({ length: 9 }, (_, c) => (
        <button key={c} className="stars-cell" onClick={() => {
          if (!cur || cur.cell !== c || tapped.current) return;
          tapped.current = true;
          onHit(cur.item === "go");
          if (cur.item === "go") playNote(84, { timbre: "bell", duration: 0.3 });
        }}>{cur && cur.cell === c ? (cur.item === "go" ? "⭐" : "🌧️") : ""}</button>
      ))}
    </div>
  );
}

function Count({ level, seed, onHit, onDone, lang }: GameProps) {
  const N = 5;
  const { i, q, answered, setAnswered, right, next, last } = useQuestions(N, (k) => countRound(level, seed + k));
  const [show, setShow] = useState(true);
  useEffect(() => { setShow(true); const t = window.setTimeout(() => setShow(false), q.showMs); return () => window.clearTimeout(t); }, [q]);
  const pick = (c: number) => {
    if (answered !== null || show) return;
    const ok = c === q.n;
    setAnswered(c); onHit(ok); if (ok) right.current++;
    setShow(true);
    window.setTimeout(() => (last ? onDone({ right: right.current, total: N }) : next()), 1300);
  };
  return (
    <>
      <div className="story-progress">{Array.from({ length: N }, (_, x) => <i key={x} className={x <= i ? "on" : ""} />)}</div>
      <div className="count-board">{show && q.dots.map((d, k) => <i key={k} style={{ left: `${d.x}%`, top: `${d.y}%` }} />)}</div>
      {!show || answered !== null ? (
        <>
          <p className="listen-how">{L(S.howMany, lang)}</p>
          <div className="row center wrap">
            {q.choices.map((c) => (
              <button key={c} className={`chip big-num${answered !== null ? (c === q.n ? " on" : "") : ""}`} disabled={answered !== null} onClick={() => pick(c)}>{c}</button>
            ))}
          </div>
        </>
      ) : <p className="muted">👀</p>}
    </>
  );
}
