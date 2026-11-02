import { AdminPanel, online, resourceExport } from "@aifivem/lib/server";
import { readSettings, readStation } from "common/police";
import { policeSchema } from "./schema";
import { readSightings } from "./sightings/settings";

export const core = resourceExport("ai-core");
const panel = new AdminPanel(policeSchema);
/** Panel content, kept current by the panel. */
export const settings = panel.view("settings", readSettings);
export const stations = panel.records("stations", readStation);
export const sightings = panel.view("sightings", readSightings);
export const onDutyOfficer = (source: number): boolean =>
  online.onDutyIn(source, settings.value.jobs);
