// What a shape drawn on dot paper IS, and why: its name, sides, corners, right angles, area (shoelace, i.e.
// counting squares), perimeter, and lines of symmetry. Pure functions, used by the Shape Lab.
export type Pt = [number, number];

const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]];
const dot = (a: Pt, b: Pt) => a[0] * b[0] + a[1] * b[1];
const cross = (a: Pt, b: Pt) => a[0] * b[1] - a[1] * b[0];
const len2 = (a: Pt) => dot(a, a);

export interface ShapeInfo {
  sides: number; name: string; rightAngles: number; area: number; perimeter: number; perimeterExact: boolean;
  equalSides: boolean; symmetry: number; crossing: boolean; facts: string[];
}

function segmentsCross(p1: Pt, p2: Pt, p3: Pt, p4: Pt): boolean {
  const d1 = cross(sub(p4, p3), sub(p1, p3)), d2 = cross(sub(p4, p3), sub(p2, p3));
  const d3 = cross(sub(p2, p1), sub(p3, p1)), d4 = cross(sub(p2, p1), sub(p4, p1));
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

/** Drop points that sit on a straight line between their neighbours (they are not real corners). */
export function corners(pts: Pt[]): Pt[] {
  const out = pts.filter((p, i) => {
    const a = pts[(i - 1 + pts.length) % pts.length], b = pts[(i + 1) % pts.length];
    return cross(sub(p, a), sub(b, p)) !== 0;
  });
  return out.length >= 3 ? out : pts;
}

const NAMES: Record<number, string> = { 3: "triangle", 4: "quadrilateral", 5: "pentagon", 6: "hexagon", 7: "heptagon", 8: "octagon" };

export function analyze(raw: Pt[]): ShapeInfo {
  const pts = corners(raw);
  const n = pts.length;
  const edges = pts.map((p, i) => sub(pts[(i + 1) % n], p));
  const L2 = edges.map(len2);
  const rightAngles = pts.filter((_, i) => dot(edges[(i - 1 + n) % n], edges[i]) === 0).length;
  let area2 = 0;
  pts.forEach((p, i) => { const q = pts[(i + 1) % n]; area2 += p[0] * q[1] - q[0] * p[1]; });
  const area = Math.abs(area2) / 2;
  const exact = edges.every((e) => e[0] === 0 || e[1] === 0);
  const perimeter = Math.round(L2.reduce((s, x) => s + Math.sqrt(x), 0) * 10) / 10;
  const equalSides = L2.every((x) => x === L2[0]);
  let crossing = false;
  for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) if (!(i === 0 && j === n - 1) && segmentsCross(pts[i], pts[(i + 1) % n], pts[j], pts[(j + 1) % n])) crossing = true;

  let name = NAMES[n] ?? `${n}-sided shape`;
  const facts: string[] = [];
  if (n === 3) {
    const kinds = new Set(L2).size;
    name = rightAngles ? "right triangle" : kinds === 1 ? "equilateral triangle" : kinds === 2 ? "isosceles triangle" : "scalene triangle";
    if (rightAngles) facts.push("It has a square corner (a right angle), so it's a RIGHT triangle.");
    if (kinds === 2) facts.push("Two of its sides are the same length: that's what isosceles means.");
    if (kinds === 3 && !rightAngles) facts.push("All three sides are different lengths: scalene.");
  } else if (n === 4) {
    const par = (a: Pt, b: Pt) => cross(a, b) === 0;
    const pairs = Number(par(edges[0], edges[2])) + Number(par(edges[1], edges[3]));
    if (rightAngles === 4 && equalSides) { name = "square"; facts.push("4 equal sides AND 4 square corners: a square."); }
    else if (rightAngles === 4) { name = "rectangle"; facts.push("4 square corners, and the opposite sides are equal: a rectangle."); }
    else if (equalSides) { name = "rhombus"; facts.push("4 equal sides but slanted corners: a rhombus (like a pushed-over square)."); }
    else if (pairs === 2) { name = "parallelogram"; facts.push("Both pairs of opposite sides are parallel (they never meet): a parallelogram."); }
    else if (pairs === 1) { name = "trapezium"; facts.push("Exactly one pair of sides is parallel: a trapezium."); }
    else if ((L2[0] === L2[1] && L2[2] === L2[3]) || (L2[1] === L2[2] && L2[3] === L2[0])) { name = "kite"; facts.push("Two pairs of equal sides next to each other: a kite."); }
  } else if (equalSides && rightAngles === 0) facts.push("All sides are equal.");
  const symmetry = symmetryLines(pts);
  facts.unshift(`${n} straight sides and ${n} corners${rightAngles ? `, ${rightAngles} of them square corners (right angles)` : ""}.`);
  facts.push(`Area: ${area} square${area === 1 ? "" : "s"} inside${Number.isInteger(area) ? "" : " (half squares count as ½)"}.`);
  facts.push(exact ? `Perimeter: ${perimeter} units, walking all the way around the edge.` : `Perimeter: about ${perimeter} units (slanted sides are a bit longer than one square).`);
  facts.push(symmetry ? `It has ${symmetry} line${symmetry > 1 ? "s" : ""} of symmetry: fold it there and both halves match.` : "It has no line of symmetry: no fold makes the halves match.");
  return { sides: n, name, rightAngles, area, perimeter, perimeterExact: exact, equalSides, symmetry, crossing, facts };
}

/** How many mirror lines (vertical, horizontal, the two diagonals) map the corners onto themselves. */
export function symmetryLines(pts: Pt[]): number {
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  const key = (p: Pt) => `${Math.round(p[0] * 2)},${Math.round(p[1] * 2)}`;
  const set = new Set(pts.map(key));
  const maps: ((p: Pt) => Pt)[] = [
    ([x, y]) => [2 * cx - x, y], ([x, y]) => [x, 2 * cy - y],
    ([x, y]) => [cx + (y - cy), cy + (x - cx)], ([x, y]) => [cx - (y - cy), cy - (x - cx)],
  ];
  return maps.filter((m) => pts.every((p) => set.has(key(m(p))))).length;
}

export interface Challenge { id: string; ask: string; test: (s: ShapeInfo) => boolean; hint: string }
export const CHALLENGES: Challenge[] = [
  { id: "tri", ask: "Make any triangle", test: (s) => s.sides === 3, hint: "A triangle needs exactly 3 corners." },
  { id: "square", ask: "Make a square", test: (s) => s.name === "square", hint: "All 4 sides the same length, and every corner a square corner." },
  { id: "right_tri", ask: "Make a triangle with a square corner", test: (s) => s.name === "right triangle", hint: "Go straight across, then straight up: that corner is a right angle." },
  { id: "rect6", ask: "Make a rectangle with area 6", test: (s) => s.name === "rectangle" && s.area === 6, hint: "Area = length × width. Which two numbers multiply to make 6?" },
  { id: "five", ask: "Make a shape with 5 corners", test: (s) => s.sides === 5, hint: "5 corners make a pentagon." },
  { id: "perim12", ask: "Make a shape with perimeter 12 (straight lines only)", test: (s) => s.perimeterExact && s.perimeter === 12, hint: "Try a 4 by 2 rectangle: 4 + 2 + 4 + 2." },
  { id: "sym4", ask: "Make a shape with 4 lines of symmetry", test: (s) => s.symmetry === 4, hint: "A square can be folded 4 ways and still match!" },
  { id: "half", ask: "Make a triangle with area 2", test: (s) => s.sides === 3 && s.area === 2, hint: "A triangle is half of a rectangle: half of 2 × 2." },
];
