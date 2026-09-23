import { Texture } from "pixi.js";
import type { CharacterDef, PickupKind } from "@lanball/sim";

/**
 * Staattinen taide piirretään kerran Canvas 2D:llä (liukuvärit, varjot, hehku) ja käytetään Pixin tekstuureina.
 * Suunta [E] 29: kattoareena auringonlaskussa.
 */


export const PALETTE = {
  skyTop: "#ff8a5b",
  skyMid: "#d14d7c",
  skyLow: "#5a2a6e",
  night: "#1d1432",
  court: "#4e3874",
  courtStripe: "#58407f",
  paint: "#ffd84a",
  blaze: "#ff5a36",
  frost: "#3cc8ff",
  chrome: "#c9d1dd",
  ink: "#1c1430",
  cream: "#fff4e0",
};
export const TEAM_HEX = [PALETTE.blaze, PALETTE.frost];
export const TEAM_NUM = [0xff5a36, 0x3cc8ff];
export const TEAM_NAMES = ["BLAZE", "FROST"];

export const PICKUP_COLORS: Record<PickupKind, string> = {
  turbo: "#ffb020",
  giant: "#6be675",
  magnet: "#c77dff",
  mega: "#ff4f2e",
  freeze: "#7fe8ff",
  banana: "#ffe14d",
};

const hexNum = (hex: string) => parseInt(hex.slice(1), 16);
export const toNum = hexNum;

function shade(hex: string, amt: number): string {
  const n = hexNum(hex);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt)));
  const r = f(n >> 16);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return `rgb(${r},${g},${b})`;
}
const numHex = (n: number) => "#" + n.toString(16).padStart(6, "0");

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = Math.ceil(w);
  c.height = Math.ceil(h);
  return [c, c.getContext("2d")!] as const;
}

/** Pehmeä pyöreä valo partikkeleille ja varjoille. */
export function softDot(size = 64): Texture {
  const [c, ctx] = canvas(size, size);
  const r = size / 2;
  const grad = ctx.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.4, "rgba(255,255,255,0.6)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return Texture.from(c);
}

export function solidDot(size = 32): Texture {
  const [c, ctx] = canvas(size, size);
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
  ctx.fill();
  return Texture.from(c);
}

export function sparkle(size = 64): Texture {
  const [c, ctx] = canvas(size, size);
  const r = size / 2;
  ctx.translate(r, r);
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const len = i % 2 === 0 ? r : r * 0.22;
    ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len);
  }
  ctx.closePath();
  ctx.fill();
  return Texture.from(c);
}

export function confettiTex(): Texture {
  const [c, ctx] = canvas(12, 20);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, 12, 20);
  return Texture.from(c);
}

export function shadowTex(): Texture {
  const [c, ctx] = canvas(128, 64);
  const grad = ctx.createRadialGradient(64, 32, 0, 64, 32, 64);
  grad.addColorStop(0, "rgba(0,0,0,0.55)");
  grad.addColorStop(0.6, "rgba(0,0,0,0.3)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.setTransform(1, 0, 0, 0.5, 0, 16);
  ctx.fillStyle = grad;
  ctx.fillRect(0, -32, 128, 128);
  return Texture.from(c);
}

// ---------- Hahmot ----------

export const CHAR_SCALE = 4; // tekstuurin pikseliä maailman yksikköä kohti
export const CHAR_R = 26;
const CHAR_SIZE = 64; // maailman yksikköä, tekstuurin leveys ja korkeus
export const HEAD_Y = -0.62 * CHAR_R;

/** Hahmon runko: joukkueen paita, pää ja hattu. Silmät ja jalat piirretään erikseen, koska ne liikkuvat. */
export function characterTexture(def: CharacterDef, team: number): Texture {
  const S = CHAR_SCALE;
  const [c, ctx] = canvas(CHAR_SIZE * S, CHAR_SIZE * S);
  ctx.setTransform(S, 0, 0, S, (CHAR_SIZE / 2) * S, (CHAR_SIZE / 2 + 6) * S);
  const R = CHAR_R;
  const jersey = TEAM_HEX[team];
  const skin = numHex(def.look.body);
  const accent = numHex(def.look.accent);
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineJoin = "round";

  // Paita
  const body = ctx.createRadialGradient(-R * 0.35, -R * 0.35, R * 0.1, 0, 0, R * 1.1);
  body.addColorStop(0, shade(jersey, 0.35));
  body.addColorStop(0.55, jersey);
  body.addColorStop(1, shade(jersey, -0.45));
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Raita ja kaulus
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, R - 1.2, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = "rgba(255,255,255,0.28)";
  ctx.beginPath();
  ctx.moveTo(-R, R * 0.2);
  ctx.lineTo(R, -R * 0.35);
  ctx.lineTo(R, -R * 0.05);
  ctx.lineTo(-R, R * 0.5);
  ctx.fill();
  ctx.fillStyle = accent;
  ctx.fillRect(-R, R * 0.62, R * 2, R * 0.2);
  ctx.restore();

  if (def.id === "keeper") {
    // Hanskat
    for (const sx of [-1, 1]) {
      ctx.fillStyle = "#ffe14d";
      ctx.beginPath();
      ctx.arc(sx * R * 0.98, R * 0.15, R * 0.34, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  // Pää
  const hr = R * 0.68;
  const hy = HEAD_Y;
  const head = ctx.createRadialGradient(-hr * 0.35, hy - hr * 0.4, hr * 0.1, 0, hy, hr * 1.1);
  head.addColorStop(0, shade(skin, 0.4));
  head.addColorStop(0.6, skin);
  head.addColorStop(1, shade(skin, -0.35));
  ctx.fillStyle = head;
  ctx.beginPath();
  ctx.arc(0, hy, hr, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Hattu tai kampaus
  ctx.fillStyle = accent;
  switch (def.look.hat) {
    case "helmet": {
      ctx.fillStyle = "#8f96a8";
      ctx.beginPath();
      ctx.arc(0, hy, hr + 1.5, Math.PI * 1.02, Math.PI * 1.98);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = accent;
      ctx.fillRect(-2.5, hy - hr - 1.5, 5, hr * 0.9);
      ctx.strokeRect(-2.5, hy - hr - 1.5, 5, hr * 0.9);
      break;
    }
    case "band": {
      ctx.fillStyle = "#2b1d10";
      for (let i = -3; i <= 3; i++) {
        ctx.beginPath();
        ctx.moveTo(i * 4 - 4, hy - hr * 0.6);
        ctx.lineTo(i * 4 + i * 1.5, hy - hr - 7);
        ctx.lineTo(i * 4 + 4, hy - hr * 0.6);
        ctx.fill();
      }
      ctx.fillStyle = accent;
      ctx.fillRect(-hr, hy - hr * 0.55, hr * 2, 5);
      ctx.strokeRect(-hr, hy - hr * 0.55, hr * 2, 5);
      break;
    }
    case "mohawk": {
      ctx.beginPath();
      ctx.moveTo(-4, hy - hr + 3);
      for (let i = 0; i < 5; i++) ctx.lineTo(-4 + i * 2, hy - hr - 12 + (i % 2) * 5);
      ctx.lineTo(5, hy - hr + 3);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }
    case "antenna": {
      for (const sx of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(sx * 5, hy - hr + 2);
        ctx.quadraticCurveTo(sx * 12, hy - hr - 10, sx * 9, hy - hr - 16);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(sx * 9, hy - hr - 16, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      break;
    }
    case "visor": {
      ctx.fillStyle = "#39465a";
      ctx.beginPath();
      ctx.roundRect(-hr - 1, hy - hr * 0.62, hr * 2 + 2, 7, 3);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = accent;
      ctx.shadowColor = accent;
      ctx.shadowBlur = 6;
      ctx.fillRect(-hr + 3, hy - hr * 0.62 + 2, hr * 2 - 6, 3);
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.moveTo(0, hy - hr);
      ctx.lineTo(0, hy - hr - 9);
      ctx.stroke();
      ctx.fillStyle = "#ff3b3b";
      ctx.beginPath();
      ctx.arc(0, hy - hr - 10, 2.6, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "duck": {
      ctx.beginPath();
      ctx.ellipse(0, hy + hr * 0.42, hr * 0.55, hr * 0.26, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = shade(skin, -0.1);
      ctx.beginPath();
      ctx.moveTo(-2, hy - hr + 1);
      ctx.quadraticCurveTo(2, hy - hr - 10, 7, hy - hr - 6);
      ctx.quadraticCurveTo(3, hy - hr - 3, 3, hy - hr + 1);
      ctx.fill();
      ctx.stroke();
      break;
    }
    case "cap": {
      ctx.fillStyle = jersey;
      ctx.beginPath();
      ctx.arc(0, hy, hr + 1, Math.PI * 1.05, Math.PI * 1.95);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = shade(jersey, -0.3);
      ctx.beginPath();
      ctx.ellipse(0, hy - hr * 0.35, hr * 0.95, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      break;
    }
  }
  return Texture.from(c);
}

export const CHAR_TEX_ANCHOR = { x: 0.5, y: (CHAR_SIZE / 2 + 6) / CHAR_SIZE };
export const CHAR_TEX_WORLD = CHAR_SIZE;

// ---------- Pallo ----------

export function ballTexture(r: number): Texture {
  const S = 4;
  const size = (r * 2 + 4) * S;
  const [c, ctx] = canvas(size, size);
  ctx.setTransform(S, 0, 0, S, size / 2, size / 2);
  const g = ctx.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.1, 0, 0, r);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(0.7, "#e9e4f2");
  g.addColorStop(1, "#a79fba");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = "#231d33";
  const pent = (cx: number, cy: number, s: number, rot: number) => {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = rot + (i * Math.PI * 2) / 5;
      ctx.lineTo(cx + Math.cos(a) * s, cy + Math.sin(a) * s);
    }
    ctx.fill();
  };
  pent(0, 0, r * 0.36, -Math.PI / 2);
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / 5 + Math.PI / 5;
    pent(Math.cos(a) * r * 0.95, Math.sin(a) * r * 0.95, r * 0.3, a);
  }
  ctx.restore();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = PALETTE.ink;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();
  return Texture.from(c);
}

// ---------- Powerupit ----------

function drawIcon(ctx: CanvasRenderingContext2D, kind: PickupKind, s: number) {
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = s * 0.08;
  ctx.lineJoin = "round";
  ctx.beginPath();
  switch (kind) {
    case "turbo":
      ctx.moveTo(s * 0.1, -s * 0.6);
      ctx.lineTo(-s * 0.35, s * 0.08);
      ctx.lineTo(-s * 0.02, s * 0.08);
      ctx.lineTo(-s * 0.12, s * 0.6);
      ctx.lineTo(s * 0.35, -s * 0.1);
      ctx.lineTo(s * 0.02, -s * 0.1);
      ctx.closePath();
      break;
    case "giant":
      ctx.moveTo(0, -s * 0.6);
      ctx.lineTo(s * 0.45, -s * 0.05);
      ctx.lineTo(s * 0.18, -s * 0.05);
      ctx.lineTo(s * 0.18, s * 0.55);
      ctx.lineTo(-s * 0.18, s * 0.55);
      ctx.lineTo(-s * 0.18, -s * 0.05);
      ctx.lineTo(-s * 0.45, -s * 0.05);
      ctx.closePath();
      break;
    case "magnet":
      ctx.lineWidth = s * 0.22;
      ctx.strokeStyle = "#fff";
      ctx.arc(0, 0, s * 0.32, Math.PI * 0.05, Math.PI * 0.95);
      ctx.moveTo(-s * 0.32, 0);
      ctx.lineTo(-s * 0.32, -s * 0.45);
      ctx.moveTo(s * 0.32, 0);
      ctx.lineTo(s * 0.32, -s * 0.45);
      ctx.stroke();
      return;
    case "mega":
      ctx.moveTo(0, -s * 0.62);
      ctx.bezierCurveTo(s * 0.55, -s * 0.1, s * 0.45, s * 0.55, 0, s * 0.55);
      ctx.bezierCurveTo(-s * 0.45, s * 0.55, -s * 0.55, 0, -s * 0.15, -s * 0.25);
      ctx.bezierCurveTo(-s * 0.1, 0, s * 0.05, -s * 0.2, 0, -s * 0.62);
      break;
    case "freeze":
      ctx.lineWidth = s * 0.1;
      ctx.strokeStyle = "#fff";
      for (let i = 0; i < 3; i++) {
        const a = (i * Math.PI) / 3;
        ctx.moveTo(Math.cos(a) * s * 0.55, Math.sin(a) * s * 0.55);
        ctx.lineTo(-Math.cos(a) * s * 0.55, -Math.sin(a) * s * 0.55);
      }
      ctx.stroke();
      return;
    case "banana":
      ctx.moveTo(-s * 0.5, -s * 0.25);
      ctx.quadraticCurveTo(-s * 0.2, s * 0.6, s * 0.5, -s * 0.2);
      ctx.quadraticCurveTo(-s * 0.05, s * 0.25, -s * 0.5, -s * 0.25);
      break;
  }
  ctx.fill();
  ctx.stroke();
}

export function pickupTexture(kind: PickupKind): Texture {
  const S = 4;
  const R = 24;
  const size = (R * 2 + 16) * S;
  const [c, ctx] = canvas(size, size);
  ctx.setTransform(S, 0, 0, S, size / 2, size / 2);
  const col = PICKUP_COLORS[kind];
  ctx.shadowColor = col;
  ctx.shadowBlur = 14;
  const g = ctx.createRadialGradient(-R * 0.3, -R * 0.35, 2, 0, 0, R);
  g.addColorStop(0, shade(col, 0.55));
  g.addColorStop(0.65, col);
  g.addColorStop(1, shade(col, -0.4));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = PALETTE.ink;
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(255,255,255,0.6)";
  ctx.beginPath();
  ctx.arc(0, 0, R - 4, Math.PI * 1.1, Math.PI * 1.6);
  ctx.stroke();
  drawIcon(ctx, kind, R * 1.2);
  return Texture.from(c);
}

export function bananaPeelTexture(): Texture {
  const S = 4;
  const [c, ctx] = canvas(40 * S, 40 * S);
  ctx.setTransform(S, 0, 0, S, 20 * S, 20 * S);
  ctx.fillStyle = "#ffe14d";
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = 1.8;
  for (let i = 0; i < 4; i++) {
    ctx.save();
    ctx.rotate((i * Math.PI) / 2 + 0.4);
    ctx.beginPath();
    ctx.ellipse(0, -8, 4.5, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  ctx.fillStyle = "#6b4a1f";
  ctx.beginPath();
  ctx.arc(0, 0, 3, 0, Math.PI * 2);
  ctx.fill();
  return Texture.from(c);
}

/** Portretti aulaan (data-URL). */
export function portraitDataUrl(tex: Texture): string {
  const src = tex.source.resource as HTMLCanvasElement;
  return src.toDataURL();
}
