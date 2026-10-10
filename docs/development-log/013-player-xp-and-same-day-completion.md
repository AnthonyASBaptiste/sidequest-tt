# Player XP and same-day completion

## Goal

Show the guest's cumulative XP in the player header and visibly mark quests
completed on the current Trinidad calendar day.

## Implemented

- Added `completedToday` to each quest-board response, alongside
  `lastCompletedAt` and `completedYesterday`. The day comparison uses
  `America/Port_of_Spain`.
- Added a header tally sourced from the guest-session API's server-reported XP.
- After a verified result, refresh the guest XP, recent completion, and quest
  board. Show “Completed today” on matching quest cards.
- Documented the response flag and player-facing behavior.

## Verification

- Backend and frontend production builds passed; `git diff --check` passed.
- With a disposable guest and non-sensitive sample reflection, the local API
  accepted an authenticated worker assessment marked verified and awarded 25
  XP. The UI displayed `25 XP`, the verified result, and “Completed today”.
- Reloading the page preserved the tally and same-day marker from server data.
- Removed the disposable acceptance, submission attempt, completion, and XP
  award, and restored the guest's original XP. Seeded quests were left intact.
- This check exercised the API's assessment contract; it did not run Gemma.

## Files

- `backend/src/quests/dto/todays-quest.dto.ts`
- `backend/src/quests/quests.service.ts`
- `frontend/src/App.tsx`
- `frontend/src/styles.css`
- `docs/data-model.md`
- `backend/README.md`
- `README.md`
