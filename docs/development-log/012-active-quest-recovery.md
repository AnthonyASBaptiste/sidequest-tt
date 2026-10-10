# 012 — Active quest recovery

## Goal

Restore a guest's current quest and latest verification feedback after the
player refreshes the frontend.

## Implemented

- Added guest-cookie-protected `GET /api/quests/active`.
- The route returns `activeAcceptance` and `latestSubmission`; both are `null`
  when the guest has no active acceptance. For active quests, the response
  includes the existing immutable quest snapshot and the latest submission's
  player-facing status, reason, confidence, failed criteria, awarded XP, and
  submission time. Evidence text and worker credentials are excluded.
- Frontend startup now reuses or creates the guest session, checks for an
  active quest, restores its accepted snapshot and latest status, and resumes
  polling if the latest attempt is pending. With no active quest it loads the
  quest board. If recovery is unavailable, the board remains accessible when
  its API request succeeds, and the connection failure is shown.
- Updated the backend README, data model, architecture, root README, and
  submission notes. No acceptance, retry, completion, or XP rules changed.

## Verification

- Backend and frontend production builds passed.
- Generated Swagger/OpenAPI describes `GET /api/quests/active` with the guest
  cookie security requirement and `200`/`401` responses.
- The route returned `{ "activeAcceptance": null, "latestSubmission": null }`
  for a guest with no active quest and returned `401` without a guest cookie.
- In the browser, accepted a disposable quest, refreshed, and confirmed the
  accepted quest and evidence form were restored. Submitted non-sensitive
  sample text, refreshed again, and confirmed the active quest and pending
  result feedback were restored. Inspected the response field names and
  confirmed it contained no evidence text.
- Removed the disposable guest, acceptance, and submission attempt afterward;
  confirmed no test records remained and all five seeded quests were intact.

## Remaining limitations

Verified, retry, and review outcomes were not exercised through this recovery
browser test. A completed acceptance is no longer active, so this endpoint
returns the empty-active response after completion rather than serving a
completed quest as active. Hosted deployment and outdoor playtesting remain
unverified.
