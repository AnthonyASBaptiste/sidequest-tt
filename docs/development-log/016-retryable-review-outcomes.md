# 016 — Make review outcomes retryable

## Problem

During testing, an obviously irrelevant reflection produced an `AWAITING
REVIEW` result that prevented another submission. The MVP has no human review
queue. The API can store `review` either when Gemma requests it or when its
confidence is below the 0.75 threshold, and both paths left the acceptance in
`submitted` state.

## Change

- The API now converts explicit review and below-threshold assessments to a
  retryable result with no XP.
- Existing legacy review attempts can be resubmitted without changing or
  deleting their original record.
- The review screen now offers a “Write another reflection” action and explains
  that no manual review is required.
- Updated the worker prompt to classify clearly irrelevant evidence as retry.
- Updated the product, architecture, data-model, and backend documentation.

## Verification status

Backend and frontend builds and `git diff --check` pass. The fix has not yet
been deployed or confirmed on mobile. It does not alter or reveal submitted
evidence text.
