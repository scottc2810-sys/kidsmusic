// Choose Melo's AI brain: Claude Code, a local model (Ollama, LM Studio, llama.cpp ...) or an online service
// that speaks the OpenAI API. Everything found on this computer is listed; one click saves and tests it.
// Lessons always work without a brain (the offline teacher); a brain makes plans, chat and feedback personal.
import { useEffect, useState } from "react";
import { api, type BrainChoice, type BrainsFound, type BrainTest as Result } from "../api";
import { PROVIDER_NAME } from "./BrainTest";

type Choice = "claude_code" | "ollama" | "local" | "online" | "offline";

export function BrainPicker() {
  const [found, setFound] = useState<BrainsFound | null>(null);
  const [choice, setChoice] = useState<Choice>("ollama");
  const [ollamaModel, setOllamaModel] = useState("");
  const [local, setLocal] = useState({ base: "", model: "" });
  const [online, setOnline] = useState({ preset: "openrouter", base: "", model: "", key: "" });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const scan = () => api.brains().then((f) => {
    setFound(f);
    const cur = f.current.configured === "auto" ? f.current.provider : f.current.configured;
    const savedBase = f.saved.llm_base_url ?? "";
    const isLocal = /^https?:\/\/(127\.0\.0\.1|localhost)/.test(savedBase);
    setChoice(cur === "claude_code" ? "claude_code" : cur === "ollama" ? "ollama" : cur === "openai" ? (isLocal ? "local" : "online")
      : cur === "offline" ? "offline" : f.claude_code.found ? "claude_code" : f.ollama.running ? "ollama" : f.local_servers.length ? "local" : "online");
    setOllamaModel(f.saved.ollama_model || f.ollama.suggested || "");
    const ls = f.local_servers[0];
    setLocal({ base: isLocal ? savedBase : ls?.base_url ?? "http://127.0.0.1:1234/v1", model: (isLocal && f.saved.llm_model) || ls?.models[0] || "" });
    const preset = f.online.find((o) => o.base_url === savedBase) ?? f.online.find((o) => o.id === "openrouter")!;
    setOnline({ preset: preset.id, base: !isLocal && savedBase ? savedBase : preset.base_url, model: (!isLocal && f.saved.llm_model) || preset.model, key: "" });
  }).catch((e) => setErr((e as Error).message));
  useEffect(() => { void scan(); }, []);

  const save = async () => {
    if (!found) return;
    let body: BrainChoice;
    if (choice === "claude_code") body = { provider: "claude_code" };
    else if (choice === "ollama") body = { provider: "ollama", ollama_url: found.ollama.url, ollama_model: ollamaModel };
    else if (choice === "local") body = { provider: "openai", llm_base_url: local.base, llm_model: local.model };
    else if (choice === "online") body = { provider: "openai", llm_base_url: online.base, llm_model: online.model, llm_api_key: online.key };
    else body = { provider: "offline" };
    setBusy(true); setErr(null); setResult(null);
    try { setResult(await api.setBrain(body)); void scan(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  if (!found) return <section className="card"><h2>🧠 Choose Melo's AI brain</h2>{err ? <p className="error">{err}</p> : <div className="spinner" />}</section>;
  const opt = (id: Choice, title: string, note: string, ok: boolean | null) => (
    <label className={`brain-option${choice === id ? " sel" : ""}`}>
      <input type="radio" name="brain" checked={choice === id} onChange={() => setChoice(id)} />
      <span><strong>{title}</strong> {ok === true ? <span className="tag ok">found ✓</span> : ok === false ? <span className="tag">not found</span> : null}
        <br /><small className="muted">{note}</small></span>
    </label>
  );
  return (
    <section className="card form brain-picker">
      <h2>🧠 Choose Melo's AI brain</h2>
      <p className="muted small">
        Now using: <strong>{PROVIDER_NAME[found.current.provider] ?? found.current.provider}</strong>
        {found.current.model ? ` · ${found.current.model}` : ""}{found.current.local ? " · runs on this computer" : found.current.provider !== "offline" ? " · online" : ""}.
        {" "}The brain is only used for children whose <em>AI brain</em> switch is on in their settings. Their name is never sent.
      </p>
      <div className="brain-options" role="radiogroup">
        {found.claude_code.offered !== false && opt("claude_code", "Claude Code", "Your Claude Code login on this computer. No API key.", found.claude_code.found)}
        {opt("ollama", "Ollama (free, private, on this computer)", found.ollama.running
          ? `${found.ollama.models.length} model(s) installed.` : "Install from ollama.com, then run: ollama pull llama3.2", found.ollama.running)}
        {opt("local", "Other local model server", "LM Studio, llama.cpp, Jan, vLLM… (OpenAI-compatible)", found.local_servers.length ? true : null)}
        {opt("online", "Online AI service", "OpenAI, OpenRouter, Groq, Gemini, Mistral, DeepSeek… with your own API key", null)}
        {opt("offline", "No AI (offline teacher)", "Built-in lines and rules only. Works everywhere, nothing leaves the computer.", null)}
      </div>

      {choice === "ollama" && (
        <label>Model
          {found.ollama.models.length ? (
            <select value={ollamaModel} onChange={(e) => setOllamaModel(e.target.value)}>
              {found.ollama.models.map((m) => <option key={m} value={m}>{m}{m === found.ollama.suggested ? " (suggested)" : ""}</option>)}
            </select>
          ) : <input value={ollamaModel} placeholder="llama3.2" onChange={(e) => setOllamaModel(e.target.value)} />}
          <small className="muted">Small models (3–8B) answer in a few seconds. Melo never makes a child wait: a slow answer is used for the next activities.</small>
        </label>
      )}
      {choice === "local" && (
        <>
          {found.local_servers.length > 0 && (
            <label>Found on this computer
              <select onChange={(e) => { const s = found.local_servers[Number(e.target.value)]; setLocal({ base: s.base_url, model: s.models[0] ?? "" }); }}>
                {found.local_servers.map((s, i) => <option key={s.base_url} value={i}>{s.name} · {s.base_url}</option>)}
              </select>
            </label>
          )}
          <label>Server address<input value={local.base} onChange={(e) => setLocal({ ...local, base: e.target.value })} placeholder="http://127.0.0.1:1234/v1" /></label>
          <label>Model<input value={local.model} onChange={(e) => setLocal({ ...local, model: e.target.value })} list="local-models" />
            <datalist id="local-models">{found.local_servers.flatMap((s) => s.models).map((m) => <option key={m} value={m} />)}</datalist></label>
        </>
      )}
      {choice === "online" && (
        <>
          <label>Service
            <select value={online.preset} onChange={(e) => { const o = found.online.find((x) => x.id === e.target.value)!; setOnline({ ...online, preset: o.id, base: o.base_url, model: o.model }); }}>
              {found.online.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </label>
          <label>Address<input value={online.base} onChange={(e) => setOnline({ ...online, base: e.target.value })} /></label>
          <label>Model<input value={online.model} onChange={(e) => setOnline({ ...online, model: e.target.value })} /></label>
          <label>API key<input type="password" autoComplete="off" value={online.key} onChange={(e) => setOnline({ ...online, key: e.target.value })}
            placeholder={found.saved.has_api_key ? "saved (leave empty to keep it)" : "paste your key"} /></label>
          <p className="muted small">An online service receives the lesson data needed to plan (skills, what was hard, parent notes), never the child's name, audio or video.
            The key is stored only in Melo's data folder on this computer.</p>
        </>
      )}
      <div className="row wrap">
        <button className="btn" onClick={() => void save()} disabled={busy}>{busy ? "Saving and testing…" : "Save and test"}</button>
        <button className="btn ghost" onClick={() => void scan()} disabled={busy}>🔍 Look again</button>
      </div>
      {result && (
        <div className={`brain-result ${result.ok ? "ok" : "bad"}`} aria-live="polite">
          <p><strong>{result.ok ? "✅ " : "⚠️ "}{result.message}</strong></p>
          {result.reply && <p className="small">Melo says: “{result.reply}”</p>}
        </div>
      )}
      {err && <p className="error small">{err}</p>}
    </section>
  );
}
