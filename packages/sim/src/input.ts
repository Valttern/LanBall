import type { InputState } from "./types.ts";

export const NO_INPUT: InputState = { moveX: 0, moveY: 0, pass: false, shoot: false, tackle: false };

export const sameInput = (a: InputState, b: InputState) =>
  a.moveX === b.moveX && a.moveY === b.moveY && a.pass === b.pass && a.shoot === b.shoot && a.tackle === b.tackle;
