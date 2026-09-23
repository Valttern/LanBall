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

describe("pallon hallinta", () => {
  const right: InputState = { ...NO_INPUT, moveX: 1 };
  const left: InputState = { ...NO_INPUT, moveX: -1 };

  /** Kenttä, jossa on vain pelaaja 0 ja halutut muut. */
  function solo(...others: number[]) {
    const s = createMatch(arena);
    s.players = s.players.filter((p) => p.id === 0 || others.includes(p.id));
    return s;
  }

  function carry(s: GameState, seconds: number, input: InputState) {
    return run(s, Math.round(seconds * TICK_RATE), [input]);
  }

  it("hahmo nappaa pallon ja pallo kulkee sen edessä", () => {
    const s = carry(solo(), 1.5, right);
    const p = s.players[0];
    expect(s.ball.owner).toBe(0);
    expect(s.ball.pos.x).toBeGreaterThan(p.pos.x + p.radius);
    expect(Math.abs(s.ball.pos.y - p.pos.y)).toBeLessThan(5);
  });

  it("pallo kulkee edessä myös kun hahmo kääntyy rauhallisesti", () => {
    let s = carry(solo(), 1, right);
    s = run(s, TICK_RATE); // pysähtyy
    s = carry(s, 1, left);
    const p = s.players[0];
    expect(s.ball.owner).toBe(0);
    expect(s.ball.pos.x).toBeLessThan(p.pos.x - p.radius);
  });

  it("jyrkkä käännös täydessä vauhdissa irrottaa pallon, joka jatkaa vanhaan suuntaan", () => {
    let s = carry(solo(), 1.2, right);
    expect(s.ball.owner).toBe(0);
    const at = s.ball.pos.x;
    s = carry(s, 0.1, left);
    expect(s.ball.owner).toBeNull();
    expect(s.ball.vel.x).toBeGreaterThan(0);
    expect(s.ball.pos.x).toBeGreaterThan(at);
  });

  it("menettäjä ei voi napata palloa heti takaisin", () => {
    let s = carry(solo(), 1.2, right);
    s = carry(s, 0.05, left);
    expect(s.ball.owner).toBeNull();
    for (let i = 0; i < 0.3 * TICK_RATE; i++) {
      s = step(s, [right], arena);
      expect(s.ball.owner).not.toBe(0);
    }
  });

  it("vastustajaan törmääminen irrottaa pallon", () => {
    const s0 = solo(4); // vastustajan keskushyökkääjä (160, 0)
    let owned = false;
    let s = s0;
    for (let i = 0; i < 2 * TICK_RATE; i++) {
      s = step(s, [right], arena);
      if (s.ball.owner === 0) owned = true;
    }
    expect(owned).toBe(true);
    expect(s.ball.owner).not.toBe(0);
  });

  it("kova seinäosuma irrottaa pallon", () => {
    let s = solo();
    s.players[0].pos = { x: 300, y: -250 };
    s.ball.pos = { x: 345, y: -250 };
    let owned = false;
    let lost = false;
    for (let i = 0; i < 2 * TICK_RATE; i++) {
      s = step(s, [right], arena);
      if (s.ball.owner === 0) owned = true;
      else if (owned) lost = true;
    }
    expect(owned).toBe(true);
    expect(lost).toBe(true);
  });
});
