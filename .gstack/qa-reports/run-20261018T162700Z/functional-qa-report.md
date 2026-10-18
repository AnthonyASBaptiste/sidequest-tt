# Functional QA Report — SideQuest T&T

- **Run ID:** `run-20261018T162700Z`
- **Date/Time (UTC):** `2026-10-18T16:27:00Z`
- **Branch:** `feat/nvidia-gemma` (`26a14cd`)
- **Base Branch:** `origin/main`
- **Tier:** Standard
- **Surfaces:** Functional (Backend API contracts, controller routes, worker pipelines, photo proof / EXIF validation, temporal context, and quest pool generation)

---

## 1. Scope & Execution Boundaries

- **Changed Areas Tested:**
  1. Full TypeScript compilation of backend (`@nestjs`) and frontend (`tsc -b && vite build`).
  2. Quests controller routing metadata for `GET /quests/today` and `POST /quests/refresh` in [quests.controller.ts](file:///home/anthony/Projects/sidequest-tt/backend/src/quests/quests.controller.ts).
  3. EXIF metadata extraction and timestamp validation in [submissions.service.ts](file:///home/anthony/Projects/sidequest-tt/backend/src/quests/submissions.service.ts).
  4. Temporal & Cultural Context Engine ([temporal-context.mjs](file:///home/anthony/Projects/sidequest-tt/backend/worker/temporal-context.mjs)) across Trinidad and Tobago regional calendars.
  5. Multi-tier Event Search Engine ([event-search.mjs](file:///home/anthony/Projects/sidequest-tt/backend/worker/event-search.mjs)) with offline seasonal fallback.
  6. CLI flag parsing and pool generation pipeline with `--force` flag support ([generate-quest-pool.mjs](file:///home/anthony/Projects/sidequest-tt/backend/worker/generate-quest-pool.mjs)).
  7. Client-side file selection, preview, and input event resetting in [App.tsx](file:///home/anthony/Projects/sidequest-tt/frontend/src/App.tsx).

---

## 2. Contract Verification & Results

| Contract | Target Area | Expectation | Result |
| :--- | :--- | :--- | :--- |
| **Build & Type Integrity** | `backend/` | `npm run build` succeeds cleanly with NestJS CLI. | **PASS** |
| **Build & Bundle Integrity** | `frontend/` | `npm run build` bundles React app + Vite without TS errors. | **PASS** |
| **Controller Route Mapping** | `quests.controller.ts` | `GET /quests/today` maps strictly to `getTodaysQuestBoard`; `POST /quests/refresh` maps to `refreshTodaysQuestBoard`. | **PASS** |
| **EXIF Parsing & Extraction** | `submissions.service.ts` | Correctly parses DateTimeOriginal from EXIF header in authentic JPEG uploads. | **PASS** |
| **Expired Photo Rejection** | `submissions.service.ts` | Rejects photos taken >24 hours before quest acceptance with `photo_timestamp_expired`. | **PASS** |
| **Future Photo Rejection** | `submissions.service.ts` | Rejects photos with future capture timestamps (>10m clock drift) with `photo_timestamp_invalid`. | **PASS** |
| **Permitted Window Acceptance** | `submissions.service.ts` | Accepts photos captured during active quest or within the 24h grace window before acceptance. | **PASS** |
| **Temporal Season Mapping** | `temporal-context.mjs` | Maps October dates to Trinidad Divali season and Tobago Carnival season. | **PASS** |
| **Day Rhythm Calculation** | `temporal-context.mjs` | Resolves Sunday family lime / beach excursions rhythm. | **PASS** |
| **Offline Search Fallback** | `event-search.mjs` | Returns culturally grounded event inspirations when live search APIs are unavailable. | **PASS** |
| **Pool Worker CLI Flags** | `generate-quest-pool.mjs` | Correctly isolates and applies `--force` flag without corrupting positional/region arguments. | **PASS** |
| **File Input Reselection** | `frontend/src/App.tsx` | Resetting file input value allows re-selecting the same image after removal. | **PASS** |

---

## 3. Defects Found & Repaired

1. **Critical Decorator Stacking Bug in QuestsController**:
   - *Defect:* In commit `1440698`, `refreshTodaysQuestBoard` was inserted above `getTodaysQuestBoard` directly beneath the `@Get('today')` decorators. Consequently, NestJS decorated `refreshTodaysQuestBoard` with both `@Get('today')` and `@Post('refresh')`, while `getTodaysQuestBoard` had no routing decorator. Every client request to `GET /quests/today` triggered a forced quest pool regeneration and returned an empty quest list with `available: false`.
   - *Fix:* Reordered decorators so `@Get('today')` properly decorates `getTodaysQuestBoard` and `@Post('refresh')` decorates `refreshTodaysQuestBoard`. Verified metadata via `Reflect.getMetadata`.
   - *Verification:* Verified `getTodayPath === 'today'` (GET) and `refreshPath === 'refresh'` (POST).

2. **File Input Reselection State Bug**:
   - *Defect:* When a user selected an image, removed it, and attempted to select the same file again, the browser's `onChange` event did not fire because the input's `value` was unchanged.
   - *Fix:* Cleared `e.target.value = ''` upon selection in `handlePhotoSelect`.
   - *Verification:* Verified same-file re-selection works without requiring page reload.

3. **Date Instance Coercion in SubmissionsService**:
   - *Defect:* `ownedAcceptance.acceptedAt.getTime()` assumed a Mongoose Date object. If passed a serialized string representation, it would throw a TypeError.
   - *Fix:* Wrapped `ownedAcceptance.acceptedAt` in `new Date()` before invoking `.getTime()` and `.toISOString()`.
   - *Verification:* Both Date instances and ISO strings evaluate safely.

---

## 4. Status

- **Status:** **DONE**
- **Readiness:** Safe to ship / merge. All contract assertions passed.
