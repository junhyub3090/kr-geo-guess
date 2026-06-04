# UX Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the app friendlier and more polished while preserving the existing map guessing gameplay, scoring, seed, timer, and room rules.

**Architecture:** Keep game domain logic untouched in `packages/shared` and API stores. Change only the React presentation layer and Playwright UX contracts in `apps/web`, using existing components and SVG map infrastructure.

**Tech Stack:** React 19, Vite 6, TypeScript, CSS, lucide-react, Playwright.

---

### Task 1: Lock UX Intent With Failing Tests

**Files:**
- Modify: `apps/web/tests/visual-qa.spec.ts`
- Modify: `apps/web/tests/game.spec.ts`

- [ ] Add a home hub test that verifies the map preview is the dominant first-screen element, the start button is adjacent to the current map setup, secondary panels are lower visual weight, and the latest selected map persists after reload.
- [ ] Add a game surface test that verifies the guess map panel is large enough to support map-first decision making while keeping roadview visible.
- [ ] Add a friend lobby test that verifies invite copy feedback, compact participant readiness/status rows, and a clear host start action.
- [ ] Update the multiplayer final-results test away from exact firework counts and toward a restrained celebration contract: limited spark count, winner emphasis, and no map/roadview after finish.
- [ ] Run targeted Playwright tests and confirm the new assertions fail before implementation.

### Task 2: Simplify Home Into A Game Hub

**Files:**
- Modify: `apps/web/src/features/home/HomeScreen.tsx`
- Modify: `apps/web/src/styles.css`

- [ ] Persist `selectedMapId` to localStorage under a versioned key when the user changes maps.
- [ ] Add a compact hero command area: large map preview, current map name, difficulty/timer/round facts, nickname, and primary `시작`.
- [ ] Keep all 18 map choices accessible, but present them as a compact map rail instead of a heavy card grid.
- [ ] Convert friend room, daily challenge, leaderboard, and feedback into lower-weight hub rows/panels so they do not compete with starting the game.
- [ ] Preserve existing accessible labels: `닉네임`, `시작`, `방 만들기`, `방 코드`, `입장`, `랭킹 난이도`, and `마음의 소리`.

### Task 3: Make Gameplay More Map-First Without Changing Rules

**Files:**
- Modify: `apps/web/src/features/game/GameScreen.tsx`
- Modify: `apps/web/src/features/game/RoomGameScreen.tsx`
- Modify: `apps/web/src/styles.css`

- [ ] Keep Kakao Roadview visible and large, but give the guessing map a wider, more deliberate panel on desktop.
- [ ] Add concise instruction/status text in the map panel without adding long explanatory copy.
- [ ] Keep submit flow, timer gating, no-pano reporting, reveal, peer pin hiding, and score display behavior intact.
- [ ] Ensure mobile still stacks roadview, map, and submit without horizontal overflow.

### Task 4: Reduce Friend Room Friction

**Files:**
- Modify: `apps/web/src/features/game/RoomGameScreen.tsx`
- Modify: `apps/web/src/styles.css`

- [ ] Make the room code, invite link copy feedback, and start action the primary lobby path.
- [ ] Add participant status labels such as `준비`, `대기`, `방장`, and `나` using existing room/player state.
- [ ] Keep color selection available but visually compact and secondary.
- [ ] Preserve leave/back behavior and existing browser history room flow.

### Task 5: Restrain Celebration And Polish Responsiveness

**Files:**
- Modify: `apps/web/src/features/game/RoomGameScreen.tsx`
- Modify: `apps/web/src/styles.css`

- [ ] Replace click-amplified fireworks with a small, bounded celebration layer.
- [ ] Keep winner emphasis, final standings, round score history, and accessibility labels.
- [ ] Add `prefers-reduced-motion` protections for celebration and reveal animation.
- [ ] Audit compact desktop and mobile breakpoints for clipping, wrapping, and overflow.

### Task 6: Verify, Iterate, Commit, Push

**Commands:**
- `npm run typecheck`
- `npm run build`
- `npm run test:e2e -w @kr-geo-guess/web -- --project=desktop`
- `npm run test:e2e -w @kr-geo-guess/web -- --project=mobile`
- `npm run qa`

- [ ] Run the fast command sequence during implementation and fix all failures.
- [ ] Use Playwright screenshots for desktop and mobile visual review because the Browser plugin is not available in this session.
- [ ] Spawn a QA/review agent after implementation for independent inspection.
- [ ] Run full `npm run qa`.
- [ ] Commit all source/test/doc changes.
- [ ] Push to `origin/main`.
