import { PICKUPS, TICK_RATE, byId, character } from "@lanball/sim";
import type { GameEvent, GameState } from "@lanball/sim";
import { sfx } from "../audio/audio.ts";
import { PICKUP_COLORS, TEAM_HEX, TEAM_NAMES } from "../render/art.ts";
import type { RosterInfo } from "../render/view.ts";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Tulostaulu, alkulaskenta ja bannerit HTML:nä: terävä teksti ja CSS-animaatiot. */
export class Hud {
  readonly el: HTMLDivElement;
  private score: HTMLElement[];
  private clock: HTMLElement;
  private banner: HTMLElement;
  private powers: HTMLElement;
  private last = { s0: -1, s1: -1, clock: "", banner: "", powers: "" };
  private bannerUntil = 0;
  private lastCount = -1;

  constructor() {
    this.el = document.createElement("div");
    this.el.className = "hud";
    this.el.innerHTML = `
      <div class="scoreboard" role="status" aria-live="polite">
        <div class="sb-team blaze"><span class="sb-name">${TEAM_NAMES[0]}</span><span class="sb-score">0</span></div>
        <div class="sb-clock">2:30</div>
        <div class="sb-team frost"><span class="sb-score">0</span><span class="sb-name">${TEAM_NAMES[1]}</span></div>
      </div>
      <div class="banner"></div>
      <div class="powers"></div>`;
    this.score = [...this.el.querySelectorAll<HTMLElement>(".sb-score")];
    this.clock = this.el.querySelector(".sb-clock")!;
    this.banner = this.el.querySelector(".banner")!;
    this.powers = this.el.querySelector(".powers")!;
  }

  private showBanner(html: string, color: string, ms: number, cls = "") {
    this.banner.innerHTML = `<div class="banner-text ${cls}" style="--c:${color}">${html}</div>`;
    this.bannerUntil = performance.now() + ms;
    this.last.banner = html;
  }

  onEvents(events: GameEvent[], state: GameState, roster: Map<number, RosterInfo>) {
    for (const e of events) {
      if (e.type === "goal") {
        const scorer = byId(state, e.scorer);
        const human = scorer?.controller != null ? roster.get(scorer.controller) : undefined;
        const who = scorer ? character(scorer.character).name : "";
        const line = e.ownGoal ? `Own goal by ${esc(who)}` : scorer ? `${esc(human ? `${who} (${human.name})` : who)} scores` : "";
        this.showBanner(`${state.golden ? "GOLDEN<br>GOAL!" : "GOAL!"}<small>${line}</small>`, TEAM_HEX[e.team], 2400);
        const el = this.score[e.team];
        el.classList.remove("bump");
        void el.offsetWidth;
        el.classList.add("bump");
      }
      if (e.type === "whistle" && e.kind === "golden") this.showBanner("GOLDEN<br>GOAL<small>Next goal wins</small>", "#ff8a5b", 2200);
      if (e.type === "whistle" && e.kind === "end") this.showBanner("FULL<br>TIME", "#d14d7c", 5000);
    }
  }

  update(state: GameState, localSlots: Set<number>) {
    const [s0, s1] = state.score;
    if (s0 !== this.last.s0) this.score[0].textContent = String((this.last.s0 = s0));
    if (s1 !== this.last.s1) this.score[1].textContent = String((this.last.s1 = s1));

    const secs = Math.ceil(state.timeLeft / TICK_RATE);
    const clock = state.golden ? "GOLDEN" : `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
    if (clock !== this.last.clock) {
      this.clock.textContent = this.last.clock = clock;
      this.clock.classList.toggle("golden", state.golden);
    }

    // Alkulaskenta 3–2–1–GO
    if (state.phase === "countdown") {
      const left = Math.ceil((state.phaseUntil - state.tick) / TICK_RATE);
      if (left !== this.lastCount && left > 0) {
        this.lastCount = left;
        sfx.beep(false);
        this.showBanner(String(left), "#d14d7c", 900, "count");
      }
    } else if (this.lastCount > 0) {
      this.lastCount = -1;
      sfx.beep(true);
      this.showBanner("GO!", "#ff5a36", 600, "count");
    }
    if (this.last.banner && performance.now() > this.bannerUntil) {
      this.banner.innerHTML = "";
      this.last.banner = "";
    }

    // Omien pelaajien voimassa olevat powerupit
    const chips: string[] = [];
    for (const p of state.players) {
      if (p.controller === null || !localSlots.has(p.controller)) continue;
      for (const e of p.effects) {
        const left = Math.ceil((e.until - state.tick) / TICK_RATE);
        chips.push(`<span class="power" style="background:${PICKUP_COLORS[e.kind]}">${PICKUPS[e.kind].label} ${left}</span>`);
      }
    }
    const html = chips.join("");
    if (html !== this.last.powers) this.powers.innerHTML = this.last.powers = html;
  }
}
