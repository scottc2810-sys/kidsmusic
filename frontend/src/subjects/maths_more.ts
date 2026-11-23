// More class 1-5 maths, each explained with the simplest everyday picture first, and every question with a
// worked solution (steps). Plus extra concept cards for the first topics, so each idea is met in more than
// one way: things you can hold, a picture, then the numbers.
import type { Text } from "../i18n";
import { numChoices, pick, ri, shuffle, T, type Card, type Exercise, type Rng, type Topic } from "./maths";
import { addSteps, subSteps } from "./worked";

const E = ["🍎", "🍪", "⭐", "🎈", "🐟", "🌸"];

const neighbours: Topic = {
  id: "neighbours", strand: "numbers", icon: "🏘️", title: T("Before, after, between", "पहले, बाद, बीच", "Pehle, baad, beech"), grades: [1, 2],
  cards: [
    { title: T("Numbers live in a row of houses"), say: T("Numbers live in a long street, in order. The house just BEFORE is one less. The house just AFTER is one more. 6 lives between 5 and 7.", "संख्याएँ एक लंबी गली में क्रम से रहती हैं। ठीक पहले वाला घर एक कम, ठीक बाद वाला एक ज़्यादा। 6, 5 और 7 के बीच रहता है।", "Numbers ek lambi gali mein order mein rehte hain. Theek pehle wala ghar ek kam, theek baad wala ek zyada. 6, 5 aur 7 ke beech rehta hai."), visual: { type: "numberline", from: 0, to: 10, start: 5, hops: 1, step: 1 } },
    { title: T("One more, one less"), say: T("AFTER = count one more: after 19 comes 20. BEFORE = count one back: before 30 comes 29.", "बाद = एक और गिनो: 19 के बाद 20। पहले = एक पीछे: 30 से पहले 29।", "Baad = ek aur gino: 19 ke baad 20. Pehle = ek peeche: 30 se pehle 29.") },
  ],
  make: (d, rng) => {
    const n = ri(rng, 2, [10, 20, 50, 100, 1000][d - 1]);
    const q = pick(rng, ["before", "after", "between"] as const);
    const ans = q === "before" ? n - 1 : q === "after" ? n + 1 : n;
    const prompt = q === "between" ? T(`What number comes between ${n - 1} and ${n + 1}?`, `${n - 1} और ${n + 1} के बीच कौन सी संख्या?`, `${n - 1} aur ${n + 1} ke beech kaunsa number?`)
      : T(`What comes just ${q} ${n}?`, `${n} के ठीक ${q === "before" ? "पहले" : "बाद"} क्या आता है?`, `${n} ke theek ${q === "before" ? "pehle" : "baad"} kya aata hai?`);
    return { prompt, visual: n <= 20 ? { type: "numberline", from: Math.max(0, n - 3), to: n + 3, start: n, hops: 0, step: 1 } : undefined, choices: numChoices(rng, ans, 2), answer: String(ans), numeric: true,
      why: T(q === "before" ? `Before means one less: ${n} − 1 = ${ans}.` : q === "after" ? `After means one more: ${n} + 1 = ${ans}.` : `Count: ${n - 1}, ${n}, ${n + 1}. The middle one is ${n}.`),
      steps: [T("Say the numbers in order, like walking down the street of number houses."), T(q === "before" ? `Step back one house from ${n}: ${ans}.` : q === "after" ? `Step forward one house from ${n}: ${ans}.` : `${n - 1} … ${n} … ${n + 1}: the one in the middle is ${n}.`)] };
  },
};

const bonds: Topic = {
  id: "bonds_10", strand: "numbers", icon: "🔟", title: T("Make 10", "10 बनाओ", "10 banao"), grades: [1, 2],
  cards: [
    { title: T("Ten friends"), say: T("Some pairs of numbers are best friends because together they make 10: 1 and 9, 2 and 8, 3 and 7, 4 and 6, 5 and 5. Hold up 10 fingers: fold some, the rest are the friend!", "कुछ संख्याओं की जोड़ी पक्की दोस्त है क्योंकि मिलकर 10 बनाती हैं: 1-9, 2-8, 3-7, 4-6, 5-5। 10 उँगलियाँ उठाओ: कुछ मोड़ो, बाक़ी दोस्त हैं!", "Kuch numbers ki jodi pakki dost hai kyunki milke 10 banati hai: 1-9, 2-8, 3-7, 4-6, 5-5. 10 ungliyan uthao: kuch modo, baaki dost hain!"), visual: { type: "objects", emoji: "🖐️", count: 10, groups: [7, 3] } },
    { title: T("Why 10 matters"), say: T("Our numbers are built in tens. Knowing the 10-friends makes adding fast: 8 + 5 = 8 + 2 + 3 = 10 + 3 = 13.", "हमारी संख्याएँ दहाई में बनी हैं। 10-दोस्त जानने से जोड़ तेज़ होता है: 8 + 5 = 8 + 2 + 3 = 10 + 3 = 13।", "Hamare numbers tens mein bane hain. 10-dost jaanne se jod fast hota hai: 8 + 5 = 8 + 2 + 3 = 10 + 3 = 13.") },
  ],
  make: (d, rng) => {
    const target = d >= 4 ? 100 : d === 3 ? 20 : 10;
    const a = target === 100 ? 10 * ri(rng, 1, 9) + (d === 5 ? ri(rng, 1, 9) : 0) : ri(rng, 0, target);
    const b = target - a;
    return { prompt: T(`${a} and what make ${target}?`, `${a} और कितना मिलकर ${target}?`, `${a} aur kitna milke ${target}?`), visual: target === 10 ? { type: "objects", emoji: pick(rng, E), count: 10, groups: [a, b] } : undefined,
      choices: numChoices(rng, b, 2), answer: String(b), numeric: true, why: T(`${a} + ${b} = ${target}, so ${b} is ${a}'s friend for ${target}.`),
      steps: [T(`We need to fill up to ${target}.`), T(`Count on from ${a} to ${target}, or take away: ${target} − ${a} = ${b}.`), T(`Check: ${a} + ${b} = ${target}. ✓`)] };
  },
};

const doubleHalf: Topic = {
  id: "double_half", strand: "numbers", icon: "🪞", title: T("Doubles and halves", "दुगना और आधा", "Double aur aadha"), grades: [1, 3],
  cards: [
    { title: T("Double = the same again"), say: T("Double means two of the same, like looking in a mirror: double 4 is 4 + 4 = 8. Half means sharing into 2 equal parts: half of 8 is 4.", "दुगना मतलब वही दो बार, जैसे दर्पण में देखना: 4 का दुगना 4 + 4 = 8। आधा मतलब 2 बराबर हिस्से: 8 का आधा 4।", "Double matlab wahi do baar, jaise mirror mein dekhna: 4 ka double 4 + 4 = 8. Aadha matlab 2 barabar hisse: 8 ka aadha 4."), visual: { type: "objects", emoji: "🍪", count: 8, groups: [4, 4] } },
    { title: T("Halving undoes doubling"), say: T("Double 7 = 14, so half of 14 = 7. Big numbers: double 36 = double 30 + double 6 = 60 + 12 = 72.", "7 का दुगना 14, तो 14 का आधा 7। बड़ी संख्या: 36 का दुगना = 30 का दुगना + 6 का दुगना = 60 + 12 = 72।", "7 ka double 14, toh 14 ka aadha 7. Bade number: 36 ka double = 30 ka double + 6 ka double = 60 + 12 = 72.") },
  ],
  make: (d, rng) => {
    const n = ri(rng, 1, [5, 10, 25, 50, 250][d - 1]);
    const dbl = rng() < 0.5;
    const q = dbl ? n : 2 * n, ans = dbl ? 2 * n : n;
    const tens = q - (q % 10), ones = q % 10;
    return { prompt: dbl ? T(`Double ${n} = ?`, `${n} का दुगना = ?`, `${n} ka double = ?`) : T(`Half of ${q} = ?`, `${q} का आधा = ?`, `${q} ka aadha = ?`), visual: q <= 10 ? { type: "objects", emoji: pick(rng, E), count: dbl ? 2 * n : q, groups: dbl ? [n, n] : [n, n] } : undefined,
      choices: numChoices(rng, ans, 3), answer: String(ans), numeric: true, why: T(dbl ? `Double means the same number twice: ${n} + ${n} = ${ans}.` : `Share ${q} into 2 equal parts: ${ans} each, because ${ans} + ${ans} = ${q}.`),
      steps: q >= 20 && tens && ones ? [T(`Split ${q} into ${tens} and ${ones}.`), T(dbl ? `Double each: ${2 * tens} and ${2 * ones}.` : `Halve each: ${tens / 2} and ${ones / 2}.`), T(`Put them together: ${ans}.`)]
        : [T(dbl ? `Double means the same number twice: ${n} + ${n}.` : `Half means 2 equal shares of ${q}.`), T(`Answer: ${ans}.`)] };
  },
};

const rounding: Topic = {
  id: "rounding", strand: "numbers", icon: "🎢", title: T("Rounding", "पूर्णांकन (राउंडिंग)", "Rounding"), grades: [3, 4],
  cards: [
    { title: T("Which ten is closer?"), say: T("Rounding to the nearest 10 is like a ball on a hill between two tens. 23 is close to 20, so it rolls back to 20. 27 is closer to 30, so it rolls to 30. 25 is exactly on top: by the rule it rolls UP to 30.", "10 तक राउंड करना दो दहाइयों के बीच पहाड़ी पर गेंद जैसा है। 23, 20 के पास, तो 20। 27, 30 के पास, तो 30। 25 ठीक चोटी पर: नियम से ऊपर, 30।", "10 tak round karna do tens ke beech pahaadi pe ball jaisa hai. 23, 20 ke paas, toh 20. 27, 30 ke paas, toh 30. 25 theek top pe: rule se UPAR, 30."), visual: { type: "numberline", from: 20, to: 30, start: 23, hops: 0, step: 1 } },
    { title: T("Look at the next digit"), say: T("To round to tens, look at the ONES digit: 0-4 round down, 5-9 round up. To round to hundreds, look at the TENS digit.", "दहाई तक राउंड के लिए इकाई देखो: 0-4 नीचे, 5-9 ऊपर। सैकड़े तक के लिए दहाई का अंक देखो।", "Tens tak round ke liye ONES digit dekho: 0-4 neeche, 5-9 upar. Hundreds tak ke liye TENS digit dekho.") },
  ],
  make: (d, rng) => {
    const to = d >= 4 && rng() < 0.6 ? 100 : 10;
    const n = to === 10 ? ri(rng, 11, d <= 2 ? 99 : 999) : ri(rng, 101, 999);
    const look = to === 10 ? n % 10 : Math.floor(n / 10) % 10;
    const down = n - (n % to), ans = look >= 5 ? down + to : down;
    return { prompt: T(`Round ${n} to the nearest ${to}.`, `${n} को नज़दीकी ${to} तक राउंड करो।`, `${n} ko nearest ${to} tak round karo.`), visual: to === 10 ? { type: "numberline", from: down, to: down + 10, start: n, hops: 0, step: 1 } : undefined,
      choices: shuffle(rng, [...new Set([String(down), String(down + to), String(ans === down ? down - to : down + 2 * to)])]).filter((x) => Number(x) >= 0), answer: String(ans), numeric: true,
      why: T(`${n} is between ${down} and ${down + to}. The ${to === 10 ? "ones" : "tens"} digit is ${look}: ${look >= 5 ? "5 or more, so round UP" : "less than 5, so round DOWN"} to ${ans}.`),
      steps: [T(`Which two ${to === 10 ? "tens" : "hundreds"} is ${n} between? ${down} and ${down + to}.`), T(`Look at the ${to === 10 ? "ones" : "tens"} digit: ${look}.`), T(look >= 5 ? `${look} is 5 or more → round up to ${ans}.` : `${look} is less than 5 → round down to ${ans}.`)] };
  },
};

const ROMAN: [number, string][] = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
export const toRoman = (n: number) => { let s = "", x = n; for (const [v, r] of ROMAN) while (x >= v) { s += r; x -= v; } return s; };
const roman: Topic = {
  id: "roman", strand: "numbers", icon: "🏛️", title: T("Roman numerals", "रोमन अंक", "Roman numerals"), grades: [4, 5],
  cards: [
    { title: T("Letters as numbers"), say: T("The Romans used letters: I = 1, V = 5, X = 10, L = 50, C = 100. You add them up: XII = 10 + 1 + 1 = 12. You see them on clocks and book chapters!", "रोमन अक्षरों से गिनते थे: I = 1, V = 5, X = 10, L = 50, C = 100। जोड़ते हैं: XII = 10 + 1 + 1 = 12। घड़ियों पर दिखते हैं!", "Romans letters se ginte the: I = 1, V = 5, X = 10, L = 50, C = 100. Jodte hain: XII = 10 + 1 + 1 = 12. Ghadiyon pe dikhte hain!") },
    { title: T("Small before big means subtract"), say: T("When a smaller letter comes BEFORE a bigger one, take it away: IV = 5 − 1 = 4, IX = 10 − 1 = 9, XL = 50 − 10 = 40. Never more than three of the same letter in a row.", "जब छोटा अक्षर बड़े से पहले हो, तो घटाओ: IV = 5 − 1 = 4, IX = 9, XL = 40। एक अक्षर लगातार तीन बार से ज़्यादा नहीं।", "Jab chhota letter bade se PEHLE ho, toh ghatao: IV = 5 − 1 = 4, IX = 9, XL = 40. Ek letter lagaataar teen baar se zyada nahi.") },
  ],
  make: (d, rng) => {
    const n = ri(rng, 1, [12, 20, 39, 100, 500][d - 1]);
    const toR = rng() < 0.5, r = toRoman(n);
    const parts: string[] = []; let x = n;
    for (const [v, s] of ROMAN) while (x >= v) { parts.push(`${s} = ${v}`); x -= v; }
    return toR
      ? { prompt: T(`Write ${n} in Roman numerals.`), choices: shuffle(rng, [...new Set([r, toRoman(n + 1), toRoman(Math.max(1, n - 1))])]), answer: r,
        why: T(`${n} = ${parts.map((p) => p.split(" = ")[1]).join(" + ")}, so ${parts.map((p) => p.split(" = ")[0]).join("")} = ${r}.`), steps: [T("Take the biggest Roman value that fits, again and again."), ...parts.map((p) => T(p)), T(`Together: ${r}.`)] }
      : { prompt: T(`What number is ${r}?`), choices: numChoices(rng, n, 3), answer: String(n), numeric: true,
        why: T(`${parts.join(", ")}: total ${n}.`), steps: [T("Read left to right. If a small letter is before a bigger one, subtract it."), ...parts.map((p) => T(p)), T(`Total: ${n}.`)] };
  },
};

const equivFrac: Topic = {
  id: "equivalent_fractions", strand: "numbers", icon: "🍫", title: T("Same amount, different fraction", "बराबर भिन्न", "Equivalent fractions"), grades: [4, 5],
  cards: [
    { title: T("Cut the pieces smaller"), say: T("Half a chocolate bar is the same as 2 out of 4 small pieces, or 4 out of 8 tiny pieces. 1/2 = 2/4 = 4/8. Same amount of chocolate, just cut into more pieces!", "आधी चॉकलेट = 4 में से 2 छोटे टुकड़े = 8 में से 4। 1/2 = 2/4 = 4/8। चॉकलेट उतनी ही, बस ज़्यादा टुकड़े!", "Aadhi chocolate = 4 mein se 2 chhote tukde = 8 mein se 4. 1/2 = 2/4 = 4/8. Chocolate utni hi, bas zyada tukde!"), visual: { type: "fraction", parts: 4, shaded: 2, shape: "bar" } },
    { title: T("Multiply top and bottom by the same number"), say: T("If you cut every piece into 3, you get 3 times as many pieces AND 3 times as many coloured ones: 2/5 = 6/15. Top and bottom always change together.", "हर टुकड़े के 3 टुकड़े करो, तो कुल भी 3 गुना और रंगे भी 3 गुना: 2/5 = 6/15। ऊपर-नीचे हमेशा साथ बदलते हैं।", "Har tukde ke 3 tukde karo, toh total bhi 3 guna aur rangin bhi 3 guna: 2/5 = 6/15. Upar-neeche hamesha saath badalte hain.") },
  ],
  make: (_d, rng) => {
    const b = pick(rng, [2, 3, 4, 5]), a = ri(rng, 1, b - 1), k = ri(rng, 2, 4);
    const ans = String(a * k);
    return { prompt: T(`${a}/${b} = ?/${b * k}`), visual: { type: "fraction", parts: b * k, shaded: a * k, shape: "bar" }, choices: numChoices(rng, a * k, 2), answer: ans, numeric: true,
      why: T(`The bottom went from ${b} to ${b * k}: × ${k}. Do the same to the top: ${a} × ${k} = ${a * k}.`),
      steps: [T(`What did we multiply the bottom by? ${b} × ? = ${b * k} → ${k}.`), T(`Every piece was cut into ${k}, so the coloured pieces are ${k} times as many too.`), T(`${a} × ${k} = ${a * k}, so ${a}/${b} = ${a * k}/${b * k}.`)] };
  },
};

const addFrac: Topic = {
  id: "add_fractions", strand: "numbers", icon: "🥧", title: T("Adding fractions", "भिन्न जोड़ना", "Fractions jodna"), grades: [4, 5],
  cards: [{ title: T("Same size pieces just add"), say: T("2/8 of a pie plus 3/8 of the pie: the pieces are the same size (eighths), so just count them: 2 + 3 = 5 eighths = 5/8. The bottom number stays, because the size of the pieces didn't change!", "पाई का 2/8 और 3/8: टुकड़े एक ही आकार (आठवें) हैं, तो बस गिनो: 2 + 3 = 5 आठवें = 5/8। नीचे की संख्या वही रहती है!", "Pie ka 2/8 aur 3/8: tukde same size (eighths) hain, toh bas gino: 2 + 3 = 5 eighths = 5/8. Neeche ka number wahi rehta hai!"), visual: { type: "fraction", parts: 8, shaded: 5, shape: "circle" } }],
  make: (_d, rng) => {
    const b = pick(rng, [4, 5, 6, 8, 10]), a = ri(rng, 1, b - 2), c = ri(rng, 1, b - a - 1);
    const ans = `${a + c}/${b}`;
    return { prompt: T(`${a}/${b} + ${c}/${b} = ?`), visual: { type: "fraction", parts: b, shaded: a + c, shape: "circle" },
      choices: shuffle(rng, [ans, `${a + c}/${2 * b}`, `${a * c}/${b}`].filter((x, i, xs) => xs.indexOf(x) === i)), answer: ans,
      why: T(`Same-size pieces (${b}ths): ${a} + ${c} = ${a + c} pieces, so ${ans}. Don't add the bottoms: the pieces didn't get smaller!`),
      steps: [T(`Both are counted in ${b}ths: same-size pieces.`), T(`Add the pieces: ${a} + ${c} = ${a + c}.`), T(`Keep the piece size: ${ans}.`)] };
  },
};

const decimals: Topic = {
  id: "decimals", strand: "numbers", icon: "🔸", title: T("Decimals (tenths)", "दशमलव", "Decimals"), grades: [4, 5],
  cards: [
    { title: T("The dot splits wholes from parts"), say: T("A decimal point separates whole things from parts. 2.3 means 2 whole bars and 3 tenths of another bar. One tenth (0.1) is one slice when a bar is cut into 10 equal slices.", "दशमलव बिंदु पूरी चीज़ों को हिस्सों से अलग करता है। 2.3 = 2 पूरी चॉकलेट और 3 दसवाँ भाग। 0.1 = 10 बराबर टुकड़ों में से 1।", "Decimal point poori cheezon ko hisson se alag karta hai. 2.3 = 2 poore bar aur 3 tenths. 0.1 = 10 barabar tukdon mein se 1."), visual: { type: "fraction", parts: 10, shaded: 3, shape: "bar" } },
    { title: T("Money uses decimals"), say: T("₹12.50 means 12 rupees and 50 paise, because 100 paise make a rupee. 0.5 is the same as half!", "₹12.50 मतलब 12 रुपये 50 पैसे, क्योंकि 100 पैसे = 1 रुपया। 0.5 = आधा!", "₹12.50 matlab 12 rupaye 50 paise, kyunki 100 paise = 1 rupaya. 0.5 = aadha!") },
  ],
  make: (d, rng) => {
    const tenths = ri(rng, 1, 9), whole = d <= 2 ? 0 : ri(rng, 0, 9);
    const ans = `${whole}.${tenths}`;
    return { prompt: T(whole ? `${whole} whole bar${whole > 1 ? "s" : ""} and ${tenths} tenths: which decimal?` : "What decimal is coloured?"), visual: { type: "fraction", parts: 10, shaded: tenths, shape: "bar" },
      choices: shuffle(rng, [ans, `${whole}.${10 - tenths === tenths ? (tenths % 9) + 1 : 10 - tenths}`, `${tenths}.${whole}`].filter((x, i, xs) => xs.indexOf(x) === i)), answer: ans,
      why: T(`${whole} whole${whole === 1 ? "" : "s"} before the dot, ${tenths} tenths after it: ${ans}.`),
      steps: [T("Whole things go BEFORE the dot."), T(`Wholes: ${whole}.`), T(`Count the coloured tenths (slices of 10): ${tenths}. They go AFTER the dot.`), T(`So: ${ans}.`)] };
  },
};

const factors: Topic = {
  id: "factors", strand: "numbers", icon: "🧱", title: T("Factors & multiples", "गुणनखंड और गुणज", "Factors aur multiples"), grades: [4, 5],
  cards: [
    { title: T("Factors make rectangles"), say: T("12 tiles can make neat rectangles: 1 × 12, 2 × 6, 3 × 4. The numbers that make those rectangles are the FACTORS of 12: 1, 2, 3, 4, 6, 12.", "12 टाइलें साफ़ आयत बनाती हैं: 1 × 12, 2 × 6, 3 × 4। इन आयतों की संख्याएँ 12 के गुणनखंड हैं: 1, 2, 3, 4, 6, 12।", "12 tiles saaf rectangle banati hain: 1 × 12, 2 × 6, 3 × 4. In rectangles ke numbers 12 ke FACTORS hain: 1, 2, 3, 4, 6, 12."), visual: { type: "array", rows: 3, cols: 4, emoji: "🟧" } },
    { title: T("Multiples are the times table"), say: T("Multiples of 4 are what you land on counting in 4s: 4, 8, 12, 16… A number with only 2 factors (1 and itself), like 7, is called PRIME.", "4 के गुणज 4-4 गिनने पर आते हैं: 4, 8, 12, 16… जिस संख्या के सिर्फ़ 2 गुणनखंड हों (1 और ख़ुद), जैसे 7, वह अभाज्य है।", "4 ke multiples 4-4 ginne pe aate hain: 4, 8, 12, 16… Jis number ke sirf 2 factors hon (1 aur khud), jaise 7, woh PRIME hai.") },
  ],
  make: (_d, rng) => {
    const kind = pick(rng, ["factor", "multiple", "prime"] as const);
    if (kind === "factor") {
      const n = pick(rng, [12, 18, 20, 24, 30, 36]);
      const fs = Array.from({ length: n }, (_, i) => i + 1).filter((k) => n % k === 0 && k > 1 && k < n);
      const f = pick(rng, fs), nf = pick(rng, Array.from({ length: n }, (_, i) => i + 2).filter((k) => n % k !== 0 && k < n));
      return { prompt: T(`Which of these is a factor of ${n}?`), choices: shuffle(rng, [String(f), String(nf)]), answer: String(f), why: T(`${n} ÷ ${f} = ${n / f} exactly, so ${f} × ${n / f} = ${n}: a factor. ${nf} leaves a remainder.`),
        steps: [T(`A factor divides ${n} with nothing left over.`), T(`${n} ÷ ${f} = ${n / f}, nothing left: factor ✓.`), T(`${n} ÷ ${nf} = ${Math.floor(n / nf)} remainder ${n % nf}: not a factor.`)] };
    }
    if (kind === "multiple") {
      const k = ri(rng, 3, 9), m = k * ri(rng, 2, 9), nm = m + ri(rng, 1, k - 1);
      return { prompt: T(`Which is a multiple of ${k}?`), choices: shuffle(rng, [String(m), String(nm)]), answer: String(m), why: T(`${m} = ${k} × ${m / k}: it's in the ${k} times table.`),
        steps: [T(`Multiples of ${k} are in the ${k} times table.`), T(`${k} × ${m / k} = ${m} ✓.`), T(`${nm} is not: ${k} × ${Math.floor(nm / k)} = ${k * Math.floor(nm / k)}, ${k} × ${Math.ceil(nm / k)} = ${k * Math.ceil(nm / k)}.`)] };
    }
    const p = pick(rng, [7, 11, 13, 17, 19, 23, 29]), c = pick(rng, [9, 15, 21, 25, 27, 33]);
    return { prompt: T("Which number is PRIME (only 1 and itself divide it)?"), choices: shuffle(rng, [String(p), String(c)]), answer: String(p),
      why: T(`${p} can only make a 1 × ${p} rectangle: prime. ${c} = ${[3, 5, 7, 11].find((x) => c % x === 0)} × ${c / [3, 5, 7, 11].find((x) => c % x === 0)!}: not prime.`) };
  },
};

const storyAddSub: Topic = {
  id: "story_add_sub", strand: "problems", icon: "📖", title: T("Story sums: + and −", "कहानी वाले सवाल: + और −", "Story sums: + aur −"), grades: [1, 3],
  cards: [
    { title: T("Read, picture, decide"), say: T("1. Read the story and picture it in your head. 2. Ask: are things coming TOGETHER (add) or going AWAY (take away)? 3. Find the numbers and solve. 4. Check: does the answer make sense?", "1. कहानी पढ़ो और मन में चित्र बनाओ। 2. पूछो: चीज़ें मिल रही हैं (जोड़) या जा रही हैं (घटाव)? 3. संख्याएँ ढूँढो और हल करो। 4. जाँचो: उत्तर सही लगता है?", "1. Kahani padho aur mann mein picture banao. 2. Poochho: cheezein mil rahi hain (jod) ya ja rahi hain (ghatao)? 3. Numbers dhoondho aur solve karo. 4. Check: answer sahi lagta hai?") },
    { title: T("Clue words"), say: T("'In all', 'altogether', 'more came' usually mean ADD. 'Left', 'gave away', 'how many more' usually mean SUBTRACT. But always picture the story first!", "'कुल', 'सब मिलाकर', 'और आए' अक्सर जोड़। 'बचे', 'दे दिए', 'कितने ज़्यादा' अक्सर घटाव। पर पहले कहानी का चित्र बनाओ!", "'Kul', 'sab milake', 'aur aaye' aksar JOD. 'Bache', 'de diye', 'kitne zyada' aksar GHATAO. Par pehle kahani ki picture banao!") },
  ],
  make: (d, rng) => {
    const max = [5, 10, 20, 50, 100][d - 1];
    const stories: (() => Exercise)[] = [
      () => { const a = ri(rng, 1, max), b = ri(rng, 1, max); return { prompt: T(`Riya has ${a} 🎈. Her friend gives her ${b} more. How many balloons in all?`, `रिया के पास ${a} 🎈 हैं। दोस्त ने ${b} और दिए। कुल कितने?`, `Riya ke paas ${a} 🎈 hain. Dost ne ${b} aur diye. Kul kitne?`), choices: numChoices(rng, a + b, 3), answer: String(a + b), numeric: true, why: T(`More came, so add: ${a} + ${b} = ${a + b}.`), steps: [T("Picture it: balloons are being GIVEN to Riya, so the group gets bigger → add."), ...(a + b >= 20 ? addSteps(a, b) : [T(`${a} + ${b} = ${a + b}.`)]), T(`Riya has ${a + b} balloons. Makes sense: more than she started with. ✓`)] }; },
      () => { const a = ri(rng, 2, max), b = ri(rng, 1, a - 1); return { prompt: T(`There are ${a} 🐦 on a tree. ${b} fly away. How many are left?`, `पेड़ पर ${a} 🐦 हैं। ${b} उड़ गईं। कितनी बचीं?`, `Ped pe ${a} 🐦 hain. ${b} ud gayi. Kitni bachi?`), choices: numChoices(rng, a - b, 3), answer: String(a - b), numeric: true, why: T(`Some went away, so subtract: ${a} − ${b} = ${a - b}.`), steps: [T("Picture it: birds fly AWAY, so fewer are left → subtract."), ...(a >= 20 ? subSteps(a, b) : [T(`${a} − ${b} = ${a - b}.`)]), T(`${a - b} birds are left. Fewer than before ✓.`)] }; },
      () => { const a = ri(rng, 1, max), b = a + ri(rng, 1, max); return { prompt: T(`Aman has ${a} 🍪 and Sara has ${b} 🍪. How many more does Sara have?`, `अमन के पास ${a} 🍪, सारा के पास ${b} 🍪। सारा के पास कितने ज़्यादा?`, `Aman ke paas ${a} 🍪, Sara ke paas ${b} 🍪. Sara ke paas kitne zyada?`), choices: numChoices(rng, b - a, 3), answer: String(b - a), numeric: true, why: T(`"How many more" compares: ${b} − ${a} = ${b - a}.`), steps: [T("Picture two rows of cookies side by side. Match them one to one."), T(`Sara's extra cookies have no partner: ${b} − ${a}.`), T(`${b} − ${a} = ${b - a}.`)] }; },
    ];
    return pick(rng, stories)();
  },
};

const storyMulDiv: Topic = {
  id: "story_mul_div", strand: "problems", icon: "🧺", title: T("Story sums: × and ÷", "कहानी वाले सवाल: × और ÷", "Story sums: × aur ÷"), grades: [2, 5],
  cards: [{ title: T("Equal groups"), say: T("If the story has EQUAL groups and asks for the total, multiply: 4 boxes with 6 pens = 4 × 6. If it shares a total EQUALLY, divide: 24 pens shared by 4 friends = 24 ÷ 4.", "अगर कहानी में बराबर समूह हैं और कुल पूछा है, तो गुणा: 4 डिब्बे, हर एक में 6 पेन = 4 × 6। अगर कुल को बराबर बाँटना है, तो भाग: 24 पेन 4 दोस्तों में = 24 ÷ 4।", "Agar kahani mein barabar group hain aur total poochha hai, toh guna: 4 dabbe, har ek mein 6 pen = 4 × 6. Agar total barabar baantna hai, toh bhaag: 24 pen 4 doston mein = 24 ÷ 4."), visual: { type: "array", rows: 4, cols: 6, emoji: "✏️" } }],
  make: (d, rng) => {
    const g = ri(rng, 2, d <= 2 ? 5 : 9), e = ri(rng, 2, d <= 2 ? 5 : 12), total = g * e;
    return rng() < 0.5
      ? { prompt: T(`There are ${g} baskets with ${e} 🍎 in each. How many apples altogether?`, `${g} टोकरियाँ हैं, हर एक में ${e} 🍎। कुल कितने सेब?`, `${g} tokriyan hain, har ek mein ${e} 🍎. Kul kitne apple?`), choices: numChoices(rng, total, e), answer: String(total), numeric: true, why: T(`${g} equal groups of ${e}: ${g} × ${e} = ${total}.`), steps: [T(`Equal groups and we want the total → multiply.`), T(`${g} baskets × ${e} apples = ${total}.`)] }
      : { prompt: T(`${total} 🍬 are shared equally by ${g} children. How many does each child get?`, `${total} 🍬, ${g} बच्चों में बराबर बाँटीं। हर एक को कितनी?`, `${total} 🍬, ${g} bachchon mein barabar baanti. Har ek ko kitni?`), choices: numChoices(rng, e, 2), answer: String(e), numeric: true, why: T(`Sharing equally → divide: ${total} ÷ ${g} = ${e}.`), steps: [T(`Sharing a total equally → divide.`), T(`${total} ÷ ${g}: count in ${g}s to ${total}: ${e} jumps.`), T(`Check: ${g} × ${e} = ${total}. ✓`)] };
  },
};

const twoStep: Topic = {
  id: "two_step", strand: "problems", icon: "🪜", title: T("Two-step problems", "दो-चरण वाले सवाल", "Two-step sawaal"), grades: [4, 5],
  cards: [{ title: T("Break it into small steps"), say: T("Big problems are just small problems stacked. Find what you need FIRST, solve that, then use the answer for the next step. Write each step on its own line.", "बड़े सवाल छोटे सवालों का ढेर हैं। पहले क्या चाहिए वह ढूँढो, हल करो, फिर उस उत्तर से अगला क़दम। हर क़दम अलग लाइन पर लिखो।", "Bade sawaal chhote sawaalon ka dher hain. Pehle kya chahiye woh dhoondho, solve karo, phir us answer se agla step. Har step alag line pe likho.") }],
  make: (_d, rng) => {
    const price = ri(rng, 5, 20), qty = ri(rng, 2, 6), note = pick(rng, [100, 200, 500].filter((x) => x > price * qty));
    const cost = price * qty, change = note - cost;
    return { prompt: T(`One notebook costs ₹${price}. Ravi buys ${qty} and pays with ₹${note}. How much change does he get?`, `एक कॉपी ₹${price} की। रवि ${qty} ख़रीदता है और ₹${note} देता है। कितने पैसे वापस?`, `Ek copy ₹${price} ki. Ravi ${qty} khareedta hai aur ₹${note} deta hai. Kitne paise wapas?`),
      choices: numChoices(rng, change, 10), answer: String(change), numeric: true, why: T(`Step 1: ${qty} × ₹${price} = ₹${cost}. Step 2: ₹${note} − ₹${cost} = ₹${change}.`),
      steps: [T(`What do we need first? The total cost.`), T(`Step 1: ${qty} notebooks × ₹${price} = ₹${cost}.`), T(`Step 2: change = what he paid − the cost.`), ...subSteps(note, cost), T(`Ravi gets ₹${change} back.`)] };
  },
};

const SOLIDS: { kind: "cube" | "cuboid" | "sphere" | "cylinder" | "cone" | "pyramid"; name: string; faces: number; edges: number; corners: number; like: string }[] = [
  { kind: "cube", name: "cube", faces: 6, edges: 12, corners: 8, like: "a dice 🎲" }, { kind: "cuboid", name: "cuboid", faces: 6, edges: 12, corners: 8, like: "a brick or a book 📘" },
  { kind: "sphere", name: "sphere", faces: 1, edges: 0, corners: 0, like: "a ball ⚽" }, { kind: "cylinder", name: "cylinder", faces: 3, edges: 2, corners: 0, like: "a tin can 🥫" },
  { kind: "cone", name: "cone", faces: 2, edges: 1, corners: 1, like: "an ice-cream cone 🍦" }, { kind: "pyramid", name: "pyramid", faces: 5, edges: 8, corners: 5, like: "the pyramids of Egypt" },
];
const solids: Topic = {
  id: "solids_3d", strand: "geometry", icon: "🎲", title: T("3D shapes", "ठोस आकृतियाँ", "3D shapes"), grades: [2, 4],
  cards: [
    { title: T("Shapes you can hold"), say: T("Flat shapes live on paper. 3D shapes are solid: you can hold them. A dice is a CUBE, a ball is a SPHERE, a tin can is a CYLINDER, an ice-cream cone is a CONE.", "समतल आकृतियाँ काग़ज़ पर रहती हैं। ठोस आकृतियों को पकड़ सकते हैं। पासा घन है, गेंद गोला, डिब्बा बेलन, आइसक्रीम कोन शंकु।", "Flat shapes kaagaz pe rehte hain. 3D shapes solid hain: pakad sakte ho. Dice CUBE hai, ball SPHERE, tin can CYLINDER, ice-cream cone CONE."), visual: { type: "solid", kind: "cube" } },
    { title: T("Faces, edges, corners"), say: T("A FACE is a flat side, an EDGE is where two faces meet (a line), a CORNER (vertex) is where edges meet (a point). A cube has 6 faces, 12 edges and 8 corners. Round shapes roll; flat faces let shapes stack.", "फलक = सपाट सतह, किनारा = जहाँ दो फलक मिलें, कोना = जहाँ किनारे मिलें। घन: 6 फलक, 12 किनारे, 8 कोने। गोल चीज़ें लुढ़कती हैं, सपाट वाली टिकती हैं।", "FACE = flat side, EDGE = jahan do faces milein, CORNER = jahan edges milein. Cube: 6 faces, 12 edges, 8 corners. Gol cheezein ludhakti hain, flat wali tikti hain."), visual: { type: "solid", kind: "cuboid" } },
  ],
  make: (d, rng) => {
    const s = pick(rng, SOLIDS);
    if (d >= 3 && s.edges > 0 && rng() < 0.6) {
      const what = pick(rng, ["faces", "edges", "corners"] as const);
      return { prompt: T(`How many ${what} does a ${s.name} have?`), visual: { type: "solid", kind: s.kind }, choices: numChoices(rng, s[what], 2), answer: String(s[what]), numeric: true,
        why: T(`A ${s.name} has ${s.faces} faces, ${s.edges} edges and ${s.corners} corners.`), steps: [T(what === "faces" ? "Count the flat (or curved) sides, front, back, top, bottom, left, right." : what === "edges" ? "Count the lines where two faces meet: top ones, bottom ones, then the standing ones." : "Count the pointy corners: top ones, then bottom ones."), T(`${s.name}: ${s[what]} ${what}.`)] };
    }
    return { prompt: T(`Which shape is like ${s.like}?`), visual: { type: "solid", kind: s.kind }, choices: shuffle(rng, [s.name, ...shuffle(rng, SOLIDS.filter((x) => x.name !== s.name)).slice(0, 2).map((x) => x.name)]), answer: s.name,
      why: T(`${s.like} is a ${s.name}: ${s.edges === 0 && s.corners === 0 ? "round all over, no corners" : `${s.faces} faces, ${s.edges} edges, ${s.corners} corners`}.`) };
  },
};

const weight: Topic = {
  id: "weight_capacity", strand: "measure", icon: "⚖️", title: T("Weight & capacity", "भार और धारिता", "Weight aur capacity"), grades: [2, 4],
  cards: [
    { title: T("Heavy and light"), say: T("Weight tells how heavy something is. We measure it in grams (g) for light things like a pencil, and kilograms (kg) for heavy things like you! 1 kg = 1000 g.", "भार बताता है चीज़ कितनी भारी है। हल्की चीज़ें ग्राम (g) में, भारी किलोग्राम (kg) में। 1 kg = 1000 g।", "Weight batata hai cheez kitni bhaari hai. Halki cheezein gram (g) mein, bhaari kilogram (kg) mein. 1 kg = 1000 g."), visual: { type: "balance", left: "1 kg", right: "1000 g" } },
    { title: T("How much it holds"), say: T("Capacity tells how much liquid a container holds: millilitres (mL) for a spoon, litres (L) for a bottle or a bucket. 1 L = 1000 mL.", "धारिता बताती है बर्तन में कितना द्रव आता है: चम्मच के लिए मिलीलीटर (mL), बोतल-बाल्टी के लिए लीटर (L)। 1 L = 1000 mL।", "Capacity batati hai bartan mein kitna liquid aata hai: chammach ke liye mL, bottle-baalti ke liye litre (L). 1 L = 1000 mL.") },
  ],
  make: (d, rng) => {
    if (d <= 2) {
      const pairs: [string, string][] = [["🐘 an elephant", "🐭 a mouse"], ["🍉 a watermelon", "🍇 a grape"], ["🧱 a brick", "🪶 a feather"], ["🚗 a car", "🚲 a bicycle"]];
      const [h, l] = pick(rng, pairs);
      return { prompt: T(`Which is heavier: ${h} or ${l}?`), choices: shuffle(rng, [h, l]), answer: h, why: T(`${h} is much bigger and has more stuff in it, so it is heavier and would push a balance down.`) };
    }
    const kg = rng() < 0.5, n = ri(rng, 1, 9), extra = d >= 4 ? ri(rng, 1, 9) * 100 : 0;
    const ans = n * 1000 + extra;
    return { prompt: T(kg ? `${n} kg ${extra ? `${extra} g` : ""} = how many grams?` : `${n} L ${extra ? `${extra} mL` : ""} = how many millilitres?`), choices: numChoices(rng, ans, 3), answer: String(ans), numeric: true,
      why: T(`1 ${kg ? "kg" : "L"} = 1000 ${kg ? "g" : "mL"}, so ${n} × 1000 = ${n * 1000}${extra ? `, plus ${extra} = ${ans}` : ""}.`),
      steps: [T(`Remember: 1 ${kg ? "kg" : "L"} = 1000 ${kg ? "g" : "mL"} ("kilo" means thousand).`), T(`${n} × 1000 = ${n * 1000}.`), ...(extra ? [T(`Add the extra ${extra}: ${n * 1000} + ${extra} = ${ans}.`)] : [])] };
  },
};

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const calendar: Topic = {
  id: "calendar", strand: "measure", icon: "📅", title: T("Days & months", "दिन और महीने", "Din aur mahine"), grades: [1, 3],
  cards: [{ title: T("A week is 7 days, a year is 12 months"), say: T("The 7 days go round and round: Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday, then Monday again. A year has 12 months and about 365 days.", "7 दिन घूमते रहते हैं: सोमवार से रविवार, फिर सोमवार। साल में 12 महीने और लगभग 365 दिन।", "7 din ghoomte rehte hain: Monday se Sunday, phir Monday. Saal mein 12 mahine aur lagbhag 365 din."), visual: { type: "steps", lines: DAYS } }],
  make: (d, rng) => {
    if (d <= 3) {
      const i = ri(rng, 0, 6), k = d <= 1 ? 1 : ri(rng, 1, 3), after = rng() < 0.6;
      const j = ((after ? i + k : i - k) % 7 + 7) % 7;
      return { prompt: T(`What day is ${k === 1 ? "" : `${k} days `}${after ? "after" : "before"} ${DAYS[i]}?`), choices: shuffle(rng, [DAYS[j], DAYS[(j + 1) % 7], DAYS[(j + 6) % 7]]), answer: DAYS[j],
        why: T(`Count ${after ? "forward" : "back"} ${k}: ${Array.from({ length: k }, (_, s) => DAYS[((after ? i + s + 1 : i - s - 1) % 7 + 7) % 7]).join(", ")}.`), steps: [T("Say the days in order, and when you pass Sunday start again at Monday."), T(`From ${DAYS[i]}, ${after ? "forward" : "back"} ${k}: ${DAYS[j]}.`)] };
    }
    const m = ri(rng, 0, 11), k = ri(rng, 1, 5);
    return { prompt: T(`Which month comes ${k} months after ${MONTHS[m]}?`), choices: shuffle(rng, [MONTHS[(m + k) % 12], MONTHS[(m + k + 1) % 12], MONTHS[(m + k + 11) % 12]]), answer: MONTHS[(m + k) % 12],
      why: T(`Count forward ${k}: ${Array.from({ length: k }, (_, s) => MONTHS[(m + s + 1) % 12]).join(", ")}.`) };
  },
};

export const MORE_MATHS: Topic[] = [neighbours, bonds, doubleHalf, rounding, roman, equivFrac, addFrac, decimals, factors, storyAddSub, storyMulDiv, twoStep, solids, weight, calendar];

/** Extra concept cards for the first topics: the same idea met in more than one simple way. */
export const EXTRA_MATHS_CARDS: Record<string, Card[]> = {
  count: [{ title: T("Zero means none"), say: T("If the plate is empty, there are ZERO cookies. 0 is how we write 'nothing'.", "थाली ख़ाली है तो शून्य कुकी। 0 मतलब 'कुछ नहीं'।", "Plate khaali hai toh ZERO cookie. 0 matlab 'kuch nahi'.") }],
  addition: [{ title: T("Order doesn't matter"), say: T("3 + 5 and 5 + 3 both make 8: swapping doesn't change the total. So always start with the bigger number and count on the smaller one!", "3 + 5 और 5 + 3 दोनों 8। अदला-बदली से कुल नहीं बदलता। तो हमेशा बड़ी संख्या से शुरू करो!", "3 + 5 aur 5 + 3 dono 8. Swap karne se total nahi badalta. Toh hamesha bade number se shuru karo!") }],
  subtraction: [{ title: T("Subtraction is finding the difference"), say: T("9 − 6 can also mean: how far is it from 6 up to 9? Count up: 7, 8, 9: 3 steps. Counting up is often easier than counting back!", "9 − 6 का मतलब यह भी: 6 से 9 कितना दूर? ऊपर गिनो: 7, 8, 9: 3 क़दम। ऊपर गिनना अक्सर आसान है!", "9 − 6 ka matlab yeh bhi: 6 se 9 kitna door? Upar gino: 7, 8, 9: 3 steps. Upar ginna aksar easy hai!"), visual: { type: "numberline", from: 5, to: 10, start: 6, hops: 3, step: 1 } }],
  multiplication: [{ title: T("Easy tables first"), say: T("× 1 keeps the number. × 2 is doubling. × 10 adds a 0. × 5 is half of × 10. Learn these first, and the hard ones become easy: 6 × 7 = 5 × 7 + 1 × 7 = 35 + 7 = 42.", "× 1 संख्या वही रखता है। × 2 दुगना। × 10 पीछे 0। × 5 = × 10 का आधा। पहले ये सीखो, फिर कठिन आसान: 6 × 7 = 35 + 7 = 42।", "× 1 number wahi rakhta hai. × 2 double. × 10 peeche 0. × 5 = × 10 ka aadha. Pehle ye seekho, phir tough easy: 6 × 7 = 35 + 7 = 42.") }],
  division: [{ title: T("Leftovers are remainders"), say: T("13 sweets for 4 friends: each gets 3 (that's 12), and 1 is left over. We write 13 ÷ 4 = 3 remainder 1.", "13 मिठाइयाँ 4 दोस्तों में: हर एक को 3 (कुल 12), 1 बची। 13 ÷ 4 = 3 शेष 1।", "13 mithaiyan 4 doston mein: har ek ko 3 (total 12), 1 bachi. 13 ÷ 4 = 3 remainder 1."), visual: { type: "share", total: 12, groups: 4, emoji: "🍬" } }],
  fractions: [{ title: T("Bigger bottom, smaller pieces"), say: T("1/2 of a pizza is bigger than 1/4, because cutting into more pieces makes each piece smaller. So a bigger bottom number means a SMALLER piece!", "पिज़्ज़ा का 1/2, 1/4 से बड़ा है, क्योंकि ज़्यादा टुकड़े करने से हर टुकड़ा छोटा होता है। तो नीचे बड़ी संख्या = छोटा टुकड़ा!", "Pizza ka 1/2, 1/4 se bada hai, kyunki zyada tukde karne se har tukda chhota hota hai. Toh neeche bada number = CHHOTA tukda!"), visual: { type: "fraction", parts: 2, shaded: 1, shape: "circle" } }],
  shapes: [{ title: T("Shapes all around us"), say: T("A door is a rectangle, a clock is a circle, a samosa is a triangle, a chessboard square is a square. Look around and find shapes!", "दरवाज़ा आयत, घड़ी वृत्त, समोसा त्रिभुज, शतरंज का खाना वर्ग। आसपास आकृतियाँ ढूँढो!", "Darwaaza rectangle, ghadi circle, samosa triangle, chess ka khaana square. Aas-paas shapes dhoondho!") }],
  time: [{ title: T("Quarter past and quarter to"), say: T("The clock face is like a pizza cut in 4. At 3 (15 minutes) it's QUARTER PAST. At 6 (30 minutes) HALF PAST. At 9 (45 minutes) it's QUARTER TO the next hour.", "घड़ी पिज़्ज़ा जैसी 4 हिस्सों में। 3 पर (15 मिनट) सवा। 6 पर (30) साढ़े। 9 पर (45) पौने अगला घंटा।", "Ghadi pizza jaisi 4 hisson mein. 3 pe (15 min) sawa. 6 pe (30) saadhe. 9 pe (45) paune agla ghanta."), visual: { type: "clock", h: 2, m: 15 } }],
  area_perimeter: [{ title: T("Fence and carpet"), say: T("Perimeter is the FENCE around a garden (we walk along it). Area is the CARPET that covers the floor (we count the squares). Different questions, different answers!", "परिमाप बगीचे के चारों ओर की बाड़ (उस पर चलते हैं)। क्षेत्रफल फ़र्श ढकने वाला क़ालीन (वर्ग गिनते हैं)।", "Perimeter garden ke chaaron taraf ki fence (uspe chalte hain). Area farsh dhakne wala carpet (squares ginte hain).") }],
  patterns: [{ title: T("Number patterns too"), say: T("Patterns aren't only colours: 2, 4, 6, 8 grows by 2 each time. Find the rule ('add 2'), then you can find any next number.", "पैटर्न सिर्फ़ रंग नहीं: 2, 4, 6, 8 हर बार 2 बढ़ता है। नियम ढूँढो ('2 जोड़ो'), फिर कोई भी अगली संख्या।", "Patterns sirf rang nahi: 2, 4, 6, 8 har baar 2 badhta hai. Rule dhoondho ('2 jodo'), phir koi bhi agla number.") }],
  money: [{ title: T("Change"), say: T("If something costs ₹7 and you give ₹10, the shopkeeper gives back ₹3 change. Count up from 7 to 10: 8, 9, 10: ₹3.", "चीज़ ₹7 की, तुमने ₹10 दिए, दुकानदार ₹3 वापस देगा। 7 से 10 तक गिनो: 8, 9, 10: ₹3।", "Cheez ₹7 ki, tumne ₹10 diye, dukaandaar ₹3 wapas dega. 7 se 10 tak gino: 8, 9, 10: ₹3.") }],
};
export type { Rng, Text };
