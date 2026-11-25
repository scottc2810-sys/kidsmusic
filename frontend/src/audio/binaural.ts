// Binaural beats: a steady tone in the left ear and a slightly different one in the right ear. The brain hears
// the difference as a slow "beat" (200 Hz left + 206 Hz right = a 6 Hz beat). Only works with headphones.
// The research is mixed (small effects on relaxation or attention in some studies, none in others), so the app
// says so, keeps the sound soft, fades in and out, and never flashes anything at the beat rate on screen
// (flicker at 15-40 Hz can trigger seizures in photosensitive children).
import { audioContext } from "./synth";

export interface Binaural { beat: number; carrier: number }

/** Left and right frequencies for a beat: the carrier in the left ear, carrier + beat in the right. */
export const earFrequencies = (b: Binaural): [number, number] => [b.carrier, b.carrier + b.beat];

let nodes: { stop: (fade: number) => void } | null = null;

export function startBinaural(b: Binaural, volume = 0.12): void {
  stopBinaural(0.05);
  const c = audioContext();
  if (c.state !== "running") void c.resume().catch(() => {});
  const [fl, fr] = earFrequencies(b);
  const merger = c.createChannelMerger(2);
  const out = c.createGain();
  out.gain.setValueAtTime(0, c.currentTime);
  out.gain.linearRampToValueAtTime(Math.min(0.25, volume), c.currentTime + 4); // a slow, gentle start
  merger.connect(out).connect(c.destination);
  const mk = (f: number, ch: number) => {
    const o = c.createOscillator();
    o.type = "sine";
    o.frequency.value = f;
    o.connect(merger, 0, ch);
    o.start();
    return o;
  };
  const oscs = [mk(fl, 0), mk(fr, 1)];
  // a very soft, low "ocean" noise under the tones makes them easier to listen to for a few minutes
  const buf = c.createBuffer(2, c.sampleRate * 4, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let last = 0;
    for (let i = 0; i < d.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; } // brown noise
  }
  const noise = c.createBufferSource();
  noise.buffer = buf;
  noise.loop = true;
  const ng = c.createGain();
  ng.gain.value = 0.25;
  noise.connect(ng).connect(out);
  noise.start();
  nodes = {
    stop: (fade: number) => {
      const t = c.currentTime;
      out.gain.cancelScheduledValues(t);
      out.gain.setValueAtTime(out.gain.value, t);
      out.gain.linearRampToValueAtTime(0, t + fade);
      window.setTimeout(() => { oscs.forEach((o) => o.stop()); noise.stop(); out.disconnect(); }, fade * 1000 + 100);
    },
  };
}

export function stopBinaural(fade = 3): void {
  nodes?.stop(fade);
  nodes = null;
}
