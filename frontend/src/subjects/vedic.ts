// More Vedic maths sutras and the quick mental tricks strong teachers use. Each: the trick in one sentence,
// a worked example step by step, WHY it works (so it is understanding, not magic), then practice where every
// answer shows the trick applied to that exact problem.
import { numChoices, pick, ri, shuffle, T, type Topic } from "./maths";

const sumDigits = (n: number): number => String(n).split("").reduce((s, c) => s + Number(c), 0);
const digitRoot = (n: number): number => { let x = n; while (x > 9) x = sumDigits(x); return x === 9 ? 0 : x; };

const times9: Topic = {
  id: "times_9", strand: "vedic", icon: "🔟", title: T("× 9 = × 10 − one more", "× 9 = × 10 − एक बार", "× 9 = × 10 − ek baar"), grades: [3, 5],
  cards: [
    { title: T("9 is 10 minus 1"), say: T("To multiply by 9: multiply by 10 (add a 0), then take away the number once. 23 × 9 = 230 − 23 = 207.", "9 से गुणा: पहले 10 से (0 लगाओ), फिर संख्या एक बार घटाओ। 23 × 9 = 230 − 23 = 207।", "9 se guna: pehle 10 se (0 lagao), phir number ek baar ghatao. 23 × 9 = 230 − 23 = 207."), visual: { type: "steps", lines: ["23 × 9", "23 × 10 = 230", "230 − 23", "= 207"] } },
    { title: T("Why it works"), say: T("9 groups of 23 is 10 groups of 23 with one group taken away. 10 groups is easy, and taking one group away is easy!", "23 के 9 समूह = 23 के 10 समूह में से एक समूह कम। 10 समूह आसान, एक हटाना आसान!", "23 ke 9 group = 23 ke 10 group mein se ek group kam. 10 group easy, ek hatana easy!") },
  ],
  make: (d, rng) => {
    const n = ri(rng, 2, [10, 20, 50, 99, 250][d - 1]), p = n * 9;
    return { prompt: T(`${n} × 9 = ?`), choices: numChoices(rng, p, 9), answer: String(p), numeric: true, why: T(`${n} × 10 = ${n * 10}, minus ${n} = ${p}.`),
      steps: [T(`× 10 first: ${n} → ${n * 10}.`), T(`That's one ${n} too many, so take ${n} away.`), T(`${n * 10} − ${n} = ${p}.`)] };
  },
};

const times25: Topic = {
  id: "times_25", strand: "vedic", icon: "🪙", title: T("× 25 = × 100 ÷ 4", "× 25 = × 100 ÷ 4", "× 25 = × 100 ÷ 4"), grades: [4, 5],
  cards: [{ title: T("Four quarters make a rupee"), say: T("25 is a quarter of 100 (like 25 paise: four make a rupee). So × 25 = × 100, then ÷ 4. 36 × 25 = 3600 ÷ 4 = 900.", "25, 100 का चौथाई है (जैसे 25 पैसे: चार मिलकर रुपया)। तो × 25 = × 100, फिर ÷ 4। 36 × 25 = 3600 ÷ 4 = 900।", "25, 100 ka chauthaai hai (jaise 25 paise: chaar milke rupaya). Toh × 25 = × 100, phir ÷ 4. 36 × 25 = 3600 ÷ 4 = 900."), visual: { type: "steps", lines: ["36 × 25", "36 × 100 = 3600", "3600 ÷ 4 = 900"] } }],
  make: (_d, rng) => {
    const n = 4 * ri(rng, 1, 25), p = n * 25;
    return { prompt: T(`${n} × 25 = ?`), choices: numChoices(rng, p, 25), answer: String(p), numeric: true, why: T(`${n} × 100 = ${n * 100}, ÷ 4 = ${p}.`),
      steps: [T(`× 100: add two zeros: ${n * 100}.`), T(`25 is a quarter of 100, so divide by 4: halve, then halve again.`), T(`${n * 100} → ${n * 50} → ${p}.`)] };
  },
};

const doubleDouble: Topic = {
  id: "double_double", strand: "vedic", icon: "👯", title: T("× 4 and × 8 by doubling", "दुगना करके × 4 और × 8", "Double karke × 4 aur × 8"), grades: [2, 4],
  cards: [{ title: T("Double, double, double"), say: T("× 2 is doubling. × 4 = double, then double again. × 8 = double three times. 17 × 4: 17 → 34 → 68. Doubling is the easiest thing to do in your head!", "× 2 = दुगना। × 4 = दुगना, फिर दुगना। × 8 = तीन बार दुगना। 17 × 4: 17 → 34 → 68। दुगना करना मन में सबसे आसान!", "× 2 = double. × 4 = double, phir double. × 8 = teen baar double. 17 × 4: 17 → 34 → 68. Double karna mann mein sabse easy!"), visual: { type: "steps", lines: ["17 × 4", "17 → 34", "34 → 68"] } }],
  make: (d, rng) => {
    const k = d <= 2 ? 4 : pick(rng, [4, 8]), n = ri(rng, 3, d <= 2 ? 15 : 45);
    const chain = [n]; while (chain.length < (k === 4 ? 3 : 4)) chain.push(chain[chain.length - 1] * 2);
    return { prompt: T(`${n} × ${k} = ?`), choices: numChoices(rng, n * k, k), answer: String(n * k), numeric: true, why: T(`Double ${k === 4 ? "twice" : "three times"}: ${chain.join(" → ")}.`),
      steps: [T(`× ${k} = doubling ${k === 4 ? "2" : "3"} times, because ${k === 4 ? "2 × 2 = 4" : "2 × 2 × 2 = 8"}.`), ...chain.slice(1).map((c, i) => T(`Double ${chain[i]} = ${c}.`))] };
  },
};

const div5: Topic = {
  id: "div_5", strand: "vedic", icon: "✂️", title: T("÷ 5 = double, then ÷ 10", "÷ 5 = दुगना, फिर ÷ 10", "÷ 5 = double, phir ÷ 10"), grades: [3, 5],
  cards: [{ title: T("5 is half of 10"), say: T("Dividing by 5 gives twice as many as dividing by 10. So double the number, then divide by 10 (drop the 0). 170 ÷ 5: 340 ÷ 10 = 34.", "5 से भाग, 10 से भाग का दुगना देता है। तो संख्या दुगनी करो, फिर 10 से भाग (0 हटाओ)। 170 ÷ 5: 340 ÷ 10 = 34।", "5 se bhaag, 10 se bhaag ka double deta hai. Toh number double karo, phir 10 se bhaag (0 hatao). 170 ÷ 5: 340 ÷ 10 = 34."), visual: { type: "steps", lines: ["170 ÷ 5", "170 × 2 = 340", "340 ÷ 10 = 34"] } }],
  make: (d, rng) => {
    const q = ri(rng, 2, [10, 20, 50, 100, 200][d - 1]), n = q * 5;
    return { prompt: T(`${n} ÷ 5 = ?`), choices: numChoices(rng, q, 3), answer: String(q), numeric: true, why: T(`Double: ${n * 2}. ÷ 10: ${q}.`),
      steps: [T(`Double ${n}: ${n * 2}.`), T(`Divide by 10 (take off the last 0): ${q}.`), T(`Check: ${q} × 5 = ${n}. ✓`)] };
  },
};

const halveDouble: Topic = {
  id: "halve_double", strand: "vedic", icon: "⚖️", title: T("Halve one, double the other", "एक आधा, दूसरा दुगना", "Ek aadha, doosra double"), grades: [3, 5],
  cards: [{ title: T("Keep the area the same"), say: T("A 4 by 6 rectangle and an 8 by 3 rectangle have the same area: if one side is halved and the other doubled, the product stays the same. Use it to reach easy numbers: 16 × 5 = 8 × 10 = 80.", "4 × 6 और 8 × 3 आयत का क्षेत्रफल बराबर: एक भुजा आधी, दूसरी दुगनी, तो गुणनफल वही। आसान संख्या पाने के लिए: 16 × 5 = 8 × 10 = 80।", "4 × 6 aur 8 × 3 rectangle ka area barabar: ek side aadhi, doosri double, toh product wahi. Easy number paane ke liye: 16 × 5 = 8 × 10 = 80."), visual: { type: "steps", lines: ["16 × 5", "= 8 × 10", "= 80"] } }],
  make: (_d, rng) => {
    const pairs: [number, number][] = [[16, 5], [14, 5], [18, 50], [24, 25], [12, 15], [22, 5], [32, 25], [14, 15], [26, 5], [44, 25]];
    let [a, b] = pick(rng, pairs); const p = a * b;
    const chain: string[] = [`${a} × ${b}`];
    while (a % 2 === 0 && ![10, 100].includes(b) && chain.length < 4) { a /= 2; b *= 2; chain.push(`${a} × ${b}`); }
    return { prompt: T(`${chain[0]} = ?`), choices: numChoices(rng, p, 10), answer: String(p), numeric: true, why: T(`${chain.join(" = ")} = ${p}.`),
      steps: [T("Halve the even number, double the other: the answer stays the same."), ...chain.slice(1).map((c) => T(`= ${c}`)), T(`= ${p}.`)] };
  },
};

const teens: Topic = {
  id: "teens", strand: "vedic", icon: "🧒", title: T("Teen × teen (11-19)", "किशोर × किशोर (11-19)", "Teen × teen (11-19)"), grades: [4, 5],
  cards: [
    { title: T("Add, then add the little product"), say: T("13 × 14: add the first number and the LAST digit of the other: 13 + 4 = 17, then × 10 = 170. Multiply the last digits: 3 × 4 = 12. Add: 170 + 12 = 182!", "13 × 14: पहली संख्या + दूसरी का आख़िरी अंक: 13 + 4 = 17, × 10 = 170। आख़िरी अंकों का गुणा: 3 × 4 = 12। जोड़ो: 182!", "13 × 14: pehla number + doosre ka last digit: 13 + 4 = 17, × 10 = 170. Last digits ka guna: 3 × 4 = 12. Jodo: 182!"), visual: { type: "steps", lines: ["13 × 14", "13 + 4 = 17 → 170", "3 × 4 = 12", "170 + 12 = 182"] } },
    { title: T("Why it works"), say: T("(10 + 3)(10 + 4) = 100 + 10·(3 + 4) + 3·4 = 10·(13 + 4) + 12. The trick just groups the pieces of the rectangle cleverly.", "(10 + 3)(10 + 4) = 100 + 10·(3 + 4) + 3·4 = 10·(13 + 4) + 12। तरकीब बस आयत के टुकड़ों को चतुराई से जोड़ती है।", "(10 + 3)(10 + 4) = 100 + 10·(3 + 4) + 3·4 = 10·(13 + 4) + 12. Trick bas rectangle ke tukdon ko smartly jodti hai.") },
  ],
  make: (_d, rng) => {
    const a = ri(rng, 11, 19), b = ri(rng, 11, 19), x = a % 10, y = b % 10;
    return { prompt: T(`${a} × ${b} = ?`), choices: numChoices(rng, a * b, 10), answer: String(a * b), numeric: true, why: T(`(${a} + ${y}) × 10 = ${(a + y) * 10}, ${x} × ${y} = ${x * y}, total ${a * b}.`),
      steps: [T(`${a} + ${y} (last digit of ${b}) = ${a + y}.`), T(`× 10: ${(a + y) * 10}.`), T(`Last digits: ${x} × ${y} = ${x * y}.`), T(`Add: ${(a + y) * 10} + ${x * y} = ${a * b}.`)] };
  },
};

const urdhva: Topic = {
  id: "urdhva", strand: "vedic", icon: "✖️", title: T("Urdhva Tiryak: crosswise", "ऊर्ध्व तिर्यक: तिरछा गुणा", "Urdhva Tiryak: crosswise"), grades: [4, 5],
  cards: [
    { title: T("Vertically and crosswise"), say: T("Urdhva Tiryagbhyam means 'vertically and crosswise'. For 23 × 14: RIGHT: 3 × 4 = 12, write 2 carry 1. MIDDLE (cross): 2 × 4 + 3 × 1 = 11, + 1 = 12, write 2 carry 1. LEFT: 2 × 1 = 2, + 1 = 3. Answer 322!", "ऊर्ध्व तिर्यग्भ्याम् मतलब 'सीधा और तिरछा'। 23 × 14: दायाँ: 3 × 4 = 12, 2 लिखो 1 हासिल। बीच (तिरछा): 2 × 4 + 3 × 1 = 11, + 1 = 12, 2 लिखो 1 हासिल। बायाँ: 2 × 1 + 1 = 3। उत्तर 322!", "Urdhva Tiryagbhyam matlab 'seedha aur tircha'. 23 × 14: RIGHT: 3 × 4 = 12, 2 likho 1 carry. MIDDLE (cross): 2 × 4 + 3 × 1 = 11, + 1 = 12, 2 likho 1 carry. LEFT: 2 × 1 + 1 = 3. Answer 322!"), visual: { type: "steps", lines: ["  2 3", "× 1 4", "right: 3×4 = 12", "cross: 2×4 + 3×1 = 11 (+1)", "left: 2×1 = 2 (+1)", "= 322"] } },
    { title: T("Why it works"), say: T("Each digit pair lands in its place: ones × ones go in the ones, the cross products are tens, tens × tens are hundreds. It's the long multiplication you know, all done in one line!", "हर जोड़ी अपनी जगह जाती है: इकाई × इकाई इकाई में, तिरछे गुणनफल दहाई में, दहाई × दहाई सैकड़े में। वही लंबा गुणा, एक लाइन में!", "Har jodi apni jagah jaati hai: ones × ones ones mein, cross products tens mein, tens × tens hundreds mein. Wahi lamba guna, ek line mein!") },
  ],
  make: (d, rng) => {
    const a = ri(rng, 11, d <= 3 ? 39 : 99), b = ri(rng, 11, d <= 3 ? 29 : 99);
    const [a1, a0, b1, b0] = [Math.floor(a / 10), a % 10, Math.floor(b / 10), b % 10];
    const r = a0 * b0, m = a1 * b0 + a0 * b1 + Math.floor(r / 10), l = a1 * b1 + Math.floor(m / 10);
    return { prompt: T(`${a} × ${b} = ?`), choices: numChoices(rng, a * b, 20), answer: String(a * b), numeric: true, why: T(`Right ${a0}×${b0}, cross ${a1}×${b0}+${a0}×${b1}, left ${a1}×${b1}, with carries: ${a * b}.`),
      steps: [T(`Right (vertical): ${a0} × ${b0} = ${r}. Write ${r % 10}${r >= 10 ? `, carry ${Math.floor(r / 10)}` : ""}.`),
        T(`Middle (crosswise): ${a1} × ${b0} + ${a0} × ${b1}${r >= 10 ? ` + ${Math.floor(r / 10)}` : ""} = ${m}. Write ${m % 10}${m >= 10 ? `, carry ${Math.floor(m / 10)}` : ""}.`),
        T(`Left (vertical): ${a1} × ${b1}${m >= 10 ? ` + ${Math.floor(m / 10)}` : ""} = ${l}.`), T(`Read it: ${l}${m % 10}${r % 10} = ${a * b}.`)] };
  },
};

const ends10: Topic = {
  id: "ends_10", strand: "vedic", icon: "🔗", title: T("Same start, ends add to 10", "पहला अंक एक, आख़िरी का जोड़ 10", "Pehla digit same, last ka jod 10"), grades: [4, 5],
  cards: [{ title: T("Antyayor Dashake'pi"), say: T("When the first digits are the same and the last digits add to 10 (like 43 × 47): multiply the first digit by the next number: 4 × 5 = 20. Multiply the last digits: 3 × 7 = 21. Put them together: 2021!", "जब पहले अंक बराबर हों और आख़िरी अंकों का जोड़ 10 (जैसे 43 × 47): पहला अंक × अगली संख्या: 4 × 5 = 20। आख़िरी अंकों का गुणा: 3 × 7 = 21। साथ रखो: 2021!", "Jab pehle digit same hon aur last digits ka jod 10 (jaise 43 × 47): pehla digit × agla number: 4 × 5 = 20. Last digits ka guna: 3 × 7 = 21. Saath rakho: 2021!"), visual: { type: "steps", lines: ["43 × 47", "3 + 7 = 10 ✓", "4 × 5 = 20", "3 × 7 = 21", "2021"] } }],
  make: (_d, rng) => {
    const t = ri(rng, 1, 9), x = ri(rng, 1, 9), a = 10 * t + x, b = 10 * t + (10 - x), right = x * (10 - x);
    return { prompt: T(`${a} × ${b} = ?`), choices: numChoices(rng, a * b, 100), answer: String(a * b), numeric: true, why: T(`${x} + ${10 - x} = 10 and both start with ${t}: ${t} × ${t + 1} = ${t * (t + 1)}, ${x} × ${10 - x} = ${String(right).padStart(2, "0")} → ${a * b}.`),
      steps: [T(`Check the rule: first digits both ${t}, last digits ${x} + ${10 - x} = 10. ✓`), T(`Left: ${t} × ${t + 1} = ${t * (t + 1)}.`), T(`Right: ${x} × ${10 - x} = ${right}${right < 10 ? ` → write it as 0${right} (always two digits)` : ""}.`), T(`Together: ${a * b}.`)] };
  },
};

const near50: Topic = {
  id: "near_50", strand: "vedic", icon: "🎯", title: T("Squares near 50", "50 के पास के वर्ग", "50 ke paas ke squares"), grades: [5, 5],
  cards: [{ title: T("Start from 25"), say: T("For a number near 50, the square starts with 25 plus how far above 50 it is (or minus if below), then two digits of the distance squared. 53² = (25 + 3)|3² = 28|09 = 2809. 48² = (25 − 2)|2² = 23|04 = 2304.", "50 के पास की संख्या का वर्ग: 25 + (50 से कितना ऊपर) या − (कितना नीचे), फिर दूरी का वर्ग दो अंकों में। 53² = 28|09 = 2809। 48² = 23|04 = 2304।", "50 ke paas ke number ka square: 25 + (50 se kitna upar) ya − (kitna neeche), phir doori ka square do digits mein. 53² = 28|09 = 2809. 48² = 23|04 = 2304."), visual: { type: "steps", lines: ["53²", "25 + 3 = 28", "3² = 09", "2809"] } }],
  make: (_d, rng) => {
    const k = ri(rng, 1, 9) * (rng() < 0.5 ? -1 : 1), n = 50 + k, sq = n * n;
    return { prompt: T(`${n} × ${n} = ?`), choices: numChoices(rng, sq, 100), answer: String(sq), numeric: true, why: T(`25 ${k > 0 ? "+" : "−"} ${Math.abs(k)} = ${25 + k}, ${Math.abs(k)}² = ${String(k * k).padStart(2, "0")} → ${sq}.`),
      steps: [T(`${n} is ${Math.abs(k)} ${k > 0 ? "above" : "below"} 50.`), T(`Left: 25 ${k > 0 ? "+" : "−"} ${Math.abs(k)} = ${25 + k}.`), T(`Right: ${Math.abs(k)} × ${Math.abs(k)} = ${k * k}, written with two digits: ${String(k * k).padStart(2, "0")}.`), T(`Together: ${sq}.`)] };
  },
};

const digitCheck: Topic = {
  id: "digit_sum_check", strand: "vedic", icon: "🔍", title: T("Check answers: digit sums", "अंकों के जोड़ से जाँच", "Digit sum se check"), grades: [4, 5],
  cards: [
    { title: T("Navasesh: the nine-remainder"), say: T("Add a number's digits again and again until one digit is left (9 counts as 0). 47 → 4 + 7 = 11 → 1 + 1 = 2. This 'digit sum' lets you CHECK a sum or product in seconds.", "संख्या के अंक बार-बार जोड़ो जब तक एक अंक बचे (9 को 0 मानो)। 47 → 11 → 2। इस 'अंक-योग' से जोड़ या गुणा सेकंडों में जाँचो।", "Number ke digits baar-baar jodo jab tak ek digit bache (9 ko 0 maano). 47 → 11 → 2. Is 'digit sum' se jod ya guna seconds mein check karo.") },
    { title: T("How to check"), say: T("For 23 × 14 = 322: digit sums 5 and 5, 5 × 5 = 25 → 7. And 322 → 3 + 2 + 2 = 7. They match, so the answer is probably right! If they don't match, it's surely wrong.", "23 × 14 = 322 के लिए: अंक-योग 5 और 5, 5 × 5 = 25 → 7। और 322 → 7। मिलते हैं, तो उत्तर शायद सही! न मिलें तो पक्का ग़लत।", "23 × 14 = 322 ke liye: digit sums 5 aur 5, 5 × 5 = 25 → 7. Aur 322 → 7. Match karte hain, toh answer shaayad sahi! Match na ho toh pakka galat."), visual: { type: "steps", lines: ["23 → 5", "14 → 5", "5 × 5 = 25 → 7", "322 → 7 ✓"] } },
  ],
  make: (_d, rng) => {
    const a = ri(rng, 12, 99), b = ri(rng, 12, 99), right = a * b, wrong = right + pick(rng, [1, 2, 10, -10, 3]);
    const shown = rng() < 0.5 ? right : wrong, ok = shown === right;
    const ra = digitRoot(a), rb = digitRoot(b), rp = digitRoot(ra * rb), rs = digitRoot(shown);
    return { prompt: T(`Is ${a} × ${b} = ${shown} correct? Check with digit sums.`), choices: ["correct", "wrong"], answer: ok ? "correct" : "wrong",
      why: T(`${a} → ${ra}, ${b} → ${rb}, ${ra} × ${rb} → ${rp}. ${shown} → ${rs}. ${rp === rs ? "They match: correct." : "They don't match: wrong."}`),
      steps: [T(`Digit sum of ${a}: ${ra}. Of ${b}: ${rb}.`), T(`Multiply them: ${ra} × ${rb} = ${ra * rb} → ${rp}.`), T(`Digit sum of ${shown}: ${rs}.`), T(rp === rs ? `${rp} = ${rs}: it checks out.` : `${rp} ≠ ${rs}: the answer must be wrong. (The right answer is ${right}.)`)] };
  },
};

const roundAdjust: Topic = {
  id: "round_adjust", strand: "vedic", icon: "🎯", title: T("Add by rounding", "राउंड करके जोड़ो", "Round karke jodo"), grades: [2, 4],
  cards: [{ title: T("Make a friendly number, then fix it"), say: T("47 + 38: 38 is almost 40. 47 + 40 = 87, but we added 2 too many, so 87 − 2 = 85. Round to a friendly number, then fix the difference!", "47 + 38: 38 लगभग 40। 47 + 40 = 87, पर 2 ज़्यादा जोड़े, तो 87 − 2 = 85। दोस्ताना संख्या बनाओ, फिर अंतर ठीक करो!", "47 + 38: 38 lagbhag 40. 47 + 40 = 87, par 2 zyada jode, toh 87 − 2 = 85. Friendly number banao, phir difference theek karo!"), visual: { type: "steps", lines: ["47 + 38", "47 + 40 = 87", "87 − 2 = 85"] } }],
  make: (d, rng) => {
    const a = ri(rng, 11, d <= 2 ? 50 : 500), b = 10 * ri(rng, 1, d <= 2 ? 5 : 30) - ri(rng, 1, 3), r = b + (10 - (b % 10)) % 10, extra = r - b;
    return { prompt: T(`${a} + ${b} = ?`), choices: numChoices(rng, a + b, 3), answer: String(a + b), numeric: true, why: T(`${b} is ${r} − ${extra}: ${a} + ${r} = ${a + r}, − ${extra} = ${a + b}.`),
      steps: [T(`${b} is close to the friendly number ${r} (${extra} more).`), T(`${a} + ${r} = ${a + r}.`), T(`We added ${extra} too many: ${a + r} − ${extra} = ${a + b}.`)] };
  },
};

const shopkeeper: Topic = {
  id: "shopkeeper", strand: "vedic", icon: "🛍️", title: T("Subtract by counting up", "ऊपर गिनकर घटाओ", "Upar gin ke ghatao"), grades: [2, 4],
  cards: [{ title: T("The shopkeeper's way"), say: T("Shopkeepers give change by counting UP: 100 − 63: from 63 to 70 is 7, from 70 to 100 is 30. 7 + 30 = 37. No borrowing at all!", "दुकानदार ऊपर गिनकर पैसे लौटाते हैं: 100 − 63: 63 से 70 तक 7, 70 से 100 तक 30। 7 + 30 = 37। उधार की ज़रूरत नहीं!", "Dukaandaar upar gin ke paise lautaate hain: 100 − 63: 63 se 70 tak 7, 70 se 100 tak 30. 7 + 30 = 37. Borrow ki zaroorat nahi!"), visual: { type: "numberline", from: 60, to: 100, start: 63, hops: 0, step: 1 } }],
  make: (d, rng) => {
    const big = d <= 2 ? 50 : pick(rng, [100, 200, 500]), small = ri(rng, Math.floor(big / 3), big - 3);
    const nextTen = Math.ceil(small / 10) * 10, s1 = nextTen - small, s2 = big - nextTen;
    return { prompt: T(`${big} − ${small} = ?`), choices: numChoices(rng, big - small, 10), answer: String(big - small), numeric: true, why: T(`Count up: ${small} → ${nextTen} is ${s1}, ${nextTen} → ${big} is ${s2}. ${s1} + ${s2} = ${big - small}.`),
      steps: [T(`Start at ${small} and count UP to ${big}.`), T(`To the next ten: ${small} → ${nextTen}: ${s1}.`), T(`Then to ${big}: ${nextTen} → ${big}: ${s2}.`), T(`Add the jumps: ${s1} + ${s2} = ${big - small}.`)] };
  },
};

const div9: Topic = {
  id: "div_9", strand: "vedic", icon: "9️⃣", title: T("Vedic ÷ 9", "वैदिक ÷ 9", "Vedic ÷ 9"), grades: [4, 5],
  cards: [{ title: T("First digit, then digit sum"), say: T("For a 2-digit number ÷ 9 (when its digits add to less than 9): the answer is the FIRST digit, and the remainder is the SUM of the digits. 23 ÷ 9 = 2 remainder 5 (2 + 3)!", "दो अंकों वाली संख्या ÷ 9 (जब अंकों का जोड़ 9 से कम हो): भागफल = पहला अंक, शेष = अंकों का जोड़। 23 ÷ 9 = 2 शेष 5!", "2-digit number ÷ 9 (jab digits ka jod 9 se kam ho): answer = PEHLA digit, remainder = digits ka JOD. 23 ÷ 9 = 2 remainder 5!"), visual: { type: "steps", lines: ["23 ÷ 9", "quotient: 2", "remainder: 2 + 3 = 5"] } }],
  make: (_d, rng) => {
    const a = ri(rng, 1, 7), b = ri(rng, 0, 8 - a), n = 10 * a + b;
    const ans = `${a} r ${a + b}`;
    return { prompt: T(`${n} ÷ 9 = ? (quotient r remainder)`), choices: shuffle(rng, [ans, `${a + b} r ${a}`, `${a} r ${b}`].filter((x, i, xs) => xs.indexOf(x) === i)), answer: ans,
      why: T(`Quotient = first digit ${a}; remainder = ${a} + ${b} = ${a + b}. Check: 9 × ${a} + ${a + b} = ${n}. ✓`),
      steps: [T(`First digit: ${a}. That's how many 9s fit.`), T(`Remainder: add the digits: ${a} + ${b} = ${a + b}.`), T(`Why: each ten is 9 + 1, so ${a} tens give ${a} nines and ${a} extra ones, plus the ${b} ones.`)] };
  },
};

const divisibility: Topic = {
  id: "divisibility", strand: "vedic", icon: "🕵️", title: T("Divisibility detective", "विभाज्यता जासूस", "Divisibility detective"), grades: [4, 5],
  cards: [{ title: T("Quick tests"), say: T("By 2: last digit even. By 5: ends in 0 or 5. By 10: ends in 0. By 3: digits add to a multiple of 3. By 9: digits add to a multiple of 9. 738: 7 + 3 + 8 = 18, so 738 is divisible by both 3 and 9!", "2 से: आख़िरी अंक सम। 5 से: 0 या 5 पर ख़त्म। 10 से: 0 पर। 3 से: अंकों का जोड़ 3 का गुणज। 9 से: अंकों का जोड़ 9 का गुणज। 738: 18, तो 3 और 9 दोनों से!", "2 se: last digit even. 5 se: 0 ya 5 pe khatam. 10 se: 0 pe. 3 se: digits ka jod 3 ka multiple. 9 se: digits ka jod 9 ka multiple. 738: 18, toh 3 aur 9 dono se!") }],
  make: (_d, rng) => {
    const k = pick(rng, [2, 3, 5, 9, 10]), yes = rng() < 0.5;
    let n = ri(rng, 100, 999); while ((n % k === 0) !== yes) n++;
    const s = sumDigits(n);
    const rule = k === 2 ? `last digit ${n % 10} is ${n % 2 ? "odd" : "even"}` : k === 5 ? `it ends in ${n % 10}` : k === 10 ? `it ends in ${n % 10}` : `digit sum ${String(n).split("").join(" + ")} = ${s}${s % k === 0 ? ` is a multiple of ${k}` : ` is not a multiple of ${k}`}`;
    return { prompt: T(`Is ${n} divisible by ${k}?`), choices: ["yes", "no"], answer: yes ? "yes" : "no", why: T(`${rule}, so ${yes ? "yes" : "no"}.`),
      steps: [T(`Rule for ${k}: ${k === 2 ? "last digit even" : k === 5 ? "ends in 0 or 5" : k === 10 ? "ends in 0" : `digits add to a multiple of ${k}`}.`), T(`${rule}.`), T(yes ? `So ${n} ÷ ${k} = ${n / k} exactly.` : `So ${n} ÷ ${k} leaves a remainder of ${n % k}.`)] };
  },
};

export const MORE_VEDIC: Topic[] = [roundAdjust, shopkeeper, doubleDouble, times9, div5, halveDouble, times25, teens, urdhva, ends10, near50, div9, divisibility, digitCheck];
