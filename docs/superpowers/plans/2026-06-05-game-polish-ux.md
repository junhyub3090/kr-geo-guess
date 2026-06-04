# Game Polish UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing game feel more deliberate, readable, and fun without changing scoring, seed selection, room rules, or provider behavior.

**Architecture:** Keep domain/API logic unchanged. Add presentation-only UI signals in `apps/web`: a reusable round progress track, timer progress affordance, selected-pin feedback, reveal polish, and responsive motion safety. Use existing React, CSS, lucide, and Playwright patterns.

**Tech Stack:** React 19, Vite 6, TypeScript, CSS, Playwright.

---

### Task 1: Lock UI Polish Contracts

**Files:**
- Modify: `apps/web/tests/visual-qa.spec.ts`

- [x] Add a desktop Playwright contract for a visible round progress track, timer progress affordance, selected pin feedback, and completed-round score label after reveal.
- [x] Run the targeted test and confirm RED: it fails because `aria-label="라운드 진행 상황"` is not present.

### Task 2: Add Reusable Progress And Feedback Components

**Files:**
- Create: `apps/web/src/features/game/RoundProgressTrack.tsx`
- Modify: `apps/web/src/features/game/GameScreen.tsx`
- Modify: `apps/web/src/features/game/RoomGameScreen.tsx`
- Modify: `apps/web/src/styles.css`

- [x] Create a small presentation-only `RoundProgressTrack` that receives `roundCount`, `currentRoundNumber`, and completed scores.
- [x] Render it below the topbar in solo and active room game screens.
- [x] Add a timer progress layer inside timer metrics without changing timer calculations.
- [x] Add selected-pin classes to the map panel and submit button.
- [x] Add restrained reveal/marker animations with `prefers-reduced-motion` fallback.

### Task 3: Verify And Refine

**Files:**
- Modify as needed: `apps/web/src/styles.css`
- Modify as needed: `apps/web/tests/visual-qa.spec.ts`

- [x] Run the targeted Playwright test until it passes.
- [x] Run typecheck and build.
- [x] Run desktop/mobile Playwright QA for affected surfaces.
- [x] Use subagent review to catch UX, responsive, and code quality regressions.
- [x] Run full `npm run qa` before commit.
