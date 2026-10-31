import {
  AdminWorld,
  cache,
  callAction,
  hasJob,
  input,
  Keybind,
  menu,
  nearestPlayer,
  nearestVehicle,
  notify,
  onDutyIn,
  onMembershipChange,
  onPlayerData,
  onShot,
  player,
  Points,
  radial,
} from "@aicore-fivem/lib/client";
import { RecordObjects } from "@aicore-fivem/lib/shared";
import { Locale } from "common";
import { EVENTS, readSettings, readStation, type Action } from "common/police";
import { restraints } from "./restraints";

const world = new AdminWorld(["settings", "stations"]);
const settings = world.view("settings", readSettings);

/** On duty in one of the panel's police jobs (the server's `online.onDutyIn` with the same list). */
const onDuty = (): boolean => onDutyIn(settings.value.jobs);

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
    if (action === "jail" && target !== null) {
      const values = await input({
        title: Locale("POLICE_JAIL_TITLE"),
        confirm: Locale("POLICE_JAIL_CONFIRM"),
        fields: [
          {
            name: "minutes",
            label: Locale("POLICE_JAIL_MINUTES"),
            type: "number",
            min: 1,
            max: 10_000,
          },
        ],
      });
      if (!values) return;
      extra = Math.floor(Number(values.minutes));
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
  { id: "jail", icon: "handcuffs", label: "POLICE_ACTION_JAIL" },
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

/** Duty stations: a point each, with blips; an edited station rebuilds only its own. */
const points = new Points();
new RecordObjects(world, "stations", readStation, (id, station) => {
  points.add(`duty:${id}`, {
    coords: station.duty,
    label: Locale("POLICE_PROMPT_DUTY"),
    icon: "user-shield",
    radius: 1.5,
    canShow: () => hasJob(settings.value.jobs),
    blip: station.blip
      ? { ...station.blipStyle, label: station.label }
      : undefined,
    onPressed: () => toggleDuty(id),
  });
  return () => points.remove(`duty:${id}`);
});
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
