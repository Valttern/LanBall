import { byId } from "./players.ts";
import { NO_INPUT } from "./input.ts";
import { TUNING, secs } from "./tuning.ts";
import type { GameState, InputState, Player, Slot } from "./types.ts";

const distToBall = (state: GameState, p: Player) => Math.hypot(p.pos.x - state.ball.pos.x, p.pos.y - state.ball.pos.y);

function switchTo(state: GameState, slot: Slot, q: Player, input: InputState) {
  if (slot.playerId === q.id) return;
  slot.playerId = q.id;
  slot.switchedAt = state.tick;
  // Uusi hahmo ei saa tulkita jo pohjassa olevaa nappia uudeksi painallukseksi.
  q.held = { pass: input.pass, shoot: input.shoot, tackle: input.tackle };
  q.charge = 0;
  state.events.push({ type: "switch", slot: slot.slot, player: q.id });
}

/**
 * Päättää, mitä hahmoa kukin ihmispelaaja ohjaa (päätökset 10 ja 15).
 * Joukkueen ainoa pelaaja vaihtaa hahmoa automaattisesti ja syöttönapista; lukittu pelaaja ei vaihda.
 */
export function updateControl(state: GameState, inputs: ReadonlyArray<InputState | undefined>) {
  const { ball } = state;
  const taken = new Set(state.slots.map((s) => s.playerId));

  for (const slot of state.slots) {
    if (slot.locked) continue;
    const input = inputs[slot.slot] ?? NO_INPUT;
    const current = byId(state, slot.playerId)!;
    const candidates = state.players.filter(
      (p) => p.team === slot.team && p.role === "field" && (p.id === current.id || !taken.has(p.id)),
    );
    const owner = byId(state, ball.owner);
    const receiver = byId(state, ball.passTo);
    let next: Player | undefined;

    if (owner && owner.team === slot.team) {
      if (candidates.includes(owner)) next = owner;
    } else if (receiver && receiver.team === slot.team && candidates.includes(receiver)) {
      next = receiver; // ohjaus siirtyy syötön vastaanottajalle jo pallon ollessa matkalla
    } else {
      const others = candidates.filter((p) => p.id !== current.id && p.mode !== "down");
      const nearest = others.sort((a, b) => distToBall(state, a) - distToBall(state, b))[0];
      if (nearest && input.pass && !current.held.pass) {
        next = nearest;
      } else if (
        nearest &&
        state.tick - slot.switchedAt >= secs(TUNING.autoSwitchDelay) &&
        current.mode !== "sliding" &&
        distToBall(state, current) - distToBall(state, nearest) > TUNING.autoSwitchMargin
      ) {
        next = nearest;
      }
    }
    if (next && next.id !== current.id) {
      taken.delete(current.id);
      taken.add(next.id);
      switchTo(state, slot, next, input);
    }
  }

  for (const p of state.players) p.controller = null;
  for (const slot of state.slots) byId(state, slot.playerId)!.controller = slot.slot;
}
