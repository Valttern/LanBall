import type { GameState } from "./types.ts";

/** Siemenellinen satunnaisluku (mulberry32). Tila kulkee GameStatessa, joten host ja testit ovat toistettavia. */
export function rand(state: GameState): number {
  let t = (state.rng = (state.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randRange(state: GameState, min: number, max: number): number {
  return min + (max - min) * rand(state);
}

export function pick<T>(state: GameState, items: readonly T[]): T {
  return items[Math.floor(rand(state) * items.length)];
}
