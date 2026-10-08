# 003 — Daily pool and MVP defaults

## Decisions

- The MVP covers Trinidad as a whole. Tobago selection remains a stretch goal.
- The always-on home server runs Gemma in a container and generates one shared daily pool of 5–10 quests from reviewed templates. Players cannot reroll or request regeneration.
- The generation job starts at 04:00 in `America/Port_of_Spain`. If today's generation fails, the app serves the latest successfully published pool (normally yesterday's), labels its actual date, and keeps it available until a newer pool is published. It never presents a failed or partial batch as today's pool.
- When a player completed a quest yesterday, its card shows `Completed yesterday`. Older completions show their date. The player may accept and try the quest again; XP is awarded only for the first verified completion of that quest instance.
- Guest accounts are the MVP default, with no email/password. Progress is tied to the browser and cannot be recovered across browsers/devices. Sign-in and account recovery are deferred.
- XP awards are 25 for Common, 50 for Uncommon, and 100 for Rare. The MVP shows total XP and history; levels are deferred.
- Only one quest may be active per player. After completion or expiry, the player may accept the same quest again; its completion marker remains and it cannot earn XP again for that player.
- Text evidence is deleted 30 days after submission. Verification metadata remains. A submission still pending then expires without an award.
- The home server initiates outbound HTTPS calls to Render: it submits daily quest candidates, polls for verification jobs, runs Gemma locally, and posts results. Service calls use a dedicated credential and request signing/replay protection; no model port is exposed publicly.

## Still open

- Exact Gemma model/version after checking the home-server hardware.
- Evidence text length limit and verification confidence threshold.
- Final guest-cookie/session implementation details and the scheduled evidence deletion job.

## Behavior to verify during implementation

- A failed daily run serves the last published pool with the correct date and per-player completion badges.
- Re-accepting a quest creates a new acceptance but does not create a second XP award for the same player and quest instance.
- A pending verification can be picked up by the home-server poller and safely retried without duplicating a completion or reward.
