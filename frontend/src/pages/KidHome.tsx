import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, type Chapter, type Child, type LearningPath } from "../api";
import { langInfo } from "../languages";
import { speak } from "../audio/speech";
import { unlockAudio } from "../audio/synth";
import { Melo } from "../components/Melo";
import { ParentGate } from "../components/ParentGate";
import { L, t, tr } from "../i18n";

export function useChild(id: string) {
  const [child, setChild] = useState<Child | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { api.child(id).then(setChild).catch((e) => setError(e.message)); }, [id]);
  return { child, error };
}

export function KidShell({ child, children, onExit }: { child: Child; children: React.ReactNode; onExit?: () => void }) {
  const [gate, setGate] = useState(false);
  const nav = useNavigate();
  return (
    <div className="kid" lang={langInfo(child.language).htmlLang} dir={langInfo(child.language).rtl ? "rtl" : "ltr"}>
      <button className="grownups" onClick={() => setGate(true)}>🔒 {t("grownUps", child.language)}</button>
      {children}
      {gate && <ParentGate onCancel={() => setGate(false)} onPass={() => { onExit?.(); nav("/parent"); }} />}
    </div>
  );
}

export function KidHome() {
  const { id = "" } = useParams();
  const { child, error } = useChild(id);
  const nav = useNavigate();
  const [path, setPath] = useState<LearningPath | null>(null);
  useEffect(() => { api.path(id).then(setPath).catch(() => {}); }, [id]);
  if (error) return <div className="center-screen"><p className="error">{error}</p></div>;
  if (!child) return <div className="center-screen"><div className="spinner" /></div>;
  const lang = child.language;
  const go = async (path: string) => { await unlockAudio(); nav(path); };
  const chapterRoute = (c: Chapter) => c.kind === "topic" ? `/play/${id}/lesson?topic=${c.target}` : c.kind === "song" ? `/play/${id}/songs/${c.target}`
    : c.kind === "compose" ? `/play/${id}/piano` : `/play/${id}/lesson?focus=${c.target}`;
  const next = path?.chapters.find((c) => c.status === "current") ?? null;
  const hello = t("helloName", lang).replace("{name}", child.name);
  return (
    <KidShell child={child}>
      <div className="kid-home">
        <button className="melo-btn" onClick={() => { void unlockAudio(); void speak(hello, lang); }} aria-label="Say hello to Melo">
          <Melo mood="happy" size={180} say={hello} />
        </button>
        {path && (
          <section className="path-card" aria-label={t("myPath", lang)}>
            <div className="path-head">
              <strong>🗺️ {t("myPath", lang)}</strong>
              <span className="muted small">{t("level", lang)} {path.level} · {path.done}/{path.total}</span>
            </div>
            <ol className="path-dots">
              {path.chapters.map((c) => (
                <li key={c.id} className={`path-dot ${c.status}`} title={tr(c.title, lang)}>
                  <button onClick={() => go(chapterRoute(c))} aria-label={`${tr(c.title, lang)} (${c.status})`}>{c.status === "done" ? "✓" : c.icon}</button>
                </li>
              ))}
            </ol>
            {next ? (
              <button className="path-next" onClick={() => go(chapterRoute(next))}>
                <span className="path-next-icon" aria-hidden>{next.icon}</span>
                <span><small>{t("nextStep", lang)}</small><strong>{tr(next.title, lang)}{next.song_title ? `: ${next.song_title}` : ""}</strong></span>
                <span aria-hidden>▶</span>
              </button>
            ) : <p className="small">🏆 {t("pathDone", lang)}</p>}
          </section>
        )}
        <div className="big-choices">
          <button className="big-choice bc-yellow" onClick={() => go(`/play/${id}/lesson`)}><span>🎹</span>{t("lesson", lang)}</button>
          <button className="big-choice bc-blue" onClick={() => go(`/play/${id}/basics`)}><span>📚</span>{t("basics", lang)}</button>
          <button className="big-choice bc-pink" onClick={() => go(`/play/${id}/songs`)}><span>🎂</span>{t("songs", lang)}</button>
          <button className="big-choice bc-orange" onClick={() => go(`/play/${id}/learn`)}><span>🗣️</span>{t("languages", lang)}</button>
          <button className="big-choice bc-blue" onClick={() => go(`/play/${id}/maths`)}><span>🔢</span>{L({ en: "Maths", hi: "गणित", hinglish: "Maths" }, lang)}</button>
          <button className="big-choice bc-green" onClick={() => go(`/play/${id}/science`)}><span>🔬</span>{L({ en: "Science", hi: "विज्ञान", hinglish: "Science" }, lang)}</button>
          <button className="big-choice bc-orange" onClick={() => go(`/play/${id}/vedas`)}><span>🕉️</span>{L({ en: "Vedas & wisdom", hi: "वेद और ज्ञान", hinglish: "Ved aur gyaan" }, lang)}</button>
          <button className="big-choice bc-yellow" onClick={() => go(`/play/${id}/finance`)}><span>🪙</span>{L({ en: "Money", hi: "पैसा", hinglish: "Paisa" }, lang)}</button>
          <button className="big-choice bc-green" onClick={() => go(`/play/${id}/piano`)}><span>🎨</span>{t("freePiano", lang)}</button>
          <button className="big-choice bc-purple" onClick={() => go(`/play/${id}/talk`)}><span>💬</span>{t("talk", lang)}</button>
          <button className="big-choice bc-yellow" onClick={() => go(`/play/${id}/stars`)}><span>✨</span>{L({ en: "My stars", hi: "मेरे सितारे", hinglish: "Mere stars" }, lang)}</button>
        </div>
      </div>
    </KidShell>
  );
}
