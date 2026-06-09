# Game Service Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the current playable game into a stronger repeat-play service loop without changing the core scoring or round-selection rules.

**Architecture:** Add small, focused UI and API surfaces around existing match, leaderboard, seed tag, and seed issue data. Keep game logic in `@kr-geo-guess/shared` untouched except for display helpers if needed; web changes stay inside existing feature folders and backend changes stay inside HTTP store/route boundaries.

**Tech Stack:** React 19, Vite, TypeScript, Express 5, Playwright, Vitest/Supertest.

---

## File Structure

- `apps/web/src/features/game/gameInsights.ts`: Korean display helpers for seed tags, score bands, share text, and result summaries.
- `apps/web/src/features/game/GameScreen.tsx`: reveal/final result panels, restart actions, learning chips.
- `apps/web/src/features/game/RoomGamePanels.tsx`: friend room final result share/rematch-facing actions.
- `apps/web/src/features/api/staticGameApi.ts`: static daily match creation using existing `createDailyChallenge`.
- `apps/web/src/features/home/HomeScreen.tsx`: daily challenge CTA, ranking mode filter, personal best summary.
- `apps/web/src/App.tsx`: orchestration state for daily start, restart same settings, ranking mode filtering.
- `apps/realtime/src/http/createApiApp.ts`: aggregate seed issue summary endpoint.
- `apps/realtime/src/http/seedIssueStore.ts`: expose aggregate-safe seed issue rows through existing store interface.
- `apps/web/src/styles/*.css`: scoped visual styling for new result, home, room, and operation widgets.
- `apps/web/tests/game.spec.ts`: user-flow assertions for result/restart/daily/friend-room share.
- `apps/web/tests/visual-qa.spec.ts`: visual and layout assertions for ranking stability and learning/result UI.
- `apps/realtime/src/__tests__/api.test.ts`: seed issue summary API tests.

## Tasks

### Task 1: Round Result Experience

- [x] Add failing Playwright assertions that reveal shows score breakdown, region clue chips, and share copy.
- [x] Implement `gameInsights.ts` helpers for score label, tag labels, and result summary text.
- [x] Update solo reveal and final panels to show distance score, time bonus, learning tags, and shareable result text.
- [x] Verify the targeted tests pass.

### Task 2: Repeat Play Loop

- [x] Add failing Playwright assertions that final solo result exposes `같은 설정 다시` and returns to round 1 with the same map/timer.
- [x] Add `onRestartSameSettings` flow in `App.tsx` and pass it into `GameScreen`.
- [x] Update final result actions to include restart and home actions.
- [x] Verify targeted solo flow tests pass.

### Task 3: Daily Challenge Entry

- [x] Add failing Playwright assertions that the home daily panel has `오늘의 챌린지 시작` and starts a mixed 30-second national match.
- [x] Add `createStaticDailyMatch` in `staticGameApi.ts` using `createDailyChallenge`.
- [x] Wire `HomeScreen` and `App.tsx` to start the daily match.
- [x] Verify daily flow tests pass.

### Task 4: Ranking and Personal Best

- [x] Add failing Playwright assertions for ranking mode filters `전체`, `싱글`, `친구방` and personal best text.
- [x] Extend `HomeScreen` props and rendering to filter by difficulty and mode.
- [x] Add selected map/difficulty personal best summary based on existing leaderboard entries.
- [x] Verify ranking layout remains stable across filters.

### Task 5: Friend Room Share and Rematch Direction

- [x] Add failing Playwright assertions that final friend room results expose copyable result text and a clear rematch/home action.
- [x] Add share text generation for room results in `RoomGamePanels.tsx`.
- [x] Add a rematch-facing action that returns the user to the home flow with clear copy, without silently reusing old room state.
- [x] Verify friend room tests pass on desktop and mobile.

### Task 6: Region Learning Layer

- [x] Add failing Playwright assertions that reveal/final result surfaces show Korean clue labels derived from seed tags.
- [x] Implement tag label mapping in `gameInsights.ts` with safe fallback from kebab-case to readable Korean-ish labels.
- [x] Use clue labels consistently in solo reveal, final history, and friend room round history.
- [x] Verify visual QA around result surfaces.

### Task 7: Seed Quality Operations Summary

- [x] Add failing Supertest coverage for an aggregate `/api/seed-issues/summary` endpoint.
- [x] Implement endpoint returning total count plus grouped counts by reason and map, without player IDs or raw coordinates.
- [x] Add a concise operations note to `docs/project-guide.ko.md`.
- [x] Verify realtime API tests pass.

## Final Verification

- [x] `npm run qa`
- [x] Targeted Playwright production preview for: solo result/restart, daily start, ranking filters, friend room final share.
- [x] Subagent spec review for requirements coverage.
- [x] Subagent code quality review for regressions and maintainability.
- [x] Fix all Critical/Important review findings.
- [x] Final `npm run qa`
- [x] Commit and push.

## 2차 후보

- Authenticated admin dashboard for seed issue triage.
- Map-by-map achievement badges and streak history.
- True daily leaderboard keyed by date.
- Friend room rematch that preserves members through server-side room cloning.
- Optional WebSocket transport for lower-latency multiplayer.
