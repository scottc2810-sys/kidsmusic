import { useEffect, useState } from "react";
import { api, type NewToken, type TokenRow } from "../api";
import { BrainPicker } from "../components/BrainPicker";
import { BrainTest } from "../components/BrainTest";
import { SystemCheck } from "../components/SystemCheck";
import { ParentShell, Toast } from "./ParentShell";

function CopyBlock({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* select manually */ }
  };
  return (
    <div className="copy-block">
      <div className="copy-head"><span>{label}</span><button className="btn ghost small" onClick={copy}>{copied ? "Copied ✓" : "Copy"}</button></div>
      <pre tabIndex={0}>{text}</pre>
    </div>
  );
}

export function ConnectClaude() {
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [name, setName] = useState("My laptop");
  const [allowWrite, setAllowWrite] = useState(false);
  const [created, setCreated] = useState<NewToken | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = () => api.tokens().then(setTokens).catch((e) => setError(e.message));
  useEffect(() => { void load(); }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      setCreated(await api.createToken(name, allowWrite));
      void load();
    } catch (err) { setError((err as Error).message); }
  };
  const revoke = async (id: string) => {
    if (!confirm("Revoke this token? Claude Code using it will lose access.")) return;
    await api.revokeToken(id).catch((e) => setError(e.message));
    void load();
  };

  return (
    <ParentShell title="Melo's AI brain and Claude Code" back="/parent">
      <SystemCheck />
      <BrainPicker />
      <section className="card">
        <p>
          Melo keeps a <strong>learning graph</strong> for each child — skills, activities, songs, lessons, recordings, recurring mistakes and
          your notes, all linked together. Connect <strong>Claude Code</strong> from your terminal and ask things like
          <em> “How is Asha doing with rhythm this month?”</em> or <em>“Plan next week's practice.”</em>
        </p>
        <ol className="steps">
          <li>Create a token below (it is shown once).</li>
          <li>Paste the command into a terminal where <code>claude</code> is installed.</li>
          <li>Run <code>claude mcp list</code> to check <code>melo</code> is connected, then just ask.</li>
        </ol>
        <p className="muted small">
          Tools: list_children, child_overview, teacher_brief, language_progress, learning_graph, search_memory, progress_timeline, recording_feedback,
          recommend_next_lesson, curriculum, rebuild_memory — plus add_note and set_focus_skill with a write-enabled token.
          Tokens only see your own children. Audio and video are never exposed.
        </p>
      </section>

      <form className="card form" onSubmit={create}>
        <h2>New connection token</h2>
        <label>Name<input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} /></label>
        <label className="check"><input type="checkbox" checked={allowWrite} onChange={(e) => setAllowWrite(e.target.checked)} />
          Allow changes (Claude Code may add notes and set the lesson focus)</label>
        <Toast msg={error} kind="error" />
        <button className="btn">Create token</button>
      </form>

      {created && (
        <section className="card highlight">
          <h2>Your connection is ready</h2>
          <p className="notice">Copy now — this token won't be shown again.</p>
          <CopyBlock label="Option A · while Melo is running (HTTP)" text={created.commands.http} />
          <CopyBlock label="Option B · direct, no server needed (stdio, this computer only)" text={created.commands.stdio} />
          <CopyBlock label="Check the connection" text={created.commands.verify} />
          <CopyBlock label="Try it" text={created.commands.try} />
        </section>
      )}

      <section className="card">
        <h2>Active tokens</h2>
        {tokens.length === 0 ? <p className="muted">No tokens yet.</p> : (
          <table className="table">
            <thead><tr><th>Name</th><th>Token</th><th>Access</th><th>Last used</th><th /></tr></thead>
            <tbody>
              {tokens.map((t) => (
                <tr key={t.id}>
                  <td>{t.name}</td><td><code>{t.prefix}…</code></td><td>{t.allow_write ? "Read + notes/focus" : "Read only"}</td>
                  <td>{t.last_used_at ? new Date(t.last_used_at).toLocaleString() : "never"}</td>
                  <td><button className="btn ghost small danger" onClick={() => revoke(t.id)}>Revoke</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <BrainTest />
    </ParentShell>
  );
}
