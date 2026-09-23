import { Container, Sprite, Text, Texture } from "pixi.js";
import { confettiTex, softDot, sparkle, solidDot } from "./art.ts";

interface Particle {
  s: Sprite;
  vx: number;
  vy: number;
  life: number;
  max: number;
  drag: number;
  gravity: number;
  spin: number;
  scale0: number;
  scale1: number;
  alpha0: number;
  flutter: boolean;
}

interface Popup {
  t: Text;
  life: number;
  max: number;
  vy: number;
}

export type ParticleKind = "soft" | "dot" | "spark" | "confetti";

/** Kevyt partikkelijärjestelmä: sprite-pooli, ei allokointeja kuumassa silmukassa. */
export class Fx {
  readonly under = new Container(); // pölyt ja jäljet hahmojen alla
  readonly over = new Container(); // kipinät ja hehku hahmojen päällä (additiivinen)
  readonly text = new Container();
  private tex: Record<ParticleKind, Texture>;
  private live: Particle[] = [];
  private pool: Sprite[] = [];
  private popups: Popup[] = [];

  constructor() {
    this.tex = { soft: softDot(), dot: solidDot(), spark: sparkle(), confetti: confettiTex() };
    this.over.blendMode = "add";
  }

  emit(
    kind: ParticleKind,
    x: number,
    y: number,
    opts: {
      count?: number;
      speed?: [number, number];
      angle?: number;
      spread?: number;
      life?: [number, number];
      size?: [number, number];
      endSize?: number;
      color?: number | number[];
      drag?: number;
      gravity?: number;
      layer?: "under" | "over";
      alpha?: number;
      spin?: number;
    } = {},
  ) {
    const count = opts.count ?? 8;
    for (let i = 0; i < count; i++) {
      const s = this.pool.pop() ?? new Sprite();
      s.texture = this.tex[kind];
      s.anchor.set(0.5);
      const colors = opts.color ?? 0xffffff;
      s.tint = Array.isArray(colors) ? colors[Math.floor(Math.random() * colors.length)] : colors;
      s.blendMode = "normal";
      const a = (opts.angle ?? 0) + (Math.random() - 0.5) * (opts.spread ?? Math.PI * 2);
      const sp = (opts.speed?.[0] ?? 40) + Math.random() * ((opts.speed?.[1] ?? 160) - (opts.speed?.[0] ?? 40));
      const life = (opts.life?.[0] ?? 0.3) + Math.random() * ((opts.life?.[1] ?? 0.7) - (opts.life?.[0] ?? 0.3));
      const size = (opts.size?.[0] ?? 6) + Math.random() * ((opts.size?.[1] ?? 14) - (opts.size?.[0] ?? 6));
      const texW = s.texture.width || 32;
      s.position.set(x, y);
      s.rotation = Math.random() * Math.PI * 2;
      s.alpha = opts.alpha ?? 1;
      (opts.layer === "under" ? this.under : this.over).addChild(s);
      this.live.push({
        s,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life,
        max: life,
        drag: opts.drag ?? 3,
        gravity: opts.gravity ?? 0,
        spin: (Math.random() - 0.5) * (opts.spin ?? 4),
        scale0: size / texW,
        scale1: ((opts.endSize ?? size * 0.2) as number) / texW,
        alpha0: opts.alpha ?? 1,
        flutter: kind === "confetti",
      });
    }
  }

  popup(text: string, x: number, y: number, color: number, size = 34) {
    const t = new Text({
      text,
      style: {
        fontFamily: "Bungee",
        fontSize: size,
        fill: color,
        stroke: { color: 0x1c1430, width: size * 0.22, join: "round" },
        dropShadow: { color: 0x1c1430, distance: 4, angle: Math.PI / 2, blur: 0, alpha: 1 },
      },
    });
    t.anchor.set(0.5);
    t.position.set(x, y);
    t.rotation = (Math.random() - 0.5) * 0.25;
    this.text.addChild(t);
    this.popups.push({ t, life: 0.9, max: 0.9, vy: -70 });
  }

  update(dt: number) {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i];
      p.life -= dt;
      if (p.life <= 0) {
        p.s.removeFromParent();
        this.pool.push(p.s);
        this.live.splice(i, 1);
        continue;
      }
      const k = Math.exp(-p.drag * dt);
      p.vx *= k;
      p.vy = p.vy * k + p.gravity * dt;
      p.s.x += p.vx * dt;
      p.s.y += p.vy * dt;
      p.s.rotation += p.spin * dt;
      const t = 1 - p.life / p.max;
      const sc = p.scale0 + (p.scale1 - p.scale0) * t;
      p.s.scale.set(p.flutter ? sc * Math.abs(Math.cos(p.s.rotation * 2)) + 0.05 : sc, sc);
      p.s.alpha = p.alpha0 * Math.min(1, (p.life / p.max) * 2.5);
    }
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i];
      p.life -= dt;
      if (p.life <= 0) {
        p.t.destroy();
        this.popups.splice(i, 1);
        continue;
      }
      const t = 1 - p.life / p.max;
      const pop = t < 0.15 ? 0.4 + (t / 0.15) * 0.8 : t < 0.25 ? 1.2 - ((t - 0.15) / 0.1) * 0.2 : 1;
      p.t.scale.set(pop);
      p.t.y += p.vy * dt;
      p.vy *= Math.exp(-3 * dt);
      p.t.alpha = Math.min(1, p.life / 0.25);
    }
  }

  clear() {
    for (const p of this.live) {
      p.s.removeFromParent();
      this.pool.push(p.s);
    }
    this.live = [];
    for (const p of this.popups) p.t.destroy();
    this.popups = [];
  }
}

/** Trauma-malli: tärinä kasvaa iskuista ja vaimenee tasaisesti. */
export class Shake {
  trauma = 0;
  x = 0;
  y = 0;
  rot = 0;
  private t = 0;
  add(amount: number) {
    this.trauma = Math.min(1, this.trauma + amount);
  }
  update(dt: number, reduced: boolean) {
    this.t += dt;
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    const k = (reduced ? 0.3 : 1) * this.trauma * this.trauma;
    this.x = k * 22 * Math.sin(this.t * 71.3);
    this.y = k * 22 * Math.sin(this.t * 53.7 + 1.3);
    this.rot = k * 0.025 * Math.sin(this.t * 41.9 + 2.1);
  }
}
