import {
  callAction,
  hasJob,
  notify,
  onMembershipChange,
  Points,
} from "@aicore-fivem/lib/client";
import { RecordObjects } from "@aicore-fivem/lib/shared";
import { Locale } from "common";
import { EVENTS, readStation } from "common/police";
import { settings, world } from "./world";

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
