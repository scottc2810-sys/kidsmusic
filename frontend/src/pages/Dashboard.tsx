import { useEffect, useState } from "react";
import { LANGS, LANGUAGE_CODES } from "../languages";
import { Link } from "react-router-dom";
import { api, type Avatar, type Child, type Language, type Mode } from "../api";
import { BrainTest } from "../components/BrainTest";
import { AVATARS, LANG_NAME, MODE_NAME, ParentShell, Toast } from "./ParentShell";

const LEVEL_NAMES = ["", "Discover Music", "Play and Repeat", "Create Music", "Play Independently"];

export function Dashboard() {
  const [kids, setKids] = useState<Child[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = () => api.children().then(setKids).catch((e) => setError(e.message));
  useEffect(() => { void load(); }, []);

  return (
    <ParentShell title="Your little musicians">
      <Toast msg={error} kind="error" />
      {kids === null ? <div className="spinner" /> : (
        <div className="grid">
          {kids.map((k) => (
            <article key={k.id} className="card child-card">
              <div className="child-head">
                <span className="avatar" aria-hidden>{AVATARS[k.avatar]}</span>
                <div>
                  <h2>{k.name}</h2>
                  <p className="muted small">Age {k.age} · {LANG_NAME[k.language]} · {MODE_NAME[k.mode]}</p>
                  <p className="level">Level {k.current_level}: {LEVEL_NAMES[k.current_level]}</p>
                </div>
              </div>
              <div className="row wrap">
                <Link to={`/play/${k.id}`} className="btn big">▶ Start {k.name}'s music time</Link>
                <Link to={`/parent/child/${k.id}/chat`} className="btn big ghost talk-btn">💬 Talk to Melo about {k.name}</Link>
              </div>
              <div className="row wrap">
                <Link to={`/parent/child/${k.id}/progress`} className="btn ghost small">📈 Progress & memory</Link>
                <Link to={`/parent/child/${k.id}/instrument`} className="btn ghost small">🎹 Instrument</Link>
                <Link to={`/parent/child/${k.id}/own-words`} className="btn ghost small">📚 Own words</Link>
                <Link to={`/parent/child/${k.id}/teachers`} className="btn ghost small">🧑‍🏫 Teachers</Link>
                <Link to={`/parent/child/${k.id}/voices`} className="btn ghost small">🎙️ Native voices</Link>
                <Link to={`/parent/child/${k.id}/recordings`} className="btn ghost small">🎙️ Recordings</Link>
                <Link to={`/parent/child/${k.id}/settings`} className="btn ghost small">⚙️ Settings</Link>
                <Link to={`/play/${k.id}/learn`} className="btn ghost small">🗣️ Languages</Link>
                <Link to={`/play/${k.id}/learn-compare`} className="btn ghost small">🔀 Compare languages</Link>
              </div>
              <div className="consents small">
                <span className={k.consent_microphone ? "on" : "off"}>🎤 Mic {k.consent_microphone ? "on" : "off"}</span>
                <span className={k.consent_camera ? "on" : "off"}>📷 Camera {k.consent_camera ? "on" : "off"}</span>
                <span className={k.consent_recording ? "on" : "off"}>⏺ Recording {k.consent_recording ? "on" : "off"}</span>
                <span className={k.cloud_ai_allowed ? "on" : "off"}>✨ Cloud AI {k.cloud_ai_allowed ? "on" : "off"}</span>
              </div>
            </article>
          ))}
          {adding ? (
            <AddChild onDone={(c) => { setAdding(false); if (c) setKids([...(kids ?? []), c]); }} />
          ) : (
            <button className="card add-card" onClick={() => setAdding(true)}>＋ Add a child</button>
          )}
        </div>
      )}
      {kids && <BrainPermission kids={kids} onChanged={load} />}
      <BrainTest />
    </ParentShell>
  );
}

const ASKED_KEY = "melo.brain.asked";

/**
 * Claude Code was found on this computer: ask the parent, once, whether Melo may use it as the
 * teacher's brain. Nothing is sent to the AI for a child until the parent says yes here (or in Settings).
 */
function BrainPermission({ kids, onChanged }: { kids: Child[]; onChanged: () => void }) {
  const [status, setStatus] = useState<Awaited<ReturnType<typeof api.teacherStatus>> | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem(ASKED_KEY) === "no"; } catch { return false; } });
  useEffect(() => { api.teacherStatus().then(setStatus).catch(() => {}); }, []);
  const waiting = kids.filter((k) => !k.cloud_ai_allowed);
  if (!status || !status.claude_code_found) return null;
  if (status.provider !== "claude_code") {
    // found, but settings keep Melo on another brain: say so instead of staying silent
    return status.provider === "offline" && !hidden ? (
      <section className="card form brain-ask">
        <h2>🧠 Claude Code is installed on this computer</h2>
        <p className="small">Melo is set to its built-in teacher (<code>KM_AI_PROVIDER={status.configured}</code>). Set it to <code>auto</code> or <code>claude_code</code> in Melo's <code>.env</code> and restart to let Melo use Claude Code.</p>
      </section>
    ) : null;
  }
  if (result?.ok) return <section className="card form brain-ask"><p><strong>✅ {result.message}</strong></p></section>;
  if (!waiting.length || (hidden && !result)) return null;
  const allow = async () => {
    setBusy(true); setResult(null);
    try {
      const test = await api.teacherTest(); // is Claude Code logged in and answering?
      if (!test.ok) { setResult({ ok: false, message: test.message }); return; }
      await Promise.all(waiting.map((k) => api.updateChild(k.id, { cloud_ai_allowed: true })));
      setResult({ ok: true, message: `Claude Code is now Melo's brain for ${waiting.map((k) => k.name).join(", ")}.` });
      onChanged();
    } catch (e) { setResult({ ok: false, message: (e as Error).message }); } finally { setBusy(false); }
  };
  const later = () => { try { localStorage.setItem(ASKED_KEY, "no"); } catch { /* private mode */ } setHidden(true); };
  return (
    <section className="card form brain-ask" aria-live="polite">
      <h2>🧠 Claude Code found on this computer</h2>
      <p>Let Melo use it as the teacher's brain for <strong>{waiting.map((k) => k.name).join(", ")}</strong>? Lessons become personal: Melo plans each lesson, writes its own praise and answers your child's questions.</p>
      <p className="muted small">It uses your Claude Code login (no API key). Your child's name, voice and video are never sent, only learning statistics and what your child types or says to Melo. You can turn it off per child in Settings.</p>
      <div className="row wrap">
        <button className="btn" onClick={allow} disabled={busy}>{busy ? "Checking Claude Code… (about 5 s)" : "Allow"}</button>
        <button className="btn ghost" onClick={later} disabled={busy}>Not now</button>
      </div>
      {result && !result.ok && (
        <p className="error small">{result.message} Open a terminal, run <code>claude</code> once and log in, then press Allow again.</p>
      )}
    </section>
  );
}

function AddChild({ onDone }: { onDone: (c: Child | null) => void }) {
  const [form, setForm] = useState({
    name: "", age: 5, avatar: "owl" as Avatar, language: "en" as Language, mode: "screen" as Mode, session_minutes: 5,
    consent_microphone: false, consent_camera: false, consent_recording: false, cloud_ai_allowed: false,
  });
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm({ ...form, [k]: v });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try { onDone(await api.createChild(form)); } catch (err) { setError((err as Error).message); }
  };
  return (
    <form className="card form" onSubmit={submit}>
      <h2>New child profile</h2>
      <label>First name or nickname<input required maxLength={40} value={form.name} onChange={(e) => set("name", e.target.value)} /></label>
      <div className="row">
        <label>Age<input type="number" min={2} max={12} value={form.age} onChange={(e) => set("age", Number(e.target.value))} /></label>
        <label>Lesson length
          <select value={form.session_minutes} onChange={(e) => set("session_minutes", Number(e.target.value))}>
            {[3, 4, 5, 7, 10, 15].map((m) => <option key={m} value={m}>{m} min</option>)}
          </select>
        </label>
      </div>
      <fieldset className="avatars"><legend>Avatar</legend>
        {Object.entries(AVATARS).map(([k, v]) => (
          <button type="button" key={k} className={form.avatar === k ? "sel" : ""} onClick={() => set("avatar", k as Avatar)} aria-label={k}>{v}</button>
        ))}
      </fieldset>
      <label>Teaching language
        <select value={form.language} onChange={(e) => set("language", e.target.value as Language)}>
          {LANGUAGE_CODES.map((code) => <option key={code} value={code}>{LANGS[code].name}{LANGS[code].native !== LANGS[code].name ? ` (${LANGS[code].native})` : ""}</option>)}
        </select>
      </label>
      <label>Learning mode
        <select value={form.mode} onChange={(e) => set("mode", e.target.value as Mode)}>
          <option value="screen">Screen piano</option>
          <option value="real" disabled={!form.consent_microphone}>Real keyboard (needs microphone)</option>
          <option value="listening">Listening games</option>
          <option value="practice">Practice what we learned</option>
        </select>
      </label>
      <fieldset className="consent-box"><legend>Permissions (you can change these any time)</legend>
        <label className="check"><input type="checkbox" checked={form.consent_microphone} onChange={(e) => set("consent_microphone", e.target.checked)} />
          Microphone — lets Melo listen to a real keyboard. Audio is analysed on this device only.</label>
        <label className="check"><input type="checkbox" checked={form.consent_camera} onChange={(e) => set("consent_camera", e.target.checked)} />
          Camera — lets Melo see hands on the keys. Video never leaves this device.</label>
        <label className="check"><input type="checkbox" checked={form.consent_recording} onChange={(e) => set("consent_recording", e.target.checked)} />
          Practice recordings — saved encrypted on your Melo server for feedback. Never used to train AI.</label>
        <label className="check"><input type="checkbox" checked={form.cloud_ai_allowed} onChange={(e) => set("cloud_ai_allowed", e.target.checked)} />
          Cloud AI (Claude) — personalises lessons and feedback. Your child's name and audio are never sent; only learning statistics and what they say to Melo.</label>
      </fieldset>
      <Toast msg={error} kind="error" />
      <div className="row">
        <button type="button" className="btn ghost" onClick={() => onDone(null)}>Cancel</button>
        <button className="btn">Create profile</button>
      </div>
    </form>
  );
}
