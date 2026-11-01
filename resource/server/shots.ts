import { dispatch, isNear, onClientEvent } from "@aicore-fivem/lib/server";
import { distance, readFinite } from "@aicore-fivem/lib/shared";
import { Locale } from "common";
import { EVENTS } from "common/police";
import { onDutyOfficer, settings } from "./content";

/** Shot alerts: at most one per 150 m area every 30 s, through ai-core's dispatch layer (whatever alert system runs). */
const recentShots: Array<{ x: number; y: number; at: number }> = [];
onClientEvent(
  EVENTS.shot,
  {
    args: ([x, y, z]) => {
      const point = [readFinite(x), readFinite(y), readFinite(z)] as const;
      return point.every((v) => v !== null)
        ? (point as readonly [number, number, number])
        : null;
    },
    rate: { count: 1, windowMs: 5000 },
  },
  (source, x, y, z) => {
    if (!settings.value.shotAlerts || onDutyOfficer(source)) return;
    if (!isNear(source, { x, y, z }, 50)) return;
    const now = Date.now();
    while (recentShots.length && now - (recentShots[0]?.at ?? 0) > 30_000)
      recentShots.shift();
    if (recentShots.some((a) => distance({ ...a, z: 0 }, { x, y, z: 0 }) < 150))
      return;
    recentShots.push({ x, y, at: now });
    dispatch.alert({
      code: "10-71",
      title: Locale("POLICE_ALERT_SHOTS"),
      coords: { x, y, z },
      source,
      jobs: settings.value.jobs,
      icon: "gun",
      blip: { sprite: 110, color: 1 },
      priority: "high",
    });
  },
);
