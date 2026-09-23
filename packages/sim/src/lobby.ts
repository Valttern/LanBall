import { CHARACTERS } from "./characters.ts";
import type { ArenaDef, GameEvent, GameState, InputState, MatchSetup, Team } from "./types.ts";

/** Pelaajan tunnusvärit (rengas jalkojen alla ja nimilappu). */
export const PLAYER_COLORS = [0xff4d6d, 0x4dabff, 0x7cff6b, 0xffd23f, 0xc77dff, 0x2ee6d6];
export const MAX_PER_TEAM = 3;
export const MAX_PLAYERS = 6;

export interface LobbyPlayer {
  slot: number;
  client: string; // mikä selain/laite omistaa paikan
  device: string; // "kb1", "kb2", "pad0"...
  name: string;
  team: Team;
  character: string;
  ready: boolean;
}

export interface LobbySettings {
  matchSeconds: number;
  powerups: boolean;
}

export interface LobbyState {
  players: LobbyPlayer[];
  settings: LobbySettings;
  startsIn: number | null; // sekunteja aloitukseen, kun kaikki ovat valmiita
}

export const newLobby = (): LobbyState => ({ players: [], settings: { matchSeconds: 150, powerups: true }, startsIn: null });

export function joinLobby(lobby: LobbyState, client: string, device: string): LobbyPlayer | null {
  if (lobby.players.length >= MAX_PLAYERS) return null;
  if (lobby.players.some((p) => p.client === client && p.device === device)) return null;
  let slot = 0;
  while (lobby.players.some((p) => p.slot === slot)) slot++;
  const count = (t: Team) => lobby.players.filter((p) => p.team === t).length;
  const team: Team = count(0) <= count(1) ? 0 : 1;
  const taken = new Set(lobby.players.filter((p) => p.team === team).map((p) => p.character));
  const character = CHARACTERS.find((c) => !taken.has(c.id))?.id ?? CHARACTERS[0].id;
  const player: LobbyPlayer = { slot, client, device, name: `P${slot + 1}`, team, character, ready: false };
  lobby.players.push(player);
  lobby.players.sort((a, b) => a.slot - b.slot);
  lobby.startsIn = null;
  return player;
}

export function leaveLobby(lobby: LobbyState, slot: number) {
  lobby.players = lobby.players.filter((p) => p.slot !== slot);
  lobby.startsIn = null;
}

export function switchTeam(lobby: LobbyState, slot: number, team: Team) {
  const p = lobby.players.find((q) => q.slot === slot);
  if (!p || p.ready || p.team === team) return;
  if (lobby.players.filter((q) => q.team === team).length >= MAX_PER_TEAM) return;
  p.team = team;
}

export function cycleCharacter(lobby: LobbyState, slot: number, dir: 1 | -1) {
  const p = lobby.players.find((q) => q.slot === slot);
  if (!p || p.ready) return;
  const i = CHARACTERS.findIndex((c) => c.id === p.character);
  p.character = CHARACTERS[(i + dir + CHARACTERS.length) % CHARACTERS.length].id;
}

export function setReady(lobby: LobbyState, slot: number, ready: boolean) {
  const p = lobby.players.find((q) => q.slot === slot);
  if (!p) return;
  if (ready) {
    // Samassa joukkueessa ei kahta samaa hahmoa.
    const clash = lobby.players.some((q) => q !== p && q.team === p.team && q.ready && q.character === p.character);
    if (clash) return;
  }
  p.ready = ready;
  if (!ready) lobby.startsIn = null;
}

export const allReady = (lobby: LobbyState) => lobby.players.length > 0 && lobby.players.every((p) => p.ready);

export function setupFromLobby(lobby: LobbyState, seed: number): MatchSetup {
  return {
    humans: lobby.players.map((p) => ({ slot: p.slot, team: p.team, character: p.character })),
    seed,
    matchSeconds: lobby.settings.matchSeconds,
    powerups: lobby.settings.powerups,
  };
}

// ---------- Verkkoprotokolla (päätös 4) ----------

export interface RosterEntry {
  slot: number;
  name: string;
  client: string;
}

export type ClientMsg =
  | { t: "join"; device: string }
  | { t: "leave"; slot: number }
  | { t: "team"; slot: number; team: Team }
  | { t: "character"; slot: number; dir: 1 | -1 }
  | { t: "ready"; slot: number; ready: boolean }
  | { t: "settings"; settings: Partial<LobbySettings> }
  | { t: "input"; frames: Record<number, InputState[]> }
  | { t: "lobby" };

export type ServerMsg =
  | { t: "welcome"; client: string; urls: string[] }
  | { t: "lobby"; lobby: LobbyState; inMatch: boolean }
  | { t: "start"; setup: MatchSetup; arena: ArenaDef; roster: RosterEntry[] }
  | { t: "snap"; state: GameState; events: GameEvent[] }
  | { t: "end" };
