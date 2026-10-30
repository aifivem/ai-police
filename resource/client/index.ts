import {
  AdminWorld,
  cache,
  createBlip,
  getPlayerData,
  input,
  Keybind,
  loadLocaleTexts,
  menu,
  notify,
  onCache,
  onServerEvent,
  optionalExport,
  player,
  Points,
  triggerServerCallback,
} from "@aicore-fivem/lib/client";
import { Locale } from "common";
import {
  EVENTS,
  readSettings,
  readStations,
  type Action,
  type Alert,
} from "common/police";
import { restraints } from "./restraints";

const world = new AdminWorld(["settings", "stations"]);
const texts = loadLocaleTexts();
const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;
const errorText = (v: unknown, fallback: string): string => {
  const key = isObj(v) && typeof v.error === "string" ? v.error : fallback;
  return texts[key] ?? key;
};

/** The closest other player within `metres`, as a server id. */
function closestPlayer(metres: number): number | null {
  const [x = 0, y = 0, z = 0] = GetEntityCoords(cache.ped, false);
  let best: number | null = null;
  let bestDistance = metres;
  for (const player of GetActivePlayers() as number[]) {
    if (player === cache.playerId) continue;
    const [px = 0, py = 0, pz = 0] = GetEntityCoords(
      GetPlayerPed(player),
      false,
    );
    const d = Math.hypot(px - x, py - y, pz - z);
    if (d < bestDistance) [best, bestDistance] = [GetPlayerServerId(player), d];
  }
  return best;
}

function closestVehicle(metres: number): number | null {
  const { x, y, z } = player.coords();
  let best: number | null = null;
  let bestDistance = metres;
  for (const vehicle of GetGamePool("CVehicle") as number[]) {
    const [vx = 0, vy = 0, vz = 0] = GetEntityCoords(vehicle, false);
    const d = Math.hypot(vx - x, vy - y, vz - z);
    if (d < bestDistance && NetworkGetEntityIsNetworked(vehicle))
      [best, bestDistance] = [vehicle, d];
  }
  return best;
}

const settings = () => readSettings(world.get("settings"));
const onDuty = (): boolean => {
  const duty = getPlayerData("duty");
  return typeof duty === "string" && settings().jobs.includes(duty);
};

async function act(action: Action): Promise<void> {
  let target: number | null;
  let extra: unknown;
  if (action === "impound") {
    const vehicle = closestVehicle(6);
    target = vehicle ? NetworkGetNetworkIdFromEntity(vehicle) : null;
  } else {
    target = closestPlayer(3);
    if (action === "seat") {
      const vehicle = closestVehicle(6);
      extra = vehicle ? NetworkGetNetworkIdFromEntity(vehicle) : null;
    }
    if (action === "fine" && target !== null) {
      const values = await input({
        title: Locale("POLICE_FINE_TITLE"),
        confirm: Locale("POLICE_FINE_CONFIRM"),
        fields: [
          {
            name: "amount",
            label: Locale("POLICE_FINE_AMOUNT"),
            type: "number",
            min: 1,
            max: settings().maxFine,
          },
        ],
      });
      if (!values) return;
      extra = Math.floor(Number(values.amount));
    }
  }
  if (target === null) return notify(Locale("POLICE_ERR_NOBODY"), "error");
  const result: unknown = await triggerServerCallback(EVENTS.act, [
    action,
    target,
    extra,
  ]).catch(() => null);
  if (!(isObj(result) && result.ok === true))
    notify(errorText(result, "POLICE_ERR_FAR"), "error");
}

const ACTIONS = [
  { id: "cuff", icon: "lock", label: "POLICE_ACTION_CUFF" },
  { id: "escort", icon: "user", label: "POLICE_ACTION_ESCORT" },
  { id: "seat", icon: "car-side", label: "POLICE_ACTION_SEAT" },
  { id: "unseat", icon: "car-rear", label: "POLICE_ACTION_UNSEAT" },
  { id: "search", icon: "box-open", label: "POLICE_ACTION_SEARCH" },
  { id: "fine", icon: "money-bill-wave", label: "POLICE_ACTION_FINE" },
  { id: "impound", icon: "square-parking", label: "POLICE_ACTION_IMPOUND" },
] as const satisfies ReadonlyArray<{ id: Action; icon: string; label: string }>;

async function openMenu(): Promise<void> {
  if (!onDuty() || restraints.isCuffed || IsEntityDead(cache.ped)) return;
  const picked = await menu({
    title: Locale("POLICE_MENU_TITLE"),
    items: ACTIONS.map((a) => ({
      id: a.id,
      label: Locale(a.label),
      icon: a.icon,
    })),
  });
  const action = ACTIONS.find((a) => a.id === picked)?.id;
  if (action) await act(action);
}

// The same menu from the radial wheel while ai-radialmenu runs (it drops the item when this resource stops).
function addRadial(): void {
  optionalExport("ai-radialmenu")?.AddItem({
    id: "police",
    label: Locale("POLICE_MENU_TITLE"),
    icon: "id-card",
    onSelect: () => void openMenu(),
  });
}
addRadial();
on(
  "onClientResourceStart",
  (resource: string) => resource === "ai-radialmenu" && addRadial(),
);

new Keybind({
  name: "police_menu",
  description: Locale("KEYBIND_MENU"),
  defaultKey: "F6",
  onPressed: () => void openMenu(),
});

/** Duty stations: a point each, with blips. */
const points = new Points();
function rebuild(): void {
  points.clear();
  for (const station of readStations(world.get("stations")).values())
    points.add(`duty:${station.id}`, {
      coords: station.duty,
      label: Locale("POLICE_PROMPT_DUTY"),
      icon: "user-shield",
      radius: 1.5,
      blip: station.blip
        ? { sprite: 60, color: 29, scale: 0.7, label: station.label }
        : undefined,
      onPressed: () => toggleDuty(station.id),
    });
}
rebuild();
world.onChange("stations", rebuild);

async function toggleDuty(stationId: string): Promise<void> {
  const r: unknown = await triggerServerCallback(EVENTS.duty, [
    stationId,
  ]).catch(() => null);
  if (isObj(r) && r.ok === true)
    notify(
      Locale(r.onDuty === true ? "POLICE_ON_DUTY" : "POLICE_OFF_DUTY"),
      "success",
    );
  else notify(errorText(r, "POLICE_ERR_NOT_POLICE"), "error");
}

// Shots by anyone are reported (the server ignores officers and throttles by area); checked only while armed.
let shotTimer: ReturnType<typeof setInterval> | null = null;
onCache("weapon", (weapon) => {
  if (shotTimer) clearInterval(shotTimer);
  shotTimer =
    weapon === false
      ? null
      : setInterval(() => {
          if (!IsPedShooting(cache.ped)) return;
          const { x, y, z } = player.coords();
          const [street] = GetStreetNameAtCoord(x, y, z);
          emitNet(EVENTS.shot, x, y, z, GetStreetNameFromHashKey(street ?? 0));
        }, 500);
});

onServerEvent(
  EVENTS.alert,
  {
    args: ([a]) =>
      isObj(a) &&
      typeof a.x === "number" &&
      typeof a.y === "number" &&
      typeof a.z === "number"
        ? [
            {
              id: Number(a.id),
              kind:
                a.kind === "custom" ? ("custom" as const) : ("shots" as const),
              x: a.x,
              y: a.y,
              z: a.z,
              text: String(a.text ?? "").slice(0, 120),
            },
          ]
        : null,
  },
  (alert: Alert) => {
    const text =
      alert.kind === "custom"
        ? alert.text
        : Locale("POLICE_ALERT_SHOTS", alert.text);
    const blip = createBlip({
      coords: alert,
      label: text,
      sprite: 432,
      color: 1,
      scale: 1,
      shortRange: false,
    });
    SetBlipFlashes(blip, true);
    notify(text, "warning", 8000);
    setTimeout(() => RemoveBlip(blip), settings().alertSeconds * 1000);
  },
);
