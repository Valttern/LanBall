import type { Body, Segment } from "./types.ts";

/** Työntää ympyrän irti janasta ja kimmottaa nopeuden. Palauttaa osumanopeuden (0 = ei osumaa). */
export function collideWall(body: Body, wall: Segment, restitution: number): number {
  const { a, b } = wall;
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;
  let t = ((body.pos.x - a.x) * abx + (body.pos.y - a.y) * aby) / len2;
  t = Math.max(0, Math.min(1, t));
  const dx = body.pos.x - (a.x + abx * t);
  const dy = body.pos.y - (a.y + aby * t);
  const dist = Math.hypot(dx, dy);
  if (dist >= body.radius || dist === 0) return 0;

  const nx = dx / dist;
  const ny = dy / dist;
  body.pos.x += nx * (body.radius - dist);
  body.pos.y += ny * (body.radius - dist);
  const vn = body.vel.x * nx + body.vel.y * ny;
  if (vn < 0) {
    body.vel.x -= (1 + restitution) * vn * nx;
    body.vel.y -= (1 + restitution) * vn * ny;
  }
  return Math.max(0, -vn);
}

/** Kahden ympyrän törmäys massojen suhteessa. Palauttaa lähestymisnopeuden, tai -1 jos ympyrät eivät koskettaneet. */
export function collideBodies(p: Body, q: Body, restitution: number): number {
  const dx = q.pos.x - p.pos.x;
  const dy = q.pos.y - p.pos.y;
  const dist = Math.hypot(dx, dy);
  const minDist = p.radius + q.radius;
  if (dist >= minDist || dist === 0) return -1;

  const nx = dx / dist;
  const ny = dy / dist;
  const invP = 1 / p.mass;
  const invQ = 1 / q.mass;
  const overlap = minDist - dist;
  const share = overlap / (invP + invQ);
  p.pos.x -= nx * share * invP;
  p.pos.y -= ny * share * invP;
  q.pos.x += nx * share * invQ;
  q.pos.y += ny * share * invQ;

  const vn = (q.vel.x - p.vel.x) * nx + (q.vel.y - p.vel.y) * ny;
  if (vn >= 0) return 0;
  const j = (-(1 + restitution) * vn) / (invP + invQ);
  p.vel.x -= j * invP * nx;
  p.vel.y -= j * invP * ny;
  q.vel.x += j * invQ * nx;
  q.vel.y += j * invQ * ny;
  return -vn;
}
