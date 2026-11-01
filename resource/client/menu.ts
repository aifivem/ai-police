import {
  callAction,
  input,
  Keybind,
  medical,
  menu,
  nearestPlayer,
  nearestVehicle,
  notify,
  onDutyIn,
  onPlayerData,
  radial,
} from "@aicore-fivem/lib/client";
import { Locale } from "common";
import { EVENTS, type Action } from "common/police";
import { restraints } from "./restraints";
import { settings, world } from "./world";

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
  if (!onDuty() || restraints.isCuffed || medical.isDead()) return;
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
