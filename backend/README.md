# SideQuest T&T backend

NestJS + Mongoose API for MongoDB Atlas. It currently creates anonymous guest
sessions, serves the daily quest board with per-player completion markers, and
supports quest acceptance, text evidence submission, authenticated verification
worker claims/results, completion, and idempotent XP awards. The `worker/`
directory contains a home-server verification worker and configurable
Ollama-compatible runtime adapter. The React/Vite frontend is in `../frontend`.

## Configure

Copy `.env.example` to `.env`, then set `MONGODB_URI` to a MongoDB Atlas
connection string (or a local MongoDB URI for development). `MONGODB_DB_NAME`
overrides the database name in the connection string. `PORT` defaults to 3000.

Do not commit `.env` or database credentials.

## Run

```sh
npm install
npm run start:dev
```

Startup validates the environment, connects to MongoDB, builds the declared
Mongoose indexes, and logs the connected database name. The API uses the `/api`
prefix. Swagger UI is available at `/api/docs`, with its OpenAPI JSON at
`/api/docs-json`.

`POST /api/session/guest` returns the existing guest for a valid cookie or
creates one and sets the `sidequest_guest` cookie. `GET /api/quests/today`
and `GET /api/quests/active`, `POST /api/quests/:questId/accept`, and
`POST /api/acceptances/:acceptanceId/submissions` require that cookie. To
enable credentialed browser requests, set `FRONTEND_ORIGIN` to one exact
frontend origin (for example `http://localhost:5173`); CORS is otherwise
disabled. Wildcard origins are not accepted.

The React/Vite player app lives in `../frontend`. Start it with
`npm install && npm run dev` from that directory. Its configurable
`VITE_API_BASE_URL` defaults to `http://localhost:3000/api`; set the exact
Vite origin in `FRONTEND_ORIGIN` on the local API to permit credentialed
browser requests. Frontend configuration must not contain API worker, Atlas,
or model secrets.

`GET /api/quests/active` returns the guest's current active acceptance and its
latest submission status, if present. The response is
`{ "activeAcceptance": <acceptance-or-null>, "latestSubmission": <status-or-null> }`.
The acceptance includes its ID, quest ID, status, ISO acceptance time, and
accepted quest snapshot. The submission status uses the same fields as
`GET /api/acceptances/:acceptanceId/submissions/:attemptId` (`attemptId`,
`acceptanceId`, `attemptNumber`, status, verification feedback, server-awarded
XP, and submission time). With no active quest, both fields are `null`.
Evidence text, guest token data, and worker secrets are never included. The
frontend calls this route after reusing or creating the guest session so an
active quest and pending/retry/review feedback survive a page refresh.

Configure `VERIFICATION_WORKER_SECRET` to a random secret of at least 32
characters. Set the same secret on the home-server worker. The verification
endpoints return HTTP 503 until the API secret is configured.
`VERIFICATION_LEASE_SECONDS` controls worker claim duration (30–3600 seconds,
default 120). Do not put the MongoDB URI or credentials on the worker.

## Read-only quest board

`GET /api/quests/today` returns today's published Trinidad pool ordered by
`slot`. If today's pool is not published, it returns the latest published pool
with its actual `poolDate` and `fallback: true`. If no published pool exists,
the route returns HTTP 503 with `available: false` and
`reason: "no_published_pool"`. This route does not generate or modify quests.

To perform a minimal database ping:

```sh
npm run db:check
```

This builds the application, creates a Nest application context using the same
configuration, and runs MongoDB's `ping` command. It exits nonzero on invalid
configuration or a failed connection.

To seed a small, repeatable sample quest pool for today's Trinidad date:

```sh
npm run db:seed
```

The seed adds five template fixtures, one published daily pool, and
five playable quest instances. It does not create guest users or completion
history. The operation is idempotent and will not replace a different pool
already published for today's date.

## Quest acceptance

`POST /api/quests/:questId/accept` accepts only an available quest from the
published pool currently shown on the board (today's pool or the latest
published fallback). It saves an immutable snapshot of the displayed quest
instructions, criteria, safety guidance, duration, difficulty, rarity, region,
and XP. A repeated request for the same active quest returns that acceptance;
a different active quest returns HTTP 409 with `code: "active_quest_exists"`.
Completed or expired acceptances no longer occupy the active slot, so the
quest instance may be accepted again as a new acceptance. Invalid ObjectIds
return HTTP 400 and quests outside the current pool or no longer available
return HTTP 404.

New acceptances return HTTP 201; returning an existing active acceptance
returns HTTP 200. The response contains the acceptance `id`, `questId`,
`status`, ISO `acceptedAt`, and `questSnapshot`. Acceptance does not implement
verification, completion, or XP awards.

## Text evidence submission

`POST /api/acceptances/:acceptanceId/submissions` accepts only an acceptance
owned by the guest and in `accepted` or `retry` status. Send JSON containing a
trimmed `evidenceText` of 1–2,000 Unicode characters and a required
`Idempotency-Key` header (1–128 visible ASCII characters). The attempt starts
as `pending`; the acceptance changes atomically to `submitted` and retains its
active-quest marker. New attempts return HTTP 201. Repeating a key for the
same acceptance and same evidence returns its existing attempt with HTTP 200;
reusing it with different evidence or for another acceptance returns HTTP 409.
A non-submittable acceptance also returns HTTP 409. Unknown or other guests'
acceptances return HTTP 404.

The response contains only the attempt ID, acceptance ID, attempt number,
status, and ISO submission time; it never returns evidence text. Evidence is
marked for deletion 30 days after submission.

## Gemma verification worker

The API does not connect into the home network. The home-server worker makes
outbound HTTPS requests to the API using the configured
`VERIFICATION_WORKER_SECRET` as a bearer credential. It does not connect to
MongoDB or expose an inbound port.

- `POST /api/internal/verification/claim` atomically leases one pending
  submission and returns `available: false` when none can be claimed. A claim
  includes the attempt/acceptance IDs, attempt number, a one-claim token and
  expiry, the accepted quest snapshot and criteria, and private evidence text.
  Only send Gemma the snapshot, criteria, and evidence; do not send IDs or
  claim credentials to the model. The evidence must not be logged or returned
  to the player.
- `POST /api/internal/verification/attempts/:attemptId/result` accepts the
  claim token and structured assessment:

  ```json
  {
    "claimToken": "<claim token>",
    "assessment": {
      "status": "verified",
      "reason": "The response addresses the accepted quest criteria.",
      "confidence": 0.87,
      "failedCriteria": []
    }
  }
  ```

- `POST /api/internal/verification/attempts/:attemptId/failure` accepts the
  token and a bounded error code (`model_unavailable`, `model_timeout`,
  `invalid_output`, or `worker_error`) to release a failed job for retry.
  Unreported failures become claimable again after the lease expires.

The API validates the exact assessment shape, reason length, confidence range,
and that failed criteria belong to the accepted snapshot. Confidence below
`0.75` is stored as `review` and cannot award XP. Invalid output and model
failures stay pending/retryable. `retry` returns the acceptance to `retry`;
`review` keeps it submitted and active without XP. Verified results atomically
complete the acceptance, clear its active marker, record completion, and award
fixed rarity XP only once per guest and quest instance.

The player can poll `GET
/api/acceptances/:acceptanceId/submissions/:attemptId` for status and feedback;
that response never contains evidence. The worker uses an Ollama-compatible
`POST /api/chat` structured-output request. The runtime base URL and model
name are supplied by the home-server environment and are not checked into the
repository. The worker sends only the accepted quest snapshot, completion
criteria, and evidence to the local model; claim tokens and API credentials
are not included in the prompt. It validates model output before submitting
it and reports malformed output or model failures through the API's failure
route. API and model requests have bounded timeouts, and result delivery is
retried only until the lease deadline; the API remains responsible for making
expired claims retryable.

### Run on the home server

Use Node.js 20.6 or newer. Copy `worker/.env.example` to `worker/.env` and
configure:

- `API_BASE_URL`: the API origin, such as the HTTPS Render service origin.
  Plain HTTP is accepted only for a loopback development API.
- `VERIFICATION_WORKER_SECRET`: the same random secret configured on the API.
- `VERIFICATION_LEASE_SECONDS`: the API's configured lease duration. Worker
  inference and API timeouts must fit inside that lease.
- `GEMMA_BASE_URL`: the configured local Ollama-compatible runtime origin.
- `GEMMA_MODEL`: the exact model name already installed in that runtime.
- `WORKER_POLL_INTERVAL_MS`, `WORKER_API_TIMEOUT_MS`, and
  `WORKER_MODEL_TIMEOUT_MS`: polling cadence and bounded request timeouts.

Start the worker from this backend directory:

```sh
npm run worker:verify
```

The worker polls until stopped with Ctrl-C/SIGTERM. Logs contain operational
status and attempt IDs only; they do not include credentials, submitted
evidence, model prompts, or model output. No Gemma model name or version is
hardcoded by this repository. The exact installed model name is configured
locally; `gemma4:e2b-it-qat` has completed a local end-to-end inference through
this worker and API.

## Collections and indexes

Mongoose schemas explicitly bind to `users`, `questTemplates`,
`questPoolBatches`, `quests`, `questAcceptances`, `submissionAttempts`,
`questCompletions`, and `xpAwards`. Required unique and lookup indexes are
declared in the corresponding schema files and are built at startup.

The logical data model remains in `../docs/data-model.md`. The API implements
the quest and verification transitions described there; daily pool generation
and publication and the scheduled evidence-deletion job remain unimplemented.
