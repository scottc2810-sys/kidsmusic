import { describe, expect, it } from "vitest";
import { pronounce } from "./audio/speech";
import { L, noteLabel, sungName, t, tr } from "./i18n";
import { LANGS, LANGUAGE_CODES } from "./languages";
import { HandStats, handPosture, jointAngle, type Observation } from "./vision/camera";

describe("Melo says note names properly", () => {
  it("gives an English voice a spelling it will not spell out letter by letter", () => {
    expect(pronounce("Sa Re Ga Ma Pa Dha Ni", "en-IN")).toBe("Saa Ray Gaa Maa Paa Dhaa Nee");
    expect(pronounce("Tumne Ga bajaya. Ab Pa bajao!", "en-IN")).toBe("Tumne Gaa bajaya. Ab Paa bajao!");
    expect(pronounce("Sa' aur .Pa", "en-IN")).toBe("Saa aur Paa");
  });
  it("leaves ordinary words alone", () => {
    expect(pronounce("Game khelein? Paani, Machli, Saath, Remember, Night", "en-IN")).toBe("Game khelein? Paani, Machli, Saath, Remember, Night");
  });
  it("gives a Hindi voice the long, open swar", () => {
    expect(pronounce("Sa Re Ga", "hi-IN")).toBe("सा रे गा");
    expect(pronounce("तुमने ग बजाया। अब प बजाओ!", "hi-IN")).toBe("तुमने गा बजाया। अब पा बजाओ!");
    expect(pronounce("गाना सुनो, मज़ा आया", "hi-IN")).toBe("गाना सुनो, मज़ा आया"); // words are untouched
  });
});

describe("languages", () => {
  it("names notes in each language's system", () => {
    expect(noteLabel(64, "en")).toBe("E");
    expect(noteLabel(64, "hinglish")).toBe("Ga");
    expect(noteLabel(64, "hi")).toBe("ग");
    expect(noteLabel(64, "es")).toBe("Mi");
    expect(noteLabel(67, "fr")).toBe("Sol");
    expect(noteLabel(60, "ar")).toBe("دو");
    expect(sungName(64, "hinglish")).toBe("Ga");
    expect(sungName(64, "zh")).toBe("Mi");
    expect(sungName(64, "en")).toBe("La");
  });
  it("falls back to English for anything a language pack has not translated", () => {
    expect(L({ en: "Zzz not translated anywhere" }, "fr")).toBe("Zzz not translated anywhere");
    expect(tr("Zzz not translated anywhere", "ar")).toBe("Zzz not translated anywhere");
    expect(t("yourTurn", "hi")).toBe("तुम्हारी बारी!");
  });
  it("every language has a pack that translates the core child screen", () => {
    for (const code of LANGUAGE_CODES) {
      expect(LANGS[code].voices.length).toBeGreaterThan(0);
      if (["en", "hi", "hinglish"].includes(code)) continue;
      for (const key of ["start", "yourTurn", "listen", "done", "back", "nextStep"] as const) {
        expect(t(key, code), `${code}/${key}`).not.toBe(t(key, "en"));
      }
    }
  });
});

describe("camera coaching", () => {
  const P = (x: number, y: number) => ({ x, y, z: 0 });
  /** A hand whose four fingers have the given bend (degrees at the middle joint). */
  function hand(bends: number[]) {
    const pts = Array.from({ length: 21 }, () => P(0, 0));
    [[5, 6, 8], [9, 10, 12], [13, 14, 16], [17, 18, 20]].forEach(([k, m, tip], i) => {
      const x = i * 0.1;
      pts[k] = P(x, 0.5); pts[m] = P(x, 0.4);
      const a = ((180 - bends[i]) * Math.PI) / 180;
      pts[tip] = P(x + 0.1 * Math.sin(a), 0.4 - 0.1 * Math.cos(a));
    });
    return pts;
  }
  it("measures a joint angle", () => {
    expect(jointAngle(P(0, 1), P(0, 0), P(0, -1))).toBeCloseTo(180, 0);
    expect(jointAngle(P(0, 1), P(0, 0), P(1, 0))).toBeCloseTo(90, 0);
  });
  it("tells flat fingers, curved fingers and one-finger poking apart", () => {
    expect(handPosture(hand([178, 176, 175, 174]))).toEqual({ flat: true, oneFinger: false });
    expect(handPosture(hand([140, 138, 135, 140]))).toEqual({ flat: false, oneFinger: false });
    expect(handPosture(hand([172, 90, 85, 80]))).toEqual({ flat: false, oneFinger: true });
  });
  it("summarises what it saw while the child played", () => {
    const st = new HandStats();
    const obs = (handsVisible: number, flat: boolean): Observation => ({ handsVisible, fingertips: [], estimatedKeys: [], inKeyboard: false, flat, oneFinger: false });
    for (let i = 0; i < 10; i++) st.add(obs(1, i < 8));
    for (let i = 0; i < 10; i++) st.add(obs(0, false));
    expect(st.summary()).toEqual({ frames: 20, seen: 0.5, flat: 0.8, one_finger: 0 });
  });
});

describe("tracing a letter", () => {
  it("rewards covering the letter and not scribbling outside it", async () => {
    const { traceScore } = await import("./pages/Learn");
    const mask = new Uint8Array(100), tolerant = new Uint8Array(100), ink = new Uint8Array(100);
    for (let i = 20; i < 40; i++) mask[i] = 1; // the letter
    for (let i = 15; i < 45; i++) tolerant[i] = 1; // a little room around it
    for (let i = 22; i < 42; i++) ink[i] = 1; // a slightly wobbly trace
    expect(traceScore(mask, tolerant, ink)).toEqual({ coverage: 0.9, spill: 0 });
    const scribble = new Uint8Array(100).fill(1);
    expect(traceScore(mask, tolerant, scribble)).toEqual({ coverage: 1, spill: 0.7 });
    expect(traceScore(mask, tolerant, new Uint8Array(100))).toEqual({ coverage: 0, spill: 0 });
  });
});
