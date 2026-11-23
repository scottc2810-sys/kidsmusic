import { describe, expect, it } from "vitest";
import { STRANDS_OF, TOPICS, type SubjectId } from "./index";
import { SHLOKAS, SUBJECT_SHLOKAS, shlokaOfTheDay } from "./shlokas";

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}

describe("vedas & wisdom and money & finance", () => {
  for (const subject of ["vedas", "finance"] as SubjectId[]) {
    for (const topic of TOPICS[subject]) {
      it(`${subject}/${topic.id}`, () => {
        expect(STRANDS_OF[subject].map((s) => s.id)).toContain(topic.strand);
        for (const c of topic.cards) if (c.visual?.type === "shloka") expect(SHLOKAS[c.visual.id], `${topic.id} card shloka`).toBeTruthy();
        for (let d = 1; d <= 5; d++) for (let seed = 1; seed <= 40; seed++) {
          const e = topic.make(d, seeded(seed * 13 + d));
          const where = `${topic.id} d${d} s${seed}: ${e.prompt.en}`;
          expect(e.choices, where).toContain(e.answer);
          expect(new Set(e.choices).size, where).toBe(e.choices.length);
          expect(e.why.en.length, where).toBeGreaterThan(10);
          expect(`${e.prompt.en} ${e.why.en} ${(e.steps ?? []).map((s) => s.en).join(" ")}`, where).not.toMatch(/undefined|NaN/);
          if (e.numeric) expect(Number.isFinite(Number(e.answer)), where).toBe(true);
          if (e.visual?.type === "shloka") expect(SHLOKAS[e.visual.id], where).toBeTruthy();
        }
      });
    }
  }
  it("most vedas and finance questions are real-life applications", () => {
    for (const subject of ["vedas", "finance"] as SubjectId[]) {
      let applied = 0, all = 0;
      for (const t of TOPICS[subject]) for (let s = 1; s <= 20; s++) { all++; if (t.make(3, seeded(s)).apply) applied++; }
      expect(applied / all, subject).toBeGreaterThan(0.4);
    }
  });
  it("every shloka has Devanagari, a source, a meaning and a lesson; each subject has a shloka of the day", () => {
    for (const s of Object.values(SHLOKAS)) {
      expect(s.dev).toMatch(/[ऀ-ॿ]/);
      expect(s.source.length).toBeGreaterThan(3);
      expect(s.meaning.en.length).toBeGreaterThan(20);
      expect(s.lesson.en.length).toBeGreaterThan(20);
      expect(s.meaning.hi).toBeTruthy();
    }
    for (const [subj, ids] of Object.entries(SUBJECT_SHLOKAS)) for (const id of ids) expect(SHLOKAS[id], `${subj}/${id}`).toBeTruthy();
    expect(shlokaOfTheDay("music").id).toBeTruthy();
  });
});
