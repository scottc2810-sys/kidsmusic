import { useEffect, useRef, useState } from "react";
import { micErrorMessage } from "../audio/permissions";
import { Link, useParams } from "react-router-dom";
import { api, type Child, type Recording } from "../api";
import { MAX_SECONDS, PracticeRecorder, toWav16k } from "../audio/recorder";
import { ParentShell, Toast } from "./ParentShell";

const SONGS: [string, string][] = [["", "Let Melo work it out"], ["sargam", "Sa Re Ga Ma"], ["hot_cross_buns", "Hot Cross Buns"], ["mary_lamb", "Mary Had a Little Lamb"],
  ["twinkle", "Twinkle Twinkle Little Star"], ["ode_to_joy", "Ode to Joy"], ["jingle_bells", "Jingle Bells"], ["old_macdonald", "Old MacDonald"]];

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export function Recordings() {
  const { id = "" } = useParams();
  const [child, setChild] = useState<Child | null>(null);
  const [recs, setRecs] = useState<Recording[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [title, setTitle] = useState("Practice");
  const [song, setSong] = useState("");
  const rec = useRef<PracticeRecorder | null>(null);

  const load = () => api.recordings(id).then(setRecs).catch((e) => setError(e.message));
  useEffect(() => { api.child(id).then(setChild).catch((e) => setError(e.message)); void load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  // poll while any analysis is running
  useEffect(() => {
    if (!recs.some((r) => r.status === "pending")) return;
    const t = window.setTimeout(load, 2000);
    return () => clearTimeout(t);
  }, [recs]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!recording) return;
    const t = window.setInterval(() => setElapsed((performance.now() - (rec.current?.startedAt ?? 0)) / 1000), 250);
    return () => clearInterval(t);
  }, [recording]);
  useEffect(() => () => rec.current?.cancel(), []);

  const upload = async (wav: Blob) => {
    setBusy("Uploading…");
    try { await api.uploadRecording(id, wav, title || "Practice", song || undefined); await load(); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(null); }
  };
  const start = async () => {
    setError(null);
    try {
      rec.current = new PracticeRecorder();
      await rec.current.start(() => void stop());
      setElapsed(0);
      setRecording(true);
    } catch (e) { setError(micErrorMessage(e).message); }
  };
  const stop = async () => {
    if (!rec.current) return;
    setRecording(false);
    setBusy("Preparing audio…");
    try { const { wav } = await rec.current.stop(); await upload(wav); }
    catch (e) { setError((e as Error).message); setBusy(null); }
    rec.current = null;
  };
  const fromFile = async (f: File | undefined) => {
    if (!f) return;
    setError(null);
    setBusy("Converting file…");
    try { const { wav } = await toWav16k(f); await upload(wav); } catch (e) { setError((e as Error).message); setBusy(null); }
  };

  if (!child) return <ParentShell title="Recordings" back="/parent"><Toast msg={error} kind="error" /><div className="spinner" /></ParentShell>;

  return (
    <ParentShell title={`${child.name}'s practice recordings`} back="/parent">
      <Toast msg={error} kind="error" />
      {!child.consent_recording ? (
        <section className="card">
          <p>Recordings are turned off for {child.name}. Lessons on the screen work without them.</p>
          <Link className="btn" to={`/parent/child/${id}/settings`}>Turn on in settings</Link>
        </section>
      ) : (
        <section className="card form">
          <h2>New recording</h2>
          <p className="muted small">Short is great — even 30 seconds helps. Up to 10 minutes. Audio is analysed on your Melo server and stored encrypted.</p>
          <div className="row">
            <label>Title<input value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} /></label>
            <label>Song (optional)
              <select value={song} onChange={(e) => setSong(e.target.value)}>{SONGS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            </label>
          </div>
          <div className="row wrap">
            {recording ? (
              <button className="btn danger big" onClick={stop}>⏹ Stop · {fmt(elapsed)} / {fmt(MAX_SECONDS)}</button>
            ) : (
              <button className="btn big" onClick={start} disabled={!!busy || !child.consent_microphone}
                title={child.consent_microphone ? "" : "Microphone permission is off"}>⏺ Record</button>
            )}
            <label className="btn ghost file">📁 Upload audio file<input type="file" accept="audio/*" hidden onChange={(e) => fromFile(e.target.files?.[0])} /></label>
          </div>
          {!child.consent_microphone && <p className="muted small">Live recording needs microphone permission; you can still upload a file.</p>}
          {busy && <p className="notice">{busy}</p>}
        </section>
      )}

      {recs.map((r) => <RecordingCard key={r.id} childId={id} r={r} onChange={load} />)}
    </ParentShell>
  );
}

function RecordingCard({ childId, r, onChange }: { childId: string; r: Recording; onChange: () => void }) {
  const a = r.analysis ?? {};
  const f = r.feedback ?? {};
  const pct = (x?: number | null) => (x == null ? "—" : `${Math.round(x * 100)}%`);
  return (
    <article className="card recording">
      <div className="row spread">
        <div>
          <h3>{r.title}</h3>
          <p className="muted small">{new Date(r.created_at).toLocaleString()} · {fmt(r.duration_seconds)}</p>
        </div>
        <div className="row">
          {r.status !== "pending" && <button className="btn ghost small" onClick={async () => { await api.reanalyze(childId, r.id); onChange(); }}>Re-analyse</button>}
          <button className="btn ghost small danger" onClick={async () => { if (confirm("Delete this recording?")) { await api.deleteRecording(childId, r.id); onChange(); } }}>Delete</button>
        </div>
      </div>
      <audio controls preload="none" src={api.recordingAudioUrl(childId, r.id)} />
      {r.status === "pending" && <p className="notice">🎧 Melo is listening carefully…</p>}
      {r.status === "failed" && <p className="error">Couldn't analyse: {r.error}</p>}
      {r.status === "analyzed" && (
        <>
          {f.child_message && <blockquote className="kid-quote">🦉 “{f.child_message}”</blockquote>}
          {f.parent_summary && <p>{f.parent_summary}</p>}
          {!a.reliable && <p className="notice small">The sound was hard to hear clearly, so Melo isn't judging this one.</p>}
          <div className="metrics">
            <div><strong>{a.song_match?.title ?? "Free play"}</strong><span>piece</span></div>
            <div><strong>{pct(a.note_accuracy)}</strong><span>notes matched</span></div>
            <div><strong>{pct(a.rhythm_stability)}</strong><span>steady beat</span></div>
            <div><strong>{a.tempo_bpm ?? "—"}</strong><span>beats / min</span></div>
            <div><strong>{a.instrument_guess?.label ?? "—"}</strong><span>instrument</span></div>
          </div>
          <div className="grid three">
            <div><h4>Strengths</h4><ul>{(f.strengths ?? []).map((s: string, i: number) => <li key={i}>{s}</li>)}</ul></div>
            <div><h4>Focus</h4>{f.focus?.length ? <ul>{f.focus.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul> : <p className="muted small">Nothing recurring.</p>}</div>
            <div><h4>Next mini-lesson</h4><ol>{(f.lesson_steps ?? []).map((s: string, i: number) => <li key={i}>{s}</li>)}</ol></div>
          </div>
          {f.compared_with_previous && (
            <p className="small">Since last time: notes {pct(f.compared_with_previous.note_accuracy_before)} → {pct(f.compared_with_previous.note_accuracy_now)},
              beat {pct(f.compared_with_previous.rhythm_before)} → {pct(f.compared_with_previous.rhythm_now)}</p>
          )}
          <p className="muted small">Feedback by {f.source === "claude" ? "Claude" : "Melo's offline teacher"}. Analyser numbers are estimates.</p>
        </>
      )}
    </article>
  );
}
