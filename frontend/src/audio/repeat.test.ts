import { describe, expect, it } from "vitest";
import { recordingRepeatLabel, repeatTimes, RECORDING_REPEATS, WORD_REPEATS } from "./repeat";

describe("repeat a sound as often as the parent chose", () => {
  it("plays exactly N times", async () => {
    let n = 0;
    await repeatTimes(3, async () => { n++; }, () => true, 0);
    expect(n).toBe(3);
  });

  it("stops early when the page closes", async () => {
    let n = 0;
    let alive = true;
    await repeatTimes(5, async () => { n++; if (n === 2) alive = false; }, () => alive, 0);
    expect(n).toBe(2);
  });

  it("plays at least once", async () => {
    let n = 0;
    await repeatTimes(0, async () => { n++; }, () => true, 0);
    expect(n).toBe(1);
  });

  it("offers the traditional counts for mantras", () => {
    expect(RECORDING_REPEATS).toEqual([0, 1, 3, 5, 7, 11, 21, 108]);
    expect(WORD_REPEATS).toEqual([1, 2, 3, 5]);
    expect(recordingRepeatLabel(0)).toMatch(/timer/);
    expect(recordingRepeatLabel(108)).toBe("108 times");
  });
});
