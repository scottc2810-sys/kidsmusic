import { describe, expect, it } from "vitest";
import { accuracyOf, bpmFor, buildChart, directionHint, judge, makeWorlds, songBeats, starsFor, worldOpen } from "./noterain";
import { foldIntoRange, parseMidi } from "../audio/midi";
import { keyForComputerKey } from "../components/Piano";

describe("Note Rain rules", () => {
  it("places every note at the beat where it starts", () => {
    const c = buildChart([[60, 1], [62, 0.5], [64, 2]]);
    expect(c.map((n) => n.start)).toEqual([0, 1, 1.5]);
    expect(songBeats(c)).toBe(3.5);
  });

  it("speeds scale the song's own tempo (80 when it has none)", () => {
    expect(bpmFor(96, "rabbit")).toBe(96);
    expect(bpmFor(null, "turtle")).toBe(48);
    expect(bpmFor(undefined, "rocket")).toBe(100);
  });

  it("judges a key by how far the note is from the line", () => {
    expect(judge(0.1, 0.4)).toBe("perfect");
    expect(judge(-0.3, 0.4)).toBe("good");
    expect(judge(0.5, 0.4)).toBeNull();
  });

  it("uses the same star bands as the server", () => {
    expect([1, 0.9, 0.8, 0.5, 0.2].map(starsFor)).toEqual([3, 3, 2, 1, 0]);
    expect(accuracyOf("wait", 10, 10, 0)).toBe(1);
    expect(accuracyOf("wait", 10, 10, 10)).toBe(0.5);
    expect(accuracyOf("wait", 10, 10, 1000)).toBe(0.2); // capped, like the server
    expect(accuracyOf("play", 7, 10, 50)).toBe(0.7);
  });

  it("says which way to go after a wrong key", () => {
    expect(directionHint(67, 60)).toBe("higher");
    expect(directionHint(60, 67)).toBe("lower");
  });

  it("groups songs into worlds that open with stars", () => {
    const cards = [
      { id: "a", ease: 1, tag: "nursery" as const }, { id: "b", ease: 2, tag: "nursery" as const }, { id: "c", ease: 2, tag: "celebration" as const },
      { id: "d", ease: 2, tag: "nursery" as const }, { id: "e", ease: 3, tag: "nursery" as const }, { id: "s", ease: 1, tag: "indian" as const },
      { id: "x", ease: 1, tag: "claude" as const },
    ];
    const worlds = makeWorlds(cards, () => 10);
    expect(worlds.map((w) => w.id)).toEqual(["forest", "ocean", "temple"]);
    expect(worlds[0].songs).toEqual(["a", "b", "c"]);
    expect(worlds.flatMap((w) => w.songs)).not.toContain("x");
    const none = () => 0;
    expect(worldOpen(worlds, 0, none)).toBe(true);
    expect(worldOpen(worlds, 1, none)).toBe(false);
    expect(worldOpen(worlds, 1, (s) => (s === "a" ? 3 : 0))).toBe(true);
    expect(worldOpen(worlds, 2, none)).toBe(true); // the Indian world is always open
  });
});

describe("keyboards", () => {
  it("reads note-on messages from a MIDI keyboard and ignores note-offs", () => {
    expect(parseMidi([0x90, 60, 100])).toEqual({ midi: 60, velocity: 100 });
    expect(parseMidi([0x93, 64, 20])).toEqual({ midi: 64, velocity: 20 }); // any channel
    expect(parseMidi([0x90, 60, 0])).toBeNull(); // note-on with velocity 0 = note-off
    expect(parseMidi([0x80, 60, 64])).toBeNull();
    expect(parseMidi([0xf8])).toBeNull(); // clock
  });

  it("brings notes played in another octave onto the keys on screen", () => {
    expect(foldIntoRange(48, 60, 72)).toBe(60);
    expect(foldIntoRange(86, 60, 72)).toBe(62);
    expect(foldIntoRange(65, 60, 72)).toBe(65);
  });

  it("maps the computer keys like music software: home row white, row above black", () => {
    const keys = Array.from({ length: 13 }, (_, i) => 60 + i);
    expect(keyForComputerKey("a", keys)).toBe(60);
    expect(keyForComputerKey("w", keys)).toBe(61);
    expect(keyForComputerKey("e", keys)).toBe(63);
    expect(keyForComputerKey("r", keys)).toBeNull(); // no black key between E and F
    expect(keyForComputerKey("t", keys)).toBe(66);
    expect(keyForComputerKey("K", keys)).toBe(72);
    expect(keyForComputerKey("z", keys)).toBeNull();
  });
});
