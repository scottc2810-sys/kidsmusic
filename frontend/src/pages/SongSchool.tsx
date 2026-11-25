// Song school: pick a tune (Happy Birthday, Gayatri Mantra, Twinkle…) and learn it one part at a time.
// Listen → play the glowing keys → next part → the whole song. Works with the screen piano or,
// when the parent allowed the microphone in real-keyboard mode, a real keyboard.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, type Child, type NoteEvent, type Song, type SongCard, type SongTag, type SupportLevel } from "../api";
import { MicNoteInput } from "../audio/mic";
import { micErrorMessage } from "../audio/permissions";
import { isSpeaking, primeSpeech, speak, stopSpeaking } from "../audio/speech";
import { playNote, playSequence, sleep, unlockAudio } from "../audio/synth";
import { Melo, type MeloMood } from "../components/Melo";
import { ConceptCards } from "../components/ConceptCards";
import { ShlokaOfTheDay } from "../components/ShlokaCard";
import { InstrumentView } from "../components/InstrumentView";
import { NoteGuide } from "../components/NoteGuide";
import { rangeFor } from "../components/Piano";
import { DOS, explainPart, explainStep, stepSpeech, wrongKeyWhy, type StepWhy } from "../teaching/explain";
import { fitToInstrument, instrumentHello, isPads, STANDARD, type InstrumentInfo } from "../teaching/instrument";
import { L, sungName, t } from "../i18n";
import { useTeacher } from "../teaching/persona";
import { CameraObserver, HandStats, loadCalibration } from "../vision/camera";
import { KidShell, useChild } from "./KidHome";

const TAG_ICON: Record<SongTag, string> = { celebration: "🎂", indian: "🪔", nursery: "🧸", alankar: "🎼", claude: "✨" };
const pcEq = (a: number, b: number) => ((a - b) % 12 + 12) % 12 === 0;
const ORDER: SupportLevel[] = ["full", "guided", "light", "memory"];
const HELP_LABEL = { full: "helpFull", guided: "helpGuided", light: "helpLight", memory: "helpMemory" } as const;
const HELP_ICON: Record<SupportLevel, string> = { full: "🧭", guided: "👣", light: "🌱", memory: "🌟" };

const ASK_GROWN_UP = { en: "This song is in the family plan. Ask a grown-up!", hi: "यह गाना फ़ैमिली प्लान में है। किसी बड़े से पूछो!", hinglish: "Yeh gaana family plan mein hai. Kisi bade se poochho!" };

export function SongList() {
  const { id = "" } = useParams();
  const { child, error } = useChild(id);
  const [songs, setSongs] = useState<SongCard[] | null>(null);
  const [lockMsg, setLockMsg] = useState(false);
  const nav = useNavigate();
  useEffect(() => { api.songs(id).then(setSongs).catch(() => setSongs([])); }, [id]);
  useEffect(() => { if (child) void speak(t("pickSong", child.language), child.language); }, [child]);
  if (error) return <div className="center-screen"><p className="error">{error}</p></div>;
  if (!child || !songs) return <div className="center-screen"><div className="spinner" /></div>;
  const lang = child.language;
  return (
    <KidShell child={child} music="home">
      <div className="lesson song-school">
        <Melo mood="happy" size={120} say={t("pickSong", lang)} />
        <ShlokaOfTheDay subject="music" lang={lang} />
        {lockMsg && <p className="card notice" role="status">🔒 {L(ASK_GROWN_UP, lang)}</p>}
        <div className="song-grid">
          {songs.map((s) => {
            const learned = s.progress.completed;
            const open = async (listen: boolean) => {
              if (s.locked) { setLockMsg(true); void speak(L(ASK_GROWN_UP, lang), lang); return; }
              primeSpeech(); await unlockAudio(); nav(`/play/${id}/songs/${s.id}${listen ? "?listen=1" : ""}`);
            };
            return (
              <div key={s.id} className="song-card-wrap">
              <button className={`song-card tag-${s.tag}${learned ? " learned" : ""}${s.locked ? " locked" : ""}`} onClick={() => void open(false)}>
                <span className="song-icon" aria-hidden>{s.locked ? "🔒" : TAG_ICON[s.tag]}</span>
                <span className="song-title">{s.title}</span>
                <span className="song-dots" aria-label={`${s.progress.phrases_learned.length} of ${s.phrase_count} parts learned`}>
                  {Array.from({ length: s.phrase_count }, (_, i) => <i key={i} className={s.progress.phrases_learned.includes(i) ? "on" : ""} />)}
                </span>
                {learned && <span className="song-badge">⭐ {t("learned", lang)}</span>}
              </button>
              <button className="btn ghost small song-listen" onClick={() => void open(true)} aria-label={`${t("hearWhole", lang)}: ${s.title}`}>🎧 {t("hearWhole", lang)}</button>
              </div>
            );
          })}
        </div>
        <button className="btn ghost" onClick={() => nav(`/play/${id}`)}>🏠 {t("back", lang)}</button>
      </div>
    </KidShell>
  );
}

type Phase = "loading" | "concepts" | "listen" | "step" | "play" | "checking" | "done" | "error";
const conceptKey = (childId: string) => `melo.concepts.${childId}`;
const seenConcepts = (childId: string) => { try { return localStorage.getItem(conceptKey(childId)) === "1"; } catch { return true; } };

export function SongLesson() {
  const { id = "", songId = "" } = useParams();
  const [params] = useSearchParams();
  const { child, error } = useChild(id);
  if (error) return <div className="center-screen"><p className="error">{error}</p></div>;
  if (!child) return <div className="center-screen"><div className="spinner" /></div>;
  return <SongRunner child={child} songId={songId} listenFirst={params.get("listen") === "1"} />;
}

function SongRunner({ child, songId, listenFirst = false }: { child: Child; songId: string; listenFirst?: boolean }) {
  const lang = child.language;
  useTeacher(child.id, "music"); // the music teacher's persona and voice (parent's choice)
  const nav = useNavigate();
  const [song, setSong] = useState<Song | null>(null);
  const [sid, setSid] = useState<string | null>(null);
  const [part, setPart] = useState(0); // phrase index, -1 = whole song
  const [learned, setLearned] = useState<number[]>([]);
  const [phase, setPhase] = useState<Phase>("loading");
  const [mood, setMood] = useState<MeloMood>("happy");
  const [say, setSay] = useState("");
  const [lit, setLit] = useState<number | null>(null);
  const [wordAt, setWordAt] = useState<number | null>(null);
  const [pos, setPos] = useState(0);
  const [follow, setFollow] = useState(child.age >= 6); // younger children: Melo waits for each key
  // One by one: Melo explains WHY each key, the child presses it, then taps Next (default for the youngest).
  const [steps, setSteps] = useState(child.age <= 4);
  const stepsRef = useRef(steps);
  stepsRef.current = steps;
  const [stepIdx, setStepIdx] = useState(0);
  const [stepOk, setStepOk] = useState(false);
  const [why, setWhy] = useState<StepWhy | null>(null);
  const [showWhy, setShowWhy] = useState(false);
  const dosAt = useRef(0);
  const stepsExplained = useRef(false);
  const young = child.age <= 4;
  // The child's own instrument (the parent's photos / links); the standard screen piano otherwise.
  const [inst, setInst] = useState<InstrumentInfo>(STANDARD);
  const conceptsDone = useRef<(() => void) | null>(null);
  const [guideIdx, setGuideIdx] = useState<number | null>(null); // beat mode: the note to press right now
  const [count, setCount] = useState<string | null>(null); // big 3-2-1 count-in
  const [tempo, setTempo] = useState(84);
  const timers = useRef<number[]>([]);
  const explained = useRef({ wait: false, beat: false });
  const followRef = useRef(follow);
  followRef.current = follow;
  const [stars, setStars] = useState(0);
  const [misses, setMisses] = useState(0);
  const [problem, setProblem] = useState<string | null>(null);
  const notes = useRef<NoteEvent[]>([]);
  const t0 = useRef(performance.now());
  const mic = useRef<MicNoteInput | null>(null);
  const source = useRef<"screen" | "mic">("screen");
  const usedMic = useRef(false); // a real-instrument note was heard in this try
  const [ears, setEars] = useState(false);
  const [nudge, setNudge] = useState<"up" | "down" | null>(null); // live hint after a wrong key
  const cam = useRef<CameraObserver | null>(null);
  const hands = useRef(new HandStats());
  const videoRef = useRef<HTMLVideoElement>(null);
  // Spot practice: a few notes of the part on their own, after Melo noticed trouble there.
  const [drill, setDrill] = useState<{ a: number; b: number } | null>(null);
  const drillRef = useRef<{ a: number; b: number; reps: number; countedAt?: number } | null>(null);
  const alive = useRef(true);
  const ended = useRef(false);
  const sidRef = useRef<string | null>(null);
  const submitting = useRef(false);
  const [preview, setPreview] = useState(false); // Melo is playing the whole tune before/while teaching
  const [previewAt, setPreviewAt] = useState<number | null>(null);
  const previewCancel = useRef<(() => void) | null>(null);
  // How much help each part gets (from the server: fades with passes, returns after a miss).
  const [support, setSupport] = useState<Record<string, SupportLevel>>({});
  const supportRef = useRef(support);
  supportRef.current = support;
  const [boost, setBoost] = useState<Record<string, boolean>>({}); // child pressed "Help me" for this part
  const boostRef = useRef(boost);
  boostRef.current = boost;
  const levelOf = useCallback((p: number, slow = false): SupportLevel => {
    let lv = boostRef.current[String(p)] ? "full" : supportRef.current[String(p)] ?? "full";
    if (slow && ORDER.indexOf(lv) > 1) lv = "guided"; // after two misses Melo shows it again, slower
    return lv;
  }, []);

  const talk = useCallback(async (text: string, after: MeloMood = "listening") => {
    if (!alive.current) return;
    setSay(text); setMood("talking");
    await speak(text, lang);
    if (alive.current) setMood(after);
  }, [lang]);

  const bounds = useCallback((s: Song, p: number): [number, number] =>
    p === -1 ? [0, s.notes.length] : [p ? s.phrases[p - 1] : 0, s.phrases[p]], []);

  const target = useMemo(() => {
    if (!song) return [] as number[];
    if (drill) return song.notes.slice(drill.a, drill.b);
    const [lo, hi] = bounds(song, part);
    return song.notes.slice(lo, hi);
  }, [song, part, bounds, drill]);

  // Play the whole tune once (keys and every word light up) so the child knows how it should sound.
  // Resolves true when it played to the end, false when stopped.
  const hearWhole = useCallback(async (s: Song): Promise<boolean> => {
    clearTimers();
    previewCancel.current?.();
    setPhase("listen"); setPreview(true); setPreviewAt(null); setTempo(s.bpm);
    let stopped = false;
    await talk(t("wholeFirst", lang), "listening");
    if (!alive.current) return false;
    const seq = s.notes.map((m, i) => ({ midi: m, beats: s.beats[i], sing: sungName(m, lang) }));
    const h = playSequence(seq, s.bpm, (i) => { setLit(i >= 0 ? seq[i].midi : null); setPreviewAt(i >= 0 ? i : null); });
    previewCancel.current = () => { stopped = true; h.cancel(); };
    setMood("happy");
    await h.done;
    previewCancel.current = null;
    setLit(null); setPreviewAt(null); setPreview(false);
    return !stopped;
  }, [lang, talk]); // eslint-disable-line react-hooks/exhaustive-deps

  // Listen to the part (keys and words light up), then it's the child's turn.
  const listen = useCallback(async (s: Song, p: number, slow = false, noSteps = false) => {
    if (!alive.current) return;
    clearTimers();
    drillRef.current = null; setDrill(null);
    setPhase("listen"); setPos(0); setGuideIdx(null); notes.current = [];
    const [lo, hi] = bounds(s, p);
    const bpm = slow ? Math.round(s.bpm * 0.75) : s.bpm;
    setTempo(bpm);
    const lv = levelOf(p, slow);
    if (p === -1) {
      await talk(t(lv === "memory" ? "wholeFromMemory" : "wholeSongIntro", lang), "listening");
    } else if (lv === "light" || lv === "memory") {
      // The child knows this part: no automatic demo. "Hear it" / "Help me" bring help back.
      await talk(t(lv === "memory" ? "fromMemory" : "remember", lang), "listening");
    } else if (stepsRef.current && !noSteps) {
      await startSteps(s, p);
      return;
    } else {
      if (lv === "full" && !noSteps) await talk(explainPart(partsOf(s), p, lang), "listening"); // the idea of the part before its notes
      if (!alive.current) return;
      await talk(`${t("listen", lang)} ${t("part", lang)} ${p + 1}`, "listening");
      const seq = s.notes.slice(lo, hi).map((m, i) => ({ midi: m, beats: s.beats[lo + i], sing: sungName(m, lang) }));
      await playSequence(seq, bpm, (i) => {
        setLit(i >= 0 ? seq[i].midi : null);
        setWordAt(i >= 0 ? lo + i : null);
      }).done;
      setLit(null); setWordAt(null);
      if (!alive.current) return;
      await talk(t("yourTurn", lang), "listening");
    }
    // Explain how to follow the note path, once per way of playing.
    const beat = followRef.current;
    if (lv === "full" && !explained.current[beat ? "beat" : "wait"]) { // only explain while it's new
      explained.current[beat ? "beat" : "wait"] = true;
      await talk(t(beat ? "howToBeat" : "howToPlay", lang), "listening");
    }
    if (!alive.current) return;
    notes.current = []; setPos(0);
    if (beat) await countIn(bpm);
    if (!alive.current) return;
    t0.current = performance.now(); usedMic.current = false; hands.current.reset();
    setPhase("play");
    if (beat) runGuide(s.beats.slice(lo, hi), bpm);
  }, [bounds, lang, talk, levelOf]); // eslint-disable-line react-hooks/exhaustive-deps

  const partsOf = (s: Song) => s.phrases.map((_, i) => { const [a, b] = bounds(s, i); return s.notes.slice(a, b); });

  /** One note of the part: why this key (and how long), Melo plays it, the key glows; the child presses it. */
  const goStep = useCallback(async (s: Song, p: number, i: number) => {
    if (!alive.current) return;
    const [lo, hi] = bounds(s, p);
    const w = explainStep(s.notes.slice(lo, hi), s.beats.slice(lo, hi), i, lang, inst,
      { words: s.words?.slice(lo, hi) ?? null, songEnd: hi === s.notes.length, home: s.notes[0] });
    setWhy(w); setStepIdx(i); setStepOk(false); setNudge(null); setPhase("step"); setWordAt(lo + i);
    await talk(stepSpeech(w, young), "listening");
    if (!alive.current) return;
    const m = s.notes[lo + i];
    await playSequence([{ midi: m, beats: s.beats[lo + i], sing: sungName(m, lang) }], Math.round(s.bpm * 0.7), (k) => setLit(k >= 0 ? m : null)).done;
    setLit(null);
    if (alive.current) { setSay(t("stepPress", lang)); setMood("listening"); }
  }, [bounds, lang, inst, talk, young]);

  const startSteps = useCallback(async (s: Song, p: number) => {
    clearTimers(); setGuideIdx(null); setPhase("step"); setPos(0); notes.current = [];
    await talk(explainPart(partsOf(s), p, lang), "listening");
    if (!alive.current) return;
    if (!stepsExplained.current) { // the first time: how one-by-one works, and one real teacher's tip
      stepsExplained.current = true;
      await talk(t("stepIntro", lang), "listening");
      if (!alive.current) return;
      await talk(L(DOS[dosAt.current++ % DOS.length], lang), "listening");
    }
    await goStep(s, p, 0);
  }, [goStep, lang, talk]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Next: the next note, or, after the last one, all of them together, slowly. */
  const nextStep = useCallback(async () => {
    if (!song) return;
    const [lo, hi] = bounds(song, part);
    if (stepIdx + 1 < hi - lo) { await goStep(song, part, stepIdx + 1); return; }
    setWhy(null); setWordAt(null);
    await talk(t("stepTogether", lang), "listening");
    await listen(song, part, true, true);
  }, [song, part, stepIdx, bounds, goStep, talk, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  /** "Why?" for the note the child is on (any mode). */
  const sayWhy = useCallback(() => {
    if (!song) return;
    const [lo, hi] = drill ? [drill.a, drill.b] : bounds(song, part);
    const i = phase === "step" ? stepIdx : Math.min(pos, hi - lo - 1);
    const w = explainStep(song.notes.slice(lo, hi), song.beats.slice(lo, hi), i, lang, inst,
      { words: song.words?.slice(lo, hi) ?? null, songEnd: hi === song.notes.length, home: song.notes[0] });
    setWhy(w); setShowWhy(true);
    void talk([w.text, w.where, w.length, w.word, w.ending].filter(Boolean).join(" "), "listening");
  }, [song, drill, bounds, part, phase, stepIdx, pos, lang, inst, talk]);

  // Spot practice, as a teacher would: take only the notes that caused trouble, play them slowly,
  // let the child get them right twice, then go back to the whole part.
  const runDrill = useCallback(async (s: Song, p: number, d: { start: number; end: number; say: string }) => {
    if (!alive.current) return;
    clearTimers();
    const [lo] = bounds(s, p);
    const a = lo + d.start, b = lo + d.end + 1;
    drillRef.current = { a, b, reps: 0 }; setDrill({ a, b });
    setPhase("listen"); setPos(0); setGuideIdx(null); notes.current = [];
    await talk(d.say, "listening");
    const bpm = Math.round(s.bpm * 0.7);
    setTempo(bpm);
    const seq = s.notes.slice(a, b).map((m, i) => ({ midi: m, beats: s.beats[a + i], sing: sungName(m, lang) }));
    await playSequence(seq, bpm, (i) => { setLit(i >= 0 ? seq[i].midi : null); setWordAt(i >= 0 ? a + i : null); }).done;
    setLit(null); setWordAt(null);
    if (!alive.current) return;
    await talk(t("yourTurn", lang), "listening");
    t0.current = performance.now();
    setPhase("play");
  }, [bounds, lang, talk]); // eslint-disable-line react-hooks/exhaustive-deps

  function clearTimers() { timers.current.forEach(clearTimeout); timers.current = []; }

  // "3, 2, 1, Go!" with a tick on each beat, so the child feels the speed before playing.
  async function countIn(bpm: number) {
    const gap = 60000 / bpm;
    for (const n of ["3", "2", "1"]) {
      if (!alive.current) return;
      setCount(n);
      playNote(n === "1" ? 84 : 79, { timbre: "bell", gain: 0.35, duration: 0.15 });
      await sleep(gap);
    }
    setCount(t("go", lang));
    window.setTimeout(() => setCount(null), 500);
  }

  // Beat mode: the light walks through the notes at the song's tempo, with a soft tick per note.
  function runGuide(beats: number[], bpm: number) {
    const beatMs = 60000 / bpm;
    let at = 0;
    beats.forEach((b, i) => {
      timers.current.push(window.setTimeout(() => {
        setGuideIdx(i);
        playNote(96, { timbre: "bell", gain: 0.12, duration: 0.05 });
      }, at));
      at += b * beatMs;
    });
    timers.current.push(window.setTimeout(() => setGuideIdx(null), at));
    timers.current.push(window.setTimeout(() => void submitRef.current(), at + 1500)); // a moment to finish
  }

  // start: open a song-school session and begin with the first part not yet learned
  useEffect(() => {
    alive.current = true;
    (async () => {
      try {
        await unlockAudio();
        // Melo listens to a real keyboard whenever the parent allowed the microphone (the screen keys still work).
        if (child.consent_microphone) {
          try {
            const m = new MicNoteInput(); await m.start(); mic.current = m; setEars(true);
            if (child.mode === "real") source.current = "mic";
          } catch (e) { if (child.mode === "real") setProblem(`${micErrorMessage(e).message} Using the screen piano for now.`); }
        }
        if (mic.current && child.mode === "real" && child.consent_camera && videoRef.current) {
          const c = new CameraObserver(videoRef.current, loadCalibration(child.id));
          c.start().then(() => { cam.current = c; c.onObservation((o) => hands.current.add(o)); }).catch(() => { /* camera is optional */ });
        }
        const myInst = await api.instrument(child.id).catch(() => STANDARD);
        if (!alive.current) return;
        setInst(myInst);
        const r = await api.startSong(child.id, songId);
        if (!alive.current) return;
        // the same tune, moved into the notes the child's own instrument has (octaves only, unless it is too wide)
        r.song = { ...r.song, notes: fitToInstrument(r.song.notes, myInst).notes };
        sidRef.current = r.session_id;
        setSid(r.session_id); setSong(r.song); setLearned(r.progress.phrases_learned);
        setSupport(r.support); supportRef.current = r.support;
        const first = r.start_phrase;
        setPart(first);
        await talk(r.say, "happy");
        const hello = instrumentHello(myInst, lang);
        if (hello && alive.current) await talk(hello, "happy");
        if (r.song.note && r.song.source && r.song.source !== "library") await talk(r.song.note, "happy"); // what is new in an exercise made for the child
        const isNew = r.progress.plays === 0 && r.progress.phrases_learned.length === 0;
        if (!seenConcepts(child.id) && alive.current) { // the very first song: how music is made, before any keys
          setPhase("concepts");
          await new Promise<void>((res) => { conceptsDone.current = res; });
          try { localStorage.setItem(conceptKey(child.id), "1"); } catch { /* private mode */ }
          if (!alive.current) return;
        }
        if (isNew || listenFirst) {
          const heard = await hearWhole(r.song);
          if (!alive.current || !heard) return;
          await talk(t("nowParts", lang), "listening");
        }
        await listen(r.song, first);
      } catch (e) { setProblem((e as Error).message); setPhase("error"); }
    })();
    return () => {
      alive.current = false;
      previewCancel.current?.();
      clearTimers();
      stopSpeaking();
      mic.current?.stop();
      cam.current?.stop();
      if (sidRef.current && !ended.current) void api.endSession(sidRef.current).catch(() => {});
    };
  }, [child, songId]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = useCallback(async () => {
    if (!sid || !song || phase !== "play" || submitting.current || drillRef.current) return;
    submitting.current = true;
    clearTimers(); setGuideIdx(null); setNudge(null);
    setPhase("checking"); setMood("thinking");
    try {
      const r = await api.songPhrase(sid, part, {
        source: usedMic.current ? "mic" : source.current, notes: notes.current.slice(0, 400), keep_beat: followRef.current,
        camera: cam.current ? hands.current.summary() : null,
      });
      setStars(r.stars);
      setSupport(r.support); supportRef.current = r.support;
      if (r.passed) { const nb = { ...boostRef.current, [String(part)]: false }; setBoost(nb); boostRef.current = nb; }
      setMood(r.outcome === "success" ? "cheer" : r.outcome === "miss" ? "encourage" : "happy");
      await new Promise((res) => setTimeout(res, r.outcome === "success" ? 900 : 500));
      if (r.passed) {
        setMisses(0);
        const nowLearned = part >= 0 ? Array.from(new Set([...learned, part])) : learned;
        setLearned(nowLearned);
        if (part === -1 && r.outcome === "success") {
          ended.current = true;
          void playSequence([{ midi: 72, beats: 0.5 }, { midi: 76, beats: 0.5 }, { midi: 79, beats: 1 }], 160);
          await talk(r.say, "happy");
          setPhase("done");
          void api.endSession(sid).catch(() => {});
          return;
        }
        await talk(r.say, "happy");
        const next = part === -1 ? -1 : (() => {
          for (let i = part + 1; i < song.phrases.length; i++) if (!nowLearned.includes(i)) return i;
          for (let i = 0; i < song.phrases.length; i++) if (!nowLearned.includes(i)) return i;
          return -1; // every part learned: the whole song
        })();
        setPart(next);
        // Passed, but Melo heard a stumble at one spot: polish just that spot before moving on.
        if (r.drill && next === part) await runDrill(song, part, r.drill);
        else await listen(song, next);
      } else {
        const m = misses + 1;
        setMisses(m);
        await talk(r.say, "encourage");
        if (r.hint_index != null) { const [lo] = bounds(song, part); setWordAt(lo + r.hint_index); }
        if (r.drill) await runDrill(song, part, r.drill); // practise the trouble spot on its own first
        else await listen(song, part, m >= 2); // after two tries, Melo plays it slower
      }
    } catch (e) { setProblem((e as Error).message); setPhase("play"); }
    finally { submitting.current = false; }
  }, [sid, song, phase, part, learned, misses, talk, listen, bounds, runDrill]);

  const switchMode = (mode: "steps" | "wait" | "beat") => {
    const beat = mode === "beat", st = mode === "steps";
    if (beat === followRef.current && st === stepsRef.current) return;
    setFollow(beat); followRef.current = beat;
    setSteps(st); stepsRef.current = st;
    if (song && (phase === "play" || phase === "step")) { stopSpeaking(); void listen(song, part); } // start this part again in the new way
  };

  const submitRef = useRef(submit);
  submitRef.current = submit;

  // The finished session is closed on the server, so a replay opens a fresh one (whole song).
  const playAgain = useCallback(async () => {
    try {
      const r = await api.startSong(child.id, songId);
      r.song = { ...r.song, notes: fitToInstrument(r.song.notes, inst).notes };
      sidRef.current = r.session_id; ended.current = false;
      setSid(r.session_id); setSong(r.song); setLearned(r.progress.phrases_learned); setPart(-1);
      setSupport(r.support); supportRef.current = r.support;
      await listen(r.song, -1);
    } catch (e) { setProblem((e as Error).message); }
  }, [child.id, songId, listen, inst]);

  // Every note the child plays: remember it, move the glowing key, finish when the part is complete.
  const onNote = useCallback((midi: number, conf = 1, fromMic = false) => {
    if (phase === "step") {
      const want = target[stepIdx];
      if (want == null || stepOk) return;
      if (isPads(inst) || pcEq(midi, want)) {
        setStepOk(true); setNudge(null); setMood("cheer"); setLit(want);
        window.setTimeout(() => setLit((l) => (l === want ? null : l)), 300);
        void talk(t("stepYes", lang), "happy");
      } else {
        let diff = want - midi;
        if (fromMic) { diff = ((diff % 12) + 12) % 12; if (diff > 6) diff -= 12; }
        setNudge(diff > 0 ? "up" : "down"); setMood("encourage");
        if (!isSpeaking()) void talk(wrongKeyWhy(want, midi, inst, lang), "listening"); // why that way, not just "wrong"
      }
      return;
    }
    if (phase !== "play") return;
    if (isPads(inst)) midi = target[Math.min(notes.current.length, target.length - 1)] ?? midi; // a drum: every tap is the next note
    if (fromMic) usedMic.current = true;
    notes.current.push({ midi, t: Math.round(performance.now() - t0.current), conf });
    setLit(midi);
    window.setTimeout(() => setLit((l) => (l === midi ? null : l)), 250);
    const d = drillRef.current;
    setPos((p) => {
      const right = p < target.length && pcEq(midi, target[p]);
      const np = right ? p + 1 : p;
      // React to every note like a teacher at the child's side: a nod for the right key, and for a
      // wrong one show at once which way to move (unless the child is playing from memory).
      if (right) { setNudge(null); setMood("happy"); }
      else if (p < target.length && (d || !followRef.current)) {
        let diff = target[p] - midi;
        if (fromMic) { diff = ((diff % 12) + 12) % 12; if (diff > 6) diff -= 12; }
        setNudge(diff > 0 ? "up" : "down"); setMood("encourage");
      }
      if (d) {
        if (np >= target.length && d.countedAt !== notes.current.length) {
          d.countedAt = notes.current.length; // count each finished repetition once
          d.reps += 1;
          const finished = d.reps >= 2;
          window.setTimeout(() => {
            if (!alive.current || !song) return;
            if (finished) { setMood("cheer"); void talk(t("drillDone", lang), "listening").then(() => listen(song, part, true)); }
            else { void talk(t("oneMore", lang), "listening"); notes.current = []; setPos(0); }
          }, 350);
        }
        return np;
      }
      if ((np >= target.length && !followRef.current) || notes.current.length >= target.length + 8) window.setTimeout(() => void submit(), 350);
      return np;
    });
  }, [phase, target, submit, song, part, lang, talk, listen, stepIdx, stepOk, inst]);

  useEffect(() => {
    const m = mic.current;
    if (!m) return;
    return m.onNote((n) => onNote(n.midi, n.conf, true));
  }, [onNote]);

  if (phase === "error") {
    return (
      <KidShell child={child}>
        <div className="lesson"><Melo mood="sleepy" /><p className="error">{problem}</p>
          <button className="btn" onClick={() => nav(`/play/${child.id}/songs`)}>{t("back", lang)}</button></div>
      </KidShell>
    );
  }
  if (phase === "concepts") {
    return (
      <KidShell child={child}>
        <div className="lesson song-lesson">
          <Melo mood="talking" size={100} />
          <ConceptCards lang={lang} inst={inst} onDone={() => { conceptsDone.current?.(); conceptsDone.current = null; }} />
        </div>
      </KidShell>
    );
  }
  if (!song) return <div className="center-screen"><Melo mood="thinking" say={t("loading", lang)} /></div>;

  const [lo, hi] = rangeFor(song.notes);
  const [plo, phi] = drill ? [drill.a, drill.b] : bounds(song, part);
  const guideAt = phase === "listen" ? (wordAt != null ? wordAt - plo : null)
    : phase === "step" ? stepIdx
    : phase === "play" ? (follow && !drill ? guideIdx : pos < target.length ? pos : null) : null;
  const lv = drill ? "full" : levelOf(part); // spot practice always shows every key
  // full/guided: every key glows. light: only the first key. memory: nothing (the child plays it).
  const glow = phase === "step" ? (stepOk ? null : target[stepIdx] ?? null) : phase !== "play" || guideAt == null ? null
    : lv === "memory" ? null : lv === "light" ? (guideAt === 0 && pos === 0 ? target[0] : null) : target[guideAt];
  const askHelp = () => {
    const nb = { ...boostRef.current, [String(part)]: true };
    setBoost(nb); boostRef.current = nb;
    if (song) void listen(song, part);
  };

  return (
    <KidShell child={child} onExit={() => { if (sid && !ended.current) { ended.current = true; void api.endSession(sid).catch(() => {}); } }}>
      <div className="lesson song-lesson">
        <div className="song-head">
          <h1>{song.title}</h1>
          <span className="stars" aria-label={`${stars} stars`}>⭐ {stars}</span>
        </div>
        <div className="song-parts" aria-label="Song parts">
          {song.phrases.map((_, i) => (
            <span key={i} className={`part-dot${learned.includes(i) ? " on" : ""}${i === part ? " now" : ""}`}>{i + 1}</span>
          ))}
          <span className={`part-dot whole${part === -1 ? " now" : ""}`} title={t("wholeSong", lang)}>🎵</span>
        </div>
        <Melo mood={mood} size={110} say={say} />
        {ears && <div className="sensor-status small">🎤 {t("earsOn", lang)}</div>}
        <video ref={videoRef} className="hidden-video" muted playsInline />
        {count && <div className="countin" aria-live="assertive">{count}</div>}
        {phase === "play" && nudge && (
          <div className={`nudge ${nudge}`} role="status">{nudge === "up" ? `${t("tryHigher", lang)} 👉` : `👈 ${t("tryLower", lang)}`}</div>
        )}
        <span className={`help-badge ${lv}`} title="Melo gives less help as your child learns this part">{HELP_ICON[lv]} {t(HELP_LABEL[lv], lang)}</span>
        {preview && <NoteGuide notes={song.notes} beats={song.beats} words={song.words} lang={lang} active={previewAt} bpm={tempo} running label={t("hearWhole", lang)} />}
        {!preview && lv !== "memory" && <NoteGuide hideNames={lv === "light"} notes={target} beats={song.beats.slice(plo, phi)} words={song.words?.slice(plo, phi) ?? null} lang={lang}
          active={guideAt} done={phase === "play" ? pos : phase === "step" ? stepIdx + (stepOk ? 1 : 0) : 0} bpm={tempo} running={phase === "listen" || (phase === "play" && follow && !drill)}
          label={drill ? t("spotPractice", lang) : `${t("part", lang)} ${part + 1}`} />}
        {drill && <span className="help-badge full">🎯 {t("spotPractice", lang)}</span>}
        {why && (phase === "step" || (showWhy && phase === "play")) && (
          <div className="why-card" role="status">
            <span className="why-icon" aria-hidden>{why.icon}</span>
            <div>
              <p>{why.text}</p>
              {why.where && <p className="why-where">📍 {why.where}</p>}
              <p className="why-len">⏱️ {why.length}</p>
              {why.word && <p>🎤 {why.word}</p>}
              {why.ending && <p>🏠 {why.ending}</p>}
            </div>
          </div>
        )}
        {phase === "step" && (
          <div className="row center wrap">
            <button className="btn ghost" onClick={() => { if (song) { const m = target[stepIdx]; void playSequence([{ midi: m, beats: song.beats[plo + stepIdx] ?? 1, sing: sungName(m, lang) }], Math.round(song.bpm * 0.7), (k) => setLit(k >= 0 ? m : null)).done.then(() => setLit(null)); } }}>🔊 {t("hearNote", lang)}</button>
            <button className="btn ghost" onClick={sayWhy}>🤔 {t("why", lang)}</button>
            {stepOk && <button className="btn next-step" onClick={() => void nextStep()}>👉 {t("next", lang)}</button>}
          </div>
        )}
        <div className="mode-switch" role="group" aria-label="How to play">
          <button className={steps ? "sel" : ""} onClick={() => switchMode("steps")} aria-pressed={steps}>👣 {t("oneByOne", lang)}</button>
          <button className={!follow && !steps ? "sel" : ""} onClick={() => switchMode("wait")} aria-pressed={!follow && !steps}>🐢 {t("waitForMe", lang)}</button>
          <button className={follow ? "sel" : ""} onClick={() => switchMode("beat")} aria-pressed={follow}>🥁 {t("withBeat", lang)}</button>
        </div>
        <InstrumentView inst={inst} tune={target} from={lo} to={hi} lang={lang} onPlay={(m) => onNote(m)} highlight={lv === "memory" || lv === "light" ? undefined : target}
          dimOthers={lv !== "memory" && lv !== "light"} glow={glow} lit={lit}
          disabled={(phase !== "play" && phase !== "step") || source.current === "mic"} silent={source.current === "mic"} />
        {problem && <p className="muted small">{problem}</p>}
        <div className="row center wrap">
          {preview ? (
            <button className="btn" onClick={() => previewCancel.current?.()}>⏹ {t("stop", lang)}</button>
          ) : (phase === "play" || phase === "done") && (
            <button className="btn ghost" onClick={() => void (async () => {
              clearTimers(); setGuideIdx(null);
              const heard = await hearWhole(song);
              if (alive.current && phase !== "done") { if (heard) await talk(t("nowParts", lang), "listening"); await listen(song, part); }
              else if (alive.current) setPhase("done");
            })()}>🎧 {t("hearWhole", lang)}</button>
          )}
          {phase === "play" && lv !== "memory" && <button className="btn ghost" onClick={sayWhy}>🤔 {t("why", lang)}</button>}
          {phase === "play" && !drill && <button className="btn" onClick={() => void submit()}>✅ {t("done", lang)}</button>}
          {phase === "play" && drill && <button className="btn ghost" onClick={() => void listen(song, part)}>⏭ {t("next", lang)}</button>}
          {phase === "play" && (lv === "light" || lv === "memory") && (
            <button className="btn ghost" onClick={askHelp}>🙋 {t("helpMe", lang)}</button>
          )}
          {(phase === "play" || phase === "done") && part !== -1 && (
            <button className="btn ghost" onClick={askHelp}>🔁 {t(lv === "light" || lv === "memory" ? "hearIt" : "again", lang)}</button>
          )}
          {phase === "play" && misses >= 1 && part !== -1 && (
            <button className="btn ghost" onClick={() => void listen(song, part, true)}>🐢 {t("slower", lang)}</button>
          )}
          {phase === "play" && part !== -1 && learned.length === song.phrases.length && (
            <button className="btn ghost" onClick={() => { setPart(-1); void listen(song, -1); }}>🎵 {t("wholeSong", lang)}</button>
          )}
        </div>
        {phase === "done" && (
          <div className="row center wrap">
            <button className="btn big" onClick={() => void playAgain()}>🔁 {t("playAgain", lang)}</button>
            <button className="btn big ghost" onClick={() => nav(`/play/${child.id}/songs`)}>🎶 {t("otherSong", lang)}</button>
          </div>
        )}
        <button className="btn ghost small" onClick={() => nav(`/play/${child.id}/songs`)}>⬅ {t("back", lang)}</button>
      </div>
    </KidShell>
  );
}
