import { onShot, player } from "@aicore-fivem/lib/client";
import { EVENTS } from "common/police";

// Shots by anyone are reported (the server ignores officers and throttles by area); one report per 5.5 s at most,
// inside the server's rate of one per 5 s.
let lastShot = -Infinity;
onShot(() => {
  const now = GetGameTimer();
  if (now - lastShot < 5500) return;
  lastShot = now;
  const { x, y, z } = player.coords();
  emitNet(EVENTS.shot, x, y, z);
});
