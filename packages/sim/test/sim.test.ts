import { describe, expect, it } from "vitest";
import { buildArena, createMatch, NO_INPUT, step, TICK_RATE } from "../src/index.ts";
import type { GameState, InputState } from "../src/index.ts";

const arena = buildArena();

function run(state: GameState, ticks: number, inputs: (InputState | undefined)[] = []) {
  for (let i = 0; i < ticks; i++) state = step(state, inputs, arena);
  return state;
}

describe("step", () => {
  it("ei muuta edellistä tilaa", () => {
    const s0 = createMatch(arena);
    const snapshot = structuredClone(s0);
    step(s0, [{ ...NO_INPUT, moveX: 1 }], arena);
    expect(s0).toEqual(snapshot);
  });

  it("pelaaja liikkuu syötteen suuntaan", () => {
    const s = run(createMatch(arena), TICK_RATE, [{ ...NO_INPUT, moveY: -1 }]);
    const p = s.players[0];
    expect(p.pos.y).toBeLessThan(-200);
    expect(Math.abs(p.pos.x - p.home.x)).toBeLessThan(1);
  });

  it("pelaaja ei pääse seinän läpi", () => {
    const s = run(createMatch(arena), TICK_RATE * 5, [{ ...NO_INPUT, moveY: -1 }]);
    expect(s.players[0].pos.y).toBeGreaterThanOrEqual(-arena.halfHeight + s.players[0].radius - 0.5);
  });

  it("kova pallo kimpoaa seinästä eikä karkaa kentältä", () => {
    let s = createMatch(arena);
    s.players = []; // tyhjä kenttä
    s.ball.vel = { x: 300, y: -1400 };
    for (let i = 0; i < TICK_RATE * 3; i++) {
      s = step(s, [], arena);
      expect(Math.abs(s.ball.pos.y)).toBeLessThanOrEqual(arena.halfHeight);
    }
  });

  it("maali kirjataan ja peli alkaa keskeltä", () => {
    let s = createMatch(arena);
    s.players = [];
    s.ball.vel = { x: 1400, y: 0 };
    s = run(s, TICK_RATE * 2);
    expect(s.score).toEqual([1, 0]);
    expect(s.ball.pos).toEqual({ x: 0, y: 0 });
  });

  it("pallo kimpoaa maalitolpan ohi kulkiessaan takaisin kentälle", () => {
    let s = createMatch(arena);
    s.players = [];
    s.ball.pos = { x: 0, y: -250 };
    s.ball.vel = { x: 1400, y: 0 };
    s = run(s, TICK_RATE);
    expect(s.score).toEqual([0, 0]);
    expect(s.ball.pos.x).toBeLessThan(arena.halfWidth);
  });
});
