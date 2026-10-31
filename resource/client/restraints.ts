import {
  cache,
  controls,
  onServerEvent,
  player,
  waitForEntity,
} from "@aicore-fivem/lib/client";
import { readId } from "@aicore-fivem/lib/shared";
import { EVENTS } from "common/police";

/** Controls a cuffed player cannot use: attack, aim, sprint, jump, cover, weapon wheel, enter / leave vehicle, melee. */
const BLOCKED = [
  24, 25, 21, 22, 44, 37, 23, 75, 140, 141, 142, 143, 257, 263, 264,
];

/**
 * What an officer does to this player, applied on this client: the cuffed animation and blocked controls (a tick only
 * while cuffed), being escorted (attached to the officer's ped), being seated in or taken out of a vehicle.
 */
class Restraints {
  isCuffed = false;
  private hold: { stop(): void } | null = null;

  async setCuffed(on: boolean): Promise<void> {
    this.isCuffed = on;
    if (on) controls.disable("cuffed", BLOCKED);
    else controls.enable("cuffed");
    this.hold?.stop();
    this.hold = null;
    const ped = cache.ped;
    if (!on) {
      ClearPedTasks(ped);
      return;
    }
    SetCurrentPedWeapon(ped, GetHashKey("WEAPON_UNARMED"), true);
    this.hold = player.holdAnim("mp_arresting", "idle", { flag: 49 });
  }

  async escort(officerNetId: number | null): Promise<void> {
    const ped = cache.ped;
    if (officerNetId === null) return DetachEntity(ped, true, false);
    const officer = await waitForEntity(officerNetId, 3000);
    if (officer)
      AttachEntityToEntity(
        ped,
        officer,
        11816,
        0.45,
        0.45,
        0,
        0,
        0,
        0,
        false,
        false,
        false,
        false,
        2,
        true,
      );
  }

  async seat(vehicleNetId: number | null): Promise<void> {
    const ped = cache.ped;
    if (vehicleNetId === null) {
      if (cache.vehicle !== false) TaskLeaveVehicle(ped, cache.vehicle, 16);
      return;
    }
    const vehicle = await waitForEntity(vehicleNetId, 3000);
    if (!vehicle) return;
    DetachEntity(ped, true, false);
    const seat = [1, 2, 0].find((s) => IsVehicleSeatFree(vehicle, s));
    if (seat !== undefined) TaskWarpPedIntoVehicle(ped, vehicle, seat);
  }
}

export const restraints = new Restraints();

onServerEvent(
  EVENTS.cuffed,
  { args: ([on]) => [on === true] as const },
  (on) => void restraints.setCuffed(on),
);
onServerEvent(
  EVENTS.escort,
  { args: ([id]) => [readId(id)] as const },
  (id) => void restraints.escort(id),
);
onServerEvent(
  EVENTS.seat,
  { args: ([id]) => [readId(id)] as const },
  (id) => void restraints.seat(id),
);
