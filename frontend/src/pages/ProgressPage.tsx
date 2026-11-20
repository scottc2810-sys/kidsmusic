import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type GraphEdge, type GraphNode, type MemoryOverview, type Progress } from "../api";
import { ACTIVITY_LABEL, SKILL_LABEL } from "../i18n";
import { ProgressTracker } from "../components/ProgressTracker";
import { ParentShell, Toast } from "./ParentShell";

const KIND_COLOR: Record<string, string> = {
  child: "var(--brand)", skill: "#3a86ff", activity: "#3bceac", song: "#ff9f1c", session: "#8d99ae", mistake: "#ff5a5f", recording: "#c77dff", note: "#ffd23f",
};

export function ProgressPage() {
  const { id = "" } = useParams();
  const [p, setP] = useState<Progress | null>(null);
  const [mem, setMem] = useState<MemoryOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [noteSkill, setNoteSkill] = useState("");
  const load = () => Promise.all([api.progress(id).then(setP), api.memory(id).then(setMem)]).catch((e) => setError(e.message));
  useEffect(() => { void load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!p || !mem) return <ParentShell title="Progress" back="/parent"><Toast msg={error} kind="error" /><div className="spinner" /></ParentShell>;

  const addNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!note.trim()) return;
    await api.addNote(id, note.trim(), noteSkill || undefined).catch((err) => setError(err.message));
    setNote("");
    void load();
  };

  return (
    <ParentShell title={`${mem.child.name}'s progress`} back="/parent">
      <Toast msg={error} kind="error" />
      <ProgressTracker childId={id} name={mem.child.name} />
      <section className="card">
        <div className="row spread">
          <div>
            <h2>Level {p.level}: {p.level_name}</h2>
            <p className="muted small">Progress is based on what {mem.child.name} can actually do, not minutes practised.</p>
          </div>
          <div className="row wrap">
            <Link to={`/parent/child/${id}/chat`} className="btn ghost">💬 Talk to Melo about {mem.child.name}</Link>
            <Link to={`/play/${id}`} className="btn">▶ Start a lesson</Link>
          </div>
        </div>
        <div className="skills">
          {Object.entries(p.skills).map(([k, s]) => (
            <div key={k} className={`skill ${p.core_skills.includes(k) ? "core" : ""}`}>
              <div className="row spread small"><span>{SKILL_LABEL[k] ?? k}{p.core_skills.includes(k) ? " ★" : ""}</span><span>{Math.round(s.mastery * 100)}% · difficulty {s.difficulty}/5</span></div>
              <div className="bar"><div style={{ width: `${s.mastery * 100}%` }} /><span className="target" style={{ left: "70%" }} title="Level-up target" /></div>
            </div>
          ))}
        </div>
        <p className="muted small">★ skills needed for the next level (70% mastery with at least 4 tries each).</p>
      </section>

      <section className="card">
        <h2>🧠 Melo's memory</h2>
        <p className="muted small">A linked learning graph: {mem.graph.nodes} things remembered, {mem.graph.edges} connections. Claude Code can read it too — see <Link to="/parent/connect">Connect Claude Code</Link>.</p>
        <div className="grid two">
          <div>
            <h3>Going well</h3>
            {mem.strengths.length ? <ul>{mem.strengths.map((s) => <li key={s.node}>{SKILL_LABEL[s.label] ?? s.label}</li>)}</ul> : <p className="muted small">Still exploring — strengths appear after a few lessons.</p>}
            <h3>Needs a little more practice</h3>
            {mem.struggles.length ? <ul>{mem.struggles.map((s) => <li key={s.node}>{s.kind === "skill" ? SKILL_LABEL[s.label] ?? s.label : s.label}</li>)}</ul> : <p className="muted small">Nothing stands out.</p>}
            <h3>Songs</h3>
            <p className="small">Learned: {mem.songs.learned.join(", ") || "—"}<br />Learning: {mem.songs.learning.join(", ") || "—"}</p>
          </div>
          <div>
            <h3>Melo's suggestion</h3>
            <ul>{mem.recommendation.suggestions.map((s, i) => <li key={i}>{s}</li>)}</ul>
            <label className="small">Lesson focus
              <select value={mem.focus_override ?? ""} onChange={async (e) => { await api.setFocus(id, e.target.value || null).catch((err) => setError(err.message)); void load(); }}>
                <option value="">Automatic (Melo decides)</option>
                {Object.keys(p.skills).map((k) => <option key={k} value={k}>{SKILL_LABEL[k] ?? k}</option>)}
              </select>
            </label>
            <form onSubmit={addNote} className="form compact">
              <label className="small">Add a note to Melo's memory
                <textarea rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Loves drums, gets tired after 4 minutes" />
              </label>
              <div className="row">
                <select value={noteSkill} onChange={(e) => setNoteSkill(e.target.value)} aria-label="Note about skill">
                  <option value="">About: general</option>
                  {Object.keys(p.skills).map((k) => <option key={k} value={k}>About: {SKILL_LABEL[k] ?? k}</option>)}
                </select>
                <button className="btn small">Save note</button>
              </div>
            </form>
          </div>
        </div>
        <GraphView childId={id} />
      </section>

      <section className="card">
        <h2>Timeline</h2>
        {mem.recent.length === 0 ? <p className="muted">No events yet.</p> : (
          <ul className="timeline">
            {mem.recent.map((e, i) => <li key={i}><span className={`tag ${e.kind}`}>{e.kind.replace("_", " ")}</span> {e.summary} <span className="muted small">{new Date(e.at).toLocaleString()}</span></li>)}
          </ul>
        )}
      </section>

      <section className="card">
        <h2>Recent lessons</h2>
        {p.sessions.length === 0 ? <p className="muted">No lessons yet.</p> : (
          <table className="table">
            <thead><tr><th>When</th><th>Mode</th><th>Activities</th><th>Successes</th><th>Stars</th><th>Focus</th><th>Ended</th></tr></thead>
            <tbody>{p.sessions.map((s) => (
              <tr key={s.id}><td>{new Date(s.started_at).toLocaleString()}</td><td>{s.mode}</td><td>{s.activities}</td><td>{s.successes}</td><td>⭐ {s.stars}</td>
                <td>{s.focus ? SKILL_LABEL[s.focus] ?? s.focus : "—"}</td><td>{s.end_reason ?? "in progress"}</td></tr>
            ))}</tbody>
          </table>
        )}
        <h3>Activities tried</h3>
        <div className="chips">
          {Object.entries(p.activity_stats).map(([k, v]) => (
            <span key={k} className="chip">{ACTIVITY_LABEL[k] ?? k}: {(v.success ?? 0)}✓ {(v.partial ?? 0)}~ {(v.miss ?? 0)}·{v.uncertain ? ` ${v.uncertain}?` : ""}</span>
          ))}
        </div>
        <p className="muted small">✓ success · ~ partly · “·” tried again · ? Melo couldn't hear clearly (never counted against the child)</p>
      </section>
    </ParentShell>
  );
}

/** Small radial graph explorer: click a node to re-centre on it. */
function GraphView({ childId }: { childId: string }) {
  const [center, setCenter] = useState<string | undefined>(undefined);
  const [g, setG] = useState<{ nodes: GraphNode[]; edges: GraphEdge[] } | null>(null);
  useEffect(() => { api.memoryGraph(childId, center, 1).then(setG).catch(() => setG(null)); }, [childId, center]);

  const layout = useMemo(() => {
    if (!g || !g.nodes.length) return null;
    const rootId = center ?? g.nodes.find((n) => n.kind === "child")?.id ?? g.nodes[0].id;
    const others = g.nodes.filter((n) => n.id !== rootId).slice(0, 24);
    const pos: Record<string, { x: number; y: number }> = { [rootId]: { x: 300, y: 190 } };
    others.forEach((n, i) => {
      const a = (i / Math.max(1, others.length)) * Math.PI * 2 - Math.PI / 2;
      pos[n.id] = { x: 300 + Math.cos(a) * 230, y: 190 + Math.sin(a) * 150 };
    });
    return { rootId, nodes: [g.nodes.find((n) => n.id === rootId)!, ...others].filter(Boolean), pos };
  }, [g, center]);

  if (!layout) return null;
  const nodeName = (n: GraphNode) => (n.kind === "skill" ? SKILL_LABEL[n.label] ?? n.label : n.kind === "activity" ? ACTIVITY_LABEL[n.label] ?? n.label : n.label);
  return (
    <div className="graph">
      <div className="row spread small">
        <span className="muted">Click a bubble to explore its connections.</span>
        {center && <button className="link" onClick={() => setCenter(undefined)}>⟲ Back to child</button>}
      </div>
      <svg viewBox="0 0 600 380" role="img" aria-label="Learning graph">
        {g!.edges.map((e, i) => {
          const a = layout.pos[e.src], b = layout.pos[e.dst];
          if (!a || !b) return null;
          return (
            <g key={i}>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--line)" strokeWidth={1 + Math.min(4, e.weight)} />
              <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2} className="edge-label">{e.rel.toLowerCase().replace("_", " ")}</text>
            </g>
          );
        })}
        {layout.nodes.map((n) => {
          const p = layout.pos[n.id];
          return (
            <g key={n.id} className="gnode" onClick={() => setCenter(n.id)} tabIndex={0} role="button" aria-label={`${n.kind}: ${nodeName(n)}`}
              onKeyDown={(e) => e.key === "Enter" && setCenter(n.id)}>
              <circle cx={p.x} cy={p.y} r={n.id === layout.rootId ? 30 : 20} fill={KIND_COLOR[n.kind] ?? "#999"} />
              <text x={p.x} y={p.y + (n.id === layout.rootId ? 44 : 33)} className="node-label">{nodeName(n).slice(0, 22)}</text>
            </g>
          );
        })}
      </svg>
      <div className="legend small">{Object.entries(KIND_COLOR).map(([k, c]) => <span key={k}><i style={{ background: c }} />{k}</span>)}</div>
    </div>
  );
}
