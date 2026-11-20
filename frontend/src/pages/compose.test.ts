import { describe, expect, it } from "vitest";
import { tuneBeats } from "./KidExtras";

describe("compose timing", () => {
  it("keeps the child's rhythm: quick taps are short notes, a pause makes a long note", () => {
    const beat = 600; // 100 bpm
    const times = [0, beat * 0.5, beat, beat * 3, beat * 4];
    expect(tuneBeats(times)).toEqual([0.5, 0.5, 2, 1, 1]);
  });
  it("caps very long pauses at 2 beats and very fast taps at half a beat", () => {
    expect(tuneBeats([0, 10, 10000])).toEqual([0.5, 2, 1]);
  });
});
