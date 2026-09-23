import type { InputState } from "@lanball/sim";

export interface KeyMap {
  up: string;
  down: string;
  left: string;
  right: string;
  pass: string;
  shoot: string;
  tackle: string;
}

// Päätös 15: kaksi pelaajaa samalla näppäimistöllä.
export const KEYMAP_P1: KeyMap = { up: "KeyW", down: "KeyS", left: "KeyA", right: "KeyD", pass: "KeyF", shoot: "KeyG", tackle: "KeyH" };
export const KEYMAP_P2: KeyMap = { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight", pass: "Comma", shoot: "Period", tackle: "Slash" };

const held = new Set<string>();
window.addEventListener("keydown", (e) => {
  held.add(e.code);
  if (e.code.startsWith("Arrow") || e.code === "Space") e.preventDefault();
});
window.addEventListener("keyup", (e) => held.delete(e.code));
window.addEventListener("blur", () => held.clear());

export function readKeyboard(map: KeyMap): InputState {
  const axis = (neg: string, pos: string) => (held.has(pos) ? 1 : 0) - (held.has(neg) ? 1 : 0);
  return {
    moveX: axis(map.left, map.right),
    moveY: axis(map.up, map.down),
    pass: held.has(map.pass),
    shoot: held.has(map.shoot),
    tackle: held.has(map.tackle),
  };
}
