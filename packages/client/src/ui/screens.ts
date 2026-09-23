import { CHARACTERS, KEEPER, PICKUPS, PLAYER_COLORS, MAX_PER_TEAM, character } from "@lanball/sim";
import type { CharacterDef, LobbyPlayer, LobbyState, PickupKind, Team } from "@lanball/sim";
import type { Device } from "../input/devices.ts";
import { TEAM_HEX, TEAM_NAMES, pickupTexture, portraitDataUrl } from "../render/art.ts";
import { charTex } from "../render/view.ts";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const hex = (n: number) => "#" + n.toString(16).padStart(6, "0");

const portraits = new Map<string, string>();
export function portrait(id: string, team: number) {
  const key = `${id}:${team}`;
  if (!portraits.has(key)) portraits.set(key, portraitDataUrl(charTex(id, team)));
  return portraits.get(key)!;
}

const icons = new Map<string, string>();
function icon(kind: PickupKind) {
  if (!icons.has(kind)) icons.set(kind, portraitDataUrl(pickupTexture(kind)));
  return icons.get(kind)!;
}

export interface MenuItem {
  id: string;
  label: string;
  sub: string;
}

export function titleHtml(items: MenuItem[], active: number, muted: boolean) {
  return `
  <div class="title">
    <div class="title-head">
      <h1 class="logo">LAN<br>BALL</h1>
      <p class="tagline">Arcade football for the couch and the whole LAN. No offside, plenty of bananas.</p>
    </div>
    <nav class="menu" aria-label="Main menu">
      ${items
        .map(
          (it, i) =>
            `<button data-menu="${i}" class="${i === active ? "active" : ""}"><span>${esc(it.label)}</span><small>${esc(it.sub)}</small></button>`,
        )
        .join("")}
    </nav>
    <p class="hint">Move with <kbd>W</kbd><kbd>S</kbd> or a stick. Select with <kbd>F</kbd>, <kbd>Enter</kbd> or <kbd>A</kbd>.</p>
    <div class="corner"><button class="chip" data-action="mute">${muted ? "Sound off" : "Sound on"} <kbd>M</kbd></button></div>
  </div>`;
}

function statBars(c: CharacterDef) {
  const bar = (label: string, v: number) =>
    `<span>${label}</span><div class="bar"><i style="width:${Math.round(Math.max(0.15, Math.min(1, v)) * 100)}%"></i></div>`;
  return `<div class="stats">
    ${bar("Speed", (c.speed - 0.8) / 0.4)}
    ${bar("Shot", (c.shot - 0.8) / 0.5)}
    ${bar("Muscle", (c.mass - 0.7) / 1.1)}
  </div>`;
}

function cardHtml(p: LobbyPlayer, dev: Device | undefined, mine: boolean) {
  const c = character(p.character);
  const color = hex(PLAYER_COLORS[p.slot % PLAYER_COLORS.length]);
  const k = dev?.keys;
  const controls =
    mine && k && !p.ready
      ? `<div class="controls">${dev!.kind === "gamepad" ? "◀ ▶ side, ▲ ▼ character" : `${k.move}: side and character`}<br>${esc(k.pass)} ready</div>`
      : mine && k
        ? `<div class="controls">${esc(k.shoot)} to change</div>`
        : "";
  return `<div class="card ${p.ready ? "ready" : ""}">
    <img src="${portrait(p.character, p.team)}" alt="">
    <div class="who"><span class="pill" style="background:${color}">${esc(p.name)}</span><span class="cname">${esc(c.name)}</span></div>
    <div class="tag">${esc(c.tagline)}</div>
    ${statBars(c)}
    ${controls}
    ${p.ready ? `<div class="badge">READY</div>` : ""}
  </div>`;
}

export function lobbyHtml(opts: {
  lobby: LobbyState;
  lan: boolean;
  me: string;
  deviceOf: (p: LobbyPlayer) => Device | undefined;
  joinUrl?: string;
  qr?: string;
  joinable: Device[];
}) {
  const { lobby, lan } = opts;
  const side = (team: Team) => {
    const ps = lobby.players.filter((p) => p.team === team);
    const open = MAX_PER_TEAM - ps.length;
    return `<section class="side ${team === 0 ? "blaze" : "frost"}">
      <h3>${TEAM_NAMES[team]}</h3>
      <div class="cards">
        ${ps.map((p) => cardHtml(p, opts.deviceOf(p), p.client === opts.me)).join("")}
        ${Array.from({ length: open }, () => `<div class="card open">Open spot. A bot plays here.</div>`).join("")}
      </div>
    </section>`;
  };
  const joinKeys = opts.joinable.map((d) => (d.kind === "gamepad" ? "A on a gamepad" : `${d.keys.pass} (${d.label.toLowerCase()})`));
  let status: string;
  if (lobby.startsIn !== null) status = `<div class="status go">Kick-off in ${lobby.startsIn}</div>`;
  else if (lobby.players.length === 0) status = `<div class="status">Press ${esc(joinKeys.join(", ") || "a button")} to join</div>`;
  else {
    const waiting = lobby.players.filter((p) => !p.ready).length;
    status = `<div class="status">${waiting ? `Waiting for ${waiting} ${waiting === 1 ? "player" : "players"} to ready up` : "Everyone's ready"}</div>`;
  }
  const secs = lobby.settings.matchSeconds;
  return `<div class="lobby">
    <div class="lobby-top">
      <h2>${lan ? "LAN party" : "Pick your side"}</h2>
      ${
        lan && opts.joinUrl
          ? `<div class="join-url">${opts.qr ? `<img src="${opts.qr}" alt="QR code for ${esc(opts.joinUrl)}">` : ""}<div><span>Friends open this address</span><b>${esc(opts.joinUrl)}</b></div></div>`
          : `<p class="hint">Everyone on this computer: press your pass button to join. Empty spots get bots.</p>`
      }
    </div>
    <div class="sides">${side(0)}<div class="vs">VS</div>${side(1)}</div>
    <div class="lobby-bottom">
      ${status}
      <div class="settings">
        <button data-action="length">Match length<b>${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}</b></button>
        <button data-action="powerups">Power-ups<b>${lobby.settings.powerups ? "On" : "Off"}</b></button>
        <button class="back" data-action="back">Back to menu <kbd>Esc</kbd></button>
      </div>
    </div>
  </div>`;
}

export function howtoHtml() {
  const moves = `
    <ul class="moves">
      <li><b>Pass</b>Goes to the teammate you're facing. Without the ball, it switches you to the player closest to it.</li>
      <li><b>Shoot</b>Hold to charge, release to shoot. Aim roughly at the goal and the shot finds the net.</li>
      <li><b>Tackle</b>Slide into opponents to knock them over. With the ball, it's a short sprint.</li>
    </ul>`;
  const kinds = Object.keys(PICKUPS) as PickupKind[];
  const desc: Record<PickupKind, string> = {
    turbo: "Run a lot faster for a few seconds.",
    giant: "Grow huge and flatten anyone you bump.",
    magnet: "The ball is pulled towards you.",
    mega: "Your next shot is a fireball that knocks down everyone in its path.",
    freeze: "The other team freezes solid for two seconds.",
    banana: "Drops banana peels behind you. Opponents slip.",
  };
  return `<div class="overlay"><div class="panel">
    <h2>How to play</h2>
    <div class="howto-grid">
      <div><h3>Keyboard, left</h3><dl>
        <dt><span class="key">W</span><span class="key">A</span><span class="key">S</span><span class="key">D</span></dt><dd>Move</dd>
        <dt><span class="key">F</span></dt><dd>Pass</dd><dt><span class="key">G</span></dt><dd>Shoot</dd><dt><span class="key">H</span></dt><dd>Tackle</dd>
      </dl></div>
      <div><h3>Keyboard, right</h3><dl>
        <dt><span class="key">Arrow keys</span></dt><dd>Move</dd>
        <dt><span class="key">,</span></dt><dd>Pass</dd><dt><span class="key">.</span></dt><dd>Shoot</dd><dt><span class="key">-</span></dt><dd>Tackle</dd>
      </dl></div>
      <div><h3>Gamepad</h3><dl>
        <dt><span class="key">Stick</span></dt><dd>Move</dd>
        <dt><span class="key">A</span></dt><dd>Pass</dd><dt><span class="key">B</span></dt><dd>Shoot</dd><dt><span class="key">X</span></dt><dd>Tackle</dd>
      </dl></div>
    </div>
    ${moves}
    <div class="powerlist"><h3>Power-ups</h3><ul>
      ${kinds.map((k) => `<li><img src="${icon(k)}" alt=""><span><b>${PICKUPS[k].label}</b><br>${desc[k]}</span></li>`).join("")}
    </ul></div>
    <div class="panel-actions"><button class="btn active" data-action="close">Got it</button></div>
  </div></div>`;
}

export interface PlayerStats {
  id: number;
  team: Team;
  character: string;
  human: string | null;
  goals: number;
  shots: number;
  knocks: number;
  saves: number;
}

export function resultsHtml(score: [number, number], stats: PlayerStats[], actions: { id: string; label: string }[], active: number) {
  const winner = score[0] === score[1] ? null : score[0] > score[1] ? 0 : 1;
  const rated = stats.map((s) => ({ s, v: s.goals * 3 + s.saves * 2 + s.knocks + s.shots * 0.5 })).sort((a, b) => b.v - a.v);
  const mvp = rated[0]?.s;
  const name = (s: PlayerStats) => (s.human ? `${character(s.character).name} (${s.human})` : character(s.character).name);
  const rows = [...stats]
    .sort((a, b) => a.team - b.team || b.goals - a.goals)
    .map(
      (s) =>
        `<tr><td><span class="dot" style="background:${TEAM_HEX[s.team]}"></span>${esc(name(s))}</td><td>${s.goals}</td><td>${s.shots}</td><td>${s.knocks}</td><td>${s.saves}</td></tr>`,
    )
    .join("");
  return `<div class="overlay"><div class="panel">
    <div class="results-head">
      <p class="winner" style="--c:${winner === null ? "#ffd84a" : TEAM_HEX[winner]}">${winner === null ? "DRAW" : `${TEAM_NAMES[winner]} WIN`}</p>
      <div class="final">${score[0]} – ${score[1]}</div>
    </div>
    ${
      mvp
        ? `<div class="mvp"><img src="${portrait(mvp.character === "keeper" ? KEEPER.id : mvp.character, mvp.team)}" alt=""><div><span>Player of the match</span><b>${esc(name(mvp))}</b></div></div>`
        : ""
    }
    <table class="stats-table"><thead><tr><th>Player</th><th>Goals</th><th>Shots</th><th>Knockdowns</th><th>Saves</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="panel-actions">${actions.map((a, i) => `<button class="btn ${i === active ? "active" : ""}" data-menu="${i}">${esc(a.label)}</button>`).join("")}</div>
  </div></div>`;
}

export function pauseHtml(title: string, actions: { id: string; label: string }[], active: number) {
  return `<div class="overlay"><div class="panel">
    <h2>${esc(title)}</h2>
    <div class="panel-actions">${actions.map((a, i) => `<button class="btn ${i === active ? "active" : ""}" data-menu="${i}">${esc(a.label)}</button>`).join("")}</div>
  </div></div>`;
}

export const allCharacterIds = () => CHARACTERS.map((c) => c.id);
