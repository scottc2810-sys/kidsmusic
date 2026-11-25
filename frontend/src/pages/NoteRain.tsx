// Note Rain 🌧️: coloured notes fall towards the piano; press each key when its note touches the line.
// Wait mode (default up to age 6) stops the music at every note until the right key is pressed: no rush, and
// after wrong keys Melo says which way to go and WHY (higher sounds live to the right). Play-along mode keeps
// the beat going. Four speeds, 3 stars per song, worlds that open with stars, a real USB/Bluetooth keyboard,
// the computer keys or the screen. Results go to the learning graph.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, type CatalogSong, type Child, type NoteRainBest, type SongCard } from "../api";
import { midiStatus, onMidiStatus, startMidi, type MidiStatus } from "../audio/midi";
import { primeSpeech, speak, stopSpeaking } from "../audio/speech";
import { playSequence, playSfx, unlockAudio } from "../audio/synth";
import { Melo, type MeloMood } from "../components/Melo";
import { KEY_COLORS, Piano, rangeFor } from "../components/Piano";
import { L, noteLabel, type Text } from "../i18n";
import {
  accuracyOf, bpmFor, buildChart, directionHint, hitWindow, judge, makeWorlds, SPEEDS, starsFor, worldOpen,
  type RainMode, type Speed,
} from "../teaching/noterain";
import { KidShell, useChild } from "./KidHome";

const S = {
  title: { en: "Note rain", hi: "सुरों की बारिश", hinglish: "Suron ki baarish" },
  pick: { en: "Pick a song. The notes fall like rain: press each key when its note touches the line!", hi: "एक गाना चुनो। सुर बारिश की तरह गिरते हैं: जब सुर लाइन को छुए, वही कुंजी दबाओ!", hinglish: "Ek gaana chuno. Sur baarish ki tarah girte hain: jab sur line ko chhuye, wahi kunji dabaao!" },
  locked: { en: "Collect {n} ⭐ in the world before to open this one", hi: "इसे खोलने के लिए पिछली दुनिया में {n} ⭐ जमा करो", hinglish: "Ise kholne ke liye pichhli duniya mein {n} ⭐ jama karo" },
  planLocked: { en: "This song is in the family plan. Ask a grown-up!", hi: "यह गाना फ़ैमिली प्लान में है। किसी बड़े से पूछो!", hinglish: "Yeh gaana family plan mein hai. Kisi bade se poochho!" },
  wait: { en: "Notes wait for me", hi: "सुर मेरा इंतज़ार करें", hinglish: "Sur mera intezaar karein" },
  play: { en: "Play along", hi: "साथ-साथ बजाओ", hinglish: "Saath-saath bajaao" },
  waitWhy: { en: "Take your time: the music waits for the right key.", hi: "आराम से: सही कुंजी तक संगीत रुका रहेगा।", hinglish: "Aaraam se: sahi kunji tak sangeet ruka rahega." },
  playWhy: { en: "The music keeps going, like playing with a band. Catch each note on the line!", hi: "संगीत चलता रहता है, जैसे बैंड के साथ बजाना। हर सुर को लाइन पर पकड़ो!", hinglish: "Sangeet chalta rehta hai, jaise band ke saath bajaana. Har sur ko line par pakdo!" },
  start: { en: "Start", hi: "शुरू", hinglish: "Shuru" },
  listen: { en: "Listen first", hi: "पहले सुनो", hinglish: "Pehle suno" },
  ready: { en: "Ready? Watch the notes fall and press each key when its note touches the line.", hi: "तैयार? सुरों को गिरते देखो और जब सुर लाइन को छुए, वह कुंजी दबाओ।", hinglish: "Taiyaar? Suron ko girte dekho aur jab sur line ko chhuye, woh kunji dabaao." },
  higher: { en: "Go higher: to the RIGHT! Higher sounds live on the right side of the piano.", hi: "ऊँचा: दाईं ओर जाओ! ऊँची आवाज़ें पियानो के दाईं तरफ़ रहती हैं।", hinglish: "Ooncha: daayein or jaao! Oonchi awaazein piano ke daayein taraf rehti hain." },
  lower: { en: "Go lower: to the LEFT! Lower, deeper sounds live on the left side.", hi: "नीचा: बाईं ओर जाओ! नीची, गहरी आवाज़ें बाईं तरफ़ रहती हैं।", hinglish: "Neecha: baayein or jaao! Neechi, gehri awaazein baayein taraf rehti hain." },
  glowing: { en: "Look for the glowing key: that's {note}.", hi: "चमकती कुंजी देखो: वह {note} है।", hinglish: "Chamakti kunji dekho: woh {note} hai." },
  perfect: { en: "Perfect!", hi: "एकदम सही!", hinglish: "Ekdam sahi!" },
  good: { en: "Good!", hi: "अच्छा!", hinglish: "Achha!" },
  miss: { en: "Missed", hi: "छूट गया", hinglish: "Chhoot gaya" },
  done3: { en: "Three stars! You're a music star!", hi: "तीन सितारे! तुम संगीत के सितारे हो!", hinglish: "Teen sitaare! Tum sangeet ke sitaare ho!" },
  done2: { en: "Two stars! A little more practice and you'll get three.", hi: "दो सितारे! थोड़ा और अभ्यास, और तीन मिलेंगे।", hinglish: "Do sitaare! Thoda aur abhyaas, aur teen milenge." },
  done1: { en: "One star! Every time you play, your fingers learn more.", hi: "एक सितारा! हर बार बजाने से उँगलियाँ और सीखती हैं।", hinglish: "Ek sitaara! Har baar bajaane se ungliyaan aur seekhti hain." },
  done0: { en: "Good try! Let's try the turtle speed: slow is how musicians learn.", hi: "अच्छी कोशिश! कछुए की चाल से करते हैं: संगीतकार धीरे-धीरे ही सीखते हैं।", hinglish: "Achhi koshish! Kachhue ki chaal se karte hain: sangeetkaar dheere-dheere hi seekhte hain." },
  faster: { en: "Try it faster", hi: "और तेज़ बजाओ", hinglish: "Aur tez bajaao" },
  again: { en: "Play again", hi: "फिर से बजाओ", hinglish: "Phir se bajaao" },
  nextSong: { en: "Next song", hi: "अगला गाना", hinglish: "Agla gaana" },
  songs: { en: "All songs", hi: "सारे गाने", hinglish: "Saare gaane" },
  newBest: { en: "New best!", hi: "नया रिकॉर्ड!", hinglish: "Naya record!" },
  streak: { en: "in a row", hi: "लगातार", hinglish: "lagaataar" },
  keyboard: { en: "Use my keyboard (USB)", hi: "मेरा कीबोर्ड (USB) इस्तेमाल करो", hinglish: "Mera keyboard (USB) use karo" },
  kbOn: { en: "Keyboard connected", hi: "कीबोर्ड जुड़ गया", hinglish: "Keyboard jud gaya" },
  kbWaiting: { en: "Plug in the keyboard's USB cable", hi: "कीबोर्ड की USB केबल लगाओ", hinglish: "Keyboard ki USB cable lagaao" },
  kbNo: { en: "This browser can't hear USB keyboards: use Chrome or Edge, or the microphone in Songs", hi: "यह ब्राउज़र USB कीबोर्ड नहीं सुन सकता: Chrome या Edge इस्तेमाल करें", hinglish: "Yeh browser USB keyboard nahi sun sakta: Chrome ya Edge use karein" },
  home: { en: "Home", hi: "घर", hinglish: "Ghar" },
} satisfies Record<string, Text>;

const PX_PER_BEAT = 90;
const LEAD_IN = 3; // beats before the first note reaches the line

function useNoteRainData(childId: string) {
  const [cards, setCards] = useState<SongCard[] | null>(null);
  const [catalog, setCatalog] = useState<Record<string, CatalogSong> | null>(null);
  const [best, setBest] = useState<Record<string, NoteRainBest>>({});
  useEffect(() => {
    api.songs(childId).then(setCards).catch(() => setCards([]));
    api.catalog().then((c) => setCatalog(c.songs)).catch(() => setCatalog({}));
    api.noteRain(childId).then((r) => setBest(r.songs)).catch(() => {});
  }, [childId]);
  return { cards, catalog, best, setBest };
}

function MidiButton({ lang }: { lang: Child["language"] }) {
  const [st, setSt] = useState<MidiStatus>(midiStatus());
  useEffect(() => onMidiStatus((s) => setSt(s)), []);
  if (st === "unsupported") return <span className="muted small">🎹 {L(S.kbNo, lang)}</span>;
  if (st === "connected") return <span className="tip-badge real">🎹 {L(S.kbOn, lang)}</span>;
  return (
    <button className="btn ghost small" onClick={() => void startMidi().then(setSt)}>
      🎹 {st === "waiting" ? L(S.kbWaiting, lang) : L(S.keyboard, lang)}
    </button>
  );
}

const Stars = ({ n, of = 3 }: { n: number; of?: number }) => (
  <span className="rain-stars" aria-label={`${n} of ${of} stars`}>{Array.from({ length: of }, (_, i) => (i < n ? "⭐" : "☆")).join("")}</span>
);

export function NoteRainList() {
  const { id = "" } = useParams();
  const { child, error } = useChild(id);
  const nav = useNavigate();
  const { cards, catalog, best } = useNoteRainData(id);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { if (child) void speak(L(S.pick, child.language), child.language); }, [child]);
  if (error) return <div className="center-screen"><p className="error">{error}</p></div>;
  if (!child || !cards || !catalog) return <div className="center-screen"><div className="spinner" /></div>;
  const lang = child.language;
  const playable = cards.filter((c) => catalog[c.id]);
  const worlds = makeWorlds(playable, (sid) => catalog[sid]?.notes.length ?? 99);
  const stars = (sid: string) => best[sid]?.stars ?? 0;
  const byId = Object.fromEntries(playable.map((c) => [c.id, c]));
  return (
    <KidShell child={child} music="play">
      <div className="lesson note-rain-list">
        <h1>🌧️ {L(S.title, lang)}</h1>
        <Melo mood="happy" size={90} say={L(S.pick, lang)} />
        <MidiButton lang={lang} />
        {msg && <p className="card notice" role="status">{msg}</p>}
        {worlds.map((w, wi) => {
          const open = worldOpen(worlds, wi, stars);
          const got = w.songs.reduce((s, x) => s + stars(x), 0);
          return (
            <section key={w.id} className={`rain-world world-${w.id}${open ? "" : " closed"}`}>
              <h2>{w.icon} {L(w.title, lang)} <small className="muted">⭐ {got}/{w.songs.length * 3}</small></h2>
              {!open && <p className="small">🔒 {L(S.locked, lang).replace("{n}", String(w.needs))}</p>}
              <div className="rain-songs">
                {w.songs.map((sid) => {
                  const c = byId[sid];
                  const locked = !open || c?.locked;
                  return (
                    <button key={sid} className={`rain-song${locked ? " locked" : ""}`} onClick={async () => {
                      if (c?.locked) { const m = L(S.planLocked, lang); setMsg(`🔒 ${m}`); void speak(m, lang); return; }
                      if (!open) { const m = L(S.locked, lang).replace("{n}", String(w.needs)); setMsg(`🔒 ${m}`); void speak(m, lang); return; }
                      primeSpeech(); await unlockAudio(); playSfx("pop"); nav(`/play/${id}/note-rain/${sid}`);
                    }}>
                      <span className="rain-song-title">{locked ? "🔒 " : ""}{catalog[sid].title}</span>
                      <Stars n={stars(sid)} />
                      {best[sid]?.fastest && <small className="muted">{SPEEDS.find((s) => s.id === best[sid].fastest)?.icon}</small>}
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
        <button className="btn ghost" onClick={() => nav(`/play/${id}`)}>🏠 {L(S.home, lang)}</button>
      </div>
    </KidShell>
  );
}

export function NoteRain() {
  const { id = "", songId = "" } = useParams();
  const { child, error } = useChild(id);
  const { cards, catalog, best, setBest } = useNoteRainData(id);
  if (error) return <div className="center-screen"><p className="error">{error}</p></div>;
  if (!child || !catalog || !cards) return <div className="center-screen"><div className="spinner" /></div>;
  const song = catalog[songId];
  if (!song || cards.find((c) => c.id === songId)?.locked) return <div className="center-screen"><p className="error">{L(S.planLocked, child.language)}</p></div>;
  return <Game key={songId} child={child} songId={songId} song={song} cards={cards} catalog={catalog} best={best[songId]}
    onBest={(b) => setBest((all) => ({ ...all, [songId]: b }))} />;
}

type Pop = { id: number; text: string; kind: "perfect" | "good" | "miss"; midi: number };

function Game({ child, songId, song, cards, catalog, best, onBest }: {
  child: Child; songId: string; song: CatalogSong; cards: SongCard[]; catalog: Record<string, CatalogSong>;
  best?: NoteRainBest; onBest: (b: NoteRainBest) => void;
}) {
  const lang = child.language;
  const nav = useNavigate();
  const chart = useMemo(() => buildChart(song.notes), [song.notes]);
  const [from, to] = useMemo(() => rangeFor(chart.map((n) => n.midi)), [chart]);
  const [mode, setMode] = useState<RainMode>(child.age <= 6 ? "wait" : "play");
  const [speed, setSpeed] = useState<Speed>(child.age <= 5 ? "turtle" : "normal");
  const [phase, setPhase] = useState<"setup" | "playing" | "done">("setup");
  const [now, setNow] = useState(-LEAD_IN);
  const [glow, setGlow] = useState<number | null>(null);
  const [lit, setLit] = useState<number | null>(null);
  const [pops, setPops] = useState<Pop[]>([]);
  const [streak, setStreak] = useState(0);
  const [result, setResult] = useState<{ stars: number; accuracy: number; newBest: boolean } | null>(null);
  const [melo, setMelo] = useState<MeloMood>("happy");
  const st = useRef({ now: -LEAD_IN, next: 0, hits: 0, wrong: 0, wrongHere: 0, judged: new Set<number>(), last: 0, raf: 0 });
  const bpm = bpmFor(song.bpm, speed);
  const window_ = hitWindow(child.age);
  const total = chart.length;
  const lastStart = chart.length ? chart[chart.length - 1].start : 0;

  const pop = (text: string, kind: Pop["kind"], midi: number) => {
    const p = { id: Math.random(), text, kind, midi };
    setPops((ps) => [...ps.slice(-4), p]);
    window.setTimeout(() => setPops((ps) => ps.filter((x) => x.id !== p.id)), 700);
  };

  const finish = useCallback(() => {
    const s = st.current;
    cancelAnimationFrame(s.raf);
    setPhase("done");
    setGlow(null);
    const acc = accuracyOf(mode, s.hits, total, s.wrong);
    const stars = starsFor(acc);
    setResult({ stars, accuracy: acc, newBest: false });
    setMelo(stars >= 2 ? "cheer" : "encourage");
    playSfx(stars >= 2 ? "tada" : "clap");
    void speak(L(stars === 3 ? S.done3 : stars === 2 ? S.done2 : stars === 1 ? S.done1 : S.done0, lang), lang);
    api.noteRainResult(child.id, { song_id: songId, hits: s.hits, total, wrong: s.wrong, mode, speed })
      .then((r) => {
        setResult({ stars: r.stars, accuracy: r.accuracy, newBest: r.new_best });
        onBest({ stars: r.best, best_accuracy: Math.max(best?.best_accuracy ?? 0, r.accuracy), plays: (best?.plays ?? 0) + 1,
          fastest: r.stars >= 2 && SPEEDS.findIndex((x) => x.id === speed) > SPEEDS.findIndex((x) => x.id === best?.fastest) ? speed : best?.fastest ?? null });
      })
      .catch(() => {});
  }, [mode, total, speed, songId, child.id, lang, best, onBest]);

  // the game clock: beats advance with the tempo; in wait mode the clock stops at the next note
  const loop = useCallback((t: number) => {
    const s = st.current;
    const dt = s.last ? Math.min(0.1, (t - s.last) / 1000) : 0;
    s.last = t;
    let n = s.now + (dt * bpm) / 60;
    if (mode === "wait") {
      const target = chart[s.next];
      if (target && n >= target.start) n = target.start; // the music waits for the child
      setGlow(target && target.start - n <= 1 ? target.midi : null);
      if (!target && n > lastStart + 1) { s.now = n; setNow(n); finish(); return; } // a beat after the last note: no empty wait
    } else {
      // notes that went past the line without being caught
      chart.forEach((c, i) => {
        if (!s.judged.has(i) && n - c.start > window_) { s.judged.add(i); setStreak(0); pop(L(S.miss, lang), "miss", c.midi); }
      });
      const upcoming = chart.find((c, i) => !s.judged.has(i) && c.start - n < 1);
      setGlow(child.age <= 7 && upcoming ? upcoming.midi : null);
      if (n > lastStart + window_ + 0.5) { s.now = n; setNow(n); finish(); return; }
    }
    s.now = n;
    setNow(n);
    s.raf = requestAnimationFrame(loop);
  }, [bpm, mode, chart, lastStart, window_, finish, lang, child.age]);

  const start = async () => {
    await unlockAudio();
    stopSpeaking();
    playSfx("pop");
    st.current = { now: -LEAD_IN, next: 0, hits: 0, wrong: 0, wrongHere: 0, judged: new Set(), last: 0, raf: 0 };
    setNow(-LEAD_IN); setResult(null); setStreak(0); setPops([]); setMelo("listening");
    setPhase("playing");
    void speak(L(mode === "wait" ? S.waitWhy : S.playWhy, lang), lang);
    st.current.raf = requestAnimationFrame(loop);
  };
  useEffect(() => () => cancelAnimationFrame(st.current.raf), []);

  const demo = useRef<{ cancel: () => void } | null>(null);
  const listen = async () => {
    await unlockAudio();
    demo.current?.cancel();
    const seq = playSequence(chart.map((c) => ({ midi: c.midi, beats: c.beats })), bpm, (i) => setLit(chart[i]?.midi ?? null));
    demo.current = seq;
    await seq.done;
    setLit(null);
  };
  useEffect(() => () => demo.current?.cancel(), []);

  const onKey = (m: number) => {
    if (phase !== "playing") return;
    const s = st.current;
    if (mode === "wait") {
      const target = chart[s.next];
      if (!target) return;
      if (m === target.midi && target.start - s.now <= 1.01) {
        s.hits++; s.next++; s.wrongHere = 0;
        setStreak((k) => k + 1);
        pop(L(S.perfect, lang), "perfect", m);
        setMelo("happy");
      } else if (target.start - s.now <= 1.01) {
        s.wrong++; s.wrongHere++;
        setStreak(0);
        setMelo("encourage");
        if (s.wrongHere === 2 || s.wrongHere === 5) {
          const dir = directionHint(target.midi, m);
          const hint = dir === "same" ? L(S.glowing, lang).replace("{note}", noteLabel(target.midi, lang))
            : `${L(dir === "higher" ? S.higher : S.lower, lang)} ${L(S.glowing, lang).replace("{note}", noteLabel(target.midi, lang))}`;
          void speak(hint, lang);
        }
      }
      return;
    }
    // play-along: the closest note not caught yet, on this key, near the line
    let bestI = -1, bestD = Infinity;
    chart.forEach((c, i) => {
      if (s.judged.has(i) || c.midi !== m) return;
      const d = Math.abs(c.start - s.now);
      if (d < bestD) { bestD = d; bestI = i; }
    });
    const j = bestI >= 0 ? judge(chart[bestI].start - s.now, window_) : null;
    if (j) {
      s.judged.add(bestI); s.hits++;
      setStreak((k) => k + 1);
      pop(L(j === "perfect" ? S.perfect : S.good, lang), j, m);
    } else {
      s.wrong++;
    }
  };

  // horizontal place of a key, like the piano below (white keys share the width; black keys sit between)
  const whites = useMemo(() => Array.from({ length: to - from + 1 }, (_, i) => from + i).filter((k) => ![1, 3, 6, 8, 10].includes(k % 12)), [from, to]);
  const lane = (m: number) => {
    const w = 100 / whites.length;
    const black = [1, 3, 6, 8, 10].includes(m % 12);
    if (!black) return { left: whites.indexOf(m) * w + w * 0.1, width: w * 0.8 };
    return { left: whites.filter((x) => x < m).length * w - w * 0.3, width: w * 0.6 };
  };

  const visible = chart.map((c, i) => ({ c, i })).filter(({ c }) => c.start + c.beats > now - 1 && c.start < now + 6);
  const caught = (i: number) => (mode === "wait" ? i < st.current.next : st.current.judged.has(i));
  const idx = cards.findIndex((c) => c.id === songId);
  const nextSong = cards.slice(idx + 1).find((c) => catalog[c.id] && !c.locked);
  const speedIdx = SPEEDS.findIndex((s) => s.id === speed);

  return (
    <KidShell child={child}>
      <div className="lesson note-rain">
        <div className="row center wrap rain-head">
          <h1>🌧️ {song.title}</h1>
          {best && <Stars n={best.stars} />}
        </div>

        {phase === "setup" && (
          <div className="card rain-setup">
            <Melo mood="happy" size={80} say={L(S.ready, lang)} />
            <div className="row center wrap" role="radiogroup" aria-label="mode">
              {(["wait", "play"] as RainMode[]).map((m) => (
                <button key={m} role="radio" aria-checked={mode === m} className={`chip${mode === m ? " on" : ""}`} onClick={() => { setMode(m); void speak(L(m === "wait" ? S.waitWhy : S.playWhy, lang), lang); }}>
                  {m === "wait" ? "⏸️" : "▶️"} {L(m === "wait" ? S.wait : S.play, lang)}
                </button>
              ))}
            </div>
            <div className="row center wrap" role="radiogroup" aria-label="speed">
              {SPEEDS.map((s) => (
                <button key={s.id} role="radio" aria-checked={speed === s.id} className={`chip speed${speed === s.id ? " on" : ""}`} onClick={() => setSpeed(s.id)} aria-label={s.id}>
                  {s.icon}
                </button>
              ))}
            </div>
            <MidiButton lang={lang} />
            <div className="row center wrap">
              <button className="btn ghost big" onClick={() => void listen()}>👂 {L(S.listen, lang)}</button>
              <button className="btn primary big" onClick={() => void start()}>▶ {L(S.start, lang)}</button>
            </div>
          </div>
        )}

        {phase !== "setup" && (
          <div className="rain-stage">
            <div className="rain-hud">
              <Melo mood={melo} size={50} />
              {streak >= 3 && <span className="rain-streak">🔥 {streak} {L(S.streak, lang)}</span>}
              <span className="muted small">{SPEEDS[speedIdx].icon} {Math.min(mode === "wait" ? st.current.next : st.current.judged.size, total)}/{total}</span>
            </div>
            <div className="rain-highway" style={{ ["--ppb" as string]: `${PX_PER_BEAT}px` }} aria-hidden>
              {whites.map((w, i) => <i key={w} className="rain-lane" style={{ left: `${(i * 100) / whites.length}%`, width: `${100 / whites.length}%` }} />)}
              {visible.map(({ c, i }) => {
                const { left, width } = lane(c.midi);
                const bottom = (c.start - now) * PX_PER_BEAT;
                const h = Math.max(26, c.beats * PX_PER_BEAT - 6);
                return (
                  <div key={i} className={`rain-note${caught(i) ? " caught" : ""}${glow === c.midi && !caught(i) && Math.abs(c.start - now) < 1.05 ? " next" : ""}`}
                    style={{ left: `${left}%`, width: `${width}%`, height: h, transform: `translateY(${-bottom}px)`, ["--c" as string]: KEY_COLORS[c.midi % 12] }}>
                    <span>{noteLabel(c.midi, lang)}</span>
                  </div>
                );
              })}
              {pops.map((p) => {
                const { left, width } = lane(p.midi);
                return <span key={p.id} className={`rain-pop ${p.kind}`} style={{ left: `${left + width / 2}%` }}>{p.text}</span>;
              })}
              <div className="rain-line" />
            </div>
            <Piano from={from} to={to} lang={lang} onPlay={onKey} glow={glow} lit={lit} disabled={phase === "done"} />
          </div>
        )}

        {phase === "done" && result && (
          <div className="card rain-result" role="status">
            <div className="rain-big-stars"><Stars n={result.stars} /></div>
            {result.newBest && <p className="tip-badge real">🏆 {L(S.newBest, lang)}</p>}
            <p>{Math.round(result.accuracy * 100)}%</p>
            <div className="row center wrap">
              <button className="btn primary big" onClick={() => void start()}>🔁 {L(S.again, lang)}</button>
              {result.stars === 3 && speedIdx < SPEEDS.length - 1 && (
                <button className="btn big" onClick={() => { setSpeed(SPEEDS[speedIdx + 1].id); setPhase("setup"); }}>{SPEEDS[speedIdx + 1].icon} {L(S.faster, lang)}</button>
              )}
              {nextSong && <button className="btn big" onClick={() => nav(`/play/${child.id}/note-rain/${nextSong.id}`)}>⏭️ {L(S.nextSong, lang)}</button>}
              <button className="btn ghost" onClick={() => nav(`/play/${child.id}/note-rain`)}>🌧️ {L(S.songs, lang)}</button>
            </div>
          </div>
        )}
      </div>
    </KidShell>
  );
}
