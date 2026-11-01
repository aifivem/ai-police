import { PlayerMap, PlayerState, stateBoolean } from "@aicore-fivem/lib/server";
import { PLAYER_BAGS } from "@aicore-fivem/shared";
import { EVENTS } from "common/police";

/** Who is cuffed and who escorts whom (server truth; clients only play it). */
export const cuffed = new PlayerMap<true>({
  // A dropped target frees the officer escorting it (escorted players are always cuffed).
  onDrop: (source) => {
    for (const [officer, target] of escorting)
      if (target === source) escorting.delete(officer);
  },
});
export const cuffedState = new PlayerState(PLAYER_BAGS.cuffed, stateBoolean);
export const deadState = new PlayerState(PLAYER_BAGS.dead, stateBoolean);
/** officer -> escorted player; a dropped officer lets go of the target. */
export const escorting = new PlayerMap<number>({
  onDrop: (_officer, target) => emitNet(EVENTS.escort, target, null),
});

export function setCuffed(target: number, on: boolean): void {
  if (on) cuffed.set(target, true);
  else cuffed.delete(target);
  cuffedState.set(target, on);
  emitNet(EVENTS.cuffed, target, on);
}
