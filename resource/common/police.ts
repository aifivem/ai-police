import { bool, int, num, record, str } from "@aicore-fivem/lib/shared";

/** ai-police's contracts and panel content. No natives. */

export type Action =
  "cuff" | "escort" | "seat" | "unseat" | "search" | "fine" | "impound";

export const EVENTS = {
  /** Callback: (action, target serverId | vehicle netId, extra?) -> { ok } an officer acts on the closest player / vehicle. */
  act: "ai-police:act",
  /** Callback: (stationId) -> { ok, onDuty } toggle duty at a station. */
  duty: "ai-police:duty",
  /** Client -> server: (x, y, z) the player fired a weapon (rate limited; only non-police count). */
  shot: "ai-police:shot",
  /** Server -> target: (cuffed: boolean). */
  cuffed: "ai-police:client:cuffed",
  /** Server -> target: (officer netId | null) attach to the officer, or let go. */
  escort: "ai-police:client:escort",
  /** Server -> target: (vehicle netId | null) sit in the back of a vehicle, or get out. */
  seat: "ai-police:client:seat",
} as const;

export interface Settings {
  jobs: string[];
  maxFine: number;
  shotAlerts: boolean;
}

export interface Station {
  id: string;
  label: string;
  duty: { x: number; y: number; z: number };
  blip: boolean;
  blipStyle: { sprite: number; color: number; scale: number };
}

const names = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

export function readSettings(raw: unknown): Settings {
  const s = record(raw);
  return {
    jobs: names(s.jobs).length ? names(s.jobs) : ["police"],
    maxFine: int(s.maxFine, 50_000, 0, 10_000_000),
    shotAlerts: bool(s.shotAlerts, true),
  };
}

/** One duty station of the panel's records file (`panel.records` / `world.records`). */
export function readStation(id: string, v: Record<string, unknown>): Station {
  const d = record(v.duty);
  const style = record(v.blipStyle);
  return {
    id,
    label: str(v.label, id, 48),
    duty: { x: num(d.x, 0), y: num(d.y, 0), z: num(d.z, 0) },
    blip: bool(v.blip, true),
    blipStyle: {
      sprite: int(style.sprite, 60, 0, 1000),
      color: int(style.color, 29, 0, 100),
      scale: num(style.scale, 0.7, 0.3, 2),
    },
  };
}
