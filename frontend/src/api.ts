// Typed API client. Auth is an httpOnly cookie; every request carries the CSRF header.

import type { Language } from "./languages";
export type { Language };
export type Mode = "screen" | "real" | "listening" | "practice";
export type Avatar = "owl" | "cat" | "elephant" | "bird" | "fish" | "lion";

export interface Parent { id: string; email: string }

export interface Child {
  id: string; name: string; age: number; avatar: Avatar; language: Language; instrument: string; mode: Mode;
  session_minutes: number; reminder_time: string | null; reminder_days: number[];
  consent_camera: boolean; consent_microphone: boolean; consent_recording: boolean; cloud_ai_allowed: boolean;
  current_level: number; created_at: string;
}

export interface SkillInfo { mastery: number; difficulty: number; attempts: number }
export interface SessionRow {
  id: string; started_at: string; ended_at: string | null; mode: Mode; level: number; activities: number; successes: number;
  stars: number; end_reason: string | null; focus: string | null; summary: Record<string, unknown>;
}
export interface Progress {
  level: number; level_name: string; core_skills: string[]; skills: Record<string, SkillInfo>;
  activity_stats: Record<string, Record<string, number>>; songs_learned: string[]; recent_minutes: number; sessions: SessionRow[];
}

export interface StartSession {
  session_id: string; mode: Mode; level: number; level_name: string; minutes: number; greeting: string; theme_line: string;
  plan: { focus_skill: string | null; theme: string; source: string };
  ears: boolean; // Melo is listening to the child's real instrument through the microphone
}

export type ActivityType = "high_low" | "loud_soft" | "instrument_guess" | "rhythm_tap" | "find_note" | "same_different" | "echo_melody" | "play_song" | "free_play" | "fast_slow";

export interface NextActivity {
  done: false; attempt_id: string; type: ActivityType; skill: string; difficulty: number; level: number;
  spec: Record<string, any>; say: string; new_activity: boolean; input: "notes" | "taps" | "choice";
  retry?: boolean; // the same item again after a miss, with more help
  stretch?: boolean; // one item from the next level, offered after a run of successes
}
export interface SessionDone { done: true; reason: string; message: string; stars: number; summary: Record<string, unknown> }

export interface AnswerResult {
  outcome: "success" | "partial" | "miss" | "uncertain" | "skipped"; score: number; say: string; events: string[];
  stars_earned: number; stars: number; level: number; reveal: { correct?: number; melody?: number[] }; time_up: boolean;
}

export interface NoteEvent { midi: number; t: number; conf: number; camera_agrees?: boolean | null }

export interface Recording {
  id: string; title: string; song_hint: string | null; duration_seconds: number; status: "pending" | "analyzed" | "failed";
  error: string | null; analysis: Record<string, any>; feedback: Record<string, any>; created_at: string;
}

export interface TokenRow { id: string; name: string; prefix: string; allow_write: boolean; created_at: string; last_used_at: string | null }
export interface NewToken { id: string; token: string; prefix: string; allow_write: boolean; commands: Record<"http" | "stdio" | "verify" | "try", string> }
export interface GraphNode { id: string; kind: string; label: string; [k: string]: unknown }
export interface GraphEdge { src: string; rel: string; dst: string; weight: number; [k: string]: unknown }
export interface MemoryEvent { at: string; kind: string; summary: string; node: string | null }
export interface MemoryOverview {
  child: { id: string; name: string; level: number; level_name: string };
  skills: Record<string, SkillInfo>;
  strengths: { node: string; label: string; score: number }[];
  struggles: { node: string; kind: string; label: string; weight: number }[];
  songs: { learned: string[]; learning: string[] };
  activities: { activity: string; times: number; [k: string]: unknown }[];
  parent_notes: string[];
  focus_override: string | null;
  recent: MemoryEvent[];
  recommendation: { focus_skill: string | null; suggestions: string[]; unlock_needs: Record<string, { mastery_target: number; attempts_left: number }> };
  graph: { nodes: number; edges: number; events: number };
}

export type LearnSkill = "listen" | "speak" | "read" | "write";
export interface LearnStatus {
  language: { code: string; name: string; native: string; flag: string; rtl: boolean; locale: string; latin: boolean };
  skills: Record<LearnSkill, { stage: number; stage_name: string; mastery: number; attempts: number }>;
  stage: number; stage_name: string; next_stage: number; words_known: number; words_total: number; tier: number; focus: LearnSkill; started: boolean;
  phrases_known: number; phrases_total: number;
  topics: { id: string; emoji: string; title: string; known: number; total: number }[];
  /** Indian script: letters are also practised with every vowel sign (barakhadi). */
  barakhadi?: boolean;
  /** From first sounds to little conversations: what each stage teaches, and a tip for home. */
  journey?: JourneyStep[];
}
export interface JourneyStep {
  stage: number; emoji: string; title: string; listen: string; read: string; write: string; speak: string; home: string; reached: boolean; current: boolean;
}
export interface LearnLanguage { code: string; name: string; native: string; flag: string; rtl: boolean; locale: string; words: number }
export interface CompareData {
  topic: string;
  topics: { id: string; emoji: string; title: string }[];
  languages: { code: string; name: string; native: string; flag: string; locale: string; rtl: boolean; latin?: boolean }[];
  rows: { id: string; emoji: string; meaning: string; english: string; cells: Record<string, { text: string; roman: string | null }> }[];
}
export interface LearnActivity {
  attempt_id: string; type: "listen_pick" | "read_pick" | "letter_sound" | "say_word" | "trace" | "spell" | "reply_pick"; skill: LearnSkill; difficulty: number;
  spec: Record<string, any>; say: string; retry: boolean; comfort: boolean; emotion?: string;
  /** Recordings of this word by native speakers (female / male), with attribution; a neural voice when none exist. */
  native?: NativeRef[];
  /** The same for a conversation question (Melo asks it). */
  native_question?: NativeRef[];
}
export interface NativeRef { url: string; gender: string; speaker: string | null; license: string | null; source: string | null; family: boolean; origin?: string; approx?: string | null }
export interface NativeCoverage {
  languages: Record<string, { items: number; of: number; files: number; female: number; male: number; family: number;
    missing: { item: string; text: string; roman: string | null; emoji: string }[] }>;
  download: { running: boolean; done: Record<string, Record<string, unknown>>; error: string | null }; source: string;
}
export interface LearnAnswer {
  outcome: "success" | "partial" | "miss" | "uncertain" | "skipped"; score: number; say: string; events: string[]; star: boolean;
  reveal: { correct: number | null; word: string | null; roman: string | null; emoji: string | null; heard?: string | null;
    pronunciation?: number | null; native?: NativeRef[]; why?: string | null }; status: LearnStatus;
  /** How Melo feels about it (see emotion.ts), how big the reaction is (1-5), a small sound, and the streak so far. */
  emotion?: string; energy?: number; sfx?: "sparkle" | "tada" | "clap" | "oops" | "pop" | null; streak?: number;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("X-Requested-With", "melo");
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
  let res: Response;
  try {
    res = await fetch(path, { ...init, headers, credentials: "same-origin" });
  } catch {
    throw new ApiError(0, "Can't reach the Melo server. Is it running?");
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const d = (data as any).detail;
    const msg = typeof d === "string" ? d : Array.isArray(d) ? d.map((e: any) => e.msg).join("; ") : `Request failed (${res.status})`;
    throw new ApiError(res.status, msg);
  }
  return data as T;
}

const json = (body: unknown) => JSON.stringify(body);

export type { InstrumentInfo } from "./teaching/instrument";
import type { Prefs } from "./teaching/persona";
export type { Prefs } from "./teaching/persona";
export type SubjectName = "maths" | "science" | "vedas" | "finance";
export interface TopicProgress { difficulty: number; rounds: number; attempts: number; correct: number; stars: number }
import type { InstrumentInfo } from "./teaching/instrument";
export interface InstrumentKind { id: string; label: string; emoji: string; layout: string; keys: number; first: string; stand_in: boolean }
export interface InstrumentForm {
  kind: string; name: string; keys: number | null; first_key: string; labels: string;
  features: { mic?: boolean; record?: boolean; lights?: boolean; demo_songs?: string[]; teach_mode?: boolean };
  sources: string[]; notes: string; summary: string; tips: string[];
}
export interface InstrumentAnalysis {
  suggestion: { kind: string; name: string; keys: number; first_key: string; labels: string; mic: boolean; record: boolean; lights: boolean;
    demo_songs: string[]; summary: string; tips: string[]; confidence: "low" | "medium" | "high" };
  used_ai: boolean; message: string; sources: { url: string; title: string; found: boolean; reason: string }[];
}

export interface BrainTest { ok: boolean; provider: string; model: string | null; latency_ms: number; reply: string | null; message: string }
export interface TrackerAxis {
  id: string; label: string; emoji: string; skill: string | null; measured: number | null; n: number; evidence: "limited" | "good" | null;
  assessed: { score: number; source: string; confidence: number; note: string; at: string; stale: boolean; id: number } | null;
  final: number | null; band: string | null; source: string; before: number | null; trend: number | null;
}
export interface TrackerArea {
  id: string; title: string; emoji: string; axes: TrackerAxis[]; strengths: string[]; developing: string[]; not_assessed: string[];
  score: number | null; facts?: Record<string, number>;
  /** learned / used in real life / remembered (0-100), and the weighted score */
  learned?: number | null; applied?: number | null; remembered?: number | null;
}
export interface TrackerOverall {
  score: number | null; learned: number | null; applied: number | null; remembered: number | null; weights: Record<string, number>;
  areas: { id: string; title: string; emoji: string; score: number | null; learned: number | null; applied: number | null; remembered: number | null }[];
}
export interface TrackerParam { group: string; name: string; definition: string; measure: string | null; score: number | null; n: number; band: string | null; info: string | null; how: string }
export interface TrackerAssessment {
  id: number; source: string; area: string; axis: string; score: number | null; band: string | null; confidence: number; note: string; status: string; at: string;
  quality: Record<string, string | number | null | string[]>;
}
export interface Tracker {
  weights: { measured: number; assessed: number }; bands: { max: number; label: string }[]; areas: TrackerArea[]; overall?: TrackerOverall;
  quality: { rushed_excluded: number; disengaged_excluded: number; events: number }; updated_at: string; compared_with: string | null;
  recommendations: { area: string; axis: string; skill: string | null; priority: number; reason: string }[];
  limitations: string[]; parameters?: TrackerParam[]; coverage?: { total: number; measured: number; with_evidence: number }; assessments?: TrackerAssessment[];
  lenses?: { id: string; title: string }[];
  lens_view?: { lens: string; title: string; axes: TrackerAxis[]; parameters: TrackerParam[]; score: number | null; developing: string[]; strengths: string[] } | null;
}
export interface TeacherPlan {
  source: "ai" | "offline"; summary: string; understands: string[]; working_on: string[];
  next_activities: { activity: string; why: string; minutes: number }[]; home_tip: string;
}
export interface ParentAction { id: string; type: string; label: string; params: Record<string, unknown> }
export interface ParentPlan {
  goals: { text: string; skill: string | null; at: string }[]; tactics: { id: string; text: string; at: string }[]; focus: string | null; minutes: number;
  custom_topics: { id: string; title: string; emoji: string; phrases: number }[]; custom_songs: { id: string; title: string }[];
  history: { from: "user" | "melo"; text: string; at: string | null }[]; summary: string;
}
export type BrainKind = "auto" | "claude_code" | "ollama" | "openai" | "offline";
export interface BrainChoice { provider: BrainKind; ollama_url?: string; ollama_model?: string; llm_base_url?: string; llm_model?: string; llm_api_key?: string }
export interface BrainsFound {
  current: { provider: string; model: string | null; configured: string; endpoint: string | null; local: boolean; claude_code_found: boolean };
  saved: Partial<BrainChoice> & { has_api_key: boolean };
  claude_code: { found: boolean; offered?: boolean }; // offered = false in the retail edition (families' copies)
  ollama: { running: boolean; url: string; models: string[]; suggested: string | null };
  local_servers: { name: string; base_url: string; models: string[] }[];
  online: { id: string; name: string; base_url: string; model: string }[];
}
export type SongTag = "celebration" | "indian" | "nursery" | "alankar" | "claude";
export interface SongProgress { phrases_learned: number[]; completed: boolean; plays: number }
export interface SongCard { id: string; title: string; tag: SongTag; ease: number; phrase_count: number; progress: SongProgress }
export interface Song {
  id: string; title: string; tag: SongTag; ease: number; bpm: number; note: string | null; source?: string;
  notes: number[]; beats: number[]; phrases: number[]; words: string[] | null;
}
export type SupportLevel = "full" | "guided" | "light" | "memory";
export interface SongStart { session_id: string; song: Song; progress: SongProgress; start_phrase: number; say: string; support: Record<string, SupportLevel> }
export interface SongPhraseResult {
  outcome: "success" | "partial" | "miss" | "uncertain" | "skipped"; score: number; passed: boolean;
  stars_earned: number; stars: number; level: number; events: string[]; say: string; hint_index: number | null;
  support: Record<string, SupportLevel>;
  tip: string | null; // what Melo noticed about how it was played (hesitation, steady, hold_long ...)
  drill: { start: number; end: number; say: string } | null; // notes of the part to practise on their own
  stats: { matched?: number; notes?: number; pace?: number; evenness?: number };
}
export interface CameraSummary { frames: number; seen: number; flat: number; one_finger: number }
export interface Chapter {
  id: string; level: number; title: string; icon: string; kind: "topic" | "song" | "compose" | "lesson"; target: string;
  status: "done" | "current" | "upcoming"; song_title: string | null;
}
export interface LearningPath { level: number; level_name: string; current: string | null; done: number; total: number; chapters: Chapter[]; skills_to_show: string[] }

export interface TopicTier { tier: number; skill: string; mastery: number; attempts: number; next: { tier: number; mastery: number; attempts: number } | null }
export interface MadeExercise { song_id: string; title: string; topic: string; tier: number; source: string; intro: string | null; notes: number; completed: boolean; reused?: boolean }
export interface BasicsStatus { tiers: Record<string, TopicTier>; exercises: MadeExercise[]; brain: string }

export const api = {
  me: () => request<Parent>("/api/auth/me"),
  register: (email: string, password: string, agree: boolean) => request<Parent>("/api/auth/register", { method: "POST", body: json({ email, password, agree }) }),
  login: (email: string, password: string) => request<Parent>("/api/auth/login", { method: "POST", body: json({ email, password }) }),
  logout: () => request<void>("/api/auth/logout", { method: "POST" }),
  deleteAccount: () => request<void>("/api/auth/account", { method: "DELETE" }),
  teacherStatus: () => request<{ provider: string; model: string | null; configured: string; claude_code_found: boolean }>("/api/teacher/status"),
  teacherTest: () => request<BrainTest>("/api/teacher/test", { method: "POST" }),
  brains: () => request<BrainsFound>("/api/teacher/brains"),
  /** Recordings of one word: native speakers, or a neural voice when there are none yet. */
  nativeRefs: (lang: string, item: string) => request<NativeRef[]>(`/api/learn/native/${encodeURIComponent(lang)}/${encodeURIComponent(item)}`),
  // The child's own instrument (parent's form, photos and shop links); none = the standard lessons
  instrument: (childId: string) => request<InstrumentInfo>(`/api/children/${childId}/instrument`),
  instrumentKinds: () => request<{ kinds: InstrumentKind[]; labels: string[] }>("/api/instrument-kinds"),
  saveInstrument: (childId: string, body: InstrumentForm) =>
    request<InstrumentInfo>(`/api/children/${childId}/instrument`, { method: "PUT", body: json(body) }),
  resetInstrument: (childId: string) => request<void>(`/api/children/${childId}/instrument`, { method: "DELETE" }),
  addInstrumentPhoto: (childId: string, file: File) => {
    const fd = new FormData(); fd.append("file", file);
    return request<InstrumentInfo>(`/api/children/${childId}/instrument/photos`, { method: "POST", body: fd });
  },
  deleteInstrumentPhoto: (childId: string, photoId: string) =>
    request<InstrumentInfo>(`/api/children/${childId}/instrument/photos/${photoId}`, { method: "DELETE" }),
  analyzeInstrument: (childId: string) => request<InstrumentAnalysis>(`/api/children/${childId}/instrument/analyze`, { method: "POST" }),
  /** Photos / links / notes of the family's own material become a personal language topic (needs the AI brain). */
  learnMaterial: (childId: string, files: File[], urls: string, notes: string, langs: string[], title: string) => {
    const fd = new FormData();
    files.forEach((f) => fd.append("files", f));
    fd.append("urls", urls); fd.append("notes", notes); fd.append("langs", langs.join(",")); fd.append("title", title);
    return request<{ ok: boolean; message: string; link: string; phrases: string[]; title: string }>(`/api/children/${childId}/learn/material`, { method: "POST", body: fd });
  },
  // Maths & science (classes 1-5) and the teacher persona per subject
  prefs: (childId: string) => request<Prefs>(`/api/children/${childId}/prefs`),
  savePrefs: (childId: string, body: { grade: number | null; teachers: Prefs["teachers"] }) =>
    request<Prefs>(`/api/children/${childId}/prefs`, { method: "PUT", body: json(body) }),
  subjectProgress: (childId: string, subject: SubjectName) =>
    request<{ prefs: Prefs; topics: Record<string, TopicProgress> }>(`/api/children/${childId}/subjects/${subject}`),
  subjectRound: (childId: string, subject: SubjectName, topic: string, body: { correct: number; total: number; difficulty: number; strand?: string; apply_correct?: number; apply_total?: number; title?: string; examples?: string[]; taught?: number; revision?: boolean }) =>
    request<TopicProgress & { earned: number; level_change: number; mastered?: boolean; challenge_started?: boolean }>(`/api/children/${childId}/subjects/${subject}/${topic}/round`, { method: "POST", body: json(body) }),
  subjectChallenges: (childId: string, subject: SubjectName, topic: string) =>
    request<{ levels: { level: number; items: unknown[] }[]; growing: boolean }>(`/api/children/${childId}/subjects/${subject}/${topic}/challenges`),
  nativeCoverage: () => request<NativeCoverage>("/api/learn/native-coverage"),
  /** Ask Melo for the next, harder challenge pack of sentences in a language (found on Tatoeba / written by the AI). */
  learnGrow: (childId: string, lang: string) => request<{ started: boolean; message: string }>(`/api/children/${childId}/learn/${lang}/grow`, { method: "POST" }),
  nativeDownload: (langs: string[]) => request<{ started: boolean; message: string }>("/api/learn/native-download", { method: "POST", body: json({ langs }) }),
  /** The child's spoken word, compared with native speakers (only the score is kept). */
  learnVoice: (childId: string, attemptId: string, wav: Blob) => {
    const fd = new FormData(); fd.append("file", wav, "voice.wav");
    return request<{ score: number | null; reason?: string; references?: number }>(`/api/children/${childId}/learn/attempts/${attemptId}/voice`, { method: "POST", body: fd });
  },
  recordNative: (childId: string, lang: string, item: string, wav: Blob, gender: "female" | "male", speaker: string) => {
    const fd = new FormData(); fd.append("file", wav, "word.wav"); fd.append("gender", gender); fd.append("speaker", speaker);
    return request<{ saved: boolean; refs: NativeRef[] }>(`/api/children/${childId}/learn/${lang}/native/${item}`, { method: "POST", body: fd });
  },
  parentPlan: (childId: string) => request<ParentPlan>(`/api/children/${childId}/parent-plan`),
  parentChat: (childId: string, message: string, history: { from: string; text: string }[]) =>
    request<{ reply: string; actions: ParentAction[]; source: "ai" | "offline" }>(`/api/children/${childId}/parent-chat`, { method: "POST", body: json({ message, history }) }),
  parentApply: (childId: string, action: ParentAction) =>
    request<{ ok: boolean; message: string; link?: string; plan: Partial<ParentPlan> }>(`/api/children/${childId}/parent-chat/apply`, { method: "POST", body: json({ action }) }),
  parentPlanRemove: (childId: string, kind: "goals" | "tactics", index: number) =>
    request<Partial<ParentPlan>>(`/api/children/${childId}/parent-plan/${kind}/${index}`, { method: "DELETE" }),
  tracker: (childId: string, lens?: string | null) => request<Tracker>(`/api/children/${childId}/tracker${lens ? `?lens=${encodeURIComponent(lens)}` : ""}`),
  trackerSummary: (childId: string, lens?: string | null) =>
    request<TeacherPlan>(`/api/children/${childId}/tracker/summary`, { method: "POST", body: json({ lens: lens ?? null }) }),
  trackerHistory: (childId: string, area: string) =>
    request<{ day: string; score: number | null; axes: Record<string, number | null> }[]>(`/api/children/${childId}/tracker/history?area=${encodeURIComponent(area)}`),
  assessNow: (childId: string) => request<{ started: boolean; message: string }>(`/api/children/${childId}/tracker/assess`, { method: "POST" }),
  addAssessment: (childId: string, body: { area: string; axis: string; score?: number | null; note: string; source: "parent" | "teacher" }) =>
    request<TrackerAssessment>(`/api/children/${childId}/assessments`, { method: "POST", body: json(body) }),
  setAssessmentStatus: (childId: string, id: number, status: "active" | "rejected") =>
    request<TrackerAssessment>(`/api/children/${childId}/assessments/${id}`, { method: "PATCH", body: json({ status }) }),
  feeling: (childId: string, feeling: "great" | "ok" | "hard", area = "overall") =>
    request<{ saved: boolean }>(`/api/children/${childId}/feeling`, { method: "POST", body: json({ feeling, area }) }),
  /** Leaving a language lesson: saves the tracker even while the page is closing (keepalive). */
  learnEnd: (childId: string, lang: string) => fetch(`/api/children/${childId}/learn/${lang}/end`,
    { method: "POST", keepalive: true, credentials: "same-origin", headers: { "X-Requested-With": "melo" } }).catch(() => undefined),
  setBrain: (body: BrainChoice) => request<BrainTest>("/api/teacher/brain", { method: "PUT", body: json(body) }),

  basics: (childId: string) => request<BasicsStatus>(`/api/children/${childId}/basics`),
  newExercise: (childId: string, topic: string, force = false) =>
    request<MadeExercise>(`/api/children/${childId}/basics/${topic}/exercise`, { method: "POST", body: json({ force }) }),
  songs: (childId: string) => request<SongCard[]>(`/api/children/${childId}/songs`),
  startSong: (childId: string, songId: string) => request<SongStart>(`/api/children/${childId}/songs/${songId}/start`, { method: "POST" }),
  path: (childId: string) => request<LearningPath>(`/api/children/${childId}/path`),
  songPhrase: (sid: string, phrase: number, response: { source: "screen" | "mic"; notes: NoteEvent[]; keep_beat?: boolean; camera?: CameraSummary | null }) =>
    request<SongPhraseResult>(`/api/sessions/${sid}/song-phrase`, { method: "POST", body: json({ phrase, response }) }),

  learnOverview: (childId: string) => request<LearnStatus[]>(`/api/children/${childId}/learn`),
  learnStatus: (childId: string, lang: string) => request<LearnStatus>(`/api/children/${childId}/learn/${lang}`),
  learnLanguages: () => request<LearnLanguage[]>("/api/learn/languages"),
  learnCompare: (langs: string[], topic: string, ui: string) =>
    request<CompareData>(`/api/learn/compare?langs=${encodeURIComponent(langs.join(","))}&topic=${encodeURIComponent(topic)}&ui=${encodeURIComponent(ui)}`),
  learnPractice: (childId: string, lang: string, item: string, skill: LearnSkill) =>
    request<LearnActivity>(`/api/children/${childId}/learn/${lang}/practice`, { method: "POST", body: json({ item, skill }) }),
  learnNext: (childId: string, lang: string, body: { focus?: LearnSkill; speech: boolean; topic?: string }) =>
    request<LearnActivity>(`/api/children/${childId}/learn/${lang}/next`, { method: "POST", body: json(body) }),
  learnAnswer: (childId: string, attemptId: string, response: Record<string, unknown>) =>
    request<LearnAnswer>(`/api/children/${childId}/learn/attempts/${attemptId}/answer`, { method: "POST", body: json({ response }) }),

  children: () => request<Child[]>("/api/children"),
  child: (id: string) => request<Child>(`/api/children/${id}`),
  createChild: (body: Partial<Child>) => request<Child>("/api/children", { method: "POST", body: json(body) }),
  updateChild: (id: string, body: Record<string, unknown>) => request<Child>(`/api/children/${id}`, { method: "PATCH", body: json(body) }),
  setConsent: (id: string, body: { camera?: boolean; microphone?: boolean; recording?: boolean }) =>
    request<Child>(`/api/children/${id}/consent`, { method: "PUT", body: json(body) }),
  consentHistory: (id: string) => request<{ kind: string; granted: boolean; at: string }[]>(`/api/children/${id}/consent-history`),
  progress: (id: string) => request<Progress>(`/api/children/${id}/progress`),
  resetProgress: (id: string) => request<void>(`/api/children/${id}/progress`, { method: "DELETE" }),
  deleteChild: (id: string) => request<void>(`/api/children/${id}`, { method: "DELETE" }),

  startSession: (childId: string, mode?: Mode, topic?: string, ears = false, focus?: string) =>
    request<StartSession>(`/api/children/${childId}/sessions`, {
      method: "POST", body: json({ ...(mode ? { mode } : {}), ...(topic ? { topic } : {}), ...(focus ? { focus } : {}), ears }),
    }),
  next: (sid: string) => request<NextActivity | SessionDone>(`/api/sessions/${sid}/next`, { method: "POST" }),
  answer: (sid: string, aid: string, response: unknown) =>
    request<AnswerResult>(`/api/sessions/${sid}/attempts/${aid}/answer`, { method: "POST", body: json({ response }) }),
  signal: (sid: string, signal: "tired" | "stop" | "frustrated" | "want_game") =>
    request<SessionDone | { done: false; say: string }>(`/api/sessions/${sid}/signal`, { method: "POST", body: json({ signal }) }),
  endSession: (sid: string) => request<SessionDone>(`/api/sessions/${sid}/end`, { method: "POST" }),

  chat: (childId: string, message: string, history: { from: string; text: string }[]) =>
    request<{ reply: string; wants_rest: boolean; wants_game: boolean; source: string }>(`/api/children/${childId}/chat`, {
      method: "POST", body: json({ message, history }),
    }),

  recordings: (childId: string) => request<Recording[]>(`/api/children/${childId}/recordings`),
  recording: (childId: string, rid: string) => request<Recording>(`/api/children/${childId}/recordings/${rid}`),
  uploadRecording: (childId: string, wav: Blob, title: string, songHint?: string) => {
    const fd = new FormData();
    fd.append("file", wav, "practice.wav");
    fd.append("title", title);
    if (songHint) fd.append("song_hint", songHint);
    return request<Recording>(`/api/children/${childId}/recordings`, { method: "POST", body: fd });
  },
  reanalyze: (childId: string, rid: string) => request<Recording>(`/api/children/${childId}/recordings/${rid}/reanalyze`, { method: "POST" }),
  deleteRecording: (childId: string, rid: string) => request<void>(`/api/children/${childId}/recordings/${rid}`, { method: "DELETE" }),
  deleteAllRecordings: (childId: string) => request<void>(`/api/children/${childId}/recordings`, { method: "DELETE" }),
  recordingAudioUrl: (childId: string, rid: string) => `/api/children/${childId}/recordings/${rid}/audio`,
  tokens: () => request<TokenRow[]>("/api/integrations/tokens"),
  createToken: (name: string, allow_write: boolean) => request<NewToken>("/api/integrations/tokens", { method: "POST", body: json({ name, allow_write }) }),
  revokeToken: (id: string) => request<void>(`/api/integrations/tokens/${id}`, { method: "DELETE" }),

  memory: (childId: string) => request<MemoryOverview>(`/api/children/${childId}/memory`),
  memoryGraph: (childId: string, node?: string, depth = 1) =>
    request<{ nodes: GraphNode[]; edges: GraphEdge[] }>(`/api/children/${childId}/memory/graph?depth=${depth}${node ? `&node=${encodeURIComponent(node)}` : ""}`),
  addNote: (childId: string, note: string, about_skill?: string) =>
    request<{ id: string }>(`/api/children/${childId}/memory/notes`, { method: "POST", body: json({ note, about_skill: about_skill || null }) }),
  setFocus: (childId: string, skill: string | null) => request<{ focus_skill: string | null }>(`/api/children/${childId}/memory/focus`, { method: "PUT", body: json({ skill }) }),
  rebuildMemory: (childId: string) => request<{ nodes: number; edges: number; events: number }>(`/api/children/${childId}/memory/rebuild`, { method: "POST" }),
  catalog: () => request<{ songs: Record<string, { title: string; ease: number; notes: [number, number][] }> }>("/api/catalog"),
};
