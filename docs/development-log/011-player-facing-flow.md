# 011 — Player-facing flow

## Goal

Add the smallest screen-away player interface for the existing quest API and
verify it against the local development stack.

## Implemented

- Added a React 19, Vite 6, and TypeScript frontend in `frontend/`.
- Added guest-session reuse, today's board, dated fallback-pool notice, quest
  details and safety guidance, quest acceptance, screen-away/return controls,
  text evidence submission, and submission-status polling.
- Configured credentialed API requests using `VITE_API_BASE_URL`. Frontend
  evidence stays in component memory, is not logged or stored in browser
  storage, and is cleared after successful submission. XP is rendered only
  from the API's verification-status response; review explicitly shows that it
  is awaiting review and has earned no XP.
- Added frontend environment-file ignores and local run instructions. The
  backend's local CORS origin was configured as the exact Vite origin in the
  ignored `backend/.env`; no secrets were added to tracked files.

## Verification

- `npm run build` completed successfully in `frontend/`; the NestJS backend
  build also completed successfully.
- Started the API against its configured Atlas database and the Vite app on
  port 5173. The browser exercised the guest cookie and board request, showed
  the fallback pool dated 8 October 2026, exposed quest criteria and safety
  before acceptance, accepted a quest, entered and exited screen-away mode,
  submitted sample text, and displayed the API's pending verification status.
- Browser inspection found no evidence in `localStorage` or `sessionStorage`.
- Removed the disposable guest, acceptance, and evidence attempt. Confirmed
  there were no test records remaining and the seeded quest count stayed at
  five.

## Not verified

This browser run did not exercise verified, retry, or review UI results, and
did not invoke Gemma. Those states and the model path are not claimed as
frontend-verified here. Hosted deployment and outdoor playtesting remain
unverified. The active quest is held in page memory and cannot be restored
after refresh because no active-acceptance lookup API exists.
