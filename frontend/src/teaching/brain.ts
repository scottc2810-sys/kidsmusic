// Brain games: the rules, kept apart from the screen so they can be tested. Each game trains one skill a
// teacher would name (working memory, sound memory, attention, logic, self-control, number sense), starts
// very easy for a 3-year-old and grows one small step after each success, never jumping ahead.
export type BrainGame = "memory" | "simon" | "odd" | "pattern" | "stars" | "count";

/** Seeded random numbers, so a round can be checked in tests. */
export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; };
}
export function shuffle<T>(xs: T[], r: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

const PICS = ["🐶", "🐱", "🐰", "🦁", "🐸", "🐵", "🐼", "🐯", "🐮", "🐷", "🐔", "🦋", "🍎", "🍌", "🚗", "⭐", "🌈", "🎈"];

// --- 🃏 memory match -------------------------------------------------------------------------------------
/** Level 1 = 2 pairs ... grows to 8 pairs. */
export const memoryPairs = (level: number) => Math.min(8, level + 1);
export function memoryDeck(level: number, seed: number): string[] {
  const r = rng(seed);
  const pics = shuffle(PICS, r).slice(0, memoryPairs(level));
  return shuffle([...pics, ...pics], r);
}

// --- 🎹 copy the tune (Simon) ----------------------------------------------------------------------------
export const SIMON_PADS = [{ midi: 60, color: "#ff6b6b" }, { midi: 64, color: "#ffd23f" }, { midi: 67, color: "#3bceac" }, { midi: 72, color: "#4c6ef5" }];
/** Level 1 = 2 notes ... the tune grows by one note per level. */
export const simonLength = (level: number) => level + 1;
export function simonTune(level: number, seed: number): number[] {
  const r = rng(seed);
  return Array.from({ length: simonLength(level) }, () => Math.floor(r() * 4));
}

// --- 🔍 odd one out --------------------------------------------------------------------------------------
// pairs that look more and more alike as the level grows
const ODD_PAIRS: [string, string][] = [["🐶", "🍎"], ["🐱", "🚗"], ["⭐", "🌙"], ["🐶", "🐱"], ["🍎", "🍊"], ["🐸", "🐢"], ["🍎", "🍏"], ["😀", "😃"], ["🌕", "🌝"], ["🔴", "🟠"]];
export function oddRound(level: number, seed: number): { cells: string[]; odd: number } {
  const r = rng(seed);
  const [same, odd] = ODD_PAIRS[Math.min(ODD_PAIRS.length - 1, Math.floor((level - 1) * 1.2 + r() * 2))];
  const n = Math.min(16, 4 + (level - 1) * 2);
  const at = Math.floor(r() * n);
  return { cells: Array.from({ length: n }, (_, i) => (i === at ? odd : same)), odd: at };
}

// --- 🔮 what comes next ----------------------------------------------------------------------------------
const PATTERNS = ["AB", "AAB", "ABB", "ABC", "AABB", "ABCD"];
export function patternRound(level: number, seed: number): { shown: string[]; answer: string; choices: string[] } {
  const r = rng(seed);
  const kind = PATTERNS[Math.min(PATTERNS.length - 1, level - 1)];
  const letters = [...new Set(kind.split(""))];
  const pics = shuffle(PICS, r).slice(0, letters.length + 1);
  const pic = (ch: string) => pics[letters.indexOf(ch)];
  const reps = Math.max(2, Math.ceil(6 / kind.length));
  const seq = Array.from({ length: kind.length * reps }, (_, i) => pic(kind[i % kind.length]));
  const answer = pic(kind[seq.length % kind.length]);
  const others = shuffle([...new Set([...letters.map(pic), pics[letters.length]])].filter((x) => x !== answer), r).slice(0, 2);
  return { shown: seq, answer, choices: shuffle([answer, ...others], r) };
}

// --- ⭐ catch the stars (go / no-go) ----------------------------------------------------------------------
/** How long each picture stays (ms) and how many in a round: slower and fewer for the youngest. */
export const starsSpeed = (level: number) => ({ showMs: Math.max(700, 1700 - (level - 1) * 160), count: 10 + level * 2 });
export function starsRound(level: number, seed: number): { item: "go" | "nogo"; cell: number }[] {
  const r = rng(seed);
  const { count } = starsSpeed(level);
  const nogoShare = Math.min(0.45, 0.2 + level * 0.04);
  return Array.from({ length: count }, () => ({ item: r() < nogoShare ? "nogo" : "go", cell: Math.floor(r() * 9) }));
}
/** Score: catching a star is right, leaving a cloud alone is right too. */
export function starsScore(events: { item: "go" | "nogo"; tapped: boolean }[]): { right: number; total: number } {
  return { right: events.filter((e) => (e.item === "go") === e.tapped).length, total: events.length };
}

// --- 🔢 quick count (subitizing) ------------------------------------------------------------------------
/** Level 1 = 1-3 dots shown for 2 s ... up to 9 dots shown for 0.8 s. */
export function countRound(level: number, seed: number): { n: number; showMs: number; choices: number[]; dots: { x: number; y: number }[] } {
  const r = rng(seed);
  const max = Math.min(9, 2 + level);
  const n = 1 + Math.floor(r() * max);
  const showMs = Math.max(800, 2200 - (level - 1) * 200);
  const choices = shuffle([...new Set([n, Math.max(1, n - 1), n + 1, n + 2].filter((x) => x >= 1))].slice(0, 3), r);
  if (!choices.includes(n)) choices[0] = n;
  const dots: { x: number; y: number }[] = [];
  while (dots.length < n) {
    const d = { x: 10 + r() * 80, y: 10 + r() * 80 };
    if (dots.every((o) => Math.hypot(o.x - d.x, o.y - d.y) > 16)) dots.push(d);
  }
  return { n, showMs, choices: shuffle(choices, r), dots };
}

// --- levels ------------------------------------------------------------------------------------------------
export const MAX_LEVEL = 8;
/** After a round: up one level when it went well, down one when it was hard, otherwise stay. */
export function nextLevel(level: number, right: number, total: number): number {
  const share = total ? right / total : 0;
  return share >= 0.8 ? Math.min(MAX_LEVEL, level + 1) : share < 0.5 ? Math.max(1, level - 1) : level;
}
export const starsFor = (right: number, total: number) => (total && right / total >= 0.9 ? 3 : total && right / total >= 0.7 ? 2 : right ? 1 : 0);
