export interface Vec {
  x: number;
  y: number;
}

/** Yhden pelaajan ohjaus yhdellä tickillä. Kaikki syötelähteet (näppäimistö, ohjain, verkko, tekoäly) tuottavat tätä. */
export interface InputState {
  moveX: number; // -1..1
  moveY: number; // -1..1
  pass: boolean;
  shoot: boolean;
  tackle: boolean;
}

export type Team = 0 | 1;
export type Role = "field" | "keeper";
export type PlayerMode = "normal" | "sliding" | "down" | "recover" | "frozen";
export type EffectKind = "turbo" | "giant" | "magnet" | "mega";
export type PickupKind = "turbo" | "giant" | "magnet" | "mega" | "freeze" | "banana";

export interface Body {
  pos: Vec;
  vel: Vec;
  radius: number;
  mass: number;
}

export interface Effect {
  kind: EffectKind;
  until: number; // tick
}

export interface AiMemory {
  charge: number; // tickejä jäljellä laukauksen latauksessa (0 = ei lataa)
  holdUntil: number; // maalivahti pitää palloa tähän asti
  tackleReadyAt: number;
  thinkAt: number; // seuraava harkittu päätös (syöttö)
  passTarget: number | null; // päätetty syöttökohde
}

export interface Player extends Body {
  id: number;
  team: Team;
  role: Role;
  character: string;
  facing: Vec;
  home: Vec; // aloituspaikka
  noGrabUntil: number; // tick, ennen jota pelaaja ei voi napata palloa
  mode: PlayerMode;
  modeUntil: number;
  charge: number; // laukauksen lataus tickeinä
  dashUntil: number;
  actionReadyAt: number; // taklauksen / spurtin viive
  controller: number | null; // ihmispelaajan slotti, null = tekoäly
  effects: Effect[];
  held: { pass: boolean; shoot: boolean; tackle: boolean }; // edellisen tickin napit reunantunnistukseen
  ai: AiMemory;
}

export interface Ball extends Body {
  owner: number | null; // pallon haltijan id
  ownedSince: number; // tick, jolloin nykyinen haltija nappasi pallon
  lastTouch: number | null;
  passTo: number | null; // syötön aiottu vastaanottaja
  fire: boolean; // tykkipotku
  curve: number; // kaartuvan laukauksen sivukiihtyvyys
  spin: number; // piirtoa varten
}

export interface Slot {
  slot: number;
  team: Team;
  playerId: number;
  locked: boolean; // useampi ihminen samassa joukkueessa: lukittu omaan hahmoon (päätös 10)
  switchedAt: number;
}

export interface Pickup {
  id: number;
  kind: PickupKind;
  pos: Vec;
  born: number;
}

export interface Hazard {
  id: number;
  kind: "banana";
  pos: Vec;
  team: Team; // pudottajan joukkue, ei liukastu omiin
  until: number;
}

export type Phase = "countdown" | "play" | "goal" | "ended";

export type GameEvent =
  | { type: "whistle"; kind: "start" | "end" | "golden" }
  | { type: "goal"; team: Team; scorer: number | null; ownGoal: boolean }
  | { type: "kick"; x: number; y: number; power: number; fire: boolean; player: number }
  | { type: "pass"; x: number; y: number; player: number }
  | { type: "grab"; x: number; y: number; player: number }
  | { type: "save"; x: number; y: number; player: number }
  | { type: "bounce"; x: number; y: number; power: number }
  | { type: "post"; x: number; y: number; power: number }
  | { type: "tackle"; x: number; y: number; player: number }
  | { type: "knock"; x: number; y: number; player: number; by: number | null }
  | { type: "slip"; x: number; y: number; player: number }
  | { type: "steal"; x: number; y: number; player: number }
  | { type: "spawn"; x: number; y: number; kind: PickupKind }
  | { type: "pickup"; x: number; y: number; kind: PickupKind; player: number; team: Team }
  | { type: "switch"; slot: number; player: number };

export interface GameState {
  tick: number;
  phase: Phase;
  phaseUntil: number;
  timeLeft: number; // pelitickejä jäljellä
  golden: boolean; // jatkoaika, seuraava maali voittaa
  kickoffTeam: Team;
  players: Player[];
  ball: Ball;
  score: [number, number];
  slots: Slot[];
  pickups: Pickup[];
  hazards: Hazard[];
  nextPickupAt: number;
  nextId: number;
  rng: number;
  powerups: boolean;
  events: GameEvent[]; // tämän tickin tapahtumat efekteille ja äänille
}

export interface Segment {
  a: Vec;
  b: Vec;
}

/** Kenttä datana (päätös 6). Origo on kentän keskellä. */
export interface ArenaDef {
  halfWidth: number;
  halfHeight: number;
  cornerRadius: number;
  goalHalfWidth: number;
  goalDepth: number;
}

export interface Arena extends ArenaDef {
  /** Kentän reunaviiva suljettuna monikulmiona, maalitaskut mukana. */
  outline: Vec[];
  walls: Segment[];
}

export interface HumanSetup {
  slot: number;
  team: Team;
  character: string;
}

export interface MatchSetup {
  humans: HumanSetup[];
  seed?: number;
  matchSeconds?: number;
  countdownSeconds?: number;
  powerups?: boolean;
}
