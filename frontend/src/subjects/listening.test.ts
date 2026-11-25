import { describe, expect, it } from "vitest";
import { CANON, LULLABY, ODE, TRACKS } from "./listening";
import { pieceIndex } from "../audio/bgm";

describe("Listening room", () => {
  it("has tracks for calming, focus, mood, sleep and Indian classical, each with a task and a reason", () => {
    const tasks = new Set(TRACKS.map((t) => t.task));
    ["breathe", "bells", "dance", "count8", "hum"].forEach((k) => expect(tasks.has(k as never)).toBe(true));
    expect(new Set(TRACKS.map((t) => t.id)).size).toBe(TRACKS.length);
    for (const t of TRACKS) for (const x of [t.title, t.goal, t.why, t.how]) {
      expect(x.hi).toMatch(/[ऀ-ॿ]/);
      expect(x.hinglish?.length).toBeGreaterThan(2);
    }
    expect(TRACKS.find((t) => t.task === "bells")?.def.bells).toBe(true);
    expect(TRACKS.find((t) => t.id === "bhupali")?.def.drone).toBe(true);
  });

  it("makes no big brain claims", () => {
    const all = TRACKS.map((t) => `${t.why.en} ${t.how.en}`).join(" ").toLowerCase();
    ["smarter", "iq", "cure", "treat", "genius", "mozart effect"].forEach((w) => expect(all).not.toContain(w));
  });

  it("writes the pieces in whole bars that loop cleanly", () => {
    for (const p of [LULLABY, CANON, ODE]) {
      const { eighths } = pieceIndex(p);
      expect(eighths % (p.beatsPerBar * 2)).toBe(0);
      expect(eighths / (p.beatsPerBar * 2) % p.chords.length).toBe(0); // the chords come round with the tune
    }
    expect(CANON.chords).toHaveLength(8);
  });
});
