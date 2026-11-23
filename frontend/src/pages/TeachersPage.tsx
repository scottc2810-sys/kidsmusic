// The parent picks who teaches each subject: a persona (gentle Melo, Professor Pi, Captain Science, Dadi,
// Coach Zoom, Maestro), the voice on this device, its speed and pitch, and the child's school class.
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, type Child } from "../api";
import { previewVoice, setTeacherVoice, voicesFor } from "../audio/speech";
import { L } from "../i18n";
import { forgetPrefs, PERSONAS, personaById, type Prefs, type Subject, type TeacherChoice } from "../teaching/persona";
import { ParentShell, Toast } from "./ParentShell";

const SUBJECTS: { id: Subject; icon: string; name: string }[] = [
  { id: "maths", icon: "🔢", name: "Maths" }, { id: "science", icon: "🔬", name: "Science" },
  { id: "music", icon: "🎹", name: "Music" }, { id: "languages", icon: "🗣️", name: "Languages" },
  { id: "vedas", icon: "🕉️", name: "Vedas & wisdom" }, { id: "finance", icon: "🪙", name: "Money & finance" },
];
const SUGGEST: Record<Subject, TeacherChoice["persona"]> = { maths: "professor_pi", science: "captain_science", music: "maestro", languages: "dadi", vedas: "guruji", finance: "money_mitra" };

export function TeachersPage() {
  const { id = "" } = useParams();
  const [child, setChild] = useState<Child | null>(null);
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [grade, setGrade] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [, setVoicesTick] = useState(0);
  useEffect(() => {
    api.child(id).then(setChild).catch((e) => setErr((e as Error).message));
    api.prefs(id).then((p) => { setPrefs(p); setGrade(p.grade_auto ? null : p.grade); }).catch((e) => setErr((e as Error).message));
    const s = window.speechSynthesis;
    if (s) s.onvoiceschanged = () => setVoicesTick((x) => x + 1); // voices load a moment after the page
  }, [id]);
  if (!child || !prefs) return <ParentShell title="Teachers" back="/parent"><Toast msg={err} kind="error" /><div className="spinner" /></ParentShell>;
  const lang = child.language;
  const voices = voicesFor(lang);
  const choice = (s: Subject): TeacherChoice => prefs.teachers[s] ?? { persona: "melo", voice: null, rate: 1, pitch: 1 };
  const setChoice = (s: Subject, c: Partial<TeacherChoice>) => setPrefs({ ...prefs, teachers: { ...prefs.teachers, [s]: { ...choice(s), ...c } } });
  const preview = async (s: Subject) => {
    const c = choice(s), p = personaById(c.persona);
    setTeacherVoice({ voice: c.voice, rate: c.rate * p.rate, pitch: c.pitch * p.pitch });
    try { await previewVoice(lang, c.voice ?? voices[0]?.name ?? "", L(p.hello, lang).replace("{name}", child.name)); } finally { setTeacherVoice(null); }
  };
  const save = async () => {
    setErr(null);
    try {
      const p = await api.savePrefs(id, { grade, teachers: prefs.teachers });
      setPrefs(p); forgetPrefs(id); setMsg("Saved ✓ The teachers will sound like this from the next lesson.");
    } catch (e) { setErr((e as Error).message); }
  };
  return (
    <ParentShell title={`🧑‍🏫 ${child.name}'s teachers`} back="/parent">
      <section className="card">
        <p>Choose who teaches each subject. The persona changes how the teacher talks and sounds (greetings, praise, encouragement, speed),
          never what is taught. Voices come from this device, so a voice chosen here may sound different on another computer.</p>
        <label>School class (for Maths and Science)
          <select value={grade ?? ""} onChange={(e) => setGrade(e.target.value === "" ? null : Number(e.target.value))}>
            <option value="">From age ({child.age} years → {Math.max(0, Math.min(5, child.age - 5)) || "pre-school"})</option>
            <option value={0}>Pre-school / KG</option>
            {[1, 2, 3, 4, 5].map((g) => <option key={g} value={g}>Class {g}</option>)}
          </select>
        </label>
        <Toast msg={msg} /><Toast msg={err} kind="error" />
      </section>
      {SUBJECTS.map((s) => {
        const c = choice(s.id);
        return (
          <section key={s.id} className="card">
            <h2>{s.icon} {s.name}</h2>
            <div className="choice-cards">
              {PERSONAS.map((p) => (
                <button key={p.id} className={`choice-card${c.persona === p.id ? " sel" : ""}`} aria-pressed={c.persona === p.id} onClick={() => setChoice(s.id, { persona: p.id })}>
                  <span className="cc-icon">{p.emoji}</span>{p.name}{SUGGEST[s.id] === p.id && <small>suggested</small>}<small>{p.about}</small>
                </button>
              ))}
            </div>
            <div className="row wrap">
              <label>Voice on this device
                <select value={c.voice ?? ""} onChange={(e) => setChoice(s.id, { voice: e.target.value || null })}>
                  <option value="">Melo's usual voice</option>
                  {voices.map((v) => <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>)}
                </select>
              </label>
              <label>Speed {c.rate.toFixed(2)}×<input type="range" min={0.6} max={1.4} step={0.05} value={c.rate} onChange={(e) => setChoice(s.id, { rate: Number(e.target.value) })} /></label>
              <label>Pitch {c.pitch.toFixed(2)}×<input type="range" min={0.6} max={1.5} step={0.05} value={c.pitch} onChange={(e) => setChoice(s.id, { pitch: Number(e.target.value) })} /></label>
              <button className="btn ghost" onClick={() => void preview(s.id)}>🔊 Preview</button>
            </div>
          </section>
        );
      })}
      <div className="row"><button className="btn" onClick={() => void save()}>💾 Save</button></div>
    </ParentShell>
  );
}
