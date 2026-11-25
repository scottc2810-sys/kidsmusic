// Note Rain: the rules of the falling-notes game, kept apart from the screen so they can be tested.
// Coloured notes fall towards the keys; the child presses each one as it reaches the line.
// * "wait" mode (default for the youngest): the music stops at every note until the right key is pressed,
//   so there is no rush; what counts is how many wrong keys were pressed on the way.
// * "play" mode: the music keeps going, like playing along with a band; a note is caught when the right key
//   is pressed close to the line.
// Four speeds (turtle, normal, rabbit, rocket), 3 stars, and worlds that open with stars.
import type { SongCard } from "../api";

export type RainMode = "wait" | "play";
export type Speed = "turtle" | "normal" | "rabbit" | "rocket";
export const SPEEDS: { id: Speed; icon: string; factor: number }[] = [
  { id: "turtle", icon: "🐢", factor: 0.6 },
  { id: "normal", icon: "🎵", factor: 0.8 },
  { id: "rabbit", icon: "🐇", factor: 1 },
  { id: "rocket", icon: "🚀", factor: 1.25 },
];

export interface RainNote { midi: number; start: number; beats: number }

/** Song notes [midi, beats] → notes with their start beat. */
export function buildChart(notes: [number, number][]): RainNote[] {
  let t = 0;
  return notes.map(([midi, beats]) => {
    const n = { midi, start: t, beats };
    t += beats;
    return n;
  });
}

export const songBeats = (chart: RainNote[]) => (chart.length ? chart[chart.length - 1].start + chart[chart.length - 1].beats : 0);

/** Beats per minute for a song at a speed. Songs without their own tempo play at 80. */
export const bpmFor = (songBpm: number | null | undefined, speed: Speed) =>
  Math.round((songBpm || 80) * (SPEEDS.find((s) => s.id === speed)?.factor ?? 0.8));

/** How far (in beats) from the line a key still catches the note in play mode: wider for little hands. */
export const hitWindow = (age: number) => (age <= 5 ? 0.6 : age <= 7 ? 0.45 : 0.35);

export type Judge = "perfect" | "good" | null;
export function judge(deltaBeats: number, window: number): Judge {
  const d = Math.abs(deltaBeats);
  return d <= window / 2 ? "perfect" : d <= window ? "good" : null;
}

/** Same bands as every round in Melo and as the server: 90 % = 3 stars, 70 % = 2, 40 % = 1. */
export const starsFor = (accuracy: number) => (accuracy >= 0.9 ? 3 : accuracy >= 0.7 ? 2 : accuracy >= 0.4 ? 1 : 0);

export function accuracyOf(mode: RainMode, hits: number, total: number, wrong: number): number {
  if (!total) return 0;
  const h = Math.min(hits, total);
  if (mode === "wait") return h ? h / (h + Math.min(wrong, 4 * total)) : 0;
  return h / total;
}

/** Wait mode: which way to go after a wrong key, said the way a teacher would, with the reason. */
export function directionHint(target: number, pressed: number): "higher" | "lower" | "same" {
  return target > pressed ? "higher" : target < pressed ? "lower" : "same";
}

// --- worlds -----------------------------------------------------------------------------------------------
export interface World { id: string; icon: string; title: { en: string; hi: string; hinglish: string }; songs: string[]; needs: number }

/** Nursery songs in order of difficulty, three per world; Indian songs and alankars have their own world. */
export function makeWorlds(cards: Pick<SongCard, "id" | "ease" | "tag">[], length: (id: string) => number): World[] {
  const known = cards.filter((c) => c.tag !== "claude");
  const easy = known.filter((c) => c.tag === "nursery" || c.tag === "celebration")
    .sort((a, b) => a.ease - b.ease || length(a.id) - length(b.id)).map((c) => c.id);
  const indian = known.filter((c) => c.tag === "indian" || c.tag === "alankar")
    .sort((a, b) => a.ease - b.ease || length(a.id) - length(b.id)).map((c) => c.id);
  const chunk = (from: number, to?: number) => easy.slice(from, to);
  return [
    { id: "forest", icon: "🌳", title: { en: "Enchanted Forest", hi: "जादुई जंगल", hinglish: "Jaadui jungle" }, songs: chunk(0, 3), needs: 0 },
    { id: "ocean", icon: "🌊", title: { en: "Magic Ocean", hi: "जादुई सागर", hinglish: "Jaadui saagar" }, songs: chunk(3, 6), needs: 3 },
    { id: "castle", icon: "🏰", title: { en: "Musical Castle", hi: "संगीत महल", hinglish: "Sangeet mahal" }, songs: chunk(6), needs: 3 },
    { id: "temple", icon: "🪔", title: { en: "Sargam Temple", hi: "सरगम मंदिर", hinglish: "Sargam mandir" }, songs: indian, needs: 0 },
  ].filter((w) => w.songs.length);
}

/** A world opens when the world before it (in the same row) has collected `needs` stars. */
export function worldOpen(worlds: World[], i: number, stars: (songId: string) => number): boolean {
  const w = worlds[i];
  if (!w.needs || i === 0) return true;
  const prev = worlds[i - 1];
  if (prev.id === "temple") return true;
  return prev.songs.reduce((sum, s) => sum + stars(s), 0) >= w.needs;
}
