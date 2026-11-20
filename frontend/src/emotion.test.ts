import { describe, expect, it } from "vitest";
import { prosody } from "./audio/speech";
import { MOOD, musicReaction, VOICE, voiceFor, type Emotion } from "./emotion";

describe("emotion", () => {
  it("changes the voice like a person: excited is quicker and higher, comforting is slower, lower and softer", () => {
    const plain = prosody("Let's try this one.", true);
    const excited = prosody("Let's try this one.", true, "excited");
    const gentle = prosody("Let's try this one.", true, "empathetic");
    expect(excited.rate).toBeGreaterThan(plain.rate);
    expect(excited.pitch).toBeGreaterThan(plain.pitch);
    expect(gentle.rate).toBeLessThan(plain.rate);
    expect(gentle.pitch).toBeLessThan(plain.pitch);
    expect(gentle.volume).toBeLessThan(excited.volume);
  });

  it("is strongest on the first sentence and settles after", () => {
    expect(voiceFor("celebrate", 0).pitch).toBeGreaterThan(voiceFor("celebrate", 1).pitch);
    expect(voiceFor(undefined, 0)).toEqual({ rate: 0, pitch: 0, volume: 1 });
  });

  it("keeps the voice in a safe range even with an exclamation on top", () => {
    const p = prosody("Hooray!", false, "celebrate", 0, 0.02);
    expect(p.pitch).toBeLessThanOrEqual(1.5);
    expect(p.rate).toBeLessThanOrEqual(1.3);
  });

  it("every emotion has a face", () => {
    for (const e of Object.keys(VOICE) as Emotion[]) expect(MOOD[e]).toBeTruthy();
  });

  it("reacts to music answers like a teacher", () => {
    expect(musicReaction("success", 3, 0)).toEqual({ emotion: "excited", sfx: "clap" });
    expect(musicReaction("success", 5, 0).emotion).toBe("celebrate");
    expect(musicReaction("success", 1, 2)).toEqual({ emotion: "proud", sfx: "clap" }); // comeback
    expect(musicReaction("miss", 0, 0)).toEqual({ emotion: "playful", sfx: "oops" });
    expect(musicReaction("miss", 0, 1)).toEqual({ emotion: "empathetic", sfx: null }); // no sound when it is hard
    expect(musicReaction("success", 1, 0, true).emotion).toBe("celebrate");
  });
});
