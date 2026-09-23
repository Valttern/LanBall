import type { InputState } from "@lanball/sim";

/** Valikkojen reunat: tosi vain sillä ruudunpäivityksellä, jolla nappi painettiin. */
export interface MenuEdges {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  confirm: boolean;
  back: boolean;
  start: boolean;
}

export interface Device {
  id: string; // "kb1", "kb2", "pad0"...
  kind: "keyboard" | "gamepad";
  label: string;
  /** Nappien nimet ruudulla näytettäviä ohjeita varten. */
  keys: { move: string; pass: string; shoot: string; tackle: string };
  connected: boolean;
  menu: MenuEdges;
  /** Pelisyöte. Lyhyet näpäytykset säilyvät seuraavaan lukuun asti, vaikka nappi olisi jo irti. */
  read(): InputState;
}

const noEdges = (): MenuEdges => ({ up: false, down: false, left: false, right: false, confirm: false, back: false, start: false });

// ---------- Näppäimistö (päätös 15: kaksi pelaajaa samalla näppäimistöllä) ----------

interface KeyMap {
  up: string[];
  down: string[];
  left: string[];
  right: string[];
  pass: string[];
  shoot: string[];
  tackle: string[];
}

const KB1: KeyMap = {
  up: ["KeyW"],
  down: ["KeyS"],
  left: ["KeyA"],
  right: ["KeyD"],
  pass: ["KeyF", "KeyJ"],
  shoot: ["KeyG", "KeyK"],
  tackle: ["KeyH", "KeyL"],
};
const KB2: KeyMap = {
  up: ["ArrowUp"],
  down: ["ArrowDown"],
  left: ["ArrowLeft"],
  right: ["ArrowRight"],
  pass: ["Comma", "Numpad1"],
  shoot: ["Period", "Numpad2"],
  tackle: ["Slash", "Numpad3"],
};

const held = new Set<string>();
const latched = new Set<string>(); // painettu sitten viime lukemisen
const GAME_KEYS = new Set([...Object.values(KB1).flat(), ...Object.values(KB2).flat(), "Space", "Enter", "Escape"]);

window.addEventListener("keydown", (e) => {
  if (e.repeat) return;
  held.add(e.code);
  latched.add(e.code);
  if (GAME_KEYS.has(e.code) && !(e.target instanceof HTMLInputElement)) e.preventDefault();
});
window.addEventListener("keyup", (e) => held.delete(e.code));
window.addEventListener("blur", () => held.clear());

class KeyboardDevice implements Device {
  kind = "keyboard" as const;
  connected = true;
  menu = noEdges();
  private prev = new Set<string>();
  id: string;
  label: string;
  keys: Device["keys"];
  private map: KeyMap;
  constructor(id: string, label: string, map: KeyMap, keys: Device["keys"]) {
    this.id = id;
    this.label = label;
    this.map = map;
    this.keys = keys;
  }

  private down = (codes: string[]) => codes.some((c) => held.has(c));
  private fresh = (codes: string[]) => codes.some((c) => held.has(c) && !this.prev.has(c));

  poll() {
    const m = this.map;
    this.menu = {
      up: this.fresh(m.up),
      down: this.fresh(m.down),
      left: this.fresh(m.left),
      right: this.fresh(m.right),
      confirm: this.fresh(m.pass),
      back: this.fresh(m.shoot),
      start: false,
    };
    this.prev = new Set(held);
  }

  read(): InputState {
    const m = this.map;
    const axis = (neg: string[], pos: string[]) => (this.down(pos) ? 1 : 0) - (this.down(neg) ? 1 : 0);
    const btn = (codes: string[]) => codes.some((c) => held.has(c) || latched.has(c));
    const input = {
      moveX: axis(m.left, m.right),
      moveY: axis(m.up, m.down),
      pass: btn(m.pass),
      shoot: btn(m.shoot),
      tackle: btn(m.tackle),
    };
    for (const c of [...m.pass, ...m.shoot, ...m.tackle]) latched.delete(c);
    return input;
  }
}

// ---------- Peliohjain (Gamepad API, standard-mapping) ----------
// A = syöttö, B = laukaus, X tai RB = taklaus (FIFA-tyyli). Valikoissa A = valitse, B = takaisin.

const DEAD = 0.22;

class GamepadDevice implements Device {
  kind = "gamepad" as const;
  connected = false;
  menu = noEdges();
  keys = { move: "stick", pass: "A", shoot: "B", tackle: "X" };
  id: string;
  label: string;
  private index: number;
  private prevButtons: boolean[] = [];
  private prevDir = { x: 0, y: 0 };
  private latch = { pass: false, shoot: false, tackle: false };
  private pad: Gamepad | null = null;
  constructor(index: number) {
    this.index = index;
    this.id = `pad${index}`;
    this.label = `Gamepad ${index + 1}`;
  }

  poll() {
    const pad = navigator.getGamepads?.()[this.index] ?? null;
    this.pad = pad;
    this.connected = !!pad;
    if (!pad) {
      this.menu = noEdges();
      return;
    }
    const b = pad.buttons.map((x) => x.pressed);
    const fresh = (i: number) => !!b[i] && !this.prevButtons[i];
    const { x, y } = this.stick(pad);
    const dir = { x: Math.abs(x) > 0.6 ? Math.sign(x) : 0, y: Math.abs(y) > 0.6 ? Math.sign(y) : 0 };
    this.menu = {
      up: fresh(12) || (dir.y < 0 && this.prevDir.y >= 0),
      down: fresh(13) || (dir.y > 0 && this.prevDir.y <= 0),
      left: fresh(14) || (dir.x < 0 && this.prevDir.x >= 0),
      right: fresh(15) || (dir.x > 0 && this.prevDir.x <= 0),
      confirm: fresh(0),
      back: fresh(1),
      start: fresh(9),
    };
    if (fresh(0)) this.latch.pass = true;
    if (fresh(1) || fresh(7)) this.latch.shoot = true;
    if (fresh(2) || fresh(5)) this.latch.tackle = true;
    this.prevButtons = b;
    this.prevDir = dir;
  }

  private stick(pad: Gamepad) {
    let x = pad.axes[0] ?? 0;
    let y = pad.axes[1] ?? 0;
    const len = Math.hypot(x, y);
    if (len < DEAD) return { x: 0, y: 0 };
    const k = Math.min(1, (len - DEAD) / (1 - DEAD)) / len;
    x *= k;
    y *= k;
    const b = pad.buttons;
    if (b[12]?.pressed) y = -1;
    if (b[13]?.pressed) y = 1;
    if (b[14]?.pressed) x = -1;
    if (b[15]?.pressed) x = 1;
    return { x, y };
  }

  read(): InputState {
    const pad = this.pad;
    if (!pad) return { moveX: 0, moveY: 0, pass: false, shoot: false, tackle: false };
    const b = pad.buttons;
    const { x, y } = this.stick(pad);
    const input = {
      moveX: x,
      moveY: y,
      pass: !!b[0]?.pressed || this.latch.pass,
      shoot: !!b[1]?.pressed || !!b[7]?.pressed || this.latch.shoot,
      tackle: !!b[2]?.pressed || !!b[5]?.pressed || this.latch.tackle,
    };
    this.latch = { pass: false, shoot: false, tackle: false };
    return input;
  }
}

const keyboard1 = new KeyboardDevice("kb1", "Keyboard left", KB1, { move: "WASD", pass: "F", shoot: "G", tackle: "H" });
const keyboard2 = new KeyboardDevice("kb2", "Keyboard right", KB2, { move: "arrows", pass: ",", shoot: ".", tackle: "-" });
const pads = [0, 1, 2, 3].map((i) => new GamepadDevice(i));

export const ALL_DEVICES: Device[] = [keyboard1, keyboard2, ...pads];

/** Globaalit valikkonäppäimet, joita kukaan ei omista. */
export const globalKeys = { enter: false, escape: false, space: false, up: false, down: false, m: false };
const prevGlobal = new Set<string>();

/** Kutsutaan kerran ruudunpäivityksessä ennen valikkologiikkaa. */
export function pollDevices() {
  keyboard1.poll();
  keyboard2.poll();
  for (const p of pads) p.poll();
  const fresh = (c: string) => held.has(c) && !prevGlobal.has(c);
  globalKeys.enter = fresh("Enter");
  globalKeys.escape = fresh("Escape");
  globalKeys.space = fresh("Space");
  globalKeys.up = fresh("ArrowUp") || fresh("KeyW");
  globalKeys.down = fresh("ArrowDown") || fresh("KeyS");
  globalKeys.m = fresh("KeyM");
  prevGlobal.clear();
  for (const c of held) prevGlobal.add(c);
}

export const deviceById = (id: string) => ALL_DEVICES.find((d) => d.id === id);
export const connectedDevices = () => ALL_DEVICES.filter((d) => d.connected);
