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
    expect(TRACKS.find((t) => t.task === "bells")?.def?.bells).toBe(true);
    expect(TRACKS.find((t) => t.id === "bhupali")?.def?.drone).toBe(true);
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

import { earFrequencies } from "../audio/binaural";
import { GROUPS } from "./listening";

const SHIPPED = import.meta.glob("../../public/listen/*.mp3");

describe("real recordings and binaural beats", () => {
  it("ships every recording with its file, licence, performer and source", () => {
    const recs = TRACKS.filter((t) => t.recording);
    expect(recs.map((t) => t.id).sort()).toEqual(["moonlight", "mozart_k448"]);
    for (const t of recs) {
      const r = t.recording!;
      expect(Object.keys(SHIPPED)).toContain(`../../public${r.src}`);
      expect(["Public domain", "CC BY-SA 3.0"]).toContain(r.licence);
      expect(r.performer.length).toBeGreaterThan(5);
      expect(r.source).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
    }
  });

  it("offers binaural beats across the bands, each with the right tone in each ear", () => {
    const beats = TRACKS.filter((t) => t.binaural).map((t) => t.binaural!.beat);
    expect(beats).toEqual([2, 6, 10, 15, 40]);
    expect(earFrequencies({ beat: 6, carrier: 200 })).toEqual([200, 206]);
    TRACKS.filter((t) => t.binaural).forEach((t) => {
      expect(t.why.en).toMatch(/headphones/i);
      expect(t.why.en).toMatch(/still studying/i); // honest about the evidence
      expect(t.task).toBe("breathe"); // a slow circle: nothing on screen flashes at the beat rate
    });
  });

  it("puts every track in a group", () => {
    for (const g of GROUPS) expect(TRACKS.some((t) => t.group === g.id)).toBe(true);
    TRACKS.forEach((t) => expect(!!(t.def || t.recording || t.binaural)).toBe(true));
  });
});
