import { useMemo, useState } from "react";

/** A grown-up check before leaving child mode: a sum young children can't easily solve. */
export function ParentGate({ onPass, onCancel }: { onPass: () => void; onCancel: () => void }) {
  const [a, b] = useMemo(() => [6 + Math.floor(Math.random() * 7), 5 + Math.floor(Math.random() * 8)], []);
  const [value, setValue] = useState("");
  const [wrong, setWrong] = useState(false);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (Number(value) === a * b) onPass();
    else { setWrong(true); setValue(""); }
  };
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="gate-title">
      <form className="modal" onSubmit={submit}>
        <h2 id="gate-title">For grown-ups</h2>
        <p>What is {a} × {b}?</p>
        <input inputMode="numeric" autoFocus value={value} onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))} aria-label="Answer" />
        {wrong && <p className="error">Not quite — try again.</p>}
        <div className="row">
          <button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>
          <button type="submit" className="btn">Continue</button>
        </div>
      </form>
    </div>
  );
}
