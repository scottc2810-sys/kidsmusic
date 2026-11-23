// Text-to-speech (Web Speech API) and optional speech-to-text for talking to Melo.
import { voiceFor, type Emotion } from "../emotion";
import { langInfo, type Language } from "../languages";
import { onMouth, pulseMouth } from "./mouth";

export { onMouth };

let voiceEnabled = true;
export const setVoiceEnabled = (v: boolean) => { voiceEnabled = v; if (!v) window.speechSynthesis?.cancel(); };
export const isVoiceEnabled = () => voiceEnabled;

const norm = (l: string) => l.replace("_", "-").toLowerCase();

/** The teacher of the subject on screen (persona chosen by the parent): voice, speed and pitch. */
export interface TeacherVoice { voice?: string | null; rate?: number; pitch?: number }
let teacherVoice: TeacherVoice | null = null;
export const setTeacherVoice = (v: TeacherVoice | null) => { teacherVoice = v; };
export const getTeacherVoice = () => teacherVoice;
const voiceKey = (lang: Language) => `melo.voice.${lang}`;

function scoreVoice(v: SpeechSynthesisVoice, lang: Language): number {
  const l = norm(v.lang);
  const info = langInfo(lang);
  const langRank = info.voices.findIndex((c) => l.startsWith(c.toLowerCase()));
  if (langRank < 0) return -1;
  let s = 100 - langRank * 30;
  const pref = info.prefer.findIndex((re) => re.test(v.name));
  if (pref >= 0) s += 40 - pref * 4;
  if (/natural|neural|online/i.test(v.name)) s += 35; // neural voices: far less robotic
  if (/google/i.test(v.name)) s += 15;
  return s;
}

/** Voices that suit this language, best first (for the parent's voice picker). */
export function voicesFor(lang: Language): SpeechSynthesisVoice[] {
  const voices = window.speechSynthesis?.getVoices() ?? [];
  return voices.map((v) => [v, scoreVoice(v, lang)] as const).filter(([, s]) => s >= 0).sort((a, b) => b[1] - a[1]).map(([v]) => v);
}

export function chosenVoiceName(lang: Language): string | null {
  try { return localStorage.getItem(voiceKey(lang)); } catch { return null; }
}
/** Per device: installed voices differ between computers, so this lives in this browser only. */
export function chooseVoice(lang: Language, name: string | null) {
  try { if (name) localStorage.setItem(voiceKey(lang), name); else localStorage.removeItem(voiceKey(lang)); } catch { /* private mode */ }
}

function pickVoice(lang: Language): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis?.getVoices() ?? [];
  const chosen = chosenVoiceName(lang);
  // the subject teacher's voice, when it is installed on this device and speaks this language
  const teacher = teacherVoice?.voice ? voices.find((v) => v.name === teacherVoice!.voice && scoreVoice(v, lang) >= 0) : undefined;
  const picked = teacher || (chosen && voices.find((v) => v.name === chosen)) || voicesFor(lang)[0];
  // No voice for this language (e.g. no Hindi voice installed): use the default voice rather than staying silent.
  return picked ?? voices.find((x) => x.default) ?? voices[0];
}

const stripForSpeech = (t: string) => t.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "").replace(/\s+/g, " ").trim();

/** Split into sentences so Melo pauses naturally and each sentence gets its own melody. */
export function sentences(text: string): string[] {
  return (stripForSpeech(text).match(/[^.!?।]+[.!?।]*/g) ?? []).map((s) => s.trim()).filter(Boolean);
}

/**
 * Expressive delivery: questions rise, exclamations are brighter, instructions are calm and clear.
 * An emotion (from the server: excited, empathetic ...) shifts speed, pitch and loudness the way a real
 * voice does, strongest on the first sentence. `jitter` adds a tiny natural variation, so the same line
 * never sounds identical twice.
 */
export function prosody(s: string, natural: boolean, emotion?: Emotion, index = 0, jitter = 0): { rate: number; pitch: number; volume: number } {
  const base = natural ? { rate: 0.95, pitch: 1.05 } : { rate: 0.9, pitch: 1.12 }; // neural voices need less push
  const e = voiceFor(emotion, index);
  let rate = base.rate + e.rate;
  let pitch = base.pitch + e.pitch + jitter;
  if (/[!]$/.test(s)) { rate += 0.04; pitch += 0.08; }
  else if (/[?]$/.test(s)) pitch += 0.05;
  const clamp = (x: number, lo: number, hi: number) => Math.round(Math.min(hi, Math.max(lo, x)) * 1000) / 1000;
  return { rate: clamp(rate, 0.6, 1.3), pitch: clamp(pitch, 0.7, 1.5), volume: clamp(e.volume, 0.5, 1) };
}

const pulse = pulseMouth;

// Speech engines mangle note names: an English voice spells "Ga" as "G, A" and reads "Pa" as an
// abbreviation; a Hindi voice clips the lone letter ग. Teachers say swars open and long, so we
// hand the voice a spelling it pronounces properly. Only the spoken text changes, never the bubble.
const SWAR_EN: Record<string, string> = { Sa: "Saa", Re: "Ray", Ga: "Gaa", Ma: "Maa", Pa: "Paa", Dha: "Dhaa", Ni: "Nee" };
const SWAR_HI: Record<string, string> = { Sa: "सा", Re: "रे", Ga: "गा", Ma: "मा", Pa: "पा", Dha: "धा", Ni: "नी" };
const DEV_LONG: Record<string, string> = { "ग": "गा", "म": "मा", "प": "पा", "ध": "धा", "नि": "नी", "सां": "ऊपर का सा", "रें": "ऊपर का रे", "गं": "ऊपर का गा" };

export function pronounce(text: string, voiceLang: string): string {
  const hindiVoice = voiceLang.toLowerCase().startsWith("hi");
  let t = text.replace(/(^|[^A-Za-z])\.?(Sa|Re|Ga|Ma|Pa|Dha|Ni)['’]?(?![A-Za-z])/g,
    (_m, pre: string, sw: string) => pre + (hindiVoice ? SWAR_HI : SWAR_EN)[sw]);
  if (hindiVoice) {
    t = t.replace(/(^|[\s,.:;!?।(])\.?(सां|रें|गं|नि|ग|म|प|ध)(?=$|[\s,.:;!?।)])/g, (_m, pre: string, sw: string) => pre + DEV_LONG[sw]);
  }
  return t.replace(/[♭♯]/g, "");
}

/** Chrome loads voices asynchronously; wait briefly for them on the first utterance. */
function voicesReady(synth: SpeechSynthesis): Promise<void> {
  if (synth.getVoices().length) return Promise.resolve();
  return new Promise((resolve) => {
    const t = window.setTimeout(resolve, 1000);
    synth.addEventListener("voiceschanged", () => { clearTimeout(t); resolve(); }, { once: true });
  });
}

// Chrome garbage-collects in-flight utterances (onend never fires, speech cuts off): keep a reference.
let current: SpeechSynthesisUtterance | null = null;
let primed = false;

/**
 * Call inside a tap/click handler. Browsers only allow speech that starts from a user gesture;
 * speaking an empty utterance during the gesture unlocks later speech (e.g. after a slow AI reply).
 */
export function primeSpeech(): void {
  const synth = window.speechSynthesis;
  if (primed || !synth) return;
  primed = true;
  try { const u = new SpeechSynthesisUtterance(" "); u.volume = 0; synth.speak(u); } catch { /* ignore */ }
}

let talking = 0; // speak() calls in progress (covers the pauses between sentences)
let generation = 0; // bumps on every new speak()/stop, so a cancelled speech stops between sentences

function sayOne(synth: SpeechSynthesis, text: string, lang: Language, v: SpeechSynthesisVoice | undefined, emotion?: Emotion, index = 0): Promise<void> {
  return new Promise((resolve) => {
    const voiceLang = v?.lang ?? langInfo(lang).voices[0];
    const u = new SpeechSynthesisUtterance(pronounce(text, voiceLang));
    if (v) u.voice = v;
    u.lang = voiceLang;
    const p = prosody(text, !!v && /natural|neural|online|google/i.test(v.name), emotion, index, (Math.random() - 0.5) * 0.04);
    u.rate = Math.min(1.6, Math.max(0.5, p.rate * (teacherVoice?.rate ?? 1)));
    u.pitch = Math.min(2, Math.max(0.3, p.pitch * (teacherVoice?.pitch ?? 1)));
    u.volume = p.volume;
    current = u;
    let gotBoundary = false;
    // Voices without word events still get a believable mouth: a gentle chatter while speaking.
    const chatter = window.setInterval(() => { if (!gotBoundary) pulse(0.35 + Math.random() * 0.5); }, 140);
    const done = () => { clearTimeout(timer); clearInterval(chatter); pulse(0); if (current === u) current = null; resolve(); };
    const timer = window.setTimeout(done, 2500 + text.length * 95);
    u.onboundary = (e) => { if (e.name === "word" || e.name === undefined) { gotBoundary = true; pulse(0.6 + Math.random() * 0.4); } };
    u.onend = done;
    u.onerror = (e) => {
      if (e.error !== "interrupted" && e.error !== "canceled") console.warn("[Melo] speech error:", e.error);
      done();
    };
    synth.speak(u);
  });
}

/** Speak sentence by sentence (natural pauses, expressive pitch, optional emotion); resolves when finished. */
export async function speak(text: string, lang: Language, emotion?: Emotion): Promise<void> {
  const synth = window.speechSynthesis;
  if (!voiceEnabled || !synth || !text) return;
  const gen = ++generation;
  await voicesReady(synth);
  if (synth.speaking || synth.pending) {
    synth.cancel();
    await new Promise((r) => setTimeout(r, 60)); // Chrome drops an utterance queued right after cancel()
  }
  synth.resume(); // Chrome can get stuck "paused" after the tab was in the background
  const v = pickVoice(lang);
  const parts = sentences(text);
  talking++;
  try {
    for (let i = 0; i < parts.length; i++) {
      if (gen !== generation) return;
      await sayOne(synth, parts[i], lang, v, emotion, i);
      // breath between sentences: a gentle teacher pauses longer, an excited one rushes on
      if (i < parts.length - 1) await new Promise((r) => setTimeout(r, emotion === "empathetic" || emotion === "calm" ? 320 : emotion === "celebrate" || emotion === "excited" ? 120 : 180));
    }
  } finally { talking--; }
}

/** Preview a voice in the parent's voice picker. */
export async function previewVoice(lang: Language, name: string, text: string): Promise<void> {
  const prev = chosenVoiceName(lang);
  chooseVoice(lang, name);
  try { await speak(text, lang); } finally { chooseVoice(lang, prev); }
}

export const speechInfo = () => ({
  supported: typeof window !== "undefined" && !!window.speechSynthesis,
  voices: typeof window !== "undefined" ? (window.speechSynthesis?.getVoices().length ?? 0) : 0,
});

export const stopSpeaking = () => { generation++; window.speechSynthesis?.cancel(); pulse(0); };

// Pre-load voices (Chrome loads them asynchronously).
if (typeof window !== "undefined" && window.speechSynthesis) {
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
}

export function speechRecognitionAvailable(): boolean {
  return typeof window !== "undefined" && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
}

/** One-shot speech recognition. Only call when the parent has allowed the microphone. */
export function listenOnce(lang: Language): Promise<string> {
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SR) return Promise.reject(new Error("Speech recognition not supported"));
  return new Promise((resolve, reject) => {
    const r = new SR();
    r.lang = langInfo(lang).listen;
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.onresult = (e: any) => resolve(String(e.results[0][0].transcript || ""));
    r.onerror = (e: any) => reject(new Error(e.error || "speech error"));
    r.onend = () => resolve("");
    r.start();
  });
}

// True during the short pauses between sentences too, so the mic never mistakes Melo's voice for the child.
export const isSpeaking = () => talking > 0 || (typeof window !== "undefined" && !!window.speechSynthesis?.speaking);

// --- Speaking and listening in the language a child is learning (any locale, not only the app's languages) ---
function voiceForLocale(locale: string): SpeechSynthesisVoice | undefined {
  const voices = typeof window !== "undefined" ? window.speechSynthesis?.getVoices() ?? [] : [];
  const want = norm(locale);
  const primary = want.split("-")[0];
  // Cantonese (zh-HK) must not be read by a Mandarin voice: for Chinese only the exact region counts.
  const fits = (v: SpeechSynthesisVoice) => {
    const l = norm(v.lang);
    return l === want || (want === "zh-hk" ? l.startsWith("yue") : primary !== "zh" && l.split("-")[0] === primary);
  };
  const rank = (v: SpeechSynthesisVoice) => (norm(v.lang) === want ? 2 : 0) + (/natural|neural|online|google/i.test(v.name) ? 1 : 0);
  return voices.filter(fits).sort((a, b) => rank(b) - rank(a))[0];
}

export const hasVoiceFor = (locale: string) => !!voiceForLocale(locale);

/** Say a word or sentence in `locale`, a little slower than normal speech so a learner can catch it. */
export async function sayIn(text: string, locale: string, rate = 0.85): Promise<boolean> {
  const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
  if (!voiceEnabled || !synth || !text) return false;
  const gen = ++generation;
  await voicesReady(synth);
  const v = voiceForLocale(locale);
  if (!v || gen !== generation) return false;
  if (synth.speaking || synth.pending) { synth.cancel(); await new Promise((r) => setTimeout(r, 60)); }
  synth.resume();
  talking++;
  try {
    await new Promise<void>((resolve) => {
      const u = new SpeechSynthesisUtterance(text);
      u.voice = v; u.lang = v.lang; u.rate = rate; u.pitch = 1.05;
      current = u;
      const chatter = window.setInterval(() => pulse(0.4 + Math.random() * 0.5), 150);
      const done = () => { clearTimeout(timer); clearInterval(chatter); pulse(0); if (current === u) current = null; resolve(); };
      const timer = window.setTimeout(done, 3000 + text.length * 220);
      u.onend = done; u.onerror = done;
      synth.speak(u);
    });
  } finally { talking--; }
  return true;
}

/** Listen once in `locale` and return what the recogniser thinks it heard (best guesses first). */
export function listenIn(locale: string, maxMs = 8000): Promise<string[]> {
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SR) return Promise.reject(new Error("Speech recognition not supported"));
  return new Promise((resolve, reject) => {
    const r = new SR();
    r.lang = locale; r.interimResults = false; r.maxAlternatives = 5;
    let settled = false;
    const finish = (out: string[]) => { if (!settled) { settled = true; clearTimeout(timer); resolve(out); } };
    const timer = window.setTimeout(() => { try { r.stop(); } catch { /* already stopped */ } finish([]); }, maxMs);
    r.onresult = (e: any) => finish(Array.from(e.results[0] as ArrayLike<{ transcript: string }>).map((a) => String(a.transcript || "")).filter(Boolean));
    r.onerror = (e: any) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") { settled = true; clearTimeout(timer); reject(new Error(e.error)); }
      else finish([]); // no-speech, network...: nothing heard
    };
    r.onend = () => finish([]);
    r.start();
  });
}
