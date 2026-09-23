import { collideBodies, collideWall } from "./physics.ts";
import type { Arena, Ball, GameState, InputState, Player, Team, Vec } from "./types.ts";

export const TICK_RATE = 60;
export const DT = 1 / TICK_RATE;

export const TUNING = {
  playerRadius: 26,
  playerMass: 5,
  playerMaxSpeed: 340,
  playerAccel: 10, // kuinka nopeasti nopeus hakeutuu tavoitteeseen (1/s)
  playerTurnRate: 10, // katseen kääntymisnopeus (rad/s)
  carrierTurnRate: 7, // pallon kanssa käännytään hitaammin
  ballRadius: 14,
  ballMass: 1,
  ballFriction: 0.8, // eksponentiaalinen hidastus (1/s)
  ballWallRestitution: 0.8,
  playerWallRestitution: 0.1,
  bodyRestitution: 0.4,
  substeps: 4,

  // Pallon hallinta (päätös 18)
  grabReach: 8, // kuinka läheltä pallon voi napata (rako ympyröiden välissä)
  dribbleGap: 4, // pallon etäisyys hahmon reunasta
  dribbleSpring: 300, // jousi, joka vetää pallon hahmon eteen
  dribbleDamping: 35,
  loseDistance: 40, // pallo irtoaa, jos se on näin kaukana paikaltaan
  sharpTurnCos: -0.5, // käännös yli 120°...
  sharpTurnSpeed: 0.8, // ...yli 80 % kuljettajan huippunopeudesta irrottaa pallon
  wallLoseSpeed: 150, // tätä kovempi seinäosuma irrottaa pallon
  regrabDelay: 0.4, // s
  carrierSpeedFactor: 0.9,
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
    noGrabUntil: 0,
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
    ball: { pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 }, radius: TUNING.ballRadius, mass: TUNING.ballMass, owner: null },
    score: [0, 0],
  };
}

function kickoff(state: GameState) {
  for (const p of state.players) {
    p.pos = { ...p.home };
    p.vel = { x: 0, y: 0 };
    p.facing = { x: p.team === 0 ? 1 : -1, y: 0 };
    p.noGrabUntil = 0;
  }
  state.ball.pos = { x: 0, y: 0 };
  state.ball.vel = { x: 0, y: 0 };
  state.ball.owner = null;
}

function release(state: GameState, owner: Player) {
  state.ball.owner = null;
  owner.noGrabUntil = state.tick + Math.round(TUNING.regrabDelay * TICK_RATE);
}

/** Paikka hahmon edessä, jossa kuljetettava pallo kulkee. */
export function dribblePoint(p: Player, ball: Ball): Vec {
  const d = p.radius + ball.radius + TUNING.dribbleGap;
  return { x: p.pos.x + p.facing.x * d, y: p.pos.y + p.facing.y * d };
}

function steerPlayer(state: GameState, p: Player, input: InputState) {
  let mx = input.moveX;
  let my = input.moveY;
  let len = Math.hypot(mx, my);
  if (len > 1) {
    mx /= len;
    my /= len;
    len = 1;
  }
  const carrying = state.ball.owner === p.id;
  const maxSpeed = TUNING.playerMaxSpeed * (carrying ? TUNING.carrierSpeedFactor : 1);

  if (carrying && len > 0.2) {
    const speed = Math.hypot(p.vel.x, p.vel.y);
    const cos = (p.facing.x * mx + p.facing.y * my) / len;
    if (speed > TUNING.sharpTurnSpeed * maxSpeed && cos < TUNING.sharpTurnCos) release(state, p);
  }

  if (len > 0.2) {
    // Katse kääntyy rajoitetulla nopeudella.
    const from = Math.atan2(p.facing.y, p.facing.x);
    let diff = Math.atan2(my, mx) - from;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    const maxTurn = (state.ball.owner === p.id ? TUNING.carrierTurnRate : TUNING.playerTurnRate) * DT;
    const a = from + Math.max(-maxTurn, Math.min(maxTurn, diff));
    p.facing = { x: Math.cos(a), y: Math.sin(a) };
  }
  if (state.ball.owner === p.id && len > 0) {
    // Pallon kanssa liikutaan katseen suuntaan ja hidastetaan käännöksessä: käännös tehdään kaarella
    // tai paikallaan, ja pallo pysyy edessä.
    const align = (p.facing.x * mx + p.facing.y * my) / len;
    const throttle = len * (1 + align) / 2;
    mx = p.facing.x * throttle;
    my = p.facing.y * throttle;
  }

  const k = Math.min(1, TUNING.playerAccel * DT);
  p.vel.x += (mx * maxSpeed - p.vel.x) * k;
  p.vel.y += (my * maxSpeed - p.vel.y) * k;
}

/** Jousi vetää pallon hahmon eteen. Vaimennus seuraa kohdan omaa nopeutta, jotta pallo kaartaa käännöksissä mukana. */
function dribble(ball: Ball, owner: Player, prevFacing: Vec) {
  const target = dribblePoint(owner, ball);
  const d = owner.radius + ball.radius + TUNING.dribbleGap;
  const tvx = owner.vel.x + ((owner.facing.x - prevFacing.x) * d) / DT;
  const tvy = owner.vel.y + ((owner.facing.y - prevFacing.y) * d) / DT;
  ball.vel.x += (TUNING.dribbleSpring * (target.x - ball.pos.x) + TUNING.dribbleDamping * (tvx - ball.vel.x)) * DT;
  ball.vel.y += (TUNING.dribbleSpring * (target.y - ball.pos.y) + TUNING.dribbleDamping * (tvy - ball.vel.y)) * DT;
}

function tryGrab(state: GameState) {
  const { ball } = state;
  let best: Player | null = null;
  let bestDist = Infinity;
  for (const p of state.players) {
    if (state.tick < p.noGrabUntil) continue;
    const d = Math.hypot(ball.pos.x - p.pos.x, ball.pos.y - p.pos.y) - p.radius - ball.radius;
    if (d < TUNING.grabReach && d < bestDist) {
      best = p;
      bestDist = d;
    }
  }
  if (best) ball.owner = best.id;
}

/**
 * Yksi simulaation askel (päätös 2). Ei koske syötteeseen tai tilaan, vaan palauttaa uuden tilan.
 * `inputs` on indeksoitu pelaajan id:llä; puuttuva syöte = paikallaan.
 */
export function step(prev: GameState, inputs: ReadonlyArray<InputState | undefined>, arena: Arena): GameState {
  const state = structuredClone(prev);
  state.tick++;
  const { ball } = state;

  const carrierFacing = { ...(state.players.find((p) => p.id === ball.owner)?.facing ?? { x: 0, y: 0 }) };
  for (const p of state.players) steerPlayer(state, p, inputs[p.id] ?? NO_INPUT);

  const owner = state.players.find((p) => p.id === ball.owner);
  if (owner) {
    dribble(ball, owner, carrierFacing);
  } else {
    const friction = Math.exp(-TUNING.ballFriction * DT);
    ball.vel.x *= friction;
    ball.vel.y *= friction;
  }

  const bodies = [...state.players, ball];
  const h = DT / TUNING.substeps;
  let challenged = false; // vastustaja kosketti palloa tai kuljettajaa
  let wallImpact = 0;

  for (let s = 0; s < TUNING.substeps; s++) {
    for (const b of bodies) {
      b.pos.x += b.vel.x * h;
      b.pos.y += b.vel.y * h;
    }
    for (let i = 0; i < bodies.length; i++)
      for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i];
        const b = bodies[j];
        const ownerAndBall = owner && ((a === owner && b === ball) || (a === ball && b === owner));
        const touched = collideBodies(a, b, ownerAndBall ? 0 : TUNING.bodyRestitution);
        if (touched && owner && !ownerAndBall) {
          const ours = a === ball || a === owner;
          const other = ours ? b : a;
          const involved = ours || b === ball || b === owner;
          if (involved && other !== ball && other !== owner && (other as Player).team !== owner.team) challenged = true;
        }
      }
    for (const wall of arena.walls) {
      wallImpact = Math.max(wallImpact, collideWall(ball, wall, TUNING.ballWallRestitution));
      for (const p of state.players) collideWall(p, wall, TUNING.playerWallRestitution);
    }
  }

  if (owner && ball.owner === owner.id) {
    const target = dribblePoint(owner, ball);
    const off = Math.hypot(ball.pos.x - target.x, ball.pos.y - target.y);
    if (challenged || wallImpact > TUNING.wallLoseSpeed || off > TUNING.loseDistance) release(state, owner);
  }
  if (ball.owner === null) tryGrab(state);

  if (ball.pos.x - ball.radius > arena.halfWidth) {
    state.score[0]++;
    kickoff(state);
  } else if (ball.pos.x + ball.radius < -arena.halfWidth) {
    state.score[1]++;
    kickoff(state);
  }
  return state;
}
