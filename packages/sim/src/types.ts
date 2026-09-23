export interface Vec {
  x: number;
  y: number;
}

/** Yhden pelaajan ohjaus yhdellä tickillä. Kaikki syötelähteet tuottavat tätä. */
export interface InputState {
  moveX: number; // -1..1
  moveY: number; // -1..1
  pass: boolean;
  shoot: boolean;
  tackle: boolean;
}

export type Team = 0 | 1;
export type Role = "field" | "keeper";

export interface Body {
  pos: Vec;
  vel: Vec;
  radius: number;
  mass: number;
}

export interface Player extends Body {
  id: number;
  team: Team;
  role: Role;
  facing: Vec;
  home: Vec; // aloituspaikka
  noGrabUntil: number; // tick, ennen jota pelaaja ei voi napata palloa
}

export interface Ball extends Body {
  owner: number | null; // pallon haltijan id
}

export interface GameState {
  tick: number;
  players: Player[];
  ball: Ball;
  score: [number, number];
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
