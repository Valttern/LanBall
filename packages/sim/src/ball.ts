import { character } from "./characters.ts";
import { byId, canAct, hasEffect } from "./players.ts";
import { DT, TUNING, secs } from "./tuning.ts";
import type { Arena, Ball, GameState, Player, Team, Vec } from "./types.ts";

/** Vastustajan maalin x-koordinaatti: joukkue 0 hyökkää oikealle. */
export const attackX = (arena: Arena, team: Team) => (team === 0 ? arena.halfWidth : -arena.halfWidth);

const norm = (v: Vec): Vec => {
  const l = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / l, y: v.y / l };
};

export function releaseBall(state: GameState, owner: Player) {
  state.ball.owner = null;
  owner.noGrabUntil = state.tick + secs(TUNING.regrabDelay);
}

/** Paikka hahmon edessä, jossa kuljetettava pallo kulkee. */
export function dribblePoint(p: Player, ball: Ball): Vec {
  const d = p.radius + ball.radius + TUNING.dribbleGap;
  return { x: p.pos.x + p.facing.x * d, y: p.pos.y + p.facing.y * d };
}

/** Jousi vetää pallon hahmon eteen. Vaimennus seuraa kohdan omaa nopeutta, jotta pallo kaartaa käännöksissä mukana. */
export function dribble(ball: Ball, owner: Player, prevFacing: Vec) {
  const target = dribblePoint(owner, ball);
  const d = owner.radius + ball.radius + TUNING.dribbleGap;
  const tvx = owner.vel.x + ((owner.facing.x - prevFacing.x) * d) / DT;
  const tvy = owner.vel.y + ((owner.facing.y - prevFacing.y) * d) / DT;
  ball.vel.x += (TUNING.dribbleSpring * (target.x - ball.pos.x) + TUNING.dribbleDamping * (tvx - ball.vel.x)) * DT;
  ball.vel.y += (TUNING.dribbleSpring * (target.y - ball.pos.y) + TUNING.dribbleDamping * (tvy - ball.vel.y)) * DT;
}

/** Vapaan pallon liike: kitka, kaartuvuus ja magneetti. */
export function freeBall(state: GameState) {
  const { ball } = state;
  const speed = Math.hypot(ball.vel.x, ball.vel.y);
  const friction = Math.exp(-TUNING.ballFriction * DT);
  ball.vel.x *= friction;
  ball.vel.y *= friction;
  if (ball.curve !== 0 && speed > 350) {
    const nx = -ball.vel.y / speed;
    const ny = ball.vel.x / speed;
    ball.vel.x += nx * ball.curve * DT;
    ball.vel.y += ny * ball.curve * DT;
    ball.curve *= Math.exp(-1.2 * DT);
  }
  if (ball.fire && speed < 650) ball.fire = false;
  if (ball.passTo !== null && speed < 160) ball.passTo = null;

  let magnet: Player | undefined;
  let best = TUNING.magnetRange;
  for (const p of state.players) {
    if (!hasEffect(p, "magnet")) continue;
    const d = Math.hypot(ball.pos.x - p.pos.x, ball.pos.y - p.pos.y);
    if (d < best) {
      best = d;
      magnet = p;
    }
  }
  if (magnet && !ball.fire) {
    const dir = norm({ x: magnet.pos.x - ball.pos.x, y: magnet.pos.y - ball.pos.y });
    ball.vel.x += dir.x * TUNING.magnetAccel * DT;
    ball.vel.y += dir.y * TUNING.magnetAccel * DT;
  }
  ball.spin = speed;
}

function canGrab(state: GameState, p: Player): boolean {
  const { ball } = state;
  if (state.tick < p.noGrabUntil || ball.fire) return false;
  const keeperDive = p.role === "keeper" && p.mode === "sliding";
  if (!canAct(p) && p.mode !== "recover" && !keeperDive) return false;
  if (ball.passTo === p.id) return true; // aiottu vastaanottaja saa syötön aina haltuun
  const rel = Math.hypot(ball.vel.x - p.vel.x, ball.vel.y - p.vel.y);
  return rel < (p.role === "keeper" ? TUNING.keeperGrabMaxSpeed : TUNING.fieldGrabMaxSpeed);
}

export function tryGrab(state: GameState) {
  const { ball } = state;
  let best: Player | null = null;
  let bestDist = Infinity;
  for (const p of state.players) {
    if (!canGrab(state, p)) continue;
    const reach = TUNING.grabReach + (p.role === "keeper" ? TUNING.ai.keeperReach : 0);
    const d = Math.hypot(ball.pos.x - p.pos.x, ball.pos.y - p.pos.y) - p.radius - ball.radius;
    if (d < reach && d < bestDist) {
      best = p;
      bestDist = d;
    }
  }
  if (!best) return;
  const speed = Math.hypot(ball.vel.x, ball.vel.y);
  const prevTouch = byId(state, ball.lastTouch);
  ball.owner = best.id;
  ball.ownedSince = state.tick;
  ball.lastTouch = best.id;
  // Nappaaja kääntyy palloa kohti, jolloin pallo asettuu hahmon eteen.
  const dx = ball.pos.x - best.pos.x;
  const dy = ball.pos.y - best.pos.y;
  const d = Math.hypot(dx, dy) || 1;
  best.facing = { x: dx / d, y: dy / d };
  ball.passTo = null;
  ball.curve = 0;
  const shotOnGoal = best.role === "keeper" && speed > 550 && prevTouch && prevTouch.team !== best.team;
  state.events.push({ type: shotOnGoal ? "save" : "grab", x: ball.pos.x, y: ball.pos.y, player: best.id });
}

function kick(state: GameState, p: Player, dir: Vec, speed: number) {
  const { ball } = state;
  ball.owner = null;
  ball.lastTouch = p.id;
  ball.vel = { x: dir.x * speed, y: dir.y * speed };
  ball.curve = 0;
  ball.fire = false;
  p.noGrabUntil = state.tick + secs(TUNING.passerNoGrab);
}

/** Tähtäysavulla syöttö katseen suunnassa olevalle joukkuekaverille ([E] 20). */
export function doPass(state: GameState, p: Player) {
  const { ball } = state;
  let best: Player | null = null;
  let bestScore = Infinity;
  let bestDist = 0;
  for (const q of state.players) {
    if (q.team !== p.team || q.id === p.id || q.mode === "down" || q.mode === "frozen") continue;
    const dx = q.pos.x - p.pos.x;
    const dy = q.pos.y - p.pos.y;
    const d = Math.hypot(dx, dy);
    if (d < 60 || d > TUNING.passMaxDist) continue;
    const cos = (dx * p.facing.x + dy * p.facing.y) / d;
    if (cos < TUNING.passConeCos) continue;
    const score = (1 - cos) * 900 + d * 0.35 + (q.role === "keeper" ? 300 : 0);
    if (score < bestScore) {
      best = q;
      bestScore = score;
      bestDist = d;
    }
  }
  const c = character(p.character);
  if (best) {
    const speed = Math.min(TUNING.passMaxSpeed, TUNING.passMinSpeed + bestDist * 0.75) * c.pass;
    const t = (bestDist / speed) * TUNING.passLead;
    const target = { x: best.pos.x + best.vel.x * t, y: best.pos.y + best.vel.y * t };
    kick(state, p, norm({ x: target.x - ball.pos.x, y: target.y - ball.pos.y }), speed);
    ball.passTo = best.id;
  } else {
    kick(state, p, p.facing, 650 * c.pass);
    ball.passTo = null;
  }
  state.events.push({ type: "pass", x: ball.pos.x, y: ball.pos.y, player: p.id });
}

/** Laukaus katseen suuntaan. Jos katse osoittaa maalia kohti, tähtäys korjataan maalin sisään ([E] 21). */
export function doShoot(state: GameState, arena: Arena, p: Player, power: number) {
  const { ball } = state;
  const c = character(p.character);
  const gx = attackX(arena, p.team);
  const g = arena.goalHalfWidth;
  let dir = p.facing;
  const toGoal = norm({ x: gx - ball.pos.x, y: -ball.pos.y });
  if (p.facing.x * toGoal.x > 0 && p.facing.x * toGoal.x + p.facing.y * toGoal.y > TUNING.shotAssistCos) {
    const t = (gx - ball.pos.x) / p.facing.x;
    const hitY = ball.pos.y + p.facing.y * t;
    const aimY = Math.max(-g * 0.72, Math.min(g * 0.72, hitY));
    dir = norm({ x: gx - ball.pos.x, y: aimY - ball.pos.y });
  }
  let speed = (TUNING.shotMinSpeed + (TUNING.shotMaxSpeed - TUNING.shotMinSpeed) * Math.min(1, power)) * c.shot;
  const mega = hasEffect(p, "mega");
  kick(state, p, dir, mega ? TUNING.megaSpeed : speed);
  if (mega) {
    speed = TUNING.megaSpeed;
    ball.fire = true;
    p.effects = p.effects.filter((e) => e.kind !== "mega");
  }
  if (c.trait === "curve") {
    // Kaartuu kohti maalin keskilinjaa.
    const nx = -dir.y;
    const ny = dir.x;
    const side = Math.sign(nx * (gx - ball.pos.x) + ny * -ball.pos.y) || 1;
    ball.curve = side * 420;
  }
  state.events.push({ type: "kick", x: ball.pos.x, y: ball.pos.y, power: Math.min(1, power), fire: ball.fire, player: p.id });
}
