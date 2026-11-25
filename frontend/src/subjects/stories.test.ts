import { describe, expect, it } from "vitest";
import { STORIES } from "./stories";
import { checkOrder } from "../pages/Stories";
import { duckLevel, makePhrase, rng } from "../audio/bgm";
import type { Text } from "../i18n";

const texts = (s: (typeof STORIES)[number]): Text[] => [
  s.title, s.skill, s.ask, s.bigIdea, s.why, s.tryToday, s.check.q, s.check.a, ...s.check.others,
  ...s.pages.map((p) => p.text), ...s.after.map((p) => p.text), ...s.options.flatMap((o) => [o.text, o.then]),
];

describe("life-skills stories", () => {
  it("has many stories with unique ids", () => {
    expect(STORIES.length).toBeGreaterThanOrEqual(16);
    expect(new Set(STORIES.map((s) => s.id)).size).toBe(STORIES.length);
    STORIES.forEach((s) => expect(s.id).toMatch(/^[a-z0-9_]{1,30}$/)); // fits the server's topic id (story_ + id)
  });

  it("is written in English, Hindi and Hinglish everywhere", () => {
    for (const s of STORIES) for (const t of texts(s)) {
      expect(t.en.trim(), s.id).not.toBe("");
      expect(t.hi?.trim(), `${s.id}: ${t.en}`).toBeTruthy();
      expect(t.hinglish?.trim(), `${s.id}: ${t.en}`).toBeTruthy();
      expect(t.hi).toMatch(/[ऀ-ॿ]/); // Hindi really is in Devanagari
    }
  });

  it("teaches by choice: exactly one good option, each with what happens and why", () => {
    for (const s of STORIES) {
      expect(s.options.filter((o) => o.good)).toHaveLength(1);
      expect(s.options.length).toBeGreaterThanOrEqual(2);
      expect(s.pages.length).toBeGreaterThanOrEqual(2);
      expect(s.after.length).toBeGreaterThanOrEqual(1);
      s.options.forEach((o) => expect(o.then.en.length).toBeGreaterThan(30));
    }
  });

  it("asks a check question with one right answer in a shuffled place", () => {
    const places = new Set<number>();
    for (const s of STORIES) {
      const order = checkOrder(s);
      expect(order).toHaveLength(1 + s.check.others.length);
      expect(order.filter((o) => o === s.check.a)).toHaveLength(1);
      places.add(order.indexOf(s.check.a));
    }
    expect(places.size).toBeGreaterThan(1); // the right answer is not always first
  });

  it("gives every mission in the child's name and fits young ages", () => {
    for (const s of STORIES) {
      expect(s.tryToday.en).toContain("{name}");
      expect(s.tryToday.hi).toContain("{name}");
      expect(s.ages[0]).toBeGreaterThanOrEqual(3);
      expect(s.ages[1]).toBeLessThanOrEqual(8);
    }
  });
});

describe("background music", () => {
  it("makes the same tune from the same seed (repetition is what makes it a tune)", () => {
    expect(makePhrase(42, 0.5)).toEqual(makePhrase(42, 0.5));
    expect(makePhrase(42, 0.5)).not.toEqual(makePhrase(43, 0.5));
  });

  it("writes 4 bars of 8 eighths that end on the home note, in a hummable range", () => {
    const p = makePhrase(7, 0.6);
    expect(p).toHaveLength(4);
    p.forEach((bar) => expect(bar).toHaveLength(8));
    expect(p[3][4]).toBe(5);
    p.flat().filter((x): x is number => x !== null).forEach((s) => { expect(s).toBeGreaterThanOrEqual(0); expect(s).toBeLessThanOrEqual(10); });
  });

  it("is never heard while Melo listens or plays, and is quieter while Melo talks", () => {
    const base = { held: false, busy: false, speaking: false, hidden: false };
    expect(duckLevel(base)).toBe(1);
    expect(duckLevel({ ...base, speaking: true })).toBeLessThan(0.5);
    expect(duckLevel({ ...base, held: true })).toBe(0);
    expect(duckLevel({ ...base, busy: true })).toBe(0);
    expect(duckLevel({ ...base, hidden: true })).toBe(0);
  });

  it("has random numbers between 0 and 1", () => {
    const r = rng(5);
    for (let i = 0; i < 100; i++) { const x = r(); expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThan(1); }
  });
});
