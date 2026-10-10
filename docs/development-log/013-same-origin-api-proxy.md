# 013 — Same-origin API proxy for hosted guest sessions

## Problem

On the hosted mobile frontend, the player saw “A valid guest session is
required” and could not load the quest board. The frontend and API used
different hosting sites (Vercel and Render), so mobile browser third-party
cookie restrictions could prevent the browser from retaining or sending the
HttpOnly guest cookie.

## Change

- Added a Vercel rewrite from `/api/*` to the deployed Render API at
  `https://sidequest-tt.onrender.com/api/*`, ahead of the SPA fallback.
- Production frontend builds now call same-origin `/api`; local builds retain
  the configurable `VITE_API_BASE_URL` and localhost default.
- Updated the architecture and root README to document the hosting route.

## Verification status

The frontend production build and `git diff --check` pass. The deployed Vercel
rewrite and mobile cookie behavior have not yet been verified; this change
must be deployed before they can be confirmed. No API records or seeded quests
were changed.

## Next step

Deploy the frontend change, then confirm on mobile that guest creation,
refresh recovery, and quest-board loading work through the Vercel origin.
