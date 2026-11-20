// Talk to Melo's AI teacher about your child. Say what you (or your child) want to achieve or what should
// change; Melo answers and proposes concrete changes, each with an Apply button. Nothing changes until you
// apply it. The conversation is kept on this computer with a running summary, so the AI teacher remembers
// earlier talks in a new session too. Works without an AI brain for the common requests.
import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type ParentAction, type ParentPlan } from "../api";
import { ParentShell, Toast } from "./ParentShell";

type Msg = { from: "user" | "melo"; text: string; actions?: ParentAction[] };

const EXAMPLES = [
  "Add a music lesson for the Mahamrityunjaya mantra",
  "She gets frustrated quickly. Please go slower and use more games.",
  "Goal: play Happy Birthday on the keyboard by her birthday next month",
  "Add phrases for shopping at the market in Hindi",
  "He finds rhythm hard. Work on rhythm in the next lessons.",
  "Lessons of 8 minutes please",
];

export function ParentChat() {
  const { id = "" } = useParams();
  const [plan, setPlan] = useState<ParentPlan | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Record<string, { ok: boolean; message: string; link?: string }>>({});
  const [error, setError] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const [name, setName] = useState("your child");

  useEffect(() => {
    api.child(id).then((c) => setName(c.name)).catch(() => {});
    api.parentPlan(id).then((p) => { setPlan(p); setMsgs(p.history.map((h) => ({ from: h.from, text: h.text }))); }).catch((e) => setError(e.message));
  }, [id]);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [msgs]);

  const send = async (message: string) => {
    if (!message.trim() || busy) return;
    setBusy(true); setError(null); setText("");
    setMsgs((m) => [...m, { from: "user", text: message }]);
    try {
      const r = await api.parentChat(id, message, msgs.slice(-6).map(({ from, text: t }) => ({ from, text: t })));
      setMsgs((m) => [...m, { from: "melo", text: r.reply + (r.source === "offline" ? " (offline helper)" : ""), actions: r.actions }]);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const apply = async (a: ParentAction) => {
    setDone((d) => ({ ...d, [a.id]: { ok: true, message: "Applying…" } }));
    try {
      const r = await api.parentApply(id, a);
      setDone((d) => ({ ...d, [a.id]: r })); setPlan((p) => (p ? { ...p, ...r.plan } : p));
    } catch (e) { setDone((d) => ({ ...d, [a.id]: { ok: false, message: (e as Error).message } })); }
  };
  const remove = async (kind: "goals" | "tactics", i: number) => { const p = await api.parentPlanRemove(id, kind, i).catch(() => null); if (p) setPlan((x) => (x ? { ...x, ...p } : x)); };

  return (
    <ParentShell title={`Talk to Melo about ${name}`} back={`/parent/child/${id}/progress`}>
      <Toast msg={error} kind="error" />
      <div className="pchat-grid">
        <section className="card pchat">
          <p className="muted small">Tell Melo what you or {name} want to achieve, what is hard, or what to change. Melo suggests changes; <strong>nothing changes until you tap Apply</strong>.
            Melo remembers this conversation (a summary is kept on this computer) and uses it in every lesson plan.</p>
          <div className="pchat-log" aria-live="polite">
            {msgs.length === 0 && (
              <div className="pchat-examples">
                <p className="small">Try for example:</p>
                {EXAMPLES.map((e) => <button key={e} className="skill-chip" onClick={() => void send(e)}>{e}</button>)}
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={`pchat-msg ${m.from}`}>
                <div className="pchat-bubble">{m.text}</div>
                {m.actions && m.actions.length > 0 && (
                  <div className="pchat-actions">
                    {m.actions.map((a) => {
                      const r = done[a.id];
                      return (
                        <div key={a.id} className={`pchat-action${r ? (r.ok ? " ok" : " bad") : ""}`}>
                          <span>{ICON[a.type] ?? "✨"} {a.label}</span>
                          {!r && <button className="btn small" onClick={() => void apply(a)}>Apply</button>}
                          {r && <small>{r.ok ? "✓ " : "⚠️ "}{r.message} {r.link && <Link to={r.link}>Open →</Link>}</small>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
            {busy && <div className="pchat-msg melo"><div className="pchat-bubble muted">Melo is thinking…</div></div>}
            <div ref={end} />
          </div>
          <form className="pchat-input" onSubmit={(e) => { e.preventDefault(); void send(text); }}>
            <textarea rows={2} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} placeholder={`What would you like for ${name}?`}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(text); } }} aria-label="Message to Melo" />
            <button className="btn" disabled={busy || !text.trim()}>Send</button>
          </form>
        </section>
        <aside className="card pchat-plan">
          <h2>📌 {name}'s plan</h2>
          {!plan ? <div className="spinner" /> : (
            <>
              <h3>Goals</h3>
              {plan.goals.length ? <ul className="small">{plan.goals.map((g, i) => <li key={i}>{g.text} <button className="link-btn" onClick={() => void remove("goals", i)}>remove</button></li>)}</ul>
                : <p className="muted small">None yet.</p>}
              <h3>How Melo teaches</h3>
              {plan.tactics.length ? <ul className="small">{plan.tactics.map((t, i) => <li key={i}>{t.text} <button className="link-btn" onClick={() => void remove("tactics", i)}>remove</button></li>)}</ul>
                : <p className="muted small">Melo's normal way: adapts to every answer.</p>}
              <p className="small"><strong>Music focus:</strong> {plan.focus ?? "chosen by Melo"} · <strong>Lesson length:</strong> {plan.minutes} min</p>
              {plan.custom_songs.length > 0 && <><h3>Songs made for {name}</h3><ul className="small">{plan.custom_songs.map((s) => <li key={s.id}><Link to={`/play/${id}/songs/${s.id}`}>{s.title}</Link></li>)}</ul></>}
              {plan.custom_topics.length > 0 && <><h3>Conversation topics made for {name}</h3><ul className="small">{plan.custom_topics.map((t) => <li key={t.id}>{t.emoji} {t.title} ({t.phrases} phrases)</li>)}</ul></>}
              {plan.summary && <><h3>What Melo remembers from your talks</h3><p className="small muted">{plan.summary}</p></>}
            </>
          )}
        </aside>
      </div>
    </ParentShell>
  );
}

const ICON: Record<string, string> = {
  set_goal: "🎯", set_focus: "🔎", set_tactic: "🧭", set_minutes: "⏱️", open_song: "🎵", add_song: "🎼", practice_topic: "💬", add_phrases: "🆕", note: "📝",
};
