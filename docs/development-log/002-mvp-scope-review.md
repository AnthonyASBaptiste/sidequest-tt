# 002 — MVP scope review

## Review

A review of the initial product and architecture documents identified schedule, safety, local inference, evidence handling, and duplicate-reward risks. The MVP was narrowed to one pilot area and 5–10 quests, with text-only evidence, no map or GPS, and text feedback instead of voice.

## Decisions recorded

- Gemma remains the player-facing product AI. It generates a bounded set of quest instances from human-reviewed templates, and assesses written completion evidence.
- The backend validates generated quests and verification results. Invalid output, low confidence, timeout, or model outage cannot award XP; the submission remains retryable.
- The API and data model must enforce one completion and one XP ledger award per accepted quest.
- Safety guidance must be visible before acceptance, and the active-quest screen should make it easy to put the phone away.
- Photo evidence, ElevenLabs voice, live maps/GPS, and social features are deferred.

## Open decisions

The single pilot area, fixed-versus-player-selected area behavior, local Gemma runtime and exact model/version, hardware assumptions, startup flow, and numeric XP rules remain undecided. No implementation or playtest result is claimed by this review.
