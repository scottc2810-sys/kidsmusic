// All topics of the four school subjects in one place: maths, science, vedas & wisdom, finance. The first
// maths / science topics get their extra concept cards and worked solutions; everyday-situation topics are
// marked as real-life application (they count for "uses it in real life" in the results).
import type { Text } from "../i18n";
import { FIN_STRANDS, FIN_TOPICS } from "./finance";
import { MATHS_TOPICS, STRANDS, type Topic } from "./maths";
import { EXTRA_MATHS_CARDS, MORE_MATHS } from "./maths_more";
import { SCI_STRANDS, SCIENCE_TOPICS, type SciTopic } from "./science";
import { EXTRA_SCIENCE_CARDS, MORE_SCIENCE } from "./science_more";
import { MORE_CARDS } from "./more_cards";
import { MORE_VEDIC } from "./vedic";
import { VEDA_STRANDS, VEDA_TOPICS } from "./vedas";
import { worked } from "./worked";

export type SubjectId = "maths" | "science" | "vedas" | "finance";
/** Topics where every question is an everyday situation: they measure applying, not only knowing. */
const REAL_LIFE = new Set(["story_add_sub", "story_mul_div", "two_step", "money", "time", "weight_capacity", "calendar", "length", "data",
  "hygiene", "recycle", "weather", "float_sink", "heat", "simple_machines", "food_groups", "teeth", "push_pull", "light_shadow", "air"]);

const finish = <T extends Topic | SciTopic>(t: T, extra: Record<string, T["cards"]> = {}): T => ({
  ...t,
  cards: [...t.cards, ...(extra[t.id] ?? []), ...(MORE_CARDS[t.id] ?? [])],
  make: (d, rng) => {
    const e = t.make(d, rng);
    return { ...e, steps: e.steps ?? worked(t.id, e), apply: e.apply ?? REAL_LIFE.has(t.id) };
  },
});

const MATHS_ORDER: Record<string, number> = { numbers: 0, problems: 1, algebra: 2, geometry: 3, measure: 4, vedic: 5 };
export const ALL_MATHS: Topic[] = [...MATHS_TOPICS.map((t) => finish(t, EXTRA_MATHS_CARDS)), ...MORE_MATHS.map((t) => finish(t)), ...MORE_VEDIC]
  .sort((a, b) => (MATHS_ORDER[a.strand] - MATHS_ORDER[b.strand]) || (a.grades[0] - b.grades[0]));
export const ALL_SCIENCE: SciTopic[] = [...SCIENCE_TOPICS.map((t) => finish(t, EXTRA_SCIENCE_CARDS)), ...MORE_SCIENCE.map((t) => finish(t))]
  .sort((a, b) => a.grades[0] - b.grades[0]);

/** Any topic of any subject, in the shape the topic page uses. */
export interface AnyTopic { id: string; strand: string; icon: string; title: Text; grades: [number, number]; cards: Topic["cards"]; make: Topic["make"] }
/** Vedas and finance topics with their extra concept cards (maths and science get them in finish()). */
const withCards = (t: AnyTopic): AnyTopic => ({ ...t, cards: [...t.cards, ...(MORE_CARDS[t.id] ?? [])] });
export const TOPICS: Record<SubjectId, AnyTopic[]> = {
  maths: ALL_MATHS, science: ALL_SCIENCE, vedas: (VEDA_TOPICS as AnyTopic[]).map(withCards), finance: (FIN_TOPICS as AnyTopic[]).map(withCards),
};
export const STRANDS_OF: Record<SubjectId, { id: string; icon: string; title: Text }[]> = {
  maths: STRANDS, science: SCI_STRANDS, vedas: VEDA_STRANDS, finance: FIN_STRANDS,
};
export const SUBJECT_INFO: Record<SubjectId, { icon: string; title: Text }> = {
  maths: { icon: "🔢", title: { en: "Maths", hi: "गणित", hinglish: "Maths" } },
  science: { icon: "🔬", title: { en: "Science", hi: "विज्ञान", hinglish: "Science" } },
  vedas: { icon: "🕉️", title: { en: "Vedas & wisdom", hi: "वेद और ज्ञान", hinglish: "Ved aur gyaan" } },
  finance: { icon: "🪙", title: { en: "Money & finance", hi: "पैसा और वित्त", hinglish: "Paisa aur finance" } },
};
