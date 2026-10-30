# ai-police

Police work for on-duty members of the panel's police jobs: a job menu (F6, ai-core's shared menu) to cuff, escort, seat / unseat, search, fine and impound; duty points; shot alerts (through lib `dispatch`; the alert cards are ai-policealert's). Depends on ai-core (jobs, duty, money, menu, input, prompts); the active inventory through ai-core's inventory layer (lib `inventory`) (search), ai-vehicles (impound) optional.

## Decisions

- The server decides everything (on duty, distance 3 m, cuffed before escort / seat / search) and tells the target's client what to play: cuffed animation with blocked controls (a tick only while cuffed), attach to the officer, warp into a back seat.
- Fines come from the target's bank and go to the officer's job account; the panel caps them.
- Shot alerts: any armed client reports shooting (checked only while armed); the server drops officers' shots, keeps one alert per 150 m every 30 s and sends it through lib `dispatch` (whatever alert system ai-core uses), to the panel's police jobs.
- Search opens the target's inventory through ai-core's inventory layer (`inventory.openInventory`) (cuffed or dead targets only).

## Contracts

- Events: `resource/common/police.ts`. Player state bag `cuffed`.

## Entry points

- Server: actions, duty, shot alerts `resource/server/index.ts`; panel `server/schema.ts`.
- Client: menu, duty stations (lib `Points` with blips), shot reports `resource/client/index.ts`; what happens to the target `client/restraints.ts`.
