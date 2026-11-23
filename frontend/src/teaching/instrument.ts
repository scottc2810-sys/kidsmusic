// The child's own instrument at home (set up by the parent with photos / shop links). Lessons use it to
// show the same instrument on screen (keys, bars or a drum), to move songs into its range, and to say
// where each note is on THAT instrument, the way a teacher sitting next to the child would.
// Without a profile everything is the standard on-screen piano.
import { useEffect, useState } from "react";
import { api } from "../api";
import { L, noteLabel, type Text } from "../i18n";
import type { Language } from "../languages";

export type KeyLabels = "none" | "letters" | "numbers" | "colors" | "sargam" | "solfege";
export type Layout = "keys" | "bars" | "pads";
export interface InstrumentInfo {
  set: boolean; kind: string; default?: boolean;
  label?: string; emoji?: string; layout?: Layout; stand_in?: boolean; name?: string; keys?: number; first_key?: string;
  labels?: KeyLabels; features?: { mic?: boolean; record?: boolean; lights?: boolean; demo_songs?: string[]; teach_mode?: boolean };
  summary?: string; tips?: string[]; low?: number; high?: number; diatonic?: boolean;
  sources?: { url: string; title: string; found: boolean | null }[]; notes?: string;
  photos?: { id: string; url: string }[]; analyzed_at?: string | null;
}
export const STANDARD: InstrumentInfo = { set: false, kind: "keyboard", default: true };

const cache = new Map<string, InstrumentInfo>();
/** The child's instrument (cached per page load; the standard piano while loading or when none is set). */
export function useInstrument(childId: string): InstrumentInfo {
  const [inst, setInst] = useState<InstrumentInfo>(cache.get(childId) ?? STANDARD);
  useEffect(() => {
    let live = true;
    api.instrument(childId).then((x) => { cache.set(childId, x); if (live) setInst(x); }).catch(() => { /* standard lessons */ });
    return () => { live = false; };
  }, [childId]);
  return inst;
}
export const forgetInstrument = (childId: string) => cache.delete(childId);

const pc = (m: number) => ((m % 12) + 12) % 12;
const BLACK = new Set([1, 3, 6, 8, 10]);
export const isBlack = (m: number) => BLACK.has(pc(m));
export const layoutOf = (inst: InstrumentInfo): Layout => (inst.set ? inst.layout ?? "keys" : "keys");
export const isPads = (inst: InstrumentInfo) => layoutOf(inst) === "pads";

/**
 * Move a tune into the notes this instrument has. Whole octaves first (the tune sounds the same, just
 * higher or lower); only if it is wider than the instrument, single notes are folded by an octave.
 */
export function fitToInstrument(notes: number[], inst: InstrumentInfo): { notes: number[]; shift: number; folded: boolean } {
  if (!inst.set || inst.low == null || inst.high == null || layoutOf(inst) === "pads" || !notes.length) return { notes, shift: 0, folded: false };
  const lo = inst.low, hi = inst.high;
  const fits = (s: number) => notes.every((n) => n + s >= lo && n + s <= hi);
  for (const s of [0, 12, -12, 24, -24, 36, -36]) if (fits(s)) return { notes: notes.map((n) => n + s), shift: s, folded: false };
  const score = (s: number) => notes.filter((n) => n + s >= lo && n + s <= hi).length;
  const shift = [0, 12, -12, 24, -24].sort((a, b) => score(b) - score(a))[0];
  const fold = (n: number) => { let m = n + shift; while (m < lo && m + 12 <= hi + 11) m += 12; while (m > hi && m - 12 >= lo - 11) m -= 12; return m; };
  return { notes: notes.map(fold), shift, folded: true };
}

/** Bars can show a tune only when it uses the "white" notes the bars have. */
export const barsCanPlay = (notes: number[]) => notes.every((n) => !isBlack(n));

const COLOR_NAMES: Text[] = [
  { en: "red", hi: "लाल", hinglish: "laal" }, { en: "red", hi: "लाल", hinglish: "laal" },
  { en: "orange", hi: "नारंगी", hinglish: "orange" }, { en: "orange", hi: "नारंगी", hinglish: "orange" },
  { en: "yellow", hi: "पीली", hinglish: "peeli" }, { en: "green", hi: "हरी", hinglish: "hari" }, { en: "green", hi: "हरी", hinglish: "hari" },
  { en: "blue", hi: "नीली", hinglish: "neeli" }, { en: "blue", hi: "नीली", hinglish: "neeli" },
  { en: "purple", hi: "बैंगनी", hinglish: "purple" }, { en: "purple", hi: "बैंगनी", hinglish: "purple" }, { en: "pink", hi: "गुलाबी", hinglish: "pink" },
];
const DEGREE: Record<number, string> = { 0: "1", 2: "2", 4: "3", 5: "4", 7: "5", 9: "6", 11: "7" };
const LETTER = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const SARGAM = ["Sa", "re", "Re", "ga", "Ga", "Ma", "ma", "Pa", "dha", "Dha", "ni", "Ni"];
const SOLF = ["Do", "Do♯", "Re", "Re♯", "Mi", "Fa", "Fa♯", "Sol", "Sol♯", "La", "La♯", "Si"];

/** What is written on this key of the child's instrument (its stickers); the language's note names otherwise. */
export function keyLabel(midi: number, inst: InstrumentInfo, lang: Language): string {
  switch (inst.set ? inst.labels : "none") {
    case "numbers": return DEGREE[pc(midi)] ?? "";
    case "letters": return LETTER[pc(midi)];
    case "sargam": return SARGAM[pc(midi)];
    case "solfege": return SOLF[pc(midi)];
    default: return noteLabel(midi, lang);
  }
}
export const colorName = (midi: number, lang: Language) => L(COLOR_NAMES[pc(midi)], lang);

// How a piano teacher finds every white key: by the groups of two and three black keys.
const LANDMARK: Record<number, Text> = {
  0: { en: "the white key just to the LEFT of the two black keys", hi: "दो काली कुंजियों के ठीक बाएँ वाली सफ़ेद कुंजी", hinglish: "do kaali keys ke bilkul LEFT wali safed key" },
  2: { en: "the white key in the MIDDLE of the two black keys", hi: "दो काली कुंजियों के बीच वाली सफ़ेद कुंजी", hinglish: "do kaali keys ke BEECH wali safed key" },
  4: { en: "the white key just to the RIGHT of the two black keys", hi: "दो काली कुंजियों के ठीक दाएँ वाली सफ़ेद कुंजी", hinglish: "do kaali keys ke bilkul RIGHT wali safed key" },
  5: { en: "the white key just to the LEFT of the three black keys", hi: "तीन काली कुंजियों के ठीक बाएँ वाली सफ़ेद कुंजी", hinglish: "teen kaali keys ke bilkul LEFT wali safed key" },
  7: { en: "the white key after the first black key of the three", hi: "तीन काली कुंजियों में पहली काली कुंजी के बाद वाली सफ़ेद कुंजी", hinglish: "teen kaali keys mein pehli kaali key ke baad wali safed key" },
  9: { en: "the white key after the second black key of the three", hi: "तीन काली कुंजियों में दूसरी काली कुंजी के बाद वाली सफ़ेद कुंजी", hinglish: "teen kaali keys mein doosri kaali key ke baad wali safed key" },
  11: { en: "the white key just to the RIGHT of the three black keys", hi: "तीन काली कुंजियों के ठीक दाएँ वाली सफ़ेद कुंजी", hinglish: "teen kaali keys ke bilkul RIGHT wali safed key" },
};

/** Where this note is on the child's own instrument, in words a small child can follow. */
export function whereIs(midi: number, inst: InstrumentInfo, lang: Language): string {
  const name = keyLabel(midi, inst, lang);
  const layout = layoutOf(inst);
  if (layout === "pads") return L({ en: "Tap your drum once for this note.", hi: "इस सुर के लिए अपना ढोल एक बार बजाओ।", hinglish: "Is note ke liye apna drum ek baar bajao." }, lang);
  if (layout === "bars" && inst.low != null) {
    const n = inst.diatonic ? countWhites(inst.low, midi) : midi - inst.low + 1;
    return L({ en: `It's bar number ${n}, counting from the longest bar. Long bars sound low, short bars sound high.`,
      hi: `यह सबसे लंबी पट्टी से गिनकर ${n}वीं पट्टी है। लंबी पट्टी नीची आवाज़, छोटी पट्टी ऊँची आवाज़।`,
      hinglish: `Yeh sabse lambi patti se ginke number ${n} patti hai. Lambi patti neechi awaaz, chhoti patti oonchi awaaz.` }, lang);
  }
  const sticker = inst.set && inst.labels === "numbers" && DEGREE[pc(midi)]
    ? L({ en: ` It has the number ${DEGREE[pc(midi)]} on it.`, hi: ` उस पर ${DEGREE[pc(midi)]} लिखा है।`, hinglish: ` Uspe ${DEGREE[pc(midi)]} likha hai.` }, lang)
    : inst.set && inst.labels === "colors" ? L({ en: ` It's the ${colorName(midi, lang)} one.`, hi: ` वह ${colorName(midi, lang)} वाली है।`, hinglish: ` Woh ${colorName(midi, lang)} wali hai.` }, lang)
    : "";
  if (isBlack(midi)) {
    return L({ en: `${name} is a black key: the one just right of ${noteLabel(midi - 1, lang)}.`, hi: `${name} एक काली कुंजी है: ${noteLabel(midi - 1, lang)} के ठीक दाएँ वाली।`,
      hinglish: `${name} ek kaali key hai: ${noteLabel(midi - 1, lang)} ke bilkul right wali.` }, lang) + sticker;
  }
  return L({ en: `${name} is ${L(LANDMARK[pc(midi)], "en")}.`, hi: `${name} ${L(LANDMARK[pc(midi)], "hi")} है।`, hinglish: `${name} ${L(LANDMARK[pc(midi)], "hinglish")} hai.` }, lang) + sticker;
}

function countWhites(from: number, to: number): number {
  let n = 0;
  for (let m = from; m <= to; m++) if (!isBlack(m)) n++;
  return Math.max(1, n);
}

/** One friendly line about the child's own instrument, for the start of a song or the song builder. */
export function instrumentHello(inst: InstrumentInfo, lang: Language): string | null {
  if (!inst.set) return null;
  const what = inst.summary || inst.name || inst.label || "";
  if (!what) return null;
  if (inst.stand_in) {
    return L({ en: `We'll learn the notes on the screen keys, then you can find the same sounds on ${what}.`,
      hi: `हम स्क्रीन की कुंजियों पर सुर सीखेंगे, फिर वही आवाज़ें ${what} पर ढूँढना।`,
      hinglish: `Hum screen ki keys pe notes seekhenge, phir wahi awaaz ${what} pe dhoondhna.` }, lang);
  }
  return L({ en: `Get ${what} ready! The keys on the screen are just like yours.`, hi: `${what} तैयार करो! स्क्रीन की कुंजियाँ बिल्कुल तुम्हारी जैसी हैं।`,
    hinglish: `${what} ready karo! Screen ki keys bilkul tumhari jaisi hain.` }, lang);
}
