import { describe, expect, it } from "vitest";
import { buildArena, createMatch, NO_INPUT, secs, step, TICK_RATE, TUNING } from "../src/index.ts";
import type { GameState, InputState, MatchSetup } from "../src/index.ts";

const arena = buildArena();
const right: InputState = { ...NO_INPUT, moveX: 1 };
const left: InputState = { ...NO_INPUT, moveX: -1 };

/** Ottelu, jossa slotti 0 ohjaa joukkueen 0 keskushyökkääjää (id 0). Ei alkulaskentaa eikä powerupeja. */
function match(extra: Partial<MatchSetup> = {}) {
  return createMatch(arena, {
    humans: [{ slot: 0, team: 0, character: "sprocket" }],
    countdownSeconds: 0,
    powerups: false,
    ...extra,
  });
}

/** Kenttä, jossa on vain pelaaja 0 ja halutut muut. */
function solo(...others: number[]) {
  const s = match();
  s.players = s.players.filter((p) => p.id === 0 || others.includes(p.id));
  return s;
}

function run(state: GameState, ticks: number, input: InputState = NO_INPUT) {
  for (let i = 0; i < ticks; i++) state = step(state, [input], arena);
  return state;
}

const p0 = (s: GameState) => s.players.find((p) => p.id === 0)!;

describe("perusliike", () => {
  it("ei muuta edellistä tilaa", () => {
    const s0 = match();
    const snapshot = structuredClone(s0);
    step(s0, [right], arena);
    expect(s0).toEqual(snapshot);
  });

  it("pelaaja liikkuu syötteen suuntaan", () => {
    const s = run(solo(), TICK_RATE, { ...NO_INPUT, moveY: -1 });
    expect(p0(s).pos.y).toBeLessThan(-200);
    expect(Math.abs(p0(s).pos.x - p0(s).home.x)).toBeLessThan(1);
  });

  it("pelaaja ei pääse seinän läpi", () => {
    const s = run(solo(), TICK_RATE * 5, { ...NO_INPUT, moveY: -1 });
    expect(p0(s).pos.y).toBeGreaterThanOrEqual(-arena.halfHeight + p0(s).radius - 0.5);
  });

  it("alkulaskennan aikana kukaan ei liiku", () => {
    let s = createMatch(arena, { humans: [{ slot: 0, team: 0, character: "zip" }], countdownSeconds: 2 });
    s = run(s, secs(1.5), right);
    expect(s.phase).toBe("countdown");
    expect(p0(s).pos).toEqual(p0(s).home);
    s = run(s, secs(1), right);
    expect(s.phase).toBe("play");
  });
});

describe("pallo ja maalit", () => {
  it("kova pallo kimpoaa seinästä eikä karkaa kentältä", () => {
    let s = match();
    s.players = [];
    s.slots = [];
    s.ball.vel = { x: 300, y: -1400 };
    for (let i = 0; i < TICK_RATE * 3; i++) {
      s = step(s, [], arena);
      expect(Math.abs(s.ball.pos.y)).toBeLessThanOrEqual(arena.halfHeight);
    }
  });

  it("maali kirjataan, tauon jälkeen aloitus keskeltä", () => {
    let s = match();
    s.players = [];
    s.slots = [];
    s.ball.vel = { x: 1400, y: 0 };
    s = run(s, TICK_RATE * 2);
    expect(s.score).toEqual([1, 0]);
    expect(s.phase).toBe("goal");
    s = run(s, secs(TUNING.goalPause + 0.1));
    expect(s.phase).toBe("countdown");
    expect(s.ball.pos).toEqual({ x: 0, y: 0 });
  });

  it("pallo kimpoaa maalin ohi kulkiessaan takaisin kentälle", () => {
    let s = match();
    s.players = [];
    s.slots = [];
    s.ball.pos = { x: 0, y: -250 };
    s.ball.vel = { x: 1400, y: 0 };
    s = run(s, TICK_RATE);
    expect(s.score).toEqual([0, 0]);
  });

  it("tasatilanteessa ajan loputtua tulee kultainen maali", () => {
    let s = match({ matchSeconds: 1 });
    s.players = s.players.filter((p) => p.id === 0);
    s = run(s, secs(1.2));
    expect(s.golden).toBe(true);
    expect(s.phase).toBe("play");
  });
});

describe("pallon hallinta", () => {
  it("hahmo nappaa pallon ja pallo kulkee sen edessä", () => {
    const s = run(solo(), secs(1.5), right);
    expect(s.ball.owner).toBe(0);
    expect(s.ball.pos.x).toBeGreaterThan(p0(s).pos.x + p0(s).radius);
    expect(Math.abs(s.ball.pos.y - p0(s).pos.y)).toBeLessThan(5);
  });

  it("pallo kulkee edessä myös kun hahmo kääntyy rauhallisesti", () => {
    let s = run(solo(), secs(1), right);
    s = run(s, TICK_RATE);
    s = run(s, secs(1), left);
    expect(s.ball.owner).toBe(0);
    expect(s.ball.pos.x).toBeLessThan(p0(s).pos.x - p0(s).radius);
  });

  it("jyrkkä käännös täydessä vauhdissa irrottaa pallon", () => {
    let s = run(solo(), secs(1.2), right);
    expect(s.ball.owner).toBe(0);
    s = run(s, 6, left);
    expect(s.ball.owner).toBeNull();
    expect(s.ball.vel.x).toBeGreaterThan(0);
  });

  it("menettäjä ei voi napata palloa heti takaisin", () => {
    let s = run(solo(), secs(1.2), right);
    s = run(s, 3, left);
    expect(s.ball.owner).toBeNull();
    for (let i = 0; i < 0.3 * TICK_RATE; i++) {
      s = step(s, [right], arena);
      expect(s.ball.owner).not.toBe(0);
    }
  });

  it("vastustajaan törmääminen irrottaa pallon", () => {
    let s = solo(4);
    let owned = false;
    for (let i = 0; i < 2 * TICK_RATE; i++) {
      s = step(s, [right], arena);
      if (s.ball.owner === 0) owned = true;
    }
    expect(owned).toBe(true);
    expect(s.ball.owner).not.toBe(0);
  });

  it("kova seinäosuma irrottaa pallon", () => {
    let s = solo();
    p0(s).pos = { x: arena.halfWidth - 300, y: -250 };
    s.ball.pos = { x: arena.halfWidth - 255, y: -250 };
    let owned = false;
    let lost = false;
    for (let i = 0; i < 2 * TICK_RATE; i++) {
      s = step(s, [right], arena);
      if (s.ball.owner === 0) owned = true;
      else if (owned) lost = true;
    }
    expect(lost).toBe(true);
  });
});

describe("syöttö, laukaus ja taklaus", () => {
  /** Pelaaja 0 pallon kanssa kohdassa (x, y) katse oikealle. */
  function withBall(s: GameState, x = -100, y = 0) {
    const p = p0(s);
    p.pos = { x, y };
    p.facing = { x: 1, y: 0 };
    s.ball.pos = { x: x + 44, y };
    s.ball.owner = 0;
    return s;
  }

  it("syöttö menee joukkuekaverille ja ohjaus siirtyy vastaanottajalle", () => {
    let s = withBall(solo(1));
    s.players.find((p) => p.id === 1)!.pos = { x: 250, y: 60 };
    s = step(s, [{ ...NO_INPUT, pass: true }], arena);
    expect(s.ball.owner).toBeNull();
    expect(s.ball.passTo).toBe(1);
    s = step(s, [NO_INPUT], arena);
    expect(s.slots[0].playerId).toBe(1);
    s = run(s, secs(1));
    expect(s.ball.owner).toBe(1);
  });

  it("ladattu laukaus on kovempi kuin näpäytys", () => {
    const tap = step(step(withBall(solo()), [{ ...NO_INPUT, shoot: true }], arena), [NO_INPUT], arena);
    let s = withBall(solo());
    s = run(s, secs(TUNING.chargeTime), { ...NO_INPUT, shoot: true });
    s = step(s, [NO_INPUT], arena);
    const tapSpeed = Math.hypot(tap.ball.vel.x, tap.ball.vel.y);
    const fullSpeed = Math.hypot(s.ball.vel.x, s.ball.vel.y);
    expect(tapSpeed).toBeLessThan(TUNING.shotMinSpeed + 50);
    expect(fullSpeed).toBeGreaterThan(TUNING.shotMaxSpeed * 0.9);
  });

  it("laukaus kohti maalia päätyy maaliin tyhjällä kentällä", () => {
    let s = withBall(solo(), 300, 60);
    s = run(s, secs(0.4), { ...NO_INPUT, shoot: true });
    s = run(s, secs(1.5));
    expect(s.score[0]).toBe(1);
  });

  it("liukutaklaus kaataa vastustajan ja irrottaa pallon", () => {
    let s = solo(4);
    const opp = s.players.find((p) => p.id === 4)!;
    opp.pos = { x: 60, y: 0 };
    s.ball.pos = { x: 104, y: 0 };
    s.ball.owner = 4;
    p0(s).pos = { x: -40, y: 0 };
    p0(s).facing = { x: 1, y: 0 };
    s = step(s, [{ ...NO_INPUT, tackle: true }], arena);
    expect(p0(s).mode).toBe("sliding");
    s = run(s, secs(0.3));
    expect(s.players.find((p) => p.id === 4)!.mode).toBe("down");
    expect(s.ball.owner).not.toBe(4);
  });

  it("syöttönappi ilman palloa vaihtaa palloa lähimpään joukkuekaveriin", () => {
    let s = match();
    s.ball.pos = { x: -400, y: 170 }; // lähellä pelaajaa 2
    s = step(s, [{ ...NO_INPUT, pass: true }], arena);
    expect(s.slots[0].playerId).toBe(2);
  });
});

describe("powerupit", () => {
  it("jäädytys pysäyttää vastustajat", () => {
    let s = match({ powerups: true });
    s.pickups = [{ id: 99, kind: "freeze", pos: { x: -100, y: 0 }, born: 0 }];
    s = run(s, secs(0.5), right);
    expect(s.pickups).toHaveLength(0);
    expect(s.players.filter((p) => p.team === 1).every((p) => p.mode === "frozen")).toBe(true);
  });

  it("banaani kaataa vastustajan mutta ei omaa", () => {
    let s = solo(4);
    s.hazards = [{ id: 98, kind: "banana", pos: { x: 100, y: 0 }, team: 0, until: 1e9 }];
    s.players.find((p) => p.id === 4)!.pos = { x: 100, y: 0 };
    s = step(s, [NO_INPUT], arena);
    expect(s.players.find((p) => p.id === 4)!.mode).toBe("down");
    expect(s.hazards).toHaveLength(0);
  });

  it("tulipallo lävistää maalivahdin ja menee maaliin", () => {
    let s = solo(7);
    const p = p0(s);
    p.pos = { x: 300, y: 0 };
    p.facing = { x: 1, y: 0 };
    p.effects = [{ kind: "mega", until: 1e9 }];
    s.ball.pos = { x: 344, y: 0 };
    s.ball.owner = 0;
    s = step(s, [{ ...NO_INPUT, shoot: true }], arena);
    s = step(s, [NO_INPUT], arena);
    expect(s.ball.fire).toBe(true);
    let keeperKnocked = false;
    for (let i = 0; i < secs(1); i++) {
      s = step(s, [NO_INPUT], arena);
      if (s.events.some((e) => e.type === "knock" && e.player === 7)) keeperKnocked = true;
    }
    expect(s.score[0]).toBe(1);
    expect(keeperKnocked).toBe(true);
  });
});

describe("tekoäly", () => {
  it("botit pelaavat kokonaisen ottelun järkevästi", () => {
    let totalGoals = 0;
    for (const seed of [1, 2, 3]) {
      let s = createMatch(arena, { humans: [], seed, countdownSeconds: 0 });
      const grabbedBy = new Set<number>();
      for (let i = 0; i < secs(150) + secs(40) && s.phase !== "ended"; i++) {
        s = step(s, [], arena);
        for (const e of s.events) if (e.type === "grab") grabbedBy.add(s.players.find((p) => p.id === e.player)!.team);
        expect(Number.isFinite(s.ball.pos.x) && Number.isFinite(s.ball.pos.y)).toBe(true);
        expect(Math.abs(s.ball.pos.y)).toBeLessThan(arena.halfHeight + 1);
        expect(Math.abs(s.ball.pos.x)).toBeLessThan(arena.halfWidth + arena.goalDepth + 1);
      }
      expect(grabbedBy.size).toBe(2);
      totalGoals += s.score[0] + s.score[1];
    }
    expect(totalGoals).toBeGreaterThanOrEqual(6); // noin 2+ maalia per ottelu
    expect(totalGoals).toBeLessThan(60);
  }, 60_000);
});

describe("vaikeustaso", () => {
  it("Hard-botit taklaavat selvästi enemmän kuin Easy-botit", () => {
    const knocks = (difficulty: "easy" | "hard") => {
      let n = 0;
      for (const seed of [1, 2]) {
        let s = createMatch(arena, { humans: [], seed, countdownSeconds: 0, matchSeconds: 90, difficulty });
        for (let i = 0; i < secs(90) && s.phase !== "ended"; i++) {
          s = step(s, [], arena);
          for (const e of s.events) if (e.type === "knock" && e.by !== null) n++;
        }
      }
      return n;
    };
    const easy = knocks("easy");
    const hard = knocks("hard");
    expect(hard).toBeGreaterThan(easy * 2);
  }, 60_000);
});
