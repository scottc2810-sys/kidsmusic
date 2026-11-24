// "Teach before you ask": a child is never asked something Melo has not shown them.
// * A FACT (no numbers to work out: "Is a cloud living?", "What comes after March?", a shloka's meaning) is
//   taught the first time it comes up: Melo shows it, says why, then asks it. Later rounds ask it from memory.
// * A METHOD (numbers to work out: sums, Roman numerals, best buy, divisibility) is shown once per difficulty
//   level as a fully worked example with OTHER numbers, step by step, before the child tries one.
// What each child has been taught is remembered on this device, per subject and topic.
import type { Exercise, Rng } from "./maths";

export type Teach = { kind: "fact" | "example"; e: Exercise };

const CAP = 500;
const key = (child: string, subject: string, topic: string, what: string) => `melo.taught.${child}.${subject}.${topic}.${what}`;
const load = (k: string): string[] => { try { return JSON.parse(localStorage.getItem(k) ?? "[]") as string[]; } catch { return []; } };
const save = (k: string, v: string[], cap = CAP) => { try { localStorage.setItem(k, JSON.stringify(v.slice(-cap))); } catch { /* private mode */ } };

/** Working something out (numbers in the question or the answer) rather than remembering a fact. */
export function isMethod(e: Exercise): boolean {
  return !!e.numeric || /\d/.test(e.prompt.en) || /\d/.test(e.answer);
}
export const factId = (e: Exercise) => `${e.prompt.en}→${e.answer}`;

export class TaughtLog {
  private facts: Set<string>;
  private levels: Set<string>;
  constructor(private child: string, private subject: string, private topic: string) {
    this.facts = new Set(load(key(child, subject, topic, "facts")));
    this.levels = new Set(load(key(child, subject, topic, "levels")));
  }
  knowsFact(e: Exercise) { return this.facts.has(factId(e)); }
  knowsLevel(level: number) { return this.levels.has(String(level)); }
  learnFact(e: Exercise) { this.facts.add(factId(e)); save(key(this.child, this.subject, this.topic, "facts"), [...this.facts]); }
  learnLevel(level: number) { this.levels.add(String(level)); save(key(this.child, this.subject, this.topic, "levels"), [...this.levels]); }
}

/**
 * What to teach before asking `e` (null = ask straight away). `make` draws another question of the same
 * kind and level, used as the worked example so the child then solves a different one.
 */
export function teachFirst(e: Exercise, level: number, log: TaughtLog, make: (rng: Rng) => Exercise, rng: Rng = Math.random): Teach | null {
  if (!isMethod(e)) return log.knowsFact(e) ? null : { kind: "fact", e };
  if (log.knowsLevel(level)) return null;
  let ex = make(rng);
  for (let i = 0; i < 8 && (ex.prompt.en === e.prompt.en || !isMethod(ex)); i++) ex = make(rng);
  return { kind: "example", e: ex.prompt.en === e.prompt.en ? e : ex };
}

// ---- never the same question twice --------------------------------------------------------------------------
// Every question a child is shown in a topic (asked, or used as a worked example) is remembered, and is never
// asked again: not later in the same round, not in a later round. When the child's level has no unseen question
// left, the nearest level that still has one is used; when the whole topic is used up, the round ends early.

/** The same question = same words, same answer, same picture (the order of the choices doesn't matter). */
export const qid = (e: Exercise) => `${e.prompt.en}|${e.answer}|${e.visual ? JSON.stringify(e.visual) : ""}`;
/** A short fingerprint of a question (FNV-1a, 32 bit), so thousands fit in the browser's storage. */
export function fingerprint(e: Exercise): string {
  let h = 0x811c9dc5;
  for (const ch of qid(e)) { h ^= ch.codePointAt(0)!; h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36);
}
const ASKED_CAP = 20000; // per child and topic: far more questions than a child meets in years
const DECK_CAP = 400; // questions kept for revision, per child and topic (about 20 bytes each)

/** Where a question came from: its level and the seed it was made with. The same seed always makes the same
 *  question again, so revision can rebuild it without storing the whole question. */
export interface Ref { d: number; s: number }
export type Drawn = Exercise & { ref?: Ref };
type DeckEntry = [d: number, s: number, fp: string, missed: 0 | 1];

/** A small, fast seeded random generator (mulberry32). */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class AskedLog {
  private seen: Set<string>;
  private deckList: DeckEntry[];
  private k: string;
  private kd: string;
  constructor(child: string, subject: string, topic: string) {
    this.k = key(child, subject, topic, "asked");
    this.kd = key(child, subject, topic, "deck");
    this.seen = new Set(load(this.k));
    try { this.deckList = JSON.parse(localStorage.getItem(this.kd) ?? "[]") as DeckEntry[]; } catch { this.deckList = []; }
  }
  has(e: Exercise) { return this.seen.has(fingerprint(e)); }
  /** Shown to the child: never asked as a new question again, and kept for revision. */
  add(e: Drawn) {
    const fp = fingerprint(e);
    this.seen.add(fp);
    save(this.k, [...this.seen], ASKED_CAP);
    if (e.ref && !this.deckList.some((x) => x[2] === fp)) { this.deckList.push([e.ref.d, e.ref.s, fp, 0]); this.saveDeck(); }
  }
  /** A slip is revised first; a right answer in revision takes it off the "revise first" list. */
  setMissed(e: Exercise, missed: boolean) {
    const fp = fingerprint(e);
    const x = this.deckList.find((y) => y[2] === fp);
    if (x && x[3] !== (missed ? 1 : 0)) { x[3] = missed ? 1 : 0; this.saveDeck(); }
  }
  get size() { return this.seen.size; }
  get deck(): readonly DeckEntry[] { return this.deckList; }
  private saveDeck() {
    // keep every slip, then the newest of the rest
    if (this.deckList.length > DECK_CAP) {
      const missed = this.deckList.filter((x) => x[3]), ok = this.deckList.filter((x) => !x[3]);
      this.deckList = [...missed.slice(-DECK_CAP), ...ok.slice(-(DECK_CAP - Math.min(missed.length, DECK_CAP)))];
    }
    try { localStorage.setItem(this.kd, JSON.stringify(this.deckList)); } catch { /* private mode */ }
  }
}

/** Levels to look in, nearest first: 3 → 3, 2, 4, 1, 5. */
export function nearLevels(level: number, max = 5): number[] {
  const out = [level];
  for (let d = 1; d < max; d++) for (const l of [level - d, level + d]) if (l >= 1 && l <= max) out.push(l);
  return out;
}

/** A question this child has never been shown in this topic (null = the topic is used up). */
export function drawFresh(make: (d: number, rng: Rng) => Exercise, levels: number[], log: AskedLog, rng: Rng = Math.random,
  avoid: Set<string> = new Set(), tries = 400): Drawn | null {
  for (const d of levels) {
    for (let i = 0; i < tries; i++) {
      const s = Math.floor(rng() * 4294967296) >>> 0;
      const e = make(d, seededRng(s));
      if (!log.has(e) && !avoid.has(qid(e))) return { ...e, ref: { d, s } };
    }
  }
  return null;
}

/** Revision: a question the child has already met, slips first (null = nothing left to revise this round). */
export function drawRevision(make: (d: number, rng: Rng) => Exercise, log: AskedLog, rng: Rng = Math.random, avoid: Set<string> = new Set()): Drawn | null {
  const mix = <T,>(xs: T[]) => xs.map((x) => [rng(), x] as const).sort((p, q) => p[0] - q[0]).map((p) => p[1]);
  const order = [...mix(log.deck.filter((x) => x[3])), ...mix(log.deck.filter((x) => !x[3]))];
  for (const [d, s, fp] of order) {
    const e = make(d, seededRng(s));
    if (fingerprint(e) === fp && !avoid.has(qid(e))) return { ...e, ref: { d, s } }; // skipped if the lesson has changed since
  }
  return null;
}
