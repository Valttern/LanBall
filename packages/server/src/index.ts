import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { networkInterfaces } from "node:os";
import { extname, join, normalize, resolve } from "node:path";
import { WebSocketServer } from "ws";
import type { ClientMsg } from "@lanball/sim";
import { Room } from "./room.ts";

const PORT = Number(process.env.PORT ?? 8080);
const DIST = resolve(import.meta.dirname, "../../client/dist");

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".json": "application/json",
};

/** Kotiverkon osoitteet ensin; link-local (169.254) ei toimi kavereille, joten se jätetään pois. */
function lanUrls(): string[] {
  const rank = (ip: string) =>
    /^192\.168\./.test(ip) ? 0 : /^10\./.test(ip) ? 1 : /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ? 2 : 3;
  const ips: string[] = [];
  for (const list of Object.values(networkInterfaces()))
    for (const a of list ?? []) if (a.family === "IPv4" && !a.internal && !a.address.startsWith("169.254.")) ips.push(a.address);
  ips.sort((a, b) => rank(a) - rank(b));
  return ips.length ? ips.map((ip) => `http://${ip}:${PORT}`) : [`http://localhost:${PORT}`];
}

const urls = lanUrls();
const room = new Room(urls);

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://x");
  if (url.pathname === "/api/info") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ urls, lanball: true }));
    return;
  }
  let file = normalize(join(DIST, decodeURIComponent(url.pathname)));
  if (!file.startsWith(DIST) || !existsSync(file) || statSync(file).isDirectory()) file = join(DIST, "index.html");
  if (!existsSync(file)) {
    res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    res.end("Client build missing. Run: npm run host");
    return;
  }
  res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
  createReadStream(file).pipe(res);
});

const wss = new WebSocketServer({ server, path: "/ws" });
let nextId = 1;
wss.on("connection", (ws) => {
  const id = `c${nextId++}`;
  ws.on("message", (data) => {
    try {
      room.handle(id, JSON.parse(String(data)) as ClientMsg);
    } catch {
      // Rikkinäinen viesti ohitetaan.
    }
  });
  ws.on("close", () => room.disconnect(id));
  room.connect({ id, send: (msg) => ws.readyState === ws.OPEN && ws.send(JSON.stringify(msg)) });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("\n  ⚽ LANBALL host is running\n");
  for (const u of urls) console.log(`  Friends join at:  ${u}`);
  console.log(`  On this machine:  http://localhost:${PORT}\n`);
});
