import { describe, expect, it } from "vitest";
import { parseSyllable, renderSyllable } from "./formant";
import { freqToMidi, yin } from "./pitch";

const SR = 44100;
const midiToFreq = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const chunk = (buf: Float32Array, atSec: number) => buf.slice(Math.round(atSec * SR), Math.round(atSec * SR) + 2048);

/** Energy near `f` (Goertzel) in a chunk, to compare formant regions. */
function energyAt(buf: Float32Array, f: number): number {
  const w = (2 * Math.PI * f) / SR;
  let s1 = 0, s2 = 0;
  for (let i = 0; i < buf.length; i++) { const s = buf[i] + 2 * Math.cos(w) * s1 - s2; s2 = s1; s1 = s; }
  return s1 * s1 + s2 * s2 - 2 * Math.cos(w) * s1 * s2;
}
const band = (buf: Float32Array, lo: number, hi: number) => {
  let e = 0;
  for (let f = lo; f <= hi; f += 50) e += energyAt(buf, f);
  return e;
};
const zeroCrossings = (buf: Float32Array) => { let z = 0; for (let i = 1; i < buf.length; i++) if ((buf[i] >= 0) !== (buf[i - 1] >= 0)) z++; return z; };

describe("singing voice", () => {
  it("parses swars, bols and solfege into consonant + vowel", () => {
    expect(parseSyllable("Sa")).toEqual({ onset: "s", vowel: "a", coda: "" });
    expect(parseSyllable("Dha")).toEqual({ onset: "dh", vowel: "a", coda: "" });
    expect(parseSyllable("Ni")).toEqual({ onset: "n", vowel: "i", coda: "" });
    expect(parseSyllable("Sa'")).toEqual({ onset: "s", vowel: "a", coda: "" });
    expect(parseSyllable("Dhin")).toEqual({ onset: "dh", vowel: "i", coda: "n" });
    expect(parseSyllable("Sol")).toEqual({ onset: "s", vowel: "o", coda: "l" });
    expect(parseSyllable("ग")).toEqual({ onset: "g", vowel: "a", coda: "" });
    expect(parseSyllable("नि")).toEqual({ onset: "n", vowel: "i", coda: "" });
    expect(parseSyllable("सां")).toEqual({ onset: "s", vowel: "a", coda: "" });
    expect(parseSyllable("???")).toEqual({ onset: "l", vowel: "a", coda: "" }); // unknown: sing "la"
  });

  it("sings every swar in tune (within 15 cents)", () => {
    const swars: [string, number][] = [["Sa", 60], ["Re", 62], ["Ga", 64], ["Ma", 65], ["Pa", 67], ["Dha", 69], ["Ni", 71], ["Sa", 72]];
    for (const [name, midi] of swars) {
      const buf = renderSyllable(name, midiToFreq(midi), 0.9, SR);
      expect(buf.every((x) => Number.isFinite(x) && Math.abs(x) <= 1)).toBe(true);
      const p = yin(chunk(buf, 0.22), SR); // after the consonant, before vibrato
      expect(p.clarity).toBeGreaterThan(0.8);
      expect(Math.abs(freqToMidi(p.freq) - midi) * 100).toBeLessThan(15);
    }
  });

  it("stays in tune across the low and high saptak", () => {
    for (const midi of [55, 59, 74, 79]) {
      const p = yin(chunk(renderSyllable("Pa", midiToFreq(midi), 0.8, SR), 0.25), SR);
      expect(Math.abs(freqToMidi(p.freq) - midi) * 100).toBeLessThan(15);
    }
  });

  it("gives vowels their own colour: Ni is brighter than Sa", () => {
    const sa = chunk(renderSyllable("Sa", 262, 0.8, SR), 0.4);
    const ni = chunk(renderSyllable("Ni", 262, 0.8, SR), 0.4);
    const bright = (b: Float32Array) => band(b, 2300, 3300) / band(b, 700, 1500);
    expect(bright(ni)).toBeGreaterThan(bright(sa) * 4);
  });

  it("starts Sa with a hissy 's' and Ma with a hum", () => {
    const sa = renderSyllable("Sa", 262, 0.8, SR).slice(0, Math.round(0.07 * SR));
    const ma = renderSyllable("Ma", 262, 0.8, SR).slice(0, Math.round(0.07 * SR));
    expect(zeroCrossings(sa)).toBeGreaterThan(zeroCrossings(ma) * 4);
  });

  it("recites bols with a spoken, falling pitch", () => {
    const buf = renderSyllable("Dha", 240, 0.3, SR, { speech: true });
    const early = yin(chunk(buf, 0.09), SR).freq;
    const late = yin(buf.slice(buf.length - 2048 - Math.round(0.06 * SR), buf.length - Math.round(0.06 * SR)), SR).freq;
    expect(early).toBeGreaterThan(late);
  });

  it("fades out without a click and is repeatable", () => {
    const a = renderSyllable("Ga", 330, 0.5, SR);
    const b = renderSyllable("Ga", 330, 0.5, SR);
    expect(Math.abs(a[a.length - 1])).toBeLessThan(0.02);
    expect(Array.from(a.slice(0, 500))).toEqual(Array.from(b.slice(0, 500)));
  });
});
