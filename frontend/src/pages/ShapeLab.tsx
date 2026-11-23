// Shape Lab: play with geometry. Make (join dots into any shape: Melo names it and explains why, with its
// sides, corners, right angles, area, perimeter and symmetry), Mix (put squares and half-square triangles
// together and watch the area add up: two triangles make a square!) and Puzzles (make a shape that fits a rule).
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { speak } from "../audio/speech";
import { playSfx } from "../audio/synth";
import { Confetti, Melo } from "../components/Melo";
import { L, t, type Text } from "../i18n";
import { analyze, CHALLENGES, type Pt } from "../subjects/geometry";
import { useTeacher } from "../teaching/persona";
import { KidShell, useChild } from "./KidHome";

const N = 9, S = 40;
type Piece = "sq" | "tl" | "tr" | "bl" | "br";
const TXT = {
  make: { en: "Make shapes", hi: "आकृतियाँ बनाओ", hinglish: "Shapes banao" }, mix: { en: "Mix pieces", hi: "टुकड़े मिलाओ", hinglish: "Pieces mix karo" },
  puzzles: { en: "Shape puzzles", hi: "आकृति पहेलियाँ", hinglish: "Shape puzzles" },
  tapDots: { en: "Tap dots to make corners. Tap the first dot again to close your shape.", hi: "कोने बनाने के लिए बिंदु छुओ। आकृति बंद करने के लिए पहला बिंदु फिर छुओ।", hinglish: "Corners banane ke liye dots chhuo. Shape band karne ke liye pehla dot phir chhuo." },
  tapCells: { en: "Pick a piece, then tap squares on the grid. Put two triangles in one square and see what happens!", hi: "एक टुकड़ा चुनो, फिर ग्रिड पर छुओ। एक वर्ग में दो त्रिभुज रखकर देखो!", hinglish: "Ek piece chuno, phir grid pe chhuo. Ek square mein do triangle rakh ke dekho!" },
  clear: { en: "Clear", hi: "साफ़ करो", hinglish: "Saaf karo" }, undo: { en: "Undo", hi: "वापस", hinglish: "Undo" },
  solved: { en: "Solved!", hi: "हल हो गया!", hinglish: "Solve ho gaya!" },
} satisfies Record<string, Text>;

export function ShapeLab() {
  const { id = "" } = useParams();
  const { child } = useChild(id);
  const nav = useNavigate();
  const teacher = useTeacher(id, "maths");
  const [mode, setMode] = useState<"make" | "mix" | "puzzles">("make");
  const [pts, setPts] = useState<Pt[]>([]);
  const [closed, setClosed] = useState(false);
  const [cells, setCells] = useState<Record<string, Piece[]>>({});
  const [piece, setPiece] = useState<Piece>("sq");
  const [puzzle, setPuzzle] = useState(0);
  const [solved, setSolved] = useState<Record<string, boolean>>({});
  const [say, setSay] = useState("");
  const [party, setParty] = useState(0);
  const info = useMemo(() => (closed && pts.length >= 3 ? analyze(pts) : null), [closed, pts]);
  if (!child) return <div className="center-screen"><div className="spinner" /></div>;
  const lang = child.language;
  const talk = (s: string) => { setSay(s); void speak(s, lang); };

  const tapDot = (p: Pt) => {
    if (closed) { setPts([p]); setClosed(false); return; }
    if (pts.length >= 3 && p[0] === pts[0][0] && p[1] === pts[0][1]) {
      setClosed(true);
      const s = analyze(pts);
      playSfx("sparkle");
      if (s.crossing) { talk("Your lines cross each other. Try going around the outside, like walking around a garden."); return; }
      const line = `A ${s.name}! ${s.facts.join(" ")}`;
      if (mode === "puzzles") {
        const ch = CHALLENGES[puzzle];
        if (ch.test(s)) { setSolved({ ...solved, [ch.id]: true }); setParty((x) => x + 1); talk(`${L(TXT.solved, lang)} ${teacher.praise(lang)} ${line}`); }
        else talk(`You made a ${s.name}. ${ch.hint}`);
      } else talk(line);
      return;
    }
    if (pts.some((q) => q[0] === p[0] && q[1] === p[1])) return;
    setPts([...pts, p]);
  };
  const tapCell = (x: number, y: number) => {
    const k = `${x},${y}`, cur = cells[k] ?? [];
    let nextPieces: Piece[];
    if (piece === "sq") nextPieces = cur.includes("sq") ? [] : ["sq"];
    else nextPieces = cur.includes(piece) ? cur.filter((q) => q !== piece) : [...cur.filter((q) => q !== "sq"), piece].slice(-2);
    const next = { ...cells, [k]: nextPieces };
    setCells(next);
    const pair = nextPieces.length === 2 && ((nextPieces.includes("tl") && nextPieces.includes("br")) || (nextPieces.includes("tr") && nextPieces.includes("bl")));
    const total = Object.values(next).reduce((s, ps) => s + ps.reduce((a, q) => a + (q === "sq" ? 1 : 0.5), 0), 0);
    if (pair) { playSfx("tada"); talk(`Two half-square triangles fit together into one whole square! ½ + ½ = 1. Total area now: ${total} squares.`); }
    else talk(`Total area: ${total} square${total === 1 ? "" : "s"}. A triangle is half a square, so it counts as ½.`);
  };

  const dots = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) dots.push([x, y] as Pt);
  const poly = pts.map(([x, y]) => `${20 + x * S},${20 + y * S}`).join(" ");
  return (
    <KidShell child={child}>
      <div className="lesson shape-lab">
        <Confetti burst={party} />
        <div className="row center wrap"><h1>🧪 Shape Lab</h1><span className="help-badge full">{teacher.persona.emoji} {teacher.persona.name}</span></div>
        <div className="mode-switch" role="group">
          {(["make", "mix", "puzzles"] as const).map((m) => <button key={m} className={mode === m ? "sel" : ""} aria-pressed={mode === m} onClick={() => { setMode(m); setPts([]); setClosed(false); }}>{L(TXT[m], lang)}</button>)}
        </div>
        <Melo mood="happy" size={80} say={say || L(mode === "mix" ? TXT.tapCells : TXT.tapDots, lang)} />
        {mode === "puzzles" && (
          <div className="choice-cards">
            {CHALLENGES.map((c, i) => <button key={c.id} className={`choice-card${i === puzzle ? " sel" : ""}`} onClick={() => { setPuzzle(i); setPts([]); setClosed(false); talk(c.ask); }}>
              <span className="cc-icon">{solved[c.id] ? "✅" : "🧩"}</span>{c.ask}</button>)}
          </div>
        )}
        {mode !== "mix" ? (
          <svg viewBox={`0 0 ${N * S} ${N * S}`} className="lab-board" role="img" aria-label="dot paper">
            {closed && <polygon points={poly} fill="rgba(108,76,241,0.25)" stroke="var(--brand)" strokeWidth={4} strokeLinejoin="round" />}
            {!closed && pts.length > 1 && <polyline points={poly} fill="none" stroke="var(--brand)" strokeWidth={4} />}
            {dots.map(([x, y]) => {
              const i = pts.findIndex((p) => p[0] === x && p[1] === y);
              return <circle key={`${x}-${y}`} cx={20 + x * S} cy={20 + y * S} r={i === 0 && !closed ? 11 : i >= 0 ? 9 : 6}
                fill={i === 0 && !closed ? "var(--glow)" : i >= 0 ? "var(--brand)" : "var(--line)"} onClick={() => tapDot([x, y])} style={{ cursor: "pointer" }} />;
            })}
          </svg>
        ) : (
          <>
            <div className="row center wrap">
              {(["sq", "tl", "tr", "bl", "br"] as Piece[]).map((p) => (
                <button key={p} className={`chip${piece === p ? " sel" : ""}`} onClick={() => setPiece(p)} aria-pressed={piece === p}>
                  <svg viewBox="0 0 30 30" width={30} height={30}><Shape p={p} x={0} y={0} s={30} /></svg>
                </button>
              ))}
            </div>
            <svg viewBox={`0 0 ${6 * S + 2} ${6 * S + 2}`} className="lab-board" role="img" aria-label="pieces grid">
              {Array.from({ length: 36 }, (_, i) => {
                const x = i % 6, y = Math.floor(i / 6);
                return <g key={i} onClick={() => tapCell(x, y)} style={{ cursor: "pointer" }}>
                  <rect x={1 + x * S} y={1 + y * S} width={S} height={S} fill="var(--surface)" stroke="var(--line)" />
                  {(cells[`${x},${y}`] ?? []).map((p) => <Shape key={p} p={p} x={1 + x * S} y={1 + y * S} s={S} />)}
                </g>;
              })}
            </svg>
          </>
        )}
        {info && !info.crossing && (
          <div className="why-card" role="status"><span className="why-icon">📐</span>
            <div><p><strong>{info.name}</strong></p>{info.facts.map((f) => <p key={f} className="small">{f}</p>)}</div></div>
        )}
        <div className="row center wrap">
          {mode !== "mix" && <button className="btn ghost" onClick={() => { setPts(pts.slice(0, -1)); setClosed(false); }} disabled={!pts.length}>↩ {L(TXT.undo, lang)}</button>}
          <button className="btn ghost" onClick={() => { setPts([]); setClosed(false); setCells({}); setSay(""); }}>🧽 {L(TXT.clear, lang)}</button>
          <button className="btn ghost" onClick={() => nav(`/play/${id}/maths`)}>⬅ {t("back", lang)}</button>
        </div>
      </div>
    </KidShell>
  );
}

function Shape({ p, x, y, s }: { p: Piece; x: number; y: number; s: number }) {
  const c = { sq: "#ffb347", tl: "#6c4cf1", tr: "#3bceac", bl: "#ff5a5f", br: "#3a86ff" }[p];
  const pts = { sq: "", tl: `${x},${y} ${x + s},${y} ${x},${y + s}`, tr: `${x},${y} ${x + s},${y} ${x + s},${y + s}`,
    bl: `${x},${y} ${x},${y + s} ${x + s},${y + s}`, br: `${x + s},${y} ${x + s},${y + s} ${x},${y + s}` }[p];
  return p === "sq" ? <rect x={x + 1} y={y + 1} width={s - 2} height={s - 2} fill={c} opacity={0.85} /> : <polygon points={pts} fill={c} opacity={0.8} />;
}
