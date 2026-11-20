// Native voices: real native-speaker pronunciations for the language lessons.
// Shows, per language, how many words have recordings (female / male), lets the parent download more from
// Lingua Libre (free, CC BY-SA, by declared native speakers), and lets a family member who speaks the language
// record the words that have none. Lessons play these instead of the computer voice, and the child's spoken
// words are compared with them.
import { Fragment, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, type NativeCoverage } from "../api";
import { playNative, recordClip } from "../audio/native";
import { ParentShell, Toast } from "./ParentShell";

const NAMES: Record<string, string> = {
  en: "English", hi: "Hindi", mr: "Marathi", fr: "French", es: "Spanish", ar: "Arabic", zh: "Chinese (Mandarin)", yue: "Cantonese", ko: "Korean",
  ru: "Russian", tr: "Turkish", sa: "Sanskrit", gu: "Gujarati", bn: "Bengali", pa: "Punjabi", ta: "Tamil", te: "Telugu", kn: "Kannada", de: "German", ja: "Japanese",
};

export function NativeVoices() {
  const { id = "" } = useParams();
  const [cov, setCov] = useState<NativeCoverage | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [gender, setGender] = useState<"female" | "male">("female");
  const [speaker, setSpeaker] = useState("");
  const [rec, setRec] = useState<{ item: string; stop: () => void } | null>(null);
  const load = () => api.nativeCoverage().then(setCov).catch((e) => setMsg((e as Error).message));
  useEffect(() => { void load(); }, []);
  useEffect(() => { if (!cov?.download.running) return; const t = window.setInterval(() => void load(), 4000); return () => clearInterval(t); }, [cov?.download.running]);

  const download = async (langs: string[]) => {
    const r = await api.nativeDownload(langs).catch((e) => ({ started: false, message: (e as Error).message }));
    setMsg(r.message); void load();
  };
  const record = async (lang: string, item: string) => {
    setMsg(null);
    try {
      const clip = await recordClip(6000);
      setRec({ item, stop: clip.stop });
      const wav = await clip.result;
      setRec(null);
      if (!wav) { setMsg("Nothing was recorded."); return; }
      const r = await api.recordNative(id, lang, item, wav, gender, speaker);
      setMsg(`Saved. ${r.refs.length} recording(s) for this word now.`);
      void playNative(r.refs.filter((x) => x.family));
      void load();
    } catch (e) { setRec(null); setMsg((e as Error).message); }
  };

  return (
    <ParentShell title="🎙️ Native voices" back="/parent">
      <section className="card">
        <p>Melo plays <strong>real native speakers</strong> instead of the computer voice wherever it has their recordings, alternating a female and a male voice,
          and compares your child's spoken words with them. Recordings come from <a href="https://lingualibre.org" target="_blank" rel="noreferrer">Lingua Libre</a>:
          single words recorded by people who speak the language natively, shared freely (CC BY-SA, the speaker is credited under each word),
          and whole sentences from <a href="https://tatoeba.org" target="_blank" rel="noreferrer">Tatoeba</a> (recorded by native speakers; many are for
          non-commercial use only, so they are downloaded on this computer and not shipped in the installer), and short sentences read by
          native speakers for Google's open speech sets on <a href="https://www.openslr.org" target="_blank" rel="noreferrer">OpenSLR</a> (CC BY-SA;
          Kannada, Gujarati, Marathi, Tamil, Telugu, Bengali, English and Spanish), used in the harder ⭐ Challenge sentences.</p>
        <p className="muted small">Lingua Libre has many single words but few phrases, and some languages (Sanskrit, Gujarati, Japanese, Punjabi) have very few.
          For those, a family member or teacher who speaks the language can record the words below: those recordings stay on this computer.</p>
        <div className="row wrap">
          <button className="btn" disabled={!!cov?.download.running} onClick={() => void download([])}>
            {cov?.download.running ? "Downloading…" : "⬇ Download native recordings (all languages)"}
          </button>
          <span className="muted small">About 50 KB per recording, up to 3 per word; from lingualibre.org and commons.wikimedia.org. Runs in the background.</span>
        </div>
        {cov?.download.error && <p className="error small">{cov.download.error}</p>}
      </section>
      <Toast msg={msg} kind="info" />
      <section className="card">
        <div className="row wrap">
          <label className="small">My voice is<select value={gender} onChange={(e) => setGender(e.target.value as "female" | "male")}><option value="female">female</option><option value="male">male</option></select></label>
          <label className="small">Name to show (optional)<input value={speaker} maxLength={40} onChange={(e) => setSpeaker(e.target.value)} placeholder="e.g. Nani" /></label>
        </div>
        {!cov ? <div className="spinner" /> : (
          <table className="table">
            <thead><tr><th>Language</th><th>Words with native voice</th><th>👩 / 👨</th><th>Family</th><th /></tr></thead>
            <tbody>
              {Object.entries(cov.languages).map(([code, c]) => (
                <Fragment key={code}>
                  <tr>
                    <td>{NAMES[code] ?? code}</td>
                    <td><span className="cov-bar"><span style={{ width: `${(100 * c.items) / Math.max(1, c.of)}%` }} /></span> {c.items} / {c.of}
                      {cov.download.done[code] && <small className="muted"> · just added {String(cov.download.done[code].new_files ?? 0)}</small>}</td>
                    <td>{c.female} / {c.male}</td><td>{c.family}</td>
                    <td><button className="btn ghost small" onClick={() => setOpen(open === code ? null : code)}>{open === code ? "Close" : `Record missing (${c.missing.length})`}</button>
                      <button className="btn ghost small" onClick={() => void download([code])} disabled={!!cov.download.running} title="Download native recordings">⬇</button>
                      <button className="btn ghost small" title="Harder sentences for this child (real sentences by native speakers, or written by the AI)"
                        onClick={() => void api.learnGrow(id, code).then((r) => setMsg(r.message)).catch((e) => setMsg((e as Error).message))}>⭐ Harder</button></td>
                  </tr>
                  {open === code && (
                    <tr key={`${code}-missing`}><td colSpan={5}>
                      <ul className="missing-words">
                        {c.missing.map((m) => (
                          <li key={m.item}>
                            <span>{m.emoji} <strong dir="auto">{m.text}</strong> {m.roman && <small className="muted">{m.roman}</small>}</span>
                            {rec?.item === m.item
                              ? <button className="btn small danger" onClick={() => rec.stop()}>⏹ Stop</button>
                              : <button className="btn ghost small" disabled={!!rec} onClick={() => void record(code, m.item)}>🎙️ Record</button>}
                          </li>
                        ))}
                      </ul>
                    </td></tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </ParentShell>
  );
}
