import { AdminWorld } from "@aicore-fivem/lib/client";
import { readSettings } from "common/police";

export const world = new AdminWorld(["settings", "stations"]);
export const settings = world.view("settings", readSettings);
