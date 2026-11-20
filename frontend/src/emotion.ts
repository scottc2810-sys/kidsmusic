// How Melo feels, and how that shows in the voice and the body, like a real teacher.
// The server decides the emotion for an answer (backend/app/teacher/emotion.py); the app turns it into
// a face, a movement, a voice and a small sound. Same names on both sides.
import type { MeloMood } from "./components/Melo";

export type Emotion = "celebrate" | "excited" | "proud" | "warm" | "playful" | "empathetic" | "curious" | "calm" | "surprised";

/**
 * Voice changes per emotion, added to the base delivery. Real voices change speed, pitch and loudness:
 * excited speech is quicker and higher, comforting speech is slower, lower and softer.
 */
export const VOICE: Record<Emotion, { rate: number; pitch: number; volume: number }> = {
  celebrate: { rate: 0.08, pitch: 0.22, volume: 1 },
  excited: { rate: 0.06, pitch: 0.15, volume: 1 },
  surprised: { rate: 0.04, pitch: 0.2, volume: 1 },
  playful: { rate: 0.04, pitch: 0.12, volume: 0.95 },
  proud: { rate: -0.02, pitch: 0.08, volume: 1 },
  warm: { rate: -0.02, pitch: 0.03, volume: 0.95 },
  curious: { rate: -0.03, pitch: 0.06, volume: 0.92 },
  calm: { rate: -0.08, pitch: -0.04, volume: 0.88 },
  empathetic: { rate: -0.12, pitch: -0.08, volume: 0.82 },
};

/** What Melo's face and body do for each emotion (while not talking). */
export const MOOD: Record<Emotion, MeloMood> = {
  celebrate: "dance",
  excited: "cheer",
  surprised: "surprised",
  playful: "happy",
  proud: "proud",
  warm: "happy",
  curious: "curious",
  calm: "idle",
  empathetic: "sad",
};

/** The feeling settles after the first sentence: "Three in a row!" is bright, the next sentence is calmer. */
export function voiceFor(emotion: Emotion | undefined, sentenceIndex: number) {
  if (!emotion) return { rate: 0, pitch: 0, volume: 1 };
  const v = VOICE[emotion];
  const k = sentenceIndex === 0 ? 1 : 0.5;
  return { rate: v.rate * k, pitch: v.pitch * k, volume: v.volume };
}

export const isEmotion = (x: unknown): x is Emotion => typeof x === "string" && x in VOICE;

/**
 * Music lessons: the same teacher rules as the server's language lessons (teacher/emotion.py), worked out
 * in the app from the sitting so far. `streak` counts successes in a row including this one; `missRun`
 * counts misses in a row before this answer.
 */
export function musicReaction(outcome: string, streak: number, missRun: number, milestone = false):
  { emotion: Emotion; sfx: "sparkle" | "tada" | "clap" | "oops" | "pop" | null } {
  if (outcome === "success") {
    if (milestone) return { emotion: "celebrate", sfx: "tada" };
    if (missRun >= 1) return { emotion: "proud", sfx: "clap" }; // a comeback: praise the effort
    if (streak >= 5 && streak % 5 === 0) return { emotion: "celebrate", sfx: "tada" };
    if (streak === 3) return { emotion: "excited", sfx: "clap" };
    return { emotion: "excited", sfx: "sparkle" };
  }
  if (outcome === "partial") return { emotion: "warm", sfx: "pop" };
  if (outcome === "miss") return missRun >= 1 ? { emotion: "empathetic", sfx: null } : { emotion: "playful", sfx: "oops" };
  if (outcome === "uncertain") return { emotion: "curious", sfx: null };
  return { emotion: "calm", sfx: null };
}
