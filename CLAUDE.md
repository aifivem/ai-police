# ai-police

Police work for on-duty members of the panel's police jobs: a job menu (F6, ai-core's shared menu) to cuff, escort, seat / unseat, search, fine and impound; duty points; shot alerts on the map of on-duty officers. Depends on ai-core (jobs, duty, money, menu, input, prompts); the active inventory through ai-core's inventory layer (lib `inventory`) (search), ai-vehicles (impound) optional.

## Decisions

- The server decides everything (on duty, distance 3 m, cuffed before escort / seat / search) and tells the target's client what to play: cuffed animation with blocked controls (a tick only while cuffed), attach to the officer, warp into a back seat.
- Fines come from the target's bank and go to the officer's job account; the panel caps them.
- Shot alerts: any armed client reports shooting (checked only while armed); the server drops officers' shots, keeps one alert per 150 m every 30 s and sends it to on-duty officers only.
- Search opens the target's inventory through ai-core's inventory layer (`inventory.openInventory`) (cuffed or dead targets only).

## Contracts

- Events: `resource/common/police.ts`. Player state bag `cuffed`.
- Export `SendAlert(x, y, z, text)`: another resource's translated alert (robberies) to on-duty officers, shown like shot alerts.

## Entry points

- Server: actions, duty, alerts `resource/server/index.ts`; panel `server/schema.ts`.
- Client: menu, duty stations (lib `Points` with blips), shot reports, alert blips (`createBlip`, flashing) `resource/client/index.ts`; what happens to the target `client/restraints.ts`.
