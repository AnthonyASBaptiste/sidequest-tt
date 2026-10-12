# 018 — Demand-triggered quest pool generation

## Problem

The home-server scheduler relied on a process staying alive until 04:00 in
`America/Port_of_Spain`. The process is no longer running, so the missed run
cannot be attributed to a specific wake-up or generation error. The site did
not request generation when a player opened the board.

## Change

- A quest-board request now creates one daily `generating` batch when today's
  pool is missing. The existing region/date uniqueness constraint makes this
  request idempotent under simultaneous page loads.
- The authenticated generation endpoint reports whether a pool was requested.
- The home-server generation worker polls every 30 seconds and generates only
  when it sees a request. It reuses the queued batch when publishing.
- The board keeps serving the latest published pool while today's pool is
  pending; the frontend refreshes and reports progress until publication.
- No fixed 04:00 trigger remains in the worker instructions. Ollama stays on
  the home server and is never reached directly by the browser or Render.

## Verification and remaining work

- Backend build passed after the implementation.
- The user reports that the home-server worker generated a new pool after the
  change. The provided mobile video shows the hosted board dated October 11,
  2026, with generated quests including “Public Space Detail Tracker” (Rare,
  100 XP) and “Route Deviation Discovery” (Common, 25 XP). The video does not
  show every pool entry, so this is not a full pool inventory.
- A read-only check of the hosted OpenAPI document returned HTTP 200 and
  included the generation-request response field. An unauthenticated request
  to the quest board returned the expected HTTP 401, so the published pool
  could not be inspected without the user's guest session. No guest or test
  records were created for this check.
- The video shows the verifier asking for a clearer route difference and
  observation on an initial reflection. After the player added detail, “The
  Safe Detour” was marked **QUEST VERIFIED** for **+25 XP**; the displayed
  account total became **100 XP**. This closes the evidence-to-XP demo loop.
- Keep `worker:generate-pool -- --schedule` running persistently on the home
  server. If the worker is stopped, the board safely keeps the prior pool and
  the queued request waits until the worker returns.
