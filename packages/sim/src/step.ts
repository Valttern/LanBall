import { collideBodies, collideWall } from "./physics.ts";
import type { Arena, GameState, InputState, Player, Team } from "./types.ts";

export const TICK_RATE = 60;
export const DT = 1 / TICK_RATE;

export const TUNING = {
  playerRadius: 26,
  playerMass: 5,
  playerMaxSpeed: 340,
  playerAccel: 10, // kuinka nopeasti nopeus hakeutuu tavoitteeseen (1/s)
  ballRadius: 14,
  ballMass: 1,
  ballFriction: 0.8, // eksponentiaalinen hidastus (1/s)
  ballWallRestitution: 0.8,
  playerWallRestitution: 0.1,
  bodyRestitution: 0.4,
  substeps: 4,
};

export const NO_INPUT: InputState = { moveX: 0, moveY: 0, pass: false, shoot: false, tackle: false };

function makePlayer(id: number, team: Team, role: Player["role"], x: number, y: number): Player {
  const dir = team === 0 ? 1 : -1;
  return {
    id,
    team,
    role,
    pos: { x, y },
    vel: { x: 0, y: 0 },
    radius: TUNING.playerRadius,
    mass: TUNING.playerMass,
    facing: { x: dir, y: 0 },
    home: { x, y },
  };
}

/** Joukkue 0 hyökkää oikealle, joukkue 1 vasemmalle. 3 kenttäpelaajaa + maalivahti (päätös 13). */
export function createMatch(arena: Arena): GameState {
  const players: Player[] = [];
  for (const team of [0, 1] as const) {
    const s = team === 0 ? -1 : 1;
    const base = team * 4;
    players.push(makePlayer(base, team, "field", s * 160, 0));
    players.push(makePlayer(base + 1, team, "field", s * 420, -180));
    players.push(makePlayer(base + 2, team, "field", s * 420, 180));
    players.push(makePlayer(base + 3, team, "keeper", s * (arena.halfWidth - 60), 0));
  }
  return {
    tick: 0,
    players,
    ball: { pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 }, radius: TUNING.ballRadius, mass: TUNING.ballMass },
    score: [0, 0],
  };
}

function kickoff(state: GameState) {
  for (const p of state.players) {
    p.pos = { ...p.home };
    p.vel = { x: 0, y: 0 };
    p.facing = { x: p.team === 0 ? 1 : -1, y: 0 };
  }
  state.ball.pos = { x: 0, y: 0 };
  state.ball.vel = { x: 0, y: 0 };
}

function steerPlayer(p: Player, input: InputState) {
  let mx = input.moveX;
  let my = input.moveY;
  const len = Math.hypot(mx, my);
  if (len > 1) {
    mx /= len;
    my /= len;
  }
  const k = Math.min(1, TUNING.playerAccel * DT);
  p.vel.x += (mx * TUNING.playerMaxSpeed - p.vel.x) * k;
  p.vel.y += (my * TUNING.playerMaxSpeed - p.vel.y) * k;
  if (len > 0.2) {
    const l = Math.hypot(mx, my);
    p.facing = { x: mx / l, y: my / l };
  }
}

/**
 * Yksi simulaation askel (päätös 2). Ei koske syötteeseen tai tilaan, vaan palauttaa uuden tilan.
 * `inputs` on indeksoitu pelaajan id:llä; puuttuva syöte = paikallaan.
 */
export function step(prev: GameState, inputs: ReadonlyArray<InputState | undefined>, arena: Arena): GameState {
  const state = structuredClone(prev);
  state.tick++;

  for (const p of state.players) steerPlayer(p, inputs[p.id] ?? NO_INPUT);

  const bodies = [...state.players, state.ball];
  const h = DT / TUNING.substeps;
  const friction = Math.exp(-TUNING.ballFriction * DT);
  state.ball.vel.x *= friction;
  state.ball.vel.y *= friction;

  for (let s = 0; s < TUNING.substeps; s++) {
    for (const b of bodies) {
      b.pos.x += b.vel.x * h;
      b.pos.y += b.vel.y * h;
    }
    for (let i = 0; i < bodies.length; i++)
      for (let j = i + 1; j < bodies.length; j++) collideBodies(bodies[i], bodies[j], TUNING.bodyRestitution);
    for (const wall of arena.walls) {
      collideWall(state.ball, wall, TUNING.ballWallRestitution);
      for (const p of state.players) collideWall(p, wall, TUNING.playerWallRestitution);
    }
  }

  const { ball } = state;
  if (ball.pos.x - ball.radius > arena.halfWidth) {
    state.score[0]++;
    kickoff(state);
  } else if (ball.pos.x + ball.radius < -arena.halfWidth) {
    state.score[1]++;
    kickoff(state);
  }
  return state;
}
