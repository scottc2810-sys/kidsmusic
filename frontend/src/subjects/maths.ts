// Maths for school classes 1-5 (and pre-school counting), built from the base up, the way strong primary
// teachers do it: concrete first (objects, blocks, a number line), then pictures, then numbers. Every topic
// starts with concept cards that show WHY with a diagram, then short adaptive rounds; every answer comes with
// its reason. Vedic maths and the quick tricks good teachers use have their own strand, each trick shown
// step by step before practising.
// Covers the usual class 1-5 syllabus (NCERT / CBSE "Joyful Mathematics" & "Maths Magic", Common Core K-5):
// numbers and place value, the four operations, fractions, patterns and missing numbers, shapes, symmetry,
// angles, perimeter and area, time, money, length and data.
import type { Text } from "../i18n";

export type Rng = () => number;
export const ri = (rng: Rng, a: number, b: number) => a + Math.floor(rng() * (b - a + 1));
export const pick = <T,>(rng: Rng, xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)];
export function shuffle<T>(rng: Rng, xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
export const T = (en: string, hi?: string, hinglish?: string): Text => ({ en, ...(hi ? { hi } : {}), ...(hinglish ? { hinglish } : {}) });

export type Visual =
  | { type: "objects"; emoji: string; count: number; groups?: number[] }
  | { type: "numberline"; from: number; to: number; start: number; hops: number; step: number }
  | { type: "tensones"; hundreds?: number; tens: number; ones: number }
  | { type: "array"; rows: number; cols: number; emoji: string }
  | { type: "share"; total: number; groups: number; emoji: string }
  | { type: "fraction"; parts: number; shaded: number; shape: "circle" | "bar" }
  | { type: "clock"; h: number; m: number }
  | { type: "coins"; coins: number[] }
  | { type: "bars"; data: { label: string; value: number }[] }
  | { type: "balance"; left: string; right: string }
  | { type: "shape"; sides: number; label?: string; kind?: "square" | "rectangle" | "circle" | "triangle" | "oval" }
  | { type: "pattern"; items: string[] }
  | { type: "symmetry"; cells: boolean[][]; axis: "v" | "h"; half: boolean }
  | { type: "angle"; deg: number }
  | { type: "gridshape"; w: number; h: number }
  | { type: "ruler"; length: number; emoji: string }
  | { type: "compare"; a: number; b: number }
  | { type: "column"; a: number; b: number; op: "+" | "−" | "×" }
  | { type: "steps"; lines: string[] }
  | { type: "diagram"; name: string; show: "names" | "numbers" }
  | { type: "shloka"; id: string }
  | { type: "solid"; kind: "cube" | "cuboid" | "sphere" | "cylinder" | "cone" | "pyramid" };

export interface Exercise {
  prompt: Text; visual?: Visual; choices: string[]; answer: string; why: Text;
  /** Numbers are typed on a number pad when the child is old enough; pictures and words are always picked. */
  numeric?: boolean;
  /** The worked solution, one small step at a time (shown with Next after answering). */
  steps?: Text[];
  /** A real-life application question (counts for the "uses it in real life" result). */
  apply?: boolean;
}
export interface Card { title: Text; say: Text; visual?: Visual }
export type Strand = "numbers" | "algebra" | "geometry" | "measure" | "problems" | "vedic";
export interface Topic {
  id: string; strand: Strand; icon: string; title: Text; grades: [number, number];
  cards: Card[]; make: (d: number, rng: Rng) => Exercise;
}

export const STRANDS: { id: Strand; icon: string; title: Text; about: Text }[] = [
  { id: "numbers", icon: "🔢", title: T("Numbers & arithmetic", "संख्याएँ और गणना", "Numbers aur ganit"), about: T("Counting, place value, + − × ÷, fractions") },
  { id: "algebra", icon: "🧩", title: T("Patterns & algebra", "पैटर्न और बीजगणित", "Patterns aur algebra"), about: T("What comes next, missing numbers, balancing") },
  { id: "geometry", icon: "📐", title: T("Shapes & geometry", "आकृतियाँ और ज्यामिति", "Shapes aur geometry"), about: T("Shapes, symmetry, angles, area and perimeter") },
  { id: "measure", icon: "⏰", title: T("Measuring & data", "मापना और आँकड़े", "Measuring aur data"), about: T("Time, money, length, charts") },
  { id: "problems", icon: "📖", title: T("Story sums & thinking", "कहानी वाले सवाल", "Story sums aur sochna"), about: T("Read a little story, find what to do, solve it") },
  { id: "vedic", icon: "⚡", title: T("Vedic & quick tricks", "वैदिक और तेज़ तरकीबें", "Vedic aur quick tricks"), about: T("Fast mental maths, and why each trick works") },
];

/** 3 or 4 answer options around a number, never negative, always including the answer. */
export function numChoices(rng: Rng, answer: number, spread = 3, n = 3): string[] {
  const set = new Set<number>([answer]);
  let guard = 0;
  while (set.size < n && guard++ < 50) {
    const d = ri(rng, 1, spread) * (rng() < 0.5 ? -1 : 1);
    if (answer + d >= 0) set.add(answer + d);
  }
  return shuffle(rng, [...set].map(String));
}

const EMO = ["🍎", "⭐", "🐟", "🎈", "🌸", "🐥", "🍪", "🚗"];
const ADD_WORDS = ["together", "in all", "altogether"];

// ---------------------------------------------------------------------------------------------------------
const count: Topic = {
  id: "count", strand: "numbers", icon: "🍎", title: T("Counting", "गिनती", "Ginti"), grades: [0, 1],
  cards: [
    { title: T("One number for each thing"), say: T("Touch each thing once and say one number for it: one, two, three. The LAST number you say tells how many there are.", "हर चीज़ को एक बार छुओ और एक संख्या बोलो: एक, दो, तीन। आख़िरी संख्या बताती है कितनी चीज़ें हैं।", "Har cheez ko ek baar chhuo aur ek number bolo: ek, do, teen. Aakhri number batata hai kitni cheezein hain."), visual: { type: "objects", emoji: "🍎", count: 3 } },
    { title: T("Don't count twice"), say: T("Go in a line, left to right, so you never count the same thing twice or miss one.", "एक लाइन में चलो, बाएँ से दाएँ, ताकि कोई चीज़ दो बार न गिनो।", "Ek line mein chalo, left se right, taaki koi cheez do baar na gino."), visual: { type: "objects", emoji: "⭐", count: 5 } },
  ],
  make: (d, rng) => {
    const n = ri(rng, 1, [5, 10, 12, 15, 20][d - 1]);
    const e = pick(rng, EMO);
    return { prompt: T(`How many ${e} are there?`, `कितने ${e} हैं?`, `Kitne ${e} hain?`), visual: { type: "objects", emoji: e, count: n },
      choices: numChoices(rng, n, 2), answer: String(n), numeric: true,
      why: T(`Touch each one and count: the last number is ${n}, so there are ${n}.`, `हर एक को छूकर गिनो: आख़िरी संख्या ${n} है, तो ${n} हैं।`, `Har ek ko chhoo ke gino: last number ${n} hai, toh ${n} hain.`) };
  },
};

const compare: Topic = {
  id: "compare", strand: "numbers", icon: "🐊", title: T("Bigger or smaller", "बड़ा या छोटा", "Bada ya chhota"), grades: [1, 2],
  cards: [
    { title: T("The hungry crocodile"), say: T("The crocodile's mouth always opens towards the BIGGER number, because it wants to eat more! 7 > 3 means 7 is bigger than 3.", "मगरमच्छ का मुँह हमेशा बड़ी संख्या की ओर खुलता है, क्योंकि उसे ज़्यादा खाना है! 7 > 3 मतलब 7 बड़ा है।", "Magarmachh ka munh hamesha BADE number ki taraf khulta hai, kyunki use zyada khaana hai! 7 > 3 matlab 7 bada hai."), visual: { type: "compare", a: 7, b: 3 } },
    { title: T("Same means equal"), say: T("When both sides have the same amount we write = , which means 'equal'.", "जब दोनों तरफ़ बराबर हो तो = लिखते हैं, मतलब 'बराबर'।", "Jab dono taraf barabar ho toh = likhte hain, matlab 'barabar'.") },
  ],
  make: (d, rng) => {
    const max = [10, 20, 50, 100, 1000][d - 1];
    const a = ri(rng, 0, max), b = rng() < 0.15 ? a : ri(rng, 0, max);
    const ans = a > b ? ">" : a < b ? "<" : "=";
    return { prompt: T(`Which sign goes between ${a} and ${b}?`, `${a} और ${b} के बीच कौन सा चिह्न आएगा?`, `${a} aur ${b} ke beech kaunsa sign aayega?`), visual: { type: "compare", a, b },
      choices: [">", "<", "="], answer: ans,
      why: ans === "=" ? T(`${a} and ${b} are the same, so they are equal: =`) : T(`${Math.max(a, b)} is bigger, so the crocodile's mouth opens towards ${Math.max(a, b)}: ${a} ${ans} ${b}.`, `${Math.max(a, b)} बड़ा है, इसलिए मगरमच्छ का मुँह उसकी ओर खुलता है: ${a} ${ans} ${b}।`, `${Math.max(a, b)} bada hai, isliye magarmachh ka munh uski taraf: ${a} ${ans} ${b}.`) };
  },
};

const placeValue: Topic = {
  id: "place_value", strand: "numbers", icon: "🧱", title: T("Tens and ones", "दहाई और इकाई", "Tens aur ones"), grades: [1, 3],
  cards: [
    { title: T("Ten ones make one ten"), say: T("When we have 10 single blocks, we stick them together into one long rod called a TEN. It's easier to count big numbers in tens.", "जब 10 अकेले ब्लॉक हों, उन्हें जोड़कर एक लंबी छड़ बनाते हैं, जिसे दहाई कहते हैं। बड़ी संख्याएँ दहाई में गिनना आसान है।", "Jab 10 single blocks hon, unhe jod ke ek lambi rod banate hain, jise TEN kehte hain. Bade numbers tens mein ginna easy hai."), visual: { type: "tensones", tens: 1, ones: 0 } },
    { title: T("Where a digit sits tells its value"), say: T("In 34, the 3 sits in the tens place, so it means 3 tens = 30. The 4 is in the ones place, so it is just 4. 30 + 4 = 34.", "34 में 3 दहाई के स्थान पर है, मतलब 3 दहाई = 30। 4 इकाई के स्थान पर, यानी 4। 30 + 4 = 34।", "34 mein 3 tens ki jagah pe hai, matlab 3 tens = 30. 4 ones ki jagah pe, yaani 4. 30 + 4 = 34."), visual: { type: "tensones", tens: 3, ones: 4 } },
  ],
  make: (d, rng) => {
    const big = d >= 4;
    const h = big ? ri(rng, 1, 9) : 0, t = ri(rng, 1, 9), o = ri(rng, 0, 9);
    const n = h * 100 + t * 10 + o;
    const ask = pick(rng, big ? ["number", "tens", "hundreds"] as const : ["number", "tens", "ones"] as const);
    const ans = ask === "number" ? n : ask === "tens" ? t : ask === "hundreds" ? h : o;
    const prompt = ask === "number" ? T("What number do these blocks make?", "ये ब्लॉक कौन सी संख्या बनाते हैं?", "Ye blocks kaunsa number banate hain?")
      : T(`How many ${ask} are in ${n}?`, `${n} में कितने ${ask === "tens" ? "दहाई" : ask === "ones" ? "इकाई" : "सैकड़े"} हैं?`, `${n} mein kitne ${ask} hain?`);
    return { prompt, visual: { type: "tensones", hundreds: h || undefined, tens: t, ones: o }, choices: numChoices(rng, ans, ask === "number" ? 10 : 2), answer: String(ans), numeric: true,
      why: T(`${h ? `${h} hundreds = ${h * 100}, ` : ""}${t} tens = ${t * 10} and ${o} ones = ${o}. Together: ${n}.`, `${h ? `${h} सैकड़े = ${h * 100}, ` : ""}${t} दहाई = ${t * 10} और ${o} इकाई = ${o}। कुल: ${n}।`, `${h ? `${h} hundreds = ${h * 100}, ` : ""}${t} tens = ${t * 10} aur ${o} ones = ${o}. Total: ${n}.`) };
  },
};

const addition: Topic = {
  id: "addition", strand: "numbers", icon: "➕", title: T("Adding", "जोड़", "Jod"), grades: [1, 3],
  cards: [
    { title: T("Adding means putting together"), say: T("2 apples and 3 apples put together make 5 apples. Plus (+) means 'put together'.", "2 सेब और 3 सेब मिलाकर 5 सेब। धन (+) मतलब 'मिलाना'।", "2 apple aur 3 apple milake 5 apple. Plus (+) matlab 'milana'."), visual: { type: "objects", emoji: "🍎", count: 5, groups: [2, 3] } },
    { title: T("Count on from the bigger number"), say: T("For 6 + 3, start at 6 and hop 3 steps forward on the number line: 7, 8, 9. Starting from the bigger number means fewer hops!", "6 + 3 के लिए 6 से शुरू करो और संख्या रेखा पर 3 क़दम आगे: 7, 8, 9। बड़ी संख्या से शुरू करने पर कम क़दम लगते हैं!", "6 + 3 ke liye 6 se shuru karo aur number line pe 3 hop aage: 7, 8, 9. Bade number se shuru karne pe kam hops!"), visual: { type: "numberline", from: 0, to: 10, start: 6, hops: 3, step: 1 } },
    { title: T("Make a ten (carrying)"), say: T("When the ones add up to 10 or more, 10 ones become 1 ten, and we carry it to the tens column. That's why we write a small 1 on top.", "जब इकाइयाँ 10 या ज़्यादा हो जाएँ, 10 इकाई 1 दहाई बन जाती है, और हम उसे दहाई वाले कॉलम में ले जाते हैं।", "Jab ones 10 ya zyada ho jaayein, 10 ones 1 ten ban jaate hain, aur hum use tens column mein carry karte hain."), visual: { type: "column", a: 27, b: 15, op: "+" } },
  ],
  make: (d, rng) => {
    const max = [5, 10, 20, 100, 1000][d - 1];
    const a = ri(rng, 1, max), b = ri(rng, 1, Math.max(1, max - (d <= 2 ? a : 0)));
    const s = a + b, e = pick(rng, EMO);
    const carry = (a % 10) + (b % 10) >= 10;
    const visual: Visual = d <= 2 ? { type: "objects", emoji: e, count: s, groups: [a, b] } : d === 3 ? { type: "numberline", from: 0, to: 20, start: Math.max(a, b), hops: Math.min(a, b), step: 1 } : { type: "column", a, b, op: "+" };
    return { prompt: T(`${a} + ${b} = ?`), visual, choices: numChoices(rng, s, d <= 2 ? 2 : 10), answer: String(s), numeric: true,
      why: d <= 3 ? T(`Start at ${Math.max(a, b)} and count on ${Math.min(a, b)} more: you land on ${s}. ${pick(rng, ADD_WORDS)} that's ${s}.`, `${Math.max(a, b)} से शुरू करो और ${Math.min(a, b)} आगे गिनो: ${s} पर पहुँचे।`, `${Math.max(a, b)} se shuru karo aur ${Math.min(a, b)} aage gino: ${s} pe pahunche.`)
        : T(`Add the ones first: ${a % 10} + ${b % 10} = ${(a % 10) + (b % 10)}${carry ? " (that's 10 or more, so carry 1 ten)" : ""}. Then the tens. Total: ${s}.`, `पहले इकाई जोड़ो: ${a % 10} + ${b % 10} = ${(a % 10) + (b % 10)}${carry ? " (10 या ज़्यादा, तो 1 दहाई हासिल)" : ""}। फिर दहाई। कुल: ${s}।`, `Pehle ones jodo: ${a % 10} + ${b % 10} = ${(a % 10) + (b % 10)}${carry ? " (10 ya zyada, toh 1 ten carry)" : ""}. Phir tens. Total: ${s}.`) };
  },
};

const subtraction: Topic = {
  id: "subtraction", strand: "numbers", icon: "➖", title: T("Taking away", "घटाना", "Ghatana"), grades: [1, 3],
  cards: [
    { title: T("Minus means take away"), say: T("5 birds sit on a tree, 2 fly away. 5 − 2 = 3 birds are left. Minus (−) means 'take away'.", "पेड़ पर 5 चिड़ियाँ, 2 उड़ गईं। 5 − 2 = 3 बचीं। ऋण (−) मतलब 'हटाना'।", "Ped pe 5 chidiya, 2 ud gayi. 5 − 2 = 3 bachi. Minus (−) matlab 'hatana'."), visual: { type: "objects", emoji: "🐦", count: 5, groups: [3, 2] } },
    { title: T("Hop back on the number line"), say: T("For 9 − 4, start at 9 and hop 4 steps BACK: 8, 7, 6, 5. Back means smaller, because we took some away.", "9 − 4 के लिए 9 से 4 क़दम पीछे: 8, 7, 6, 5। पीछे मतलब कम, क्योंकि कुछ हटाया।", "9 − 4 ke liye 9 se 4 hop PEECHE: 8, 7, 6, 5. Peeche matlab kam, kyunki kuch hataya."), visual: { type: "numberline", from: 0, to: 10, start: 9, hops: 4, step: -1 } },
    { title: T("Borrowing a ten"), say: T("In 42 − 17, we can't take 7 ones from 2 ones. So we open one ten into 10 ones: now 12 ones − 7 = 5, and 3 tens − 1 ten = 2 tens. Answer 25.", "42 − 17 में 2 इकाई से 7 नहीं हटा सकते। तो एक दहाई खोलकर 10 इकाई बनाते हैं: 12 − 7 = 5, और 3 − 1 = 2 दहाई। उत्तर 25।", "42 − 17 mein 2 ones se 7 nahi hata sakte. Toh ek ten khol ke 10 ones: 12 − 7 = 5, aur 3 − 1 = 2 tens. Answer 25."), visual: { type: "column", a: 42, b: 17, op: "−" } },
  ],
  make: (d, rng) => {
    const max = [5, 10, 20, 100, 1000][d - 1];
    const a = ri(rng, 2, max), b = ri(rng, 1, a - 1 || 1), r = a - b;
    const visual: Visual = d <= 2 ? { type: "objects", emoji: pick(rng, EMO), count: a, groups: [r, b] } : d === 3 ? { type: "numberline", from: 0, to: 20, start: a, hops: b, step: -1 } : { type: "column", a, b, op: "−" };
    const borrow = a % 10 < b % 10;
    return { prompt: T(`${a} − ${b} = ?`), visual, choices: numChoices(rng, r, d <= 2 ? 2 : 10), answer: String(r), numeric: true,
      why: d <= 3 ? T(`Start at ${a} and go back ${b}: you land on ${r}. Check: ${r} + ${b} = ${a}.`, `${a} से ${b} पीछे जाओ: ${r} पर पहुँचे। जाँचो: ${r} + ${b} = ${a}।`, `${a} se ${b} peeche jao: ${r} pe pahunche. Check: ${r} + ${b} = ${a}.`)
        : T(`${borrow ? `${a % 10} is smaller than ${b % 10}, so borrow a ten. ` : ""}Ones first, then tens. Answer ${r}. Check by adding back: ${r} + ${b} = ${a}.`, `${borrow ? `${a % 10}, ${b % 10} से छोटा है, तो एक दहाई उधार लो। ` : ""}पहले इकाई, फिर दहाई। उत्तर ${r}। जोड़कर जाँचो: ${r} + ${b} = ${a}।`, `${borrow ? `${a % 10}, ${b % 10} se chhota hai, toh ek ten borrow karo. ` : ""}Pehle ones, phir tens. Answer ${r}. Jod ke check karo: ${r} + ${b} = ${a}.`) };
  },
};

const skip: Topic = {
  id: "skip_count", strand: "numbers", icon: "🦘", title: T("Skip counting", "उछल-गिनती", "Skip counting"), grades: [1, 2],
  cards: [{ title: T("Jump instead of walk"), say: T("Counting by 2s, 5s or 10s is like a kangaroo jumping: 5, 10, 15, 20. It's much faster than counting one by one, and it's the secret behind times tables!", "2, 5 या 10 के हिसाब से गिनना कंगारू की छलाँग जैसा है: 5, 10, 15, 20। एक-एक गिनने से तेज़, और यही पहाड़ों का राज़ है!", "2, 5 ya 10 se ginna kangaroo ki chhalaang jaisa hai: 5, 10, 15, 20. Ek-ek ginne se fast, aur yahi tables ka secret hai!"), visual: { type: "numberline", from: 0, to: 20, start: 0, hops: 4, step: 5 } }],
  make: (d, rng) => {
    const step = pick(rng, d <= 2 ? [2, 10] : [2, 5, 10, 3, 4]);
    const start = step * ri(rng, 0, 4);
    const seq = [0, 1, 2, 3].map((i) => start + i * step);
    const ans = start + 4 * step;
    return { prompt: T(`What comes next? ${seq.join(", ")}, ?`, `आगे क्या आएगा? ${seq.join(", ")}, ?`, `Aage kya aayega? ${seq.join(", ")}, ?`), visual: { type: "numberline", from: start, to: ans + step, start, hops: 4, step },
      choices: numChoices(rng, ans, step), answer: String(ans), numeric: true,
      why: T(`Each jump adds ${step}: ${seq[3]} + ${step} = ${ans}.`, `हर छलाँग में ${step} जुड़ता है: ${seq[3]} + ${step} = ${ans}।`, `Har jump mein ${step} judta hai: ${seq[3]} + ${step} = ${ans}.`) };
  },
};

const multiplication: Topic = {
  id: "multiplication", strand: "numbers", icon: "✖️", title: T("Multiplying", "गुणा", "Guna"), grades: [2, 4],
  cards: [
    { title: T("Times means groups of"), say: T("3 × 4 means 3 groups of 4. Instead of adding 4 + 4 + 4, we multiply. It's a shortcut for adding the same number again and again.", "3 × 4 मतलब 4-4 के 3 समूह। 4 + 4 + 4 जोड़ने की बजाय गुणा करते हैं। बार-बार एक ही संख्या जोड़ने का छोटा रास्ता।", "3 × 4 matlab 4-4 ke 3 group. 4 + 4 + 4 jodne ki jagah guna karte hain. Baar-baar same number jodne ka shortcut."), visual: { type: "array", rows: 3, cols: 4, emoji: "🍪" } },
    { title: T("Turn it around"), say: T("3 rows of 4 is the same as 4 rows of 3: turn the picture sideways and nothing changes. So if you know 3 × 4, you also know 4 × 3!", "4 की 3 पंक्तियाँ = 3 की 4 पंक्तियाँ: चित्र घुमाओ, कुछ नहीं बदलता। तो 3 × 4 आता है तो 4 × 3 भी आता है!", "4 ki 3 rows = 3 ki 4 rows: picture ghumao, kuch nahi badalta. Toh 3 × 4 aata hai toh 4 × 3 bhi aata hai!"), visual: { type: "array", rows: 4, cols: 3, emoji: "🍪" } },
  ],
  make: (d, rng) => {
    const a = ri(rng, 2, [3, 5, 10, 12, 20][d - 1]), b = ri(rng, 2, [3, 5, 10, 10, 12][d - 1]);
    const p = a * b;
    return { prompt: T(`${a} × ${b} = ?`), visual: d <= 3 ? { type: "array", rows: a, cols: b, emoji: pick(rng, EMO) } : d === 5 ? { type: "column", a, b, op: "×" } : undefined,
      choices: numChoices(rng, p, Math.max(2, b)), answer: String(p), numeric: true,
      why: T(`${a} groups of ${b}: ${Array(Math.min(a, 6)).fill(b).join(" + ")}${a > 6 ? " + …" : ""} = ${p}.`, `${b} के ${a} समूह: ${Array(Math.min(a, 6)).fill(b).join(" + ")}${a > 6 ? " + …" : ""} = ${p}।`, `${b} ke ${a} group: ${Array(Math.min(a, 6)).fill(b).join(" + ")}${a > 6 ? " + …" : ""} = ${p}.`) };
  },
};

const division: Topic = {
  id: "division", strand: "numbers", icon: "➗", title: T("Sharing (division)", "बाँटना (भाग)", "Baantna (bhaag)"), grades: [3, 4],
  cards: [
    { title: T("Division is fair sharing"), say: T("12 sweets shared equally by 3 friends: give one to each friend again and again. Each gets 4. 12 ÷ 3 = 4.", "12 मिठाइयाँ 3 दोस्तों में बराबर: हर दोस्त को एक-एक देते जाओ। हर एक को 4। 12 ÷ 3 = 4।", "12 mithaiyan 3 doston mein barabar: har dost ko ek-ek dete jao. Har ek ko 4. 12 ÷ 3 = 4."), visual: { type: "share", total: 12, groups: 3, emoji: "🍬" } },
    { title: T("Division undoes multiplication"), say: T("If 3 × 4 = 12, then 12 ÷ 3 = 4. Knowing your tables makes division easy!", "अगर 3 × 4 = 12, तो 12 ÷ 3 = 4। पहाड़े आते हैं तो भाग आसान है!", "Agar 3 × 4 = 12, toh 12 ÷ 3 = 4. Tables aate hain toh bhaag easy hai!") },
  ],
  make: (d, rng) => {
    const g = ri(rng, 2, [3, 5, 6, 9, 12][d - 1]), each = ri(rng, 1, [4, 5, 10, 10, 12][d - 1]);
    const total = g * each;
    return { prompt: T(`${total} ÷ ${g} = ?`), visual: d <= 3 ? { type: "share", total, groups: g, emoji: pick(rng, ["🍬", "🍪", "🍓", "⭐"]) } : undefined,
      choices: numChoices(rng, each, 2), answer: String(each), numeric: true,
      why: T(`Share ${total} into ${g} equal groups: each gets ${each}, because ${g} × ${each} = ${total}.`, `${total} को ${g} बराबर हिस्सों में बाँटो: हर एक को ${each}, क्योंकि ${g} × ${each} = ${total}।`, `${total} ko ${g} barabar hisson mein baanto: har ek ko ${each}, kyunki ${g} × ${each} = ${total}.`) };
  },
};

const fractions: Topic = {
  id: "fractions", strand: "numbers", icon: "🍕", title: T("Fractions", "भिन्न", "Fractions"), grades: [2, 5],
  cards: [
    { title: T("Equal parts"), say: T("A fraction is a part of a whole cut into EQUAL pieces. Cut a pizza into 4 equal slices; one slice is one quarter, written 1/4.", "भिन्न किसी पूरी चीज़ के बराबर टुकड़ों का हिस्सा है। पिज़्ज़ा के 4 बराबर टुकड़े; एक टुकड़ा एक चौथाई, 1/4।", "Fraction kisi poori cheez ke BARABAR tukdon ka hissa hai. Pizza ke 4 barabar slice; ek slice ek quarter, 1/4."), visual: { type: "fraction", parts: 4, shaded: 1, shape: "circle" } },
    { title: T("Top and bottom"), say: T("The bottom number says how many equal parts the whole has. The top number says how many parts we take. 3/4 = 3 of 4 parts.", "नीचे की संख्या बताती है कितने बराबर हिस्से हैं। ऊपर की संख्या बताती है कितने लिए। 3/4 = 4 में से 3।", "Neeche ka number batata hai kitne barabar hisse hain. Upar ka number batata hai kitne liye. 3/4 = 4 mein se 3."), visual: { type: "fraction", parts: 4, shaded: 3, shape: "bar" } },
  ],
  make: (d, rng) => {
    const parts = pick(rng, d <= 2 ? [2, 4] : [2, 3, 4, 5, 6, 8]);
    const shaded = ri(rng, 1, parts - 1);
    const ans = `${shaded}/${parts}`;
    const others = shuffle(rng, [`${parts - shaded}/${parts}`, `${shaded}/${parts + 1}`, `${parts}/${shaded}`].filter((x) => x !== ans)).slice(0, 2);
    return { prompt: T("What fraction is coloured?", "कितना भाग रंगा है?", "Kitna hissa rangin hai?"), visual: { type: "fraction", parts, shaded, shape: rng() < 0.5 ? "circle" : "bar" },
      choices: shuffle(rng, [ans, ...others]), answer: ans,
      why: T(`The whole has ${parts} equal parts (bottom number), and ${shaded} are coloured (top number): ${ans}.`, `पूरे में ${parts} बराबर हिस्से (नीचे), और ${shaded} रंगे हैं (ऊपर): ${ans}।`, `Poore mein ${parts} barabar hisse (neeche), aur ${shaded} rangin (upar): ${ans}.`) };
  },
};

const evenOdd: Topic = {
  id: "even_odd", strand: "numbers", icon: "🧦", title: T("Even and odd", "सम और विषम", "Even aur odd"), grades: [1, 2],
  cards: [{ title: T("Can everyone get a partner?"), say: T("Put things in pairs, like socks. If every one has a partner, the number is EVEN. If one is left alone, it's ODD. Even numbers end in 0, 2, 4, 6 or 8.", "चीज़ों को जोड़ों में रखो, जैसे मोज़े। सबका साथी हो तो संख्या सम। एक अकेला बचे तो विषम। सम संख्याएँ 0, 2, 4, 6, 8 पर ख़त्म होती हैं।", "Cheezon ko pairs mein rakho, jaise mooze. Sabka partner ho toh EVEN. Ek akela bache toh ODD. Even numbers 0, 2, 4, 6, 8 pe khatam hote hain."), visual: { type: "objects", emoji: "🧦", count: 7, groups: [6, 1] } }],
  make: (d, rng) => {
    const n = ri(rng, 1, [10, 20, 50, 100, 1000][d - 1]);
    const even = n % 2 === 0;
    return { prompt: T(`Is ${n} even or odd?`, `${n} सम है या विषम?`, `${n} even hai ya odd?`), visual: n <= 20 ? { type: "objects", emoji: "🧦", count: n, groups: even ? [n] : [n - 1, 1] } : undefined,
      choices: ["even", "odd"], answer: even ? "even" : "odd",
      why: T(`${n} ends in ${n % 10}. ${even ? "0, 2, 4, 6, 8 at the end means every one has a partner: even." : "1, 3, 5, 7, 9 at the end means one is left without a partner: odd."}`) };
  },
};

// --- patterns & algebra ---------------------------------------------------------------------------------
const patterns: Topic = {
  id: "patterns", strand: "algebra", icon: "🔁", title: T("What comes next?", "आगे क्या आएगा?", "Aage kya aayega?"), grades: [0, 2],
  cards: [{ title: T("A pattern repeats"), say: T("A pattern is something that repeats, like red, blue, red, blue. Find the part that repeats, and you can always say what comes next. Algebra starts with patterns!", "पैटर्न वो है जो दोहराता है, जैसे लाल, नीला, लाल, नीला। दोहराने वाला हिस्सा ढूँढो, तो हमेशा बता सकते हो आगे क्या है। बीजगणित पैटर्न से शुरू होता है!", "Pattern woh hai jo repeat hota hai, jaise laal, neela, laal, neela. Repeat wala hissa dhoondho, toh hamesha bata sakte ho aage kya hai. Algebra patterns se shuru hota hai!"), visual: { type: "pattern", items: ["🔴", "🔵", "🔴", "🔵", "❓"] } }],
  make: (d, rng) => {
    const sets = [["🔴", "🔵", "🟢"], ["🐱", "🐶", "🐰"], ["⭐", "🌙", "☀️"], ["🔺", "⬛", "⚪"]];
    const s = pick(rng, sets);
    const unit = d <= 1 ? [s[0], s[1]] : d === 2 ? [s[0], s[0], s[1]] : [s[0], s[1], s[2]];
    const shown = Array.from({ length: unit.length * 2 + 1 }, (_, i) => unit[i % unit.length]);
    const ans = unit[shown.length % unit.length];
    return { prompt: T("What comes next?", "आगे क्या आएगा?", "Aage kya aayega?"), visual: { type: "pattern", items: [...shown, "❓"] },
      choices: shuffle(rng, [...s]),
      answer: ans, why: T(`The part that repeats is ${unit.join(" ")}. After ${shown[shown.length - 1]} comes ${ans}.`, `दोहराने वाला हिस्सा ${unit.join(" ")} है। ${shown[shown.length - 1]} के बाद ${ans} आता है।`, `Repeat wala hissa ${unit.join(" ")} hai. ${shown[shown.length - 1]} ke baad ${ans} aata hai.`) };
  },
};

const missing: Topic = {
  id: "missing_number", strand: "algebra", icon: "📦", title: T("The missing number", "छुपी संख्या", "Chhupa number"), grades: [1, 4],
  cards: [{ title: T("A box hides a number"), say: T("3 + □ = 7. Something is hiding in the box! Think: 3 and how many more make 7? Count on from 3 to 7: 4 more. This box is the 'x' grown-ups use in algebra.", "3 + □ = 7। डिब्बे में कुछ छुपा है! सोचो: 3 और कितने मिलकर 7? 3 से 7 तक गिनो: 4। यही डिब्बा बड़ों के बीजगणित का 'x' है।", "3 + □ = 7. Box mein kuch chhupa hai! Socho: 3 aur kitne milke 7? 3 se 7 tak gino: 4. Yahi box bado ke algebra ka 'x' hai."), visual: { type: "balance", left: "3 + □", right: "7" } }],
  make: (d, rng) => {
    const op = d >= 3 && rng() < 0.4 ? "×" : rng() < 0.5 ? "+" : "−";
    let a: number, x: number, c: number, text: string, why: Text;
    if (op === "×") { a = ri(rng, 2, 9); x = ri(rng, 2, 9); c = a * x; text = `${a} × □ = ${c}`; why = T(`${a} times what makes ${c}? ${c} ÷ ${a} = ${x}. Check: ${a} × ${x} = ${c}.`); }
    else if (op === "+") { a = ri(rng, 1, [5, 10, 20, 50, 100][d - 1]); x = ri(rng, 1, [5, 10, 20, 50, 100][d - 1]); c = a + x; text = `${a} + □ = ${c}`; why = T(`From ${a}, count on to ${c}: that's ${x} more. Or: ${c} − ${a} = ${x}.`, `${a} से ${c} तक गिनो: ${x} और। या: ${c} − ${a} = ${x}।`, `${a} se ${c} tak gino: ${x} aur. Ya: ${c} − ${a} = ${x}.`); }
    else { c = ri(rng, 1, [5, 10, 20, 50, 100][d - 1]); x = ri(rng, 1, [5, 10, 20, 50, 100][d - 1]); a = c + x; text = `${a} − □ = ${c}`; why = T(`${a} take away what leaves ${c}? ${a} − ${c} = ${x}.`, `${a} में से कितना हटाएँ कि ${c} बचे? ${a} − ${c} = ${x}।`, `${a} mein se kitna hatayein ki ${c} bache? ${a} − ${c} = ${x}.`); }
    return { prompt: T(`What is in the box? ${text}`, `डिब्बे में क्या है? ${text}`, `Box mein kya hai? ${text}`), visual: { type: "balance", left: text.split(" = ")[0], right: text.split(" = ")[1] },
      choices: numChoices(rng, x, 3), answer: String(x), numeric: true, why };
  },
};

const balance: Topic = {
  id: "balance", strand: "algebra", icon: "⚖️", title: T("Balance the scale", "तराज़ू बराबर करो", "Taraazu barabar karo"), grades: [3, 5],
  cards: [{ title: T("Both sides must weigh the same"), say: T("= is like a balance scale: both sides must be equal. If you take 2 from one side, take 2 from the other too, and it stays balanced. That's how we find x!", "= तराज़ू जैसा है: दोनों तरफ़ बराबर। एक तरफ़ से 2 हटाओ तो दूसरी तरफ़ से भी 2, तब बराबर रहता है। ऐसे ही x ढूँढते हैं!", "= taraazu jaisa hai: dono taraf barabar. Ek taraf se 2 hatao toh doosri taraf se bhi 2, tab barabar rehta hai. Aise hi x dhoondhte hain!"), visual: { type: "balance", left: "x + 2", right: "5" } }],
  make: (d, rng) => {
    const x = ri(rng, 1, [5, 9, 12, 15, 20][d - 1]), k = ri(rng, 1, 9), m = d >= 4 ? ri(rng, 2, 4) : 1;
    const right = m * x + k;
    const left = `${m > 1 ? m : ""}x + ${k}`;
    return { prompt: T(`Find x: ${left} = ${right}`, `x ढूँढो: ${left} = ${right}`, `x dhoondho: ${left} = ${right}`), visual: { type: "balance", left, right: String(right) },
      choices: numChoices(rng, x, 3), answer: String(x), numeric: true,
      why: T(`Take ${k} from both sides: ${m > 1 ? m : ""}x = ${right - k}.${m > 1 ? ` Share by ${m}: x = ${x}.` : ""} Check: ${m > 1 ? `${m} × ` : ""}${x} + ${k} = ${right}.`) };
  },
};

// --- geometry -------------------------------------------------------------------------------------------
const SHAPES: { name: string; sides: number; kind?: "square" | "rectangle" | "circle" | "triangle" | "oval"; hi: string; fact: string }[] = [
  { name: "circle", sides: 0, kind: "circle", hi: "वृत्त", fact: "no straight sides and no corners: it's perfectly round, every point is the same distance from the middle" },
  { name: "triangle", sides: 3, kind: "triangle", hi: "त्रिभुज", fact: "3 straight sides and 3 corners" },
  { name: "square", sides: 4, kind: "square", hi: "वर्ग", fact: "4 EQUAL sides and 4 square corners" },
  { name: "rectangle", sides: 4, kind: "rectangle", hi: "आयत", fact: "4 sides, opposite sides equal, and 4 square corners" },
  { name: "pentagon", sides: 5, hi: "पंचभुज", fact: "5 sides and 5 corners" },
  { name: "hexagon", sides: 6, hi: "षट्भुज", fact: "6 sides and 6 corners, like a honeycomb cell" },
  { name: "oval", sides: 0, kind: "oval", hi: "अंडाकार", fact: "round like a stretched circle, no corners" },
];
const shapes: Topic = {
  id: "shapes", strand: "geometry", icon: "🔺", title: T("Shapes", "आकृतियाँ", "Shapes"), grades: [0, 2],
  cards: [
    { title: T("Count sides and corners"), say: T("We know a shape by counting its straight sides and its corners. A triangle has 3 of each, a square 4. 'Tri' means three!", "आकृति को उसकी सीधी भुजाएँ और कोने गिनकर पहचानते हैं। त्रिभुज में 3-3, वर्ग में 4। 'त्रि' मतलब तीन!", "Shape ko uski seedhi sides aur corners gin ke pehchaante hain. Triangle mein 3-3, square mein 4. 'Tri' matlab teen!"), visual: { type: "shape", sides: 3, kind: "triangle" } },
    { title: T("Square or rectangle?"), say: T("Both have 4 square corners. A square's 4 sides are all equal; a rectangle has 2 long and 2 short sides.", "दोनों में 4 सीधे कोने। वर्ग की चारों भुजाएँ बराबर; आयत में 2 लंबी और 2 छोटी।", "Dono mein 4 seedhe corner. Square ki chaaron sides barabar; rectangle mein 2 lambi aur 2 chhoti."), visual: { type: "shape", sides: 4, kind: "rectangle" } },
  ],
  make: (d, rng) => {
    const pool = SHAPES.slice(0, d <= 1 ? 4 : 7);
    const s = pick(rng, pool);
    const ask = d >= 3 && s.sides > 0 && rng() < 0.5;
    if (ask) return { prompt: T(`How many corners does a ${s.name} have?`, `${s.hi} के कितने कोने होते हैं?`, `${s.name} ke kitne corner hote hain?`), visual: { type: "shape", sides: s.sides, kind: s.kind },
      choices: numChoices(rng, s.sides, 2), answer: String(s.sides), numeric: true, why: T(`A ${s.name} has ${s.fact}.`) };
    const opts = shuffle(rng, [s, ...shuffle(rng, pool.filter((x) => x.name !== s.name)).slice(0, 2)]);
    return { prompt: T("What is this shape called?", "इस आकृति का नाम क्या है?", "Is shape ka naam kya hai?"), visual: { type: "shape", sides: s.sides, kind: s.kind },
      choices: opts.map((x) => x.name), answer: s.name, why: T(`It has ${s.fact}, so it's a ${s.name}.`) };
  },
};

function symGrid(rng: Rng, n: number): boolean[][] {
  const g = Array.from({ length: n }, () => Array(n).fill(false));
  for (let r = 0; r < n; r++) for (let c = 0; c < n / 2; c++) if (rng() < 0.45) { g[r][c] = true; g[r][n - 1 - c] = true; }
  return g;
}
const symmetry: Topic = {
  id: "symmetry", strand: "geometry", icon: "🦋", title: T("Symmetry", "सममिति", "Symmetry"), grades: [2, 4],
  cards: [{ title: T("A mirror line"), say: T("A shape is symmetrical when one half is the mirror picture of the other half, like a butterfly's wings. Fold it on the line and both halves match exactly.", "जब एक आधा दूसरे आधे का दर्पण चित्र हो, जैसे तितली के पंख, तब आकृति सममित है। रेखा पर मोड़ो तो दोनों हिस्से मिल जाते हैं।", "Jab ek aadha doosre aadhe ka mirror picture ho, jaise titli ke pankh, tab shape symmetrical hai. Line pe modo toh dono hisse mil jaate hain."), visual: { type: "symmetry", cells: [[true, false, false, true], [true, true, true, true], [false, true, true, false], [false, true, true, false]], axis: "v", half: false } }],
  make: (d, rng) => {
    const g = symGrid(rng, d <= 2 ? 4 : 6);
    const broken = rng() < 0.5;
    if (broken) { const r = ri(rng, 0, g.length - 1), c = ri(rng, 0, g.length / 2 - 1); g[r][c] = !g[r][c]; }
    return { prompt: T("Is this picture symmetrical about the dotted line?", "क्या यह चित्र बिंदु-रेखा पर सममित है?", "Kya yeh picture dotted line pe symmetrical hai?"), visual: { type: "symmetry", cells: g, axis: "v", half: false },
      choices: ["yes", "no"], answer: broken ? "no" : "yes",
      why: broken ? T("One square on the left has no matching square in the same place on the right, so the halves don't match: not symmetrical.") : T("Every coloured square on the left has a twin in the mirror place on the right: symmetrical.") };
  },
};

const angles: Topic = {
  id: "angles", strand: "geometry", icon: "📐", title: T("Angles", "कोण", "Angles"), grades: [4, 5],
  cards: [{ title: T("How wide is the turn?"), say: T("An angle measures how much a line turns. A square corner is a RIGHT angle (90°). Smaller than that is ACUTE (sharp, like a beak). Bigger is OBTUSE (wide open, like a reclining chair).", "कोण बताता है रेखा कितना मुड़ी। वर्ग का कोना समकोण (90°)। उससे छोटा न्यून कोण (चोंच जैसा नुकीला)। बड़ा अधिक कोण (खुली कुर्सी जैसा)।", "Angle batata hai line kitna mudi. Square ka corner RIGHT angle (90°). Usse chhota ACUTE (chonch jaisa nukeela). Bada OBTUSE (khuli kursi jaisa)."), visual: { type: "angle", deg: 90 } }],
  make: (_d, rng) => {
    const kind = pick(rng, ["acute", "right", "obtuse"] as const);
    const deg = kind === "right" ? 90 : kind === "acute" ? ri(rng, 20, 75) : ri(rng, 105, 165);
    return { prompt: T("What kind of angle is this?", "यह कौन सा कोण है?", "Yeh kaunsa angle hai?"), visual: { type: "angle", deg }, choices: ["acute", "right", "obtuse"], answer: kind,
      why: T(kind === "right" ? "It's exactly a square corner (90°): a right angle." : kind === "acute" ? `It's sharper than a square corner (${deg}° < 90°): acute.` : `It's wider than a square corner (${deg}° > 90°): obtuse.`) };
  },
};

const areaPerimeter: Topic = {
  id: "area_perimeter", strand: "geometry", icon: "🟩", title: T("Area & perimeter", "क्षेत्रफल और परिमाप", "Area aur perimeter"), grades: [3, 5],
  cards: [
    { title: T("Perimeter: walk around the edge"), say: T("Perimeter is how far an ant walks all the way around a shape. Add up all the sides. For a 4 by 3 rectangle: 4 + 3 + 4 + 3 = 14.", "परिमाप वह दूरी है जो चींटी आकृति के चारों ओर चलती है। सारी भुजाएँ जोड़ो। 4 गुणा 3 आयत: 4 + 3 + 4 + 3 = 14।", "Perimeter woh doori hai jo cheenti shape ke chaaron taraf chalti hai. Saari sides jodo. 4 by 3 rectangle: 4 + 3 + 4 + 3 = 14."), visual: { type: "gridshape", w: 4, h: 3 } },
    { title: T("Area: squares inside"), say: T("Area is how many little squares fit INSIDE. 4 squares in each row, 3 rows: 4 × 3 = 12 squares. That's why area of a rectangle = length × width.", "क्षेत्रफल बताता है अंदर कितने छोटे वर्ग आते हैं। हर पंक्ति में 4, 3 पंक्तियाँ: 4 × 3 = 12। इसीलिए आयत का क्षेत्रफल = लंबाई × चौड़ाई।", "Area batata hai andar kitne chhote square aate hain. Har row mein 4, 3 rows: 4 × 3 = 12. Isiliye rectangle ka area = length × width."), visual: { type: "gridshape", w: 4, h: 3 } },
  ],
  make: (d, rng) => {
    const w = ri(rng, 2, [4, 5, 6, 8, 10][d - 1]), h = ri(rng, 1, [3, 4, 5, 6, 8][d - 1]);
    const area = rng() < 0.5;
    const ans = area ? w * h : 2 * (w + h);
    return { prompt: area ? T(`What is the AREA of this ${w} by ${h} rectangle (in squares)?`) : T(`What is the PERIMETER of this ${w} by ${h} rectangle?`), visual: { type: "gridshape", w, h },
      choices: numChoices(rng, ans, 4), answer: String(ans), numeric: true,
      why: area ? T(`${h} rows of ${w} squares: ${w} × ${h} = ${ans} squares inside.`) : T(`Walk around: ${w} + ${h} + ${w} + ${h} = ${ans}. (Or 2 × (${w} + ${h}).)`) };
  },
};

// --- measuring & data -----------------------------------------------------------------------------------
const time: Topic = {
  id: "time", strand: "measure", icon: "⏰", title: T("Telling time", "समय देखना", "Time dekhna"), grades: [1, 4],
  cards: [
    { title: T("Two hands"), say: T("The SHORT hand shows the hour. The LONG hand shows the minutes. When the long hand points straight up at 12, it's exactly 'o'clock'.", "छोटी सुई घंटा बताती है, बड़ी सुई मिनट। जब बड़ी सुई सीधे 12 पर हो, तो ठीक 'बजे' होते हैं।", "Chhoti sui ghanta batati hai, badi sui minute. Jab badi sui seedhe 12 pe ho, toh theek 'baje' hote hain."), visual: { type: "clock", h: 3, m: 0 } },
    { title: T("Each number is 5 minutes"), say: T("The long hand takes 5 minutes to move from one number to the next. So at 6 it's 30 minutes: half past!", "बड़ी सुई को एक अंक से अगले तक जाने में 5 मिनट लगते हैं। 6 पर 30 मिनट: साढ़े!", "Badi sui ko ek number se agle tak 5 minute lagte hain. 6 pe 30 minute: half past!"), visual: { type: "clock", h: 4, m: 30 } },
  ],
  make: (d, rng) => {
    const h = ri(rng, 1, 12), m = d <= 1 ? 0 : d === 2 ? pick(rng, [0, 30]) : d === 3 ? pick(rng, [0, 15, 30, 45]) : 5 * ri(rng, 0, 11);
    const fmt = (hh: number, mm: number) => `${hh}:${String(mm).padStart(2, "0")}`;
    const ans = fmt(h, m);
    const opts = [...new Set([ans, fmt(h % 12 + 1, m), fmt(h, (m + 30) % 60), fmt(m / 5 || 12, (h * 5) % 60)])].slice(0, 3); // the classic mix-up: hands swapped
    return { prompt: T("What time does the clock show?", "घड़ी कितना समय दिखा रही है?", "Ghadi kitna time dikha rahi hai?"), visual: { type: "clock", h, m }, choices: shuffle(rng, opts), answer: ans,
      why: T(`The short hand is at ${h}${m ? " (just past it)" : ""}, so the hour is ${h}. The long hand is at ${m === 0 ? 12 : m / 5}, and ${m === 0 ? "12 means o'clock" : `${m / 5} × 5 = ${m} minutes`}. Time: ${ans}.`) };
  },
};

const money: Topic = {
  id: "money", strand: "measure", icon: "🪙", title: T("Money", "पैसे", "Paise"), grades: [1, 3],
  cards: [{ title: T("Add up the coins"), say: T("Each coin has a value written on it. To find how much money we have, add the values, starting with the biggest coin.", "हर सिक्के पर उसकी क़ीमत लिखी होती है। कुल पैसे जानने के लिए क़ीमतें जोड़ो, सबसे बड़े सिक्के से शुरू करके।", "Har sikke pe uski keemat likhi hoti hai. Total paise jaanne ke liye keemat jodo, sabse bade sikke se shuru karke."), visual: { type: "coins", coins: [10, 5, 2, 1] } }],
  make: (d, rng) => {
    const vals = d <= 1 ? [1, 2] : d <= 2 ? [1, 2, 5] : [1, 2, 5, 10, 20];
    const coins = Array.from({ length: ri(rng, 2, d + 2) }, () => pick(rng, vals)).sort((a, b) => b - a);
    const sum = coins.reduce((a, b) => a + b, 0);
    return { prompt: T("How many rupees are here?", "यहाँ कितने रुपये हैं?", "Yahan kitne rupaye hain?"), visual: { type: "coins", coins }, choices: numChoices(rng, sum, 3), answer: String(sum), numeric: true,
      why: T(`Start with the biggest coin and add: ${coins.join(" + ")} = ₹${sum}.`) };
  },
};

const length: Topic = {
  id: "length", strand: "measure", icon: "📏", title: T("Measuring length", "लंबाई मापना", "Lambai naapna"), grades: [1, 3],
  cards: [{ title: T("Start at zero"), say: T("Put one end of the thing exactly at 0 on the ruler, then read the number at the other end. Starting at 0 is the most important rule!", "चीज़ का एक सिरा ठीक 0 पर रखो, फिर दूसरे सिरे का अंक पढ़ो। 0 से शुरू करना सबसे ज़रूरी नियम है!", "Cheez ka ek sira theek 0 pe rakho, phir doosre sire ka number padho. 0 se shuru karna sabse zaroori rule hai!"), visual: { type: "ruler", length: 6, emoji: "✏️" } }],
  make: (d, rng) => {
    const n = ri(rng, 2, d <= 2 ? 8 : 12), e = pick(rng, ["✏️", "🖍️", "🐛", "🔑", "🥕"]);
    return { prompt: T(`How long is the ${e}, in centimetres?`, `${e} कितने सेंटीमीटर लंबा है?`, `${e} kitne centimetre lamba hai?`), visual: { type: "ruler", length: n, emoji: e }, choices: numChoices(rng, n, 2), answer: String(n), numeric: true,
      why: T(`It starts at 0 and ends at ${n}, so it is ${n} cm long.`) };
  },
};

const data: Topic = {
  id: "data", strand: "measure", icon: "📊", title: T("Reading charts", "चार्ट पढ़ना", "Chart padhna"), grades: [2, 5],
  cards: [{ title: T("Taller bar, more things"), say: T("In a bar chart each bar shows how many. Read the number where the top of the bar is. The tallest bar is the most popular!", "बार चार्ट में हर बार बताता है कितने। बार के ऊपर वाला अंक पढ़ो। सबसे ऊँचा बार सबसे ज़्यादा!", "Bar chart mein har bar batata hai kitne. Bar ke upar wala number padho. Sabse ooncha bar sabse zyada!"), visual: { type: "bars", data: [{ label: "🍎", value: 4 }, { label: "🍌", value: 6 }, { label: "🍇", value: 2 }] } }],
  make: (d, rng) => {
    const labels = shuffle(rng, ["🍎", "🍌", "🍇", "🍊", "🍓"]).slice(0, d <= 2 ? 3 : 4);
    const dataset = labels.map((label) => ({ label, value: ri(rng, 1, d <= 2 ? 6 : 10) }));
    const q = pick(rng, d <= 2 ? ["most", "count"] as const : ["most", "count", "diff"] as const);
    if (q === "most") {
      const top = dataset.reduce((a, b) => (b.value > a.value ? b : a));
      if (dataset.filter((x) => x.value === top.value).length > 1) top.value += 1;
      return { prompt: T("Which fruit has the most?", "किस फल की संख्या सबसे ज़्यादा है?", "Kis fruit ki ginti sabse zyada hai?"), visual: { type: "bars", data: dataset }, choices: labels, answer: top.label,
        why: T(`${top.label}'s bar is the tallest (${top.value}), so it has the most.`) };
    }
    if (q === "count") {
      const x = pick(rng, dataset);
      return { prompt: T(`How many ${x.label}?`, `कितने ${x.label}?`, `Kitne ${x.label}?`), visual: { type: "bars", data: dataset }, choices: numChoices(rng, x.value, 2), answer: String(x.value), numeric: true,
        why: T(`The top of the ${x.label} bar is at ${x.value}.`) };
    }
    const [a, b] = shuffle(rng, dataset);
    const diff = Math.abs(a.value - b.value);
    return { prompt: T(`How many more ${a.value >= b.value ? a.label : b.label} than ${a.value >= b.value ? b.label : a.label}?`), visual: { type: "bars", data: dataset }, choices: numChoices(rng, diff, 2), answer: String(diff), numeric: true,
      why: T(`Read the top of both bars: ${a.label} has ${a.value} and ${b.label} has ${b.value}. The difference is ${Math.max(a.value, b.value)} − ${Math.min(a.value, b.value)} = ${diff}.`) };
  },
};

// --- Vedic maths and quick tricks ------------------------------------------------------------------------
// Each one: a worked example shown step by step (cards), the reason it works, then practice.
const add9: Topic = {
  id: "add_9", strand: "vedic", icon: "9️⃣", title: T("Add 9 fast: +10 −1", "9 जल्दी जोड़ो: +10 −1", "9 jaldi jodo: +10 −1"), grades: [1, 3],
  cards: [
    { title: T("9 is 10 minus 1"), say: T("Adding 10 is super easy: just add 1 to the tens. And 9 is one less than 10. So to add 9: add 10, then take away 1.", "10 जोड़ना बहुत आसान है: दहाई में 1 बढ़ाओ। और 9, 10 से 1 कम है। तो 9 जोड़ने के लिए: 10 जोड़ो, फिर 1 घटाओ।", "10 jodna bahut easy hai: tens mein 1 badhao. Aur 9, 10 se 1 kam hai. Toh 9 jodne ke liye: 10 jodo, phir 1 ghatao.") },
    { title: T("Example: 26 + 9"), say: T("26 + 10 = 36. Then 36 − 1 = 35. So 26 + 9 = 35!", "26 + 10 = 36। फिर 36 − 1 = 35। तो 26 + 9 = 35!", "26 + 10 = 36. Phir 36 − 1 = 35. Toh 26 + 9 = 35!"), visual: { type: "steps", lines: ["26 + 9", "= 26 + 10 − 1", "= 36 − 1", "= 35"] } },
  ],
  make: (d, rng) => {
    const a = ri(rng, 5, [20, 50, 90, 200, 900][d - 1]), nine = d >= 4 ? pick(rng, [9, 19, 99]) : 9;
    const s = a + nine, ten = nine + 1;
    return { prompt: T(`${a} + ${nine} = ?`), choices: numChoices(rng, s, 2), answer: String(s), numeric: true, visual: { type: "steps", lines: [`${a} + ${ten} = ${a + ten}`, `${a + ten} − 1 = ?`] },
      why: T(`${nine} is ${ten} − 1. ${a} + ${ten} = ${a + ten}, then − 1 = ${s}.`) };
  },
};

const times11: Topic = {
  id: "times_11", strand: "vedic", icon: "🔟", title: T("× 11 trick", "× 11 की तरकीब", "× 11 trick"), grades: [3, 5],
  cards: [
    { title: T("Split the digits, add in the middle"), say: T("To multiply a 2-digit number by 11: write the two digits apart, and put their SUM in the middle. 23 × 11: 2 _ 3, 2 + 3 = 5, so 253!", "दो अंकों की संख्या को 11 से गुणा: दोनों अंक अलग लिखो, बीच में उनका जोड़। 23 × 11: 2 _ 3, 2 + 3 = 5, तो 253!", "2-digit number ko 11 se guna: dono digits alag likho, beech mein unka jod. 23 × 11: 2 _ 3, 2 + 3 = 5, toh 253!"), visual: { type: "steps", lines: ["23 × 11", "2 _ 3", "2 + 3 = 5", "253"] } },
    { title: T("Why it works"), say: T("× 11 is × 10 plus × 1: 230 + 23 = 253. The middle digit gets added twice, once from each part. If the middle sum is 10 or more, carry 1 to the left: 57 × 11 = 5 (12) 7 = 627.", "× 11 मतलब × 10 + × 1: 230 + 23 = 253। बीच का अंक दो बार जुड़ता है। अगर बीच का जोड़ 10 या ज़्यादा हो, तो 1 बाएँ हासिल: 57 × 11 = 627।", "× 11 matlab × 10 + × 1: 230 + 23 = 253. Beech ka digit do baar judta hai. Agar beech ka jod 10 ya zyada ho, toh 1 left carry: 57 × 11 = 627."), visual: { type: "steps", lines: ["57 × 11", "5 _ 7", "5 + 7 = 12 → carry 1", "6 2 7"] } },
  ],
  make: (d, rng) => {
    const t0 = ri(rng, 1, 4);
    const n = d <= 2 ? 10 * t0 + ri(rng, 0, 9 - t0) : ri(rng, 11, 99); // easy: no carrying in the middle
    const a = Math.floor(n / 10), b = n % 10, p = n * 11;
    return { prompt: T(`${n} × 11 = ?`), choices: numChoices(rng, p, 11), answer: String(p), numeric: true,
      why: T(`${a} _ ${b}, middle = ${a} + ${b} = ${a + b}${a + b >= 10 ? ", carry 1 to the left" : ""}: ${p}.`) };
  },
};

const square5: Topic = {
  id: "square_5", strand: "vedic", icon: "5️⃣", title: T("Squares ending in 5", "5 पर ख़त्म होने वाले वर्ग", "5 wale squares"), grades: [4, 5],
  cards: [
    { title: T("Ekādhikena Pūrveṇa: one more than the one before"), say: T("For 35 × 35: take the first digit 3, multiply it by ONE MORE (4): 3 × 4 = 12. Then write 25 after it: 1225!", "35 × 35 के लिए: पहला अंक 3, उसे एक अधिक (4) से गुणा करो: 12। फिर पीछे 25 लिखो: 1225!", "35 × 35 ke liye: pehla digit 3, usse ek zyada (4) se guna karo: 12. Phir peeche 25 likho: 1225!"), visual: { type: "steps", lines: ["35²", "3 × 4 = 12", "…25", "1225"] } },
    { title: T("Why it works"), say: T("(10a + 5)² = 100·a·(a + 1) + 25. The 5 × 5 always gives 25 at the end, and the rest is a times the next number, in hundreds.", "(10a + 5)² = 100·a·(a + 1) + 25। 5 × 5 हमेशा अंत में 25 देता है, बाक़ी a गुणा अगली संख्या, सैकड़ों में।", "(10a + 5)² = 100·a·(a + 1) + 25. 5 × 5 hamesha end mein 25 deta hai, baaki a guna agla number, hundreds mein.") },
  ],
  make: (d, rng) => {
    const a = ri(rng, 1, d <= 2 ? 4 : 9), n = 10 * a + 5, p = n * n;
    return { prompt: T(`${n} × ${n} = ?`), choices: numChoices(rng, p, 100), answer: String(p), numeric: true,
      why: T(`${a} × ${a + 1} = ${a * (a + 1)}, then 25: ${p}.`) };
  },
};

const times5: Topic = {
  id: "times_5", strand: "vedic", icon: "🖐️", title: T("× 5 = half of × 10", "× 5 = × 10 का आधा", "× 5 = × 10 ka aadha"), grades: [2, 4],
  cards: [{ title: T("5 is half of 10"), say: T("Multiplying by 10 is easy (add a 0). 5 is half of 10, so × 5 is HALF of × 10. 48 × 5: 480, half is 240!", "10 से गुणा आसान है (0 लगाओ)। 5, 10 का आधा है, तो × 5 = × 10 का आधा। 48 × 5: 480 का आधा 240!", "10 se guna easy hai (0 lagao). 5, 10 ka aadha hai, toh × 5 = × 10 ka aadha. 48 × 5: 480 ka aadha 240!"), visual: { type: "steps", lines: ["48 × 5", "48 × 10 = 480", "480 ÷ 2 = 240"] } }],
  make: (d, rng) => {
    const n = ri(rng, 2, [10, 20, 50, 100, 500][d - 1]) * (d >= 3 ? 2 : 1), p = n * 5;
    return { prompt: T(`${n} × 5 = ?`), choices: numChoices(rng, p, 5), answer: String(p), numeric: true,
      why: T(`${n} × 10 = ${n * 10}, half of that is ${p}.`) };
  },
};

const nikhilam: Topic = {
  id: "nikhilam", strand: "vedic", icon: "🎯", title: T("Nikhilam: near 10 or 100", "निखिलम्: 10 या 100 के पास", "Nikhilam: 10 ya 100 ke paas"), grades: [3, 5],
  cards: [
    { title: T("How far from 10?"), say: T("Nikhilam means 'all from 9, the last from 10'. For 8 × 7: 8 is 2 less than 10, 7 is 3 less. Cross-subtract: 8 − 3 = 5 (or 7 − 2 = 5). Multiply the gaps: 2 × 3 = 6. Answer 56!", "निखिलम् मतलब 'सब 9 से, आख़िरी 10 से'। 8 × 7: 8, 10 से 2 कम; 7, 3 कम। तिरछा घटाओ: 8 − 3 = 5। कमियों का गुणा: 2 × 3 = 6। उत्तर 56!", "Nikhilam matlab 'sab 9 se, last 10 se'. 8 × 7: 8, 10 se 2 kam; 7, 3 kam. Cross ghatao: 8 − 3 = 5. Kami ka guna: 2 × 3 = 6. Answer 56!"), visual: { type: "steps", lines: ["8 → −2", "7 → −3", "8 − 3 = 5", "2 × 3 = 6", "56"] } },
    { title: T("Why it works"), say: T("8 × 7 = (10 − 2)(10 − 3) = 10·(10 − 2 − 3) + 2·3. So the left part is the number minus the other gap, and the right part is gap × gap. It works near 100 too: 97 × 96 = 93|12 = 9312.", "8 × 7 = (10 − 2)(10 − 3) = 10·(10 − 2 − 3) + 2·3। बायाँ हिस्सा = संख्या − दूसरी कमी, दायाँ = कमी × कमी। 100 के पास भी: 97 × 96 = 9312।", "8 × 7 = (10 − 2)(10 − 3) = 10·(10 − 2 − 3) + 2·3. Left part = number − doosri kami, right = kami × kami. 100 ke paas bhi: 97 × 96 = 9312.") },
  ],
  make: (d, rng) => {
    const base = d <= 2 ? 10 : 100;
    const a = base - ri(rng, 1, d <= 2 ? 4 : 9), b = base - ri(rng, 1, d <= 2 ? 4 : 9);
    const ga = base - a, gb = base - b, p = a * b;
    return { prompt: T(`${a} × ${b} = ?`), choices: numChoices(rng, p, base === 10 ? 4 : 20), answer: String(p), numeric: true,
      visual: { type: "steps", lines: [`${a} → −${ga}`, `${b} → −${gb}`] },
      why: T(`Gaps from ${base}: ${ga} and ${gb}. Left: ${a} − ${gb} = ${a - gb}. Right: ${ga} × ${gb} = ${ga * gb}${base === 100 && ga * gb < 10 ? " (write it as 0" + ga * gb + ")" : ""}. Answer ${p}.`) };
  },
};

const nineFingers: Topic = {
  id: "nine_fingers", strand: "vedic", icon: "✋", title: T("9 times table on fingers", "उँगलियों पर 9 का पहाड़ा", "Ungliyon pe 9 ka table"), grades: [2, 4],
  cards: [{ title: T("Fold one finger"), say: T("Hold up 10 fingers. For 9 × 4, fold down the 4th finger. Fingers to the LEFT of it: 3 (tens). Fingers to the RIGHT: 6 (ones). 9 × 4 = 36! It works because each step of 9 is one more ten and one less one.", "10 उँगलियाँ उठाओ। 9 × 4 के लिए चौथी उँगली मोड़ो। बाईं ओर 3 (दहाई), दाईं ओर 6 (इकाई)। 9 × 4 = 36!", "10 ungliyan uthao. 9 × 4 ke liye chauthi ungli modo. Left mein 3 (tens), right mein 6 (ones). 9 × 4 = 36!"), visual: { type: "steps", lines: ["🖐️🖐️", "fold finger 4", "3 | 6", "36"] } }],
  make: (_d, rng) => {
    const n = ri(rng, 1, 10);
    return { prompt: T(`9 × ${n} = ?`), choices: numChoices(rng, 9 * n, 9), answer: String(9 * n), numeric: true,
      why: T(`Fold finger ${n}: ${n - 1} fingers on the left (tens) and ${10 - n} on the right (ones): ${9 * n}. The digits always add to 9!`) };
  },
};

const from100: Topic = {
  id: "from_100", strand: "vedic", icon: "💯", title: T("Subtract from 100 / 1000", "100 / 1000 में से घटाना", "100 / 1000 se ghatana"), grades: [3, 5],
  cards: [{ title: T("All from 9, the last from 10"), say: T("100 − 37: take each digit from 9 except the last, which you take from 10. 9 − 3 = 6, 10 − 7 = 3: answer 63. No borrowing needed!", "100 − 37: हर अंक 9 में से घटाओ, आख़िरी 10 में से। 9 − 3 = 6, 10 − 7 = 3: उत्तर 63। उधार की ज़रूरत नहीं!", "100 − 37: har digit 9 se ghatao, last 10 se. 9 − 3 = 6, 10 − 7 = 3: answer 63. Borrow ki zaroorat nahi!"), visual: { type: "steps", lines: ["100 − 37", "9 − 3 = 6", "10 − 7 = 3", "63"] } }],
  make: (d, rng) => {
    const big = d >= 3 ? 1000 : 100, n = ri(rng, 11, big - 1);
    if (n % 10 === 0) return from100.make(d, rng);
    const r = big - n;
    return { prompt: T(`${big} − ${n} = ?`), choices: numChoices(rng, r, 10), answer: String(r), numeric: true,
      why: T(`All from 9, the last from 10: ${String(n).padStart(String(big).length - 1, "0").split("").map((c, i, a) => (i === a.length - 1 ? `10−${c}` : `9−${c}`)).join(", ")} → ${r}.`) };
  },
};

export const MATHS_TOPICS: Topic[] = [count, compare, placeValue, addition, subtraction, evenOdd, skip, multiplication, division, fractions,
  patterns, missing, balance, shapes, symmetry, angles, areaPerimeter, time, money, length, data,
  add9, times5, nineFingers, times11, nikhilam, from100, square5];
export const mathsTopic = (id: string) => MATHS_TOPICS.find((t) => t.id === id);
