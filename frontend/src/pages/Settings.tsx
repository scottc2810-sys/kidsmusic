import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, type Child, type Language, type Mode } from "../api";
import { MicNoteInput } from "../audio/mic";
import { micErrorMessage, micPermission, requestMic, watchMicPermission, type MicState } from "../audio/permissions";
import { chooseVoice, chosenVoiceName, previewVoice, speak, voicesFor } from "../audio/speech";
import { getTeacherTimbre, getTuning, isSinging, playSequence, setSinging, setTeacherTimbre, setTuning, unlockAudio, type Timbre, type Tuning } from "../audio/synth";
import { LANGS, LANGUAGE_CODES, langInfo } from "../languages";
import { L, noteLabel, sungName, t, type Text } from "../i18n";
import { CameraObserver, loadCalibration, saveCalibration, type KeyboardCalibration } from "../vision/camera";
import { AVATARS, ParentShell, Toast } from "./ParentShell";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function Settings() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const [child, setChild] = useState<Child | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<{ kind: string; granted: boolean; at: string }[]>([]);

  useEffect(() => {
    api.child(id).then(setChild).catch((e) => setError(e.message));
    api.consentHistory(id).then(setHistory).catch(() => {});
  }, [id]);

  const save = async (patch: Record<string, unknown>) => {
    setError(null);
    try { setChild(await api.updateChild(id, patch)); setMsg("Saved ✓"); setTimeout(() => setMsg(null), 1500); }
    catch (e) { setError((e as Error).message); }
  };
  const consent = async (k: "camera" | "microphone" | "recording", v: boolean) => {
    // Turning the mic on: ask the browser right away, inside this click, so the prompt appears now
    // rather than in the middle of a child's lesson.
    if (k === "microphone" && v) {
      const r = await requestMic();
      if (!r.ok) setError(r.message);
    }
    try {
      setChild(await api.setConsent(id, { [k]: v }));
      setHistory(await api.consentHistory(id));
    } catch (e) { setError((e as Error).message); }
  };

  if (!child) return <ParentShell title="Settings" back="/parent"><Toast msg={error} kind="error" /><div className="spinner" /></ParentShell>;

  return (
    <ParentShell title={`${child.name}'s settings`} back="/parent">
      <Toast msg={msg} /><Toast msg={error} kind="error" />
      <section className="card form">
        <h2>Profile & lessons</h2>
        <div className="row">
          <label>Name<input defaultValue={child.name} maxLength={40} onBlur={(e) => e.target.value !== child.name && save({ name: e.target.value })} /></label>
          <label>Age<input type="number" min={2} max={12} defaultValue={child.age} onBlur={(e) => Number(e.target.value) !== child.age && save({ age: Number(e.target.value) })} /></label>
        </div>
        <fieldset className="avatars"><legend>Avatar</legend>
          {Object.entries(AVATARS).map(([k, v]) => (
            <button type="button" key={k} className={child.avatar === k ? "sel" : ""} onClick={() => save({ avatar: k })} aria-label={k}>{v}</button>
          ))}
        </fieldset>
        <div className="row">
          <label>Teaching language
            <select value={child.language} onChange={(e) => save({ language: e.target.value as Language })}>
              {LANGUAGE_CODES.map((code) => (
                <option key={code} value={code}>{LANGS[code].name}{LANGS[code].native !== LANGS[code].name ? ` (${LANGS[code].native})` : ""}{LANGS[code].beta ? " · beta" : ""}</option>
              ))}
            </select>
            {langInfo(child.language).beta && <span className="muted small">Beta: translated automatically and not yet checked by a native-speaking teacher. Anything untranslated shows in English.</span>}
          </label>
          <div className="field">Instrument
            <Link to={`/parent/child/${id}/instrument`} className="btn ghost small">🎹 Set up {child.name}'s own instrument</Link>
            <span className="muted small">Add photos or a shop link of the real instrument at home and Melo fits the lessons to it. Skip it to keep the standard lessons.</span>
          </div>
        </div>
        <div className="row">
          <label>Learning mode
            <select value={child.mode} onChange={(e) => save({ mode: e.target.value as Mode })}>
              <option value="screen">Screen piano</option>
              <option value="real" disabled={!child.consent_microphone}>Real keyboard (needs microphone)</option>
              <option value="listening">Listening games</option>
              <option value="practice">Practice what we learned</option>
            </select>
          </label>
          <label>Lesson length
            <select value={child.session_minutes} onChange={(e) => save({ session_minutes: Number(e.target.value) })}>
              {[3, 4, 5, 7, 10, 15, 20].map((m) => <option key={m} value={m}>{m} minutes</option>)}
            </select>
          </label>
        </div>
        <div className="row">
          <label>Level
            <select value={child.current_level} onChange={(e) => save({ current_level: Number(e.target.value) })}>
              {LEVEL_NAMES.map((n, i) => <option key={n} value={i + 1}>{i + 1} · {n}</option>)}
            </select>
            <span className="muted small">Melo moves your child up as they show each skill, and skips ahead when they get new material right.
              If your child already plays, set the level here.</span>
          </label>
        </div>
      </section>

      <section className="card form">
        <h2>Practice reminders</h2>
        <div className="row">
          <label>Time<input type="time" defaultValue={child.reminder_time ?? ""} onChange={(e) => e.target.value && save({ reminder_time: e.target.value })} /></label>
          <button className="btn ghost small" onClick={() => save({ clear_reminder: true })}>Turn off</button>
          {"Notification" in window && Notification.permission !== "granted" && (
            <button className="btn ghost small" onClick={() => Notification.requestPermission()}>Allow browser notifications</button>
          )}
        </div>
        <div className="days">
          {DAYS.map((d, i) => {
            const on = child.reminder_days.includes(i);
            return <button key={d} className={`day ${on ? "sel" : ""}`} onClick={() => save({ reminder_days: on ? child.reminder_days.filter((x) => x !== i) : [...child.reminder_days, i] })}>{d}</button>;
          })}
        </div>
        <p className="muted small">No days selected means every day. Reminders show while Melo is open in this browser.</p>
      </section>

      <section className="card form">
        <h2>Permissions & privacy</h2>
        <Toggle label="🎤 Microphone — Melo listens to your child's real keyboard in every lesson and corrects what it hears (analysed on this device only)" on={child.consent_microphone} set={(v) => consent("microphone", v)} />
        <Toggle label="📷 Camera — in Real keyboard mode Melo watches the hands and coaches finger shape (video never leaves this device)" on={child.consent_camera} set={(v) => consent("camera", v)} />
        <Toggle label="⏺ Practice recordings — saved encrypted on your Melo server" on={child.consent_recording} set={(v) => consent("recording", v)} />
        <Toggle label="✨ AI brain — personalised plans, chat & feedback from the brain chosen under 🧠 AI brain (Claude Code, a local model or an online service); the name and audio are never sent" on={child.cloud_ai_allowed} set={(v) => save({ cloud_ai_allowed: v })} />
        <details><summary>Permission history</summary>
          <ul className="small">{history.map((h, i) => <li key={i}>{new Date(h.at).toLocaleString()} — {h.kind} {h.granted ? "allowed" : "turned off"}</li>)}</ul>
        </details>
      </section>

      <TeacherSound lang={child.language} />
      <SoundCheck lang={child.language} />
      {child.consent_microphone && <MicTest />}
      {child.consent_camera && <CameraSetup childId={child.id} />}

      <section className="card form danger-zone">
        <h2>Your data</h2>
        <div className="row wrap">
          <button className="btn ghost danger" onClick={async () => { if (confirm("Delete all recordings for this child?")) { await api.deleteAllRecordings(id); setMsg("Recordings deleted"); } }}>Delete all recordings</button>
          <button className="btn ghost danger" onClick={async () => { if (confirm("Reset all progress (levels, skills, lesson history)?")) { await api.resetProgress(id); setChild(await api.child(id)); setMsg("Progress reset"); } }}>Reset progress</button>
          <button className="btn danger" onClick={async () => { if (confirm(`Permanently delete ${child.name}'s profile and ALL data?`)) { await api.deleteChild(id); nav("/parent"); } }}>Delete child profile</button>
        </div>
        <AccountDelete />
      </section>
    </ParentShell>
  );
}

const LEVEL_NAMES = ["Discover Music", "Play and Repeat", "Create Music", "Play Independently"];
const TEACHER_INSTRUMENTS: [Timbre, string][] = [["piano", "Piano"], ["harmonium", "Harmonium"], ["flute", "Flute (bansuri)"], ["guitar", "Guitar"],
  ["violin", "Violin"], ["sitar", "Sitar"], ["santoor", "Santoor"], ["xylophone", "Xylophone"], ["kalimba", "Kalimba"], ["bell", "Bells"]];

/** How Melo plays for the child: instrument, tuning, and whether it sings the note names (per device). */
function TeacherSound({ lang }: { lang: Language }) {
  const [timbre, setTimbre] = useState<Timbre>(getTeacherTimbre());
  const [tuning, setTune] = useState<Tuning>(getTuning());
  const [sing, setSing] = useState(isSinging());
  const demo = async () => {
    await unlockAudio();
    await playSequence([60, 62, 64, 65, 67, 69, 71, 72].map((m, i) => ({ midi: m, beats: i === 7 ? 2 : 1, sing: sungName(m, lang) })), 96).done;
  };
  return (
    <section className="card form">
      <h2>🎹 How Melo plays</h2>
      <div className="row">
        <label>Melo's instrument
          <select value={timbre} onChange={(e) => { const v = e.target.value as Timbre; setTimbre(v); setTeacherTimbre(v); }}>
            {TEACHER_INSTRUMENTS.map(([v, name]) => <option key={v} value={v}>{name}</option>)}
          </select>
        </label>
        <label>Tuning
          <select value={tuning} onChange={(e) => { const v = e.target.value as Tuning; setTune(v); setTuning(v); }}>
            <option value="equal">Keyboard tuning (matches a piano or keyboard)</option>
            <option value="pure">Indian pure tuning (sweeter Ga, Dha, Ni; Sa = C)</option>
          </select>
          <span className="muted small">Use keyboard tuning when your child plays along on a keyboard, so both sound the same.</span>
        </label>
      </div>
      <Toggle label="🎤 Melo also sings the note names while playing (experimental synthetic voice)" on={sing} set={(v) => { setSing(v); setSinging(v); }} />
      <button className="btn ghost" onClick={() => void demo()}>▶ Hear Melo play the scale</button>
    </section>
  );
}

function Toggle({ label, on, set }: { label: string; on: boolean; set: (v: boolean) => void }) {
  return (
    <label className="toggle">
      <input type="checkbox" role="switch" checked={on} onChange={(e) => set(e.target.checked)} />
      <span className="switch" aria-hidden /> <span>{label}</span>
    </label>
  );
}

function AccountDelete() {
  const nav = useNavigate();
  return (
    <p className="small">
      <button className="link danger" onClick={async () => {
        if (confirm("Delete your whole Melo account, every child profile and all recordings? This cannot be undone.")) {
          await api.deleteAccount(); nav("/login"); window.location.reload();
        }
      }}>Delete my entire account</button>
    </p>
  );
}

const VOICE_HELLO: Text = {
  en: "Hello! I'm Melo. Shall we make some music today?",
  hi: "नमस्ते! मैं मेलो हूँ। आज संगीत बनाएँ?",
  hinglish: "Hello! Main Melo hoon. Aaj thoda music banayein?",
};

function VoicePicker({ lang }: { lang: Language }) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [chosen, setChosen] = useState<string>(chosenVoiceName(lang) ?? "");
  useEffect(() => {
    const load = () => setVoices(voicesFor(lang));
    load();
    window.speechSynthesis?.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis?.removeEventListener("voiceschanged", load);
  }, [lang]);
  const natural = voices.some((v) => /natural|neural|online/i.test(v.name));
  return (
    <div className="form">
      <label>Melo's voice on this device
        <select value={chosen} onChange={(e) => { setChosen(e.target.value); chooseVoice(lang, e.target.value || null); }}>
          <option value="">Automatic (best available{voices[0] ? `: ${voices[0].name}` : ""})</option>
          {voices.map((v, i) => <option key={v.name} value={v.name}>{v.name}{i === 0 ? " ★ recommended" : ""}</option>)}
        </select>
      </label>
      <div className="row wrap">
        <button className="btn ghost small" onClick={() => void previewVoice(lang, chosen || voices[0]?.name || "", L(VOICE_HELLO, lang))} disabled={!voices.length}>▶ Hear this voice</button>
      </div>
      {!voices.length && <p className="small muted">No {langInfo(lang).name} voice is installed in this browser. Melo will use the default voice.</p>}
      {voices.length > 0 && !natural && (
        <p className="small muted">For a warm, human-sounding Indian voice, open Melo in <strong>Microsoft Edge</strong> (it has free natural voices: Swara for Hindi, Neerja for Indian English) or add Hindi / English (India) speech in Windows Settings → Time &amp; language → Speech.</p>
      )}
    </div>
  );
}

function SoundCheck({ lang }: { lang: Language }) {
  const [info, setInfo] = useState<string | null>(null);
  const test = async () => {
    await unlockAudio();
    await playSequence([{ midi: 60, beats: 0.5 }, { midi: 64, beats: 0.5 }, { midi: 67, beats: 1 }], 120).done;
    const voices = window.speechSynthesis?.getVoices().length ?? 0;
    await speak(t("canYouHear", lang), lang);
    setInfo(window.speechSynthesis
      ? `You should have heard 3 piano notes, then Melo's voice${voices ? "" : " (no voices installed in this browser yet; try Chrome or Edge)"}.`
      : "This browser cannot speak. The notes still play; Melo's words appear on screen.");
  };
  return (
    <section className="card form">
      <h2>🔊 Sound check</h2>
      <p className="muted small">Plays three notes and says hello. No sound? Check that the volume is up, this tab isn't muted, and the right speaker is chosen in Windows.</p>
      <button className="btn ghost" onClick={test}>Play test sound</button>
      {info && <p className="small">{info}</p>}
      <VoicePicker lang={lang} />
    </section>
  );
}

const MIC_STATE_LABEL: Record<MicState, string> = {
  granted: "✅ Allowed in this browser",
  prompt: "❔ Not asked yet. Press “Allow microphone”",
  denied: "⛔ Blocked in this browser",
  unsupported: "⚠️ This browser has no microphone support",
  insecure: "⚠️ Needs a secure page (localhost or HTTPS)",
};

function MicTest() {
  const [perm, setPerm] = useState<MicState | null>(null);
  const [on, setOn] = useState(false);
  const [level, setLevel] = useState(0);
  const [heard, setHeard] = useState(false);
  const [last, setLast] = useState<string>("");
  const [note, setNote] = useState<string | null>(null);
  const mic = useRef<MicNoteInput | null>(null);
  useEffect(() => {
    let unwatch = () => {};
    void micPermission().then(setPerm);
    void watchMicPermission(setPerm).then((u) => { unwatch = u; });
    return () => { unwatch(); mic.current?.stop(); };
  }, []);
  const allow = async () => {
    const r = await requestMic();
    setPerm(r.state);
    setNote(r.message);
  };
  const toggle = async () => {
    if (on) { mic.current?.stop(); mic.current = null; setOn(false); return; }
    setNote(null); setHeard(false); setLast("");
    try {
      await unlockAudio();
      const m = new MicNoteInput();
      await m.start(); // asks for permission if it has not been decided yet
      setPerm("granted");
      m.onLevel((l) => { setLevel(Math.min(1, l * 8)); if (l > 0.02) setHeard(true); });
      m.onNote((n) => setLast(`${noteLabel(n.midi, "en")}${Math.floor(n.midi / 12) - 1} (confidence ${Math.round(n.conf * 100)}%)`));
      mic.current = m;
      setOn(true);
    } catch (e) {
      const r = micErrorMessage(e);
      setPerm(r.state === "denied" ? "denied" : await micPermission());
      setNote(r.message);
    }
  };
  return (
    <section className="card form">
      <h2>🎤 Microphone check</h2>
      <p className="small">Browser permission: <strong>{perm ? MIC_STATE_LABEL[perm] : "checking…"}</strong></p>
      <div className="row wrap">
        {perm !== "granted" && perm !== "unsupported" && perm !== "insecure" && (
          <button className="btn" onClick={allow}>Allow microphone</button>
        )}
        <button className="btn ghost" onClick={toggle} disabled={perm === "unsupported" || perm === "insecure"}>{on ? "Stop" : "Start listening"}</button>
      </div>
      {note && <p className="small">{note}</p>}
      <p className="muted small">Place the device about 1 metre from the keyboard, press Start listening, then play or clap.</p>
      <div className="meter" role="meter" aria-label="Microphone level" aria-valuenow={Math.round(level * 100)} aria-valuemin={0} aria-valuemax={100}>
        <div style={{ width: `${level * 100}%` }} />
      </div>
      {on && <p className="small">{heard ? "✅ Melo can hear you!" : "Listening… make a sound. If the bar never moves, choose the right input in Windows Sound settings."}</p>}
      {last && <p>Heard note: <strong>{last}</strong></p>}
    </section>
  );
}

function CameraSetup({ childId }: { childId: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const cam = useRef<CameraObserver | null>(null);
  const [on, setOn] = useState(false);
  const [status, setStatus] = useState("");
  const [cal, setCal] = useState<KeyboardCalibration | null>(() => loadCalibration(childId));
  const [corner, setCorner] = useState<{ x: number; y: number } | null>(null);
  const [first, setFirst] = useState(cal?.firstWhiteMidi ?? 60);
  const [count, setCount] = useState(cal?.whiteKeys ?? 15);
  useEffect(() => () => cam.current?.stop(), []);
  useEffect(() => {
    // keep the saved calibration in sync when the key settings change
    setCal((c) => {
      if (!c || (c.firstWhiteMidi === first && c.whiteKeys === count)) return c;
      const next = { ...c, firstWhiteMidi: first, whiteKeys: count };
      saveCalibration(childId, next);
      cam.current?.setCalibration(next);
      return next;
    });
  }, [first, count, childId]);

  const start = async () => {
    if (on) { cam.current?.stop(); setOn(false); return; }
    try {
      setStatus("Starting camera and loading hand tracking…");
      cam.current = new CameraObserver(video.current!, cal);
      await cam.current.start();
      cam.current.onObservation((o) => setStatus(`${o.handsVisible} hand(s) visible` + (o.estimatedKeys.length ? ` · near ${o.estimatedKeys.map((k) => noteLabel(k, "en")).join(", ")}` : "")));
      setOn(true);
    } catch {
      setStatus("Camera or hand-tracking unavailable (needs camera permission and an internet connection the first time).");
    }
  };
  const click = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const p = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
    if (!corner) { setCorner(p); return; }
    const next = { x: Math.min(corner.x, p.x), y: Math.min(corner.y, p.y), w: Math.abs(p.x - corner.x), h: Math.abs(p.y - corner.y), firstWhiteMidi: first, whiteKeys: count };
    setCorner(null);
    setCal(next);
    saveCalibration(childId, next);
    cam.current?.setCalibration(next);
  };
  return (
    <section className="card form">
      <h2>Camera setup</h2>
      <p className="muted small">Point the camera at the keyboard. Click two opposite corners of the keys you want Melo to watch, then say which white key is left-most.</p>
      <button className="btn ghost" onClick={start}>{on ? "Stop camera" : "Start camera"}</button>
      <div className="cam-wrap" onClick={on ? click : undefined}>
        <video ref={video} className="cam" muted playsInline />
        {cal && <div className="cal-rect" style={{ left: `${cal.x * 100}%`, top: `${cal.y * 100}%`, width: `${cal.w * 100}%`, height: `${cal.h * 100}%` }} />}
        {corner && <div className="cal-dot" style={{ left: `${corner.x * 100}%`, top: `${corner.y * 100}%` }} />}
      </div>
      <div className="row">
        <label>Left-most white key
          <select value={first} onChange={(e) => setFirst(Number(e.target.value))}>
            {[36, 48, 53, 55, 57, 60].map((m) => <option key={m} value={m}>{noteLabel(m, "en")}{Math.floor(m / 12) - 1}</option>)}
          </select>
        </label>
        <label>White keys in the box<input type="number" min={5} max={52} value={count} onChange={(e) => setCount(Number(e.target.value))} /></label>
        <button className="btn ghost small" onClick={() => { setCal(null); saveCalibration(childId, null); cam.current?.setCalibration(null); }}>Clear</button>
      </div>
      <p className="small">{status}</p>
    </section>
  );
}
