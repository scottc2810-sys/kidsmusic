// Make a song WITH Melo, one small step at a time, so even a 2-year-old can follow and understands why:
// start at home -> choose where the tune goes (up, down, same, jump) and hear what that does to the music ->
// press the shining key -> choose short or long and hear why -> Next -> ... -> go home, which is why it
// sounds finished. Every choice is explained like a teacher at the child's side would.
import { useEffect, useMemo, useRef, useState } from "react";
import type { Child } from "../api";
import { speak, stopSpeaking } from "../audio/speech";
import { playSequence } from "../audio/synth";
import { InstrumentView } from "../components/InstrumentView";
import { Melo, type MeloMood } from "../components/Melo";
import { NoteGuide } from "../components/NoteGuide";
import { L, noteLabel, t, type StrKey, type Text } from "../i18n";
import { explainPart } from "../teaching/explain";
import { isBlack, isPads, whereIs, type InstrumentInfo } from "../teaching/instrument";

type Stage = "intro" | "press" | "length" | "next" | "move" | "done";
type MoveId = "up" | "down" | "same" | "jumpUp" | "jumpDown" | "home";
const BPM = 90;

const MOVES: { id: MoveId; icon: string; label: StrKey; why: Text }[] = [
  { id: "up", icon: "🪜", label: "stepUp", why: { en: "Going UP makes the song sound brighter and more excited, like asking a question. We move one key to the right.", hi: "ऊपर जाने से गाना ज़्यादा चमकदार और उत्साही लगता है, जैसे कोई सवाल पूछना। हम एक कुंजी दाएँ जाते हैं।", hinglish: "UPAR jaane se gaana zyada bright aur excited lagta hai, jaise sawaal poochhna. Hum ek key right jaate hain." } },
  { id: "down", icon: "🛝", label: "stepDown", why: { en: "Going DOWN makes the song sound calm, like answering or sitting down to rest. We move one key to the left.", hi: "नीचे जाने से गाना शांत लगता है, जैसे जवाब देना या बैठकर आराम करना। हम एक कुंजी बाएँ जाते हैं।", hinglish: "NEECHE jaane se gaana shaant lagta hai, jaise jawaab dena ya baith ke aaraam karna. Hum ek key left jaate hain." } },
  { id: "same", icon: "🔁", label: "sameAgain", why: { en: "The SAME note again makes a pattern. Patterns are why songs are easy to remember.", hi: "वही सुर दोबारा एक पैटर्न बनाता है। पैटर्न की वजह से गाने याद रहते हैं।", hinglish: "WAHI note dobara ek pattern banata hai. Pattern ki wajah se gaane yaad rehte hain." } },
  { id: "jumpUp", icon: "🐸", label: "jumpUp", why: { en: "A JUMP up is a happy surprise! We skip a key and land two white keys to the right.", hi: "ऊपर छलाँग एक ख़ुशी भरा सरप्राइज़ है! हम एक कुंजी छोड़कर दो सफ़ेद कुंजी दाएँ जाते हैं।", hinglish: "Upar CHHALAANG ek happy surprise hai! Ek key chhod ke do safed key right jaate hain." } },
  { id: "jumpDown", icon: "🪂", label: "jumpDown", why: { en: "A JUMP down floats like a parachute. We skip a key and land two white keys to the left.", hi: "नीचे छलाँग पैराशूट जैसी तैरती है। एक कुंजी छोड़कर दो सफ़ेद कुंजी बाएँ।", hinglish: "Neeche CHHALAANG parachute jaisi tairti hai. Ek key chhod ke do safed key left." } },
  { id: "home", icon: "🏠", label: "goHome", why: { en: "Let's go HOME. Ending on the home note is what makes a song sound finished, like coming home after a walk.", hi: "चलो घर चलें। घर वाले सुर पर ख़त्म करने से ही गाना पूरा लगता है, जैसे घूमकर घर आना।", hinglish: "Chalo GHAR chalein. Home note pe khatam karne se hi gaana poora lagta hai, jaise ghoom ke ghar aana." } },
];
const LENGTH_WHY: Record<"short" | "long", Text> = {
  short: { en: "A SHORT sound: quick, like a hop. Short sounds make the music bounce and hurry along.", hi: "छोटी आवाज़: जल्दी, जैसे फुदकना। छोटी आवाज़ें संगीत को उछलता और आगे बढ़ता बनाती हैं।", hinglish: "CHHOTI awaaz: jaldi, jaise hop. Chhoti awaaz music ko bouncy aur tez banati hain." },
  long: { en: "A LONG sound: we hold it, one, two. Long sounds let the song rest and breathe.", hi: "लंबी आवाज़: हम उसे पकड़े रहते हैं, एक, दो। लंबी आवाज़ में गाना आराम करता और साँस लेता है।", hinglish: "LAMBI awaaz: usse pakde rehte hain, ek, do. Lambi awaaz mein gaana aaraam karta aur saans leta hai." },
};
const INTRO: Text = { en: "A song is a little walk with sounds. We start at home, take some steps up and down, and come back home. Let's make one together!", hi: "गाना आवाज़ों की एक छोटी सैर है। हम घर से शुरू करते हैं, ऊपर-नीचे कुछ क़दम चलते हैं, और वापस घर आते हैं। चलो मिलकर एक बनाते हैं!", hinglish: "Gaana awaazon ki ek chhoti sair hai. Hum ghar se shuru karte hain, upar-neeche kuch kadam chalte hain, aur wapas ghar aate hain. Chalo milke ek banate hain!" };

/** Move `n` white keys from `m` (n < 0 = left). */
function whiteMove(m: number, n: number): number {
  let x = m;
  const dir = Math.sign(n);
  for (let k = 0; k < Math.abs(n); k++) { x += dir; while (isBlack(x)) x += dir; }
  return x;
}

export function SongBuilder({ child, inst }: { child: Child; inst: InstrumentInfo }) {
  const lang = child.language;
  const pads = isPads(inst);
  const lo = inst.set && inst.low != null ? inst.low : 55, hi = inst.set && inst.high != null ? inst.high : 77;
  const home = useMemo(() => { // the C nearest to middle C that the child's instrument has
    for (const c of [60, 72, 48, 84, 36]) if (c >= lo && c <= hi) return c;
    return lo + ((12 - (lo % 12)) % 12);
  }, [lo, hi]);
  const [tune, setTune] = useState<{ midi: number; beats: number }[]>([]);
  const [stage, setStage] = useState<Stage>("intro");
  const [target, setTarget] = useState(home);
  const [lit, setLit] = useState<number | null>(null);
  const [mood, setMood] = useState<MeloMood>("happy");
  const [say, setSay] = useState("");
  const [busy, setBusy] = useState(false);
  const [ending, setEnding] = useState(false);
  const [playAt, setPlayAt] = useState<number | null>(null);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; stopSpeaking(); }, []);

  const talk = async (text: string, after: MeloMood = "listening") => {
    if (!alive.current) return;
    setSay(text); setMood("talking");
    await speak(text, lang, "calm");
    if (alive.current) setMood(after);
  };
  useEffect(() => { void talk(L(INTRO, lang), "happy"); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const playTune = async (notes = tune) => {
    setBusy(true);
    await playSequence(notes, BPM, (k) => { setLit(k >= 0 ? notes[k].midi : null); setPlayAt(k >= 0 ? k : null); }).done;
    if (alive.current) { setLit(null); setPlayAt(null); setBusy(false); }
  };
  const askPress = async (m: number, why: string) => {
    setTarget(m); setStage("press");
    await talk(`${why} ${pads ? "" : whereIs(m, inst, lang)}`);
  };
  const begin = async () => {
    await askPress(home, L({ en: `Every song needs a HOME note. Ours is ${noteLabel(home, lang)}. Songs often start and end at home, so they feel safe.`,
      hi: `हर गाने का एक घर वाला सुर होता है। हमारा ${noteLabel(home, lang)} है। गाने अक्सर घर से शुरू और घर पर ख़त्म होते हैं, इसलिए सुरक्षित लगते हैं।`,
      hinglish: `Har gaane ka ek HOME note hota hai. Hamara ${noteLabel(home, lang)} hai. Gaane aksar ghar se shuru aur ghar pe khatam hote hain, isliye safe lagte hain.` }, lang));
  };
  const pressed = (m: number) => {
    if (stage !== "press" || busy) return;
    if (pads || ((m - target) % 12 + 12) % 12 === 0) {
      setMood("cheer"); setStage("length");
      void talk(`${t("stepYes", lang)} ${t("pickLength", lang)}`);
    } else {
      void talk(L(m < target ? { en: "That one is lower. Ours is a little to the right, where sounds are higher.", hi: "यह नीचा है। हमारा थोड़ा दाएँ है, जहाँ आवाज़ें ऊँची होती हैं।", hinglish: "Yeh neecha hai. Hamara thoda right mein hai, jahan awaaz oonchi hoti hai." }
        : { en: "That one is higher. Ours is a little to the left, where sounds are lower.", hi: "यह ऊँचा है। हमारा थोड़ा बाएँ है, जहाँ आवाज़ें नीची होती हैं।", hinglish: "Yeh ooncha hai. Hamara thoda left mein hai, jahan awaaz neechi hoti hai." }, lang));
    }
  };
  const chooseLength = async (len: "short" | "long") => {
    const next = [...tune, { midi: target, beats: len === "short" ? 0.5 : 2 }];
    setTune(next);
    await talk(L(LENGTH_WHY[len], lang));
    if (!alive.current) return;
    await talk(L({ en: "Listen to your song so far!", hi: "अब तक का अपना गाना सुनो!", hinglish: "Ab tak ka apna gaana suno!" }, lang));
    await playTune(next);
    if (!alive.current) return;
    if (ending) {
      setStage("done"); setMood("cheer");
      await talk(L({ en: "You made a whole song! ", hi: "तुमने पूरा गाना बना लिया! ", hinglish: "Tumne poora gaana bana liya! " }, lang)
        + explainPart([next.map((n) => n.midi)], 0, lang) + " "
        + L({ en: "And it ends at home, so it sounds finished.", hi: "और यह घर पर ख़त्म होता है, इसलिए पूरा लगता है।", hinglish: "Aur yeh ghar pe khatam hota hai, isliye poora lagta hai." }, lang), "happy");
      return;
    }
    setStage("next");
  };
  const chooseMove = async (id: MoveId) => {
    const mv = MOVES.find((x) => x.id === id)!;
    const cur = tune[tune.length - 1]?.midi ?? home;
    if (pads) { await askPress(cur, L({ en: "On a drum every tap is the same sound: only WHEN and HOW LONG change.", hi: "ढोल पर हर थाप एक जैसी आवाज़ है: बस कब और कितनी लंबी, बदलता है।", hinglish: "Drum pe har tap same awaaz hai: bas KAB aur KITNI LAMBI badalta hai." }, lang)); return; }
    const want = id === "home" ? home : id === "same" ? cur : whiteMove(cur, { up: 1, down: -1, jumpUp: 2, jumpDown: -2 }[id as "up"]);
    const m = want < lo || want > hi ? whiteMove(cur, -Math.sign(want - cur)) : want; // the edge of the instrument: bounce back
    if (id === "home") setEnding(true);
    await askPress(m, L(mv.why, lang) + (m !== want ? " " + L({ en: "Oops, that's the end of your keys, so we go the other way.", hi: "अरे, कुंजियाँ यहीं ख़त्म, इसलिए दूसरी तरफ़ चलते हैं।", hinglish: "Oops, keys yahin khatam, isliye doosri taraf chalte hain." }, lang) : ""));
  };
  const restart = () => { setTune([]); setEnding(false); setStage("intro"); void talk(L(INTRO, lang), "happy"); };
  const canFinish = tune.length >= 3;
  const mustFinish = tune.length >= 8;

  return (
    <div className="lesson compose builder">
      <Melo mood={mood} size={96} say={say} />
      {tune.length > 0 && <NoteGuide notes={tune.map((n) => n.midi)} beats={tune.map((n) => n.beats)} lang={lang} bpm={BPM} active={playAt} running={busy} label={t("yourTune", lang)} />}
      {stage === "intro" && <button className="btn next-step" onClick={() => void begin()}>👉 {t("next", lang)}</button>}
      {stage === "press" && <p className="phase">✨ {t("stepPress", lang)}</p>}
      {stage === "length" && (
        <div className="choice-cards" role="group" aria-label={t("pickLength", lang)}>
          <button className="choice-card" onClick={() => void chooseLength("short")} disabled={busy}><span className="cc-icon">🐇</span>{t("shortNote", lang)}<small>♪</small></button>
          <button className="choice-card" onClick={() => void chooseLength("long")} disabled={busy}><span className="cc-icon">🐢</span>{t("longNote", lang)}<small>♩ — —</small></button>
        </div>
      )}
      {stage === "next" && <button className="btn next-step" onClick={() => { setStage("move"); void talk(t("pickMove", lang)); }} disabled={busy}>👉 {t("next", lang)}</button>}
      {stage === "move" && (
        <div className="choice-cards" role="group" aria-label={t("pickMove", lang)}>
          {MOVES.filter((m) => (m.id === "home" ? canFinish : !mustFinish) && (!pads || m.id === "same" || m.id === "home")).map((m) => (
            <button key={m.id} className="choice-card" onClick={() => void chooseMove(m.id)} disabled={busy}><span className="cc-icon">{m.icon}</span>{t(m.label, lang)}</button>
          ))}
        </div>
      )}
      <InstrumentView inst={inst} lang={lang} from={Math.max(lo, home - 12)} to={Math.min(hi, home + 12)} lit={lit} tune={tune.map((n) => n.midi)}
        onPlay={pressed} glow={stage === "press" ? target : null} highlight={stage === "press" ? [target] : undefined} disabled={busy} />
      {stage === "done" && (
        <div className="row center wrap">
          <button className="btn big" onClick={() => void playTune()} disabled={busy}>▶️ {t("playMine", lang)}</button>
          <button className="btn big ghost" onClick={restart} disabled={busy}>👣 {t("newSong", lang)}</button>
        </div>
      )}
    </div>
  );
}
