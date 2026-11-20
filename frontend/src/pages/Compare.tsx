// Side by side: the same words or everyday phrases in several languages at once (the family chooses how
// many, up to every language taught), so a child (or a parent with the child) can hear, read, say and
// write them in parallel and notice what is alike. Wide tables scroll sideways.
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, type Child, type CompareData, type LearnActivity, type LearnLanguage } from "../api";
import { hasVoiceFor, listenIn, sayIn, speak, speechRecognitionAvailable, stopSpeaking } from "../audio/speech";
import { unlockAudio } from "../audio/synth";
import { Melo, type MeloMood } from "../components/Melo";
import { L, t, topicTitle } from "../i18n";
import { KidShell, useChild } from "./KidHome";
import { Spell } from "./Learn";

export const DEFAULT_MAX = 4;
export const CHOICES = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15];
const keyFor = (childId: string) => `melo.compare.${childId}`;
const maxKey = (childId: string) => `melo.compare.max.${childId}`;
const htmlLang = (code: string) => (code === "yue" ? "zh-HK" : code === "zh" ? "zh-CN" : code);

function loadLangs(childId: string): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(keyFor(childId)) ?? "null");
    if (Array.isArray(v) && v.length && v.every((c) => typeof c === "string")) return v;
  } catch { /* no storage */ }
  return ["en", "hi", "es", "zh"];
}

function loadMax(childId: string, chosen: number): number {
  try {
    const v = Number(localStorage.getItem(maxKey(childId)));
    if (Number.isInteger(v) && v >= 1) return Math.max(v, chosen);
  } catch { /* no storage */ }
  return Math.max(DEFAULT_MAX, chosen);
}

/** Add or remove one language; when the limit is reached the oldest choice makes room. Never empty. */
export function toggled(cur: string[], code: string, max: number): string[] {
  if (cur.includes(code)) return cur.length > 1 ? cur.filter((c) => c !== code) : cur;
  const next = [...cur, code];
  return next.length > max ? next.slice(next.length - max) : next;
}

export function CompareLanguages() {
  const { id = "" } = useParams();
  const { child, error } = useChild(id);
  if (error) return <div className="center-screen"><p className="error">{error}</p></div>;
  if (!child) return <div className="center-screen"><div className="spinner" /></div>;
  return <CompareView child={child} />;
}

type Feedback = { ok: boolean; text: string };

function CompareView({ child }: { child: Child }) {
  const ui = child.language;
  const nav = useNavigate();
  const [all, setAll] = useState<LearnLanguage[]>([]);
  const [langs, setLangs] = useState<string[]>(() => loadLangs(child.id));
  const [max, setMax] = useState<number>(() => loadMax(child.id, loadLangs(child.id).length));
  const [topic, setTopic] = useState("greetings");
  const [data, setData] = useState<CompareData | null>(null);
  const [roman, setRoman] = useState(true);
  const [hide, setHide] = useState(false);
  const [shown, setShown] = useState<Set<string>>(new Set());
  const [playing, setPlaying] = useState<string | null>(null); // "row|lang" being spoken
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, Feedback>>({});
  const [writing, setWriting] = useState<{ key: string; act: LearnActivity } | null>(null);
  const [mood, setMood] = useState<MeloMood>("happy");
  const [say, setSay] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const stop = useRef(false);
  const canSpeak = child.consent_microphone && speechRecognitionAvailable();

  useEffect(() => { api.learnLanguages().then(setAll).catch(() => {}); }, []);
  useEffect(() => {
    try { localStorage.setItem(maxKey(child.id), String(max)); } catch { /* private mode */ }
    setLangs((cur) => (cur.length > max ? cur.slice(0, max) : cur));
  }, [max, child.id]);
  useEffect(() => {
    try { localStorage.setItem(keyFor(child.id), JSON.stringify(langs)); } catch { /* private mode */ }
    setProblem(null);
    api.learnCompare(langs, topic, ui).then(setData).catch((e) => setProblem((e as Error).message));
  }, [langs, topic, ui, child.id]);
  useEffect(() => { setShown(new Set()); setFeedback({}); }, [topic, langs]);
  useEffect(() => () => { stop.current = true; stopSpeaking(); }, []);

  const talk = useCallback(async (text: string, after: MeloMood = "happy") => {
    setSay(text); setMood("talking");
    await speak(text, ui);
    setMood(after);
  }, [ui]);

  const toggleLang = (code: string) => setLangs((cur) => toggled(cur, code, max));
  const total = all.length || 20;
  const chooseAll = () => { setMax(total); setLangs(all.map((l) => l.code)); };
  const locale = (code: string) => data?.languages.find((l) => l.code === code)?.locale ?? code;

  const hear = async (rowId: string, code: string, text: string, slow = false) => {
    await unlockAudio();
    setPlaying(`${rowId}|${code}`); setMood("talking");
    await sayIn(text, locale(code), slow ? 0.6 : 0.85);
    setPlaying(null); setMood("happy");
  };
  const hearAll = async (rowId: string) => {
    if (!data) return;
    stop.current = false;
    const row = data.rows.find((r) => r.id === rowId)!;
    for (const l of data.languages) {
      if (stop.current) break;
      await hear(rowId, l.code, row.cells[l.code].text);
      await new Promise((r) => setTimeout(r, 350));
    }
  };

  const result = async (key: string, attemptId: string, response: Record<string, unknown>) => {
    const r = await api.learnAnswer(child.id, attemptId, response);
    const ok = r.outcome === "success" || r.outcome === "partial";
    setFeedback((f) => ({ ...f, [key]: { ok, text: r.reveal.heard ? `“${r.reveal.heard}”` : "" } }));
    await talk(r.say, ok ? "cheer" : "encourage");
  };
  const trySay = async (rowId: string, code: string) => {
    const key = `${rowId}|${code}`;
    setBusy(key); setProblem(null);
    try {
      const p = await api.learnPractice(child.id, code, rowId, "speak");
      setMood("listening");
      let heard: string[] = [];
      try { heard = await listenIn(locale(code)); }
      catch (e) {
        const m = (e as Error).message;
        if (m === "not-allowed" || m === "service-not-allowed") { setProblem("Melo can't hear yet. Ask a grown-up to allow the microphone (🔒 icon in the address bar)."); return; }
      }
      await result(key, p.attempt_id, { heard });
    } catch (e) { setProblem((e as Error).message); } finally { setBusy(null); }
  };
  const tryWrite = async (rowId: string, code: string) => {
    const key = `${rowId}|${code}`;
    setBusy(key); setProblem(null);
    try { setWriting({ key, act: await api.learnPractice(child.id, code, rowId, "write") }); }
    catch (e) { setProblem((e as Error).message); } finally { setBusy(null); }
  };

  const n = langs.length;
  return (
    <KidShell child={child}>
      <div className="lesson compare wide">
        <div className="learn-head">
          <h1>🔀 {t("compareTitle", ui)}</h1>
          <button className="btn ghost small" onClick={() => nav(`/play/${child.id}/learn`)}>⬅ {t("back", ui)}</button>
        </div>
        <Melo mood={mood} size={80} say={say || t("compareIntro", ui)} />

        <section className="cmp-controls" aria-label={t("chooseLanguages", ui)}>
          <div className="row center wrap small">
            <strong>{t("chooseLanguages", ui)}</strong> ({langs.length}/{max})
            <label>{t("howMany", ui)}{" "}
              <select value={max >= total ? "all" : String(max)} onChange={(e) => setMax(e.target.value === "all" ? total : Number(e.target.value))}>
                {CHOICES.filter((c) => c < total).map((c) => <option key={c} value={c}>{c}</option>)}
                <option value="all">{t("allLanguages", ui)} ({total})</option>
              </select>
            </label>
            <button className="btn ghost small" onClick={chooseAll}>🌍 {t("allLanguages", ui)}</button>
          </div>
          <div className="lang-chips">
            {all.map((l) => (
              <button key={l.code} className={`lang-chip${langs.includes(l.code) ? " sel" : ""}`} aria-pressed={langs.includes(l.code)}
                onClick={() => toggleLang(l.code)}>
                <span aria-hidden>{l.flag}</span> <span dir="auto" lang={htmlLang(l.code)}>{l.native}</span>
              </button>
            ))}
          </div>
          <div className="topic-chips" role="tablist">
            {(data?.topics ?? []).map((tp) => (
              <button key={tp.id} role="tab" aria-selected={topic === tp.id} className={`skill-chip${topic === tp.id ? " sel" : ""}`} onClick={() => setTopic(tp.id)}>
                {tp.emoji} {topicTitle(tp.id, tp.title, ui)}
              </button>
            ))}
          </div>
          <div className="row center wrap small">
            <label className="check"><input type="checkbox" checked={roman} onChange={(e) => setRoman(e.target.checked)} /> Aa {t("showRoman", ui)}</label>
            <label className="check"><input type="checkbox" checked={hide} onChange={(e) => { setHide(e.target.checked); setShown(new Set()); }} /> 🙈 {t("hideWords", ui)}</label>
          </div>
        </section>
        {problem && <p className="error small">{problem}</p>}

        {data && (
          <div className={`cmp-scroll${n > 4 ? " many" : ""}`}>
          <div className="cmp-table" style={{ ["--n" as string]: String(n) }}>
            <div className="cmp-row cmp-head" aria-hidden>
              <div />
              {data.languages.map((l) => (
                <div key={l.code} className="cmp-lang">
                  <span className="lang-flag small">{l.flag}</span> <strong dir="auto" lang={htmlLang(l.code)}>{l.native}</strong>
                  {!hasVoiceFor(l.locale) && <small className="muted" title="No voice for this language on this device"> 🔇</small>}
                </div>
              ))}
            </div>
            {data.rows.map((r) => (
              <div key={r.id} className="cmp-row">
                <div className="cmp-meaning">
                  <span className="learn-emoji">{r.emoji}</span>
                  <span dir="auto">{r.meaning}</span>
                  <button className="btn ghost small" onClick={() => void hearAll(r.id)} title={t("hearAll", ui)}>▶ {t("hearAll", ui)}</button>
                </div>
                {data.languages.map((l) => {
                  const cell = r.cells[l.code];
                  const key = `${r.id}|${l.code}`;
                  const hidden = hide && !shown.has(key);
                  const fb = feedback[key];
                  return (
                    <div key={l.code} className={`cmp-cell${playing === key ? " playing" : ""}${fb ? (fb.ok ? " good" : " again") : ""}`}>
                      <span className="cmp-flag" aria-hidden>{l.flag}</span>
                      {hidden ? (
                        <button className="cmp-reveal" onClick={() => setShown(new Set(shown).add(key))} aria-label={t("showWord", ui)}>❓</button>
                      ) : (
                        <>
                          <strong className="cmp-text" dir="auto" lang={htmlLang(l.code)}>{cell.text}</strong>
                          {roman && cell.roman && <small className="roman">{cell.roman}</small>}
                        </>
                      )}
                      <div className="cmp-actions">
                        <button onClick={() => void hear(r.id, l.code, cell.text)} aria-label={t("hearIt", ui)} title={t("hearIt", ui)}>🔊</button>
                        <button onClick={() => void hear(r.id, l.code, cell.text, true)} aria-label={t("slower", ui)} title={t("slower", ui)}>🐢</button>
                        {canSpeak && <button onClick={() => void trySay(r.id, l.code)} disabled={!!busy} aria-label={t("sayIt", ui)} title={t("sayIt", ui)}>🎤</button>}
                        <button onClick={() => void tryWrite(r.id, l.code)} disabled={!!busy} aria-label={t("tryWriting", ui)} title={t("tryWriting", ui)}>✍️</button>
                      </div>
                      {busy === key && <small className="muted">{t("listening", ui)}</small>}
                      {fb && <small>{fb.ok ? "✅" : "🔁"} <span dir="auto">{fb.text}</span></small>}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          </div>
        )}

        {writing && (
          <div className="modal-back" role="dialog" aria-modal="true" aria-label={t("tryWriting", ui)}>
            <div className="modal card" dir={data?.languages.find((l) => writing.key.endsWith(`|${l.code}`))?.rtl ? "rtl" : "ltr"}>
              <Spell act={writing.act} busy={false} ui={ui} onDone={(text) => {
                const w = writing; setWriting(null);
                void result(w.key, w.act.attempt_id, { text });
              }} />
              <button className="btn ghost small" onClick={() => setWriting(null)}>✖ {L({ en: "Close", hi: "बंद करो", hinglish: "Band karo" }, ui)}</button>
            </div>
          </div>
        )}
      </div>
    </KidShell>
  );
}
