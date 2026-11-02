import { isRecord } from "@aifivem/lib/shared";
import { Locale } from "common";

/** Replies of the warrant callbacks, checked field by field (`callAction` leaves extra fields unchecked). */

export interface Person {
  charId: number;
  citizenid: string;
  name: string;
}

export interface WarrantItem {
  id: number;
  reason: string;
  by: string;
  expires: number | null;
  /** Rows of the active list carry their character. */
  person: Person | null;
}

const whole = (v: unknown): number | null =>
  typeof v === "number" && Number.isSafeInteger(v) && v > 0 ? v : null;
const text = (v: unknown): string | null => (typeof v === "string" ? v : null);

function toPerson(v: Record<string, unknown>): Person | null {
  const charId = whole(v.charId);
  const citizenid = text(v.citizenid);
  const name = text(v.name);
  return charId === null || citizenid === null || name === null
    ? null
    : { charId, citizenid, name };
}

export function readPeople(value: unknown): Person[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((v) => {
    const person = isRecord(v) ? toPerson(v) : null;
    return person ? [person] : [];
  });
}

export function readWarrants(value: unknown): WarrantItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((v): WarrantItem[] => {
    if (!isRecord(v)) return [];
    const id = whole(v.id);
    const reason = text(v.reason);
    if (id === null || reason === null) return [];
    return [
      {
        id,
        reason,
        by: text(v.by) ?? "",
        expires: whole(v.expires),
        person: toPerson(v),
      },
    ];
  });
}

/** "until cleared", "2 d 5 h left", "3 h 10 min left", "12 min left" (from the server's `now`). */
export function timeLeft(expires: number | null, now: number): string {
  if (expires === null) return Locale("POLICE_WARRANT_UNTIL_CLEARED");
  const minutes = Math.max(1, Math.ceil((expires - now) / 60_000));
  const d = Math.floor(minutes / 1440);
  const h = Math.floor((minutes % 1440) / 60);
  if (d > 0) return Locale("POLICE_WARRANT_LEFT_DAYS", d, h);
  if (h > 0) return Locale("POLICE_WARRANT_LEFT_HOURS", h, minutes % 60);
  return Locale("POLICE_WARRANT_LEFT_MINUTES", minutes);
}
