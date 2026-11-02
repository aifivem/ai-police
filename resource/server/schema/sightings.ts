import type { FileSpec, TabSpec } from "@aifivem/shared";
import { BLIP_STYLE_FIELDS } from "@aifivem/lib/shared";

const CHANCE = { type: "number", min: 0, max: 100, integer: true } as const;

/** Server-only: players never need the chances. */
export const sightingsFile: FileSpec = {
  kind: "settings",
  sync: "admin",
  sections: {
    enabled: { type: "bool" },
    cooldown: { type: "number", min: 5, max: 3600, integer: true },
    defaultChance: CHANCE,
    places: {
      type: "list",
      min: 0,
      max: 30,
      of: {
        type: "object",
        fields: {
          place: {
            type: "text",
            min: 0,
            max: 32,
            pattern: "^([a-z0-9_-]{2,32})?$",
          },
          chance: CHANCE,
        },
      },
    },
    blip: { type: "object", fields: BLIP_STYLE_FIELDS },
  },
  defaults: {
    enabled: true,
    cooldown: 60,
    defaultChance: 100,
    places: [
      { place: "atm", chance: 100 },
      { place: "bank", chance: 100 },
      { place: "shop", chance: 60 },
      { place: "clothing", chance: 20 },
      { place: "garage", chance: 60 },
      { place: "phone", chance: 1 },
    ],
    blip: { sprite: 126, color: 1, scale: 1 },
  },
};

const chanceField = {
  widget: "number",
  min: 0,
  max: 100,
  step: 5,
  unit: "%",
} as const;

export const sightingsTab: TabSpec = {
  id: "sightings",
  file: "sightings",
  icon: "eye",
  label: "ADMIN_TAB_SIGHTINGS",
  desc: "ADMIN_TAB_SIGHTINGS_DESC",
  cards: [
    {
      icon: "eye",
      title: "ADMIN_C_SIGHTINGS",
      desc: "ADMIN_C_SIGHTINGS_DESC",
      fields: [
        {
          widget: "switch",
          path: "enabled",
          label: "ADMIN_F_SIGHTINGS",
          hint: "ADMIN_H_SIGHTINGS",
        },
        {
          widget: "number",
          path: "cooldown",
          label: "ADMIN_F_SIGHT_COOLDOWN",
          hint: "ADMIN_H_SIGHT_COOLDOWN",
          min: 5,
          max: 3600,
          step: 5,
          unit: "s",
        },
        {
          ...chanceField,
          path: "defaultChance",
          label: "ADMIN_F_SIGHT_DEFAULT",
          hint: "ADMIN_H_SIGHT_DEFAULT",
        },
        { widget: "blip", path: "blip", label: "ADMIN_F_SIGHT_BLIP" },
      ],
    },
    {
      icon: "location-dot",
      title: "ADMIN_C_SIGHT_PLACES",
      desc: "ADMIN_C_SIGHT_PLACES_DESC",
      fields: [
        {
          widget: "list",
          path: "places",
          label: "ADMIN_F_SIGHT_PLACES",
          addLabel: "ADMIN_ADD_SIGHT_PLACE",
          min: 0,
          max: 30,
          newRow: { place: "", chance: 50 },
          rows: [
            {
              widget: "text",
              path: "place",
              label: "ADMIN_F_SIGHT_PLACE",
              placeholder: "ADMIN_P_SIGHT_PLACE",
            },
            { ...chanceField, path: "chance", label: "ADMIN_F_SIGHT_CHANCE" },
          ],
        },
      ],
    },
  ],
};
