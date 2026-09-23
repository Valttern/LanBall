import { aiInput } from "./ai.ts";
import { doPass, doShoot, dribble, dribblePoint, freeBall, releaseBall, tryGrab } from "./ball.ts";
import { updateControl } from "./control.ts";
import { NO_INPUT } from "./input.ts";
import { kickoff } from "./match.ts";
import { collideBodies, collideWall } from "./physics.ts";
import { applyStats, byId, canAct, hasEffect, knockDown, startSlide, steerPlayer } from "./players.ts";
import { spawnPickups, updatePickups } from "./powerups.ts";
import { DT, TUNING, secs } from "./tuning.ts";
import type { Arena, Ball, GameState, InputState, Player, Team } from "./types.ts";

/** Napit reunoina: painallus, pito ja irrotus. */
function handleActions(state: GameState, arena: Arena, p: Player, input: InputState) {
  const was = p.held;
  p.held = { pass: input.pass, shoot: input.shoot, tackle: input.tackle };
  if (!canAct(p) || state.phase !== "play") {
    p.charge = 0;
    return;
  }
  const { ball } = state;
  const carrying = ball.owner === p.id;
  const full = secs(TUNING.chargeTime);

  if (input.shoot) p.charge = Math.min(p.charge + 1, full);
  if (!input.shoot && was.shoot) {
    const power = p.charge / full;
    const gap = Math.hypot(ball.pos.x - p.pos.x, ball.pos.y - p.pos.y) - p.radius - ball.radius;
    if (carrying) doShoot(state, arena, p, power);
    else if (ball.owner === null && !ball.fire && gap < TUNING.volleyReach && state.tick >= p.noGrabUntil)
      doShoot(state, arena, p, Math.max(TUNING.volleyPower, power)); // suora laukaus vapaasta pallosta
    p.charge = 0;
  }
  if (input.pass && !was.pass && carrying) doPass(state, p);
  if (input.tackle && !was.tackle && state.tick >= p.actionReadyAt) {
    if (carrying) {
      p.dashUntil = state.tick + secs(TUNING.dashTime);
      p.actionReadyAt = state.tick + secs(TUNING.dashCooldown);
    } else {
      startSlide(state, p);
    }
  }
}

/** Kaatavat kontaktit: liukutaklaus ja jättiläisen jyräys. */
function contact(state: GameState, x: Player, y: Player) {
  if (y.mode === "down") return;
  const fast = Math.hypot(x.vel.x, x.vel.y) > 150;
  const sliding = x.mode === "sliding" && x.role === "field";
  if (!sliding && !(hasEffect(x, "giant") && !hasEffect(y, "giant") && fast)) return;
  knockDown(state, y, x.id);
  const { ball } = state;
  if (sliding && ball.owner === null && Math.hypot(ball.pos.x - y.pos.x, ball.pos.y - y.pos.y) < 70) {
    ball.vel.x += x.vel.x * 0.6;
    ball.vel.y += x.vel.y * 0.6;
  }
}

/**
 * Yksi simulaation askel (päätös 2). Ei muuta edellistä tilaa, vaan palauttaa uuden.
 * `inputs` on indeksoitu ihmispelaajan slotilla; muita hahmoja ohjaa tekoäly.
 */
export function step(prev: GameState, inputs: ReadonlyArray<InputState | undefined>, arena: Arena): GameState {
  const state = structuredClone(prev);
  state.tick++;
  state.events = [];
  const { ball } = state;

  if (state.phase === "ended") return state;
  if (state.phase === "countdown") {
    if (state.tick < state.phaseUntil) return state;
    state.phase = "play";
    state.events.push({ type: "whistle", kind: "start" });
  }
  if (state.phase === "goal" && state.tick >= state.phaseUntil) {
    if (state.golden || state.timeLeft <= 0) {
      state.phase = "ended";
      state.events.push({ type: "whistle", kind: "end" });
    } else {
      kickoff(state, state.kickoffTeam);
    }
    return state;
  }

  updateControl(state, inputs);
  for (const p of state.players) {
    p.effects = p.effects.filter((e) => e.until > state.tick);
    applyStats(p);
  }

  const frame = state.players.map((p) => (p.controller !== null ? (inputs[p.controller] ?? NO_INPUT) : aiInput(state, arena, p)));
  state.players.forEach((p, i) => handleActions(state, arena, p, frame[i]));

  const startOwner = byId(state, ball.owner);
  const carrierFacing = { ...(startOwner?.facing ?? { x: 0, y: 0 }) };
  state.players.forEach((p, i) => steerPlayer(state, p, frame[i]));

  const carrier = byId(state, ball.owner);
  if (carrier) dribble(ball, carrier, carrierFacing);
  else freeBall(state);

  const h = DT / TUNING.substeps;
  let challenged = false; // vastustaja kosketti palloa tai kuljettajaa
  let wallImpact = 0;
  let postImpact = 0;
  const posts = [-1, 1].flatMap((sx) => [-1, 1].map((sy) => ({ x: sx * arena.halfWidth, y: sy * arena.goalHalfWidth })));
  const players = state.players;

  for (let s = 0; s < TUNING.substeps; s++) {
    for (const b of [...players, ball]) {
      b.pos.x += b.vel.x * h;
      b.pos.y += b.vel.y * h;
    }
    const owner = byId(state, ball.owner);
    for (let i = 0; i < players.length; i++) {
      const a = players[i];
      for (let j = i + 1; j < players.length; j++) {
        const b = players[j];
        const bump = collideBodies(a, b, TUNING.bodyRestitution);
        if (bump < 0 || a.team === b.team) continue;
        if (owner && (a === owner || b === owner) && bump > TUNING.bumpLoseSpeed) challenged = true;
        contact(state, a, b);
        contact(state, b, a);
      }
      if (ball.fire && a.id !== ball.lastTouch) {
        // Tulipallo lävistää pelaajat ja kaataa ne.
        if (Math.hypot(a.pos.x - ball.pos.x, a.pos.y - ball.pos.y) < a.radius + ball.radius) knockDown(state, a, ball.lastTouch);
        continue;
      }
      const touched = collideBodies(a, ball, owner === a ? 0 : TUNING.bodyRestitution) >= 0;
      if (touched && owner && a !== owner && a.team !== owner.team) challenged = true; // vastustaja koskee palloon
    }
    for (const wall of arena.walls) {
      const imp = collideWall(ball, wall, TUNING.ballWallRestitution);
      if (imp > 0 && posts.some((q) => Math.hypot(q.x - ball.pos.x, q.y - ball.pos.y) < ball.radius + 3)) postImpact = Math.max(postImpact, imp);
      else wallImpact = Math.max(wallImpact, imp);
      for (const p of players) collideWall(p, wall, TUNING.playerWallRestitution);
    }
    if (ball.owner === null && state.phase === "play") tryGrab(state);
  }

  const owner = byId(state, ball.owner);
  if (owner && owner === startOwner) {
    const target = dribblePoint(owner, ball);
    const off = Math.hypot(ball.pos.x - target.x, ball.pos.y - target.y);
    const settled = state.tick - ball.ownedSince > secs(TUNING.settleTime);
    const keeperHolds = owner.role === "keeper"; // maalivahdin käsissä olevaa palloa ei tönäistä irti
    if ((challenged && !keeperHolds) || wallImpact > TUNING.wallLoseSpeed || (settled && off > TUNING.loseDistance)) {
      releaseBall(state, owner);
      if (challenged) state.events.push({ type: "steal", x: ball.pos.x, y: ball.pos.y, player: -1 });
    }
  }
  if (ball.owner === null) {
    if (postImpact > 200) state.events.push({ type: "post", x: ball.pos.x, y: ball.pos.y, power: postImpact });
    else if (wallImpact > 280) state.events.push({ type: "bounce", x: ball.pos.x, y: ball.pos.y, power: wallImpact });
  }

  updatePickups(state, arena);
  if (state.phase === "play") checkGoalAndClock(state, arena, ball);
  spawnPickups(state, arena);
  return state;
}

function checkGoalAndClock(state: GameState, arena: Arena, ball: Ball) {
  let scorer: Team | null = null;
  if (ball.pos.x - ball.radius > arena.halfWidth) scorer = 0;
  else if (ball.pos.x + ball.radius < -arena.halfWidth) scorer = 1;
  if (scorer !== null) {
    const last = byId(state, ball.lastTouch);
    state.score[scorer]++;
    state.events.push({ type: "goal", team: scorer, scorer: last?.id ?? null, ownGoal: !!last && last.team !== scorer });
    state.phase = "goal";
    state.phaseUntil = state.tick + secs(TUNING.goalPause);
    state.kickoffTeam = scorer === 0 ? 1 : 0;
    const owner = byId(state, ball.owner);
    if (owner) releaseBall(state, owner);
    return;
  }
  if (state.golden) return;
  state.timeLeft--;
  if (state.timeLeft > 0) return;
  if (state.score[0] === state.score[1]) {
    state.golden = true;
    state.events.push({ type: "whistle", kind: "golden" });
  } else {
    state.phase = "ended";
    state.events.push({ type: "whistle", kind: "end" });
  }
}
