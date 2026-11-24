// The family's plan: free or family. A parent pastes the licence key from their purchase email here; it is
// checked on this computer (no account, no internet). BUY_URL (Legal.tsx) is the shop page, filled before launch.
import { useEffect, useState } from "react";
import { api, type PlanStatus } from "../api";
import { loadPlan } from "../plan";
import { BUY_URL } from "./Legal";
import { ParentShell } from "./ParentShell";

const FREE_ROWS: [keyof PlanStatus["limits"], (n: number) => string][] = [
  ["children", (n) => `${n} child profile${n === 1 ? "" : "s"}`],
  ["songs", (n) => `the first ${n} songs in Song school (music basics are all included)`],
  ["languages", (n) => `${n} language${n === 1 ? "" : "s"} per child`],
  ["topics_per_strand", (n) => `the first ${n} topics of every group in maths, science, money and Vedas`],
];

export function PlanPage() {
  const [st, setSt] = useState<PlanStatus | null>(null);
  const [key, setKey] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.licence().then(setSt).catch(() => {}); }, []);

  const add = async () => {
    setBusy(true); setMsg(null);
    try {
      const s = await api.licenceAdd(key.trim());
      setSt(s); setKey(""); void loadPlan(true);
      setMsg({ ok: true, text: "Thank you! The family plan is on: every song, language and topic is open." });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!confirm("Remove the licence key from this computer? Melo goes back to the free plan; progress stays.")) return;
    setSt(await api.licenceRemove()); void loadPlan(true);
  };

  return (
    <ParentShell title="Your plan" back="/parent">
      {!st ? <div className="spinner" /> : (
        <section className="card plan-card">
          <h2>{st.plan === "family" ? "⭐ Family plan" : "Free plan"}</h2>
          {st.edition === "dev" && <p className="small muted">This is the owner's copy: everything is open.</p>}
          {st.plan === "family" && st.licence && (
            <p>Licensed to {st.licence.to || "your family"}{st.licence.expires ? `, until ${st.licence.expires}` : ""}.
              <button className="btn ghost small" onClick={() => void remove()}>Remove key</button></p>
          )}
          {st.plan === "free" && (
            <>
              <p>The free plan includes:</p>
              <ul>{FREE_ROWS.map(([k, f]) => st.limits[k] != null && <li key={k}>{f(st.limits[k] as number)}</li>)}</ul>
              <p>The <strong>family plan</strong> opens everything: up to 8 children, every song, every language and
                every topic, and all new lessons as they come.</p>
              {BUY_URL && <a className="btn big" href={BUY_URL} target="_blank" rel="noreferrer noopener">Get the family plan</a>}
              <label>Have a licence key? Paste it here
                <textarea rows={3} value={key} onChange={(e) => setKey(e.target.value)} placeholder="MELO1-..." spellCheck={false} />
              </label>
              <button className="btn" disabled={busy || key.trim().length < 10} onClick={() => void add()}>{busy ? "…" : "Activate"}</button>
            </>
          )}
          {msg && <p className={msg.ok ? "notice" : "error"} role="status">{msg.text}</p>}
        </section>
      )}
    </ParentShell>
  );
}
