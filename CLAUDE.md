# ai-police

Police work for on-duty members of the panel's police jobs: a job menu (F6, ai-core's shared menu) to cuff, escort, seat / unseat, search, fine and impound; duty points; shot alerts (through lib `dispatch`; the alert cards are ai-policealert's). Depends on ai-core (jobs, duty, money, menu, input, prompts); the active inventory through ai-core's inventory layer (lib `inventory`) (search), ai-vehicles (impound) optional.

## Decisions

- The server decides everything (on duty, distance 3 m, cuffed before escort / seat / search) and tells the target's client what to play: cuffed animation with blocked controls (a tick only while cuffed), attach to the officer, warp into a back seat.
- Fines are bills from the officer's on-duty job (lib `billing.send`: whatever billing script runs, else ai-core's own bills, paid by the target from a list) plus an MDT fine record (lib `mdt.record`); the panel caps them. Sending someone to prison writes an MDT `arrest` record (ai-prison writes the jail record itself).
- Shot alerts: any client reports its shots (lib `onShot`, one report per 5.5 s at most, inside the event's server rate of one per 5 s); the server drops officers' shots, keeps one alert per 150 m every 30 s and sends it through lib `dispatch` (whatever alert system ai-core uses), to the panel's police jobs.
- Search opens the target's inventory through ai-core's inventory layer (`inventory.openInventory`) (cuffed or dead targets only).
- The police menu is also a lib `radial` item (added once, `canShow`: on duty and not cuffed; refreshed on duty and settings changes), so it shows on whichever radial menu runs.
- Station blips: per station `blip` switch plus a `blipStyle` (panel `blip` widget). Cuffs and escorts are `PlayerMap`s: a dropped target frees its officer, a dropped officer lets the target go.

## Contracts

- Events: `resource/common/police.ts`. Player state bag `cuffed`.

## Entry points

- Server: actions, duty, shot alerts `resource/server/index.ts`; panel `server/schema.ts`.
- Client: menu, duty stations (lib `RecordObjects` + `Points` with blips: an edited station rebuilds only its point), shot reports `resource/client/index.ts`; what happens to the target `client/restraints.ts`.
