import { releaseBall } from "./ball.ts";
import { character } from "./characters.ts";
import { AI_LEVELS, DT, TUNING, secs } from "./tuning.ts";
import type { EffectKind, GameState, InputState, Player } from "./types.ts";

export const hasEffect = (p: Player, kind: EffectKind) => p.effects.some((e) => e.kind === kind);

export const byId = (state: GameState, id: number | null) => (id === null ? undefined : state.players.find((p) => p.id === id));

/** Hahmon ja voimassa olevien powerupien vaikutus kokoon ja massaan. */
export function applyStats(p: Player) {
  const c = character(p.character);
  const base = p.role === "keeper" ? TUNING.keeperRadius : TUNING.playerRadius;
  const giant = hasEffect(p, "giant");
  p.radius = base * c.size * (giant ? TUNING.giantScale : 1);
  p.mass = TUNING.playerMass * c.mass * (giant ? TUNING.giantMass : 1);
}

export function maxSpeed(state: GameState, p: Player): number {
  const c = character(p.character);
  // Maalivahti on aina tekoäly, joten sen nopeus seuraa vaikeustasoa.
  let s = (p.role === "keeper" ? TUNING.keeperSpeed * AI_LEVELS[state.difficulty].keeperSpeed : TUNING.playerMaxSpeed) * c.speed;
  if (hasEffect(p, "turbo")) s *= TUNING.turboSpeed;
  if (hasEffect(p, "giant")) s *= 0.92;
  if (state.ball.owner === p.id) s *= TUNING.carrierSpeedFactor;
  if (state.tick < p.dashUntil) s *= TUNING.dashFactor;
  if (p.mode === "recover") s *= 0.45;
  return s;
}

export const canAct = (p: Player) => p.mode === "normal";

export function knockDown(state: GameState, p: Player, by: number | null, time = TUNING.knockTime, slip = false) {
  if (p.mode === "down") return;
  if (state.ball.owner === p.id) {
    releaseBall(state, p);
    state.events.push({ type: "steal", x: p.pos.x, y: p.pos.y, player: by ?? -1 });
  }
  const c = character(p.character);
  p.mode = "down";
  p.modeUntil = state.tick + secs(time * c.knock);
  p.noGrabUntil = p.modeUntil;
  p.charge = 0;
  state.events.push(
    slip ? { type: "slip", x: p.pos.x, y: p.pos.y, player: p.id } : { type: "knock", x: p.pos.x, y: p.pos.y, player: p.id, by },
  );
}

export function startSlide(state: GameState, p: Player) {
  const c = character(p.character);
  p.mode = "sliding";
  p.modeUntil = state.tick + secs(TUNING.slideTime * c.slide);
  const speed = TUNING.slideSpeed * Math.sqrt(c.slide) * (p.role === "keeper" ? 0.85 : 1);
  p.vel = { x: p.facing.x * speed, y: p.facing.y * speed };
  p.actionReadyAt = state.tick + secs(TUNING.tackleCooldown);
  p.charge = 0;
  state.events.push({ type: "tackle", x: p.pos.x, y: p.pos.y, player: p.id });
}

export function steerPlayer(state: GameState, p: Player, input: InputState) {
  if (p.mode === "down" || p.mode === "frozen") {
    const k = Math.exp(-(p.mode === "down" ? 3 : 8) * DT);
    p.vel.x *= k;
    p.vel.y *= k;
    if (state.tick >= p.modeUntil) {
      p.mode = p.mode === "down" ? "recover" : "normal";
      p.modeUntil = state.tick + secs(TUNING.recoverTime);
    }
    return;
  }
  if (p.mode === "sliding") {
    const k = Math.exp(-2.2 * DT);
    p.vel.x *= k;
    p.vel.y *= k;
    if (state.tick >= p.modeUntil) {
      p.mode = "recover";
      p.modeUntil = state.tick + secs(TUNING.recoverTime);
    }
    return;
  }
  if (p.mode === "recover" && state.tick >= p.modeUntil) p.mode = "normal";

  let mx = input.moveX;
  let my = input.moveY;
  let len = Math.hypot(mx, my);
  if (len > 1) {
    mx /= len;
    my /= len;
    len = 1;
  }
  const carrying = state.ball.owner === p.id;
  const speedMax = maxSpeed(state, p);

  if (carrying && len > 0.2) {
    const speed = Math.hypot(p.vel.x, p.vel.y);
    const cos = (p.facing.x * mx + p.facing.y * my) / len;
    if (speed > TUNING.sharpTurnSpeed * speedMax && cos < TUNING.sharpTurnCos) releaseBall(state, p);
  }

  if (len > 0.2) {
    const from = Math.atan2(p.facing.y, p.facing.x);
    let diff = Math.atan2(my, mx) - from;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    const maxTurn = (state.ball.owner === p.id ? TUNING.carrierTurnRate : TUNING.playerTurnRate) * DT;
    const a = from + Math.max(-maxTurn, Math.min(maxTurn, diff));
    p.facing = { x: Math.cos(a), y: Math.sin(a) };
  }
  if (state.ball.owner === p.id && len > 0) {
    // Pallon kanssa liikutaan katseen suuntaan ja hidastetaan käännöksessä ([E] 19).
    const align = (p.facing.x * mx + p.facing.y * my) / len;
    const throttle = (len * (1 + align)) / 2;
    mx = p.facing.x * throttle;
    my = p.facing.y * throttle;
  }

  const c = character(p.character);
  const accel = TUNING.playerAccel * c.accel * (hasEffect(p, "turbo") ? 1.5 : 1) * (state.tick < p.dashUntil ? 2 : 1);
  const k = Math.min(1, accel * DT);
  p.vel.x += (mx * speedMax - p.vel.x) * k;
  p.vel.y += (my * speedMax - p.vel.y) * k;
}
