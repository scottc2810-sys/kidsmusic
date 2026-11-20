// Parent / teacher view of the progress tracker: one spider chart per learning area (music, each language,
// learning habits). Each score = 80 % measured from the child's activities + 20 % assessed by a teacher,
// a parent or the AI teacher. Shows what is strong, what is developing, what to do next, every parameter of
// the assessment guide with its evidence, and the assessments themselves (with their quality fields), which
// a parent can reject when they are wrong. Updated after every activity; refreshes while open.
import { useEffect, useMemo, useState } from "react";
import { api, type TeacherPlan, type Tracker, type TrackerArea, type TrackerAxis, type TrackerParam } from "../api";
import { SpiderChart } from "./SpiderChart";

const SOURCE_TAG: Record<string, string> = { ai: "🤖 AI teacher", teacher: "🧑‍🏫 Teacher", parent: "👪 Parent", child: "🧒 Child", system: "⚙️ System" };

export function ProgressTracker({ childId, name }: { childId: string; name: string }) {
  const [t, setT] = useState<Tracker | null>(null);
  const [areaId, setAreaId] = useState("music");
  const [msg, setMsg] = useState<string | null>(null);
  const [form, setForm] = useState({ axis: "", score: 60, note: "", source: "teacher" as "teacher" | "parent", withScore: true });
  const [group, setGroup] = useState("Common");
  const [lens, setLens] = useState<string | null>(null); // null = by area; else one skill across areas
  const [q, setQ] = useState("");
  const [show, setShow] = useState<"all" | "evidence" | "teacher">("all");
  const [bandFilter, setBandFilter] = useState("");
  const [plan, setPlan] = useState<TeacherPlan | null>(null);
  const [planBusy, setPlanBusy] = useState(false);
  const load = () => api.tracker(childId, lens).then((x) => {
    setT(x);
    if (!x.areas.some((a) => a.id === areaId)) setAreaId(x.areas[0]?.id ?? "music");
  }).catch((e) => setMsg((e as Error).message));
  useEffect(() => { void load(); const id = window.setInterval(() => void load(), 30000); return () => clearInterval(id); }, [childId, lens]); // eslint-disable-line react-hooks/exhaustive-deps

  const area: TrackerArea | undefined = t?.areas.find((a) => a.id === areaId);
  const view = lens ? t?.lens_view : null;
  const allParams: TrackerParam[] = view ? view.parameters : t?.parameters ?? [];
  const groups = useMemo(() => [...new Set(allParams.map((p) => p.group))], [allParams]);
  const activeGroup = groups.includes(group) ? group : groups[0];
  const params = allParams.filter((p) => (q ? `${p.name} ${p.definition}`.toLowerCase().includes(q.toLowerCase()) : p.group === activeGroup))
    .filter((p) => show === "all" || (show === "evidence" ? p.score != null || !!p.info : !p.measure))
    .filter((p) => !bandFilter || p.band === bandFilter);
  const chartAxes: TrackerAxis[] = view ? view.axes : area?.axes ?? [];
  const summarize = async () => {
    setPlanBusy(true); setPlan(null);
    try { setPlan(await api.trackerSummary(childId, lens)); } catch (e) { setMsg((e as Error).message); } finally { setPlanBusy(false); }
  };
  if (!t) return <section className="card"><h2>📊 Progress tracker</h2>{msg ? <p className="error">{msg}</p> : <div className="spinner" />}</section>;

  const assess = async () => { setMsg(null); const r = await api.assessNow(childId).catch((e) => ({ started: false, message: (e as Error).message })); setMsg(r.message); window.setTimeout(() => void load(), 8000); };
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!area || !form.axis) return;
    await api.addAssessment(childId, { area: area.id, axis: form.axis, score: form.withScore ? form.score : null, note: form.note, source: form.source })
      .then(() => { setForm({ ...form, note: "" }); setMsg("Saved: it counts as the 20 % assessed part of that skill."); void load(); })
      .catch((err) => setMsg((err as Error).message));
  };
  const reject = async (id: number, status: "active" | "rejected") => { await api.setAssessmentStatus(childId, id, status).catch(() => {}); void load(); };
  const teacherNote = t.assessments?.find((a) => a.axis === "teacher_note" && a.status === "active");

  return (
    <section className="card tracker">
      <div className="row spread wrap">
        <div>
          <h2>📊 Progress tracker</h2>
          <p className="muted small">Each score: <strong>{Math.round(t.weights.measured * 100)}% measured</strong> from what {name} did in Melo, updated after every activity,
            {" "}+ <strong>{Math.round(t.weights.assessed * 100)}% assessed</strong> by a teacher, a parent or the AI teacher.
            {t.compared_with ? ` Dashed line: ${t.compared_with}.` : " The dashed comparison line appears after two weeks of practice."}</p>
        </div>
        <button className="btn ghost small" onClick={() => void assess()}>🤖 Ask the AI teacher to review</button>
      </div>
      <div className="tracker-filters">
        <span className="muted small">By area</span>
        <div className="topic-chips" role="tablist" aria-label="Learning areas">
          {t.areas.map((a) => (
            <button key={a.id} role="tab" aria-selected={!lens && a.id === areaId} className={`skill-chip${!lens && a.id === areaId ? " sel" : ""}`}
              onClick={() => { setLens(null); setAreaId(a.id); }}>
              {a.emoji} {a.title}{a.score != null && <small> {Math.round(a.score)}</small>}
            </button>
          ))}
        </div>
        <span className="muted small">Or one skill everywhere</span>
        <div className="topic-chips" role="tablist" aria-label="Skills">
          {(t.lenses ?? []).map((l) => (
            <button key={l.id} role="tab" aria-selected={lens === l.id} className={`skill-chip${lens === l.id ? " sel" : ""}`} onClick={() => setLens(l.id)}>{l.title}</button>
          ))}
        </div>
      </div>
      {view && chartAxes.length === 0 && <p className="muted">No language has been practised yet, so there is nothing to show for {view.title}.</p>}
      {(view ? chartAxes.length > 0 : area) && (
        <div className="tracker-grid">
          <SpiderChart title={view ? `${view.title}${view.axes.length < 3 ? " (one point per language)" : ""}` : `${area!.emoji} ${area!.title}`} axes={chartAxes.map((x) => ({
            id: x.id, label: x.label, emoji: x.emoji, value: x.final, before: x.before, band: x.band,
            detail: `${x.source}${x.n ? ` · ${x.n} activities` : ""}${x.evidence === "limited" ? " · limited evidence" : ""}${x.trend != null ? ` · ${x.trend >= 0 ? "+" : ""}${Math.round(x.trend)} in 2 weeks` : ""}`,
          }))} />
          <div className="tracker-side">
            {(view ?? area)!.strengths.length > 0 && <p><strong>🌟 Strengths:</strong> {(view ?? area)!.strengths.join(", ")}</p>}
            {(view ?? area)!.developing.length > 0 && <p><strong>🌱 Developing:</strong> {(view ?? area)!.developing.join(", ")}</p>}
            {!view && area!.not_assessed.length > 0 && <p className="muted small"><strong>Not tried enough yet:</strong> {area!.not_assessed.join(", ")}</p>}
            <ul className="small tracker-axes">
              {chartAxes.map((x) => (
                <li key={x.id}>
                  <span>{x.emoji} {x.label}</span>
                  <span className="band">{x.final == null ? <em className="muted">not yet</em> : <>{Math.round(x.final)} · {x.band}</>}</span>
                  <small className="muted">{x.measured != null ? `measured ${Math.round(x.measured)}` : ""}{x.assessed ? ` · ${SOURCE_TAG[x.assessed.source] ?? x.assessed.source} ${Math.round(x.assessed.score)}${x.assessed.stale ? " (old)" : ""}` : ""}</small>
                </li>
              ))}
            </ul>
            {teacherNote && <p className="notice small">🤖 <strong>AI teacher:</strong> {teacherNote.note}</p>}
          </div>
        </div>
      )}
      <div className="row wrap">
        <button className="btn" onClick={() => void summarize()} disabled={planBusy}>
          {planBusy ? "Writing the summary…" : `📝 Summary & next lesson plan${view ? ` (${view.title})` : ""}`}
        </button>
      </div>
      {plan && (
        <div className="teacher-plan card-inset" aria-live="polite">
          <p><strong>{plan.source === "ai" ? "🤖 AI teacher" : "📋 From the tracker"}:</strong> {plan.summary}</p>
          {plan.understands.length > 0 && <><strong>Understands</strong><ul className="small">{plan.understands.map((u) => <li key={u}>{u}</li>)}</ul></>}
          {plan.working_on.length > 0 && <><strong>Still developing</strong><ul className="small">{plan.working_on.map((u) => <li key={u}>{u}</li>)}</ul></>}
          <strong>Next lesson</strong>
          <ol className="small">{plan.next_activities.map((a, i) => <li key={i}><strong>{a.activity}</strong> · {a.minutes} min. <span className="muted">{a.why}</span></li>)}</ol>
          {plan.home_tip && <p className="small">🏠 {plan.home_tip}</p>}
        </div>
      )}
      {t.recommendations.length > 0 && (
        <>
          <h3>Next steps</h3>
          <ul className="small">{t.recommendations.map((r, i) => <li key={i}>{t.areas.find((a) => a.id === r.area)?.emoji} {r.reason}</li>)}</ul>
        </>
      )}

      <details className="tracker-more">
        <summary>🧑‍🏫 Add a teacher or parent assessment</summary>
        {area && !view && (
          <form className="form" onSubmit={(e) => void save(e)}>
            <label>Skill ({area.title})
              <select value={form.axis} onChange={(e) => setForm({ ...form, axis: e.target.value })} required>
                <option value="">Choose…</option>
                {area.axes.map((x) => <option key={x.id} value={x.id}>{x.emoji} {x.label}</option>)}
              </select>
            </label>
            <label className="check"><input type="checkbox" checked={form.withScore} onChange={(e) => setForm({ ...form, withScore: e.target.checked })} /> Give a score (else a note only)</label>
            {form.withScore && (
              <label>Score: {form.score} · {t.bands.find((b) => form.score <= b.max)?.label}
                <input type="range" min={0} max={100} step={5} value={form.score} onChange={(e) => setForm({ ...form, score: Number(e.target.value) })} />
              </label>
            )}
            <label>What you saw<input value={form.note} maxLength={500} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="e.g. plays the C scale at home without help" /></label>
            <label>I am a
              <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value as "teacher" | "parent" })}><option value="teacher">teacher</option><option value="parent">parent</option></select>
            </label>
            <button className="btn">Save assessment</button>
          </form>
        )}
      </details>

      <details className="tracker-more">
        <summary>📋 {view ? `${view.title} parameters (${allParams.length})` : `All ${t.coverage?.total} parameters (${t.coverage?.measured} measured by the app, ${t.coverage?.with_evidence} with evidence so far)`}</summary>
        <div className="row wrap param-filters">
          <input type="search" placeholder="Search parameters…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search parameters" />
          <select value={show} onChange={(e) => setShow(e.target.value as typeof show)} aria-label="Show">
            <option value="all">All</option><option value="evidence">With evidence</option><option value="teacher">Needs a teacher / AI</option>
          </select>
          <select value={bandFilter} onChange={(e) => setBandFilter(e.target.value)} aria-label="Band">
            <option value="">Any band</option>{t.bands.map((b) => <option key={b.label} value={b.label}>{b.label}</option>)}
          </select>
        </div>
        {!q && <div className="topic-chips">{groups.map((g) => <button key={g} className={`skill-chip${g === activeGroup ? " sel" : ""}`} onClick={() => setGroup(g)}>{g}</button>)}</div>}
        <table className="table small">
          <thead><tr><th>Parameter</th><th>Score</th><th>Band</th><th>Evidence</th><th>How</th></tr></thead>
          <tbody>{params.length === 0 && <tr><td colSpan={5} className="muted">No parameter matches these filters.</td></tr>}
            {params.map((p) => (
            <tr key={`${p.group}/${p.name}`} title={p.definition}>
              <td>{p.name}<br /><small className="muted">{p.definition}</small></td>
              <td>{p.score != null ? Math.round(p.score) : p.info ?? <span className="muted">–</span>}</td>
              <td>{p.band ?? ""}</td><td>{p.n || ""}</td><td className="muted">{p.how}</td>
            </tr>
          ))}</tbody>
        </table>
      </details>

      <details className="tracker-more">
        <summary>🔎 Assessments and their quality ({t.assessments?.length ?? 0})</summary>
        {(t.assessments ?? []).length === 0 ? <p className="muted small">None yet. Turn on the AI brain for {name}, or add a teacher assessment above.</p> : (
          <table className="table small">
            <thead><tr><th>When</th><th>Who</th><th>Skill</th><th>Score</th><th>Note</th><th>Quality</th><th /></tr></thead>
            <tbody>{(t.assessments ?? []).map((a) => (
              <tr key={a.id} className={a.status === "rejected" ? "muted" : ""}>
                <td>{new Date(a.at).toLocaleString()}</td><td>{SOURCE_TAG[a.source] ?? a.source}</td><td>{a.area} / {a.axis}</td>
                <td>{a.score != null ? `${Math.round(a.score)} (${a.band})` : "–"}</td><td>{a.note}</td>
                <td><small>{String(a.quality.assessment_validity ?? "")}{a.source === "ai" ? ` · confidence ${a.confidence}` : ""}{a.quality.model_name ? ` · ${a.quality.model_name}${a.quality.model_version ? ` ${a.quality.model_version}` : ""}` : ""}
                  {a.quality.limitations ? ` · ${a.quality.limitations}` : ""}{a.quality.pace && a.quality.pace !== "same" ? ` · pace ${a.quality.pace}` : ""}</small></td>
                <td>{a.score != null && a.source !== "child" && (a.status === "active"
                  ? <button className="btn ghost small" onClick={() => void reject(a.id, "rejected")}>Reject</button>
                  : <button className="btn ghost small" onClick={() => void reject(a.id, "active")}>Restore</button>)}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </details>
      <details className="tracker-more">
        <summary>ℹ️ How to read this</summary>
        <ul className="small muted">
          {t.bands.map((b, i) => <li key={b.label}>{i ? t.bands[i - 1].max + 1 : 0}–{b.max}: {b.label}</li>)}
          {t.limitations.map((l) => <li key={l}>{l}</li>)}
          <li>Outliers left out: {t.quality.rushed_excluded} accidental taps (answered under 0.6 s), {t.quality.disengaged_excluded} activities in long runs of skips.</li>
        </ul>
      </details>
      {msg && <p className="small notice" aria-live="polite">{msg}</p>}
    </section>
  );
}
