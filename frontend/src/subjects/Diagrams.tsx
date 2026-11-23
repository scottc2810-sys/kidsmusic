// Simple, clear science diagrams a child could copy into a notebook: a plant with its parts, the water cycle,
// the solar system, day and night, a butterfly's life cycle, particles in solids, liquids and gases, a magnet,
// a shadow, a circuit, the senses, a healthy plate. `show="numbers"` swaps the part names for numbers
// (for "which number is the stem?" questions).
const INK = "var(--ink)";

function Tag({ x, y, n, name, show, anchor = "start" }: { x: number; y: number; n: number; name: string; show: "names" | "numbers"; anchor?: "start" | "end" | "middle" }) {
  return show === "numbers"
    ? <g><circle cx={x} cy={y - 6} r={13} fill="var(--brand)" /><text x={x} y={y - 1} textAnchor="middle" fontSize={15} fontWeight={800} fill="#fff">{n}</text></g>
    : <text x={x} y={y} textAnchor={anchor} fontSize={16} fontWeight={800} fill={INK}>{name}</text>;
}

export function Diagram({ name, show }: { name: string; show: "names" | "numbers" }) {
  const svg = (w: number, h: number, children: React.ReactNode, label: string) => <svg viewBox={`0 0 ${w} ${h}`} className="viz-svg diagram" role="img" aria-label={label}>{children}</svg>;
  switch (name) {
    case "plant": return svg(360, 300, <>
      <rect x={0} y={200} width={360} height={100} fill="#8b5a2b" opacity={0.35} />
      <path d="M180 200 C178 150 182 110 180 60" stroke="#3c9d3c" strokeWidth={8} fill="none" />
      <ellipse cx={140} cy={130} rx={38} ry={16} fill="#5cbf5c" transform="rotate(-25 140 130)" /><ellipse cx={222} cy={110} rx={38} ry={16} fill="#5cbf5c" transform="rotate(25 222 110)" />
      {[0, 72, 144, 216, 288].map((a) => <ellipse key={a} cx={180 + 18 * Math.cos((a * Math.PI) / 180)} cy={48 + 18 * Math.sin((a * Math.PI) / 180)} rx={14} ry={9} fill="#ff7eb6" transform={`rotate(${a} ${180 + 18 * Math.cos((a * Math.PI) / 180)} ${48 + 18 * Math.sin((a * Math.PI) / 180)})`} />)}
      <circle cx={180} cy={48} r={9} fill="#ffd23f" /><circle cx={208} cy={160} r={13} fill="#e4572e" />
      {[-40, -15, 10, 35].map((dx) => <path key={dx} d={`M180 200 Q${180 + dx / 2} 230 ${180 + dx} 270`} stroke="#c9a26b" strokeWidth={4} fill="none" />)}
      <Tag x={240} y={45} n={1} name="flower" show={show} /><Tag x={30} y={125} n={2} name="leaf" show={show} /><Tag x={100} y={185} n={3} name="stem" show={show} />
      <Tag x={240} y={260} n={4} name="roots" show={show} /><Tag x={240} y={170} n={5} name="fruit" show={show} />
    </>, "parts of a plant");
    case "photosynthesis": return svg(360, 220, <>
      <circle cx={50} cy={50} r={30} fill="#ffd23f" />{[0, 1, 2].map((i) => <line key={i} x1={85} y1={60 + i * 12} x2={170} y2={100 + i * 8} stroke="#ffb703" strokeWidth={3} strokeDasharray="6 4" />)}
      <ellipse cx={200} cy={110} rx={60} ry={28} fill="#5cbf5c" />
      <text x={20} y={110} fontSize={15} fill={INK}>☀️ sunlight</text><text x={210} y={190} fontSize={15} fill={INK}>💧 water (from roots)</text>
      <text x={250} y={45} fontSize={15} fill={INK}>💨 air in (CO₂)</text><text x={260} y={110} fontSize={15} fill={INK}>→ 🍬 food</text><text x={262} y={135} fontSize={15} fill={INK}>→ O₂ out</text>
    </>, "how a leaf makes food");
    case "water_cycle": return svg(400, 260, <>
      <rect x={0} y={200} width={400} height={60} fill="#5aa9e6" /><circle cx={340} cy={45} r={28} fill="#ffd23f" />
      <path d="M40 120 Q 70 90 110 110 Q 140 80 170 110 Q 190 130 160 140 L 60 140 Q 30 140 40 120" fill="#e8eef7" stroke="#9fb3c8" />
      {[70, 95, 120, 145].map((x) => <line key={x} x1={x} y1={150} x2={x - 8} y2={185} stroke="#5aa9e6" strokeWidth={3} />)}
      {[240, 270, 300].map((x) => <path key={x} d={`M${x} 195 q -8 -20 0 -40 q 8 -20 0 -40`} stroke="#9fb3c8" strokeWidth={3} fill="none" strokeDasharray="5 4" />)}
      <path d="M190 120 Q 220 100 235 110" stroke={INK} strokeWidth={2} fill="none" markerEnd="url(#a)" />
      <defs><marker id="a" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill={INK} /></marker></defs>
      <Tag x={230} y={240} n={1} name="1 evaporation" show={show} /><Tag x={60} y={80} n={2} name="2 condensation" show={show} />
      <Tag x={10} y={175} n={3} name="3 rain" show={show} /><Tag x={20} y={235} n={4} name="4 collection" show={show} />
    </>, "the water cycle");
    case "solar": return svg(420, 160, <>
      <circle cx={20} cy={80} r={60} fill="#ffd23f" />
      {["#b0a89a", "#e6c27a", "#3a86ff", "#e4572e", "#d9a066", "#e8c77a", "#7fd1d9", "#4561d9"].map((c, i) => {
        const x = 100 + i * 40, r = [5, 8, 9, 7, 18, 15, 11, 11][i];
        return <g key={i}><circle cx={x} cy={80} r={r} fill={c} />{i === 5 && <ellipse cx={x} cy={80} rx={24} ry={5} fill="none" stroke="#b89b5e" strokeWidth={2} />}
          {show === "names" && <text x={x} y={i % 2 ? 130 : 45} textAnchor="middle" fontSize={11} fill={INK}>{["Mercury", "Venus", "Earth", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune"][i]}</text>}</g>;
      })}
    </>, "the solar system");
    case "day_night": return svg(360, 180, <>
      <circle cx={40} cy={90} r={30} fill="#ffd23f" /><line x1={75} y1={90} x2={170} y2={90} stroke="#ffb703" strokeWidth={3} strokeDasharray="6 4" />
      <circle cx={230} cy={90} r={60} fill="#3a86ff" /><path d="M230 30 A60 60 0 0 1 230 150 Z" fill="#1b2a4a" />
      <text x={175} y={170} fontSize={15} fill={INK}>☀️ day</text><text x={255} y={170} fontSize={15} fill={INK}>🌙 night</text>
      <path d="M300 40 q 30 50 0 100" stroke={INK} strokeWidth={2} fill="none" markerEnd="url(#s)" />
      <defs><marker id="s" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill={INK} /></marker></defs>
    </>, "day and night");
    case "butterfly": return svg(320, 300, <>
      <circle cx={160} cy={150} r={95} fill="none" stroke="var(--line)" strokeWidth={4} strokeDasharray="8 6" />
      <text x={160} y={62} textAnchor="middle" fontSize={34}>🥚</text><text x={262} y={160} textAnchor="middle" fontSize={34}>🐛</text>
      <text x={160} y={262} textAnchor="middle" fontSize={34}>🫘</text><text x={58} y={160} textAnchor="middle" fontSize={34}>🦋</text>
      {show === "names" && <><text x={160} y={28} textAnchor="middle" fontSize={14} fill={INK}>1 egg</text><text x={262} y={195} textAnchor="middle" fontSize={14} fill={INK}>2 caterpillar</text>
        <text x={160} y={292} textAnchor="middle" fontSize={14} fill={INK}>3 pupa</text><text x={58} y={195} textAnchor="middle" fontSize={14} fill={INK}>4 butterfly</text></>}
    </>, "life cycle of a butterfly");
    case "matter": return svg(420, 170, <>
      {[["solid", 0], ["liquid", 1], ["gas", 2]].map(([label, k]) => {
        const x0 = 10 + Number(k) * 140;
        const dots = Number(k) === 0 ? Array.from({ length: 16 }, (_, i) => [x0 + 25 + (i % 4) * 22, 40 + Math.floor(i / 4) * 22])
          : Number(k) === 1 ? Array.from({ length: 12 }, (_, i) => [x0 + 22 + ((i * 37) % 90), 70 + ((i * 23) % 50)])
          : Array.from({ length: 6 }, (_, i) => [x0 + 20 + ((i * 53) % 100), 30 + ((i * 41) % 100)]);
        return <g key={String(label)}><rect x={x0} y={20} width={125} height={115} rx={10} fill="none" stroke={INK} strokeWidth={2} />
          {dots.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={8} fill={["#3a86ff", "#3bceac", "#ff9f1c"][Number(k)]} />)}
          <text x={x0 + 62} y={160} textAnchor="middle" fontSize={16} fontWeight={800} fill={INK}>{label}</text></g>;
      })}
    </>, "particles in solids, liquids and gases");
    case "magnet": return svg(320, 150, <>
      <path d="M60 30 h50 v70 a30 30 0 0 0 60 0 v-70 h50 v70 a80 80 0 0 1 -160 0 z" fill="#e4572e" stroke={INK} strokeWidth={2} />
      <rect x={60} y={30} width={50} height={22} fill="#ddd" /><rect x={170} y={30} width={50} height={22} fill="#ddd" />
      <text x={85} y={47} textAnchor="middle" fontSize={14} fontWeight={800}>N</text><text x={195} y={47} textAnchor="middle" fontSize={14} fontWeight={800}>S</text>
      <text x={260} y={60} fontSize={26}>📎</text><text x={260} y={110} fontSize={26}>🔩</text>
    </>, "a magnet attracting iron");
    case "shadow": return svg(360, 170, <>
      <text x={20} y={70} fontSize={44}>🔦</text>{[0, 1, 2].map((i) => <line key={i} x1={70} y1={55} x2={170} y2={40 + i * 30} stroke="#ffd23f" strokeWidth={3} />)}
      <rect x={170} y={40} width={30} height={90} fill="#c97b3a" /><polygon points="200,40 340,20 340,150 200,130" fill="#555" opacity={0.6} />
      <text x={265} y={165} textAnchor="middle" fontSize={14} fill={INK}>shadow</text>
    </>, "light making a shadow");
    case "circuit": return svg(320, 200, <>
      <rect x={40} y={40} width={240} height={120} fill="none" stroke="#c97b3a" strokeWidth={5} />
      <rect x={20} y={80} width={40} height={50} fill="#444" /><text x={40} y={110} textAnchor="middle" fontSize={12} fill="#fff">+ −</text>
      <circle cx={160} cy={40} r={20} fill="#fff3b0" stroke={INK} strokeWidth={2} /><text x={160} y={46} textAnchor="middle" fontSize={18}>💡</text>
      <line x1={220} y1={160} x2={255} y2={140} stroke={INK} strokeWidth={5} /><rect x={210} y={150} width={60} height={20} fill="var(--bg)" />
      <line x1={215} y1={160} x2={250} y2={138} stroke={INK} strokeWidth={5} />
      <text x={240} y={190} textAnchor="middle" fontSize={13} fill={INK}>switch (open)</text><text x={40} y={150} textAnchor="middle" fontSize={13} fill={INK}>battery</text>
    </>, "a simple circuit");
    case "senses": return svg(360, 140, <>
      {[["👀", "see"], ["👂", "hear"], ["👃", "smell"], ["👅", "taste"], ["✋", "touch"]].map(([e, w], i) => <g key={w}>
        <text x={36 + i * 72} y={70} textAnchor="middle" fontSize={40}>{e}</text><text x={36 + i * 72} y={110} textAnchor="middle" fontSize={15} fontWeight={800} fill={INK}>{w}</text></g>)}
    </>, "the five senses");
    case "plate": return svg(320, 220, <>
      <circle cx={160} cy={110} r={100} fill="var(--surface)" stroke={INK} strokeWidth={3} />
      <path d="M160 110 L160 10 A100 100 0 0 1 247 160 Z" fill="#ffe08a" /><path d="M160 110 L247 160 A100 100 0 0 1 73 160 Z" fill="#c9f2d9" /><path d="M160 110 L73 160 A100 100 0 0 1 160 10 Z" fill="#ffc9c9" />
      <text x={200} y={80} fontSize={14} fontWeight={800}>🍚 energy</text><text x={160} y={190} textAnchor="middle" fontSize={14} fontWeight={800}>🥦 protective</text>
      <text x={78} y={90} fontSize={14} fontWeight={800}>🥚 body-building</text>
    </>, "a healthy plate");
    case "skeleton": return svg(220, 300, <>
      <circle cx={110} cy={40} r={26} fill="#f4f1e8" stroke={INK} strokeWidth={3} />
      <line x1={110} y1={66} x2={110} y2={170} stroke={INK} strokeWidth={6} strokeDasharray="10 4" />
      {[90, 105, 120, 135].map((y) => <path key={y} d={`M75 ${y} Q110 ${y - 12} 145 ${y}`} fill="none" stroke={INK} strokeWidth={3} />)}
      <line x1={110} y1={80} x2={55} y2={150} stroke={INK} strokeWidth={5} /><line x1={110} y1={80} x2={165} y2={150} stroke={INK} strokeWidth={5} />
      <line x1={110} y1={170} x2={75} y2={285} stroke={INK} strokeWidth={6} /><line x1={110} y1={170} x2={145} y2={285} stroke={INK} strokeWidth={6} />
      <circle cx={92} cy={228} r={6} fill="var(--brand)" /><circle cx={128} cy={228} r={6} fill="var(--brand)" />
      {show === "names" && <><text x={145} y={30} fontSize={13} fill={INK}>skull</text><text x={150} y={112} fontSize={13} fill={INK}>ribs</text><text x={120} y={185} fontSize={13} fill={INK}>spine</text><text x={140} y={232} fontSize={13} fill={INK}>joint (knee)</text></>}
    </>, "skeleton");
    case "tooth": return svg(320, 160, <>
      <path d="M30 40 h20 v70 h-20 z" fill="#fff" stroke={INK} strokeWidth={3} /><text x={40} y={140} textAnchor="middle" fontSize={14} fontWeight={800} fill={INK}>cut</text>
      <path d="M120 30 l10 -15 l10 15 v80 h-20 z" fill="#fff" stroke={INK} strokeWidth={3} /><text x={130} y={140} textAnchor="middle" fontSize={14} fontWeight={800} fill={INK}>tear</text>
      <path d="M205 40 h50 v20 q-6 10 0 20 v30 h-50 v-30 q6 -10 0 -20 z" fill="#fff" stroke={INK} strokeWidth={3} /><text x={230} y={140} textAnchor="middle" fontSize={14} fontWeight={800} fill={INK}>crush</text>
      {show === "names" && <><text x={40} y={22} textAnchor="middle" fontSize={12} fill={INK}>front</text><text x={130} y={10} textAnchor="middle" fontSize={12} fill={INK}>pointy</text><text x={230} y={22} textAnchor="middle" fontSize={12} fill={INK}>back</text></>}
    </>, "kinds of teeth");
    case "digestion": return svg(260, 320, <>
      <ellipse cx={130} cy={30} rx={34} ry={20} fill="#ffd6c9" stroke={INK} strokeWidth={2} /><line x1={130} y1={50} x2={130} y2={110} stroke="#e4572e" strokeWidth={10} />
      <path d="M130 110 q40 0 40 30 q0 30 -40 30 q-20 0 -20 -20" fill="#ffb3a7" stroke={INK} strokeWidth={2} />
      <path d="M100 185 q-30 10 0 20 q30 10 0 20 q-30 10 0 20 q30 10 0 20" fill="none" stroke="#f08c00" strokeWidth={8} />
      <path d="M60 180 h140 v100 h-140 z" fill="none" stroke="#a0522d" strokeWidth={8} opacity={0.6} />
      {show === "names" && <><text x={175} y={34} fontSize={12} fill={INK}>1 mouth</text><text x={140} y={82} fontSize={12} fill={INK}>2 food pipe</text><text x={175} y={142} fontSize={12} fill={INK}>3 stomach</text><text x={120} y={238} fontSize={12} fill={INK}>4 small intestine</text><text x={60} y={302} fontSize={12} fill={INK}>5 large intestine</text></>}
    </>, "digestive system");
    case "heart_lungs": return svg(280, 200, <>
      <path d="M60 40 q-40 20 -30 110 q30 20 60 0 v-110 z" fill="#ffb3c6" stroke={INK} strokeWidth={2} /><path d="M220 40 q40 20 30 110 q-30 20 -60 0 v-110 z" fill="#ffb3c6" stroke={INK} strokeWidth={2} />
      <path d="M140 150 l-30 -30 a17 17 0 0 1 30 -22 a17 17 0 0 1 30 22 z" fill="#e4572e" stroke={INK} strokeWidth={2} />
      <line x1={140} y1={10} x2={140} y2={40} stroke="#9fb3c8" strokeWidth={8} />
      {show === "names" && <><text x={20} y={185} fontSize={13} fill={INK}>lung</text><text x={225} y={185} fontSize={13} fill={INK}>lung</text><text x={120} y={175} fontSize={13} fill={INK}>heart</text><text x={150} y={22} fontSize={12} fill={INK}>windpipe</text></>}
    </>, "heart and lungs");
    case "sound": return svg(360, 160, <>
      <text x={20} y={95} fontSize={44}>🥁</text>
      {[0, 1, 2, 3].map((i) => <path key={i} d={`M${90 + i * 45} 40 q25 40 0 80`} fill="none" stroke="var(--brand)" strokeWidth={4} opacity={1 - i * 0.2} />)}
      <text x={300} y={95} fontSize={44}>👂</text>
      {show === "names" && <text x={180} y={150} textAnchor="middle" fontSize={13} fill={INK}>vibrations travel through the air</text>}
    </>, "sound travelling");
    case "float": return svg(320, 180, <>
      <rect x={0} y={70} width={320} height={110} fill="#5aa9e6" opacity={0.6} /><line x1={0} y1={70} x2={320} y2={70} stroke="#1d4ed8" strokeWidth={2} />
      <text x={40} y={75} fontSize={36}>🪵</text><text x={130} y={72} fontSize={30}>🍃</text><text x={210} y={170} fontSize={30}>🪨</text><text x={270} y={170} fontSize={26}>🪙</text>
      {show === "names" && <><text x={60} y={40} fontSize={14} fontWeight={800} fill={INK}>floats</text><text x={225} y={110} fontSize={14} fontWeight={800} fill="#fff">sinks</text></>}
    </>, "floating and sinking");
    case "seed": return svg(400, 170, <>
      <rect x={0} y={110} width={400} height={60} fill="#8b5a2b" opacity={0.35} />
      {["🌰", "🌱", "🌿", "🪴", "🌻"].map((e, i) => <text key={i} x={40 + i * 80} y={110} textAnchor="middle" fontSize={34}>{e}</text>)}
      {show === "names" && ["seed", "root & shoot", "leaves", "grows", "flower"].map((w, i) => <text key={w} x={40 + i * 80} y={150} textAnchor="middle" fontSize={12} fill={INK}>{w}</text>)}
    </>, "how a seed grows");
    case "moon": return svg(400, 130, <>
      {["🌑", "🌒", "🌓", "🌔", "🌕", "🌖", "🌗", "🌘"].map((e, i) => <g key={i}>
        <text x={25 + i * 50} y={60} textAnchor="middle" fontSize={34}>{e}</text>
        {show === "names" && <text x={25 + i * 50} y={95} textAnchor="middle" fontSize={11} fill={INK}>{["new", "crescent", "half", "", "full", "", "half", ""][i]}</text>}</g>)}
    </>, "phases of the moon");
    case "lever": return svg(340, 150, <>
      <polygon points="170,120 150,140 190,140" fill={INK} /><line x1={30} y1={110} x2={310} y2={130} stroke="#c97b3a" strokeWidth={8} />
      <text x={40} y={100} fontSize={34}>🧒</text><text x={230} y={115} fontSize={40}>📦</text>
      {show === "names" && <><text x={170} y={150} textAnchor="middle" fontSize={12} fill={INK}>pivot</text><text x={40} y={145} fontSize={12} fill={INK}>small push, far away</text></>}
    </>, "a lever");
    default: return null;
  }
}
