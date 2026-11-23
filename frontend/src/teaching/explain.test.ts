import { describe, expect, it } from "vitest";
import { explainPart, explainStep, moveOf, shapeOf, whiteSteps, wrongKeyWhy } from "./explain";
import { fitToInstrument, keyLabel, STANDARD, whereIs, type InstrumentInfo } from "./instrument";

const toy: InstrumentInfo = { set: true, kind: "toy_keyboard", layout: "keys", keys: 37, first_key: "F", labels: "numbers", low: 53, high: 89 };

describe("why each note", () => {
  it("names the move between notes", () => {
    expect(moveOf(null, 60)).toBe("first");
    expect(moveOf(60, 60)).toBe("same");
    expect(moveOf(60, 62)).toBe("step_up");
    expect(moveOf(64, 62)).toBe("step_down");
    expect(moveOf(60, 64)).toBe("jump_up");
    expect(moveOf(60, 72)).toBe("leap_up");
    expect(whiteSteps(60, 67)).toBe(4);
  });

  it("explains direction, place, length, words and the ending", () => {
    const notes = [60, 60, 62, 60, 65, 64], beats = [0.5, 0.5, 1, 1, 1, 2];
    const w = explainStep(notes, beats, 2, "en", STANDARD, { words: ["Hap", "py", "birth", "day", "to", "you"] });
    expect(w.move).toBe("step_up");
    expect(w.text).toMatch(/right/i);
    expect(w.where).toMatch(/two black keys/);
    expect(w.word).toMatch(/birth/);
    const end = explainStep([60, 62, 64, 62, 60], [1, 1, 1, 1, 2], 4, "en", STANDARD, { songEnd: true });
    expect(end.ending).toMatch(/HOME/);
    expect(end.length).toMatch(/LONG/);
    expect(explainStep([60, 62], [1, 1], 1, "hi", STANDARD).text).toMatch(/दाएँ/);
  });

  it("says why a wrong key is wrong", () => {
    expect(wrongKeyWhy(67, 60, STANDARD, "en")).toMatch(/HIGHER.*RIGHT/);
    expect(wrongKeyWhy(60, 67, STANDARD, "en")).toMatch(/LOWER.*LEFT/);
  });

  it("describes the shape of a part and spots repeats", () => {
    expect(shapeOf([60, 62, 64, 65])).toBe("up");
    expect(shapeOf([67, 65, 64, 62])).toBe("down");
    expect(shapeOf([60, 64, 67, 64, 60])).toBe("hill");
    expect(shapeOf([60, 60, 60])).toBe("same");
    expect(explainPart([[60, 62, 64], [60, 62, 64]], 1, "en")).toMatch(/exactly like part 1/);
  });
});

describe("the child's own instrument", () => {
  it("moves a song into its keys by octaves", () => {
    const narrow: InstrumentInfo = { ...toy, low: 72, high: 84 };
    expect(fitToInstrument([60, 64, 67], narrow)).toEqual({ notes: [72, 76, 79], shift: 12, folded: false });
    expect(fitToInstrument([60, 64], STANDARD).notes).toEqual([60, 64]);
    const tiny: InstrumentInfo = { ...toy, low: 60, high: 67 };
    const f = fitToInstrument([55, 60, 72], tiny);
    expect(f.folded).toBe(true);
    expect(f.notes.every((n) => n >= 60 && n <= 67)).toBe(true);
  });

  it("uses the key stickers and says where a note is", () => {
    expect(keyLabel(64, toy, "en")).toBe("3");
    expect(whereIs(60, toy, "en")).toMatch(/number 1/);
    expect(whereIs(65, STANDARD, "en")).toMatch(/three black keys/);
    const bars: InstrumentInfo = { set: true, kind: "xylophone", layout: "bars", keys: 8, low: 60, high: 72, diatonic: true, labels: "colors" };
    expect(whereIs(64, bars, "en")).toMatch(/bar number 3/);
  });
});
