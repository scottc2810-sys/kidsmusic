// What the "Learn it" cards cover: for every topic, the facts its questions ask (answers that are words, not
// numbers to work out) must appear in the topic's concept cards. Numbers are worked out, and every new level
// opens with a worked example (teachfirst.ts), so they are not counted here.
import { expect, it } from "vitest";
import { TOPICS, type SubjectId } from "./index";
import { isMethod } from "./teachfirst";

function seeded(seed: number) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }
const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N} ]+/gu, " ").replace(/\s+/g, " ").trim();
const STOP = new Set("a an the of to is are and or it in on at for with by be this that what which who how".split(" "));
const YESNO = new Set(["yes", "no", "correct", "wrong"]); // judged by a rule the cards teach, not recalled
// a library of many items, each taught on its own "learn first" card just before it is first asked
const ONE_BY_ONE = new Set(["shloka_meaning"]);

export function coverage() {
  const rows: { id: string; pct: number; missing: string[] }[] = [];
  let total = 0, untaught = 0;
  for (const subj of Object.keys(TOPICS) as SubjectId[]) {
    for (const t of TOPICS[subj]) {
      if (ONE_BY_ONE.has(t.id)) continue;
      const taught = norm(t.cards.map((c) => `${c.title.en} ${c.say.en}`).join(" "));
      const miss = new Set<string>(); let n = 0, m = 0;
      const rng = seeded(7);
      for (let d = 1; d <= 5; d++) for (let k = 0; k < 60; k++) {
        const e = t.make(d, rng);
        const ans = norm(e.answer);
        if (!ans || isMethod(e) || YESNO.has(ans)) continue;
        n++;
        const words = ans.split(" ").filter((w) => w.length > 2 && !STOP.has(w));
        if (!(taught.includes(ans) || (words.length > 0 && words.every((w) => taught.includes(w))))) { m++; miss.add(e.answer); }
      }
      total += n; untaught += m;
      rows.push({ id: `${subj}/${t.id}`, pct: n ? Math.round((100 * m) / n) : 0, missing: [...miss] });
    }
  }
  return { rows, share: untaught / Math.max(1, total) };
}

it("the Learn cards teach what the questions ask", () => {
  const { rows, share } = coverage();
  const weak = rows.filter((r) => r.pct > 0).map((r) => `${r.pct}% ${r.id}: ${r.missing.slice(0, 4).join(" ; ")}`);
  expect(weak, weak.join("\n")).toEqual([]);
  expect(share).toBe(0);
});
