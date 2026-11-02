import type { FileSpec, TabSpec } from "@aifivem/shared";

export const settingsFile: FileSpec = {
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
};

export const settingsTab: TabSpec = {
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
};
