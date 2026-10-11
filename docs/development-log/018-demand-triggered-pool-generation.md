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
- This change has not yet been deployed or exercised against the hosted API.
- The earlier real local Gemma generation remains verified, but this specific
  page-trigger-to-publication flow still needs a live run.
- Keep `worker:generate-pool -- --schedule` running persistently on the home
  server. If the worker is stopped, the board safely keeps the prior pool and
  the queued request waits until the worker returns.
