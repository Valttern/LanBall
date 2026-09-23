/**
 * Hahmot datana (päätös 6). Luvut ovat kertoimia perusarvoihin.
 * `look` kertoo piirtäjälle, miltä hahmo näyttää; simulaatio ei käytä sitä.
 */
export interface CharacterDef {
  id: string;
  name: string;
  tagline: string;
  speed: number;
  accel: number;
  mass: number;
  size: number;
  shot: number;
  pass: number;
  slide: number; // taklausliu'un pituus
  knock: number; // kuinka pitkään taklattu makaa
  trait: "none" | "curve" | "lucky";
  look: { body: number; accent: number; hat: "helmet" | "band" | "mohawk" | "antenna" | "visor" | "duck" | "cap" };
}

export const CHARACTERS: CharacterDef[] = [
  {
    id: "brick",
    name: "BRICK",
    tagline: "Walks through walls. And people.",
    speed: 0.88,
    accel: 0.85,
    mass: 1.7,
    size: 1.12,
    shot: 1.0,
    pass: 0.95,
    slide: 1.0,
    knock: 1.45,
    trait: "none",
    look: { body: 0x8b8f9c, accent: 0xffc93c, hat: "helmet" },
  },
  {
    id: "zip",
    name: "ZIP",
    tagline: "Already there. Forgot the ball.",
    speed: 1.16,
    accel: 1.35,
    mass: 0.8,
    size: 0.92,
    shot: 0.85,
    pass: 1.0,
    slide: 1.1,
    knock: 0.9,
    trait: "none",
    look: { body: 0x57e0c7, accent: 0xfff275, hat: "band" },
  },
  {
    id: "boomer",
    name: "BOOMER",
    tagline: "Shoots first. Asks never.",
    speed: 0.96,
    accel: 1.0,
    mass: 1.1,
    size: 1.02,
    shot: 1.25,
    pass: 0.9,
    slide: 0.95,
    knock: 1.0,
    trait: "none",
    look: { body: 0xff5d73, accent: 0x2b2d42, hat: "mohawk" },
  },
  {
    id: "noodle",
    name: "NOODLE",
    tagline: "Bends it like spaghetti.",
    speed: 1.02,
    accel: 1.05,
    mass: 0.9,
    size: 0.96,
    shot: 1.05,
    pass: 1.15,
    slide: 1.0,
    knock: 1.0,
    trait: "curve",
    look: { body: 0xb28dff, accent: 0x7cff6b, hat: "antenna" },
  },
  {
    id: "sprocket",
    name: "SPROCKET",
    tagline: "Tackle.exe has stopped responding.",
    speed: 1.0,
    accel: 1.1,
    mass: 1.25,
    size: 1.0,
    shot: 1.0,
    pass: 1.0,
    slide: 1.35,
    knock: 1.2,
    trait: "none",
    look: { body: 0x9fb4c7, accent: 0x00e5ff, hat: "visor" },
  },
  {
    id: "ducky",
    name: "DUCKY",
    tagline: "Suspiciously lucky.",
    speed: 1.04,
    accel: 1.1,
    mass: 0.95,
    size: 0.95,
    shot: 0.95,
    pass: 1.05,
    slide: 1.0,
    knock: 0.9,
    trait: "lucky",
    look: { body: 0xffe066, accent: 0xff8c1a, hat: "duck" },
  },
];

export const KEEPER: CharacterDef = {
  id: "keeper",
  name: "KEEPER",
  tagline: "",
  speed: 1,
  accel: 1.2,
  mass: 1.8,
  size: 1,
  shot: 1.05,
  pass: 1.1,
  slide: 1,
  knock: 0.7,
  trait: "none",
  look: { body: 0xe8e8e8, accent: 0x222222, hat: "cap" },
};

export function character(id: string): CharacterDef {
  return CHARACTERS.find((c) => c.id === id) ?? (id === "keeper" ? KEEPER : CHARACTERS[0]);
}
