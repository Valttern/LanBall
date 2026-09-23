import { Application } from "pixi.js";
import QRCode from "qrcode";
import {
  PLAYER_COLORS,
  allReady,
  cycleCharacter,
  joinLobby,
  leaveLobby,
  newLobby,
  setReady,
  setupFromLobby,
  switchTeam,
} from "@lanball/sim";
import type { ArenaDef, GameEvent, GameState, InputState, LobbyPlayer, LobbyState, ServerMsg, Team } from "@lanball/sim";
import { isMuted, sfx, startMusic, stopMusic, toggleMute, unlock } from "./audio/audio.ts";
import { ALL_DEVICES, connectedDevices, deviceById, globalKeys, pollDevices } from "./input/devices.ts";
import type { Device } from "./input/devices.ts";
import { GameView, warmCharacters } from "./render/view.ts";
import type { RosterInfo } from "./render/view.ts";
import { Connection, LocalSession, NetSession } from "./session.ts";
import type { Session } from "./session.ts";
import { Hud } from "./ui/hud.ts";
import { howtoHtml, lobbyHtml, pauseHtml, resultsHtml, titleHtml } from "./ui/screens.ts";
import type { MenuItem, PlayerStats } from "./ui/screens.ts";

type Screen = "title" | "howto" | "lobby" | "match" | "results";

const MENU: MenuItem[] = [
  { id: "local", label: "Play on this computer", sub: "Up to 6 players on keyboards and gamepads" },
  { id: "lan", label: "LAN party", sub: "Everyone plays from their own browser" },
  { id: "howto", label: "How to play", sub: "Controls and power-ups" },
];
const LENGTHS = [90, 150, 240];
const ME = "local";

/** Sovelluksen tila: mikä ruutu on auki, mikä sessio pyörii ja kuka pelaa millä laitteella. */
export class App {
  private pixi: Application;
  private ui: HTMLElement;
  private view!: GameView;
  private session!: Session;
  private hud = new Hud();
  private screen: Screen = "title";
  private menuIndex = 0;
  private overlayIndex = 0;
  private paused = false;
  private lan = false;
  private lobby: LobbyState = newLobby();
  private conn: Connection | null = null;
  private qr = "";
  private joinUrl = "";
  private localStartAt: number | null = null;
  private roster = new Map<number, RosterInfo>();
  private localSlots = new Set<number>();
  private stats = new Map<number, PlayerStats>();
  private lastState: GameState | null = null;
  private endedAt: number | null = null;
  private lobbyKey = "";
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(pixi: Application) {
    this.pixi = pixi;
    this.ui = document.getElementById("ui")!;
    warmCharacters();
    this.startAttract();
    this.renderScreen();

    const wake = () => unlock();
    window.addEventListener("keydown", wake);
    window.addEventListener("pointerdown", wake);
    window.addEventListener("keydown", () => {
      if (this.screen === "title" || this.screen === "lobby") startMusic();
    });
    window.addEventListener("pointerdown", () => {
      if (this.screen === "title" || this.screen === "lobby") startMusic();
    });
    this.ui.addEventListener("click", (e) => this.onClick(e));
    this.ui.addEventListener("pointermove", (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>("[data-menu]");
      if (!b) return;
      const i = Number(b.dataset.menu);
      if (this.screen === "title" && i !== this.menuIndex) {
        this.menuIndex = i;
        this.renderScreen();
      }
    });
    pixi.renderer.on("resize", () => this.view.setViewport(pixi.screen.width, pixi.screen.height));
    pixi.ticker.add((t) => this.tick(Math.min(0.1, t.deltaMS / 1000)));

    if (import.meta.env.DEV) (window as unknown as { __lanball: unknown }).__lanball = this.devHooks();
  }

  // ---------- Sessiot ----------

  private setSession(session: Session) {
    this.session?.dispose();
    this.view?.destroy();
    this.session = session;
    this.view = new GameView(session.arena, this.pixi.renderer.resolution);
    this.view.roster = this.roster;
    this.view.onHitstop = (ms) => this.session.hitstop(ms);
    this.pixi.stage.addChildAt(this.view.root, 0);
    this.view.setViewport(this.pixi.screen.width, this.pixi.screen.height);
  }

  /** Taustalla pyörivä bottiottelu valikoiden takana. */
  private startAttract() {
    this.roster.clear();
    this.localSlots.clear();
    this.setSession(new LocalSession({ humans: [], seed: Math.floor(Math.random() * 1000), countdownSeconds: 1 }, new Map(), true));
  }

  private startLocalMatch() {
    const devices = new Map<number, Device>();
    this.roster.clear();
    this.localSlots.clear();
    for (const p of this.lobby.players) {
      const d = deviceById(p.device);
      if (d) devices.set(p.slot, d);
      this.roster.set(p.slot, { name: p.name, color: PLAYER_COLORS[p.slot % PLAYER_COLORS.length], local: true });
      this.localSlots.add(p.slot);
    }
    this.setSession(new LocalSession(setupFromLobby(this.lobby, Math.floor(Math.random() * 1e6)), devices));
    this.enterMatch();
  }

  private startNetMatch(roster: { slot: number; name: string; client: string }[], arena: ArenaDef) {
    const devices = new Map<number, Device>();
    this.roster.clear();
    this.localSlots.clear();
    for (const r of roster) {
      const mine = r.client === this.conn!.client;
      this.roster.set(r.slot, { name: r.name, color: PLAYER_COLORS[r.slot % PLAYER_COLORS.length], local: mine });
      if (!mine) continue;
      const lp = this.lobby.players.find((p) => p.slot === r.slot);
      const d = lp && deviceById(lp.device);
      if (d) {
        devices.set(r.slot, d);
        this.localSlots.add(r.slot);
      }
    }
    this.setSession(new NetSession(this.conn!, arena, devices));
    this.enterMatch();
  }

  private enterMatch() {
    stopMusic();
    this.stats.clear();
    this.endedAt = null;
    this.lastState = null;
    this.paused = false;
    this.screen = "match";
    this.renderScreen();
  }

  // ---------- Ruudut ----------

  private renderScreen() {
    const s = this.screen;
    let html = "";
    if (s === "title") html = titleHtml(MENU, this.menuIndex, isMuted());
    if (s === "howto") html = howtoHtml();
    if (s === "lobby") html = this.lobbyMarkup();
    if (s === "results") html = resultsHtml(this.lastState?.score ?? [0, 0], [...this.stats.values()], this.resultActions(), this.overlayIndex);
    this.ui.innerHTML = html;
    if (s === "match") {
      this.ui.appendChild(this.hud.el);
      if (this.paused) this.ui.insertAdjacentHTML("beforeend", pauseHtml(this.lan ? "Leave the match?" : "Paused", this.pauseActions(), this.overlayIndex));
    }
  }

  private lobbyMarkup() {
    const players = this.lobby.players;
    return lobbyHtml({
      lobby: this.lobby,
      lan: this.lan,
      me: this.lan ? (this.conn?.client ?? "") : ME,
      deviceOf: (p) => deviceById(p.device),
      joinUrl: this.joinUrl,
      qr: this.qr,
      joinable: connectedDevices().filter((d) => !players.some((p) => p.device === d.id && p.client === this.myClient())),
    });
  }

  private myClient = () => (this.lan ? (this.conn?.client ?? "") : ME);

  private pauseActions() {
    return this.lan
      ? [
          { id: "resume", label: "Keep playing" },
          { id: "leave", label: "Leave match" },
        ]
      : [
          { id: "resume", label: "Resume" },
          { id: "lobby", label: "Back to lobby" },
          { id: "title", label: "Quit to menu" },
        ];
  }

  private resultActions() {
    return this.lan
      ? [
          { id: "lobby", label: "Back to lobby" },
          { id: "title", label: "Quit to menu" },
        ]
      : [
          { id: "rematch", label: "Rematch" },
          { id: "lobby", label: "Back to lobby" },
          { id: "title", label: "Quit to menu" },
        ];
  }

  private toast(msg: string) {
    document.querySelector(".toast")?.remove();
    const el = document.createElement("div");
    el.className = "toast";
    el.setAttribute("role", "alert");
    el.textContent = msg;
    document.body.appendChild(el);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => el.remove(), 6000);
  }

  // ---------- Siirtymät ----------

  private async choose(id: string) {
    sfx.ui("confirm");
    if (id === "local") {
      this.lan = false;
      this.lobby = newLobby();
      this.screen = "lobby";
      this.renderScreen();
    } else if (id === "lan") {
      await this.openLan();
    } else if (id === "howto") {
      this.screen = "howto";
      this.renderScreen();
    }
  }

  private async openLan() {
    const conn = new Connection();
    try {
      await conn.connect();
    } catch {
      this.toast("No LanBall host found at this address. On the host computer run npm run host, then open the address it prints.");
      return;
    }
    this.conn = conn;
    this.lan = true;
    this.joinUrl = conn.urls[0] ?? location.origin;
    this.qr = await QRCode.toDataURL(this.joinUrl, { margin: 1, width: 168, color: { dark: "#1c1430", light: "#fff4e0" } });
    conn.on((m) => this.onServer(m));
    this.screen = "lobby";
    this.renderScreen();
  }

  private onServer(msg: ServerMsg) {
    if (msg.t === "lobby") {
      this.lobby = msg.lobby;
      if (this.screen === "lobby") this.renderLobbyIfChanged();
    } else if (msg.t === "start") {
      this.startNetMatch(msg.roster, msg.arena);
    } else if (msg.t === "end") {
      if (!this.conn?.open) {
        this.toast("Lost connection to the host.");
        this.leaveToTitle();
        return;
      }
      if (this.screen === "match") this.showResults();
    }
  }

  private renderLobbyIfChanged() {
    const key = JSON.stringify(this.lobby) + connectedDevices().map((d) => d.id).join();
    if (key === this.lobbyKey) return;
    this.lobbyKey = key;
    this.renderScreen();
  }

  private showResults() {
    this.screen = "results";
    this.overlayIndex = 0;
    this.renderScreen();
    startMusic();
  }

  private backToLobby() {
    this.screen = "lobby";
    for (const p of this.lobby.players) p.ready = false;
    this.lobby.startsIn = null;
    this.localStartAt = null;
    this.lobbyKey = "";
    this.startAttract();
    this.renderScreen();
    startMusic();
  }

  private leaveToTitle() {
    this.conn?.close();
    this.conn = null;
    this.lan = false;
    this.lobby = newLobby();
    this.localStartAt = null;
    this.screen = "title";
    this.startAttract();
    this.renderScreen();
    startMusic();
  }

  private act(id: string) {
    sfx.ui("confirm");
    if (id === "resume") {
      this.paused = false;
      this.session.paused = false;
      this.renderScreen();
    } else if (id === "rematch") this.startLocalMatch();
    else if (id === "lobby") this.backToLobby();
    else if (id === "title" || id === "leave") this.leaveToTitle();
  }

  private onClick(e: MouseEvent) {
    const t = e.target as HTMLElement;
    const menu = t.closest<HTMLElement>("[data-menu]");
    const action = t.closest<HTMLElement>("[data-action]")?.dataset.action;
    if (action === "mute") {
      toggleMute();
      this.renderScreen();
      return;
    }
    if (action === "close") {
      this.screen = "title";
      this.renderScreen();
      return;
    }
    if (action === "back") return this.leaveToTitle();
    if (action === "length") return this.changeSettings({ matchSeconds: LENGTHS[(LENGTHS.indexOf(this.lobby.settings.matchSeconds) + 1) % LENGTHS.length] });
    if (action === "powerups") return this.changeSettings({ powerups: !this.lobby.settings.powerups });
    if (!menu) return;
    const i = Number(menu.dataset.menu);
    if (this.screen === "title") void this.choose(MENU[i].id);
    else if (this.screen === "results") this.act(this.resultActions()[i].id);
    else if (this.screen === "match" && this.paused) this.act(this.pauseActions()[i].id);
  }

  private changeSettings(s: Partial<LobbyState["settings"]>) {
    sfx.ui("move");
    if (this.lan) this.conn?.send({ t: "settings", settings: s });
    else {
      Object.assign(this.lobby.settings, s);
      this.renderScreen();
    }
  }

  // ---------- Aulan ohjaus laitteilla ----------

  private lobbyInput() {
    const mine = (d: Device) => this.lobby.players.find((p) => p.device === d.id && p.client === this.myClient());
    for (const d of ALL_DEVICES) {
      if (!d.connected) continue;
      const m = d.menu;
      const p = mine(d);
      if (!p) {
        if (m.confirm || m.start) this.lobbyCmd({ t: "join", device: d.id }, d);
        continue;
      }
      if (m.left) this.lobbyCmd({ t: "team", slot: p.slot, team: 0 });
      if (m.right) this.lobbyCmd({ t: "team", slot: p.slot, team: 1 });
      if (m.up) this.lobbyCmd({ t: "character", slot: p.slot, dir: -1 });
      if (m.down) this.lobbyCmd({ t: "character", slot: p.slot, dir: 1 });
      if (m.confirm || m.start) this.lobbyCmd({ t: "ready", slot: p.slot, ready: !p.ready });
      if (m.back) {
        if (p.ready) this.lobbyCmd({ t: "ready", slot: p.slot, ready: false });
        else this.lobbyCmd({ t: "leave", slot: p.slot });
      }
    }
    if (globalKeys.escape) this.leaveToTitle();

    // Paikallinen aloituslaskenta; LAN:ssa host laskee.
    if (!this.lan) {
      if (allReady(this.lobby)) {
        this.localStartAt ??= performance.now() + 3000;
        const left = Math.ceil((this.localStartAt - performance.now()) / 1000);
        if (left !== this.lobby.startsIn) {
          this.lobby.startsIn = left;
          if (left > 0) sfx.beep(false);
        }
        if (left <= 0) {
          this.lobby.startsIn = null;
          this.localStartAt = null;
          this.startLocalMatch();
          return;
        }
      } else {
        this.localStartAt = null;
        this.lobby.startsIn = null;
      }
    }
    this.renderLobbyIfChanged();
  }

  private lobbyCmd(
    cmd:
      | { t: "join"; device: string }
      | { t: "team"; slot: number; team: Team }
      | { t: "character"; slot: number; dir: 1 | -1 }
      | { t: "ready"; slot: number; ready: boolean }
      | { t: "leave"; slot: number },
    dev?: Device,
  ) {
    sfx.ui(cmd.t === "join" ? "join" : cmd.t === "leave" ? "back" : cmd.t === "ready" && cmd.ready ? "confirm" : "move");
    if (this.lan) {
      this.conn?.send(cmd);
      return;
    }
    const l = this.lobby;
    if (cmd.t === "join") joinLobby(l, ME, dev!.id);
    if (cmd.t === "team") switchTeam(l, cmd.slot, cmd.team);
    if (cmd.t === "character") cycleCharacter(l, cmd.slot, cmd.dir);
    if (cmd.t === "ready") setReady(l, cmd.slot, cmd.ready);
    if (cmd.t === "leave") leaveLobby(l, cmd.slot);
  }

  // ---------- Pääsilmukka ----------

  private anyMenu() {
    const e = { up: globalKeys.up, down: globalKeys.down, left: false, right: false, confirm: globalKeys.enter || globalKeys.space, back: globalKeys.escape, start: false };
    for (const d of ALL_DEVICES) {
      if (!d.connected) continue;
      e.up ||= d.menu.up;
      e.down ||= d.menu.down;
      e.left ||= d.menu.left;
      e.right ||= d.menu.right;
      e.confirm ||= d.menu.confirm;
      e.back ||= d.menu.back;
      e.start ||= d.menu.start;
    }
    return e;
  }

  private navigate(count: number, index: number, horizontal = false) {
    const m = this.anyMenu();
    const prev = horizontal ? m.left || m.up : m.up;
    const next = horizontal ? m.right || m.down : m.down;
    if (prev) index = (index + count - 1) % count;
    if (next) index = (index + 1) % count;
    if (prev || next) sfx.ui("move");
    return { index, confirm: m.confirm, back: m.back, changed: prev || next };
  }

  private tick(dt: number) {
    pollDevices();
    if (globalKeys.m) {
      toggleMute();
      if (this.screen === "title") this.renderScreen();
    }

    if (this.screen === "title") {
      const n = this.navigate(MENU.length, this.menuIndex);
      if (n.changed) {
        this.menuIndex = n.index;
        this.renderScreen();
      }
      if (n.confirm) void this.choose(MENU[this.menuIndex].id);
    } else if (this.screen === "howto") {
      const m = this.anyMenu();
      if (m.confirm || m.back) {
        sfx.ui("back");
        this.screen = "title";
        this.renderScreen();
      }
    } else if (this.screen === "lobby") {
      this.lobbyInput();
    } else if (this.screen === "results") {
      const actions = this.resultActions();
      const n = this.navigate(actions.length, this.overlayIndex, true);
      if (n.changed) {
        this.overlayIndex = n.index;
        this.renderScreen();
      }
      if (n.confirm) this.act(actions[this.overlayIndex].id);
    } else if (this.screen === "match") {
      this.matchInput();
    }

    const frame = this.session.frame(dt);
    if (frame) {
      if (frame.events.length) {
        this.view.onEvents(frame.events, frame.curr);
        if (this.screen === "match") {
          this.hud.onEvents(frame.events, frame.curr, this.roster);
          this.track(frame.events, frame.curr);
        }
      }
      this.view.render(frame.prev, frame.curr, frame.alpha, this.session.paused ? 0 : dt);
      if (this.screen === "match") {
        this.hud.update(frame.curr, this.localSlots);
        this.lastState = frame.curr;
        if (frame.curr.phase === "ended") {
          this.endedAt ??= performance.now();
          if (!this.lan && performance.now() - this.endedAt > 3000) this.showResults();
        }
      }
    }
  }

  private matchInput() {
    const pausePressed = globalKeys.escape || ALL_DEVICES.some((d) => d.connected && d.kind === "gamepad" && d.menu.start);
    if (!this.paused) {
      if (pausePressed) {
        this.paused = true;
        this.session.paused = this.session.canPause;
        this.overlayIndex = 0;
        sfx.ui("back");
        this.renderScreen();
      }
      return;
    }
    const actions = this.pauseActions();
    const n = this.navigate(actions.length, this.overlayIndex, true);
    if (n.changed) {
      this.overlayIndex = n.index;
      this.renderScreen();
    }
    if (n.confirm) this.act(actions[this.overlayIndex].id);
    else if (pausePressed) this.act("resume");
  }

  private track(events: GameEvent[], state: GameState) {
    const get = (id: number | null) => {
      if (id === null || id < 0) return undefined;
      let s = this.stats.get(id);
      const p = state.players.find((q) => q.id === id);
      if (!p) return undefined;
      if (!s) {
        s = { id, team: p.team, character: p.character, human: null, goals: 0, shots: 0, knocks: 0, saves: 0 };
        this.stats.set(id, s);
      }
      if (p.controller !== null) s.human = this.roster.get(p.controller)?.name ?? s.human;
      return s;
    };
    for (const p of state.players) get(p.id);
    for (const e of events) {
      if (e.type === "goal" && !e.ownGoal) get(e.scorer)!.goals++;
      if (e.type === "kick") get(e.player)!.shots++;
      if (e.type === "knock" && e.by !== null) get(e.by)!.knocks++;
      if (e.type === "save") get(e.player)!.saves++;
    }
  }

  // ---------- Kehitystilan koukut selaintesteihin ----------

  private devHooks() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const app = this;
    return {
      get screen() {
        return app.screen;
      },
      get state() {
        return (app.session as LocalSession).state ?? (app.session as NetSession).latest;
      },
      get lobby() {
        return app.lobby;
      },
      /** Ajaa paikallista sessiota eteenpäin ja piirtää yhden kuvan (piilotettu välilehti ei päivity itse). */
      advance(ticks: number, input?: Partial<InputState>) {
        const s = app.session as LocalSession;
        const before = s.state;
        s.advance(ticks, input);
        app.view.render(before, s.state, 1, ticks / 60);
        if (app.screen === "match") app.hud.update(s.state, app.localSlots);
        app.pixi.render();
        return s.state;
      },
      /** Ajaa sovelluksen pääsilmukkaa n kertaa (valikot, verkko, efektit). */
      step(n = 1, dt = 1 / 60) {
        for (let i = 0; i < n; i++) app.tick(dt);
        app.pixi.render();
      },
      choose: (id: string) => app.choose(id),
      joinLocal(device: string, team: Team, charId: string) {
        const p = joinLobby(app.lobby, ME, device) as LobbyPlayer;
        switchTeam(app.lobby, p.slot, team);
        p.character = charId;
        setReady(app.lobby, p.slot, true);
        app.renderScreen();
      },
      startLocal: () => app.startLocalMatch(),
      results: () => app.showResults(),
    };
  }
}
