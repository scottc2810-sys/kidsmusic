import { describe, expect, it } from "vitest";
import { countRound, memoryDeck, nextLevel, oddRound, patternRound, simonTune, starsFor, starsRound, starsScore } from "./brain";
import { MOVES } from "../subjects/move";
import { MOVE_MEDIA } from "../subjects/moveMedia";

describe("brain games", () => {
  it("memory decks are pairs and grow with the level", () => {
    const d1 = memoryDeck(1, 7), d4 = memoryDeck(4, 7);
    expect(d1).toHaveLength(4); expect(d4).toHaveLength(10);
    for (const d of [d1, d4]) for (const p of d) expect(d.filter((x) => x === p)).toHaveLength(2);
  });
  it("the tune grows by one note per level and only uses the four pads", () => {
    expect(simonTune(1, 3)).toHaveLength(2); expect(simonTune(5, 3)).toHaveLength(6);
    expect(simonTune(5, 3).every((p) => p >= 0 && p < 4)).toBe(true);
  });
  it("odd one out has exactly one different picture", () => {
    for (let lv = 1; lv <= 8; lv++) {
      const r = oddRound(lv, lv * 11);
      expect(r.cells.filter((c) => c !== r.cells[r.odd])).toHaveLength(r.cells.length - 1);
    }
  });
  it("what comes next: the answer is among different choices and follows the pattern", () => {
    for (let lv = 1; lv <= 6; lv++) {
      const r = patternRound(lv, 99);
      expect(r.choices).toContain(r.answer);
      expect(new Set(r.choices).size).toBe(r.choices.length);
    }
    const ab = patternRound(1, 5);
    expect(ab.answer).toBe(ab.shown[ab.shown.length - 2]);
  });
  it("catch the stars: leaving a cloud alone counts as right", () => {
    expect(starsRound(1, 1).length).toBe(12);
    expect(starsScore([{ item: "go", tapped: true }, { item: "nogo", tapped: false }, { item: "nogo", tapped: true }])).toEqual({ right: 2, total: 3 });
  });
  it("quick count shows the right number of dots with the answer among the choices", () => {
    for (let lv = 1; lv <= 7; lv++) {
      const r = countRound(lv, lv);
      expect(r.dots).toHaveLength(r.n);
      expect(r.choices).toContain(r.n);
    }
  });
  it("levels go up after a strong round, down after a hard one", () => {
    expect(nextLevel(2, 5, 5)).toBe(3); expect(nextLevel(2, 1, 5)).toBe(1); expect(nextLevel(2, 3, 5)).toBe(2); expect(nextLevel(1, 0, 5)).toBe(1);
    expect(starsFor(5, 5)).toBe(3); expect(starsFor(0, 5)).toBe(0);
  });
});

const SHIPPED = import.meta.glob(["../../public/move/*.webm", "../../public/move/*.jpg"]);
describe("move & stretch", () => {
  it("has 5-7 exercises and 10-15 yoga asanas, each in three languages with steps and a reason", () => {
    const ex = MOVES.filter((m) => m.kind === "exercise"), yoga = MOVES.filter((m) => m.kind === "yoga");
    expect(ex.length).toBeGreaterThanOrEqual(5); expect(ex.length).toBeLessThanOrEqual(7);
    expect(yoga.length).toBeGreaterThanOrEqual(10); expect(yoga.length).toBeLessThanOrEqual(15);
    for (const m of MOVES) {
      expect(m.steps.length).toBeGreaterThanOrEqual(3);
      for (const t of [m.name, m.why, ...m.steps]) { expect(t.hi).toMatch(/[ऀ-ॿ]/); expect(t.hinglish).toBeTruthy(); }
      expect(m.video || m.photo, m.id).toBeTruthy();
    }
  });
  it("only uses real, openly licensed media that ship with the app", () => {
    for (const m of MOVES) for (const k of [m.video, m.photo].filter(Boolean) as string[]) {
      const media = MOVE_MEDIA[k];
      expect(media, `${m.id}: ${k}`).toBeTruthy();
      expect(Object.keys(SHIPPED)).toContain(`../../public${media.src}`);
      expect(media.licence).toMatch(/^(Public domain|CC0|CC BY)/);
      expect(media.licence).not.toMatch(/NC|ND/);
    }
  });
});
