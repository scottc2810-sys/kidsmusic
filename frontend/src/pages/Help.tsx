// Help and feedback for parents (beta). Families' copies run on their own computers, so feedback reaches the
// makers only when the parent sends it: an email (when SUPPORT_EMAIL is set) or a copy to paste anywhere. The
// message carries technical details (Melo version, system, browser, AI brain), never anything about the child.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { SUPPORT_EMAIL } from "./Legal";
import { ParentShell } from "./ParentShell";

const FAQ: [string, string][] = [
  ["Melo can't hear my child", "Allow the microphone: click the lock or camera icon in the browser's address bar and allow the microphone for Melo. Then check the child's Settings: the 🎤 Microphone switch must be on. Chrome or Edge work best."],
  ["A word or phrase has no voice", "Melo plays a native speaker when one is recorded, then a computer voice, then the browser's own voice. In Parent → 🎙️ Native voices you can download more recordings, or record a family member saying it."],
  ["Lessons feel too easy or too hard", "Each topic moves up after a strong round and eases after a weak one. You can also set the child's school class in Teachers, and tell Melo in 💬 Talk to Melo (\"go gently\", \"more challenge\")."],
  ["What is the AI brain, and do I need it?", "No. Melo's built-in teacher works offline. An AI brain makes lessons more personal: a free one on this computer (Ollama), or an online service with your own key. Choose it in 🧠 AI brain."],
  ["How do I update Melo?", "When a new version is out, a banner on the parent page links to it. Install it over the old one: progress and recordings stay."],
  ["How do I delete our data?", "In a child's Settings you can delete recordings, the child, or your whole account. Deleting removes it from this computer."],
];

export function HelpPage() {
  const [kind, setKind] = useState("idea");
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);
  const [tech, setTech] = useState("");
  useEffect(() => {
    Promise.all([api.updateCheck().catch(() => null), api.teacherStatus().catch(() => null)]).then(([u, t]) => {
      setTech([`Melo ${u?.current ?? "?"}`, `AI brain: ${t?.provider ?? "?"}`, `Browser: ${navigator.userAgent}`,
        `Screen: ${window.screen.width}x${window.screen.height}`, `Language: ${navigator.language}`].join("\n"));
    });
  }, []);
  const label = { idea: "Idea", problem: "Something went wrong", content: "A mistake in a lesson", praise: "Something we loved" }[kind] ?? kind;
  const message = `${label}\n\n${text.trim()}\n\n---\n${tech}`;
  const subject = `Melo feedback: ${label}`;
  const copy = async () => { await navigator.clipboard.writeText(`${subject}\n\n${message}`).catch(() => {}); setCopied(true); };

  return (
    <ParentShell title="Help and feedback" back="/parent">
      <section className="card">
        <h2>Quick help</h2>
        {FAQ.map(([q, a]) => (
          <details key={q} className="faq"><summary>{q}</summary><p>{a}</p></details>
        ))}
        <p className="small muted"><Link to="/privacy">Privacy Policy</Link> · <Link to="/terms">Terms of Use</Link></p>
      </section>
      <section className="card">
        <h2>Tell us what you think</h2>
        <p className="small muted">Your message goes only where you send it. It includes Melo's version, your system
          and browser, never your child's name or progress.</p>
        <label>What is it about?
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="idea">An idea</option>
            <option value="problem">Something went wrong</option>
            <option value="content">A mistake in a lesson (a word, a translation, a fact)</option>
            <option value="praise">Something we loved</option>
          </select>
        </label>
        <label>Your message
          <textarea rows={6} maxLength={4000} value={text} onChange={(e) => { setText(e.target.value); setCopied(false); }}
            placeholder="What happened, or what would make Melo better for your child?" />
        </label>
        <details className="small"><summary>Technical details we include</summary><pre className="tech">{tech}</pre></details>
        <div className="row wrap">
          {SUPPORT_EMAIL && (
            <a className={`btn${text.trim() ? "" : " disabled"}`} aria-disabled={!text.trim()}
              href={text.trim() ? `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}` : undefined}>
              ✉️ Send by email
            </a>
          )}
          <button className="btn ghost" disabled={!text.trim()} onClick={() => void copy()}>{copied ? "✅ Copied" : "📋 Copy message"}</button>
        </div>
        {!SUPPORT_EMAIL && <p className="small muted">Paste the copied message wherever you got Melo (its website or support page).</p>}
      </section>
    </ParentShell>
  );
}
