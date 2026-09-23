import { Container, Graphics, Text } from "pixi.js";
import type { Arena, GameState, Player, Vec } from "@lanball/sim";

// Väliaikainen värimaailma S1:een. Grafiikkatyyli on vielä auki.
const COLORS = {
  floor: 0x3fbf6f,
  floorStripe: 0x38ad63,
  wall: 0xf5e6c8,
  wallEdge: 0x2b2d52,
  lines: 0xffffff,
  net: 0xffffff,
  team: [0xff7a2f, 0x4a7dff],
  keeper: 0xffd23f,
  ball: 0xffffff,
  shadow: 0x000000,
};

const WALL = 18;

function drawArena(arena: Arena): Container {
  const c = new Container();
  const flat = arena.outline.flatMap((p) => [p.x, p.y]);

  c.addChild(new Graphics().poly(flat).stroke({ width: WALL * 2 + 6, color: COLORS.wallEdge, join: "round" }));
  c.addChild(new Graphics().poly(flat).stroke({ width: WALL * 2, color: COLORS.wall, join: "round" }));
  c.addChild(new Graphics().poly(flat).fill(COLORS.floor));

  const stripes = new Graphics();
  const bands = 10;
  const bw = (arena.halfWidth * 2) / bands;
  for (let i = 0; i < bands; i += 2) stripes.rect(-arena.halfWidth + i * bw, -arena.halfHeight, bw, arena.halfHeight * 2);
  stripes.fill(COLORS.floorStripe);
  const mask = new Graphics().poly(flat).fill(0xffffff);
  stripes.mask = mask;
  c.addChild(mask, stripes);

  const { halfWidth: w, halfHeight: h, goalHalfWidth: g, goalDepth: d } = arena;
  const lines = new Graphics()
    .moveTo(0, -h)
    .lineTo(0, h)
    .circle(0, 0, 90)
    .stroke({ width: 4, color: COLORS.lines, alpha: 0.7 })
    .circle(0, 0, 6)
    .fill({ color: COLORS.lines, alpha: 0.7 });
  for (const s of [-1, 1]) {
    lines.moveTo(s * w, -g - 60).arcTo(s * (w - 150), -g - 60, s * (w - 150), 0, 60);
    lines.arcTo(s * (w - 150), g + 60, s * w, g + 60, 60).lineTo(s * w, g + 60);
  }
  lines.stroke({ width: 4, color: COLORS.lines, alpha: 0.7 });
  c.addChild(lines);

  for (const s of [-1, 1]) {
    const x0 = s < 0 ? -w - d : w;
    const net = new Graphics().rect(x0, -g, d, g * 2).fill({ color: 0x000000, alpha: 0.25 });
    for (let y = -g; y <= g; y += 15) net.moveTo(x0, y).lineTo(x0 + d, y);
    for (let x = 0; x <= d; x += 14) net.moveTo(x0 + x, -g).lineTo(x0 + x, g);
    net.stroke({ width: 1.5, color: COLORS.net, alpha: 0.5 });
    const team = s < 0 ? 0 : 1;
    net.moveTo(s * w, -g).lineTo(s * w, g).stroke({ width: 6, color: COLORS.team[team] });
    c.addChild(net);
  }
  return c;
}

class PlayerView {
  root = new Container();
  private eyes = new Graphics();
  private marker = new Graphics();

  constructor(p: Player) {
    const color = COLORS.team[p.team];
    this.marker.ellipse(0, 6, p.radius + 10, p.radius * 0.7 + 6).stroke({ width: 4, color: 0xffffff, alpha: 0.9 });
    this.marker.visible = false;
    const body = new Graphics()
      .ellipse(0, p.radius * 0.55, p.radius * 0.95, p.radius * 0.45)
      .fill({ color: COLORS.shadow, alpha: 0.25 })
      .circle(0, 0, p.radius)
      .fill(color)
      .stroke({ width: 3, color: 0x1a1a2e });
    if (p.role === "keeper") body.circle(0, 0, p.radius - 7).stroke({ width: 5, color: COLORS.keeper });
    this.root.addChild(this.marker, body, this.eyes);
  }

  update(pos: Vec, facing: Vec, controlled: boolean, radius: number) {
    this.root.position.set(pos.x, pos.y);
    this.marker.visible = controlled;
    // Mulkosilmät katsovat liikesuuntaan.
    const g = this.eyes.clear();
    const px = -facing.y;
    const py = facing.x;
    for (const side of [-1, 1]) {
      const ex = facing.x * radius * 0.35 + px * side * radius * 0.38;
      const ey = facing.y * radius * 0.35 + py * side * radius * 0.38 - 4;
      g.circle(ex, ey, 8).fill(0xffffff).stroke({ width: 2, color: 0x1a1a2e });
      g.circle(ex + facing.x * 3.5, ey + facing.y * 3.5, 3.5).fill(0x1a1a2e);
    }
  }
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export class GameView {
  root = new Container();
  private players: PlayerView[];
  private ball = new Graphics();
  private score = new Text({
    text: "0 – 0",
    style: { fontFamily: "system-ui, sans-serif", fontSize: 56, fontWeight: "900", fill: 0xffffff, stroke: { color: 0x1a1a2e, width: 8 } },
  });

  constructor(arena: Arena, initial: GameState) {
    this.root.addChild(drawArena(arena));
    this.players = initial.players.map((p) => new PlayerView(p));
    for (const v of this.players) this.root.addChild(v.root);
    const r = initial.ball.radius;
    this.ball
      .ellipse(3, r * 0.8, r, r * 0.45)
      .fill({ color: COLORS.shadow, alpha: 0.3 })
      .circle(0, 0, r)
      .fill(COLORS.ball)
      .stroke({ width: 3, color: 0x1a1a2e })
      .circle(-r * 0.3, -r * 0.3, r * 0.3)
      .fill(0x1a1a2e);
    this.root.addChild(this.ball);
    this.score.anchor.set(0.5, 0.5);
    this.score.position.set(0, -arena.halfHeight - 70);
    this.root.addChild(this.score);
  }

  /** Piirtää kahden tickin välistä, `alpha` 0..1. */
  render(prev: GameState, curr: GameState, alpha: number, controlledId: number) {
    const at = (a: Vec, b: Vec) => ({ x: lerp(a.x, b.x, alpha), y: lerp(a.y, b.y, alpha) });
    curr.players.forEach((p, i) => {
      const q = prev.players[i] ?? p;
      this.players[i].update(at(q.pos, p.pos), p.facing, p.id === controlledId, p.radius);
    });
    const b = at(prev.ball.pos, curr.ball.pos);
    this.ball.position.set(b.x, b.y);
    this.score.text = `${curr.score[0]} – ${curr.score[1]}`;
  }
}
