import { AdminPanel, aiLog, aiLogChannels, inventory, notify, onClientCallback, onClientEvent, optionalExport, registerExport, resourceExport } from "@aicore-fivem/lib/server";
import { Locale } from "common";
import { EVENTS, readSettings, readStations, type Action, type Alert } from "common/police";
import { policeSchema } from "./schema";

const core = resourceExport("ai-core");
const panel = new AdminPanel(policeSchema);
/** Panel content, parsed again after every change. */
const content = { settings: readSettings(panel.get("settings")), stations: readStations(panel.get("stations")) };
panel.onChange("settings", () => (content.settings = readSettings(panel.get("settings"))));
panel.onChange("stations", () => (content.stations = readStations(panel.get("stations"))));
aiLogChannels({ actions: {}, fines: {} });

const fail = (error: string) => ({ ok: false as const, error });
const pos = (source: number) => {
  const [x = 0, y = 0, z = 0] = GetEntityCoords(GetPlayerPed(String(source)));
  return { x, y, z };
};
const near = (a: number, b: number, metres: number): boolean => {
  const p = pos(a);
  const q = pos(b);
  return Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z) <= metres;
};
const onDutyOfficer = (source: number): boolean => {
  const duty = core.GetDutyJob(source);
  return duty !== null && content.settings.jobs.includes(duty);
};

/** Who is cuffed and who escorts whom (server truth; clients only play it). */
const cuffed = new Set<number>();
const escorting = new Map<number, number>();

function setCuffed(target: number, on: boolean): void {
  if (on) cuffed.add(target);
  else cuffed.delete(target);
  Player(target).state.set("cuffed", on, true);
  emitNet(EVENTS.cuffed, target, on);
}

onClientCallback(
  EVENTS.act,
  {
    args: ([action, target, extra]) =>
      ["cuff", "escort", "seat", "unseat", "search", "fine", "impound"].includes(String(action)) && typeof target === "number" ? [action as Action, target, extra] : null,
    lock: true,
  },
  (source, action, target, extra) => {
    if (!onDutyOfficer(source)) return fail("POLICE_ERR_DUTY");
    if (action === "impound") {
      const vehicle = NetworkGetEntityFromNetworkId(target);
      if (!vehicle || !DoesEntityExist(vehicle) || GetEntityType(vehicle) !== 2) return fail("POLICE_ERR_FAR");
      const [vx = 0, vy = 0, vz = 0] = GetEntityCoords(vehicle);
      const p = pos(source);
      if (Math.hypot(p.x - vx, p.y - vy, p.z - vz) > 6) return fail("POLICE_ERR_FAR");
      const api = optionalExport("ai-vehicles");
      const id = api?.GetVehicleIdByEntity(vehicle);
      if (api && id !== null && id !== undefined) api.StoreVehicle(id, null, "impound");
      else DeleteEntity(vehicle);
      aiLog("actions", "impounded a vehicle", { source, metadata: { plate: GetVehicleNumberPlateText(vehicle) } });
      return { ok: true };
    }
    if (target === source || !core.GetCharacter(target) || !near(source, target, 3)) return fail("POLICE_ERR_FAR");
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
          emitNet(EVENTS.escort, target, NetworkGetNetworkIdFromEntity(GetPlayerPed(String(source))));
        }
        break;
      }
      case "seat": {
        if (!cuffed.has(target) || typeof extra !== "number") return fail("POLICE_ERR_NOT_CUFFED");
        const vehicle = NetworkGetEntityFromNetworkId(extra);
        if (!vehicle || !DoesEntityExist(vehicle)) return fail("POLICE_ERR_FAR");
        escorting.delete(source);
        emitNet(EVENTS.escort, target, null);
        emitNet(EVENTS.seat, target, extra);
        break;
      }
      case "unseat":
        emitNet(EVENTS.seat, target, null);
        break;
      case "search":
        if (!cuffed.has(target) && !Player(target).state.dead) return fail("POLICE_ERR_NOT_CUFFED");
        if (!inventory.openInventory(source, target)) return fail("POLICE_ERR_FAR");
        break;
      case "fine": {
        const amount = typeof extra === "number" && Number.isInteger(extra) ? extra : 0;
        if (amount <= 0 || amount > content.settings.maxFine) return fail("POLICE_ERR_FINE");
        const job = core.GetDutyJob(source) ?? "police";
        if (!core.RemoveMoney(target, "bank", amount, `fine:${job}`)) return fail("POLICE_ERR_FINE_MONEY");
        core.AddSharedMoney("job", job, "bank", amount, `fine by ${source}`);
        notify(target, Locale("POLICE_FINED", amount), "warning", 8000);
        aiLog("fines", `fined $${amount}`, { source, target, metadata: { amount, job } });
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

onClientCallback(EVENTS.duty, { args: ([id]) => (typeof id === "string" ? [id] : null), lock: true }, (source, id) => {
  const station = content.stations.get(id);
  const p = pos(source);
  if (!station || Math.hypot(p.x - station.duty.x, p.y - station.duty.y, p.z - station.duty.z) > 3) return fail("POLICE_ERR_FAR");
  const job = (core.GetJobs(source) ?? []).find((m) => content.settings.jobs.includes(m.job))?.job;
  if (!job) return fail("POLICE_ERR_NOT_POLICE");
  const onDuty = core.GetDutyJob(source) !== job;
  core.SetDuty(source, onDuty ? job : null);
  return { ok: true, onDuty };
});

const sendAlert = (alert: Alert) => {
  for (const officer of core.GetLoadedSources()) if (onDutyOfficer(officer)) emitNet(EVENTS.alert, officer, alert);
};
/** Other resources' alerts (robberies): a translated text at a place, to on-duty officers. */
registerExport("SendAlert", (x: unknown, y: unknown, z: unknown, text: unknown) => {
  if (typeof x === "number" && typeof y === "number" && typeof z === "number" && typeof text === "string") sendAlert({ id: ++alertId, kind: "custom", x, y, z, text: text.slice(0, 120) });
});

/** Shot alerts: at most one per 150 m area every 30 s, sent to on-duty officers only. */
const recentAlerts: Array<{ x: number; y: number; at: number }> = [];
let alertId = 0;
onClientEvent(
  EVENTS.shot,
  { args: ([x, y, z, street]) => (typeof x === "number" && typeof y === "number" && typeof z === "number" && typeof street === "string" ? [x, y, z, street.slice(0, 64)] : null), rate: { count: 1, windowMs: 5000 } },
  (source, x, y, z, street) => {
    if (!content.settings.shotAlerts || onDutyOfficer(source)) return;
    const p = pos(source);
    if (Math.hypot(p.x - x, p.y - y) > 50) return;
    const now = Date.now();
    while (recentAlerts.length && now - (recentAlerts[0]?.at ?? 0) > 30_000) recentAlerts.shift();
    if (recentAlerts.some((a) => Math.hypot(a.x - x, a.y - y) < 150)) return;
    recentAlerts.push({ x, y, at: now });
    sendAlert({ id: ++alertId, kind: "shots", x, y, z, text: street });
  },
);

on("playerDropped", () => {
  const source = Number(globalThis.source);
  cuffed.delete(source);
  escorting.delete(source);
  for (const [officer, target] of escorting) if (target === source) escorting.delete(officer);
});
