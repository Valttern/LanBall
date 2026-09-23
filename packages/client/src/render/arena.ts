import { Container, Graphics, Sprite, Text, Texture, TilingSprite } from "pixi.js";
import type { Arena, Vec } from "@lanball/sim";
import { PALETTE, TEAM_NUM, toNum } from "./art.ts";

/**
 * Vino kuvakulma (päätös 32): maailman syvyyssuunta (y) litistetään kertoimella TILT ja korkeus (z)
 * nousee suoraan ylös ruudulla. Hahmot ja pallo piirretään pystyssä projisoituun kohtaan.
 */
export const TILT = 0.7;
export const WALL_H = 46;
export const GOAL_H = 44;
export const proj = (x: number, y: number, z = 0): Vec => ({ x, y: y * TILT - z });

const flat = (pts: Vec[], z = 0) => pts.flatMap((p) => [p.x, p.y * TILT - z]);

function noiseTexture(): Texture {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d")!;
  let s = 11;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 2600; i++) {
    ctx.fillStyle = rnd() < 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.08)";
    ctx.fillRect(rnd() * 256, rnd() * 256, 1.6, 1.6);
  }
  return Texture.from(c);
}

function radialTexture(inner: string, outer: string): Texture {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return Texture.from(c);
}

/** Pisteitä pitkin kaarta (maailman koordinaateissa). */
function arcPts(cx: number, cy: number, r: number, a0: number, a1: number, n = 24): Vec[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / n;
    return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
  });
}

export interface ArenaLayers {
  back: Container; // lattia, viivat, kaukaiset laidat, maalien takaosat
  front: Container; // lähin lasilaita ja maaliverkkojen katot pelaajien edessä
  posts: Container[]; // maalitolpat lajitellaan hahmojen kanssa syvyyden mukaan
  ledFlash: Graphics; // maalin jälkeinen välähdys laidoissa
  ads: Text[];
  bounds: { minX: number; maxX: number; minY: number; maxY: number }; // kameran rajat ruudun koordinaateissa
}

export function buildArena(arena: Arena): ArenaLayers {
  const { halfWidth: w, halfHeight: h, goalHalfWidth: g, goalDepth: d, outline } = arena;
  const back = new Container();
  const front = new Container();

  // Piha laitojen ulkopuolella
  const apronTop = -h * TILT - WALL_H;
  const apron = new Graphics().rect(-w - d - 400, apronTop, (w + d + 400) * 2, (h + 80) * TILT - apronTop).fill(0x241a38);
  back.addChild(apron);

  // Lattia: väri, raidat, rakeisuus, valokeilat ja reunojen varjostus – kaikki kentän muotoon rajattuna.
  const floorShape = flat(outline);
  const floor = new Container();
  const base = new Graphics().poly(floorShape).fill(toNum(PALETTE.court));
  const stripes = new Graphics();
  const bands = 16;
  const bw = (w * 2) / bands;
  for (let i = 0; i < bands; i += 2) stripes.rect(-w + i * bw, -h * TILT, bw, h * 2 * TILT);
  stripes.fill(toNum(PALETTE.courtStripe));
  const grain = new TilingSprite({ texture: noiseTexture(), width: (w + d) * 2, height: h * 2 * TILT });
  grain.position.set(-w - d, -h * TILT);
  const pools = new Container();
  const warm = radialTexture("rgba(255,214,170,0.22)", "rgba(255,214,170,0)");
  for (const [x, y, r] of [
    [0, 0, 900],
    [-w * 0.6, -h * 0.4, 700],
    [w * 0.6, h * 0.4, 700],
    [-w * 0.6, h * 0.45, 650],
    [w * 0.6, -h * 0.45, 650],
  ]) {
    const s = new Sprite(warm);
    s.anchor.set(0.5);
    s.position.set(x, y * TILT);
    s.width = r * 2;
    s.height = r * 2 * TILT;
    s.blendMode = "add";
    pools.addChild(s);
  }
  for (const [sx, col] of [
    [-1, TEAM_NUM[0]],
    [1, TEAM_NUM[1]],
  ]) {
    const tint = new Sprite(radialTexture("rgba(255,255,255,0.35)", "rgba(255,255,255,0)"));
    tint.tint = col;
    tint.anchor.set(0.5);
    tint.position.set(sx * w, 0);
    tint.width = 700;
    tint.height = 700 * TILT;
    pools.addChild(tint);
  }
  const vignette = new Sprite(radialTexture("rgba(10,5,20,0)", "rgba(10,5,20,0.45)"));
  vignette.anchor.set(0.5);
  vignette.width = w * 2.6;
  vignette.height = h * 2.6 * TILT;
  const logo = new Text({ text: "LANBALL", style: { fontFamily: "Bungee", fontSize: 260, fill: toNum(PALETTE.paint) } });
  logo.anchor.set(0.5);
  logo.scale.y = TILT;
  logo.alpha = 0.07;
  const mask = new Graphics().poly(floorShape).fill(0xffffff);
  floor.addChild(base, stripes, grain, pools, vignette, logo, mask);
  for (const x of [stripes, grain, pools, vignette, logo]) x.mask = mask;
  back.addChild(floor);

  // Maalatut viivat
  const lines = new Graphics();
  const paint = { width: 6, color: toNum(PALETTE.paint), alpha: 0.85 };
  lines.moveTo(0, -h * TILT).lineTo(0, h * TILT).stroke(paint);
  lines.poly(flat(arcPts(0, 0, 130, 0, Math.PI * 2, 48))).stroke(paint);
  lines.ellipse(0, 0, 9, 9 * TILT).fill(toNum(PALETTE.paint));
  for (const s of [-1, 1]) {
    // Kaukalon tapaan: puoliympyrän muotoinen maalialue ja pieni joukkueen värinen maalivahdin alue.
    const a0 = s < 0 ? -Math.PI / 2 : Math.PI / 2;
    lines.poly(flat(arcPts(s * w, 0, 260, a0, a0 + Math.PI, 28)), false).stroke(paint);
    lines.poly([...flat(arcPts(s * w, 0, 92, a0, a0 + Math.PI, 16))]).fill({ color: TEAM_NUM[s < 0 ? 0 : 1], alpha: 0.22 });
    lines.poly(flat(arcPts(s * w, 0, 92, a0, a0 + Math.PI, 16)), false).stroke({ width: 4, color: toNum(PALETTE.paint), alpha: 0.85 });
    lines.ellipse(s * (w - 330), 0, 8, 8 * TILT).fill(toNum(PALETTE.paint));
    // Katkoviiva hyökkäysalueen merkiksi
    for (let y = -h; y < h; y += 44) lines.moveTo(s * (w - 560), y * TILT).lineTo(s * (w - 560), (y + 22) * TILT);
    lines.stroke({ width: 5, color: toNum(PALETTE.paint), alpha: 0.35 });
  }
  back.addChild(lines);

  // Maalit: tasku, takaverkko ja sivuverkot. Tolpat erikseen syvyyslajittelua varten.
  const posts: Container[] = [];
  for (const [s, col] of [
    [-1, TEAM_NUM[0]],
    [1, TEAM_NUM[1]],
  ] as const) {
    const gx = s * w;
    const bx = s * (w + d);
    const net = new Graphics();
    net.poly([gx, -g * TILT, bx, -g * TILT, bx, g * TILT, gx, g * TILT]).fill(0x140d22);
    // Takaverkko pystypintana
    net.poly([bx, -g * TILT, bx, -g * TILT - GOAL_H, bx, g * TILT - GOAL_H, bx, g * TILT]).fill({ color: 0xffffff, alpha: 0.06 });
    for (let y = -g; y <= g; y += 14) net.moveTo(bx, y * TILT).lineTo(bx, y * TILT - GOAL_H);
    for (let z = 0; z <= GOAL_H; z += 11) net.moveTo(bx, -g * TILT - z).lineTo(bx, g * TILT - z);
    // Kaukainen sivuverkko
    for (let x = 0; x <= d; x += 14) net.moveTo(gx + s * x, -g * TILT).lineTo(gx + s * x, -g * TILT - GOAL_H);
    net.moveTo(gx, -g * TILT - GOAL_H).lineTo(bx, -g * TILT - GOAL_H);
    net.stroke({ width: 1.5, color: 0xffffff, alpha: 0.3 });
    back.addChild(net);

    // Verkon katto ja lähin sivuverkko pelaajien edessä, läpikuultavana
    const roof = new Graphics();
    roof.poly([gx, -g * TILT - GOAL_H, bx, -g * TILT - GOAL_H, bx, g * TILT - GOAL_H, gx, g * TILT - GOAL_H]).fill({ color: 0xffffff, alpha: 0.05 });
    for (let y = -g; y <= g; y += 16) roof.moveTo(gx, y * TILT - GOAL_H).lineTo(bx, y * TILT - GOAL_H);
    for (let x = 0; x <= d; x += 14) roof.moveTo(gx + s * x, -g * TILT - GOAL_H).lineTo(gx + s * x, g * TILT - GOAL_H);
    for (let x = 0; x <= d; x += 14) roof.moveTo(gx + s * x, g * TILT).lineTo(gx + s * x, g * TILT - GOAL_H);
    roof.stroke({ width: 1.2, color: 0xffffff, alpha: 0.28 });
    front.addChild(roof);

    for (const py of [-g, g]) {
      const post = new Container();
      const pg = new Graphics();
      pg.moveTo(0, 0).lineTo(0, -GOAL_H).stroke({ width: 9, color: 0x1c1430 });
      pg.moveTo(0, 0).lineTo(0, -GOAL_H).stroke({ width: 5, color: 0xffffff });
      if (py > 0) {
        // Ylärima kulkee lähimmästä tolpasta kaukaisempaan.
        pg.moveTo(0, -GOAL_H).lineTo(0, -2 * g * TILT - GOAL_H).stroke({ width: 9, color: 0x1c1430 });
        pg.moveTo(0, -GOAL_H).lineTo(0, -2 * g * TILT - GOAL_H).stroke({ width: 5, color: col });
      }
      post.addChild(pg);
      post.position.set(gx, py * TILT);
      post.zIndex = py * TILT;
      posts.push(post);
    }
  }

  // Laidat: kaukaiset seinäpinnat taakse, lähin lasilaita eteen.
  const walls = new Graphics();
  const glass = new Graphics();
  const railBack = new Graphics();
  const railFront = new Graphics();
  const backRail: [Vec, Vec][] = [];
  const frontRail: [Vec, Vec][] = [];
  const boards = new Graphics(); // laitojen paksuus ulospäin
  const ledBack = new Graphics();
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i];
    const b = outline[(i + 1) % outline.length];
    // Sisäänpäin osoittava normaali (reunaviiva kulkee myötäpäivään)
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const ny = (b.x - a.x) / len;
    const quad = [a.x, a.y * TILT, b.x, b.y * TILT, b.x, b.y * TILT - WALL_H, a.x, a.y * TILT - WALL_H];
    const inGoal = Math.abs(a.x) > w + 1 || Math.abs(b.x) > w + 1;
    if (inGoal) continue;
    if (ny > 0.02) {
      const shade = 0.55 + ny * 0.45;
      const c = Math.round(0xd4 * shade) * 0x10000 + Math.round(0xdb * shade) * 0x100 + Math.round(0xe6 * shade);
      walls.poly(quad).fill(c);
      backRail.push([a, b]);
      ledBack.moveTo(a.x, a.y * TILT - 3).lineTo(b.x, b.y * TILT - 3).stroke({ width: 4, color: (a.x + b.x) / 2 < 0 ? TEAM_NUM[0] : TEAM_NUM[1] });
    } else if (ny < -0.02) {
      glass.poly(quad).fill({ color: 0xbfe8ff, alpha: 0.2 });
      frontRail.push([a, b]);
    } else {
      backRail.push([a, b]);
      // Sivulaita: paksu kromilevy ulospäin, jotta laita näkyy myös suoraan sivulta.
      const out = Math.sign(a.x) * 22;
      boards.poly([a.x, a.y * TILT - WALL_H, b.x, b.y * TILT - WALL_H, b.x + out, b.y * TILT, a.x + out, a.y * TILT]).fill(0xaab3c3);
      boards.poly([a.x + out, a.y * TILT, b.x + out, b.y * TILT, b.x + out, b.y * TILT + 10, a.x + out, a.y * TILT + 10]).fill(0x5d667a);
    }
  }
  // Laitojen alareunan tumma raja lattiaa vasten
  const baseLine = new Graphics().poly(floorShape).stroke({ width: 4, color: 0x1c1430, alpha: 0.7 });
  const rail = (g: Graphics, segs: [Vec, Vec][], width: number, color: number, alpha = 1) => {
    for (const [a, b] of segs) g.moveTo(a.x, a.y * TILT - WALL_H).lineTo(b.x, b.y * TILT - WALL_H);
    g.stroke({ width, color, alpha, cap: "round", join: "round" });
  };
  rail(railBack, backRail, 9, 0x1c1430);
  rail(railBack, backRail, 5, 0xf4f7fb);
  rail(railFront, frontRail, 9, 0x1c1430, 0.85);
  rail(railFront, frontRail, 5, 0xf4f7fb, 0.95);
  for (const [a, b] of frontRail) glass.moveTo(a.x, a.y * TILT - WALL_H + 7).lineTo(b.x, b.y * TILT - WALL_H + 7);
  glass.stroke({ width: 2, color: 0xffffff, alpha: 0.35 });
  back.addChild(boards, baseLine, walls, ledBack, railBack);

  // Mainostaulut kaukaisen laidan pinnassa
  const ads: Text[] = [];
  const adsText = ["LANBALL", "NO OFFSIDE", "BANANAS ARE LEGAL", "ROOFTOP CUP", "KEEP IT ROLLING", "BRING SNACKS"];
  const straight = w - arena.cornerRadius;
  for (let i = 0, x = -straight + 170; x < straight - 120; x += 330, i++) {
    const t = new Text({ text: adsText[i % adsText.length], style: { fontFamily: "Bungee", fontSize: 22, fill: 0x2a1c44 } });
    t.anchor.set(0.5);
    t.position.set(x, -h * TILT - WALL_H / 2 + 1);
    t.alpha = 0.8;
    back.addChild(t);
    ads.push(t);
  }

  front.addChild(glass, railFront);
  const ledFlash = new Graphics();
  back.addChild(ledFlash);

  const bounds = {
    minX: -w - d - 120,
    maxX: w + d + 120,
    minY: -h * TILT - WALL_H - 260,
    maxY: h * TILT + 140,
  };
  return { back, front, posts, ledFlash, ads, bounds };
}

/** Maalin jälkeen laitojen yläreuna vilkkuu maalin tehneen joukkueen värissä. */
export function drawLedFlash(g: Graphics, arena: Arena, color: number, alpha: number) {
  g.clear();
  if (alpha <= 0) return;
  const w = arena.halfWidth;
  const top = arena.outline.filter((p) => p.y < 0 && Math.abs(p.x) <= w);
  g.moveTo(top[0].x, top[0].y * TILT - WALL_H);
  for (const p of top.slice(1)) g.lineTo(p.x, p.y * TILT - WALL_H);
  g.stroke({ width: 14, color, alpha });
  g.rect(-w + arena.cornerRadius, -arena.halfHeight * TILT - WALL_H, (w - arena.cornerRadius) * 2, WALL_H).fill({ color, alpha: alpha * 0.4 });
}
