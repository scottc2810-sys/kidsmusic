// Mouth movement for the avatar: listeners get 0..1 "openness" pulses while Melo speaks or sings.
type MouthListener = (open: number) => void;
const listeners = new Set<MouthListener>();

export const onMouth = (cb: MouthListener) => { listeners.add(cb); return () => { listeners.delete(cb); }; };
export const pulseMouth = (v: number) => listeners.forEach((l) => l(v));
