import {
  AdminWorld,
  cache,
  callAction,
  getPlayerData,
  hasJob,
  input,
  Keybind,
  menu,
  nearestPlayer,
  nearestVehicle,
  notify,
  onMembershipChange,
  onPlayerData,
  onShot,
  player,
  Points,
  radial,
} from "@aicore-fivem/lib/client";
import { Locale } from "common";
import { EVENTS, readSettings, readStation, type Action } from "common/police";
import { restraints } from "./restraints";

const world = new AdminWorld(["settings", "stations"]);
const settings = world.view("settings", readSettings);
const stations = world.records("stations", readStation);

const onDuty = (): boolean => {
  const duty = getPlayerData("duty");
  return typeof duty === "string" && settings.value.jobs.includes(duty);
};

async function act(action: Action): Promise<void> {
  let target: number | null;
  let extra: unknown;
  if (action === "impound") {
    const vehicle = nearestVehicle(6);
    target = vehicle ? NetworkGetNetworkIdFromEntity(vehicle) : null;
  } else {
    target = nearestPlayer(3);
    if (action === "seat") {
      const vehicle = nearestVehicle(6);
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
            max: settings.value.maxFine,
          },
        ],
      });
      if (!values) return;
      extra = Math.floor(Number(values.amount));
    }
  }
  if (target === null) return notify(Locale("POLICE_ERR_NOBODY"), "error");
  await callAction(EVENTS.act, [action, target, extra], {
    fallback: "POLICE_ERR_FAR",
  });
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

// The same menu on whichever radial menu runs (ai-core keeps the item across radial restarts).
radial.add({
  id: "police",
  label: Locale("POLICE_MENU_TITLE"),
  icon: "id-card",
  canShow: () => onDuty() && !restraints.isCuffed,
  onPressed: () => void openMenu(),
});
onPlayerData("duty", () => radial.refresh());
world.onChange("settings", () => radial.refresh());

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
  for (const station of stations.values())
    points.add(`duty:${station.id}`, {
      coords: station.duty,
      label: Locale("POLICE_PROMPT_DUTY"),
      icon: "user-shield",
      radius: 1.5,
      canShow: () => hasJob(settings.value.jobs),
      blip: station.blip
        ? { ...station.blipStyle, label: station.label }
        : undefined,
      onPressed: () => toggleDuty(station.id),
    });
}
rebuild();
world.onChange("stations", rebuild);
onMembershipChange(() => points.refresh());

async function toggleDuty(stationId: string): Promise<void> {
  const r = await callAction(EVENTS.duty, [stationId], {
    fallback: "POLICE_ERR_NOT_POLICE",
  });
  if (r)
    notify(
      Locale(r.onDuty === true ? "POLICE_ON_DUTY" : "POLICE_OFF_DUTY"),
      "success",
    );
}

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
