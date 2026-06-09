# Game Service Loop Phase 2 Plan

**Goal:** Deepen the service loop around the existing game without changing scoring, seed selection, or core round rules.

## 1차 이후 2차 실행 범위

### 1. 게임 감각 강화

- [x] Add visible result tone and restrained score feedback to the solo reveal panel.
- [x] Add CSS-only micro-interactions for score, result tone, and final highlights.
- [x] Verify no layout shift or mobile clipping.

### 2. 반복 플레이 구조

- [x] Add local progress storage for recent games, daily streak, and map mastery.
- [x] Show streak/recent progress on home.
- [x] Add final result branches for same settings, harder difficulty, and another region.

### 3. 결과 화면 핵심화

- [x] Add final summary panels for best round, largest miss, average error, and share-ready text.
- [x] Add tests for final result summary labels and branch actions.

### 4. 친구방 경험 강화

- [x] Add a host rematch action that creates a new room with the same settings.
- [x] Keep copy/share result flow and make the action copy match its behavior.
- [x] Verify friend room final flow.

### 5. 지도/지역 학습

- [x] Expand seed tag labels into learning hints.
- [x] Show short location hint text after reveal/final history.
- [x] Verify no raw tag code leaks.

### 6. 랭킹 고도화

- [x] Add map/difficulty-aware personal best, 1st-place gap, and recent record surface.
- [x] Keep existing leaderboard filters stable.

### 7. 운영/품질 도구

- [x] Add aggregate-safe seed issue list endpoint for admin triage.
- [x] Include map/reason/round/region metadata without raw player identifiers.
- [x] Add API tests and docs.

## Verification

- [x] Targeted Playwright and API tests.
- [x] Production render smoke for home/result/friend room surfaces.
- [x] Subagent requirements review.
- [x] Subagent code quality review.
- [x] Fix Important/Critical review findings.
- [x] Final `npm run qa`.
- [x] Commit and push.

## Follow-up Candidates

- Same-member friend room rematch: the current phase creates a clean same-settings room and remounts the host session. A fuller rematch should let guests discover or join the new room from the old final screen.
- Admin UI for seed issue triage: the current phase exposes an authenticated API and docs. A later phase can add an operator-facing issue list and quality dashboard.
