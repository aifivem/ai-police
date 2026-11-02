import {
  bool,
  int,
  readBlipStyle,
  record,
  type BlipStyle,
} from "@aifivem/lib/shared";

/** The panel's Wanted sightings tab (`data/sightings.json`, server only). */
export interface Sightings {
  enabled: boolean;
  /** Seconds before the same player can be reported again. */
  cooldown: number;
  /** Chance in percent for a place the list does not name. */
  defaultChance: number;
  /** Chance in percent per place name. */
  chances: ReadonlyMap<string, number>;
  blip: BlipStyle;
}

export function readSightings(raw: unknown): Sightings {
  const s = record(raw);
  const chances = new Map<string, number>();
  for (const row of Array.isArray(s.places) ? s.places : []) {
    const r = record(row);
    // Rows left empty in the panel name no place.
    if (typeof r.place === "string" && r.place.trim())
      chances.set(r.place.trim().toLowerCase(), int(r.chance, 0, 0, 100));
  }
  return {
    enabled: bool(s.enabled, true),
    cooldown: int(s.cooldown, 60, 5, 3600),
    defaultChance: int(s.defaultChance, 100, 0, 100),
    chances,
    blip: readBlipStyle(s.blip, { sprite: 126, color: 1, scale: 1 }),
  };
}
