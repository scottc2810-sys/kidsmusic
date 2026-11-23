// The parent describes the child's own instrument: type, keys, stickers, photos and shop / maker links.
// "Let Melo read them" suggests the details (the AI brain looks at the photos when it is on for this child);
// the parent checks and saves. Lessons then show THIS instrument, fit songs into its keys and tell the
// child where each note is on it. "Use standard lessons" removes it again.
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, type Child, type InstrumentAnalysis, type InstrumentForm, type InstrumentKind } from "../api";
import { InstrumentView } from "../components/InstrumentView";
import { forgetInstrument, type InstrumentInfo } from "../teaching/instrument";
import { ParentShell, Toast } from "./ParentShell";

const LABELS: Record<string, string> = {
  none: "Nothing printed on the keys", numbers: "Numbers (1 2 3 … 7)", colors: "Colour stickers", letters: "Letters (C D E …)",
  sargam: "Sargam (Sa Re Ga …)", solfege: "Do Re Mi",
};
const COMMON_KEYS = [8, 13, 25, 32, 37, 44, 49, 54, 61, 76, 88];
const EMPTY: InstrumentForm = { kind: "toy_keyboard", name: "", keys: 37, first_key: "C", labels: "none", features: {}, sources: [], notes: "", summary: "", tips: [] };

const formOf = (x: InstrumentInfo): InstrumentForm => ({
  kind: x.kind, name: x.name ?? "", keys: x.keys ?? null, first_key: x.first_key ?? "C", labels: x.labels ?? "none", features: x.features ?? {},
  sources: (x.sources ?? []).map((s) => s.url), notes: x.notes ?? "", summary: x.summary ?? "", tips: x.tips ?? [],
});

export function InstrumentPage() {
  const { id = "" } = useParams();
  const [child, setChild] = useState<Child | null>(null);
  const [kinds, setKinds] = useState<InstrumentKind[]>([]);
  const [info, setInfo] = useState<InstrumentInfo | null>(null);
  const [form, setForm] = useState<InstrumentForm>(EMPTY);
  const [link, setLink] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [analysis, setAnalysis] = useState<InstrumentAnalysis | null>(null);

  useEffect(() => {
    api.child(id).then(setChild).catch((e) => setErr((e as Error).message));
    api.instrumentKinds().then((k) => setKinds(k.kinds)).catch(() => {});
    api.instrument(id).then((x) => { setInfo(x); if (x.set) setForm(formOf(x)); }).catch((e) => setErr((e as Error).message));
  }, [id]);

  const set = <K extends keyof InstrumentForm>(k: K, v: InstrumentForm[K]) => setForm((f) => ({ ...f, [k]: v }));
  const done = (x: InstrumentInfo, text: string) => { setInfo(x); forgetInstrument(id); setMsg(text); setErr(null); };
  const run = async (f: () => Promise<void>) => { setBusy(true); setErr(null); try { await f(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); } };

  const save = (f = form) => run(async () => done(await api.saveInstrument(id, f), "Saved ✓ Lessons now use this instrument."));
  const addLink = () => {
    const u = link.trim();
    if (!/^https?:\/\//i.test(u)) { setErr("Paste a full link starting with https://"); return; }
    if (form.sources.includes(u) || form.sources.length >= 4) return;
    const f = { ...form, sources: [...form.sources, u] };
    setForm(f); setLink(""); void save(f);
  };
  const upload = (files: FileList | null) => run(async () => {
    if (!info?.set) done(await api.saveInstrument(id, form), "");
    let x: InstrumentInfo | null = null;
    for (const file of Array.from(files ?? []).slice(0, 6)) x = await api.addInstrumentPhoto(id, file);
    if (x) done(x, "Photo added ✓ Now tap “Let Melo read them”.");
  });
  const analyze = () => run(async () => {
    done(await api.saveInstrument(id, form), "");
    const a = await api.analyzeInstrument(id);
    setAnalysis(a); setMsg(a.message);
  });
  const apply = () => {
    if (!analysis) return;
    const s = analysis.suggestion;
    const f: InstrumentForm = { ...form, kind: s.kind, name: s.name || form.name, keys: s.keys, first_key: s.first_key, labels: s.labels,
      features: { ...form.features, mic: s.mic, record: s.record, lights: s.lights, demo_songs: s.demo_songs }, summary: s.summary || form.summary, tips: s.tips.length ? s.tips : form.tips };
    setForm(f); setAnalysis(null); void save(f);
  };
  const reset = () => run(async () => {
    if (!confirm("Go back to the standard lessons? The photos and details of this instrument are removed.")) return;
    await api.resetInstrument(id); forgetInstrument(id);
    setInfo({ set: false, kind: "keyboard" }); setForm(EMPTY); setMsg("Back to the standard lessons.");
  });

  if (!child) return <ParentShell title="Instrument" back="/parent"><Toast msg={err} kind="error" /><div className="spinner" /></ParentShell>;
  const kind = kinds.find((k) => k.id === form.kind);
  const preview: InstrumentInfo = info?.set ? info : { set: false, kind: "keyboard" };
  return (
    <ParentShell title={`🎹 ${child.name}'s instrument`} back="/parent">
      <section className="card">
        <p>Tell Melo about the instrument {child.name} plays at home. Lessons will show the same instrument on screen, fit every song into its keys,
          use the same stickers, and tell {child.name} where each note is <em>on that instrument</em>. Skip this and Melo keeps the standard on-screen piano lessons.</p>
        <Toast msg={msg} /><Toast msg={err} kind="error" />
      </section>

      <section className="card">
        <h2>1. Photos and links (optional)</h2>
        <p className="muted small">A photo of the whole instrument from above, and a close-up of the keys or the panel, work best. Shop pages (Amazon, Flipkart, the maker's site)
          are read for the model name and features; many shops block programs, so also paste the product description below if you have it.
          Photos stay on this computer; they are shown to the AI brain only if it is turned on for {child.name}.</p>
        <div className="inst-photos">
          {(info?.photos ?? []).map((p) => (
            <figure key={p.id}>
              <img src={p.url} alt="Instrument" />
              <button className="btn ghost small" onClick={() => run(async () => done(await api.deleteInstrumentPhoto(id, p.id), "Photo removed"))} aria-label="Remove photo">✕</button>
            </figure>
          ))}
        </div>
        <label className="btn ghost">📷 Add photos
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => { void upload(e.target.files); e.target.value = ""; }} disabled={busy} />
        </label>
        <div className="row wrap">
          <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://www.amazon.in/…" aria-label="Product link" style={{ flex: 1, minWidth: 240 }} />
          <button className="btn ghost" onClick={addLink} disabled={busy || !link.trim()}>🔗 Add link</button>
        </div>
        <ul>
          {form.sources.map((u) => {
            const s = info?.sources?.find((x) => x.url === u);
            return <li key={u} className="small"><a href={u} target="_blank" rel="noreferrer noopener">{s?.title || u.slice(0, 80)}</a>
              {s?.found === false && <span className="muted"> · couldn't be read (paste the description below)</span>}
              {" "}<button className="btn ghost small" onClick={() => { const f = { ...form, sources: form.sources.filter((x) => x !== u) }; setForm(f); void save(f); }}>✕</button></li>;
          })}
        </ul>
        <label>Anything else (or paste the product description)
          <textarea rows={4} maxLength={4000} value={form.notes} onChange={(e) => set("notes", e.target.value)}
            placeholder="e.g. Blue 37-key kids keyboard with a microphone, numbers 1–7 on the keys, 8 demo songs" />
        </label>
        <button className="btn" onClick={() => void analyze()} disabled={busy}>{busy ? "Reading…" : "✨ Let Melo read them"}</button>
        {analysis && (
          <div className="card highlight">
            <p><strong>Melo thinks:</strong> {kinds.find((k) => k.id === analysis.suggestion.kind)?.label ?? analysis.suggestion.kind}
              {analysis.suggestion.keys ? `, ${analysis.suggestion.keys} keys` : ""}, leftmost white key {analysis.suggestion.first_key},
              keys show: {LABELS[analysis.suggestion.labels]}{analysis.suggestion.mic ? ", microphone" : ""}{analysis.suggestion.record ? ", recording" : ""}
              {analysis.suggestion.lights ? ", light-up keys" : ""}. <span className="muted">(confidence: {analysis.suggestion.confidence})</span></p>
            {analysis.suggestion.summary && <p>For {child.name}: “{analysis.suggestion.summary}”</p>}
            {analysis.suggestion.tips.length > 0 && <ul>{analysis.suggestion.tips.map((t) => <li key={t}>{t}</li>)}</ul>}
            {analysis.sources.filter((s) => !s.found).map((s) => <p key={s.url} className="muted small">⚠️ {s.url.slice(0, 60)}…: {s.reason}</p>)}
            <div className="row"><button className="btn" onClick={apply}>✓ Use these details</button><button className="btn ghost" onClick={() => setAnalysis(null)}>Ignore</button></div>
          </div>
        )}
      </section>

      <section className="card">
        <h2>2. Check the details</h2>
        <div className="row wrap">
          <label>Instrument
            <select value={form.kind} onChange={(e) => { const k = kinds.find((x) => x.id === e.target.value); setForm((f) => ({ ...f, kind: e.target.value, keys: k?.keys ?? f.keys, first_key: k?.first ?? f.first_key })); }}>
              {kinds.map((k) => <option key={k.id} value={k.id}>{k.emoji} {k.label}</option>)}
            </select>
          </label>
          <label>Name or model
            <input value={form.name} maxLength={80} onChange={(e) => set("name", e.target.value)} placeholder="e.g. the blue keyboard" />
          </label>
        </div>
        {kind?.layout !== "pads" && (
          <div className="row wrap">
            <label>{kind?.layout === "bars" ? "Number of bars" : "Number of keys"}
              <select value={form.keys ?? ""} onChange={(e) => set("keys", e.target.value ? Number(e.target.value) : null)}>
                {Array.from(new Set([...COMMON_KEYS, form.keys ?? 37])).sort((a, b) => a - b).map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <label>{kind?.layout === "bars" ? "Lowest (longest) bar" : "Leftmost white key"}
              <select value={form.first_key} onChange={(e) => set("first_key", e.target.value)}>
                {["C", "D", "E", "F", "G", "A", "B"].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <span className="muted small">Tip: C is the white key just left of a group of two black keys. Most 32- and 37-key kids' keyboards start on F or C.</span>
            </label>
            <label>What's on the keys
              <select value={form.labels} onChange={(e) => set("labels", e.target.value)}>
                {Object.entries(LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
          </div>
        )}
        <div className="row wrap">
          {(["mic", "record", "lights"] as const).map((f) => (
            <label key={f} className="check"><input type="checkbox" checked={!!form.features[f]} onChange={(e) => set("features", { ...form.features, [f]: e.target.checked })} />
              {{ mic: "🎤 Has a microphone", record: "⏺ Can record & play back", lights: "💡 Light-up keys" }[f]}</label>
          ))}
        </div>
        <label>What Melo says to {child.name} about it
          <input value={form.summary} maxLength={300} onChange={(e) => set("summary", e.target.value)} placeholder="your blue keyboard" />
        </label>
        {kind?.stand_in && <p className="muted small">There's no on-screen {kind.label.toLowerCase()} yet: lessons show keys with the same notes, and Melo reminds {child.name} to find them on the real instrument.</p>}
        <h3>Preview</h3>
        <InstrumentView inst={preview} lang={child.language} from={preview.low ?? 60} to={Math.min(preview.high ?? 72, (preview.low ?? 60) + 24)} tune={[60, 62, 64]} onPlay={() => {}} />
        {(info?.tips ?? []).length > 0 && <><h3>Tips for you</h3><ul>{info!.tips!.map((t) => <li key={t}>{t}</li>)}</ul></>}
        <div className="row">
          <button className="btn" onClick={() => void save()} disabled={busy}>💾 Save</button>
          {info?.set && <button className="btn ghost danger" onClick={() => void reset()} disabled={busy}>Use standard lessons</button>}
        </div>
      </section>
    </ParentShell>
  );
}
