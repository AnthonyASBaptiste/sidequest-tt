# 005 — Read-only daily quest board

## Completed

- Added `GET /api/quests/today` at the `/api` global prefix.
- The route determines the current calendar date in `America/Port_of_Spain`.
- It returns today's published Trinidad quest pool, ordered by slot; otherwise
  it returns the most recently published pool, its actual date, and
  `fallback: true`.
- If no published pool exists, it returns HTTP 503 with
  `available: false`, `reason: "no_published_pool"`, `poolDate: null`,
  `fallback: false`, and an empty quest list.
- The endpoint is read-only. It does not create pools or quests, and it does
  not implement guest state, quest acceptance/completion, evidence, Gemma, XP,
  or completion markers.
- Added NestJS Swagger/OpenAPI support for the route. Swagger UI is served at
  `/api/docs` and the generated OpenAPI JSON at `/api/docs-json`, so future
  routes can use the same decorators and shared API document.

## Verification

- `npm run build` passes.
- The route was called against the configured Atlas database, returning the
  seeded pool for `2026-10-08` with `fallback: false`.
- A disposable local MongoDB test returned the previous day's pool with
  `fallback: true`, and returned HTTP 503 when only a failed batch existed.
- The OpenAPI document includes the route and its HTTP 200 and 503 response
  schemas.
- Existing Mongoose schemas and seeded Atlas records were not changed.

## Response contract

Success:

```json
{
  "available": true,
  "poolDate": "YYYY-MM-DD",
  "fallback": false,
  "quests": []
}
```

Unavailable (HTTP 503):

```json
{
  "available": false,
  "reason": "no_published_pool",
  "poolDate": null,
  "fallback": false,
  "quests": []
}
```
