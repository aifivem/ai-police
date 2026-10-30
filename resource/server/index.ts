import { PLAYER_BAGS } from "@aicore-fivem/shared";
import {
  AdminPanel,
  aiLog,
  aiLogChannels,
  coordsOf,
  dispatch,
  inventory,
  isNear,
  money,
  notify,
  onClientCallback,
  onClientEvent,
  online,
  optionalExport,
  PlayerMap,
  PlayerState,
  resourceExport,
  stateBoolean,
  vehicleNearPlayer,
} from "@aicore-fivem/lib/server";
import {
  distance,
  fail,
  readFinite,
  readId,
  readInt,
} from "@aicore-fivem/lib/shared";
import { Locale } from "common";
import { EVENTS, readSettings, readStation, type Action } from "common/police";
import { policeSchema } from "./schema";

const core = resourceExport("ai-core");
const panel = new AdminPanel(policeSchema);
/** Panel content, kept current by the panel. */
const settings = panel.view("settings", readSettings);
const stations = panel.records("stations", readStation);
aiLogChannels({ actions: {}, fines: {} });

const ACTIONS: readonly string[] = [
  "cuff",
  "escort",
  "seat",
  "unseat",
  "search",
  "fine",
  "impound",
] satisfies Action[];
const onDutyOfficer = (source: number): boolean => {
  const duty = online.dutyJob(source);
  return duty !== null && settings.value.jobs.includes(duty);
};

/** Who is cuffed and who escorts whom (server truth; clients only play it). */
const cuffed = new PlayerMap<true>({
  // A dropped target frees the officer escorting it (escorted players are always cuffed).
  onDrop: (source) => {
    for (const [officer, target] of escorting)
      if (target === source) escorting.delete(officer);
  },
});
const cuffedState = new PlayerState(PLAYER_BAGS.cuffed, stateBoolean);
const deadState = new PlayerState(PLAYER_BAGS.dead, stateBoolean);
/** officer -> escorted player; a dropped officer lets go of the target. */
const escorting = new PlayerMap<number>({
  onDrop: (_officer, target) => emitNet(EVENTS.escort, target, null),
});

function setCuffed(target: number, on: boolean): void {
  if (on) cuffed.set(target, true);
  else cuffed.delete(target);
  cuffedState.set(target, on);
  emitNet(EVENTS.cuffed, target, on);
}

onClientCallback(
  EVENTS.act,
  {
    args: ([action, target, extra]) =>
      ACTIONS.includes(String(action)) && readId(target) !== null
        ? [action as Action, target as number, extra]
        : null,
    lock: true,
  },
  (source, action, target, extra) => {
    if (!onDutyOfficer(source)) return fail("POLICE_ERR_DUTY");
    if (action === "impound") {
      const vehicle = vehicleNearPlayer(source, target, { metres: 6 });
      if (!vehicle) return fail("POLICE_ERR_FAR");
      const api = optionalExport("ai-vehicles");
      const id = api?.GetVehicleIdByEntity(vehicle);
      if (api && id !== null && id !== undefined)
        api.StoreVehicle(id, null, "impound");
      else DeleteEntity(vehicle);
      aiLog("actions", "impounded a vehicle", {
        source,
        metadata: { plate: GetVehicleNumberPlateText(vehicle) },
      });
      return { ok: true };
    }
    if (
      target === source ||
      !online.character(target) ||
      !isNear(source, coordsOf(target), 3)
    )
      return fail("POLICE_ERR_FAR");
    switch (action) {
      case "cuff":
        setCuffed(target, !cuffed.has(target));
        if (!cuffed.has(target) && escorting.get(source) === target) {
          escorting.delete(source);
          emitNet(EVENTS.escort, target, null);
        }
        break;
      case "escort": {
        if (!cuffed.has(target)) return fail("POLICE_ERR_NOT_CUFFED");
        const current = escorting.get(source);
        if (current === target) {
          escorting.delete(source);
          emitNet(EVENTS.escort, target, null);
        } else {
          escorting.set(source, target);
          emitNet(
            EVENTS.escort,
            target,
            NetworkGetNetworkIdFromEntity(GetPlayerPed(String(source))),
          );
        }
        break;
      }
      case "seat": {
        if (!cuffed.has(target)) return fail("POLICE_ERR_NOT_CUFFED");
        if (!vehicleNearPlayer(source, extra, { metres: 8 }))
          return fail("POLICE_ERR_FAR");
        escorting.delete(source);
        emitNet(EVENTS.escort, target, null);
        emitNet(EVENTS.seat, target, extra);
        break;
      }
      case "unseat":
        emitNet(EVENTS.seat, target, null);
        break;
      case "search":
        if (!cuffed.has(target) && deadState.get(target) !== true)
          return fail("POLICE_ERR_NOT_CUFFED");
        if (!inventory.openInventory(source, target))
          return fail("POLICE_ERR_FAR");
        break;
      case "fine": {
        const amount = readInt(extra, 1, settings.value.maxFine);
        if (amount === null) return fail("POLICE_ERR_FINE");
        const job = online.dutyJob(source) ?? "police";
        if (
          !money.transfer(
            { source: target, account: "bank" },
            { owner: "job", id: job, account: "bank" },
            amount,
            `fine:${job}`,
          )
        )
          return fail("POLICE_ERR_FINE_MONEY");
        notify(target, Locale("POLICE_FINED", amount), "warning", 8000);
        aiLog("fines", `fined $${amount}`, {
          source,
          target,
          metadata: { amount, job },
        });
        break;
      }
      default: {
        const _exhaustive: never = action;
        return _exhaustive;
      }
    }
    aiLog("actions", action, { source, target });
    return { ok: true };
  },
);

onClientCallback(
  EVENTS.duty,
  { args: ([id]) => (typeof id === "string" ? [id] : null), lock: true },
  (source, id) => {
    const station = stations.get(id);
    if (!station || !isNear(source, station.duty, 3))
      return fail("POLICE_ERR_FAR");
    const job = online
      .jobs(source)
      .find((name) => settings.value.jobs.includes(name));
    if (!job) return fail("POLICE_ERR_NOT_POLICE");
    const onDuty = online.dutyJob(source) !== job;
    core.SetDuty(source, onDuty ? job : null);
    return { ok: true, onDuty };
  },
);

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
