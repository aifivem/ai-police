import {
  Cooldowns,
  dispatch,
  mdt,
  online,
  plateOf,
  registerExport,
  vehicleOf,
} from "@aifivem/lib/server";
import { readId, readText, rollChance } from "@aifivem/lib/shared";
import { Locale } from "common";
import { settings, sightings } from "../content";

const cooldowns = new Cooldowns();

/** "Male, vehicle plate 12ABC345" / "Female, on foot": alert systems that read `source` add more (vehicle, colour). */
function describe(source: number, sex: "male" | "female"): string {
  const sexText = Locale(
    sex === "female" ? "POLICE_SEX_FEMALE" : "POLICE_SEX_MALE",
  );
  const vehicle = vehicleOf(source);
  return vehicle
    ? Locale("POLICE_SIGHTING_VEHICLE", sexText, plateOf(vehicle))
    : Locale("POLICE_SIGHTING_ON_FOOT", sexText);
}

/** A place saw the player: a wanted character may be reported to the police jobs, at most once per cooldown. */
async function reportSighting(source: number, place: string): Promise<void> {
  const rules = sightings.value;
  const character = online.character(source);
  if (!rules.enabled || !character) return;
  // Taken before the warrant check, like the original: one roll per cooldown, whatever the place.
  if (!cooldowns.take(source, rules.cooldown * 1000)) return;
  // The MDT's and / or ai-core's own warrants, by ai-core's panel setting `warrants`.
  if (!(await mdt.hasWarrant(character.citizenid))) return;
  // The answer may come later: the same character must still be in the game.
  if (online.character(source)?.citizenid !== character.citizenid) return;
  if (!rollChance(rules.chances.get(place) ?? rules.defaultChance)) return;
  dispatch.alert({
    title: Locale("POLICE_ALERT_WANTED", online.name(source)),
    message: describe(source, character.sex),
    source,
    jobs: settings.value.jobs,
    icon: "skull-crossbones",
    blip: rules.blip,
    priority: "high",
  });
}

registerExport("ReportSighting", (rawSource: unknown, rawPlace: unknown) => {
  const source = readId(rawSource);
  const place = readText(rawPlace, 32)?.toLowerCase();
  if (source !== null && place) void reportSighting(source, place);
});
