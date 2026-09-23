import { Container, Graphics, Sprite, Text, Texture } from "pixi.js";
import { CHARACTERS, KEEPER, PICKUPS, character, hasEffect } from "@lanball/sim";
import type { Arena, GameEvent, GameState, Pickup, Player, Vec } from "@lanball/sim";
import { sfx, setCrowd } from "../audio/audio.ts";
import {
  BOARD,
  CHAR_R,
  CHAR_TEX_ANCHOR,
  CHAR_TEX_WORLD,
  HEAD_Y,
  PICKUP_COLORS,
  TEAM_NUM,
  VIEW_H,
  VIEW_W,
  arenaTexture,
  ballTexture,
  bananaPeelTexture,
  characterTexture,
  pickupTexture,
  shadowTex,
  softDot,
  solidDot,
  sparkle,
  toNum,
} from "./art.ts";
import { Fx, Shake } from "./fx.ts";

export interface RosterInfo {
  name: string;
  color: number;
  local: boolean;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const KNOCK_WORDS = ["BONK!", "OOF!", "WHAM!", "SPLAT!", "KAPOW!"];

const charTextures = new Map<string, Texture>();
export function charTex(id: string, team: number) {
  const key = `${id}:${team}`;
  let t = charTextures.get(key);
  if (!t) {
    t = characterTexture(id === "keeper" ? KEEPER : character(id), team);
    charTextures.set(key, t);
  }
  return t;
}
/** Luo kaikki hahmotekstuurit etukäteen, jotta ottelun alussa ei nyi. */
export function warmCharacters() {
  for (const c of [...CHARACTERS, KEEPER]) for (const team of [0, 1]) charTex(c.id, team);
}

class PlayerView {
  root = new Container();
  private shadow: Sprite;
  private ring = new Graphics();
  private feet = new Graphics();
  private body: Sprite;
  private eyes = new Graphics();
  private overlay = new Graphics();
  private tag = new Container();
  private tagText: Text;
  private tagBg = new Graphics();
  private stars: Sprite[] = [];
  private phase = Math.random() * 10;
  private lastPos: Vec;
  private tagKey = "";

  constructor(p: Player, shadow: Texture, star: Texture) {
    this.shadow = new Sprite(shadow);
    this.shadow.anchor.set(0.5);
    this.body = new Sprite(charTex(p.character, p.team));
    this.body.anchor.set(CHAR_TEX_ANCHOR.x, CHAR_TEX_ANCHOR.y);
    this.tagText = new Text({ text: "", style: { fontFamily: "Bungee", fontSize: 15, fill: 0xffffff } });
    this.tagText.anchor.set(0.5);
    this.tag.addChild(this.tagBg, this.tagText);
    for (let i = 0; i < 3; i++) {
      const s = new Sprite(star);
      s.anchor.set(0.5);
      s.scale.set(0.2);
      s.tint = 0xffe14d;
      this.stars.push(s);
    }
    this.root.addChild(this.shadow, this.ring, this.feet, this.body, this.eyes, this.overlay, ...this.stars, this.tag);
    this.lastPos = { ...p.pos };
  }

  update(p: Player, pos: Vec, dt: number, time: number, roster: RosterInfo | undefined, state: GameState, fx: Fx) {
    const scale = p.radius / (CHAR_R * (p.role === "keeper" ? 29 / 26 : 1) * character(p.character).size) || 1;
    const baseScale = (p.radius / CHAR_R) * (CHAR_R / 26);
    const speed = dt > 0 ? Math.hypot(pos.x - this.lastPos.x, pos.y - this.lastPos.y) / dt : 0;
    this.lastPos = { ...pos };
    this.phase += dt * (4 + speed / 30);
    this.root.position.set(pos.x, pos.y);
    this.root.zIndex = pos.y;

    const R = p.radius;
    const moving = speed > 30 && p.mode !== "down" && p.mode !== "frozen";
    const bob = moving ? Math.abs(Math.sin(this.phase)) * 3.5 : Math.sin(time * 2 + this.phase) * 0.8;
    const k = baseScale * (CHAR_TEX_WORLD / (CHAR_TEX_WORLD * 1));
    const squash = moving ? 1 + Math.sin(this.phase * 2) * 0.04 : 1;
    this.body.texture = charTex(p.character, p.team);
    this.body.scale.set((k / 4) * (2 - squash), (k / 4) * squash);
    this.body.y = -bob;
    this.body.rotation = 0;
    this.body.tint = 0xffffff;
    this.body.alpha = 1;

    this.shadow.position.set(0, R * 0.92);
    this.shadow.scale.set((R * 2.3) / 128, (R * 1.3) / 64);
    this.shadow.alpha = 1 - bob / 12;

    // Jalat vuorottelevat juostessa.
    const f = this.feet.clear();
    if (p.mode !== "down") {
      const stride = moving ? Math.sin(this.phase) * R * 0.28 : 0;
      for (const side of [-1, 1]) {
        f.ellipse(side * R * 0.42 + p.facing.x * stride * side * 0.3, R * 0.86 + stride * side * 0.35, R * 0.26, R * 0.16).fill(0x1c1430);
      }
    }

    let eyesVisible = p.facing.y > -0.7;
    // Tilat: liuku, kaatunut, jäätynyt
    if (p.mode === "sliding") {
      this.body.rotation = Math.sign(p.vel.x || p.facing.x) * 0.9;
      if (Math.random() < 0.7) fx.emit("soft", pos.x, pos.y + R * 0.8, { count: 1, color: 0xd9c8ff, speed: [10, 40], size: [14, 26], endSize: 40, life: [0.3, 0.5], layer: "under", alpha: 0.35 });
    }
    if (p.mode === "down") {
      this.body.rotation = (p.id % 2 ? 1 : -1) * 1.45;
      this.body.y = R * 0.2;
      eyesVisible = false;
    }
    this.stars.forEach((s, i) => {
      s.visible = p.mode === "down";
      const a = time * 5 + (i * Math.PI * 2) / 3;
      s.position.set(Math.cos(a) * R * 0.8, -R * 1.3 + Math.sin(a) * R * 0.3);
      s.rotation = time * 4;
    });
    if (p.mode === "recover") this.body.alpha = Math.sin(time * 40) > 0 ? 1 : 0.55;

    const o = this.overlay.clear();
    if (p.mode === "frozen") {
      this.body.tint = 0x9fe8ff;
      o.roundRect(-R * 1.15, -R * 1.9, R * 2.3, R * 2.9, R * 0.35).fill({ color: 0xbff4ff, alpha: 0.35 }).stroke({ width: 2.5, color: 0xffffff, alpha: 0.8 });
      o.moveTo(-R * 0.8, -R * 1.5).lineTo(-R * 0.3, -R * 1.7).stroke({ width: 3, color: 0xffffff, alpha: 0.9 });
    }
    if (hasEffect(p, "magnet")) {
      for (let i = 0; i < 6; i++) {
        const a = time * 3 + (i * Math.PI) / 3;
        o.arc(0, 0, R * 1.5, a, a + 0.35).stroke({ width: 3, color: toNum(PICKUP_COLORS.magnet), alpha: 0.8 });
      }
    }
    if (hasEffect(p, "turbo") && moving && Math.random() < 0.8)
      fx.emit("soft", pos.x - p.vel.x * 0.03, pos.y + R * 0.5, { count: 1, color: [0xffb020, 0xff5a36], speed: [0, 20], size: [16, 26], endSize: 4, life: [0.25, 0.4], alpha: 0.8 });
    if (hasEffect(p, "mega") && Math.random() < 0.6)
      fx.emit("soft", pos.x + (Math.random() - 0.5) * R, pos.y + R * 0.6, { count: 1, color: [0xff4f2e, 0xffb020], speed: [30, 80], angle: -Math.PI / 2, spread: 0.6, size: [10, 18], endSize: 2, life: [0.3, 0.5] });

    // Silmät katsovat liikesuuntaan; selkä kameraan päin, kun katse on ylös.
    const e = this.eyes.clear();
    this.eyes.visible = eyesVisible;
    this.eyes.position.set(0, this.body.y);
    this.eyes.scale.set(baseScale);
    if (eyesVisible) {
      const hy = HEAD_Y;
      const fxv = p.facing.x;
      const fyv = p.facing.y;
      for (const side of [-1, 1]) {
        const ex = side * 6.8 + fxv * 4;
        const ey = hy + 1 + fyv * 3;
        const big = p.mode === "frozen" ? 5 : 5.4;
        e.circle(ex, ey, big).fill(0xffffff).stroke({ width: 1.6, color: 0x1c1430 });
        e.circle(ex + fxv * 2.2, ey + fyv * 2.2, 2.4).fill(0x1c1430);
      }
    }

    // Ohjattavan pelaajan rengas ja nimilappu, latausmittari.
    const ring = this.ring.clear();
    if (roster) {
      const pulse = 0.75 + Math.sin(time * 6) * 0.25;
      ring.ellipse(0, R * 0.9, R * 1.3, R * 0.55).stroke({ width: 4, color: roster.color, alpha: pulse });
      ring.moveTo(-8, R * 0.9 + R * 0.55 + 4).lineTo(0, R * 0.9 + R * 0.55 - 3).lineTo(8, R * 0.9 + R * 0.55 + 4).stroke({ width: 3, color: roster.color });
    }
    if (p.charge > 0) {
      const t = Math.min(1, p.charge / 45);
      const col = t < 1 ? (t < 0.5 ? 0xffe14d : 0xffa43a) : 0xff3b3b;
      ring.arc(0, -R * 0.2, R * 1.45, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * t).stroke({ width: 5, color: col, cap: "round" });
      if (t >= 1 && Math.random() < 0.3) fx.emit("spark", pos.x, pos.y - R * 0.2, { count: 1, color: 0xffe14d, speed: [80, 160], size: [8, 14], life: [0.15, 0.3] });
    }
    this.tag.visible = !!roster;
    if (roster) {
      const key = roster.name + roster.color;
      if (key !== this.tagKey) {
        this.tagKey = key;
        this.tagText.text = roster.name;
        const w = this.tagText.width + 16;
        this.tagBg.clear().roundRect(-w / 2, -12, w, 24, 12).fill(roster.color).stroke({ width: 2.5, color: 0x1c1430 });
      }
      this.tag.position.set(0, -R * 2.05 - bob + Math.sin(time * 3) * 1.5);
      this.tag.scale.set(1 / Math.max(0.8, scale));
    }
    void state;
  }
}

/** Koko pelinäkymä: areena, yleisö, hahmot, pallo, powerupit ja efektit. */
export class GameView {
  readonly root = new Container(); // sisältää kameran
  private world = new Container();
  private crowd: { head: Sprite; body: Sprite; base: number; phase: number; team: number }[] = [];
  private crowdLayer = new Container();
  private ledFlash = new Graphics();
  private hazardLayer = new Container();
  private pickupLayer = new Container();
  private actors = new Container();
  private players = new Map<number, PlayerView>();
  private ballShadow: Sprite;
  private ball: Sprite;
  private ballGlow: Sprite;
  private trail = new Graphics();
  private trailPts: Vec[] = [];
  private pickups = new Map<number, { root: Container; glow: Sprite; icon: Sprite; born: number }>();
  private hazards = new Map<number, Sprite>();
  private pickupTex = new Map<string, Texture>();
  private peelTex: Texture;
  private shadowT: Texture;
  private starT: Texture;
  private glowT: Texture;
  readonly fx = new Fx();
  readonly shake = new Shake();
  private time = 0;
  private excitement = 0;
  private cheerTeam: number | null = null;
  private cheerUntil = 0;
  private ledColor = 0xffffff;
  private ledAlpha = 0;
  private ballRoll = 0;
  private zoom = 1;
  private arena: Arena;
  roster = new Map<number, RosterInfo>();
  onHitstop: ((ms: number) => void) | null = null;

  constructor(arena: Arena, resolution: number) {
    this.arena = arena;
    this.shadowT = shadowTex();
    this.starT = sparkle(48);
    this.glowT = softDot(128);
    this.peelTex = bananaPeelTexture();
    const bg = new Sprite(arenaTexture(arena, Math.min(2, Math.max(1, resolution))));
    bg.anchor.set(0.5);
    bg.scale.set(1 / Math.min(2, Math.max(1, resolution)));
    this.buildCrowd();
    this.actors.sortableChildren = true;
    this.ballShadow = new Sprite(this.shadowT);
    this.ballShadow.anchor.set(0.5);
    this.ball = new Sprite(ballTexture(14));
    this.ball.anchor.set(0.5);
    this.ball.scale.set(1 / 4);
    this.ballGlow = new Sprite(this.glowT);
    this.ballGlow.anchor.set(0.5);
    this.ballGlow.blendMode = "add";
    this.ballGlow.tint = 0xff6a2e;
    this.world.addChild(bg, this.crowdLayer, this.ledFlash, this.fx.under, this.hazardLayer, this.pickupLayer, this.trail, this.ballShadow, this.actors, this.ballGlow, this.fx.over, this.fx.text);
    this.actors.addChild(this.ball);
    this.root.addChild(this.world);
  }

  private buildCrowd() {
    const head = solidDot(32);
    const skins = [0xf1c7a3, 0xd9a07a, 0x9c6b4a, 0x6b4630, 0xffe0bd];
    const rows = [
      { y: -434, count: 70, size: 7 },
      { y: VIEW_H / 2 - 82, count: 58, size: 11 },
      { y: VIEW_H / 2 - 56, count: 62, size: 12 },
      { y: VIEW_H / 2 - 28, count: 66, size: 13 },
    ];
    for (const row of rows) {
      for (let i = 0; i < row.count; i++) {
        const x = -VIEW_W / 2 + ((i + (row.y % 2 ? 0.5 : 0) + Math.random() * 0.4) / row.count) * VIEW_W;
        const team = x < 0 ? 0 : 1;
        const shirt = Math.random() < 0.7 ? TEAM_NUM[team] : [0xffe14d, 0xffffff, 0x7cff6b, 0xc77dff][i % 4];
        const body = new Sprite(head);
        body.anchor.set(0.5);
        body.tint = shirt;
        body.scale.set((row.size * 2.2) / 32, (row.size * 1.6) / 32);
        const h = new Sprite(head);
        h.anchor.set(0.5);
        h.tint = skins[Math.floor(Math.random() * skins.length)];
        h.scale.set((row.size * 1.25) / 32);
        this.crowdLayer.addChild(body, h);
        this.crowd.push({ head: h, body, base: row.y, phase: Math.random() * 10, team });
        body.position.set(x, row.y + row.size * 0.8);
        h.position.set(x, row.y);
      }
    }
  }

  resize(w: number, h: number) {
    const s = Math.min(w / VIEW_W, h / VIEW_H) * this.zoom;
    this.world.scale.set(s);
    this.root.position.set(w / 2, h / 2);
  }

  private viewSize = { w: 0, h: 0 };
  setViewport(w: number, h: number) {
    this.viewSize = { w, h };
    this.resize(w, h);
  }

  /** Piirtää kahden tilan välistä (alpha 0..1). dt on todellinen aika sekunteina. */
  render(prev: GameState, curr: GameState, alpha: number, dt: number) {
    this.time += dt;
    const t = this.time;
    const at = (a: Vec, b: Vec) => ({ x: lerp(a.x, b.x, alpha), y: lerp(a.y, b.y, alpha) });

    // Hahmot
    const seen = new Set<number>();
    for (const p of curr.players) {
      seen.add(p.id);
      let v = this.players.get(p.id);
      if (!v) {
        v = new PlayerView(p, this.shadowT, this.starT);
        this.players.set(p.id, v);
        this.actors.addChild(v.root);
      }
      const q = prev.players.find((x) => x.id === p.id) ?? p;
      const roster = p.controller !== null ? this.roster.get(p.controller) : undefined;
      v.update(p, at(q.pos, p.pos), dt, t, roster, curr, this.fx);
    }
    for (const [id, v] of this.players)
      if (!seen.has(id)) {
        v.root.destroy({ children: true });
        this.players.delete(id);
      }

    // Pallo: vierii, hyppää kovissa laukauksissa ja jättää vanan.
    const b = at(prev.ball.pos, curr.ball.pos);
    const speed = Math.hypot(curr.ball.vel.x, curr.ball.vel.y);
    const lift = Math.min(1, Math.max(0, (speed - 650) / 900));
    this.ballRoll += (speed * dt) / curr.ball.radius;
    this.ball.position.set(b.x, b.y - lift * 10);
    this.ball.rotation = this.ballRoll * 0.25;
    this.ball.scale.set((1 / 4) * (1 + lift * 0.18));
    this.ball.zIndex = b.y + 1;
    this.ballShadow.position.set(b.x + lift * 5, b.y + curr.ball.radius * 0.8);
    this.ballShadow.scale.set((curr.ball.radius * 2.4) / 128, (curr.ball.radius * 1.2) / 64);
    this.ballShadow.alpha = 1 - lift * 0.4;
    this.ballGlow.visible = curr.ball.fire;
    if (curr.ball.fire) {
      this.ballGlow.position.set(b.x, b.y);
      this.ballGlow.scale.set(1.2 + Math.sin(t * 30) * 0.1);
      this.fx.emit("soft", b.x, b.y, { count: 3, color: [0xff4f2e, 0xffb020, 0xffe14d], speed: [20, 90], size: [16, 30], endSize: 2, life: [0.2, 0.45] });
    }
    this.trailPts.push({ x: b.x, y: b.y - lift * 10 });
    if (this.trailPts.length > 12) this.trailPts.shift();
    const tr = this.trail.clear();
    if (speed > 600) {
      const last = curr.players.find((p) => p.id === curr.ball.lastTouch);
      const col = curr.ball.fire ? 0xffa43a : last ? TEAM_NUM[last.team] : 0xffffff;
      for (let i = 1; i < this.trailPts.length; i++) {
        const a = this.trailPts[i - 1];
        const c = this.trailPts[i];
        tr.moveTo(a.x, a.y).lineTo(c.x, c.y).stroke({ width: (i / this.trailPts.length) * 18, color: col, alpha: (i / this.trailPts.length) * 0.5, cap: "round" });
      }
    } else if (this.trailPts.length > 2) {
      this.trailPts.splice(0, this.trailPts.length - 2);
    }

    this.syncPickups(curr.pickups, curr.tick);
    this.syncHazards(curr);

    // Yleisö innostuu, kun pallo on lähellä maalia.
    const nearGoal = Math.max(0, (Math.abs(curr.ball.pos.x) - 300) / (this.arena.halfWidth - 300));
    this.excitement = lerp(this.excitement, curr.phase === "goal" ? 1 : nearGoal * 0.7, Math.min(1, dt * 2));
    setCrowd(this.excitement);
    const cheering = t < this.cheerUntil;
    for (const c of this.crowd) {
      const hype = cheering && c.team === this.cheerTeam ? 1 : this.excitement * 0.5;
      const jump = Math.max(0, Math.sin(t * (5 + hype * 7) + c.phase)) * (1.5 + hype * 9);
      c.head.y = c.base - jump;
      c.body.y = c.base + 8 - jump * 0.8;
    }

    this.ledAlpha = Math.max(0, this.ledAlpha - dt * 1.2);
    const led = this.ledFlash.clear();
    if (this.ledAlpha > 0) {
      const pts = this.arena.outline.flatMap((p) => [p.x, p.y]);
      const on = Math.sin(t * 24) > 0 ? 1 : 0.5;
      led.poly(pts).stroke({ width: BOARD * 2, color: this.ledColor, alpha: this.ledAlpha * 0.55 * on });
    }

    this.fx.update(dt);
    this.shake.update(dt, reducedMotion);
    const targetZoom = curr.phase === "goal" ? 1.04 : 1;
    this.zoom = lerp(this.zoom, targetZoom, Math.min(1, dt * 3));
    this.resize(this.viewSize.w, this.viewSize.h);
    this.world.position.set(this.shake.x, this.shake.y);
    this.world.rotation = this.shake.rot;
  }

  private syncPickups(list: Pickup[], tick: number) {
    const ids = new Set(list.map((p) => p.id));
    for (const [id, v] of this.pickups)
      if (!ids.has(id)) {
        v.root.destroy({ children: true });
        this.pickups.delete(id);
      }
    for (const p of list) {
      let v = this.pickups.get(p.id);
      if (!v) {
        let tex = this.pickupTex.get(p.kind);
        if (!tex) this.pickupTex.set(p.kind, (tex = pickupTexture(p.kind)));
        const root = new Container();
        const glow = new Sprite(this.glowT);
        glow.anchor.set(0.5);
        glow.blendMode = "add";
        glow.tint = toNum(PICKUP_COLORS[p.kind]);
        const icon = new Sprite(tex);
        icon.anchor.set(0.5);
        const shadow = new Sprite(this.shadowT);
        shadow.anchor.set(0.5);
        shadow.scale.set(0.4, 0.4);
        shadow.y = 26;
        root.addChild(shadow, glow, icon);
        this.pickupLayer.addChild(root);
        v = { root, glow, icon, born: this.time };
        this.pickups.set(p.id, v);
      }
      const age = this.time - v.born;
      const pop = Math.min(1, age * 3);
      v.root.position.set(p.pos.x, p.pos.y);
      v.icon.y = -8 + Math.sin(this.time * 3 + p.id) * 5;
      v.icon.scale.set((0.25 * (pop < 1 ? pop * 1.2 : 1)) * (1 + Math.sin(this.time * 6) * 0.03));
      v.icon.rotation = Math.sin(this.time * 2 + p.id) * 0.15;
      v.glow.y = v.icon.y;
      v.glow.scale.set(0.9 + Math.sin(this.time * 4) * 0.15);
      v.glow.alpha = 0.55;
    }
    void tick;
  }

  private syncHazards(state: GameState) {
    const ids = new Set(state.hazards.map((h) => h.id));
    for (const [id, s] of this.hazards)
      if (!ids.has(id)) {
        s.destroy();
        this.hazards.delete(id);
      }
    for (const h of state.hazards) {
      if (this.hazards.has(h.id)) continue;
      const s = new Sprite(this.peelTex);
      s.anchor.set(0.5);
      s.scale.set(0.3);
      s.rotation = Math.random() * 6;
      s.position.set(h.pos.x, h.pos.y);
      this.hazardLayer.addChild(s);
      this.hazards.set(h.id, s);
    }
  }

  /** Tapahtumat efekteiksi ja ääniksi. */
  onEvents(events: GameEvent[], state: GameState) {
    const who = (id: number) => state.players.find((p) => p.id === id);
    for (const e of events) {
      switch (e.type) {
        case "kick": {
          const p = who(e.player);
          const col = p ? TEAM_NUM[p.team] : 0xffffff;
          sfx.kick(e.power, e.fire);
          this.fx.emit("spark", e.x, e.y, { count: 6 + Math.round(e.power * 10), color: [0xffffff, col], speed: [150, 420], size: [10, 22], life: [0.15, 0.35] });
          this.fx.emit("soft", e.x, e.y, { count: 5, color: 0xd9c8ff, speed: [20, 80], size: [20, 36], endSize: 60, life: [0.4, 0.7], layer: "under", alpha: 0.35 });
          this.shake.add(0.15 + e.power * 0.3 + (e.fire ? 0.5 : 0));
          if (e.fire) {
            this.fx.popup("FIREBALL!", e.x, e.y - 60, 0xff6a2e, 40);
            this.onHitstop?.(90);
          } else if (e.power > 0.95) this.fx.popup("BOOM!", e.x, e.y - 50, 0xffe14d, 30);
          break;
        }
        case "pass":
          sfx.pass();
          this.fx.emit("soft", e.x, e.y, { count: 3, color: 0xd9c8ff, speed: [10, 50], size: [14, 24], endSize: 40, life: [0.3, 0.5], layer: "under", alpha: 0.3 });
          break;
        case "grab":
          sfx.grab();
          break;
        case "save": {
          sfx.save();
          this.fx.popup("SAVE!", e.x, e.y - 50, 0x7fe8ff, 38);
          this.fx.emit("spark", e.x, e.y, { count: 14, color: [0xffffff, 0x7fe8ff], speed: [120, 380], size: [10, 20] });
          this.shake.add(0.3);
          break;
        }
        case "bounce":
          sfx.bounce(e.power);
          this.fx.emit("spark", e.x, e.y, { count: 5, color: 0xffffff, speed: [60, 220], size: [6, 14], life: [0.1, 0.25] });
          this.shake.add(Math.min(0.25, e.power / 4000));
          break;
        case "post":
          sfx.post();
          this.fx.popup("POST!", e.x, e.y - 40, 0xffffff, 34);
          this.fx.emit("spark", e.x, e.y, { count: 16, color: [0xffffff, 0xffe14d], speed: [150, 400], size: [8, 16] });
          this.shake.add(0.45);
          break;
        case "tackle":
          sfx.tackle();
          break;
        case "knock": {
          sfx.knock();
          this.fx.popup(KNOCK_WORDS[Math.floor(Math.random() * KNOCK_WORDS.length)], e.x, e.y - 55, 0xffe14d, 30);
          this.fx.emit("spark", e.x, e.y - 10, { count: 10, color: [0xffe14d, 0xffffff], speed: [120, 300], size: [10, 20], life: [0.2, 0.4] });
          this.shake.add(0.25);
          this.onHitstop?.(55);
          break;
        }
        case "slip":
          sfx.slip();
          this.fx.popup("WHEEE!", e.x, e.y - 55, 0xffe14d, 28);
          break;
        case "steal":
          sfx.steal();
          break;
        case "spawn":
          sfx.spawn();
          this.fx.emit("spark", e.x, e.y, { count: 12, color: toNum(PICKUP_COLORS[e.kind]), speed: [60, 200], size: [8, 16], life: [0.3, 0.6] });
          this.fx.emit("soft", e.x, e.y - 200, { count: 10, color: toNum(PICKUP_COLORS[e.kind]), speed: [300, 600], angle: Math.PI / 2, spread: 0.1, size: [12, 20], life: [0.2, 0.35] });
          break;
        case "pickup": {
          sfx.pickup();
          const col = toNum(PICKUP_COLORS[e.kind]);
          this.fx.popup(PICKUPS[e.kind].label + "!", e.x, e.y - 60, col, 32);
          this.fx.emit("spark", e.x, e.y, { count: 18, color: [col, 0xffffff], speed: [100, 340], size: [10, 20] });
          if (e.kind === "freeze")
            for (const p of state.players)
              if (p.team !== e.team) this.fx.emit("spark", p.pos.x, p.pos.y, { count: 10, color: [0xbff4ff, 0xffffff], speed: [60, 200], size: [8, 16] });
          break;
        }
        case "goal": {
          sfx.goal();
          const gx = e.team === 0 ? this.arena.halfWidth : -this.arena.halfWidth;
          const col = TEAM_NUM[e.team];
          for (const sy of [-1, 1])
            this.fx.emit("confetti", gx, sy * this.arena.goalHalfWidth, {
              count: 70,
              color: [col, 0xffffff, 0xffe14d],
              speed: [300, 900],
              angle: e.team === 0 ? Math.PI : 0,
              spread: 1.6,
              size: [8, 14],
              endSize: 8,
              life: [1.2, 2.2],
              drag: 2.2,
              gravity: 260,
              spin: 14,
            });
          this.fx.emit("soft", gx, 0, { count: 20, color: col, speed: [100, 500], size: [40, 80], endSize: 10, life: [0.4, 0.8] });
          this.shake.add(0.9);
          this.cheerTeam = e.team;
          this.cheerUntil = this.time + 3;
          this.ledColor = col;
          this.ledAlpha = 1.5;
          this.onHitstop?.(120);
          break;
        }
        case "whistle":
          sfx.whistle(e.kind !== "start");
          break;
        case "switch":
          break;
      }
    }
  }

  destroy() {
    this.root.destroy({ children: true });
  }
}
