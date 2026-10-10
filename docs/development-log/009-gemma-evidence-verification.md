# 009 — Evidence verification API and XP transition

## Completed

- Added authenticated NestJS worker routes to claim one pending evidence
  attempt, return a structured assessment, or release a claim after a bounded
  worker/model failure.
- Claims are atomic and time-limited. The API stores only a hash of each
  claim token and makes expired claims available again. Attempts whose
  evidence-retention date has passed are not claimable and are expired without
  XP.
- The API validates the assessment shape, reason, confidence range, and failed
  criteria against the accepted quest snapshot. Scores below `0.75` become
  `review`; invalid output releases the claim and leaves the attempt
  retryable. A `retry` result returns the acceptance to `retry`. Neither
  outcome awards XP.
- A verified result uses an Atlas transaction to complete the attempt and
  acceptance, clear the active-quest marker, record a completion, and award
  fixed rarity XP only if the guest has not already earned XP for that quest
  instance. Result replays are idempotent.
- Added a guest-owned submission-status route that returns assessment feedback
  without returning submitted evidence.
- Updated the backend README, architecture, data model, product spec, and
  internal submission notes with the worker contract and configuration
  boundary.

## Verification

- `npm run build` passes. `npm run db:check` connected to the configured Atlas
  database, built the declared indexes, and completed a MongoDB ping.
- Started the API against Atlas and exercised guest creation, the quest board,
  acceptance, idempotent evidence submission, and the worker verification
  routes using disposable guest records.
- Concurrent claim requests leased an attempt to only one request. Invalid
  assessment output left the attempt claimable; a valid `retry` result returned
  the acceptance to retryable state. Player status showed the result without
  exposing evidence.
- A verified structured assessment completed the acceptance and awarded the
  quest's fixed XP. Replaying the same result did not duplicate the award.
- A confidence score below `0.75` became `review` with zero XP. Accepting and
  completing the same quest instance again created no second XP award; the
  Atlas XP total and unique award record matched the first award.
- All temporary guest, acceptance, attempt, completion, and XP-award records
  were removed. The seeded quest pool was left unchanged.

## Runtime boundary

No home-server worker process, Gemma runtime adapter, model endpoint, model
identifier, or model credentials were present in the repository. The API-side
worker contract was tested with structured assessment requests, not with a
live Gemma model. The home-server URL and locally selected model's request
format and timeout still need to be supplied by that deployment; no model
connection details were invented.
