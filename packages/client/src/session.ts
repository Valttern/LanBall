import { DT, TICK_RATE, buildArena, createMatch, step } from "@lanball/sim";
import type { Arena, ArenaDef, ClientMsg, GameEvent, GameState, InputState, MatchSetup, ServerMsg } from "@lanball/sim";
import type { Device } from "./input/devices.ts";
import { inputToSim } from "./render/orientation.ts";

export interface Frame {
  prev: GameState;
  curr: GameState;
  alpha: number;
  events: GameEvent[];
}

/** Näkymä ei tiedä, pyöriikö peli tässä selaimessa vai hostilla (päätös 3). */
export interface Session {
  readonly arena: Arena;
  readonly canPause: boolean;
  paused: boolean;
  frame(dt: number): Frame | null;
  hitstop(ms: number): void;
  dispose(): void;
}

/** Koko peli tässä selaimessa: sohvapeli tai taustalla pyörivä esittelyottelu. */
export class LocalSession implements Session {
  readonly arena: Arena;
  readonly canPause = true;
  paused = false;
  private prev: GameState;
  private curr: GameState;
  private acc = 0;
  private stopUntil = 0;
  private devices: Map<number, Device>;
  private setup: MatchSetup;
  private loop: boolean;

  constructor(setup: MatchSetup, devices: Map<number, Device>, loop = false) {
    this.arena = buildArena();
    this.setup = setup;
    this.devices = devices;
    this.loop = loop;
    this.prev = this.curr = createMatch(this.arena, setup);
  }

  get state() {
    return this.curr;
  }

  hitstop(ms: number) {
    this.stopUntil = Math.max(this.stopUntil, performance.now() + ms);
  }

  frame(dt: number): Frame {
    const events: GameEvent[] = [];
    if (!this.paused && performance.now() >= this.stopUntil) {
      this.acc = Math.min(this.acc + dt, 0.25);
      while (this.acc >= DT) {
        this.acc -= DT;
        const inputs: InputState[] = [];
        for (const [slot, dev] of this.devices) inputs[slot] = inputToSim(dev.read());
        this.prev = this.curr;
        this.curr = step(this.curr, inputs, this.arena);
        events.push(...this.curr.events);
        if (this.loop && this.curr.phase === "ended") {
          this.setup = { ...this.setup, seed: (this.setup.seed ?? 1) + 1 };
          this.prev = this.curr = createMatch(this.arena, this.setup);
        }
      }
    }
    return { prev: this.prev, curr: this.curr, alpha: this.acc / DT, events };
  }

  /** Kehitystilan apu: ajaa simulaatiota eteenpäin ilman ruudunpäivitystä. */
  advance(ticks: number, input?: Partial<InputState>) {
    for (let i = 0; i < ticks; i++) {
      const inputs: InputState[] = [];
      for (const [slot, dev] of this.devices) inputs[slot] = inputToSim({ ...dev.read(), ...input });
      this.prev = this.curr;
      this.curr = step(this.curr, inputs, this.arena);
    }
    return this.curr;
  }

  dispose() {}
}

// ---------- LAN ----------

type Listener = (msg: ServerMsg) => void;

/** WebSocket-yhteys hostiin. Sama osoite, josta sivu ladattiin. */
export class Connection {
  private ws: WebSocket | null = null;
  private listeners = new Set<Listener>();
  client = "";
  urls: string[] = [];
  open = false;

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const proto = location.protocol === "https:" ? "wss" : "ws";
      const ws = new WebSocket(`${proto}://${location.host}/ws`);
      this.ws = ws;
      const timer = setTimeout(() => reject(new Error("timeout")), 3000);
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data) as ServerMsg;
        if (msg.t === "welcome") {
          this.client = msg.client;
          this.urls = msg.urls;
          this.open = true;
          clearTimeout(timer);
          resolve();
        }
        for (const l of this.listeners) l(msg);
      };
      ws.onerror = () => {
        clearTimeout(timer);
        reject(new Error("no host"));
      };
      ws.onclose = () => {
        this.open = false;
        for (const l of this.listeners) l({ t: "end" });
      };
    });
  }

  on(l: Listener) {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  send(msg: ClientMsg) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  close() {
    this.ws?.close();
    this.ws = null;
    this.open = false;
  }
}

interface Snap {
  state: GameState;
  events: GameEvent[];
  at: number;
}

const INTERP_DELAY = 3; // tickiä (50 ms) puskuria verkon heilunnalle

/** Host ajaa pelin; tämä selain lähettää omien laitteidensa syötteet ja piirtää tilakuvien välistä. */
export class NetSession implements Session {
  readonly arena: Arena;
  readonly canPause = false;
  paused = false;
  private snaps: Snap[] = [];
  private pending: { tick: number; events: GameEvent[] }[] = [];
  private acc = 0;
  private off: () => void;
  private conn: Connection;
  private devices: Map<number, Device>;
  latest: GameState | null = null;

  constructor(conn: Connection, arenaDef: ArenaDef, devices: Map<number, Device>) {
    this.arena = buildArena(arenaDef);
    this.conn = conn;
    this.devices = devices;
    this.off = conn.on((msg) => {
      if (msg.t !== "snap") return;
      this.snaps.push({ state: msg.state, events: msg.events, at: performance.now() });
      if (this.snaps.length > 30) this.snaps.shift();
      this.pending.push({ tick: msg.state.tick, events: msg.events });
      this.latest = msg.state;
    });
  }

  hitstop() {}

  frame(dt: number): Frame | null {
    // Syötteet 60 Hz:n tahdissa, yksi kehys per tick.
    this.acc = Math.min(this.acc + dt, 0.25);
    const frames: Record<number, InputState[]> = {};
    while (this.acc >= DT) {
      this.acc -= DT;
      for (const [slot, dev] of this.devices) (frames[slot] ??= []).push(inputToSim(dev.read()));
    }
    if (Object.keys(frames).length) this.conn.send({ t: "input", frames });

    if (this.snaps.length === 0) return null;
    const newest = this.snaps[this.snaps.length - 1];
    const estTick = newest.state.tick + ((performance.now() - newest.at) / 1000) * TICK_RATE;
    const renderTick = Math.min(estTick - INTERP_DELAY, newest.state.tick);
    let a = this.snaps[0];
    let b = newest;
    for (let i = 0; i < this.snaps.length - 1; i++) {
      if (this.snaps[i].state.tick <= renderTick && this.snaps[i + 1].state.tick >= renderTick) {
        a = this.snaps[i];
        b = this.snaps[i + 1];
        break;
      }
    }
    const span = b.state.tick - a.state.tick;
    const alpha = span > 0 ? Math.max(0, Math.min(1, (renderTick - a.state.tick) / span)) : 1;

    const events: GameEvent[] = [];
    while (this.pending.length && this.pending[0].tick <= renderTick + 1) events.push(...this.pending.shift()!.events);
    return { prev: a.state, curr: b.state, alpha, events };
  }

  dispose() {
    this.off();
  }
}
