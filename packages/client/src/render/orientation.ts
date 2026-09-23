import type { InputState } from "@lanball/sim";

/**
 * Kameran suunta (päätös 33). Simulaatio ei tiedä siitä mitään: näkymä kiertää maailman ruudulle
 * ja ohjaimen suunnat käännetään takaisin simulaation koordinaatteihin, jotta "ylös" on aina ruudulla ylös.
 *
 * Vaaka: maalit vasemmalla ja oikealla. Pysty: joukkueen 0 hyökkäyssuunta (+x) on ruudulla ylös.
 */
export type Orientation = "horizontal" | "vertical";

export const TILT = 0.7; // syvyyssuunnan litistys (vino kuvakulma, päätös 32)

let current: Orientation = "horizontal";
try {
  if (localStorage.getItem("lanball.camera") === "vertical") current = "vertical";
} catch {
  /* yksityinen ikkuna */
}

export const orientation = () => current;

export function setOrientation(o: Orientation) {
  current = o;
  try {
    localStorage.setItem("lanball.camera", o);
  } catch {
    /* ei tallennusta */
  }
}

/** Maailman piste (x, y, korkeus z) ruudun koordinaatteihin. */
export function toScreen(x: number, y: number, z = 0): { x: number; y: number } {
  return current === "horizontal" ? { x, y: y * TILT - z } : { x: y, y: -x * TILT - z };
}

/** Maailman suunta ruudun suunnaksi ilman litistystä (katse, liike). */
export function dirToScreen(dx: number, dy: number): { x: number; y: number } {
  return current === "horizontal" ? { x: dx, y: dy } : { x: dy, y: -dx };
}

/** Ruudun suuntainen ohjain simulaation koordinaatteihin. */
export function inputToSim(input: InputState): InputState {
  if (current === "horizontal") return input;
  return { ...input, moveX: -input.moveY, moveY: input.moveX };
}
