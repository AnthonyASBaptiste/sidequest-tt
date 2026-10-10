# 014 — Hosted Gemma verification

## Problem

A reflection submitted from the hosted mobile app remained `pending`. The
verification worker was not running in the current environment, and its
ignored local configuration still pointed `API_BASE_URL` at the local
development API.

## Resolution

- Confirmed the hosted Render API was reachable and Ollama had
  `gemma4:e2b-it-qat` available locally.
- Changed only `API_BASE_URL` in the ignored `backend/worker/.env` to
  `https://sidequest-tt.onrender.com`. Existing secret, model, and 120-second
  lease settings were preserved and not printed.
- Started the worker manually. It completed a real inference in **12,377 ms**
  and successfully returned the assessment to the hosted API.
- Stopped the worker after processing the pending attempt. No evidence text or
  API credentials were logged, and no seeded quest data was changed.

## Verification limits and next step

The API accepted the assessment result, but the worker logs do not include its
final category. After refresh, the app returned to the quest board without
showing any submission result. Investigation found that the recovery route
only returns active acceptances; successful verification marks an acceptance
completed and removes its active marker, so the result disappeared from the
startup response. The completed-result recovery is recorded in development log
015. Keep `npm run worker:verify` running on the home server for future
submissions; the worker is not configured as a persistent service.
