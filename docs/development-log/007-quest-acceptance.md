# 007 — Quest acceptance

## Completed

- Added `POST /api/quests/:questId/accept`, protected by the existing guest
  session cookie.
- Acceptance is limited to available quest instances in the published batch
  selected by the quest board: today's published pool, or the most recent
  published fallback. Quests from another batch, quests with a non-available
  status, and quests whose expiry time has passed are rejected.
- Each acceptance stores a snapshot of the title, description and proof
  instructions, completion criteria, safety guidance, duration, difficulty,
  rarity, region, and displayed XP.
- Repeated acceptance of the same currently active quest returns the existing
  acceptance. A different active quest returns HTTP 409. Completed or expired
  acceptances without `activeUserId` allow a new acceptance of the same quest
  instance.
- Concurrent requests rely on the existing unique sparse `activeUserId`
  index. Duplicate-key races resolve to the winning same-quest acceptance or
  return a conflict identifying the different active quest.
- Added ObjectId validation and Swagger response documentation. No evidence,
  verification, completion, or XP behavior was added.
- Updated `backend/README.md`.

## Verification

- `npm run build` passes.
- End-to-end checks against the configured MongoDB verified session
  authorization, new acceptance response and snapshot fields, same-quest
  request reuse, the different-active-quest conflict, concurrent same-quest
  reuse, concurrent different-quest exclusivity, re-acceptance after marking a
  temporary acceptance terminal, invalid-ID and unavailable-quest responses,
  and Swagger's 200/201/400/401/404/409 response documentation.
- All temporary guest and acceptance test records were removed. Existing
  seeded quests and pool data were not changed.

## Response contract

New acceptance:

```json
{
  "id": "507f1f77bcf86cd799439012",
  "questId": "507f1f77bcf86cd799439011",
  "status": "accepted",
  "acceptedAt": "2026-10-08T16:15:00.000Z",
  "questSnapshot": {
    "title": "Notice a New Detail",
    "description": "Spend a few minutes noticing details in a public place you already visit.",
    "region": "Trinidad",
    "durationMinutes": 15,
    "difficulty": "easy",
    "rarity": "common",
    "xp": 25,
    "proofInstructions": "Describe three details you noticed.",
    "completionCriteria": ["Describe three distinct details."],
    "safetyGuidance": ["Stay in a public area."]
  }
}
```

If a different quest is already active, HTTP 409 returns `code:
"active_quest_exists"` and the active `activeAcceptanceId` and `activeQuestId`.
Evidence submission, quest completion, and XP awards remain unimplemented.
