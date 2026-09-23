import {
  AI_LEVELS,
  allReady,
  buildArena,
  createMatch,
  cycleCharacter,
  DEFAULT_ARENA,
  DT,
  joinLobby,
  leaveLobby,
  newLobby,
  NO_INPUT,
  setReady,
  setupFromLobby,
  step,
  switchTeam,
  TICK_RATE,
} from "@lanball/sim";
import type { Arena, ClientMsg, GameEvent, GameState, InputState, LobbyState, ServerMsg } from "@lanball/sim";

export interface Peer {
  id: string;
  send(msg: ServerMsg): void;
}

const SNAPSHOT_EVERY = 2; // 30 Hz tilakuvat, asiakkaat interpoloivat (päätös 4)
const MAX_QUEUE = 4;
const STALE_TICKS = 30; // jos syötettä ei tule puoleen sekuntiin (esim. välilehti taustalla), hahmo pysähtyy

/**
 * Yksi LAN-huone: aula ja käynnissä oleva ottelu. Simulaatio pyörii täällä, selaimet lähettävät vain syötteet.
 * Ei riippuvuutta verkkokirjastoon, joten huonetta voi testata ilman socketteja.
 */
export class Room {
  lobby: LobbyState = newLobby();
  peers = new Map<string, Peer>();
  state: GameState | null = null;
  private arena: Arena = buildArena(DEFAULT_ARENA);
  private queues = new Map<number, InputState[]>();
  private last = new Map<number, InputState>();
  private lastFresh = new Map<number, number>();
  private events: GameEvent[] = [];
  private startTimer: ReturnType<typeof setInterval> | null = null;
  private loop: ReturnType<typeof setInterval> | null = null;
  private ending = false;
  private urls: string[];
  constructor(urls: string[]) {
    this.urls = urls;
  }

  connect(peer: Peer) {
    this.peers.set(peer.id, peer);
    peer.send({ t: "welcome", client: peer.id, urls: this.urls });
    peer.send({ t: "lobby", lobby: this.lobby, inMatch: !!this.state });
  }

  disconnect(id: string) {
    this.peers.delete(id);
    const gone = this.lobby.players.filter((p) => p.client === id).map((p) => p.slot);
    for (const slot of gone) leaveLobby(this.lobby, slot);
    if (this.state) {
      // Poistuneen pelaajan hahmo siirtyy tekoälylle.
      this.state.slots = this.state.slots.filter((s) => !gone.includes(s.slot));
      if (this.peers.size === 0) this.stopMatch();
    }
    this.lobbyChanged();
  }

  handle(id: string, msg: ClientMsg) {
    const own = (slot: number) => this.lobby.players.some((p) => p.slot === slot && p.client === id);
    switch (msg.t) {
      case "join":
        if (!this.state) joinLobby(this.lobby, id, msg.device);
        break;
      case "leave":
        if (own(msg.slot)) leaveLobby(this.lobby, msg.slot);
        break;
      case "team":
        if (own(msg.slot)) switchTeam(this.lobby, msg.slot, msg.team);
        break;
      case "character":
        if (own(msg.slot)) cycleCharacter(this.lobby, msg.slot, msg.dir);
        break;
      case "ready":
        if (own(msg.slot)) setReady(this.lobby, msg.slot, msg.ready);
        break;
      case "settings": {
        // Vain tunnetut arvot: selaimen lähettämä roska ei saa kaataa hostia.
        const s = msg.settings;
        if (typeof s.matchSeconds === "number" && s.matchSeconds >= 30 && s.matchSeconds <= 600) this.lobby.settings.matchSeconds = s.matchSeconds;
        if (typeof s.powerups === "boolean") this.lobby.settings.powerups = s.powerups;
        if (s.difficulty && s.difficulty in AI_LEVELS) this.lobby.settings.difficulty = s.difficulty;
        break;
      }
      case "input":
        for (const [slotStr, frames] of Object.entries(msg.frames)) {
          const slot = Number(slotStr);
          if (!own(slot)) continue;
          const q = this.queues.get(slot) ?? [];
          q.push(...frames);
          while (q.length > MAX_QUEUE) q.shift();
          this.queues.set(slot, q);
        }
        return;
      case "lobby":
        return;
    }
    this.lobbyChanged();
  }

  private broadcast(msg: ServerMsg) {
    for (const p of this.peers.values()) p.send(msg);
  }

  private lobbyChanged() {
    if (!this.state && allReady(this.lobby)) {
      if (this.lobby.startsIn === null) this.beginCountdown();
    } else if (this.startTimer) {
      clearInterval(this.startTimer);
      this.startTimer = null;
      this.lobby.startsIn = null;
    }
    this.broadcast({ t: "lobby", lobby: this.lobby, inMatch: !!this.state });
  }

  private beginCountdown() {
    this.lobby.startsIn = 3;
    this.startTimer = setInterval(() => {
      if (!allReady(this.lobby)) return this.lobbyChanged();
      this.lobby.startsIn = (this.lobby.startsIn ?? 1) - 1;
      if (this.lobby.startsIn <= 0) {
        clearInterval(this.startTimer!);
        this.startTimer = null;
        this.lobby.startsIn = null;
        this.startMatch();
      } else {
        this.broadcast({ t: "lobby", lobby: this.lobby, inMatch: false });
      }
    }, 1000);
  }

  startMatch() {
    const setup = setupFromLobby(this.lobby, (Date.now() % 100000) | 0);
    this.state = createMatch(this.arena, setup);
    this.queues.clear();
    this.last.clear();
    this.lastFresh.clear();
    this.events = [];
    this.ending = false;
    const roster = this.lobby.players.map((p) => ({ slot: p.slot, name: p.name, client: p.client }));
    this.broadcast({ t: "start", setup, arena: DEFAULT_ARENA, roster });
    this.broadcast({ t: "lobby", lobby: this.lobby, inMatch: true });

    // Kiinteä 60 Hz silmukka: ajastin herää usein ja ajaa niin monta tickiä kuin aikaa on kulunut.
    let acc = 0;
    let prev = performance.now();
    this.loop = setInterval(() => {
      const now = performance.now();
      acc = Math.min(acc + (now - prev) / 1000, 0.25);
      prev = now;
      while (acc >= DT && this.state) {
        acc -= DT;
        this.tick();
      }
    }, 4);
  }

  tick() {
    if (!this.state) return;
    const inputs: InputState[] = [];
    for (const slot of this.state.slots) {
      const q = this.queues.get(slot.slot);
      const fresh = q?.shift();
      if (fresh) this.lastFresh.set(slot.slot, this.state.tick);
      const stale = this.state.tick - (this.lastFresh.get(slot.slot) ?? this.state.tick) > STALE_TICKS;
      const next = fresh ?? (stale ? NO_INPUT : (this.last.get(slot.slot) ?? NO_INPUT));
      this.last.set(slot.slot, next);
      inputs[slot.slot] = next;
    }
    this.state = step(this.state, inputs, this.arena);
    this.events.push(...this.state.events);
    if (this.state.tick % SNAPSHOT_EVERY === 0 || this.state.phase === "ended") {
      const { players, ...rest } = this.state;
      const lean = { ...rest, players: players.map(({ ai: _ai, ...p }) => p) } as unknown as GameState;
      this.broadcast({ t: "snap", state: lean, events: this.events });
      this.events = [];
    }
    if (this.state.phase === "ended" && !this.ending) {
      // Lopputulos näkyy asiakkaalla; palataan aulaan.
      this.ending = true;
      setTimeout(() => this.stopMatch(), 1000 / TICK_RATE);
    }
  }

  stopMatch() {
    if (this.loop) clearInterval(this.loop);
    this.loop = null;
    this.state = null;
    for (const p of this.lobby.players) p.ready = false;
    this.broadcast({ t: "end" });
    this.lobbyChanged();
  }
}
