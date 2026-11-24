import { useEffect, useState } from "react";
import { LANGS } from "../languages";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../App";
import { Melo } from "../components/Melo";

export const AVATARS: Record<string, string> = { owl: "🦉", cat: "🐱", elephant: "🐘", bird: "🐦", fish: "🐠", lion: "🦁" };
export const LANG_NAME: Record<string, string> = Object.fromEntries(Object.entries(LANGS).map(([code, info]) => [code, info.name]));
export const MODE_NAME: Record<string, string> = { screen: "Screen piano", real: "Real instrument", listening: "Listening", practice: "Practice" };

export function ParentShell({ title, back, children }: { title: string; back?: string; children: React.ReactNode }) {
  const { parent, setParent } = useAuth();
  const nav = useNavigate();
  const [ai, setAi] = useState<string>("");
  useEffect(() => { api.teacherStatus().then((s) => setAi(s.provider)).catch(() => setAi("")); }, []);
  const logout = async () => { await api.logout().catch(() => {}); setParent(null); nav("/login"); };
  return (
    <div className="parent">
      <header className="topbar">
        <Link to="/parent" className="brand"><Melo size={36} /> <span>Melo</span></Link>
        <nav>
          {ai && <span className={`pill ${ai !== "offline" ? "ok" : ""}`} title="AI teacher provider">
            {ai === "anthropic" ? "Claude teacher" : ai === "claude_code" ? "Claude Code teacher" : "Offline teacher"}</span>}
          <Link to="/parent/connect" className="btn ghost small">🧠 AI brain</Link>
          <Link to="/parent/plan" className="btn ghost small">⭐ Plan</Link>
          <Link to="/parent/help" className="btn ghost small">💬 Help</Link>
          <span className="muted small hide-sm">{parent?.email}</span>
          <button className="btn ghost small" onClick={logout}>Sign out</button>
        </nav>
      </header>
      <main className="container">
        <div className="page-head">
          {back && <Link to={back} className="link">← Back</Link>}
          <h1>{title}</h1>
        </div>
        {children}
      </main>
    </div>
  );
}

export function Toast({ msg, kind = "info" }: { msg: string | null; kind?: "info" | "error" }) {
  if (!msg) return null;
  return <p className={kind === "error" ? "error" : "notice"} role={kind === "error" ? "alert" : "status"}>{msg}</p>;
}
