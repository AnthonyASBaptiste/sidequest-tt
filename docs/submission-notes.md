# Submission notes

**Purpose:** Keep a concise, factual record for the Hacktoberfest Touch Grass
submission and its write-up. This is an internal working note, not a public
build-in-public log or posting schedule.

## Priority

Finish the submission and its write-up first. Do not add community research,
extra technical exploration, or public progress posts unless they directly
unblock the submission or are requested.

## Verified milestones

| Milestone | Recorded outcome | Write-up value |
| --- | --- | --- |
| Product framing and MVP decisions | SideQuest T&T is a real-world RPG, not a travel planner. The MVP covers Trinidad with one shared daily pool, screen-away play, guest accounts, and text evidence. See development logs 001–003. | Explain the product distinction, local scope, and deliberate cuts. |
| NestJS/Mongoose and Atlas foundation | Backend configuration, schemas/indexes, connection check, and sample seeding were added. See development log 004. | Show why Atlas is the persistent source of game state and NestJS owns writes. |
| Read-only quest board | Board returns today's published pool or the latest published fallback, with Trinidad calendar dates. See development log 005. | Describe resilient daily quest selection without player rerolls. |
| Guest identity and completion markers | Browser guest sessions use a hashed token; the board exposes per-player completion metadata. See development log 006. | Describe lightweight identity and replay-friendly game behavior. |
| Quest acceptance | Acceptance snapshots preserve the offered quest; a unique active-user index handles concurrent one-active-quest requests. See development log 007. | Highlight server-authoritative state and idempotent/concurrent behavior. |
| Text evidence submission | Numbered pending attempts use a 2,000-character limit, idempotency keys, atomic state changes, and 30-day deletion metadata. See development log 008. | Explain privacy-conscious evidence capture and retry-safe persistence. |
| Verification and XP transition | The API exposes authenticated, leased worker claims/results, validates assessments at an initial 0.75 confidence threshold, and transactionally completes quests and awards fixed XP once. A disposable local run with Ollama `gemma4:e2b-it-qat` took 13.484 seconds and returned `review` without XP. On 2026-10-10, the same model processed a real hosted submission in 12.377 seconds; the user-provided October 11 video additionally shows a retry request followed by “QUEST VERIFIED,” +25 XP, and a 100 XP total. See development logs 009, 010, 014, and 018. | Show the API/model boundary and exactly-once game state while accurately describing local and hosted evidence. |
| Generated daily quest pools | The API serves reviewed templates to the authenticated home-server worker, validates Gemma's structured candidates, and transactionally publishes a complete pool. The user-provided hosted demo video shows the October 11, 2026 board and generated entries including “Public Space Detail Tracker” (Rare, 100 XP) and “Route Deviation Discovery” (Common, 25 XP); it does not show the whole pool. See development logs 017 and 018. | Demonstrate Gemma generating playable content while the API keeps safety, criteria, rarity, and rewards authoritative. |
| Player-facing flow | A React/Vite app builds and was exercised in a browser against the local API: guest cookie, dated fallback pool, quest details and safety, acceptance, screen-away/return, text submission, and pending status. Evidence was not found in local or session storage. The disposable guest, acceptance, and submission were removed; all five seeded quests remained. See [development log 011](development-log/011-player-facing-flow.md). | Demonstrate the screen-away loop and how the frontend leaves game state and XP authoritative on the API. |

These entries describe work recorded as implemented and verified in the
development logs, with the outdoor playtest and retry-flow confirmation also
reported directly by the user. Phone testing covered real outdoor quests; the
provided video now shows the October 11 generated pool on the hosted app.

## Submission narrative to assemble

- **Problem and experience:** make real-world exploration feel like an RPG and
  deliberately reduce screen time while a quest is underway.
- **What makes it distinct:** quests are gameplay, not itineraries; Gemma
  generates the shared quest pool and assesses evidence, while the API enforces
  game rules.
- **Architecture:** local Gemma/home-server worker, NestJS API, MongoDB Atlas,
  and the Vite frontend. The hosted video shows a verifier retry followed by a
  successful verification and XP award.
- **Technical decisions worth showing:** dated fallback pools, immutable
  acceptance snapshots, one-active-quest enforcement, idempotent submissions,
  transaction-backed state changes, and evidence retention metadata.
- **Honest demo status:** the user confirmed the retry flow on mobile and has
  completed outdoor quests. The video shows a generated October 11 pool, a
  successful verification after the player added detail, +25 XP for the quest,
  and a 100 XP total.
- **Evidence to collect:** working demo URL, repository link, screenshots or
  short demo capture, and actual playtest observations if available.

## Deferred until submission needs it

- Community/library research and other optional technical “wisdom.”
- A public build-in-public cadence or progress posts.
- Persistent worker startup/monitoring on the home server and the evidence
  deletion job.
- Claims about user enjoyment; outdoor completion has been tested, but no
  broader user feedback has been collected.

## Hosted worker operation

The worker's ignored local environment now points to
`https://sidequest-tt.onrender.com`; the hosted API accepted one result using
the configured secret and 120-second lease. The worker was stopped after that
attempt, so start and keep `npm run worker:verify` running on the home server
to process future submissions. Keep model settings and credentials in the
worker's local environment.
