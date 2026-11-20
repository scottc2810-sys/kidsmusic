import { afterEach, describe, expect, it, vi } from "vitest";
import { prosody, sentences, voicesFor } from "./speech";

const V = (name: string, lang: string) => ({ name, lang, default: false }) as SpeechSynthesisVoice;

afterEach(() => vi.unstubAllGlobals());

describe("speech", () => {
  it("splits into sentences (incl. the Hindi danda) and strips emoji", () => {
    expect(sentences("Wow! You did it 🎉. Shall we play again?")).toEqual(["Wow!", "You did it .", "Shall we play again?"]);
    expect(sentences("वाह! तुमने बजा दिया। चलो फिर से")).toEqual(["वाह!", "तुमने बजा दिया।", "चलो फिर से"]);
  });

  it("is expressive: exclamations brighter, questions rise", () => {
    const plain = prosody("Listen to this.", true);
    expect(prosody("Hooray!", true).pitch).toBeGreaterThan(plain.pitch);
    expect(prosody("Ready?", true).pitch).toBeGreaterThan(plain.pitch);
  });

  it("prefers natural Indian voices over robotic or foreign ones", () => {
    const voices = [V("Microsoft David - English (United States)", "en-US"), V("Microsoft Heera - English (India)", "en-IN"),
      V("Microsoft Neerja Online (Natural) - English (India)", "en-IN"), V("Microsoft Kalpana - Hindi (India)", "hi-IN"),
      V("Microsoft Swara Online (Natural) - Hindi (India)", "hi-IN"), V("Google Deutsch", "de-DE")];
    vi.stubGlobal("window", { speechSynthesis: { getVoices: () => voices } });
    expect(voicesFor("en")[0].name).toMatch(/Neerja/);
    expect(voicesFor("hinglish")[0].name).toMatch(/Neerja/);
    expect(voicesFor("hi")[0].name).toMatch(/Swara/);
    expect(voicesFor("hi").map((v) => v.name)).not.toContain("Google Deutsch");
  });
});
