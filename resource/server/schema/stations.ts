import type { FileSpec, TabSpec } from "@aifivem/shared";
import { BLIP_STYLE_FIELDS } from "@aifivem/lib/shared";

export const stationsFile: FileSpec = {
  kind: "records",
  sync: "all",
  labelPath: "label",
  newRecord: {
    label: "",
    duty: { x: 0, y: 0, z: 0 },
    blip: true,
    blipStyle: { sprite: 60, color: 29, scale: 0.7 },
  },
  sections: {
    label: { type: "text", min: 1, max: 48 },
    duty: { type: "vec3" },
    blip: { type: "bool" },
    blipStyle: {
      type: "object",
      optional: true,
      fields: BLIP_STYLE_FIELDS,
    },
  },
};

export const stationsTab: TabSpec = {
  id: "stations",
  file: "stations",
  icon: "location-dot",
  label: "ADMIN_TAB_STATIONS",
  desc: "ADMIN_TAB_STATIONS_DESC",
  createLabel: "ADMIN_NEW_STATION",
  deleteLabel: "ADMIN_DELETE_STATION",
  cards: [
    {
      icon: "location-dot",
      title: "ADMIN_C_STATION",
      desc: "ADMIN_C_STATION_DESC",
      fields: [
        {
          widget: "text",
          path: "label",
          suggest: { from: "duty" },
          label: "ADMIN_F_LABEL",
          placeholder: "ADMIN_P_LABEL",
        },
        {
          widget: "point",
          path: "duty",
          label: "ADMIN_F_DUTY",
          hint: "ADMIN_H_DUTY",
          ground: true,
        },
        { widget: "switch", path: "blip", label: "ADMIN_F_BLIP" },
        {
          widget: "blip",
          path: "blipStyle",
          label: "ADMIN_F_BLIP_STYLE",
          showIf: { path: "blip", values: [true] },
        },
      ],
    },
  ],
};
