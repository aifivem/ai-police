import type { PanelSchema } from "@aicore-fivem/shared";

/** ai-police's panel: which jobs are police, fines, alerts and the duty stations. */
export const policeSchema: PanelSchema = {
  title: "ADMIN_TITLE",
  icon: "id-card",
  files: {
    settings: {
      kind: "settings",
      sync: "all",
      sections: {
        jobs: {
          type: "names",
          lookup: "job",
          max: 10,
          itemMax: 32,
          pattern: "^[a-z0-9_]{2,32}$",
        },
        maxFine: { type: "number", min: 0, max: 10_000_000, integer: true },
        shotAlerts: { type: "bool" },
      },
    },
    stations: {
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
          fields: {
            sprite: { type: "number", min: 0, max: 1000, integer: true },
            color: { type: "number", min: 0, max: 100, integer: true },
            scale: { type: "number", min: 0.3, max: 2 },
          },
        },
      },
    },
  },
  tabs: [
    {
      id: "settings",
      file: "settings",
      icon: "id-card",
      label: "ADMIN_TAB_SETTINGS",
      desc: "ADMIN_TAB_SETTINGS_DESC",
      cards: [
        {
          icon: "id-card",
          title: "ADMIN_C_POLICE",
          desc: "ADMIN_C_POLICE_DESC",
          fields: [
            {
              widget: "tags",
              lookup: "job",
              path: "jobs",
              label: "ADMIN_F_JOBS",
              hint: "ADMIN_H_JOBS",
              placeholder: "ADMIN_P_JOBS",
            },
            {
              widget: "number",
              path: "maxFine",
              label: "ADMIN_F_MAX_FINE",
              hint: "ADMIN_H_MAX_FINE",
              min: 0,
              max: 10_000_000,
              step: 500,
              unit: "$",
            },
            {
              widget: "switch",
              path: "shotAlerts",
              label: "ADMIN_F_SHOT_ALERTS",
              hint: "ADMIN_H_SHOT_ALERTS",
            },
          ],
        },
      ],
    },
    {
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
    },
  ],
};
