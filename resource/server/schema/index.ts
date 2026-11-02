import type { PanelSchema } from "@aifivem/shared";
import { settingsFile, settingsTab } from "./settings";
import { sightingsFile, sightingsTab } from "./sightings";
import { stationsFile, stationsTab } from "./stations";

/** ai-police's panel: which jobs are police, fines, alerts, wanted sightings and the duty stations. */
export const policeSchema: PanelSchema = {
  title: "ADMIN_TITLE",
  icon: "id-card",
  files: {
    settings: settingsFile,
    stations: stationsFile,
    sightings: sightingsFile,
  },
  tabs: [settingsTab, sightingsTab, stationsTab],
};
