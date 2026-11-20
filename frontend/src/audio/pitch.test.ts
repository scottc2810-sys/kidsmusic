import { describe, expect, it } from "vitest";
import { NoteTracker, freqToMidi, rms, yin } from "./pitch";

const SR = 44100;
const tone = (f: number, n = 2048, amp = 0.5) => {
  const b = new Float32Array(n);
  for (let i = 0; i < n; i++) b[i] = amp * (Math.sin((2 * Math.PI * f * i) / SR) + 0.3 * Math.sin((4 * Math.PI * f * i) / SR));
  return b;
};

describe("yin", () => {
  it.each([130.81, 261.63, 440, 880])("detects %f Hz", (f) => {
    const r = yin(tone(f), SR);
    expect(Math.abs(freqToMidi(r.freq) - freqToMidi(f))).toBeLessThan(0.2);
    expect(r.clarity).toBeGreaterThan(0.8);
  });
  it("reports no pitch for noise", () => {
    const b = new Float32Array(2048).map(() => Math.random() * 2 - 1);
    expect(yin(b, SR).clarity).toBeLessThan(0.85);
  });
});

describe("NoteTracker", () => {
  it("emits one note per stable pitch and re-triggers after release", () => {
    const notes: number[] = [];
    const tr = new NoteTracker(3, (n) => notes.push(n.midi));
    const c4 = tone(261.63);
    const e4 = tone(329.63);
    const silence = new Float32Array(2048);
    const feed = (b: Float32Array, k: number) => { for (let i = 0; i < k; i++) tr.push(yin(b, SR), rms(b), i * 20); };
    feed(c4, 6); feed(e4, 6); feed(silence, 3); feed(e4, 6);
    expect(notes).toEqual([60, 64, 64]);
  });
});
