# 008 — Text evidence submission

## Completed

- Added `POST /api/acceptances/:acceptanceId/submissions`, protected by the
  existing guest session. The API verifies ownership and returns the same 404
  for unknown and other guests' acceptances.
- Evidence is trimmed, required to be non-empty, and limited to 2,000 Unicode
  characters. The selected limit is recorded in the product specification and
  data model.
- Submissions are allowed only while an owned acceptance is `accepted` or
  `retry`. A new attempt is numbered per acceptance, starts `pending`, and gets
  an `evidenceDeleteAt` timestamp 30 days after submission.
- Attempt creation and changing the acceptance to `submitted` occur in one
  MongoDB transaction. The acceptance keeps its `activeUserId`.
- A required 1–128 character visible-ASCII `Idempotency-Key` is SHA-256 hashed
  before storage. A unique sparse index prevents reuse from creating another
  attempt. Repeating the key for the same acceptance and evidence returns the
  original attempt; reusing it for another acceptance or different evidence
  returns HTTP 409.
- The response includes only attempt ID, acceptance ID, attempt number, status,
  and submission time. Evidence is not returned or logged.
- Added Swagger documentation and updated `backend/README.md` and
  `docs/data-model.md`. The evidence deletion job, Gemma verification,
  completion, XP, and frontend remain unimplemented.

## Verification

- `npm run build` passes; the API starts against the configured MongoDB Atlas
  database and registers the submission endpoint and required indexes.
- Integration checks verified ownership and 404 behavior, missing/blank/
  oversized evidence validation, acceptance of exactly 2,000 Unicode
  characters, trimmed evidence storage, pending attempt metadata and 30-day
  deletion date, acceptance state update with `activeUserId` retained, and
  retry attempt numbering.
- Repeated requests returned the original attempt. Reuse with changed evidence
  or another acceptance returned 409 without a duplicate. Concurrent duplicate
  and competing submissions left exactly one attempt and one state transition.
- Swagger marks `Idempotency-Key` as required, documents the route responses,
  and does not expose evidence text in the response schema.
- All temporary guest, acceptance, and submission-attempt records were removed.
  Existing quest pool and seeded data were left unchanged.

## Response contract

New submission (HTTP 201):

```json
{
  "id": "507f1f77bcf86cd799439014",
  "acceptanceId": "507f1f77bcf86cd799439012",
  "attemptNumber": 1,
  "status": "pending",
  "submittedAt": "2026-10-09T11:48:00.000Z"
}
```

An idempotent replay of the same request returns HTTP 200 with the same
response. Evidence text is never included.
