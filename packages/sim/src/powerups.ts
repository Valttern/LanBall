import { releaseBall } from "./ball.ts";
import { character } from "./characters.ts";
import { knockDown } from "./players.ts";
import { pick, rand, randRange } from "./rng.ts";
import { TUNING, secs } from "./tuning.ts";
import type { Arena, EffectKind, GameState, PickupKind, Player } from "./types.ts";

/** Powerupit datana: kesto ja todennäköisyyspaino (päätös 6). */
export const PICKUPS: Record<PickupKind, { weight: number; label: string }> = {
  turbo: { weight: 3, label: "TURBO" },
  giant: { weight: 2, label: "GIANT" },
  magnet: { weight: 2, label: "MAGNET" },
  mega: { weight: 2, label: "FIREBALL" },
  freeze: { weight: 1.5, label: "FREEZE" },
  banana: { weight: 2, label: "BANANAS" },
};

const EFFECT_TIME: Record<EffectKind, number> = {
  turbo: TUNING.turboTime,
  giant: TUNING.giantTime,
  magnet: TUNING.magnetTime,
  mega: TUNING.megaTime,
};

function randomKind(state: GameState): PickupKind {
  const kinds = Object.keys(PICKUPS) as PickupKind[];
  const total = kinds.reduce((s, k) => s + PICKUPS[k].weight, 0);
  let r = rand(state) * total;
  for (const k of kinds) {
    r -= PICKUPS[k].weight;
    if (r <= 0) return k;
  }
  return pick(state, kinds);
}

export function spawnPickups(state: GameState, arena: Arena) {
  if (!state.powerups || state.phase !== "play" || state.tick < state.nextPickupAt) return;
  state.nextPickupAt = state.tick + secs(randRange(state, TUNING.pickupInterval[0], TUNING.pickupInterval[1]));
  if (state.pickups.length >= TUNING.maxPickups) return;
  for (let attempt = 0; attempt < 12; attempt++) {
    const pos = {
      x: randRange(state, -arena.halfWidth + 170, arena.halfWidth - 170),
      y: randRange(state, -arena.halfHeight + 90, arena.halfHeight - 90),
    };
    const clear =
      state.players.every((p) => Math.hypot(p.pos.x - pos.x, p.pos.y - pos.y) > 90) &&
      state.pickups.every((q) => Math.hypot(q.pos.x - pos.x, q.pos.y - pos.y) > 200);
    if (!clear) continue;
    const kind = randomKind(state);
    state.pickups.push({ id: state.nextId++, kind, pos, born: state.tick });
    state.events.push({ type: "spawn", x: pos.x, y: pos.y, kind });
    return;
  }
}

function apply(state: GameState, arena: Arena, p: Player, kind: PickupKind) {
  const luck = character(p.character).trait === "lucky" ? 1.5 : 1;
  if (kind === "freeze") {
    for (const q of state.players) {
      if (q.team === p.team) continue;
      if (state.ball.owner === q.id) releaseBall(state, q);
      q.mode = "frozen";
      q.modeUntil = state.tick + secs(TUNING.freezeTime * luck);
      q.charge = 0;
    }
    return;
  }
  if (kind === "banana") {
    const px = -p.facing.y;
    const py = p.facing.x;
    for (let i = 0; i < TUNING.bananaCount; i++) {
      const back = 55 + i * 30;
      const side = (i - (TUNING.bananaCount - 1) / 2) * 55;
      const x = p.pos.x - p.facing.x * back + px * side;
      const y = p.pos.y - p.facing.y * back + py * side;
      state.hazards.push({
        id: state.nextId++,
        kind: "banana",
        pos: { x: Math.max(-arena.halfWidth + 30, Math.min(arena.halfWidth - 30, x)), y: Math.max(-arena.halfHeight + 30, Math.min(arena.halfHeight - 30, y)) },
        team: p.team,
        until: state.tick + secs(TUNING.bananaLife),
      });
    }
    return;
  }
  p.effects = p.effects.filter((e) => e.kind !== kind);
  p.effects.push({ kind, until: state.tick + secs(EFFECT_TIME[kind] * luck) });
}

/** Poiminnat, banaanit ja jättiläisen jyräys. */
export function updatePickups(state: GameState, arena: Arena) {
  for (const p of state.players) {
    if (p.role !== "field" || (p.mode !== "normal" && p.mode !== "recover" && p.mode !== "sliding")) continue;
    const hit = state.pickups.find((q) => Math.hypot(q.pos.x - p.pos.x, q.pos.y - p.pos.y) < p.radius + TUNING.pickupRadius);
    if (!hit) continue;
    state.pickups = state.pickups.filter((q) => q !== hit);
    apply(state, arena, p, hit.kind);
    state.events.push({ type: "pickup", x: hit.pos.x, y: hit.pos.y, kind: hit.kind, player: p.id, team: p.team });
  }

  state.hazards = state.hazards.filter((h) => h.until > state.tick);
  for (const h of [...state.hazards]) {
    const victim = state.players.find(
      (p) => p.team !== h.team && p.mode !== "down" && Math.hypot(p.pos.x - h.pos.x, p.pos.y - h.pos.y) < p.radius + 10,
    );
    if (!victim) continue;
    state.hazards = state.hazards.filter((x) => x !== h);
    knockDown(state, victim, null, TUNING.slipTime, true);
    victim.vel.x *= 1.4;
    victim.vel.y *= 1.4;
  }
}
