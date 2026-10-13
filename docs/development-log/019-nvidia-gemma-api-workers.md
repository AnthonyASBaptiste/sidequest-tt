# 019 — NVIDIA API Gemma integration and full-time home-server workers

## Context

The main branch of the project relies on local Gemma via Ollama on a development machine.
For evaluating the application and keeping the services active full-time, the always-on home server is used. Because the home server cannot run the full Gemma model locally, cloud inference via the NVIDIA NIM API (`integrate.api.nvidia.com`) is configured to access the full Gemma 2 27B model (`google/gemma-2-27b-it`).
Work is isolated on the `feat/nvidia-gemma` branch to preserve the `main` branch currently under evaluation for the hackathon.

## Changes

1. **Branch Isolation**:
   - Created and checked out branch `feat/nvidia-gemma`.
2. **NVIDIA NIM API Integration**:
   - Implemented `backend/worker/runtime-client.mjs`, a unified runtime adapter supporting NVIDIA NIM (`https://integrate.api.nvidia.com/v1/chat/completions`) using `Authorization: Bearer <NVIDIA_API_KEY>` and OpenAI-compatible structured JSON mode.
   - Preserved fallback to local Ollama when `NVIDIA_API_KEY` is not provided.
   - Added resilient JSON parsing with markdown block fence trimming and boundaries extraction.
   - Updated `backend/worker/generate-quest-pool.mjs` and `backend/worker/verify-worker.mjs` to use `runtime-client.mjs`.
3. **Backend Model Format Update**:
   - Updated `backend/src/quests/quest-pool-generation.service.ts` to allow `/` in candidate model strings (`^[A-Za-z0-9][A-Za-z0-9._:/-]{0,119}$`), allowing NVIDIA model identifiers such as `google/gemma-2-27b-it`.
4. **Full-Time Worker Runner & Daemon**:
   - Created `backend/worker/run-all-workers.mjs`, an automatic supervisor that launches both `verify-worker.mjs` and `generate-quest-pool.mjs --schedule` in parallel, prefixes logs, and restarts workers on transient failures.
   - Added npm scripts `worker:all`, `worker:daemon`, and `worker:generate-pool:schedule`.
   - Created `backend/worker/sidequest-workers.service` for systemd (user or system) deployment on the always-on home server.
5. **Configuration**:
   - Updated `backend/worker/.env.example` and created pre-configured `backend/worker/.env` with placeholders for `VERIFICATION_WORKER_SECRET` and `NVIDIA_API_KEY`.
