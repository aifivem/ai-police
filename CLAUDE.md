# ai-police

Police work for on-duty members of the panel's police jobs: a job menu (F6, ai-core's shared menu) to cuff, escort, seat / unseat, search, fine and impound; duty points; shot alerts and wanted sightings (through lib `dispatch`; the alert cards are ai-policealert's). Depends on ai-core (jobs, duty, money, menu, input, prompts); the active inventory through ai-core's inventory layer (lib `inventory`) (search), ai-vehicles (impound) optional.

## Decisions

- The server decides everything (on duty, distance 3 m, cuffed before escort / seat / search) and tells the target's client what to play: cuffed animation with blocked controls (a tick only while cuffed), attach to the officer, warp into a back seat.
- Fines are bills from the officer's on-duty job (lib `billing.send`: whatever billing script runs, else ai-core's own bills, paid by the target from a list) plus an MDT fine record (lib `mdt.record`); the panel caps them. Sending someone to prison writes an MDT `arrest` record (ai-prison writes the jail record itself).
- Shot alerts: any client reports its shots (lib `onShot`, one report per 5.5 s at most, inside the event's server rate of one per 5 s); the server drops officers' shots, keeps one alert per 150 m every 30 s and sends it through lib `dispatch` (whatever alert system ai-core uses), to the panel's police jobs.
- Search opens the target's inventory through ai-core's inventory layer (`inventory.openInventory`) (cuffed or dead targets only).
- The police menu is also a lib `radial` item (added once, `canShow`: on duty and not cuffed; refreshed on duty and settings changes), so it shows on whichever radial menu runs.
- Wanted sightings (panel tab, `data/sightings.json`, `sync: "admin"`): another script reports a place that saw a player (`ReportSighting`); with the switch on, a loaded character, the per-player cooldown free (default 60 s, lib `Cooldowns`, taken before the warrant check like qbx_smallresources' isWanted) and an active warrant, the place's chance (panel list: atm 100, bank 100, shop 60, clothing 20, garage 60, phone 1; other names the default chance, 100) sends a lib `dispatch` alert to the panel's police jobs with name, sex, the plate of the vehicle the player sits in and the panel's blip; `source` lets alert systems that describe the suspect add vehicle label and colour. The warrant comes from lib `mdt.hasWarrant(citizenid)` (the active MDT through ai-core; false while no MDT runs or it exposes no warrants, so no alert then; which MDTs answer: `docs/compat/mdt.md`); the answer is async, so the character is checked again after it. Callers: ai-banking (`atm`, `bank`), ai-inventory shop purchases (`shop`), ai-appearance clothing / barber purchases (`clothing`), ai-garages take-outs (`garage`); no ai-* phone exists for `phone`.
- Station blips: per station `blip` switch plus a `blipStyle` (panel `blip` widget). Cuffs and escorts are `PlayerMap`s: a dropped target frees its officer, a dropped officer lets the target go.

## Contracts

- Events: `resource/common/police.ts`. Player state bag `cuffed`.
- Server export `ReportSighting(source, place)` (`AiPoliceServerExports` in `@aifivem/shared`): callers use `optionalExport("ai-police")?.ReportSighting(source, "<place>")` after the action succeeded, so a server without ai-police loses nothing.

## Entry points

- Server: panel and settings `resource/server/content.ts`, actions `server/actions/` (`act.ts` the switch, `restraints.ts` cuff and escort state), duty `server/duty.ts`, shot alerts `server/shots.ts`, wanted sightings `server/sightings/`; panel `server/schema/` (one file per tab).
- Client: menu `resource/client/menu.ts`, duty stations (lib `RecordObjects` + `Points` with blips: an edited station rebuilds only its point) `client/stations.ts`, shot reports `client/shots.ts`; what happens to the target `client/restraints.ts`.
