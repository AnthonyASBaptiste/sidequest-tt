# 010 — Local Gemma verification

## Completed

- Configured the ignored local API and worker environment files with a
  generated matching worker secret and a 120-second verification lease. The
  worker used the local NestJS API at port 3000 with its `/api` prefix and
  the local Ollama service at `127.0.0.1:11434`.
- Ran the worker with the exact installed model name `gemma4:e2b-it-qat`.
  No model was downloaded or substituted.
- Submitted one disposable, non-sensitive evidence sample for an existing
  seeded quest. The real model returned a structurally valid assessment:
  `review`, confidence `1`, with two failed criteria. Its reason stated that
  the sample repeated the criteria but did not supply the required
  observations.
- The local API accepted and persisted the `review` result. The attempt earned
  zero XP, as required for review outcomes.
- The worker measured the local model request at **13,484 ms**. This is well
  within the 120-second lease; no lease increase is indicated by this run.
- Removed the temporary guest, acceptance, and submission attempt from Atlas.
  No completion or XP award was created, and the seeded quest pool was not
  modified.

## Verification limits

- This confirms one real local inference and API result application. It does
  not establish model reliability or verify a hosted Render-to-home-server
  run.
- API and worker credentials remain only in ignored local `.env` files. The
  Render API still needs `VERIFICATION_WORKER_SECRET` and
  `VERIFICATION_LEASE_SECONDS=120`; the home-server worker must use the same
  secret and lease when pointed at the hosted API.
- The local sample correctly received `review`, so a successful verified
  completion and XP award were not demonstrated by this model run.
