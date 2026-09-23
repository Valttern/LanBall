import { Application } from "pixi.js";
import { buildArena, createMatch, DT, step } from "@lanball/sim";
import type { InputState } from "@lanball/sim";
import { KEYMAP_P1, readKeyboard } from "./input/keyboard.ts";
import { GameView } from "./render.ts";

const VIEW_W = 1600;
const VIEW_H = 1000;

const arena = buildArena();
let prev = createMatch(arena);
let curr = prev;
const controlledId = 0; // näyte: P1 ohjaa joukkueen 0 keskushyökkääjää

const app = new Application();
await app.init({ background: 0x1b1d3a, resizeTo: window, antialias: true, autoDensity: true, resolution: devicePixelRatio });
document.body.appendChild(app.canvas);

const view = new GameView(arena, curr);
app.stage.addChild(view.root);

function fit() {
  const s = Math.min(app.screen.width / VIEW_W, app.screen.height / VIEW_H);
  view.root.scale.set(s);
  view.root.position.set(app.screen.width / 2, app.screen.height / 2 + 20 * s);
}
fit();
app.renderer.on("resize", fit);

// Kehitystilassa tila näkyy konsolista ja selaintesteistä. `advance` ajaa simulaatiota ohjatulla syötteellä
// ilman ruudunpäivitystä (piilotettu välilehti ei päivity).
if (import.meta.env.DEV)
  (window as any).__lanball = {
    get state() {
      return curr;
    },
    advance(ticks: number, input: Partial<InputState> = {}) {
      for (let i = 0; i < ticks; i++) {
        const inputs: InputState[] = [];
        inputs[controlledId] = { ...readKeyboard(KEYMAP_P1), ...input };
        prev = curr;
        curr = step(curr, inputs, arena);
      }
      view.render(prev, curr, 1, controlledId);
      app.render();
      return curr;
    },
  };

// Kiinteä 60 Hz simulaatio, piirto interpoloi tickien välistä.
let acc = 0;
let last = performance.now();
app.ticker.add(() => {
  const now = performance.now();
  acc = Math.min(acc + (now - last) / 1000, 0.25);
  last = now;
  while (acc >= DT) {
    const inputs: InputState[] = [];
    inputs[controlledId] = readKeyboard(KEYMAP_P1);
    prev = curr;
    curr = step(curr, inputs, arena);
    acc -= DT;
  }
  view.render(prev, curr, acc / DT, controlledId);
});
