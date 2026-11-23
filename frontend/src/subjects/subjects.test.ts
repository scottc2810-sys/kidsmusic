import { describe, expect, it } from "vitest";
import { analyze, CHALLENGES, symmetryLines } from "./geometry";
import { ALL_MATHS as MATHS_TOPICS, ALL_SCIENCE as SCIENCE_TOPICS } from "./index";
import { STRANDS } from "./maths";
import { SCI_STRANDS } from "./science";
import { toRoman } from "./maths_more";

/** A small seeded random generator so failures can be reproduced. */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}

describe("every maths and science exercise is answerable and explained", () => {
  for (const topic of [...MATHS_TOPICS, ...SCIENCE_TOPICS]) {
    it(topic.id, () => {
      expect(topic.cards.length).toBeGreaterThan(0);
      for (let d = 1; d <= 5; d++) {
        for (let seed = 1; seed <= 60; seed++) {
          const e = topic.make(d, seeded(seed * 31 + d));
          const where = `${topic.id} d${d} seed${seed}: ${e.prompt.en}`;
          expect(e.choices, where).toContain(e.answer);
          expect(new Set(e.choices).size, where).toBe(e.choices.length);
          expect(e.choices.length, where).toBeGreaterThanOrEqual(2);
          expect(e.why.en.length, where).toBeGreaterThan(10);
          if (e.numeric) expect(Number.isFinite(Number(e.answer)), where).toBe(true);
          for (const st of e.steps ?? []) expect(st.en.includes("undefined") || st.en.includes("NaN"), where + " step: " + st.en).toBe(false);
          expect(e.why.en.includes("undefined") || e.why.en.includes("NaN"), where).toBe(false);
        }
      }
    });
  }
  it("every topic belongs to a strand and a class range 0-5", () => {
    for (const t of MATHS_TOPICS) expect(STRANDS.map((s) => s.id)).toContain(t.strand);
    for (const t of SCIENCE_TOPICS) expect(SCI_STRANDS.map((s) => s.id)).toContain(t.strand);
    for (const t of [...MATHS_TOPICS, ...SCIENCE_TOPICS]) expect(t.grades[0] >= 0 && t.grades[1] <= 5 && t.grades[0] <= t.grades[1]).toBe(true);
  });
  it("every maths exercise has a worked solution that reaches the right answer", () => {
    const noSteps = ["count", "even_odd", "skip_count", "patterns", "shapes", "symmetry", "angles", "length", "data", "solids_3d", "calendar", "factors", "weight_capacity"];
    for (const t of MATHS_TOPICS) {
      for (let seed = 1; seed <= 40; seed++) {
        const e = t.make(1 + (seed % 5), seeded(seed));
        if (noSteps.includes(t.id) && !e.steps) continue;
        expect(e.steps?.length ?? 0, `${t.id} seed ${seed}: ${e.prompt.en}`).toBeGreaterThan(0);
        if (e.numeric) expect(e.steps!.map((s) => s.en).join(" "), `${t.id}: ${e.prompt.en}`).toContain(e.answer);
      }
    }
  });
  it("every new trick is mathematically right", () => {
    const r = seeded(11);
    const check: Record<string, (a: number, b: number) => number> = { times_9: (a) => a * 9, times_25: (a) => a * 25, teens: (a, b) => a * b, urdhva: (a, b) => a * b, ends_10: (a, b) => a * b, near_50: (a) => a * a, round_adjust: (a, b) => a + b, shopkeeper: (a, b) => a - b, div_5: (a) => a / 5 };
    for (const [id, f] of Object.entries(check)) {
      const t = MATHS_TOPICS.find((x) => x.id === id)!;
      for (let i = 0; i < 100; i++) {
        const e = t.make(1 + (i % 5), r);
        const n = (e.prompt.en.match(/\d+/g) ?? []).map(Number);
        expect(Number(e.answer), `${id}: ${e.prompt.en}`).toBe(f(n[0], n[1]));
      }
    }
    expect([toRoman(4), toRoman(9), toRoman(14), toRoman(40), toRoman(99), toRoman(444)]).toEqual(["IV", "IX", "XIV", "XL", "XCIX", "CDXLIV"]);
  });
  it("vedic tricks give the true answer", () => {
    const r = seeded(7);
    for (let i = 0; i < 200; i++) {
      const e = MATHS_TOPICS.find((t) => t.id === "nikhilam")!.make(1 + (i % 5), r);
      const [a, b] = e.prompt.en.split(" = ")[0].split(" × ").map(Number);
      expect(Number(e.answer)).toBe(a * b);
    }
  });
});

describe("shape lab geometry", () => {
  it("names shapes and explains them", () => {
    expect(analyze([[0, 0], [2, 0], [2, 2], [0, 2]]).name).toBe("square");
    const r = analyze([[0, 0], [3, 0], [3, 2], [0, 2]]);
    expect([r.name, r.area, r.perimeter, r.symmetry]).toEqual(["rectangle", 6, 10, 2]);
    expect(analyze([[0, 0], [3, 0], [0, 4]]).name).toBe("right triangle");
    expect(analyze([[0, 0], [4, 0], [2, 3]]).name).toBe("isosceles triangle");
    expect(analyze([[0, 0], [2, 0], [3, 2], [1, 2]]).name).toBe("parallelogram");
    expect(analyze([[0, 0], [4, 0], [3, 2], [1, 2]]).name).toBe("trapezium");
    expect(analyze([[0, 0], [1, 0], [2, 0], [2, 2], [0, 2]]).sides).toBe(4); // a point in the middle of a side is not a corner
    expect(symmetryLines([[0, 0], [2, 0], [2, 2], [0, 2]])).toBe(4);
    expect(analyze([[0, 0], [2, 2], [2, 0], [0, 2]]).crossing).toBe(true);
  });
  it("puzzles can be solved", () => {
    const sq = analyze([[0, 0], [2, 0], [2, 2], [0, 2]]);
    expect(CHALLENGES.find((c) => c.id === "square")!.test(sq)).toBe(true);
    expect(CHALLENGES.find((c) => c.id === "sym4")!.test(sq)).toBe(true);
    expect(CHALLENGES.find((c) => c.id === "rect6")!.test(analyze([[0, 0], [3, 0], [3, 2], [0, 2]]))).toBe(true);
    expect(CHALLENGES.find((c) => c.id === "perim12")!.test(analyze([[0, 0], [4, 0], [4, 2], [0, 2]]))).toBe(true);
  });
});
