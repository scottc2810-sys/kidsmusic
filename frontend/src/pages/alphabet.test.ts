import { describe, expect, it } from "vitest";
import { distractors, nextSet, traceGlyph } from "./Alphabet";
import type { AbcLetter } from "../api";

const mk = (i: number, char: string, roman: string, group = "letter"): AbcLetter =>
  ({ i, item: `abc${String(i).padStart(2, "0")}`, char, group, sound: roman, roman, say: char, name: "", example: null });
const latin = "ABCDEFGH".split("").map((c, i) => mk(i, c + c.toLowerCase(), c.toLowerCase()));

describe("alphabet practice", () => {
  it("practises the first 5 letters not yet learned, in order", () => {
    expect(nextSet(latin, {}, "read")).toEqual([0, 1, 2, 3, 4]);
    const prog = { 0: { read: { tries: 2, right: 2, streak: 2 } }, 2: { read: { tries: 3, right: 2, streak: 2 } } };
    expect(nextSet(latin, prog, "read")).toEqual([1, 3, 4, 5, 6]);
    expect(nextSet(latin, prog, "write")).toEqual([0, 1, 2, 3, 4]); // each skill has its own progress
  });

  it("revises the last letters once everything is learned", () => {
    const all = Object.fromEntries(latin.map((l) => [l.i, { read: { tries: 2, right: 2, streak: 2 } }]));
    expect(nextSet(latin, all, "read")).toEqual([3, 4, 5, 6, 7]);
  });

  it("offers nearby letters with a different sound as the other choices", () => {
    const d = distractors(latin, 3);
    expect(d).toHaveLength(2);
    expect(d.map((x) => x.i).every((i) => Math.abs(i - 3) <= 1)).toBe(true);
  });

  it("traces one glyph: the capital of a pair, the pinyin letter of an initial, Indian letters whole", () => {
    expect(traceGlyph({ char: "Aa", group: "letter" })).toBe("A");
    expect(traceGlyph({ char: "Шш", group: "letter" })).toBe("Ш");
    expect(traceGlyph({ char: "zh 知", group: "initial" })).toBe("zh");
    expect(traceGlyph({ char: "क", group: "consonant" })).toBe("क");
    expect(traceGlyph({ char: "ß", group: "extra" })).toBe("ß");
  });
});
