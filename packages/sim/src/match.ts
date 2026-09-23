import { CHARACTERS } from "./characters.ts";
import { applyStats } from "./players.ts";
import { rand } from "./rng.ts";
import { TUNING, secs } from "./tuning.ts";
import type { Arena, GameState, MatchSetup, Player, Role, Slot, Team } from "./types.ts";

function makePlayer(id: number, team: Team, role: Role, character: string, x: number, y: number): Player {
  const dir = team === 0 ? 1 : -1;
  const p: Player = {
    id,
    team,
    role,
    character,
    pos: { x, y },
    vel: { x: 0, y: 0 },
    radius: TUNING.playerRadius,
    mass: TUNING.playerMass,
    facing: { x: dir, y: 0 },
    home: { x, y },
    noGrabUntil: 0,
    mode: "normal",
    modeUntil: 0,
    charge: 0,
    dashUntil: 0,
    actionReadyAt: 0,
    controller: null,
    effects: [],
    held: { pass: false, shoot: false, tackle: false },
    ai: { charge: 0, holdUntil: 0, tackleReadyAt: 0, thinkAt: 0, passTarget: null },
  };
  applyStats(p);
  return p;
}

/**
 * Luo ottelun. Joukkue 0 hyökkää oikealle, joukkue 1 vasemmalle.
 * Joukkueessa 3 kenttäpelaajaa + tekoälymaalivahti (päätös 13). Id:t: joukkue 0 = 0–3, joukkue 1 = 4–7, maalivahti viimeisenä.
 */
export function createMatch(arena: Arena, setup: MatchSetup = { humans: [] }): GameState {
  const state: GameState = {
    tick: 0,
    phase: "countdown",
    phaseUntil: secs(setup.countdownSeconds ?? TUNING.countdownSeconds),
    timeLeft: secs(setup.matchSeconds ?? TUNING.matchSeconds),
    golden: false,
    kickoffTeam: 0,
    players: [],
    ball: {
      pos: { x: 0, y: 0 },
      vel: { x: 0, y: 0 },
      radius: TUNING.ballRadius,
      mass: TUNING.ballMass,
      owner: null,
      ownedSince: 0,
      lastTouch: null,
      passTo: null,
      fire: false,
      curve: 0,
      spin: 0,
    },
    score: [0, 0],
    slots: [],
    pickups: [],
    hazards: [],
    nextPickupAt: secs(TUNING.pickupFirstAt),
    nextId: 1,
    rng: (setup.seed ?? 12345) | 0,
    powerups: setup.powerups ?? true,
    events: [],
  };

  // Muodostelma suhteessa kentän kokoon: keskushyökkääjä ja kaksi laitapuolustajaa.
  const formation = [
    { x: arena.halfWidth * 0.2, y: 0 },
    { x: arena.halfWidth * 0.58, y: -arena.halfHeight * 0.45 },
    { x: arena.halfWidth * 0.58, y: arena.halfHeight * 0.45 },
  ];
  for (const team of [0, 1] as const) {
    const s = team === 0 ? -1 : 1;
    const humans = setup.humans.filter((h) => h.team === team).slice(0, 3);
    const used = new Set(humans.map((h) => h.character));
    const pool = CHARACTERS.map((c) => c.id).filter((id) => !used.has(id));
    const chars = humans.map((h) => h.character);
    while (chars.length < 3) chars.push(pool.splice(Math.floor(rand(state) * pool.length), 1)[0]);
    formation.forEach((f, i) => state.players.push(makePlayer(team * 4 + i, team, "field", chars[i], s * f.x, f.y)));
    state.players.push(makePlayer(team * 4 + 3, team, "keeper", "keeper", s * (arena.halfWidth - 60), 0));

    humans.forEach((h, i) => {
      const slot: Slot = { slot: h.slot, team, playerId: team * 4 + i, locked: humans.length > 1, switchedAt: 0 };
      state.slots.push(slot);
      state.players[team * 4 + i].controller = h.slot;
    });
  }
  if (state.phaseUntil === 0) state.phase = "play";
  return state;
}

/** Aloitus keskeltä. Päästetty joukkue aloittaa: sen keskushyökkääjä on pallon vieressä. */
export function kickoff(state: GameState, kickoffTeam: Team) {
  for (const p of state.players) {
    p.pos = { ...p.home };
    p.vel = { x: 0, y: 0 };
    p.facing = { x: p.team === 0 ? 1 : -1, y: 0 };
    p.noGrabUntil = 0;
    p.mode = "normal";
    p.charge = 0;
    p.ai.charge = 0;
    p.ai.passTarget = null;
    if (p.team === kickoffTeam && p.role === "field" && p.home.y === 0) p.pos.x = (p.team === 0 ? -1 : 1) * 46;
  }
  Object.assign(state.ball, { pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 }, owner: null, lastTouch: null, passTo: null, fire: false, curve: 0 });
  state.hazards = [];
  state.phase = "countdown";
  state.phaseUntil = state.tick + secs(TUNING.kickoffCountdown);
}
