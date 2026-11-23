// Worked solutions, one tiny step at a time, for the exercises of the original topics: built from the
// exercise's own numbers (its prompt and picture), so every question can be explained the way a patient
// teacher does it on the board: "Ones first: 7 + 5 = 12. Write 2, carry 1 ten…".
import type { Text } from "../i18n";
import { T, type Exercise } from "./maths";

const nums = (s: string) => (s.match(/\d+/g) ?? []).map(Number);
const digits = (n: number) => String(n).split("").map(Number).reverse(); // ones first
const PLACE = [T("ones", "इकाई", "ones"), T("tens", "दहाई", "tens"), T("hundreds", "सैकड़े", "hundreds"), T("thousands", "हज़ार", "thousands")];
const place = (i: number) => PLACE[i] ?? T(`column ${i + 1}`);

/** Column addition, column by column, with every carry said out loud. */
export function addSteps(a: number, b: number): Text[] {
  const out: Text[] = [T(`Write ${a} and ${b} one under the other: ones under ones, tens under tens.`, `${a} और ${b} को एक के नीचे एक लिखो: इकाई के नीचे इकाई, दहाई के नीचे दहाई।`, `${a} aur ${b} ko ek ke neeche ek likho: ones ke neeche ones, tens ke neeche tens.`)];
  const A = digits(a), B = digits(b);
  let carry = 0;
  for (let i = 0; i < Math.max(A.length, B.length); i++) {
    const x = A[i] ?? 0, y = B[i] ?? 0, s = x + y + carry;
    const pl = place(i);
    const add = `${x} + ${y}${carry ? ` + ${carry} (carried)` : ""} = ${s}`;
    out.push(s >= 10
      ? T(`${pl.en}: ${add}. That's 10 or more, so write ${s % 10} and carry 1 to the ${place(i + 1).en}.`, `${pl.hi}: ${add}। 10 या ज़्यादा है, तो ${s % 10} लिखो और 1 हासिल ${place(i + 1).hi} में।`, `${pl.en}: ${add}. 10 ya zyada hai, toh ${s % 10} likho aur 1 carry ${place(i + 1).en} mein.`)
      : T(`${pl.en}: ${add}. Write ${s}.`, `${pl.hi}: ${add}। ${s} लिखो।`, `${pl.en}: ${add}. ${s} likho.`));
    carry = s >= 10 ? 1 : 0;
  }
  if (carry) out.push(T("The last carry goes in front: write 1.", "आख़िरी हासिल आगे लिखो: 1।", "Last carry aage likho: 1."));
  out.push(T(`So ${a} + ${b} = ${a + b}.`, `तो ${a} + ${b} = ${a + b}।`, `Toh ${a} + ${b} = ${a + b}.`));
  return out;
}

/** Column subtraction with each borrow explained ("open one ten into 10 ones"). */
export function subSteps(a: number, b: number): Text[] {
  const out: Text[] = [T(`Write ${a} on top and ${b} below it, ones under ones.`, `${a} ऊपर और ${b} नीचे लिखो, इकाई के नीचे इकाई।`, `${a} upar aur ${b} neeche likho, ones ke neeche ones.`)];
  const A = digits(a), B = digits(b); // A changes as we borrow, exactly like crossing out digits on paper
  for (let i = 0; i < A.length; i++) {
    const y = B[i] ?? 0, pl = place(i);
    if (A[i] < y) {
      // find the nearest place on the left that has something to open (zeros in between must be opened too)
      let j = i + 1;
      while (A[j] === 0) j++;
      if (j > i + 1) {
        out.push(T(`${pl.en}: ${A[i]} is smaller than ${y}, but there are no ${place(i + 1).en} to open. So first open 1 of the ${place(j).en} into 10 ${place(j - 1).en}${j - 1 > i + 1 ? ", and keep opening to the right" : ""}.`,
          `${pl.hi}: ${A[i]}, ${y} से छोटा है, पर ${place(i + 1).hi} में कुछ नहीं। तो पहले 1 ${place(j).hi} खोलकर 10 ${place(j - 1).hi} बनाओ।`,
          `${pl.en}: ${A[i]}, ${y} se chhota hai, par ${place(i + 1).en} mein kuch nahi. Toh pehle 1 ${place(j).en} khol ke 10 ${place(j - 1).en} banao.`));
        A[j] -= 1;
        for (let k = j - 1; k > i; k--) A[k] = 9; // 10 of them, one passed on to the right
        out.push(T(`Now take 1 of those ${place(i + 1).en} and open it into 10 ${pl.en}: ${place(i + 1).en} left: ${A[i + 1]}. ${pl.en}: ${A[i]} + 10 = ${A[i] + 10}.`,
          `अब उनमें से 1 ${place(i + 1).hi} खोलकर 10 ${pl.hi}: बचे ${A[i + 1]}। ${pl.hi}: ${A[i]} + 10 = ${A[i] + 10}।`,
          `Ab unmein se 1 ${place(i + 1).en} khol ke 10 ${pl.en}: bache ${A[i + 1]}. ${pl.en}: ${A[i]} + 10 = ${A[i] + 10}.`));
      } else {
        A[j] -= 1;
        out.push(T(`${pl.en}: ${A[i]} is smaller than ${y}, so borrow: open 1 of the ${place(i + 1).en} into 10 ${pl.en} (${place(i + 1).en} left: ${A[j]}). Now ${A[i]} + 10 = ${A[i] + 10}.`,
          `${pl.hi}: ${A[i]}, ${y} से छोटा है, तो उधार लो: 1 ${place(i + 1).hi} खोलकर 10 ${pl.hi} (बचे ${A[j]})। अब ${A[i]} + 10 = ${A[i] + 10}।`,
          `${pl.en}: ${A[i]}, ${y} se chhota hai, toh borrow karo: 1 ${place(i + 1).en} khol ke 10 ${pl.en} (bache ${A[j]}). Ab ${A[i]} + 10 = ${A[i] + 10}.`));
      }
      A[i] += 10;
    }
    const x = A[i];
    if (i < B.length || x !== 0 || i < A.length - 1) out.push(T(`${pl.en}: ${x} − ${y} = ${x - y}.`, `${pl.hi}: ${x} − ${y} = ${x - y}।`, `${pl.en}: ${x} − ${y} = ${x - y}.`));
  }
  out.push(T(`So ${a} − ${b} = ${a - b}. Check by adding back: ${a - b} + ${b} = ${a}. ✓`, `तो ${a} − ${b} = ${a - b}। जोड़कर जाँचो: ${a - b} + ${b} = ${a}। ✓`, `Toh ${a} − ${b} = ${a - b}. Jod ke check karo: ${a - b} + ${b} = ${a}. ✓`));
  return out;
}

/** Multiplication: groups for small ones, "break it apart" for bigger ones. */
export function mulSteps(a: number, b: number): Text[] {
  if (a <= 10 && b <= 10) {
    const seq = Array.from({ length: a }, (_, i) => (i + 1) * b);
    return [T(`${a} × ${b} means ${a} groups of ${b}.`, `${a} × ${b} मतलब ${b} के ${a} समूह।`, `${a} × ${b} matlab ${b} ke ${a} group.`),
      T(`Count in ${b}s, ${a} times: ${seq.join(", ")}.`, `${b}-${b} करके ${a} बार गिनो: ${seq.join(", ")}।`, `${b}-${b} karke ${a} baar gino: ${seq.join(", ")}.`),
      T(`The last number is the answer: ${a * b}.`, `आख़िरी संख्या उत्तर है: ${a * b}।`, `Last number answer hai: ${a * b}.`)];
  }
  const [big, small] = a >= b ? [a, b] : [b, a];
  const tens = big - (big % 10), ones = big % 10;
  return [T(`Break ${big} into ${tens} and ${ones}: it's easier to multiply round numbers.`, `${big} को ${tens} और ${ones} में तोड़ो: गोल संख्याओं से गुणा आसान है।`, `${big} ko ${tens} aur ${ones} mein todo: round numbers se guna easy hai.`),
    T(`${tens} × ${small} = ${tens * small}.`), T(`${ones} × ${small} = ${ones * small}.`),
    T(`Add the two parts: ${tens * small} + ${ones * small} = ${big * small}.`, `दोनों हिस्से जोड़ो: ${tens * small} + ${ones * small} = ${big * small}।`, `Dono hisse jodo: ${tens * small} + ${ones * small} = ${big * small}.`)];
}

export function divSteps(total: number, g: number): Text[] {
  const k = total / g;
  const seq = Array.from({ length: k }, (_, i) => (i + 1) * g);
  return [T(`${total} ÷ ${g} asks: how many in each of ${g} equal groups? Or: how many ${g}s make ${total}?`, `${total} ÷ ${g} पूछता है: ${g} बराबर समूहों में हर एक में कितने? या: कितने ${g} मिलकर ${total}?`, `${total} ÷ ${g} poochhta hai: ${g} barabar group mein har ek mein kitne? Ya: kitne ${g} milke ${total}?`),
    T(`Count in ${g}s until you reach ${total}: ${seq.join(", ")}.`, `${g}-${g} करके ${total} तक गिनो: ${seq.join(", ")}।`, `${g}-${g} karke ${total} tak gino: ${seq.join(", ")}.`),
    T(`That was ${k} jumps, so ${total} ÷ ${g} = ${k}. Check: ${g} × ${k} = ${total}. ✓`, `${k} छलाँग लगीं, तो ${total} ÷ ${g} = ${k}। जाँचो: ${g} × ${k} = ${total}। ✓`, `${k} jumps lage, toh ${total} ÷ ${g} = ${k}. Check: ${g} × ${k} = ${total}. ✓`)];
}

/** Steps for an exercise of one of the original topics (undefined = the one-line reason is enough). */
export function worked(topic: string, e: Exercise): Text[] | undefined {
  const p = e.prompt.en, n = nums(p), v = e.visual;
  switch (topic) {
    case "addition": return n.length >= 2 ? addSteps(n[0], n[1]) : undefined;
    case "subtraction": return n.length >= 2 ? subSteps(n[0], n[1]) : undefined;
    case "multiplication": return n.length >= 2 ? mulSteps(n[0], n[1]) : undefined;
    case "division": return n.length >= 2 ? divSteps(n[0], n[1]) : undefined;
    case "compare": {
      if (n.length < 2) return undefined;
      const [a, b] = n;
      return [T(`First count the digits: a number with more digits is bigger.`, `पहले अंक गिनो: ज़्यादा अंकों वाली संख्या बड़ी।`, `Pehle digits gino: zyada digits wala number bada.`),
        T(`Same number of digits? Compare from the LEFT, the biggest place first.`, `बराबर अंक? बाएँ से, सबसे बड़े स्थान से मिलाओ।`, `Same digits? LEFT se, sabse bade place se compare karo.`),
        T(a === b ? `${a} and ${b} are exactly the same: =.` : `${Math.max(a, b)} is bigger, so the crocodile eats it: ${a} ${a > b ? ">" : "<"} ${b}.`)];
    }
    case "place_value": {
      if (v?.type !== "tensones") return undefined;
      const h = v.hundreds ?? 0;
      return [...(h ? [T(`Each big square is 100: ${h} × 100 = ${h * 100}.`, `हर बड़ा वर्ग 100: ${h} × 100 = ${h * 100}।`, `Har bada square 100: ${h} × 100 = ${h * 100}.`)] : []),
        T(`Each long rod is 10: ${v.tens} rods = ${v.tens * 10}.`, `हर लंबी छड़ 10: ${v.tens} छड़ें = ${v.tens * 10}।`, `Har lambi rod 10: ${v.tens} rods = ${v.tens * 10}.`),
        T(`Each little cube is 1: ${v.ones} cubes = ${v.ones}.`, `हर छोटा घन 1: ${v.ones} घन = ${v.ones}।`, `Har chhota cube 1: ${v.ones} cubes = ${v.ones}.`),
        T(`Put them together: ${h ? `${h * 100} + ` : ""}${v.tens * 10} + ${v.ones} = ${h * 100 + v.tens * 10 + v.ones}.`)];
    }
    case "missing_number": {
      const m = p.match(/(\d+) ([+−×]) □ = (\d+)/);
      if (!m) return undefined;
      const [a, op, c] = [Number(m[1]), m[2], Number(m[3])];
      if (op === "+") return [T(`${a} + □ = ${c}: what do we add to ${a} to reach ${c}?`), T(`Count up from ${a} to ${c}, or take away: ${c} − ${a} = ${c - a}.`), T(`Check: ${a} + ${c - a} = ${c}. ✓ The box is ${c - a}.`)];
      if (op === "−") return [T(`${a} − □ = ${c}: we took something away from ${a} and ${c} was left.`), T(`What was taken = ${a} − ${c} = ${a - c}.`), T(`Check: ${a} − ${a - c} = ${c}. ✓`)];
      return [T(`${a} × □ = ${c}: ${a} groups of what make ${c}?`), T(`Count in ${a}s to ${c}, or divide: ${c} ÷ ${a} = ${c / a}.`), T(`Check: ${a} × ${c / a} = ${c}. ✓`)];
    }
    case "balance": {
      const m = p.match(/(\d*)x \+ (\d+) = (\d+)/);
      if (!m) return undefined;
      const k = Number(m[1] || 1), c = Number(m[2]), r = Number(m[3]);
      return [T(`The scale is balanced: ${k > 1 ? k : ""}x + ${c} weighs the same as ${r}.`),
        T(`Take ${c} off BOTH sides (so it stays balanced): ${k > 1 ? k : ""}x = ${r} − ${c} = ${r - c}.`),
        ...(k > 1 ? [T(`${k} x's weigh ${r - c}, so one x = ${r - c} ÷ ${k} = ${(r - c) / k}.`)] : []),
        T(`Check: put x = ${(r - c) / k} back: ${k > 1 ? `${k} × ` : ""}${(r - c) / k} + ${c} = ${r}. ✓`)];
    }
    case "area_perimeter": {
      if (v?.type !== "gridshape") return undefined;
      return /AREA/.test(p)
        ? [T(`Area = how many little squares cover the inside.`), T(`Each row has ${v.w} squares, and there are ${v.h} rows.`), T(`${v.h} rows of ${v.w}: ${v.w} × ${v.h} = ${v.w * v.h} squares.`)]
        : [T(`Perimeter = walk all the way around the edge.`), T(`Top ${v.w}, right side ${v.h}, bottom ${v.w}, left side ${v.h}.`), T(`${v.w} + ${v.h} + ${v.w} + ${v.h} = ${2 * (v.w + v.h)}.`)];
    }
    case "time": {
      if (v?.type !== "clock") return undefined;
      return [T(`Find the SHORT hand first: it points at (or just after) ${v.h}. That's the hour.`, `पहले छोटी सुई: ${v.h} पर (या थोड़ा आगे)। यह घंटा है।`, `Pehle chhoti sui: ${v.h} pe (ya thoda aage). Yeh ghanta hai.`),
        T(`Now the LONG hand: it points at ${v.m === 0 ? 12 : v.m / 5}.`, `अब बड़ी सुई: ${v.m === 0 ? 12 : v.m / 5} पर।`, `Ab badi sui: ${v.m === 0 ? 12 : v.m / 5} pe.`),
        T(v.m === 0 ? "At 12 the minutes are 0: exactly o'clock." : `Count in 5s for each number: ${Array.from({ length: v.m / 5 }, (_, i) => (i + 1) * 5).join(", ")} → ${v.m} minutes.`),
        T(`Time: ${v.h}:${String(v.m).padStart(2, "0")}.`)];
    }
    case "money": {
      if (v?.type !== "coins") return undefined;
      let run = 0;
      return [T(`Start with the biggest coin and keep a running total.`, `सबसे बड़े सिक्के से शुरू करो और जोड़ते जाओ।`, `Sabse bade sikke se shuru karo aur jodte jao.`),
        ...v.coins.map((c) => { run += c; return T(`+ ₹${c} → ₹${run}`); }), T(`Total: ₹${run}.`)];
    }
    case "fractions": {
      if (v?.type !== "fraction") return undefined;
      return [T(`Count ALL the equal parts: ${v.parts}. That's the bottom number.`, `सारे बराबर हिस्से गिनो: ${v.parts}। यह नीचे की संख्या।`, `Saare barabar hisse gino: ${v.parts}. Yeh neeche ka number.`),
        T(`Count the coloured parts: ${v.shaded}. That's the top number.`, `रंगे हिस्से गिनो: ${v.shaded}। यह ऊपर की संख्या।`, `Rangin hisse gino: ${v.shaded}. Yeh upar ka number.`), T(`So it's ${v.shaded}/${v.parts}.`)];
    }
    case "add_9": {
      if (n.length < 2) return undefined;
      const [a, nine] = n, ten = nine + 1;
      return [T(`${nine} is just 1 less than ${ten}.`), T(`Add ${ten} (easy!): ${a} + ${ten} = ${a + ten}.`), T(`We added 1 too many, so take 1 away: ${a + ten} − 1 = ${a + nine}.`)];
    }
    case "times_5": {
      const a = n[0];
      return [T(`× 10 first: just put a 0 at the end: ${a} → ${a * 10}.`), T(`5 is half of 10, so halve it: ${a * 10} ÷ 2 = ${a * 5}.`)];
    }
    case "nine_fingers": {
      const k = n[1] ?? n[0];
      return [T(`Hold up all 10 fingers.`), T(`Fold down finger number ${k}.`), T(`Fingers on the left of it: ${k - 1}. That's the tens digit.`), T(`Fingers on the right: ${10 - k}. That's the ones digit.`), T(`So 9 × ${k} = ${9 * k}.`)];
    }
    case "times_11": {
      const x = n[0], a = Math.floor(x / 10), b = x % 10, s = a + b;
      return [T(`Write the two digits apart: ${a} _ ${b}.`), T(`Add them for the middle: ${a} + ${b} = ${s}.`),
        s < 10 ? T(`Put ${s} in the middle: ${a}${s}${b}.`) : T(`${s} is 10 or more: write ${s % 10} in the middle and carry 1 to the ${a}: ${a + 1}${s % 10}${b}.`)];
    }
    case "square_5": {
      const x = n[0], a = Math.floor(x / 10);
      return [T(`Take the digit before the 5: ${a}.`), T(`Multiply it by the next number: ${a} × ${a + 1} = ${a * (a + 1)}.`), T(`5 × 5 is always 25: write 25 at the end → ${x * x}.`)];
    }
    case "nikhilam": {
      if (n.length < 2) return undefined;
      const [a, b] = n, base = a > 20 ? 100 : 10, ga = base - a, gb = base - b, right = ga * gb;
      return [T(`Base ${base}. How far is each number below ${base}? ${a} is ${ga} below, ${b} is ${gb} below.`),
        T(`Left part: cross-subtract: ${a} − ${gb} = ${a - gb} (same as ${b} − ${ga}).`),
        T(`Right part: multiply the gaps: ${ga} × ${gb} = ${right}${base === 100 && right < 10 ? `, written as 0${right} (two digits for base 100)` : ""}.`),
        T(`Put them side by side: ${a * b}.`)];
    }
    case "from_100": {
      const big = n[0], x = n[1], d = String(x).padStart(String(big).length - 1, "0").split("");
      return [T(`All from 9, the last from 10.`), ...d.map((c, i) => T(i === d.length - 1 ? `Last digit from 10: 10 − ${c} = ${10 - Number(c)}.` : `From 9: 9 − ${c} = ${9 - Number(c)}.`)), T(`Answer: ${big - x}. No borrowing needed!`)];
    }
  }
  return undefined;
}
