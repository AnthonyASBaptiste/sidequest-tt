# 015 — Completed result recovery after refresh

## Problem

After the hosted worker returned a real Gemma assessment, refreshing the mobile
app showed the quest board with no indication that a reflection had been
submitted. Successful verification marks the acceptance completed and clears
its active-user marker. The existing `GET /api/quests/active` response then
returned two null fields, so the frontend had no result to restore.

## Change

- Extended the guest-protected active-quest response with `recentCompletion`,
  containing the latest completed quest snapshot, verified feedback, XP, and
  completion time when no quest is active.
- Kept evidence text and guest/session secrets out of the response.
- The frontend now shows a dismissible completion message above the quest
  board after refresh. Accepting a new quest clears that message.
- Updated backend and architecture documentation.

## Verification status

Builds and diff checks are pending. The mobile refresh behavior requires the
backend and frontend changes to be deployed before it can be confirmed.
