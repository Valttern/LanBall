import type { Arena, ArenaDef, Segment, Vec } from "./types.ts";

export const DEFAULT_ARENA: ArenaDef = {
  halfWidth: 700,
  halfHeight: 380,
  cornerRadius: 110,
  goalHalfWidth: 90,
  goalDepth: 70,
};

const CORNER_STEPS = 10;

function arc(out: Vec[], cx: number, cy: number, r: number, from: number, to: number) {
  for (let i = 0; i <= CORNER_STEPS; i++) {
    const t = from + ((to - from) * i) / CORNER_STEPS;
    out.push({ x: cx + Math.cos(t) * r, y: cy + Math.sin(t) * r });
  }
}

/** Rakentaa reunaviivan myötäpäivään vasemmasta yläkulmasta alkaen. */
export function buildArena(def: ArenaDef = DEFAULT_ARENA): Arena {
  const { halfWidth: w, halfHeight: h, cornerRadius: r, goalHalfWidth: g, goalDepth: d } = def;
  const pts: Vec[] = [];
  const PI = Math.PI;

  arc(pts, -w + r, -h + r, r, PI, 1.5 * PI);
  arc(pts, w - r, -h + r, r, 1.5 * PI, 2 * PI);
  pts.push({ x: w, y: -g }, { x: w + d, y: -g }, { x: w + d, y: g }, { x: w, y: g });
  arc(pts, w - r, h - r, r, 0, 0.5 * PI);
  arc(pts, -w + r, h - r, r, 0.5 * PI, PI);
  pts.push({ x: -w, y: g }, { x: -w - d, y: g }, { x: -w - d, y: -g }, { x: -w, y: -g });

  const walls: Segment[] = pts.map((a, i) => ({ a, b: pts[(i + 1) % pts.length] }));
  return { ...def, outline: pts, walls };
}
