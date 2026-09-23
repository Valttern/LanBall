import "@fontsource/bungee";
import "@fontsource/rubik/400.css";
import "@fontsource/rubik/500.css";
import "./style.css";
import { Application } from "pixi.js";
import { App } from "./app.ts";

// Areenan kylttiteksti piirretään canvasiin, joten fontin on oltava ladattu ennen sitä.
await Promise.all([document.fonts.load("40px Bungee"), document.fonts.load("16px Rubik")]);

const pixi = new Application();
await pixi.init({
  background: 0x1d1432,
  resizeTo: window,
  antialias: true,
  autoDensity: true,
  resolution: Math.min(2, devicePixelRatio),
});
document.getElementById("stage")!.appendChild(pixi.canvas);
new App(pixi);
