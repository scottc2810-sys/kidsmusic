// 🩺 System check: what this computer and browser have for Melo, what is optional, and how to add it.
// Server side: data folder, disk, AI brains. Browser side: voices, speech recognition, microphone permission.
import { useEffect, useState } from "react";
import { speechRecognitionAvailable } from "../audio/speech";

interface Check { id: string; name: string; ok: boolean; required: boolean; detail: string; fix: string | null; link: string | null }

async function browserChecks(): Promise<Check[]> {
  const voices = typeof window !== "undefined" ? window.speechSynthesis?.getVoices() ?? [] : [];
  const natural = voices.filter((v) => /natural|neural|online|google/i.test(v.name)).length;
  let mic = "unknown";
  try { mic = (await navigator.permissions.query({ name: "microphone" as PermissionName })).state; } catch { /* not supported */ }
  const sr = speechRecognitionAvailable();
  return [
    { id: "voices", name: "Melo's voice", ok: voices.length > 0, required: false, detail: `${voices.length} voices (${natural} natural)`,
      fix: "No speech voices: open Melo in Microsoft Edge or Chrome, or add voices in your system's speech settings.", link: null },
    { id: "speech", name: "Speaking practice (speech recognition)", ok: sr, required: false, detail: sr ? "available" : "not available in this browser",
      fix: "Open Melo in Chrome or Edge for speaking practice.", link: null },
    { id: "mic", name: "Microphone permission", ok: mic !== "denied", required: false, detail: mic,
      fix: "The browser blocks the microphone: click the 🔒 icon in the address bar and allow it.", link: null },
  ];
}

export function SystemCheck() {
  const [checks, setChecks] = useState<Check[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const run = async () => {
    setChecks(null); setErr(null);
    try {
      const res = await fetch("/api/system/check", { credentials: "same-origin", headers: { "X-Requested-With": "melo" } });
      const server = res.ok ? ((await res.json()) as { checks: Check[] }).checks : [];
      setChecks([...server, ...(await browserChecks())]);
    } catch (e) { setErr((e as Error).message); }
  };
  useEffect(() => { void run(); }, []);
  return (
    <section className="card system-check">
      <div className="row spread"><h2>🩺 System check</h2><button className="btn ghost small" onClick={() => void run()}>Check again</button></div>
      {err && <p className="error small">{err}</p>}
      {!checks ? <div className="spinner" /> : (
        <ul className="checks">
          {checks.map((c) => (
            <li key={c.id} className={c.ok ? "ok" : c.required ? "bad" : "warn"}>
              <span aria-hidden>{c.ok ? "✅" : c.required ? "❌" : "➖"}</span>
              <div>
                <strong>{c.name}</strong> {!c.required && <small className="muted">(optional)</small>}<br />
                <small className="muted">{c.detail}</small>
                {c.fix && <p className="small">{c.fix} {c.link && <a href={c.link} target="_blank" rel="noreferrer">Get it →</a>}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
