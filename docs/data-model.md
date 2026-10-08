# SideQuest T&T — MongoDB Data Model

**Status:** MVP schema proposal  
**Persistence:** MongoDB Atlas, accessed only by the NestJS API

## MVP decisions captured here

- Gemma runs in a container on the always-on home server and generates one
  shared daily quest pool for players in Trinidad.
- A published daily pool contains 5–10 quests. The home-server job runs at 04:00
  in `America/Port_of_Spain`. Players cannot reroll or trigger regeneration.
- If today's generation fails, serve the most recently published pool (normally
  yesterday's) with its actual date and a previous-pool notice. Keep it available
  for acceptance until a newer pool is successfully published.
- If no pool has ever been published, show a clear unavailable state; never
  fabricate a board or publish a partial batch.
- The daily job sends generated candidates to the API. The API validates and
  persists them in Atlas; Gemma never writes directly to the database.
- Tobago selection is a stretch goal. The MVP region is Trinidad as a whole;
  quests may describe a broad, accessible local context but must not require
  GPS, private property, or unverified access.
- “Offline” means the player puts the phone away during the activity. The app
  does not promise offline access or sync. Acceptance and evidence submission
  require a connection; the UI should explain when the service is unavailable.
- An accepted quest remains tied to the exact quest instructions and criteria
  the player accepted, even if its daily board entry later expires.
- The board response includes the pool date, whether it is being served as a
  fallback, and the player's most recent completion date for each quest. These
  are response metadata; a completion marker does not disable acceptance.

## Collections

The following shapes are logical contracts, not a commitment to a particular
ODM. ObjectId is used for document references. All timestamps are UTC; daily
pool dates are calendar dates in `America/Port_of_Spain`.

### `users`

```js
{
  _id: ObjectId,
  name: String,                  // optional display name
  auth: {
    provider: "guest",
    subject: String               // unique server-issued guest identity
  },
  region: "Trinidad",             // Tobago is a stretch goal
  preferences: {},                // no MVP preference controls
  xp: Number,                     // cached total from xpAwards
  createdAt: Date,
  updatedAt: Date
}
```

Do not store credentials in this collection. The API creates a guest identity
on first use and issues a secure, HttpOnly cookie. No email or password is
collected. Progress is tied to that browser and cannot be recovered across
browsers/devices in the MVP; sign-in and recovery are deferred. Enforce
uniqueness on `(auth.provider, auth.subject)`.

### `questTemplates`

```js
{
  _id: ObjectId,
  version: Number,
  active: Boolean,
  rarity: "common" | "uncommon" | "rare",
  difficulty: "easy" | "moderate" | "challenging",
  activityShape: String,
  generationGuidance: String,
  completionCriteria: [String],
  proofInstructions: String,
  safetyGuidance: [String],
  allowedRegions: ["Trinidad"],
  createdAt: Date,
  updatedAt: Date
}
```

Templates are human-reviewed and versioned. Their criteria, safety limits, and
proof requirements bound Gemma's wording and variation; generated text cannot
override them. Legendary templates are deferred.

### `questPoolBatches`

One record tracks the once-per-day generation and publication for a region.
The unique date/region key makes the scheduled job idempotent.

```js
{
  _id: ObjectId,
  poolDate: "YYYY-MM-DD",        // local date in America/Port_of_Spain
  region: "Trinidad",
  status: "generating" | "published" | "failed",
  questCount: Number,
  model: String,
  promptVersion: String,
  startedAt: Date,
  publishedAt: Date | null,
  errorCode: String | null
}
```

A failed generation is visible operationally; it must not be presented as a
successful new pool. The API continues serving the latest published pool and
marks it as a previous pool with its actual date. That pool remains available
for new acceptances until a newer pool is successfully published; at that point
its quests receive an expiry time. Generation retries, if needed to finish an
unpublished batch, are server/operator behavior—not a player reroll. A
published batch is immutable. The scheduled run starts at 04:00 local time in
`America/Port_of_Spain`.

### `quests`

Each document is a validated quest instance in a daily pool. Quest content is
immutable; availability status and expiry may change when a newer pool is
successfully published.

```js
{
  _id: ObjectId,
  batchId: ObjectId,
  slot: Number,
  templateId: ObjectId,
  templateVersion: Number,
  title: String,
  description: String,
  region: "Trinidad",
  localContext: String | null,
  durationMinutes: Number,
  difficulty: "easy" | "moderate" | "challenging",
  rarity: "common" | "uncommon" | "rare",
  xp: Number,
  proofType: "text",
  proofInstructions: String,
  completionCriteria: [String],
  safetyGuidance: [String],
  generatedBy: "gemma",
  model: String,
  promptVersion: String,
  availableOn: "YYYY-MM-DD",
  expiresAt: Date | null,       // set when a newer pool replaces this pool
  status: "available" | "expired" | "disabled",
  createdAt: Date
}
```

Rarity and duration bands:

| Rarity | MVP duration |
| --- | --- |
| Common | 10–30 minutes |
| Uncommon | 30–60 minutes |
| Rare | 60–120 minutes |
| Legendary | Deferred; intended for 120+ minutes |

Quest ideas by rarity include noticing something on a different route (Common),
trying somewhere new or exploring a different neighbourhood (Uncommon), and a
multi-step exploration or visiting somewhere new (Rare). A Common architecture
quest can ask the player to describe what they noticed; taking a photo is not
an MVP evidence option. Legendary ideas such as crossing into an unexplored
part of Trinidad remain future content.

The API validates rarity/duration bounds, XP bounds (Common 25, Uncommon 50,
Rare 100), region, text lengths, non-empty criteria, and required safety
guidance before publishing a quest. Difficulty is defined by the reviewed
template; players do not select it in the MVP.
Validate every candidate before inserting any quests, then persist the complete
batch and mark it published atomically. An unpublished failed batch can be
retried idempotently; a published batch cannot be regenerated or replaced by
player action.
A quest must not depend on travel by car, payment, private access, or unverified
opening hours.

### `questAcceptances`

One record represents one player's acceptance of one quest instance. The
snapshot preserves what was offered at acceptance. Retrying insufficient
evidence uses this same acceptance.

```js
{
  _id: ObjectId,
  userId: ObjectId,
  questId: ObjectId,
  acceptanceNumber: Number,        // increments for each re-acceptance
  activeUserId: ObjectId,          // present only while the player has an active quest
  questSnapshot: {
    title: String,
    description: String,
    region: String,
    durationMinutes: Number,
    difficulty: String,
    rarity: String,
    xp: Number,
    proofInstructions: String,
    completionCriteria: [String],
    safetyGuidance: [String]
  },
  status: "accepted" | "submitted" | "retry" | "completed" | "expired",
  acceptedAt: Date,
  updatedAt: Date
}
```

Allow one active acceptance per player at a time. After completion or expiry,
the player may accept the same quest instance again. A unique sparse index on
`activeUserId` prevents multiple active quests; remove this field when the
acceptance becomes terminal. Use an idempotency key for repeated accept
requests. Re-acceptance does not reset prior completion history.

### `submissionAttempts`

Each new evidence submission creates a numbered attempt. If verification is
unavailable, the same attempt remains pending and can be re-verified when
Gemma is reachable; this is distinct from asking the player to improve
insufficient evidence.

```js
{
  _id: ObjectId,
  acceptanceId: ObjectId,
  attemptNumber: Number,
  evidenceText: String,
  status: "pending" | "verified" | "retry" | "review",
  verification: {
    reason: String | null,
    confidence: Number | null,
    failedCriteria: [String],
    model: String | null,
    evaluatedAt: Date | null
  },
  lastErrorCode: String | null,
  evidenceDeleteAt: Date,         // 30 days after submission
  createdAt: Date,
  updatedAt: Date
}
```

After 30 days from submission, delete `evidenceText` and retain only outcome
metadata. If verification is still pending at that point, expire the attempt
without XP. A scheduled deletion job unsets the evidence field; it must not
TTL-delete the attempt metadata. Gemma output is untrusted. The API validates
the response and applies the confidence threshold. Unavailable Gemma, malformed
output, `review`, and low confidence cannot create a completion or award XP.
Do not log raw evidence or include it in error reporting.

### `questCompletions`

Only a verified attempt creates a completion. There is at most one completion
per acceptance.

```js
{
  _id: ObjectId,
  userId: ObjectId,
  questId: ObjectId,
  acceptanceId: ObjectId,
  winningAttemptId: ObjectId,
  completedAt: Date
}
```

### `xpAwards`

This immutable ledger is the source of truth for XP awards. `users.xp` is only
a summary/cache and must be updated with the ledger entry.

```js
{
  _id: ObjectId,
  userId: ObjectId,
  completionId: ObjectId,
  questId: ObjectId,
  amount: Number,
  awardedAt: Date
}
```

Create the completion and, if no prior award exists for this user and quest
instance, the unique XP award and user XP summary update in one Atlas
transaction. A replay of a previously completed quest instance may create a new
acceptance and completion, but cannot create another XP award. Duplicate
requests must return the existing result rather than award XP again. If
transaction support is not available in the chosen Atlas deployment, use an
explicitly designed idempotent recovery strategy before launch; do not silently
weaken the exactly-once requirement.

## Required indexes and invariants

- `questPoolBatches`: unique `{ region: 1, poolDate: 1 }`.
- `quests`: unique `{ batchId: 1, slot: 1 }`; board lookup on
  `{ region: 1, status: 1, availableOn: 1 }`.
- `questAcceptances`: unique `{ userId: 1, questId: 1, acceptanceNumber: 1 }`;
  unique sparse `{ activeUserId: 1 }` while an acceptance is active; lookup by
  `{ userId: 1, status: 1, acceptedAt: -1 }`.
- `submissionAttempts`: unique `{ acceptanceId: 1, attemptNumber: 1 }`.
- `questCompletions`: unique `{ acceptanceId: 1 }`; history lookup on
  `{ userId: 1, questId: 1, completedAt: -1 }` for dated completion badges.
- `xpAwards`: unique `{ completionId: 1 }` and unique `{ userId: 1, questId: 1 }`;
  XP history lookup on `{ userId: 1, awardedAt: -1 }`.
- `users`: unique `{ auth.provider: 1, auth.subject: 1 }`.

Do not TTL-delete quest instances, acceptances, completions, or XP awards: they
are referenced by history and must remain consistent. A scheduled job removes
evidence text after 30 days but retains attempt metadata. Define a guest
profile deletion path before public playtesting.

## Still to decide before implementation

- Exact Gemma runtime/model version after checking home-server hardware.
- Evidence text length limit and verification confidence threshold.
- Cookie implementation details and the scheduled evidence deletion job.
