import {
  aiLog,
  billing,
  coordsOf,
  garages,
  inventory,
  isNear,
  mdt,
  notify,
  online,
  plateOf,
  prison,
  vehicleNearPlayer,
} from "@aicore-fivem/lib/server";
import { fail, readInt } from "@aicore-fivem/lib/shared";
import { Locale } from "common";
import { EVENTS, type Action } from "common/police";
import { onDutyOfficer, settings } from "../content";
import { cuffed, deadState, escorting, setCuffed } from "./restraints";

/** One officer action on the nearest player (or vehicle for `impound`). */
export function act(
  source: number,
  action: Action,
  target: number,
  extra: unknown,
) {
  if (!onDutyOfficer(source)) return fail("POLICE_ERR_DUTY");
  if (action === "impound") {
    const vehicle = vehicleNearPlayer(source, target, { metres: 6 });
    if (!vehicle) return fail("POLICE_ERR_FAR");
    // Read before impounding: the entity is gone afterwards.
    const plate = plateOf(vehicle);
    // The garage script takes owned vehicles (or opens its impound form for the officer); anything else goes.
    if (!garages.impound(vehicle, source)) DeleteEntity(vehicle);
    aiLog("actions", "impounded a vehicle", {
      source,
      metadata: { plate },
    });
    return { ok: true };
  }
  if (
    target === source ||
    !online.character(target) ||
    !isNear(source, coordsOf(target), 3)
  )
    return fail("POLICE_ERR_FAR");
  switch (action) {
    case "cuff":
      setCuffed(target, !cuffed.has(target));
      if (!cuffed.has(target) && escorting.get(source) === target) {
        escorting.delete(source);
        emitNet(EVENTS.escort, target, null);
      }
      break;
    case "escort": {
      if (!cuffed.has(target)) return fail("POLICE_ERR_NOT_CUFFED");
      const current = escorting.get(source);
      if (current === target) {
        escorting.delete(source);
        emitNet(EVENTS.escort, target, null);
      } else {
        escorting.set(source, target);
        emitNet(
          EVENTS.escort,
          target,
          NetworkGetNetworkIdFromEntity(GetPlayerPed(String(source))),
        );
      }
      break;
    }
    case "seat": {
      if (!cuffed.has(target)) return fail("POLICE_ERR_NOT_CUFFED");
      if (!vehicleNearPlayer(source, extra, { metres: 8 }))
        return fail("POLICE_ERR_FAR");
      escorting.delete(source);
      emitNet(EVENTS.escort, target, null);
      emitNet(EVENTS.seat, target, extra);
      break;
    }
    case "unseat":
      emitNet(EVENTS.seat, target, null);
      break;
    case "search":
      if (!cuffed.has(target) && deadState.get(target) !== true)
        return fail("POLICE_ERR_NOT_CUFFED");
      if (!inventory.openInventory(source, target))
        return fail("POLICE_ERR_FAR");
      break;
    case "jail": {
      if (!cuffed.has(target)) return fail("POLICE_ERR_NOT_CUFFED");
      const minutes = readInt(extra, 1, 10_000);
      if (minutes === null) return fail("POLICE_ERR_JAIL");
      if (!prison.jail(target, minutes, source))
        return fail("POLICE_ERR_NO_PRISON");
      mdt.record({
        kind: "arrest",
        target,
        by: source,
        title: Locale("POLICE_RECORD_ARREST"),
        minutes,
      });
      escorting.delete(source);
      emitNet(EVENTS.escort, target, null);
      setCuffed(target, false);
      break;
    }
    case "fine": {
      const amount = readInt(extra, 1, settings.value.maxFine);
      if (amount === null) return fail("POLICE_ERR_FINE");
      const job = online.dutyJob(source) ?? "police";
      const label = Locale("POLICE_FINE_LABEL");
      if (!billing.send({ to: target, amount, label, from: source, job }))
        return fail("POLICE_ERR_FINE_SEND");
      mdt.record({ kind: "fine", target, by: source, title: label, amount });
      notify(target, Locale("POLICE_FINED", amount), "warning", 8000);
      aiLog("fines", `fined $${amount}`, {
        source,
        target,
        metadata: { amount, job },
      });
      break;
    }
    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
  aiLog("actions", action, { source, target });
  return { ok: true };
}
