import { Container, Graphics, Sprite, Text, Texture, TilingSprite } from "pixi.js";
import type { Arena, Vec } from "@lanball/sim";
import { PALETTE, TEAM_NUM, toNum } from "./art.ts";
import { TILT, dirToScreen, orientation, toScreen } from "./orientation.ts";

/**
 * Areena vektoreina vinossa kuvakulmassa (päätökset 32–33). Kaikki pisteet kulkevat toScreen():n kautta,
 * joten sama koodi piirtää kentän vaaka- tai pystysuuntaan. Pinnan puoli (kaukainen seinä, lähin lasi,
 * sivulaita) päätellään siitä, mihin suuntaan sen normaali osoittaa ruudulla.
 */
export const WALL_H = 46;
export const GOAL_H = 44;

const S = (x: number, y: number, z = 0) => toScreen(x, y, z);
const flat = (pts: Vec[], z = 0) =>
  pts.flatMap((p) => {
    const s = S(p.x, p.y, z);
    return [s.x, s.y];
  });

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

const radialCache = new Map<string, Texture>();
export function radialTexture(inner: string, outer: string): Texture {
  const key = inner + outer;
  const hit = radialCache.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const t = Texture.from(c);
  radialCache.set(key, t);
  return t;
}

/** Pisteitä pitkin kaarta (maailman koordinaateissa). */
function arcPts(cx: number, cy: number, r: number, a0: number, a1: number, n = 24): Vec[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / n;
    return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
  });
}

export interface Box {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface ArenaLayers {
  back: Container; // lattia, viivat, kaukaiset seinät, maalien takaosat
  front: Container; // lähin lasilaita ja maaliverkot pelaajien edessä
  posts: Container[]; // maalitolpat lajitellaan hahmojen kanssa syvyyden mukaan
  ledFlash: Graphics;
  ledFaces: [Vec, Vec][];
  ads: Text[];
  rink: Box; // kentän reunaviivan laatikko ruudun koordinaateissa (lattiataso)
  farTop: number; // kaukaisen seinän yläreuna ruudulla
  bounds: Box; // kameran rajat
  goalScreen: [Vec, Vec]; // joukkueiden 0 ja 1 omien maalien keskikohdat ruudulla
}

export function buildArena(arena: Arena): ArenaLayers {
  const { halfWidth: w, halfHeight: h, goalHalfWidth: g, goalDepth: d, outline } = arena;
  const back = new Container();
  const front = new Container();
  const pts = outline.map((p) => S(p.x, p.y));
  const rink: Box = {
    minX: Math.min(...pts.map((p) => p.x)),
    maxX: Math.max(...pts.map((p) => p.x)),
    minY: Math.min(...pts.map((p) => p.y)),
    maxY: Math.max(...pts.map((p) => p.y)),
  };
  const farTop = rink.minY - WALL_H;

  // Piha laitojen ympärillä
  back.addChild(
    new Graphics().roundRect(rink.minX - 60, farTop - 6, rink.maxX - rink.minX + 120, rink.maxY - farTop + 70, 60).fill(0x241a38),
  );

  // Lattia: väri, raidat, rakeisuus, valokeilat, reunojen varjostus ja logo, rajattuna kentän muotoon.
  const floorShape = flat(outline);
  const floor = new Container();
  const base = new Graphics().poly(floorShape).fill(toNum(PALETTE.court));
  const stripes = new Graphics();
  const bands = 16;
  const bw = (w * 2) / bands;
  for (let i = 0; i < bands; i += 2) {
    const x0 = -w + i * bw;
    stripes.poly(
      flat([
        { x: x0, y: -h },
        { x: x0 + bw, y: -h },
        { x: x0 + bw, y: h },
        { x: x0, y: h },
      ]),
    );
  }
  stripes.fill(toNum(PALETTE.courtStripe));
  const grain = new TilingSprite({ texture: noiseTexture(), width: rink.maxX - rink.minX + 200, height: rink.maxY - rink.minY + 200 });
  grain.position.set(rink.minX - 100, rink.minY - 100);
  const pools = new Container();
  const warm = radialTexture("rgba(255,214,170,0.22)", "rgba(255,214,170,0)");
  const pool = (x: number, y: number, r: number, tex: Texture, tint?: number, add = true) => {
    const s = new Sprite(tex);
    s.anchor.set(0.5);
    const at = S(x, y);
    s.position.set(at.x, at.y);
    s.width = r * 2;
    s.height = r * 2 * TILT;
    if (add) s.blendMode = "add";
    if (tint !== undefined) s.tint = tint;
    pools.addChild(s);
  };
  for (const [x, y, r] of [
    [0, 0, 900],
    [-w * 0.6, -h * 0.4, 700],
    [w * 0.6, h * 0.4, 700],
    [-w * 0.6, h * 0.45, 650],
    [w * 0.6, -h * 0.45, 650],
  ])
    pool(x, y, r, warm);
  const tintTex = radialTexture("rgba(255,255,255,0.35)", "rgba(255,255,255,0)");
  pool(-w, 0, 350, tintTex, TEAM_NUM[0], false);
  pool(w, 0, 350, tintTex, TEAM_NUM[1], false);
  const vignette = new Sprite(radialTexture("rgba(10,5,20,0)", "rgba(10,5,20,0.45)"));
  vignette.anchor.set(0.5);
  vignette.width = (rink.maxX - rink.minX) * 1.3;
  vignette.height = (rink.maxY - rink.minY) * 1.3;
  vignette.position.set((rink.minX + rink.maxX) / 2, (rink.minY + rink.maxY) / 2);
  const logoBox = new Container();
  const logo = new Text({ text: "LANBALL", style: { fontFamily: "Bungee", fontSize: 260, fill: toNum(PALETTE.paint) } });
  logo.anchor.set(0.5);
  logo.alpha = 0.07;
  if (orientation() === "vertical") logo.rotation = -Math.PI / 2;
  logoBox.addChild(logo);
  logoBox.scale.y = TILT;
  const mask = new Graphics().poly(floorShape).fill(0xffffff);
  floor.addChild(base, stripes, grain, pools, vignette, logoBox, mask);
  for (const x of [stripes, grain, pools, vignette, logoBox]) x.mask = mask;
  back.addChild(floor);

  // Maalatut viivat
  const lines = new Graphics();
  const paintCol = toNum(PALETTE.paint);
  const stroke = (p: Vec[], width = 6, alpha = 0.85, closed = false) => lines.poly(flat(p), closed).stroke({ width, color: paintCol, alpha });
  stroke([
    { x: 0, y: -h },
    { x: 0, y: h },
  ]);
  stroke(arcPts(0, 0, 130, 0, Math.PI * 2, 48), 6, 0.85, true);
  const dot = (x: number, y: number, r: number) => {
    const at = S(x, y);
    lines.ellipse(at.x, at.y, r, r * TILT).fill(paintCol);
  };
  dot(0, 0, 9);
  for (const s of [-1, 1]) {
    // Kaukalon tapaan: puoliympyrän muotoinen maalialue ja joukkueen värinen maalivahdin alue.
    const a0 = s < 0 ? -Math.PI / 2 : Math.PI / 2;
    stroke(arcPts(s * w, 0, 260, a0, a0 + Math.PI, 28));
    lines.poly(flat(arcPts(s * w, 0, 92, a0, a0 + Math.PI, 16))).fill({ color: TEAM_NUM[s < 0 ? 0 : 1], alpha: 0.22 });
    stroke(arcPts(s * w, 0, 92, a0, a0 + Math.PI, 16), 4);
    dot(s * (w - 330), 0, 8);
    for (let y = -h; y < h; y += 44)
      stroke(
        [
          { x: s * (w - 560), y },
          { x: s * (w - 560), y: y + 22 },
        ],
        5,
        0.35,
      );
  }
  back.addChild(lines);

  // Maalit: tasku, verkot ja katto. Ruudulla alaspäin osoittavat pinnat piirretään pelaajien eteen.
  const posts: Container[] = [];
  const netLine = { width: 1.4, color: 0xffffff, alpha: 0.3 };
  for (const [s, col] of [
    [-1, TEAM_NUM[0]],
    [1, TEAM_NUM[1]],
  ] as const) {
    const gx = s * w;
    const bx = s * (w + d);
    const pocket = [
      { x: gx, y: -g },
      { x: bx, y: -g },
      { x: bx, y: g },
      { x: gx, y: g },
    ];
    back.addChild(new Graphics().poly(flat(pocket)).fill(0x140d22));

    // Verkon pystypinnat: takaverkko ja kaksi sivuverkkoa. Ulospäin osoittava normaali maailmassa.
    const faces: { a: Vec; b: Vec; out: Vec }[] = [
      { a: { x: bx, y: -g }, b: { x: bx, y: g }, out: { x: s, y: 0 } },
      { a: { x: gx, y: -g }, b: { x: bx, y: -g }, out: { x: 0, y: -1 } },
      { a: { x: gx, y: g }, b: { x: bx, y: g }, out: { x: 0, y: 1 } },
    ];
    for (const f of faces) {
      const n = dirToScreen(f.out.x, f.out.y);
      const inFront = n.y > 0.1;
      const net = new Graphics();
      net.poly([...flat([f.a, f.b]), ...flat([f.b, f.a], GOAL_H)]).fill({ color: 0xffffff, alpha: inFront ? 0.04 : 0.07 });
      const len = Math.hypot(f.b.x - f.a.x, f.b.y - f.a.y);
      for (let t = 0; t <= len; t += 14) {
        const px = f.a.x + ((f.b.x - f.a.x) * t) / len;
        const py = f.a.y + ((f.b.y - f.a.y) * t) / len;
        const lo = S(px, py);
        const hi = S(px, py, GOAL_H);
        net.moveTo(lo.x, lo.y).lineTo(hi.x, hi.y);
      }
      for (let z = 0; z <= GOAL_H; z += 11) {
        const lo = S(f.a.x, f.a.y, z);
        const hi = S(f.b.x, f.b.y, z);
        net.moveTo(lo.x, lo.y).lineTo(hi.x, hi.y);
      }
      net.stroke(netLine);
      (inFront ? front : back).addChild(net);
    }
    const roof = new Graphics();
    roof.poly(flat(pocket, GOAL_H)).fill({ color: 0xffffff, alpha: 0.05 });
    for (let y = -g; y <= g; y += 16) {
      const a = S(gx, y, GOAL_H);
      const b = S(bx, y, GOAL_H);
      roof.moveTo(a.x, a.y).lineTo(b.x, b.y);
    }
    roof.stroke({ width: 1.2, color: 0xffffff, alpha: 0.28 });
    front.addChild(roof);

    // Tolpat ja ylärima. Rima kulkee lähemmän tolpan mukana, jotta se on pelaajien edessä oikeassa kohdassa.
    const p1 = S(gx, -g);
    const p2 = S(gx, g);
    const near = p2.y >= p1.y ? p2 : p1;
    const far = near === p2 ? p1 : p2;
    for (const at of [p1, p2]) {
      const post = new Container();
      const pg = new Graphics();
      pg.moveTo(0, 0).lineTo(0, -GOAL_H).stroke({ width: 9, color: 0x1c1430 });
      pg.moveTo(0, 0).lineTo(0, -GOAL_H).stroke({ width: 5, color: 0xffffff });
      if (at === near) {
        pg.moveTo(0, -GOAL_H).lineTo(far.x - near.x, far.y - near.y - GOAL_H).stroke({ width: 9, color: 0x1c1430 });
        pg.moveTo(0, -GOAL_H).lineTo(far.x - near.x, far.y - near.y - GOAL_H).stroke({ width: 5, color: col });
      }
      post.addChild(pg);
      post.position.set(at.x, at.y);
      post.zIndex = at.y + (at === near ? 0.5 : 0);
      posts.push(post);
    }
  }

  // Laidat: kaukaiset seinäpinnat taakse, lähin lasilaita eteen, sivulaidat paksuina levyinä.
  const walls = new Graphics();
  const glass = new Graphics();
  const boards = new Graphics();
  const railBack = new Graphics();
  const railFront = new Graphics();
  const ledBack = new Graphics();
  const backRail: [Vec, Vec][] = [];
  const frontRail: [Vec, Vec][] = [];
  const farFaces: [Vec, Vec][] = [];
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i];
    const b = outline[(i + 1) % outline.length];
    if (Math.abs(a.x) > w + 1 || Math.abs(b.x) > w + 1) continue; // maalitaskun seinät piirtää verkko
    const sa = S(a.x, a.y);
    const sb = S(b.x, b.y);
    const ta = S(a.x, a.y, WALL_H);
    const tb = S(b.x, b.y, WALL_H);
    const len = Math.hypot(sb.x - sa.x, sb.y - sa.y) || 1;
    const nx = -(sb.y - sa.y) / len; // sisäänpäin osoittava normaali ruudulla (reunaviiva kulkee myötäpäivään)
    const ny = (sb.x - sa.x) / len;
    const quad = [sa.x, sa.y, sb.x, sb.y, tb.x, tb.y, ta.x, ta.y];
    if (ny > 0.05) {
      const shade = 0.55 + ny * 0.45;
      const c = Math.round(0xd4 * shade) * 0x10000 + Math.round(0xdb * shade) * 0x100 + Math.round(0xe6 * shade);
      walls.poly(quad).fill(c);
      backRail.push([ta, tb]);
      farFaces.push([sa, sb]);
      ledBack.moveTo(sa.x, sa.y - 3).lineTo(sb.x, sb.y - 3).stroke({ width: 4, color: (a.x + b.x) / 2 < 0 ? TEAM_NUM[0] : TEAM_NUM[1] });
    } else if (ny < -0.05) {
      glass.poly(quad).fill({ color: 0xbfe8ff, alpha: 0.2 });
      frontRail.push([ta, tb]);
    } else {
      // Sivulaita: yläpinta ulospäin ja ulkoseinä, jotta laidalla on paksuutta.
      const ox = -Math.sign(nx) * 22;
      boards.poly([ta.x, ta.y, tb.x, tb.y, tb.x + ox, tb.y, ta.x + ox, ta.y]).fill(0xc3cad6);
      boards.poly([ta.x + ox, ta.y, tb.x + ox, tb.y, sb.x + ox, sb.y, sa.x + ox, sa.y]).fill(0x5d667a);
      backRail.push([ta, tb]);
    }
  }
  const rail = (gr: Graphics, segs: [Vec, Vec][], width: number, color: number, alpha = 1) => {
    for (const [a, b] of segs) gr.moveTo(a.x, a.y).lineTo(b.x, b.y);
    gr.stroke({ width, color, alpha, cap: "round", join: "round" });
  };
  rail(railBack, backRail, 9, 0x1c1430);
  rail(railBack, backRail, 5, 0xf4f7fb);
  rail(railFront, frontRail, 9, 0x1c1430, 0.85);
  rail(railFront, frontRail, 5, 0xf4f7fb, 0.95);
  for (const [a, b] of frontRail) glass.moveTo(a.x, a.y + 7).lineTo(b.x, b.y + 7);
  glass.stroke({ width: 2, color: 0xffffff, alpha: 0.35 });
  const baseLine = new Graphics().poly(floorShape).stroke({ width: 4, color: 0x1c1430, alpha: 0.7 });
  back.addChild(boards, baseLine, walls, ledBack, railBack);

  // Mainostaulut kaukaisen seinän pitkillä suorilla osilla
  const ads: Text[] = [];
  const adsText = ["LANBALL", "NO OFFSIDE", "BANANAS ARE LEGAL", "ROOFTOP CUP", "KEEP IT ROLLING", "BRING SNACKS"];
  let adIndex = 0;
  for (const [a, b] of farFaces) {
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 260) continue;
    const n = Math.max(1, Math.floor((len - 60) / 330));
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n;
      const ad = new Text({ text: adsText[adIndex++ % adsText.length], style: { fontFamily: "Bungee", fontSize: 22, fill: 0x2a1c44 } });
      ad.anchor.set(0.5);
      ad.position.set(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t - WALL_H / 2 + 1);
      ad.alpha = 0.8;
      back.addChild(ad);
      ads.push(ad);
    }
  }

  front.addChild(glass, railFront);
  const ledFlash = new Graphics();
  back.addChild(ledFlash);

  const bounds: Box = { minX: rink.minX - 170, maxX: rink.maxX + 170, minY: farTop - 250, maxY: rink.maxY + 140 };
  const goalScreen: [Vec, Vec] = [S(-w, 0), S(w, 0)];
  return { back, front, posts, ledFlash, ledFaces: farFaces, ads, rink, farTop, bounds, goalScreen };
}

/** Maalin jälkeen kaukaiset seinät vilkkuvat maalin tehneen joukkueen värissä. */
export function drawLedFlash(layers: ArenaLayers, color: number, alpha: number) {
  const gr = layers.ledFlash.clear();
  if (alpha <= 0) return;
  for (const [a, b] of layers.ledFaces) gr.poly([a.x, a.y, b.x, b.y, b.x, b.y - WALL_H, a.x, a.y - WALL_H]).fill({ color, alpha: alpha * 0.4 });
  for (const [a, b] of layers.ledFaces) gr.moveTo(a.x, a.y - WALL_H).lineTo(b.x, b.y - WALL_H);
  gr.stroke({ width: 14, color, alpha });
}
