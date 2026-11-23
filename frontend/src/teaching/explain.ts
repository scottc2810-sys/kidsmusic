// The "why" behind every key, the way a patient teacher explains it to a very small child.
// Not "press this key" but: why THIS key (the tune goes up, so we move right), why this long
// (hold it, it is a resting note), why the song ends here (we come back home), and what the
// shape of a part is (stairs, slide, hill), so a child understands music instead of copying it.
// English, Hindi and Hinglish are written here; other languages fall back to English.
import { L, noteLabel, type Text } from "../i18n";
import type { Language } from "../languages";
import { isBlack, layoutOf, whereIs, type InstrumentInfo } from "./instrument";

const pc = (m: number) => ((m % 12) + 12) % 12;

export type Move = "first" | "same" | "step_up" | "step_down" | "jump_up" | "jump_down" | "leap_up" | "leap_down";
export function moveOf(prev: number | null, cur: number): Move {
  if (prev == null) return "first";
  const d = cur - prev;
  if (d === 0) return "same";
  const a = Math.abs(d);
  if (a <= 2) return d > 0 ? "step_up" : "step_down";
  if (a <= 5) return d > 0 ? "jump_up" : "jump_down";
  return d > 0 ? "leap_up" : "leap_down";
}

/** Keys between two notes, counting white keys (what a child sees). */
export function whiteSteps(a: number, b: number): number {
  const [lo, hi] = a < b ? [a, b] : [b, a];
  let n = 0;
  for (let m = lo + 1; m <= hi; m++) if (!isBlack(m)) n++;
  return n;
}

const MOVE_ICON: Record<Move, string> = { first: "🏁", same: "🔁", step_up: "🪜", step_down: "🛝", jump_up: "🐸", jump_down: "🐸", leap_up: "🚀", leap_down: "🪂" };

function moveText(m: Move, name: string, keys: number, pads: boolean): Text {
  if (pads) {
    return m === "first" ? { en: "Every note is one tap on the drum. Listen to how long each one is.", hi: "हर सुर ढोल पर एक थाप है। सुनो, हर एक कितना लंबा है।", hinglish: "Har note drum pe ek tap hai. Suno har ek kitna lamba hai." }
      : { en: "Next tap. The drum doesn't go high or low, so we only think about WHEN to tap.", hi: "अगली थाप। ढोल ऊँचा-नीचा नहीं होता, इसलिए बस यह सोचो कि कब बजाना है।", hinglish: "Agla tap. Drum high-low nahi hota, isliye bas socho KAB bajana hai." };
  }
  switch (m) {
    case "first": return { en: `We start on ${name}. The first note is where our tune begins its little walk.`, hi: `हम ${name} से शुरू करते हैं। पहला सुर वहाँ है जहाँ से हमारी धुन चलना शुरू करती है।`, hinglish: `Hum ${name} se shuru karte hain. Pehla note wahan hai jahan se hamari dhun chalna shuru karti hai.` };
    case "same": return { en: `Same sound again: press ${name} once more. Saying it twice helps our ears remember it, like clapping twice.`, hi: `वही आवाज़ फिर से: ${name} एक बार और दबाओ। दो बार कहने से कान उसे याद रखते हैं, जैसे दो बार ताली।`, hinglish: `Wahi awaaz phir se: ${name} ek baar aur dabao. Do baar kehne se kaan yaad rakhte hain, jaise do baar taali.` };
    case "step_up": return { en: `The tune goes up a tiny step, so we move ONE key to the right, to ${name}. Right side = higher sound, like climbing one stair.`, hi: `धुन एक छोटी सीढ़ी ऊपर जाती है, इसलिए हम एक कुंजी दाएँ, ${name} पर जाते हैं। दाईं तरफ़ = ऊँची आवाज़, जैसे एक सीढ़ी चढ़ना।`, hinglish: `Dhun ek chhoti seedhi upar jaati hai, isliye hum EK key right, ${name} pe jaate hain. Right side = oonchi awaaz, jaise ek seedhi chadhna.` };
    case "step_down": return { en: `The tune comes down a tiny step, so we move ONE key to the left, to ${name}. Left side = lower sound, like stepping down one stair.`, hi: `धुन एक छोटी सीढ़ी नीचे आती है, इसलिए हम एक कुंजी बाएँ, ${name} पर जाते हैं। बाईं तरफ़ = नीची आवाज़।`, hinglish: `Dhun ek chhoti seedhi neeche aati hai, isliye hum EK key left, ${name} pe jaate hain. Left side = neechi awaaz.` };
    case "jump_up": return { en: `A little jump UP! We skip over keys and land ${keys} white keys to the right, on ${name}. Jumps make a tune bouncy, like a frog.`, hi: `ऊपर की ओर छोटी छलाँग! हम कुंजियाँ छोड़कर ${keys} सफ़ेद कुंजी दाएँ, ${name} पर कूदते हैं। छलाँग से धुन मेंढक जैसी उछलती है।`, hinglish: `Upar ek chhoti chhalaang! Keys chhod ke ${keys} safed key right, ${name} pe koodo. Chhalaang se dhun frog jaisi uchhalti hai.` };
    case "jump_down": return { en: `A little jump DOWN! We land ${keys} white keys to the left, on ${name}. Down feels calmer, like sitting down.`, hi: `नीचे की ओर छोटी छलाँग! ${keys} सफ़ेद कुंजी बाएँ, ${name} पर। नीचे जाना शांत लगता है, जैसे बैठ जाना।`, hinglish: `Neeche ek chhoti chhalaang! ${keys} safed key left, ${name} pe. Neeche jaana shaant lagta hai, jaise baith jaana.` };
    case "leap_up": return { en: `A BIG jump up to ${name}, ${keys} white keys to the right! Big jumps make a song feel exciting.`, hi: `${name} तक बड़ी छलाँग, ${keys} सफ़ेद कुंजी दाएँ! बड़ी छलाँग से गाना रोमांचक लगता है।`, hinglish: `${name} tak BADI chhalaang, ${keys} safed key right! Badi chhalaang se gaana exciting lagta hai.` };
    case "leap_down": return { en: `A BIG jump down to ${name}, ${keys} white keys to the left, like a parachute floating down.`, hi: `${name} तक नीचे बड़ी छलाँग, ${keys} सफ़ेद कुंजी बाएँ, जैसे पैराशूट नीचे आता है।`, hinglish: `${name} tak neeche BADI chhalaang, ${keys} safed key left, jaise parachute neeche aata hai.` };
  }
}

function lengthText(beats: number): Text {
  if (beats <= 0.5) return { en: "It's a quick note: tap and let go, like a bunny hop.", hi: "यह जल्दी वाला सुर है: दबाओ और छोड़ दो, जैसे खरगोश की फुदक।", hinglish: "Yeh quick note hai: dabao aur chhod do, jaise khargosh ki hop." };
  if (beats < 1.5) return { en: "It lasts one count, like one footstep.", hi: "यह एक गिनती तक चलता है, जैसे एक क़दम।", hinglish: "Yeh ek count tak chalta hai, jaise ek kadam." };
  if (beats < 3) return { en: "It's a LONG note: keep pressing while we count one, two. Long notes let the song rest.", hi: "यह लंबा सुर है: एक, दो गिनते हुए दबाए रखो। लंबे सुर में गाना आराम करता है।", hinglish: "Yeh LAMBA note hai: ek, do ginte hue dabaye rakho. Lambe note mein gaana aaraam karta hai." };
  return { en: "A very long note: hold it for one, two, three. The song takes a big breath here.", hi: "बहुत लंबा सुर: एक, दो, तीन तक दबाए रखो। यहाँ गाना लंबी साँस लेता है।", hinglish: "Bahut lamba note: ek, do, teen tak dabaye rakho. Yahan gaana lambi saans leta hai." };
}

export interface StepWhy { icon: string; move: Move; text: string; where: string; length: string; word: string | null; ending: string | null }

/**
 * Why the child plays note `i` of `notes`: how it moves from the note before, where it is on their
 * instrument, how long to hold it, which piece of the words it sings, and why the song ends there.
 */
export function explainStep(notes: number[], beats: number[], i: number, lang: Language, inst: InstrumentInfo,
  opts: { words?: (string | null)[] | null; songEnd?: boolean; home?: number } = {}): StepWhy {
  const cur = notes[i];
  const prev = i > 0 ? notes[i - 1] : null;
  const move = moveOf(prev, cur);
  const pads = layoutOf(inst) === "pads";
  const name = noteLabel(cur, lang);
  const text = L(moveText(move, name, prev == null ? 0 : whiteSteps(prev, cur), pads), lang);
  const where = pads ? "" : whereIs(cur, inst, lang);
  const length = L(lengthText(beats[i] ?? 1), lang);
  const w = opts.words?.[i];
  const word = w ? L({ en: `This note sings “${w}”. One note for each little piece of a word.`, hi: `यह सुर “${w}” गाता है। शब्द के हर छोटे टुकड़े के लिए एक सुर।`,
    hinglish: `Yeh note “${w}” gaata hai. Shabd ke har chhote tukde ke liye ek note.` }, lang) : null;
  const home = opts.home ?? notes[0];
  const last = i === notes.length - 1;
  const ending = last && opts.songEnd
    ? (pc(cur) === pc(home)
      ? L({ en: `Last note: we come back HOME to ${name}. That's why the song sounds finished, like coming home after a walk.`, hi: `आख़िरी सुर: हम वापस घर, ${name} पर आते हैं। इसीलिए गाना पूरा लगता है, जैसे घूमकर घर आना।`,
        hinglish: `Last note: hum wapas GHAR, ${name} pe aate hain. Isiliye gaana poora lagta hai, jaise ghoom ke ghar aana.` }, lang)
      : L({ en: "Last note of the song. Hold it and let it ring, then lift your finger gently.", hi: "गाने का आख़िरी सुर। उसे बजने दो, फिर उँगली धीरे से उठाओ।", hinglish: "Gaane ka last note. Usse bajne do, phir ungli dheere se uthao." }, lang))
    : last ? L({ en: "That's the end of this part. A part is like one sentence of the song.", hi: "यह इस हिस्से का अंत है। एक हिस्सा गाने का एक वाक्य जैसा है।", hinglish: "Yeh is part ka end hai. Ek part gaane ka ek sentence jaisa hai." }, lang)
    : null;
  return { icon: MOVE_ICON[move], move, text, where, length, word, ending };
}

/** Everything about one step as Melo says it (shortest helpful version for the youngest). */
export function stepSpeech(w: StepWhy, young: boolean): string {
  const parts = young ? [w.text, w.length, w.ending] : [w.text, w.where, w.length, w.word, w.ending];
  return parts.filter(Boolean).join(" ");
}

export type Shape = "up" | "down" | "hill" | "valley" | "same" | "wave";
export function shapeOf(notes: number[]): Shape {
  if (notes.length < 2) return "same";
  const first = notes[0], last = notes[notes.length - 1];
  const hi = Math.max(...notes), lo = Math.min(...notes);
  if (hi === lo) return "same";
  const ups = notes.slice(1).filter((n, i) => n > notes[i]).length;
  const downs = notes.slice(1).filter((n, i) => n < notes[i]).length;
  if (downs === 0) return "up";
  if (ups === 0) return "down";
  const peak = notes.indexOf(hi), trough = notes.indexOf(lo);
  if (peak > 0 && peak < notes.length - 1 && hi > first && hi > last && ups + downs <= notes.length) {
    if (notes.slice(0, peak + 1).every((n, i, a) => i === 0 || n >= a[i - 1]) && notes.slice(peak).every((n, i, a) => i === 0 || n <= a[i - 1])) return "hill";
  }
  if (trough > 0 && trough < notes.length - 1 && lo < first && lo < last) {
    if (notes.slice(0, trough + 1).every((n, i, a) => i === 0 || n <= a[i - 1]) && notes.slice(trough).every((n, i, a) => i === 0 || n >= a[i - 1])) return "valley";
  }
  return "wave";
}

const SHAPE: Record<Shape, Text & { icon: string }> = {
  up: { icon: "🪜", en: "This part climbs UP like stairs: each note a little higher, so your finger walks to the right.", hi: "यह हिस्सा सीढ़ी की तरह ऊपर चढ़ता है: हर सुर थोड़ा ऊँचा, इसलिए उँगली दाएँ चलती है।", hinglish: "Yeh part seedhi ki tarah UPAR chadhta hai: har note thoda ooncha, isliye ungli right chalti hai." },
  down: { icon: "🛝", en: "This part slides DOWN like a slide: each note a little lower, so your finger walks to the left.", hi: "यह हिस्सा फिसलपट्टी की तरह नीचे आता है: हर सुर थोड़ा नीचा, उँगली बाएँ चलती है।", hinglish: "Yeh part slide ki tarah NEECHE aata hai: har note thoda neecha, ungli left chalti hai." },
  hill: { icon: "⛰️", en: "This part is a HILL: it goes up, up to the top, and then comes back down.", hi: "यह हिस्सा पहाड़ी जैसा है: ऊपर, ऊपर चोटी तक, फिर वापस नीचे।", hinglish: "Yeh part ek PAHAADI hai: upar, upar top tak, phir wapas neeche." },
  valley: { icon: "🏞️", en: "This part is a VALLEY: it goes down low, and then climbs back up.", hi: "यह हिस्सा घाटी जैसा है: नीचे जाता है, फिर वापस ऊपर चढ़ता है।", hinglish: "Yeh part ek GHAATI hai: neeche jaata hai, phir wapas upar chadhta hai." },
  same: { icon: "🔁", en: "This part stays on the same sound. Only the rhythm changes: listen to the long and short notes.", hi: "यह हिस्सा एक ही आवाज़ पर रहता है। बस लय बदलती है: लंबे और छोटे सुर सुनो।", hinglish: "Yeh part ek hi awaaz pe rehta hai. Bas rhythm badalta hai: lambe aur chhote note suno." },
  wave: { icon: "🌊", en: "This part goes up and down like waves in the sea. Watch which way each note moves.", hi: "यह हिस्सा समुद्र की लहरों जैसा ऊपर-नीचे जाता है। देखो हर सुर किधर जाता है।", hinglish: "Yeh part samundar ki lehron jaisa upar-neeche jaata hai. Dekho har note kidhar jaata hai." },
};
export const shapeIcon = (s: Shape) => SHAPE[s].icon;

/** The idea of a whole part before playing it: its shape, and whether it repeats an earlier part. */
export function explainPart(parts: number[][], p: number, lang: Language): string {
  const notes = parts[p] ?? [];
  const same = parts.findIndex((q, i) => i < p && q.length === notes.length && q.every((n, k) => n === notes[k]));
  const almost = same < 0 ? parts.findIndex((q, i) => i < p && q.length >= 3 && notes.length >= 3 && q.slice(0, 3).every((n, k) => n === notes[k])) : -1;
  const rep = same >= 0
    ? L({ en: ` Good news: it's exactly like part ${same + 1}! Songs repeat parts so they're easy to remember.`, hi: ` अच्छी ख़बर: यह बिल्कुल हिस्सा ${same + 1} जैसा है! गाने हिस्से दोहराते हैं ताकि याद रखना आसान हो।`, hinglish: ` Good news: yeh bilkul part ${same + 1} jaisa hai! Gaane parts repeat karte hain taaki yaad rakhna easy ho.` }, lang)
    : almost >= 0 ? L({ en: ` It starts just like part ${almost + 1}, then changes. Listen for the change!`, hi: ` यह हिस्सा ${almost + 1} की तरह शुरू होता है, फिर बदलता है। बदलाव सुनो!`, hinglish: ` Yeh part ${almost + 1} ki tarah shuru hota hai, phir badalta hai. Change suno!` }, lang) : "";
  return L(SHAPE[shapeOf(notes)], lang) + rep;
}

/** How music is made, in four tiny ideas (shown once before the first song and in the song builder). */
export interface Concept { icon: string; title: Text; say: Text; demo: { midi: number; beats: number }[] }
export const CONCEPTS: Concept[] = [
  { icon: "🔔", title: { en: "One key, one sound", hi: "एक कुंजी, एक आवाज़", hinglish: "Ek key, ek awaaz" },
    say: { en: "Every key makes its own sound. Press one key, you hear one note. That's the smallest piece of music.", hi: "हर कुंजी की अपनी आवाज़ होती है। एक कुंजी दबाओ, एक सुर सुनाई देता है। यही संगीत का सबसे छोटा टुकड़ा है।", hinglish: "Har key ki apni awaaz hoti hai. Ek key dabao, ek note sunai deta hai. Yahi music ka sabse chhota tukda hai." },
    demo: [{ midi: 60, beats: 1 }] },
  { icon: "🐦", title: { en: "Right is high, left is low", hi: "दाएँ ऊँचा, बाएँ नीचा", hinglish: "Right ooncha, left neecha" },
    say: { en: "Keys on the right sound high, like a little bird. Keys on the left sound low, like a big elephant. Listen: low, middle, high!", hi: "दाईं ओर की कुंजियाँ ऊँची, चिड़िया जैसी। बाईं ओर की नीची, हाथी जैसी। सुनो: नीचा, बीच, ऊँचा!", hinglish: "Right wali keys oonchi, chidiya jaisi. Left wali neechi, haathi jaisi. Suno: neecha, beech, ooncha!" },
    demo: [{ midi: 48, beats: 1 }, { midi: 60, beats: 1 }, { midi: 72, beats: 1 }] },
  { icon: "🐢", title: { en: "Long and short", hi: "लंबा और छोटा", hinglish: "Lamba aur chhota" },
    say: { en: "Some sounds are short, some are long. Short, short, looong! The long and short sounds make the rhythm, the heartbeat of the song.", hi: "कुछ आवाज़ें छोटी, कुछ लंबी। छोटा, छोटा, लंबाआ! छोटी-लंबी आवाज़ें लय बनाती हैं, गाने की धड़कन।", hinglish: "Kuch awaaz chhoti, kuch lambi. Chhota, chhota, lambaaa! Chhoti-lambi awaaz rhythm banati hain, gaane ki dhadkan." },
    demo: [{ midi: 64, beats: 0.5 }, { midi: 64, beats: 0.5 }, { midi: 64, beats: 2 }] },
  { icon: "🎵", title: { en: "Sounds in order = a song", hi: "क्रम में आवाज़ें = गाना", hinglish: "Order mein awaaz = gaana" },
    say: { en: "Put the sounds in the right order, with the right long and short, and it becomes a song! That's why we learn which key comes next, and why.", hi: "आवाज़ों को सही क्रम में, सही लंबाई के साथ रखो, तो गाना बन जाता है! इसीलिए हम सीखते हैं कि अगली कुंजी कौन सी है, और क्यों।", hinglish: "Awaazon ko sahi order mein, sahi lambai ke saath rakho, toh gaana ban jaata hai! Isiliye hum seekhte hain ki agli key kaunsi hai, aur kyun." },
    demo: [{ midi: 60, beats: 1 }, { midi: 62, beats: 1 }, { midi: 64, beats: 1 }, { midi: 60, beats: 2 }] },
];

/** A real teacher's do's and don'ts, one at a time (shown with the first steps). */
export const DOS: Text[] = [
  { en: "Do: use one finger and press the key gently, then lift it. Don't bang it: gentle presses sound the nicest.", hi: "करो: एक उँगली से कुंजी धीरे से दबाओ, फिर उठाओ। ज़ोर से मत मारो: धीरे दबाने से सबसे अच्छा बजता है।", hinglish: "Karo: ek ungli se key dheere se dabao, phir uthao. Zor se mat maaro: dheere dabane se sabse achha bajta hai." },
  { en: "Do: listen first, then play. Your ears are the most important part of music.", hi: "करो: पहले सुनो, फिर बजाओ। संगीत में सबसे ज़रूरी तुम्हारे कान हैं।", hinglish: "Karo: pehle suno, phir bajao. Music mein sabse zaroori tumhare kaan hain." },
  { en: "Don't worry about a wrong key! A wrong key just tells your ears which way to go. Even big musicians miss keys.", hi: "ग़लत कुंजी की चिंता मत करो! ग़लत कुंजी बस बताती है कि किधर जाना है। बड़े संगीतकार भी ग़लती करते हैं।", hinglish: "Galat key ki tension mat lo! Galat key bas batati hai kidhar jaana hai. Bade musicians bhi galti karte hain." },
  { en: "Do: sit tall, with soft round hands, like you're holding a little ball.", hi: "करो: सीधे बैठो, हाथ नरम और गोल, जैसे छोटी गेंद पकड़ी हो।", hinglish: "Karo: seedhe baitho, haath naram aur gol, jaise chhoti ball pakdi ho." },
  { en: "Don't rush! Slow and right is better than fast and wrong. Speed comes by itself later.", hi: "जल्दी मत करो! धीरे और सही, तेज़ और ग़लत से अच्छा है। तेज़ी बाद में अपने आप आती है।", hinglish: "Jaldi mat karo! Dheere aur sahi, tez aur galat se achha hai. Speed baad mein apne aap aati hai." },
];

/** After a wrong key: say which way to go and WHY, using the sound (higher / lower) and the place. */
export function wrongKeyWhy(target: number, played: number, inst: InstrumentInfo, lang: Language): string {
  if (layoutOf(inst) === "pads") return L({ en: "Almost! Wait for the light, then tap.", hi: "लगभग! रोशनी का इंतज़ार करो, फिर बजाओ।", hinglish: "Almost! Light ka wait karo, phir bajao." }, lang);
  const up = target > played;
  const name = noteLabel(target, lang), got = noteLabel(played, lang);
  return L(up
    ? { en: `You played ${got}. Our note ${name} sounds HIGHER, so it's further to the RIGHT. Higher sounds live on the right.`, hi: `तुमने ${got} बजाया। हमारा सुर ${name} ऊँचा है, इसलिए वह और दाएँ है। ऊँची आवाज़ें दाईं ओर रहती हैं।`, hinglish: `Tumne ${got} bajaya. Hamara note ${name} OONCHA hai, isliye woh aur RIGHT mein hai. Oonchi awaaz right mein rehti hai.` }
    : { en: `You played ${got}. Our note ${name} sounds LOWER, so it's further to the LEFT. Lower sounds live on the left.`, hi: `तुमने ${got} बजाया। हमारा सुर ${name} नीचा है, इसलिए वह और बाएँ है। नीची आवाज़ें बाईं ओर रहती हैं।`, hinglish: `Tumne ${got} bajaya. Hamara note ${name} NEECHA hai, isliye woh aur LEFT mein hai. Neechi awaaz left mein rehti hai.` }, lang)
    + " " + whereIs(target, inst, lang);
}
