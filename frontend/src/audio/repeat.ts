// How many times a sound is played, set by the parent (per device):
// * recordings in the Listening room (a mantra 3, 11, 21 or 108 times, as it is traditionally recited),
//   or 0 = keep looping until the chosen minutes are over;
// * letters and words: each one said 1, 2, 3 or 5 times in a row, so a child hears it again and again.
export const RECORDING_REPEATS = [0, 1, 3, 5, 7, 11, 21, 108] as const;
export const WORD_REPEATS = [1, 2, 3, 5] as const;

const read = (k: string, d: number, allowed: readonly number[]) => {
  try {
    const v = Number(localStorage.getItem(k));
    return allowed.includes(v) && localStorage.getItem(k) !== null ? v : d;
  } catch { return d; }
};
const write = (k: string, v: number) => { try { localStorage.setItem(k, String(v)); } catch { /* private mode */ } };

export const recordingRepeats = () => read("melo.repeat.recordings", 0, RECORDING_REPEATS);
export const setRecordingRepeats = (n: number) => write("melo.repeat.recordings", n);
export const wordRepeats = () => read("melo.repeat.words", 1, WORD_REPEATS);
export const setWordRepeats = (n: number) => write("melo.repeat.words", n);

/** Play something `times` times with a short pause between, stopping early if `alive()` turns false. */
export async function repeatTimes(times: number, play: () => Promise<unknown>, alive: () => boolean = () => true, gapMs = 600): Promise<void> {
  for (let i = 0; i < Math.max(1, times) && alive(); i++) {
    if (i) await new Promise((r) => setTimeout(r, gapMs));
    if (!alive()) return;
    await play();
  }
}

/** The label a parent sees for a recording repeat setting. */
export const recordingRepeatLabel = (n: number) => (n === 0 ? "Keep playing until the timer ends" : n === 1 ? "Once" : `${n} times`);
