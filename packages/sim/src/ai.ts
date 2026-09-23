import { attackX } from "./ball.ts";
import { byId, canAct } from "./players.ts";
import { rand } from "./rng.ts";
import { TUNING, secs } from "./tuning.ts";
import type { Arena, GameState, InputState, Player, Vec } from "./types.ts";

/**
 * Sääntöpohjainen tekoäly (päätös 11). Tuottaa saman InputStaten kuin ihmispelaaja (päätös 3),
 * joten se ei voi tehdä mitään, mihin ihminen ei pystyisi.
 */

const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function moveTo(inp: InputState, from: Vec, to: Vec, arrive = 40) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const d = Math.hypot(dx, dy);
  if (d < 1) return;
  const m = Math.min(1, d / arrive);
  inp.moveX = (dx / d) * m;
  inp.moveY = (dy / d) * m;
}

/** Kääntyy kohti pistettä liikkumatta juuri lainkaan. */
function faceTo(inp: InputState, from: Vec, to: Vec, walk = 0.3) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const d = Math.hypot(dx, dy) || 1;
  inp.moveX = (dx / d) * walk;
  inp.moveY = (dy / d) * walk;
}

const facingCos = (p: Player, to: Vec) => {
  const dx = to.x - p.pos.x;
  const dy = to.y - p.pos.y;
  return (dx * p.facing.x + dy * p.facing.y) / (Math.hypot(dx, dy) || 1);
};

/** Onko linja a→b vapaa vastustajista (säde `margin`)? */
function laneClear(state: GameState, p: Player, a: Vec, b: Vec, margin: number, ignoreKeeper = false) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len2 = abx * abx + aby * aby || 1;
  for (const q of state.players) {
    if (q.team === p.team || q.mode === "down" || q.mode === "frozen") continue;
    if (ignoreKeeper && q.role === "keeper") continue;
    const t = clamp(((q.pos.x - a.x) * abx + (q.pos.y - a.y) * aby) / len2, 0, 1);
    if (Math.hypot(q.pos.x - (a.x + abx * t), q.pos.y - (a.y + aby * t)) < margin + q.radius) return false;
  }
  return true;
}

function nearestOpponent(state: GameState, p: Player): [Player | undefined, number] {
  let best: Player | undefined;
  let bd = Infinity;
  for (const q of state.players) {
    if (q.team === p.team || q.mode === "down" || q.mode === "frozen") continue;
    const d = dist(q.pos, p.pos);
    if (d < bd) {
      bd = d;
      best = q;
    }
  }
  return [best, bd];
}

/** Paras syöttökohde: vapaa, mielellään edempänä oleva kenttäpelaaja. */
function passTarget(state: GameState, arena: Arena, p: Player, needForward: boolean): Player | undefined {
  const s = p.team === 0 ? 1 : -1;
  let best: Player | undefined;
  let bestScore = -Infinity;
  for (const q of state.players) {
    if (q.team !== p.team || q.id === p.id || q.role !== "field" || q.mode !== "normal") continue;
    const d = dist(q.pos, p.pos);
    if (d < 110 || d > TUNING.passMaxDist * 0.85) continue;
    if (!laneClear(state, p, p.pos, q.pos, 26)) continue;
    const [, space] = nearestOpponent(state, q);
    const forward = (q.pos.x - p.pos.x) * s;
    if (needForward && forward < 60) continue;
    const score = Math.min(space, 220) + forward * 0.5 - d * 0.1 + (Math.abs(q.pos.y) < arena.halfHeight - 90 ? 30 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = q;
    }
  }
  return best;
}

function carrierAi(state: GameState, arena: Arena, p: Player, inp: InputState): InputState {
  const s = p.team === 0 ? 1 : -1;
  const gx = attackX(arena, p.team);
  const g = arena.goalHalfWidth;

  // Syöttö on päätetty: käänny kohti ja syötä, kun katse osoittaa kohdetta.
  const target = byId(state, p.ai.passTarget);
  if (target) {
    faceTo(inp, p.pos, target.pos, 0.35);
    if (facingCos(p, target.pos) > 0.9 || state.tick > p.ai.thinkAt + secs(0.7)) {
      inp.pass = true;
      p.ai.passTarget = null;
    }
    return inp;
  }

  const keeper = state.players.find((q) => q.team !== p.team && q.role === "keeper");
  // Tähtäys kulmaan maalivahdista poispäin, hajonnalla: osa laukauksista menee ohi.
  const aimY = (keeper && keeper.pos.y > 0 ? -g * 0.62 : g * 0.62) + (rand(state) * 2 - 1) * g * TUNING.ai.aimError;
  const shotTarget = { x: gx, y: aimY };

  // Laukaus latautuu: pidä nappi pohjassa ja päästä irti, kun lataus on valmis.
  if (p.ai.charge > 0) {
    p.ai.charge--;
    moveTo(inp, p.pos, shotTarget);
    inp.moveX *= 0.5;
    inp.moveY *= 0.5;
    inp.shoot = p.ai.charge > 0;
    return inp;
  }

  const dGoal = dist(p.pos, { x: gx, y: 0 });
  const [opp, oppDist] = nearestOpponent(state, p);

  if (dGoal < 580 && Math.abs(p.pos.y) < 320 && (gx - p.pos.x) * s > 60) {
    moveTo(inp, p.pos, shotTarget);
    if (facingCos(p, shotTarget) > 0.92 && (laneClear(state, p, p.pos, shotTarget, 20, true) || oppDist < 90)) {
      // Painostettuna laukaistaan heti, muuten ladataan etäisyyden mukaan.
      p.ai.charge = oppDist < 90 ? 2 : clamp(Math.round((dGoal / 580) * 24 + rand(state) * 8), 4, 30);
      inp.shoot = true;
    }
    return inp;
  }

  // Harkinta muutaman kerran sekunnissa: syötä, jos painostetaan tai joku on paremmassa paikassa.
  if (state.tick >= p.ai.thinkAt) {
    p.ai.thinkAt = state.tick + secs(TUNING.ai.think[0] + rand(state) * (TUNING.ai.think[1] - TUNING.ai.think[0]));
    const pressured = oppDist < 120;
    const mate = passTarget(state, arena, p, !pressured);
    if (mate && (pressured || rand(state) < 0.3)) {
      p.ai.passTarget = mate.id;
      faceTo(inp, p.pos, mate.pos, 0.35);
      return inp;
    }
  }

  // Kuljeta kohti maalia ja väistä vastustajia.
  const goalSide = { x: gx - s * 170, y: clamp(p.pos.y * 0.5, -g, g) };
  moveTo(inp, p.pos, goalSide, 10);
  for (const q of state.players) {
    if (q.team === p.team || q.mode === "down") continue;
    const dx = p.pos.x - q.pos.x;
    const dy = p.pos.y - q.pos.y;
    const d = Math.hypot(dx, dy);
    const ahead = (q.pos.x - p.pos.x) * s > -20;
    if (d < 170 && ahead) {
      const push = (170 - d) / 170;
      // Väistä sivulle, poispäin vastustajasta, mutta pysy kentällä.
      let side = Math.sign(dy) || 1;
      if (Math.abs(p.pos.y) > arena.halfHeight - 120) side = -Math.sign(p.pos.y);
      inp.moveY += side * push * 1.2;
    }
  }
  if (opp && oppDist < 75 && state.tick >= p.actionReadyAt && rand(state) < 0.06) inp.tackle = true; // spurtti
  return inp;
}

function formationSpot(state: GameState, arena: Arena, p: Player, teamHasBall: boolean): Vec {
  const s = p.team === 0 ? 1 : -1;
  const { ball } = state;
  const shift = ball.pos.x * 0.55 + (teamHasBall ? s * 150 : -s * 40);
  let x = p.home.x + shift;
  let y = p.home.y + (ball.pos.y - p.home.y) * 0.28;
  if (p.home.y === 0 && teamHasBall) y = ball.pos.y > 0 ? -130 : 130; // keskushyökkääjä tarjoutuu
  x = clamp(x, -arena.halfWidth + 90, arena.halfWidth - 90);
  y = clamp(y, -arena.halfHeight + 60, arena.halfHeight - 60);
  return { x, y };
}

function fieldAi(state: GameState, arena: Arena, p: Player, inp: InputState): InputState {
  const { ball } = state;
  if (ball.owner === p.id) return carrierAi(state, arena, p, inp);
  p.ai.charge = 0;
  p.ai.passTarget = null;

  const owner = byId(state, ball.owner);
  const teamHasBall = !!owner && owner.team === p.team;

  if (ball.passTo === p.id) {
    moveTo(inp, p.pos, { x: ball.pos.x + ball.vel.x * 0.15, y: ball.pos.y + ball.vel.y * 0.15 }, 20);
    return inp;
  }

  if (!teamHasBall) {
    // Pallon lähin hakee sen; toiseksi lähin asettuu pallon ja oman maalin väliin.
    const mates = state.players
      .filter((q) => q.team === p.team && q.role === "field" && q.mode !== "down")
      .sort((a, b) => dist(a.pos, ball.pos) - dist(b.pos, ball.pos));
    const rank = mates.indexOf(p);
    if (rank === 0 || (rank === 1 && mates[0].controller !== null && dist(mates[0].pos, ball.pos) > 200)) {
      const t = Math.min(0.5, dist(p.pos, ball.pos) / 600);
      moveTo(inp, p.pos, { x: ball.pos.x + ball.vel.x * t, y: ball.pos.y + ball.vel.y * t }, 8);
      inp.moveX *= TUNING.ai.chaseSpeed;
      inp.moveY *= TUNING.ai.chaseSpeed;
      const ai = TUNING.ai;
      const gap = owner ? dist(p.pos, owner.pos) - p.radius - owner.radius : Infinity;
      if (owner && gap < ai.tackleRange && state.tick >= p.ai.tackleReadyAt && facingCos(p, owner.pos) > ai.tackleFacing) {
        p.ai.tackleReadyAt = state.tick + secs(0.3);
        if (rand(state) < ai.tackleChance) {
          inp.tackle = true;
          p.ai.tackleReadyAt = state.tick + secs(ai.tackleRest[0] + rand(state) * (ai.tackleRest[1] - ai.tackleRest[0]));
        }
      }
      return inp;
    }
    if (rank === 1 && owner) {
      const ownGoal = { x: -attackX(arena, p.team), y: 0 };
      moveTo(inp, p.pos, { x: owner.pos.x + (ownGoal.x - owner.pos.x) * 0.35, y: owner.pos.y * 0.65 }, 30);
      return inp;
    }
  }

  moveTo(inp, p.pos, formationSpot(state, arena, p, teamHasBall), 60);
  return inp;
}

function keeperAi(state: GameState, arena: Arena, p: Player, inp: InputState): InputState {
  const { ball } = state;
  const s = p.team === 0 ? 1 : -1;
  const gx = -attackX(arena, p.team);
  const g = arena.goalHalfWidth;

  if (ball.owner === p.id) {
    if (p.ai.holdUntil === 0) p.ai.holdUntil = state.tick + secs(0.8);
    const mate = passTarget(state, arena, p, false);
    const aim = mate ? mate.pos : { x: 0, y: p.pos.y };
    faceTo(inp, p.pos, aim, 0.2);
    if (state.tick >= p.ai.holdUntil && facingCos(p, aim) > 0.85) {
      inp.pass = true;
      p.ai.holdUntil = 0;
    }
    return inp;
  }
  p.ai.holdUntil = 0;

  const speed = Math.hypot(ball.vel.x, ball.vel.y);
  const dBall = dist(ball.pos, { x: gx, y: 0 });
  const incoming = ball.owner === null && ball.vel.x * -s > 350;

  if (incoming) {
    const t = (gx + s * 40 - ball.pos.x) / ball.vel.x;
    if (t > 0 && t < 1.2) {
      const y = clamp(ball.pos.y + ball.vel.y * t, -g - 12, g + 12);
      const spot = { x: gx + s * 40, y };
      moveTo(inp, p.pos, spot, 6);
      // Syöksy, jos laukaus menee ohi kädenmitan eikä aikaa ole.
      if (Math.abs(p.pos.y - y) > p.radius + 6 && t < TUNING.ai.keeperDiveTime && state.tick >= p.actionReadyAt) inp.tackle = true;
      return inp;
    }
  }
  if (ball.owner === null && dBall < 240 && speed < 700) {
    moveTo(inp, p.pos, ball.pos, 6);
    return inp;
  }
  const owner = byId(state, ball.owner);
  if (owner && owner.team !== p.team && dist(owner.pos, { x: gx, y: 0 }) < 190) {
    moveTo(inp, p.pos, ball.pos, 6);
    return inp;
  }
  moveTo(inp, p.pos, { x: gx + s * 48, y: clamp(ball.pos.y * 0.45, -g * 0.85, g * 0.85) }, 14);
  return inp;
}

export function aiInput(state: GameState, arena: Arena, p: Player): InputState {
  const inp: InputState = { moveX: 0, moveY: 0, pass: false, shoot: false, tackle: false };
  if (!canAct(p) && p.mode !== "recover") return inp;
  return p.role === "keeper" ? keeperAi(state, arena, p, inp) : fieldAi(state, arena, p, inp);
}
