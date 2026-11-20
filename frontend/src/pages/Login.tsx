import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../App";
import { Melo } from "../components/Melo";

export function Login() {
  const { parent, setParent } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();
  const loc = useLocation();
  if (parent) return <Navigate to="/parent" replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const p = mode === "login" ? await api.login(email, password) : await api.register(email, password);
      setParent(p);
      nav((loc.state as any)?.from ?? "/parent", { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-page">
      <Melo mood="happy" size={120} />
      <h1>Melo</h1>
      <p className="tagline">A patient music teacher for little musicians (ages 3–8)</p>
      <form className="card auth-card" onSubmit={submit}>
        <h2>{mode === "login" ? "Parent sign in" : "Create a parent account"}</h2>
        <label>Email<input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label>Password
          <input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={mode === "register" ? 8 : 1}
            value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {mode === "register" && <p className="muted small">At least 8 characters. Only a parent should hold this account.</p>}
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn big" disabled={busy}>{busy ? "…" : mode === "login" ? "Sign in" : "Create account"}</button>
        <button type="button" className="link" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(null); }}>
          {mode === "login" ? "New here? Create an account" : "Already have an account? Sign in"}
        </button>
      </form>
    </main>
  );
}
