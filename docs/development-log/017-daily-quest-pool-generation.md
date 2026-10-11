# 017 — Generate and publish daily quest pools

## Goal

Replace the sample-only daily board with a real Gemma generation path while
keeping reviewed templates and the API as the source of product rules.

## Implementation

- Added authenticated worker routes to fetch active Trinidad templates and
  publish a generated pool.
- Added API-side validation for the current Trinidad date, template identity,
  title uniqueness, field limits, and rarity duration bands.
- The API derives criteria, proof instructions, safety guidance, rarity,
  difficulty, and XP from the stored template. It publishes the pool and quest
  instances in one Atlas transaction and never replaces an existing daily
  pool.
- Added `backend/worker/generate-quest-pool.mjs` using the configured local
  Ollama-compatible runtime. It supports preview, publish-from-preview, direct
  publication, and a scheduler for 04:00 `America/Port_of_Spain` with retries
  every 15 minutes after a failed run.

## Verification

- Backend build, worker syntax check, and `git diff --check` passed.
- The installed `gemma4:e2b-it-qat` generated five structured candidates in
  18.1 seconds from the five active reviewed templates.
- The API published the candidates to the development Atlas database. The
  local quest board returned HTTP 200 with all five generated quests and
  `fallback: false`.
- Removed the disposable generated batch, its five quest instances, and the
  temporary guest. Existing sample templates and the seeded pool were left
  intact.
- The hosted `sidequest` database already has a published sample pool for
  2026-10-10. It references two acceptances, three submission attempts, and two
  completions, so it was deliberately preserved. The next date has no pool and
  is eligible for the new scheduler.

## Remaining

- Run the home-server scheduler against the hosted database and confirm the
  next Trinidad-date pool appears in the hosted mobile app.
- Deploy the API source changes before relying on these new worker routes from
  Render or using the generation endpoint remotely.
- The scheduled evidence-deletion job remains separate work.
