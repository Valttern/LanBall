/**
 * Kaikki äänet syntetisoidaan Web Audiolla: ei äänitiedostoja, ei lisenssejä.
 * Selaimet sallivat äänen vasta käyttäjän ensimmäisen painalluksen jälkeen, joten konteksti herätetään unlock():lla.
 */

let ctx: AudioContext | null = null;
let master: GainNode;
let sfxBus: GainNode;
let musicBus: GainNode;
let crowdGain: GainNode;
let noiseBuf: AudioBuffer;
let muted = false;
try {
  muted = localStorage.getItem("lanball.muted") === "1";
} catch {
  /* yksityinen ikkuna */
}

function init() {
  if (ctx) return;
  ctx = new AudioContext();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.8;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 4;
  master.connect(comp).connect(ctx.destination);
  sfxBus = ctx.createGain();
  sfxBus.connect(master);
  musicBus = ctx.createGain();
  musicBus.gain.value = 0.32;
  musicBus.connect(master);

  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

  // Yleisön jatkuva humina: suodatettua kohinaa, jonka voimakkuutta pelitilanne säätää.
  const crowd = ctx.createBufferSource();
  crowd.buffer = noiseBuf;
  crowd.loop = true;
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 700;
  bp.Q.value = 0.6;
  crowdGain = ctx.createGain();
  crowdGain.gain.value = 0;
  crowd.connect(bp).connect(crowdGain).connect(master);
  crowd.start();
}

export function unlock() {
  init();
  if (ctx!.state === "suspended") void ctx!.resume();
}

export function toggleMute(): boolean {
  muted = !muted;
  try {
    localStorage.setItem("lanball.muted", muted ? "1" : "0");
  } catch {
    /* ei tallennusta */
  }
  if (ctx) master.gain.setTargetAtTime(muted ? 0 : 0.8, ctx.currentTime, 0.05);
  return muted;
}
export const isMuted = () => muted;

const now = () => ctx!.currentTime;
const ready = () => !!ctx && ctx.state === "running";

function tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, when = 0, bus = sfxBus) {
  const t = now() + when;
  const o = ctx!.createOscillator();
  const g = ctx!.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(bus);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise(dur: number, vol: number, type: BiquadFilterType, f0: number, f1 = f0, q = 1, when = 0, bus = sfxBus) {
  const t = now() + when;
  const src = ctx!.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx!.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(f0, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = ctx!.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(bus);
  src.start(t, Math.random());
  src.stop(t + dur + 0.05);
}

export const sfx = {
  kick(power: number, fire: boolean) {
    if (!ready()) return;
    tone("sine", 140 + power * 60, 45, 0.18, 0.7);
    noise(0.07, 0.5, "highpass", 2500, 1200, 0.7);
    if (fire) {
      noise(0.6, 0.5, "lowpass", 3000, 200, 0.8);
      tone("sawtooth", 90, 40, 0.5, 0.25);
    }
  },
  pass() {
    if (!ready()) return;
    tone("sine", 220, 90, 0.1, 0.35);
    noise(0.04, 0.2, "highpass", 3000);
  },
  grab() {
    if (!ready()) return;
    tone("sine", 320, 200, 0.06, 0.12);
  },
  bounce(power: number) {
    if (!ready()) return;
    const v = Math.min(0.5, power / 1500);
    tone("triangle", 180, 70, 0.12, v);
    noise(0.08, v * 0.6, "bandpass", 900, 500, 2);
  },
  post() {
    if (!ready()) return;
    for (const [f, v] of [
      [860, 0.35],
      [1290, 0.2],
      [2150, 0.12],
    ] as const)
      tone("sine", f, f * 0.98, 0.9, v);
  },
  tackle() {
    if (!ready()) return;
    noise(0.3, 0.35, "bandpass", 600, 2400, 1.5);
  },
  knock() {
    if (!ready()) return;
    tone("sine", 520, 90, 0.35, 0.45);
    tone("square", 90, 50, 0.12, 0.2);
  },
  slip() {
    if (!ready()) return;
    tone("sine", 300, 1600, 0.45, 0.3);
  },
  steal() {
    if (!ready()) return;
    tone("triangle", 600, 900, 0.08, 0.15);
  },
  spawn() {
    if (!ready()) return;
    [0, 0.05, 0.1].forEach((w, i) => tone("sine", 900 + i * 300, 1300 + i * 300, 0.25, 0.12, w));
  },
  pickup() {
    if (!ready()) return;
    [523, 659, 784, 1046].forEach((f, i) => tone("square", f, f, 0.1, 0.12, i * 0.05));
  },
  save() {
    if (!ready()) return;
    noise(1.2, 0.35, "bandpass", 500, 800, 3); // yleisön "ooh"
    tone("sine", 200, 120, 0.2, 0.3);
  },
  whistle(long = false) {
    if (!ready()) return;
    const t = now();
    const o = ctx!.createOscillator();
    const lfo = ctx!.createOscillator();
    const lfoGain = ctx!.createGain();
    const g = ctx!.createGain();
    o.frequency.value = 2900;
    lfo.frequency.value = 32;
    lfoGain.gain.value = 140;
    lfo.connect(lfoGain).connect(o.frequency);
    const dur = long ? 1.1 : 0.45;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
    g.gain.setValueAtTime(0.22, t + dur - 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(sfxBus);
    o.start(t);
    lfo.start(t);
    o.stop(t + dur);
    lfo.stop(t + dur);
  },
  goal() {
    if (!ready()) return;
    // Ilmatorvi: kolme sahalaitaa sointuna, hento vibrato.
    for (const f of [233, 294, 349]) {
      const t = now();
      const o = ctx!.createOscillator();
      const g = ctx!.createGain();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(f * 0.9, t);
      o.frequency.linearRampToValueAtTime(f, t + 0.08);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.12, t + 0.05);
      g.gain.setValueAtTime(0.12, t + 1.1);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
      const lp = ctx!.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 2200;
      o.connect(lp).connect(g).connect(sfxBus);
      o.start(t);
      o.stop(t + 1.6);
    }
    noise(3.2, 0.55, "bandpass", 900, 1300, 0.5); // yleisön riemu
  },
  beep(high = false) {
    if (!ready()) return;
    tone("square", high ? 1320 : 660, high ? 1320 : 660, high ? 0.35 : 0.12, 0.15);
  },
  ui(kind: "move" | "confirm" | "back" | "join") {
    if (!ready()) return;
    if (kind === "move") tone("square", 880, 880, 0.04, 0.06);
    if (kind === "confirm") [660, 990].forEach((f, i) => tone("square", f, f, 0.07, 0.08, i * 0.06));
    if (kind === "back") tone("square", 440, 330, 0.08, 0.07);
    if (kind === "join") [523, 784, 1046].forEach((f, i) => tone("triangle", f, f, 0.12, 0.14, i * 0.05));
  },
};

/** Yleisön äänenvoimakkuus 0..1, liukuu pehmeästi. */
export function setCrowd(level: number) {
  if (!ctx) return;
  crowdGain.gain.setTargetAtTime(0.03 + level * 0.12, now(), 0.4);
}

// ---------- Musiikki: yksinkertainen sekvensseri valikoihin ----------

let musicTimer: ReturnType<typeof setInterval> | null = null;
let stepIndex = 0;
let nextTime = 0;
const BPM = 118;
const STEP = 60 / BPM / 4;
// Sointukierto (juurisävelet Hz): Am – F – C – G
const ROOTS = [110, 87.31, 130.81, 98];
const CHORDS = [
  [0, 3, 7],
  [0, 4, 7],
  [0, 4, 7],
  [0, 4, 7],
];

function scheduleStep(i: number, t: number) {
  const bar = Math.floor(i / 16) % 4;
  const s = i % 16;
  const root = ROOTS[bar];
  const at = t - now();
  // Rummut
  if (s % 4 === 0) tone("sine", 120, 40, 0.18, 0.55, at, musicBus);
  if (s % 8 === 4) noise(0.12, 0.3, "highpass", 1800, 1200, 0.8, at, musicBus);
  if (s % 2 === 1) noise(0.03, 0.08, "highpass", 7000, 7000, 1, at, musicBus);
  // Basso
  if (s % 4 === 0 || s % 4 === 3) tone("square", root, root, STEP * 1.8, 0.12, at, musicBus);
  // Arpeggio
  const chord = CHORDS[bar];
  const note = root * 4 * Math.pow(2, chord[s % 3] / 12);
  if (s % 2 === 0) tone("triangle", note, note, STEP * 1.5, 0.06, at, musicBus);
}

export function startMusic() {
  if (!ctx || musicTimer) return;
  nextTime = now() + 0.1;
  musicTimer = setInterval(() => {
    if (!ctx) return;
    while (nextTime < now() + 0.2) {
      scheduleStep(stepIndex++, nextTime);
      nextTime += STEP;
    }
  }, 50);
}

export function stopMusic() {
  if (musicTimer) clearInterval(musicTimer);
  musicTimer = null;
}
