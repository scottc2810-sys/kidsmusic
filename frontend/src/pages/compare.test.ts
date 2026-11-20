import { describe, expect, it } from "vitest";
import { CHOICES, DEFAULT_MAX, toggled } from "./Compare";

describe("side by side: the family chooses how many languages", () => {
  it("adds up to the chosen number, then the oldest choice makes room", () => {
    expect(toggled(["en", "hi"], "es", 3)).toEqual(["en", "hi", "es"]);
    expect(toggled(["en", "hi", "es"], "zh", 3)).toEqual(["hi", "es", "zh"]);
    const six = toggled(["en", "hi", "es", "zh", "fr"], "ar", 6);
    expect(six).toHaveLength(6);
  });
  it("never leaves the table empty and removes a chosen language", () => {
    expect(toggled(["en"], "en", 4)).toEqual(["en"]);
    expect(toggled(["en", "hi"], "en", 4)).toEqual(["hi"]);
  });
  it("can show every language at once", () => {
    const all = ["en", "hi", "mr", "fr", "es", "ar", "zh", "yue", "ko", "ru", "tr", "sa", "gu", "bn", "pa", "ta", "te", "kn", "de", "ja"];
    let cur = ["en"];
    for (const c of all.slice(1)) cur = toggled(cur, c, all.length);
    expect(cur).toEqual(all);  // all twenty side by side
    expect(DEFAULT_MAX).toBe(4);
    expect(CHOICES[0]).toBe(1);
  });
});
