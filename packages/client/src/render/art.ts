import { Texture } from "pixi.js";
import type { Arena, CharacterDef, PickupKind } from "@lanball/sim";

/**
 * Staattinen taide piirretään kerran Canvas 2D:llä (liukuvärit, varjot, hehku) ja käytetään Pixin tekstuureina.
 * Suunta [E] 29: kattoareena auringonlaskussa.
 */

export const VIEW_W = 1640;
export const VIEW_H = 1040;
export const BOARD = 30; // laitojen paksuus kentän reunan ulkopuolella

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

/** Pieni deterministinen satunnaisluku, jotta areena näyttää joka kerta samalta. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function outlinePath(ctx: CanvasRenderingContext2D, arena: Arena) {
  ctx.beginPath();
  arena.outline.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
}

function courtPath(ctx: CanvasRenderingContext2D, arena: Arena, grow = 0) {
  const w = arena.halfWidth + grow;
  const h = arena.halfHeight + grow;
  const r = arena.cornerRadius + grow;
  ctx.beginPath();
  ctx.roundRect(-w, -h, w * 2, h * 2, r);
}

export function arenaTexture(arena: Arena, scale: number): Texture {
  const [c, ctx] = canvas(VIEW_W * scale, VIEW_H * scale);
  ctx.setTransform(scale, 0, 0, scale, (VIEW_W / 2) * scale, (VIEW_H / 2) * scale);
  const rnd = seeded(7);
  const W = VIEW_W / 2;
  const H = VIEW_H / 2;
  const { halfWidth: w, halfHeight: h, goalHalfWidth: g, goalDepth: d } = arena;

  // Taivas ja aurinko
  const sky = ctx.createLinearGradient(0, -H, 0, H);
  sky.addColorStop(0, PALETTE.skyTop);
  sky.addColorStop(0.2, PALETTE.skyMid);
  sky.addColorStop(0.45, PALETTE.skyLow);
  sky.addColorStop(0.75, PALETTE.night);
  sky.addColorStop(1, "#140d24");
  ctx.fillStyle = sky;
  ctx.fillRect(-W, -H, VIEW_W, VIEW_H);
  const sun = ctx.createRadialGradient(-380, -500, 10, -380, -500, 260);
  sun.addColorStop(0, "rgba(255,236,160,1)");
  sun.addColorStop(0.25, "rgba(255,190,110,0.8)");
  sun.addColorStop(1, "rgba(255,120,90,0)");
  ctx.fillStyle = sun;
  ctx.fillRect(-W, -H, VIEW_W, 400);

  // Kaupungin siluetti yläreunassa
  for (const layer of [
    { col: "#6a2f6d", base: -452, hMin: 25, hMax: 70, alpha: 0.8 },
    { col: "#2c1a42", base: -438, hMin: 18, hMax: 58, alpha: 1 },
  ]) {
    let x = -W;
    while (x < W) {
      const bw = 26 + rnd() * 60;
      const bh = layer.hMin + rnd() * (layer.hMax - layer.hMin);
      ctx.globalAlpha = layer.alpha;
      ctx.fillStyle = layer.col;
      ctx.fillRect(x, layer.base - bh, bw - 3, bh + 20);
      if (layer.col === "#2c1a42") {
        ctx.fillStyle = "rgba(255,210,120,0.55)";
        for (let wy = layer.base - bh + 6; wy < layer.base - 4; wy += 9)
          for (let wx = x + 5; wx < x + bw - 8; wx += 8) if (rnd() < 0.3) ctx.fillRect(wx, wy, 3, 4);
      }
      x += bw;
    }
  }
  ctx.globalAlpha = 1;

  // Katsomot ylhäällä ja alhaalla
  for (const side of [-1, 1]) {
    const y0 = side < 0 ? -438 : h + BOARD + 18;
    const y1 = side < 0 ? -h - BOARD - 18 : H;
    const grad = ctx.createLinearGradient(0, y0, 0, y1);
    grad.addColorStop(0, side < 0 ? "#251838" : "#2a1b40");
    grad.addColorStop(1, side < 0 ? "#2f2046" : "#170f28");
    ctx.fillStyle = grad;
    ctx.fillRect(-W, Math.min(y0, y1), VIEW_W, Math.abs(y1 - y0));
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 2;
    for (let y = Math.min(y0, y1) + 10; y < Math.max(y0, y1); y += 14) {
      ctx.beginPath();
      ctx.moveTo(-W, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
  }

  // Valonheitinmastot kulmissa
  for (const sx of [-1, 1])
    for (const sy of [-1, 1]) {
      const x = sx * (w + 85);
      const y = sy * (h + 60);
      const cone = ctx.createRadialGradient(x, y, 0, x, y, 520);
      cone.addColorStop(0, "rgba(255,240,200,0.22)");
      cone.addColorStop(1, "rgba(255,240,200,0)");
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = cone;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.arc(x, y, 520, Math.atan2(-y, -x) - 0.45, Math.atan2(-y, -x) + 0.45);
      ctx.closePath();
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#1a1128";
      ctx.fillRect(x - 5, y - 4, 10, sy * 60);
      ctx.fillStyle = "#fff6d8";
      ctx.shadowColor = "#fff2c0";
      ctx.shadowBlur = 24;
      ctx.beginPath();
      ctx.roundRect(x - 18, y - 9, 36, 18, 4);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

  // Kentän ympäryspiha ja laidat
  courtPath(ctx, arena, BOARD + 16);
  ctx.fillStyle = "#231935";
  ctx.fill();
  ctx.lineJoin = "round";
  outlinePath(ctx, arena);
  ctx.lineWidth = BOARD * 2 + 8;
  ctx.strokeStyle = PALETTE.ink;
  ctx.stroke();
  const chrome = ctx.createLinearGradient(0, -h - BOARD, 0, h + BOARD);
  chrome.addColorStop(0, "#f2f5fa");
  chrome.addColorStop(0.08, "#9aa4b5");
  chrome.addColorStop(0.5, "#dfe5ee");
  chrome.addColorStop(0.92, "#8791a3");
  chrome.addColorStop(1, "#eef2f7");
  ctx.lineWidth = BOARD * 2;
  ctx.strokeStyle = chrome;
  ctx.stroke();
  // Niitit laidoissa
  ctx.fillStyle = "rgba(40,30,60,0.45)";
  for (let x = -w + 60; x <= w - 60; x += 46)
    for (const y of [-h - BOARD / 2, h + BOARD / 2]) {
      ctx.beginPath();
      ctx.arc(x, y, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
  // Mainosteksti laidoissa
  ctx.font = "15px Bungee";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(40,28,64,0.7)";
  const ads = ["LANBALL", "NO OFFSIDE", "BANANAS ARE LEGAL", "ROOFTOP CUP", "KEEP IT ROLLING"];
  for (const [y, flip] of [
    [-h - BOARD / 2, 0],
    [h + BOARD / 2, 1],
  ] as const)
    for (let i = 0, x = -w + 170; x < w - 150; x += 250, i++) ctx.fillText(ads[(i + flip * 2) % ads.length], x, y + 1);

  // Kenttä
  ctx.save();
  outlinePath(ctx, arena);
  ctx.clip();
  ctx.fillStyle = PALETTE.court;
  ctx.fillRect(-w - d, -h, (w + d) * 2, h * 2);
  const bands = 12;
  const bw = (w * 2) / bands;
  ctx.fillStyle = PALETTE.courtStripe;
  for (let i = 0; i < bands; i += 2) ctx.fillRect(-w + i * bw, -h, bw, h * 2);
  // Asfaltin rakeisuus
  for (let i = 0; i < 9000; i++) {
    ctx.fillStyle = rnd() < 0.5 ? "rgba(255,255,255,0.035)" : "rgba(0,0,0,0.06)";
    ctx.fillRect(-w - d + rnd() * (w + d) * 2, -h + rnd() * h * 2, 1.6, 1.6);
  }
  // Valokeilat
  ctx.globalCompositeOperation = "lighter";
  for (const [x, y, r, a] of [
    [0, 0, 560, 0.14],
    [-w * 0.55, -h * 0.4, 400, 0.09],
    [w * 0.55, h * 0.4, 400, 0.09],
    [-w * 0.55, h * 0.4, 400, 0.08],
    [w * 0.55, -h * 0.4, 400, 0.08],
  ]) {
    const pool = ctx.createRadialGradient(x, y, 0, x, y, r);
    pool.addColorStop(0, `rgba(255,214,170,${a})`);
    pool.addColorStop(1, "rgba(255,214,170,0)");
    ctx.fillStyle = pool;
    ctx.fillRect(-w - d, -h, (w + d) * 2, h * 2);
  }
  ctx.globalCompositeOperation = "source-over";
  // Maalialueiden joukkuesävy
  for (const [s, col] of [
    [-1, PALETTE.blaze],
    [1, PALETTE.frost],
  ] as const) {
    const gx = s * w;
    const tint = ctx.createRadialGradient(gx, 0, 20, gx, 0, 260);
    tint.addColorStop(0, col + "55");
    tint.addColorStop(1, col + "00");
    ctx.fillStyle = tint;
    ctx.fillRect(gx - 300, -300, 600, 600);
  }
  // Keskilogo
  ctx.font = "150px Bungee";
  ctx.fillStyle = "rgba(255,216,74,0.07)";
  ctx.fillText("LANBALL", 0, 8);
  // Reunan varjostus
  const vig = ctx.createRadialGradient(0, 0, h * 0.8, 0, 0, w * 1.15);
  vig.addColorStop(0, "rgba(10,5,20,0)");
  vig.addColorStop(1, "rgba(10,5,20,0.32)");
  ctx.fillStyle = vig;
  ctx.fillRect(-w - d, -h, (w + d) * 2, h * 2);
  ctx.restore();

  // Maalatut viivat
  ctx.strokeStyle = PALETTE.paint;
  ctx.fillStyle = PALETTE.paint;
  ctx.globalAlpha = 0.85;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(0, -h);
  ctx.lineTo(0, h);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, 95, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, 7, 0, Math.PI * 2);
  ctx.fill();
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * w, -g - 70);
    ctx.arcTo(s * (w - 160), -g - 70, s * (w - 160), 0, 70);
    ctx.arcTo(s * (w - 160), g + 70, s * w, g + 70, 70);
    ctx.lineTo(s * w, g + 70);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(s * (w - 110), 0, 5, 0, Math.PI * 2);
    ctx.fill();
    // Katkoviiva hyökkäysalueen merkiksi
    ctx.setLineDash([14, 14]);
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.moveTo(s * (w - 330), -h);
    ctx.lineTo(s * (w - 330), h);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.85;
  }
  ctx.globalAlpha = 1;

  // Maalit: tasku, verkko ja hehkuva kehys
  for (const [s, col] of [
    [-1, PALETTE.blaze],
    [1, PALETTE.frost],
  ] as const) {
    const x0 = s < 0 ? -w - d : w;
    ctx.fillStyle = "#130c20";
    ctx.fillRect(x0, -g, d, g * 2);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, -g, d, g * 2);
    ctx.clip();
    ctx.strokeStyle = "rgba(255,255,255,0.28)";
    ctx.lineWidth = 1.5;
    for (let k = -g * 2; k < g * 2 + d; k += 13) {
      ctx.beginPath();
      ctx.moveTo(x0 + k, -g);
      ctx.lineTo(x0 + k - g * 2, g);
      ctx.moveTo(x0 + k - g * 2, -g);
      ctx.lineTo(x0 + k, g);
      ctx.stroke();
    }
    ctx.restore();
    ctx.shadowColor = col;
    ctx.shadowBlur = 22;
    ctx.strokeStyle = col;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(s * w, -g);
    ctx.lineTo(s * (w + d), -g);
    ctx.lineTo(s * (w + d), g);
    ctx.lineTo(s * w, g);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#fff";
    for (const y of [-g, g]) {
      ctx.beginPath();
      ctx.arc(s * w, y, 7, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // LED-nauha laitojen sisäreunassa: vasen puolisko BLAZE, oikea FROST
  for (const [s, col] of [
    [-1, PALETTE.blaze],
    [1, PALETTE.frost],
  ] as const) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(s < 0 ? -W : 0, -H, W, VIEW_H);
    ctx.clip();
    outlinePath(ctx, arena);
    ctx.shadowColor = col;
    ctx.shadowBlur = 14;
    ctx.strokeStyle = col;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  }

  return Texture.from(c);
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
