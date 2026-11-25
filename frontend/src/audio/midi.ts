// A real keyboard plugged in with USB (or paired with Bluetooth MIDI): every key the child presses arrives here
// as a note number, exactly, with no microphone guessing. Works with any MIDI keyboard or digital piano that
// has a USB port (Yamaha, Casio, Roland, ROLI, Alesis ...), in Chrome and Edge. Safari has no Web MIDI: there the
// screen piano, the computer keys and the microphone still work.
//
// Nothing is asked until a page calls startMidi() after a tap (the browser may show a permission prompt).
// Keyboards that make their own sound may sound twice: parents can switch Melo's sound for them off.

type Listener = (midi: number, velocity: number) => void;
export type MidiStatus = "unsupported" | "off" | "waiting" | "connected" | "denied";

const listeners = new Set<Listener>();
const statusListeners = new Set<(s: MidiStatus, name: string | null) => void>();
let status: MidiStatus = typeof navigator !== "undefined" && "requestMIDIAccess" in navigator ? "off" : "unsupported";
let deviceName: string | null = null;
let access: any = null;

const pref = (k: string, d: string) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
let echo = pref("melo.midi.sound", "on") !== "off";
/** Should Melo also sound the notes played on the keyboard? (off for digital pianos with their own speakers) */
export const midiEcho = () => echo;
export function setMidiEcho(on: boolean) { echo = on; try { localStorage.setItem("melo.midi.sound", on ? "on" : "off"); } catch { /* private mode */ } }

export const midiStatus = () => status;
export const midiDevice = () => deviceName;

function setStatus(s: MidiStatus) {
  status = s;
  statusListeners.forEach((l) => l(status, deviceName));
}

/** Note-on messages (status 0x9n with velocity > 0); a note-on with velocity 0 is a note-off. */
export function parseMidi(data: ArrayLike<number>): { midi: number; velocity: number } | null {
  if (!data || data.length < 3) return null;
  const kind = data[0] & 0xf0;
  if (kind === 0x90 && data[2] > 0) return { midi: data[1], velocity: data[2] };
  return null;
}

function attach() {
  if (!access) return;
  const inputs: any[] = Array.from(access.inputs.values());
  inputs.forEach((inp) => {
    inp.onmidimessage = (e: any) => {
      const n = parseMidi(e.data);
      if (n) listeners.forEach((l) => l(n.midi, n.velocity));
    };
  });
  deviceName = inputs[0]?.name ?? null;
  setStatus(inputs.length ? "connected" : "waiting");
}

/** Ask for MIDI access (call after a tap). Safe to call many times. */
export async function startMidi(): Promise<MidiStatus> {
  if (status === "unsupported") return status;
  if (access) { attach(); return status; }
  try {
    access = await (navigator as any).requestMIDIAccess({ sysex: false });
    access.onstatechange = () => attach(); // plugged in or out while playing
    attach();
  } catch {
    setStatus("denied");
  }
  return status;
}

/** Listen for keys pressed on a real keyboard. Returns an unsubscribe function. */
export function onMidiNote(cb: Listener): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

export function onMidiStatus(cb: (s: MidiStatus, name: string | null) => void): () => void {
  statusListeners.add(cb);
  return () => { statusListeners.delete(cb); };
}

/** Bring a played note into the keys on screen (a child may play the same tune an octave higher or lower). */
export function foldIntoRange(midi: number, from: number, to: number): number {
  let m = midi;
  while (m < from) m += 12;
  while (m > to) m -= 12;
  return m >= from ? m : midi;
}
