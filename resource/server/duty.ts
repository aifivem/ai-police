import { isNear, onClientCallback, online } from "@aicore-fivem/lib/server";
import { fail } from "@aicore-fivem/lib/shared";
import { EVENTS } from "common/police";
import { core, settings, stations } from "./content";

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
