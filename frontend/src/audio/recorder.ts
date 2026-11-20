// Practice recording: MediaRecorder (any codec) → decode → 16 kHz mono 16-bit PCM WAV.
// Converting in the browser means the server needs no ffmpeg on Windows or Linux.

export const MAX_SECONDS = 600;
const TARGET_SR = 16000;

export function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buffer);
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, "RIFF"); v.setUint32(4, 36 + samples.length * 2, true); str(8, "WAVE");
  str(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, "data"); v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

/** Decode any browser-supported audio file and convert it to a 16 kHz mono WAV. */
export async function toWav16k(data: Blob): Promise<{ wav: Blob; seconds: number }> {
  const AC = window.AudioContext || (window as any).webkitAudioContext;
  const tmp = new AC();
  let decoded: AudioBuffer;
  try {
    decoded = await tmp.decodeAudioData(await data.arrayBuffer());
  } catch {
    throw new Error("This audio format can't be read by your browser. Try WAV, MP3 or M4A.");
  } finally {
    void tmp.close();
  }
  if (decoded.duration > MAX_SECONDS + 1) throw new Error("Recordings can be up to 10 minutes long.");
  const length = Math.ceil(decoded.duration * TARGET_SR);
  const off = new OfflineAudioContext(1, length, TARGET_SR);
  const src = off.createBufferSource();
  src.buffer = decoded;
  src.connect(off.destination); // channels are down-mixed to mono by the destination
  src.start();
  const rendered = await off.startRendering();
  return { wav: encodeWav(rendered.getChannelData(0), TARGET_SR), seconds: decoded.duration };
}

export class PracticeRecorder {
  private rec: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private stopTimer: number | null = null;
  startedAt = 0;

  async start(onAutoStop: () => void) {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true } });
    this.chunks = [];
    this.rec = new MediaRecorder(this.stream);
    this.rec.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
    this.rec.start(1000);
    this.startedAt = performance.now();
    this.stopTimer = window.setTimeout(onAutoStop, MAX_SECONDS * 1000);
  }

  async stop(): Promise<{ wav: Blob; seconds: number }> {
    if (this.stopTimer) clearTimeout(this.stopTimer);
    const rec = this.rec;
    if (!rec) throw new Error("Not recording");
    const stopped = new Promise<void>((r) => (rec.onstop = () => r()));
    rec.stop();
    await stopped;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.rec = null;
    return toWav16k(new Blob(this.chunks, { type: rec.mimeType }));
  }

  cancel() {
    if (this.stopTimer) clearTimeout(this.stopTimer);
    try { this.rec?.stop(); } catch { /* already stopped */ }
    this.stream?.getTracks().forEach((t) => t.stop());
    this.rec = null;
  }
}
