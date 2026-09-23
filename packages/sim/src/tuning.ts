export const TICK_RATE = 60;
export const DT = 1 / TICK_RATE;
export const secs = (s: number) => Math.round(s * TICK_RATE);

export type Difficulty = "easy" | "normal" | "hard";

/** Tekoälyn taso (päätökset 35–36). Normal on hieman heikennetty, Hard suunnilleen alkuperäinen. */
export interface AiSkill {
  tackleRange: number; // kuinka läheltä liukutaklaus yritetään (rako hahmojen välissä)
  tackleChance: number; // todennäköisyys per harkinta, kun kuljettaja on kantamalla
  tackleFacing: number; // taklataan vain, kun katse osoittaa kuljettajaa näin suoraan (cos)
  tackleRest: readonly [number, number]; // tauko taklausyrityksen jälkeen (s)
  chaseSpeed: number; // pallon jahtaamisen vauhti
  aimError: number; // laukauksen hajonta maalin puolikkaan leveydestä
  think: readonly [number, number]; // syöttöpäätösten väli (s)
  keeperReach: number; // maalivahdin lisäulottuvuus nappaamiseen
  keeperDiveTime: number; // kuinka myöhään maalivahti vielä syöksyy (s)
  keeperSpeed: number; // maalivahdin nopeuskerroin
}

export const AI_LEVELS: Record<Difficulty, AiSkill> = {
  easy: {
    tackleRange: 45,
    tackleChance: 0.08,
    tackleFacing: 0.92,
    tackleRest: [2.4, 3.6],
    chaseSpeed: 0.78,
    aimError: 0.85,
    think: [0.9, 1.4],
    keeperReach: 0,
    keeperDiveTime: 0.2,
    keeperSpeed: 0.9,
  },
  normal: {
    tackleRange: 60,
    tackleChance: 0.18,
    tackleFacing: 0.85,
    tackleRest: [1.6, 2.6],
    chaseSpeed: 0.88,
    aimError: 0.55,
    think: [0.6, 1.0],
    keeperReach: 4,
    keeperDiveTime: 0.28,
    keeperSpeed: 1,
  },
  hard: {
    tackleRange: 62,
    tackleChance: 0.35,
    tackleFacing: 0.75,
    tackleRest: [1.2, 2.2],
    chaseSpeed: 1,
    aimError: 0.2,
    think: [0.4, 0.7],
    keeperReach: 10,
    keeperDiveTime: 0.35,
    keeperSpeed: 1.07,
  },
};
const deg = (d: number) => (d * Math.PI) / 180;

/** Kaikki pelituntuman säätöarvot yhdessä paikassa. */
export const TUNING = {
  playerRadius: 26,
  playerMass: 5,
  playerMaxSpeed: 375, // isompi kenttä (päätös 34)
  playerAccel: 10, // kuinka nopeasti nopeus hakeutuu tavoitteeseen (1/s)
  playerTurnRate: 10, // katseen kääntymisnopeus (rad/s)
  carrierTurnRate: 7, // pallon kanssa käännytään hitaammin
  keeperRadius: 29,
  keeperSpeed: 315,
  ballRadius: 14,
  ballMass: 1,
  ballFriction: 0.7, // eksponentiaalinen hidastus (1/s)
  ballWallRestitution: 0.8,
  playerWallRestitution: 0.1,
  bodyRestitution: 0.4,
  substeps: 4,

  // Pallon hallinta (päätös 18)
  grabReach: 8,
  dribbleGap: 4,
  dribbleSpring: 300,
  dribbleDamping: 35,
  loseDistance: 40,
  sharpTurnCos: -0.5, // käännös yli 120°...
  sharpTurnSpeed: 0.8, // ...yli 80 % kuljettajan huippunopeudesta irrottaa pallon
  wallLoseSpeed: 150,
  bumpLoseSpeed: 200, // tätä kovempi törmäys kuljettajaan irrottaa pallon (kevyt hipaisu ei)
  regrabDelay: 0.4,
  settleTime: 0.25, // napatun pallon asettumisaika, jonka aikana se ei irtoa etäisyyden takia
  carrierSpeedFactor: 0.9,
  fieldGrabMaxSpeed: 720, // kovempaa palloa kenttäpelaaja ei saa haltuun, se vain kimpoaa
  keeperGrabMaxSpeed: 1280,

  // Syöttö (tähtäysapu, [E] 20)
  passConeCos: Math.cos(deg(55)),
  passMaxDist: 1250,
  passMinSpeed: 520,
  passMaxSpeed: 1150,
  passLead: 0.6,
  passerNoGrab: 0.25,

  // Laukaus (ladattava, [E] 21)
  shotMinSpeed: 860,
  shotMaxSpeed: 1650,
  chargeTime: 0.75,
  volleyReach: 24,
  volleyPower: 0.55,
  shotAssistCos: Math.cos(deg(28)),

  // Taklaus ja spurtti ([E] 22)
  slideSpeed: 660,
  slideTime: 0.32,
  recoverTime: 0.35,
  knockTime: 0.9,
  tackleCooldown: 0.9,
  dashFactor: 1.5,
  dashTime: 0.35,
  dashCooldown: 1.6,

  // Ottelu (päätös 14)
  matchSeconds: 150,
  countdownSeconds: 3,
  kickoffCountdown: 1.5,
  goalPause: 2.6,

  // Powerupit (S4)
  pickupRadius: 24,
  pickupFirstAt: 6,
  pickupInterval: [8, 13] as const,
  maxPickups: 2,
  turboTime: 6,
  turboSpeed: 1.4,
  giantTime: 8,
  giantScale: 1.55,
  giantMass: 3,
  freezeTime: 2,
  magnetTime: 6,
  magnetRange: 280,
  magnetAccel: 1500,
  megaTime: 12,
  megaSpeed: 2300,
  bananaCount: 3,
  bananaLife: 20,
  slipTime: 1.1,

  // Ohjauksen vaihto (päätös 10 ja 15)
  autoSwitchMargin: 110,
  autoSwitchDelay: 0.35,
};
