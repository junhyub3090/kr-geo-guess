# Game Service Loop Phase 3 Plan

**Goal:** Finish the remaining service-loop follow-ups from phase 2 and reduce structural risk without changing scoring, seed selection rules, or round fairness.

## 1. Same-member Friend Room Rematch

- [x] Add a finished-room rematch API that creates a same-settings lobby and preserves the prior members as expected seats.
- [x] Expose the rematch room code through the old finished room so guests can join from the final screen.
- [x] Update host and guest final actions so the behavior is clear and testable.
- [x] Add API and two-browser Playwright coverage for host create + guest join rematch.
- [x] Lock rematch rooms against normal join and keep child-code joins working if the source room is gone.
- [x] Add host recovery for missing rematch members with `allowMissingRematchPlayers`.

## 2. Admin Seed Issue Operations

- [x] Add a typed web API client for seed issue summary and authenticated issue list.
- [x] Build a focused admin screen at `?admin=seed-issues` with token entry, issue list, reason/map quality summary, and exclude-candidate copy.
- [x] Keep the admin screen out of the main player flow and avoid storing the token beyond the session.
- [x] Add Playwright coverage for summary load, token auth, and issue triage rendering.
- [x] Clear stale issue lists on auth failure and map raw API errors to Korean operator copy.

## 3. Daily Challenge Fairness

- [x] Keep daily rounds deterministic by Korea date so everyone sees the same 5 national mixed rounds.
- [x] Store local daily attempt status so the first completion is the official result.
- [x] Mark later starts as practice attempts and keep them out of official leaderboard recording.
- [x] Show official/practice state on the home panel and final result screen.
- [x] Add Playwright coverage for official-first and practice replay behavior.

## 4. Structural Risk Pass

- [x] Keep room rematch state local to the room store seam and avoid duplicating room creation behavior across routes.
- [x] Keep admin API concerns in one web client module instead of leaking bearer header logic into UI components.
- [x] Check timer, polling, localStorage, and zoom reset risks touched by this phase.
- [x] Clean up copy-status timeouts on unmount for room lobby, final results, and admin surfaces.

## 5. Verification

- [x] Targeted API tests.
- [x] Targeted Playwright tests.
- [x] Subagent implementation review.
- [x] Subagent UX/risk review.
- [x] Fix review findings.
- [x] Final `npm run qa`.
- [x] Commit and push.
