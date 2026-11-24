import { beforeEach, describe, expect, it } from "vitest";
import { TOPICS, type SubjectId } from "./index";
import { AskedLog, drawFresh, drawRevision, isMethod, nearLevels, qid, TaughtLog, teachFirst } from "./teachfirst";

function seeded(seed: number) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }

beforeEach(() => {
  const m = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k),
  };
});

describe("teach before asking", () => {
  it("in every topic of every subject, no question is asked before it was taught", () => {
    for (const subj of Object.keys(TOPICS) as SubjectId[]) {
      for (const t of TOPICS[subj]) {
        const log = new TaughtLog("kid", subj, t.id);
        const rng = seeded(11);
        for (let d = 1; d <= 5; d++) {
          for (let k = 0; k < 40; k++) {
            const e = t.make(d, rng);
            const lesson = teachFirst(e, d, log, (r) => t.make(d, r), rng);
            if (isMethod(e)) {
              // a new level always opens with a worked example; once shown, questions come straight away
              expect(lesson == null, `${t.id} L${d}`).toBe(log.knowsLevel(d));
              if (lesson) { expect(lesson.kind).toBe("example"); log.learnLevel(d); }
            } else {
              expect(lesson == null, `${t.id}: ${e.prompt.en}`).toBe(log.knowsFact(e));
              if (lesson) { expect(lesson).toEqual({ kind: "fact", e }); log.learnFact(e); }
            }
            // whatever is asked now has been taught (the fact itself, or a worked example at this level)
            expect(isMethod(e) ? log.knowsLevel(d) : log.knowsFact(e)).toBe(true);
          }
        }
      }
    }
  });

  it("works an example with other numbers, then the child solves a different one", () => {
    const add = TOPICS.maths.find((t) => t.id === "addition")!;
    const rng = seeded(3);
    const e = add.make(2, rng);
    const lesson = teachFirst(e, 2, new TaughtLog("kid", "maths", "addition"), (r) => add.make(2, r), rng)!;
    expect(lesson.kind).toBe("example");
    expect(lesson.e.prompt.en).not.toBe(e.prompt.en);
    expect(lesson.e.steps?.length).toBeGreaterThan(0);
  });

  it("remembers what each child was taught, separately", () => {
    const living = TOPICS.science.find((t) => t.id === "living")!;
    const e = living.make(1, seeded(5));
    new TaughtLog("asha", "science", "living").learnFact(e);
    expect(new TaughtLog("asha", "science", "living").knowsFact(e)).toBe(true);
    expect(new TaughtLog("ravi", "science", "living").knowsFact(e)).toBe(false);
  });

  it("never asks the same question twice, in any topic, over many rounds and levels", () => {
    for (const subj of Object.keys(TOPICS) as SubjectId[]) {
      for (const t of TOPICS[subj]) {
        const log = new AskedLog("kid", subj, t.id);
        const ever = new Set<string>();
        const rng = seeded(21);
        let ranOut = false;
        for (let round = 0; round < 30 && !ranOut; round++) {
          const level = 1 + (round % 5);
          const inRound = new Set<string>();
          for (let k = 0; k < 5; k++) {
            const e = drawFresh(t.make, nearLevels(level), log, rng, inRound);
            if (!e) { ranOut = true; break; }
            expect(ever.has(qid(e)), `${subj}/${t.id} repeated: ${e.prompt.en} → ${e.answer}`).toBe(false);
            ever.add(qid(e)); inRound.add(qid(e)); log.add(e);
          }
        }
        // a used-up topic stays used up: nothing old comes back, even after reopening it
        if (ranOut) expect(drawFresh(t.make, nearLevels(3), new AskedLog("kid", subj, t.id), rng)).toBeNull();
      }
    }
  });

  it("revision brings back only questions already met, slips first, rebuilt exactly, and never into new practice", () => {
    for (const subj of Object.keys(TOPICS) as SubjectId[]) {
      for (const t of TOPICS[subj]) {
        const log = new AskedLog("kid", subj, t.id);
        const rng = seeded(33);
        const met = new Map<string, string>(); // qid -> how it looked when asked
        for (let k = 0; k < 6; k++) {
          const e = drawFresh(t.make, nearLevels(2), log, rng);
          if (!e) break;
          log.add(e); met.set(qid(e), e.why.en);
        }
        expect(log.deck.length, `${t.id}: nothing kept for revision`).toBe(met.size);
        // one question was a slip: revision always starts with it
        const slipped = drawRevision(t.make, log, rng)!;
        log.setMissed(slipped, true);
        for (let k = 0; k < 5; k++) expect(qid(drawRevision(t.make, log, rng)!), t.id).toBe(qid(slipped));
        // answered right in revision: no longer first in line
        log.setMissed(slipped, false);
        expect(log.deck.some((x) => x[3])).toBe(false);
        const r1 = drawRevision(t.make, log, rng)!;
        expect(met.has(qid(r1)), `${t.id}: revision asked something never met`).toBe(true);
        expect(r1.why.en).toBe(met.get(qid(r1))); // the very same question, rebuilt from its seed
        // a whole revision round: no repeats inside it, and only met questions
        const round = new Set<string>();
        for (let k = 0; k < met.size + 2; k++) {
          const r = drawRevision(t.make, log, rng, round);
          if (!r) break;
          expect(round.has(qid(r))).toBe(false);
          expect(met.has(qid(r))).toBe(true);
          round.add(qid(r));
        }
        expect(round.size).toBe(met.size);
        // new practice still never brings them back
        const fresh = drawFresh(t.make, nearLevels(2), log, rng);
        if (fresh) expect(met.has(qid(fresh))).toBe(false);
      }
    }
  });
});
