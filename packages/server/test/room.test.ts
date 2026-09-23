import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NO_INPUT } from "@lanball/sim";
import type { ServerMsg } from "@lanball/sim";
import { Room } from "../src/room.ts";

function peer(id: string) {
  const inbox: ServerMsg[] = [];
  return { id, inbox, send: (m: ServerMsg) => inbox.push(structuredClone(m)) };
}

describe("LAN-huone", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("kaksi selainta liittyy, ottelu alkaa kun kaikki ovat valmiita, ja syötteet liikuttavat hahmoja", () => {
    const room = new Room(["http://test"]);
    const a = peer("a");
    const b = peer("b");
    room.connect(a);
    room.connect(b);
    room.handle("a", { t: "join", device: "kb1" });
    room.handle("b", { t: "join", device: "pad0" });
    const [pa, pb] = room.lobby.players;
    expect(pa.team).not.toBe(pb.team); // tasainen jako

    // Toisen selaimen pelaajaa ei voi muuttaa.
    room.handle("a", { t: "ready", slot: pb.slot, ready: true });
    expect(pb.ready).toBe(false);

    room.handle("a", { t: "ready", slot: pa.slot, ready: true });
    room.handle("b", { t: "ready", slot: pb.slot, ready: true });
    expect(room.lobby.startsIn).toBe(3);
    vi.advanceTimersByTime(3000);
    expect(room.state).not.toBeNull();
    expect(b.inbox.some((m) => m.t === "start")).toBe(true);

    // Ohitetaan alkulaskenta ja ajetaan tickejä käsin.
    room.state!.phase = "play";
    const startX = room.state!.players.find((p) => p.controller === pa.slot)!.pos.x;
    for (let i = 0; i < 30; i++) {
      room.handle("a", { t: "input", frames: { [pa.slot]: [{ ...NO_INPUT, moveY: 1 }] } });
      room.tick();
    }
    const me = room.state!.players.find((p) => p.controller === pa.slot)!;
    expect(me.pos.y).toBeGreaterThan(60);
    expect(Math.abs(me.pos.x - startX)).toBeLessThan(40);

    const snaps = b.inbox.filter((m) => m.t === "snap");
    expect(snaps.length).toBeGreaterThanOrEqual(14); // 30 Hz
    const last = snaps.at(-1)!;
    expect(last.t === "snap" && "ai" in last.state.players[0]).toBe(false);
    room.stopMatch();
  });

  it("poistuneen selaimen hahmo siirtyy tekoälylle", () => {
    const room = new Room([]);
    room.connect(peer("a"));
    room.connect(peer("b"));
    room.handle("a", { t: "join", device: "kb1" });
    room.handle("b", { t: "join", device: "kb1" });
    room.startMatch();
    expect(room.state!.slots).toHaveLength(2);
    room.disconnect("b");
    expect(room.state!.slots).toHaveLength(1);
    expect(room.lobby.players).toHaveLength(1);
    room.stopMatch();
  });
});
