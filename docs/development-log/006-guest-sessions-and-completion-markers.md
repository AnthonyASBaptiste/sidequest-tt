# 006 — Guest sessions and completion markers

## Completed

- Added `POST /api/session/guest`. A valid guest cookie resolves to the same
  guest; otherwise the API creates a guest user and sets a new cookie.
- Guest cookies contain a cryptographically random token. Only its SHA-256 hash
  is stored in the existing `users.auth.subject` field; the raw token and hash
  are not included in the API response.
- The cookie is `HttpOnly`, `SameSite=Lax`, uses `Path=/`, and has a one-year
  lifetime. It is marked `Secure` in production. Guests older than one year
  are not accepted.
- Protected `GET /api/quests/today` with the guest session. Existing published
  pool selection, fallback date, slot ordering, and unavailable behavior remain
  unchanged.
- Added `lastCompletedAt` and `completedYesterday` to each board quest. These
  are based on the guest's most recent completion, with the previous calendar
  date calculated in `America/Port_of_Spain`. Completion markers do not remove
  or disable quests.
- Added exact-origin credentialed CORS configuration through
  `FRONTEND_ORIGIN`; the API does not allow wildcard origins with credentials.
- Documented the session cookie and board response fields, updated the backend
  README, and included cookie authentication and route responses in Swagger.

## Verification

- `npm run build` passes.
- Started the API against the configured MongoDB database and verified the
  Swagger document includes both routes and the guest-cookie security scheme.
- An end-to-end check verified missing and invalid cookies are rejected by the
  quest board, a valid cookie reuses the same guest, cookie attributes and
  production `Secure` behavior, allowed and disallowed CORS origins, and the
  correct “completed yesterday” marker on the seeded quest board.
- Temporary guest and completion test records were removed after the check;
  existing sample quest data was left unchanged.

## Response changes

`POST /api/session/guest` returns a guest profile containing its ID, region,
and XP. The raw session token is delivered only in the `Set-Cookie` header.
`GET /api/quests/today` now requires this cookie and adds these fields to each
quest:

```json
{
  "lastCompletedAt": "2026-10-07T16:15:00.000Z",
  "completedYesterday": true
}
```

`lastCompletedAt` is `null` when the guest has not completed that quest.
