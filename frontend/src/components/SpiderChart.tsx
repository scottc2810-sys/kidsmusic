// Spider (radar) chart of one learning area: one axis per skill, 0 at the centre, 100 at the rim.
// "Now" is a filled blue shape; "2 weeks ago" a dashed orange outline (dash = secondary encoding, so colour is
// never the only cue). Rings mark the progress bands (20 / 40 / 60 / 80). An axis without enough activity is
// drawn as a hollow point at the centre and labelled "not yet": it is not a zero. Hover or focus a point for
// the details; "Show as table" gives the same numbers as text. Colours validated for both themes (dataviz).
import { useId, useMemo, useState } from "react";

export interface SpiderAxis { id: string; label: string; emoji: string; value: number | null; before?: number | null; band?: string | null; detail?: string }

const RINGS = [20, 40, 60, 80, 100];

export function SpiderChart({ axes, title, size = 400, kid = false, showBefore = true }: {
  axes: SpiderAxis[]; title: string; size?: number; kid?: boolean; showBefore?: boolean;
}) {
  const uid = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const pad = kid ? 58 : 112; // room for the skill names around the chart, so none are cut off
  const r = size / 2 - pad;
  const c = size / 2;
  const n = Math.max(3, axes.length);
  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const pt = (i: number, v: number) => [c + Math.cos(angle(i)) * (r * v) / 100, c + Math.sin(angle(i)) * (r * v) / 100] as const;
  const hasBefore = showBefore && axes.some((a) => a.before != null);
  const poly = (vals: (number | null | undefined)[]) => vals.map((v, i) => pt(i, Math.max(0, v ?? 0)).join(",")).join(" ");
  const now = useMemo(() => poly(axes.map((a) => a.value)), [axes]); // eslint-disable-line react-hooks/exhaustive-deps
  const before = useMemo(() => poly(axes.map((a) => a.before)), [axes]); // eslint-disable-line react-hooks/exhaustive-deps
  const h = hover != null ? axes[hover] : null;

  return (
    <figure className={`spider viz-root${kid ? " kid-spider" : ""}`} aria-labelledby={`t${uid}`}>
      <figcaption id={`t${uid}`} className="spider-title">{title}</figcaption>
      {!kid && (
        <div className="spider-legend" aria-hidden>
          <span><i className="sw now" /> Now</span>
          {hasBefore && <span><i className="sw before" /> 2 weeks ago</span>}
          <button type="button" className="btn ghost small" onClick={() => setTable(!table)}>{table ? "Show chart" : "Show as table"}</button>
        </div>
      )}
      {!table && axes.length < 3 ? (
        // a spider needs 3+ axes to be a shape: with one or two (e.g. Reading in one language) bars say it better
        <div className="spider-bars">
          {axes.map((a) => (
            <div key={a.id} className="spider-bar-row" title={a.detail}>
              <span className="spider-bar-label">{a.emoji} {a.label}</span>
              <span className="spider-bar-track" role="img" aria-label={`${a.label}: ${a.value == null ? "not yet" : Math.round(a.value)}`}>
                {a.value != null && <span className="spider-bar-fill" style={{ width: `${a.value}%` }} />}
                {a.before != null && showBefore && <span className="spider-bar-before" style={{ left: `${a.before}%` }} />}
              </span>
              <span className="spider-bar-value">{a.value == null ? "not yet" : `${Math.round(a.value)} · ${a.band}`}</span>
            </div>
          ))}
        </div>
      ) : table ? (
        <table className="table small">
          <thead><tr><th>Skill</th><th>Now</th><th>Band</th>{hasBefore && <th>2 weeks ago</th>}<th>How</th></tr></thead>
          <tbody>{axes.map((a) => (
            <tr key={a.id}><td>{a.emoji} {a.label}</td><td>{a.value == null ? "not yet" : Math.round(a.value)}</td><td>{a.band ?? "–"}</td>
              {hasBefore && <td>{a.before == null ? "–" : Math.round(a.before)}</td>}<td className="muted">{a.detail}</td></tr>
          ))}</tbody>
        </table>
      ) : (
        <div className="spider-wrap" style={{ maxWidth: size }}>
          <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${title}: ${axes.map((a) => `${a.label} ${a.value == null ? "not yet assessed" : Math.round(a.value)}`).join(", ")}`}>
            {RINGS.map((v) => (
              <polygon key={v} className={`ring${v === 100 ? " rim" : ""}`} points={Array.from({ length: n }, (_, i) => pt(i, v).join(",")).join(" ")} />
            ))}
            {axes.map((_, i) => { const [x, y] = pt(i, 100); return <line key={i} className="spoke" x1={c} y1={c} x2={x} y2={y} />; })}
            {!kid && RINGS.slice(0, 4).map((v) => <text key={v} className="ring-label" x={c + 3} y={c - (r * v) / 100 - 2}>{v}</text>)}
            {hasBefore && <polygon className="shape before" points={before} />}
            <polygon className="shape now" points={now} />
            {axes.map((a, i) => {
              const [x, y] = pt(i, a.value ?? 0);
              return (
                <g key={a.id} tabIndex={0} role="button" aria-label={`${a.label}: ${a.value == null ? "not assessed yet" : `${Math.round(a.value)}, ${a.band}`}`}
                  onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}>
                  <circle className="hit" cx={x} cy={y} r={14} />
                  <circle className={`dot${a.value == null ? " empty" : ""}`} cx={x} cy={y} r={kid ? 6 : 5} />
                </g>
              );
            })}
            {axes.map((a, i) => {
              const [x, y] = pt(i, 100);
              const dx = Math.cos(angle(i)), dy = Math.sin(angle(i));
              const lx = x + dx * (kid ? 26 : 12), ly = y + dy * (kid ? 26 : 12);
              const anchor = Math.abs(dx) < 0.3 ? "middle" : dx > 0 ? "start" : "end";
              return (
                <text key={a.id} className={`axis-label${a.value == null ? " muted" : ""}`} x={lx} y={ly + (dy > 0.3 ? 10 : dy < -0.3 ? -2 : 4)} textAnchor={anchor}>
                  <tspan className="axis-emoji">{a.emoji}</tspan>{!kid && <tspan> {a.label}</tspan>}
                  {!kid && <tspan className="axis-value" x={lx} dy="1.2em" textAnchor={anchor}>{a.value == null ? "not yet" : Math.round(a.value)}</tspan>}
                </text>
              );
            })}
          </svg>
          {!kid && (
            <p className="spider-help">
              <b>How to read:</b> each line from the centre is a skill; further out is stronger (rings: 20 Introduction · 40 Exploring ·
              60 Developing · 80 Proficient · 100 Mastery). A hollow dot means not tried enough yet.{hasBefore ? " Dashed orange: two weeks ago." : ""} Hover a dot for details.
            </p>
          )}
          {h && (
            <div className="spider-tip" role="status">
              <strong>{h.emoji} {h.label}</strong>
              <span>{h.value == null ? "Not assessed yet (this is not a zero)" : `${Math.round(h.value)} · ${h.band}`}</span>
              {h.before != null && !kid && <span className="muted">2 weeks ago: {Math.round(h.before)}</span>}
              {h.detail && !kid && <span className="muted">{h.detail}</span>}
            </div>
          )}
        </div>
      )}
    </figure>
  );
}
