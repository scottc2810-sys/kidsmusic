// Language lessons from the family's own material: a photo of the school word list or a book page, a link,
// or a few lines. The AI brain picks child-sized words and phrases, translates them, and they become a
// personal topic in the language lessons (with native or neural voices, "why" explanations and all skills).
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type Child, type LearnLanguage } from "../api";
import { ParentShell, Toast } from "./ParentShell";

export function LanguageMaterial() {
  const { id = "" } = useParams();
  const [child, setChild] = useState<Child | null>(null);
  const [langs, setLangs] = useState<LearnLanguage[]>([]);
  const [chosen, setChosen] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [urls, setUrls] = useState("");
  const [notes, setNotes] = useState("");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<{ message: string; link: string; phrases: string[] } | null>(null);

  useEffect(() => {
    api.child(id).then(setChild).catch((e) => setErr((e as Error).message));
    api.learnLanguages().then(setLangs).catch(() => {});
    api.learnOverview(id).then((o) => setChosen(o.filter((s) => s.started).map((s) => s.language.code).slice(0, 3))).catch(() => {});
  }, [id]);

  const make = async () => {
    setBusy(true); setErr(null); setDone(null);
    try { setDone(await api.learnMaterial(id, files, urls, notes, chosen, title)); setFiles([]); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  if (!child) return <ParentShell title="Own words" back="/parent"><Toast msg={err} kind="error" /><div className="spinner" /></ParentShell>;
  return (
    <ParentShell title={`📚 Teach ${child.name} from your own material`} back="/parent">
      <section className="card">
        <p>Take a photo of {child.name}'s school word list, a page of a favourite book, or paste a link or a few lines. Melo picks up to six
          child-sized words or phrases, translates them and makes a personal topic in the language lessons, with voices, pictures and the
          “why” behind every answer. Photos are only read, never stored. This needs the AI brain to be on for {child.name}.</p>
        <Toast msg={err} kind="error" />
        {done && <div className="notice" role="status">✓ {done.message} <em>({done.phrases.join(", ")})</em> <Link className="btn small" to={done.link}>▶ Open the lesson</Link></div>}
      </section>
      <section className="card">
        <label className="btn ghost">📷 Add photos ({files.length}/4)
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => { setFiles([...files, ...Array.from(e.target.files ?? [])].slice(0, 4)); e.target.value = ""; }} />
        </label>
        {files.length > 0 && <p className="small muted">{files.map((f) => f.name).join(", ")} <button className="btn ghost small" onClick={() => setFiles([])}>✕</button></p>}
        <label>Links (one per line)
          <textarea rows={2} value={urls} onChange={(e) => setUrls(e.target.value)} placeholder="https://…" />
        </label>
        <label>Or type the words
          <textarea rows={3} maxLength={3000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. good morning, my school bag, may I drink water" />
        </label>
        <label>Topic name (optional)
          <input value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} placeholder="School words" />
        </label>
        <fieldset>
          <legend>Learn them in</legend>
          <div className="row wrap">
            {langs.filter((l) => l.code !== "en").map((l) => (
              <label key={l.code} className="check">
                <input type="checkbox" checked={chosen.includes(l.code)} onChange={(e) => setChosen(e.target.checked ? [...chosen, l.code] : chosen.filter((c) => c !== l.code))} />
                {l.flag} {l.name}
              </label>
            ))}
          </div>
        </fieldset>
        <button className="btn" onClick={() => void make()} disabled={busy || !chosen.length || (!files.length && !urls.trim() && !notes.trim())}>
          {busy ? "Melo is reading…" : "✨ Make lessons from this"}
        </button>
      </section>
    </ParentShell>
  );
}
