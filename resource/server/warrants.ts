import { characters, onClientCallback, warrants } from "@aifivem/lib/server";
import { fail, oneArg, readId, readText } from "@aifivem/lib/shared";
import { WARRANT_DURATIONS } from "@aifivem/shared";
import { EVENTS } from "common/police";
import { onDutyOfficer } from "./content";

/**
 * The job menu's Warrants entry: on-duty officers find a character (lib `characters.search`), list, issue and clear
 * ai-core's own warrants (lib `warrants`; ai-core logs every change with the officer). Whether they make a player
 * wanted for the sightings is ai-core's panel setting `warrants`.
 */

const DUTY = fail("POLICE_ERR_DUTY");
/** Database reads per officer: a menu is opened by hand. */
const RATE = { count: 20, windowMs: 10_000 };
const LENGTHS: ReadonlyArray<number | null> = WARRANT_DURATIONS.map(
  (d) => d.minutes,
);

onClientCallback(
  EVENTS.warrantSearch,
  { args: oneArg((v) => readText(v, 64)), rate: RATE },
  async (source, text) => {
    if (!onDutyOfficer(source)) return DUTY;
    if (text.length < 2) return fail("POLICE_ERR_WARRANT_SEARCH");
    const page = await characters.search(text);
    return {
      ok: true,
      people: page.characters.map((c) => ({
        charId: c.charId,
        citizenid: c.citizenid,
        name: `${c.firstname} ${c.lastname}`,
      })),
    };
  },
);

onClientCallback(
  EVENTS.warrantsOf,
  { args: oneArg(readId), rate: RATE },
  async (source, charId) => {
    if (!onDutyOfficer(source)) return DUTY;
    const list = await warrants.of({ charId });
    if (!list) return fail("POLICE_ERR_WARRANT_PERSON");
    return { ok: true, warrants: list, now: Date.now() };
  },
);

onClientCallback(
  EVENTS.warrantList,
  {
    args: ([cursor]): [number | null] | null => {
      if (cursor == null) return [null];
      const id = readId(cursor);
      return id === null ? null : [id];
    },
    rate: RATE,
  },
  async (source, cursor) => {
    if (!onDutyOfficer(source)) return DUTY;
    const page = await warrants.page(cursor);
    return { ok: true, ...page, now: Date.now() };
  },
);

onClientCallback(
  EVENTS.warrantAdd,
  {
    args: ([charId, reason, minutes]) => {
      const id = readId(charId);
      const why = readText(reason, 255);
      // One of the menu's lengths; null = until cleared.
      const mins = minutes == null ? null : readId(minutes);
      return id === null ||
        why === null ||
        (minutes != null && mins === null) ||
        !LENGTHS.includes(mins)
        ? null
        : [id, why, mins];
    },
    lock: true,
    rate: RATE,
  },
  async (source, charId, reason, minutes) => {
    if (!onDutyOfficer(source)) return DUTY;
    if (reason.length < 3) return fail("POLICE_ERR_WARRANT_REASON");
    const result = await warrants.add({
      target: { charId },
      reason,
      minutes,
      by: source,
    });
    if (result.ok) return { ok: true };
    return fail(
      result.error === "WARRANT_ERR_FULL"
        ? "POLICE_ERR_WARRANT_FULL"
        : "POLICE_ERR_WARRANT",
    );
  },
);

onClientCallback(
  EVENTS.warrantClear,
  { args: oneArg(readId), lock: true, rate: RATE },
  async (source, id) => {
    if (!onDutyOfficer(source)) return DUTY;
    return (await warrants.clear(id, source))
      ? { ok: true }
      : fail("POLICE_ERR_WARRANT_GONE");
  },
);
