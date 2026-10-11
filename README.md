# SideQuest T&T

SideQuest T&T is an AI-powered real-world RPG that uses a local open-weight
Gemma model to generate a shared daily quest pool for Trinidad, getting players
off their screens and out exploring.

## Product principle

This is a game whose quests happen in the real world—not a travel planner. The
screen should disappear for the largest part of the experience, supporting the
Hacktoberfest Week 1 "Touch Grass" theme.

## Core game loop

```mermaid
flowchart TD
    A[Quest board] --> B[Accept quest]
    B --> C[Go outside - screen away]
    C --> D[Submit proof]
    D --> E[Gemma verifies]
    E -->|Verified| F[Earn XP]
    F --> G[Quest complete]
    G --> H[Text completion feedback]
    E -->|Rejected| I[Try again]
    I --> D
```

## Proposed architecture

```mermaid
flowchart TD
    U[User] --> UI[React + Vite UI]
    UI -->|HTTPS| API[NestJS API on Render]
    API --> DB[MongoDB Atlas - player and game state]
    HS[Home server: daily Gemma job] -->|Pool submission over HTTPS| API
    HS -->|Poll for verification jobs| API
    HS -->|Post signed verification result| API
    HS --> GM[Local open-weight Gemma model]
```

Gemma generates one shared pool of 5–10 quests daily from reviewed templates.
The home server sends the pool to Render and polls for verification jobs; it
never connects directly to Atlas. Players cannot reroll. If today's generation
fails, the app shows the most recently published pool with its date. If no
pool has been published yet, the board shows an unavailable state. A quest
completed today or yesterday is marked but can be tried again; XP is awarded
only once for each player and quest instance. The player header shows the
server-reported total XP, updated when verification completes. The MVP uses
guest accounts and awards 25, 50, or 100 XP by rarity. Voice, levels, and
Tobago selection are deferred.
MongoDB Atlas persists game state through the API.

## Project status

The NestJS API now supports guest sessions, the Trinidad quest board,
acceptance, text evidence, worker verification, and server-authoritative XP.
The home-server verification worker has completed real local and hosted
Gemma inference using `gemma4:e2b-it-qat`. The repository now also contains a
daily quest-pool generator: Gemma produces candidates from the reviewed
templates, while the NestJS API validates and publishes the pool. A real
five-quest generation was published and read back from the development Atlas
database; the temporary data was then cleaned up. Today's hosted pool remains
the original seed because it already has player activity. A small React/Vite player flow is available in `frontend/`
and hosted on Vercel; the API is hosted on Render. Vercel proxies `/api/*` to
the Render API so the browser uses a same-origin guest cookie, including on
mobile browsers with strict third-party cookie handling.

## Run locally

Start the API using the existing Atlas connection:

```sh
cd backend
npm install
npm run start:dev
```

In another terminal, start the player app:

```sh
cd frontend
npm install
npm run dev
```

The frontend defaults to `http://localhost:3000/api`. Copy
`frontend/.env.example` to `frontend/.env` to set `VITE_API_BASE_URL` to a
different local API origin and `/api` prefix. Production builds use the
same-origin `/api` proxy configured in `frontend/vercel.json`. For local
browser requests, set the ignored `backend/.env` value
`FRONTEND_ORIGIN=http://localhost:5173`. Frontend configuration contains no
worker, database, or model credentials.

The player flow uses a browser guest cookie, displays the current or dated
fallback quest pool, shows quest criteria and safety guidance before
acceptance, submits text reflections, and polls server verification status.
Evidence remains in page memory only and is not stored in browser storage.
Verified XP is displayed only from the API response.

The player has completed real outdoor quests and confirmed the retry flow on
mobile. The current production pool is still the original seeded pool. The
board now requests a generated pool on first visit for a Trinidad date without
one, while keeping the previous pool available; the home-server worker must be
running to fulfill that request. Existing acceptances, submissions, and
completions remain intact. The API and verification worker use matching
credentials and a 120-second lease.
