// "Is Claude Code connected?" A parent-facing button that makes one real call to Melo's AI brain.
import { useState } from "react";
import { api, type BrainTest as Result } from "../api";

export const PROVIDER_NAME: Record<string, string> = { claude_code: "Claude Code (your login)", anthropic: "Claude API", ollama: "Ollama (local)",
  openai: "OpenAI-compatible", offline: "Offline teacher" };

export function BrainTest() {
  const [busy, setBusy] = useState(false);
  const [r, setR] = useState<Result | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const run = async () => {
    setBusy(true); setErr(null); setR(null);
    try { setR(await api.teacherTest()); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <section className="card form brain-test" aria-live="polite">
      <h2>🧠 Melo's brain</h2>
      <p className="muted small">Checks that the AI brain is connected and answering. Takes a few seconds (a local model can take longer the first time).</p>
      <div className="row wrap">
        <button className="btn" onClick={run} disabled={busy}>{busy ? "Testing…" : "Test the AI brain"}</button>
      </div>
      {r && (
        <div className={`brain-result ${r.ok ? "ok" : "bad"}`}>
          <p><strong>{r.ok ? "✅ " : "⚠️ "}{r.message}</strong></p>
          <p className="small">Brain: {PROVIDER_NAME[r.provider] ?? r.provider}{r.model ? ` · model ${r.model}` : ""}</p>
          {r.reply && <p className="small">Melo says: “{r.reply}”</p>}
          {!r.ok && r.provider !== "offline" && (
            <p className="small muted">Lessons keep working with the offline teacher until this is fixed. {r.provider === "claude_code"
              ? <>In a terminal, run <code>claude</code> once and log in, then test again.</> : <>Check the brain settings above, then test again.</>}</p>
          )}
        </div>
      )}
      {err && <p className="error small">{err}</p>}
    </section>
  );
}
