// Pictures that make an idea visible: objects to count, a number line with hops, tens rods and ones cubes,
// arrays, fair shares, fraction pizzas, a clock, coins, bar charts, a balance, shapes, angles, area grids,
// rulers. Concrete -> pictorial -> abstract, the way children understand maths.
import { Diagram } from "./Diagrams";
import type { Visual } from "./maths";

const INK = "var(--ink)", BRAND = "var(--brand)", SOFT = "var(--brand-soft)", LINE = "var(--line)", GLOW = "var(--glow)";

export function VisualView({ v }: { v: Visual }) {
  switch (v.type) {
    case "objects": return <Objects v={v} />;
    case "numberline": return <NumberLine v={v} />;
    case "tensones": return <TensOnes v={v} />;
    case "array": return <div className="viz-grid" style={{ gridTemplateColumns: `repeat(${v.cols}, auto)` }} aria-label={`${v.rows} rows of ${v.cols}`}>{Array.from({ length: v.rows * v.cols }, (_, i) => <span key={i}>{v.emoji}</span>)}</div>;
    case "share": return (
      <div className="viz-share" aria-label={`${v.total} shared into ${v.groups}`}>
        {Array.from({ length: v.groups }, (_, g) => <div key={g} className="viz-plate">{Array.from({ length: v.total / v.groups }, (_, i) => <span key={i}>{v.emoji}</span>)}</div>)}
      </div>);
    case "fraction": return <Fraction v={v} />;
    case "clock": return <Clock h={v.h} m={v.m} />;
    case "coins": return <div className="viz-coins">{v.coins.map((c, i) => <span key={i} className={`coin c${c}`}>₹{c}</span>)}</div>;
    case "bars": return <Bars v={v} />;
    case "balance": return <Balance left={v.left} right={v.right} />;
    case "shape": return <ShapePic sides={v.sides} kind={v.kind} />;
    case "pattern": return <div className="viz-pattern">{v.items.map((x, i) => <span key={i}>{x}</span>)}</div>;
    case "symmetry": return <Symmetry cells={v.cells} />;
    case "angle": return <Angle deg={v.deg} />;
    case "gridshape": return <GridRect w={v.w} h={v.h} />;
    case "ruler": return <Ruler n={v.length} emoji={v.emoji} />;
    case "compare": return <div className="viz-compare"><b>{v.a}</b><span aria-hidden>🐊</span><b>{v.b}</b></div>;
    case "column": return <Column a={v.a} b={v.b} op={v.op} />;
    case "steps": return <ol className="viz-steps">{v.lines.map((l, i) => <li key={i}>{l}</li>)}</ol>;
    case "diagram": return <Diagram name={v.name} show={v.show} />;
  }
}

function Objects({ v }: { v: Extract<Visual, { type: "objects" }> }) {
  const groups = v.groups ?? [v.count];
  return (
    <div className="viz-objects" aria-label={`${v.count} ${v.emoji}`}>
      {groups.map((g, gi) => (
        <div key={gi} className={`viz-group${gi ? " second" : ""}`}>{Array.from({ length: g }, (_, i) => <span key={i}>{v.emoji}</span>)}</div>
      ))}
    </div>
  );
}

function NumberLine({ v }: { v: Extract<Visual, { type: "numberline" }> }) {
  const step = Math.abs(v.step);
  const lo = Math.min(v.from, v.start + v.hops * v.step), hi = Math.max(v.to, v.start + v.hops * v.step);
  const ticks: number[] = [];
  const unit = step > 1 ? step : 1;
  for (let n = lo; n <= hi; n += unit) ticks.push(n);
  const W = 640, x = (n: number) => 30 + ((n - lo) / Math.max(1, hi - lo)) * (W - 60);
  return (
    <svg viewBox={`0 0 ${W} 110`} className="viz-svg" role="img" aria-label="number line">
      <line x1={20} y1={80} x2={W - 20} y2={80} stroke={INK} strokeWidth={3} />
      {ticks.map((n) => <g key={n}><line x1={x(n)} y1={72} x2={x(n)} y2={88} stroke={INK} strokeWidth={2} /><text x={x(n)} y={106} textAnchor="middle" fontSize={16} fill={INK}>{n}</text></g>)}
      {Array.from({ length: v.hops }, (_, i) => {
        const a = x(v.start + i * v.step), b = x(v.start + (i + 1) * v.step);
        return <path key={i} d={`M${a},72 Q${(a + b) / 2},${20} ${b},72`} fill="none" stroke={BRAND} strokeWidth={3} markerEnd="url(#arrow)" />;
      })}
      <defs><marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill={BRAND} /></marker></defs>
      <circle cx={x(v.start)} cy={80} r={7} fill={GLOW} stroke={INK} />
    </svg>
  );
}

function TensOnes({ v }: { v: Extract<Visual, { type: "tensones" }> }) {
  return (
    <div className="viz-blocks" aria-label={`${v.hundreds ?? 0} hundreds ${v.tens} tens ${v.ones} ones`}>
      {Array.from({ length: v.hundreds ?? 0 }, (_, i) => <span key={`h${i}`} className="blk hundred" title="100" />)}
      {Array.from({ length: v.tens }, (_, i) => <span key={`t${i}`} className="blk ten" title="10" />)}
      <span className="blk-ones">{Array.from({ length: v.ones }, (_, i) => <span key={`o${i}`} className="blk one" title="1" />)}</span>
    </div>
  );
}

function Fraction({ v }: { v: Extract<Visual, { type: "fraction" }> }) {
  if (v.shape === "bar") {
    return (
      <svg viewBox="0 0 400 70" className="viz-svg narrow" role="img" aria-label={`${v.shaded} of ${v.parts}`}>
        {Array.from({ length: v.parts }, (_, i) => <rect key={i} x={10 + (i * 380) / v.parts} y={10} width={380 / v.parts} height={50} fill={i < v.shaded ? BRAND : SOFT} stroke={INK} strokeWidth={2} />)}
      </svg>
    );
  }
  const r = 70, c = 80;
  return (
    <svg viewBox="0 0 160 160" className="viz-svg small" role="img" aria-label={`${v.shaded} of ${v.parts}`}>
      {Array.from({ length: v.parts }, (_, i) => {
        const a0 = (i / v.parts) * 2 * Math.PI - Math.PI / 2, a1 = ((i + 1) / v.parts) * 2 * Math.PI - Math.PI / 2;
        const large = a1 - a0 > Math.PI ? 1 : 0;
        return <path key={i} d={`M${c},${c} L${c + r * Math.cos(a0)},${c + r * Math.sin(a0)} A${r},${r} 0 ${large} 1 ${c + r * Math.cos(a1)},${c + r * Math.sin(a1)} Z`}
          fill={i < v.shaded ? "#ffb347" : "#fff4dd"} stroke={INK} strokeWidth={2} />;
      })}
    </svg>
  );
}

export function Clock({ h, m }: { h: number; m: number }) {
  const ha = (((h % 12) + m / 60) / 12) * 2 * Math.PI, ma = (m / 60) * 2 * Math.PI;
  const hand = (a: number, len: number) => [80 + len * Math.sin(a), 80 - len * Math.cos(a)];
  const [hx, hy] = hand(ha, 38), [mx, my] = hand(ma, 60);
  return (
    <svg viewBox="0 0 160 160" className="viz-svg small" role="img" aria-label={`clock ${h}:${String(m).padStart(2, "0")}`}>
      <circle cx={80} cy={80} r={74} fill="var(--surface)" stroke={INK} strokeWidth={4} />
      {Array.from({ length: 12 }, (_, i) => { const a = ((i + 1) / 12) * 2 * Math.PI; return <text key={i} x={80 + 58 * Math.sin(a)} y={86 - 58 * Math.cos(a)} textAnchor="middle" fontSize={15} fontWeight={700} fill={INK}>{i + 1}</text>; })}
      <line x1={80} y1={80} x2={hx} y2={hy} stroke={INK} strokeWidth={7} strokeLinecap="round" />
      <line x1={80} y1={80} x2={mx} y2={my} stroke={BRAND} strokeWidth={4} strokeLinecap="round" />
      <circle cx={80} cy={80} r={5} fill={INK} />
    </svg>
  );
}

function Bars({ v }: { v: Extract<Visual, { type: "bars" }> }) {
  const max = Math.max(...v.data.map((d) => d.value), 1), H = 140, bw = 50;
  return (
    <svg viewBox={`0 0 ${40 + v.data.length * (bw + 20)} ${H + 50}`} className="viz-svg narrow" role="img" aria-label="bar chart">
      {Array.from({ length: max + 1 }, (_, i) => <g key={i}><line x1={30} x2={40 + v.data.length * (bw + 20)} y1={H - (i / max) * (H - 10)} y2={H - (i / max) * (H - 10)} stroke={LINE} /><text x={22} y={H - (i / max) * (H - 10) + 5} fontSize={12} textAnchor="end" fill={INK}>{i}</text></g>)}
      {v.data.map((d, i) => <g key={d.label}><rect x={40 + i * (bw + 20)} y={H - (d.value / max) * (H - 10)} width={bw} height={(d.value / max) * (H - 10)} fill={BRAND} rx={4} /><text x={40 + i * (bw + 20) + bw / 2} y={H + 30} fontSize={24} textAnchor="middle">{d.label}</text></g>)}
    </svg>
  );
}

function Balance({ left, right }: { left: string; right: string }) {
  return (
    <svg viewBox="0 0 320 150" className="viz-svg narrow" role="img" aria-label={`${left} equals ${right}`}>
      <polygon points="160,140 140,150 180,150" fill={INK} /><line x1={160} y1={140} x2={160} y2={50} stroke={INK} strokeWidth={5} />
      <line x1={40} y1={50} x2={280} y2={50} stroke={INK} strokeWidth={5} />
      {[[70, left], [250, right]].map(([x, t]) => <g key={String(x)}><line x1={Number(x)} y1={50} x2={Number(x)} y2={80} stroke={INK} strokeWidth={2} />
        <rect x={Number(x) - 60} y={80} width={120} height={36} rx={10} fill={SOFT} stroke={BRAND} strokeWidth={2} />
        <text x={Number(x)} y={105} textAnchor="middle" fontSize={20} fontWeight={800} fill={INK}>{t}</text></g>)}
    </svg>
  );
}

export function ShapePic({ sides, kind }: { sides: number; kind?: string }) {
  const c = 80;
  let el: JSX.Element;
  if (kind === "circle") el = <circle cx={c} cy={c} r={60} />;
  else if (kind === "oval") el = <ellipse cx={c} cy={c} rx={70} ry={45} />;
  else if (kind === "square") el = <rect x={25} y={25} width={110} height={110} />;
  else if (kind === "rectangle") el = <rect x={10} y={45} width={140} height={70} />;
  else {
    const pts = Array.from({ length: sides }, (_, i) => { const a = (i / sides) * 2 * Math.PI - Math.PI / 2; return `${c + 65 * Math.cos(a)},${c + 8 + 65 * Math.sin(a)}`; });
    el = <polygon points={pts.join(" ")} />;
  }
  return <svg viewBox="0 0 160 160" className="viz-svg small" role="img" aria-label="shape"><g fill="#ffd9a0" stroke={INK} strokeWidth={4} strokeLinejoin="round">{el}</g></svg>;
}

function Symmetry({ cells }: { cells: boolean[][] }) {
  const n = cells.length, s = 30;
  return (
    <svg viewBox={`0 0 ${n * s + 4} ${n * s + 4}`} className="viz-svg small" role="img" aria-label="symmetry picture">
      {cells.flatMap((row, r) => row.map((on, c) => <rect key={`${r}-${c}`} x={2 + c * s} y={2 + r * s} width={s} height={s} fill={on ? BRAND : "var(--surface)"} stroke={LINE} />))}
      <line x1={2 + (n * s) / 2} x2={2 + (n * s) / 2} y1={0} y2={n * s + 4} stroke="#e4572e" strokeWidth={3} strokeDasharray="6 5" />
    </svg>
  );
}

function Angle({ deg }: { deg: number }) {
  const a = (deg * Math.PI) / 180, ox = 40, oy = 130, L = 110;
  return (
    <svg viewBox="0 0 200 150" className="viz-svg small" role="img" aria-label={`angle ${deg} degrees`}>
      <line x1={ox} y1={oy} x2={ox + L} y2={oy} stroke={INK} strokeWidth={5} strokeLinecap="round" />
      <line x1={ox} y1={oy} x2={ox + L * Math.cos(a)} y2={oy - L * Math.sin(a)} stroke={INK} strokeWidth={5} strokeLinecap="round" />
      {deg === 90 ? <rect x={ox} y={oy - 22} width={22} height={22} fill="none" stroke={BRAND} strokeWidth={3} />
        : <path d={`M${ox + 30},${oy} A30,30 0 0 0 ${ox + 30 * Math.cos(a)},${oy - 30 * Math.sin(a)}`} fill="none" stroke={BRAND} strokeWidth={3} />}
    </svg>
  );
}

function GridRect({ w, h }: { w: number; h: number }) {
  const s = 28;
  return (
    <svg viewBox={`0 0 ${w * s + 40} ${h * s + 40}`} className="viz-svg narrow" role="img" aria-label={`${w} by ${h} rectangle`}>
      {Array.from({ length: w * h }, (_, i) => <rect key={i} x={20 + (i % w) * s} y={20 + Math.floor(i / w) * s} width={s} height={s} fill="#c9f2d9" stroke="#59b37f" />)}
      <rect x={20} y={20} width={w * s} height={h * s} fill="none" stroke={INK} strokeWidth={3} />
      <text x={20 + (w * s) / 2} y={14} textAnchor="middle" fontSize={14} fill={INK}>{w}</text>
      <text x={10} y={24 + (h * s) / 2} textAnchor="middle" fontSize={14} fill={INK}>{h}</text>
    </svg>
  );
}

function Ruler({ n, emoji }: { n: number; emoji: string }) {
  const s = 40, W = Math.max(n, 8) * s + 60;
  return (
    <svg viewBox={`0 0 ${W} 110`} className="viz-svg" role="img" aria-label={`${emoji} on a ruler`}>
      <rect x={20} y={10} width={n * s} height={30} rx={8} fill="#ffe08a" stroke={INK} strokeWidth={2} />
      <text x={20 + (n * s) / 2} y={33} textAnchor="middle" fontSize={20}>{emoji}</text>
      <rect x={10} y={50} width={W - 20} height={45} fill="#fff7d6" stroke={INK} strokeWidth={2} rx={4} />
      {Array.from({ length: Math.max(n, 8) + 1 }, (_, i) => <g key={i}><line x1={20 + i * s} y1={50} x2={20 + i * s} y2={68} stroke={INK} strokeWidth={2} /><text x={20 + i * s} y={88} textAnchor="middle" fontSize={14} fill="#23203a">{i}</text></g>)}
    </svg>
  );
}

function Column({ a, b, op }: { a: number; b: number; op: string }) {
  const w = Math.max(String(a).length, String(b).length) + 1;
  const pad = (n: number) => String(n).padStart(w, " ");
  return <pre className="viz-column" aria-label={`${a} ${op} ${b}`}>{`  ${pad(a)}\n${op} ${pad(b)}\n${"─".repeat(w + 2)}`}</pre>;
}
